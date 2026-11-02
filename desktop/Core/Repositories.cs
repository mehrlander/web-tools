namespace WebTools.Desktop;

public record RepositoryComparison(string? Branch, string State, int? Ahead, int? Behind);
public record RepositoryCheckout(string Key, string Name, string Branch, string? Upstream,
    int? Changed, int? Untracked, int? Conflicts, RepositoryComparison Tracked, RepositoryComparison Main);
public record RepositoryGroup(string Key, string Name, string? Url, DateTimeOffset? CheckedAt,
    DateTimeOffset? AttemptedAt, string? Notice, List<RepositoryCheckout> Checkouts);
public record RepositorySnapshot(int SchemaVersion, string MachineName, DateTimeOffset ObservedAt,
    List<RepositoryGroup> Repositories, List<string> Refreshing, string? Notice = null);
