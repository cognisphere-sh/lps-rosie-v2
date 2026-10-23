# script.md (Part 2) -> narration.json: chapters, beat ids, narration text, captions.
import re, json
s = open('script.md').read()
chapters = [{'n': int(m.group(1)), 'title': m.group(2), 'beats': []}
            for m in re.finditer(r'^### Chapter (\d+)\. (.+?) \(', s, re.M)]
cur = None
for line in s.splitlines():
    m = re.match(r'^### Chapter (\d+)\.', line)
    if m: cur = chapters[int(m.group(1)) - 1]; continue
    if line.startswith('## Part 3'): cur = None
    if not cur: continue
    m = re.match(r'^\*\*(\d+\.\d+)\*\* "(.+)" \(~', line)
    if m: cur['beats'].append({'id': m.group(1), 'text': m.group(2), 'caption': None}); continue
    m = re.match(r'^- Caption: "(.+)"', line)
    if m and cur['beats'] and cur['beats'][-1]['caption'] is None: cur['beats'][-1]['caption'] = m.group(1)
json.dump(chapters, open('narration.json', 'w'), indent=1, ensure_ascii=False)
