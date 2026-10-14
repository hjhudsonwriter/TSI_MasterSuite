/* Commodity trade and Port Charters (pull request 5 of the facilities
   overhaul, Harry's answers of 14 October 2026), clicked through from a
   double-clicked index.html with the internet off:
   - the DM grants a Port Charter in the Explorer; the Bastion holds it once
     (a notice, Clan Influence, the Hall's Port Charters box) and the
     Explorer says Applied;
   - the Hall's Register Port Charter order (Level 2, 3 days) registers it;
   - the Dock's Ship cargo… sends real Warehouse lots (Fresh Fish stays on
     the local market); the ship sells on arrival, once, even after a reload,
     and is home a week later; trouble at sea brings the cargo home;
   - standing shipments at Dock Level 4;
   - the Dock panel and the Ship cargo dialog fit the laptop and the TV.
   Run with:  node tests/e2e/commerce.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const qty = (s, id) => s.warehouse.filter(w => w.goodId === id).reduce((n, w) => n + w.qty, 0);

async function context(browser, size) {
  const ctx = await H.newContext(browser, size || 'laptop', { acceptDownloads: true });
  await ctx.setOffline(true);
  /* No travel or campfire events and no weather; the voyage roll comes out
     at 100 (safe) unless a check changes it. */
  await ctx.addInitScript(() => { Math.random = () => 0.99; });
  return ctx;
}
async function openExplorer(ctx) {
  const p = await ctx.newPage();
  await p.goto(INDEX + '?tool=explorer');
  await p.waitForSelector('[data-test=camp]');
  return p;
}
async function openBastion(ctx) {
  const p = await ctx.newPage();
  await p.goto(INDEX + '?tool=bastion');
  await p.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  return p;
}
/* Make Camp in the Explorer, closing whatever the night brings. */
async function camp(ex) {
  await ex.waitForTimeout(400);
  await ex.click('[data-test=camp]');
  let word = null;
  for (let n = 0; n < 20; n++) {
    await ex.waitForTimeout(200);
    if (!(await ex.$('.tsi-modal'))) { if (n > 2) break; continue; }
    if (await ex.$('[data-test=ironbow-word]')) word = (word || '') + (await bare(ex, '[data-test=ironbow-word]'));
    await ex.click('.tsi-modal__foot button:last-child');
  }
  return word;
}
/* The Bastion reaches a day by itself; its "The Ironbow sends word…" is
   read and closed on the way. Resolves with the word's text. */
async function bastionReaches(ba, day) {
  let word = '';
  for (let n = 0; n < 60; n++) {
    if (await ba.$('[data-test=ironbow-word]')) {
      word += ' ' + (await bare(ba, '[data-test=ironbow-word]'));
      await ba.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary');
    }
    const ok = await ba.evaluate(d => {
      const s = TSI.bastion.debug.state();
      return s.day === d && !s.dayInProgress && !TSI.bastion.debug.busy();
    }, day);
    if (ok && !(await ba.$('[data-test=ironbow-word]'))) return word;
    await ba.waitForTimeout(250);
  }
  throw new Error('The Bastion didn\'t reach Day ' + day);
}
async function passDays(ex, ba, n) {
  let exWord = '';
  for (let i = 0; i < n; i++) exWord += ' ' + ((await camp(ex)) || '');
  const day = await ex.evaluate(() => TSI.explorer.debug.state().travel.day);
  const baWord = await bastionReaches(ba, day);
  return { exWord, baWord };
}
async function openDock(ba) {
  if (await ba.$('.tsi-modal')) await ba.keyboard.press('Escape');
  await ba.waitForTimeout(200);
  await ba.click('[data-test=tile-dock]');
  await ba.waitForSelector('[data-test=dock-cargo]');
}
async function closePanel(ba) {
  await ba.keyboard.press('Escape');
  await ba.waitForTimeout(250);
}

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  let ex = null;
  let ba = null;

  /* ------------------------------------------------------------------ */
  section('The DM grants a Port Charter; the Bastion holds it once');

  await check('the Explorer and the Bastion open side by side; the Bastion has a Hall at Level 2 and goods', async () => {
    ex = await openExplorer(ctx);
    await ex.waitForTimeout(600);
    ba = await openBastion(ctx);
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }];
      s.facilityLevels.hall_of_emissaries = 2;
      s.facilityLevels.dock = 2;
      s.treasuryGP = 100;
      s.warehouse = [
        { id: 'w1', goodId: 'sawn_lumber', item: 'Sawn Lumber', qty: 3, gp: '', notes: '' },
        { id: 'w2', goodId: 'fresh_fish', item: 'Fresh Fish', qty: 4, gp: '', notes: '' },
        { id: 'w3', goodId: 'raw_stone', item: 'Raw Stone', qty: 6, gp: '', notes: '' }
      ];
    }));
    equal((await bas(ba)).day, 1);
  });

  await check('Port Charter… lists both ports, Not held; Grant sends Goldport\'s with what it\'s for', async () => {
    await ex.click('[data-test=charter-open]');
    await ex.waitForSelector('[data-test=charter-dialog]');
    equal(await ex.$$eval('[data-test=charter-ports] li', l => l.map(x => x.textContent)), ['Timberport (Clan Blackstone): Not held.', 'Goldport (Clan Molten): Not held.']);
    await ex.selectOption('[data-test=charter-port]', 'goldport');
    await ex.fill('[data-test=charter-why]', 'Cleared the wreckers');
    await ex.click('[data-test=charter-dialog] .tsi-btn--primary');
    await ex.waitForTimeout(400);
    equal(await bare(ex, '[data-test=notice]'), 'Sent to the Bastion: Port Charter for Goldport (Clan Molten).');
    const out = await ex.evaluate(() => TSI.explorer.debug.outbox());
    equal(out.map(m => [m.type, m.port, m.clan, m.text]), [['charter', 'goldport', 'molten', 'Port Charter for Goldport (Clan Molten): Cleared the wreckers']]);
  });

  await check('within a few seconds the Bastion holds it: a Port Charter notice, the Hall\'s box and Clan Influence', async () => {
    await ba.waitForFunction(() => TSI.bastion.debug.state().tradeNetwork.portCharters.length === 1, null, { timeout: 8000 });
    await H.waitForNotice(ba, /Port Charter for Goldport \(Clan Molten\) \(DM, Day 1\): the Bastion now holds it\. Register it at the Hall of Emissaries \(Level 2\)/);
    const s = await bas(ba);
    equal([s.tradeNetwork.portCharters[0].status, s.tradeNetwork.portCharters[0].port], ['earned', 'goldport']);
    await ba.click('[data-test=open-influence]');
    await ba.waitForSelector('[data-test=bridge-row]');
    assert(/Port Charter: Goldport \(Clan Molten\) · Day 1/.test(await bare(ba, '[data-test=bridge-row]')), await bare(ba, '[data-test=bridge-row]'));
    await closePanel(ba);
  });

  await check('the Explorer says Applied, and won\'t grant Goldport again', async () => {
    await ex.waitForFunction(() => document.querySelector('[data-test=sent]') && document.querySelector('[data-test=sent]').getAttribute('data-status') === 'applied', null, { timeout: 8000 });
    equal(await bare(ex, '[data-test=sent-line]'), 'Applied on Day 1: the Bastion holds the Port Charter for Goldport.');
    await ex.waitForTimeout(400);
    await ex.click('[data-test=charter-open]');
    await ex.waitForSelector('[data-test=charter-dialog]');
    equal(await ex.$$eval('[data-test=charter-ports] li', l => l.map(x => x.getAttribute('data-status'))), ['none', 'held']);
    equal(await ex.$$eval('[data-test=charter-port] option', o => o.map(x => x.value)), ['timberport'], 'only Timberport can be granted');
    await ex.click('[data-test=charter-dialog] .tsi-modal__foot button:text-is("Cancel")');
  });

  /* ------------------------------------------------------------------ */
  section('The Hall registers it (Level 2, 3 days)');

  await check('Register Port Charter lists Goldport; Issue Order makes a 3-day order costing nothing', async () => {
    await ba.click('[data-test=tile-hall_of_emissaries]');
    await ba.waitForSelector('[data-test="issue-hall_of_emissaries__register_port_charter"]');
    assert(/Earned on Day 1: register it at the Hall of Emissaries/.test(await bare(ba, '[data-test=hall-charters]')));
    equal(await ba.$$eval('[data-test="sel-hall_of_emissaries__register_port_charter"] option', o => o.map(x => x.textContent)), ['Port Charter: Goldport (Clan Molten)']);
    await ba.click('[data-test="issue-hall_of_emissaries__register_port_charter"]');
    await ba.waitForTimeout(400);
    const s = await bas(ba);
    const o = s.pendingOrders.filter(x => x.fnId === 'register_port_charter')[0];
    equal([o.label, o.dueDay, o.costGP, s.treasuryGP], ['Hall of Emissaries: Register Port Charter (Goldport)', 4, 0, 100]);
    equal(await bare(ba, '[data-test="issue-hall_of_emissaries__register_port_charter"]'), 'No Port Charter to register', 'not again while it\'s being registered');
    assert(/Being registered at the Hall of Emissaries \(ready Day 4\)/.test(await bare(ba, '[data-test=hall-charters]')));
    await closePanel(ba);
  });

  await check('three camps later it\'s registered; the forecast called it complete, never a roll', async () => {
    const w = await passDays(ex, ba, 3);
    assert(/Register Port Charter \(Goldport\) is complete/.test(w.exWord), w.exWord);
    assert(!/Register Port Charter[^.]*needs your roll/.test(w.exWord));
    const s = await bas(ba);
    equal([s.day, s.tradeNetwork.portCharters[0].status, s.tradeNetwork.portCharters[0].registeredDay], [4, 'registered', 4]);
    assert(/The Port Charter for Goldport \(Clan Molten\) is registered/.test(s.log.map(l => l.body).join(' ')));
    equal(qty(s, 'sawn_lumber'), 3, 'nothing went into the Warehouse');
  });

  /* ------------------------------------------------------------------ */
  section('The Dock ships cargo, and it sells once on arrival');

  await check('the Dock\'s Cargo and Port Charters: Level 2, 2 lots a ship; Ship cargo… is ready', async () => {
    await openDock(ba);
    const t = await bare(ba, '[data-test=dock-cargo]');
    assert(/Level 2: each ship carries up to 2 lots, 1 ship at sea at once/.test(t), t);
    assert(/Goldport \(Clan Molten\): Registered on Day 4/.test(t));
    equal(await ba.$eval('[data-test=ship-cargo]', b => b.disabled), false);
    const box = await ba.$eval('[data-test=charter_berth], [data-test="issue-dock__charter_berth"]', b => !!b);
    assert(box, 'the Charter Berth is still there');
  });

  await check('the dialog: Fresh Fish stays on the local market; 2 lots of Sawn Lumber quote 320 gp; it sails', async () => {
    await ba.click('[data-test=ship-cargo]');
    await ba.waitForSelector('[data-test=cargo-dialog]');
    equal(await ba.$eval('[data-test=cargo-qty-fresh_fish]', i => i.disabled), true);
    assert(/local market/.test(await bare(ba, '[data-test=cargo-note-fresh_fish]')));
    await ba.fill('[data-test=cargo-qty-sawn_lumber]', '2');
    await ba.waitForTimeout(150);
    assert(/2 lots of Sawn Lumber × 160 gp × Normal ×1\.00 = 320 gp/.test(await bare(ba, '[data-test=cargo-quote]')));
    equal(await bare(ba, '[data-test=cargo-net]'), 'Shipping 0 gp · tariff 0 gp (0%) · 320 gp to the treasury.');
    assert(/arrives \(Day 11\)\. The ship is home Day 18\. Voyage risk: High \(20 in 100\)/.test(await bare(ba, '[data-test=cargo-quote]')));
    const lay = await H.layoutCheck(ba, ['[data-test=cargo-dialog]']);
    equal(lay.outOfView, [], 'the dialog fits the laptop');
    await H.shot(ba, 'commerce-ship-cargo-laptop');
    await ba.click('[data-test=cargo-dialog] .tsi-btn--primary');
    await ba.waitForTimeout(400);
    const s = await bas(ba);
    equal([qty(s, 'sawn_lumber'), s.tradeNetwork.voyages.length, s.tradeNetwork.voyages[0].arriveDay, s.tradeNetwork.voyages[0].returnDay, s.treasuryGP], [1, 1, 11, 18, 100]);
    assert(/The ship is at sea: the first one home is back on Day 18/.test(await bare(ba, '[data-test=ship-why]')));
    equal(await ba.$eval('[data-test=ship-cargo]', b => b.disabled), true);
    await closePanel(ba);
  });

  await check('on Day 11 it sells: +320 gp once, in the word and the Dock\'s Recent sales; the Explorer saw it coming', async () => {
    const w = await passDays(ex, ba, 7);
    assert(/Your cargo ship reaches Goldport/.test(w.exWord), 'the Explorer\'s word: ' + w.exWord);
    assert(!/320|sold/.test(w.exWord), 'the forecast never says what it sells for');
    assert(/Cargo sold at Goldport: \+320 gp\./.test(w.baWord), 'the Bastion\'s word: ' + w.baWord);
    const s = await bas(ba);
    equal([s.treasuryGP, s.tradeNetwork.cargoSales.length, s.tradeNetwork.voyages[0].stage], [420, 1, 'returning']);
    await openDock(ba);
    assert(/Day 11 · Goldport: sold 2 lots of Sawn Lumber for 320 gp/.test(await bare(ba, '[data-test=sales]')));
    await closePanel(ba);
  });

  await check('a reload pays nothing more; on Day 18 the ship is home and can sail again', async () => {
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    await ba.waitForTimeout(2500);
    equal((await bas(ba)).treasuryGP, 420);
    const w = await passDays(ex, ba, 7);
    assert(/The cargo ship is home from Goldport/.test(w.baWord), w.baWord);
    const s = await bas(ba);
    equal([s.treasuryGP, s.tradeNetwork.voyages.length, qty(s, 'sawn_lumber')], [420, 0, 1]);
  });

  await check('trouble at sea: nothing sells, and the cargo is back in the Warehouse when the ship is home', async () => {
    await openDock(ba);
    await ba.click('[data-test=ship-cargo]');
    await ba.waitForSelector('[data-test=cargo-dialog]');
    await ba.fill('[data-test=cargo-qty-raw_stone]', '2');
    await ba.waitForTimeout(150);
    await ba.click('[data-test=cargo-dialog] .tsi-btn--primary');
    await ba.waitForTimeout(400);
    await closePanel(ba);
    equal(qty(await bas(ba), 'raw_stone'), 4);
    /* The Bastion's next roll comes out at 6: trouble (the chance is 20 in 100). */
    await ba.evaluate(() => { Math.random = () => 0.05; });
    const w = await passDays(ex, ba, 7);
    assert(/turned back with its cargo/.test(w.baWord), w.baWord);
    let s = await bas(ba);
    equal([s.treasuryGP, qty(s, 'raw_stone'), s.tradeNetwork.cargoSales[1].outcome], [420, 4, 'turned_back']);
    await ba.evaluate(() => { Math.random = () => 0.99; });
    const back = await passDays(ex, ba, 7);
    assert(/cargo is back in the Warehouse/.test(back.baWord), back.baWord);
    s = await bas(ba);
    equal([s.treasuryGP, qty(s, 'raw_stone'), s.tradeNetwork.voyages.length], [420, 6, 0]);
  });

  /* ------------------------------------------------------------------ */
  section('Standing shipments (Dock Level 4)');

  await check('at Level 4: set up 1 lot of Raw Stone every 7 days; it sails tomorrow', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.facilityLevels.dock = 4; }));
    await openDock(ba);
    await ba.click('[data-test=set-schedule]');
    await ba.waitForSelector('[data-test=schedule-dialog]');
    await ba.fill('[data-test=cargo-qty-raw_stone]', '1');
    await ba.waitForTimeout(150);
    await ba.click('[data-test=schedule-dialog] .tsi-btn--primary');
    await ba.waitForTimeout(400);
    const today = (await bas(ba)).day;
    assert(new RegExp('Every 7 days to Goldport: 1 lot of Raw Stone · next Day ' + (today + 1)).test(await bare(ba, '[data-test=schedules]')), await bare(ba, '[data-test=schedules]'));
    await closePanel(ba);
    const w = await passDays(ex, ba, 1);
    assert(/Standing shipment: cargo sailed for Goldport/.test(w.baWord), w.baWord);
    const s = await bas(ba);
    equal([s.tradeNetwork.voyages.length, s.tradeNetwork.voyages[0].scheduleId === s.tradeNetwork.schedules[0].id, qty(s, 'raw_stone')], [1, true, 5]);
  });

  await check('Stop ends it; the ship at sea carries on', async () => {
    await openDock(ba);
    await ba.click('[data-test=stop-schedule]');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Stop")');
    await ba.click('.tsi-modal__foot button:text-is("Stop")');
    await ba.waitForTimeout(400);
    const s = await bas(ba);
    equal([s.tradeNetwork.schedules.length, s.tradeNetwork.voyages.length], [0, 1]);
    await closePanel(ba);
  });

  await check('the Dock panel fits the laptop with no sideways scroll, and Ship cargo… is in view as it opens', async () => {
    await openDock(ba);
    const lay = await H.layoutCheck(ba, ['[data-test=ship-cargo]']);
    assert(lay.scrollWidth <= lay.clientWidth, 'sideways scroll: ' + lay.scrollWidth + ' > ' + lay.clientWidth);
    equal(lay.outOfView, [], 'Ship cargo… in view without scrolling');
    const box = await ba.$eval('[data-test=ship-cargo]', b => { const r = b.getBoundingClientRect(); const f = document.querySelector('.tsi-modal__foot'); const fr = f ? f.getBoundingClientRect() : null; return { bottom: r.bottom, footTop: fr ? fr.top : 99999 }; });
    assert(box.bottom <= box.footTop, 'not under the panel\'s footer: ' + JSON.stringify(box));
    await H.shot(ba, 'commerce-dock-laptop');
    await closePanel(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Review fixes');

  await check('only Fresh Fish in the Warehouse: Ship cargo… is off, and says why', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.tradeNetwork.voyages = [];
      s.facilityLevels.dock = 2;
      s.warehouse = [{ id: 'f1', goodId: 'fresh_fish', item: 'Fresh Fish', qty: 4, gp: '', notes: '' }];
    }));
    await openDock(ba);
    equal(await ba.$eval('[data-test=ship-cargo]', b => b.disabled), true);
    equal(await bare(ba, '[data-test=ship-why]'), 'None of the trade goods in the Warehouse can go to sea: Fresh Fish is for the local market.');
    await closePanel(ba);
  });

  await check('the Ship cargo dialog: Send is off for cargo the Warehouse hasn\'t got, and it follows the Warehouse while open', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.warehouse = [{ id: 's1', goodId: 'sawn_lumber', item: 'Sawn Lumber', qty: 1, gp: '', notes: '' }];
    }));
    await openDock(ba);
    await ba.click('[data-test=ship-cargo]');
    await ba.waitForSelector('[data-test=cargo-dialog]');
    const send = '[data-test=cargo-dialog] .tsi-modal__foot .tsi-btn--primary';
    equal(await ba.$eval(send, b => b.disabled), true, 'nothing chosen yet');
    await ba.fill('[data-test=cargo-qty-sawn_lumber]', '2');
    await ba.waitForTimeout(150);
    equal(await bare(ba, '[data-test=cargo-problem]'), 'Needs 2 lots of Sawn Lumber in the Warehouse; it has 1 lot.');
    equal(await ba.$eval(send, b => b.disabled), true, 'Send is off');
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.warehouse[0].qty = 3; }));
    await ba.waitForTimeout(200);
    assert(/in the Warehouse: 3 lots/.test(await bare(ba, '[data-test=cargo-note-sawn_lumber]')), await bare(ba, '[data-test=cargo-note-sawn_lumber]'));
    equal(await ba.$('[data-test=cargo-problem]'), null, 'no problem now');
    equal(await ba.$eval(send, b => b.disabled), false, 'Send is on');
    await ba.click('[data-test=cargo-dialog] .tsi-modal__foot button:text-is("Cancel")');
    await ba.waitForTimeout(200);
    await closePanel(ba);
  });

  await check('many goods on a Level 5 ship: the lot count and its problem stay in view on the laptop', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.facilityLevels.dock = 5;
      s.warehouse = ['preserved_fish', 'premium_seafood', 'raw_timber', 'sawn_lumber', 'construction_timber', 'premium_hardwood', 'raw_stone', 'dressed_stone', 'medicinal_herbs', 'sailcloth', 'fresh_fish']
        .map((g, i) => ({ id: 'm' + i, goodId: g, item: g, qty: 3, gp: '', notes: '' }));
    }));
    await openDock(ba);
    await ba.click('[data-test=ship-cargo]');
    await ba.waitForSelector('[data-test=cargo-dialog]');
    for (const g of ['preserved_fish', 'raw_timber', 'sawn_lumber', 'raw_stone', 'sailcloth']) await ba.fill('[data-test=cargo-qty-' + g + ']', '2');
    await ba.waitForTimeout(200);
    equal(await bare(ba, '[data-test=cargo-problem]'), 'That\'s 10 lots: a ship from a Level 5 Dock carries 5 lots.');
    equal((await H.layoutCheck(ba, ['[data-test=cargo-room]', '[data-test=cargo-problem]', '[data-test=cargo-dialog] .tsi-modal__foot'])).outOfView, [], 'in view');
    await H.shot(ba, 'commerce-many-goods-laptop');
    await ba.click('[data-test=cargo-dialog] .tsi-modal__foot button:text-is("Cancel")');
    await ba.waitForTimeout(200);
    await closePanel(ba);
  });

  await check('the harbour box: a double-click on Grant opens one dialog with no error, and the box follows the Bastion', async () => {
    await ex.selectOption('[data-test=map-select]', 'northern_province_west');
    await ex.click('[data-test=load]');
    await ex.waitForTimeout(400);
    if (await ex.$('.tsi-modal .tsi-btn--primary')) await ex.click('.tsi-modal .tsi-btn--primary');
    await ex.waitForTimeout(400);
    assert(await ex.evaluate(() => TSI.explorer.debug.openPin('timberport')), 'Timberport\'s pin');
    await ex.waitForSelector('[data-test=harbour]');
    await ex.waitForFunction(() => !document.querySelector('[data-test=harbour-grant]').disabled, null, { timeout: 5000 });
    assert(/Not held/.test(await bare(ex, '[data-test=harbour-line]')));
    const before = ctx.log.errors.length;
    await ex.dblclick('[data-test=harbour-grant]');
    await ex.waitForSelector('[data-test=charter-dialog]');
    await ex.waitForTimeout(400);
    equal(ctx.log.errors.slice(before), [], 'no page error');
    equal(await ex.$$eval('[data-test=charter-dialog]', d => d.length), 1, 'one dialog');
    equal(await ex.$eval('[data-test=charter-port]', s => s.value), 'timberport');
    await ex.click('[data-test=charter-dialog] .tsi-btn--primary');
    await ex.waitForFunction(() => /waiting for the Bastion/.test(document.querySelector('[data-test=harbour-line]').textContent), null, { timeout: 5000 });
    await ex.waitForFunction(() => /Held: register it at the Hall/.test(document.querySelector('[data-test=harbour-line]').textContent), null, { timeout: 10000 });
    equal(await ex.$eval('[data-test=harbour-grant]', b => b.disabled), true);
    await H.shot(ex, 'commerce-harbour-laptop');
    await ex.click('.tsi-modal__foot button:text-is("Close")');
    const s = await bas(ba);
    equal(s.tradeNetwork.portCharters.map(c => c.port + ' ' + c.status), ['goldport registered', 'timberport earned']);
  });

  /* ------------------------------------------------------------------ */
  section('Harry\'s sample file (tests/fixtures/bastion-pr5-sample.json)');

  await check('with only the Bastion open, the sample imports: the Hall and the Dock at Level 2, goods in the Warehouse; then the Explorer opens beside it, and a change it sent earlier (say, while testing pull request 4) is skipped, not applied', async () => {
    const c2 = await context(browser, 'laptop');
    /* An Explorer that sent an Honour/Respect change before: T4 won. */
    const e0 = await openExplorer(c2);
    await e0.selectOption('[data-test=region]', 'eastern_province');
    await e0.waitForTimeout(150);
    assert(await e0.evaluate(() => TSI.explorer.debug.startEvent('t4', 'travel')), 'T4 starts');
    await e0.waitForSelector('.tsi-modal.tsi-exp-journey');
    for (const t of ['choice-0', 'round-hero', 'round-hero', 'event-done']) {
      await e0.waitForTimeout(380);
      await e0.click('.tsi-modal.tsi-exp-journey [data-test="' + t + '"]');
    }
    await e0.waitForTimeout(500);
    equal((await e0.evaluate(() => TSI.explorer.debug.outbox())).length, 1, 'one change sent');
    await e0.close();
    const b3 = await c2.newPage();
    await b3.goto(INDEX + '?tool=bastion');
    await b3.waitForFunction(() => TSI.bastion && TSI.bastion.debug, null, { timeout: 8000 });
    await H.chooseFile(b3, '[data-test=import-save]', require('path').join(__dirname, '..', 'fixtures', 'bastion-pr5-sample.json'));
    await H.clickModal(b3, 'Import');
    await b3.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().facilityLevels.hall_of_emissaries === 2, null, { timeout: 8000 });
    const e3 = await openExplorer(c2);
    await e3.waitForTimeout(500);
    await b3.waitForFunction(() => TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    const s = await bas(b3);
    equal([s.day, s.treasuryGP, s.facilityLevels.dock, s.facilityLevels.hall_of_emissaries, qty(s, 'sawn_lumber'), qty(s, 'raw_stone'), qty(s, 'preserved_fish'), qty(s, 'fresh_fish'), s.bridge.fresh],
      [1, 500, 2, 2, 4, 6, 2, 4, false]);
    equal([Object.values(s.bridge.done).map(r => r.r), s.honourRespectByClan.slade], [['skipped'], 0], 'the earlier change is skipped');
    await e3.click('[data-test=charter-open]');
    await e3.waitForSelector('[data-test=charter-dialog]');
    await e3.click('[data-test=charter-dialog] .tsi-btn--primary');
    await b3.waitForFunction(() => TSI.bastion.debug.state().tradeNetwork.portCharters.length === 1, null, { timeout: 8000 });
    equal(c2.log.errors, [], 'no page errors');
    await c2.close();
  });

  /* ------------------------------------------------------------------ */
  section('The TV (1920 × 1080)');

  await check('the Dock panel and the Ship cargo dialog fit the TV', async () => {
    const saved = await ba.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
    await ex.close();
    await ba.close();
    const tv = await context(browser, 'tv');
    const e2 = await openExplorer(tv);
    await e2.waitForTimeout(500);
    const b2 = await openBastion(tv);
    await b2.evaluate(s => TSI.bastion.debug.change(st => {
      st.tradeNetwork = s.tradeNetwork;
      st.facilityLevels = s.facilityLevels;
      st.builtExtras = s.builtExtras;
      st.warehouse = s.warehouse;
      st.tradeNetwork.voyages = [];
    }), saved);
    await openDock(b2);
    const lay = await H.layoutCheck(b2, []);
    assert(lay.scrollWidth <= lay.clientWidth, 'sideways scroll on the TV');
    await H.shot(b2, 'commerce-dock-tv');
    await b2.click('[data-test=ship-cargo]');
    await b2.waitForSelector('[data-test=cargo-dialog]');
    equal((await H.layoutCheck(b2, ['[data-test=cargo-dialog]'])).outOfView, [], 'the dialog fits the TV');
    await H.shot(b2, 'commerce-ship-cargo-tv');
    await b2.click('[data-test=cargo-dialog] .tsi-modal__foot button:text-is("Cancel")');
    equal(tv.log.errors, [], 'no page errors on the TV');
    await tv.close();
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'page errors');
    equal(ctx.log.net, [], 'internet');
    equal(ctx.log.failed, [], 'missing files');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
