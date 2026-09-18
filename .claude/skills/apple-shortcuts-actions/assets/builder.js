// ============================================================================
// Copy-ActionFromJson device-side builder
// ----------------------------------------------------------------------------
// This block lives in a Text action inside the user's Copy-ActionFromJson
// shortcut. The shortcut calls it as  (THIS)(payload)  where payload is the
// parsed chain object: { actions: [ { id, p }, ... ] }.
//
// It serializes each action to a full plist XML document and writes
//   { "actions": [ "<?xml...>", ... ] }
// into the page via textContent, so Get-JsonFromJs can read it back.
//
// Two non-obvious rules baked in:
//   1. esc() preserves numeric entities like &#65532; (does not turn the & into
//      &amp;), so inline-variable anchors written as &#65532; survive intact.
//   2. Output goes through pre.textContent, never document.write of raw markup,
//      so XML angle brackets are not parsed away as unknown HTML tags.
// ============================================================================

((obj) => {
  const esc = s => String(s)
    .replace(/&(?!#\d+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const val = (v, ind) => {
    const pad = '\t'.repeat(ind);
    if (typeof v === 'string') return `${pad}<string>${esc(v)}</string>`;
    if (typeof v === 'number') return pad + (Number.isInteger(v) ? `<integer>${v}</integer>` : `<real>${v}</real>`);
    if (typeof v === 'boolean') return pad + (v ? '<true/>' : '<false/>');
    if (Array.isArray(v)) return v.length
      ? `${pad}<array>\n${v.map(x => val(x, ind + 1)).join('\n')}\n${pad}</array>`
      : `${pad}<array/>`;
    const keys = Object.keys(v);
    return keys.length
      ? `${pad}<dict>\n${keys.map(k => `${'\t'.repeat(ind + 1)}<key>${esc(k)}</key>\n${val(v[k], ind + 1)}`).join('\n')}\n${pad}</dict>`
      : `${pad}<dict/>`;
  };

  const toPlist = a => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${val({ WFWorkflowActionIdentifier: a.id, WFWorkflowActionParameters: a.p }, 0)}
</plist>
`;

  const actions = obj.actions.map(toPlist);
  document.open();
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify({ actions });
  document.body.appendChild(pre);
  document.close();
})
