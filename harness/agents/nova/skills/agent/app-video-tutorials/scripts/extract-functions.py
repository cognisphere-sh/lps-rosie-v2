#!/usr/bin/env python3
"""Latest CREATE FUNCTION text per function name from the migrations, in order.
Usage: extract-functions.py <migrations-dir> <name,name,...> <out.sql>
Prints the names it could not find (fetch those from the live catalog)."""
import re, sys, glob, os
mig = sorted(glob.glob(sys.argv[1] + '/[0-9]*.sql'))
head = re.compile(r'create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?(\w+)"?\s*\(', re.I)
defs = {}
for f in mig:
    s = open(f).read()
    for m in head.finditer(s):
        i = m.end()
        t = re.compile(r'\$([A-Za-z_]*)\$').search(s, i)
        if not t: continue
        close = s.find(t.group(0), t.end())
        end = s.find(';', close + len(t.group(0)))
        defs[m.group(1).lower()] = (os.path.basename(f), s[m.start():end + 1])
want = sys.argv[2].split(',')
out = open(sys.argv[3], 'w')
missing = []
for n in want:
    if n in defs:
        out.write(f'-- {n} from {defs[n][0]}\n' + re.sub(r'^create\s+function', 'CREATE OR REPLACE FUNCTION', defs[n][1], flags=re.I) + '\n\n')
    else:
        missing.append(n)
print('found', len(want) - len(missing), 'missing', ','.join(missing))
