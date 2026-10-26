/* Reset the Explorer to Day 1, blank (Harry, 26 October 2026), from a double-clicked index.html with the internet off:
   the Explorer is stripped back (no threads, effects, gold, bags, log, messages or event in progress; Day 1, no miles)
   but keeps its map, grid, heroes and pins; the Bastion drops what the Explorer delivered (its Changes list, a creature
   still waiting for a home) and leaves its buildings, orders, treasury and Warehouse alone.
   Run with:  node tests/e2e/explorer-reset.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exs = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));

(async () => {
  const browser = await H.chromium.launch();
  for (const size of ['laptop', 'tv']) {
    section('Reset to Day 1 (' + size + ')');
    const ctx = await H.newContext(browser, size, { acceptDownloads: true });
    await ctx.setOffline(true);
    await ctx.addInitScript(() => { Math.random = () => 0.99; });
    const ex = await ctx.newPage();
    await ex.goto(INDEX + '?tool=explorer');
    await ex.waitForSelector('[data-test=camp]');
    await ex.selectOption('[data-test=map-select]', 'the_east_isle');
    await ex.click('[data-test=load]');
    await ex.waitForTimeout(300);
    const ba = await ctx.newPage();
    await ba.goto(INDEX + '?tool=bastion');
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });

    await check('a busy journey: gold, a chart, a thread, an effect, a waiting creature', async () => {
      await ex.evaluate(() => TSI.explorer.debug.change(s => {
        const J = TSI.explorer.journey;
        s.tokens.forEach(t => { t.milesUsed = 12; });
        s.grid.r = 50;
        s.journey.gold = 90;
        J.addItem(s, J.CHART, 2);
        s.journey.threads.push({ id: 'zz-thread', name: 'ZZThread', day: 3 });
        s.journey.effects.push({ id: 'zz-effect', name: 'ZZEffect', day: 3, untilDay: null });
        s.journey.log.push('ZZ log line');
        J.grantCreature(s, 'griffin', { name: 'Spark' });
      }));
      await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.some(c => c.name === 'Spark' && c.status === 'waiting'), null, { timeout: 15000 });
      await ba.evaluate(() => TSI.bastion.debug.change(s => { s.treasuryGP = 777; s.warehouse = [{ name: 'ZZRope', qty: 4 }]; }));
    });

    const before = await bas(ba);

    await check('Reset asks first, and says what it clears and what it keeps; Cancel changes nothing', async () => {
      await ex.waitForTimeout(400);
      await ex.click('[data-test=reset-travel]');
      const text = await H.modalText(ex);
      assert(/Start again from Day 1/.test(text) && /What stays: the map/.test(text) && /safety copy/.test(text), text);
      await H.clickModal(ex, 'Cancel');
      equal((await exs(ex)).journey.gold, 90);
    });

    await check('after OK the Explorer is Day 1 and blank, with its map, grid and heroes kept', async () => {
      await ex.waitForTimeout(400);
      await ex.click('[data-test=reset-travel]');
      await H.clickModal(ex, 'OK');
      await ex.waitForFunction(() => TSI.explorer.debug.state().resetId);
      const s = await exs(ex);
      equal([s.journey.gold, s.journey.threads, s.journey.effects, s.journey.log, s.journey.inventory, s.journey.outbox, s.journey.current], [0, [], [], [], [], [], null]);
      equal(s.tokens.map(t => t.milesUsed), s.tokens.map(() => 0));
      equal([s.mapPresetId, s.grid.r], ['the_east_isle', 50]);
      assert(s.tokens.length > 0 && s.tokens.every(t => t.name), 'the heroes are still there');
      assert(s.resetId, 'a reset id was saved');
      equal(await ex.textContent('[data-test=day]'), 'Day 1');
      equal(await ex.textContent('[data-test=gold]'), '0');
      equal(await ex.$$eval('[data-test=bags-list] [data-test=bag-use]', n => n.length), 0);
      assert((await ex.$$eval('.tsi-exp-pin', n => n.length)) > 0, 'the pins are still on the map');
    });

    await check('the Bastion drops the Explorer\'s deliveries once: no waiting creature, no receipts; its own things stay', async () => {
      await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.every(c => c.name !== 'Spark') && Object.keys(TSI.bastion.debug.state().bridge.done).length === 0 && TSI.bastion.debug.state().day === 1, null, { timeout: 15000 });
      const s = await bas(ba);
      equal(s.treasuryGP, 777);
      equal(s.warehouse, [{ name: 'ZZRope', qty: 4 }]);
      equal(s.builtFacilities, before.builtFacilities);
      equal(s.pendingOrders.length, before.pendingOrders.length);
      equal(s.creatures.filter(c => c.msgId).length, 0);
      equal(s.bridge.resetSeen, (await exs(ex)).resetId);
    });

    await check('a new journey after the reset works as on a fresh start: a grant is held, not skipped', async () => {
      await ex.evaluate(() => TSI.explorer.debug.change(s => { TSI.explorer.journey.grantCreature(s, 'griffin', { name: 'Ember' }); }));
      await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.some(c => c.name === 'Ember' && c.status === 'waiting'), null, { timeout: 15000 });
      const s = await bas(ba);
      equal(Object.values(s.bridge.done).map(r => r.r), ['applied']);
    });

    await check('closing and reopening the Bastion does not clear again', async () => {
      await ba.reload();
      await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
      await ba.waitForTimeout(3000);
      assert((await bas(ba)).creatures.some(c => c.name === 'Ember'), 'Ember is still waiting');
    });

    equal(ctx.log.errors, []);
    await ctx.close();
  }
  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
