import math, sys
W, H = 1000, 700
A = 34            # wave height
LAM = 250         # wavelength
T = 120           # bar thickness
N = 4             # bars
GAP = 34          # gap between bars
X0, X1 = 40, 960
def curve(y0, phase, dy=0.0):
    pts = []
    n = 240
    for i in range(n + 1):
        x = X0 + (X1 - X0) * i / n
        y = y0 + dy + A * math.sin(2 * math.pi * (x - X0) / LAM + phase)
        pts.append((x, y))
    return pts
def taper(u): return max(0.0, math.sin(math.pi * u)) ** 0.45
def tcurve(y0, phase, frac, side):
    # the bar's edge at frac (0 top .. 1 bottom) of its thickness, thinning to a point at both ends
    pts = []
    n = 260
    for i in range(n + 1):
        u = i / n
        x = X0 + (X1 - X0) * u
        t = taper(u)
        yc = y0 + T / 2 + A * math.sin(2 * math.pi * (x - X0) / LAM + phase)
        y = yc + (frac - 0.5) * T * t
        pts.append((x, y))
    return pts
def d(pts): return 'M' + ' L'.join('%.1f %.1f' % p for p in pts)
out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H)]
for k in range(N):
    y0 = 60 + k * (T + GAP)
    ph = 0.0
    top = tcurve(y0, ph, 0.0, -1); bot = tcurve(y0, ph, 1.0, 1)
    shape = top + bot[::-1]
    fill = '#d82a2a' if k % 2 == 1 else '#f0f0f0'
    out.append('<path d="%s Z" fill="%s" stroke="#111" stroke-width="15" stroke-linejoin="round"/>' % (d(shape), fill))
    # engraved shading along the lower part of each bar
    for j, off in enumerate((T * 0.62, T * 0.80)):
        dash = '110 36 70 52 150 40 90 60' if j == 0 else '60 70 120 44 80 80'
        out.append('<path d="%s" fill="none" stroke="#111" stroke-width="%d" stroke-linecap="round" stroke-dasharray="%s"/>' % (d(tcurve(y0, 0, off / T, 1)[10:-10]), 7 if j == 0 else 5, dash))
    # a light line near the top edge, like a highlight cut
    out.append('<path d="%s" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round" stroke-dasharray="140 60 40 90"/>' % d(tcurve(y0, 0, 0.24, 1)[14:-14]))
out.append('</svg>')
open("waves/waves.svg", "w").write('\n'.join(out))
