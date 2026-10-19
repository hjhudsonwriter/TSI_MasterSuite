/* Explorer: the warning when the Region isn't the loaded map's province
   (Harry, 19 October 2026). Run with:  node tests/e2e/region-warning.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const warn = page => page.$eval('[data-test=region-warning]', n => ({ hidden: n.hidden, text: n.textContent }));
const region = page => page.evaluate(() => TSI.explorer.debug.state().travel.provinceId);

(async () => {
  const browser = await H.chromium.launch();
  const context = await H.newContext(browser, 'laptop');
  await context.setOffline(true);
  const page = await context.newPage();

  section('The Region warning');
  await page.goto(EXPLORER);
  await page.waitForSelector('[data-test=camp]');

  await check('loading a map sets its Region, and there is no warning', async () => {
    await page.selectOption('[data-test=map-select]', 'southern_province_west');
    await page.click('[data-test=load]');
    await page.waitForTimeout(200);
    equal(await region(page), 'southern_province');
    equal((await warn(page)).hidden, true);
  });

  await check('choosing another Region shows the warning and changes nothing else', async () => {
    await page.selectOption('[data-test=region]', 'northern_province');
    await page.waitForTimeout(200);
    const w = await warn(page);
    equal(w.hidden, false);
    assert(/Southern Province/.test(w.text) && /Northern Province/.test(w.text) && /Honour\/Respect/.test(w.text), w.text);
    equal(await region(page), 'northern_province', 'the Region is exactly what was chosen');
    await H.shot(page, 'region-warning');
  });

  await check('it survives a reload, and choosing the map\'s own province clears it', async () => {
    await page.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
    await page.reload();
    await page.waitForSelector('[data-test=camp]');
    equal((await warn(page)).hidden, false);
    await page.selectOption('[data-test=region]', 'southern_province');
    await page.waitForTimeout(200);
    equal((await warn(page)).hidden, true);
  });

  await check('nothing reached for the internet, and nothing failed', async () => {
    equal(context.log.net, []);
    equal(context.log.failed, []);
    equal(context.log.errors, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
