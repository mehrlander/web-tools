import fs from 'node:fs';
import path from 'node:path';

const artDir = 'C:/Users/mehrl/.gemini/antigravity/brain/26c2bc15-08fb-4950-ad6e-f28d365ccfec';

const images = {
  card1Mobile: `data:image/png;base64,${fs.readFileSync(path.join(artDir, 'fixed-card1-mobile.png')).toString('base64')}`,
  card2Mobile: `data:image/png;base64,${fs.readFileSync(path.join(artDir, 'fixed-card2-mobile.png')).toString('base64')}`,
  card2Desktop: `data:image/png;base64,${fs.readFileSync(path.join(artDir, 'fixed-card2-desktop.png')).toString('base64')}`
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
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }
  </style>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-2">
  <div class="bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-xl p-3 shadow-sm max-w-xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between pb-2 border-b border-[var(--border)] mb-2.5">
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Fixed & Aligned Chronological Underlay</h3>
        <p class="text-sm font-medium text-[var(--foreground)]">Bars start from text origin (left: 22px) · Scaled to total session turns</p>
      </div>
      <span class="px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">Fixed</span>
    </div>

    <!-- Details summary -->
    <div class="space-y-3">
      <!-- Desktop View: Staircase and Return Visit -->
      <div class="preview-card rounded-lg p-2.5 shadow-sm">
        <div class="flex items-center justify-between mb-1.5 text-xs text-[var(--muted-foreground)]">
          <span class="font-medium text-[var(--foreground)]">Desktop View (1280px) · Multi-topic Session Progression</span>
          <span class="px-1.5 py-0.5 font-mono text-[10px] rounded bg-blue-500/10 text-blue-600 font-semibold">1 active bar per cross-section</span>
        </div>
        <div class="flex justify-center overflow-hidden rounded border border-black/5 bg-white p-1">
          <img src="${images.card2Desktop}" alt="Desktop staircase" class="max-w-full h-auto rounded" />
        </div>
        <p class="text-[11px] text-[var(--muted-foreground)] mt-1.5 leading-snug">
          Notice the staircase progression: each topic illuminates exactly when it was active. On row 5 (<em>"Stance and anchor terms"</em>), the <strong>return visit</strong> lights up as a second segment further to the right.
        </p>
      </div>

      <!-- Mobile View -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div class="preview-card rounded-lg p-2.5 shadow-sm">
          <div class="text-xs text-[var(--muted-foreground)] mb-1">
            <span class="font-medium text-[var(--foreground)]">Mobile (430px) · 2 Topics</span>
          </div>
          <div class="flex justify-center overflow-hidden rounded border border-black/5 bg-white p-1">
            <img src="${images.card1Mobile}" alt="Mobile 2 topics" class="max-w-full h-auto rounded" />
          </div>
          <p class="text-[10px] text-[var(--muted-foreground)] mt-1">Topic 1 fills 1st half; Topic 2 takes over 2nd half.</p>
        </div>

        <div class="preview-card rounded-lg p-2.5 shadow-sm">
          <div class="text-xs text-[var(--muted-foreground)] mb-1">
            <span class="font-medium text-[var(--foreground)]">Mobile (430px) · Cascade</span>
          </div>
          <div class="flex justify-center overflow-hidden rounded border border-black/5 bg-white p-1">
            <img src="${images.card2Mobile}" alt="Mobile cascade" class="max-w-full h-auto rounded" />
          </div>
          <p class="text-[10px] text-[var(--muted-foreground)] mt-1">Left-aligned at text origin (22px), zero icon overlap.</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

fs.writeFileSync(path.join(artDir, 'chrono-fixed.html'), html);
console.log('Built chrono-fixed.html');
