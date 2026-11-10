/* The Courier Exchange's Levels 3 to 5 (Harry, 10 November 2026), clicked through from a double-clicked index.html with the internet off,
   the Explorer and the Bastion open side by side:
   - Level 3: Send to the Ironbow… at a town's courier post: items leave the Travel bags, the Bastion takes the cargo once, it reaches the
     Warehouse on arrival; it is off, with the reason, below Level 3;
   - Level 4: a Priority tick (the Send dialog and the Explorer's): half the days, double the fee;
   - Level 5: one parcel for two towns, one place, one fee; four places;
   - the dialogs fit the laptop and the TV.
   Run with:  node tests/e2e/courier-levels.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const PACK = 'expedition_provision_pack';
const SLADE = 'Slade’s Muster';

const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exs = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const qty = (s, id) => s.warehouse.filter(w => w.goodId === id).reduce((n, w) => n + w.qty, 0);
const bag = (s, kind) => (s.journey.inventory || []).filter(i => i.kind === kind).reduce((n, i) => n + i.qty, 0);

async function context(browser, size) {
  const ctx = await H.newContext(browser, size || 'laptop');
  await ctx.setOffline(true);
  await ctx.addInitScript(() => { Math.random = () => 0.99; });
  return ctx;
}
async function closeAll(page) {
  for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
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
/* The Courier Exchange built at a level, 500 gp, 10 packs in the Warehouse (set up directly). */
async function setBastion(ba, level) {
  await ba.evaluate(lv => TSI.bastion.debug.change(s => {
    s.partyLevel = 9;
    s.treasuryGP = 500;
    s.builtPlots = [{ facId: 'courier_exchange', status: 'built' }, ''];
    s.facilityLevels = Object.assign({}, s.facilityLevels, { courier_exchange: lv });
    s.tradeNetwork.parcels = [];
  }), level);
  await ba.waitForTimeout(500);
}
async function addPacks(ba, n) {
  await closeAll(ba);
  await ba.click('[data-test=open-warehouse]');
  await ba.waitForSelector('[data-test=add-supplies]');
  await ba.waitForTimeout(400);
  await ba.click('[data-test=add-supplies]');
  await ba.waitForSelector('[data-test=supplies-dialog]');
  await ba.selectOption('[data-test=supplies-good]', PACK);
  await ba.fill('[data-test=supplies-qty]', String(n));
  await ba.click('[data-test=supplies-dialog] .tsi-modal__foot .tsi-btn--primary');
  await ba.waitForTimeout(400);
  await closeAll(ba);
}
async function openCourier(ba) {
  await closeAll(ba);
  await ba.click('[data-test=tile-courier_exchange]');
  await ba.waitForSelector('[data-test=courier]');
}
async function giveBags(ex, kind, n) {
  await ex.evaluate(([k, c]) => { const st = TSI.explorer.debug.state(); TSI.explorer.journey.addItem(st, k, c); }, [kind, n]);
}
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
async function bastionReaches(ba, day) {
  for (let n = 0; n < 120; n++) {
    if (await ba.$('[data-test=ironbow-word]')) await ba.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary');
    const ok = await ba.evaluate(d => { const s = TSI.bastion.debug.state(); return s.day === d && !s.dayInProgress && !TSI.bastion.debug.busy(); }, day);
    if (ok && !(await ba.$('[data-test=ironbow-word]'))) return;
    await ba.waitForTimeout(250);
  }
  throw new Error('The Bastion didn\'t reach Day ' + day);
}
async function camp(ex) {
  await ex.waitForTimeout(400);
  await ex.click('[data-test=camp]');
  for (let n = 0; n < 20; n++) {
    await ex.waitForTimeout(200);
    if (!(await ex.$('.tsi-modal'))) { if (n > 2) break; continue; }
    await ex.click('.tsi-modal__foot button:last-child');
  }
}
/* Fits the screen: inside its pop-up, no sideways scroll, the main button in view. */
async function dialogFits(page, sel) {
  return page.evaluate(s => {
    const d = document.querySelector(s);
    const body = d.querySelector('.tsi-modal__body');
    const foot = d.querySelector('.tsi-modal__foot button:last-child').getBoundingClientRect();
    return { inside: body.scrollHeight - body.clientHeight <= 1, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth, inView: foot.bottom <= innerHeight && foot.top >= 0 };
  }, sel);
}

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  let ex = null;
  let ba = null;

  section('Level 2 can\'t send cargo home');

  await check('at Level 2 the courier post\'s Send to the Ironbow… is off, saying why', async () => {
    ex = await openExplorer(ctx);
    await ex.waitForTimeout(600);
    ba = await openBastion(ctx);
    await setBastion(ba, 2);
    await giveBags(ex, PACK, 4);
    await loadMap(ex, 'eastern_province_north');
    await openTown(ex, 'slades_muster');
    await ex.waitForTimeout(500);
    equal(await ex.$eval('[data-test=send-cargo]', b => b.disabled), true);
    assert(/Level 3/.test(await bare(ex, '[data-test=send-why]')), await bare(ex, '[data-test=send-why]'));
  });

  section('Level 3: cargo home');

  await check('at Level 3 it is on; the dialog takes whole items, shows the fee and when it arrives, and fits the laptop', async () => {
    await setBastion(ba, 3);
    await ex.waitForTimeout(2500);
    await openTown(ex, 'slades_muster');
    await ex.waitForTimeout(500);
    equal(await ex.$eval('[data-test=send-cargo]', b => b.disabled), false);
    await ex.click('[data-test=send-cargo]');
    await ex.waitForSelector('[data-test=send-dialog]');
    equal(await ex.$('[data-test=send-priority]'), null, 'no Priority tick at Level 3');
    assert(await ex.$('[data-test=send-qty-' + PACK + ']'), 'the packs are listed');
    await ex.fill('[data-test=send-qty-' + PACK + ']', '20');
    await ex.waitForTimeout(200);
    assert(/holds only|only 4|hold only/.test(await bare(ex, '[data-test=send-problem]')), await bare(ex, '[data-test=send-problem]'));
    equal(await ex.$eval('[data-test=send-dialog] .tsi-modal__foot .tsi-btn--primary', b => b.disabled), true);
    await ex.fill('[data-test=send-qty-' + PACK + ']', '3');
    await ex.waitForTimeout(200);
    assert(/fee 5 gp/.test(await bare(ex, '[data-test=send-summary]')), await bare(ex, '[data-test=send-summary]'));
    const fit = await dialogFits(ex, '[data-test=send-dialog]');
    equal([fit.inside, fit.sideways, fit.inView], [true, false, true]);
  });

  await check('Send: the packs leave the bags, the Bastion takes the cargo once, charges the fee, and the Warehouse gets it on arrival', async () => {
    await ex.click('[data-test=send-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ex.waitForTimeout(600);
    await closeAll(ex);
    const e1 = await exs(ex);
    equal(bag(e1, PACK), 1, 'three packs left the bags');
    equal(e1.journey.outbox.slice(-1)[0].type, 'cargo_return');
    const day = e1.travel.day;
    const before = await bas(ba);
    await ba.waitForTimeout(2500);
    await ba.evaluate(() => TSI.bastion.debug.clock());
    await ba.waitForTimeout(1000);
    const s1 = await bas(ba);
    const p = s1.tradeNetwork.parcels.filter(x => x.status === 'inbound')[0];
    assert(p, 'an inbound parcel');
    equal([p.point, p.direction, p.feeGP, p.readyDay], ['slades_muster', 'in', 5, day + 2]);
    equal(s1.treasuryGP, 495, 'one fee of 5 gp from 500');
    equal(qty(s1, PACK), qty(before, PACK), 'not yet in the Warehouse');
    for (let i = 0; i < 2; i++) { await camp(ex); }
    const d2 = await ex.evaluate(() => TSI.explorer.debug.state().travel.day);
    await bastionReaches(ba, d2);
    const s2 = await bas(ba);
    equal(qty(s2, PACK), qty(before, PACK) + 3, 'three packs in the Warehouse, once');
    equal(s2.tradeNetwork.parcels.filter(x => x.status === 'delivered').length, 1);
    await openCourier(ba);
    assert(/Recently delivered/.test(await bare(ba, '[data-test=courier]')), 'the panel lists it');
    await closeAll(ba);
  });

  section('Level 4: Priority');

  await check('at Level 4 the Send dialog has a Priority tick: half the days, double the fee, in the town list and the summary', async () => {
    await setBastion(ba, 4);
    await addPacks(ba, 6);
    await openCourier(ba);
    await ba.waitForTimeout(300);
    await ba.click('[data-test=send-parcel]');
    await ba.waitForSelector('[data-test=parcel-dialog]');
    await ba.selectOption('[data-test=parcel-point]', 'moorcastle');
    await ba.fill('[data-test=parcel-qty-' + PACK + ']', '2');
    await ba.waitForTimeout(200);
    assert(/fee 10 gp/.test(await bare(ba, '[data-test=parcel-summary]')), await bare(ba, '[data-test=parcel-summary]'));
    await ba.check('[data-test=parcel-priority]');
    await ba.waitForTimeout(200);
    assert(/fee 20 gp \(Priority\)/.test(await bare(ba, '[data-test=parcel-summary]')), await bare(ba, '[data-test=parcel-summary]'));
    assert(/Moorcastle · 2 days · 20 gp/.test(await ba.$eval('[data-test=parcel-point]', n => n.options[n.selectedIndex].text)), 'the town list shows Priority\'s numbers');
    equal(await ba.$('[data-test=parcel-combined]'), null, 'no combined parcel at Level 4');
    const fit = await dialogFits(ba, '[data-test=parcel-dialog]');
    equal([fit.inside, fit.sideways, fit.inView], [true, false, true]);
    const before = await bas(ba);
    await ba.click('[data-test=parcel-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    await closeAll(ba);
    const s = await bas(ba);
    const p = s.tradeNetwork.parcels.filter(x => x.point === 'moorcastle').slice(-1)[0];
    equal([p.priority, p.feeGP, p.readyDay - p.departDay], [true, 20, 2]);
    equal(s.treasuryGP, before.treasuryGP - 20);
  });

  await check('in the Explorer, Priority cargo home to Slade’s Muster: 1 day and 10 gp', async () => {
    await giveBags(ex, PACK, 2);
    await ex.waitForTimeout(2500);
    await openTown(ex, 'slades_muster');
    await ex.waitForTimeout(500);
    await ex.evaluate(() => { const b = document.querySelector('[data-test=send-cargo]'); b.disabled = b.disabled; });
    await ex.click('[data-test=send-cargo]');
    await ex.waitForSelector('[data-test=send-dialog]');
    await ex.fill('[data-test=send-qty-' + PACK + ']', '2');
    await ex.check('[data-test=send-priority]');
    await ex.waitForTimeout(200);
    assert(/fee 10 gp \(Priority\)/.test(await bare(ex, '[data-test=send-summary]')), await bare(ex, '[data-test=send-summary]'));
    await ex.click('[data-test=send-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ex.waitForTimeout(600);
    await closeAll(ex);
    const m = (await exs(ex)).journey.outbox.slice(-1)[0];
    equal([m.type, m.priority], ['cargo_return', true]);
  });

  section('Level 5: a combined parcel');

  await check('at Level 5 one parcel goes to two towns on one fee, one place, each leg on its own days', async () => {
    await setBastion(ba, 5);
    await addPacks(ba, 10);
    await openCourier(ba);
    await ba.waitForTimeout(300);
    await ba.click('[data-test=send-parcel]');
    await ba.waitForSelector('[data-test=parcel-dialog]');
    equal(await ba.$eval('[data-test=parcel-second]', n => n.hidden), true);
    await ba.check('[data-test=parcel-combined]');
    await ba.waitForTimeout(200);
    equal(await ba.$eval('[data-test=parcel-second]', n => n.hidden), false);
    await ba.selectOption('[data-test=parcel-point]', 'slades_muster');
    await ba.selectOption('[data-test=parcel-point-2]', 'moorcastle');
    await ba.fill('[data-test=parcel-qty-' + PACK + ']', '2');
    await ba.fill('[data-test=parcel-qty-' + PACK + '-2]', '3');
    await ba.waitForTimeout(200);
    assert(/5 items of 30 in all · one fee 13 gp/.test(await bare(ba, '[data-test=parcel-summary]')), await bare(ba, '[data-test=parcel-summary]'));
    /* Two towns' lists are long: the pop-up's own body scrolls, but nothing goes sideways and the main button stays in view. */
    const fit = await dialogFits(ba, '[data-test=parcel-dialog]');
    equal([fit.sideways, fit.inView], [false, true]);
    const before = await bas(ba);
    await ba.click('[data-test=parcel-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    await closeAll(ba);
    const s = await bas(ba);
    const legs = s.tradeNetwork.parcels.filter(x => x.combo);
    equal(legs.map(p => [p.point, p.readyDay - p.departDay]), [['slades_muster', 2], ['moorcastle', 4]]);
    equal(s.treasuryGP, before.treasuryGP - 13);
    equal(qty(s, PACK), qty(before, PACK) - 5);
    assert(/Travelling \(1 of 4 places\)/.test(await ba.evaluate(() => { document.querySelector('[data-test=tile-courier_exchange]').click(); return document.querySelector('[data-test=parcels-travelling]').parentNode.textContent; })), 'one place of four');
    await closeAll(ba);
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'page errors');
    equal(ctx.log.net, [], 'internet');
    equal(ctx.log.failed, [], 'missing files');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
