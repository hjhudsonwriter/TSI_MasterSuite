/* Bastion: research trees are switched off for now (Harry, 10 November 2026), from files with the internet off, at the laptop and the TV.
   Checks, with the shipped data as Harry has it: the Herbal Gardens has no Research row or panel; the Upgrade words do not mention a
   research token; the two recipes that used to need a research can be ordered; a save's researched choices are kept through a reload
   (nothing is discarded); and the Workshop and the other facilities are untouched.
   Run with:  node tests/e2e/research-off.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Research trees off at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name, { backedUp: true, acceptDownloads: true, researchOff: true });
    await context.setOffline(true);
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(INDEX + '?tool=bastion');
    await page.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state(), null, { timeout: 10000 });
    await H.dismissNotices(page);
    await page.evaluate(() => TSI.bastion.debug.change(s => {
      s.builtExtras = [{ facId: 'herbal_gardens', status: 'built' }];
      s.facilityLevels.herbal_gardens = 5;
      s.treasuryGP = 2000;
      s.research = { herbal_gardens: { agricultural: ['fertile_soil'] } };
      s.warehouse = [];
    }));
    await page.evaluate(() => TSI.store.flush());

    await check('the switch is off in the shipped data, the tree is still in the data, and the Herbal Gardens has no Research row or panel', async () => {
      equal(await page.evaluate(() => TSI_DATA.bastionResearch.enabled), false);
      equal(await page.evaluate(() => Object.keys(TSI_DATA.bastionResearch.trees)), ['herbal_gardens'], 'the tree is kept');
      equal(await page.evaluate(() => TSI_DATA.bastionResearch.trees.herbal_gardens.branches.length), 4);
      await page.click('[data-test=tile-herbal_gardens]');
      await page.waitForSelector('[data-test=panel-fac-herbal_gardens]');
      equal(await page.$('[data-test=research-row-herbal_gardens]'), null, 'no Research row');
      equal(await page.$('[data-test=open-research-herbal_gardens]'), null, 'no Open Research button');
      assert(!/research token|Open Research/i.test(await page.textContent('[data-test=panel-fac-herbal_gardens]')), 'no word of research tokens in the panel');
      await H.shot(page, 'research-off-' + name);
    });

    await check('the recipes that used to wait for a research (Refined Botanical Reagents, Rare Botanical Extraction) can be ordered, with no "needs" words', async () => {
      const opts = await page.$$eval('[data-test="sel-herbal_gardens__commercial_medicinal_crops"] option', os => os.map(o => o.textContent));
      assert(opts.length === 2 && !/needs/i.test(opts.join(' ')), 'no "needs" in the list: ' + opts.join(' | '));
      const opts2 = await page.$$eval('[data-test="sel-herbal_gardens__major_botanical_production"] option', os => os.map(o => o.textContent));
      assert(!/needs/i.test(opts2.join(' ')), 'nor in the other: ' + opts2.join(' | '));
      const why = await page.$('[data-test=why-herbal_gardens__commercial_medicinal_crops]');
      assert(!why || !/research/i.test(await why.textContent()), 'nothing says it needs a research');
    });

    await check('the Upgrade words do not promise a research token', async () => {
      await page.evaluate(() => TSI.bastion.debug.change(s => { s.facilityLevels.herbal_gardens = 1; }));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.click('[data-test=tile-herbal_gardens]');
      await page.waitForSelector('[data-test=upgrade-row-herbal_gardens]');
      const t = await page.textContent('[data-test=upgrade-row-herbal_gardens]');
      assert(!/research/i.test(t), 'no research in the Upgrade row: ' + t.replace(/\s+/g, ' '));
    });

    await check('a save\'s researched choices are kept through a reload (nothing is discarded), and the Workshop is untouched', async () => {
      await page.evaluate(() => TSI.store.flush());
      await page.reload();
      await page.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state(), null, { timeout: 10000 });
      await H.dismissNotices(page);
      const s = await bas(page);
      equal(s.research, { herbal_gardens: { agricultural: ['fertile_soil'] } }, 'the researched choice is still in the save');
      await page.click('[data-test=tile-workshop]');
      await page.waitForSelector('[data-test=panel-fac-workshop] [data-test=workshop-staff]');
    });

    equal(errors, [], 'no page errors');
    await context.close();
  }
  await browser.close();
  H.summary();
})();
