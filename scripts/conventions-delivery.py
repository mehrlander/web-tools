#!/usr/bin/env python3
"""How each recorded session took delivery of the conventions.

web-tools stopped `@`-importing docs/SURFACING.md and docs/QUALIFIED-WRITING.md
on 2026-09-12, so every session now loads them the way a marketplace consumer
does: the portable plugin's conventions-nudge hook prints a directive at session
start and the session invokes /portable:default. That is a request to a model
rather than a mechanism, so it can be declined, and nothing errors when it is.
This is the instrument that says how often it is taken.

It reads what the session records already hold rather than adding a field:

  import   docs/SURFACING.md appears in the record's startup_context, meaning a
           resolved @-import put it in the session's context. Expected to fall
           to zero for web-tools sessions from 2026-09-12.
  invoke   no such import, and the session called the Skill tool on the
           conventions skill. This is the plugin path working.
  neither  no import and no invocation. The session ran without the conventions,
           which is the failure the number exists to count.

DO NOT USE THE `repos` FIELD TO ASK WHETHER A CHECKOUT WAS PRESENT. Measured
2026-09-12: records whose `repos` omits web-tools still carry
web-tools/CLAUDE.md and web-tools/docs/SURFACING.md in startup_context, so
`repos` records what a session worked in rather than what it had. An earlier
count in this estate read `repos` the wrong way and concluded that 68 sessions
ran without the conventions when they had them by import all along.
startup_context is the field that answers the question, which is why this reads
that one.

THE `calls` LIST IS SAMPLED, so an invocation can be missed and `neither` is an
upper bound. The per-session `tools` count is complete, so a session with zero
Skill calls of any kind is a certain `neither`; those are reported separately as
the floor. Read the two together and do not quote the first alone.

    python3 scripts/conventions-delivery.py <path-to-sessions-dir> [--since YYYY-MM-DD]
"""
import argparse, collections, glob, json, os, sys

CONV = {'web-tools', 'default', 'portable:default', 'portable:web-tools'}
SURFACING = 'docs/SURFACING.md'


def skill_of(call):
    arg = call.get('arg')
    if isinstance(arg, dict):
        return arg.get('skill')
    if isinstance(arg, str):
        try:
            return (json.loads(arg) or {}).get('skill')
        except (ValueError, AttributeError):
            return None
    return None


def classify(rec):
    imported = any(SURFACING in (e.get('path') or '')
                   for e in (rec.get('startup_context') or [])
                   if isinstance(e, dict))
    if imported:
        return 'import'
    invoked = any(isinstance(c, dict) and c.get('name') == 'Skill' and skill_of(c) in CONV
                  for c in (rec.get('calls') or []))
    return 'invoke' if invoked else 'neither'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sessions', help='a sessions/ directory of per-session JSON records')
    ap.add_argument('--since', default='', help='only records on or after this YYYY-MM-DD')
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.sessions, '**', '*.json'), recursive=True))
    counts, no_skill_at_all, with_checkout, rows = collections.Counter(), 0, 0, []
    for f in files:
        try:
            rec = json.load(open(f))
        except (OSError, ValueError):
            continue
        day = rec.get('day') or ''
        if not day or (args.since and day < args.since):
            continue
        # A record predating the startup_context field cannot answer the
        # question either way, so it is left out rather than counted as neither.
        if 'startup_context' not in rec:
            continue
        # The denominator worth seeing beside the split: how many sessions even
        # had the hub checked out. Nearly all of them do, so cutting the import
        # puts nearly every session on the prod rather than a minority.
        if any('web-tools/CLAUDE.md' in (e.get('path') or '')
               for e in (rec.get('startup_context') or []) if isinstance(e, dict)):
            with_checkout += 1
        verdict = classify(rec)
        counts[verdict] += 1
        if verdict == 'neither' and not (rec.get('tools') or {}).get('Skill'):
            no_skill_at_all += 1
        rows.append((day, verdict, os.path.basename(f)))

    total = sum(counts.values())
    if not total:
        print('no records carry startup_context in that range')
        return 0
    print(f'{total} session(s) with a startup_context record'
          + (f' since {args.since}' if args.since else '')
          + f'; {with_checkout} of them had a web-tools checkout')
    for k in ('import', 'invoke', 'neither'):
        print(f'  {counts[k]:4d}  {k}')
    print(f'\n  of the {counts["neither"]} neither, {no_skill_at_all} made no Skill call at all,'
          ' which is the certain floor; the rest may be sampling.')
    for day, verdict, name in rows[-10:]:
        print(f'    {day}  {verdict:8s} {name}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
