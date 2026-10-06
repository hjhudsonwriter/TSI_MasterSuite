"""Stand-in battle maps for the Explorer's fights (7 October 2026).

These are simple top-down maps drawn by code, so every fight has a map until
Harry swaps in real art. Each is 1800 x 1200 pixels: a 30 x 20 grid of
60-pixel squares. The grid itself isn't drawn on the picture; the Battlemap
draws its own.

Run from the repo root (needs Python 3 with Pillow and NumPy):
    python3 docs/dev/make-battlemaps.py
It rewrites the pictures in tools/encounter/assets/battlemaps/. The same seed
gives the same pictures every time.

Layouts (column, row of the 30 x 20 grid) must match the start zones in
tools/explorer/data/fights-data.js.
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join('tools', 'encounter', 'assets', 'battlemaps')
COLS, ROWS, CELL = 30, 20, 60
W, H = COLS * CELL, ROWS * CELL

# Colours taken by eye from the Explorer's province maps.
REGIONS = {
    'northern': dict(grass=(92, 104, 54), grass2=(126, 126, 66), dirt=(116, 94, 62), tree='pine', tree_c=(34, 60, 36), rock=(112, 110, 102), snow=0.0, flowers=None, density=1.0),
    'midland': dict(grass=(100, 124, 56), grass2=(140, 140, 70), dirt=(136, 108, 70), tree='oak', tree_c=(54, 88, 38), rock=(120, 116, 104), snow=0.0, flowers=(214, 196, 92), density=0.8),
    'eastern': dict(grass=(108, 120, 60), grass2=(146, 138, 72), dirt=(130, 104, 68), tree='mix', tree_c=(44, 74, 38), rock=(116, 112, 100), snow=0.0, flowers=(200, 200, 210), density=0.9),
    'southern': dict(grass=(146, 128, 68), grass2=(170, 146, 80), dirt=(150, 102, 64), tree='mix', tree_c=(66, 82, 40), rock=(128, 96, 80), snow=0.0, flowers=(196, 90, 60), density=0.6),
    'western': dict(grass=(150, 136, 76), grass2=(176, 156, 92), dirt=(158, 122, 80), tree='oak', tree_c=(70, 92, 44), rock=(132, 118, 100), snow=0.0, flowers=(210, 180, 80), density=0.55),
    'north-isle': dict(grass=(94, 102, 86), grass2=(120, 122, 104), dirt=(108, 98, 84), tree='pine', tree_c=(40, 62, 50), rock=(118, 120, 122), snow=0.22, flowers=(150, 110, 150), density=0.5),
    'east-isle': dict(grass=(116, 104, 76), grass2=(140, 124, 88), dirt=(124, 100, 76), tree='pine', tree_c=(52, 70, 46), rock=(122, 102, 86), snow=0.0, flowers=None, density=0.45),
}
SEA = (34, 92, 106)
SEA_DEEP = (22, 64, 82)
SHALLOW = (74, 130, 132)


def cell(c, r):
    """The centre of grid square (c, r) in pixels."""
    return ((c + 0.5) * CELL, (r + 0.5) * CELL)


def noise(rng, scales=((6, 0.5), (14, 0.3), (40, 0.2))):
    """Smooth random values 0..1 over the picture (a few octaves of value noise)."""
    total = np.zeros((H, W), np.float32)
    for n, weight in scales:
        small = rng.random((max(2, n * H // W), n)).astype(np.float32)
        img = Image.fromarray((small * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        total += np.asarray(img, np.float32) / 255.0 * weight
    total -= total.min()
    total /= max(1e-6, total.max())
    return total


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return np.asarray(a, np.float32) * (1 - t) + np.asarray(b, np.float32) * t


def ground(rng, pal):
    n = noise(rng)
    fine = noise(rng, ((80, 0.6), (200, 0.4)))
    base = mix(pal['grass'], pal['grass2'], n * 1.1 - 0.1)
    base *= (0.9 + 0.2 * fine)[..., None]
    if pal['snow']:
        s = noise(rng, ((5, 0.6), (18, 0.4)))
        snow_mask = np.clip((s - (1 - pal['snow'])) * 6, 0, 1)
        base = base * (1 - snow_mask[..., None]) + np.array([226, 230, 232], np.float32) * snow_mask[..., None]
    return base


def paint(base, mask, colour, texture=None, rng=None, soft=6):
    """Lay a colour over the picture where mask (an L image) is white."""
    if soft:
        mask = mask.filter(ImageFilter.GaussianBlur(soft))
    m = np.asarray(mask, np.float32)[..., None] / 255.0
    col = np.asarray(colour, np.float32)
    if texture is not None:
        col = col * (0.85 + 0.3 * texture[..., None])
    return base * (1 - m) + col * m


def polyline_mask(points, width, rough=0, rng=None):
    mask = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(mask)
    pts = [(x + (rng.uniform(-rough, rough) if rough else 0), y + (rng.uniform(-rough, rough) if rough else 0)) for x, y in points]
    d.line(pts, fill=255, width=int(width), joint='curve')
    for x, y in pts:
        d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=255)
    return mask


def smooth_path(points, steps=12):
    """A Catmull-Rom curve through the points, in pixels."""
    out = []
    p = [points[0]] + points + [points[-1]]
    for i in range(1, len(p) - 2):
        for s in range(steps):
            t = s / steps
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p[i][0]) + (-p[i - 1][0] + p[i + 1][0]) * t + (2 * p[i - 1][0] - 5 * p[i][0] + 4 * p[i + 1][0] - p[i + 2][0]) * t2 + (-p[i - 1][0] + 3 * p[i][0] - 3 * p[i + 1][0] + p[i + 2][0]) * t3)
            y = 0.5 * ((2 * p[i][1]) + (-p[i - 1][1] + p[i + 1][1]) * t + (2 * p[i - 1][1] - 5 * p[i][1] + 4 * p[i + 1][1] - p[i + 2][1]) * t2 + (-p[i - 1][1] + 3 * p[i][1] - 3 * p[i + 1][1] + p[i + 2][1]) * t3)
            out.append((x, y))
    out.append(points[-1])
    return out


def road(base, rng, pal, cells, width=2.2):
    pts = smooth_path([cell(c, r) for c, r in cells])
    tex = noise(rng, ((60, 0.5), (160, 0.5)))
    edge = polyline_mask(pts, width * CELL + 26)
    base = paint(base, edge, tuple(int(v * 0.9) for v in pal['dirt']), tex, soft=10)
    core = polyline_mask(pts, width * CELL)
    base = paint(base, core, pal['dirt'], tex, soft=5)
    # wheel ruts
    for off in (-0.45, 0.45):
        rut = []
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            dx, dy = x1 - x0, y1 - y0
            L = math.hypot(dx, dy) or 1
            nx, ny = -dy / L, dx / L
            rut.append((x0 + nx * off * CELL, y0 + ny * off * CELL))
        base = paint(base, polyline_mask(rut, 8), tuple(int(v * 0.78) for v in pal['dirt']), tex, soft=3)
    return base, pts


def water(base, rng, mask, deep_mask=None):
    tex = noise(rng, ((20, 0.5), (70, 0.5)))
    base = paint(base, mask.filter(ImageFilter.MaxFilter(15)), (96, 82, 60), tex, soft=8)   # muddy bank
    base = paint(base, mask, SHALLOW, tex, soft=6)
    if deep_mask is not None:
        base = paint(base, deep_mask, SEA, tex, soft=18)
    return base


def to_image(base):
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB')


# ---------- Things on the ground (drawn on the RGB picture) ----------

def shadow_layer():
    return Image.new('L', (W, H), 0)


def tree(img, sh, rng, x, y, r, pal, kind=None):
    kind = kind or pal['tree']
    if kind == 'mix':
        kind = 'pine' if rng.random() < 0.5 else 'oak'
    ds = ImageDraw.Draw(sh)
    ds.ellipse([x - r + 10, y - r + 14, x + r + 10, y + r + 14], fill=150)
    d = ImageDraw.Draw(img)
    c = pal['tree_c']
    if kind == 'pine':
        for layer, (scale, shade) in enumerate(((1.0, 0.75), (0.72, 0.95), (0.42, 1.15))):
            pts = []
            spikes = 9
            for i in range(spikes * 2):
                a = i * math.pi / spikes + rng.uniform(-0.08, 0.08)
                rr = r * scale * (1.0 if i % 2 == 0 else 0.62)
                pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
            d.polygon(pts, fill=tuple(min(255, int(v * shade)) for v in c))
        if pal['snow'] and rng.random() < 0.7:
            d.ellipse([x - r * 0.25, y - r * 0.3, x + r * 0.15, y + r * 0.05], fill=(225, 230, 232))
    else:
        d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(int(v * 0.7) for v in c))
        for i in range(7):
            a = rng.uniform(0, 2 * math.pi)
            rr = r * rng.uniform(0.25, 0.55)
            bx, by = x + math.cos(a) * r * 0.45, y + math.sin(a) * r * 0.45
            d.ellipse([bx - rr, by - rr, bx + rr, by + rr], fill=tuple(int(v * rng.uniform(0.85, 1.05)) for v in c))
        hr = r * 0.35
        d.ellipse([x - r * 0.45 - hr, y - r * 0.45 - hr, x - r * 0.45 + hr, y - r * 0.45 + hr], fill=tuple(min(255, int(v * 1.25)) for v in c))


def rock(img, sh, rng, x, y, r, pal):
    pts = []
    n = rng.randint(6, 9)
    for i in range(n):
        a = i * 2 * math.pi / n + rng.uniform(-0.25, 0.25)
        rr = r * rng.uniform(0.7, 1.1)
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr * 0.8))
    ImageDraw.Draw(sh).polygon([(px + 7, py + 9) for px, py in pts], fill=170)
    d = ImageDraw.Draw(img)
    col = pal['rock']
    d.polygon(pts, fill=tuple(int(v * 0.8) for v in col), outline=tuple(int(v * 0.5) for v in col))
    top = [(px * 0.7 + x * 0.3 - r * 0.12, py * 0.7 + y * 0.3 - r * 0.15) for px, py in pts]
    d.polygon(top, fill=col)
    if pal['snow'] and rng.random() < 0.5:
        d.polygon([(px * 0.4 + x * 0.6 - r * 0.2, py * 0.4 + y * 0.6 - r * 0.25) for px, py in pts], fill=(224, 228, 232))


def scatter(obj, sh, rng, pal, count, avoid, kind='tree', rmin=26, rmax=46, area=(0, 0, W, H)):
    placed = 0
    tries = 0
    while placed < count and tries < count * 40:
        tries += 1
        x = rng.uniform(area[0], area[2])
        y = rng.uniform(area[1], area[3])
        if avoid(x, y):
            continue
        r = rng.uniform(rmin, rmax)
        if kind == 'tree':
            tree(obj, sh, rng, x, y, r, pal)
        else:
            rock(obj, sh, rng, x, y, r, pal)
        placed += 1


def tufts(img, rng, pal, count, avoid):
    d = ImageDraw.Draw(img)
    for _ in range(count):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        if avoid(x, y):
            continue
        c = tuple(int(v * rng.uniform(0.7, 0.9)) for v in pal['grass'])
        for _ in range(5):
            a = rng.uniform(-2.4, -0.7)
            L = rng.uniform(6, 14)
            d.line([(x, y), (x + math.cos(a) * L, y + math.sin(a) * L)], fill=c, width=2)
        if pal['flowers'] and rng.random() < 0.25:
            d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=pal['flowers'])


def apply_shadow(img, sh, obj=None):
    """Shadows on the ground first, then the things that cast them on top."""
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    dark = Image.new('RGB', (W, H), (12, 14, 8))
    out = Image.composite(dark, img, sh.point(lambda v: int(v * 0.55)))
    if obj is not None:
        out = out.convert('RGBA')
        out.alpha_composite(obj)
        out = out.convert('RGB')
    return out


def layer():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))


def dist_to_path(x, y, pts):
    best = 1e9
    for i in range(0, len(pts) - 1, 2):
        (x0, y0), (x1, y1) = pts[i], pts[min(i + 2, len(pts) - 1)]
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1
        t = max(0, min(1, ((x - x0) * dx + (y - y0) * dy) / L2))
        best = min(best, math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)))
    return best


def campfire(img, x, y):
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([x - 170, y - 170, x + 170, y + 170], fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    warm = Image.new('RGB', (W, H), (255, 170, 80))
    img = Image.composite(warm, img, glow.point(lambda v: int(v * 0.3)))
    d = ImageDraw.Draw(img)
    for i in range(9):
        a = i * 2 * math.pi / 9
        sx, sy = x + math.cos(a) * 30, y + math.sin(a) * 30
        d.ellipse([sx - 9, sy - 8, sx + 9, sy + 8], fill=(104, 100, 94), outline=(60, 58, 54))
    d.ellipse([x - 22, y - 22, x + 22, y + 22], fill=(60, 34, 20))
    d.line([(x - 18, y - 10), (x + 18, y + 10)], fill=(90, 58, 30), width=7)
    d.line([(x - 18, y + 10), (x + 18, y - 10)], fill=(90, 58, 30), width=7)
    d.ellipse([x - 13, y - 13, x + 13, y + 13], fill=(240, 120, 40))
    d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(255, 214, 120))
    return img


def tent(img, sh, x, y, w, h, colour, angle=0):
    ImageDraw.Draw(sh).rectangle([x - w / 2 + 8, y - h / 2 + 10, x + w / 2 + 8, y + h / 2 + 10], fill=170)
    d = ImageDraw.Draw(img)
    d.rectangle([x - w / 2, y - h / 2, x + w / 2, y + h / 2], fill=colour, outline=tuple(int(v * 0.55) for v in colour), width=2)
    d.rectangle([x - w / 2, y - h / 2, x, y + h / 2], fill=tuple(int(v * 0.82) for v in colour))
    d.line([(x, y - h / 2), (x, y + h / 2)], fill=tuple(int(v * 0.5) for v in colour), width=3)


def log(img, sh, x, y, L, angle):
    dx, dy = math.cos(angle) * L / 2, math.sin(angle) * L / 2
    ImageDraw.Draw(sh).line([(x - dx + 6, y - dy + 8), (x + dx + 6, y + dy + 8)], fill=170, width=22)
    d = ImageDraw.Draw(img)
    d.line([(x - dx, y - dy), (x + dx, y + dy)], fill=(98, 68, 40), width=20)
    d.line([(x - dx, y - dy - 4), (x + dx, y + dy - 4)], fill=(126, 90, 54), width=6)
    d.ellipse([x + dx - 10, y + dy - 10, x + dx + 10, y + dy + 10], fill=(170, 130, 84), outline=(90, 62, 36))


def bedroll(img, x, y, colour):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x - 16, y - 34, x + 16, y + 34], radius=12, fill=colour, outline=tuple(int(v * 0.6) for v in colour), width=2)
    d.rectangle([x - 16, y - 34, x + 16, y - 22], fill=tuple(int(v * 0.75) for v in colour))


def crate(img, sh, x, y, s=42):
    ImageDraw.Draw(sh).rectangle([x - s / 2 + 6, y - s / 2 + 8, x + s / 2 + 6, y + s / 2 + 8], fill=170)
    d = ImageDraw.Draw(img)
    d.rectangle([x - s / 2, y - s / 2, x + s / 2, y + s / 2], fill=(150, 110, 64), outline=(80, 56, 30), width=3)
    d.line([(x - s / 2, y - s / 2), (x + s / 2, y + s / 2)], fill=(96, 68, 38), width=3)
    d.line([(x - s / 2, y + s / 2), (x + s / 2, y - s / 2)], fill=(96, 68, 38), width=3)


def lantern(img, x, y):
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([x - 90, y - 90, x + 90, y + 90], fill=140)
    glow = glow.filter(ImageFilter.GaussianBlur(36))
    img = Image.composite(Image.new('RGB', (W, H), (255, 196, 110)), img, glow.point(lambda v: int(v * 0.5)))
    d = ImageDraw.Draw(img)
    d.rectangle([x - 8, y - 10, x + 8, y + 10], fill=(60, 44, 30))
    d.rectangle([x - 5, y - 7, x + 5, y + 7], fill=(255, 220, 140))
    return img


def boat(img, sh, x, y, L=170, wdt=64, angle=0.3):
    ca, sa = math.cos(angle), math.sin(angle)

    def rot(px, py):
        return (x + px * ca - py * sa, y + px * sa + py * ca)
    hull = [rot(-L / 2, 0), rot(-L / 2 + 30, -wdt / 2), rot(L / 2 - 20, -wdt / 2), rot(L / 2, 0), rot(L / 2 - 20, wdt / 2), rot(-L / 2 + 30, wdt / 2)]
    ImageDraw.Draw(sh).polygon([(px + 8, py + 10) for px, py in hull], fill=150)
    d = ImageDraw.Draw(img)
    d.polygon(hull, fill=(110, 76, 44), outline=(60, 40, 22))
    inner = [rot(px * 0.8, py * 0.7) for px, py in [(-L / 2, 0), (-L / 2 + 30, -wdt / 2), (L / 2 - 20, -wdt / 2), (L / 2, 0), (L / 2 - 20, wdt / 2), (-L / 2 + 30, wdt / 2)]]
    inner = [((px - x) + x, (py - y) + y) for px, py in inner]
    d.polygon(inner, fill=(140, 100, 60))
    for k in (-0.25, 0.05, 0.3):
        a, b = rot(L * k, -wdt * 0.32), rot(L * k, wdt * 0.32)
        d.line([a, b], fill=(92, 62, 34), width=6)


def waves(img, rng, area_test, count=260):
    d = ImageDraw.Draw(img)
    for _ in range(count):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        if not area_test(x, y):
            continue
        L = rng.uniform(18, 46)
        d.arc([x - L, y - 6, x + L, y + 6], 200, 340, fill=(150, 196, 200), width=2)


# ---------- The settings ----------

def make_ford(region, seed):
    rng_np = np.random.default_rng(seed)
    rng = random.Random(seed)
    pal = REGIONS[region]
    base = ground(rng_np, pal)
    # The river runs west to east across rows 8 to 12.
    river_pts = smooth_path([(-60, 9.6 * CELL), cell(6, 10.4), cell(13, 9.4), cell(19, 10.6), cell(25, 9.8), (W + 60, 10.2 * CELL)])
    rmask = polyline_mask(river_pts, 4.4 * CELL)
    deep = polyline_mask(river_pts, 2.4 * CELL)
    # The ford: a shallow crossing at columns 13 to 17, where the deep channel stops.
    ford_cut = Image.new('L', (W, H), 0)
    ImageDraw.Draw(ford_cut).rectangle([12.6 * CELL, 0, 17.4 * CELL, H], fill=255)
    deep = Image.fromarray(np.minimum(np.asarray(deep), 255 - np.asarray(ford_cut)))
    base = water(base, rng_np, rmask, deep)
    base, rpts = road(base, rng_np, pal, [(15, 21), (15, 17), (14.6, 13), (15, 10), (15.4, 7), (16, 3), (17, -1)])
    # Put the water back over the road where it crosses, a little lighter: the ford.
    ford = Image.fromarray(np.minimum(np.asarray(rmask), np.asarray(ford_cut)))
    base = paint(base, ford, (96, 146, 142), noise(rng_np, ((40, 1.0),)), soft=10)
    img = to_image(base)
    sh = shadow_layer()
    obj = layer()
    d = ImageDraw.Draw(img)
    for _ in range(46):  # stepping stones across the ford
        x = rng.uniform(13.1, 16.9) * CELL
        y = rng.uniform(8.4, 11.8) * CELL
        rr = rng.uniform(7, 14)
        d.ellipse([x - rr, y - rr * 0.8, x + rr, y + rr * 0.8], fill=(150, 146, 136), outline=(92, 90, 84))
    waves(img, rng, lambda x, y: np.asarray(deep)[int(min(H - 1, y)), int(min(W - 1, x))] > 128, 160)

    def avoid(x, y):
        return dist_to_path(x, y, river_pts) < 2.6 * CELL or dist_to_path(x, y, rpts) < 1.9 * CELL
    tufts(img, rng, pal, 900, avoid)
    # Woods on both banks, thickest at the flanks (where an ambush hides).
    n = int(70 * pal['density']) + 20
    scatter(obj, sh, rng, pal, n // 2, avoid, area=(0, 0, 11 * CELL, H))
    scatter(obj, sh, rng, pal, n // 2, avoid, area=(19 * CELL, 0, W, H))
    scatter(obj, sh, rng, pal, 10, avoid, area=(0, 0, W, H))
    scatter(obj, sh, rng, pal, 14, avoid, kind='rock', rmin=16, rmax=34)
    return apply_shadow(img, sh, obj)


def make_road(region, seed):
    rng_np = np.random.default_rng(seed)
    rng = random.Random(seed)
    pal = REGIONS[region]
    base = ground(rng_np, pal)
    base, rpts = road(base, rng_np, pal, [(-1, 12.5), (5, 12), (11, 10.8), (17, 9.6), (23, 9.2), (31, 7.5)])
    img = to_image(base)
    sh = shadow_layer()
    obj = layer()

    def avoid(x, y):
        return dist_to_path(x, y, rpts) < 1.8 * CELL
    tufts(img, rng, pal, 1000, avoid)
    # A wooded rise to the north, scattered trees and boulders to the south.
    scatter(obj, sh, rng, pal, int(60 * pal['density']) + 16, avoid, area=(0, 0, W, 6.5 * CELL))
    scatter(obj, sh, rng, pal, int(24 * pal['density']) + 8, avoid, area=(0, 13.5 * CELL, W, H))
    scatter(obj, sh, rng, pal, 18, avoid, kind='rock', rmin=18, rmax=40)
    # A fallen tree half across the road ahead.
    log(obj, sh, 19.6 * CELL, 8.6 * CELL, 190, 1.2)
    rock(obj, sh, rng, 21.2 * CELL, 11.4 * CELL, 46, pal)
    rock(obj, sh, rng, 13.4 * CELL, 7.6 * CELL, 40, pal)
    return apply_shadow(img, sh, obj)


def make_camp(region, seed):
    rng_np = np.random.default_rng(seed)
    rng = random.Random(seed)
    pal = REGIONS[region]
    base = ground(rng_np, pal)
    cx, cy = cell(15, 10)
    clearing = Image.new('L', (W, H), 0)
    ImageDraw.Draw(clearing).ellipse([cx - 5.5 * CELL, cy - 4.2 * CELL, cx + 5.5 * CELL, cy + 4.2 * CELL], fill=255)
    base = paint(base, clearing, tuple(int(v * 0.95) for v in pal['dirt']), noise(rng_np, ((50, 0.5), (140, 0.5))), soft=40)
    base, rpts = road(base, rng_np, pal, [(15, 21), (15.5, 16), (15, 13)], width=1.2)
    img = to_image(base)
    sh = shadow_layer()
    obj = layer()

    def avoid(x, y):
        return math.hypot((x - cx) / (6.6 * CELL), (y - cy) / (5.2 * CELL)) < 1 or dist_to_path(x, y, rpts) < 1.1 * CELL
    tufts(img, rng, pal, 900, avoid)
    scatter(obj, sh, rng, pal, int(110 * pal['density']) + 30, avoid)
    scatter(obj, sh, rng, pal, 12, avoid, kind='rock', rmin=16, rmax=34)
    tent(obj, sh, cx - 3.4 * CELL, cy - 2.2 * CELL, 120, 84, (176, 150, 110))
    tent(obj, sh, cx + 3.2 * CELL, cy - 2.4 * CELL, 120, 84, (150, 120, 92))
    bedroll(obj, cx - 2.0 * CELL, cy + 1.6 * CELL, (120, 40, 40))
    bedroll(obj, cx + 2.2 * CELL, cy + 1.4 * CELL, (60, 80, 110))
    bedroll(obj, cx + 0.2 * CELL, cy + 2.6 * CELL, (110, 96, 60))
    log(obj, sh, cx - 1.6 * CELL, cy - 0.6 * CELL, 120, 1.4)
    log(obj, sh, cx + 1.7 * CELL, cy - 0.4 * CELL, 120, 1.8)
    img = campfire(apply_shadow(img, sh, obj), cx, cy)
    return img


def make_cove(region, seed):
    """The cove below Redport: cliff top, a cliff path, a shingle beach and the sea."""
    rng_np = np.random.default_rng(seed)
    rng = random.Random(seed)
    pal = REGIONS[region]
    base = ground(rng_np, pal)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    wob = noise(rng_np, ((8, 0.6), (30, 0.4))) * CELL * 1.2
    cliff_y = 6.0 * CELL + wob
    shore_y = 13.0 * CELL + wob * 0.8
    tex = noise(rng_np, ((60, 0.5), (180, 0.5)))
    shingle = mix((150, 140, 120), (186, 176, 150), tex)
    sea = mix(SHALLOW, SEA_DEEP, np.clip((yy - shore_y) / (5 * CELL), 0, 1))
    t_beach = np.clip((yy - cliff_y) / 40, 0, 1)
    t_sea = np.clip((yy - shore_y) / 30, 0, 1)
    base = base * (1 - t_beach[..., None]) + shingle * t_beach[..., None]
    base = base * (1 - t_sea[..., None]) + sea * t_sea[..., None]
    # The cliff face: a dark band just below the cliff top.
    face = np.clip(1 - np.abs(yy - cliff_y - 30) / 46, 0, 1)
    base = base * (1 - 0.7 * face[..., None]) + np.array(pal['rock'], np.float32) * 0.55 * 0.7 * face[..., None]
    img = to_image(base)
    sh = shadow_layer()
    obj = layer()
    d = ImageDraw.Draw(img)
    # The cliff path, zig-zagging down at the west end.
    path = [cell(3, -1), cell(4, 2), cell(7, 4), cell(4, 6), cell(6, 8)]
    d.line(path, fill=pal['dirt'], width=44, joint='curve')
    waves(img, rng, lambda x, y: y > shore_y[int(min(H - 1, y)), int(min(W - 1, x))] + 20, 320)

    def avoid(x, y):
        return y > cliff_y[int(min(H - 1, y)), int(min(W - 1, x))] - 40 or dist_to_path(x, y, path) < 1.2 * CELL
    tufts(img, rng, pal, 500, avoid)
    scatter(obj, sh, rng, pal, int(30 * pal['density']) + 6, avoid, area=(0, 0, W, 5 * CELL))
    # Rocks along the foot of the cliff and in the surf.
    for _ in range(16):
        x = rng.uniform(0, W)
        rock(obj, sh, rng, x, cliff_y[0, int(min(W - 1, x))] + rng.uniform(40, 90), rng.uniform(18, 36), pal)
    for _ in range(8):
        x = rng.uniform(0, W)
        rock(obj, sh, rng, x, shore_y[0, int(min(W - 1, x))] + rng.uniform(30, 140), rng.uniform(16, 30), pal)
    # The smugglers' crates and lamp, and their boat drawn up on the shingle.
    for c, r in ((16, 9.6), (16.9, 9.7), (16.4, 10.5), (18.4, 10.2), (19.3, 9.8), (13.6, 10.8)):
        crate(obj, sh, c * CELL, r * CELL)
    boat(obj, sh, 22.5 * CELL, shore_y[0, int(22.5 * CELL)] + 30, angle=-0.5)
    img = apply_shadow(img, sh, obj)
    return lantern(img, 17.6 * CELL, 9.0 * CELL)


def make_rocks(region, seed):
    """The rocks below Bleakharbour: moorland, a rocky shore and the sea, with the wreckers' lanterns."""
    rng_np = np.random.default_rng(seed)
    rng = random.Random(seed)
    pal = REGIONS[region]
    base = ground(rng_np, pal)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    wob = noise(rng_np, ((7, 0.6), (26, 0.4))) * CELL * 2.2
    # The shore runs from the top right to the bottom left; the sea is to the south-east.
    line = (xx * 0.55 + yy) - (17 * CELL) - wob
    rocky = mix(np.array(pal['rock']) * 0.9, np.array(pal['rock']) * 1.15, noise(rng_np, ((40, 0.5), (120, 0.5))))
    t_rock = np.clip((line + 2.5 * CELL) / 60, 0, 1)
    t_sea = np.clip((line - 1.5 * CELL) / 40, 0, 1)
    sea = mix(SHALLOW, SEA_DEEP, np.clip((line - 1.5 * CELL) / (6 * CELL), 0, 1))
    base = base * (1 - t_rock[..., None]) + rocky * t_rock[..., None]
    base = base * (1 - t_sea[..., None]) + sea * t_sea[..., None]
    img = to_image(base)
    sh = shadow_layer()
    obj = layer()
    lv = line

    def at(x, y):
        return lv[int(min(H - 1, max(0, y))), int(min(W - 1, max(0, x)))]
    waves(img, rng, lambda x, y: at(x, y) > 2.2 * CELL, 380)

    def avoid(x, y):
        return at(x, y) > -2.6 * CELL
    tufts(img, rng, pal, 700, avoid)
    scatter(obj, sh, rng, pal, int(24 * pal['density']) + 4, avoid, area=(0, 0, W, 9 * CELL))
    # Boulders on the shore, and reefs out in the water.
    for _ in range(60):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        v = at(x, y)
        if -2.4 * CELL < v < 1.8 * CELL:
            rock(obj, sh, rng, x, y, rng.uniform(20, 46), pal)
        elif 2.4 * CELL < v < 6 * CELL and rng.random() < 0.3:
            rock(obj, sh, rng, x, y, rng.uniform(16, 30), pal)
    # The path down from the camp.
    ImageDraw.Draw(img).line([cell(2, -1), cell(4, 3), cell(8, 6), cell(12, 9)], fill=pal['dirt'], width=36, joint='curve')
    img = apply_shadow(img, sh, obj)
    for c, r in ((18, 8.2), (12.5, 11.4)):
        img = lantern(img, c * CELL, r * CELL)
    return img


SETTINGS = {
    'ford': (make_ford, ['northern', 'midland', 'eastern', 'southern', 'western', 'north-isle', 'east-isle']),
    'road': (make_road, ['northern', 'midland', 'eastern', 'southern', 'western', 'north-isle', 'east-isle']),
    'camp': (make_camp, ['northern', 'midland', 'eastern', 'southern', 'western', 'north-isle', 'east-isle']),
    'cove': (make_cove, ['western']),
    'rocks': (make_rocks, ['north-isle']),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    seed = 1000
    for setting, (fn, regions) in SETTINGS.items():
        for region in regions:
            seed += 1
            img = fn(region, seed)
            path = os.path.join(OUT, '%s-%s.jpg' % (setting, region))
            img.save(path, quality=84, optimize=True, progressive=True)
            print(path, os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    main()
