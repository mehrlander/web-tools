import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUN_SCHEMA } from './records.mjs';
import { runMeasures } from './summary.mjs';
import { planSelection } from './select.mjs';

const encode = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`).toString('base64');
const decode = value => JSON.parse(Buffer.from(value.content.replace(/\s/g, ''), 'base64').toString('utf8'));
const trailer = '\n\nCo-Authored-By: Codex <codex@openai.com>';

export function runLocation(record) {
  if (record?.schema !== RUN_SCHEMA || !/^\d+$/.test(String(record.run?.id)) ||
      !/^\d+$/.test(String(record.run?.attempt)) || !/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(record.source?.checkout_sha || '') ||
      !Number.isFinite(Date.parse(record.finished_at))) throw new Error('Run identity, source or event time is invalid');
  return `data/tests/runs/${record.finished_at.slice(0, 7)}/${record.run.id}-${record.run.attempt}.json`;
}

export function baselineEligible(record) {
  const possible = record?.schema === RUN_SCHEMA && record.mode === 'full' && record.exit_code === 0 &&
    record.complete === true && record.source?.dirty === false && Array.isArray(record.tests) && record.tests.length > 0 &&
    Number.isFinite(Date.parse(record.finished_at)) &&
    typeof record.runtime?.arch === 'string' && record.runtime.arch.length > 0 &&
    /^[a-f\d]{64}$/i.test(record.runtime?.dependency_fingerprint || '') &&
    Number.isInteger(record.runtime?.concurrency) && record.runtime.concurrency > 0;
  if (!possible) return false;
  try {
    return planSelection({ snapshot: record, tests: record.tests.map(row => row.path),
      gates: [], changedPaths: [], runtime: record.runtime }).mode === 'selected';
  } catch { return false; }
}

export function reachSnapshot(record) {
  if (!baselineEligible(record)) throw new Error('A baseline needs a complete, passing, clean full run');
  return {
    schema: RUN_SCHEMA, source: record.source, runtime: record.runtime,
    mode: 'full', complete: true, exit_code: 0, finished_at: record.finished_at,
    tests: record.tests.map(row => ({
      path: row.path, complete: true, exit_code: 0, elapsed_ms: null,
      files: row.files, directories: row.directories, missing: row.missing, opaque: row.opaque,
    })),
  };
}

export async function publishReach(record, { request, branch = 'main' }) {
  if (!baselineEligible(record)) return { published: false, reason: 'Run is not eligible as a baseline' };
  const snapshot = reachSnapshot(record), file = 'data/tests/reach.json';
  for (let attempt = 0; attempt < 5; attempt++) {
    let current = null;
    try { current = await request('GET', file, { ref: branch }); }
    catch (error) { if (error.status !== 404) throw error; }
    if (current) {
      const held = decode(current);
      let sourceAdvanced = false;
      if (held.source?.checkout_sha && held.source.checkout_sha !== snapshot.source.checkout_sha) {
        const comparison = await request('COMPARE', `${held.source.checkout_sha}...${snapshot.source.checkout_sha}`, {});
        if (comparison.status !== 'ahead') return { published: false, reason: 'The source does not advance the retained baseline' };
        sourceAdvanced = true;
      }
      if (JSON.stringify(held) === JSON.stringify(snapshot) ||
          (!sourceAdvanced && Date.parse(held.finished_at) >= Date.parse(snapshot.finished_at)))
        return { published: false, reason: 'An equivalent or newer baseline is retained' };
    }
    try {
      await request('PUT', file, { branch, content: encode(snapshot),
        ...(current ? { sha: current.sha } : {}),
        message: `tests: retain observed reach for ${snapshot.source.checkout_sha.slice(0, 8)}${trailer}` });
      return { published: true, source: snapshot.source.checkout_sha };
    } catch (error) { if (![409, 422].includes(error.status) || attempt === 4) throw error; }
  }
}

// The caller supplies the Contents API adapter. Captures are immutable; only
// latest pointers are replaced, with SHA checks and a bounded retry on races.
export async function publishRun(record, { request, branch = 'background' }) {
  const capturePath = runLocation(record);
  const get = async file => {
    try { return await request('GET', file, { ref: branch }); }
    catch (error) { if (error.status === 404) return null; throw error; }
  };
  const write = async (file, value, { immutable = false, baseline = false } = {}) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await get(file);
      if (current) {
        const held = decode(current);
        if (JSON.stringify(held) === JSON.stringify(value)) return false;
        if (immutable) throw new Error(`Refusing to alter captured run ${file}`);
        let sourceAdvanced = false;
        if (baseline && held.source?.checkout_sha && held.source.checkout_sha !== value.source.checkout_sha) {
          const comparison = await request('COMPARE', `${held.source.checkout_sha}...${value.source.checkout_sha}`, {});
          if (comparison.status !== 'ahead') return false;
          sourceAdvanced = true;
        }
        if (!sourceAdvanced && Date.parse(held.generated || held.finished_at) >= Date.parse(value.generated || value.finished_at)) return false;
      }
      try {
        await request('PUT', file, {
          branch, message: `tests: record ${record.run.id} attempt ${record.run.attempt}${trailer}`,
          content: encode(value), ...(current ? { sha: current.sha } : {}),
        });
        return true;
      } catch (error) {
        if (![409, 422].includes(error.status) || attempt === 4) throw error;
      }
    }
    return false;
  };
  const captured = await write(capturePath, record, { immutable: true });
  const latest = await write('data/tests/latest.json', { ...runMeasures(record), record: capturePath });
  const baseline = baselineEligible(record) ? await write('data/tests/reach.json', record, { baseline: true }) : false;
  return { capturePath, captured, latest, baseline };
}

export function githubContents({ token, repository = 'mehrlander/web-tools-private', fetchImpl = fetch }) {
  if (!token) throw new Error('REGISTRY_WRITE_TOKEN is absent');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid destination repository');
  return async (method, file, data) => {
    const comparison = method === 'COMPARE';
    const url = new URL(`https://api.github.com/repos/${repository}/${comparison ? 'compare/' + encodeURIComponent(file) : 'contents/' + file.split('/').map(encodeURIComponent).join('/')}`);
    if (method === 'GET') url.searchParams.set('ref', data.ref);
    const response = await fetchImpl(url, {
      method: comparison ? 'GET' : method, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json',
        'content-type': 'application/json', 'x-github-api-version': '2022-11-28' },
      ...(method === 'PUT' ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const error = new Error(`Run publication ${method} failed with HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const result = await response.json();
    if (method === 'GET' && result.encoding === 'none' && /^[a-f\d]{40,64}$/i.test(result.sha || '')) {
      const blob = await fetchImpl(`https://api.github.com/repos/${repository}/git/blobs/${result.sha}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000),
      });
      if (!blob.ok) throw new Error(`Run publication blob read failed with HTTP ${blob.status}`);
      const bytes = await blob.json();
      return { ...result, encoding: bytes.encoding, content: bytes.content };
    }
    return result;
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const file = process.argv[2];
    if (!file) throw new Error('Pass the full-run record path');
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    const publicReach = process.argv.includes('--public-reach');
    const request = githubContents({ token: publicReach ? process.env.GITHUB_TOKEN : process.env.REGISTRY_WRITE_TOKEN,
      repository: publicReach ? 'mehrlander/web-tools' : 'mehrlander/web-tools-private' });
    const result = publicReach ? await publishReach(record, { request }) : await publishRun(record, { request });
    console.log(JSON.stringify(result));
  } catch (error) { console.error(`Test observations: ${error.message}`); process.exitCode = 1; }
}
