/* The Bolt Isle (Harry, 11 November 2026), clicked through from a double-clicked index.html with the internet off, at the laptop and the TV:
   - it is in the Explorer's map list, loads its picture, sets the Region to the Bolt Isle (no mismatch warning) and puts the party at Holder's
     Rest;
   - Roll an event now draws only the generic bandit events (travel: the toll or the wagon; camp: the dice game or the bard);
   - the DM doc shows the Region with no Clan or god card;
   - the player's window shows the same map.
   Run with:  node tests/e2e/bolt-isle.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const INDEX = H.fileUrl('index.html');
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const MODAL = '.tsi-modal.tsi-exp-journey';

async function rollOne(page, label) {
  await page.waitForTimeout(300);
  await page.click('[data-test=roll-now]');
  await H.clickModal(page, label);
  await page.waitForSelector(MODAL);
  const title = await page.$eval(MODAL, m => m.innerText);
  await page.evaluate(() => TSI.explorer.debug.change(s => { s.journey.current = null; }));
  await page.keyboard.press('Escape');
  await page.waitForSelector(MODAL, { state: 'detached', timeout: 4000 }).catch(() => {});
  await page.evaluate(() => TSI.explorer.debug.change(s => { s.journey.current = null; }));
  return title;
}

(async () => {
  const browser = await H.chromium.launch();
  for (const size of ['laptop', 'tv']) {
    section('The Bolt Isle on the ' + size);
    const ctx = await H.newContext(browser, size);
    await ctx.setOffline(true);
    const page = await ctx.newPage();
    await page.goto(INDEX + '?tool=explorer');
    await page.waitForSelector('[data-test=camp]');
    await page.waitForFunction(() => window.TSI && TSI.explorer && TSI.explorer.debug, null, { timeout: 20000 });

    await check('it is in the map list, loads its picture, sets the Region and puts the party at Holder\'s Rest', async () => {
      const options = await page.$$eval('[data-test=map-select] option', os => os.map(o => [o.value, o.textContent.trim()]));
      assert(options.some(o => o[0] === 'the_bolt_isle' && o[1] === 'The Bolt Isle'), JSON.stringify(options));
      await page.selectOption('[data-test=map-select]', 'the_bolt_isle');
      await page.click('[data-test=load]');
      await page.waitForTimeout(500);
      if (await page.$('.tsi-modal .tsi-btn--primary')) await page.click('.tsi-modal .tsi-btn--primary');
      await page.waitForFunction(() => TSI.explorer.debug.state().mapPresetId === 'the_bolt_isle', null, { timeout: 6000 });
      await page.waitForTimeout(600);
      const s = await st(page);
      equal([s.mapPresetId, s.travel.provinceId], ['the_bolt_isle', 'the_bolt_isle']);
      equal(await page.$eval('[data-test=region]', n => n.value), 'the_bolt_isle');
      const label = await page.$eval('[data-test=region]', n => n.options[n.selectedIndex].textContent.trim());
      equal(label, 'The Bolt Isle');
      equal(await page.$eval('[data-test=region-warning]', n => n.hidden), true, 'no mismatch warning');
      const dims = await page.evaluate(() => new Promise(res => {
        const i = new Image();
        i.onload = () => res([i.naturalWidth, i.naturalHeight]);
        i.onerror = () => res(null);
        i.src = TSI_DATA.explorer.maps.filter(m => m.id === 'the_bolt_isle')[0].src;
      }));
      equal(dims, [2000, 1500], 'the picture loads');
      const cx = s.tokens.reduce((n, t) => n + t.x, 0) / s.tokens.length;
      const cy = s.tokens.reduce((n, t) => n + t.y, 0) / s.tokens.length;
      assert(Math.abs(cx - 0.345) < 0.03 && Math.abs(cy - 0.66) < 0.03, 'at the landing: ' + cx + ', ' + cy);
      const lay = await H.layoutCheck(page, ['[data-test=camp]', '[data-test=region]']);
      equal([lay.scrollWidth > lay.clientWidth, lay.outOfView], [false, []]);
      await H.shot(page, 'bolt-isle-' + size);
    });

    await check('Roll an event now draws only the generic bandit events', async () => {
      const travel = [];
      const camp = [];
      for (let i = 0; i < 5; i++) travel.push(await rollOne(page, 'Travel event'));
      for (let i = 0; i < 5; i++) camp.push(await rollOne(page, 'Campfire event'));
      travel.forEach(t => assert(/The Wardens' Toll|The Overturned Wagon/.test(t), 'travel: ' + t.slice(0, 80)));
      camp.forEach(t => assert(/Bones by Firelight|The Bard's Wager/.test(t), 'camp: ' + t.slice(0, 80)));
      travel.concat(camp).forEach(t => assert(!/Clan|Telluria|Aurush|Pelagos/.test(t.split('\n').slice(0, 6).join(' ')), 'no Clan or god in the opening: ' + t.slice(0, 80)));
    });

    await check('the DM doc shows the Region with no Clan or god card', async () => {
      if (!(await page.$('[data-test=dmdoc-panel]:not([hidden])'))) await page.click('[data-test=dm-doc]');
      await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden]) [data-test=dmdoc-region]');
      await page.waitForFunction(() => /The Bolt Isle/.test(document.querySelector('[data-test=dmdoc-region]').textContent));
      equal(await page.$('[data-test=dmdoc-clan]'), null);
      equal(await page.$('[data-test=dmdoc-god]'), null);
      assert(/belongs to no Clan and no god/.test(await page.$eval('[data-test=dmdoc-no-clan]', n => n.textContent)));
      await H.shot(page, 'bolt-isle-dmdoc-' + size);
    });

    await check('nothing went wrong or reached for the internet', async () => {
      equal(ctx.log.errors, [], 'page errors');
      equal(ctx.log.net, [], 'internet');
      equal(ctx.log.failed, [], 'missing files');
    });
    await ctx.close();
  }
  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
