/* Explorer: the reach (29 October 2026). With heroes picked and Click to move on, the hexes the party can still reach today are
   tinted on the DM's map and, unless the DM switches it off, on the TV (on by default); the hex under the DM's pointer is picked
   out when the party could go there. Run:  node tests/e2e/explorer-reach.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const change = (page, fn) => page.evaluate(src => TSI.explorer.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const reachInfo = page => page.evaluate(() => TSI.explorer.debug.reach());

async function hexVector(page, dq, dr) {
  return page.evaluate(([dq, dr]) => {
    const s = TSI.explorer.debug.state(), v = TSI.explorer.debug.view();
    const r = TSI.explorer.rules.hexSize(s.grid) * v.fit;
    return { x: r * Math.sqrt(3) * (dq + dr / 2), y: r * 1.5 * dr };
  }, [dq, dr]);
}
/* How many pixels of a canvas are tinted. */
const tinted = (page, sel) => page.$eval(sel, c => { const g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < g.length; i += 4) if (g[i] > 8) n++; return n; });
/* The alpha of the canvas at a screen point of the stage. */
const alphaAt = (page, sel, x, y) => page.$eval(sel, (c, p) => { const r = c.getBoundingClientRect(); const k = c.width / r.width; return c.getContext('2d').getImageData(Math.round((p.x - r.left) * k), Math.round((p.y - r.top) * k), 1, 1).data[3]; }, { x, y });

async function selectParty(page) {
  const id = (await st(page)).tokens[0].id;
  const at = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), id);
  await page.mouse.click(at.x, at.y);
  return { id, at };
}

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The reach at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.selectOption('[data-test=map-select]', 'the_east_isle');
    await page.click('[data-test=load]');
    await page.waitForTimeout(300);
    await change(page, s => { s.travel.travelEventDay = s.travel.day; });
    const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
    await pv.setViewportSize(size);
    await pv.waitForSelector('[data-test=pv-stage]');
    await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected');

    await check('nothing is tinted before anyone is picked, on either screen', async () => {
      equal(await tinted(page, '[data-test=reach-canvas]'), 0);
      equal(await tinted(pv, '[data-test=pv-reach]'), 0);
    });

    let id, at;
    await check('picking a hero tints the hexes within today\'s reach (5 hexes) on the DM\'s map and on the TV, on by default', async () => {
      ({ id, at } = await selectParty(page));
      const info = await reachInfo(page);
      equal(info.reach.n, 5);
      equal(info.tv.n, 5);
      await pv.waitForFunction(() => { const c = document.querySelector('[data-test=pv-reach]'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 8); }, null, { timeout: 4000 });
      assert((await tinted(page, '[data-test=reach-canvas]')) > 1000, 'the DM\'s map is tinted');
      assert((await tinted(pv, '[data-test=pv-reach]')) > 1000, 'the TV is tinted');
      await H.shot(page, 'explorer-reach-dm-' + name);
      await H.shot(pv, 'explorer-reach-tv-' + name);
    });

    await check('a hex inside the reach is tinted and one outside is not, on both screens', async () => {
      const inV = await hexVector(page, 3, 0), outV = await hexVector(page, 7, 0);
      assert((await alphaAt(page, '[data-test=reach-canvas]', at.x + inV.x, at.y + inV.y)) > 8, 'DM: three hexes along is in reach');
      equal(await alphaAt(page, '[data-test=reach-canvas]', at.x + outV.x, at.y + outV.y), 0);
      const frame = async (p2, sel) => p2.$eval(sel, n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      const dm = await frame(page, '.tsi-exp-map'), tv = await frame(pv, '.tsi-xpv-map');
      const map = (b, p) => ({ x: (p.x - b.x) / b.w, y: (p.y - b.y) / b.h });
      const toTv = p => { const f = map(dm, p); return { x: tv.x + f.x * tv.w, y: tv.y + f.y * tv.h }; };
      const a = toTv({ x: at.x + inV.x, y: at.y + inV.y }), b = toTv({ x: at.x + outV.x, y: at.y + outV.y });
      assert((await alphaAt(pv, '[data-test=pv-reach]', a.x, a.y)) > 8, 'TV: the same hex is tinted');
      equal(await alphaAt(pv, '[data-test=pv-reach]', b.x, b.y), 0);
    });

    await check('pointing at a hex in reach picks it out on the TV too; one out of reach is picked out only on the DM\'s map', async () => {
      const inV = await hexVector(page, 2, 0), outV = await hexVector(page, 7, 0);
      await page.mouse.move(at.x + inV.x - 10, at.y + inV.y);
      await page.mouse.move(at.x + inV.x, at.y + inV.y, { steps: 4 });
      await page.waitForTimeout(250);
      let info = await reachInfo(page);
      equal([info.target.inReach, info.target.miles], [true, 12]);
      assert(info.tv.target && info.tv.target.length === 2, 'the TV is told the hex');
      await page.mouse.move(at.x + outV.x, at.y + outV.y, { steps: 6 });
      await page.waitForTimeout(250);
      info = await reachInfo(page);
      equal(info.target.inReach, false);
      equal(info.tv.target, null);
    });

    await check('"Show reach to players" off clears the TV and leaves the DM\'s map as it was; on brings it back', async () => {
      await page.uncheck('[data-test=reach-on]');
      await pv.waitForFunction(() => { const c = document.querySelector('[data-test=pv-reach]'); return !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 8); }, null, { timeout: 4000 });
      assert((await tinted(page, '[data-test=reach-canvas]')) > 1000);
      await page.check('[data-test=reach-on]');
      await pv.waitForFunction(() => { const c = document.querySelector('[data-test=pv-reach]'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 8); }, null, { timeout: 4000 });
    });

    await check('the miles a hero has used shrink it, for the most-travelled of those picked', async () => {
      await change(page, s => { s.tokens[0].milesUsed = 13; });
      await page.keyboard.press('Escape');
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(250);
      equal((await reachInfo(page)).reach.n, 2);
      await change(page, s => { s.tokens[0].milesUsed = 0; });
    });

    await check('a walk takes the tint away while it goes, and the new reach is round the new hex when it ends', async () => {
      await page.keyboard.press('Escape');
      await page.mouse.click(at.x, at.y);
      const v = await hexVector(page, 3, 0);
      await page.mouse.click(at.x + v.x, at.y + v.y);
      await page.waitForTimeout(250);
      equal((await reachInfo(page)).reach, null);
      await page.waitForFunction(() => !TSI.explorer.debug.walking(), null, { timeout: 8000 });
      await page.waitForTimeout(250);
      const info = await reachInfo(page);
      equal(info.reach.n, 2, '18 of 30 miles used: two hexes left');
    });

    await check('Esc puts the heroes down and clears the tint on both screens', async () => {
      await page.keyboard.press('Escape');
      await pv.waitForFunction(() => { const c = document.querySelector('[data-test=pv-reach]'); return !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 8); }, null, { timeout: 4000 });
      equal(await tinted(page, '[data-test=reach-canvas]'), 0);
    });

    await check('no reach with Free Move, with Click to move off, or for a tired hero', async () => {
      await change(page, s => { s.tokens.forEach(t => { t.milesUsed = 0; }); });
      const t0 = (await st(page)).tokens[0].id;
      const where = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), t0);
      await page.mouse.click(where.x, where.y);
      equal((await reachInfo(page)).reach !== null, true);
      await page.click('[data-test=free-move]');
      await page.waitForTimeout(250);
      equal((await reachInfo(page)).reach, null);
      await page.click('[data-test=free-move]');
      await page.mouse.click(where.x, where.y);
      await page.click('[data-test=click-move]');
      await page.waitForTimeout(250);
      equal((await reachInfo(page)).reach, null);
      await page.click('[data-test=click-move]');
      await change(page, s => { s.tokens[0].milesUsed = 30; });
      await page.mouse.click(where.x, where.y);
      await page.waitForTimeout(250);
      equal((await reachInfo(page)).reach, null);
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
