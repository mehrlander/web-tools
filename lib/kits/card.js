// card.js — the CARD of the house popup rule: the ✕ and the ways out.
// The rule itself, and where a note ends and a card begins, is stated once, in
// daisy-alpine/references/mechanics.md ("Notes and cards"). This file
// implements the card's dismissal contract and does not restate the rule.
//
// ── What it owns, and what it deliberately does not ────────────────────────
//
// It owns THE WAY OUT, which is the half that was written five times and got
// written differently each time. It does not own position, size, content, or
// the open state: a card that follows the cursor over a chart and a card
// anchored beside a sidebar row are the same rule and different geometry, and
// a kit that owned the geometry would serve one of them and be forked for the
// other. Same split as dock-split.js, which owns the gesture and not the
// layout.
//
//   Card.closeHTML(pinned)          // the ✕, or '' where none should show
//   Card.wire(el, { onClose, except, stale, label })  -> { detach() }
//   Card.coarse()                   // no hover available on this screen
//
// It also reports every guard decision, including the refusals, to
// `window.__cardProbe` when something has set one; with nothing listening the
// cost is a property read. See "THE ONE-WAY WINDOW" beside GRACE_MS below, and
// lib/kits/probe.js for the listener it was cut for.
//
// `wire` also serves a NOTE, which is the other half of the rule and takes no
// ✕: pass `stale: 'geometry'` and it brings Escape, the press outside and the
// scroll, resize and blur guards, without the pointer guard a panel that
// cannot take the pointer would trip on immediately. See `stale` below.
//
// Named beside Note, since the two are the halves of one rule. A caller
// renders `closeHTML(pinned)` into its own panel and calls `wire` once, on the
// element:
//
//   popEl.innerHTML = Card.closeHTML(isPinned) + body;
//   const w = Card.wire(popEl, { onClose: unpin, except: ['[data-info-btn]'] });
//
// ── Why the ✕ shows when it does ───────────────────────────────────────────
//
// `closeHTML` renders the button when the card is PINNED, or on any screen
// with no hover. The second half is the one that keeps being missed, and it is
// not a nicety: a touch synthesizes the hover that opens a card and never
// sends the leave that would close it, so on a phone a hover-opened card is
// pinned in all but name and has no way out at all. Measured 2026-09-06 on
// budget-drs's Funding view, where the card had a ✕ in its pinned state and
// none in the state a phone could actually reach.
//
// Tap-outside is a courtesy, never the route. It fires here too, and it lets
// the tap through to whatever was under it, which is correct and is exactly
// why it cannot be the only way out: on a dense page every point outside the
// card is a control, so dismissing means finding somewhere safe to press and
// guessing whether it is.
//
// ── The check, which exists because the silent failure is invisible ────────
//
// A card shell that is `pointer-events: none` unless pinned renders a ✕ that
// cannot be tapped: it is drawn, it looks right, and the tap goes through it
// to the page. `wire` measures the element on a coarse pointer and reports it
// once, naming the element. Found the same day in the lineage graph's shell,
// which schema shares, one commit after the ✕ was added to both.
(() => {
  // The house grace: long enough to cross the gap between a trigger and the
  // card it raised, short enough that a card left behind is not read as stuck.
  const GRACE_MS = 220;

  // ── THE ONE-WAY WINDOW, for a probe that is watching and usually is not ────
  //
  // Every guard below decides NOT to close at least as often as it decides to,
  // and the refusals are the half nothing can see from outside. A card left on
  // screen looks identical whether its guard declined to fire, never ran, or
  // ran against an element it reads as already hidden. Those are three
  // different defects and one symptom, which is how "the cards refuse to go
  // away" survived three passes.
  //
  // So each branch says what it did, through one optional hook. This is a
  // HOOK AND NOT A LOG: nothing is written, nothing is retained, and with no
  // listener attached the whole cost is one property read per event. It cannot
  // throw into the page either, since a diagnostic that breaks its subject is
  // a second defect this estate has already shipped once.
  //
  // The tag is `<door>:<verdict>` and is stable, because a probe reads it:
  // wire:on, close:x, press:in, press:except, press:close, key:esc,
  // over:off, over:hidden, over:near, over:arm, over:close,
  // scroll:off, scroll:inside, scroll:close, gone:off, gone:close.
  // lib/kits/probe.js is the listener this was cut for; anything may be.
  const tell = (tag, el, detail) => {
    const f = window.__cardProbe;
    if (typeof f !== 'function') return;
    try { f(tag, el, detail || null); } catch (e) {}
  };

  const CSS = `
/* A ghost: no border, no fill, muted, tucked into the corner. It is a way out,
   not a control the card is about. A bordered button reads as an action the
   card offers, which is what the first draft looked like and why this is a
   rule rather than a preference. */
.wt-card-close{position:absolute;top:6px;right:6px;width:26px;height:26px;
  display:flex;align-items:center;justify-content:center;
  border:0;background:none;border-radius:6px;padding:0;
  font-size:13px;line-height:1;cursor:pointer;
  color:color-mix(in srgb,currentColor 45%,transparent)}
.wt-card-close:hover,.wt-card-close:active{
  background:var(--color-base-200,#eef1f4);color:inherit}
.wt-card-close:focus-visible{outline:2px solid var(--color-primary,#4f8ef7);
  outline-offset:1px}
`;

  function ensureCSS() {
    if (document.getElementById('wt-card-css')) return;
    const st = document.createElement('style');
    st.id = 'wt-card-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // No hover on this screen. `hover: none` rather than a width test: what
  // decides this is whether the reader can hover at all, and a narrow desktop
  // window can hover while a wide tablet cannot.
  const coarse = () => !!(window.matchMedia && window.matchMedia('(hover: none)').matches);

  // The ✕, or nothing. Pass the card's own pinned state; on a coarse pointer
  // the answer is yes either way, since a hover-opened card there is pinned in
  // all but name (see the header).
  function closeHTML(pinned) {
    if (!pinned && !coarse()) return '';
    ensureCSS();
    return '<button type="button" class="wt-card-close" data-wt-card-close '
      + 'aria-label="Close" title="Close">✕</button>';
  }

  const warned = new WeakSet();

  // WHETHER THE CARD IS ON SCREEN, asked of the DOM rather than of the caller.
  // `wire` is attached once and never told when the card opens, and the guards
  // below must not fire against a card that is already away. The rule's own
  // line about a toggle applies here too: read the actual visibility, not a
  // flag that can fall out of step with it. These are the three ways a panel in
  // this estate is hidden, which is what this can honestly claim to cover: an
  // Alpine `x-show` writes inline `display:none`, a view toggles the `hidden`
  // class, and the `hidden` attribute is the plain HTML case. A card hidden by
  // opacity or clip alone reads as shown, and would need its own answer.
  function shown(el) {
    if (el.hidden || el.classList.contains('hidden')) return false;
    if (el.style && el.style.display === 'none') return false;
    const w = el.ownerDocument && el.ownerDocument.defaultView;
    if (w && w.getComputedStyle && w.getComputedStyle(el).display === 'none') return false;
    return true;
  }

  // Every way out, wired once on the card element. Returns { detach } so a
  // view that rebuilds its card can drop the old listeners.
  //
  //   onClose   called by the ✕, by Escape, by a press outside, and by the
  //             staleness guards below
  //   except    selectors that are NOT "outside" this card: the control that
  //             toggles it owns its own toggle, and without this the press
  //             closes the card and the toggle immediately reopens it, or the
  //             reverse. The guards read the same set as "not elsewhere", since
  //             a pointer on the trigger is not a pointer that has left.
  //   stale     the guards, on by default. Pass false only for a card that
  //             genuinely must survive a scroll, which is a card anchored to
  //             nothing that moves. Pass 'geometry' for the two geometry
  //             guards WITHOUT the pointer one, which is what a panel that
  //             cannot take the pointer needs: `pointer-events: none` makes
  //             `el.contains(target)` false for every point on the panel
  //             itself, so the pointer guard would start its grace the moment
  //             the panel opened and close it 220ms later. Such a panel is a
  //             note by the house rule, and its ordinary departure is the
  //             trigger's own leave; what it cannot see without these is a
  //             scroll, a resize or a blur.
  //
  // ── THE GUARDS, and why a leave event was never enough ─────────────────────
  //
  // A leave is not a promise. The pointer can stop being over the trigger
  // without one ever firing, and each of those ways leaves a card on screen
  // anchored to something that is no longer under it:
  //
  //   a scroll slides the content out from under a card positioned `fixed`,
  //     which stays exactly where it was and is now beside the wrong row;
  //   a re-render replaces the element the leave listener was attached to;
  //   the window loses focus mid-hover and the leave never comes.
  //
  // None of those is a gesture anyone can report, which is why the symptom
  // arrives as "the cards refuse to go away" rather than as a reproduction.
  // Measured on budget-drs's submittal page, where a hover card outlived its
  // row on every scroll. So closing does not rest on the leave: it rests on two
  // facts checked against the world, the pointer being demonstrably elsewhere
  // and the geometry the card was placed against no longer holding.
  function wire(el, { onClose, except = [], stale = true, label = '' } = {}) {
    if (!el || typeof onClose !== 'function') return { detach() {} };
    // `label` is for the probe alone and never renders. A page wiring three
    // panels gets three traces, and `#tip-card` is not a name a reader of the
    // trace can place; "tip panel" is.
    const name = label || el.id || (el.className && String(el.className).split(/\s+/)[0]) || el.tagName;
    tell('wire:on', el, { name, stale, except: except.join(',') });

    // The ✕ is inside the element, which a view re-renders, so this is
    // delegated rather than bound to the button.
    const onClick = (ev) => {
      if (!ev.target.closest || !ev.target.closest('[data-wt-card-close]')) return;
      ev.stopPropagation();
      tell('close:x', el, { name });
      onClose();
    };
    el.addEventListener('click', onClick);

    // Capture phase, because a press often lands on a control whose own
    // handler stops propagation, and a bubble-phase listener never sees the
    // press that is meant to dismiss. The press is NOT swallowed: what was
    // pressed still acts, which is what makes this a courtesy rather than the
    // route out.
    const onDown = (ev) => {
      if (!ev.target.closest) return;
      if (el.contains(ev.target)) return tell('press:in', el, { name });
      for (const sel of except) if (ev.target.closest(sel)) return tell('press:except', el, { name, sel });
      tell('press:close', el, { name });
      onClose();
    };
    document.addEventListener('pointerdown', onDown, true);

    const onKey = (ev) => { if (ev.key === 'Escape') { tell('key:esc', el, { name }); onClose(); } };
    document.addEventListener('keydown', onKey);

    // THE POINTER IS DEMONSTRABLY SOMEWHERE ELSE. A pointer that has left the
    // trigger is over something, so the question can be asked positively rather
    // than waiting for a leave that may not come. The grace is the house 220ms
    // and is cancelled by the pointer arriving back on the card or on a trigger,
    // which is what lets a reader cross the gap between the two and what keeps a
    // second trigger's own hover from flickering through empty.
    let fade = null;
    // The mode is a FACT ABOUT THE PANEL and not an event, so it is reported
    // once. Saying it on every pointer move buried the two lines that matter
    // (the arm and the close) under one line per mouse twitch, which is a
    // trace that technically holds the answer and cannot be read. Measured
    // 2026-09-09 against the note card on the submittal page's Overview.
    let saidOff = false;
    const clear = () => { clearTimeout(fade); fade = null; };
    const near = (t) => el.contains(t)
      || (t.closest && except.some((sel) => t.closest(sel)));
    const onOver = (ev) => {
      if (stale !== true) {
        if (!saidOff) { saidOff = true; tell('over:off', el, { name, stale: String(stale) }); }
        return;
      }
      if (!shown(el)) return;
      if (near(ev.target)) { clear(); return tell('over:near', el, { name }); }
      if (fade === null) {
        tell('over:arm', el, { name, ms: GRACE_MS });
        fade = setTimeout(() => { fade = null; tell('over:close', el, { name }); onClose(); }, GRACE_MS);
      }
    };
    document.addEventListener('pointerover', onOver, true);

    // THE GEOMETRY NO LONGER HOLDS. A scroll is the one that bites: the card is
    // `fixed` and the content is not, so afterwards the card sits beside
    // whatever scrolled into its place, which is worse than stale. Scrolling
    // INSIDE the card is excluded, since that is a reader reaching the rest of
    // a long one. Resize and blur are the same fact arriving by other doors.
    const onScroll = (ev) => {
      if (!stale) return tell('scroll:off', el, { name });
      if (!shown(el)) return;
      if (el.contains(ev.target)) return tell('scroll:inside', el, { name });
      tell('scroll:close', el, { name });
      clear(); onClose();
    };
    document.addEventListener('scroll', onScroll, true);
    const onGone = (ev) => {
      if (!stale) return tell('gone:off', el, { name, via: ev && ev.type });
      if (!shown(el)) return;
      tell('gone:close', el, { name, via: ev && ev.type });
      clear(); onClose();
    };
    window.addEventListener('resize', onGone);
    window.addEventListener('blur', onGone);

    // A ✕ that cannot be pressed. The shell, not this kit, owns
    // `pointer-events`, so all this can do is say so: measured on the element
    // the caller passed, once, naming it.
    if (coarse() && !warned.has(el)) {
      const pe = getComputedStyle(el).pointerEvents;
      if (pe === 'none') {
        warned.add(el);
        console.warn('[card] this card is pointer-events:none on a screen with no hover, '
          + 'so its ✕ is drawn and cannot be pressed; the shell needs '
          + '`@media (hover:none){ .<shell>.show{pointer-events:auto} }` '
          + '(daisy-alpine mechanics.md, "Notes and cards")', el);
      }
    }

    return {
      detach() {
        clear();
        el.removeEventListener('click', onClick);
        document.removeEventListener('pointerdown', onDown, true);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('pointerover', onOver, true);
        document.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onGone);
        window.removeEventListener('blur', onGone);
      },
    };
  }

  window.Card = { closeHTML, wire, coarse, CSS };
})();
