"""Put two copies of a traced sigil in saltire (crossed), points upward.
   python3 compose.py <in.json> <out.json> <id> <degrees>"""
import sys, json, re, math
src, out, sid, deg = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
r = json.load(open(src))
TOK = re.compile(r'[MmCcLlZz]|-?(?:\d+\.?\d*|\.\d+)')

def parse(d):
    """my traced paths: M x y, then relative c / l, z -> list of subpaths of absolute segments"""
    toks = TOK.findall(d); i = 0; subs = []; cur = None; cmd = None
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t; i += 1
            if cmd in 'zZ': cur['closed'] = True
            continue
        if cmd == 'M':
            p = (float(toks[i]), float(toks[i + 1])); i += 2
            cur = {'start': p, 'segs': [], 'closed': False}; subs.append(cur); pos = p; cmd = 'l'
        elif cmd == 'c':
            v = [float(x) for x in toks[i:i + 6]]; i += 6
            pts = [(pos[0] + v[0], pos[1] + v[1]), (pos[0] + v[2], pos[1] + v[3]), (pos[0] + v[4], pos[1] + v[5])]
            cur['segs'].append(('c', pts)); pos = pts[2]
        elif cmd == 'l':
            v = [float(x) for x in toks[i:i + 2]]; i += 2
            pos = (pos[0] + v[0], pos[1] + v[1]); cur['segs'].append(('l', [pos]))
        else:
            raise SystemExit('unexpected ' + cmd)
    return subs

def fmt(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    if s in ('-0', ''): s = '0'
    if s.startswith('0.'): s = s[1:]
    elif s.startswith('-0.'): s = '-' + s[2:]
    return s
def join(nums):
    return ''.join((' ' if i and not fmt(v).startswith('-') else '') + fmt(v) for i, v in enumerate(nums))

def emit(subs, f):
    out = []
    for s in subs:
        rc = tuple(round(v, 1) for v in f(s['start'])); out.append('M' + join(rc))
        for kind, pts in s['segs']:
            q = [tuple(round(v, 1) for v in f(p)) for p in pts]
            nums = []
            for p in q: nums += [p[0] - rc[0], p[1] - rc[1]]
            out.append(kind + join(nums)); rc = q[-1]
        if s['closed']: out.append('z')
    return ''.join(out)

W, H = r['box'][2], r['box'][3]
cx, cy = W / 2, H / 2
def rot(a):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return lambda p: (cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c)
layers = ('body', 'accent', 'white', 'lines')
parsed = {k: parse(r[k]) for k in layers}
# bounds of both copies, from every point
pts = []
for a in (deg, -deg):
    f = rot(a)
    for s in parsed['body']:
        pts.append(f(s['start']))
        for _, ps in s['segs']: pts += [f(p) for p in ps]
x0 = min(p[0] for p in pts); y0 = min(p[1] for p in pts); x1 = max(p[0] for p in pts); y1 = max(p[1] for p in pts)
S = 1000 / max(x1 - x0, y1 - y0)
def place(f):
    return lambda p: ((f(p)[0] - x0) * S, (f(p)[1] - y0) * S)
# each sword keeps its own layers together, so the upper one fully covers the lower one
rec = {'id': sid, 'box': [0, 0, round((x1 - x0) * S, 1), round((y1 - y0) * S, 1)], 'copies': 2}
for k in layers:
    rec[k] = [emit(parsed[k], place(rot(a))) if parsed[k] else '' for a in (deg, -deg)]
rec['bytes'] = sum(len(x) for k in layers for x in rec[k])
json.dump(rec, open(out, 'w'))
print(sid, rec['box'], rec['bytes'])
