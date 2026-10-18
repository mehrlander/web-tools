// ── browser-kind: what kind of browser this is, and what the reader calls it ─
//
// Browser storage is kept per browser, per profile and, on iOS, per home-screen
// app, so anything the app keeps locally is true of one browser only. Where the
// app says which, it names it the same way everywhere: the reader's own name
// for the browser if they gave one in the Here view (wt:browserNote), else the
// kind read off the browser itself, such as "iPhone Safari" or "Mac Chrome".
// The Here view, the Traffic pane's day, and the traffic log all ask here; the
// log's files carry both the kind and the note, so a reading of them can tell
// the reader's browsers apart.
//
// The kind of browser, never the machine: two laptops running Chrome on
// Windows read alike. maxTouchPoints is the touch signal iPadOS does not
// misreport, unlike the user-agent string (the same reading fab.js makes for
// the Shortcuts bridge). Moved here from here-view.js on 2026-10-17, when the
// Traffic pane needed it too. Pure but for the reads it names; attaches
// window.BrowserKind.
(function () {
  const NOTE_KEY = 'wt:browserNote';

  // `nav` and `mm` (a matchMedia test) are the browser's by default, and a
  // test's stubs otherwise.
  function detect(nav = window.navigator || {}, mm = (q) => window.matchMedia(q).matches) {
    let standalone = false, touch = false;
    try { standalone = !!nav.standalone || mm('(display-mode: standalone)'); } catch (e) {}
    try { touch = (nav.maxTouchPoints || 0) > 1; } catch (e) {}
    const ua = String(nav.userAgent || '');
    const browser = /Edg\//.test(ua) ? 'Edge'
      : /CriOS\//.test(ua) ? 'Chrome'
      : /FxiOS\/|Firefox\//.test(ua) ? 'Firefox'
      : /Chrome\//.test(ua) ? 'Chrome'
      : /Safari\//.test(ua) ? 'Safari' : 'an unrecognized browser';
    const os = /iPhone/.test(ua) ? 'iPhone'
      : /iPad/.test(ua) || (/Macintosh/.test(ua) && touch) ? 'iPad'
      : /Android/.test(ua) ? 'Android'
      : /Windows/.test(ua) ? 'Windows'
      : /CrOS/.test(ua) ? 'ChromeOS'
      : /Macintosh/.test(ua) ? 'Mac'
      : /Linux/.test(ua) ? 'Linux' : '';
    return { browser, os, standalone, touch };
  }

  // The kind in a few words: "iPhone Safari, home screen".
  function kind(c = detect()) {
    return (c.os ? c.os + ' ' : '') + c.browser + (c.standalone ? ', home screen' : '');
  }

  function note() {
    try { return localStorage.getItem(NOTE_KEY) || ''; } catch (e) { return ''; }
  }

  window.BrowserKind = {
    NOTE_KEY, detect, kind, note,
    // The reader's name for this browser, else its kind.
    name() { return note() || kind(); },
  };
})();
