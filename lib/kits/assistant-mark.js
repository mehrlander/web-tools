// assistant-mark.js: logomarks and attribution classifier for AI assistants
// and human contributors across the estate.
//
// Extends the visual vocabulary established by claude-mark.js: each assistant
// receives a matching geometric stroke-based mark with stroke-width 2.2 in its
// brand color, sized to fit the standard 24x24 viewBox.
//
// Attaches to window.AssistantMark and window.assistantMark.
(() => {
  const COLOR = {
    claude: '#d97757',
    gemini: '#1a73e8',
    codex: '#10a37f',
    grok: '#52525b',
    human: '#64748b',
    copilot: '#6e40c9',
  };

  const LABEL = {
    claude: 'Claude Code',
    gemini: 'Gemini',
    codex: 'ChatGPT',
    grok: 'Grok',
    human: 'Human',
    copilot: 'Copilot',
  };

  // Minimalist geometric stroke paths in a 24x24 coordinate space.
  // Claude's 11-ray mark is owned by claude-mark.js and delegated to here.
  const PATH = {
    // 4-pointed curved star sparkle meeting at inward quadratic arc tangents
    gemini: 'M12,2 C12,8.5 15.5,12 22,12 C15.5,12 12,15.5 12,22 C12,15.5 8.5,12 2,12 C8.5,12 12,8.5 12,2 Z',
    // 3-arc geometric vortex swirl
    codex: 'M12,4 A8,8 0 0,1 18.9,16 M18.9,16 A8,8 0 0,1 7.1,16 M7.1,16 A8,8 0 0,1 12,4',
    // Mathematical slash mark with top and bottom terminals
    grok: 'M7,20 L17,4 M4.5,20 L9.5,20 M14.5,4 L19.5,4',
    // User silhouette outline (drawn only when an explicit human mark is requested)
    human: 'M12,11 A3.5,3.5 0 1,0 12,4 A3.5,3.5 0 1,0 12,11 Z M6,20 C6,16.5 8.7,14.5 12,14.5 C15.3,14.5 18,16.5 18,20',
  };

  const SESSION_RE = /https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+/;

  // Classify branch or commit into an assistant key.
  function classify(item) {
    if (!item) return 'human';
    const name = typeof item === 'string' ? item : (item.name || item.head || '');
    const session = typeof item === 'object' ? (item.session || '') : '';
    const subject = typeof item === 'object' ? (item.subject || item.title || item.message || '') : '';
    const trailer = typeof item === 'object' ? (item.trailer || '') : '';

    if (name.startsWith('claude/') || SESSION_RE.test(session) || trailer.includes('Claude-Session')) {
      return 'claude';
    }
    if (name.startsWith('codex/') || name.startsWith('chatgpt/')) {
      return 'codex';
    }
    if (name.startsWith('grok/') || name.endsWith('-grok') || subject.includes('Grok') || trailer.includes('Grok')) {
      return 'grok';
    }
    if (name.startsWith('gemini/')
        || name === 'agent/two-modes-github-flow-and-real-time'
        || name === 'agent/shortcut-run-test'
        || name === 'agent/concept-index-workflow'
        || (name.startsWith('agent/') && !name.includes('grok'))
        || trailer.includes('Co-Authored-By: Gemini')
        || trailer.includes('Gemini')) {
      return 'gemini';
    }
    if (name.startsWith('copilot/')) {
      return 'copilot';
    }
    return 'human';
  }

  function svg(assistant, { cls = 'w-4 h-4 shrink-0', color, showHuman = false } = {}) {
    const key = assistant || 'human';
    if (key === 'claude') {
      if (window.claudeMark?.svg) {
        return window.claudeMark.svg({ cls, color: color || COLOR.claude });
      }
    }
    if (key === 'human' && !showHuman) return '';

    const strokeColor = color || COLOR[key] || COLOR.human;
    const pathD = PATH[key] || PATH.human;
    return `<svg viewBox="0 0 24 24" class="${cls}" style="stroke:${strokeColor}" stroke-width="2.2"`
      + ` stroke-linecap="round" stroke-linejoin="round" fill="none" aria-hidden="true"><path d="${pathD}"/></svg>`;
  }

  function el(assistant, opts) {
    const markup = svg(assistant, opts);
    if (!markup) return null;
    const box = document.createElement('div');
    box.innerHTML = markup;
    return box.firstElementChild;
  }

  const api = {
    COLOR,
    LABEL,
    PATH,
    classify,
    svg,
    el,
    label: key => LABEL[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : ''),
    color: key => COLOR[key] || COLOR.human,
  };

  window.assistantMark = api;
  window.AssistantMark = api;
})();
