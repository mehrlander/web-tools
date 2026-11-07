#!/usr/bin/env python3
"""Check a page-design-loop record without changing files or dispatching work."""
import argparse
import hashlib
import json
from pathlib import Path


TARGETS = {
    "create_structure": "brief", "revise_structure": "structure",
    "create_sketch": "structure", "revise_sketch": "sketch",
    "build_page": "sketch", "revise_page": "page",
    "run_check": None, "park": None, "resume": None, "present": None,
}
OUTPUTS = {
    "create_structure": "structure", "revise_structure": "structure",
    "create_sketch": "sketch", "revise_sketch": "sketch",
    "build_page": "page", "revise_page": "page",
}
PROCEDURES = {
    "trace_task", "source_support", "render_health", "visual_requirements",
    "dependency_compatibility", "person_review",
}


def validate(run_path):
    root = run_path.resolve().parent
    run = json.loads(run_path.read_text(encoding="utf-8"))
    errors, warnings = [], []

    def need(condition, message):
        if not condition:
            errors.append(message)
        return bool(condition)

    def text(value):
        return isinstance(value, str) and bool(value.strip())

    def count(value):
        return isinstance(value, int) and not isinstance(value, bool) and value >= 0

    def file(value, owner):
        if not need(text(value), f"{owner}: missing file path"):
            return None
        path = (root / value).resolve()
        if not need(not Path(value).is_absolute() and path.is_relative_to(root),
                    f"{owner}: path must stay within the run folder"):
            return None
        need(path.is_file(), f"{owner}: missing file {value}")
        return path if path.is_file() else None

    if not isinstance(run, dict):
        raise ValueError("run must be an object")
    brief = run.get("brief", {})
    if not isinstance(brief, dict):
        raise ValueError("brief must be an object")
    need(text(brief.get("purpose")), "brief: purpose required")
    requested = brief.get("requested_output")
    need(requested in {"structure", "sketch", "page"}, "brief: invalid requested_output")
    sources = brief.get("sources", [])
    need(isinstance(sources, list) and bool(sources), "brief: source snapshots required")
    for source in sources:
        file(source, "source")
    criteria = {}
    for criterion in brief.get("criteria", []):
        cid = criterion["id"]
        need(text(cid) and cid not in criteria, f"criterion: duplicate or invalid ID {cid}")
        need(criterion.get("procedure") in PROCEDURES, f"{cid}: unknown procedure")
        need(isinstance(criterion.get("spec"), dict) and bool(criterion["spec"]), f"{cid}: spec required")
        need(bool(criterion.get("applies_to")) and all(k in {"structure", "sketch", "page", "report"}
             for k in criterion["applies_to"]), f"{cid}: invalid applies_to")
        criteria[cid] = criterion
    need(bool(criteria), "brief: named criteria required")

    artifacts, revisions, paths = {}, {}, set()
    for artifact in run.get("artifacts", []):
        aid = artifact["id"]
        need(text(aid) and aid not in artifacts, f"artifact: duplicate or invalid ID {aid}")
        need(artifact.get("kind") in {"structure", "sketch", "page", "report"}, f"{aid}: invalid kind")
        path = file(artifact.get("path"), aid)
        need(path is None or path not in paths, f"{aid}: versions must use distinct file paths")
        if path:
            paths.add(path)
            if artifact.get("sha256"):
                need(hashlib.sha256(path.read_bytes()).hexdigest() == artifact["sha256"], f"{aid}: hash mismatch")
        need(isinstance(artifact.get("parents"), list), f"{aid}: parents must be a list")
        artifacts[aid] = artifact
    for aid, artifact in artifacts.items():
        for parent in artifact.get("parents", []):
            need(parent in artifacts, f"{aid}: missing parent {parent}")
        parent_kinds = {artifacts[p]["kind"] for p in artifact.get("parents", []) if p in artifacts}
        if artifact["kind"] == "sketch":
            need("structure" in parent_kinds, f"{aid}: sketch needs a structure dependency")
        if artifact["kind"] == "page":
            need("sketch" in parent_kinds, f"{aid}: page needs a sketch dependency")
        previous = artifact.get("revises")
        if previous:
            need(previous in artifacts, f"{aid}: missing revision target {previous}")
            need(previous not in revisions, f"{previous}: revision branches need distinct candidate identities")
            if previous in artifacts:
                need(artifact["kind"] == artifacts[previous]["kind"], f"{aid}: revision changes artifact kind")
            revisions[previous] = aid
    visited, visiting = set(), set()

    def visit(aid):
        if aid in visited or aid not in artifacts:
            return
        if aid in visiting:
            raise ValueError(f"artifact ancestry cycle at {aid}")
        visiting.add(aid)
        artifact = artifacts[aid]
        for parent in artifact.get("parents", []) + ([artifact["revises"]] if artifact.get("revises") else []):
            visit(parent)
        visiting.remove(aid)
        visited.add(aid)
    for aid in artifacts:
        visit(aid)

    checks = run.get("checks", [])
    for check in checks:
        aid, cid = check.get("artifact"), check.get("criterion")
        need(aid in artifacts and cid in criteria, "check: artifact and criterion must resolve")
        if aid in artifacts and cid in criteria:
            need(artifacts[aid]["kind"] in criteria[cid]["applies_to"], "check: criterion does not apply to artifact kind")
        need(check.get("status") in {"pass", "fail", "unknown"}, "check: invalid status")
        need(isinstance(check.get("evidence"), list) and bool(check["evidence"])
             and all(text(v) for v in check["evidence"]), "check: observed evidence or an explicit unknown reason required")
        if cid in criteria and criteria[cid]["procedure"] == "person_review" and check.get("status") == "pass":
            need(check.get("by") == "person", "person_review: a pass requires the person's response")
        if check.get("compatible_with"):
            replacement = check["compatible_with"]
            need(replacement in artifacts, "compatibility: replacement must resolve")
            need(cid in criteria and criteria[cid]["procedure"] == "dependency_compatibility",
                 "compatibility: use a dependency_compatibility criterion")

    limit = run.get("allowance", {}).get("worker_jobs")
    need(count(limit), "allowance: nonnegative worker_jobs required")
    used_total, reserved_total, action_ids, branch_controls = 0, 0, set(), {}
    for action in run.get("actions", []):
        xid = action["id"]
        need(text(xid) and xid not in action_ids, f"action: duplicate or invalid ID {xid}")
        action_ids.add(xid)
        op, target, status = action.get("op"), action.get("target"), action.get("status")
        need(op in TARGETS, f"{xid}: unknown operation {op}")
        need(action.get("by") in {"person", "bot", "script"}, f"{xid}: invalid actor")
        need(status in {"planned", "running", "completed", "failed", "cancelled"}, f"{xid}: invalid status")
        for key in ("reason", "expected_change"):
            need(text(action.get(key)), f"{xid}: {key} required")
        need(bool(action.get("verify")) and all(c in criteria for c in action["verify"]), f"{xid}: named verification required")
        for parent in action.get("inputs", []):
            need(parent in artifacts, f"{xid}: missing consumed version {parent}")
        if target == "brief":
            need(op == "create_structure", f"{xid}: operation requires an artifact target")
        else:
            need(target in artifacts, f"{xid}: missing target {target}")
            if target in artifacts and op in TARGETS and TARGETS[op]:
                need(artifacts[target]["kind"] == TARGETS[op], f"{xid}: wrong target kind")
            need(target in action.get("inputs", []), f"{xid}: target must be in inputs")
        budget = action.get("allowance", {}).get("worker_jobs")
        used = action.get("used", {}).get("worker_jobs")
        if need(count(budget) and count(used), f"{xid}: numeric allowance and usage required"):
            need(used <= budget, f"{xid}: action allowance exceeded")
            if op in OUTPUTS and action.get("by") == "bot" and status != "cancelled":
                need(budget >= 1, f"{xid}: creator assignment needs a reserved worker job")
                if status == "completed":
                    need(used >= 1, f"{xid}: completed creator assignment must account for a worker job")
            used_total += used
            reserved_total += budget if status in {"planned", "running"} else used
        output_ids = action.get("outputs", [])
        for output in output_ids:
            need(output in artifacts, f"{xid}: missing output {output}")
        if status == "completed" and op in OUTPUTS:
            need(len(output_ids) == 1, f"{xid}: creator action must produce one artifact version")
            file(action.get("prompt"), xid + " prompt")
            file(action.get("response"), xid + " response")
            for output in output_ids:
                if output not in artifacts:
                    continue
                artifact = artifacts[output]
                need(artifact["kind"] == OUTPUTS[op], f"{xid}: wrong output kind")
                if op.startswith("revise_"):
                    need(artifact.get("revises") == target, f"{xid}: revision must name target")
                if op in {"create_sketch", "build_page"}:
                    need(target in artifact["parents"], f"{xid}: output must depend on target")
        if status == "completed" and op == "run_check":
            need(any(c.get("action") == xid and c.get("artifact") == target for c in checks),
                 f"{xid}: completed check needs a linked check result")
        if status == "completed" and op in {"park", "resume"}:
            branch_controls[target] = op
    for target, op in branch_controls.items():
        need((target in run.get("parked", [])) == (op == "park"),
             f"{target}: parked state disagrees with the latest branch control")
    if count(limit):
        need(reserved_total <= limit, "run allowance exceeded by used or reserved worker jobs")

    def latest(aid):
        while aid in revisions:
            aid = revisions[aid]
        return aid

    def dependency_issues(aid, seen=None):
        seen = set() if seen is None else seen
        if aid in seen or aid not in artifacts:
            return set()
        if artifacts[aid]["kind"] == "report":
            return set()  # Evidence remains historical evidence about its named target.
        seen.add(aid)
        issues = set()
        for parent in artifacts[aid].get("parents", []):
            replacement = latest(parent)
            compatible = any(c.get("artifact") == aid and c.get("compatible_with") == replacement
                             and c.get("status") == "pass" for c in checks)
            if parent != replacement and not compatible:
                issues.add(f"{aid}: dependency {parent} superseded by {replacement}")
            issues.update(dependency_issues(parent, seen))
        return issues

    stale = {aid: sorted(dependency_issues(aid)) for aid in artifacts if dependency_issues(aid)}
    warnings.extend(issue for issues in stale.values() for issue in issues)
    need(run.get("state") in {"in_progress", "ready_for_review"}, "run: invalid state")
    for aid in run.get("parked", []) + run.get("presented", []):
        need(aid in artifacts, f"run: missing listed artifact {aid}")
    if run.get("state") == "ready_for_review":
        presented = run.get("presented", [])
        need(any(artifacts.get(a, {}).get("kind") == requested for a in presented),
             "handoff: requested artifact kind not presented")
        unresolved = []
        for aid in presented:
            if aid not in artifacts:
                continue
            if aid in revisions:
                unresolved.append(f"{aid}: presented version superseded by {latest(aid)}")
            unresolved.extend(stale.get(aid, []))
            for cid, criterion in criteria.items():
                if artifacts[aid]["kind"] not in criterion["applies_to"]:
                    continue
                results = [c for c in checks if c.get("artifact") == aid and c.get("criterion") == cid]
                if not results or results[-1].get("status") != "pass":
                    unresolved.append(f"{aid}: criterion {cid} unresolved")
        if unresolved:
            handoff = run.get("handoff", {})
            need(text(handoff.get("reason")) and bool(handoff.get("unresolved")),
                 "handoff: unresolved findings require a reason and visible unresolved list")
            warnings.extend(unresolved)
    return {"valid": not errors, "errors": errors, "warnings": sorted(set(warnings)),
            "needs_review": stale, "superseded": {a: latest(a) for a in revisions},
            "artifacts": len(artifacts), "actions": len(action_ids),
            "worker_jobs_used": used_total, "worker_jobs_used_or_reserved": reserved_total}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run", type=Path)
    args = parser.parse_args()
    try:
        result = validate(args.run)
    except (ValueError, KeyError, TypeError, AttributeError, OSError) as error:
        result = {"valid": False, "errors": [str(error)], "warnings": []}
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
