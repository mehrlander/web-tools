// The Overview of a project that declares an installation manifest, and the
// Installation pill of the project view until 2026-09-14: one workspace's
// PowerShell material, each file with where it is meant to go under the work
// installation and what has been observed about the copy there. The subject
// is a machine with no Git checkout, so every fact about it arrives by hand:
// a pasted or dropped work copy (the Compare copy flow, lib/kits/
// file-correspondence.js, which stays browser-local), or a confirmed "I placed
// this on the work computer", which lib/kits/installation.js appends to the
// workspace's observations.csv. The derivation is the kit's; this file is the
// surface, and its one rule is that no gesture but the confirm writes.
//
// Mounts by the crumb-bar idiom (template injected in init, then initTree),
// reads the open project from the argument the pane passes, and reaches the
// shell for the comparison hand-off and the Files view.
document.addEventListener('alpine:init', function () {
  Alpine.data('installationView', function (project) {
    const K = () => window.Installation;
    const short = sha => String(sha || '').slice(0, 7);
    const when = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      return isNaN(d) ? iso : d.toISOString().slice(0, 10);
    };
    const BADGE = {
      unknown: 'badge-ghost', reported: 'badge-info', verified: 'badge-success', changed: 'badge-warning',
      differs: 'badge-warning', 'differs-changed': 'badge-warning', 'repo-only': 'badge-neutral badge-outline',
    };
    const store = () => window.Alpine.store('browser');
    const shell = () => window.__shell;
    const pill = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-base font-medium transition-colors';

    return {
      description: 'The Overview of a workspace declaring an installation manifest (the Installation pill until 2026-09-14): its PowerShell files grouped by Profile, Modules, Forms and Scripts, each with its intended location under the work installation, its state read from the durable observations ledger (reported installed, verified from supplied copy, GitHub changed since, local copy differs, local state unknown), the areas known only locally, and the actions on a selected file: compare a work copy, copy or download the GitHub text, record a placement after the fact, promote a browser check to the ledger, reverify, and open the Stage.',

      project,
      repo: '', ref: '', revision: '', ledgerPath: '', manifest: null,
      items: [], groups: [], derived: {}, rows: [], checks: [],
      loading: true, err: '',
      filter: '',                 // '' or a state key
      selected: '',               // the selected item's repo path
      text: '', textBusy: false,  // the selected file's GitHub text, fetched on demand
      ideTab: 'code',             // 'code' | 'split' | 'diff' | 'ledger' | 'patterns'
      inspectorTab: 'symbols',    // 'symbols' | 'transfer'
      activeAst: null,            // AST for active file
      companionText: '',          // text of item.companion
      companionAst: null,         // AST for companion file
      crossRef: null,             // XAML + PS cross-reference
      transfer: null,             // { winPath, verifyCmd, installCmd, headerSnippet }
      currentSha256: '',          // SHA-256 of currently selected GitHub file
      loadRequestId: 0,           // token to drop stale async fetch results
      patternCategory: '',
      compareOpen: false, compareDraft: '', compareEncoding: 'auto', compareBusy: false, compareError: '',
      lastTransfer: {},           // path -> 'copy' | 'download', the method a later confirm reports
      pending: null,              // { row, line, why } awaiting the confirm
      recordNote: '', recording: false, recordError: '', recorded: null,
      openHistory: true,

      template: `
        <div class="@container flex flex-col gap-4" data-installation>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <i class="ph ph-desktop text-xl text-base-content/50"></i>
            <!-- The work machine heads this view. "Installation" was the pill's
                 label, and the pill became a workspace's Overview on
                 2026-09-14; the breadcrumb above already names the workspace. -->
            <h2 class="text-lg font-semibold font-mono" x-text="root || 'Installation'"></h2>
            <a x-show="docUrl" :href="docUrl" target="_blank" rel="noopener"
               class="link link-hover text-base">the installation map</a>
            <div class="grow"></div>
            <span x-show="!loading" class="font-mono text-xs text-base-content/50" x-text="headline"></span>
            <div class="flex items-center gap-1">
              <select x-model="filter" class="select select-bordered select-sm" aria-label="Filter by state">
                <option value="">every state</option>
                <template x-for="s in states" :key="s.key">
                  <option :value="s.key" x-text="s.label + ' · ' + s.count"></option>
                </template>
              </select>
              <button @click="reload()" class="btn btn-ghost btn-sm btn-square" title="Reload">
                <i class="ph ph-arrows-clockwise text-base"></i></button>
            </div>
          </div>
          <p x-show="err" class="text-error text-base" x-text="err"></p>
          <div x-show="loading" class="flex justify-center py-16"><span class="loading loading-dots loading-md opacity-30"></span></div>

          <div x-show="!loading" class="grid gap-6 @3xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <!-- The corpus: areas, units, files. Hidden on a narrow pane while a file is open. -->
            <div class="flex flex-col gap-5 min-w-0" :class="selected ? 'hidden @3xl:flex' : 'flex'">
              <template x-for="g in visibleGroups" :key="g.area">
                <section>
                  <h3 class="flex items-baseline gap-2 text-sm font-mono uppercase tracking-widest text-base-content/50 mb-1.5">
                    <span x-text="g.area"></span>
                    <span class="normal-case tracking-normal text-base-content/40" x-text="destinationOf(g)"></span>
                  </h3>
                  <div class="flex flex-col gap-2">
                    <template x-for="u in g.units" :key="u.name">
                      <div class="rounded-lg border border-base-300 px-2 py-1.5">
                        <div x-show="u.name !== g.area" class="text-base font-medium px-1" x-text="u.name"></div>
                        <div class="flex flex-col">
                          <template x-for="it in u.files" :key="it.path">
                            <!-- flex-wrap with a floor on the name: a narrow pane
                                 drops the badge to a second line rather than
                                 eating the filename. -->
                            <button @click="select(it.path)"
                                    class="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 py-1 rounded text-left text-base hover:bg-base-200 min-w-0"
                                    :class="selected === it.path && 'bg-primary/10'">
                              <i class="ph text-base-content/50 shrink-0" :class="iconOf(it)"></i>
                              <span class="truncate grow min-w-40 basis-0" x-text="it.name"></span>
                              <span class="badge badge-sm whitespace-nowrap shrink-0" :class="badgeOf(it.path)" x-text="stateOf(it.path).label"></span>
                              <span class="font-mono text-xs text-base-content/40 tabular-nums w-20 text-right hidden @md:inline" x-text="when(stateOf(it.path).latest?.date)"></span>
                            </button>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                </section>
              </template>
              <!-- The areas the work computer holds and GitHub does not. The
                   manifest carries each one's name, status and shape; why it
                   carries that status is in the document the header links, so
                   a row here stays one line of facts rather than a card of
                   policy prose repeated from there. -->
              <section x-show="!filter && localAreas.length">
                <h3 class="flex items-baseline gap-2 text-sm font-mono uppercase tracking-widest text-base-content/50 mb-1.5">
                  <span>Local areas</span>
                  <span class="normal-case tracking-normal text-base-content/40">no repository counterpart</span>
                </h3>
                <div class="rounded-lg border border-dashed border-base-300 px-2 py-1">
                  <template x-for="(a, i) in localAreas" :key="a.name">
                    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1 py-1"
                         :class="i && 'border-t border-base-200'">
                      <i class="ph ph-folder-dashed text-base-content/40 shrink-0"></i>
                      <span class="font-mono text-base" x-text="a.name"></span>
                      <span class="badge badge-sm badge-ghost shrink-0" x-text="a.status === 'local-only' ? 'local only' : 'unresolved'"></span>
                      <span class="text-base text-base-content/60" x-text="a.shape"></span>
                    </div>
                  </template>
                </div>
              </section>
            </div>

            <!-- The selected file: where it goes, what is known, what to do next. -->
            <div class="min-w-0" :class="selected ? 'block' : 'hidden @3xl:block'">
              <template x-if="!item">
                <p class="text-base-content/40 italic text-base py-8">Select a file to see its intended location, its observations, and the actions on it.</p>
              </template>
              <template x-if="item">
                <div class="flex flex-col gap-4">
                  <div class="flex items-start gap-2">
                    <button @click="select('')" class="btn btn-ghost btn-sm btn-square @3xl:hidden" title="Back">
                      <i class="ph ph-arrow-left text-base"></i></button>
                    <div class="min-w-0 grow">
                      <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-lg font-semibold truncate" x-text="item.name"></h3>
                        <span class="badge" :class="badgeOf(item.path)" x-text="stateOf(item.path).label"></span>
                      </div>
                      <div class="font-mono text-base text-base-content/60 break-all" x-text="item.path + ' · ' + short(item.blobSha)"></div>
                    </div>
                  </div>
                  <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-base">
                    <dt class="text-base-content/50">installs to</dt>
                    <dd class="font-mono break-all" x-text="destinationOfItem(item)"></dd>
                    <template x-if="item.companion">
                      <dt class="text-base-content/50">companion</dt></template>
                    <template x-if="item.companion">
                      <dd><button @click="select(item.companion)" class="link link-hover font-mono" x-text="item.companion.split('/').pop()"></button>
                        <span class="badge badge-sm ml-1" :class="badgeOf(item.companion)" x-text="stateOf(item.companion).label"></span></dd></template>
                    <dt class="text-base-content/50">GitHub now</dt>
                    <dd class="font-mono" x-text="short(revision) + ' on ' + ref"></dd>
                    <dt class="text-base-content/50">last observed</dt>
                    <dd x-text="observedLine(item)"></dd>
                  </dl>

                  <div class="flex flex-wrap gap-1.5">
                    <button x-show="item.comparable" @click="toggleCompare()" class="btn btn-sm gap-1" :class="compareOpen ? 'btn-primary' : 'btn-outline'">
                      <i class="ph ph-git-diff text-base"></i>Compare copy</button>
                    <button @click="copyText()" class="btn btn-outline btn-sm gap-1" :disabled="!!textBusy">
                      <i class="ph ph-copy text-base"></i>Copy GitHub text</button>
                    <button @click="downloadText()" class="btn btn-outline btn-sm gap-1" :disabled="!!textBusy">
                      <i class="ph ph-download-simple text-base"></i>Download</button>
                    <button x-show="item.installs !== null" @click="askInstalled()" class="btn btn-sm gap-1"
                            :class="lastTransfer[item.path] ? 'btn-primary' : 'btn-outline'">
                      <i class="ph ph-check-circle text-base"></i>Record installed</button>
                    <button @click="openInFiles()" class="btn btn-ghost btn-sm gap-1">
                      <i class="ph ph-folders text-base"></i>Files</button>
                    <button @click="goStage()" class="btn btn-ghost btn-sm gap-1">
                      <i class="ph ph-stack text-base"></i>Stage</button>
                  </div>

                  <div x-show="compareOpen && item.comparable" x-cloak
                       class="border border-base-300 rounded-lg p-3 flex flex-col gap-2"
                       @dragover.prevent @drop.prevent.stop="compareDrop($event)">
                    <textarea x-model="compareDraft" class="textarea textarea-bordered w-full min-h-36 font-mono text-sm"
                              placeholder="Paste the work copy here, or anywhere on the page while this file is selected"></textarea>
                    <div class="flex flex-wrap items-center gap-2">
                      <button @click="submitCompare()" :disabled="!!(!compareDraft || compareBusy)" class="btn btn-primary btn-sm">Compare text</button>
                      <label class="btn btn-outline btn-sm cursor-pointer">Choose file
                        <input type="file" accept=".ps1,.psm1,.psd1,.ps1xml,.xaml,.txt" class="hidden" @change="comparePicked($event)"></label>
                      <select x-model="compareEncoding" class="select select-bordered select-sm" aria-label="Comparison file encoding">
                        <option value="auto">Auto encoding</option>
                        <option value="utf-16le">UTF-16 LE</option>
                        <option value="utf-16be">UTF-16 BE</option>
                        <option value="windows-1252">Windows-1252</option>
                      </select>
                      <span class="text-sm text-base-content/50">or drop a file here</span>
                    </div>
                    <p x-show="compareError" class="text-sm text-error" x-text="compareError"></p>
                  </div>

                  <!-- The confirm: the exact row, the file it lands in, one tap. -->
                  <div x-show="pending" x-cloak class="border border-primary/40 rounded-lg p-3 flex flex-col gap-2 bg-primary/10">
                    <div class="text-base font-medium" x-text="pending?.why"></div>
                    <input x-model="recordNote" type="text" class="input input-bordered input-sm w-full" placeholder="note (optional, one line)" @input="renderPending()">
                    <pre class="font-mono text-base whitespace-pre-wrap break-all bg-base-100 rounded p-2" x-text="pending?.line"></pre>
                    <div class="font-mono text-base text-base-content/60 break-all" x-text="'appends to ' + repo + '@' + ref + ':' + ledgerPath"></div>
                    <div class="flex flex-wrap gap-1.5">
                      <button @click="confirmRecord()" :disabled="!!recording" class="btn btn-primary btn-sm" x-text="pending?.confirm"></button>
                      <button @click="pending = null; recordError = ''" class="btn btn-ghost btn-sm">Cancel</button>
                    </div>
                    <p x-show="recordError" class="text-sm text-error" x-text="recordError"></p>
                  </div>
                  <p x-show="recorded" x-cloak class="text-base text-success" x-text="recorded"></p>

                  <!-- PowerShell IDE Workbench -->
                  <div class="border border-base-300 rounded-xl overflow-hidden flex flex-col bg-base-100 shadow-sm mt-1">
                    <!-- IDE Toolbar / Tab Strip -->
                    <div class="flex flex-wrap items-center justify-between border-b border-base-300 bg-base-200/50 px-3 py-2 gap-2">
                      <div class="flex items-center gap-1 font-mono text-xs">
                        <button @click="ideTab = 'code'" class="btn btn-xs" :class="ideTab === 'code' ? 'btn-primary' : 'btn-ghost'" title="Code">
                          <i class="ph ph-code text-sm"></i> Code
                        </button>
                        <button x-show="item.companion" @click="ideTab = 'split'" class="btn btn-xs" :class="ideTab === 'split' ? 'btn-primary' : 'btn-ghost'" title="Companion">
                          <i class="ph ph-columns text-sm"></i> Companion Split
                        </button>
                        <button @click="ideTab = 'diff'" class="btn btn-xs" :class="ideTab === 'diff' ? 'btn-primary' : 'btn-ghost'" title="Diff">
                          <i class="ph ph-git-diff text-sm"></i> Diff & Verify
                        </button>
                        <button @click="ideTab = 'ledger'" class="btn btn-xs" :class="ideTab === 'ledger' ? 'btn-primary' : 'btn-ghost'" title="Ledger">
                          <i class="ph ph-clock-counter-clockwise text-sm"></i> Ledger & Checks
                          <span class="badge badge-xs ml-1" x-text="historyOf(item).length + checksOf(item).length"></span>
                        </button>
                        <button @click="ideTab = 'patterns'" class="btn btn-xs" :class="ideTab === 'patterns' ? 'btn-primary' : 'btn-ghost'" title="Patterns">
                          <i class="ph ph-bookmarks text-sm"></i> Patterns
                        </button>
                      </div>

                      <!-- Right Toolbar Tools -->
                      <div class="flex items-center gap-1">
                        <button x-show="ideTab === 'code'" @click="copyCode()" class="btn btn-ghost btn-xs gap-1" title="Copy">
                          <i class="ph ph-copy text-sm"></i> Copy Code
                        </button>
                        <button x-show="ideTab === 'code' && isScript" @click="copySuccinctCode()" class="btn btn-ghost btn-xs gap-1" title="Succinct">
                          <i class="ph ph-scissors text-sm"></i> Copy Succinct
                        </button>
                        <button x-show="ideTab === 'code' && transfer" @click="copyTransferHelper()" class="btn btn-ghost btn-xs gap-1" title="Transfer">
                          <i class="ph ph-terminal text-sm"></i> Transfer Cmd
                        </button>
                        <button x-show="ideTab === 'code' && transfer" @click="copyHeaderSnippet()" class="btn btn-ghost btn-xs gap-1" title="Header">
                          <i class="ph ph-hash text-sm"></i> Header Snippet
                        </button>
                      </div>
                    </div>

                    <!-- 1. Code View Pane -->
                    <div x-show="ideTab === 'code'" class="flex flex-col @4xl:flex-row divide-y @4xl:divide-y-0 @4xl:divide-x divide-[var(--color-base-300)] min-h-[460px]">
                      <!-- Left: Code Surface -->
                      <div class="flex-1 flex flex-col min-w-0">
                        <div class="flex flex-wrap items-center justify-between px-3 py-1.5 bg-base-200/40 border-b border-base-200 text-xs font-mono text-base-content/70 gap-2">
                          <div class="flex items-center gap-2">
                            <span class="badge badge-sm badge-neutral" x-text="codeLanguage"></span>
                            <span x-show="activeAst?.declaredFile" class="text-success truncate max-w-xs font-mono" x-text="activeAst?.declaredFile ? '# @file ' + activeAst.declaredFile : ''"></span>
                            <span x-show="activeAst && !activeAst.declaredFile && isScript" class="badge badge-sm badge-warning">missing # @file</span>
                            <template x-if="isScript && activeAst?.compatibility">
                              <span x-show="!activeAst.compatibility.length" class="badge badge-sm badge-success font-mono">PS 5.1 OK</span>
                            </template>
                            <template x-if="isScript && activeAst?.compatibility?.length">
                              <button @click="inspectorTab = 'symbols'" class="badge badge-sm badge-warning font-mono hover:badge-error" title="PS Issues" x-text="activeAst.compatibility.length + ' PS 5.1 issue(s)'"></button>
                            </template>
                          </div>
                          <div class="flex items-center gap-2">
                            <span x-text="(textLines.length || 0) + ' lines'"></span>
                            <span x-show="activeAst?.functions?.length" x-text="activeAst?.functions ? activeAst.functions.length + ' fn' : ''"></span>
                            <span x-show="activeAst?.controls?.size" x-text="activeAst?.controls ? activeAst.controls.size + ' ctrl' : ''"></span>
                          </div>
                        </div>

                        <!-- Code Surface scroll container -->
                        <div class="p-2 overflow-auto max-h-[600px] font-mono text-xs bg-base-100/60 grow">
                          <div x-show="textBusy" class="flex justify-center py-12">
                            <span class="loading loading-dots loading-sm opacity-50"></span>
                          </div>
                          <div x-show="!textBusy && !text" class="text-center py-12 text-base-content/40 italic">
                            Select a file to inspect code.
                          </div>
                          <div x-show="!textBusy && text" class="divide-y divide-[var(--color-base-200)]/20" x-html="highlightedMainCode"></div>
                        </div>
                      </div>

                      <!-- Right: Inspector Sidebar -->
                      <div class="w-full @4xl:w-80 shrink-0 flex flex-col bg-base-200/20">
                        <div class="flex border-b border-base-300 bg-base-200/50 text-xs font-mono">
                          <button @click="inspectorTab = 'symbols'" class="flex-1 py-2 px-3 text-center transition-colors"
                                  :class="inspectorTab === 'symbols' ? 'font-semibold border-b-2 border-primary bg-base-100 text-primary' : 'text-base-content/60 hover:text-base-content'"
                                  title="Symbols">
                            <i class="ph ph-tree-structure mr-1"></i>Symbols
                          </button>
                          <button @click="inspectorTab = 'transfer'" class="flex-1 py-2 px-3 text-center transition-colors"
                                  :class="inspectorTab === 'transfer' ? 'font-semibold border-b-2 border-primary bg-base-100 text-primary' : 'text-base-content/60 hover:text-base-content'"
                                  title="Transfer">
                            <i class="ph ph-terminal-window mr-1"></i>Transfer
                          </button>
                        </div>

                        <!-- Symbols Pane -->
                        <div x-show="inspectorTab === 'symbols'" class="p-3 flex flex-col gap-3 overflow-y-auto max-h-[550px] text-xs">
                          <div x-show="!activeAst" class="text-base-content/40 italic py-4 text-center">
                            No symbol outline available.
                          </div>

                          <!-- PS 5.1 Compatibility Warnings -->
                          <template x-if="activeAst?.compatibility?.length">
                            <div class="flex flex-col gap-1.5 border-b border-base-300 pb-3">
                              <div class="font-mono text-2xs uppercase tracking-wider text-warning font-semibold flex items-center justify-between">
                                <span>PS 5.1 Issues</span>
                                <span class="badge badge-xs badge-warning" x-text="activeAst.compatibility.length"></span>
                              </div>
                              <div class="flex flex-col gap-1">
                                <template x-for="c in activeAst.compatibility" :key="c.line + c.rule">
                                  <div class="rounded border border-warning/40 bg-warning/10 p-2 flex flex-col gap-1">
                                    <div class="flex items-center justify-between font-mono text-2xs">
                                      <span class="font-semibold text-warning" x-text="c.rule"></span>
                                      <button @click="jumpToLine(c.line)" class="link link-hover text-2xs text-base-content/60" title="Jump Line" x-text="'L' + c.line"></button>
                                    </div>
                                    <p class="text-2xs text-base-content/80" x-text="c.message"></p>
                                    <pre class="font-mono text-2xs bg-base-100/80 p-1 rounded truncate text-base-content/70" x-text="c.snippet"></pre>
                                  </div>
                                </template>
                              </div>
                            </div>
                          </template>

                          <!-- Functions & Filters -->
                          <template x-if="activeAst?.functions?.length">
                            <div class="flex flex-col gap-1.5">
                              <div class="font-mono text-2xs uppercase tracking-wider text-base-content/50 font-semibold flex items-center justify-between">
                                <span>Functions</span>
                                <span x-text="activeAst?.functions?.length || 0"></span>
                              </div>
                              <div class="flex flex-col gap-1">
                                <template x-for="f in (activeAst?.functions || [])" :key="f.name">
                                  <div class="rounded border border-base-300 bg-base-100 p-2 flex flex-col gap-1">
                                    <div class="flex items-center justify-between">
                                      <span class="font-mono font-semibold text-primary truncate" x-text="f.name"></span>
                                      <button @click="jumpToLine(f.line)" class="link link-hover font-mono text-2xs text-base-content/50" title="Jump" x-text="'L' + f.line"></button>
                                    </div>
                                    <p x-show="f.synopsis" class="text-2xs text-base-content/70 italic" x-text="f.synopsis"></p>
                                    <div x-show="f.params?.length" class="flex flex-wrap gap-1 mt-0.5">
                                      <template x-for="p in f.params" :key="p.name">
                                        <span class="badge badge-xs badge-ghost font-mono" x-text="(p.type ? '[' + p.type + ']' : '') + p.name"></span>
                                      </template>
                                    </div>
                                  </div>
                                </template>
                              </div>
                            </div>
                          </template>

                          <!-- Dot Sources -->
                          <template x-if="activeAst?.dotSources?.length">
                            <div class="flex flex-col gap-1.5">
                              <div class="font-mono text-2xs uppercase tracking-wider text-base-content/50 font-semibold flex items-center justify-between">
                                <span>Dot-Sourced</span>
                                <span x-text="activeAst?.dotSources?.length || 0"></span>
                              </div>
                              <div class="flex flex-col gap-1 font-mono text-2xs">
                                <template x-for="d in (activeAst?.dotSources || [])" :key="d">
                                  <div class="rounded border border-base-300 bg-base-100 px-2 py-1 truncate text-base-content/80" x-text="d"></div>
                                </template>
                              </div>
                            </div>
                          </template>

                          <!-- Module Imports -->
                          <template x-if="activeAst?.imports?.length">
                            <div class="flex flex-col gap-1.5">
                              <div class="font-mono text-2xs uppercase tracking-wider text-base-content/50 font-semibold flex items-center justify-between">
                                <span>Module Imports</span>
                                <span x-text="activeAst?.imports?.length || 0"></span>
                              </div>
                              <div class="flex flex-col gap-1 font-mono text-2xs">
                                <template x-for="m in (activeAst?.imports || [])" :key="m">
                                  <div class="rounded border border-base-300 bg-base-100 px-2 py-1 truncate text-secondary font-medium" x-text="m"></div>
                                </template>
                              </div>
                            </div>
                          </template>

                          <!-- XAML Controls (when file is XAML) -->
                          <template x-if="activeAst?.controls && !activeAst?.functions">
                            <div class="flex flex-col gap-1.5">
                              <div class="font-mono text-2xs uppercase tracking-wider text-base-content/50 font-semibold flex items-center justify-between">
                                <span>Named Controls</span>
                                <span x-text="Array.from(activeAst?.controls || []).length"></span>
                              </div>
                              <div class="flex flex-col gap-1 font-mono text-2xs">
                                <template x-for="c in Array.from(activeAst?.controls || [])" :key="c">
                                  <div class="rounded border border-base-300 bg-base-100 px-2 py-1 flex items-center justify-between">
                                    <span class="text-primary font-medium truncate" x-text="c"></span>
                                  </div>
                                </template>
                              </div>
                            </div>
                          </template>

                          <!-- Dynamic Resources in XAML -->
                          <template x-if="activeAst?.dynamicResources?.length">
                            <div class="flex flex-col gap-1.5">
                              <div class="font-mono text-2xs uppercase tracking-wider text-base-content/50 font-semibold flex items-center justify-between">
                                <span>Dynamic Resources</span>
                                <span x-text="activeAst?.dynamicResources?.length || 0"></span>
                              </div>
                              <div class="flex flex-wrap gap-1 font-mono text-2xs">
                                <template x-for="r in (activeAst?.dynamicResources || [])" :key="r">
                                  <span class="badge badge-xs badge-info font-mono" x-text="r"></span>
                                </template>
                              </div>
                            </div>
                          </template>
                        </div>

                        <!-- Transfer Pane (No-Direct-Sync Assistant) -->
                        <div x-show="inspectorTab === 'transfer'" class="p-3 flex flex-col gap-3 overflow-y-auto max-h-[550px] text-xs">
                          <template x-if="transfer">
                            <div class="flex flex-col gap-3">
                              <div class="flex flex-col gap-1">
                                <span class="font-mono text-2xs uppercase tracking-wider text-base-content/50 font-semibold">Destination on Work Computer</span>
                                <pre class="font-mono text-2xs bg-base-100 rounded border border-base-300 p-2 whitespace-pre-wrap break-all text-base-content/80" x-text="transfer.winPath"></pre>
                              </div>

                              <div class="flex flex-col gap-1">
                                <div class="flex items-center justify-between">
                                  <span class="font-mono text-2xs uppercase tracking-wider text-base-content/50 font-semibold">Verify Hash Command</span>
                                  <button @click="copyTransferCommand('verify')" class="btn btn-xs btn-outline gap-1" title="Copy">
                                    <i class="ph ph-copy"></i>Copy
                                  </button>
                                </div>
                                <pre class="font-mono text-2xs bg-base-100 rounded border border-base-300 p-2 whitespace-pre-wrap break-all text-base-content/80" x-text="transfer.verifyCmd"></pre>
                              </div>

                              <div class="flex flex-col gap-1">
                                <div class="flex items-center justify-between">
                                  <span class="font-mono text-2xs uppercase tracking-wider text-base-content/50 font-semibold">Placement Command</span>
                                  <button @click="copyTransferCommand('install')" class="btn btn-xs btn-outline gap-1" title="Copy">
                                    <i class="ph ph-copy"></i>Copy
                                  </button>
                                </div>
                                <pre class="font-mono text-2xs bg-base-100 rounded border border-base-300 p-2 whitespace-pre-wrap break-all text-base-content/80 max-h-32 overflow-y-auto" x-text="transfer.installCmd"></pre>
                              </div>

                              <div class="flex flex-col gap-1">
                                <div class="flex items-center justify-between">
                                  <span class="font-mono text-2xs uppercase tracking-wider text-base-content/50 font-semibold">Header Tag</span>
                                  <button @click="copyHeaderSnippet()" class="btn btn-xs btn-outline gap-1" title="Copy">
                                    <i class="ph ph-copy"></i>Copy
                                  </button>
                                </div>
                                <pre class="font-mono text-2xs bg-base-100 rounded border border-base-300 p-2 whitespace-pre-wrap break-all text-base-content/80" x-text="transfer.headerSnippet"></pre>
                              </div>
                            </div>
                          </template>
                          <div x-show="!transfer" class="text-base-content/40 italic py-4 text-center">
                            No transfer helper available.
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 2. Companion Split View Pane -->
                    <div x-show="ideTab === 'split'" class="flex flex-col min-h-[460px]">
                      <!-- Cross Reference Diagnostic Banner -->
                      <div class="border-b border-base-300 bg-base-200/30 p-3 flex flex-col gap-2 text-xs">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="flex items-center gap-2">
                            <i class="ph ph-git-fork text-primary text-base"></i>
                            <span class="font-mono font-semibold">Controller + Layout Pairing</span>
                          </div>
                          <div class="flex items-center gap-2 font-mono">
                            <span class="badge badge-sm" :class="crossRef?.isFullyThemed ? 'badge-success' : 'badge-warning'"
                                  x-text="crossRef?.isFullyThemed ? 'DynamicResource Theme OK' : 'Check Theme Resources'"></span>
                            <span class="badge badge-sm badge-info" x-text="(crossRef?.wired?.length || 0) + ' wired controls'"></span>
                            <span class="badge badge-sm badge-ghost" x-text="(crossRef?.unwired?.length || 0) + ' unwired controls'"></span>
                          </div>
                        </div>

                        <!-- Diagnostic Details if unwired or wired -->
                        <div x-show="crossRef?.wired?.length || crossRef?.unwired?.length" class="grid grid-cols-1 @2xl:grid-cols-2 gap-2 pt-1">
                          <div class="rounded bg-base-100 p-2 border border-base-200">
                            <div class="font-mono text-2xs text-success font-semibold mb-1">Bound Controls in Controller</div>
                            <div class="flex flex-wrap gap-1">
                              <template x-for="c in crossRef?.wired || []" :key="c.name">
                                <span class="badge badge-xs badge-success badge-outline font-mono" x-text="c.name"></span>
                              </template>
                              <span x-show="!crossRef?.wired?.length" class="text-2xs text-base-content/40 italic">None detected</span>
                            </div>
                          </div>
                          <div class="rounded bg-base-100 p-2 border border-base-200">
                            <div class="font-mono text-2xs text-warning font-semibold mb-1">Unwired Controls in XAML</div>
                            <div class="flex flex-wrap gap-1">
                              <template x-for="u in crossRef?.unwired || []" :key="u.name">
                                <span class="badge badge-xs badge-warning badge-outline font-mono" x-text="u.name"></span>
                              </template>
                              <span x-show="!crossRef?.unwired?.length" class="text-2xs text-base-content/40 italic">All controls wired</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Side-by-side Columns -->
                      <div class="grid grid-cols-1 @3xl:grid-cols-2 divide-y @3xl:divide-y-0 @3xl:divide-x divide-[var(--color-base-300)] grow">
                        <!-- Left: Main File -->
                        <div class="flex flex-col min-w-0">
                          <div class="px-3 py-1.5 bg-base-200/50 border-b border-base-200 text-xs font-mono font-semibold flex items-center justify-between">
                            <span class="truncate" x-text="item.name"></span>
                            <span class="badge badge-xs badge-ghost" x-text="(textLines.length || 0) + ' lines'"></span>
                          </div>
                          <div class="p-2 overflow-auto max-h-[520px] font-mono text-xs bg-base-100/60 grow">
                            <div class="divide-y divide-[var(--color-base-200)]/20" x-html="highlightedMainCode"></div>
                          </div>
                        </div>

                        <!-- Right: Companion File -->
                        <div class="flex flex-col min-w-0">
                          <div class="px-3 py-1.5 bg-base-200/50 border-b border-base-200 text-xs font-mono font-semibold flex items-center justify-between">
                            <span class="truncate" x-text="item.companion ? item.companion.split('/').pop() : 'Companion'"></span>
                            <button x-show="item.companion" @click="select(item.companion)" class="btn btn-ghost btn-xs gap-1" title="Open">
                              <i class="ph ph-arrows-clockwise text-xs"></i>Open
                            </button>
                          </div>
                          <div class="p-2 overflow-auto max-h-[520px] font-mono text-xs bg-base-100/60 grow">
                            <div x-show="!companionText" class="text-center py-12 text-base-content/40 italic">
                              Loading companion text...
                            </div>
                            <div x-show="companionText" class="divide-y divide-[var(--color-base-200)]/20" x-html="highlightedCompanionCode"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 3. Diff & Verify Pane -->
                    <div x-show="ideTab === 'diff'" class="flex flex-col p-4 gap-4 min-h-[460px]">
                      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 pb-3">
                        <div>
                          <h4 class="font-mono text-sm font-semibold">Inline Diff & Verification Bench</h4>
                          <p class="text-xs text-base-content/60">Compare local work machine copy against GitHub repository blob.</p>
                        </div>
                        <div class="flex items-center gap-2">
                          <span x-show="diffStat" class="badge badge-neutral font-mono text-xs" x-text="diffStat"></span>
                        </div>
                      </div>

                      <!-- Diff Inputs & Dropzone -->
                      <div class="flex flex-col gap-2">
                        <textarea x-model="compareDraft" class="textarea textarea-bordered w-full min-h-28 font-mono text-xs"
                                  placeholder="Paste the work copy here, or drop a file anywhere on this area to inspect diff..."></textarea>
                        <div class="flex flex-wrap items-center gap-2">
                          <button @click="submitCompare()" :disabled="!!(!compareDraft || compareBusy)" class="btn btn-primary btn-sm">
                            <i class="ph ph-git-diff"></i>Compare text
                          </button>
                          <button @click="pasteClipboardHash()" class="btn btn-outline btn-sm gap-1" title="Paste Clip">
                            <i class="ph ph-clipboard-text"></i>Paste clipboard
                          </button>
                          <label class="btn btn-outline btn-sm cursor-pointer">Choose file
                            <input type="file" accept=".ps1,.psm1,.psd1,.ps1xml,.xaml,.txt" class="hidden" @change="comparePicked($event)"></label>
                          <select x-model="compareEncoding" class="select select-bordered select-sm" aria-label="Comparison file encoding">
                            <option value="auto">Auto encoding</option>
                            <option value="utf-16le">UTF-16 LE</option>
                            <option value="utf-16be">UTF-16 BE</option>
                            <option value="windows-1252">Windows-1252</option>
                          </select>
                          <button x-show="compareDraft" @click="compareDraft = ''" class="btn btn-ghost btn-sm" title="Clear">Clear</button>
                        </div>
                        <p x-show="compareError" class="text-sm text-error" x-text="compareError"></p>
                      </div>

                      <!-- Smart Hash Verification Bench Card -->
                      <div x-show="detectedHash" class="rounded-lg border p-3 flex flex-col gap-2 shadow-xs transition-all"
                           :class="hashMatchStatus === 'match' ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10'">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2 font-mono font-semibold text-xs"
                               :class="hashMatchStatus === 'match' ? 'text-success' : 'text-warning'">
                            <i class="ph text-base" :class="hashMatchStatus === 'match' ? 'ph-check-circle' : 'ph-warning'"></i>
                            <span x-text="hashMatchStatus === 'match' ? 'SHA-256 Verified Match' : 'SHA-256 Hash Mismatch'"></span>
                          </div>
                          <span class="badge badge-xs font-mono"
                                :class="hashMatchStatus === 'match' ? 'badge-success' : 'badge-warning'"
                                x-text="hashMatchStatus === 'match' ? 'exact match' : 'differs'"></span>
                        </div>
                        <div class="flex flex-col gap-1 font-mono text-2xs text-base-content/80">
                          <div class="truncate">Supplied: <span class="font-bold break-all" :class="hashMatchStatus === 'match' ? 'text-success' : 'text-error'" x-text="detectedHash"></span></div>
                          <div class="truncate">Expected: <span class="font-bold text-success break-all" x-text="currentSha256 || 'calculating...'"></span></div>
                        </div>
                        <p class="text-xs text-base-content/70"
                           x-text="hashMatchStatus === 'match'
                             ? 'The supplied work copy hash matches the GitHub repository blob byte-for-byte.'
                             : 'The work machine copy differs from the GitHub blob at this revision.'"></p>
                        <div class="flex items-center gap-2 pt-1">
                          <button x-show="hashMatchStatus === 'match'" @click="stageVerifiedHashRecord()" class="btn btn-success btn-xs gap-1" title="Record Match">
                            <i class="ph ph-check"></i> Record as Verified Observation
                          </button>
                          <button x-show="hashMatchStatus === 'mismatch'" @click="stageDiffersHashRecord()" class="btn btn-warning btn-xs gap-1" title="Record Diff">
                            <i class="ph ph-git-diff"></i> Record as Differs Observation
                          </button>
                        </div>
                      </div>

                      <!-- Diff Rows Output (when compareDraft exists and diff calculated) -->
                      <div x-show="diffRows?.length" class="flex flex-col gap-2 border border-base-300 rounded-lg overflow-hidden bg-base-100">
                        <div class="flex items-center justify-between px-3 py-1.5 bg-base-200/50 border-b border-base-200 text-xs font-mono">
                          <span class="font-semibold text-base-content/70">Diff (GitHub blob vs supplied work copy)</span>
                          <span class="text-base-content/50" x-text="diffStat"></span>
                        </div>
                        <div class="p-2 overflow-auto max-h-96 font-mono text-xs flex flex-col">
                          <template x-for="(r, i) in diffRows" :key="i">
                            <div class="whitespace-pre px-2 py-0.5"
                                 :class="r.t === 'add' ? 'bg-success/10 text-success font-medium' : r.t === 'del' ? 'bg-error/10 text-error font-medium' : 'text-base-content/60'"
                                 x-text="(r.t === 'add' ? '+ ' : r.t === 'del' ? '- ' : '  ') + r.line"></div>
                          </template>
                        </div>
                      </div>

                      <div x-show="!diffRows?.length && !compareDraft" class="text-center py-8 text-base-content/40 italic">
                        Paste or drop your work machine copy into the text area above to inspect differences line-by-line.
                      </div>
                    </div>

                    <!-- 4. Ledger & Checks Pane -->
                    <div x-show="ideTab === 'ledger'" class="flex flex-col p-4 gap-4 min-h-[460px]">
                      <div>
                        <div class="flex items-center gap-2 text-sm font-medium text-base-content/60">
                          <span>Observations</span>
                          <span class="font-mono text-xs" x-text="historyOf(item).length"></span>
                          <div class="grow"></div>
                          <a :href="ledgerUrl" target="_blank" rel="noopener" class="link link-hover text-xs font-mono">observations.csv</a>
                        </div>
                        <p x-show="!historyOf(item).length" class="text-base text-base-content/50 py-1">Nothing recorded for this file. Local state unknown.</p>
                        <div class="flex flex-col">
                          <template x-for="(r, i) in historyOf(item)" :key="r.date + r.local_sha256">
                            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1 text-base" :class="i && 'border-t border-base-200'">
                              <span class="font-mono text-xs tabular-nums" x-text="when(r.date)"></span>
                              <span class="badge badge-sm" :class="r.kind === 'installed' ? 'badge-info' : r.kind === 'verified' ? 'badge-success' : 'badge-warning'" x-text="rowLabel(r)"></span>
                              <span class="font-mono text-base text-base-content/60" x-text="'at ' + short(r.revision) + (r.blob_sha === item.blobSha ? ' (current)' : ' (superseded)')"></span>
                              <span class="text-base text-base-content/60" x-text="r.method"></span>
                              <span x-show="r.note" class="text-base-content/70 w-full" x-text="r.note"></span>
                            </div>
                          </template>
                        </div>
                      </div>

                      <div x-show="checksOf(item).length">
                        <div class="flex items-center gap-2 text-sm font-medium text-base-content/60">
                          <span>Checks in this browser</span>
                          <span class="font-mono text-xs" x-text="checksOf(item).length"></span>
                        </div>
                        <div class="flex flex-col">
                          <template x-for="(c, i) in checksOf(item)" :key="c.id">
                            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1 text-base" :class="i && 'border-t border-base-200'">
                              <span class="font-mono text-xs tabular-nums" x-text="when(c.checkedAt)"></span>
                              <span :class="c.exact ? 'text-success' : c.lineEndingsOnly ? 'text-success' : 'text-warning'"
                                    x-text="c.exact ? 'matched revision' : c.lineEndingsOnly ? 'matched, line endings differ' : 'differed from revision'"></span>
                              <span class="font-mono text-base text-base-content/60" x-text="short(c.revision) + ' · ' + c.source"></span>
                              <div class="grow"></div>
                              <button x-show="!isRecorded(c)" @click="askCheck(c)" class="btn btn-outline btn-xs">Record</button>
                              <span x-show="isRecorded(c)" class="text-base text-base-content/60">recorded</span>
                              <button @click="reopen(c)" class="btn btn-ghost btn-xs">Reopen</button>
                            </div>
                          </template>
                        </div>
                      </div>
                    </div>

                    <!-- 5. Patterns Library Pane -->
                    <div x-show="ideTab === 'patterns'" class="flex flex-col p-4 gap-4 min-h-[460px]">
                      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 pb-3">
                        <div>
                          <h4 class="font-mono text-sm font-semibold">PowerShell GUI Cookbook & Scripting Patterns</h4>
                          <p class="text-xs text-base-content/60">Curated, production-tested recipes for WPF, runspace concurrency, and AST reflection.</p>
                        </div>
                        <div class="flex items-center gap-1">
                          <select x-model="patternCategory" class="select select-bordered select-xs" aria-label="Pattern category">
                            <option value="">All Categories</option>
                            <option value="GUI & Layout">GUI & Layout</option>
                            <option value="Concurrency">Concurrency</option>
                            <option value="Browser Integration">Browser Integration</option>
                            <option value="Data & Utilities">Data & Utilities</option>
                            <option value="Documentation">Documentation</option>
                            <option value="Script Analysis">Script Analysis</option>
                          </select>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 @2xl:grid-cols-2 gap-4">
                        <template x-for="s in visibleSnippets" :key="s.id">
                          <div class="border border-base-300 rounded-lg p-3 bg-base-100 flex flex-col gap-2">
                            <div class="flex items-start justify-between gap-2">
                              <div>
                                <div class="font-mono font-semibold text-xs text-primary" x-text="s.title"></div>
                                <span class="badge badge-xs badge-neutral mt-0.5" x-text="s.category"></span>
                              </div>
                              <button @click="copySnippet(s.code)" class="btn btn-xs btn-outline gap-1" title="Copy">
                                <i class="ph ph-copy"></i>Copy
                              </button>
                            </div>
                            <p class="text-xs text-base-content/70" x-text="s.summary"></p>
                            <pre class="font-mono text-2xs bg-base-200/50 p-2 rounded max-h-40 overflow-auto whitespace-pre text-base-content/80" x-text="s.code"></pre>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>`,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this._onCheck = () => { this.loadChecks(); };
        window.addEventListener('correspondence-check', this._onCheck);
        this.reload();
      },
      destroy() {
        window.removeEventListener('correspondence-check', this._onCheck);
        if (shell()) shell().installationItem = '';
      },

      get root() { return this.manifest?.root || ''; },
      get states() {
        const counts = K().summary(Object.values(this.derived));
        return K().STATES.filter(s => counts[s]).map(s => ({ key: s, label: K().LABELS[s], count: counts[s] }));
      },
      get headline() {
        const counts = K().summary(Object.values(this.derived));
        const parts = [this.items.length + ' files'];
        for (const s of K().STATES) if (counts[s]) parts.push(counts[s] + ' ' + K().LABELS[s]);
        return short(this.revision) + ' · ' + parts.join(' · ');
      },
      get localAreas() { return this.manifest?.localAreas || []; },
      get visibleGroups() {
        if (!this.filter) return this.groups;
        return this.groups.map(g => ({ ...g, units: g.units
          .map(u => ({ ...u, files: u.files.filter(it => this.stateOf(it.path).state === this.filter) }))
          .filter(u => u.files.length) })).filter(g => g.units.length);
      },
      get item() { return this.items.find(it => it.path === this.selected) || null; },
      get ledgerUrl() {
        return window.GithubLinks?.pathUrl ? window.GithubLinks.pathUrl(this.repo, this.ledgerPath, this.ref) : '';
      },
      // The explanation the manifest deliberately does not carry. Linked
      // rather than summarized here, so the mappings and statuses on this
      // pane and the reasoning behind them stay one statement each.
      get docUrl() {
        const doc = this.manifest?.doc;
        return doc && window.GithubLinks?.pathUrl ? window.GithubLinks.pathUrl(this.repo, doc, this.ref) : '';
      },
      short, when,
      stateOf(path) { return this.derived[path] || { state: 'unknown', label: K().LABELS.unknown, latest: null, history: [] }; },
      badgeOf(path) { return BADGE[this.stateOf(path).state] || 'badge-ghost'; },
      historyOf(it) { return this.stateOf(it.path).history; },
      checksOf(it) { return this.checks.filter(c => c.path === it.path); },
      isRecorded(c) { return K().isRecorded(c, this.rows); },
      iconOf(it) {
        return { profile: 'ph-user-gear', module: 'ph-package', companion: 'ph-file-code', controller: 'ph-file-code',
          xaml: 'ph-layout', script: 'ph-file-code', resource: 'ph-file' }[it.kind] || 'ph-file';
      },
      destinationOf(g) {
        return g.installs === null ? 'no installation destination' : g.installs === '' ? 'installation root' : g.installs;
      },
      destinationOfItem(it) {
        if (it.installs === null) return 'no installation destination (repository only)';
        if (it.installs === '') return this.root + '\\ (filename unverified)';
        return this.root + '\\' + it.installs.replace(/\//g, '\\');
      },
      rowLabel(r) {
        return r.kind === 'installed' ? 'reported installed' : r.kind === 'verified'
          ? (r.match === 'line-endings' ? 'verified, line endings differ' : 'verified from supplied copy') : 'local copy differed';
      },
      observedLine(it) {
        const s = this.stateOf(it.path);
        if (!s.latest) return 'never';
        // Name what moved. "which is what GitHub holds now" read as a claim
        // about the revision, when the comparison is between the file's blob
        // then and its blob now, and the revision has usually moved either way.
        return when(s.latest.date) + ' · ' + this.rowLabel(s.latest) + ' at ' + short(s.latest.revision)
          + (s.latest.blob_sha === it.blobSha ? ', and this file has not changed since'
                                              : ', and this file has changed on GitHub since');
      },

      // ── Reads ────────────────────────────────────────────────────────────
      async reload() {
        const s = store();
        this.repo = s.repo; this.ref = s.ref || s.defaultRef || '';
        this.loading = true; this.err = '';
        try {
          const gh = s.gh;
          if (!gh) throw new Error('No repository is open.');
          const manifestPath = this.project?.installation;
          if (!manifestPath) throw new Error('This workspace declares no installation manifest.');
          const [mf, tree, commits] = await Promise.all([
            gh.get(manifestPath),
            gh.req('git/trees/' + encodeURIComponent(this.ref || 'HEAD') + '?recursive=1'),
            gh.req('commits?' + (this.ref ? 'sha=' + encodeURIComponent(this.ref) + '&' : '') + 'per_page=1'),
          ]);
          this.manifest = K().manifest(mf.text);
          this.revision = commits?.[0]?.sha || '';
          this.ledgerPath = this.manifest.observations || (this.project.path + '/data/observations.csv');
          this.items = K().inventory({ tree: tree.tree, manifest: this.manifest, projectPath: this.project.path });
          this.groups = K().groups(this.items, this.manifest);
          await this.loadRows(gh);
          await this.loadChecks();
          if (!this.selected && shell()?.installationItem && this.items.some(it => it.path === shell().installationItem)) {
            this.select(shell().installationItem);
          }
        } catch (e) { this.err = 'Could not read the installation: ' + (e?.message || e); }
        this.loading = false;
      },
      async loadRows(gh) {
        let text = '';
        try { text = (await (gh || store().gh).get(this.ledgerPath, window.GH?.FRESH)).text; }
        catch (e) { if (e?.status !== 404) throw e; }
        this.rows = K().observations(text);
        this.derived = Object.fromEntries(this.items.map(it => [it.path, K().derive(it, this.rows)]));
      },
      async loadChecks() {
        try { this.checks = window.FileCorrespondence?.checksUnder ? await window.FileCorrespondence.checksUnder(this.repo, this.project.path + '/') : []; }
        catch { this.checks = []; }
      },

      // ── Selection ────────────────────────────────────────────────────────
      select(path) {
        const reqId = ++this.loadRequestId;
        this.selected = path; this.compareOpen = false; this.compareDraft = ''; this.compareError = '';
        this.pending = null; this.recorded = null; this.recordError = ''; this.text = '';
        this.activeAst = null; this.companionText = ''; this.companionAst = null; this.crossRef = null; this.transfer = null;
        this.currentSha256 = '';
        if (shell()) { shell().installationItem = path; shell().syncUrl?.(); }
        if (path) this.loadIde(reqId, path);
      },
      target() {
        const it = this.item;
        return it ? { repo: this.repo, ref: this.ref, path: it.path } : null;
      },
      openInFiles() { if (this.item) shell()?.openFile(this.item.path); },
      goStage() { shell()?.goStage(); },

      // ── PowerShell IDE Getters & Intelligence ────────────────────────────
      get codeLanguage() {
        const p = this.item?.path || '';
        if (/\.ps1$/i.test(p)) return 'PowerShell Script (.ps1)';
        if (/\.psm1$/i.test(p)) return 'PowerShell Module (.psm1)';
        if (/\.psd1$/i.test(p)) return 'Module Manifest (.psd1)';
        if (/\.xaml$/i.test(p)) return 'WPF XAML (.xaml)';
        if (/\.ps1xml$/i.test(p)) return 'PowerShell XML (.ps1xml)';
        return 'PowerShell';
      },
      get textLines() {
        return this.text ? this.text.split(/\r?\n/) : [];
      },
      get isScript() {
        return /\.(ps1|psm1|psd1)$/i.test(this.item?.path || '');
      },
      get highlightedMainCode() {
        if (!this.text) return '';
        if (!window.PowerShellIde) return this.escHtml(this.text);
        if (/\.xaml$/i.test(this.item?.path || '')) {
          return window.PowerShellIde.highlightXaml(this.text);
        }
        return window.PowerShellIde.highlightPowerShell(this.text);
      },
      get highlightedCompanionCode() {
        if (!this.companionText) return '';
        if (!window.PowerShellIde) return this.escHtml(this.companionText);
        if (/\.xaml$/i.test(this.item?.companion || '')) {
          return window.PowerShellIde.highlightXaml(this.companionText);
        }
        return window.PowerShellIde.highlightPowerShell(this.companionText);
      },
      get snippets() {
        return window.PowerShellIde?.SNIPPETS || [];
      },
      get visibleSnippets() {
        const all = this.snippets;
        if (!this.patternCategory) return all;
        return all.filter(s => s.category === this.patternCategory);
      },
      get diffRows() {
        if (!this.text || !this.compareDraft || !window.textDiff) return null;
        try {
          const a = this.text.split(/\r?\n/);
          const b = this.compareDraft.split(/\r?\n/);
          const ops = window.textDiff.lines(a, b);
          if (!ops) return null;
          return window.textDiff.rows(ops, a, b);
        } catch { return null; }
      },
      get diffStat() {
        const rows = this.diffRows;
        if (!rows) return '';
        const adds = rows.filter(r => r.t === 'add').length;
        const dels = rows.filter(r => r.t === 'del').length;
        return `+${adds} / -${dels} lines`;
      },
      get detectedHash() {
        return window.PowerShellIde?.extractSha256(this.compareDraft) || null;
      },
      get hashMatchStatus() {
        if (!this.detectedHash || !this.currentSha256) return null;
        return this.detectedHash.toLowerCase() === this.currentSha256.toLowerCase() ? 'match' : 'mismatch';
      },
      escHtml(s) {
        return (window.esc ? window.esc(s) : String(s || ''));
      },

      // ── PowerShell IDE Actions ───────────────────────────────────────────
      async loadIde(reqId, targetPath) {
        if (!this.item) return;
        const currentPath = targetPath || this.item.path;
        try {
          const text = await this.fetchText(reqId, currentPath);
          if (reqId && reqId !== this.loadRequestId) return;
          this.refreshIde(text);
          if (this.item?.companion) {
            await this.loadCompanion(reqId);
          }
        } catch { /* text fetch will happen on demand */ }
      },
      refreshIde(text) {
        if (!window.PowerShellIde || !text || !this.item) return;
        const path = this.item.path;
        if (/\.(ps1|psm1|psd1)$/i.test(path)) {
          this.activeAst = window.PowerShellIde.parseScript(text);
        } else if (/\.(xaml|xml|ps1xml)$/i.test(path)) {
          this.activeAst = window.PowerShellIde.parseXaml(text);
        }
        this.transfer = window.PowerShellIde.generateTransferHelper(this.item, text, this.root);
        if (window.Installation?.digest && text) {
          window.Installation.digest(text).then(h => { this.currentSha256 = h; }).catch(() => {});
        }
        if (this.companionAst) {
          this.computeCrossRef();
        }
      },
      async loadCompanion(reqId) {
        if (!this.item?.companion) return;
        const companionPath = this.item.companion;
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo });
          gh.ref = this.revision || this.ref;
          const f = await gh.get(companionPath);
          if (reqId && reqId !== this.loadRequestId) return;
          this.companionText = f.text;
          if (window.PowerShellIde) {
            if (/\.xaml$/i.test(companionPath)) {
              this.companionAst = window.PowerShellIde.parseXaml(f.text);
            } else if (/\.(ps1|psm1)$/i.test(companionPath)) {
              this.companionAst = window.PowerShellIde.parseScript(f.text);
            }
            this.computeCrossRef();
          }
        } catch {
          if (!reqId || reqId === this.loadRequestId) {
            this.companionText = '';
          }
        }
      },
      computeCrossRef() {
        if (!window.PowerShellIde) return;
        if (this.activeAst && this.companionAst) {
          if (/\.(ps1|psm1)$/i.test(this.item.path) && /\.xaml$/i.test(this.item.companion)) {
            this.crossRef = window.PowerShellIde.crossReference(this.companionAst, this.activeAst, this.text);
          } else if (/\.xaml$/i.test(this.item.path) && /\.(ps1|psm1)$/i.test(this.item.companion)) {
            this.crossRef = window.PowerShellIde.crossReference(this.activeAst, this.companionAst, this.companionText);
          }
        }
      },
      jumpToLine(line) {
        const lineEl = this.$el.querySelector('#ps-L' + line) || this.$el.querySelector('#xaml-L' + line);
        if (lineEl) {
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          lineEl.classList.add('bg-primary/20');
          setTimeout(() => lineEl.classList.remove('bg-primary/20'), 2000);
        }
      },
      async copyCode() {
        try {
          const text = await this.fetchText();
          await navigator.clipboard.writeText(text);
          window.Alpine.store('toast')?.('copy', 'Code copied to clipboard.', 'alert-success', 3000);
        } catch (e) { this.err = 'Copy failed: ' + (e?.message || e); }
      },
      async copySuccinctCode() {
        try {
          const text = await this.fetchText();
          const succinct = window.PowerShellIde?.stripComments ? window.PowerShellIde.stripComments(text) : text;
          await navigator.clipboard.writeText(succinct);
          window.Alpine.store('toast')?.('scissors', 'Succinct code (comments removed) copied.', 'alert-success', 3000);
        } catch (e) { this.err = 'Copy failed: ' + (e?.message || e); }
      },
      async pasteClipboardHash() {
        try {
          const clip = await navigator.clipboard.readText();
          if (clip) {
            this.compareDraft = clip.trim();
            window.Alpine.store('toast')?.('clipboard', 'Clipboard contents pasted.', 'alert-info', 2000);
          }
        } catch (e) {
          this.compareError = 'Clipboard read unavailable. Paste directly into text box.';
        }
      },
      stageVerifiedHashRecord() {
        if (!this.item || !this.detectedHash) return;
        this.pending = {
          kind: 'check',
          check: {
            path: this.item.path,
            revision: this.revision,
            blobSha: this.item.blobSha,
            incomingSha256: this.detectedHash,
            exact: true,
            lineEndingsOnly: false,
            source: 'hash'
          },
          why: 'Record that a supplied work copy SHA-256 hash matched revision ' + short(this.revision) + '.',
          confirm: 'Record this verified hash'
        };
        this.renderPending();
      },
      stageDiffersHashRecord() {
        if (!this.item || !this.detectedHash) return;
        this.pending = {
          kind: 'check',
          check: {
            path: this.item.path,
            revision: this.revision,
            blobSha: this.item.blobSha,
            incomingSha256: this.detectedHash,
            exact: false,
            lineEndingsOnly: false,
            source: 'hash'
          },
          why: 'Record that a supplied work copy SHA-256 hash differed from revision ' + short(this.revision) + '.',
          confirm: 'Record this differing hash'
        };
        this.renderPending();
      },
      async copyTransferHelper() {
        if (!this.transfer?.installCmd) return;
        try {
          await navigator.clipboard.writeText(this.transfer.installCmd);
          window.Alpine.store('toast')?.('terminal', 'Transfer command copied.', 'alert-info', 3000);
        } catch (e) { this.err = 'Copy failed: ' + (e?.message || e); }
      },
      async copyHeaderSnippet() {
        if (!this.transfer?.headerSnippet) return;
        try {
          await navigator.clipboard.writeText(this.transfer.headerSnippet);
          window.Alpine.store('toast')?.('hash', '# @file header snippet copied.', 'alert-info', 3000);
        } catch (e) { this.err = 'Copy failed: ' + (e?.message || e); }
      },
      async copySnippet(code) {
        try {
          await navigator.clipboard.writeText(code);
          window.Alpine.store('toast')?.('copy', 'PowerShell snippet copied to clipboard.', 'alert-success', 3000);
        } catch (e) { this.err = 'Copy failed: ' + (e?.message || e); }
      },
      async copyTransferCommand(type) {
        if (!this.transfer) return;
        const cmd = type === 'verify' ? this.transfer.verifyCmd : this.transfer.installCmd;
        try {
          await navigator.clipboard.writeText(cmd);
          window.Alpine.store('toast')?.('terminal', 'PowerShell command copied.', 'alert-info', 3000);
        } catch (e) { this.err = 'Copy failed: ' + (e?.message || e); }
      },

      // ── Compare a work copy (browser-local check, then the Stage diff) ───
      toggleCompare() { this.compareOpen = !this.compareOpen; this.compareError = ''; },
      async submitCompare() {
        if (!this.compareDraft || this.compareBusy || !this.item) return;
        this.compareBusy = true; this.compareError = '';
        try { await shell().openCorrespondence(this.target(), this.compareDraft, this.item.name, 'field'); this.compareDraft = ''; }
        catch (e) { this.compareError = e?.message || String(e); }
        finally { this.compareBusy = false; await this.loadChecks(); }
      },
      async comparePicked(e) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) await this.compareFile(file, 'file picker');
      },
      async compareDrop(e) {
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length === 1) await this.compareFile(files[0], 'drop');
        else if (!files.length) {
          const text = e.dataTransfer?.getData('text') || '';
          if (text && this.item) { try { await shell().openCorrespondence(this.target(), text, this.item.name, 'drop'); } catch (err) { this.compareError = err?.message || String(err); } }
        }
      },
      async compareFile(file, source) {
        if (!this.item) return;
        this.compareError = '';
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const text = window.FileCorrespondence.decodeBytes(bytes, this.compareEncoding);
          await shell().openCorrespondence(this.target(), text, file.name, source);
        } catch (e) { this.compareError = e?.message || String(e); }
        await this.loadChecks();
      },
      async reopen(check) {
        try { await window.FileCorrespondence.reopen(check); shell()?.goStage(); }
        catch (e) { this.compareError = 'Could not reopen check: ' + (e?.message || e); }
      },

      // ── The GitHub text, for manual placement ────────────────────────────
      async fetchText(reqId, targetPath) {
        const item = targetPath ? (this.items.find(it => it.path === targetPath) || this.item) : this.item;
        if (!item) return '';
        if (this.text && (!targetPath || targetPath === this.item?.path)) return this.text;
        this.textBusy = true;
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo });
          gh.ref = this.revision || this.ref;
          const f = await gh.get(item.path);
          if (reqId && reqId !== this.loadRequestId) return f.text;
          this.text = f.text;
          this.refreshIde(f.text);
          return f.text;
        } finally {
          if (!reqId || reqId === this.loadRequestId) {
            this.textBusy = false;
          }
        }
      },
      async copyText() {
        try {
          const text = await this.fetchText();
          await navigator.clipboard.writeText(text);
          this.lastTransfer = { ...this.lastTransfer, [this.item.path]: 'copy' };
          window.Alpine.store('toast')?.('copy', 'GitHub text copied. Place it on the work computer, then Record installed.', 'alert-info', 6000);
        } catch (e) { this.err = 'Copy failed: ' + (e?.message || e); }
      },
      async downloadText() {
        try {
          const text = await this.fetchText();
          window.io?.save?.(text, this.item.name, 'text/plain');
          this.lastTransfer = { ...this.lastTransfer, [this.item.path]: 'download' };
        } catch (e) { this.err = 'Download failed: ' + (e?.message || e); }
      },

      // ── The write, in two taps ───────────────────────────────────────────
      async askInstalled() {
        if (!this.item) return;
        this.recordError = ''; this.recorded = null;
        try {
          const text = await this.fetchText();
          const sha256 = await K().digest(text);
          const method = this.lastTransfer[this.item.path] || 'reported';
          this.pending = { kind: 'installed', method, sha256,
            why: 'Record that you placed this GitHub revision on the work computer. Nothing here has inspected that computer; the row records your report.',
            confirm: 'I placed this on the work computer' };
          this.renderPending();
        } catch (e) { this.recordError = e?.message || String(e); }
      },
      askCheck(check) {
        this.recordError = ''; this.recorded = null;
        this.pending = { kind: 'check', check,
          why: (check.exact || check.lineEndingsOnly ? 'Record that a supplied work copy matched' : 'Record that a supplied work copy differed from')
            + ' revision ' + short(check.revision) + '. The row carries the check\'s hashes; it does not claim the file was installed.',
          confirm: 'Record this check' };
        this.renderPending();
      },
      renderPending() {
        if (!this.pending || !this.item) return;
        try {
          const p = this.pending;
          p.row = p.kind === 'installed'
            ? K().row({ kind: 'installed', path: this.item.path, revision: this.revision, blobSha: this.item.blobSha,
                sha256: p.sha256, method: p.method, note: this.recordNote })
            : K().fromCheck(p.check, this.recordNote);
          p.line = K().line(p.row);
          this.pending = { ...p };
        } catch (e) { this.recordError = e?.message || String(e); }
      },
      async confirmRecord() {
        if (!this.pending?.row || this.recording) return;
        this.recording = true; this.recordError = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo });
          gh.ref = this.ref;
          const res = await K().append({ gh, path: this.ledgerPath, row: this.pending.row });
          this.recorded = 'Recorded ' + this.rowLabel(this.pending.row) + ' in ' + this.ledgerPath.split('/').pop()
            + (res.commit ? ' (' + short(res.commit) + ')' : '') + '.';
          this.pending = null; this.recordNote = '';
          await this.loadRows();
          window.Alpine.store('toast')?.('check', this.recorded, 'alert-success', 5000);
        } catch (e) { this.recordError = 'Not recorded: ' + (e?.message || e); }
        finally { this.recording = false; }
      },
    };
  });
});
