import fs from 'node:fs';
import path from 'node:path';

const artifactDir = 'C:/Users/mehrl/.gemini/antigravity/brain/26c2bc15-08fb-4950-ad6e-f28d365ccfec';

const modes = [
  {
    id: 'databar-nonum',
    label: '✨ Data Bar (From Text, No Number)',
    tag: 'Text Underlay · No Digits',
    badge: 'Requested Direction',
    file: 'cropped-databar-nonum.png',
    desc: 'Starts exactly at the text boundary (leaving icon glyph and outer hop arc clean). Proportional width highlights conversational weight with zero visual clutter.'
  },
  {
    id: 'databar-withnum',
    label: 'Data Bar (From Text, With Number)',
    tag: 'Text Underlay · With Count',
    badge: 'Hybrid',
    file: 'cropped-databar-withnum.png',
    desc: 'Starts at the text boundary (clean icon glyph) but preserves the quiet tabular count (· 4) at the tail.'
  },
  {
    id: 'databar-old',
    label: 'Data Bar (From Icon - Previous)',
    tag: 'Icon + Text Tint',
    badge: 'Previous',
    file: 'cropped-databar.png',
    desc: 'The previous variant that tinted across the entire row including the emoji icon.'
  },
  {
    id: 'ticks',
    label: 'Timeline Micro-Ticks',
    tag: '|||| 4',
    badge: 'Rail Mirror',
    file: 'cropped-ticks.png',
    desc: 'Discrete vertical cyan ticks (one tick per turn, matching the session timeline above). Direct visual count.'
  },
  {
    id: 'bar',
    label: 'Micro Spark Bar',
    tag: '[▬▬] 4',
    badge: 'Proportional Capsule',
    file: 'cropped-bar.png',
    desc: 'Continuous horizontal capsule whose width scales proportionally with turns (5px/turn).'
  },
  {
    id: 'pips',
    label: 'Intensity Pips',
    tag: '●●○ 2',
    badge: '3-tier Gauge',
    file: 'cropped-pips.png',
    desc: 'Stepped 3-dot gauge (●○○ for 1 turn, ●●○ for 2–3 turns, ●●● for 4+ turns).'
  },
  {
    id: 'dot',
    label: 'Quiet Dot (Baseline)',
    tag: '· 4',
    badge: 'Minimal Text',
    file: 'cropped-dot.png',
    desc: 'Middle dot separator with quiet tabular mono count, leaving maximum focus on the return hop arcs.'
  }
];

const b64Data = {};
for (const m of modes) {
  const p = path.join(artifactDir, m.file);
  if (fs.existsSync(p)) {
    b64Data[m.id] = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  }
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    .tab-btn.active {
      background-color: var(--primary, #3b82f6);
      color: #ffffff;
      font-weight: 600;
    }
    .preview-box {
      background: #f8fafc;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }
    .dark .preview-box {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-2">
  <div class="bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-xl p-3 shadow-sm max-w-xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between pb-2 border-b border-[var(--border)] mb-2.5">
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Data Bar Starting From Text (No Number)</h3>
        <p class="text-sm font-medium text-[var(--foreground)]">Real rendered screenshots comparing the new text-origin bar</p>
      </div>
      <div class="flex items-center gap-1">
        <button id="view-mode-tabs" onclick="setViewMode('tabs')" class="px-2 py-0.5 text-xs rounded border border-[var(--border)] bg-[var(--primary)] text-white font-medium">Tabs</button>
        <button id="view-mode-stack" onclick="setViewMode('stack')" class="px-2 py-0.5 text-xs rounded border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] font-medium">Stack All</button>
      </div>
    </div>

    <!-- Tab Buttons -->
    <div id="tab-nav" class="flex flex-wrap gap-1 mb-2.5">
      ${modes.map((m, idx) => `
        <button onclick="selectTab('${m.id}')" id="tab-${m.id}"
                class="tab-btn ${idx === 0 ? 'active' : ''} px-2 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1">
          <span>${m.label.replace('✨ ', '')}</span>
        </button>
      `).join('')}
    </div>

    <!-- Tab View: Single Shot with details -->
    <div id="single-view" class="space-y-2">
      <div class="preview-box rounded-lg p-3 flex items-center justify-center overflow-hidden min-h-[140px]">
        <img id="active-img" src="${b64Data['databar-nonum']}" alt="Mockup preview" class="rounded max-w-full h-auto shadow-xs border border-black/5" />
      </div>
      <div class="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 text-xs flex items-baseline justify-between gap-2">
        <div id="active-desc" class="text-[var(--muted-foreground)] leading-relaxed">
          ${modes[0].desc}
        </div>
        <span id="active-badge" class="shrink-0 px-1.5 py-0.5 font-mono text-[10px] rounded bg-[var(--primary)]/10 text-[var(--primary)] font-semibold">
          ${modes[0].badge}
        </span>
      </div>
    </div>

    <!-- Stacked View: All together for instant scan -->
    <div id="stack-view" class="hidden space-y-3 max-h-[360px] overflow-y-auto pr-1">
      ${modes.map(m => `
        <div class="border border-[var(--border)] rounded-lg p-2.5 bg-[var(--card)]">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-semibold text-[var(--foreground)]">${m.label}</span>
            <span class="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">${m.badge}</span>
          </div>
          <div class="preview-box rounded p-2 mb-1.5 flex justify-center">
            <img src="${b64Data[m.id]}" alt="${m.label}" class="rounded max-w-full h-auto" />
          </div>
          <p class="text-[11px] text-[var(--muted-foreground)] leading-normal">${m.desc}</p>
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    const modesData = ${JSON.stringify(modes.reduce((acc, m) => {
      acc[m.id] = { ...m, img: b64Data[m.id] };
      return acc;
    }, {}))};

    function selectTab(id) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById('tab-' + id);
      if (activeBtn) activeBtn.classList.add('active');

      const data = modesData[id];
      if (data) {
        document.getElementById('active-img').src = data.img;
        document.getElementById('active-desc').textContent = data.desc;
        document.getElementById('active-badge').textContent = data.badge;
      }
    }

    function setViewMode(mode) {
      const single = document.getElementById('single-view');
      const stack = document.getElementById('stack-view');
      const tabNav = document.getElementById('tab-nav');
      const btnTabs = document.getElementById('view-mode-tabs');
      const btnStack = document.getElementById('view-mode-stack');

      if (mode === 'stack') {
        single.classList.add('hidden');
        stack.classList.remove('hidden');
        tabNav.classList.add('hidden');
        btnStack.classList.add('bg-[var(--primary)]', 'text-white');
        btnStack.classList.remove('text-[var(--muted-foreground)]');
        btnTabs.classList.remove('bg-[var(--primary)]', 'text-white');
        btnTabs.classList.add('text-[var(--muted-foreground)]');
      } else {
        single.classList.remove('hidden');
        stack.classList.add('hidden');
        tabNav.classList.remove('hidden');
        btnTabs.classList.add('bg-[var(--primary)]', 'text-white');
        btnTabs.classList.remove('text-[var(--muted-foreground)]');
        btnStack.classList.remove('bg-[var(--primary)]', 'text-white');
        btnStack.classList.add('text-[var(--muted-foreground)]');
      }
    }
  </script>
</body>
</html>
`;

const dest = path.join(artifactDir, 'topic-size-mockups.html');
fs.writeFileSync(dest, html, 'utf8');
console.log('Saved ' + dest);
