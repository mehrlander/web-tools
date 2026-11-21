using System.Text;
using System.Text.Json;
using WebTools.Desktop;

static class SyncHealthChecks
{
    private sealed class Source
    {
        public DateTimeOffset Now = DateTimeOffset.Parse("2026-11-21T12:00:00Z");
        public string Index = "index", Rollup = "rollup", Tree = "tree";
        public string? SessionJson, RollupJson, CompanionJson;
        public bool Missing, Oversized, FailBackground;
        public int BackgroundSeconds, BackgroundFetches, BlobReads;
        public TaskCompletionSource<bool>? SummaryRelease;
        public TaskCompletionSource<bool> SummaryStarted = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public List<(string Command,int Timeout)> Calls = [];
        public readonly string Path = "sessions/topics/2026/11/2026-11-21-cloud-1.json";
        public readonly DateTimeOffset Published = DateTimeOffset.Parse("2026-11-21T11:59:00Z");
        public string Companion(string id = "cloud-1", DateTimeOffset? at = null) => JsonSerializer.Serialize(new {
            short_id=id,source_ended=at??Published,turns=new[]{new{turn=0,headline="Saved checkpoint",summary="Recorded result"}}
        });
        public Task<byte[]> Run(string[] args, byte[]? input, int timeout)
        {
            Calls.Add((args[0],timeout));
            if(args[0]=="fetch") {
                if(args[^1].Contains("/background:")) {
                    BackgroundFetches++;Now=Now.AddSeconds(BackgroundSeconds);
                    if(FailBackground)throw new CommandFailureException(CommandFailureKind.TimedOut,null,45000,45);
                }
                return Task.FromResult(Array.Empty<byte>());
            }
            string Value(string sha) => sha switch {
                "request" => "{\"title\":\"Fixture\",\"run\":{\"method\":\"laptop-daemon\"}}",
                "companion" => CompanionJson??Companion(),
                _ when sha==Index => SessionJson??JsonSerializer.Serialize(new {generatedAt=Published,rows=new[]{new{id="cloud-1",agent="https://claude.ai/code/session_fixture",ended=Published,title="Fixture"}}}),
                _ when sha==Rollup => RollupJson??JsonSerializer.Serialize(new {sessions=new Dictionary<string,object>{["cloud-1"]=new{path=Path,source_ended=Published,summary="Saved checkpoint"}}}),
                _ => throw new IOException()
            };
            string output;
            if(args[0]=="rev-parse") output=args[^1] switch {
                "refs/remotes/origin/main:state/sessions.json"=>Index,
                "base:state/session-topics.json"=>Rollup,
                "base:sessions/topics"=>Tree,
                _=>"base"
            };
            else if(args[0]=="ls-tree") output=args.Contains("sessions/topics")
                ? Missing?"":$"100644 blob companion {(Oversized?2097153:Encoding.UTF8.GetByteCount(Value("companion")))}\t{Path}\n"
                : "100644 blob request\terrands/requests/job.json\n";
            else if(args is ["cat-file","blob",var sha]){
                BlobReads++;output=Value(sha);
                if(sha==Rollup&&SummaryRelease is not null) {
                    SummaryStarted.TrySetResult(true);
                    return SummaryRelease.Task.ContinueWith(_=>Encoding.UTF8.GetBytes(output),TaskScheduler.Default);
                }
            }
            else if(args is ["cat-file","--batch"]){
                BlobReads++;using var bytes=new MemoryStream();
                foreach(var batchSha in Encoding.ASCII.GetString(input!).Split('\n',StringSplitOptions.RemoveEmptyEntries)) {
                    var body=Encoding.UTF8.GetBytes(Value(batchSha));
                    bytes.Write(Encoding.ASCII.GetBytes($"{batchSha} blob {body.Length}\n"));bytes.Write(body);bytes.WriteByte((byte)'\n');
                }
                return Task.FromResult(bytes.ToArray());
            }else throw new IOException();
            return Task.FromResult(Encoding.UTF8.GetBytes(output));
        }
    }

    public static async Task Run(Action<bool,string> check)
    {
        var directory=System.IO.Path.Combine(System.IO.Path.GetTempPath(),"web-tools-sync-health-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try {
            var source=new Source();var reader=new ErrandReader(directory,()=>source.Now,source.Run);
            var snapshot=await reader.Read(default,force:true);
            check(reader.Health is{Errands.State:"ok",Sessions.State:"ok",Summaries.State:"ok"},"Synthetic Git validates three independent feed completions.");
            var reads=source.BlobReads;source.Now=source.Now.AddSeconds(1);await reader.Synchronize(force:true);
            check(source.BlobReads==reads&&reader.Health.Summaries.SucceededAt==source.Now,"Unchanged immutable index, rollup, companion tree and selection advance health without rereading blobs.");
            check(source.Calls.Where(c=>c.Command=="fetch").All(c=>c.Timeout==45)&&source.Calls.Where(c=>c.Command!="fetch").All(c=>c.Timeout==25),"Only remote fetches receive the longer deadline.");
            source.Now=source.Now.AddSeconds(5);source.FailBackground=true;source.BackgroundSeconds=45;await reader.Synchronize();
            var attempts=source.BackgroundFetches;var due=reader.Health.Errands.NextAttemptAt;
            await reader.Synchronize();
            check(source.BackgroundFetches==attempts&&reader.Health.Summaries.NextAttemptAt==due&&reader.Health.Sessions.State=="ok", "An overdue summary cannot bypass a background failure cooldown after a slow fetch.");
            source.Now=due!.Value;source.FailBackground=false;source.BackgroundSeconds=0;await reader.Synchronize();
            check(reader.Health.Errands.ErrorCode is null&&reader.Health.Summaries.ErrorCode is null,"Due automatic retries recover feed health.");
            async Task FailedSummary(string expected,string message){source.Tree+="x";await reader.Synchronize(force:true);check(reader.Health.Summaries.ErrorCode==expected&&reader.Cloud.Items.Single().Checkpoint?.Headline=="Saved checkpoint"&&reader.Health.Sessions.State=="ok",message);}
            source.Missing=true;await FailedSummary("read-failed","Missing intended companions preserve usable detail under a separate summary read failure.");
            source.Missing=false;source.Oversized=true;await FailedSummary("read-failed","Oversized intended companions cannot silently clear saved detail or report healthy enrichment.");
            source.Oversized=false;source.CompanionJson=source.Companion("wrong-id");await FailedSummary("invalid-data","A valid JSON companion with the wrong identifier retains the last matched detail.");
            source.CompanionJson=source.Companion(at:source.Published.AddSeconds(-1));await FailedSummary("invalid-data","A mismatched companion source timestamp is an invalid refresh.");
            source.CompanionJson=null;source.Tree+="x";await reader.Synchronize(force:true);
            check(reader.Health.Summaries is{State:"ok",ErrorCode:null},"A matching repaired companion recovers summary health.");
            source.RollupJson="{}";source.Rollup+="bad";await reader.Synchronize(force:true);
            check(reader.Health.Summaries.ErrorCode=="invalid-data"&&reader.Cloud.Items.Single().Checkpoint is not null,"A structurally invalid summary rollup preserves its last usable enrichment.");
            source.RollupJson=null;source.Rollup+="fixed";await reader.Synchronize(force:true);
            var updatedCapture=source.Published.AddSeconds(30);
            source.Index+="updated";source.Rollup+="updated";
            source.SessionJson=JsonSerializer.Serialize(new {generatedAt=updatedCapture,rows=new[]{new{id="cloud-1",agent="https://claude.ai/code/session_fixture",ended=updatedCapture,title="Updated history"}}});
            source.SummaryRelease=new(TaskCreationOptions.RunContinuationsAsynchronously);
            var paused=reader.Synchronize(force:true);
            await source.SummaryStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
            check(reader.Health.Sessions.State=="ok"&&reader.Cloud.CapturedAt==updatedCapture&&reader.Cloud.Items.Single().Title=="Updated history",
                "Session success publishes its matching capture and rows before slow independent summary work completes.");
            source.SummaryRelease.TrySetResult(true);await paused;source.SummaryRelease=null;
            source.Index+="bad";source.SessionJson="{broken";await reader.Synchronize(force:true);
            check(reader.Health.Sessions.ErrorCode=="invalid-data"&&reader.Cloud.CapturedAt==updatedCapture&&reader.Cloud.Items.Count==1,"A corrupt session index retains published capture time and usable saved sessions.");
            var before=await reader.Read(default,synchronize:false);Directory.Delete(directory);
            var missing=await reader.Read(default,synchronize:false);
            check(missing.Errands.Count==before.Errands.Count&&missing.Revision==before.Revision&&missing.SyncedAt==before.SyncedAt&&missing.Sync?.Errands.ErrorCode=="repository-unavailable","A missing checkout retains cached queue identity and successful sync metadata.");
        }finally{if(Directory.Exists(directory))Directory.Delete(directory);}
    }
}
