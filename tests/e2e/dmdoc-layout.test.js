/* The DM doc's layout (5 November 2026, Harry): the Quest box rises to just under the Bastion panel, which is only as tall as it needs to be.
   Run with:  node tests/e2e/dmdoc-layout.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const box = (page, s) => page.$eval('[data-test=dmdoc-' + s + ']', e => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height, b: b.bottom }; });

(async () => {
  const browser = await H.chromium.launch();
  for (const size of ['laptop', 'tv']) {
    section('The DM doc layout (' + size + ', internet off)');
    const context = await H.newContext(browser, size, { questMode: 'default', backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.click('[data-test=dm-doc]');
    await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden]) [data-test=dmdoc-level]');
    await page.waitForTimeout(600);

    await check('the Quest box starts just under the Bastion panel, which is only as tall as its contents; the left column is unchanged in shape', async () => {
      const b = await box(page, 'bastion'), q = await box(page, 'quest'), p = await box(page, 'party'), e = await box(page, 'explorer');
      assert(Math.abs(q.t - (b.b + 12)) <= 2, 'Quest starts ' + (q.t - b.b) + ' px under the Bastion panel');
      const content = await page.$eval('[data-test=dmdoc-bastion] .tsi-dmdoc__panel-body', e2 => e2.scrollHeight);
      assert(b.h < content + 90, 'the Bastion panel is not padded out: ' + b.h + ' for ' + content + ' of contents');
      assert(Math.abs(q.b - e.b) <= 2 && Math.abs(b.t - p.t) <= 2, 'the columns end and begin together');
      assert(q.h > b.h * 1.5, 'the Quest box is the tall one: ' + q.h + ' vs ' + b.h);
      assert(Math.abs(e.h / p.h - 1.15) < 0.05, 'Party to Explorer stays 1 to 1.15: ' + (e.h / p.h));
      await H.shot(page, 'dmdoc-layout-' + size);
    });

    await check('the Quest box reads and types as before, and no panel runs off the DM doc', async () => {
      await page.fill('[data-test=dmdoc-quest-text]', 'one two');
      equal(await page.inputValue('[data-test=dmdoc-quest-text]'), 'one two');
      const out = await page.evaluate(() => { const d = document.querySelector('[data-test=dmdoc-panel]').getBoundingClientRect(); return Array.from(document.querySelectorAll('.tsi-dmdoc__panel')).filter(p => { const r = p.getBoundingClientRect(); return r.right > d.right + 1 || r.bottom > d.bottom + 1 || r.left < d.left - 1; }).length; });
      equal(out, 0);
    });
    await context.close();
  }
  await browser.close();
  H.summary();
})();
