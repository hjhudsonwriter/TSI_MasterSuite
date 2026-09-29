"""Trace a rendered heraldic drawing into the Crest's four recolourable layers.
   python3 trace.py <picture.png> <out.json> '<settings as JSON>'
   Needs Python 3 with Pillow, numpy and scipy, and the potrace program.
   The settings are explained in README.md."""
import sys, json, subprocess, re, os, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage

png, out, cfg = sys.argv[1], sys.argv[2], json.loads(sys.argv[3] if len(sys.argv) > 3 else '{}')
im = Image.open(png).convert('RGBA')
if cfg.get('crop'):
    im = im.crop(tuple(cfg['crop']))
size = cfg.get('size', 1600)
if max(im.size) > size:
    k = size / max(im.size)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
a = np.asarray(im).astype(np.float32)
rgb, al = a[..., :3], a[..., 3] / 255.0
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b
mx, mn = rgb.max(-1), rgb.min(-1)
sat = (mx - mn) / np.maximum(mx, 1)

opaque = al > 0.5
# fill pinholes in the silhouette (tiny transparent specks inside the drawing)
holes = ~opaque
lab, nlab = ndimage.label(holes)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
areas = ndimage.sum(np.ones_like(lab), lab, range(nlab + 1))
minhole = cfg.get('minhole', 60)
filled = np.zeros_like(opaque)
specks = np.zeros_like(opaque)     # tiny holes in the linework: filled as line
for i in range(1, nlab + 1):
    if i not in border and areas[i] < minhole:
        if areas[i] < cfg.get('holemin', 60):
            specks |= lab == i
        else:
            filled |= lab == i
opaque |= filled | specks

dark = specks | opaque & ~filled & (((lum < cfg.get('dark', 110)) & (sat < 0.45)) | (mx < 60))
red = opaque & ~filled & ~dark & (r > 120) & (r - np.maximum(g, b) > 70)
white = opaque & ~filled & ~dark & ~red & (lum > 222) & (sat < 0.12)
rest = opaque & ~filled & ~dark & ~red
# the drawing's main colour: the commonest colour left
q = (rgb[rest] // 24).astype(np.int32)
key = q[:, 0] * 10000 + q[:, 1] * 100 + q[:, 2]
vals, counts = np.unique(key, return_counts=True)
top = vals[np.argmax(counts)]
main = np.array([top // 10000, (top // 100) % 100, top % 100]) * 24 + 12
main_is_white = main.min() > 200
if main_is_white:
    white = np.zeros_like(white)
import colorsys
def hue(c):
    return colorsys.rgb_to_hsv(*(np.asarray(c, dtype=float) / 255))[0] * 360
hsv_h = np.zeros(lum.shape)
cmax = mx; cmin = mn; d = np.maximum(cmax - cmin, 1e-6)
hsv_h = np.where(cmax == r, ((g - b) / d) % 6, np.where(cmax == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
mh = hue(main)
dh = np.abs(hsv_h - mh); dh = np.minimum(dh, 360 - dh)
other = rest & ~white & (sat > 0.35) & (mx > 60) & ((dh > 30) | main_is_white)
lab2, n2 = ndimage.label(other)
if n2:
    ar = ndimage.sum(np.ones_like(lab2), lab2, range(n2 + 1))
    other &= (ar[lab2] >= 40)
roles = {'A': red.copy(), 'W': white.copy(), 'L': dark.copy()}
orole = cfg.get('other', 'A')
if orole in roles:
    roles[orole] |= other
# holes filled in (a crown's jewels) can take the accent colour
if cfg.get('holes') == 'A':
    roles['A'] |= ndimage.binary_dilation(filled, iterations=2) & opaque
# small colour areas bleed under the lines so no fringe of body colour shows
grow = cfg.get('grow', 2)
for k in ('A', 'W'):
    if roles[k].any():
        roles[k] = ndimage.binary_dilation(roles[k], iterations=grow) & opaque
for k, v in cfg.get('force', {}).items():   # {"A": [[x0,y0,x1,y1], ...]} regions (in traced px) forced to a role
    for (x0, y0, x1, y1) in v:
        sub = np.zeros_like(opaque); sub[y0:y1, x0:x1] = True
        roles[k] |= sub & opaque & ~dark

# parts picked by hand for the accent colour: each seed [fx, fy] (fractions of
# the picture) fills the enclosed area it sits in, like a paint bucket
seeds = cfg.get('seeds', [])
if seeds:
    close = cfg.get('close', 2)
    barrier = ndimage.binary_dilation(dark, iterations=close) if close else dark
    if cfg.get('cuts'):
        from PIL import ImageDraw
        Hc, Wc = opaque.shape
        cim = Image.new('L', (Wc, Hc), 0); cd = ImageDraw.Draw(cim)
        for c in cfg['cuts']:
            cd.line([(c[0] * Wc, c[1] * Hc), (c[2] * Wc, c[3] * Hc)], fill=255, width=4)
        barrier = barrier | (np.asarray(cim) > 0)
    lab3, n3 = ndimage.label(opaque & ~barrier)
    total = opaque.sum()
    acc = np.zeros_like(opaque)
    Hh, Ww = opaque.shape
    for sd in seeds:
        fx, fy = sd[0], sd[1]
        x, y = min(Ww - 1, int(fx * Ww)), min(Hh - 1, int(fy * Hh))
        l = lab3[y, x]
        if l == 0:
            win = lab3[max(0, y - 6):y + 7, max(0, x - 6):x + 7]
            nz = win[win > 0]
            l = np.bincount(nz).argmax() if nz.size else 0
        if l == 0:
            print('  seed misses', sd); continue
        region = lab3 == l
        frac = region.sum() / total
        lim = sd[2] if len(sd) > 2 else cfg.get('maxfrac', 0.03)
        if frac > lim:
            print('  seed leaks', sd, round(frac, 4)); continue
        acc |= region
    acc = ndimage.binary_dilation(acc, iterations=close + grow) & opaque
    roles['A'] |= acc
    print('  seeded accent', round(acc.sum() / total, 4))

# areas outlined by hand (fractions): everything inside that isn't linework
if cfg.get('polys'):
    from PIL import ImageDraw
    Hp, Wp = opaque.shape
    pim = Image.new('L', (Wp, Hp), 0); pd = ImageDraw.Draw(pim)
    vote = cfg.get('vote', False)
    for poly in cfg['polys']:
        pd.polygon([(x * Wp, y * Hp) for x, y in poly], fill=255)
    inside = np.asarray(pim) > 0
    if not vote:
        pm = inside & opaque & ~dark
        roles['A'] |= ndimage.binary_dilation(pm, iterations=grow) & opaque & inside
    else:
        # whole enclosed areas that lie mostly inside the outline; an area that
        # runs on into the body is cut at the outline
        barrier = ndimage.binary_dilation(dark, iterations=2)
        lab4, n4 = ndimage.label(opaque & ~barrier)
        tot = ndimage.sum(np.ones_like(lab4), lab4, range(n4 + 1))
        ins = ndimage.sum(inside, lab4, range(n4 + 1))
        f = ins / np.maximum(tot, 1)
        whole = (f > 0.6); whole[0] = False
        part = (f > 0.05) & ~whole & (tot > 0.01 * opaque.sum()); part[0] = False
        pm = whole[lab4] | (part[lab4] & inside)
        roles['A'] |= ndimage.binary_dilation(pm, iterations=2 + grow) & opaque
# dark areas outlined by hand (a gateway drawn in black) take the accent colour instead
if cfg.get('darkpolys'):
    from PIL import ImageDraw
    Hq, Wq = opaque.shape
    qim = Image.new('L', (Wq, Hq), 0); qd = ImageDraw.Draw(qim)
    for poly in cfg['darkpolys']:
        qd.polygon([(x * Wq, y * Hq) for x, y in poly], fill=255)
    qin = np.asarray(qim) > 0
    roles['A'] |= qin & dark
    roles['L'] &= ~(qin & dark)
    dark = dark & ~qin
if cfg.get('debug'):
    dbg = np.zeros(opaque.shape + (3,), np.uint8); dbg[:] = (120, 150, 190)
    dbg[opaque] = (235, 225, 200); dbg[roles['A']] = (220, 30, 30); dbg[roles['W']] = (255, 255, 255); dbg[dark] = (20, 20, 20)
    Image.fromarray(dbg).resize((opaque.shape[1] * 900 // max(opaque.shape), opaque.shape[0] * 900 // max(opaque.shape))).save(cfg['debug'])
ys, xs = np.nonzero(opaque)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
bw, bh = x1 - x0, y1 - y0
S = 1000.0 / max(bw, bh)
flip = cfg.get('flip', False)

def fmt(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    if s in ('-0', ''): s = '0'
    if s.startswith('0.'): s = s[1:]
    elif s.startswith('-0.'): s = '-' + s[2:]
    return s

def join(nums):
    out = ''
    for i, v in enumerate(nums):
        s = fmt(v)
        if i and not s.startswith('-') and not (s.startswith('.') and '.' in out.split(' ')[-1].split('-')[-1] and False):
            out += ' '
        out += s
    return out

def trace(mask):
    if not mask.any():
        return ''
    with tempfile.TemporaryDirectory() as td:
        pbm = os.path.join(td, 'm.pbm'); svg = os.path.join(td, 'm.svg')
        Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).convert('1').save(pbm)
        subprocess.run(['potrace', pbm, '-s', '--flat', '-t', str(cfg.get('turd', 6)), '-a', str(cfg.get('alpha', 1.0)),
                        '-O', str(cfg.get('opt', 0.35)), '-o', svg], check=True)
        text = open(svg).read()
    m = re.search(r'translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+),([-\d.]+)\)', text)
    TX, TY, SX, SY = map(float, m.groups())
    ds = re.findall(r'<path d="([^"]+)"', text)
    toks = re.findall(r'[MmCcLlZz]|-?[\d.]+(?:e-?\d+)?', ' '.join(ds))
    def P(x, y):
        px, py = TX + SX * x, TY + SY * y
        X, Y = (px - x0) * S, (py - y0) * S
        if flip: X = bw * S - X
        return X, Y
    out = []; i = 0; cur = (0.0, 0.0); start = (0.0, 0.0); cmd = None
    rc = (0.0, 0.0)          # rounded current point, in output units
    def rnd(p): return (round(p[0], 1), round(p[1], 1))
    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t; i += 1
            if cmd in 'Zz':
                out.append('z'); cur = start
                rc = rnd(P(*start))
                continue
            continue
        if cmd in 'Mm':
            x, y = float(toks[i]), float(toks[i + 1]); i += 2
            cur = (x, y) if cmd == 'M' else (cur[0] + x, cur[1] + y)
            start = cur
            p = rnd(P(*cur)); out.append('M' + join(p)); rc = p
            cmd = 'l' if cmd == 'm' else 'L'
        elif cmd in 'Cc':
            v = [float(x) for x in toks[i:i + 6]]; i += 6
            if cmd == 'c':
                pts = [(cur[0] + v[0], cur[1] + v[1]), (cur[0] + v[2], cur[1] + v[3]), (cur[0] + v[4], cur[1] + v[5])]
            else:
                pts = [(v[0], v[1]), (v[2], v[3]), (v[4], v[5])]
            cur = pts[2]
            q = [rnd(P(*pp)) for pp in pts]
            out.append('c' + join([q[0][0] - rc[0], q[0][1] - rc[1], q[1][0] - rc[0], q[1][1] - rc[1], q[2][0] - rc[0], q[2][1] - rc[1]]))
            rc = q[2]
        elif cmd in 'Ll':
            v = [float(x) for x in toks[i:i + 2]]; i += 2
            cur = (cur[0] + v[0], cur[1] + v[1]) if cmd == 'l' else (v[0], v[1])
            q = rnd(P(*cur))
            out.append('l' + join([q[0] - rc[0], q[1] - rc[1]]))
            rc = q
        else:
            raise SystemExit('unexpected ' + t)
    return ''.join(out)

rec = {'id': cfg.get('id', os.path.basename(png)), 'box': [0, 0, float(round(bw * S, 1)), float(round(bh * S, 1))],
       'body': trace(opaque), 'accent': trace(roles['A']), 'white': trace(roles['W']), 'lines': trace(roles['L'])}
rec['bytes'] = sum(len(rec[k]) for k in ('body', 'accent', 'white', 'lines'))
rec['main'] = [int(v) for v in main]
json.dump(rec, open(out, 'w'))
print(rec['id'], rec['box'], 'bytes', rec['bytes'], {k: len(rec[k]) for k in ('body', 'accent', 'white', 'lines')}, 'main', rec['main'])
