import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../pages/session-context.html', import.meta.url), 'utf8');
const code = html.match(/<script id="context-model">([\s\S]*?)<\/script>/)[1];
const model = vm.createContext({ URLSearchParams });
vm.runInContext(code, model);
const evidence = record => JSON.parse(JSON.stringify(model.contextEvidence(record)));

test('the current startup repair joins the nudge to the default skill', () => {
  const routes = JSON.parse(vm.runInContext('JSON.stringify(contextRoutes)', model));
  const skill = routes.find(r => r.id === 'skills');
  const hook = routes.find(r => r.id === 'hooks');
  assert.ok(skill.phases.includes('start'));
  assert.ok(skill.sources.some(s => s.path === '.claude/skills/default/SKILL.md'));
  assert.ok(hook.sources.some(s => s.path === '.claude/skills/hooks/conventions-nudge.sh'));
});

test('the provenance graph distinguishes durable evidence from causal gaps', () => {
  const routes = JSON.parse(vm.runInContext('JSON.stringify(contextRoutes)', model));
  const outputs = JSON.parse(vm.runInContext('JSON.stringify(provenanceOutputs)', model));
  assert.equal(routes.find(r => r.id === 'instructions').trace,'reconstructed');
  assert.equal(routes.find(r => r.id === 'tools').trace,'observed');
  assert.equal(routes.find(r => r.id === 'continuity').trace,'partial');
  assert.deepEqual(outputs.map(o => o.id),['decision','file','commit','guide']);
  assert.match(html,/data-provenance-graph/);
  assert.match(html,/causal join missing/);
});

test('reconstruction and supplied receipts never claim document delivery', () => {
  const rows = evidence({startup_context:[
    {path:'repo/CLAUDE.md',basis:'reconstructed',via:'project_instructions',bytes:9000},
    {path:'docs/SURFACING.md',basis:'receipt',via:'session_hook',bytes:3000,sent:3000},
    {path:'unknown.md'}
  ],startup_delivery:[{hook:'SessionStart',produced:10000,delivered:2000,truncated:true}]});
  assert.equal(rows.instructions[0].status,'Reconstructed');
  assert.doesNotMatch(rows.instructions[0].detail,/Supplied bytes/);
  assert.equal(rows.instructions[1].status,'Basis unknown');
  assert.equal(rows.hooks[0].status,'Supplied · receipt');
  assert.equal(rows.hooks[1].status,'Truncated');
});

test('unknown hook delivery is not reported as complete', () => {
  const rows = evidence({startup_delivery:[{produced:1000}]});
  assert.equal(rows.hooks[0].status,'Delivery unknown');
  assert.doesNotMatch(rows.hooks[0].detail,/Delivered characters/);
});

test('invocation, expansion, tool output and continuation remain separate evidence', () => {
  const rows = evidence({calls:[
    {name:'Skill',arg:'{"skill":"portable:daisy-alpine"}',ok:true},
    {name:'Read',arg:'/repo/file.md',ok:true},
    {name:'Bash',arg:'cat docs/example.md',ok:false,body:'denied',clipped:true}
  ],injected:[
    {kind:'skill',head:'Base directory for this skill: …',chars:1000},
    {kind:'resume',head:'Continue from where you left off.'},
    {kind:'hook',head:'Stop hook feedback: …'}
  ],prompts:[{text:'Can you explain the diagram?'}]});
  assert.equal(rows.skills.length,2);
  assert.equal(rows.tools.length,2);
  assert.equal(rows.skills[0].label,'portable:daisy-alpine');
  assert.equal(rows.skills[1].status,'Expansion marker');
  assert.match(rows.tools[0].detail,/Result body not retained/);
  assert.equal(rows.tools[1].status,'Failed');
  assert.equal(rows.messages.length,1);
  assert.equal(rows.continuity.length,1);
  assert.equal(rows.hooks.length,1);
});

test('an older empty record does not invent evidence', () => {
  assert.ok(Object.values(evidence({schema:3})).every(rows => rows.length === 0));
});
