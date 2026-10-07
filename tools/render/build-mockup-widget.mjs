import fs from 'node:fs';
import path from 'node:path';

const artifactDir = 'C:/Users/mehrl/.gemini/antigravity/brain/26c2bc15-08fb-4950-ad6e-f28d365ccfec';

const modes = [
  {
    id: 'ticks',
    label: '1. Timeline Ticks',
    tag: '|||| 4',
    badge: 'Mirroring timeline rail',
    file: 'cropped-ticks.png',
    desc: 'Discrete vertical cyan ticks (one tick per turn, matching the session timeline above). Highly legible for 1–6 turns, with a quiet + for 8+ turns.'
  },
  {
    id: 'bar',
    label: '2. Spark Bar',
    tag: '[▬▬] 4',
    badge: 'Proportional capsule',
    file: 'cropped-bar.png',
    desc: 'Micro horizontal capsule whose width scales continuously with turns (5px/turn). Gives an instantaneous perception of conversational length.'
  },
  {
    id: 'databar',
    label: '3. Data Bar',
    tag: 'bg-tint',
    badge: 'Row background fill',
    file: 'cropped-databar.png',
    desc: 'Subtle translucent background fill (bg-primary/8) spanning proportionally behind the topic name according to its share of the session.'
  },
  {
    id: 'pips',
    label: '4. Intensity Pips',
    tag: '●●○ 2',
    badge: '3-tier meter',
    file: 'cropped-pips.png',
    desc: 'Stepped 3-dot gauge (●○○ for 1 turn, ●●○ for 2–3 turns, ●●● for 4+ turns). Compact, low visual noise, quick threshold scanning.'
  },
  {
    id: 'weight',
    label: '5. Typographic Weight',
    tag: 'bolder/lighter',
    badge: 'Text hierarchy',
    file: 'cropped-weight.png',
    desc: 'Scales typographic prominence: major topics (4+ turns) are bold and high-contrast; 1-turn mentions remain muted and lighter.'
  },
  {
    id: 'dot',
    label: '6. Quiet Dot (Current)',
    tag: '· 4',
    badge: 'Minimal baseline',
    file: 'cropped-dot.png',
    desc: 'The clean baseline: middle dot separator with quiet tabular mono count, leaving full visual prominence to the return hop arcs.'
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
    /* Custom scrollbars and transitions */
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
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Topic Turn Size & Hop Rail Mockups</h3>
        <p class="text-sm font-medium text-[var(--foreground)]">Real rendered screenshots across 6 visual directions</p>
      </div>
      <div class="flex items-center gap-1">
        <button id="view-mode-tabs" onclick="setViewMode('tabs')" class="px-2 py-0.5 text-xs rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-medium">Tabs</button>
        <button id="view-mode-stack" onclick="setViewMode('stack')" class="px-2 py-0.5 text-xs rounded border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] font-medium">Stack All</button>
      </div>
    </div>

    <!-- Tab Buttons -->
    <div id="tab-nav" class="flex flex-wrap gap-1 mb-2.5">
      ${modes.map((m, idx) => `
        <button onclick="selectTab('${m.id}')" id="tab-${m.id}"
                class="tab-btn ${idx === 0 ? 'active' : ''} px-2 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1">
          <span>${m.label.split('.')[1]}</span>
          <span class="font-mono text-[10px] opacity-75">(${m.tag})</span>
        </button>
      `).join('')}
    </div>

    <!-- Tab View: Single Shot with details -->
    <div id="single-view" class="space-y-2">
      <div class="preview-box rounded-lg p-2 flex items-center justify-center overflow-hidden">
        <img id="active-img" src="${b64Data['ticks']}" alt="Mockup preview" class="rounded max-w-full h-auto shadow-xs border border-black/5" />
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

    <!-- Stacked View: All 6 together for instant scan -->
    <div id="stack-view" class="hidden space-y-3 max-h-[360px] overflow-y-auto pr-1">
      ${modes.map(m => `
        <div class="border border-[var(--border)] rounded-lg p-2 bg-[var(--card)]">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-semibold text-[var(--foreground)]">${m.label}</span>
            <span class="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">${m.badge}</span>
          </div>
          <div class="preview-box rounded p-1 mb-1.5">
            <img src="${b64Data[m.id]}" alt="${m.label}" class="rounded w-full h-auto" />
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
      } else {
        single.classList.remove('hidden');
        stack.classList.add('hidden');
        tabNav.classList.remove('hidden');
        btnTabs.classList.add('bg-[var(--primary)]', 'text-white');
        btnTabs.classList.remove('text-[var(--muted-foreground)]');
        btnStack.classList.remove('bg-[var(--primary)]', 'text-white');
      }
    }
  </script>
</body>
</html>
`;

const dest = path.join(artifactDir, 'topic-size-mockups.html');
fs.writeFileSync(dest, html, 'utf8');
console.log('Saved ' + dest);
