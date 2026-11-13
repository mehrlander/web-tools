// read-aloud.js — markdown reduced to what is worth hearing, and a player that
// speaks it.
//
//   readAloud.speechText(md)        -> string    the reading, with the syntax gone
//   readAloud.chunks(text, max?)    -> [string]  sentence-safe pieces, one utterance each
//   readAloud.player(o?)            -> handle    play/pause/next/prev over items
//   readAloud.deckAction(o)         -> {action, onSlide, stop}   a swipe deck, spoken
//   readAloud.supported             -> boolean   whether this browser speaks at all
//   readAloud.voices()              -> [SpeechSynthesisVoice]
//
// The Claude app reads nothing aloud, and a session record is the one thing in
// this estate a reader might want in their ears rather than their eyes: it is
// long, it is prose, and it is read after the fact. The browser has spoken text
// since 2014; what it has never had is anything that knows markdown is not
// speech.
//
// ── Why speechText is the substance and the player is the wrapper ────────────
// Handed a reply verbatim, an engine says "open square bracket pages slash
// index dot h t m l close square bracket open paren h t t p s colon slash
// slash", and the session detail caption closing every reply here has one of
// those. So the reduction is the feature. It drops what carries no sound
// (fences, URLs, emoji, rules), keeps what a listener needs (a link's label, a
// table's cells, the sentence), and shortens what reads worse than it looks: a
// path in a code span becomes its basename, because "lib slash kits slash read
// aloud dot j s" is nine words for a filename.
//
// It is lossy ON PURPOSE, which is the thing to hold on to when extending it.
// The page still has the text; this is a second, worse channel chosen for being
// hands-free, and a rule that buys fidelity at the cost of being listenable is
// the wrong trade.
//
// ── Three engine behaviours the player exists to absorb ──────────────────────
// **A long utterance is cut.** Every engine has an undocumented ceiling and
// Safari's is the low one, so text is chunked at sentence boundaries and queued
// rather than handed over whole.
//
// **pause() and resume() are not dependable**, iOS Safari in particular, where
// a paused synth can refuse to resume and take the rest of the queue with it.
// So pause is cancel-and-remember: the position is state here, and resuming
// speaks the current chunk again from its start. A repeated half-sentence is a
// cost worth paying for a control that always works.
//
// **cancel() fires the callbacks of what it cancelled**, as `end` on some
// engines and as `error: interrupted` on others, and both arrive AFTER the next
// utterance has been queued. Every callback therefore carries the generation it
// was armed in, and a stale one returns; without that token a skip advances
// twice and the queue eats a turn. This is the bug in most published
// speechSynthesis wrappers, and it is why the guard is a counter rather than a
// boolean.
(() => {
  const synth = () => (typeof speechSynthesis === 'undefined' ? null : speechSynthesis);
  // Read once, at load, and shared by deckAction and the export. It was only on
  // the export, so deckAction's own guard referenced a name that did not exist
  // and threw on the first tap instead of standing down quietly.
  const supported = typeof speechSynthesis !== 'undefined'
                 && typeof SpeechSynthesisUtterance !== 'undefined';

  // ── The reduction ──────────────────────────────────────────────────────────

  // A code span holding a path reads as its basename. The test is deliberately
  // narrow: no spaces, at least one slash, and nothing but the characters a
  // path uses, so `git diff origin/main...HEAD` is not a path and keeps its
  // sentence. Anything longer than a phrase is dropped outright, since a
  // command spoken aloud was noise in every case read back.
  const PATHY = /^[\w@.+-]+(?:\/[\w@.+-]+)+\/?$/;
  // A basename that names its role rather than its subject identifies nothing
  // on its own, so it keeps the folder that does: "app index.html", not
  // "index.html". Everything else is already distinctive by the time it reaches
  // the last segment.
  const GENERIC = /^(?:index|readme|main|init|mod|__init__|package|config|skill)\.[a-z]+$/i;
  function codeSpan(s) {
    const t = String(s || '').trim();
    if (PATHY.test(t)) {
      const seg = t.replace(/\/$/, '').split('/');
      const last = seg.pop();
      return GENERIC.test(last) && seg.length ? seg.pop() + ' ' + last : last;
    }
    if (t.length > 48) return '';
    return t;
  }

  // A markdown table row becomes its cells, comma-joined; the alignment row
  // becomes nothing. Kept rather than dropped because the tables in these
  // records are small and carry the finding, and comma-joined rather than read
  // column by column because a header repeated per cell is unlistenable.
  const isRule = (line) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');
  const tableRow = (line) =>
    line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()).filter(Boolean).join(', ');

  // Pictographs go silently. The state markers this estate ends every turn with
  // are followed by their own name in bold, so the emoji is redundant where it
  // is meaningful and "large green circle" everywhere else.
  const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{20E3}️‍]/gu;

  // Control characters, and U+FFFC, which rides in from anything that carried a
  // Shortcuts token through this estate.
  const INVISIBLE = /[\u0000-\u0008\u000B-\u001F\u007F\uFFFC]/g;

  function speechText(md) {
    let s = String(md || '');

    s = s.replace(/<!--[\s\S]*?-->/g, ' ');            // HTML comments
    s = s.replace(/^```[\s\S]*?^```[^\n]*$/gm, '\n');  // fenced code, whole
    s = s.replace(/^~~~[\s\S]*?^~~~[^\n]*$/gm, '\n');
    s = s.replace(/^```[\s\S]*$/m, '\n');              // an unclosed fence at the end
    s = s.replace(/^\s*\[\/\/\]:\s*#.*$/gm, '');       // link-label region markers

    const out = [];
    for (let line of s.split('\n')) {
      if (isRule(line)) continue;
      if (/^\s*([*_-])\s*(\1\s*){2,}$/.test(line)) continue;        // horizontal rule
      if (/\|[^|]*\|/.test(line)) line = tableRow(line);
      line = line.replace(/^\s{0,3}#{1,6}\s+/, '');                 // heading marker
      line = line.replace(/^\s*>+\s?/, '');                         // blockquote
      line = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');          // list marker
      line = line.replace(/^\s*\[[^\]]*\]:\s*\S+.*$/, '');          // link definition
      out.push(line);
    }
    s = out.join('\n');

    s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');                    // images
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');                  // links keep the label
    s = s.replace(/`([^`]*)`/g, (_, c) => codeSpan(c));             // code spans
    s = s.replace(/<[^<>\s][^<>]*>/g, ' ');                         // stray tags and <url>
    s = s.replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ');             // bare URLs
    s = s.replace(/(\*\*\*|___|\*\*|__|~~|\*|_)(?=\S)([\s\S]*?\S)\1/g, '$2');  // emphasis
    s = s.replace(EMOJI, ' ');
    s = s.replace(/[·•]/g, ', ')
         .replace(/[→⇒]/g, ' to ')
         .replace(/[←]/g, ' from ');
    s = s.replace(INVISIBLE, ' ');
    s = s.replace(/\s+([,;:.])/g, '$1').replace(/([,;:])(\s*[,;:])+/g, '$1');

    // Blank lines are the only pause markdown gives us, so they survive as a
    // paragraph break and every other run of space collapses. `chunks` reads them.
    s = s.replace(/[ \t]+/g, ' ')
         .replace(/ ?\n ?/g, '\n')
         .replace(/\n{3,}/g, '\n\n');
    // A line reduced to punctuation says nothing and costs a pause.
    s = s.split('\n').filter(l => l === '' || /[\p{L}\p{N}]/u.test(l)).join('\n');
    return s.replace(/\n{3,}/g, '\n\n').trim();
  }

  // Sentence-safe pieces under `max`. Splits on the paragraph breaks speechText
  // preserved, then on sentence ends, and only then mid-sentence at a space,
  // which is the last resort and the only one that can land badly.
  //
  // SPLIT, never match. The first version matched sentences with
  // `/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g` and silently dropped every line whose full
  // stops were internal: "the fix is in read-aloud.js." offers the engine no
  // position where a run of non-stops is followed by a stop at a boundary, so
  // the match began past the last one and two thirds of the sentence never
  // reached the queue. A split cannot lose a character, which is the property
  // this needs; the boundary is a stop FOLLOWED BY SPACE, so a version number
  // or a filename stays whole.
  function chunks(text, max = 180) {
    const pieces = [];
    for (const para of String(text || '').split(/\n{2,}/)) {
      for (const line of para.split('\n')) {
        const sentences = line.split(/(?<=[.!?])\s+/);
        let buf = '';
        const flush = () => { if (buf.trim()) pieces.push(buf.trim()); buf = ''; };
        for (let sen of sentences) {
          sen = sen.trim();
          if (!sen) continue;
          // Over the ceiling with no sentence end to use: cut at the last space
          // that fits. Only a single word longer than `max` reaches the hard
          // cut, and that one does break mid-word, which is the one place this
          // does not read back word for word.
          while (sen.length > max) {
            const at = sen.lastIndexOf(' ', max);
            const cut = at > 0 ? at : max;
            pieces.push(sen.slice(0, cut).trim());
            sen = sen.slice(cut).trim();
          }
          if ((buf + ' ' + sen).trim().length > max) flush();
          buf = (buf ? buf + ' ' : '') + sen;
        }
        flush();
      }
    }
    return pieces;
  }

  // ── The player ─────────────────────────────────────────────────────────────
  //
  // Items are `{ key, label, md }` and nothing else: the caller decides what a
  // turn is, which is what keeps this kit free of any opinion about a session
  // record. `onState` is called on every observable change and is the only way
  // out, so an Alpine host binds to it and reads nothing else.
  function player(o = {}) {
    const onState = typeof o.onState === 'function' ? o.onState : () => {};
    const s = synth();

    const st = {
      items: [], i: 0, chunk: 0, chunks: [],
      state: 'idle',                 // 'idle' | 'speaking' | 'paused' | 'done'
      rate: Number(o.rate) || 1,
      voice: o.voice || null,
    };

    // The generation token. Bumped by anything that invalidates the queue, and
    // read by every callback before it acts; see the header.
    let gen = 0;

    const emit = () => onState({
      state: st.state, i: st.i, n: st.items.length,
      item: st.items[st.i] || null, rate: st.rate,
      chunk: st.chunk, chunks: st.chunks.length,
    });

    // EVERY item is kept, including one with nothing to say. It is tempting to
    // drop those, and it breaks the only caller that matters: a player driving a
    // deck needs item `i` to BE slide `i`, so a filter here silently
    // desynchronises the voice from the screen a third of the way in. A silent
    // item speaks its label instead (see `prepare`), which is also the honest
    // reading of a card that was all tool calls.
    function load(items) {
      stop();
      st.items = (items || []).filter(Boolean);
      st.i = 0; st.chunk = 0; st.chunks = [];
      st.state = 'idle';
      emit();
      return st.items.length;
    }

    function prepare(i) {
      st.i = Math.max(0, Math.min(i, st.items.length - 1));
      st.chunk = 0;
      st.chunks = chunks(speechText(st.items[st.i]?.md || ''));
      // An item whose whole body was syntax speaks nothing, so say its label
      // rather than skipping in silence: a turn that reduced to a screenshot
      // and two links is a real thing to have reached.
      if (!st.chunks.length) st.chunks = [String(st.items[st.i]?.label || 'Nothing to read here') + '.'];
    }

    function speak() {
      if (!s) return;
      const mine = ++gen;
      const text = st.chunks[st.chunk];
      if (text === undefined) return advance(mine);
      const u = new SpeechSynthesisUtterance(text);
      u.rate = st.rate;
      if (st.voice) u.voice = st.voice;
      u.onend = () => { if (mine === gen) { st.chunk++; speak(); } };
      // 'interrupted' and 'canceled' are what our own cancel() looks like from
      // in here. A real fault is anything else, and stops, rather than skipping
      // ahead through a queue that will fault the same way.
      u.onerror = (e) => {
        if (mine !== gen) return;
        if (e && /interrupt|cancel/i.test(e.error || '')) return;
        st.state = 'idle'; emit();
      };
      st.state = 'speaking';
      emit();
      s.speak(u);
    }

    function advance(mine) {
      if (mine !== undefined && mine !== gen) return;
      if (st.i + 1 < st.items.length) { prepare(st.i + 1); speak(); return; }
      st.state = 'done'; st.chunk = 0; emit();
    }

    function play(i) {
      if (!s || !st.items.length) return;
      // Safari will not speak until a gesture has touched the synth, and this
      // call is always inside one. cancel() first because a queue left behind
      // by a previous page state is invisible and blocks the new one.
      s.cancel();
      if (typeof i === 'number' || st.state === 'idle' || st.state === 'done') {
        prepare(typeof i === 'number' ? i : 0);
      }
      speak();
    }

    // Pause is cancel-and-remember. `chunk` does not advance, so resuming
    // speaks the current chunk from its start; the header says why resume() is
    // not used.
    function pause() {
      if (!s) return;
      gen++;
      s.cancel();
      st.state = 'paused';
      emit();
    }

    const resume = () => { if (st.state === 'paused') speak(); };
    const toggle = () => (st.state === 'speaking' ? pause() : st.state === 'paused' ? resume() : play());

    function stop() {
      gen++;
      if (s) s.cancel();
      st.state = 'idle'; st.chunk = 0;
      emit();
    }

    function step(d) {
      if (!st.items.length) return;
      const was = st.state;
      gen++;
      if (s) s.cancel();
      prepare(Math.max(0, Math.min(st.i + d, st.items.length - 1)));
      if (was === 'speaking') speak();
      else { st.state = was === 'done' ? 'paused' : was; emit(); }
    }

    // Move without deciding whether to speak: a reader who swipes a driven deck
    // re-points the voice, and whether it is talking is not their instruction.
    function seek(i) {
      if (!st.items.length || i === st.i) return;
      gen++;
      if (s) s.cancel();
      const was = st.state;
      prepare(i);
      if (was === 'speaking') speak(); else emit();
    }

    function setRate(r) {
      st.rate = Number(r) || 1;
      if (st.state === 'speaking') { gen++; if (s) s.cancel(); speak(); }
      else emit();
    }

    return {
      load, play, pause, resume, toggle, stop, setRate, seek,
      next: () => step(1), prev: () => step(-1),
      get state() { return st.state; },
      get index() { return st.i; },
      get item() { return st.items[st.i] || null; },
      get count() { return st.items.length; },
      get rate() { return st.rate; },
    };
  }


  // ── The deck action ────────────────────────────────────────────────────────
  //
  //   readAloud.deckAction({ items })  -> { action, onSlide, stop }
  //
  // Spread `action` into swipeDeck.open's `actions`, compose `onSlide` with
  // your own, and the deck reads itself aloud. `items` is one entry PER SLIDE,
  // index-aligned, which is the whole contract: item `i` is slide `i`, so
  // position is one number rather than a mapping that can drift.
  //
  // THE VOICE DRIVES THE DECK, which is the reason this lives here rather than
  // as a play button on a page. A listener is not looking at the screen, so the
  // screen follows the audio; when they do look, the card on it is the card
  // being spoken. And a reader who swipes re-points the voice, because moving
  // the deck is the only instruction a listener can give without stopping.
  //
  // No flag guards the two directions and none is needed. The player emits, and
  // the emit moves the deck only when the deck is elsewhere; the deck's own
  // slide callback re-points the player only when the player is elsewhere. Each
  // echo finds its side already correct and stops. A boolean would have had to
  // survive the deck's smooth scroll, which resolves a frame or more later, and
  // that is exactly the kind of flag that is set and never cleared.
  function deckAction(o = {}) {
    const items = o.items || [];
    let player = null, btnEl = null;

    const paint = (state) => {
      if (!btnEl) return;
      const speaking = state === 'speaking';
      const i = btnEl.querySelector('i');
      if (i) i.className = 'ph ' + (speaking ? 'ph-pause' : (o.icon || 'ph-speaker-high')) + ' text-base';
      btnEl.dataset.titleTip = speaking ? 'Pause' : (o.title || 'Read aloud from this card');
      btnEl.setAttribute('aria-label', btnEl.dataset.titleTip);
      btnEl.setAttribute('aria-pressed', String(speaking));
    };

    const action = {
      icon: o.icon || 'ph-speaker-high',
      title: o.title || 'Read aloud from this card',
      onClick: (deck, btn) => {
        if (btn) btnEl = btn;
        if (player) { player.toggle(); return; }
        if (!supported) return;
        player = player0(deck);
        player.load(items);
        // From where the reader IS, not from the top. They found this card in
        // the outline; starting at slide 0 would discard that.
        player.play(deck.active());
      },
    };

    const player0 = (deck) => window.readAloud.player({
      rate: rememberedRate(),
      onState: (s) => {
        paint(s.state);
        if (s.state !== 'idle' && deck.active() !== s.i) deck.go(s.i);
      },
    });

    return {
      action,
      onSlide: (i) => { if (player) player.seek(i); },
      stop: () => { player?.stop(); player = null; paint('idle'); },
      // The button the deck built from `action`, found by the aria-label the
      // deck sets FROM `action.title`. That coupling is the one thing here that
      // reaches across the kit boundary, so node/test/read-aloud-deck.test.mjs
      // asserts the two still agree rather than leaving it to be noticed when a
      // speaker icon refuses to become a pause icon.
      button: (overlay) =>
        overlay?.querySelector('button[aria-label="' + (action.title || '').replace(/"/g, '\\"') + '"]') || null,
      adopt: (el) => { if (el) btnEl = el; },
    };
  }

  // One rate across every deck, because a reader who wants 1.5x wants it on the
  // next session too. Read at player creation rather than held, so a change made
  // on one surface is in force on the next.
  const rememberedRate = () => {
    try { return Number(localStorage.getItem('wt:readRate')) || 1; } catch { return 1; }
  };

  // getVoices() is empty until the engine has loaded them, and on Safari the
  // event is the only reliable signal. Consumers wanting a named voice call
  // this after `voiceschanged`; nothing here needs one, since the default is
  // the voice the reader already chose in Settings.
  const voices = () => (synth() ? synth().getVoices() : []);

  window.readAloud = { speechText, chunks, player, voices, deckAction, supported };
})();
