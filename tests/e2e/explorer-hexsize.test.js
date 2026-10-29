/* Explorer: each map keeps its own hex size; "Miles across this map"; the lock (29 October 2026).
   Run:  node tests/e2e/explorer-hexsize.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const text = (page, k) => page.getAttribute('[data-test=' + k + ']', 'placeholder');
async function loadMap(page, id) {
  await page.selectOption('[data-test=map-select]', id);
  await page.click('[data-test=load]');
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Hex size per map at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');

    await check('typing the miles across a map sets the hex so one hex is 6 miles, and says so', async () => {
      await loadMap(page, 'midland_province');
      await page.fill('[data-test=miles-across]', '240');
      await page.click('[data-test=miles-set]');
      const s = await st(page);
      assert(Math.abs(s.grid.r - 1440 * 6 / (Math.sqrt(3) * 240)) < 0.01, 'r is ' + s.grid.r);
      assert((await text(page, 'miles-across')).includes('240 miles across'), await text(page, 'miles-across'));
    });
    await check('a number that can\'t be right is refused with a plain message', async () => {
      const before = (await st(page)).grid.r;
      await page.fill('[data-test=miles-across]', '5');
      await page.click('[data-test=miles-set]');
      const msg = await page.textContent('.tsi-modal');
      assert(msg.includes('miles the map is across'), msg);
      await page.click('.tsi-modal__foot button');
      equal((await st(page)).grid.r, before);
    });
    await check('another map starts at the usual size and keeps its own', async () => {
      await loadMap(page, 'the_east_isle');
      equal((await st(page)).grid.r, 38);
      await page.click('[data-test=hex-up]');
      equal((await st(page)).grid.r, 40);
      await loadMap(page, 'midland_province');
      assert((await text(page, 'miles-across')).includes('240 miles across'));
      await loadMap(page, 'the_east_isle');
      equal((await st(page)).grid.r, 40);
    });
    await check('locking freezes the hex size, nudges and the miles box; unlocking frees them', async () => {
      await page.click('[data-test=grid-lock]');
      equal((await st(page)).grid.locked, true);
      for (const k of ['hex-up', 'hex-down', 'nudge-left', 'miles-set']) assert(await page.isDisabled('[data-test=' + k + ']'), k + ' should be off');
      equal(await page.textContent('[data-test=grid-lock]'), 'Unlock hex');
      await loadMap(page, 'midland_province');
      equal((await st(page)).grid.locked, false);
      assert(!(await page.isDisabled('[data-test=hex-up]')));
      await loadMap(page, 'the_east_isle');
      equal((await st(page)).grid.locked, true);
    });
    await check('it all survives a reload', async () => {
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      const s = await st(page);
      equal(s.grid.r, 40); equal(s.grid.locked, true);
      assert(s.gridByMap['preset:midland_province'] && Math.abs(s.gridByMap['preset:midland_province'].r - 1440 * 6 / (Math.sqrt(3) * 240)) < 0.01);
      await page.click('[data-test=grid-lock]');
    });
    await check('the laptop fit and no errors', async () => {
      const r = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      assert(r, 'sideways scroll');
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }
  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
