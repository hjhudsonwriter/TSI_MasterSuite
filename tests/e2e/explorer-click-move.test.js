/* Explorer: click to move (29 October 2026). With heroes picked, a click on the map sends them walking there at a fixed pace
   (a hex at a time with Snap on, a straight line with it off). The miles, the day's limit and the day's travel roll are the
   same as a drag's; where the roll falls part-way the walk stops at that hex. The TV follows the walk.
   Run:  node tests/e2e/explorer-click-move.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const change = (page, fn) => page.evaluate(src => TSI.explorer.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const notice = page => page.evaluate(() => (document.querySelector('.tsi-exp-notice, [data-test=notice]') || {}).textContent || '');

/* The vector, in screen pixels, of a hex move (dq, dr) on the DM's map. */
async function hexVector(page, dq, dr) {
  return page.evaluate(([dq, dr]) => {
    const s = TSI.explorer.debug.state(), v = TSI.explorer.debug.view();
    const r = TSI.explorer.rules.hexSize(s.grid) * v.fit;
    return { x: r * Math.sqrt(3) * (dq + dr / 2), y: r * 1.5 * dr };
  }, [dq, dr]);
}
async function hexOf(page, id) {
  return page.evaluate(id => { const R = TSI.explorer.rules, s = TSI.explorer.debug.state(); const t = R.token(s, id); return R.tokenHex(s, R.board(R.aspect(s, TSI_DATA.explorer)), t); }, id);
}
async function selectParty(page) {
  /* Pick the first hero (its group comes with it). */
  const id = (await st(page)).tokens[0].id;
  const at = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), id);
  await page.mouse.click(at.x, at.y);
  return id;
}
async function clickHexes(page, id, dq, dr) {
  const at = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), id);
  const v = await hexVector(page, dq, dr);
  await page.mouse.click(at.x + v.x, at.y + v.y);
}
async function waitIdle(page) { await page.waitForFunction(() => !TSI.explorer.debug.walking(), null, { timeout: 8000 }); }
async function dismiss(page) {
  for (let k = 0; k < 10 && await page.$('.tsi-modal'); k++) {
    const b = await page.$('.tsi-modal .tsi-modal__foot button');
    if (!b) break;
    await page.waitForTimeout(400);
    await b.click().catch(() => {});
    await page.waitForTimeout(150);
  }
}
async function fresh(browser, name, extra) {
  const context = await H.newContext(browser, name, extra);
  await context.setOffline(true);
  const page = await context.newPage();
  await page.goto(EXPLORER);
  await page.waitForSelector('[data-test=camp]');
  await page.selectOption('[data-test=map-select]', 'the_east_isle');
  await page.click('[data-test=load]');
  await page.waitForTimeout(300);
  /* No event in the way unless a test wants one. */
  await change(page, s => { s.travel.travelEventDay = s.travel.day; });
  return { context, page };
}

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Click to move at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const { context, page } = await fresh(browser, name);
    const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
    await pv.setViewportSize(size);
    await pv.waitForSelector('[data-test=pv-stage]');
    await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });

    await check('there is a Click to move button, on by default', async () => {
      equal(await page.textContent('[data-test=click-move]'), 'Click to move: On');
    });

    let id;
    await check('snap off: a click sends the picked party gliding in a straight line to the spot, over a moment (not a jump), and the miles are charged', async () => {
      id = await selectParty(page);
      const before = await st(page);
      const at = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), id);
      const v = await hexVector(page, 3, 0);
      await page.mouse.click(at.x + v.x, at.y + v.y);
      const xs = new Set();
      for (let i = 0; i < 12; i++) { await page.waitForTimeout(70); xs.add(Math.round((await st(page)).tokens[0].x * 10000)); }
      assert(xs.size >= 5, 'it moved in steps over time: ' + xs.size + ' distinct places');
      await waitIdle(page);
      const after = await st(page);
      equal(after.tokens[0].milesUsed - (before.tokens[0].milesUsed || 0), 18);
      const c = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), id);
      assert(Math.abs(c.x - (at.x + v.x)) < 6 && Math.abs(c.y - (at.y + v.y)) < 6, 'it ended where the click was: ' + JSON.stringify([c, at, v]));
    });

    await check('the TV followed the walk: its hero ends at the same place on the map as the DM\'s', async () => {
      await pv.waitForTimeout(400);
      const frac = (page2, mapSel, tokSel) => page2.evaluate(([m, t]) => { const a = document.querySelector(m).getBoundingClientRect(), b = document.querySelector(t).getBoundingClientRect(); return { x: (b.x + b.width / 2 - a.x) / a.width, y: (b.y + b.height / 2 - a.y) / a.height }; }, [mapSel, tokSel]);
      const d = await frac(page, '.tsi-exp-map', '.tsi-exp-token[data-id=' + id + ']');
      const p = await frac(pv, '.tsi-xpv-map', '.tsi-xpv-token[data-id=' + id + ']');
      assert(Math.abs(d.x - p.x) < 0.004 && Math.abs(d.y - p.y) < 0.004, JSON.stringify([d, p]));
    });

    await check('the TV sees it moving, not appearing (its hero is at several places during a walk)', async () => {
      await page.click('[data-test=click-move]'); await page.click('[data-test=click-move]'); /* a harmless pair of clicks */
      const at = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), id);
      await change(page, s => { s.tokens.forEach(t => { t.milesUsed = 0; }); });
      const v = await hexVector(page, -3, 0);
      await selectParty(page);
      await page.mouse.click(at.x + v.x, at.y + v.y);
      const seen = new Set();
      for (let i = 0; i < 10; i++) { await pv.waitForTimeout(70); seen.add(await pv.$eval('.tsi-xpv-token[data-id=' + id + ']', n => n.style.left)); }
      assert(seen.size >= 4, 'TV positions: ' + seen.size);
      await waitIdle(page);
    });

    await check('snap on: the party steps from hex to hex along the line and rests in the middle of the last one', async () => {
      await page.click('[data-test=snap]');
      await change(page, s => { s.tokens.forEach(t => { t.milesUsed = 0; }); });
      await selectParty(page);
      const start = await hexOf(page, id);
      const visited = [];
      await clickHexes(page, id, 0, 3);
      for (let i = 0; i < 14; i++) { await page.waitForTimeout(70); const h = await hexOf(page, id); const k = h.q + ',' + h.r; if (!visited.length || visited[visited.length - 1] !== k) visited.push(k); }
      await waitIdle(page);
      const end = await hexOf(page, id);
      equal(await page.evaluate(([a, b]) => TSI.explorer.rules.hexDistance(a, b), [start, end]), 3);
      assert(visited.length >= 3, 'it passed through hexes on the way: ' + visited.join(' '));
      const s2 = await st(page);
      equal(s2.tokens[0].milesUsed, 18);
    });

    await check('too far: nothing moves, nothing is charged, and the DM is told', async () => {
      await change(page, s => { s.tokens.forEach(t => { t.milesUsed = 24; }); });
      await selectParty(page);
      const before = await hexOf(page, id);
      await clickHexes(page, id, 3, 0);
      await page.waitForTimeout(300);
      equal(await page.evaluate(() => TSI.explorer.debug.walking()), false);
      equal(await hexOf(page, id), before);
      equal((await st(page)).tokens[0].milesUsed, 24);
      assert(/Too far/.test(await page.textContent('body')), 'the notice says so');
    });

    await check('Esc stops a long walk where the party is and charges only the hexes walked', async () => {
      await change(page, s => { s.tokens.forEach(t => { t.milesUsed = 0; }); });
      await selectParty(page);
      const start = await hexOf(page, id);
      await clickHexes(page, id, 0, -4);
      await page.waitForTimeout(420);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      equal(await page.evaluate(() => TSI.explorer.debug.walking()), false);
      const end = await hexOf(page, id);
      const hexes = await page.evaluate(([a, b]) => TSI.explorer.rules.hexDistance(a, b), [start, end]);
      assert(hexes >= 1 && hexes < 4, 'stopped part-way: ' + hexes);
      equal((await st(page)).tokens[0].milesUsed, hexes * 6);
    });

    await check('where the day\'s travel roll falls part-way the walk stops at that hex, and the roll is made there', async () => {
      await dismiss(page);
      await change(page, s => { s.tokens.forEach(t => { t.milesUsed = 0; }); s.travel.travelEventDay = 0; s.travel.nextTravelEventAtMiles = 12; });
      await selectParty(page);
      const start = await hexOf(page, id);
      await clickHexes(page, id, 0, 4);
      await waitIdle(page);
      const end = await hexOf(page, id);
      equal(await page.evaluate(([a, b]) => TSI.explorer.rules.hexDistance(a, b), [start, end]), 2);
      const s2 = await st(page);
      equal(s2.tokens[0].milesUsed, 12);
      equal(s2.travel.travelEventDay, s2.travel.day);
      await dismiss(page);
    });

    await check('with Click to move off, a click on the map only deselects, as before', async () => {
      await dismiss(page);
      await page.click('[data-test=click-move]');
      await change(page, s => { s.tokens.forEach(t => { t.milesUsed = 0; }); s.travel.travelEventDay = s.travel.day; });
      await selectParty(page);
      const before = await hexOf(page, id);
      await clickHexes(page, id, 2, 0);
      await page.waitForTimeout(300);
      equal(await page.evaluate(() => TSI.explorer.debug.walking()), false);
      equal(await hexOf(page, id), before);
      await page.click('[data-test=click-move]');
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
