// kits/write-kinds.js — what wrote a commit, read off the commit itself.
//
// Three writers share one GitHub identity in this estate: the Web Tools app,
// the phone (through Log-Repo in mehrlander/shortcut-tools), and a pull-request
// merge all commit as the account owner. Only a Claude session stands apart,
// authored as `Claude`. So `%an` answers almost nothing and the subject line is
// the signal, which is why the app's own messages are a contract rather than a
// courtesy (docs/show-repo.md, "What the app's own commits say").
//
// The split that matters is not who typed but WHAT KIND OF RECORD a commit is:
//
//   development history  a session, a merge, a person's own commit, CI
//   application state    the app's crawl, a tap in the app, the phone's log
//
// Both are real commits on a real branch. Nothing but this reading separates
// them, and the second kind is the one that surprises a reader of `git log`,
// because nobody deliberately made most of it: the crawl refreshes its caches
// on a tab-arrival kick, not only on the Refresh button.
//
// Every kind carries `sure`. Five read a signal the writer emits deliberately
// (an author name the platform sets, a subject this repo writes on purpose).
// `device` alone is a heuristic over an OBSERVED vocabulary, so it is marked
// unsure and a consumer may say so. A guess that cannot be told from a fact is
// the failure this field exists to prevent.
//
// Attaches window.WriteKinds. Pure: no network, no DOM, no clock.
(() => {
  // The app's four cache refreshes. These are exact: this repo writes them, in
  // app/index.html, and each names the derived file it rewrites.
  const CRAWL = /^(Update (config|activity|sessions) cache \(state\/[a-z]+\.json\)|Log .+ crawl calls \(state\/calls\.json\))/;
  // A write a PERSON made by tapping in the app. `show-repo` is the same
  // trailer under the app's old internal name and stays readable, since 608
  // commits already carry it and history keeps the name it was written with.
  const TAP = / via (Web Tools|show-repo)$/;
  // Both merge shapes GitHub produces: the merge commit and the squash.
  const MERGE = /^Merge (pull request|branch) |\(#\d+\)$/;
  // OBSERVED on 2026-09-08, not a contract: the subjects Log-Repo has actually
  // produced in the registry repo. A new op lands in `authored` until it is
  // added here, which is the honest failure direction.
  const DEVICE = /^(page report|probe-unattended|manifest|import|fetch|route|session-pick|capture|dump|probe|stage): /;

  // Order is the classifier. The two exact app signals go first, because a
  // crawl subject or a tap trailer settles the question outright; author tests
  // follow; the residual is `authored`, which claims nothing.
  const KINDS = [
    { key: 'crawl',    label: 'Crawl',    icon: 'ph-arrows-clockwise', state: true,  sure: true,
      what: "the app refreshing a derived cache, on a tab-arrival kick as much as on Refresh" },
    { key: 'tap',      label: 'Tap',      icon: 'ph-hand-tap',         state: true,  sure: true,
      what: 'a person acting in the app: a jot, a pin, a manifest save, a deposit' },
    { key: 'device',   label: 'Device',   icon: 'ph-device-mobile',    state: true,  sure: false,
      what: 'the phone logging through Log-Repo' },
    { key: 'session',  label: 'Session',  icon: 'ph-terminal-window',  state: false, sure: true,
      what: 'a Claude session, by the author the platform sets' },
    { key: 'merge',    label: 'Merge',    icon: 'ph-git-merge',        state: false, sure: true,
      what: 'a pull request landing' },
    { key: 'ci',       label: 'CI',       icon: 'ph-robot',            state: false, sure: true,
      what: 'a GitHub App or Action' },
    { key: 'authored', label: 'Authored', icon: 'ph-user',             state: false, sure: true,
      what: 'a person committing directly; the residual, which claims nothing' },
  ];
  const BY_KEY = Object.fromEntries(KINDS.map(k => [k.key, k]));

  // commit: { msg, author } — the shape lib/kits/repo-activity-cache.js stores
  // in recentCommits. Anything else returns `authored`, since a classifier that
  // throws on a short row would take a whole pane down with it.
  function classify(commit) {
    const msg = String(commit?.msg || '').split('\n')[0].trim();
    const author = String(commit?.author || '');
    let key = 'authored';
    if (CRAWL.test(msg)) key = 'crawl';
    else if (TAP.test(msg)) key = 'tap';
    else if (/\[bot\]$/.test(author)) key = 'ci';
    else if (author === 'Claude') key = 'session';
    else if (MERGE.test(msg)) key = 'merge';
    else if (DEVICE.test(msg)) key = 'device';
    return BY_KEY[key];
  }

  // Counts in KINDS order, so a caller renders a stable row rather than one
  // that reshuffles as the data changes. Zero-count kinds are kept: an absent
  // category and a category with nothing in it read differently.
  function tally(commits) {
    const out = Object.fromEntries(KINDS.map(k => [k.key, 0]));
    for (const c of commits || []) out[classify(c).key]++;
    return out;
  }

  // How much of a set is application state rather than development. The one
  // number this kit exists to make available, and the reason the pane's accent
  // marks that split and nothing else.
  function stateShare(commits) {
    const list = commits || [];
    if (!list.length) return 0;
    return list.filter(c => classify(c).state).length / list.length;
  }

  window.WriteKinds = { KINDS, BY_KEY, classify, tally, stateShare };
})();
