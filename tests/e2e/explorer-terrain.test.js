/* Explorer: painted terrain (29 October 2026). The DM locks the hex size and paints forests, roads, water and so on onto the
   hexes; they change what a hex costs to cross, can block the way, shape the reach, and show to the players only if ticked.
   Run:  node tests/e2e/explorer-terrain.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const terr = page => page.evaluate(() => TSI.explorer.debug.terrain());
const change = (page, fn) => page.evaluate(src => TSI.explorer.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const hexAt = (page, q, r) => page.evaluate(([q, r]) => TSI.explorer.debug.hexScreen(q, r), [q, r]);
const pvPixels = page => page.$eval('[data-test=pv-terrain]', c => { const g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < g.length; i += 4) if (g[i] > 8) n++; return n; });
async function dismiss(page) {
  for (let k = 0; k < 10 && await page.$('.tsi-modal'); k++) {
    const b = await page.$('.tsi-modal .tsi-modal__foot button:last-child');
    if (!b) break;
    await page.waitForTimeout(400);
    await b.click().catch(() => {});
    await page.waitForTimeout(150);
  }
}
async function heroHex(page) {
  return page.evaluate(() => { const R = TSI.explorer.rules, s = TSI.explorer.debug.state(); return R.tokenHex(s, R.board(R.aspect(s, TSI_DATA.explorer)), s.tokens[0]); });
}
async function paintHex(page, q, r) { const p = await hexAt(page, q, r); await page.mouse.click(p.x, p.y); }

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Terrain at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.selectOption('[data-test=map-select]', 'the_east_isle');
    await page.click('[data-test=load]');
    await page.waitForTimeout(300);
    await change(page, s => { s.travel.travelEventDay = s.travel.day; s.snap.enabled = true; });
    const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
    await pv.setViewportSize(size);
    await pv.waitForSelector('[data-test=pv-stage]');
    await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected');

    let hx;
    await check('Edit terrain asks to lock the hex size first, then opens the brush', async () => {
      await page.click('[data-test=terrain-edit]');
      const msg = await page.textContent('.tsi-modal');
      assert(msg.includes('hex size has to be locked'), msg);
      await page.click('.tsi-modal__foot button:last-child');
      await page.waitForSelector('[data-test=terrain-panel]', { state: 'visible' });
      equal((await st(page)).grid.locked, true);
      equal((await terr(page)).editing, true);
      hx = await heroHex(page);
    });
    await check('the brush lists every kind with its cost, and Erase', async () => {
      const t = await page.textContent('[data-test=terrain-panel]');
      for (const w of ['Road', '×0.5', 'Forest', '×2', 'Hills', 'Marsh', '×3', 'Mountain trails', 'Mountain climb', 'Mountains (impassable)', 'Water (impassable)', 'blocked', 'Erase']) assert(t.includes(w), 'missing ' + w);
    });
    await check('clicking paints a hex; dragging paints a line of hexes; the DM map shows it', async () => {
      await page.click('[data-test=terrain-brush-forest]');
      await paintHex(page, hx.q + 1, hx.r);
      equal((await st(page)).terrainByMap['preset:the_east_isle'][(hx.q + 1) + ',' + hx.r], 'forest');
      const a = await hexAt(page, hx.q + 2, hx.r + 1), b = await hexAt(page, hx.q + 2, hx.r + 4);
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
      const n = Object.keys((await st(page)).terrainByMap['preset:the_east_isle']).length;
      assert(n >= 5, 'painted ' + n);
      assert((await terr(page)).pixels > 0, 'the canvas shows it');
    });
    await check('painting does not pick up or move a hero', async () => {
      const before = (await st(page)).tokens[0].x;
      const p = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), (await st(page)).tokens[0].id);
      await page.mouse.click(p.x, p.y);
      equal((await st(page)).tokens[0].x, before);
    });
    await check('the TV sees nothing until "Show terrain to players" is ticked, and loses it when unticked', async () => {
      equal(await pvPixels(pv), 0);
      await page.check('[data-test=terrain-show]');
      await pv.waitForFunction(() => { const c = document.querySelector('[data-test=pv-terrain]'); const g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < g.length; i += 4) if (g[i] > 8) return true; return false; }, null, { timeout: 8000 });
      await page.uncheck('[data-test=terrain-show]');
      await pv.waitForFunction(() => { const c = document.querySelector('[data-test=pv-terrain]'); const g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < g.length; i += 4) if (g[i] > 8) return false; return true; }, null, { timeout: 8000 });
    });
    await check('Erase takes a hex back to open land', async () => {
      await page.click('[data-test=terrain-brush-open]');
      await paintHex(page, hx.q + 1, hx.r);
      equal((await st(page)).terrainByMap['preset:the_east_isle'][(hx.q + 1) + ',' + hx.r], undefined);
    });
    await check('Done ends painting; the hero can be picked again', async () => {
      await page.click('[data-test=terrain-done]');
      equal((await terr(page)).editing, false);
      assert(await page.isHidden('[data-test=terrain-panel]'));
    });

    section('Terrain changes the walk (' + name + ')');
    const paint = (hexes, kind) => page.evaluate(([hexes, kind]) => TSI.explorer.debug.change(s => TSI.explorer.rules.paintHexes(s, hexes, kind)), [hexes, kind]);
    const notice = () => page.evaluate(() => document.querySelector('[data-test=notice]').textContent);
    const walkTo = async (q, r) => { const p = await hexAt(page, q, r); await page.mouse.click(p.x, p.y); };
    const idle = () => page.waitForFunction(() => !TSI.explorer.debug.walking(), null, { timeout: 8000 });
    const pickHero = async () => { const p = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), (await st(page)).tokens[0].id); await page.mouse.click(p.x, p.y); };
    let h0;
    await check('walking through two forest hexes then open land costs 12 + 12 + 6 miles', async () => {
      await page.evaluate(() => TSI.explorer.debug.change(s => TSI.explorer.rules.clearTerrain(s)));
      h0 = await heroHex(page);
      await paint([{ q: h0.q + 1, r: h0.r }, { q: h0.q + 2, r: h0.r }], 'forest');
      if (!(await page.textContent('[data-test=click-move]')).includes('On')) await page.click('[data-test=click-move]');
      await pickHero();
      await walkTo(h0.q + 3, h0.r);
      await idle();
      equal((await st(page)).tokens[0].milesUsed, 30);
    });
    await check('the reach on the DM map and the TV follows the terrain (a list of hexes, not a circle)', async () => {
      await page.evaluate(() => TSI.explorer.debug.change(s => { s.tokens.forEach(t => { t.milesUsed = 0; }); }));
      h0 = await heroHex(page);
      await paint([{ q: h0.q + 1, r: h0.r }], 'forest');
      await pickHero();
      const info = await page.evaluate(() => TSI.explorer.debug.reach());
      assert(info.reach && Array.isArray(info.reach.cells) && info.reach.cells.length > 0, 'reach has cells');
      assert(!info.reach.cells.some(c => c.q === h0.q + 5 && c.r === h0.r), 'five hexes through forest is out of reach');
      assert(info.reach.cells.some(c => c.q === h0.q + 1 && c.r === h0.r), 'the forest hex itself is in reach');
    });
    await check('impassable ground blocks a walk: nobody moves and the DM is told why', async () => {
      await paint([{ q: h0.q + 2, r: h0.r }], 'water');
      const before = (await st(page)).tokens[0].x;
      await pickHero();
      await walkTo(h0.q + 3, h0.r);
      await page.waitForTimeout(300);
      assert((await notice()).includes('blocked'), await notice());
      equal((await st(page)).tokens[0].x, before);
      equal((await st(page)).tokens[0].milesUsed, 0);
    });
    await check('the reach never includes the water hex', async () => {
      const info = await page.evaluate(() => TSI.explorer.debug.reach());
      assert(!info.reach.cells.some(c => c.q === h0.q + 2 && c.r === h0.r));
    });
    await check('unlocking asks first because terrain would slide off the picture; refusing keeps it locked', async () => {
      await page.click('[data-test=grid-lock]');
      const msg = await page.textContent('.tsi-modal');
      assert(msg.includes('no longer line up'), msg);
      await page.click('.tsi-modal__foot button:first-child');
      await page.waitForTimeout(300);
      await dismiss(page);
      equal((await st(page)).grid.locked, true);
    });
    await check('it is saved: a reload brings the painting back', async () => {
      const n = Object.keys((await st(page)).terrainByMap['preset:the_east_isle']).length;
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      equal(Object.keys((await st(page)).terrainByMap['preset:the_east_isle']).length, n);
      assert((await terr(page)).pixels > 0);
    });
    await check('Clear all terrain empties the map after asking', async () => {
      await page.click('[data-test=terrain-edit]');
      await page.click('[data-test=terrain-clear]');
      await page.click('.tsi-modal__foot button:last-child');
      await page.waitForTimeout(300);
      equal((await terr(page)).count, 0);
      await page.click('[data-test=terrain-done]');
    });
    await check('nothing failed and nothing sideways', async () => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sideways scroll');
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }
  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
