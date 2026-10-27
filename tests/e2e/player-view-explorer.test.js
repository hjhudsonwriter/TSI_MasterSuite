/* The Explorer's Player View (26 October 2026; docs/PLAYER-VIEW-PLAN.md, phase P4), from a double-clicked index.html with
   the internet off: the DM's Explorer opens the players' window (player.html?view=explorer), which shows the map filling
   the screen under one slim row (Day, Daily Travel, Gold), follows everything the DM does, writes nothing, and has no
   side panels. The Explorer has no pan or zoom of its own (it always shows the whole map, fitted and centred), so "the
   same view" is checked as: every hero sits at the same fraction of the map picture in both windows, whatever the
   window's shape.
   Run with:  node tests/e2e/player-view-explorer.test.js */
'use strict';

const H = require('./helpers');
const path = require('path');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const PLAYER = H.fileUrl('player.html') + '?view=explorer';
const UPLOAD = path.join(H.ROOT, 'tools/arenas/assets/maps/middlemount_lions_crown.png');
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const change = (page, fn) => page.evaluate(src => TSI.explorer.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const rect = (page, sel) => page.$eval(sel, n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; });
const bare = (page, sel) => page.$eval(sel, n => n.innerText.replace(/\s+/g, ' ').trim());
const pillText = (pv, test) => pv.$eval('[data-test=' + test + '] .tsi-xpv-pill__n', n => n.textContent);
/* Where a hero's centre is, as a fraction of the map picture, in a window. */
async function fraction(page, mapSel, tokSel) {
  return page.evaluate(([m, t]) => {
    const a = document.querySelector(m).getBoundingClientRect(), b = document.querySelector(t).getBoundingClientRect();
    return { x: (b.x + b.width / 2 - a.x) / a.width, y: (b.y + b.height / 2 - a.y) / a.height };
  }, [mapSel, tokSel]);
}
const dmFrac = (page, id) => fraction(page, '.tsi-exp-map', '.tsi-exp-token[data-id=' + id + ']');
const pvFrac = (pv, id) => fraction(pv, '.tsi-xpv-map', '.tsi-xpv-token[data-id=' + id + ']');
function near(a, b, msg) { assert(Math.abs(a.x - b.x) < 0.004 && Math.abs(a.y - b.y) < 0.004, (msg || 'same place') + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)); }

async function hexVector(page, dq, dr) {
  return page.evaluate(([dq, dr]) => {
    const s = TSI.explorer.debug.state(), v = TSI.explorer.debug.view();
    const r = TSI.explorer.rules.hexSize(s.grid) * v.fit;
    return { x: r * Math.sqrt(3) * (dq + dr / 2), y: r * 1.5 * dr };
  }, [dq, dr]);
}
async function dragHex(page, id, dq, dr) {
  const from = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), id);
  const by = await hexVector(page, dq, dr);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(from.x + by.x * i / 20, from.y + by.y * i / 20);
  await page.mouse.up();
  await page.waitForTimeout(150);
}
async function dismissModals(page) {
  for (let k = 0; k < 10 && await page.$('.tsi-modal'); k++) {
    const b = await page.$('.tsi-modal .tsi-modal__foot button');
    if (!b) break;
    await page.waitForTimeout(400);
    await b.click().catch(() => {});
    await page.waitForTimeout(150);
  }
}
async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  await pv.waitForFunction(() => [...document.images].every(i => i.complete));
  return pv;
}

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The Explorer Player View at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name, { acceptDownloads: true });
    await context.setOffline(true);
    await context.addInitScript(() => {
      if (!/view=explorer/.test(location.search) || !/player\.html/.test(location.pathname)) return;
      window.__writes = [];
      window.__maps = 0;
      window.addEventListener('message', e => { if (e.data && e.data.type === 'map') window.__maps++; });
      const log = what => window.__writes.push(what);
      try {
        const set = Storage.prototype.setItem, rem = Storage.prototype.removeItem, clr = Storage.prototype.clear;
        Storage.prototype.setItem = function (k) { log('setItem ' + k); return set.apply(this, arguments); };
        Storage.prototype.removeItem = function (k) { log('removeItem ' + k); return rem.apply(this, arguments); };
        Storage.prototype.clear = function () { log('clear'); return clr.apply(this, arguments); };
        if (window.indexedDB) { const open = indexedDB.open; indexedDB.open = function (n) { log('indexedDB ' + n); return open.apply(this, arguments); }; }
        const d = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
        if (d && d.set) Object.defineProperty(document, 'cookie', { get() { return d.get.call(document); }, set(v) { log('cookie'); d.set.call(document, v); } });
      } catch (e) { log('spy failed: ' + e.message); }
    });
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.selectOption('[data-test=map-select]', 'the_east_isle');
    await page.click('[data-test=load]');
    await page.waitForTimeout(300);
    await change(page, s => { s.snap.enabled = true; });
    await page.waitForTimeout(200);

    await check('the DM view has an Open Player View button, with a status that says Not open', async () => {
      equal(await page.textContent('[data-test=open-player-view]'), 'Open Player View');
      equal(await page.textContent('[data-test=player-view-status]'), 'Not open');
    });

    const pv = await openPlayer(page, size);
    const hero = (await st(page)).tokens[0].id;

    await check('the DM status says Connected', async () => {
      await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected');
    });

    await check('the map fills the window under a slim row: the whole picture showing, centred, nothing scrolling', async () => {
      const row = await rect(pv, '[data-test=pv-row]');
      const stage = await rect(pv, '[data-test=pv-stage]');
      assert(row.y < 2 && row.h < size.height * 0.07 && row.w >= size.width - 2, 'a slim row along the top: ' + JSON.stringify(row));
      assert(stage.y >= row.bottom - 1 && Math.abs(stage.bottom - size.height) < 2 && stage.w >= size.width - 2, 'the map takes the rest: ' + JSON.stringify(stage));
      const m = await rect(pv, '.tsi-xpv-map');
      const ratio = 4 / 3;
      const want = Math.min(stage.w, stage.h * ratio);
      assert(Math.abs(m.w - want) < 2 && Math.abs(m.h - m.w / ratio) < 2, 'as large as it can be, in shape: ' + JSON.stringify(m));
      assert(Math.abs(m.x + m.w / 2 - size.width / 2) < 2 && Math.abs(m.y + m.h / 2 - (stage.y + stage.h / 2)) < 2, 'centred');
      equal(await pv.$eval('.tsi-xpv-map', i => i.naturalWidth > 0), true, 'the picture loaded');
      equal(await pv.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true, 'no scrolling');
      await H.shot(pv, 'pv-explorer-' + name);
    });

    await check('no side panels, top bar, inputs or buttons but the map icon, its Close and Full screen; clicks do nothing', async () => {
      equal(await pv.$$eval('input, select, textarea, a[href]', n => n.length), 0);
      equal(await pv.$$eval('button', bs => bs.map(b => b.dataset.test)), ['pv-mapbtn', 'pv-map-close', 'pv-fullscreen']);
      equal(await pv.$('.tsi-topbar, .tsi-exp-panel, .tsi-exp-side, .tsi-modal, [data-test=journal], [data-test=bags-list], [data-test=effects-list]'), null);
      equal(await pv.$eval('[data-test=pv-stage]', n => getComputedStyle(n).pointerEvents), 'none');
      await pv.click('.tsi-xpv-token', { force: true });
      await pv.click('[data-test=pv-row]', { force: true });
      equal(await page.evaluate(() => !!document.querySelector('.tsi-modal')), false);
    });

    await check('the slim row: Day, Daily Travel (one figure out of the limit) and Gold', async () => {
      equal((await bare(pv, '[data-test=pv-row]')).toLowerCase(), 'day 1 daily travel 0 / 30 gold 0');
      equal(await pv.getAttribute('[data-test=pv-mapbtn]', 'aria-label'), 'Open the map of the Scarlett Isles');
      const ys = await pv.$$eval('.tsi-xpv-pill', ps => ps.map(p => Math.round(p.getBoundingClientRect().top)));
      assert(new Set(ys).size === 1, 'one row');
    });

    await check('the heroes sit at the same fraction of the picture as in the DM view, and the hex grid is drawn', async () => {
      const toks = (await st(page)).tokens;
      for (const t of toks) near(await dmFrac(page, t.id), await pvFrac(pv, t.id), t.name);
      equal(await pv.$$eval('.tsi-xpv-token', n => n.length), toks.length);
      equal(await pv.$eval('[data-test=pv-grid]', c => { const g = c.getContext('2d'); return g.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0); }), true, 'grid lines on the canvas');
    });

    await check('the town pins show, as on the DM map', async () => {
      const dm = await page.$$eval('.tsi-exp-pin', n => n.map(x => x.getAttribute('aria-label')).sort());
      const pl = await pv.$$eval('.tsi-xpv-pin', n => n.map(x => x.getAttribute('aria-label')).sort());
      assert(dm.length > 0, 'there are pins');
      equal(pl, dm);
    });

    await check('dragging the party in the DM view moves the markers and Daily Travel at once', async () => {
      await dragHex(page, hero, 2, 0);
      await dismissModals(page);
      const mi = (await st(page)).tokens.map(t => t.milesUsed);
      assert(Math.max(...mi) > 0, 'the party travelled: ' + mi);
      await pv.waitForFunction(m => document.querySelector('[data-test=pv-travel] .tsi-xpv-pill__n').textContent === m + ' / 30', Math.max(...mi));
      for (const t of (await st(page)).tokens) near(await dmFrac(page, t.id), await pvFrac(pv, t.id), t.name);
    });

    await check('the Day and the Gold follow the DM', async () => {
      await change(page, s => { s.travel.day = 4; s.journey.gold = 135; s.tokens.forEach(t => { t.milesUsed = 18; }); });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-day] .tsi-xpv-pill__n').textContent === '4' && document.querySelector('[data-test=pv-gold] .tsi-xpv-pill__n').textContent === '135');
      equal(await pillText(pv, 'pv-travel'), '18 / 30');
    });

    await check('the grid follows the DM: size, opacity and off', async () => {
      const count = () => pv.$eval('[data-test=pv-grid]', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, max = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) { n++; if (d[i] > max) max = d[i]; } return { n, max }; });
      const before = await count();
      await change(page, s => { s.grid.opacity = 1; });
      await pv.waitForFunction(m => { const c = document.querySelector('[data-test=pv-grid]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let max = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > max) max = d[i]; return max > m; }, before.max);
      await change(page, s => { s.grid.enabled = false; });
      await pv.waitForFunction(() => { const c = document.querySelector('[data-test=pv-grid]'); return !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0); });
      await change(page, s => { s.grid.enabled = true; s.grid.opacity = 0.35; });
      await pv.waitForFunction(() => { const c = document.querySelector('[data-test=pv-grid]'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0); });
    });

    await check('fog of war shows as the DM has it: dark, with the uncovered hexes cut out', async () => {
      await change(page, s => { const R = TSI.explorer.rules; s.fog.enabled = true; R.reveal(s, { q: 5, r: 5 }, 2); });
      const probe = () => pv.$eval('[data-test=pv-fog]', (c) => {
        const R = TSI.explorer.rules; const dpr = window.devicePixelRatio || 1;
        const grid = { r: 38, offsetX: 0, offsetY: 0 };
        const a = (x, y) => c.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data[3];
        return [a(2, 2), a(c.clientWidth - 3, c.clientHeight - 3)];
      });
      await pv.waitForFunction(() => { const c = document.querySelector('[data-test=pv-fog]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let dark = 0, clear = 0; for (let i = 3; i < d.length; i += 4 * 97) d[i] > 200 ? dark++ : clear++; return dark > 0 && clear > 0; });
      const dm = await page.$eval('.tsi-exp-canvas--fog', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 200) dark++; return dark; });
      const pl = await pv.$eval('[data-test=pv-fog]', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 200) dark++; return dark; });
      assert(dm > 0 && pl > 0, 'both dark somewhere');
      await probe();
      await change(page, s => { s.fog.enabled = false; });
      await pv.waitForFunction(() => { const c = document.querySelector('[data-test=pv-fog]'); return !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0); });
    });

    await check('opening a town pin in the DM view opens the same card for the players; closing, or opening another, follows', async () => {
      equal(await pv.isVisible('[data-test=pv-pin]'), false);
      await page.evaluate(() => TSI.explorer.debug.openPin('swyth'));
      await pv.waitForSelector('[data-test=pv-pin]');
      equal(await bare(pv, '[data-test=pv-pin-title]'), 'Swyth');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-pin] img').complete && document.querySelector('[data-test=pv-pin] img').naturalWidth > 0);
      const c = await rect(pv, '[data-test=pv-pin]');
      assert(c.x >= 0 && c.right <= size.width && c.bottom <= size.height, 'the card fits: ' + JSON.stringify(c));
      equal(await pv.$$eval('[data-test=pv-pin] button, [data-test=pv-pin] input, [data-test=pv-pin] a', n => n.length), 0, 'read only');
      equal(await pv.$eval('[data-test=pv-pin-host]', n => getComputedStyle(n).pointerEvents), 'none');
      await H.shot(pv, 'pv-explorer-pin-' + name);
      await H.clickModal(page, 'Close');
      await pv.waitForSelector('[data-test=pv-pin]', { state: 'detached' });
      await page.waitForTimeout(450);
      await page.evaluate(() => TSI.explorer.debug.openPin('greymyr'));
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-pin-title]') && document.querySelector('[data-test=pv-pin-title]').textContent === 'Greymyr');
      await H.clickModal(page, 'Close');
      await pv.waitForSelector('[data-test=pv-pin]', { state: 'detached' });
    });

    const dimNow = () => pv.$eval('[data-test=pv-dim]', n => Number(getComputedStyle(n).opacity));
    await check('Make Camp fades the players\' map to black and back in; the slim row stays', async () => {
      await page.evaluate(() => { Math.random = () => 0.999; });
      await page.click('[data-test=camp]');
      await pv.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-test=pv-dim]')).opacity) > 0.9, null, { timeout: 4000 });
      assert(await pv.isVisible('[data-test=pv-row]'), 'the row stays');
      const eventOpen = await page.waitForSelector('.tsi-modal.tsi-exp-journey', { timeout: 1500 }).then(() => true, () => false);
      if (eventOpen) {
        await pv.waitForTimeout(4500);
        const d = await dimNow();
        assert(d > 0.85 && d < 0.97, 'held very dark but not black: ' + d);
        await H.clickModal(page, 'Close');
      } else {
        await pv.waitForTimeout(4000);
      }
      await pv.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-test=pv-dim]')).opacity) < 0.05, null, { timeout: 6000 });
      await dismissModals(page);
    });

    await check('a campfire event holds the map very dark until the DM closes it, then fades back in', async () => {
      await page.evaluate(() => TSI.explorer.debug.startEvent('c1', 'camp'));
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await pv.waitForFunction(() => { const o = Number(getComputedStyle(document.querySelector('[data-test=pv-dim]')).opacity); return o > 0.9 && o < 0.95; }, null, { timeout: 4000 });
      await pv.waitForTimeout(2500);
      const d = await dimNow();
      assert(d > 0.9 && d < 0.95, 'still held: ' + d);
      await page.waitForTimeout(400);
      await page.click('[data-test=skip-event]');
      await dismissModals(page);
      await pv.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-test=pv-dim]')).opacity) < 0.05, null, { timeout: 4000 });
    });

    await check('with reduced motion the fade is a quick cross-fade', async () => {
      await pv.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => TSI.explorer.debug.startEvent('c2', 'camp'));
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await pv.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-test=pv-dim]')).opacity) > 0.85, null, { timeout: 900 });
      await H.clickModal(page, 'Close');
      await pv.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-test=pv-dim]')).opacity) < 0.05, null, { timeout: 900 });
      await pv.emulateMedia({ reducedMotion: 'no-preference' });
    });

    const zoomState = () => page.evaluate(() => TSI.explorer.debug.zoomState());
    const stageRect = () => rect(page, '.tsi-exp-stage');
    /* A spot on the DM's map with nothing on it (no hero, pin, button or notice). */
    const emptySpot = () => page.evaluate(() => {
      const r = document.querySelector('.tsi-exp-stage').getBoundingClientRect();
      for (const fy of [0.9, 0.5, 0.7, 0.3, 0.1]) for (const fx of [0.9, 0.7, 0.5, 0.3, 0.1]) {
        const x = r.x + r.width * fx, y = r.y + r.height * fy;
        const e = document.elementFromPoint(x, y);
        if (e && document.querySelector('.tsi-exp-stage').contains(e) && !e.closest('.tsi-exp-token, .tsi-exp-pin, button, .tsi-notice')) return { x, y };
      }
      return null;
    });
    const settle = () => pv.waitForTimeout(500);
    await check('zooming the DM map with the wheel: anchored at the pointer, the players\' map follows, heroes line up', async () => {
      await dismissModals(page);
      const hero = (await st(page)).tokens[0].id;
      const at = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), hero);
      const before = await dmFrac(page, hero);
      await page.mouse.move(at.x, at.y - 60);
      await page.mouse.wheel(0, -500);
      await page.waitForFunction(() => TSI.explorer.debug.zoomState().zoom > 1.5);
      await settle();
      const z = (await zoomState()).zoom;
      assert(z > 1.5 && z <= 6, 'zoomed: ' + z);
      near(await dmFrac(page, hero), await pvFrac(pv, hero), 'hero, zoomed');
      near(before, await dmFrac(page, hero), 'the map did not slide: the hero is the same place on the picture');
      const m = await rect(page, '.tsi-exp-map'), sg = await stageRect();
      assert(m.w > sg.w * 0.99 && m.h > sg.h * 0.99, 'the map is bigger than the area');
      const pm = await rect(pv, '.tsi-xpv-map'), ps = await rect(pv, '[data-test=pv-stage]');
      assert(pm.w * pm.h > ps.w * ps.h * 0.9, 'and bigger than the players\' area too');
      await H.shot(pv, 'pv-explorer-zoom-' + name);
    });

    await check('dragging the empty map pans it (only after a few pixels); a plain click does not; the players follow; the map can\'t leave the area', async () => {
      const hero = (await st(page)).tokens[0].id;
      const sg = await stageRect();
      const was = await zoomState();
      const sp = await emptySpot();
      assert(sp, 'an empty spot');
      await page.mouse.click(sp.x, sp.y);
      equal(await zoomState(), was, 'a plain click moves nothing');
      await page.mouse.move(sp.x, sp.y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(sp.x - i * 12, sp.y - i * 7);
      await page.mouse.up();
      const after = await zoomState();
      assert(Math.abs(after.cx - was.cx) > 0.01 || Math.abs(after.cy - was.cy) > 0.01, 'the view moved: ' + JSON.stringify([was, after]));
      await settle();
      near(await dmFrac(page, hero), await pvFrac(pv, hero), 'hero, panned');
      /* Way past the edge: the map stays on the area. */
      const sp2 = await emptySpot();
      await page.mouse.move(sp2.x, sp2.y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(sp2.x + i * 400, sp2.y + i * 300);
      await page.mouse.up();
      const m = await rect(page, '.tsi-exp-map');
      assert(m.x <= sg.x + 1 && m.y <= sg.y + 1 && m.right >= sg.right - 1 && m.bottom >= sg.bottom - 1, 'the map still covers the area: ' + JSON.stringify([m, sg]));
      await settle();
      const pm = await rect(pv, '.tsi-xpv-map');
      assert(pm.w > 100, 'players still show it');
    });

    await check('at zoom, dragging a hero still moves it, spends miles, and shows on the players\' map and Daily Travel', async () => {
      await change(page, s => { s.snap.enabled = true; s.tokens.forEach(t => { t.milesUsed = 0; }); });
      const hero = (await st(page)).tokens[0].id;
      const at = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), hero);
      const sg = await stageRect();
      assert(at.x > sg.x && at.x < sg.right && at.y > sg.y && at.y < sg.bottom, 'the hero is in view: ' + JSON.stringify([at, sg]));
      const was = await zoomState();
      await dragHex(page, hero, 1, 0);
      await dismissModals(page);
      assert(Math.max(...(await st(page)).tokens.map(t => t.milesUsed)) > 0, 'miles were spent');
      equal(await zoomState(), was, 'dragging a hero does not pan');
      await settle();
      near(await dmFrac(page, hero), await pvFrac(pv, hero), 'hero, moved at zoom');
      await pv.waitForFunction(() => /^[1-9]/.test(document.querySelector('[data-test=pv-travel] .tsi-xpv-pill__n').textContent));
    });

    await check('the grid lines up with the heroes at zoom: a hero snapped to a hex sits in the middle of a drawn hex', async () => {
      const ok = await page.evaluate(() => {
        const R = TSI.explorer.rules, d = TSI.explorer.debug, s = d.state();
        const t = s.tokens[0];
        const a = R.tokenHex(s, d.board(), t);
        const c = R.axialToPixel(s.grid, a.q, a.r);
        const scr = d.toScreen(c.x, c.y);
        const spot = d.tokenScreen(t.id);
        return Math.hypot(scr.x - spot.x, scr.y - spot.y) < 14 + 10;
      });
      assert(ok, 'the hero is on its hex centre');
    });

    await check('the + and − buttons, the keys + − 0, and Fit work; the players\' map follows to the whole map', async () => {
      await page.click('[data-test=zoom-fit]');
      equal((await zoomState()).zoom, 1);
      await page.click('[data-test=zoom-in]');
      assert(Math.abs((await zoomState()).zoom - 1.4) < 0.01, 'zoom in');
      await page.click('[data-test=zoom-out]');
      equal((await zoomState()).zoom, 1);
      await page.click('.tsi-exp-stage', { position: { x: 5, y: 5 } });
      await page.keyboard.press('+');
      assert((await zoomState()).zoom > 1.3, 'key +');
      await page.keyboard.press('-');
      equal((await zoomState()).zoom, 1);
      await page.keyboard.press('+'); await page.keyboard.press('+');
      await page.keyboard.press('0');
      equal((await zoomState()).zoom, 1);
      await settle();
      const hero = (await st(page)).tokens[0].id;
      near(await dmFrac(page, hero), await pvFrac(pv, hero), 'hero, fitted again');
      const pm = await rect(pv, '.tsi-xpv-map'), ps = await rect(pv, '[data-test=pv-stage]');
      assert(pm.x >= ps.x - 1 && pm.right <= ps.right + 1 && pm.bottom <= ps.bottom + 1 && pm.y >= ps.y - 1, 'the whole map in view at 1x');
      const base = Math.min(ps.w, ps.h * 4 / 3);
      assert(Math.abs(pm.w - base) < 2, 'exactly as before at 1x: ' + pm.w + ' vs ' + base);
    });

    await check('with reduced motion the players\' map jumps to the new view at once', async () => {
      await pv.emulateMedia({ reducedMotion: 'reduce' });
      await page.click('[data-test=zoom-in]');
      await page.click('[data-test=zoom-in]');
      const hero = (await st(page)).tokens[0].id;
      await pv.waitForTimeout(80);
      const pm = await rect(pv, '.tsi-xpv-map'), ps = await rect(pv, '[data-test=pv-stage]');
      assert(pm.w > ps.w * 1.05 || pm.h > ps.h * 1.05, 'already zoomed after 80 ms');
      await pv.emulateMedia({ reducedMotion: 'no-preference' });
      await page.click('[data-test=zoom-fit]');
      await settle();
    });

    await check('the map icon sits at the right of the slim row; clicking it opens the Scarlett Isles panel, which fills its width and scrolls', async () => {
      const row = await rect(pv, '[data-test=pv-row]'), ic = await rect(pv, '[data-test=pv-mapbtn]');
      assert(ic.right > size.width - 60 && ic.y >= row.y && ic.bottom <= row.bottom, 'in the row, at the right: ' + JSON.stringify(ic));
      equal(await pv.isVisible('[data-test=pv-map-panel]'), false);
      await pv.click('[data-test=pv-mapbtn]');
      await pv.waitForSelector('[data-test=pv-map-panel]', { state: 'visible' });
      await pv.waitForFunction(() => { const i = document.querySelector('[data-test=pv-map-picture]'); return i.complete && i.naturalWidth === 747 && i.naturalHeight === 998; });
      const sc = await rect(pv, '[data-test=pv-map-scroll]'), img = await rect(pv, '[data-test=pv-map-picture]');
      assert(sc.y >= row.bottom - 1 && sc.bottom <= size.height + 1, 'below the row, on screen');
      assert(img.w > sc.w - 16 && img.h > sc.h, 'the picture fills the width and is taller than the panel: ' + JSON.stringify([sc, img]));
      equal(await pv.$eval('[data-test=pv-map-scroll]', n => getComputedStyle(n).overflowY), 'auto');
      equal(await bare(pv, '.tsi-xpv-atlas__title'), 'The Scarlett Isles');
      await H.shot(pv, 'pv-explorer-atlas-' + name);
      await pv.hover('[data-test=pv-map-scroll]');
      await pv.mouse.wheel(0, 400);
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-map-scroll]').scrollTop > 100);
      await pv.keyboard.press('End');
      await pv.waitForFunction(() => { const n = document.querySelector('[data-test=pv-map-scroll]'); return n.scrollTop + n.clientHeight >= n.scrollHeight - 2; });
      await pv.keyboard.press('Home');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-map-scroll]').scrollTop === 0);
      const box = await rect(pv, '[data-test=pv-map-scroll]');
      await pv.mouse.move(box.x + box.w / 2, box.y + 100);
      await pv.mouse.down();
      await pv.mouse.move(box.x + box.w / 2, box.y + 20, { steps: 5 });
      await pv.mouse.up();
      assert((await pv.$eval('[data-test=pv-map-scroll]', n => n.scrollTop)) > 40, 'dragging scrolls');
      await pv.keyboard.press('Home');
    });

    await check('while it is open the live map underneath still follows the DM (day, gold, heroes), and the night dim covers the panel', async () => {
      await change(page, s => { s.travel.day = 7; s.journey.gold = 222; });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-day] .tsi-xpv-pill__n').textContent === '7' && document.querySelector('[data-test=pv-gold] .tsi-xpv-pill__n').textContent === '222');
      equal(await pv.isVisible('[data-test=pv-map-panel]'), true, 'the panel stays');
      await dismissModals(page);
      await page.evaluate(() => TSI.explorer.debug.startEvent('c1', 'camp'));
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await pv.waitForFunction(() => { const o = Number(getComputedStyle(document.querySelector('[data-test=pv-dim]')).opacity); return o > 0.9 && o < 0.95; }, null, { timeout: 4000 });
      const top = await pv.evaluate(() => { const r = document.querySelector('[data-test=pv-map-scroll]').getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!e.closest('[data-test=pv-map-panel]'); });
      const z = await pv.evaluate(() => [Number(getComputedStyle(document.querySelector('[data-test=pv-dim]')).zIndex), Number(getComputedStyle(document.querySelector('[data-test=pv-map-panel]')).zIndex)]);
      assert(z[0] > z[1], 'the dim is above the panel: ' + z + ' ' + top);
      await page.click('[data-test=skip-event]');
      await dismissModals(page);
      await pv.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-test=pv-dim]')).opacity) < 0.05, null, { timeout: 5000 });
    });

    await check('closing: the X, Escape, and the icon again', async () => {
      await pv.click('[data-test=pv-map-close]');
      equal(await pv.isVisible('[data-test=pv-map-panel]'), false);
      await pv.click('[data-test=pv-mapbtn]');
      equal(await pv.isVisible('[data-test=pv-map-panel]'), true);
      await pv.keyboard.press('Escape');
      equal(await pv.isVisible('[data-test=pv-map-panel]'), false);
      await pv.focus('[data-test=pv-mapbtn]');
      await pv.keyboard.press('Enter');
      equal(await pv.isVisible('[data-test=pv-map-panel]'), true, 'keyboard operable');
      await pv.click('[data-test=pv-mapbtn]');
      equal(await pv.isVisible('[data-test=pv-map-panel]'), false);
    });

    await check('the DM\'s button shows and hides the panel on the players\' window, and overrides a local click on its next change', async () => {
      equal(await page.textContent('[data-test=atlas-toggle]'), 'Show Scarlett Isles map to players');
      await page.click('[data-test=atlas-toggle]');
      equal(await page.textContent('[data-test=atlas-toggle]'), 'Hide Scarlett Isles map from players');
      await pv.waitForSelector('[data-test=pv-map-panel]', { state: 'visible' });
      await pv.click('[data-test=pv-map-close]');
      equal(await pv.isVisible('[data-test=pv-map-panel]'), false, 'a local close stands until the DM changes it');
      await page.click('[data-test=atlas-toggle]');
      await page.click('[data-test=atlas-toggle]');
      await pv.waitForSelector('[data-test=pv-map-panel]', { state: 'visible' });
      await page.click('[data-test=atlas-toggle]');
      await pv.waitForSelector('[data-test=pv-map-panel]', { state: 'hidden' });
      equal(await page.textContent('[data-test=atlas-toggle]'), 'Show Scarlett Isles map to players');
    });

    await check('the same region at any window shape: resizing either window keeps every hero at the same place on the picture', async () => {
      const t = (await st(page)).tokens[0].id;
      await pv.setViewportSize({ width: 900, height: 900 });
      await pv.waitForTimeout(300);
      near(await dmFrac(page, t), await pvFrac(pv, t), 'players, square window');
      let m = await rect(pv, '.tsi-xpv-map');
      assert(m.x >= -1 && m.right <= 901 && m.bottom <= 901, 'the whole picture in view');
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(400);
      near(await dmFrac(page, t), await pvFrac(pv, t), 'DM window smaller');
      await page.setViewportSize(context.__size || size);
      await pv.setViewportSize(size);
      await page.waitForTimeout(300);
    });

    await check('an uploaded map is sent once and kept; later changes send only small snapshots', async () => {
      await page.setInputFiles('[data-test=upload-input]', UPLOAD);
      await page.waitForFunction(() => TSI.explorer.debug.state().mapUploadKey);
      await pv.waitForFunction(() => /^data:image/.test(document.querySelector('.tsi-xpv-map').getAttribute('src') || '') && document.querySelector('.tsi-xpv-map').naturalWidth > 0, null, { timeout: 15000 });
      const board = await page.evaluate(() => TSI.explorer.debug.board());
      const m = await rect(pv, '.tsi-xpv-map');
      assert(Math.abs(m.w / m.h - board.w / board.h) < 0.01, 'the upload\'s own shape');
      await change(page, s => { s.travel.day = 6; });
      await change(page, s => { s.journey.gold = 1; });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-gold] .tsi-xpv-pill__n').textContent === '1');
      equal(await pv.evaluate(() => window.__maps), 1, 'the picture crossed once');
      for (const t of (await st(page)).tokens) near(await dmFrac(page, t.id), await pvFrac(pv, t.id), t.name);
    });

    await check('reloading the players\' window brings the map back', async () => {
      await pv.reload();
      await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
      await pv.waitForFunction(() => document.querySelector('.tsi-xpv-map').naturalWidth > 0, null, { timeout: 15000 });
      equal(await pillText(pv, 'pv-gold'), '1');
    });

    await check('the players\' window wrote nothing to storage, and nothing went online', async () => {
      equal(await pv.evaluate(() => window.__writes), []);
    });

    await check('the DM Explorer\'s own save is the DM\'s only (the player window is not a saver)', async () => {
      equal((await st(page)).journey.gold, 1);
    });

    await check('leaving the DM tool leaves the players\' window open, with its last picture (more in player-view-keep-open.test.js)', async () => {
      await dismissModals(page);
      await page.evaluate(() => { location.href = location.href.replace(/\?.*$/, ''); });
      await page.waitForSelector('.tsi-card');
      await page.waitForTimeout(1500);
      assert(!pv.isClosed(), 'the window stays');
      equal(await pv.isVisible('[data-test=pv-waiting]'), false, 'and still shows the map');
    });

    const bad = context.log.net.concat(context.log.failed, context.log.errors);
    await check('nothing went online, no file was missing, no errors', async () => { equal(bad.filter(x => !/ERR_ABORTED/.test(x)), []); });
    await context.close();
  }

  section('The window on its own, and reduced motion');
  {
    const context = await H.newContext(browser, 'tv');
    await context.setOffline(true);
    const pv = await context.newPage();
    await pv.emulateMedia({ reducedMotion: 'reduce' });
    await pv.goto(PLAYER);
    await check('with no DM it waits calmly, still and without a map or numbers', async () => {
      await pv.waitForSelector('[data-test=pv-waiting]');
      equal(await bare(pv, '[data-test=pv-waiting]'), 'Waiting for the DM...');
      equal(await pv.$eval('.tsi-xpv-waiting__text', n => getComputedStyle(n).animationName), 'none', 'no breathing with reduced motion');
    });
    await context.close();
  }

  await browser.close();
  H.summary();
})();
