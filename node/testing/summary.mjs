import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUN_SCHEMA } from './records.mjs';

const seconds = value => Number.isFinite(value) ? `${(value / 1000).toFixed(2)} s` : 'unknown';
const cell = value => String(value ?? 'unknown').replace(/[\r\n]/g, ' ').replaceAll('|', '\\|').replaceAll('`', "'");

export function runMeasures(record) {
  if (record?.schema !== RUN_SCHEMA || !Array.isArray(record.tests)) throw new Error('Unsupported test run record');
  const known = record.tests.filter(row => Number.isFinite(row.elapsed_ms));
  const opaque = record.tests.filter(row => row.opaque?.length).length;
  const candidate = record.candidate_selection;
  const candidates = candidate ? new Set(candidate.tests.map(row => row.path)) : null;
  const omittedFailures = candidates ? record.tests.filter(row => row.complete && row.exit_code !== 0 && !candidates.has(row.path)) : null;
  return {
    schema: 'web-tools-test-measures/1',
    generated: record.finished_at,
    source: record.source,
    runtime: record.runtime,
    run: record.run,
    summary: {
      columns: ['Measure', 'Value'],
      rows: [
        ['Suite wall time', seconds(record.wall_ms)],
        ['Accumulated process elapsed time', seconds(record.sum_process_wall_ms)],
        ['Planned test files', record.tests.length],
        ['Files with elapsed observations', known.length],
        ['Files with opaque dependencies', opaque],
        ['Selected share', `${record.selection?.selected ?? record.tests.length}/${record.selection?.total ?? record.tests.length}`],
        ['Candidate selected share', candidate ? `${candidate.selected}/${candidate.total}` : 'not collected'],
        ['Candidate process elapsed time', seconds(record.candidate_sum_process_wall_ms)],
        ['Omitted failing files', omittedFailures ? omittedFailures.length : 'not collected'],
        ['Run mode', record.mode],
        ['Exit code', record.exit_code ?? record.signal ?? 'unknown'],
        ['Worker observations', record.complete ? 'complete' : 'incomplete'],
      ],
    },
    caveats: [
      'Accumulated process elapsed time overlaps across concurrent workers and includes waiting; it is not CPU time or developer waiting.',
      'File reads are observed dependencies. Opaque tests run conservatively; a passing run is not a complete dependency proof.',
      'Durations describe the recorded venue, runtime, dependency fingerprint and concurrency.',
      'Selected, failed, dirty or incomplete runs cannot replace a passing full-run selection baseline.',
      'Candidate process time is a comparison within a full run, not a prediction of parallel elapsed time; omitted failures are file-level observations.',
    ],
  };
}

export function markdownSummary(record) {
  const measures = runMeasures(record);
  const lines = [
    '### Test run observations', '',
    `Source: \`${cell(record.source?.checkout_sha)}\` · ${cell(record.runtime?.platform)}/${cell(record.runtime?.arch)} · Node ${cell(record.runtime?.node)} · concurrency ${cell(record.runtime?.concurrency)}`, '',
    '| Measure | Value |', '| --- | --- |',
    ...measures.summary.rows.map(row => `| ${row.map(cell).join(' | ')} |`), '',
    'Observed process cost, largest first:', '',
    '| Test file | Process elapsed | Dependency limits |', '| --- | --- | --- |',
    ...record.tests.filter(row => Number.isFinite(row.elapsed_ms)).sort((a, b) => b.elapsed_ms - a.elapsed_ms).slice(0, 12)
      .map(row => `| \`${cell(row.path)}\` | ${seconds(row.elapsed_ms)} | ${cell(row.opaque?.join(', ') || 'none observed')} |`), '',
    ...measures.caveats.map(text => `- ${text}`), '',
  ];
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const file = process.argv[2];
    if (!file) throw new Error('Pass the test run JSON path');
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    process.stdout.write(markdownSummary(record));
  } catch (error) { console.error(`Test summary: ${error.message}`); process.exitCode = 1; }
}
