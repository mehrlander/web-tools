/**
 * Test script: runs groupByTemplate (the shared core engine) against a corpus of
 * real DOM signature strings. The signatures are just convenient real-world data;
 * the engine itself is generic string-in / string-out.
 *
 * Usage:  node core/test-group.js
 */

const { groupByTemplate, summarize, reconstruct } = require('./group-by-template.js');

const signatures = {
  "📍0": "button.font-base-bold.!text-xs.rounded-l-lg.bg-bg-000.h-full.flex.items-center.justify-center.px-2.border-y-0.5.border-l-0.5.border-border-200.hover:bg-bg-200.disabled:opacity-50.disabled:hover:bg-bg-000",
  "📍1": "button.inline-flex.items-center.justify-center.relative.isolate.shrink-0.can-focus.select-none.disabled:pointer-events-none.disabled:opacity-50.disabled:shadow-none.disabled:drop-shadow-none.font-base-bold.border-0.5.overflow-hidden.transition.duration-100.backface-hidden.h-8.rounded-md.px-3.min-w-[4rem].whitespace-nowrap.!text-xs._fill_1abo4_9._secondary_1abo4_72",
  "📍2": "button.inline-flex.items-center.justify-center.relative.isolate.shrink-0.can-focus.select-none.disabled:pointer-events-none.disabled:opacity-50.disabled:shadow-none.disabled:drop-shadow-none.font-base-bold.border-0.5.overflow-hidden.transition.duration-100.backface-hidden.h-9.px-4.py-2.rounded-lg.min-w-[5rem].whitespace-nowrap._fill_1abo4_9._secondary_1abo4_72",
  "📍3": "div.!box-content.flex.flex-col.bg-bg-000.mx-2.md:mx-0.items-stretch.transition-all.duration-200.relative.z-10.rounded-[20px].cursor-text.z-[1].border.border-transparent.md:w-full.shadow-[0_0.25rem_1.25rem_hsl(var(--always-black)/3.5%),0_0_0_0.5px_hsla(var(--border-300)/0.15)].hover:shadow-[0_0.25rem_1.25rem_hsl(var(--always-black)/3.5%),0_0_0_0.5px_hsla(var(--border-200)/0.3)].focus-within:shadow-[0_0.25rem_1.25rem_hsl(var(--always-black)/7.5%),0_0_0_0.5px_hsla(var(--border-200)/0.3)].hover:focus-within:shadow-[0_0.25rem_1.25rem_hsl(var(--always-black)/7.5%),0_0_0_0.5px_hsla(var(--border-200)/0.3)]",
  "📍4": "div.[&_button]:!text-xs.[&>div]:!rounded-lg",
  "📍5": "div.absolute.inset-0.overflow-auto",
  "📍6": "div.bg-bg-100.text-text-500.text-center.text-xs.py-2",
  "📍7": "div.fixed.lg:sticky.z-sidebar",
  "📍8": "div.flex-1.min-h-0.bg-bg-000.overflow-auto",
  "📍9": "div.flex-1.min-w-0",
  "📍A": "div.flex-1.overflow-hidden.h-full.bg-bg-100",
  "📍B": "div.flex-1.relative.overflow-hidden",
  "📍C": "div.flex.flex-1.gap-2.min-w-0",
  "📍D": "div.flex.flex-col.gap-1.py-4.min-w-0.flex-1",
  "📍E": "div.flex.flex-col.gap-2",
  "📍F": "div.flex.flex-col.gap-2.py-2",
  "📍G": "div.flex.flex-col.gap-5.md:transition-opacity.md:duration-300.md:animate-[fade_0.3s_ease-in-out_0.1s_forwards]",
  "📍H": "div.flex.flex-col.h-full.overflow-hidden",
  "📍I": "div.flex.flex-col.items-start.min-w-0.flex-1.pr-1",
  "📍J": "div.flex.flex-col.m-3.5.gap-3",
  "📍K": "div.flex.h-8.whitespace-nowrap",
  "📍L": "div.flex.items-center.gap-[4px]",
  "📍M": "div.flex.items-center.gap-1.flex-shrink-0",
  "📍N": "div.flex.items-center.gap-2.transition.border-t-0.5.border-transparent",
  "📍O": "div.flex.items-center.group.[&:hover>button]:!bg-bg-300.[&>button:hover]:!bg-bg-500",
  "📍P": "div.flex.items-center.justify-between.px-2.py-2.bg-bg-000.gap-2",
  "📍Q": "div.flex.items-center.justify-center.rounded-full.text-text-200.border-0.5.border-transparent.group-hover:border-border-200.transition.group-hover:opacity-90",
  "📍R": "div.flex.min-w-0.flex-1.shrink.md:items-center.font-base-bold.pr-[100px]",
  "📍S": "div.flex.min-w-0.items-center.justify-center.gap-2.shrink-0",
  "📍T": "div.flex.min-w-0.shrink-1.items-center.group",
  "📍U": "div.flex.shrink-0.items-center.justify-center.rounded-full.font-bold.select-none.h-9.w-9.text-[16px].bg-text-200.text-bg-100",
  "📍V": "div.flex.text-left.font-ui.rounded-lg.overflow-hidden.border-0.5.transition.duration-300.w-full.hover:bg-bg-000/50.px-4.border-border-300/15.hover:border-border-200",
  "📍W": "div.flex.w-full.items-center.justify-between.gap-4.pl-11.lg:px-8.gap-6.p-3.lg:pl-4.lg:pr-3.pr-3",
  "📍X": "div.grid.w-full.overflow-hidden",
  "📍Y": "div.h-full",
  "📍Z": "div.leading-tight.text-sm.line-clamp-1",
  "📍a": "div.max-md:absolute.top-0.right-0.bottom-0.left-0.z-20.draggable-none.md:flex-grow-0.md:flex-shrink-0.md:basis-0.overflow-hidden.h-full.md:pt-[var(--df-header-h,0px)].max-md:flex-1",
  "📍b": "div.md:absolute.md:right-0.md:top-0.z-20.max-md:w-fit.max-md:self-end.max-md:pointer-events-auto.flex.justify-end.shrink-0.min-w-0.pr-3.items-center.gap-1.!h-12.transition-opacity.duration-150.ease-in-out.md:opacity-0.md:pointer-events-none",
  "📍c": "div.md:w-[342px]",
  "📍d": "div.min-w-0.flex-1",
  "📍e": "div.opacity-0.transition-opacity.ease-out.duration-150.flex.flex-1.text-sm.justify-between.items-center.font-medium.min-w-0",
  "📍f": "div.opacity-0.transition-opacity.ease-out.duration-150.flex.flex-col",
  "📍g": "div.overflow-hidden.shrink-0.p-1.-m-1",
  "📍h": "div.overflow-x-hidden.overflow-y-auto.md:h-[calc(100%-56px)].max-md:h-full.max-md:border-t.max-md:border-border-300.max-md:bg-bg-100.md:transition-[width].md:duration-300.md:ease-[cubic-bezier(0.4,0,0.2,1)].w-full.md:mt-12.md:m-2.md:w-[384px].p-5.border-0.5.border-border-300.md:rounded-2xl.max-md:border-0.md:absolute",
  "📍i": "div.overflow-y-auto.overflow-x-hidden.[scrollbar-gutter:stable].pt-6.flex-1",
  "📍j": "div.px-2",
  "📍k": "div.relative.flex-shrink-0",
  "📍l": "div.relative.flex.gap-2.w-full.items-center",
  "📍m": "div.relative.group/copy.bg-bg-000/50.border-0.5.border-border-400.rounded-lg.focus:outline-none.focus-visible:ring-2.focus-visible:ring-accent-100",
  "📍n": "div.relative.h-full",
  "📍o": "div.relative.w-full.min-h-full.flex.flex-col",
  "📍p": "div.root",
  "📍q": "div.shrink-0",
  "📍r": "div.transition-all.duration-200.ease-out",
  "📍s": "div.truncate.font-base-bold",
  "📍t": "div.whitespace-nowrap.select-none",
  "📍u": "div#main-content.w-full.relative.min-w-0.h-full",
  "📍v": "div#root",
  "📍w": "div#wiggle-file-content",
  "📍x": "h2.text-text-500.pb-2.mt-1.text-xs.select-none.pl-2.pr-2.pointer-events-none",
  "📍y": "h2.text-text-500.pb-2.mt-1.text-xs.select-none.pl-2.pr-2.pointer-events-none.group/header.cursor-pointer.flex.items-center.justify-between.gap-2",
  "📍z": "h3.font-medium.text-sm",
  "📍10": "h3#_r_14a_.text-[12px].break-words.text-text-100.line-clamp-4",
  "📍11": "h3#_r_14k_.text-[12px].break-words.text-text-100.line-clamp-4",
  "📍12": "h3#_r_d1_.text-[12px].break-words.text-text-100.line-clamp-4",
  "📍13": "h3#_r_d3_.text-[12px].break-words.text-text-100.line-clamp-4",
  "📍14": "h3#_r_d5_.text-[12px].break-words.text-text-100.line-clamp-4",
  "📍15": "h3#_r_dn_.text-[12px].break-words.text-text-100.line-clamp-4",
  "📍16": "h3#_r_dp_.text-[12px].break-words.text-text-100.line-clamp-4",
  "📍17": "h3#_r_dr_.text-[12px].break-words.text-text-100.line-clamp-4",
  "📍18": "h3#_r_gp_.text-[12px].break-words.text-text-100.line-clamp-4",
  "📍19": "h3#_r_h3_.text-[12px].break-words.text-text-100.line-clamp-4",
  "📍1A": "header.flex.w-full.bg-bg-100.sticky.top-0.z-header.h-12.-mb-3",
  "📍1B": "nav.flex.flex-col.px-0.fixed.left-0.border-r-0.5.h-screen.lg:bg-gradient-to-t.from-bg-200/5.to-bg-200/30.border-border-300.bg-bg-100.transition-[background-color,border-color,box-shadow].duration-[35ms]",
  "📍1C": "span.text-text-400.opacity-0.group-hover/header:opacity-75.transition-opacity",
  "📍1D": "span.text-text-500",
  "📍1E": "span.truncate.text-sm.whitespace-nowrap.flex-1",
  "📍1F": "span.truncate.text-sm.whitespace-nowrap.flex-1.group-hover:[mask-image:linear-gradient(to_right,hsl(var(--always-black))_78%,transparent_95%)].group-focus-within:[mask-image:linear-gradient(to_right,hsl(var(--always-black))_78%,transparent_95%)].[mask-size:100%_100%].[mask-image:linear-gradient(to_right,hsl(var(--always-black))_78%,transparent_95%)]",
  "📍1G": "span.w-full.text-start.block.truncate",
  "📍1H": "span.w-full.truncate.text-xs.text-text-500.font-normal.text-start",
  "📍1I": "ul.-mx-1.5.flex.flex-1.flex-col.px-1.5.gap-px"
};

const strings = Object.values(signatures);
const keys = Object.keys(signatures);

// Create a lookup: original string -> key
const keyMap = new Map();
Object.entries(signatures).forEach(([k, v]) => keyMap.set(v, k));

console.log('='.repeat(80));
console.log('  DOM Signature Grouping: Bookend Merge (maxSlots=1)');
console.log('='.repeat(80));
console.log(`\nInput: ${strings.length} signatures\n`);

const result1 = groupByTemplate(strings, { maxSlots: 1 });

for (let i = 0; i < result1.groups.length; i++) {
  const g = result1.groups[i];
  console.log(`Group ${i + 1}  (${g.members.length} members, score ${g.score})`);
  console.log(`  Template: ${g.template}`);
  for (const m of g.members) {
    const key = keyMap.get(m.original) || '?';
    const slotDisplay = m.slots.map(s => s === '' ? '(empty)' : s).join(' | ');
    console.log(`    ${key}  →  ${slotDisplay}`);
  }
  console.log();
}

if (result1.ungrouped.length > 0) {
  console.log(`Ungrouped  (${result1.ungrouped.length} strings)`);
  for (const s of result1.ungrouped) {
    const key = keyMap.get(s) || '?';
    console.log(`  ${key}: ${s.length > 70 ? s.slice(0, 67) + '...' : s}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('  DOM Signature Grouping: Multi-slot (maxSlots=2)');
console.log('='.repeat(80));
console.log();

const result2 = groupByTemplate(strings, { maxSlots: 2 });

for (let i = 0; i < result2.groups.length; i++) {
  const g = result2.groups[i];
  console.log(`Group ${i + 1}  (${g.members.length} members, score ${g.score})`);
  console.log(`  Template: ${g.template}`);
  const slotCount = g.members[0].slots.length;
  for (const m of g.members) {
    const key = keyMap.get(m.original) || '?';
    const slotDisplay = m.slots.map((s, i) => `$\{${i}}=${s === '' ? '(empty)' : `"${s}"`}`).join('  ');
    console.log(`    ${key}  →  ${slotDisplay}`);
  }
  console.log();
}

console.log(`\nGrouped: ${strings.length - result2.ungrouped.length}/${strings.length}`);
console.log(`Ungrouped: ${result2.ungrouped.length}`);

// ─── Reconstruction Verification ────────────────────────────────────────────

console.log('\n' + '='.repeat(80));
console.log('  Reconstruction Verification');
console.log('='.repeat(80));

let pass = 0, fail = 0;
for (const result of [result1, result2]) {
  for (const g of result.groups) {
    for (const m of g.members) {
      const rebuilt = reconstruct(g.template, m.slots);
      if (rebuilt === m.original) {
        pass++;
      } else {
        fail++;
        console.log(`  FAIL: ${keyMap.get(m.original)}`);
        console.log(`    original:      ${m.original}`);
        console.log(`    reconstructed: ${rebuilt}`);
      }
    }
  }
}
console.log(`\n  ${pass} passed, ${fail} failed\n`);

// ─── Strategy: 'specific', finer-grained sub-groups ─────────────────────────

console.log('='.repeat(80));
console.log('  Strategy: "specific" (most-specific templates first)');
console.log('='.repeat(80));
console.log();

const result3 = groupByTemplate(strings, { maxSlots: 1, strategy: 'specific' });

for (let i = 0; i < result3.groups.length; i++) {
  const g = result3.groups[i];
  const memberKeys = g.members.map(m => keyMap.get(m.original) || '?').join(', ');
  console.log(`Group ${i + 1}  (${g.members.length} members)`);
  console.log(`  Template: ${g.template}`);
  console.log(`  Members: ${memberKeys}`);
  console.log();
}

console.log(`Grouped: ${strings.length - result3.ungrouped.length}/${strings.length}`);
console.log(`Ungrouped: ${result3.ungrouped.length}`);

// ─── Regression: "$" replacement patterns in slot values ────────────────────
// String.prototype.replace treats "$&", "$$", "$'" etc. in a string
// replacement specially; slot values are data and must round-trip verbatim
// (Reconstruction Fidelity invariant).

console.log('\n' + '='.repeat(80));
console.log('  Regression: "$" patterns in slot values');
console.log('='.repeat(80));

let dollarFails = 0;
const dollarStrings = ["price.a$&1.usd", "price.b$$2.usd", "price.c$'3.usd"];
const dollarResult = groupByTemplate(dollarStrings);
if (dollarResult.groups.length === 0) {
  dollarFails++;
  console.log('  FAIL: no group formed for $-containing strings');
}
for (const g of dollarResult.groups) {
  for (const m of g.members) {
    const rebuilt = reconstruct(g.template, m.slots);
    if (rebuilt !== m.original) {
      dollarFails++;
      console.log(`  FAIL: ${JSON.stringify(rebuilt)} !== ${JSON.stringify(m.original)}`);
    }
  }
}
if (dollarFails === 0) console.log('\n  ✓ slot values containing "$" round-trip exactly');

const totalFailures = fail + dollarFails;
console.log(totalFailures === 0 ? '\nALL PASSED' : `\n${totalFailures} FAILURES`);
process.exit(totalFailures === 0 ? 0 : 1);
