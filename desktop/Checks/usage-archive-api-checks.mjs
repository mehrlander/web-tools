import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const fixture = await mkdtemp(join(tmpdir(), 'web-tools-usage-archive-'));
const token = randomBytes(32).toString('hex');
const port = 48500 + Math.floor(Math.random() * 1000);
await writeFile(join(fixture, 'companion-access.json'), JSON.stringify({LocalToken:token,TailscaleLogin:'owner@example.test',PhoneUrl:'https://fixture.example.ts.net/'}));
await writeFile(join(fixture, 'settings.json'), JSON.stringify({RepositoriesRoot:join(fixture,'missing-repositories')}));
const archive = join(fixture, 'phone-usage-history.json');
const executable = fileURLToPath(new URL('../Companion/bin/Release/net8.0-windows/WebTools.Companion.dll', import.meta.url));
const child = spawn('dotnet', [executable], {env:{...process.env,WEBTOOLS_COMPANION_DATA:fixture,WEBTOOLS_COMPANION_PORT:String(port)},windowsHide:true,stdio:'pipe'});
let errors = '';
child.stderr.on('data', value => { errors += value; });
child.stdout.resume();
const local = {Authorization:'Bearer '+token};
const owner = {'Tailscale-User-Login':'owner@example.test'};
const request = (headers=owner, method='GET', query='') => fetch(`http://127.0.0.1:${port}/api/v1/usage-history${query}`, {headers,method});
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const at = '2026-04-08T10:00:00Z';
const valid = {schemaVersion:1,updatedAt:at,periods:[{provider:'claude',bucket:'seven_day',reset:'2026-04-13T00:00:00Z',minutes:10080,label:'All models',first_at:at,last_at:at,peak:25,last_used:25,samples:1}],tokenDays:[],codexTokenStatus:'unavailable',dailyAllowance:{schemaVersion:1,timezone:'UTC',updatedAt:at,days:[],providers:[]},adjustments:[],sourceCount:1,sessionUsage:{schemaVersion:1,available:false,sessions:[]}};
try {
  let ready=false;
  let lastStatus='not reached';
  for(let attempt=0;attempt<100;attempt++) {
    if(child.exitCode!==null) throw new Error('Companion exited: '+errors);
    try { lastStatus=(await request(local)).status; if(lastStatus===503) {ready=true;break;} }
    catch(error) { lastStatus=error.cause?.code || error.code || error.name; }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  check(ready,'An absent derived archive returns 503 without starting a collector in the isolated fixture (last response: '+lastStatus+').');
  check((await request({})).status===403 && (await request({'Tailscale-User-Login':'other@example.test'})).status===403,'Archive reads require the existing owner or local bearer boundary.');
  await writeFile(archive,JSON.stringify(valid));
  const response=await request();
  check(response.ok && response.headers.get('cache-control')==='no-store','An owner receives the private derived archive without HTTP caching.');
  assert.deepEqual(await response.json(),valid);checks++;
  check((await request(local)).ok,'The local desktop bearer can read the same canonical archive.');
  check((await request(owner,'POST')).status===405 && (await request(owner,'GET','?source=elsewhere')).status===400,'The route accepts no mutation or caller-selected path.');
  check((await request({...owner,Origin:'https://foreign.example'})).status===403,'Foreign-origin requests cannot read usage history.');
  for(const value of [
    {...valid,privatePath:'PRIVATE SOURCE PATH'},
    {...valid,periods:[{...valid.periods[0],private_diagnostic:'PRIVATE TRACE'}]},
    {...valid,periods:[{...valid.periods[0],last_used:-1}]},
    {...valid,updatedAt:'not a timestamp'},
    {...valid,sessionUsage:{schemaVersion:1,available:true,sessions:[{transcript:'PRIVATE TRANSCRIPT'}]}}
  ]) {
    await writeFile(archive,JSON.stringify(value));
    const rejected=await request();
    check(rejected.status===503 && !(await rejected.text()).includes('PRIVATE'),'Malformed or extra fields cannot expose private source details.');
  }
  await writeFile(archive,'not json: PRIVATE PARSE FAILURE');
  const malformed=await request();
  check(malformed.status===503 && !(await malformed.text()).includes('PRIVATE'),'Parse errors return a sanitized unavailable response.');
  await writeFile(archive,' '.repeat(8*1024*1024+1));
  check((await request()).status===503,'An oversized archive is rejected before JSON parsing.');
  await writeFile(archive,JSON.stringify(valid));
  check((await request()).ok,'A later complete archive recovers without restarting the companion.');
  const worker=fileURLToPath(new URL('../worker/',import.meta.url));
  const derived=spawnSync('python',['-c',[
    'import sys',
    'from pathlib import Path',
    'from datetime import datetime, timezone',
    'from unittest.mock import patch',
    'sys.path.insert(0,sys.argv[1])',
    'from usage_history import store',
    'import usage_archive',
    'state=Path(sys.argv[2])',
    "at='2026-04-08T09:00:00Z'",
    "p=dict(provider='claude',status='available',observedAt=at,windows=[dict(id='seven_day',label='All models',usedPercent=70,resetsAt='2026-04-13T00:00:00Z',durationMinutes=10080)])",
    'store(state,[p],at=at)',
    "p['observedAt']='2026-04-08T09:10:00Z';p['windows'][0]['usedPercent']=20",
    "store(state,[p],at=p['observedAt'])",
    "session=dict(id='1234abcd',agentSessionId='session_Test',provider='claude',title='Recorded session',sessionUrl='https://claude.ai/code/session_Test',contextTokens=1234,usageAt=at,cacheReadTokens=5000,cacheWriteTokens=600,inputTokens=7,outputTokens=88,measuredSteps=2,reloads=0)",
    "with patch.object(usage_archive,'collect_session_usage',return_value=dict(available=True,sessions=[session],observedAt=at,revision='a'*40)):",
    ' usage_archive.export(state=state,now=datetime(2026,4,8,12,tzinfo=timezone.utc).timestamp(),zone=timezone.utc)'
  ].join('\n'),worker,fixture],{windowsHide:true,encoding:'utf8'});
  assert.equal(derived.status,0,'The real recorder and aggregate projector generate a complete fixture archive.');checks++;
  const actualResponse=await request(),actual=actualResponse.ok?await actualResponse.json():null;
  const rejectedSections=[];
  if(!actualResponse.ok) {
    const complete=JSON.parse(await readFile(archive,'utf8'));
    for(const field of ['periods','tokenDays','dailyAllowance','adjustments','sessionUsage']) {
      await writeFile(archive,JSON.stringify({...valid,[field]:complete[field]}));
      if(!(await request()).ok) rejectedSections.push(field);
    }
  }
  check(actualResponse.ok && actual.dailyAllowance.providers.length===3 && actual.adjustments[0].drop===50
    && actual.sessionUsage.sessions[0].outputTokens===88,'The API accepts the real projector contract, including daily rows, observed decreases and recorded session counters (status '+actualResponse.status+'; rejected sections: '+rejectedSections.join(', ')+').');
  console.log(JSON.stringify({checks,result:'passed',fixtureOutputPublished:false}));
} finally {
  child.kill();
  await new Promise(resolve=>child.once('exit',resolve));
  await rm(fixture,{recursive:true,force:true});
}
