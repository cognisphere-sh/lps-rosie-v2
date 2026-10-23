#!/usr/bin/env python3
"""Check a recorded chapter: every beat's footage must cover its narration + 0.3 s,
and every narration beat must be in marks.json (as footage or a card).
Usage (from the video project dir): check-beats.py ch3 [ch4 ...]"""
import json, sys

vo = json.load(open('vo.json'))
narration = {b['id'] for c in json.load(open('narration.json')) for b in c['beats']}
bad = 0
for ch in sys.argv[1:]:
    n = ch.removeprefix('ch')
    m = json.load(open(f'footage/ch{n}/marks.json'))
    beats = [b for b in m['beats'] if b['take']]
    for i, b in enumerate(beats):
        end = next((x['t'] for x in beats[i + 1:] if x['take'] == b['take']), m['takes'][b['take']]['duration'])
        need = vo[b['id']] + 0.3
        if end - b['t'] < need:
            bad += 1
            print(f"{ch} {b['id']}: footage {end - b['t']:.1f} s < narration {need:.1f} s")
    missing = sorted(i for i in narration if i.split('.')[0] == n and i not in {b['id'] for b in m['beats']})
    for i in missing:
        print(f'{ch} {i}: not recorded (renders as a generic card)')
    print(f"{ch}: {len(m['beats'])} beats, {len(m['takes'])} takes", 'OK' if not bad and not missing else '')
sys.exit(1 if bad else 0)
