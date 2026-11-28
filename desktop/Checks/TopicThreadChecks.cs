using System.Text.Json;
using WebTools.Desktop;

public static class TopicThreadChecks
{
    private const string Parent = "aabbccdd", Url = "https://claude.ai/code/session_topic_fixture";
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-11-20T21:00:00Z");
    private static string Encode(object value) => JsonSerializer.Serialize(value);
    private static object Agenda(string topic, int first, int last, string kind = "improve") =>
        new { topic, turns = new[] { first, last }, kind, minor = false, area = "web-tools" };
    private static object Status(string topic, string? status, string? waits = null) =>
        new { topic, status, waits_on = waits, waiting = "Review the proposed choices", basis = "closing", evidence = "Published closing line" };
    private static string Rollup(DateTimeOffset? at = null) => Encode(new {
        version = 3, sessions = new Dictionary<string,object> { [Parent] = new {
            path = "sessions/topics/2026/11/2026-11-18-" + Parent + ".json",
            title = "Phone topics and related activity", summary = "The session improved topic visibility and preserved related work.",
            source_ended = at ?? Now.AddDays(-2), analyzed_at = Now.AddMinutes(-5), turn_count = 101,
            agenda = new[] { Agenda("Topic choices",0,1), Agenda("Build the interface",2,3), Agenda("Unclassified follow-up",4,5), Agenda("TOPIC CHOICES",6,7) },
            topic_status = new[] { Status("Topic choices","open","owner"), Status("Build the interface","open","session"), Status("Unclassified follow-up",null) }
        } }
    });
    private static KeyValuePair<string,string> Signal(string id, string url, string state, DateTimeOffset at, string prompt, string response = "") =>
        new($"sessions/activity/{at:yyyy-MM-dd}/{id}.json",Encode(new {
            schemaVersion = 1, id, provider = "Claude", location = "Cloud", agent = url,
            updatedAt = at, startedAt = at.AddMinutes(-1), state, title = prompt, prompt, response, lastTool = "Read"
        }));

    private static (CloudSnapshot Parsed, Dictionary<string,string> Signals) Scenario(int helpers = 35, int threads = 16)
    {
        var rows = new List<object> { new { id = Parent, title = "Original owner session", ask = "Owner request", agent = Url, ended = Now.AddDays(-2) } };
        var signals = new Dictionary<string,string>();
        void Add(KeyValuePair<string,string> signal) => signals[signal.Key] = signal.Value;
        Add(Signal(Parent,Url,"idle",Now.AddMinutes(-10),"Owner's original prompt","Owner's original reply"));
        for (var i = 1; i <= helpers; i++) {
            var id = i.ToString("x8");
            rows.Add(new { id, title = "", ask = "Review helper " + i, agent = Url, ended = Now.AddMinutes(-5) });
            Add(Signal(id,Url,i == 1 ? "working" : "idle",Now.AddSeconds(-20 - i),"Distinct related prompt " + i,"Distinct related reply " + i));
        }
        for (var i = 0; i < threads; i++) {
            var id = (0x1000 + i).ToString("x8");
            Add(Signal(id,"https://claude.ai/code/session_other_" + i,"idle",Now.AddSeconds(-60 - i),"Other provider thread " + i));
        }
        return (CloudSessions.Parse(Encode(new { generatedAt = Now, rows }),Now),signals);
    }
    private static CloudSnapshot Enrich(CloudSnapshot parsed) => SessionCheckpoints.Enrich(parsed,Rollup(),new Dictionary<string,string> {
        [Parent] = Encode(new { short_id = Parent, source_ended = Now.AddDays(-2), turns = new[] {
            new { turn = 100, headline = "Preserved preview", summary = "A meaningful published result remains visible.", facts = new { } }
        } })
    });
    private static PhoneSnapshot Phone(CloudSnapshot cloud, IEnumerable<string>? ids = null) => PhoneActivity.Create(new(
        new(Now,Now,"fixture",true,null,[]),new("unknown","",null),[],[],[],"Fixture Lenovo",Now,
        new([],[]),0,cloud,[],(ids ?? new[] { Parent,"00000001","00000002" }).Select(id => new ActivityChange(
            "cloud:" + id,"change-" + id,"Claude","Recorded activity","idle",Now,"","Cloud",null)).ToList()),Now);

    public static PhoneSnapshot Example()
    {
        var (parsed,signals) = Scenario(1,0);
        return Phone(CloudTurns.Merge(Enrich(parsed),signals,Now));
    }

    public static void Run(Action<bool,string> check)
    {
        var (parsed,signals) = Scenario();
        check(parsed.Items.Count == 35 && parsed.Catalog?.Any(s => s.Id == Parent) == true,
            "Published thread parents remain in the bounded seven-day catalog even when they are older than the current feed.");
        var originalSelection = CloudTurns.SelectionKey(signals,Now);
        var heartbeat = new Dictionary<string,string>(signals);
        var refreshed = Signal("00000001",Url,"working",Now.AddSeconds(-1),"A newer tool update");
        heartbeat[refreshed.Key] = refreshed.Value;
        check(CloudTurns.SelectionKey(heartbeat,Now) == originalSelection,
            "Repeated tool heartbeats in the same provider threads do not invalidate topic companion selection.");
        var added = Signal("feedbeef","https://claude.ai/code/session_new_thread","working",Now.AddSeconds(-1),"A newly relevant thread");
        heartbeat[added.Key] = added.Value;
        check(CloudTurns.SelectionKey(heartbeat,Now) != originalSelection,
            "A newly observed provider thread refreshes parent-companion selection even when the published record and topic blobs are unchanged.");
        var candidates = CloudTurns.TopicCandidates(parsed,signals,Now);
        check(SessionCheckpoints.Paths(Rollup(),candidates).ContainsKey(Parent),
            "Topic hydration reaches an older parent of a live provider thread before individual helper row caps.");
        var enriched = Enrich(parsed);
        var grouped = CloudTurns.Merge(enriched,signals,Now);
        var parent = grouped.Items.Single(s => s.SourceUrl == Url);
        check(grouped.Items.Count == 17 && parent.Id == Parent && parent.Title == "Phone topics and related activity",
            "Shared provider URLs group before the forty-thread cap and preserve the meaningful published parent identity.");
        check(parent is { State:"working", ActivityId:"00000001", Turn.Prompt:"Owner's original prompt", Turn.Response:"Owner's original reply" }
            && parent.Members?.Single(s => s.Id == "00000001").Turn?.Response == "Distinct related reply 1",
            "Actual active member signals supply thread activity while parent and member prompt/reply bodies retain their own provenance.");
        check(parent.MemberCount == 36 && parent.Members?.Count == 35 && parent.Checkpoint?.Headline == "Preserved preview",
            "The related count includes the canonical record without replacing the published preview.");
        var topics = parent.Checkpoint!.Topics!;
        check(topics.Count == 3 && topics[0] is { Topic:"Topic choices", Status:"open", WaitsOn:"owner", First:0, Last:3, Turns:4 }
            && topics[0].Spans.Count == 2 && topics[1] is { Status:"open", WaitsOn:"session" }
            && topics[2].Status is null,
            "Topic names join case-insensitively, preserve repeated spans and last-topic order, and distinguish who moves next from unknown status.");
        var phone = Phone(grouped);
        var item = phone.Items.Single(i => i.Id == Parent);
        check(item.ActivityKey == "cloud:00000001" && item.MemberCount == 36
            && item.Members?.Single(m => m.Key == "cloud:00000001").Turn?.Prompt == "Distinct related prompt 1"
            && item.RelatedKeys?.Contains("cloud:00000001") == true
            && phone.Changes!.Any(c => c.Key == "cloud:00000001")
            && phone.Changes!.Any(c => c.Key == "cloud:" + Parent),
            "Phone member bookmarks resolve exact observed records while related journal keys identify duplicate rows without losing their metadata fallback.");
        check(!JsonSerializer.Serialize(grouped).Contains("Catalog"),
            "The internal published-record catalog never enters desktop or phone JSON.");
        var serialized = JsonSerializer.Serialize(Example(),new JsonSerializerOptions(JsonSerializerDefaults.Web));
        check(serialized.Contains("\"waitsOn\":\"owner\"") && serialized.Contains("\"activityKey\":\"cloud:00000001\"")
            && serialized.Contains("\"memberCount\":2"),
            "The additive phone DTO serializes topic dispositions and related-record provenance with stable camel-case names.");
        var legacy = Rollup().Replace("\"topic_status\"", "\"old_topic_status\"");
        var legacyItem = SessionCheckpoints.Enrich(parsed,legacy,new Dictionary<string,string>()).Catalog!.Single(s => s.Id == Parent);
        check(legacyItem.Checkpoint!.Topics!.All(t => t.Status is null),
            "Older topic formats retain topic names while missing status remains unknown rather than done.");
        var invalid = Rollup().Replace("\"status\":\"open\"", "\"status\":\"blocked\"");
        check(SessionCheckpoints.Enrich(parsed,invalid,new Dictionary<string,string>()).Catalog!.Single(s => s.Id == Parent)
            .Checkpoint!.Topics!.All(t => t.Status is null),
            "Unknown status vocabulary is not promoted to an actionable topic disposition.");
        var terminal = Rollup().Replace("\"status\":\"open\"", "\"status\":\"done\"");
        check(SessionCheckpoints.Enrich(parsed,terminal,new Dictionary<string,string>()).Catalog!.Single(s => s.Id == Parent)
            .Checkpoint!.Topics!.Where(t => t.Status == "done").All(t => t.WaitsOn is null && t.Waiting.Length == 0),
            "Completed topics do not keep stale waiting-party labels.");
        var malformed = Rollup().Replace("[0,1]","[\"wrong\",1]");
        check(SessionCheckpoints.Enrich(parsed,malformed,new Dictionary<string,string>()).Catalog!.Single(s => s.Id == Parent)
            .Checkpoint!.Topics!.Count == 3,
            "Malformed agenda ranges are ignored without losing the remaining topic account.");
        var many = Encode(new { sessions = new Dictionary<string,object> { [Parent] = new {
            source_ended = Now.AddDays(-2), agenda = Enumerable.Range(0,45).Select(i => Agenda("Topic " + i,i,i)).ToArray()
        } } });
        var capped = SessionCheckpoints.Enrich(parsed,many,new Dictionary<string,string>()).Catalog!.Single(s => s.Id == Parent).Checkpoint!;
        check(capped.TopicsPartial && capped.Topics!.Count == 32 && capped.Topics.Any(t => t.Topic == "Topic 44" && t.Last == 44),
            "Large topic accounts signal their cap and preserve the most recent topic as well as early context.");
        var (largeRecords,largeSignals) = Scenario(150,55);
        var large = CloudTurns.Merge(Enrich(largeRecords),largeSignals,Now);
        check(large.Items.Count == CloudThreads.MaximumThreads && large.Items.All(i => (i.Members?.Count ?? 0) <= CloudThreads.MaximumMembersPerThread)
            && large.Items.Sum(i => i.Members?.Count ?? 0) <= CloudThreads.MaximumMembers
            && large.Items.Single(i => i.SourceUrl == Url).MemberCount == 151,
            "Thread and member bounds apply after grouping, expose total related counts and retain source records without unbounded phone bodies.");
        var cappedPhone = Phone(large,new[] { Parent,"0000008c" });
        var cappedParent = cappedPhone.Items.Single(i => i.SessionUrl == Url);
        check(cappedParent.Members!.All(i => i.Key != "cloud:0000008c")
            && cappedParent.RelatedKeys!.Contains("cloud:0000008c")
            && cappedPhone.Changes!.Single(i => i.Key == "cloud:0000008c").Title == "Recorded activity",
            "A related body beyond the cap retains its original bounded change fallback instead of aliasing the parent's prompt or disappearing.");
        var foreign = new[] { new LocalSession("one","Claude","One","idle",Now,"",Location:"Cloud",SourceUrl:"https://evil.example/thread"),
            new LocalSession("two","Claude","Two","idle",Now,"",Location:"Cloud",SourceUrl:"https://evil.example/thread") };
        check(CloudThreads.Group(foreign,[],[]).Count == 2,
            "Unvalidated shared addresses never establish provider-thread identity.");
    }
}
