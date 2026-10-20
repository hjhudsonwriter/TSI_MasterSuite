/* More things by parcel (Harry, 20 October 2026), from the test page with
   the internet off: a row typed into the Warehouse and Restorative Herbs go
   in a parcel through the Send dialog; the goods leave the Warehouse once;
   the party collects them in the Explorer (the Travel bags show the exact
   name and count); the Bastion closes the parcel once.
   Run with:  node tests/e2e/parcels-more.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');

(async () => {
  const browser = await H.chromium.launch();
  section('Parcels: typed Warehouse rows and herbs');
  const ctx = await H.newContext(browser, 'laptop', { backedUp: true });
  await ctx.setOffline(true);
  const ex = await ctx.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await ctx.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    s.partyLevel = 9;
    s.treasuryGP = 300;
    s.builtPlots = [{ facId: 'courier_exchange', status: 'built' }];
    s.facilityLevels.courier_exchange = 2;
    s.warehouse = [
      { id: 'potionrow1abc', item: 'Potion of Healing', qty: 5, gp: '', notes: '' },
      { id: 'goodsrow1herb', goodId: 'restorative_herbs', item: 'Restorative Herbs', qty: 10, gp: '', notes: '' }
    ];
  }));
  await ba.waitForTimeout(600);

  await check('the Send dialog lists the typed row and the herbs; sending takes them once', async () => {
    await ba.click('[data-test=tile-courier_exchange]');
    await ba.waitForSelector('[data-test=send-parcel]');
    await ba.waitForTimeout(400);
    await ba.click('[data-test=send-parcel]');
    await ba.waitForSelector('[data-test=parcel-dialog]');
    equal(await ba.$$eval('[data-test=parcel-free-row] .tsi-bas-cargo__name', n => n.map(x => x.textContent)), ['Potion of Healing']);
    await ba.fill('[data-test=parcel-free-qty]', '3');
    await ba.fill('[data-test=parcel-qty-restorative_herbs]', '4');
    await ba.waitForTimeout(200);
    assert(!(await ba.$eval('[data-test=parcel-dialog] .tsi-modal__foot .tsi-btn--primary', b => b.disabled)), 'Send is on');
    await ba.click('[data-test=parcel-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    const s = await ba.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
    equal(s.warehouse.map(w => [w.item, w.qty]), [['Potion of Healing', 2], ['Restorative Herbs', 6]]);
    equal(s.tradeNetwork.parcels.length, 1);
    equal(s.tradeNetwork.parcels[0].goods, [{ goodId: 'restorative_herbs', qty: 4 }, { goodId: 'free:potionrow1abc', qty: 3, name: 'Potion of Healing' }]);
  });

  await check('the party collects it: the Travel bags show the exact name and count, once', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.tradeNetwork.parcels[0].status = 'ready'; s.tradeNetwork.parcels[0].arrivedDay = s.day; s.tradeNetwork.parcels[0].readyDay = s.day; }));
    await ba.waitForTimeout(500);
    const r = await ex.evaluate(async () => {
      const st = TSI.explorer.debug.state();
      let b = null;
      for (let n = 0; n < 40; n++) {
        b = await TSI.store.fresh('tsi.bastion.state', null);
        if (TSI.bridge.parcels(b).some(p => p.status === 'ready')) break;
        await new Promise(r => setTimeout(r, 250));
      }
      const p = TSI.bridge.parcels(b)[0];
      const first = TSI.explorer.journey.collectParcel(st, p.id, p.point, b, {});
      const second = TSI.explorer.journey.collectParcel(st, p.id, p.point, b, {});
      TSI.store.set('tsi.explorer.save', TSI.explorer.rules.toSave(st));
      return { first: first.ok, second: second.ok, inv: st.journey.inventory.map(i => [i.kind, i.qty, i.name || '']) };
    });
    equal([r.first, r.second], [true, false]);
    equal(r.inv, [['restorative_herbs', 4, ''], ['free:potionrow1abc', 3, 'Potion of Healing']]);
    await ba.waitForFunction(() => TSI.bastion.debug.state().tradeNetwork.parcels[0].status === 'collected', null, { timeout: 8000 });
    const s = await ba.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
    equal(s.warehouse.map(w => [w.item, w.qty]), [['Potion of Healing', 2], ['Restorative Herbs', 6]], 'nothing came back');
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'page errors');
    equal(ctx.log.net, [], 'internet');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
