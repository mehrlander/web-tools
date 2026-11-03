namespace WebTools.Desktop;

public record RepositoryComparison(string? Branch, string State, int? Ahead, int? Behind);
public record RepositoryLocalEntry(string Key, string Path, string Kind, string GitState,
    long? Bytes, int? Files, DateTimeOffset? ModifiedAt, bool Partial, string? Role);
public record RepositoryFileInventory(string Key, string Name, DateTimeOffset ObservedAt, string State,
    List<RepositoryLocalEntry> Entries, bool Partial, string? Notice);
public record RepositoryLocalFiles(int SchemaVersion, string MachineName, DateTimeOffset ObservedAt,
    List<RepositoryFileInventory> Checkouts);
public record RepositoryCheckout(string Key, string Name, string Branch, string? Upstream,
    int? Changed, int? Untracked, int? Conflicts, RepositoryComparison Tracked, RepositoryComparison Main,
    RepositoryFileInventory? LocalFiles = null);
public record RepositoryGroup(string Key, string Name, string? Url, DateTimeOffset? CheckedAt,
    DateTimeOffset? AttemptedAt, string? Notice, List<RepositoryCheckout> Checkouts);
public record RepositorySnapshot(int SchemaVersion, string MachineName, DateTimeOffset ObservedAt,
    List<RepositoryGroup> Repositories, List<string> Refreshing, string? Notice = null);
