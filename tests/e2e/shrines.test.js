/* The old Shrines, converted into the Temple (the Strip Back Overhaul, step S11, 22 October 2026), from a
   double-clicked file, on the test page with Harry's sample file (tests/fixtures/bastion-pr8b-sample.json: three
   Shrines at Level 5, each god's Favour at 60%, a Courier Exchange) made heavier with the orders the Shrines could
   hold (Rootguard Salve, the Great Rite of Pelagos, Craft, a prayer for Favour, an Aquatic Protection Charm):
   - the box that says what changed names the Temple, the orders that carried on and the ones that ended, in plain
     English, and the Favour that came back;
   - one Temple stands where the first Shrine stood, the other slots are free, each god's Favour is as it was (plus
     what the cancelled charm gave back);
   - the two orders that carried on complete on their own due days (the salve into the Warehouse, the Great Rite
     waiting at the Ironbow with its god), so a day passes without any trouble;
   - the Courier Exchange lists the Temple's items; the Great Rite shows in Pelagos's third of the panel;
   - a reload changes nothing.
   (The Temple's own panel is clicked through in tests/e2e/temple.test.js.)
   Run with:  node tests/e2e/shrines.test.js */
'use strict';

const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const HARNESS = H.fileUrl('tests/harness.html');
const SAMPLE = require(path.join(__dirname, '..', 'fixtures', 'bastion-pr8b-sample.json'));

const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const lastModal = page => page.$$eval('.tsi-modal', ms => ms[ms.length - 1].textContent.replace(/\s+/g, ' ').trim());

/* Harry's sample with the old Shrines' orders in it (version 3: the Bastion converts it when it opens). */
function withOrders() {
  const file = JSON.parse(JSON.stringify(SAMPLE));
  const s = file.records[0].value;
  const order = (id, facId, fnId, label, dueDay, extra) => Object.assign({ id, facId, fnId, chosen: null, optionLabel: null, notes: '', label, costGP: 0, issuedDay: 1, dueDay }, extra || {});
  s.pendingOrders = [
    order('sh-1', 'shrine_telluria', 'prepare_rootguard_salve', 'Shrine of Telluria: Prepare Rootguard Salve (2 doses of Rootguard Salve)', 4,
      { chosen: { label: '2 doses of Rootguard Salve', outputs: [{ good: 'rootguard_salve', qty: 2 }] }, optionLabel: '2 doses of Rootguard Salve', favourCost: 5 }),
    order('sh-2', 'shrine_pelagos', 'great_rite_pelagos', 'Shrine of Pelagos: Great Rite of Pelagos', 6, { favourCost: 25 }),
    order('sh-3', 'shrine_aurush', 'craft', 'Shrine of Aurush: Craft (Aurush Sun Charm)', 5, { chosen: { label: 'Aurush Sun Charm' }, optionLabel: 'Aurush Sun Charm' }),
    order('sh-4', 'shrine_pelagos', 'pray', 'Shrine of Pelagos: Pray (Pelagos\'s Blessing)', 2, { chosen: { label: 'Pelagos\'s Blessing', special: { type: 'favour_blessing', god: 'pelagos' } }, optionLabel: 'Pelagos\'s Blessing' }),
    order('sh-5', 'shrine_pelagos', 'prepare_aquatic_protection_charm', 'Shrine of Pelagos: Prepare Aquatic Protection Charm (1 Aquatic Protection Charm)', 5,
      { chosen: { label: '1 Aquatic Protection Charm', outputs: [{ good: 'aquatic_protection_charm', qty: 1 }] }, optionLabel: '1 Aquatic Protection Charm', favourCost: 5 })
  ];
  return H.writeTemp('shrines-heavy.json', file);
}

async function context(browser) {
  const ctx = await H.newContext(browser, 'laptop', { acceptDownloads: true });
  await ctx.setOffline(true);
  /* No travel or campfire events and no weather: every die comes up 0.99. */
  await ctx.addInitScript(() => { Math.random = () => 0.99; });
  return ctx;
}
async function openExplorer(ctx) {
  const p = await ctx.newPage();
  await p.goto(HARNESS + '?tool=explorer');
  await p.waitForSelector('[data-test=camp]');
  return p;
}
async function closeAll(page) {
  for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}
/* Make Camp in the Explorer, closing whatever the night brings. */
async function camp(ex) {
  await ex.waitForTimeout(400);
  await ex.click('[data-test=camp]');
  for (let n = 0; n < 20; n++) {
    await ex.waitForTimeout(200);
    if (!(await ex.$('.tsi-modal'))) { if (n > 2) break; continue; }
    await ex.click('.tsi-modal__foot button:last-child');
  }
}
/* The Bastion reaches a day by itself; "The Ironbow sends word…" is read and closed on the way. */
async function bastionReaches(ba, day) {
  for (let n = 0; n < 200; n++) {
    if (await ba.$('[data-test=ironbow-word]')) await ba.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary');
    const ok = await ba.evaluate(d => { const s = TSI.bastion.debug.state(); return s.day === d && !s.dayInProgress && !TSI.bastion.debug.busy(); }, day);
    if (ok && !(await ba.$('[data-test=ironbow-word]'))) return;
    await ba.waitForTimeout(250);
  }
  throw new Error('The Bastion didn\'t reach Day ' + day);
}
async function openTile(ba, fac) {
  await closeAll(ba);
  await ba.waitForTimeout(300);
  await ba.click('[data-test=tile-' + fac + ']');
  await ba.waitForSelector('[data-test=panel-fac-' + fac + ']');
  await ba.waitForTimeout(300);
}

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser);
  let ba = null;
  let ex = null;
  let box = '';

  section('Harry\'s sample with the old Shrines\' orders, on the test page');

  await check('it imports and the box that says what changed describes the Temple, the orders that carried on and the ones that ended', async () => {
    ba = await ctx.newPage();
    await ba.goto(HARNESS + '?tool=bastion');
    await ba.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug, null, { timeout: 8000 });
    await H.chooseFile(ba, '[data-test=import-save]', withOrders());
    await H.clickModal(ba, 'Import');
    await ba.waitForSelector('[data-test=changes-box]', { timeout: 8000 });
    box = await bare(ba, '[data-test=changes-box]');
    assert(/Places that joined others\. The Shrine of Telluria, the Shrine of Aurush and the Shrine of Pelagos have become one Temple\./.test(box), box);
    assert(/Each god has a Favour bar there, a Pray button \(instant: it adds a d50 roll, 1 to 50 percent, to the bar\) and Receive Blessing, a list of three blessings that opens when the bar is full/.test(box), box);
    assert(/Your Favour bars carry over as they are\./.test(box), box);
    assert(/Favour\. Pelagos: 5% went back to the bar \(on Day 1 it went from 60% to 65%\)\./.test(box), box);
    assert(/Goods\. /.test(box) === false, 'the charm held no goods, so none came back');
    assert(/3 orders were cancelled: Shrine of Aurush: Craft \(Aurush Sun Charm\) \(the Temple has no Craft order any more\); Shrine of Pelagos: Pray \(Pelagos's Blessing\) \(praying at the Temple is instant now, so this one-day prayer ended without its roll\); Shrine of Pelagos: Prepare Aquatic Protection Charm \(1 Aquatic Protection Charm\) \(the Temple gives three blessings for each god, and this is not one of Pelagos's\)\./.test(box), box);
    assert(/2 orders moved with their places, keeping their due days: Shrine of Telluria: Prepare Rootguard Salve \(2 doses of Rootguard Salve\) \(now at the Temple\); Shrine of Pelagos: Great Rite of Pelagos \(now at the Temple\)\./.test(box), box);
    assert(!/shrine_|undefined|null|NaN|\[object/.test(box), 'no code words');
    const lay = await H.layoutCheck(ba, ['[data-test=changes-box]', '[data-test=changes-ok]']);
    assert(lay.scrollWidth <= lay.clientWidth && lay.outOfView.length === 0, 'the box fits: ' + JSON.stringify(lay));
    await H.ackChanges(ba);
    ex = await openExplorer(ctx);
    await ba.waitForFunction(() => TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  });

  section('One Temple');

  await check('one Temple stands where the first Shrine did, the other two slots are free, it has one level, and each god\'s Favour is as it was (Pelagos\'s 5% came back)', async () => {
    const s = await bas(ba);
    equal(s.builtExtras.slice(0, 3).map(e => e && e.facId), ['temple', '', ''], 'the Temple in the first Shrine\'s slot, the other two free');
    equal(s.builtExtras.filter(Boolean).map(e => e.facId), ['temple'], 'and nothing else');
    equal([s.facilityLevels.temple, 'shrine_telluria' in s.facilityLevels, 'shrine_aurush' in s.facilityLevels, 'shrine_pelagos' in s.facilityLevels], [1, false, false, false]);
    equal(s.favour, { telluria: 60, aurush: 60, pelagos: 65 });
    equal(s.archivedFacilities.filter(a => /^shrine_/.test(a.facId)).map(a => [a.facId, a.name]), [['shrine_telluria', 'Shrine of Telluria'], ['shrine_aurush', 'Shrine of Aurush'], ['shrine_pelagos', 'Shrine of Pelagos']]);
    equal(s.pendingOrders.map(o => [o.id, o.facId, o.fnId, o.label, o.dueDay, o.favourCost]), [
      ['sh-1', 'temple', 'prepare_rootguard_salve', 'Temple: Rootguard Salve', 4, 5],
      ['sh-2', 'temple', 'great_rite_pelagos', 'Temple: Great Rite of Pelagos', 6, 25]
    ], 'the two that carried on kept their ids, due days and the Favour they had taken');
    equal(await ba.$('[data-test=tile-shrine_telluria]'), null, 'no Shrine tile');
  });

  await check('the Temple\'s panel shows both orders pending and the three gods\' bars as they were', async () => {
    await openTile(ba, 'temple');
    assert(/Temple: Rootguard Salve/.test(await bare(ba, '[data-test=panel-fac-temple]')) && /Temple: Great Rite of Pelagos/.test(await bare(ba, '[data-test=panel-fac-temple]')), await bare(ba, '[data-test=panel-fac-temple]'));
    equal([await bare(ba, '[data-test=temple-favour-telluria]'), await bare(ba, '[data-test=temple-favour-aurush]'), await bare(ba, '[data-test=temple-favour-pelagos]')], ['60%', '60%', '65%']);
    await closeAll(ba);
  });

  section('The carried-over orders complete');

  await check('5 camps later (Day 6): the salve is in the Warehouse (Day 4), the Great Rite of Pelagos waits at the Ironbow (Day 6); nothing is left pending', async () => {
    await closeAll(ba);
    for (let i = 0; i < 5; i++) await camp(ex);
    const day = await ex.evaluate(() => TSI.explorer.debug.state().travel.day);
    equal(day, 6);
    await bastionReaches(ba, day);
    const s = await bas(ba);
    equal(s.warehouse.filter(w => w.goodId).map(w => [w.goodId, w.qty]), [['rootguard_salve', 2]]);
    equal(s.greatRites.map(g => [g.id, g.rite, g.god, g.madeDay, g.status]), [['rite-sh-2', 'tides_passage', 'pelagos', 6, 'waiting']]);
    equal(s.pendingOrders, []);
    equal(s.favour, { telluria: 60, aurush: 60, pelagos: 65 }, 'finishing an order that is already paid for costs no more Favour');
  });

  await check('the Great Rite shows under Pelagos in the Temple\'s panel, and only there', async () => {
    await openTile(ba, 'temple');
    assert(/Tide's Passage: waiting at the Ironbow since Day 6/.test(await bare(ba, '[data-test=temple-god-pelagos]')), await bare(ba, '[data-test=temple-god-pelagos]'));
    equal(await ba.$('[data-test=great-rites-telluria]'), null);
    await closeAll(ba);
  });

  await check('the Courier Exchange lists the Temple\'s items beside packs and charts', async () => {
    await closeAll(ba);
    await openTile(ba, 'courier_exchange');
    await ba.click('[data-test=send-parcel]');
    await ba.waitForTimeout(500);
    const t = await lastModal(ba);
    assert(/Rootguard Salvein the Warehouse: 2 doses/.test(t), t);
    await closeAll(ba);
  });

  await check('a reload changes nothing', async () => {
    const before = await bas(ba);
    await ba.reload();
    await ba.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    const after = await bas(ba);
    equal([after.favour, after.greatRites, after.tradeNetwork.protections, after.warehouse, after.builtExtras, after.pendingOrders], [before.favour, before.greatRites, before.tradeNetwork.protections, before.warehouse, before.builtExtras, before.pendingOrders]);
    equal(await ba.$('[data-test=changes-box]'), null, 'the box is not shown again once read');
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'no page errors');
    equal(ctx.log.net, [], 'nothing online');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
