document.addEventListener('alpine:init', function() {
  Alpine.data('waiting', function() {
    // The Waiting view: what waits on the owner, in one place (owner,
    // 2026-10-04: "is there somewhere in the app I can see them, and does it
    // include doc calls?"). Two queues, read by lib/kits/user-calls.js: the
    // open user calls, and the Text collection's proposals Dictate would stage
    // on each file as it stands.
    //
    // THREE TABS: Calls, Edits, Tighten (owner, 2026-10-06: "group and
    // rename"). The proposals split by what their variant's purpose does to
    // the text (mdVariants.kind): an edit changes what a paragraph says, most
    // often an update after a change elsewhere made a claim wrong; a
    // tightening keeps what it says in fewer or plainer words. The two differ
    // in urgency, since an unapplied edit leaves a wrong statement and an
    // unapplied tightening costs nothing, so Edits comes first. A file with
    // both kinds is a row in each tab, and its Review opens Dictate with only
    // that tab's kind staged (&proposed=edit or &proposed=tighten).
    //
    // TWO CONTAINERS AND NOTHING ABOVE THEM (owner, 2026-10-06, on a phone:
    // "the list on the top and then the embedded swiper basically on the
    // bottom in its own container ... the standing calls would be in one tab,
    // and then the list of the other proposals would be in another tab"). The
    // list holds the tabs in its own head row, so the view spends no height on
    // a title. Below the list, a STRIP of detail cards, one per row the list
    // shows: a swipe moves to the next row's card and the list's selection
    // follows it, kept in view inside the list and never by scrolling the
    // page; a pick in the list moves the strip. One head row above the strip
    // counts the card in view and carries its ways out. At @3xl the two
    // containers sit side by side instead of stacked.
    //
    // THE EXPANDER IS THE DECK TAKEOVER (owner, 2026-10-06: "the natural way
    // ... is that it would just have the ability to go into the swipe deck
    // cards and swipe through everything in the list above"). It replaced a
    // mode that hid the list and gave the strip the whole height, which was a
    // second full-screen idiom beside the house one. The deck shows the same
    // cards (CARD) over the same rows, opened on the row in view; back closes
    // it onto the list with the selection where the swipe left it.
    //
    // The pattern is budget-drs's corpusSwiper (home, app/view/views/
    // corpora.js, the Comp and CSM tabs), which took it from this repo's
    // branch page (branch-brief.js, its file strip). The strip is built the
    // branch page's way, in Alpine, rather than on swipeDeck.core(): a card
    // here is Alpine markup with md-diff mounted into it, and a core slide is
    // filled by a render callback outside Alpine's tree.
    //
    // The detail is what was a click away before 2026-10-05: a call's brief
    // and recommendation, and each edit's reason above the edit itself, drawn
    // as md-diff's inline reading (the words that leave struck, the words that
    // arrive tinted); a file's staged proposals the same way, with who
    // proposed each and on what basis. A card mounts when the strip comes
    // within one card of it and then stays mounted, so swiping back is instant.
    //
    // A CALL IS ANSWERED WHERE IT IS READ (owner, 2026-10-06, on a phone, of
    // two merge calls whose card was empty and whose Answer opened another
    // page: "there's a lot of extra steps there for no reason. And the
    // decision could be made right here"). The detail container is built as a
    // header, a body and a footer (owner, later the same day: "to the extent
    // that we have like button content for taking action, it would make
    // sense to put that in a footer ... right there on the surface always").
    //
    //   Header  the call's status, read from GitHub rather than claimed: its
    //           PR in its state's colour, CI on the PR's head commit, GitHub's
    //           mergeable_state, the other PRs it names still open, and a
    //           count of what moved since it was filed. Each says what it
    //           checked, and what Merge does about it, in its title-tip; none
    //           asks the owner to act, since answering Merge sends the session
    //           to resolve conflicts and failing checks first. The refresh
    //           reads all of it past the client's cache, and its tip lists
    //           what it checks for this call.
    //   Body    what the answer rests on: the brief and the recommendation,
    //           or for a merge what ships, what is loose and what changes on
    //           main, then the materials one link each. These are the filing
    //           session's words at filing time and nothing re-verifies them;
    //           the moved count is what says they may be stale.
    //   Footer  the answers as buttons, each two taps with the second on
    //           Confirm in the same place, because a session acts on the
    //           answer as soon as it is commented on the PR. A message instead
    //           of a merge, or a note with a decision, opens from its own
    //           button in the footer itself, not in a modal. A documentation
    //           call and a file put Review in Dictate here, where they are
    //           still answered.
    //
    // The answer is written as the call page writes it (UserCallForm.postAnswer)
    // and, where the call names a PR, commented there, which wakes the session
    // watching it.
    //
    // THE HEAD ROW'S WAYS OUT ARE ICONS (owner, 2026-10-06: the Open link "is
    // kind of superfluous at this point ... it should be more minimal and just
    // an icon"). A call answered here keeps one: the Claude mark, opening the
    // session that filed it in Claude Code, as the session page and the
    // Activity view's session deck draw it. The call's own page dropped out
    // (owner, same day: "we don't need that"), since the card and the deck
    // now carry everything the page did but render the materials, which the
    // card links one by one. The session is resolved
    // from state/session-menu.json, the store's short-id index, and the mark
    // is left off a call whose session the index no longer carries. A
    // documentation call and a file keep a labelled Review, since Dictate is
    // still where they are answered.
    //
    // Calls are cheap (one listing and a read each) and come first; the
    // proposals need the collection's passages, so they arrive after, their tab
    // saying so meanwhile. The nav entry is standing, with the count of open
    // calls as its badge (the shell's waitingCount).
    const U = () => window.UserCalls;
    // One row's card, drawn by the strip and by the deck takeover alike: in
    // scope it needs `r`, the row, and `deck`, true only inside the deck.
    // The call's status (header), its actions (footer) and its card (body),
    // each drawn by the container and by the deck takeover alike. In scope
    // they need `r`, the row, and `deck`, true only inside the deck.
    const STATUS = `
                        <span class="hidden" x-init="loadFacts(r.c); loadSince(r.c)"></span>
                        <template x-if="r.c.pr">
                          <a :href="prUrl(r.c.pr)" target="_blank" rel="noopener" data-waiting-pr data-title-tip-bare :data-title-tip="prTip(r.c)"
                             class="inline-flex items-center gap-1 rounded-full border px-2 text-sm leading-6 shrink-0 hover:bg-base-200" :class="prTone(r.c)">
                            <i class="ph ph-git-pull-request"></i><span x-text="'#' + prNum(r.c)"></span></a>
                        </template>
                        <button type="button" x-show="!!branchOf(r.c)" @click="openBranch(r.c)" data-waiting-branch
                                class="btn btn-sm btn-ghost btn-square shrink-0" data-title-tip-bare data-title-tip-lead="Open in Activity"
                                :data-title-tip="branchOf(r.c)?.name" aria-label="Open the branch in Activity">
                          <i class="ph ph-git-branch text-lg"></i></button>
                        <span x-show="!!ciIcon(r.c)" data-waiting-ci data-title-tip-bare :data-title-tip="ciTip(r.c)"
                              class="inline-flex text-xl leading-none shrink-0" :class="ciTone(r.c)"><i class="ph" :class="ciIcon(r.c)"></i></span>
                        <span x-show="!!mergeIcon(r.c)" data-waiting-mergeable data-title-tip-bare :data-title-tip="mergeTip(r.c)"
                              class="inline-flex text-xl leading-none shrink-0" :class="mergeTone(r.c)"><i class="ph" :class="mergeIcon(r.c)"></i></span>
                        <span x-show="!!prsLine(r.c)" data-waiting-prs data-title-tip-bare :data-title-tip="prsTip(r.c)"
                              class="inline-flex items-center gap-1 text-sm text-base-content/70 shrink-0"><i class="ph ph-git-pull-request"></i><span x-text="prsLine(r.c)"></span></span>
                        <span x-show="movedCount(r.c) > 0" data-waiting-moved data-title-tip-bare :data-title-tip="sinceLine(r.c)"
                              class="badge badge-sm badge-warning gap-1 shrink-0"><i class="ph ph-pulse"></i><span x-text="movedCount(r.c) + ' new'"></span></span>
                        <button type="button" data-waiting-refresh x-show="checkable(r.c)" @click="refreshCall(r.c)" :disabled="!!since[r.c.id]?.busy"
                                class="btn btn-sm btn-ghost btn-square shrink-0" data-title-tip-bare data-title-tip-lead="Check GitHub"
                                :data-title-tip="checkedTip(r.c)" aria-label="Check GitHub">
                          <i class="ph ph-arrows-clockwise text-lg" :class="since[r.c.id]?.busy && 'animate-spin'"></i></button>
                        <button type="button" data-waiting-gemini x-show="r.c.open && r.c.kind !== 'documentation'" @click="askGemini(r.c)"
                                :disabled="geminiBusy(r.c)" :data-stage="checks[r.c.id]?.stage || ''"
                                class="btn btn-sm btn-ghost btn-square shrink-0" data-title-tip-bare data-title-tip-lead="Ask Gemini"
                                :data-title-tip="geminiTip(r.c)" aria-label="Ask Gemini to check this call">
                          <span x-show="geminiBusy(r.c)" class="loading loading-spinner loading-xs"></span>
                          <span x-show="!geminiBusy(r.c)" class="inline-flex" x-html="geminiMark()"></span></button>
    `;
    const FOOT = `
                        <div class="flex flex-col gap-2" data-waiting-actions>
                          <template x-if="r.kind === 'call' && !r.c.open">
                            <div class="flex items-start gap-2 text-sm" data-waiting-answer>
                              <i class="ph ph-check-circle text-lg text-success shrink-0"></i>
                              <div class="min-w-0">
                                <span class="font-medium" x-text="'Answered: ' + lastAnswer(r.c)"></span>
                                <span class="text-base-content/50" x-text="answerBy(r.c)"></span>
                                <p x-show="lastNote(r.c)" class="text-base-content/70" x-text="lastNote(r.c)"></p>
                              </div>
                            </div>
                          </template>
                          <!-- The message or note opens from its button, in
                               place, rather than standing open or in a modal. -->
                          <template x-if="r.kind === 'call' && r.c.open && noteOpen[r.c.id]">
                            <div class="flex items-center gap-2" data-waiting-note-field>
                              <input type="text" x-model="notes[r.c.id]" x-init="$nextTick(() => $el.focus({ preventScroll: true }))"
                                     class="input input-sm input-bordered w-auto grow basis-40 min-w-0"
                                     :placeholder="r.c.kind === 'merge' ? 'A message, or a note on the call' : 'A note, with your answer or on its own'">
                              <template x-if="r.c.kind === 'merge'">
                                <button type="button" class="btn btn-sm btn-primary shrink-0" data-waiting-send-message
                                        :disabled="!(notes[r.c.id] || '').trim() || !!sending[r.c.id]" @click="answer(r.c, 'Message', notes[r.c.id])">Send</button>
                              </template>
                              <!-- A note on the call answers nothing: it waits in the
                                   notes store, where the card and the next session read it. -->
                              <button type="button" class="btn btn-sm btn-ghost shrink-0 gap-1" data-waiting-save-note
                                      :disabled="!(notes[r.c.id] || '').trim() || !!noting[r.c.id]" @click="saveNote(r.c, notes[r.c.id])"
                                      data-title-tip-bare data-title-tip="Keep this as a note on the call, without answering it">
                                <span x-show="noting[r.c.id]" class="loading loading-spinner loading-xs"></span>
                                <i x-show="!noting[r.c.id]" class="ph ph-note"></i><span>Note</span></button>
                            </div>
                          </template>
                          <template x-if="r.kind === 'call' && r.c.open && r.c.kind === 'merge' && !!prDone(r.c)">
                            <div class="flex items-center gap-2 text-sm text-base-content/70" data-waiting-pr-done>
                              <i class="ph ph-info text-lg shrink-0"></i><span x-text="prDone(r.c)"></span></div>
                          </template>
                          <template x-if="r.kind === 'call' && r.c.open && answersOf(r.c).length">
                            <div class="flex flex-wrap items-center gap-2">
                              <template x-for="o in answersOf(r.c)" :key="o">
                                <button type="button" data-waiting-answer-btn :data-option="o" :disabled="!!sending[r.c.id]" @click="tapAnswer(r.c, o)"
                                        class="btn btn-sm gap-1.5" :class="answerClass(r.c, o)">
                                  <span x-show="sending[r.c.id] === o" class="loading loading-spinner loading-xs"></span>
                                  <i x-show="sending[r.c.id] !== o && !!answerIcon(r.c, o)" class="ph" :class="answerIcon(r.c, o)"></i>
                                  <span x-text="isArmed(r.c, o) ? 'Confirm' : o"></span>
                                </button>
                              </template>
                              <button type="button" data-waiting-note data-title-tip-bare @click="noteOpen[r.c.id] = !noteOpen[r.c.id]"
                                      class="btn btn-sm btn-ghost btn-square" :class="noteOpen[r.c.id] && 'btn-active'"
                                      :aria-label="r.c.kind === 'merge' ? 'Message instead' : 'Add a note'"
                                      :data-title-tip="r.c.kind === 'merge' ? 'A message instead of merging, or a note on the call' : 'A note with your answer, or on its own'">
                                <i class="ph text-lg" :class="r.c.kind === 'merge' ? 'ph-chat-circle-text' : 'ph-note-pencil'"></i></button>
                            </div>
                          </template>
                          <p x-show="r.kind === 'call' && !!sendErr[r.c.id]" class="text-sm text-error" x-text="r.kind === 'call' ? sendErr[r.c.id] : ''"></p>
                          <template x-if="r.kind === 'file' || r.c.kind === 'documentation'">
                            <a :href="actionHref(r)" target="_blank" rel="noopener" data-waiting-open :data-kind="r.kind"
                               class="btn btn-sm btn-primary self-start gap-1.5"><i class="ph ph-pencil-line"></i><span>Review in Dictate</span></a>
                          </template>
                        </div>
    `;
    const CARD = `
                    <template x-if="mounted[r.id] && r.kind === 'call'">
                      <article class="grow flex flex-col gap-4" data-waiting-detail-call :data-id="r.c.id">
                        <!-- In the deck the header is the kit's, so the call's
                             status rides at the head of its card. -->
                        <template x-if="deck && hasStatus(r)">
                          <div class="flex items-center gap-1.5 flex-wrap" data-waiting-status>${STATUS}</div>
                        </template>
                        <p x-show="r.c.name && r.c.question" class="text-lg font-medium text-pretty" data-waiting-question x-text="r.c.question"></p>
                        <!-- What sort of call it is, as filed: size, how firm,
                             one-way or not, what it waits on, and the derived
                             Easy. GitHub's live state is the header's. -->
                        <div x-show="shapeOf(r.c).length" class="flex items-center gap-1.5 flex-wrap" data-waiting-shape
                             x-init="loadDeps(r.c)">
                          <template x-for="t in shapeOf(r.c)" :key="t.key">
                            <span class="badge gap-1" :class="t.tone" :data-shape="t.key" data-title-tip-bare :data-title-tip="t.tip">
                              <i class="ph" :class="t.icon"></i><span x-text="t.label"></span></span>
                          </template>
                        </div>
                        <p x-show="r.c.brief" class="text-base text-base-content/80 text-pretty" x-text="r.c.brief"></p>
                        <div x-show="r.c.recommend" class="text-base text-pretty" data-waiting-recommend>
                          <span class="font-medium">Recommended:</span>
                          <span x-text="r.c.recommend"></span><span x-show="r.c.why" class="text-base-content/60" x-text="', since ' + r.c.why"></span>
                        </div>
                        <!-- A MERGE CALL: what ships, what stays loose, and what
                             changes on main. The PR itself is in the header. -->
                        <template x-if="r.c.kind === 'merge'">
                          <div class="flex flex-col gap-4" data-waiting-merge>
                            <ul class="flex flex-col gap-3" data-waiting-shipped>
                              <template x-for="(x, i) in (r.c.shipped || [])" :key="r.c.id + ':s' + i">
                                <li class="flex gap-2.5">
                                  <span class="mt-0.5 size-6 shrink-0 rounded-full grid place-items-center" :class="changeOf(x).tone" :title="changeOf(x).label">
                                    <i class="ph text-sm" :class="changeOf(x).icon"></i></span>
                                  <div class="min-w-0 flex flex-col gap-0.5 text-base">
                                    <div class="flex items-baseline gap-x-2 flex-wrap">
                                      <span class="font-semibold" x-text="x.head || shipText(x)"></span>
                                      <a x-show="proofOf(x)" :href="proofOf(x)?.href" target="_blank" rel="noopener"
                                         class="text-sm text-base-content/50 hover:text-primary inline-flex items-center gap-1">
                                        <i class="ph" :class="proofOf(x)?.icon"></i><span x-text="proofOf(x)?.label"></span></a>
                                    </div>
                                    <div x-show="x.old" class="text-base-content/60"><span class="text-sm">Was </span><span x-text="x.old"></span></div>
                                    <div x-show="x.new"><span x-show="x.old" class="text-sm text-base-content/60">Now </span><span x-text="x.new"></span></div>
                                    <div x-show="x.head && x.text" class="text-base-content/70" x-text="x.text"></div>
                                  </div>
                                </li>
                              </template>
                            </ul>
                            <ul x-show="(r.c.loose || []).length" class="flex flex-col gap-1 text-base" data-waiting-loose>
                              <template x-for="x in (r.c.loose || [])" :key="x">
                                <li class="flex gap-2 leading-snug"><i class="ph ph-circle-dashed mt-1 shrink-0 text-warning"></i><span x-text="x"></span></li>
                              </template>
                            </ul>
                            <p x-show="r.c.effect" class="text-base text-base-content/80 text-pretty" data-waiting-effect>
                              <span class="font-medium">Once merged:</span> <span x-text="r.c.effect"></span></p>
                          </div>
                        </template>
                        <!-- What the answer rests on, one link each. -->
                        <ul x-show="r.c.kind !== 'documentation' && matsOf(r.c).length" class="flex flex-col gap-1.5 text-base" data-waiting-materials>
                          <template x-for="(m, i) in matsOf(r.c)" :key="r.c.id + ':m' + i">
                            <li><a :href="m.href" target="_blank" rel="noopener" class="inline-flex items-start gap-2 hover:text-primary">
                              <i class="ph mt-1 shrink-0 text-base-content/50" :class="m.icon"></i><span x-text="m.label"></span></a></li>
                          </template>
                        </ul>
                        <!-- NOTES ON THE CALL: second opinions and the owner's own
                             notes (the notes store, addressed to the call), and the
                             tending findings that name it among their subjects. -->
                        <section x-show="noteRows(r.c).length" class="flex flex-col gap-3" data-waiting-notes>
                          <template x-for="x in noteRows(r.c)" :key="x.n.id">
                            <div class="flex gap-2.5" :class="x.d && 'ml-6'" data-waiting-note-row :data-stance="x.n.stance || ''">
                              <i class="ph mt-1 shrink-0 text-base-content/50" :class="x.n.finding ? 'ph-magnifying-glass' : x.d ? 'ph-arrow-bend-down-right' : 'ph-note'"></i>
                              <div class="min-w-0 flex flex-col gap-0.5">
                                <div class="flex items-center gap-1.5 flex-wrap text-sm text-base-content/50">
                                  <span x-text="whoOf(x.n.author)"></span><span x-text="'· ' + ago(x.n.at)"></span>
                                  <span x-show="!!x.n.stance" class="badge badge-sm border-0" :class="stanceTone(x.n.stance)" x-text="stanceLabel(x.n.stance)"></span>
                                  <span x-show="!!x.n.finding" class="badge badge-sm badge-ghost" x-text="'Finding' + (x.n.finding?.status && x.n.finding.status !== 'open' ? ', ' + x.n.finding.status : '')"></span>
                                </div>
                                <p class="text-base text-pretty" x-text="x.n.text"></p>
                              </div>
                            </div>
                          </template>
                        </section>
                        <div class="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-base-content/50">
                          <a x-show="r.c.file" :href="fileGh(r.c)" target="_blank" rel="noopener" class="font-mono hover:text-primary break-all" x-text="shortFile(r.c)"></a>
                          <a x-show="r.c.session" :href="sessionHref(r.c)" target="_blank" rel="noopener" class="hover:text-primary" x-text="'session ' + r.c.session"></a>
                        </div>
                        <ol class="flex flex-col gap-5" data-waiting-edits>
                          <template x-for="(e, i) in (r.c.edits || [])" :key="r.c.id + ':' + i">
                            <li class="flex flex-col gap-1.5" data-waiting-edit>
                              <div class="flex items-baseline gap-2">
                                <span class="badge badge-sm tabular-nums shrink-0" x-text="i + 1"></span>
                                <span x-show="decisionOf(r.c, i)" class="badge badge-sm shrink-0" :class="decisionTone(decisionOf(r.c, i))" x-text="decisionOf(r.c, i)"></span>
                                <span class="text-base text-base-content/80 text-pretty" x-text="e.why || ''"></span>
                              </div>
                              <div class="rounded-lg border border-base-300 px-3 py-2" x-init="mountDiff($el, e.from, e.to)" data-waiting-diff></div>
                            </li>
                          </template>
                        </ol>
                        <!-- In the deck the actions ride at the foot of the card,
                             held on screen while it scrolls. -->
                        <template x-if="deck">
                          <div class="mt-auto sticky bottom-0 z-10 -mx-4 sm:-mx-8 -mb-5 sm:-mb-8 px-4 sm:px-8 py-3 border-t border-base-300 bg-base-100">${FOOT}</div>
                        </template>
                      </article>
                    </template>

                    <template x-if="mounted[r.id] && r.kind === 'file'">
                      <article class="grow flex flex-col gap-4" data-waiting-detail-file :data-file="r.f.file">
                        <div class="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-base-content/50">
                          <span x-text="r.f.repo"></span>
                          <a :href="'https://github.com/' + r.f.repo + '/blob/main/' + r.f.path" target="_blank" rel="noopener"
                             class="flex items-center gap-1 hover:text-primary"><i class="ph ph-github-logo"></i>on GitHub</a>
                        </div>
                        <ol class="flex flex-col gap-5" data-waiting-items>
                          <template x-for="(it, i) in r.f.items" :key="r.f.file + ':' + i">
                            <li class="flex flex-col gap-1.5" data-waiting-item>
                              <div class="flex items-baseline gap-2 flex-wrap text-sm text-base-content/50">
                                <span class="badge badge-sm tabular-nums shrink-0" x-text="i + 1"></span>
                                <span x-text="[it.author, it.purpose].filter(Boolean).join(' · ')"></span>
                                <a x-show="it.basis" :href="it.basis" target="_blank" rel="noopener" class="hover:text-primary" x-text="basisLabel(it.basis)"></a>
                              </div>
                              <div class="rounded-lg border border-base-300 px-3 py-2" x-init="mountDiff($el, it.from, it.to)" data-waiting-diff></div>
                            </li>
                          </template>
                        </ol>
                        <!-- In the deck the actions ride at the foot of the card,
                             held on screen while it scrolls. -->
                        <template x-if="deck">
                          <div class="mt-auto sticky bottom-0 z-10 -mx-4 sm:-mx-8 -mb-5 sm:-mb-8 px-4 sm:px-8 py-3 border-t border-base-300 bg-base-100">${FOOT}</div>
                        </template>
                      </article>
                    </template>
    `;

    return {
      description: 'Waiting view: the open user calls (decision, merge, documentation) from web-tools-private user-calls/, a merge or a decision answered in place from its row or its card, and the Text collection\'s proposals that Dictate would stage, by file, split into edits (what a paragraph says changes) and tightenings (only its wording does), in three tabs, each a list over a strip of detail cards that a swipe moves through with the list following.',

      calls: [],
      callsErr: '',
      loadingCalls: false,
      pending: null,
      pendingErr: '',
      loadingPending: false,
      showAnswered: false,
      asks: {},          // session short id -> its first ask, from the session index
      deps: {},          // a dependency's ref (a PR or a task) -> { met, state }, as read
      allNotes: [],      // the notes store, for notes and findings about a call
      me: '',            // the signed-in login, once a note has been written here
      noting: {},        // call id -> a note being saved
      checks: {},        // call id -> a Gemini check filed from here: { id, at, stage, message }
      POLL_MS: 30000,    // how often a filed check's result is looked for
      tab: 'calls',        // 'calls' | 'edit' | 'tighten'
      tabChosen: false,    // the reader picked a tab, so loading stops choosing
      picked: { calls: '', edit: '', tighten: '' },   // each tab's selected row key
      mounted: {},         // row ids whose card has mounted
      deck: false,         // shadowed true inside the deck takeover's slides
      _deck: null,         // the deck takeover's handle while it is open
      hovered: false,
      _aim: -1, _aimT: 0, _raf: 0,
      // Answering in place: each call's PR facts once read, a send in flight
      // or its error, the row whose button waits for Confirm, and a
      // decision's picked option and note, all keyed by call id.
      facts: {}, sending: {}, sendErr: {}, armed: '', _armT: 0, noteOpen: {}, notes: {}, ucf: null,
      agents: {},          // short session id -> its claude.ai session id
      since: {},           // call id -> { text, busy }: what moved since it was filed

      template: `
        <div class="@container h-full" data-waiting>
          <!-- data-pattern and data-slot name the unit's body and its tabs
               (data/ui-units/codebook.md, "Slots"); nothing at runtime reads
               them. -->
          <div class="h-full flex flex-col gap-3 @3xl:flex-row @3xl:gap-4" data-pattern="linked-swiper">

            <!-- THE LIST: the tabs as its head row, then the tab's rows. As
                 tall as its rows up to 40% of the view, so one open call
                 leaves the strip nearly all of it. -->
            <section data-waiting-list
                     class="shrink-0 min-h-0 max-h-[40%] flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100
                            @3xl:max-h-none @3xl:w-[22rem]">
              <div class="flex items-center gap-1 shrink-0 pl-1 pr-1 border-b border-base-300 bg-base-200/60">
                <div role="tablist" class="tabs tabs-border tabs-sm grow min-w-0 flex-nowrap" data-waiting-tabs data-slot="frame:tabs">
                  <template x-for="t in tabs" :key="t.key">
                    <button type="button" role="tab" class="tab gap-1.5 px-2.5" :data-waiting-tab="t.key"
                            :class="tab === t.key && 'tab-active'" :aria-selected="String(tab === t.key)" @click="setTab(t.key)">
                      <span x-text="t.label"></span>
                      <span x-show="t.loading" class="loading loading-dots loading-xs opacity-40"></span>
                      <span x-show="t.n != null" class="badge badge-xs tabular-nums" :class="t.warn && t.n ? 'badge-warning' : 'badge-ghost'" x-text="t.n"></span>
                    </button>
                  </template>
                </div>
                <button type="button" class="btn btn-ghost btn-xs btn-square text-base-content/50 shrink-0" @click="load(true)"
                        :disabled="!!(loadingCalls || loadingPending)" title="Refresh" aria-label="Refresh">
                  <i class="ph ph-arrows-clockwise text-base"></i></button>
              </div>

              <div x-ref="list" class="min-h-0 overflow-y-auto overscroll-contain" data-waiting-rows
                   @keydown.down.prevent="key(1)" @keydown.up.prevent="key(-1)">
                <template x-if="tab === 'calls'">
                  <div class="flex flex-col p-1" data-waiting-calls>
                    <div x-show="loadingCalls && !calls.length" class="flex px-2 py-2"><span class="loading loading-dots loading-sm opacity-40"></span></div>
                    <div x-show="callsErr" class="text-sm text-error px-2 py-1" x-text="callsErr"></div>
                    <div x-show="!loadingCalls && !callsErr && !openCalls.length" class="text-sm text-base-content/50 px-2 py-1">None open.</div>
                    <template x-for="c in listCalls" :key="c.id">
                      <div class="flex flex-col">
                      <div x-show="c === settledCalls[0]" data-waiting-settled-label
                           class="flex items-center gap-1.5 px-2 pt-2 pb-1 text-xs text-base-content/50">
                        <i class="ph ph-check-square-offset"></i><span>Settled on GitHub</span></div>
                      <div class="flex items-center gap-1 rounded-lg hover:bg-base-200"
                           :class="[isOn('call:' + c.id) && 'bg-primary/10 hover:bg-primary/10', settled(c) && 'opacity-60']">
                        <button type="button" @click="pickRow(c.id)" data-waiting-call :data-kind="c.kind" :data-key="'call:' + c.id"
                                class="grow min-w-0 flex items-start gap-2.5 px-2 py-1.5 text-left" :aria-current="isOn('call:' + c.id) ? 'true' : null">
                          <i class="ph text-lg mt-0.5 text-primary shrink-0" :class="kindIcon(c)"></i>
                          <span class="min-w-0 flex flex-col">
                            <span class="text-sm font-medium line-clamp-2" x-text="c.name || c.question"
                                  data-title-tip-bare :data-title-tip="c.name ? c.question : ''"></span>
                            <span class="text-xs text-base-content/50" x-text="callLine(c)" data-waiting-line
                                  data-title-tip-bare :data-title-tip="whoTip(c)"></span>
                          </span>
                        </button>
                        <span x-show="(c.pr && (!!ciIcon(c) || !!mergeIcon(c))) || easy(c) || unmet(c).length > 0"
                              class="flex items-center gap-1 shrink-0 pr-2 text-lg leading-none" data-waiting-row-status>
                          <span x-show="easy(c)" data-waiting-row-easy data-title-tip-bare data-title-tip="Easy: firm, reversible, small, and waiting on nothing."
                                class="text-success-content"><i class="ph ph-lightning"></i></span>
                          <span x-show="unmet(c).length > 0" data-waiting-row-waits data-title-tip-bare :data-title-tip="depsTip(c)"
                                class="text-warning"><i class="ph ph-hourglass-medium"></i></span>
                          <span x-show="!!ciIcon(c)" data-title-tip-bare :data-title-tip="ciTip(c)" :class="ciTone(c)"><i class="ph" :class="ciIcon(c)"></i></span>
                          <span x-show="!!mergeIcon(c)" data-title-tip-bare :data-title-tip="mergeTip(c)" :class="mergeTone(c)"><i class="ph" :class="mergeIcon(c)"></i></span>
                        </span>
                      </div>
                      </div>
                    </template>
                    <template x-if="answeredCalls.length">
                      <div class="flex flex-col">
                        <button type="button" @click="showAnswered = !showAnswered" data-waiting-answered-toggle
                                class="self-start flex items-center gap-1.5 px-2 py-1 text-xs text-base-content/50 hover:text-base-content/80">
                          <i class="ph" :class="showAnswered ? 'ph-caret-down' : 'ph-caret-right'"></i>
                          <span x-text="answeredCalls.length + ' answered'"></span></button>
                        <template x-if="showAnswered">
                          <div class="flex flex-col">
                            <template x-for="c in answeredCalls" :key="c.id">
                              <button type="button" @click="pickRow(c.id)" data-waiting-answered :data-key="'call:' + c.id"
                                      class="flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-base-200"
                                      :class="isOn('call:' + c.id) && 'bg-primary/10 hover:bg-primary/10'" :aria-current="isOn('call:' + c.id) ? 'true' : null">
                                <i class="ph text-base-content/40 shrink-0" :class="kindIcon(c)"></i>
                                <span class="min-w-0 flex-1 truncate" x-text="c.question"></span>
                                <span class="text-xs text-base-content/60 shrink-0" x-text="lastAnswer(c)"></span>
                              </button>
                            </template>
                          </div>
                        </template>
                      </div>
                    </template>
                    <a :href="'https://github.com/' + store + '/tree/main/user-calls'" target="_blank" rel="noopener"
                       class="self-start flex items-center gap-1.5 px-2 py-1 text-xs text-base-content/40 hover:text-primary">
                      <i class="ph ph-github-logo"></i><span>user-calls/ on GitHub</span></a>
                  </div>
                </template>

                <template x-if="tab !== 'calls'">
                  <div class="flex flex-col pb-1" data-waiting-proposed :data-proposed-kind="tab">
                    <div x-show="loadingPending" class="flex items-center gap-2 px-3 py-2 text-sm text-base-content/50">
                      <span class="loading loading-dots loading-sm opacity-40"></span><span>Reading the Text collection</span></div>
                    <div x-show="pendingErr" class="text-sm text-error px-3 py-1" x-text="pendingErr"></div>
                    <div x-show="pending && !groupsOf(tab).length" class="text-sm text-base-content/50 px-3 py-2">None pending.</div>
                    <template x-for="g in groupsOf(tab)" :key="g.repo">
                      <div class="flex flex-col" data-waiting-repo :data-repo="g.repo">
                        <div class="sticky top-0 z-10 flex items-baseline gap-2 px-3 pt-2 pb-1 bg-base-100">
                          <span class="text-xs font-semibold text-base-content/70" x-text="g.repo.split('/')[1]"></span>
                          <span class="text-xs text-base-content/40 tabular-nums" x-text="g.staged + ' in ' + g.files.length + (g.files.length === 1 ? ' file' : ' files')"></span>
                        </div>
                        <template x-for="f in g.files" :key="f.file">
                          <button type="button" @click="pickRow(f.file)" data-waiting-file :data-file="f.file" :data-key="tab + ':' + f.file"
                                  class="mx-1 flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-base-200"
                                  :class="isOn(tab + ':' + f.file) && 'bg-primary/10 hover:bg-primary/10'" :aria-current="isOn(tab + ':' + f.file) ? 'true' : null">
                            <span class="font-mono text-sm min-w-0 truncate" x-text="f.path"></span>
                            <span class="ml-auto badge badge-sm badge-ghost tabular-nums shrink-0" x-text="f.staged"></span>
                          </button>
                        </template>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </section>

            <!-- THE STRIP: one card per row the list shows, under one head row
                 that counts the card in view. -->
            <section data-waiting-detail class="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100"
                     @pointerenter="hovered = true" @pointerleave="hovered = false">
              <div data-waiting-head class="flex items-center gap-1 shrink-0 min-h-12 pl-3 pr-1 py-1 border-b border-base-300 bg-base-200/60">
                <span x-show="!cur" class="grow text-sm text-base-content/50" x-text="emptyLine"></span>
                <div x-show="rows.length > 1" data-waiting-pager class="flex items-center shrink-0 sm:-ml-2 max-sm:pr-1">
                  <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden" @click="go(at - 1)"
                          :disabled="at <= 0" title="Previous" aria-label="Previous"><i class="ph ph-caret-left"></i></button>
                  <span class="font-mono text-xs opacity-60 tabular-nums px-1" data-waiting-pos x-text="(at + 1) + '/' + rows.length"></span>
                  <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden" @click="go(at + 1)"
                          :disabled="at >= rows.length - 1" title="Next" aria-label="Next"><i class="ph ph-caret-right"></i></button>
                </div>
                <template x-for="r in (hasStatus(cur) ? [cur] : [])" :key="r.id">
                  <div class="min-w-0 flex items-center gap-1.5 overflow-hidden" data-waiting-status>${STATUS}</div>
                </template>
                <span x-show="!!cur" class="grow"></span>
                <a x-show="!!agentHref(cur)" :href="agentHref(cur)" target="_blank" rel="noopener" data-waiting-agent
                   class="btn btn-sm btn-square btn-ghost shrink-0" title="Open this session in Claude Code" aria-label="Open this session in Claude Code"
                   x-html="window.claudeMark?.svg?.({ cls: 'w-4 h-4 shrink-0' }) || ''"></a>
                <button type="button" class="btn btn-sm btn-ghost btn-square shrink-0" @click="openDeck()" data-waiting-full :disabled="!rows.length"
                        title="Swipe through these, full screen" aria-label="Swipe through these, full screen">
                  <i class="ph ph-arrows-out-simple text-lg"></i></button>
              </div>

              <div x-show="!rows.length" class="flex-1 min-h-0"></div>
              <!-- data-no-swipe: a sideways drag here is the strip's, never the
                   shell's view pager, even with one card and nothing to scroll. -->
              <div x-ref="strip" x-show="rows.length > 0" data-waiting-strip data-no-swipe @scroll.passive="stripScroll()"
                   class="flex-1 min-h-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain
                          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <template x-for="r in rows" :key="r.id">
                  <div data-slide :data-key="r.id" class="w-full shrink-0 snap-center min-h-0 overflow-y-auto overscroll-y-contain px-3 py-3 @3xl:px-5 @3xl:py-4">

${CARD}
                  </div>
                </template>
              </div>
              <!-- THE FOOTER: the row's actions, on the surface whatever the
                   card's scroll. -->
              <div x-show="!!cur" data-waiting-foot class="shrink-0 border-t border-base-300 bg-base-200/60 px-3 py-2">
                <template x-for="r in (cur ? [cur] : [])" :key="r.id">
                  <div>${FOOT}</div>
                </template>
              </div>
            </section>
          </div>
        </div>
      `,

      init() {
        this.$el.innerHTML = this.template;
        if (!window.TitleTip && window.gh?.load) window.gh.load('kits/title-tip.js');
        this.$nextTick(() => {
          if (!this.$el.isConnected) return;
          Alpine.initTree(this.$el);
          // A strip that changed width (a phone turned, the list hidden, the
          // view back from display:none) has every card at a new offset, so it
          // is put back on the card it was showing, at once.
          try {
            let w = 0;
            this._ro = new ResizeObserver(() => {
              const nw = this.$refs.strip?.clientWidth || 0;
              if (nw && nw !== w) { w = nw; this.jump(); }
            });
            if (this.$refs.strip) this._ro.observe(this.$refs.strip);
          } catch {}
        });
        // Mount the card in view and its neighbours.
        this.$watch(() => this.tab + '|' + this.at + '|' + this.rows.length, () => this.markNear());
        // The rows changed under the strip (a tab, the answered fold, a load),
        // so the strip is rebuilt and has to be put on the selected card.
        this.$watch(() => this.tab + '|' + this.rows.map((r) => r.id).join('\n'), () => {
          this.ensurePick();
          this.$nextTick(() => { this.jump(); this.reveal(); });
        });
        // Left and right move the strip while the pointer or focus is in the
        // view. Nothing in the shell binds the arrows; capture is so a focused
        // control inside a card does not swallow them first.
        this._onKey = (e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
          const t = e.target;
          if (t && (/^(INPUT|TEXTAREA|SELECT)$/i.test(t.tagName) || t.isContentEditable)) return;
          if (!this.$el.isConnected || !this.$el.offsetParent) return;
          if (!this.hovered && !this.$el.contains(document.activeElement)) return;
          if (this.rows.length < 2) return;
          e.preventDefault();
          this.go(this.at + (e.key === 'ArrowRight' ? 1 : -1));
        };
        window.addEventListener('keydown', this._onKey, true);
        // An address or a board's task naming a call (the shell's waitingCall)
        // while this view is already mounted.
        this._onCall = (e) => this.focusCall(e.detail?.id);
        document.addEventListener('web-tools:waiting-call', this._onCall);
        // Any view writing to the notes store announces it (kits/notes.js).
        this._onNotes = (e) => { if (e.detail?.repo === this.store) this.allNotes = e.detail.notes || []; };
        window.addEventListener('notes:changed', this._onNotes);
        this.load();
      },
      destroy() {
        window.removeEventListener('keydown', this._onKey, true);
        document.removeEventListener('web-tools:waiting-call', this._onCall);
        window.removeEventListener('notes:changed', this._onNotes);
        try { this._ro?.disconnect(); } catch {}
      },

      get store() { return U()?.STORE || 'mehrlander/web-tools-private'; },

      async load(fresh = false) {
        if (!window.UserCalls) await window.gh?.load?.('kits/user-calls.js');
        if (!U()) { this.callsErr = 'The user-calls kit did not load.'; return; }
        this.loadingCalls = true; this.callsErr = '';
        this.helpers().catch(() => {});
        if (!Object.keys(this.agents).length) this.loadAgents();
        this.loadNotes();
        try { this.calls = await U().list({ fresh }); }
        catch (e) { this.callsErr = 'User calls could not be read: ' + (e?.message || e); }
        finally { this.loadingCalls = false; }
        this.syncCount();
        for (const c of this.openCalls) { if (c.pr) this.loadFacts(c); this.loadDeps(c); }
        this.chooseTab();
        if (window.__shell?.waitingCall) this.focusCall(window.__shell.waitingCall);
        this.loadingPending = true; this.pendingErr = '';
        try { this.pending = await U().pendingEdits({ fresh }); }
        catch (e) { this.pendingErr = 'Proposed edits could not be read: ' + (e?.message || e); }
        finally { this.loadingPending = false; }
        this.chooseTab();
      },
      // Until the reader picks one, the tab is the first with something in it,
      // in the tabs' order: calls, then edits, then tightenings.
      chooseTab() {
        if (!this.tabChosen) this.tab = this.tabs.find((t) => t.n)?.key || 'calls';
        this.ensurePick();
      },
      setTab(t) { this.tabChosen = true; this.tab = t; },
      // Each tab keeps its own selection, and never shows a blank card while
      // it has a row: a selection the rows no longer hold falls to the first.
      ensurePick() {
        for (const t of ['calls', 'edit', 'tighten']) {
          const rows = this.rowsOf(t);
          if (!rows.some((r) => r.key === this.picked[t])) this.picked[t] = rows[0]?.key || '';
        }
      },

      // ── The rows and the strip ──────────────────────────────────────────
      // A row is what the list draws and the strip shows a card for: a call
      // (the open ones, then the answered while the fold is open) or a file,
      // holding only the proposals of the tab's kind.
      rowsOf(t) {
        if (t === 'calls') {
          const cs = [...this.listCalls, ...(this.showAnswered ? this.answeredCalls : [])];
          return cs.map((c) => ({ id: 'call:' + c.id, key: c.id, kind: 'call', c }));
        }
        return this.groupsOf(t).flatMap((g) => g.files).map((f) => ({ id: t + ':' + f.file, key: f.file, kind: 'file', f, k: t }));
      },
      get rows() { return this.rowsOf(this.tab); },
      get at() { const i = this.rows.findIndex((r) => r.key === this.picked[this.tab]); return i < 0 ? 0 : i; },
      get cur() { return this.rows[this.at] || null; },
      isOn(id) { return this.cur?.id === id; },
      markNear() {
        const rows = this.rows;
        for (let i = Math.max(0, this.at - 1); i <= Math.min(rows.length - 1, this.at + 1); i++) {
          if (!this.mounted[rows[i].id]) this.mounted[rows[i].id] = true;
        }
      },
      panels() {
        const el = this.$refs.strip;
        return el ? [...el.querySelectorAll(':scope > [data-slide]')] : [];
      },
      // The card nearest the strip's left edge, measured rather than divided
      // out of scrollLeft, which is what branch-brief learned to do.
      nearest() {
        const el = this.$refs.strip;
        if (!el) return -1;
        const x0 = el.getBoundingClientRect().left;
        let best = -1, near = Infinity;
        this.panels().forEach((k, i) => {
          const d = Math.abs(k.getBoundingClientRect().left - x0);
          if (d < near) { near = d; best = i; }
        });
        return best;
      },
      // A swipe: the selection follows the card in view, once per frame.
      stripScroll() {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
          this._raf = 0;
          if (!this.$refs.strip?.clientWidth) return;
          const best = this.nearest();
          if (best < 0) return;
          // A go() is in flight: its scroll passes the cards between, and
          // reading those back would walk the selection through each of them.
          if (this._aim >= 0) {
            if (best !== this._aim) return;
            this._aim = -1; clearTimeout(this._aimT);
          }
          if (best !== this.at && this.rows[best]) { this.picked[this.tab] = this.rows[best].key; this.reveal(); }
        });
      },
      // Move to row i: the selection at once, the strip after it. `instant`
      // for a pick in the list, where animating past twenty cards is noise.
      go(i, instant = false) {
        const rows = this.rows;
        if (!rows.length) return;
        i = Math.max(0, Math.min(rows.length - 1, i));
        this.picked[this.tab] = rows[i].key;
        this.reveal();
        this.scrollTo(i, instant);
      },
      // Be on the selected card, without travelling to it.
      jump() { this.scrollTo(this.at, true); },
      scrollTo(i, instant) {
        const el = this.$refs.strip, k = this.panels()[i];
        if (!el || !k || !el.clientWidth) return;
        const x = k.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
        if (Math.abs(el.scrollLeft - x) < 2) return;
        this._aim = i; clearTimeout(this._aimT);
        this._aimT = setTimeout(() => { this._aim = -1; this.stripScroll(); }, 900);
        el.scrollTo({ left: x, behavior: instant ? 'instant' : 'smooth' });
        if (Math.abs(el.scrollLeft - x) < 2) { this._aim = -1; clearTimeout(this._aimT); }
      },
      pickRow(key) {
        const i = this.rows.findIndex((r) => r.key === key);
        if (i >= 0) this.go(i, true);
      },
      // Open on one call, as an address or a board's task asked: the Calls
      // tab, the answered fold opened if that is where it sits. Once taken,
      // the shell forgets it (see waitingCall there).
      focusCall(id) {
        if (!id || !this.calls.length) return;
        const c = this.calls.find((x) => x.id === id);
        if (window.__shell && window.__shell.waitingCall === id) window.__shell.waitingCall = '';
        if (!c) return;
        this.tabChosen = true; this.tab = 'calls';
        if (!c.open) this.showAnswered = true;
        this.picked.calls = id;
        this.$nextTick(() => { this.jump(); this.reveal(); });
      },
      // Up and down in the list step the selection, the strip following, and
      // focus moves to the row without scrolling anything but the list.
      key(d) {
        this.go(this.at + d, true);
        this.$nextTick(() => this.rowEl()?.focus({ preventScroll: true }));
      },
      rowEl() {
        const id = this.cur?.id;
        return id ? this.$refs.list?.querySelector('[data-key="' + CSS.escape(id) + '"]') : null;
      },
      // Keep the selected row in view INSIDE THE LIST, never by scrolling the
      // page: a swipe through the cards walks the selection down rows the
      // reader may have scrolled away from. The lead clears the sticky
      // repository label over the proposed edits.
      reveal() {
        this.$nextTick(() => {
          const list = this.$refs.list, row = this.rowEl();
          if (!list || !row || !list.clientHeight) return;
          const box = list.getBoundingClientRect(), r = row.getBoundingClientRect();
          const lead = this.tab === 'calls' ? 4 : 30;
          if (r.top < box.top + lead) list.scrollTop -= box.top + lead - r.top;
          else if (r.bottom > box.bottom - 4) list.scrollTop += r.bottom - box.bottom + 4;
        });
      },
      // The deck takeover over the same rows, opened on the row in view: the
      // card is CARD, rendered in this component's scope with `deck` true, so
      // an answer given there is the same write and the list follows the
      // swipe. Its header names the row and carries the filing session's mark.
      async openDeck() {
        if (!window.swipeDeck) await window.gh?.load?.('kits/swipe-deck.js');
        const D = window.swipeDeck, rows = this.rows, host = this.$el;
        if (!D || !rows.length || this._deck) return;
        const chrome = (i) => {
          const r = rows[i];
          if (!r) return {};
          return r.kind === 'call' ? { title: r.c.name || r.c.question, subtitle: this.callLine(r.c), icon: this.kindIcon(r.c) }
                                   : { title: r.f.path, subtitle: this.fileLine(r.f, r.k), icon: 'ph-file-text' };
        };
        const link = (i) => {
          const href = this.agentHref(rows[i]);
          return href ? { href, title: 'Open this session in Claude Code', svg: window.claudeMark?.svg?.({ cls: 'w-3.5 h-3.5 shrink-0' }) } : null;
        };
        const render = (i, slide) => {
          const r = rows[i];
          if (!r) return;
          this.mounted[r.id] = true;
          const el = document.createElement('div');
          el.className = 'grow flex flex-col';
          el.innerHTML = CARD;
          window.Alpine.addScopeToNode(el, { r, deck: true }, host);
          slide.append(el);
          window.Alpine.initTree(el);
        };
        this._deck = D.open({
          count: rows.length, start: this.at, render, ...chrome(this.at), link: link(this.at),
          // A column as tall as the slide, so a short card's footer still
          // sits at the bottom edge.
          innerClass: 'min-h-full flex flex-col',
          index: (i) => chrome(i),
          onClose: () => {
            this._deck = null;
            const after = this._afterDeck; this._afterDeck = null;
            this.$nextTick(() => { if (after) after(); else { this.jump(); this.reveal(); } });
          },
        });
        this._deck.deck.onSlide((i) => {
          if (rows[i] && this.rows.some((x) => x.key === rows[i].key)) this.picked[this.tab] = rows[i].key;
          const c = chrome(i);
          this._deck?.setTitle?.(c.title); this._deck?.setSubtitle?.(c.subtitle);
          this._deck?.setIcon?.(c.icon); this._deck?.setLink?.(link(i));
        });
      },

      // One edit as md-diff draws a change's `both` stop, mounted when its card
      // is: the words that leave struck, the words that arrive tinted.
      async mountDiff(host, from, to) {
        try {
          if (!window.mdDiff) await window.gh?.load?.('kits/md-diff.js');
          const box = await window.mdDiff.inline(from, to);
          if (host.isConnected || host.parentNode) host.replaceChildren(box);
        } catch (e) {
          host.textContent = String(to || '');
        }
      },

      get openCalls() { return this.calls.filter((c) => c.open); },
      // A merge call whose PR GitHub already merged or closed is SETTLED: still
      // open in the store, since nobody has answered it, but nothing waits on
      // the owner. It leaves the count and sorts after the calls that do wait.
      // Derived from the PR read, never written; a session closes the call
      // itself with user-call.py close.
      settled(c) { return c?.kind === 'merge' && !!this.prDone(c); },
      get waitingCalls() { return this.openCalls.filter((c) => !this.settled(c)); },
      get settledCalls() { return this.openCalls.filter((c) => this.settled(c)); },
      get listCalls() { return [...this.waitingCalls, ...this.settledCalls]; },
      syncCount() { if (window.__shell) window.__shell.waitingCount = this.waitingCalls.length; },

      // ── Notes on a call ─────────────────────────────────────────────────
      // A call is a subject in the notes store by its file's address. Notes
      // about it, replies nested, and the tending findings that name it among
      // their subjects, oldest first. A note may take a stance on the
      // recommendation (agrees, disagrees, moot), which the row's line reports
      // as who weighed in and when.
      callLoc(c) { return (c?._repo || this.store) + ':' + (c?._path || 'user-calls/' + c?.id + '.json'); },
      async loadNotes() {
        try {
          if (!window.Notes) await window.gh?.load?.('kits/notes.js');
          if (!window.Findings) window.gh?.load?.('kits/findings.js');
          const gh = new window.GH({ token: window.TOKEN, repo: this.store, ref: 'main' });
          this.allNotes = await window.Notes.load(gh);
        } catch { /* no store, no notes */ }
      },
      // A finding is drawn once, as the findings kit folds its thread: its
      // current title and status, dated by its last move. Its updates are
      // replies carrying `finding`, so they never draw as notes of their own.
      notesOf(c) {
        const N = window.Notes;
        if (!c || !N || !this.allNotes.length) return [];
        const loc = this.callLoc(c);
        const F = window.Findings;
        const found = F ? F.fold(this.allNotes).filter((f) => f.about !== loc && f.subjects.includes(loc))
            .map((f) => ({ id: f.id, at: f.lastAt, author: f.author, text: f.title, finding: { status: f.status }, replies: [] }))
          : this.allNotes.filter((n) => n.finding && !n.about.startsWith('note:') && n.about !== loc && (n.finding.subjects || []).includes(loc))
            .map((n) => ({ ...n, replies: [] }));
        const plain = (ns) => ns.filter((n) => !n.finding).map((n) => ({ ...n, replies: plain(n.replies || []) }));
        return [...found, ...plain(N.thread(this.allNotes, loc))].sort((a, b) => a.at.localeCompare(b.at));
      },
      noteRows(c) {
        const out = [], walk = (ns, d) => ns.forEach((n) => { out.push({ n, d }); walk(n.replies || [], d + 1); });
        walk(this.notesOf(c), 0);
        return out;
      },
      // The owner's notes read "You": the store's owner is the owner, and the
      // login is asked of GitHub only when a note is written, as the other
      // views do (a /user read on load costs a request, and in a tokenless
      // render its 401 raises the shell's token gate over the whole app).
      whoOf(a) {
        const s = String(a || '');
        if (s && (s === this.me || s === this.store.split('/')[0])) return 'You';
        const m = s.match(/^(claude|gemini|codex|grok)\b/i);
        return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : s;
      },
      STANCE: { agrees: ['Agrees', 'agrees', 'bg-success/30 text-success-content'],
                disagrees: ['Disagrees', 'disagrees', 'bg-error/20 text-error'],
                moot: ['Moot', 'calls it moot', 'bg-base-200 text-base-content/70'] },
      stanceLabel(s) { return this.STANCE[s]?.[0] || ''; },
      stanceTone(s) { return this.STANCE[s]?.[2] || ''; },
      // The latest stance of each author who took one, newest first.
      stancesOf(c) {
        const last = new Map();
        for (const { n } of this.noteRows(c)) if (n.stance && (!last.has(n.author) || last.get(n.author).at < n.at)) last.set(n.author, n);
        return [...last.values()].sort((a, b) => b.at.localeCompare(a.at));
      },
      async saveNote(c, text) {
        const t = String(text || '').trim();
        if (!t || this.noting[c.id]) return;
        this.noting[c.id] = true; this.sendErr[c.id] = '';
        try {
          if (!window.Notes) await window.gh?.load?.('kits/notes.js');
          const gh = new window.GH({ token: window.TOKEN, repo: this.store, ref: 'main' });
          const author = this.me || (this.me = await window.Notes.author(gh));
          this.allNotes = await window.Notes.append(gh, window.Notes.make({ about: this.callLoc(c), text: t, author }));
          this.notes[c.id] = ''; this.noteOpen[c.id] = false;
        } catch (e) { this.sendErr[c.id] = 'Note not saved: ' + (e?.message || e); }
        this.noting[c.id] = false;
      },

      // ── A Gemini check of a call ────────────────────────────────────────
      // The laptop daemon's `call-check` errand (web-tools-private
      // sessions/tools/errand_runner.py): this view gathers what GitHub shows
      // now about the call, files the errand, and looks for its result every
      // half minute. Gemini's verdict lands as its note on the call, with a
      // stance, so it reaches the card and the row's line like any other note.
      geminiMark() { return window.assistantMark?.svg?.('gemini', { cls: 'w-4 h-4 shrink-0' }) || '<i class="ph ph-sparkle text-lg"></i>'; },
      geminiBusy(c) { const st = this.checks[c?.id]?.stage; return st === 'gathering' || st === 'sent' || st === 'thinking'; },
      geminiTip(c) {
        const k = this.checks[c?.id];
        if (!k) return 'Gemini, on the laptop, reads this call and what GitHub shows now, then leaves a note: agrees, disagrees or moot. A few minutes, while the laptop is awake.';
        if (k.stage === 'gathering') return 'Reading GitHub for the evidence.';
        if (k.stage === 'sent') return 'Filed ' + this.ago(k.at) + '. The laptop picks it up within a few minutes while it is awake.';
        if (k.stage === 'thinking') return 'Gemini is reading it.';
        if (k.stage === 'failed') return 'The last check did not finish: ' + k.message;
        return 'Checked ' + this.ago(k.at) + ': ' + k.message + ' Ask again to check anew.';
      },
      async askGemini(c) {
        if (!c || this.geminiBusy(c)) return;
        this.checks[c.id] = { stage: 'gathering', at: new Date().toISOString() };
        try {
          if (!window.Errands) await window.gh?.load?.('kits/errands.js');
          const g = new window.GH({ token: window.TOKEN, repo: this.store, ref: 'main' });
          if (typeof g.save !== 'function' && window.gh?.load) await window.gh.load('gh-store.js');
          const req = window.Errands.callCheckRequest({ call: c.id, evidence: await this.evidenceOf(c), title: c.name || c.question, registry: this.store });
          await g.save(window.Errands.DIR.req + '/' + req.id + '.json', req, 'Ask Gemini to check user call ' + c.id + ' via Web Tools');
          this.checks[c.id] = { id: req.id, stage: 'sent', at: req.createdAt };
          this.pollCheck(c, g, 0);
        } catch (e) { this.checks[c.id] = { stage: 'failed', at: new Date().toISOString(), message: String(e?.message || e) }; }
      },
      async pollCheck(c, g, n) {
        const k = this.checks[c.id];
        if (!k?.id || !this.$el.isConnected || n > 40) return;
        await new Promise((r) => setTimeout(r, this.POLL_MS));
        const read = (dir) => g.get(dir + '/' + k.id + '.json', window.GH.FRESH).then((f) => JSON.parse(f.text), () => null);
        const res = await read(window.Errands.DIR.res);
        if (res) {
          this.checks[c.id] = { ...k, stage: res.ok ? 'done' : 'failed', at: res.closedAt || k.at, message: res.message || '' };
          if (res.ok) this.loadNotes();
          return;
        }
        if (k.stage === 'sent' && await read('errands/claims')) this.checks[c.id] = { ...k, stage: 'thinking' };
        this.pollCheck(c, g, n + 1);
      },
      // What GitHub shows now about the call, as plain text for Gemini: the
      // call's PR and what moved on it since filing, the other PRs and files it
      // names, and its dependencies. Read fresh; bounded so the errand stays small.
      async evidenceOf(c) {
        const H = await this.helpers().catch(() => null), opt = window.GH.FRESH;
        const gh = (slug) => new window.GH({ token: window.TOKEN, repo: slug });
        const t0 = Date.parse(c.created) || 0, after = (d) => (Date.parse(d || '') || 0) > t0;
        const one = (s, n = 300) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
        const out = ['Filed ' + (c.created || 'at an unknown time') + '; checked ' + new Date().toISOString() + '.'];
        const p = c.pr && H?.prOf(c.pr);
        if (p) {
          const g = gh(p.slug);
          const [pr, commits, comments, reviews] = await Promise.all([
            g.req('pulls/' + p.n, opt).catch(() => null),
            g.req('pulls/' + p.n + '/commits?per_page=100', opt).catch(() => []),
            g.req('issues/' + p.n + '/comments?per_page=100&since=' + encodeURIComponent(c.created || ''), opt).catch(() => []),
            g.req('pulls/' + p.n + '/reviews?per_page=100', opt).catch(() => []),
          ]);
          const f = this.facts[c.id] || {};
          if (pr) out.push('Its PR, ' + c.pr + (pr.title ? ', "' + one(pr.title, 120) + '"' : '') + ': ' + (pr.merged_at ? 'merged ' + pr.merged_at
            : pr.state === 'closed' ? 'closed unmerged ' + pr.closed_at : (pr.draft ? 'open, a draft' : 'open'))
            + '; mergeable_state ' + (pr.mergeable_state || 'unknown') + (f.ci ? '; CI ' + f.ci : '') + '.');
          const cs = (commits || []).filter((x) => after(x.commit?.committer?.date));
          out.push('Commits since filing:' + (cs.length ? '' : ' none.'), ...cs.slice(-15).map((x) => '- ' + String(x.sha || '').slice(0, 7) + ' ' + one(x.commit?.message, 120)));
          const ms = (comments || []).filter((x) => after(x.created_at));
          out.push('Comments since filing:' + (ms.length ? '' : ' none.'), ...ms.slice(-10).map((x) => '- ' + (x.user?.login || '?') + ', ' + x.created_at + ': ' + one(x.body)));
          const rs = (reviews || []).filter((x) => after(x.submitted_at));
          out.push('Reviews since filing:' + (rs.length ? '' : ' none.'), ...rs.slice(-10).map((x) => '- ' + (x.user?.login || '?') + ' ' + x.state + ': ' + one(x.body, 200)));
        }
        const mats = c.materials || [];
        const prs = [...new Set(mats.filter((l) => l.kind === 'pr' && l.ref !== c.pr).map((l) => l.ref))].slice(0, 20);
        if (prs.length && H) {
          out.push('Other PRs it names:');
          for (const ref of prs) {
            const q = H.prOf(ref), x = q ? await gh(q.slug).req('pulls/' + q.n, opt).catch(() => null) : null;
            out.push('- ' + ref + (x ? (x.title ? ' "' + one(x.title, 100) + '"' : '') + ': ' + (x.merged_at ? 'merged ' + x.merged_at : x.state === 'closed' ? 'closed unmerged ' + x.closed_at : 'open') : ': could not be read'));
          }
        }
        const files = mats.filter((l) => l.kind === 'file' || l.kind === 'task').map((l) => /^([^/@:]+\/[^@:]+)(?:@([^:]+))?:(.+)$/.exec(l.ref || '')).filter(Boolean).slice(0, 20);
        if (files.length) {
          out.push('Files it names:');
          for (const [, slug, ref = 'main', path] of files) {
            const hits = await gh(slug).req('commits?sha=' + encodeURIComponent(ref) + '&path=' + encodeURIComponent(path)
              + '&since=' + encodeURIComponent(c.created || '') + '&per_page=5', opt).catch(() => null);
            out.push('- ' + slug + ':' + path + ': ' + (!hits ? 'could not be read' : hits.length
              ? 'changed since filing (' + (hits.length === 1 ? '1 commit' : hits.length + (hits.length === 5 ? '+' : '') + ' commits')
                + (hits[0].commit?.message ? '; latest "' + one(hits[0].commit.message, 100) + '"' : '') + ')' : 'unchanged since filing'));
          }
        }
        const deps = this.depsOf(c);
        if (deps.length) out.push('Its dependencies:', ...deps.map((d) => '- ' + d.label + ': ' + d.state));
        const own = this.noteRows(c).filter((x) => !x.n.finding);
        if (own.length) out.push('Notes on it so far:', ...own.map((x) => '- ' + this.whoOf(x.n.author) + (x.n.stance ? ' (' + x.n.stance + ')' : '') + ': ' + one(x.n.text, 200)));
        return out.join('\n').slice(0, 20000);
      },

      // ── What sort of call it is ─────────────────────────────────────────
      // Five fields the filing session may write (user-call.py states them):
      // name, size, confidence, reversible, depends_on. Each dependency is
      // checked here: a PR is met once merged, a task once its status is
      // done, another call once answered or settled. A call is EASY when it
      // is firm, reversible, XS or S, and waits on nothing; derived, never
      // filed, so it cannot disagree with the fields it reads.
      SIZES: { XS: 'folds into another pass', S: 'one session with room to spare', M: 'one full session',
               L: 'several sessions', XL: 'a project', '?': 'not sizable until it is designed' },
      depKind(ref) {
        // A task is a path, owner/repo[@ref]:path; a call's id holds no colon.
        return /^[^/\s]+\/[^#\s]+#\d+$/.test(ref) ? 'pr' : ref.includes(':') ? 'task' : 'call';
      },
      depLabel(ref) {
        const k = this.depKind(ref);
        if (k === 'pr') { const [slug, n] = ref.split('#'); return slug.split('/').pop() + ' #' + n; }
        if (k === 'call') { const o = this.calls.find((x) => x.id === ref); return o?.name || 'call ' + ref.replace(/^[0-9a-f]{8}-/, ''); }
        return 'task ' + ref.split('/').pop().replace(/\.md$/, '');
      },
      async loadDeps(c) {
        for (const ref of c?.depends_on || []) {
          if (this.depKind(ref) === 'call' || this.deps[ref]) continue;
          this.deps[ref] = { met: null, state: 'reading' };
          this.deps[ref] = await this.readDep(ref);
        }
      },
      async readDep(ref) {
        try {
          if (this.depKind(ref) === 'pr') {
            const [slug, n] = ref.split('#');
            const pr = await new window.GH({ token: window.TOKEN, repo: slug }).req('pulls/' + n);
            return { met: !!pr.merged_at, state: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed unmerged' : 'open' };
          }
          const m = ref.match(/^([^/@:\s]+\/[^@:\s]+)(?:@([^:\s]+))?:(\S+)$/);
          if (m) {
            const text = (await new window.GH({ token: window.TOKEN, repo: m[1], ref: m[2] || 'main' }).get(m[3])).text;
            const st = (String(text).match(/^status:\s*(\S+)/m) || [])[1] || '';
            return { met: st === 'done', state: st || 'no status' };
          }
        } catch { /* unread below */ }
        return { met: null, state: 'could not be read' };
      },
      // Each dependency with its state; another call's is read off the list
      // live, since answering it here changes it.
      depsOf(c) {
        return (c?.depends_on || []).map((ref) => {
          if (this.depKind(ref) !== 'call') return { ref, label: this.depLabel(ref), ...(this.deps[ref] || { met: null, state: 'not read' }) };
          const o = this.calls.find((x) => x.id === ref);
          const st = !o ? 'not found' : !o.open ? 'answered' : this.settled(o) ? 'settled on GitHub' : 'open';
          return { ref, label: this.depLabel(ref), met: o ? !o.open || this.settled(o) : null, state: st };
        });
      },
      unmet(c) { return this.depsOf(c).filter((d) => d.met !== true); },
      depsTip(c) { return this.depsOf(c).map((d) => d.label + ': ' + d.state).join('; ') + '.'; },
      easy(c) {
        return c?.confidence === 'firm' && c.reversible === true && (c.size === 'XS' || c.size === 'S') && !this.unmet(c).length;
      },
      shapeOf(c) {
        if (!c) return [];
        const out = [], easy = this.easy(c), deps = this.depsOf(c), u = deps.filter((d) => d.met !== true);
        // This theme's success is too pale for a soft badge: a tinted fill
        // with dark ink, as user-call-form's CHANGE_KIND does.
        if (easy) out.push({ key: 'easy', icon: 'ph-lightning', label: 'Easy', tone: 'border-0 bg-success/30 text-success-content',
                             tip: 'Firm, reversible, small, and waiting on nothing.' });
        if (c.size) out.push({ key: 'size', icon: 'ph-t-shirt', label: c.size, tone: 'badge-ghost',
                               tip: 'Size ' + c.size + ', ' + (this.SIZES[c.size] || '') + ': the work the recommended answer sets off.' });
        if (!easy && c.confidence === 'firm') out.push({ key: 'conf', icon: 'ph-seal-check', label: 'Firm', tone: 'badge-ghost',
          tip: 'The filing session would act on its recommendation unasked if it could.' });
        if (c.confidence === 'lean') out.push({ key: 'conf', icon: 'ph-scales', label: 'Lean', tone: 'badge-warning badge-soft',
          tip: 'Another option has a real case' + (c.why ? ': ' + c.why : '.') });
        if (c.reversible === false) out.push({ key: 'oneway', icon: 'ph-lock-simple', label: 'One-way', tone: 'badge-warning badge-soft',
          tip: 'The answer cannot be cheaply undone.' });
        if (deps.length) out.push(u.length
          ? { key: 'deps', icon: 'ph-hourglass-medium', label: u.length === 1 ? 'Waits on ' + u[0].label : 'Waits on ' + u.length,
              tone: 'badge-warning badge-soft', tip: this.depsTip(c) }
          : { key: 'deps', icon: 'ph-check', label: deps.length === 1 ? deps[0].label + ' met' : 'All ' + deps.length + ' met',
              tone: 'badge-ghost', tip: this.depsTip(c) });
        return out;
      },
      get answeredCalls() { return this.calls.filter((c) => !c.open).slice(0, 8); },
      get files() {
        return [...(this.pending?.values() || [])].filter((f) => f.staged)
          .map((f) => { const i = f.file.indexOf(':'); return { ...f, repo: f.file.slice(0, i), path: f.file.slice(i + 1) }; });
      },
      // One kind's files: each file's proposals of that kind, and the files
      // that have any.
      filesOf(k) {
        return this.files.map((f) => { const items = f.items.filter((it) => it.kind === k); return { ...f, items, staged: items.length }; })
          .filter((f) => f.staged);
      },
      // By repository, the repository with most waiting first, and within it
      // the file with most.
      groupsOf(k) {
        const by = new Map();
        for (const f of this.filesOf(k)) {
          if (!by.has(f.repo)) by.set(f.repo, { repo: f.repo, staged: 0, files: [] });
          const g = by.get(f.repo); g.staged += f.staged; g.files.push(f);
        }
        for (const g of by.values()) g.files.sort((a, b) => b.staged - a.staged || a.path.localeCompare(b.path));
        return [...by.values()].sort((a, b) => b.staged - a.staged || a.repo.localeCompare(b.repo));
      },
      count(k) { return this.filesOf(k).reduce((t, f) => t + f.staged, 0); },
      // The tab row: a count once its queue has been read, a spinner before.
      get tabs() {
        const read = !!this.pending;
        return [
          { key: 'calls', label: 'Calls', n: this.loadingCalls && !this.calls.length ? null : this.waitingCalls.length, warn: true },
          { key: 'edit', label: 'Edits', n: read ? this.count('edit') : null, loading: this.loadingPending },
          { key: 'tighten', label: 'Tighten', n: read ? this.count('tighten') : null, loading: this.loadingPending },
        ];
      },
      get summary() {
        const n = this.waitingCalls.length, parts = [n + (n === 1 ? ' call' : ' calls')];
        if (this.pending) parts.push(this.count('edit') + ' edits', this.count('tighten') + ' tightenings');
        return parts.join(' · ');
      },
      get emptyLine() {
        if (this.tab === 'calls') return this.loadingCalls ? 'Reading user calls' : 'No user call is open.';
        if (this.loadingPending) return 'Reading the Text collection';
        return this.tab === 'edit' ? 'No edit is proposed.' : 'No tightening is proposed.';
      },

      // The head row's action: a documentation call and a file open in
      // Dictate, which is where they are answered; any other call is
      // answered here, so its call page is only a way out, to the materials
      // rendered.
      actionHref(r) { return !r ? '#' : r.kind === 'call' ? this.href(r.c) : this.dictate(r.f, r.k); },
      // The session that filed a call, in Claude Code, when the index has it.
      agentHref(r) {
        const id = r && r.kind === 'call' ? this.agents[r.c.session] : '';
        return id ? 'https://claude.ai/code/' + id : '';
      },
      // The store's short-id index: each row leads with the short id, and its
      // fourth field is the claude.ai session id (repo-sessions-cache.js,
      // buildMenuIndex). Read once; a call it does not name gets no mark.
      async loadAgents() {
        try {
          const g = new window.GH({ token: window.TOKEN, repo: this.store, ref: 'main' });
          const m = JSON.parse((await g.get('state/session-menu.json')).text);
          const out = {}, asks = {};
          for (const row of [...(m.recent || []), ...Object.values(m.branches || {})]) {
            if (Array.isArray(row) && row[0] && /^session_/.test(row[3] || '') && !out[row[0]]) { out[row[0]] = row[3]; asks[row[0]] = row[2] || ''; }
          }
          this.agents = out; this.asks = asks;
        } catch { /* no index, no marks */ }
      },

      // ── Answering in place ──────────────────────────────────────────────
      // The call page's helpers (prFacts, postAnswer, linkOf), loaded once.
      async helpers() {
        if (!window.UserCallForm) await window.gh?.load?.('alpineComponents/user-call-form.js');
        if (window.UserCallForm && !this.ucf) this.ucf = window.UserCallForm;
        return window.UserCallForm;
      },
      // THE HEADER'S FACTS ARE READ, NOT CLAIMED. For a call naming a PR:
      // its state, CI as the check runs on its head commit report it, and
      // GitHub's own mergeable_state, read from the API; the refresh reads
      // them again past the client's one-minute cache. What the session wrote
      // when it filed the call (what ships, what is loose) is its claim at
      // filing and is not re-verified: the moved count is what says it may
      // be stale.
      async readFacts(c, fresh = false) {
        const H = await this.helpers().catch(() => null), p = H?.prOf(c?.pr);
        if (!p) return;
        const opt = fresh ? window.GH.FRESH : {}, g = new window.GH({ token: window.TOKEN, repo: p.slug });
        try {
          const pr = await g.req('pulls/' + p.n, opt);
          let ci = '';
          try {
            const runs = (await g.req('commits/' + pr.head.sha + '/check-runs', opt))?.check_runs || [];
            const bad = runs.filter((r) => ['failure', 'timed_out', 'cancelled'].includes(r.conclusion)).length;
            const going = runs.filter((r) => r.status !== 'completed').length;
            ci = !runs.length ? 'no checks' : bad ? bad + ' failing' : going ? 'running' : 'passing';
          } catch { ci = ''; }
          this.facts[c.id] = { state: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open',
                               ci, mergeable: pr.mergeable_state || '', files: pr.changed_files, add: pr.additions, del: pr.deletions,
                               repo: p.slug, branch: pr.head?.ref || '', branchRepo: pr.head?.repo?.full_name || p.slug,
                               at: new Date().toISOString() };
        } catch { this.facts[c.id] = { state: '', at: new Date().toISOString() }; }
        this.syncCount();
      },
      loadFacts(c) { if (c?.pr && !this.facts[c.id]) return this.readFacts(c); },
      // The PR's branch, opened in Activity's branch takeover: its guide,
      // verdict, files and the views it changes, where a merge is looked over.
      // Known once the PR is read; a fork's branch is outside the estate, so
      // only a branch of the PR's own repo gets the button.
      branchOf(c) {
        const f = this.facts[c?.id];
        return f?.branch && f.branchRepo === f.repo ? { repo: f.repo, name: f.branch } : null;
      },
      // From the deck, close it first and go once its history entry is
      // unwound, or the Back it pops would land after the new address.
      openBranch(c) {
        const b = this.branchOf(c);
        if (!b) return;
        if (this._deck) { this._afterDeck = () => this.openBranch(c); this._deck.close(); return; }
        const S = window.__shell;
        if (S?.openBranchSpec) S.openBranchSpec(b.repo, b.name);
        else location.href = '?view=branches&detail=' + encodeURIComponent(b.repo + '@' + b.name);
      },
      // The answers a call offers in the footer: Merge for a merge call (a
      // message instead rides the note button), every option for a decision,
      // the recommended one first. Each takes two taps, the second on Confirm.
      answersOf(c) {
        if (!c?.open || c.kind === 'documentation') return [];
        if (c.kind === 'merge') return this.prDone(c) ? [] : ['Merge'];
        const os = this.optsOf(c), rec = c.recommend;
        return os.includes(rec) ? [rec, ...os.filter((o) => o !== rec)] : os;
      },
      armKey(c, o) { return c.id + '\n' + o; },
      isArmed(c, o) { return this.armed === this.armKey(c, o); },
      tapAnswer(c, o) {
        if (this.sending[c.id]) return;
        const k = this.armKey(c, o);
        if (this.armed !== k) {
          this.armed = k; clearTimeout(this._armT);
          this._armT = setTimeout(() => { if (this.armed === k) this.armed = ''; }, 4000);
          return;
        }
        this.armed = ''; clearTimeout(this._armT);
        this.answer(c, o, this.notes[c.id] || '');
      },
      answerClass(c, o) {
        if (this.isArmed(c, o)) return 'btn-success';
        return o === 'Merge' || o === c.recommend ? 'btn-primary' : 'btn-ghost border-base-300';
      },
      answerIcon(c, o) {
        if (this.isArmed(c, o)) return 'ph-check-circle';
        // The recommended answer's mark is a thumbs-up, not a four-point star,
        // which is Gemini's mark on the check button beside it in the header.
        return o === 'Merge' ? 'ph-git-merge' : o === c.recommend ? 'ph-thumbs-up' : '';
      },
      // One answer line beside the call, commented on its PR first when it
      // names one, in the call page's words. The call leaves the open list.
      async answer(c, opt, note = '') {
        if (!opt || this.sending[c.id]) return;
        this.sending[c.id] = opt; this.sendErr[c.id] = '';
        try {
          if (!window.TOKEN) throw new Error('no GitHub token in this browser');
          const H = await this.helpers();
          if (!H) throw new Error('the call page\'s helpers did not load');
          note = String(note || '').trim();
          const entry = { answer: opt, note, at: new Date().toISOString() };
          const body = '**User call: ' + c.question + '**\n\nAnswer: **' + opt + '**'
            + (note ? '\n\n> ' + note : '') + '\n\n_' + (c.id || '') + ', sent from the Waiting view._';
          const pr = H.prOf(c.pr);
          await H.postAnswer({ repo: c._repo, ref: c._ref || 'main', path: c._path.replace(/\.json$/, '.answers.jsonl'),
                               entry, pr, comment: pr ? body : '' });
          c.answers = [...(c.answers || []), entry];
          c.open = false;
          this.noteOpen[c.id] = false; this.notes[c.id] = '';
          this.syncCount();
        } catch (e) { this.sendErr[c.id] = 'Not sent: ' + (e?.message || e); }
        this.sending[c.id] = false;
      },
      // WHAT MOVED SINCE THE CALL WAS FILED, read from GitHub rather than asked
      // of anyone, and kept as counts the header draws: on the call's own PR,
      // commits, comments and reviews dated after the call; of the other PRs
      // it names, those closed or merged after it, by their own timestamps,
      // and how many stand open; of the files it names, how many were
      // committed to since. A PR already merged when the call was filed is not
      // news and is not counted. The refresh reads it again, past the cache.
      async loadSince(c, fresh = false) {
        if (!c || c.kind === 'documentation' || (!fresh && this.since[c.id])) return;
        this.since[c.id] = { ...(this.since[c.id] || {}), busy: true };
        const opt = fresh ? window.GH.FRESH : {};
        const t0 = Date.parse(c.created) || 0, after = (d) => (Date.parse(d || '') || 0) > t0;
        const out = { commits: 0, comments: 0, reviews: 0, shut: 0, open: 0, known: 0, files: 0, changed: 0, err: '' };
        try {
          const H = await this.helpers();
          const gh = (slug) => new window.GH({ token: window.TOKEN, repo: slug });
          if (c.pr && H?.prOf(c.pr)) {
            const p = H.prOf(c.pr), g = gh(p.slug);
            const [commits, comments, reviews] = await Promise.all([
              g.req('pulls/' + p.n + '/commits?per_page=100', opt).catch(() => []),
              g.req('issues/' + p.n + '/comments?per_page=100&since=' + encodeURIComponent(c.created || ''), opt).catch(() => []),
              g.req('pulls/' + p.n + '/reviews?per_page=100', opt).catch(() => []),
            ]);
            out.commits = (commits || []).filter((x) => after(x.commit?.committer?.date)).length;
            out.comments = (comments || []).filter((x) => after(x.created_at)).length;
            out.reviews = (reviews || []).filter((x) => after(x.submitted_at)).length;
          }
          const mats = c.materials || [];
          const prs = [...new Set(mats.filter((l) => l.kind === 'pr' && l.ref !== c.pr).map((l) => l.ref))];
          if (prs.length && H) {
            const got = (await Promise.all(prs.map(async (ref) => {
              const p = H.prOf(ref);
              return p ? gh(p.slug).req('pulls/' + p.n, opt).catch(() => null) : null;
            }))).filter(Boolean);
            out.known = got.length;
            out.open = got.filter((x) => x.state === 'open').length;
            out.shut = got.filter((x) => x.state !== 'open' && after(x.merged_at || x.closed_at)).length;
          }
          const files = mats.filter((l) => l.kind === 'file').map((l) => /^([^/@]+\/[^@:]+)@([^:]+):(.+)$/.exec(l.ref || '')).filter(Boolean);
          if (files.length) {
            const hit = await Promise.all(files.map(([, slug, ref, path]) =>
              gh(slug).req('commits?sha=' + encodeURIComponent(ref) + '&path=' + encodeURIComponent(path)
                + '&since=' + encodeURIComponent(c.created || '') + '&per_page=1', opt).then((x) => (x || []).length > 0, () => false)));
            out.files = files.length;
            out.changed = hit.filter(Boolean).length;
          }
        } catch (e) { out.err = String(e?.message || e); }
        this.since[c.id] = { ...out, busy: false, at: new Date().toISOString() };
      },
      movedCount(c) { const s = this.since[c?.id]; return s ? s.commits + s.comments + s.reviews + s.shut + s.changed : 0; },
      // The same counts as a sentence, for the moved badge's tip.
      sinceLine(c) {
        const s = this.since[c.id];
        if (!s || !s.at) return 'Checking what changed since it was filed';
        if (s.err) return 'Could not check what changed: ' + s.err;
        const n = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
        const of = (k, verb1, verbN) => (k === s.known ? (s.known === 1 ? 'its PR ' + verb1 : 'its ' + s.known + ' PRs ' + verbN)
                                                       : k + ' of its ' + s.known + ' PRs ' + (k === 1 ? verb1 : verbN));
        const parts = [];
        const moved = [s.commits && n(s.commits, 'commit'), s.comments && n(s.comments, 'comment'), s.reviews && n(s.reviews, 'review')].filter(Boolean);
        if (moved.length) parts.push(moved.join(', ') + ' on ' + this.prLabel(c));
        if (s.shut) parts.push(of(s.shut, 'was closed or merged', 'were closed or merged'));
        if (s.changed) parts.push(s.changed + ' of ' + n(s.files, 'file') + ' changed');
        const standing = s.open ? of(s.open, 'is still open', 'are still open') : '';
        const age = this.ago(c.created), cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
        return parts.length ? 'Since it was filed ' + age + ': ' + parts.join('; ') + '.' + (standing ? ' ' + cap(standing) + '.' : '')
                            : 'Nothing has moved since it was filed ' + age + (standing ? '; ' + standing : '') + '.';
      },
      // WHAT THE REFRESH CHECKS, said for this call: for its PR, the state,
      // CI and conflicts, and what is new on it since filing; for the PRs and
      // files it names, which are open and which changed since filing.
      named(c) {
        const mats = c?.materials || [];
        return { prs: mats.filter((l) => l.kind === 'pr' && l.ref !== c.pr).length, files: mats.filter((l) => l.kind === 'file').length };
      },
      checkable(c) { const n = this.named(c); return !!c?.pr || n.prs > 0 || n.files > 0; },
      checkedTip(c) {
        const n = this.named(c), what = [];
        if (c.pr) what.push('PR state, CI, conflicts, and new commits, comments or reviews since filing');
        if (n.prs) what.push(n.prs === 1 ? 'whether its PR is open' : 'which of its ' + n.prs + ' PRs are open');
        if (n.files) what.push(n.files === 1 ? 'whether its file changed since filing' : 'which of its ' + n.files + ' files changed since filing');
        const at = this.since[c.id]?.at || this.facts[c.id]?.at, list = what.join('; ');
        return list.charAt(0).toUpperCase() + list.slice(1) + '.' + (at ? ' Checked ' + this.ago(at) + '.' : '');
      },
      refreshCall(c) { return Promise.all([c.pr ? this.readFacts(c, true) : null, this.loadSince(c, true)]); },
      // Which rows carry a status in the header: a call answered here.
      hasStatus(r) { return !!r && r.kind === 'call' && r.c.kind !== 'documentation'; },
      prNum(c) { return (/#(\d+)$/.exec(String(c?.pr || '')) || [])[1] || ''; },
      prTip(c) { const l = this.factsLine(c); return this.prLabel(c) + (l ? ': ' + l : ''); },
      ciIcon(c) {
        const ci = this.facts[c?.id]?.ci || '';
        return !ci ? '' : ci === 'passing' ? 'ph-check-circle' : ci === 'running' ? 'ph-circle-notch' : ci === 'no checks' ? 'ph-minus-circle' : 'ph-x-circle';
      },
      ciTone(c) {
        const ci = this.facts[c?.id]?.ci || '';
        return ci === 'passing' ? 'text-success' : ci === 'running' ? 'text-warning animate-spin' : ci === 'no checks' ? 'text-base-content/40' : 'text-error';
      },
      ciTip(c) {
        const ci = this.facts[c?.id]?.ci || '';
        if (ci === 'no checks') return 'No CI checks ran on the PR\'s latest commit.';
        if (/failing/.test(ci)) return 'CI ' + ci + ' on the PR\'s latest commit. Merge has the session fix it first.';
        return 'CI ' + ci + ' on the PR\'s latest commit.';
      },
      // GitHub's mergeable_state, said plainly, with what Merge does about it:
      // nothing here asks the owner to act, since answering Merge sends the
      // session to bring the branch up to date and fix what blocks it first.
      MERGEABLE: {
        clean: ['ph-git-merge', 'text-success', 'Merges cleanly.'],
        dirty: ['ph-warning-circle', 'text-error', 'Conflicts with main. Merge has the session resolve them first.'],
        blocked: ['ph-lock-simple', 'text-warning', 'Blocked by a required review or check.'],
        unstable: ['ph-git-merge', 'text-warning', 'Mergeable, but a check is failing. Merge has the session fix it first.'],
        behind: ['ph-git-merge', 'text-base-content/60', 'Behind main, and mergeable.'],
        draft: ['ph-pencil-simple-line', 'text-warning', 'A draft. Merge has the session mark it ready.'],
        has_hooks: ['ph-git-merge', 'text-success', 'Mergeable.'],
        unknown: ['ph-circle-dashed', 'text-base-content/40', 'GitHub has not worked out yet whether it merges cleanly.'],
      },
      prDone(c) {
        const st = this.facts[c?.id]?.state;
        return st === 'merged' ? 'Already merged on GitHub.' : st === 'closed' ? 'Closed on GitHub without merging.' : '';
      },
      mergeIcon(c) { const f = this.facts[c?.id]; return f && f.state === 'open' || f?.state === 'draft' ? (this.MERGEABLE[f.mergeable] || [''])[0] : ''; },
      mergeTone(c) { return (this.MERGEABLE[this.facts[c?.id]?.mergeable] || [, ''])[1]; },
      mergeTip(c) { return (this.MERGEABLE[this.facts[c?.id]?.mergeable] || [, , ''])[2]; },
      // The other PRs a call names, as a count that stands open, shown once
      // any is open or any closed since filing; an already-closed reference
      // is not a status.
      prsLine(c) { const s = this.since[c?.id]; return s && s.known && (s.open || s.shut) ? (s.open === s.known ? s.known + ' open' : s.open + '/' + s.known + ' open') : ''; },
      prsTip(c) {
        const s = this.since[c?.id];
        return !s ? '' : 'Of the PRs this call names, ' + s.open + ' of ' + s.known + ' open' + (s.shut ? '; ' + s.shut + ' closed or merged since it was filed' : '');
      },
      optsOf(c) { return (c?.options || []).map((o) => typeof o === 'string' ? o : o?.label).filter(Boolean); },
      // The materials as the call page links them, once its helpers are
      // here (until then a plain address), less what the card already shows:
      // the call's own PR, drawn as a chip on a merge, and a shipped line's
      // proof, drawn beside its line.
      matsOf(c) {
        const shown = (c?.shipped || []).map((x) => x && typeof x === 'object' ? x.proof : null).filter(Boolean);
        return (c?.materials || [])
          .filter((l) => !(c.kind === 'merge' && l.kind === 'pr' && l.ref === c.pr))
          .filter((l) => !shown.some((p) => p.kind === l.kind && p.ref === l.ref))
          .map((l) => this.linkOf(l));
      },
      linkOf(l) {
        if (this.ucf) return this.ucf.linkOf(l);
        return { href: l?.kind === 'pr' ? this.prUrl(l.ref) : l?.ref || '#', label: l?.label || l?.ref || '', icon: 'ph-link' };
      },
      proofOf(x) { const p = x && typeof x === 'object' ? x.proof : null; return p ? this.linkOf(p) : null; },
      shipText(x) { return typeof x === 'string' ? x : x?.text || x?.new || x?.old || ''; },
      changeOf(x) {
        return ({
          added: { icon: 'ph-plus', tone: 'bg-success/30 text-success-content', label: 'Added' },
          changed: { icon: 'ph-pencil-simple', tone: 'bg-primary/10 text-primary', label: 'Changed' },
          fixed: { icon: 'ph-wrench', tone: 'bg-warning/40 text-warning-content', label: 'Fixed' },
          removed: { icon: 'ph-minus', tone: 'bg-error/20 text-error', label: 'Removed' },
          recorded: { icon: 'ph-bookmark-simple', tone: 'bg-secondary/10 text-secondary', label: 'Recorded' },
        })[x?.kind] || { icon: 'ph-check', tone: 'bg-success/30 text-success-content', label: 'Shipped' };
      },
      prLabel(c) { const m = /^[\w.-]+\/([\w.-]+)#(\d+)$/.exec(String(c?.pr || '')); return m ? m[1] + ' #' + m[2] : String(c?.pr || ''); },
      prTone(c) {
        return ({ draft: 'border-warning/60 bg-warning/20', open: 'border-success/60 bg-success/20',
                  merged: 'border-secondary/60 bg-secondary/20', closed: 'border-error/60 bg-error/20' })[this.facts[c.id]?.state] || 'border-base-300';
      },
      // The PR in one line: its state, CI on its head, and its size.
      factsLine(c) {
        const f = this.facts[c.id];
        if (!f) return 'reading the PR';
        if (!f.state) return '';
        const size = f.files != null ? f.files + (f.files === 1 ? ' file' : ' files') + ' · +' + (f.add || 0) + ' −' + (f.del || 0) : '';
        return [f.state, f.ci ? 'CI ' + f.ci : '', f.mergeable === 'clean' ? 'merges cleanly' : '', size].filter(Boolean).join(' · ');
      },
      href(c) { return U()?.href(c) || '#'; },
      sessionHref(c) { return U()?.sessionHref(c) || ''; },
      dictate(f, k) { return U()?.dictateHref({ file: f.file, proposed: k || true }) || '#'; },
      fileOf(c) { return U()?.fileKey(c.file) || c.file || ''; },
      // owner/repo:path, said as the repo's name and the path.
      shortFile(c) { const f = this.fileOf(c), i = f.indexOf(':'); return i < 0 ? f : f.slice(0, i).split('/').pop() + '/' + f.slice(i + 1); },
      fileGh(c) { const f = this.fileOf(c), i = f.indexOf(':'); return i < 0 ? '#' : 'https://github.com/' + f.slice(0, i) + '/blob/main/' + f.slice(i + 1); },
      kindIcon(c) { return { documentation: 'ph-pencil-line', merge: 'ph-git-merge' }[c.kind] || 'ph-scales'; },
      // A call's second line: the kind, what it holds, and its age.
      // The row's second line: who filed it and what they recommend, then
      // its age. The kind is the icon's to say (owner, 2026-10-06: the kind
      // word under each row was redundant). Every call so far is filed by a
      // Claude session; a session the index does not name is said as one.
      callLine(c) {
        const n = (c.edits || []).length;
        const who = this.agents[c.session] ? 'Claude' : c.session ? 'Session ' + c.session : '';
        const rec = c.kind !== 'merge' && c.kind !== 'documentation' && c.recommend ? 'recommends ' + c.recommend : '';
        const head = [who, rec].filter(Boolean).join(' ');
        const done = this.settled(c) ? (this.facts[c.id].state === 'merged' ? 'merged on GitHub' : 'closed on GitHub') : '';
        const weighed = this.stancesOf(c).map((x) => this.whoOf(x.author) + ' ' + this.STANCE[x.stance][1] + ' ' + this.ago(x.at));
        return [head, done, c.kind === 'documentation' && n ? n + (n === 1 ? ' edit' : ' edits') : '', this.ago(c.created), ...weighed]
          .filter(Boolean).join(' · ');
      },
      // The line's tip: which session filed the call, by its first ask.
      whoTip(c) {
        if (!c?.session) return '';
        const ask = String(this.asks[c.session] || '').trim();
        return 'Filed by session ' + c.session + (ask ? ': "' + ask + '"' : '');
      },
      // A file's second line: its repository and how many of the tab's kind
      // Dictate would stage.
      fileLine(f, k) {
        const n = f.staged, noun = k === 'tighten' ? 'tightening' : 'edit';
        return f.repo.split('/').pop() + ' · ' + n + ' ' + noun + (n === 1 ? '' : 's');
      },
      prUrl(pr) {
        const m = /^([\w.-]+\/[\w.-]+)#(\d+)$/.exec(String(pr || ''));
        return m ? 'https://github.com/' + m[1] + '/pull/' + m[2] : '#';
      },
      // What proposed an edit, said short: a pull request as repo#n, a run by
      // its folder, anything else by its last path segment.
      basisLabel(b) {
        const s = String(b || '');
        const pr = /github\.com\/[\w.-]+\/([\w.-]+)\/pull\/(\d+)/.exec(s);
        if (pr) return pr[1] + '#' + pr[2];
        const run = /\/runs\/([^/]+)\//.exec(s);
        if (run) return run[1];
        return s.replace(/\/+$/, '').split('/').pop() || s;
      },
      lastOf(c) { const as = c.answers || []; return as[as.length - 1] || null; },
      lastAnswer(c) { const a = this.lastOf(c); return a ? a.answer : (c.status === 'closed' ? 'closed' : ''); },
      lastNote(c) { return this.lastOf(c)?.note || ''; },
      answerBy(c) { const a = this.lastOf(c); return a ? [a.by, this.ago(a.at)].filter(Boolean).join(' · ') : ''; },
      // A documentation answer's decision on edit i, as Dictate recorded it.
      decisionOf(c, i) { return (this.lastOf(c)?.decisions || []).find((d) => d.edit === i + 1)?.decision || ''; },
      decisionTone(d) { return { confirmed: 'badge-success', amended: 'badge-info', discarded: 'badge-error badge-outline' }[d] || 'badge-ghost'; },
      ago(at) {
        const t = Date.parse(at); if (!Number.isFinite(t)) return '';
        const m = Math.round((Date.now() - t) / 60000);
        if (m < 60) return Math.max(1, m) + 'm ago';
        const h = Math.round(m / 60); if (h < 48) return h + 'h ago';
        return Math.round(h / 24) + 'd ago';
      },
    };
  });
});
