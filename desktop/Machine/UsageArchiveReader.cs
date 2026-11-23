using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace WebTools.Desktop;

// Only the derived aggregate document is served, never a database or a caller path.
public static class UsageArchiveReader
{
    public const int MaximumBytes = 8 * 1024 * 1024;
    private const double MaximumCounter = 9_007_199_254_740_991;

    public static byte[]? Read()
    {
        try {
            var path = Path.Combine(UserSettings.DataDirectory, "phone-usage-history.json");
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete);
            if (stream.Length is <= 0 or > MaximumBytes) return null;
            var bytes = new byte[(int)stream.Length];
            stream.ReadExactly(bytes);
            // Atomic writers keep a read on one complete inode; a different writer
            // extending a file is still rejected instead of serving a prefix.
            if (stream.ReadByte() != -1) return null;
            using var document = JsonDocument.Parse(bytes, new JsonDocumentOptions { MaxDepth = 16 });
            return Archive(document.RootElement) ? bytes : null;
        } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException) {
            return null;
        }
    }

    private static bool Shape(JsonElement value, string allowed, string required = "")
    {
        if (value.ValueKind != JsonValueKind.Object) return false;
        var names = allowed.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var field in value.EnumerateObject())
            if (!names.Contains(field.Name) || !seen.Add(field.Name)) return false;
        return required.Split(' ', StringSplitOptions.RemoveEmptyEntries).All(seen.Contains);
    }
    private static bool Has(JsonElement value, string name, Func<JsonElement, bool> valid) => value.TryGetProperty(name, out var field) && valid(field);
    private static bool Optional(JsonElement value, string name, Func<JsonElement, bool> valid) => !value.TryGetProperty(name, out var field) || valid(field);
    private static bool NullOr(JsonElement value, Func<JsonElement, bool> valid) => value.ValueKind == JsonValueKind.Null || valid(value);
    private static bool Text(JsonElement value, int maximum = 180) => value.ValueKind == JsonValueKind.String && value.GetString() is { } text
        && text.Length is > 0 && text.Length <= maximum && !text.Any(char.IsControl)
        && !Regex.IsMatch(text, @"(?:(?<![A-Za-z])[A-Za-z]:[\\/]|\\\\|/Users/|/home/)");
    private static bool Is(JsonElement value, params string[] choices) => value.ValueKind == JsonValueKind.String && choices.Contains(value.GetString(), StringComparer.Ordinal);
    private static bool Provider(JsonElement value) => Is(value, "codex", "gemini", "claude");
    private static bool Number(JsonElement value, double maximum = MaximumCounter, bool integer = false) => value.ValueKind == JsonValueKind.Number
        && value.TryGetDouble(out var number) && double.IsFinite(number) && number >= 0 && number <= maximum && (!integer || number == Math.Floor(number));
    private static bool Count(JsonElement value) => Number(value, integer: true);
    private static bool Boolean(JsonElement value) => value.ValueKind is JsonValueKind.True or JsonValueKind.False;
    private static bool Stamp(JsonElement value) => Text(value, 50) && Regex.IsMatch(value.GetString()!, @"^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$")
        && DateTimeOffset.TryParse(value.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    private static bool Day(JsonElement value) => Text(value, 10) && DateOnly.TryParseExact(value.GetString(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    private static bool Bucket(JsonElement value) => Text(value, 160) && Regex.IsMatch(value.GetString()!, @"^[A-Za-z0-9_.:-]{1,160}$");
    private static bool Array(JsonElement value, int maximum, Func<JsonElement, bool> valid) => value.ValueKind == JsonValueKind.Array
        && value.GetArrayLength() <= maximum && value.EnumerateArray().All(valid);

    private static bool Archive(JsonElement value) => Shape(value,
        "schemaVersion updatedAt periods tokenDays codexTokenStatus dailyAllowance adjustments sourceCount sessionUsage",
        "schemaVersion updatedAt periods tokenDays dailyAllowance adjustments sourceCount sessionUsage")
        && Has(value, "schemaVersion", field => field.ValueKind == JsonValueKind.Number && field.TryGetInt32(out var schema) && schema == 1)
        && Has(value, "updatedAt", Stamp) && Has(value, "periods", field => Array(field, 10000, Period))
        && Has(value, "tokenDays", field => Array(field, 10000, TokenDay))
        && Optional(value, "codexTokenStatus", field => Is(field, "available", "unavailable"))
        && Has(value, "dailyAllowance", Daily) && Has(value, "adjustments", field => Array(field, 10000, Adjustment))
        && Has(value, "sourceCount", field => Number(field, 8, true)) && Has(value, "sessionUsage", Sessions);

    private static bool Period(JsonElement value) => Shape(value,
        "provider bucket reset minutes label first_at last_at peak last_used samples",
        "provider bucket reset minutes label first_at last_at peak last_used samples")
        && Has(value, "provider", Provider) && Has(value, "bucket", Bucket) && Has(value, "reset", Stamp)
        && Has(value, "minutes", field => NullOr(field, field => Number(field, 525600) && field.GetDouble() > 0))
        && Has(value, "label", field => Text(field, 160)) && Has(value, "first_at", Stamp) && Has(value, "last_at", Stamp)
        && Has(value, "peak", field => Number(field, 100)) && Has(value, "last_used", field => Number(field, 100)) && Has(value, "samples", Count);
    private static bool TokenDay(JsonElement value) => Shape(value, "provider day tokens observed_at", "provider day tokens observed_at")
        && Has(value, "provider", Provider) && Has(value, "day", Day) && Has(value, "tokens", Count) && Has(value, "observed_at", Stamp);
    private static bool Daily(JsonElement value) => Shape(value, "schemaVersion timezone updatedAt days providers", "schemaVersion timezone updatedAt days providers")
        && Has(value, "schemaVersion", field => field.ValueKind == JsonValueKind.Number && field.TryGetInt32(out var schema) && schema == 1)
        && Has(value, "timezone", field => Text(field, 100)) && Has(value, "updatedAt", Stamp)
        && Has(value, "days", field => Array(field, 90, Day)) && Has(value, "providers", field => Array(field, 3, DailyProvider));
    private static bool DailyProvider(JsonElement value) => Shape(value, "provider firstAt lastAt days", "provider firstAt lastAt days")
        && Has(value, "provider", Provider) && Has(value, "firstAt", field => NullOr(field, Stamp)) && Has(value, "lastAt", field => NullOr(field, Stamp))
        && Has(value, "days", field => Array(field, 90, DailyDay));
    private static bool DailyDay(JsonElement value) => Shape(value,
        "day points state coverage estimated today reasons resets restores restoredPoints unallocated seconds expectedSeconds",
        "day points state coverage estimated today reasons resets restores restoredPoints unallocated seconds expectedSeconds")
        && Has(value, "day", Day) && Has(value, "points", field => NullOr(field, field => Number(field)))
        && Has(value, "state", field => Is(field, "missing", "partial", "observed")) && Has(value, "coverage", field => Number(field, 1))
        && Has(value, "estimated", Boolean) && Has(value, "today", Boolean)
        && Has(value, "reasons", field => Array(field, 16, reason => Is(reason, "allowance-restored", "overnight-gap", "reset-tail", "reported-decrease", "correction-recovery", "period-change", "bucket-change")))
        && new[] { "resets", "restores", "seconds", "expectedSeconds" }.All(name => Has(value, name, Count))
        && Has(value, "restoredPoints", field => Number(field)) && Has(value, "unallocated", field => Number(field));
    private static bool Adjustment(JsonElement value) => Shape(value,
        "id before_at at before_reset reset before after drop provider bucket label minutes confirmed_restore restore_label confirmation",
        "id before_at at before_reset reset before after drop provider bucket label minutes")
        && Has(value, "id", field => Text(field, 80) && Regex.IsMatch(field.GetString()!, @"^allowance-decrease:[a-f0-9]{24}$"))
        && new[] { "before_at", "at", "before_reset", "reset" }.All(name => Has(value, name, Stamp))
        && new[] { "before", "after", "drop" }.All(name => Has(value, name, field => Number(field, 100)))
        && Has(value, "provider", Provider) && Has(value, "bucket", Bucket) && Has(value, "label", field => Text(field, 160))
        && Has(value, "minutes", field => Number(field, 525600) && field.GetDouble() > 0)
        && Optional(value, "confirmed_restore", Boolean) && Optional(value, "restore_label", field => Is(field, "Fable", "Manual"))
        && Optional(value, "confirmation", field => Is(field, "owner-report"));
    private static bool Sessions(JsonElement value) => Shape(value,
        "schemaVersion observedAt revision available partial source lookbackHours fallbackDays indexGeneratedAt sessions notice",
        "schemaVersion available sessions")
        && Has(value, "schemaVersion", field => field.ValueKind == JsonValueKind.Number && field.TryGetInt32(out var schema) && schema == 1)
        && Has(value, "available", Boolean) && Has(value, "sessions", field => Array(field, 512, Session))
        && Optional(value, "observedAt", field => NullOr(field, Stamp)) && Optional(value, "indexGeneratedAt", field => NullOr(field, Stamp))
        && Optional(value, "revision", field => NullOr(field, field => Text(field, 64) && Regex.IsMatch(field.GetString()!, @"^[a-f0-9]{40,64}$")))
        && Optional(value, "partial", Boolean) && Optional(value, "source", field => Is(field, "Recorded Claude Code usage extracts"))
        && Optional(value, "lookbackHours", field => Number(field, 24, true)) && Optional(value, "fallbackDays", field => Number(field, 62, true))
        && Optional(value, "notice", field => NullOr(field, field => Text(field, 300)));
    private static bool Session(JsonElement value) => Shape(value,
        "id agentSessionId provider title sessionUrl contextTokens usageAt cacheReadTokens cacheWriteTokens inputTokens outputTokens measuredSteps reloads",
        "id agentSessionId provider title sessionUrl contextTokens usageAt cacheReadTokens cacheWriteTokens inputTokens outputTokens measuredSteps reloads")
        && Has(value, "id", field => Text(field, 80) && Regex.IsMatch(field.GetString()!, @"^(?:\d{4}-\d{2}-\d{2}-)?[a-f0-9]{8}$"))
        && Has(value, "provider", field => Is(field, "claude")) && Has(value, "title", field => Text(field, 180)) && Has(value, "usageAt", Stamp)
        && Has(value, "agentSessionId", field => NullOr(field, field => Text(field, 150) && Regex.IsMatch(field.GetString()!, @"^session_[A-Za-z0-9_-]+$")))
        && Has(value, "sessionUrl", field => field.ValueKind == JsonValueKind.Null || Text(field, 180)
            && value.GetProperty("agentSessionId").ValueKind == JsonValueKind.String && field.GetString() == "https://claude.ai/code/" + value.GetProperty("agentSessionId").GetString())
        && new[] { "contextTokens", "cacheReadTokens", "cacheWriteTokens", "inputTokens", "outputTokens", "measuredSteps", "reloads" }.All(name => Has(value, name, Count));
}
