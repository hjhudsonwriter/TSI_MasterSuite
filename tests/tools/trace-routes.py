#!/usr/bin/env python3.12
"""One-off helper: traces each Port route overlay into a polyline for the Dock's moving ship.

Run from the repo root:   python3.12 tests/tools/trace-routes.py [out_dir]
It needs Pillow only. For every tools/bastion/assets/ui/routes/<port>.png it
  1. keeps the visible pixels (alpha above 20), then thickens them so the dashes join up,
  2. thins that to a one pixel line (Zhang-Suen),
  3. walks the longest path from the end nearest the Ironbow marker,
  4. simplifies it (Douglas-Peucker) and scales it to the map's own pixels (1494 x 1996).
It prints the result as JavaScript (routePaths for tools/bastion/data/bastion-data.js) and, if out_dir is
given, writes a picture of each path drawn over its overlay so it can be checked by eye.
Hand corrections are kept in HAND below. The traced numbers are pasted into bastion-data.js by hand;
this script does not edit any file in the suite.
"""
import sys, os, glob, math
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ROUTES = os.path.join(ROOT, 'tools/bastion/assets/ui/routes')
MAP = os.path.join(ROOT, 'tools/bastion/assets/ui/clan_trading_locations.png')
IRONBOW = (528, 636)   # the Ironbow marker, in overlay pixels (747 x 998); x2 on the 1494 x 1996 map
SCALE = 2
GROW = 9               # thickening window (odd): joins the dashes
EPS = 3.0              # simplification, overlay pixels
HAND = {}              # port -> list of [x, y] (map pixels) to use instead of the traced line


def thin(img):
    w, h = img.size
    px = img.load()
    P = [[1 if px[x, y] else 0 for x in range(w)] for y in range(h)]
    def nb(x, y):
        return [P[y-1][x], P[y-1][x+1], P[y][x+1], P[y+1][x+1], P[y+1][x], P[y+1][x-1], P[y][x-1], P[y-1][x-1]]
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            kill = []
            for y in range(1, h - 1):
                row = P[y]
                for x in range(1, w - 1):
                    if not row[x]:
                        continue
                    n = nb(x, y)
                    b = sum(n)
                    if b < 2 or b > 6:
                        continue
                    a = sum(1 for i in range(8) if n[i] == 0 and n[(i + 1) % 8] == 1)
                    if a != 1:
                        continue
                    if step == 0:
                        if n[0] * n[2] * n[4] or n[2] * n[4] * n[6]:
                            continue
                    else:
                        if n[0] * n[2] * n[6] or n[0] * n[4] * n[6]:
                            continue
                    kill.append((x, y))
            if kill:
                changed = True
                for x, y in kill:
                    P[y][x] = 0
    return {(x, y) for y in range(h) for x in range(w) if P[y][x]}


def longest_path(pts, start_near):
    start = min(pts, key=lambda p: (p[0] - start_near[0]) ** 2 + (p[1] - start_near[1]) ** 2)
    def bfs(src):
        prev = {src: None}
        dq = deque([src])
        last = src
        while dq:
            c = dq.popleft()
            last = c
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (c[0] + dx, c[1] + dy)
                    if (dx or dy) and q in pts and q not in prev:
                        prev[q] = c
                        dq.append(q)
        return last, prev
    end, prev = bfs(start)
    path = []
    c = end
    while c is not None:
        path.append(c)
        c = prev[c]
    path.reverse()          # start (Ironbow end) -> far end
    return path


def dp(pts, eps):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    imax, dmax = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L
        if d > dmax:
            imax, dmax = i, d
    if dmax > eps:
        return dp(pts[:imax + 1], eps)[:-1] + dp(pts[imax:], eps)
    return [pts[0], pts[-1]]


def trace(path_png):
    im = Image.open(path_png).convert('RGBA')
    mask = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).filter(ImageFilter.MaxFilter(GROW))
    bbox = mask.getbbox()
    crop = mask.crop((bbox[0] - 2, bbox[1] - 2, bbox[2] + 2, bbox[3] + 2)).point(lambda v: 255 if v else 0)
    ox, oy = bbox[0] - 2, bbox[1] - 2
    sk = thin(crop)
    pts = {(x + ox, y + oy) for x, y in sk}
    p = longest_path(pts, IRONBOW)
    s = dp(p, EPS)
    return im, [[x * SCALE, y * SCALE] for x, y in s]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else None
    if out:
        os.makedirs(out, exist_ok=True)
    base = Image.open(MAP).convert('RGB')
    result = {}
    for f in sorted(glob.glob(os.path.join(ROUTES, '*.png'))):
        port = os.path.splitext(os.path.basename(f))[0]
        im, line = trace(f)
        line = HAND.get(port, line)
        result[port] = line
        if out:
            full = base.copy().convert('RGBA')
            ov = im.resize(full.size)
            full.alpha_composite(ov)
            d = ImageDraw.Draw(full)
            d.line([tuple(p) for p in line], fill=(255, 0, 0, 255), width=5)
            for i, p in enumerate(line):
                d.ellipse([p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5], fill=(0, 255, 0, 255) if i else (255, 255, 0, 255))
            full.convert('RGB').resize((747, 998)).save(os.path.join(out, port + '.png'))
    print('routePaths: {')
    keys = sorted(result)
    for i, k in enumerate(keys):
        print("  %s: %s%s" % (k, [tuple(p) for p in result[k]], ',' if i < len(keys) - 1 else ''))
    print('}')
    for k in keys:
        sys.stderr.write('%s: %d points\n' % (k, len(result[k])))


main()
