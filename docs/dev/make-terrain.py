"""Where the rivers and the coast are on the Explorer's 10 maps (7 October 2026).

Harry's choice: T2 The Ambush Sign ("take them at the ford") only happens
when the party is near a river, and a road fight near the sea is fought on
the cove map. The Explorer can't look at its map pictures while it runs
(browsers block that for double-clicked files), so this script looks at them
once, here, and writes what it finds to tools/explorer/data/terrain-data.js.

Run from the repo root (needs Python 3 with Pillow, NumPy and SciPy):
    python3 docs/dev/make-terrain.py
Same pictures in, same file out.

How it works:
- Water is found by its colour (the maps' teal and blue), at half size.
- Broad water that reaches the edge of the picture (or is very large) is the
  sea; broad water inside the land is a lake; long thin water is a river.
- FIXES below correct what colour alone gets wrong, checked by eye against
  the pictures.
- Each map becomes a grid of COLS x ROWS squares. A square is near a river
  or near the sea if one is within NEAR_HEXES hexes (6 miles each, at the
  Explorer's usual hex size) of its centre. Two hexes (12 miles), because
  the pins of port towns sit up to 1.7 hexes from open water.
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC = os.path.join('tools', 'explorer', 'assets', 'maps')
OUT = os.path.join('tools', 'explorer', 'data', 'terrain-data.js')
W, H = 1024, 768            # analysis size; every map picture is 2048 x 1536 (4:3)
COLS, ROWS = 64, 48         # the grid written to the data file (16 x 16 analysis pixels a square)
BOARD_W, HEX_R = 1440, 38   # the Explorer's board width and usual hex size (tools/explorer/rules.js)
NEAR_HEXES = 2              # the port pins sit 1 to 1.7 hexes from open water, so 2 hexes (12 miles)
EDGE = 24                   # analysis pixels from the picture's edge that still count as reaching it
NEAR_PX = NEAR_HEXES * HEX_R * 3 ** 0.5 * W / BOARD_W   # NEAR_HEXES hexes across, in analysis pixels

# Corrections, checked by eye: (x0, y0, x1, y1) in analysis pixels, and what the water found there really is
# ('sea', 'river', 'lake', or 'land' for a picture that only looks like water).
FIXES = {
    # Midland has no coast: the River Rook runs off the bottom edge, and the wide gorge in the south-west is a river too.
    'midland_province': [((0, 0, W, H), 'river'),
                         ((290, 650, 360, 745), 'land')],   # Midland's coat of arms, not water
    # The top of the Northern Province's coat of arms, which sits on the sea.
    'northern_province_west': [((30, 590, 125, 640), 'sea')],
    # The River Split's mouth at the bottom-left corner.
    'southern_province_west': [((0, 640, 150, H), 'river')],
}

CHARS = {'sea': '~', 'river': '-', 'lake': 'o'}


def hsv(a):
    a = a.astype(np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1)
    d = mx - a.min(-1) + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, d / (mx + 1e-6), mx


def classify(path, fixes):
    im = Image.open(path).convert('RGB').resize((W, H), Image.BILINEAR)
    h, s, v = hsv(np.asarray(im))
    water = (h > 175) & (h < 225) & (s > 0.25) & (v > 0.12)
    water = ndi.binary_closing(ndi.binary_opening(water, iterations=1), iterations=3)
    broad = ndi.binary_opening(water, structure=np.ones((3, 3)), iterations=6)
    lab, n = ndi.label(broad)
    sea = np.zeros_like(water)
    lake = np.zeros_like(water)
    for i in range(1, n + 1):
        comp = lab == i
        area = comp.sum()
        m = EDGE  # the pictures have a dark frame, so "reaches the edge" means within EDGE pixels of it
        touches = comp[:m].any() or comp[-m:].any() or comp[:, :m].any() or comp[:, -m:].any()
        if (touches and area > 0.0005 * W * H) or area > 0.05 * W * H:
            sea |= comp
        elif area > 0.0015 * W * H:
            lake |= comp
    sea = ndi.binary_fill_holes(sea | (water & ndi.binary_dilation(sea, iterations=8))) & ~lake
    sea = ndi.binary_closing(sea, iterations=4)
    thin = water & ~ndi.binary_dilation(sea | lake, iterations=4)
    lab, n = ndi.label(thin)
    river = np.zeros_like(water)
    for i in range(1, n + 1):
        comp = lab == i
        ys, xs = np.nonzero(comp)
        if comp.sum() >= 80 and np.hypot(xs.max() - xs.min(), ys.max() - ys.min()) >= 70:
            river |= comp
    for (x0, y0, x1, y1), kind in fixes:
        box = np.zeros_like(water)
        box[y0:y1, x0:x1] = True
        here = box & (sea | lake | river)
        sea &= ~here
        lake &= ~here
        river &= ~here
        if kind != 'land':
            {'sea': sea, 'lake': lake, 'river': river}[kind][...] |= here
    return im, sea, river, lake


def grid(sea, river, lake):
    d_sea = ndi.distance_transform_edt(~sea) if sea.any() else np.full(sea.shape, 1e9)
    d_river = ndi.distance_transform_edt(~river) if river.any() else np.full(sea.shape, 1e9)
    rows = []
    for r in range(ROWS):
        line = ''
        for c in range(COLS):
            y = int((r + 0.5) * H / ROWS)
            x = int((c + 0.5) * W / COLS)
            if sea[y, x]:
                ch = '~'
            elif river[y, x]:
                ch = '-'
            elif lake[y, x]:
                ch = 'o'
            else:
                near_c = d_sea[y, x] <= NEAR_PX
                near_r = d_river[y, x] <= NEAR_PX
                ch = 'b' if near_c and near_r else 'c' if near_c else 'r' if near_r else '.'
            line += ch
        rows.append(line)
    return rows


def main():
    maps = {}
    for f in sorted(os.listdir(SRC)):
        if not f.endswith('.jpg'):
            continue
        mid = f[:-4]
        _, sea, river, lake = classify(os.path.join(SRC, f), FIXES.get(mid, []))
        maps[mid] = grid(sea, river, lake)
        print(mid, 'sea %.0f%%' % (100 * sea.mean()), 'river %.1f%%' % (100 * river.mean()), 'lake %.1f%%' % (100 * lake.mean()))
    out = []
    out.append('/* Scarlett Isles Explorer: where the rivers and the coast are on each map')
    out.append('   (7 October 2026). Made by docs/dev/make-terrain.py from the map')
    out.append('   pictures; to change it, change the script (its FIXES) and run it again,')
    out.append('   rather than editing this file by hand.')
    out.append('')
    out.append('   Each map is a grid of %d x %d squares over its picture, one text row per' % (COLS, ROWS))
    out.append('   grid row, top to bottom. A hero at (x, y) on the picture (0 to 1 across')
    out.append('   and down, as the Explorer stores them) is in square')
    out.append('   (floor(x * %d), floor(y * %d)).' % (COLS, ROWS))
    out.append('     ~  the sea           -  a river          o  a lake')
    out.append('     c  land near the sea r  land near a river b  land near both')
    out.append('     .  other land')
    out.append('   "Near" means within %d hexes (%d miles at the usual hex size) of the square\'s centre.' % (NEAR_HEXES, 6 * NEAR_HEXES))
    out.append('   Used for T2 The Ambush Sign (only near a river) and for fights near the sea')
    out.append('   (fights-data.js). An uploaded map has no grid here. */')
    out.append('window.TSI_DATA = window.TSI_DATA || {};')
    out.append('')
    out.append('window.TSI_DATA.terrain = {')
    out.append('  cols: %d,' % COLS)
    out.append('  rows: %d,' % ROWS)
    out.append('  maps: {')
    names = sorted(maps)
    for i, mid in enumerate(names):
        out.append('    %s: [' % mid)
        rows = maps[mid]
        for j, row in enumerate(rows):
            out.append("      '%s'%s" % (row, ',' if j < len(rows) - 1 else ''))
        out.append('    ]%s' % (',' if i < len(names) - 1 else ''))
    out.append('  }')
    out.append('};')
    with open(OUT, 'w') as fh:
        fh.write('\n'.join(out) + '\n')
    print('wrote', OUT)


if __name__ == '__main__':
    main()
