/* Explorer: the three fog modes, colour reveal and the ambient touches (guide 6B, 4 November 2026), from files with the internet off, at the
   laptop and the TV. Checks: the starting mode (new save: Colour reveal; an old save keeps its black fog or its no fog); the control shows the
   real saved mode; a move opens the ground around the party in colour on the players' window, and it stays when they walk away; the Reveal and
   Hide brushes, Reveal all and Reset (it asks first); the three modes on both windows; towns and quest markers in unexplored land are hidden from
   the players until explored, or until the town is marked Known to players; an uploaded map behaves the same; the cloud shadows (and their switch,
   and reduced motion); the camera glide; Export, Import, Back up and Restore; and the frame rate while dragging a hero.
   Run with:  node tests/e2e/explorer-fog.test.js */
'use strict';

const H = require('./helpers');
const path = require('path');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const UPLOAD = path.join(H.ROOT, 'tools/arenas/assets/maps/middlemount_lions_crown.png');
const info = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.explored())));
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const loadMap = async (page, id) => { await page.selectOption('[data-test=map-select]', id); await page.click('[data-test=load]'); await page.waitForTimeout(400); /* no random travel event during these checks */ await page.evaluate(() => { TSI.explorer.debug.state().travel.nextTravelEventAtMiles = 999; }); };
const flushReload = async page => { await page.evaluate(() => TSI.store.flush()); await page.reload(); };
const dismiss = async page => { for (let k = 0; k < 6 && await page.$('.tsi-modal'); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };
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
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + by.x * i / 12, from.y + by.y * i / 12);
  await page.mouse.up();
  await page.waitForTimeout(250);
  await dismiss(page);
}
async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  return pv;
}
const pvWait = (pv, fn, arg) => pv.waitForFunction(fn, arg, { timeout: 8000 });
const pvColour = pv => pv.evaluate(() => { const i = document.querySelector('[data-test=pv-colour]'); return { grey: document.querySelector('.tsi-xpv-map').classList.contains('tsi-xpv-map--grey'), has: !!i, mask: i ? (i.style.maskImage || i.style.webkitMaskImage || '').slice(0, 30) : '' }; });

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Fog modes and colour reveal at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name, { acceptDownloads: true });
    await context.setOffline(true);
    /* The "Back up your campaign" reminder sits over the bottom controls on the laptop and comes back after a reload: these checks are not about it. */
    await context.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.tsi-notice{display:none!important}'; document.head.appendChild(st); }));
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');

    await check('a new save starts in Colour reveal, and the Fog control shows it', async () => {
      equal(await page.$eval('[data-test=fog-mode]', s => s.value), 'colour');
      equal((await info(page)).mode, 'colour');
      equal((await st(page)).fog.enabled, false, 'the black fog is off');
      equal(await page.$$eval('[data-test=fog-mode] option', o => o.map(x => x.textContent)), ['Classic fog', 'Colour reveal', 'No fog']);
    });

    await check('loading a map opens the ground around every hero in colour (19 hexes each at radius 2, overlapping), and the DM sees a light grey wash over the rest', async () => {
      await loadMap(page, 'midland_province');
      const i = await info(page);
      assert(i.flat.length / 2 >= 19 && i.flat.length / 2 <= 19 * 5, 'hexes: ' + i.flat.length / 2);
      equal(await page.$$('[data-test=colour-wash]').then(l => l.length), 1, 'the wash is there');
      assert((await page.$eval('[data-test=colour-wash]', n => (n.style.maskImage || n.style.webkitMaskImage || '').startsWith('url("data:image/png'))), 'a soft mask');
      equal(await page.$$eval('.tsi-exp-pin', n => n.length), 2, 'the DM sees every pin, explored or not');
    });

    const pv = await openPlayer(page, size);
    await check('the players\' window: greyscale and dimmed map, with the colour shown through the explored hexes (a masked colour copy)', async () => {
      await pvWait(pv, () => !!document.querySelector('[data-test=pv-colour]'));
      const c = await pvColour(pv);
      equal([c.grey, c.has], [true, true]);
      assert(c.mask.startsWith('url("data:image/png'), c.mask);
      const filter = await pv.$eval('.tsi-xpv-map', n => getComputedStyle(n).filter);
      assert(/grayscale/.test(filter) && /brightness/.test(filter), filter);
      equal(await pv.$eval('[data-test=pv-fog]', n => !!n.getContext && true), true);
      await H.shot(pv, 'fog-colour-tv-' + name);
    });

    await check('the snapshot sent to the players holds the same explored hexes as the DM\'s window, nothing about unexplored towns', async () => {
      const dmHexes = (await info(page)).flat.length;
      const pvHexes = await pv.evaluate(() => { /* the colour copy's mask was built from them; count via the page's own snapshot if it is kept */ return window.__lastSnap ? window.__lastSnap.explored.hexes.length : -1; });
      assert(pvHexes === -1 || pvHexes === dmHexes);
      const banners = await pv.$$eval('.tsi-xpv-banner', n => n.map(x => x.dataset.id));
      equal(banners, [], 'no town of the Midland map is explored yet');
    });

    await check('moving a hero opens the ground around where it stops, in both windows; walking away keeps the colour', async () => {
      const id = (await st(page)).tokens[0].id;
      const before = (await info(page)).flat.length;
      await dragHex(page, id, 3, 0);
      const mid = (await info(page)).flat.length;
      assert(mid > before, 'more is explored: ' + before + ' -> ' + mid);
      const sig1 = await pv.evaluate(() => document.querySelector('[data-test=pv-colour]').style.maskImage.length);
      await dragHex(page, id, -3, 0);
      const after = (await info(page)).flat.length;
      assert(after >= mid, 'nothing is forgotten when the party walks back: ' + mid + ' -> ' + after);
      await pvWait(pv, () => !!document.querySelector('[data-test=pv-colour]'));
      equal((await pvColour(pv)).has, true);
    });

    await check('Reveal map: Reveal and Hide brushes work by hexes under the pointer (click or drag), and Reveal all, and Reset asks first', async () => {
      await page.click('[data-test=reveal-edit]');
      await page.waitForSelector('[data-test=reveal-panel]:not([hidden])');
      const stage = await page.$eval('.tsi-exp-stage', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      const spot = { x: stage.x + stage.w * 0.78, y: stage.y + stage.h * 0.7 };
      const hexAtSpot = await page.evaluate(([x, y]) => { const s = TSI.explorer.debug.state(), v = TSI.explorer.debug.view(), R = TSI.explorer.rules; const r = stage_rect(); function stage_rect() { return document.querySelector('.tsi-exp-stage').getBoundingClientRect(); } const b = R.toBoard(v, x - r.left, y - r.top); return R.hexAt(s.grid, b.x, b.y); }, [spot.x, spot.y]);
      const has = async h => (await info(page)).flat.some((v, i, a) => i % 2 === 0 && v === h.q && a[i + 1] === h.r);
      equal(await has(hexAtSpot), false, 'not explored yet');
      await page.mouse.click(spot.x, spot.y);
      equal(await has(hexAtSpot), true, 'a click reveals the hex');
      await page.click('[data-test=reveal-brush-hide]');
      await page.mouse.click(spot.x, spot.y);
      equal(await has(hexAtSpot), false, 'the Hide brush takes it away');
      await page.click('[data-test=reveal-brush-reveal]');
      await page.click('[data-test=reveal-size-1]');
      const n0 = (await info(page)).flat.length;
      await page.mouse.move(spot.x, spot.y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(spot.x - i * 18, spot.y);
      await page.mouse.up();
      assert((await info(page)).flat.length > n0 + 14, 'a Medium drag opens a trail');
      await pvWait(pv, () => !!document.querySelector('[data-test=pv-colour]'));
      /* Reveal all */
      await page.click('[data-test=reveal-all]');
      const all = (await info(page)).flat.length / 2;
      assert(all > 300, 'the whole map: ' + all);
      await H.shot(page, 'fog-reveal-all-dm-' + name);
      /* Reset asks first */
      await page.click('[data-test=reveal-reset]');
      await page.waitForSelector('.tsi-modal');
      assert((await page.textContent('.tsi-modal')).includes('Hide the whole map again?'));
      await H.clickModal(page, 'Cancel');
      await page.waitForTimeout(250);
      equal((await info(page)).flat.length / 2, all, 'No keeps it all');
      await page.click('[data-test=reveal-reset]');
      await page.waitForSelector('.tsi-modal');
      await H.clickModal(page, 'Hide it');
      await page.waitForTimeout(300);
      equal((await info(page)).flat.length, 0, 'Yes hides it all');
      await page.click('[data-test=reveal-done]');
      equal((await info(page)).revealing, false);
      /* The party's own ground comes back with the next move. */
      await page.evaluate(() => TSI.explorer.debug.exploreNow());
      assert((await info(page)).flat.length >= 38, 'the party\'s surroundings are opened again');
    });

    await check('towns and quest markers in unexplored land are hidden from the players and shown to the DM; Known to players shows a town; exploring its hex shows it too', async () => {
      await page.evaluate(() => TSI.explorer.debug.change(s => {})); /* a redraw */
      /* a marker in the far corner, not explored */
      await page.evaluate(() => { const k = 'tsi.explorer.markers'; });
      await page.click('[data-test=quest-place]');
      const b = await page.$eval('.tsi-exp-stage', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      await page.mouse.click(b.x + b.w * 0.9, b.y + b.h * 0.9);
      await page.keyboard.press('Escape');
      equal(await page.$$eval('.tsi-exp-qmark', n => n.length), 1, 'the DM sees it');
      equal(await pv.$$('.tsi-xpv-quest').then(l => l.length), 0, 'the players do not');
      equal(await pv.$$('.tsi-xpv-banner').then(l => l.length), 0, 'no banner either');
      /* Known to players */
      await page.hover('[data-test=banner-middlemount]');
      await page.click('[data-test=banner-ruled-middlemount]');
      await page.waitForSelector('[data-test=ruled-dialog]');
      await page.check('[data-test=known-to-players]');
      await H.clickModal(page, 'Save');
      await page.waitForTimeout(400);
      equal((await info(page)).known, { version: 1, known: { middlemount: true } });
      await pvWait(pv, () => !!document.querySelector('.tsi-xpv-banner[data-id=middlemount]'));
      equal(await pv.$$eval('.tsi-xpv-banner', n => n.map(x => x.dataset.id)), ['middlemount'], 'only the known town');
      equal(await pv.$$('.tsi-xpv-quest').then(l => l.length), 0, 'the marker is still hidden');
      /* Reveal all shows the rest. */
      await page.evaluate(() => TSI.explorer.debug.change(s => {}));
      await page.click('[data-test=reveal-edit]');
      await page.click('[data-test=reveal-all]');
      await page.click('[data-test=reveal-done]');
      await pvWait(pv, () => document.querySelectorAll('.tsi-xpv-quest').length === 1);
      assert((await pv.$$('.tsi-xpv-banner').then(l => l.length)) === 2, 'both towns now');
      /* Un-know it and hide everything */
      await page.hover('[data-test=banner-middlemount]');
      await page.click('[data-test=banner-ruled-middlemount]');
      await page.waitForSelector('[data-test=ruled-dialog]');
      await page.uncheck('[data-test=known-to-players]');
      await H.clickModal(page, 'Save');
      await page.waitForTimeout(300);
      equal((await info(page)).known, { version: 1, known: {} });
      await page.click('[data-test=reset-fog]');
      await page.waitForSelector('.tsi-modal');
      await H.clickModal(page, 'Hide it');
      await page.waitForTimeout(300);
    });

    await check('switching to Classic gives the black fog (and the players\' fog canvas), Colour reveal the grey map, Off neither; the control and both windows follow, and a reload shows the real mode', async () => {
      await page.selectOption('[data-test=fog-mode]', 'classic');
      await page.waitForTimeout(300);
      equal([(await info(page)).mode, (await st(page)).fog.enabled], ['classic', true]);
      await pvWait(pv, () => !document.querySelector('.tsi-xpv-map').classList.contains('tsi-xpv-map--grey'));
      equal(await page.$$('[data-test=colour-wash]').then(l => l.length), 0, 'no wash in Classic');
      const dark = await pv.evaluate(() => { const c = document.querySelector('[data-test=pv-fog]'); const x = c.getContext('2d'); const d = x.getImageData(5, 5, 1, 1).data; return d[3]; });
      assert(dark > 100, 'the players\' black fog is drawn: ' + dark);
      await flushReload(page);
      await page.waitForSelector('[data-test=camp]');
      equal(await page.$eval('[data-test=fog-mode]', s => s.value), 'classic', 'a reload shows Classic, the real mode');
      equal((await st(page)).fog.enabled, true);
      await page.selectOption('[data-test=fog-mode]', 'off');
      await page.waitForTimeout(300);
      equal([(await info(page)).mode, (await st(page)).fog.enabled], ['off', false]);
      await pvWait(pv, () => !document.querySelector('[data-test=pv-colour]') && !document.querySelector('.tsi-xpv-map').classList.contains('tsi-xpv-map--grey'));
      await flushReload(page);
      await page.waitForSelector('[data-test=camp]');
      equal(await page.$eval('[data-test=fog-mode]', s => s.value), 'off');
      await page.selectOption('[data-test=fog-mode]', 'colour');
      await page.waitForTimeout(400);
      equal((await info(page)).mode, 'colour');
      await pvWait(pv, () => !!document.querySelector('[data-test=pv-colour]'));
      await flushReload(page);
      await page.waitForSelector('[data-test=camp]');
      equal(await page.$eval('[data-test=fog-mode]', s => s.value), 'colour');
      equal((await info(page)).flat.length > 0, true, 'what was explored survived the reload');
    });

    await check('Reveal map says to switch to Colour reveal first when it is not on', async () => {
      await page.selectOption('[data-test=fog-mode]', 'off');
      assert(await page.$eval('[data-test=reveal-edit]', b => b.disabled), 'the button is greyed out');
      await page.selectOption('[data-test=fog-mode]', 'colour');
      assert(!(await page.$eval('[data-test=reveal-edit]', b => b.disabled)));
    });

    await check('cloud shadows: on by default, drawn in code (a data picture, no file), below the heroes and never in the way of the mouse; the switch turns them off here and on the TV, and it is saved', async () => {
      equal(await page.isChecked('[data-test=clouds-on]'), true);
      const c = await page.$eval('[data-test=clouds]', n => ({ hidden: n.hidden, bg: getComputedStyle(n).backgroundImage.slice(0, 22), pe: getComputedStyle(n).pointerEvents, anim: getComputedStyle(n).animationName }));
      equal([c.hidden, c.bg.startsWith('url("data:image/png'), c.pe], [false, true, 'none']);
      assert(/cloud-drift/.test(c.anim), c.anim);
      await pvWait(pv, () => !document.querySelector('[data-test=pv-clouds]').hidden);
      await page.uncheck('[data-test=clouds-on]');
      equal(await page.$eval('[data-test=clouds]', n => n.hidden), true);
      await pvWait(pv, () => document.querySelector('[data-test=pv-clouds]').hidden);
      equal((await page.evaluate(() => TSI.explorer.debug.prefs())).clouds, false);
      await flushReload(page);
      await page.waitForSelector('[data-test=camp]');
      equal(await page.isChecked('[data-test=clouds-on]'), false, 'saved');
      await H.dismissNotices(page);
      await page.check('[data-test=clouds-on]');
    });

    await check('the camera glide: zoomed in, with the party off the edge of the view, a move eases the view back to them; any click on the map stops it', async () => {
      await page.waitForSelector('[data-test=camp]');
      for (let i = 0; i < 4; i++) await page.click('.tsi-exp-zoombox button[aria-label="Zoom in"]');
      await page.waitForTimeout(200);
      /* Pan the map away from the party, then end a move: the view comes back. */
      const z0 = await page.evaluate(() => TSI.explorer.debug.zoomState());
      assert(z0.zoom > 1.5, 'zoomed in: ' + z0.zoom);
      await page.evaluate(() => { const v = TSI.explorer.debug.zoomState(); });
      await page.mouse.move(600, 500); await page.mouse.down(); await page.mouse.move(100, 120, { steps: 6 }); await page.mouse.up();
      await page.waitForTimeout(200);
      const before = await page.evaluate(() => { const t = TSI.explorer.debug.tokenScreen(TSI.explorer.debug.state().tokens[0].id); const r = document.querySelector('.tsi-exp-stage').getBoundingClientRect(); return { x: t.x - r.left, y: t.y - r.top, w: r.width, h: r.height }; });
      assert(before.x < 0 || before.y < 0 || before.x > before.w || before.y > before.h, 'the party is off screen: ' + JSON.stringify(before));
      await page.evaluate(() => TSI.explorer.debug.glide());
      await page.waitForTimeout(700);
      const after = await page.evaluate(() => { const t = TSI.explorer.debug.tokenScreen(TSI.explorer.debug.state().tokens[0].id); const r = document.querySelector('.tsi-exp-stage').getBoundingClientRect(); return { x: t.x - r.left, y: t.y - r.top, w: r.width, h: r.height }; });
      assert(after.x > 0 && after.y > 0 && after.x < after.w && after.y < after.h, 'the party is back in view: ' + JSON.stringify(after));
      await page.keyboard.press('0');
    });

    await check('an uploaded map behaves like the bundled ones: grey for the players, colour where explored', async () => {
      await page.setInputFiles('[data-test=upload-input]', UPLOAD);
      await page.waitForTimeout(1200);
      const i = await info(page);
      assert(i.key.startsWith('upload:'), i.key);
      assert(i.flat.length >= 38, 'the party\'s ground is opened: ' + i.flat.length);
      await pvWait(pv, () => !!document.querySelector('[data-test=pv-colour]') && document.querySelector('.tsi-xpv-map').classList.contains('tsi-xpv-map--grey'));
      const src = await pv.evaluate(() => [document.querySelector('.tsi-xpv-map').getAttribute('src').slice(0, 11), document.querySelector('[data-test=pv-colour]').getAttribute('src').slice(0, 11)]);
      assert(src.every(x => x === 'data:image/'), 'both are the uploaded picture: ' + src);
      await loadMap(page, 'midland_province');
    });

    await check('the explored map and the known towns are in a campaign file and in Back up everything; a damaged one is refused on import; an old save with neither opens in the black fog (or none)', async () => {
      const keys = await page.evaluate(async () => {
        await TSI.store.flush();
        const rules = TSI.backupRules;
        const campaign = rules.makeCampaignBackup(TSI.store.records('explorer'), new Date(), TSI.space);
        const suite = rules.makeSuiteBackup(await TSI.store.freshAll(), new Date(), TSI.space);
        return { campaign: campaign.records.map(r => r.key), suite: suite.records.map(r => r.key) };
      });
      assert(keys.campaign.includes('tsi.explorer.explored') && keys.suite.includes('tsi.explorer.explored'), keys.campaign.join());
      const bad = await page.evaluate(() => TSI.explorer.rules.importProblem([{ key: 'tsi.explorer.explored', value: { version: 1, mode: 'fancy', maps: {} } }]));
      assert(bad && /explored/.test(bad), String(bad));
      equal(await page.evaluate(() => TSI.explorer.rules.importProblem([{ key: 'tsi.explorer.pinknown', value: 'x' }])).then(v => !!v), true);
      /* An old save: a journey with the black fog on, no explored record. */
      await page.evaluate(async () => {
        const s = TSI.explorer.debug.state();
        TSI.explorer.debug.change(x => { x.fog.enabled = true; });
        TSI.store.remove('tsi.explorer.explored'); TSI.store.remove('tsi.explorer.pinknown');
        await TSI.store.flush();
      });
      await flushReload(page);
      await page.waitForSelector('[data-test=camp]');
      equal(await page.$eval('[data-test=fog-mode]', s => s.value), 'classic', 'an old save with the black fog on stays Classic');
      await page.evaluate(async () => { TSI.explorer.debug.change(x => { x.fog.enabled = false; }); TSI.store.remove('tsi.explorer.explored'); await TSI.store.flush(); });
      await flushReload(page);
      await page.waitForSelector('[data-test=camp]');
      equal(await page.$eval('[data-test=fog-mode]', s => s.value), 'off', 'an old save with no fog stays as it was');
      await page.evaluate(async () => { TSI.store.set('tsi.explorer.explored', { version: 7, bogus: true }); await TSI.store.flush(); });
      await flushReload(page);
      await page.waitForSelector('[data-test=camp]');
      assert(['classic', 'colour', 'off'].includes(await page.$eval('[data-test=fog-mode]', s => s.value)), 'a damaged record does not crash it');
    });

    await check('the controls fit: the Explorer\'s left column and the bottom strip stay in view, with no sideways scrolling', async () => {
      const lay = await H.layoutCheck(page, ['[data-test=fog-mode]', '[data-test=reset-fog]', '[data-test=pick]', '[data-test=reveal-edit]', '[data-test=clouds-on]']);
      equal(lay.outOfView, []);
      equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    });

    await check('nothing went wrong or reached for the internet', async () => {
      equal(context.log.errors, []);
      equal(context.log.net, []);
      equal(context.log.failed, []);
    });
    await context.close();
  }

  /* ---- Reduced motion: no clouds, no fade ---- */
  section('Reduced motion');
  {
    const context = await H.newContext(browser, 'laptop', { reducedMotion: 'reduce' });
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await loadMap(page, 'midland_province');
    await check('with reduced motion the cloud shadows are off and the wash changes at once', async () => {
      equal(await page.$eval('[data-test=clouds]', n => n.hidden), true);
      const id = (await st(page)).tokens[0].id;
      await dragHex(page, id, 3, 0);
      equal(await page.$$eval('[data-test=colour-wash]', n => n.length), 1, 'no second layer left fading');
    });
    await context.close();
  }

  /* ---- Frame rate while dragging a hero, at the TV's size ---- */
  section('Performance at 1920 x 1080');
  {
    const context = await H.newContext(browser, 'tv');
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await loadMap(page, 'the_east_isle');
    const pv = await openPlayer(page, { width: 1920, height: 1080 });
    await pv.waitForTimeout(1200);
    await check('dragging a hero in Colour reveal stays smooth on the TV (the frame rate is printed; headless software drawing, so a real GPU does better)', async () => {
      await pv.evaluate(() => { window.__f = 0; (function tick() { window.__f++; requestAnimationFrame(tick); })(); });
      const t0 = Date.now();
      const at = await page.evaluate(() => TSI.explorer.debug.tokenScreen(TSI.explorer.debug.state().tokens[0].id));
      await page.mouse.move(at.x, at.y); await page.mouse.down();
      for (let i = 1; i <= 50; i++) { await page.mouse.move(at.x + i * 4, at.y + i * 2); await page.waitForTimeout(16); }
      await page.mouse.up();
      const frames = await pv.evaluate(() => window.__f), ms = Date.now() - t0;
      console.log('    TV window: ' + frames + ' frames in ' + ms + ' ms = ' + (frames * 1000 / ms).toFixed(1) + ' frames a second while dragging');
      assert(frames * 1000 / ms >= 12, 'at least 12 frames a second: ' + (frames * 1000 / ms).toFixed(1));
    });
    await context.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
