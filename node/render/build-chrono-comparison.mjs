import fs from 'node:fs';
import path from 'node:path';

const artifactDir = 'C:/Users/mehrl/.gemini/antigravity/brain/26c2bc15-08fb-4950-ad6e-f28d365ccfec';

const images = {
  phoneRail: `data:image/png;base64,${fs.readFileSync(path.join(artifactDir, 'fullcard-chrono-rail.png')).toString('base64')}`,
  phoneBar: `data:image/png;base64,${fs.readFileSync(path.join(artifactDir, 'fullcard-chrono-bar.png')).toString('base64')}`,
  desktopRail: `data:image/png;base64,${fs.readFileSync(path.join(artifactDir, 'desktop-card-chrono-rail.png')).toString('base64')}`,
  desktopBar: `data:image/png;base64,${fs.readFileSync(path.join(artifactDir, 'desktop-card-chrono-bar.png')).toString('base64')}`
};

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
    .preview-card {
      background: #f8fafc;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }
    .dark .preview-card {
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
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Concept Face-Off</h3>
        <p class="text-sm font-medium text-[var(--foreground)]">Chrono Rail vs Chrono Swimlane (No Hops, No Digits)</p>
      </div>
      <div class="flex items-center gap-1">
        <button id="view-mode-tabs" onclick="setViewMode('tabs')" class="px-2 py-0.5 text-xs rounded border border-[var(--border)] bg-[var(--primary)] text-white font-medium">Tabs</button>
        <button id="view-mode-stack" onclick="setViewMode('stack')" class="px-2 py-0.5 text-xs rounded border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] font-medium">Side-by-Side</button>
      </div>
    </div>

    <!-- Tab Buttons -->
    <div id="tab-nav" class="flex flex-wrap gap-1 mb-2.5">
      <button onclick="selectTab('rail')" id="tab-rail"
              class="tab-btn active px-2.5 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition-colors flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-blue-500"></span>
        <span class="font-semibold">Option A: Chrono Rail (Recommended)</span>
      </button>
      <button onclick="selectTab('bar')" id="tab-bar"
              class="tab-btn px-2.5 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-slate-400"></span>
        <span>Option B: Chrono Swimlane (Underlay)</span>
      </button>
    </div>

    <!-- Tab View: Single Shot with Details -->
    <div id="single-view" class="space-y-2">
      <!-- Phone View -->
      <div class="preview-card rounded-lg p-2.5">
        <div class="flex items-center justify-between mb-1.5 text-xs text-[var(--muted-foreground)]">
          <span class="font-medium text-[var(--foreground)]">Mobile View (430px)</span>
          <span id="active-badge" class="px-1.5 py-0.5 font-mono text-[10px] rounded bg-[var(--primary)]/10 text-[var(--primary)] font-semibold">Right Capsule</span>
        </div>
        <div class="flex justify-center overflow-hidden rounded border border-black/5 bg-white p-1">
          <img id="active-phone-img" src="${images.phoneRail}" alt="Phone preview" class="max-w-full h-auto rounded" />
        </div>
      </div>

      <!-- Desktop View -->
      <div class="preview-card rounded-lg p-2.5">
        <div class="text-xs text-[var(--muted-foreground)] mb-1.5">
          <span class="font-medium text-[var(--foreground)]">Desktop View (1280px)</span>
        </div>
        <div class="flex justify-center overflow-hidden rounded border border-black/5 bg-white p-1">
          <img id="active-desktop-img" src="${images.desktopRail}" alt="Desktop preview" class="max-w-full h-auto rounded" />
        </div>
      </div>

      <!-- Description Note -->
      <div id="active-desc" class="p-2 rounded bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] leading-relaxed">
        <strong>Why this is recommended:</strong> Pure, untouched typography on the left. The 80px micro timeline rail on the right creates a consistent column rhythm where turns cascade downward in a clean staircase. Long topic titles never get muddied by background tints.
      </div>
    </div>

    <!-- Stacked / Side-by-Side View -->
    <div id="stack-view" class="hidden space-y-3 max-h-[380px] overflow-y-auto pr-1">
      <!-- Option A Card -->
      <div class="border-2 border-[var(--primary)]/50 rounded-lg p-2.5 bg-[var(--card)]">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-[var(--foreground)]">Option A: Chrono Rail</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)] text-white font-semibold uppercase">Recommended</span>
          </div>
          <span class="font-mono text-[10px] text-[var(--muted-foreground)]">Right-aligned 80px Capsule</span>
        </div>
        <div class="preview-card rounded p-1 mb-2 bg-white">
          <img src="${images.phoneRail}" alt="Option A Phone" class="w-full h-auto rounded" />
        </div>
        <ul class="text-[11px] text-[var(--muted-foreground)] space-y-1 list-disc list-inside">
          <li><strong>Text Clarity:</strong> 100% clean typography with zero background tinting.</li>
          <li><strong>Staircase Rhythm:</strong> Active turn segments step down the right margin like stairs.</li>
          <li><strong>No Clutter:</strong> Completely removes the bouncy hop line and count numbers.</li>
        </ul>
      </div>

      <!-- Option B Card -->
      <div class="border border-[var(--border)] rounded-lg p-2.5 bg-[var(--card)]">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-[var(--foreground)]">Option B: Chrono Swimlane (Underlay)</span>
          <span class="font-mono text-[10px] text-[var(--muted-foreground)]">Full-width Underlay</span>
        </div>
        <div class="preview-card rounded p-1 mb-2 bg-white">
          <img src="${images.phoneBar}" alt="Option B Phone" class="w-full h-auto rounded" />
        </div>
        <ul class="text-[11px] text-[var(--muted-foreground)] space-y-1 list-disc list-inside">
          <li><strong>Concept:</strong> Single active underlay bar at any vertical line across the card.</li>
          <li><strong>Trade-off:</strong> The light tint sits directly behind text, reducing contrast on narrow screens or stretching widely on desktop.</li>
        </ul>
      </div>
    </div>
  </div>

  <script>
    const data = {
      rail: {
        phone: '${images.phoneRail}',
        desktop: '${images.desktopRail}',
        badge: 'Right Capsule',
        desc: '<strong>Why this is recommended:</strong> Pure, untouched typography on the left. The 80px micro timeline rail on the right creates a consistent column rhythm where turns cascade downward in a clean staircase. Long topic titles never get muddied by background tints.'
      },
      bar: {
        phone: '${images.phoneBar}',
        desktop: '${images.desktopBar}',
        badge: 'Full Underlay',
        desc: '<strong>Alternative Concept:</strong> The chronological bar sits directly behind the topic text as an underlay. While it shows the single active bar per cross-section, the underlay tint competes with text contrast on narrow screens and stretches widely on desktop screens.'
      }
    };

    function selectTab(mode) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const activeBtn = document.getElementById('tab-' + mode);
      if (activeBtn) activeBtn.classList.add('active');

      const d = data[mode];
      if (d) {
        document.getElementById('active-phone-img').src = d.phone;
        document.getElementById('active-desktop-img').src = d.desktop;
        document.getElementById('active-badge').textContent = d.badge;
        document.getElementById('active-desc').innerHTML = d.desc;
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

const dest = path.join(artifactDir, 'chrono-comparison.html');
fs.writeFileSync(dest, html, 'utf8');
console.log('Saved', dest);
