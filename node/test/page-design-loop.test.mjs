import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {repoRoot} from '../repo-root.mjs';

// Fixed cases exercise version ancestry, handoff honesty and resource limits.
// The information model's own schema is deliberately outside this check.
const cases=String.raw`import copy
import sys
import importlib.util
import json
from pathlib import Path

root = Path(sys.argv[2])
root.mkdir(exist_ok=True)
module_path = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("record_checker", module_path)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
for name in ("source.txt", "prompt.txt", "m1.json", "s1.html", "p1.html", "m2.json", "s2.html", "p2.html"):
    (root / name).write_text("{}" if name.endswith("json") else "fixture", encoding="utf-8")


def action(xid, op, target, output):
    return {"id": xid, "by": "bot", "op": op, "target": target,
            "inputs": [] if target == "brief" else [target], "reason": "Exercise the fixed case",
            "expected_change": "Trace the stated relation", "verify": ["task"],
            "allowance": {"worker_jobs": 1}, "used": {"worker_jobs": 1},
            "status": "completed", "outputs": [output], "prompt": "prompt.txt",
            "response": output + (".json" if output.startswith("m") else ".html")}


base = {"brief": {"purpose": "Understand the relation", "requested_output": "page", "sources": ["source.txt"],
                   "criteria": [{"id": "task", "procedure": "trace_task", "applies_to": ["structure", "sketch", "page"],
                                 "spec": {"question": "What follows?", "expected": ["the relation"]}}]},
        "allowance": {"worker_jobs": 10}, "state": "ready_for_review",
        "artifacts": [{"id": "m1", "kind": "structure", "path": "m1.json", "parents": []},
                      {"id": "s1", "kind": "sketch", "path": "s1.html", "parents": ["m1"]},
                      {"id": "p1", "kind": "page", "path": "p1.html", "parents": ["s1"]}],
        "actions": [action("a1", "create_structure", "brief", "m1"), action("a2", "create_sketch", "m1", "s1"),
                    action("a3", "build_page", "s1", "p1")],
        "checks": [{"artifact": "p1", "criterion": "task", "status": "pass", "evidence": ["Observed path in p1"]}],
        "presented": ["p1"]}


def run(value):
    path = root / "run.json"
    path.write_text(json.dumps(value), encoding="utf-8")
    return checker.validate(path)


passed = []
assert run(base)["valid"]
passed.append("a complete artifact chain validates")

wrong = copy.deepcopy(base)
wrong["actions"][2]["target"] = "m1"
assert not run(wrong)["valid"]
passed.append("a build action rejects a model target in place of a sketch")

over = copy.deepcopy(base)
over["allowance"]["worker_jobs"] = 2
assert not run(over)["valid"]
passed.append("effort usage exceeding the run allowance is rejected")

revised = copy.deepcopy(base)
revised["state"] = "in_progress"
revised["artifacts"].append({"id": "m2", "kind": "structure", "path": "m2.json", "parents": [], "revises": "m1"})
revised["actions"].append(action("a4", "revise_structure", "m1", "m2"))
result = run(revised)
assert result["valid"] and {"s1", "p1"} <= result["needs_review"].keys()
passed.append("model revision flags directly and transitively dependent views")

unreported = copy.deepcopy(revised)
unreported["state"] = "ready_for_review"
assert not run(unreported)["valid"]
passed.append("a handoff cannot silently present an unchecked older dependency")

fixed = copy.deepcopy(revised)
fixed["artifacts"] += [{"id": "s2", "kind": "sketch", "path": "s2.html", "parents": ["m2"], "revises": "s1"},
                       {"id": "p2", "kind": "page", "path": "p2.html", "parents": ["s2"], "revises": "p1"}]
fixed["actions"] += [action("a5", "revise_sketch", "s1", "s2"), action("a6", "revise_page", "p1", "p2")]
fixed["checks"].append({"artifact": "p2", "criterion": "task", "status": "pass", "evidence": ["New chain traced"]})
fixed["presented"] = ["p2"]
fixed["state"] = "ready_for_review"
assert run(fixed)["valid"] and "p2" not in run(fixed)["needs_review"]
passed.append("revised views consume new versions while originals remain recorded")

compatible = copy.deepcopy(revised)
compatible["brief"]["criteria"].append({"id": "compat", "procedure": "dependency_compatibility", "applies_to": ["sketch"],
                                          "spec": {"compare": "s1 with m2"}})
compatible["checks"].append({"artifact": "s1", "criterion": "compat", "compatible_with": "m2", "status": "pass",
                              "evidence": ["All displayed relationships remain valid under m2"]})
assert not run(compatible)["needs_review"]
passed.append("a named compatibility check can retain a valid earlier view")

indirect = copy.deepcopy(fixed)
indirect["state"] = "in_progress"
indirect["artifacts"][-1]["parents"] = ["s1"]
indirect["brief"]["criteria"].append({"id": "compat", "procedure": "dependency_compatibility", "applies_to": ["page"],
                                        "spec": {"compare": "p2 with s2"}})
indirect["checks"].append({"artifact": "p2", "criterion": "compat", "compatible_with": "s2", "status": "pass",
                            "evidence": ["Page appearance compared"]})
assert "p2" in run(indirect)["needs_review"]
passed.append("a direct compatibility check cannot conceal an older indirect dependency")

controls = copy.deepcopy(base)
for index, op in enumerate(("park", "resume")):
    a = action("control" + str(index), op, "s1", "s1")
    a["outputs"] = []
    a["allowance"] = a["used"] = {"worker_jobs": 0}
    controls["actions"].append(a)
controls["parked"] = []
assert run(controls)["valid"]
passed.append("park followed by resume validates against the final branch state")

fake_review = copy.deepcopy(base)
fake_review["brief"]["criteria"][0]["procedure"] = "person_review"
assert not run(fake_review)["valid"]
passed.append("a bot cannot record a passing person review")

cycle = copy.deepcopy(base)
cycle["artifacts"][0]["parents"] = ["p1"]
try:
    run(cycle)
except ValueError:
    passed.append("cyclic artifact ancestry is rejected")
else:
    raise AssertionError("cycle accepted")

historical = copy.deepcopy(base)
historical["state"] = "in_progress"
historical["artifacts"] += [{"id": "p2", "kind": "page", "path": "p2.html", "parents": ["s1"], "revises": "p1"},
                            {"id": "old-report", "kind": "report", "path": "report.json", "parents": ["p1"]}]
(root / "report.json").write_text("{}",encoding="utf-8")
historical["actions"].append(action("a4", "revise_page", "p1", "p2"))
assert "old-report" not in run(historical)["needs_review"]
passed.append("reports remain historical evidence bound to the artifact version tested")

print(json.dumps({"passed": passed, "count": len(passed)}, indent=2))
`;

test('page design actions preserve revisions, dependency checks and effort limits',()=>{
  const tempRoot=path.resolve(os.tmpdir());
  const work=mkdtempSync(path.join(tempRoot,'page-design-loop-'));
  try {
    const python=process.platform==='win32'?'python':'python3';
    const scriptPath=path.join(repoRoot,'skills/page-design-loop/scripts/validate_run.py');
    const result=spawnSync(python,['-B','-',scriptPath,work],{input:cases,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
    assert.equal(JSON.parse(result.stdout).count,12);
  } finally {
    const relative=path.relative(tempRoot,path.resolve(work));
    assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
    rmSync(work,{recursive:true,force:true});
  }
});
