/* The Courier Exchange (pull request 6 of the facilities overhaul, Harry's
   answers of 14 October 2026), clicked through from a double-clicked
   index.html with the internet off, with the Explorer and the Bastion open
   side by side:
   - the Courier Exchange builds on a Development Plot in 21 days;
   - + Add supplies (the DM, by hand) adds Expedition Provision Packs and
     Overland charts to the Warehouse, once, with no gold;
   - Send a parcel… to Slade’s Muster takes the fee and the goods; two camps
     later it waits there; the Explorer's From the Ironbow list and the
     town's courier post show it; Collect… asks first, and puts its contents
     in the Travel bags once; the Bastion closes the parcel once;
   - Level 2 reaches eight towns, two parcels on the road at once, up to 10
     items each;
   - Recall parcel…: it turns back, and its contents are back in the
     Warehouse once, after as many days as it had travelled;
   - Under Repair stops new parcels, but not the ones already sent;
   - the panel and its dialogs fit the laptop and the TV;
   - Harry's sample file imports on the test page, and the real suite
     refuses it.
   Run with:  node tests/e2e/courier.test.js */
'use strict';

const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
/* The test page, where Harry tries the sample file (it only takes test-page files). */
const HARNESS = H.fileUrl('tests/harness.html');
const SAMPLE = path.join(__dirname, '..', 'fixtures', 'bastion-pr6-sample.json');
const PACK = 'expedition_provision_pack';
const CHART = 'overland_chart';
const SLADE = 'Slade’s Muster';

const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exs = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const qty = (s, id) => s.warehouse.filter(w => w.goodId === id).reduce((n, w) => n + w.qty, 0);
const rows = (s, id) => s.warehouse.filter(w => w.goodId === id).length;
/* The Travel bags: packs count one each; an Overland chart counts its days of use. */
const bag = (s, kind) => (s.journey.inventory || []).filter(i => i.kind === kind).reduce((n, i) => n + i.qty, 0);
const parcel = (s, point) => s.tradeNetwork.parcels.filter(p => p.point === point).slice(-1)[0];
const lastModal = page => page.$$eval('.tsi-modal', ms => ms[ms.length - 1].textContent.replace(/\s+/g, ' ').trim());

async function context(browser, size) {
  const ctx = await H.newContext(browser, size || 'laptop', { acceptDownloads: true });
  await ctx.setOffline(true);
  /* No travel or campfire events and no weather, like the trade test. */
  await ctx.addInitScript(() => { Math.random = () => 0.99; });
  return ctx;
}
async function openExplorer(ctx, page) {
  const p = await ctx.newPage();
  await p.goto((page || INDEX) + '?tool=explorer');
  await p.waitForSelector('[data-test=camp]');
  return p;
}
async function openBastion(ctx) {
  const p = await ctx.newPage();
  await p.goto(INDEX + '?tool=bastion');
  await p.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  return p;
}
async function closeAll(page) {
  for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}
/* Make Camp in the Explorer, closing whatever the night brings. Resolves
   with "The Ironbow sends word…" as the Explorer showed it. */
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
  for (let n = 0; n < 120; n++) {
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
  await closeAll(ex);
  let exWord = '';
  for (let i = 0; i < n; i++) exWord += ' ' + ((await camp(ex)) || '');
  const day = await ex.evaluate(() => TSI.explorer.debug.state().travel.day);
  const baWord = await bastionReaches(ba, day);
  return { exWord, baWord, day };
}
async function openCourier(ba) {
  await closeAll(ba);
  await ba.click('[data-test=tile-courier_exchange]');
  await ba.waitForSelector('[data-test=courier]');
}
async function openWarehouse(ba) {
  await closeAll(ba);
  await ba.click('[data-test=open-warehouse]');
  await ba.waitForSelector('[data-test=add-supplies]');
}
/* + Add supplies in the Warehouse: the supply and how many. */
async function addSupplies(ba, goodId, n) {
  await openWarehouse(ba);
  await ba.waitForTimeout(400);
  await ba.click('[data-test=add-supplies]');
  await ba.waitForSelector('[data-test=supplies-dialog]');
  await ba.selectOption('[data-test=supplies-good]', goodId);
  await ba.fill('[data-test=supplies-qty]', String(n));
  await ba.click('[data-test=supplies-dialog] .tsi-modal__foot .tsi-btn--primary');
  await ba.waitForTimeout(400);
  await closeAll(ba);
}
/* The Send dialog, filled in: { goodId: count }, and a town (or the first). */
async function fillParcel(ba, picks, point) {
  await openCourier(ba);
  await ba.waitForTimeout(400);
  await ba.click('[data-test=send-parcel]');
  await ba.waitForSelector('[data-test=parcel-dialog]');
  if (point) await ba.selectOption('[data-test=parcel-point]', point);
  for (const k of Object.keys(picks)) await ba.fill('[data-test=parcel-qty-' + k + ']', String(picks[k]));
  await ba.waitForTimeout(200);
}
async function sendParcel(ba, picks, point) {
  await fillParcel(ba, picks, point);
  await ba.click('[data-test=parcel-dialog] .tsi-modal__foot .tsi-btn--primary');
  await ba.waitForTimeout(450);
  await closeAll(ba);
}
/* Show a map in the Explorer, then a town's picture on it. */
async function loadMap(ex, id) {
  await closeAll(ex);
  await ex.selectOption('[data-test=map-select]', id);
  await ex.click('[data-test=load]');
  await ex.waitForTimeout(400);
  if (await ex.$('.tsi-modal .tsi-btn--primary')) await ex.click('.tsi-modal .tsi-btn--primary');
  await ex.waitForTimeout(300);
}
async function openTown(ex, pin) {
  await closeAll(ex);
  assert(await ex.evaluate(id => TSI.explorer.debug.openPin(id), pin), pin + '\'s pin is on the map');
  await ex.waitForSelector('[data-test=courier-post]');
  await ex.waitForFunction(() => !/Checking the Bastion/.test(document.querySelector('[data-test=courier-post]').textContent), null, { timeout: 6000 });
}
/* The town picture with its courier post fits the screen, with no scrolling. */
async function townFits(ex) {
  return ex.evaluate(() => {
    const m = Array.from(document.querySelectorAll('.tsi-modal')).pop();
    const b = m.querySelector('.tsi-modal__body');
    const foot = m.querySelector('.tsi-modal__foot button:last-child').getBoundingClientRect();
    const post = m.querySelector('[data-test=courier-post]').getBoundingClientRect();
    return {
      inside: b.scrollHeight - b.clientHeight <= 1,
      sideways: b.scrollWidth > b.clientWidth || document.documentElement.scrollWidth > document.documentElement.clientWidth,
      inView: foot.bottom <= innerHeight && post.bottom <= innerHeight && post.top >= 0
    };
  });
}
/* Send a parcel… in view as the panel opens, above its footer, and no sideways scroll. */
async function panelFits(ba) {
  const lay = await H.layoutCheck(ba, ['[data-test=send-parcel]']);
  const box = await ba.$eval('[data-test=send-parcel]', b => {
    const r = b.getBoundingClientRect();
    const f = b.closest('.tsi-modal').querySelector('.tsi-modal__foot');
    return { bottom: r.bottom, footTop: f ? f.getBoundingClientRect().top : 99999 };
  });
  return { sideways: lay.scrollWidth > lay.clientWidth, outOfView: lay.outOfView, underFooter: box.bottom > box.footTop };
}

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  let ex = null;
  let ba = null;
  /* The TV's browser and its Explorer. */
  let tv = null;
  let e2 = null;

  /* ------------------------------------------------------------------ */
  section('Building the Courier Exchange');

  await check('the Explorer and the Bastion open side by side; at party level 9 a Development Plot builds the Courier Exchange in 21 days', async () => {
    ex = await openExplorer(ctx);
    await ex.waitForTimeout(600);
    ba = await openBastion(ctx);
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.treasuryGP = 60; }));
    await ba.selectOption('[data-test=level]', '9');
    await ba.waitForTimeout(400);
    await ba.click('[data-test=plot-0]');
    await ba.waitForSelector('[data-test=build-courier_exchange]');
    await ba.waitForTimeout(400);
    await ba.click('[data-test=build-courier_exchange]');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Construct")');
    assert((await lastModal(ba)).includes('Construct the Courier Exchange? It takes 21 days.'), await lastModal(ba));
    await H.clickModal(ba, 'Construct');
    await ba.waitForTimeout(400);
    const s = await bas(ba);
    equal([s.day, s.partyLevel, s.builtPlots[0], s.treasuryGP], [1, 9, { facId: 'courier_exchange', status: 'building', startDay: 1, readyDay: 22 }, 60]);
  });

  await check('21 camps later it\'s built at Level 1; Send a parcel… is off while the Warehouse has nothing the courier carries', async () => {
    for (let i = 0; i < 3; i++) await passDays(ex, ba, 7);
    const s = await bas(ba);
    equal([s.day, s.builtPlots[0].status, s.facilityLevels.courier_exchange], [22, 'built', 1]);
    await openCourier(ba);
    equal(await bare(ba, '[data-test=courier-status]'), 'Level 1: 1 parcel travelling at a time, up to 5 items each. Reaches: ' + SLADE + '. Each parcel\'s fee comes from the treasury when it\'s sent; nothing goes wrong on the road.');
    equal(await ba.$eval('[data-test=send-parcel]', b => b.disabled), true);
    equal(await bare(ba, '[data-test=parcel-why]'), 'The Warehouse has nothing the courier carries (Expedition Provision Packs, Overland charts and the Temple\'s items).');
    equal(await ba.$$eval('[data-test=courier-later] li', l => l.map(x => x.textContent)), [
      'Level 3: Collect Expedition Cargo (return trips, from the party to the Ironbow).',
      'Level 4: Priority Courier (faster parcels).',
      'Level 5: Express Cargo Exchange (more and combined parcels).'
    ], 'Coming later');
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('+ Add supplies (the DM, by hand)');

  await check('+ Add supplies offers only Expedition Provision Packs and Overland charts; a double-click adds 4 packs once, logged, with no gold', async () => {
    await openWarehouse(ba);
    await ba.waitForTimeout(400);
    await ba.dblclick('[data-test=add-supplies]');
    await ba.waitForSelector('[data-test=supplies-dialog]');
    await ba.waitForTimeout(300);
    equal(await ba.$$eval('[data-test=supplies-dialog]', l => l.length), 1, 'one dialog');
    equal(await ba.$$eval('[data-test=supplies-good] option', o => o.map(x => x.value + ' ' + x.textContent)), [PACK + ' Expedition Provision Pack', CHART + ' Overland chart'], 'no trade goods');
    equal(await bare(ba, '[data-test=supplies-have]'), 'The Warehouse has 0 packs.');
    await ba.fill('[data-test=supplies-qty]', '4');
    equal((await H.layoutCheck(ba, ['[data-test=supplies-dialog]'])).outOfView, [], 'the dialog fits the laptop');
    await H.shot(ba, 'courier-add-supplies-laptop');
    await ba.dblclick('[data-test=supplies-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(600);
    const s = await bas(ba);
    equal([qty(s, PACK), rows(s, PACK), s.treasuryGP], [4, 1, 60]);
    await closeAll(ba);
  });

  await check('2 Overland charts, then 1 more pack, which joins the packs\' row in the Warehouse', async () => {
    await addSupplies(ba, CHART, 2);
    let s = await bas(ba);
    equal(qty(s, CHART), 2);
    await addSupplies(ba, PACK, 1);
    s = await bas(ba);
    equal([qty(s, PACK), rows(s, PACK), s.treasuryGP], [5, 1, 60]);
  });

  await check('a reload of the Bastion adds nothing more', async () => {
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    await ba.waitForTimeout(1500);
    const s = await bas(ba);
    equal([qty(s, PACK), qty(s, CHART), s.treasuryGP], [5, 2, 60]);
  });

  /* ------------------------------------------------------------------ */
  section('A parcel to Slade’s Muster, collected in the Explorer');

  await check('the Send dialog: Level 1 reaches only Slade’s Muster; 6 items are too many, and Send is off until it\'s 5 or fewer', async () => {
    await fillParcel(ba, { [PACK]: 5, [CHART]: 1 });
    equal(await ba.$$eval('[data-test=parcel-point] option', o => o.map(x => x.textContent)), [SLADE + ' · 2 days · 5 gp']);
    const send = '[data-test=parcel-dialog] .tsi-modal__foot .tsi-btn--primary';
    equal(await bare(ba, '[data-test=parcel-problem]'), 'That\'s 6 items: a parcel from a Level 1 Courier Exchange holds up to 5 items.');
    equal(await ba.$eval(send, b => b.disabled), true, 'Send is off');
    await ba.fill('[data-test=parcel-qty-' + PACK + ']', '3');
    await ba.waitForTimeout(200);
    equal(await bare(ba, '[data-test=parcel-summary]'), '4 items of 5 · fee 5 gp · leaves today, reaches ' + SLADE + ' on Day 24 and waits there until the party collects it.');
    equal(await ba.$eval('[data-test=parcel-problem]', n => n.hidden), true, 'no problem now');
    equal(await ba.$eval(send, b => b.disabled), false, 'Send is on');
    equal(await bare(ba, '[data-test=parcel-note-' + PACK + ']'), 'in the Warehouse: 5 packs');
    equal((await H.layoutCheck(ba, ['[data-test=parcel-dialog]'])).outOfView, [], 'the dialog fits the laptop');
    await H.shot(ba, 'courier-send-laptop');
  });

  await check('Send the parcel: the 5 gp fee and the 3 packs and 1 chart leave the Bastion once; it\'s on the road, and the one place is taken', async () => {
    await ba.dblclick('[data-test=parcel-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(600);
    const s = await bas(ba);
    equal([s.treasuryGP, qty(s, PACK), qty(s, CHART), s.tradeNetwork.parcels.length], [55, 2, 1, 1]);
    const p = s.tradeNetwork.parcels[0];
    equal([p.point, p.status, p.goods, p.items, p.departDay, p.readyDay, p.feeGP], ['slades_muster', 'in_transit', [{ goodId: PACK, qty: 3 }, { goodId: CHART, qty: 1 }], 4, 22, 24, 5]);
    await openCourier(ba);
    equal(await ba.$eval('[data-test=send-parcel]', b => b.disabled), true);
    equal(await bare(ba, '[data-test=parcel-why]'), 'A parcel is already travelling: the first place is free on Day 24.');
    assert(/^On the road to Slade’s Muster: arrives Day 24 · 3 Expedition Provision Packs, 1 Overland chart/.test(await bare(ba, '[data-test=parcels-travelling] [data-test=parcel]')), await bare(ba, '[data-test=parcels-travelling] [data-test=parcel]'));
    await H.shot(ba, 'courier-panel-sent-laptop');
    await closeAll(ba);
  });

  await check('within a few seconds the Explorer\'s From the Ironbow list shows it on the road', async () => {
    await ex.waitForFunction(() => !document.querySelector('[data-test=from-ironbow]').hidden, null, { timeout: 6000 });
    equal(await ex.$$eval('[data-test=parcel-line]', l => l.map(x => x.getAttribute('data-kind') + ' | ' + x.querySelector('[data-test=parcel-text]').textContent)),
      ['on_road | On the road: due at ' + SLADE + ' on Day 24.']);
  });

  await check('two camps later it waits at Slade’s Muster: the forecast said it was due, the Bastion\'s word says it\'s waiting', async () => {
    const w = await passDays(ex, ba, 2);
    assert(/A parcel from the Ironbow is due at Slade’s Muster/.test(w.exWord), 'the Explorer\'s word: ' + w.exWord);
    assert(!/arrived|collected/i.test(w.exWord), 'the forecast never says arrived or collected: ' + w.exWord);
    assert(/A parcel is waiting at Slade’s Muster for the party to collect\./.test(w.baWord), 'the Bastion\'s word: ' + w.baWord);
    const s = await bas(ba);
    const p = s.tradeNetwork.parcels[0];
    equal([s.day, p.status, p.arrivedDay], [24, 'ready', 24]);
    await openCourier(ba);
    assert(/^Waiting at Slade’s Muster since Day 24, for the party to collect/.test(await bare(ba, '[data-test=parcels-waiting] [data-test=parcel]')), await bare(ba, '[data-test=parcels-waiting]'));
    equal(await ba.$eval('[data-test=send-parcel]', b => b.disabled), false, 'a waiting parcel doesn\'t take a place');
    await closeAll(ba);
    await ex.waitForFunction(() => { const l = document.querySelector('[data-test=parcel-line]'); return l && l.getAttribute('data-kind') === 'waiting'; }, null, { timeout: 6000 });
    equal(await bare(ex, '[data-test=parcel-text]'), 'Waiting at ' + SLADE + ' since Day 24: collect it from the town picture at ' + SLADE + '.');
  });

  await check('Slade’s Muster\'s town picture has a courier post; Collect… asks first, and Cancel changes nothing', async () => {
    await loadMap(ex, 'eastern_province_north');
    await openTown(ex, 'slades_muster');
    await ex.waitForSelector('[data-test=collect-parcel]');
    equal(await bare(ex, '[data-test=post-parcel]'), '3 Expedition Provision Packs, 1 Overland chart (3 days of use) · Waiting here since Day 24.Collect…');
    const fit = await townFits(ex);
    equal(fit, { inside: true, sideways: false, inView: true }, 'the town picture fits the laptop');
    await H.shot(ex, 'courier-post-laptop');
    const before = await exs(ex);
    await ex.waitForTimeout(400);
    await ex.click('[data-test=collect-parcel]');
    await ex.waitForSelector('[data-test=collect-dialog]');
    equal(await bare(ex, '[data-test=collect-dialog] .tsi-modal__title'), 'Collect the parcel at ' + SLADE + '?');
    equal(await bare(ex, '[data-test=collect-dialog] .tsi-modal__body'), 'Only collect it when the party is at ' + SLADE + '. Its contents go into the Travel bags: 3 Expedition Provision Packs, 1 Overland chart (3 days of use).');
    equal(await ex.$$eval('[data-test=collect-dialog] .tsi-modal__foot button', l => l.map(b => b.textContent)), ['Cancel', 'The party is here: collect']);
    equal((await H.layoutCheck(ex, ['[data-test=collect-dialog]'])).outOfView, [], 'the question fits the laptop');
    await ex.click('[data-test=collect-dialog] .tsi-modal__foot button:text-is("Cancel")');
    await ex.waitForTimeout(500);
    const after = await exs(ex);
    equal([after.journey.inventory, after.journey.outbox], [before.journey.inventory, before.journey.outbox], 'the Travel bags and Sent to the Bastion');
    equal((await bas(ba)).tradeNetwork.parcels[0].status, 'ready', 'still waiting');
  });

  await check('The party is here: collect puts 3 packs and 1 chart (3 days of use) in the Travel bags, once, and sends the pickup', async () => {
    const before = await exs(ex);
    await ex.waitForTimeout(400);
    await ex.dblclick('[data-test=collect-parcel]');
    await ex.waitForSelector('[data-test=collect-dialog]');
    await ex.waitForTimeout(300);
    equal(await ex.$$eval('[data-test=collect-dialog]', l => l.length), 1, 'one question');
    await ex.dblclick('[data-test=collect-dialog] .tsi-modal__foot button:text-is("The party is here: collect")');
    await ex.waitForSelector('[data-test=post-done]:not([hidden])');
    await ex.waitForTimeout(400);
    const s = await exs(ex);
    equal([bag(s, PACK) - bag(before, PACK), bag(s, CHART) - bag(before, CHART)], [3, 3]);
    equal(s.journey.outbox.map(m => [m.type, m.point, m.id === s.journey.outbox[0].parcel + ':collect:0']), [['parcel_collected', 'slades_muster', true]], 'one pickup');
    equal(await bare(ex, '[data-test=notice]'), 'Collected at ' + SLADE + ': 3 Expedition Provision Packs, 1 Overland chart (3 days of use).');
    equal(await bare(ex, '[data-test=post-done]'), 'Collected at ' + SLADE + ': 3 Expedition Provision Packs, 1 Overland chart (3 days of use), now in the Travel bags. Sent to the Bastion.');
    equal(await ex.$$eval('[data-test=collect-parcel]', l => l.length), 0, 'no Collect… any more');
    await closeAll(ex);
  });

  await check('the Bastion closes the parcel once, with a notice and "Parcel collected: Slade’s Muster" in Management\'s Changes from the Explorer; the Explorer says Applied', async () => {
    await ba.waitForFunction(() => TSI.bastion.debug.state().tradeNetwork.parcels[0].status === 'collected', null, { timeout: 8000 });
    await H.waitForNotice(ba, /Collected at Slade’s Muster: 3 Expedition Provision Packs, 1 Overland chart[^.]* \(from the Explorer\)\./);
    const s = await bas(ba);
    const p = s.tradeNetwork.parcels[0];
    equal([p.status, p.collectedDay, p.collectId, qty(s, PACK), qty(s, CHART), s.treasuryGP], ['collected', 24, p.id + ':collect:0', 2, 1, 55]);
    equal(Object.values(s.bridge.done).map(r => [r.r, r.type, r.point, r.held, r.hr]), [['applied', 'parcel_collected', 'slades_muster', false, 0]], 'one receipt, no Honour/Respect');
    await openCourier(ba);
    assert(/^Collected at Slade’s Muster on Day 24 · 3 Expedition Provision Packs/.test(await bare(ba, '[data-test=parcels-closed] [data-test=parcel]')), await bare(ba, '[data-test=parcels-closed]'));
    await closeAll(ba);
    await ba.click('[data-test=open-management]');
    await ba.waitForSelector('[data-test=explorer-change]');
    assert(/Parcel collected: Slade’s Muster/.test(await bare(ba, '[data-test=explorer-change]')), await bare(ba, '[data-test=explorer-change]'));
    await closeAll(ba);
    await ex.waitForFunction(() => document.querySelector('[data-test=sent]').getAttribute('data-status') === 'applied', null, { timeout: 8000 });
    equal(await ex.$eval('[data-test=sent] strong', n => n.textContent), 'Parcel collected: ' + SLADE);
    equal(await bare(ex, '[data-test=sent-line]'), 'Applied on Day 24: the Bastion recorded the parcel at ' + SLADE + ' as collected.');
    equal(await ex.$$eval('[data-test=parcel-line]', l => l.map(x => x.getAttribute('data-kind') + ' | ' + x.querySelector('[data-test=parcel-text]').textContent)), ['collected | Collected at ' + SLADE + ' on Day 24.']);
  });

  await check('a reload of both windows adds nothing: the Travel bags, the Warehouse and the treasury stay the same, and there\'s no Collect…', async () => {
    const e0 = await exs(ex);
    const b0 = await bas(ba);
    await ex.reload();
    await ex.waitForSelector('[data-test=camp]');
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    await ex.waitForTimeout(2600);
    const e1 = await exs(ex);
    const b1 = await bas(ba);
    equal([e1.journey.inventory, e1.journey.outbox.length], [e0.journey.inventory, 1]);
    equal([qty(b1, PACK), qty(b1, CHART), b1.treasuryGP, b1.tradeNetwork.parcels, Object.keys(b1.bridge.done).length],
      [qty(b0, PACK), qty(b0, CHART), b0.treasuryGP, b0.tradeNetwork.parcels, 1]);
    await openTown(ex, 'slades_muster');
    equal(await ex.$$eval('[data-test=collect-parcel]', l => l.length), 0);
    equal(await ex.$eval('[data-test=post-parcel]', n => n.getAttribute('data-kind')), 'collected');
    await closeAll(ex);
  });

  /* ------------------------------------------------------------------ */
  section('Level 2: eight towns, two parcels on the road, up to 10 items');

  await check('at Level 2 the panel and the Send dialog list all eight towns, each with its days and fee', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.facilityLevels.courier_exchange = 2;
      s.warehouse.forEach(w => { if (w.goodId === 'expedition_provision_pack') w.qty = 10; if (w.goodId === 'overland_chart') w.qty = 3; });
    }));
    await openCourier(ba);
    assert(/^Level 2: 2 parcels travelling at a time, up to 10 items each\. Reaches: Slade’s Muster, Moorcastle, Bretan, Middlemount, Timberport, Goldport, Swyth, Bleakharbour\./.test(await bare(ba, '[data-test=courier-status]')), await bare(ba, '[data-test=courier-status]'));
    await fillParcel(ba, { [PACK]: 10, [CHART]: 1 }, 'bretan');
    equal(await ba.$$eval('[data-test=parcel-point] option', o => o.map(x => x.textContent)), [
      SLADE + ' · 2 days · 5 gp', 'Moorcastle · 4 days · 10 gp', 'Bretan · 5 days · 10 gp', 'Middlemount · 6 days · 20 gp',
      'Timberport · 7 days · 20 gp', 'Goldport · 7 days · 20 gp', 'Swyth · 10 days · 30 gp', 'Bleakharbour · 12 days · 30 gp']);
    equal(await bare(ba, '[data-test=parcel-problem]'), 'That\'s 11 items: a parcel from a Level 2 Courier Exchange holds up to 10 items.');
    await ba.fill('[data-test=parcel-qty-' + PACK + ']', '2');
    await ba.fill('[data-test=parcel-qty-' + CHART + ']', '0');
    await ba.waitForTimeout(200);
    equal(await bare(ba, '[data-test=parcel-summary]'), '2 items of 10 · fee 10 gp · leaves today, reaches Bretan on Day 29 and waits there until the party collects it.');
    await ba.click('[data-test=parcel-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(450);
    await closeAll(ba);
    const s = await bas(ba);
    equal([parcel(s, 'bretan').status, parcel(s, 'bretan').readyDay, s.treasuryGP, qty(s, PACK)], ['in_transit', 29, 45, 8]);
  });

  await check('a second parcel, to Bleakharbour (12 days), takes the second place; a third can\'t go, and the panel says when a place is free', async () => {
    await sendParcel(ba, { [PACK]: 4, [CHART]: 1 }, 'bleakharbour');
    const s = await bas(ba);
    equal([parcel(s, 'bleakharbour').status, parcel(s, 'bleakharbour').readyDay, s.treasuryGP, qty(s, PACK), qty(s, CHART)], ['in_transit', 36, 15, 4, 2]);
    await openCourier(ba);
    equal(await ba.$eval('[data-test=send-parcel]', b => b.disabled), true);
    equal(await bare(ba, '[data-test=parcel-why]'), 'All 2 travelling places are taken: the first place is free on Day 29.');
    assert(/^Travelling \(2 of 2 places\)/.test(await ba.$eval('[data-test=parcels-travelling]', n => n.parentNode.textContent)), 'two of two places');
    equal(await ba.$$eval('[data-test=parcels-travelling] [data-test=recall-parcel]', l => l.length), 2, 'each can be recalled');
    await closeAll(ba);
    await ex.waitForFunction(() => document.querySelectorAll('[data-test=parcel-line][data-kind=on_road]').length === 2, null, { timeout: 6000 });
    equal(await ex.$$eval('[data-test=parcel-line]', l => l.map(x => x.getAttribute('data-kind') + ' | ' + x.querySelector('[data-test=parcel-text]').textContent)),
      ['on_road | On the road: due at Bretan on Day 29.', 'on_road | On the road: due at Bleakharbour on Day 36.', 'collected | Collected at ' + SLADE + ' on Day 24.'],
      'the parcel collected today is still listed');
  });

  /* ------------------------------------------------------------------ */
  section('Recall parcel…');

  await check('two days out, Recall parcel… asks first, saying when it\'s home; Cancel changes nothing', async () => {
    await passDays(ex, ba, 2);
    const s = await bas(ba);
    equal([s.day, parcel(s, 'bretan').status], [26, 'in_transit']);
    await ex.waitForFunction(() => document.querySelectorAll('[data-test=parcel-line]').length === 2, null, { timeout: 6000 });
    equal(await ex.$$eval('[data-test=parcel-line]', l => l.map(x => x.getAttribute('data-kind'))), ['on_road', 'on_road'], 'two days on, the collected parcel has left From the Ironbow');
    await openCourier(ba);
    await ba.waitForTimeout(400);
    await ba.click('[data-test=parcel][data-parcel="' + parcel(s, 'bretan').id + '"] [data-test=recall-parcel]');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Recall parcel")');
    const text = await lastModal(ba);
    assert(text.includes('Recall the parcel bound for Bretan? It turns back now and is home on Day 28 (2 days away). Its contents (2 Expedition Provision Packs) go back into the Warehouse then. The 10 gp fee isn\'t refunded.'), text);
    await H.shot(ba, 'courier-recall-laptop');
    await H.clickModal(ba, 'Cancel');
    await ba.waitForTimeout(300);
    equal(parcel(await bas(ba), 'bretan').status, 'in_transit', 'still on its way');
    await closeAll(ba);
  });

  await check('Recall parcel: it turns back, still takes its place until it\'s home, can\'t be recalled twice, and the fee stays spent', async () => {
    const before = await bas(ba);
    await openCourier(ba);
    await ba.waitForTimeout(400);
    await ba.click('[data-test=parcel][data-parcel="' + parcel(before, 'bretan').id + '"] [data-test=recall-parcel]');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Recall parcel")');
    await H.clickModal(ba, 'Recall parcel');
    await ba.waitForTimeout(450);
    const s = await bas(ba);
    const p = parcel(s, 'bretan');
    equal([p.status, p.recalledDay, p.returnDay, s.treasuryGP, qty(s, PACK)], ['returning', 26, 28, before.treasuryGP, 4]);
    assert(/^Recalled on the way to Bretan: back at the Ironbow on Day 28/.test(await bare(ba, '[data-test=parcels-returning] [data-test=parcel]')), await bare(ba, '[data-test=parcels-returning]'));
    equal(await ba.$$eval('[data-test=recall-parcel]', l => l.length), 1, 'only Bleakharbour\'s can be recalled now');
    equal(await bare(ba, '[data-test=parcel-why]'), 'All 2 travelling places are taken: the first place is free on Day 28.');
    await closeAll(ba);
    await ex.waitForFunction(() => document.querySelector('[data-test=parcel-line][data-kind=returning]'), null, { timeout: 6000 });
    equal(await ex.$eval('[data-test=parcel-line][data-kind=returning] [data-test=parcel-text]', n => n.textContent), 'Recalled: on its way back to the Ironbow (home on Day 28). It can\'t be collected.');
  });

  await check('Bretan\'s courier post has no Collect… for the recalled parcel', async () => {
    await loadMap(ex, 'eastern_province_south');
    await openTown(ex, 'bretan');
    await ex.waitForFunction(() => document.querySelector('[data-test=post-parcel]'), null, { timeout: 6000 });
    equal(await ex.$eval('[data-test=post-parcel]', n => n.getAttribute('data-kind')), 'returning');
    equal(await ex.$$eval('[data-test=collect-parcel]', l => l.length), 0);
    await closeAll(ex);
  });

  await check('two days later it\'s home: its 2 packs are back in the Warehouse once, nothing is refunded, and a reload adds nothing', async () => {
    const before = await bas(ba);
    const w = await passDays(ex, ba, 2);
    assert(/The recalled parcel is back at the Ironbow; its contents \(2 Expedition Provision Packs\) are back in the Warehouse\./.test(w.baWord), w.baWord);
    assert(/A recalled parcel is due back at the Ironbow/.test(w.exWord), 'the forecast: ' + w.exWord);
    let s = await bas(ba);
    equal([s.day, parcel(s, 'bretan').status, qty(s, PACK), s.treasuryGP], [28, 'returned', 6, before.treasuryGP]);
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    await ba.waitForTimeout(1500);
    s = await bas(ba);
    equal([parcel(s, 'bretan').status, qty(s, PACK), s.treasuryGP], ['returned', 6, before.treasuryGP]);
    await openCourier(ba);
    equal(await ba.$eval('[data-test=send-parcel]', b => b.disabled), false, 'its place is free again');
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Under Repair and Demolish');

  await check('Under Repair: Send a parcel… is off with the reason; the parcel to Bleakharbour carries on and can still be recalled', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.repairs = s.repairs || {}; s.repairs.courier_exchange = s.day + 3; }));
    await openCourier(ba);
    equal(await ba.$eval('[data-test=send-parcel]', b => b.disabled), true);
    equal(await bare(ba, '[data-test=parcel-why]'), 'The Courier Exchange is Under Repair until Day 31.');
    equal(await ba.$eval('[data-test=recall-parcel]', b => b.disabled), false, 'Recall parcel… still works');
    await H.shot(ba, 'courier-repair-laptop');
    await closeAll(ba);
    await passDays(ex, ba, 1);
    const s = await bas(ba);
    equal([parcel(s, 'bleakharbour').status, parcel(s, 'bleakharbour').readyDay], ['in_transit', 36]);
    await ba.evaluate(() => TSI.bastion.debug.change(st => { delete st.repairs.courier_exchange; }));
  });

  await check('Demolish… says the parcel already sent carries on (Cancel keeps the Courier Exchange)', async () => {
    await openCourier(ba);
    await ba.waitForTimeout(400);
    await ba.click('[data-test=demolish-courier_exchange]');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Cancel")');
    const t = await lastModal(ba);
    assert(/The parcel already sent carries on: it still arrives and can be collected \(or, if it was recalled, still comes home\), but it can no longer be recalled\./.test(t), t);
    await H.clickModal(ba, 'Cancel');
    await ba.waitForTimeout(300);
    equal((await bas(ba)).builtPlots[0], { facId: 'courier_exchange', status: 'built' });
    await closeAll(ba);
  });

  await check('the Courier Exchange panel fits the laptop with no sideways scroll, and Send a parcel… is in view as it opens', async () => {
    await openCourier(ba);
    equal(await panelFits(ba), { sideways: false, outOfView: [], underFooter: false });
    await H.shot(ba, 'courier-panel-laptop');
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Harry\'s sample file (tests/fixtures/bastion-pr6-sample.json), on the test page');

  await check('on the test page, with only the Bastion open, the sample imports (the Courier Exchange at Level 2 on a plot, 300 gp, 6 packs and 2 charts); then the Explorer opens beside it, and a parcel the party collected earlier is skipped, not applied', async () => {
    const c2 = await context(browser, 'laptop');
    /* Earlier testing on the test page: a parcel collected at Slade’s Muster. */
    const e0 = await openExplorer(c2, HARNESS);
    await e0.waitForTimeout(600);
    const b0 = await c2.newPage();
    await b0.goto(HARNESS + '?tool=bastion');
    await b0.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    await b0.evaluate(() => TSI.bastion.debug.change(s => {
      s.partyLevel = 9;
      s.builtPlots = [{ facId: 'courier_exchange', status: 'built' }];
      s.facilityLevels.courier_exchange = 1;
      s.tradeNetwork.parcels = [{ id: 'earlier-parcel', point: 'slades_muster', goods: [{ goodId: 'expedition_provision_pack', qty: 2 }], items: 2,
        departDay: 1, readyDay: 1, status: 'ready', arrivedDay: 1, collectedDay: null, collectId: null, recalledDay: null, returnDay: null, feeGP: 5 }];
    }));
    const got = await e0.evaluate(async () => {
      const st = TSI.explorer.debug.state();
      let b = null;
      for (let n = 0; n < 40; n++) {
        b = await TSI.store.fresh('tsi.bastion.state', null);
        if (TSI.bridge.parcels(b).some(p => p.id === 'earlier-parcel')) break;
        await new Promise(r => setTimeout(r, 250));
      }
      const r = TSI.explorer.journey.collectParcel(st, 'earlier-parcel', 'slades_muster', b, { memory: TSI.store.mode === 'memory' });
      if (r.ok) TSI.store.set('tsi.explorer.save', TSI.explorer.rules.toSave(st));
      return r;
    });
    assert(got.ok, JSON.stringify(got));
    await b0.waitForFunction(() => TSI.bastion.debug.state().tradeNetwork.parcels[0].status === 'collected', null, { timeout: 8000 });
    await e0.close();
    await b0.close();
    /* The sample, with only the Bastion open. */
    const b3 = await c2.newPage();
    await b3.goto(HARNESS + '?tool=bastion');
    await b3.waitForFunction(() => TSI.bastion && TSI.bastion.debug, null, { timeout: 8000 });
    await H.chooseFile(b3, '[data-test=import-save]', SAMPLE);
    await H.clickModal(b3, 'Import');
    await b3.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().facilityLevels.courier_exchange === 2, null, { timeout: 8000 });
    /* The box that says what changed holds the Bastion until it is read (the Strip Back Overhaul). */
    await H.ackChanges(b3);
    const e3 = await openExplorer(c2, HARNESS);
    await e3.waitForTimeout(500);
    await b3.waitForFunction(() => TSI.bastion.debug.state().anchored && !TSI.bastion.debug.state().bridge.fresh, null, { timeout: 8000 });
    const s = await bas(b3);
    equal([s.treasuryGP, s.partyLevel, s.builtPlots.filter(Boolean), s.facilityLevels.courier_exchange, qty(s, PACK), qty(s, CHART), s.tradeNetwork.parcels],
      [300, 9, [{ facId: 'courier_exchange', status: 'built' }], 2, 6, 2, []]);
    equal(Object.values(s.bridge.done).map(r => [r.r, r.type]), [['skipped', 'parcel_collected']], 'the earlier pickup is skipped');
    await e3.waitForFunction(() => { const n = document.querySelector('[data-test=sent]'); return n && n.getAttribute('data-status') === 'skipped'; }, null, { timeout: 8000 });
    equal(await bare(e3, '[data-test=sent-line]'), 'Skipped: collected before this Bastion started.');
    /* The sample's Courier Exchange works: a parcel to Moorcastle (Level 2). */
    await b3.click('[data-test=tile-courier_exchange]');
    await b3.waitForSelector('[data-test=send-parcel]');
    equal(await b3.$eval('[data-test=send-parcel]', b => b.disabled), false);
    await closeAll(b3);
    equal(c2.log.errors, [], 'no page errors');
    equal(c2.log.net, [], 'nothing online');
    await c2.close();
  });

  await check('the real suite (index.html) refuses the sample, which is a test-page file, and changes nothing', async () => {
    const c3 = await context(browser, 'laptop');
    const b4 = await c3.newPage();
    await b4.goto(INDEX + '?tool=bastion');
    await b4.waitForFunction(() => TSI.bastion && TSI.bastion.debug, null, { timeout: 8000 });
    const before = await bas(b4);
    await H.chooseFile(b4, '[data-test=import-save]', SAMPLE);
    assert(/came from the suite's test page/.test(await H.modalText(b4)), await H.modalText(b4));
    await H.clickModal(b4, 'OK');
    const after = await bas(b4);
    equal([after.treasuryGP, after.builtPlots, after.warehouse], [before.treasuryGP, before.builtPlots, before.warehouse]);
    await c3.close();
  });

  /* ------------------------------------------------------------------ */
  section('The TV (1920 × 1080)');

  await check('the Courier Exchange panel (full, at Level 2), the Send dialog, + Add supplies, the courier post and Collect… fit the TV', async () => {
    await ex.close();
    await ba.close();
    tv = await context(browser, 'tv');
    e2 = await openExplorer(tv);
    await e2.waitForTimeout(500);
    const b2 = await openBastion(tv);
    await b2.evaluate(() => TSI.bastion.debug.change(s => {
      s.partyLevel = 9;
      s.builtPlots = [{ facId: 'courier_exchange', status: 'built' }];
      s.facilityLevels.courier_exchange = 2;
      s.treasuryGP = 300;
      s.warehouse = [
        { id: 'w1', goodId: 'expedition_provision_pack', item: 'Expedition Provision Pack', qty: 6, gp: '', notes: '' },
        { id: 'w2', goodId: 'overland_chart', item: 'Overland chart', qty: 2, gp: '', notes: '' }];
      const P = (id, point, status, extra) => Object.assign({ id, point, goods: [{ goodId: 'expedition_provision_pack', qty: 2 }, { goodId: 'overland_chart', qty: 1 }], items: 3,
        departDay: 1, readyDay: 8, status, arrivedDay: null, collectedDay: null, collectId: null, recalledDay: null, returnDay: null, feeGP: 20 }, extra || {});
      s.tradeNetwork.parcels = [
        P('tvparcel01', 'bleakharbour', 'in_transit', { readyDay: 13 }),
        P('tvparcel02', 'slades_muster', 'ready', { arrivedDay: 1, readyDay: 1, feeGP: 5 }),
        P('tvparcel03', 'goldport', 'ready', { arrivedDay: 1 }),
        P('tvparcel04', 'moorcastle', 'collected', { arrivedDay: 1, collectedDay: 1, collectId: 'tvparcel04:collect:0' }),
        P('tvparcel05', 'timberport', 'returned', { recalledDay: 1, returnDay: 1 }),
        P('tvparcel06', 'swyth', 'collected', { arrivedDay: 1, collectedDay: 1, collectId: 'tvparcel06:collect:0' })
      ];
    }));
    await openCourier(b2);
    equal(await panelFits(b2), { sideways: false, outOfView: [], underFooter: false }, 'the panel');
    await H.shot(b2, 'courier-panel-tv');
    await b2.click('[data-test=send-parcel]');
    await b2.waitForSelector('[data-test=parcel-dialog]');
    equal((await H.layoutCheck(b2, ['[data-test=parcel-dialog]'])).outOfView, [], 'the Send dialog');
    await H.shot(b2, 'courier-send-tv');
    await b2.click('[data-test=parcel-dialog] .tsi-modal__foot button:text-is("Cancel")');
    await openWarehouse(b2);
    await b2.waitForTimeout(400);
    await b2.click('[data-test=add-supplies]');
    await b2.waitForSelector('[data-test=supplies-dialog]');
    equal((await H.layoutCheck(b2, ['[data-test=supplies-dialog]'])).outOfView, [], '+ Add supplies');
    await b2.click('[data-test=supplies-dialog] .tsi-modal__foot button:text-is("Cancel")');
    await closeAll(b2);
    await loadMap(e2, 'eastern_province_north');
    await openTown(e2, 'slades_muster');
    await e2.waitForSelector('[data-test=collect-parcel]');
    equal(await townFits(e2), { inside: true, sideways: false, inView: true }, 'the town picture with its courier post');
    await H.shot(e2, 'courier-post-tv');
    await e2.waitForTimeout(400);
    await e2.click('[data-test=collect-parcel]');
    await e2.waitForSelector('[data-test=collect-dialog]');
    equal((await H.layoutCheck(e2, ['[data-test=collect-dialog]'])).outOfView, [], 'the Collect question');
    await e2.click('[data-test=collect-dialog] .tsi-modal__foot button:text-is("Cancel")');
    await closeAll(e2);
    const lay = await H.layoutCheck(e2, ['[data-test=camp]']);
    assert(lay.scrollWidth <= lay.clientWidth, 'sideways scroll in the Explorer');
  });

  await check('a browser that isn\'t saving: Collect… is off, and the courier post says why', async () => {
    const before = await exs(e2);
    await e2.evaluate(() => Object.defineProperty(TSI.store, 'mode', { get: () => 'memory', configurable: true }));
    await openTown(e2, 'slades_muster');
    await e2.waitForSelector('[data-test=collect-parcel]');
    equal(await e2.$eval('[data-test=collect-parcel]', b => b.disabled), true);
    equal(await bare(e2, '[data-test=post-line]'), 'This browser isn\'t saving, so the Bastion can\'t see the pickup.');
    await e2.click('[data-test=collect-parcel]', { force: true });
    await e2.waitForTimeout(400);
    equal(await e2.$('[data-test=collect-dialog]'), null, 'no question');
    await closeAll(e2);
    const after = await exs(e2);
    equal([after.journey.inventory, after.journey.outbox], [before.journey.inventory, before.journey.outbox], 'nothing collected');
    equal(tv.log.errors, [], 'no page errors on the TV');
    equal(tv.log.net, [], 'nothing online on the TV');
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
