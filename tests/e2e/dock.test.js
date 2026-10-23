/* The Dock takes the Port Charter system and the Routes map from the Hall of Emissaries (step S08
   of the Strip Back Overhaul, Harry, 22 October 2026), clicked through from a double-clicked
   index.html with the internet off:
   - the Dock panel has four tabs (Cargo, Orders, Port Charters, Routes) and opens on Cargo, with
     Ship cargo… in view; the arrow keys, Home and End move between the tabs;
   - Register Port Charter is a Dock order (under Orders): a 3-day order, "Dock: Register Port
     Charter (Goldport)";
   - the Port Charters tab holds each Charter's state and terms;
   - the Routes tab is the map of the Scarlett Isles: a Clan's route GLOWS for each registered Port
     Charter (one lane for the ports of one Clan), glows brighter with a ship at sea, and lights
     nothing for a Charter that is only earned; the pulse stops with "reduce motion";
   - the panel fits the laptop (1707 x 930 at 1.5) and the TV (1920 x 1080 at 1) on every tab, with no
     sideways scrolling;
   - an old Bastion whose Hall had a Register Port Charter order pending is converted: the order is
     at the Dock, with the same due day, and completes there.
   Run with:  node tests/e2e/dock.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));

const CHARTER = (id, port, clan, status, day) => ({ id: id, port: port, clan: clan, mode: 'commodity_backed', status: status, earnedDay: 1, registeredDay: status === 'registered' ? (day || 1) : null, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' });

async function open(browser, size) {
  const ctx = await H.newContext(browser, size, { backedUp: true });
  await ctx.setOffline(true);
  /* The Bastion reads the Explorer's day, so the Explorer is open beside it. */
  const ex = await ctx.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await ctx.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  return { ctx, ex, ba };
}
const close = async ba => { for (let i = 0; i < 4 && (await ba.$('.tsi-modal')); i++) { await ba.keyboard.press('Escape'); await ba.waitForTimeout(250); } };
async function openDock(ba) {
  await close(ba);
  await ba.click('[data-test=tile-dock]');
  await ba.waitForSelector('[data-test=dock-tabs]');
}
async function tab(ba, id) {
  await ba.click('[data-test=dock-tab-' + id + ']');
  await ba.waitForSelector('[data-test=dock-pane-' + id + ']');
}
/* The panel fits: no sideways scrolling anywhere in it, and (optionally) these are in view inside its scrolling body. */
async function panelFits(ba, sels) {
  return ba.evaluate(list => {
    const dlg = document.querySelector('[data-test=panel-fac-dock]');
    const body = dlg.querySelector('.tsi-modal__body');
    const out = { page: document.documentElement.scrollWidth <= document.documentElement.clientWidth, dialog: dlg.scrollWidth <= dlg.clientWidth + 1, body: body.scrollWidth <= body.clientWidth + 1, inDialog: dlg.getBoundingClientRect().right <= innerWidth + 0.5 && dlg.getBoundingClientRect().bottom <= innerHeight + 0.5, notInView: [] };
    const b = body.getBoundingClientRect();
    list.forEach(sel => {
      const el = dlg.querySelector(sel);
      if (!el) { out.notInView.push(sel + ' missing'); return; }
      const r = el.getBoundingClientRect();
      if (r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5 || r.left < b.left - 0.5 || r.right > b.right + 0.5) out.notInView.push(sel + ' ' + Math.round(r.top) + '-' + Math.round(r.bottom) + ' not in ' + Math.round(b.top) + '-' + Math.round(b.bottom));
    });
    return out;
  }, sels || []);
}

(async () => {
  const browser = await H.chromium.launch();
  let { ctx, ex, ba } = await open(browser, 'laptop');
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    s.facilityLevels.dock = 3;
    s.treasuryGP = 500;
    s.tradeNetwork.portCharters = [];
    s.warehouse = [{ id: 'w1', goodId: 'sawn_lumber', item: 'Sawn Lumber', qty: 3, gp: '', notes: '' }];
  }));
  await ba.waitForTimeout(500);

  /* ------------------------------------------------------------------ */
  section('The Dock panel: four tabs, opening on Cargo');

  await check('it opens on Cargo, with the tabs Cargo, Orders, Port Charters and Routes, and Ship cargo… in view on the laptop', async () => {
    await openDock(ba);
    equal(await ba.$$eval('[data-test=dock-tabs] [role=tab]', t => t.map(x => x.textContent)), ['Cargo', 'Orders', 'Port Charters', 'Routes']);
    equal(await ba.$$eval('[data-test=dock-tabs] [role=tab]', t => t.map(x => x.getAttribute('aria-selected'))), ['true', 'false', 'false', 'false']);
    equal(await ba.$eval('[data-test=dock-tabs]', n => n.getAttribute('data-tab')), 'cargo');
    const fit = await panelFits(ba, ['[data-test=ship-cargo]']);
    equal([fit.page, fit.dialog, fit.body, fit.inDialog, fit.notInView], [true, true, true, true, []]);
    equal(await ba.$eval('[data-test=ship-cargo]', b => b.classList.contains('tsi-btn--primary')), true, 'the one main button of the panel');
    await H.shot(ba, 'dock-cargo-laptop');
  });

  await check('the arrow keys, Home and End move between the tabs; the chosen tab is kept while the panel stays open and reset when it is opened again', async () => {
    await ba.focus('[data-test=dock-tab-cargo]');
    await ba.keyboard.press('ArrowRight');
    await ba.waitForSelector('[data-test=dock-pane-orders]');
    equal(await ba.evaluate(() => document.activeElement.getAttribute('data-test')), 'dock-tab-orders', 'the focus follows');
    await ba.keyboard.press('End');
    await ba.waitForSelector('[data-test=dock-pane-routes]');
    await ba.keyboard.press('ArrowLeft');
    await ba.waitForSelector('[data-test=dock-pane-charters]');
    await ba.keyboard.press('Home');
    await ba.waitForSelector('[data-test=dock-pane-cargo]');
    await tab(ba, 'routes');
    await close(ba);
    await openDock(ba);
    equal(await ba.$eval('[data-test=dock-tabs]', n => n.getAttribute('data-tab')), 'cargo', 'opens on Cargo again');
  });

  /* ------------------------------------------------------------------ */
  section('Register Port Charter is a Dock order');

  await check('the Orders tab holds Upgrade, Charter Berth and Register Port Charter; the Hall has no Register order', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.tradeNetwork.portCharters = [{ id: 'c-gold', port: 'goldport', clan: 'molten', mode: 'commodity_backed', status: 'earned', earnedDay: 1, registeredDay: null, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' }]; }));
    await ba.waitForTimeout(300);
    await tab(ba, 'orders');
    assert(await ba.$('[data-test="issue-dock__charter_berth"]'), 'Charter Berth');
    assert(await ba.$('[data-test="issue-dock__register_port_charter"]'), 'Register Port Charter');
    equal(await ba.$$eval('[data-test="sel-dock__register_port_charter"] option', o => o.map(x => x.textContent)), ['Port Charter: Goldport (Clan Molten)']);
    assert(/Takes 3 days/.test(await bare(ba, '[data-test="days-dock__register_port_charter"]')), 'three days');
    await ba.click('[data-test="issue-dock__register_port_charter"]');
    await ba.waitForTimeout(400);
    const s = await bas(ba);
    const o = s.pendingOrders.filter(x => x.fnId === 'register_port_charter')[0];
    equal([o.facId, o.label, o.dueDay - o.issuedDay, o.costGP, s.treasuryGP], ['dock', 'Dock: Register Port Charter (Goldport)', 3, 0, 500]);
    assert(/Dock: Register Port Charter \(Goldport\)/.test(await bare(ba, '.tsi-bas-facpanel__orders')), 'under "Orders pending here"');
    await tab(ba, 'charters');
    assert(/Being registered at the Dock \(ready Day 4\)/.test(await bare(ba, '[data-test=dock-charters]')));
    await close(ba);
    await ba.click('[data-test=tile-hall_of_emissaries]').catch(() => {});
    if (await ba.$('[data-test=panel-diplomacy]')) {
      equal(await ba.$('[data-test="issue-hall_of_emissaries__register_port_charter"]'), null, 'not in the Hall');
      await close(ba);
    }
  });

  /* ------------------------------------------------------------------ */
  section('The Routes map: a Clan glows for each registered Port Charter');

  await check('no registered Charter: the map shows, nothing glows, and the Charter that is only earned or being registered lights nothing but is listed', async () => {
    await openDock(ba);
    await tab(ba, 'routes');
    assert(await ba.$('[data-test=trade-map] img.tsi-bas-trademap__img'), 'the map of the Scarlett Isles');
    equal(await ba.$$('[data-test=trade-map] img.tsi-bas-trademap__route').then(l => l.length), 0);
    equal(await bare(ba, '[data-test=routes-shown]'), 'none');
    equal(await ba.$$eval('[data-test=routes-list] li', l => l.map(x => x.getAttribute('data-status'))), ['registering']);
  });

  await check('registered Charters at Goldport and Moltenport (Clan Molten) and Timberport (Clan Blackstone) light two lanes; Steelport (Clan Slade), only earned, lights none', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.pendingOrders = [];
      s.tradeNetwork.portCharters = [
        { id: 'c-gold', port: 'goldport', clan: 'molten', mode: 'commodity_backed', status: 'registered', earnedDay: 1, registeredDay: 1, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' },
        { id: 'c-mol', port: 'moltenport', clan: 'molten', mode: 'commodity_backed', status: 'registered', earnedDay: 1, registeredDay: 1, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' },
        { id: 'c-timb', port: 'timberport', clan: 'blackstone', mode: 'commodity_backed', status: 'registered', earnedDay: 1, registeredDay: 1, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' },
        { id: 'c-stee', port: 'steelport', clan: 'slade', mode: 'commodity_backed', status: 'earned', earnedDay: 1, registeredDay: null, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' }
      ];
    }));
    await ba.waitForSelector('[data-test=trade-map] img.tsi-bas-trademap__route');
    equal(await ba.$$eval('[data-test=trade-map] img.tsi-bas-trademap__route', l => l.map(x => [x.getAttribute('data-clan'), x.getAttribute('data-glow'), x.classList.contains('tsi-bas-trademap__route--sea')])), [['Blackstone', 'registered', false], ['Molten', 'registered', false]]);
    equal(await bare(ba, '[data-test=routes-shown]'), 'Blackstone, Molten');
    equal(await ba.$$eval('[data-test=routes-list] li', l => l.map(x => x.getAttribute('data-status'))), ['registered', 'registered', 'registered', 'earned']);
    const src = await ba.$eval('[data-test=trade-map] img.tsi-bas-trademap__route[data-clan=Molten]', i => i.getAttribute('src'));
    assert(/molten_trade_route\.png$/.test(src), src);
    equal(await ba.evaluate(() => [...document.querySelectorAll('[data-test=trade-map] img')].every(i => i.complete && i.naturalWidth > 0)), true, 'every picture loaded');
    await H.shot(ba, 'dock-routes-laptop');
  });

  await check('a ship at sea to a Clan makes its lane glow brighter (and the list says where it is); when the ship is home it is steady again', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.tradeNetwork.voyages = [{ id: 'v1', port: 'goldport', clan: 'molten', charterId: 'c-gold', mode: 'commodity_backed', cargo: [{ goodId: 'sawn_lumber', name: 'Sawn Lumber', qty: 1 }], departDay: 1, arriveDay: 8, returnDay: 15, stage: 'outbound', risk: 'high', basePct: 20, protections: [], chance: 20, scheduleId: null, outcome: null, recalledDay: null, roll: null, terms: null }];
    }));
    await ba.waitForSelector('img.tsi-bas-trademap__route--sea');
    equal(await ba.$$eval('[data-test=trade-map] img.tsi-bas-trademap__route', l => l.map(x => [x.getAttribute('data-clan'), x.getAttribute('data-glow')])), [['Blackstone', 'registered'], ['Molten', 'sea']]);
    equal(await bare(ba, '[data-test=routes-shown]'), 'Blackstone, Molten (a ship at sea)');
    assert(/Sailing to Goldport: arrives Day 8, home Day 15/.test(await bare(ba, '[data-test=route-row-goldport]')), await bare(ba, '[data-test=route-row-goldport]'));
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.tradeNetwork.voyages = []; }));
    await ba.waitForFunction(() => !document.querySelector('img.tsi-bas-trademap__route--sea'));
  });

  await check('the glow pulses by default and holds steady with "reduce motion"', async () => {
    const anim = () => ba.$eval('[data-test=trade-map] img.tsi-bas-trademap__route[data-clan=Molten]', i => getComputedStyle(i).animationName);
    equal(await anim(), 'tsi-bas-route-pulse');
    await ba.emulateMedia({ reducedMotion: 'reduce' });
    equal(await anim(), 'none');
    await ba.emulateMedia({ reducedMotion: 'no-preference' });
  });

  /* ------------------------------------------------------------------ */
  section('The panel fits the laptop and the TV on every tab');

  await check('laptop (1707 x 930, 1.5): no sideways scrolling on any tab', async () => {
    for (const id of ['cargo', 'orders', 'charters', 'routes']) {
      await tab(ba, id);
      const fit = await panelFits(ba, id === 'cargo' ? ['[data-test=ship-cargo]'] : []);
      equal([id, fit.page, fit.dialog, fit.body, fit.inDialog, fit.notInView], [id, true, true, true, true, []]);
    }
  });

  await check('no page errors, nothing reached for the internet', async () => {
    equal(ctx.log.errors, [], 'page errors');
    equal(ctx.log.net, [], 'internet');
    equal(ctx.log.failed, [], 'missing files');
  });
  await ctx.close();

  const tvr = await open(browser, 'tv');
  ctx = tvr.ctx; ex = tvr.ex; ba = tvr.ba;
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    s.facilityLevels.dock = 5;
    s.warehouse = [{ id: 'w1', goodId: 'sawn_lumber', item: 'Sawn Lumber', qty: 3, gp: '', notes: '' }];
    s.tradeNetwork.portCharters = ['goldport:molten', 'moltenport:molten', 'timberport:blackstone', 'steelport:slade', 'leatherport:karr', 'redport:farmer'].map((p, i) => ({ id: 'c' + i, port: p.split(':')[0], clan: p.split(':')[1], mode: 'commodity_backed', status: 'registered', earnedDay: 1, registeredDay: 1, terms: { priceMult: 1.1, feePerLot: 5, tariffPct: 4 }, from: { code: 'DM', title: 'DM award' }, text: '', termsLog: [{ day: 1, kind: 'amend', before: { priceMult: 1, feePerLot: 0, tariffPct: 0 }, after: { priceMult: 1.1, feePerLot: 5, tariffPct: 4 }, why: 'A feast.' }] }));
  }));
  await ba.waitForTimeout(500);
  section('The TV (1920 x 1080, 1)');
  await check('no sideways scrolling on any tab, Ship cargo… in view, six Charters with their terms', async () => {
    await openDock(ba);
    for (const id of ['cargo', 'orders', 'charters', 'routes']) {
      await tab(ba, id);
      const fit = await panelFits(ba, id === 'cargo' ? ['[data-test=ship-cargo]'] : []);
      equal([id, fit.page, fit.dialog, fit.body, fit.inDialog, fit.notInView], [id, true, true, true, true, []]);
      if (id === 'routes') await H.shot(ba, 'dock-routes-tv');
    }
    await tab(ba, 'charters');
    equal(await ba.$$eval('[data-test=dock-charters] .tsi-bas-terms', l => l.length), 6);
  });
  await check('nothing went wrong on the TV', async () => {
    equal(ctx.log.errors, [], 'page errors');
    equal(ctx.log.net, [], 'internet');
  });
  await ctx.close();

  /* ------------------------------------------------------------------ */
  section('An old Bastion with a Register Port Charter order pending at the Hall');

  await check('it is converted when the Bastion opens: the box says the order carries on at the Dock, and the order is there with the same due day and Charter', async () => {
    const octx = await H.newContext(browser, 'laptop', { backedUp: true });
    await octx.setOffline(true);
    const page = await octx.newPage();
    await page.goto(H.fileUrl('index.html'));
    await page.waitForSelector('.tsi-card');
    const old = {
      v: 3, day: 5, anchored: true, treasuryGP: 100, partyLevel: 9, builtExtras: [{ facId: 'hall_of_emissaries', status: 'built' }], facilityLevels: { hall_of_emissaries: 2, dock: 2 },
      defenders: { count: 0, armed: false, patrolUntil: 0 }, warehouse: [], log: [],
      tradeNetwork: { active: false, strategy: 'balanced', stability: 75, routes: [], portCharters: [{ id: 'c-gold', port: 'goldport', clan: 'molten', mode: 'commodity_backed', status: 'earned', earnedDay: 1, registeredDay: null, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' }], voyages: [], schedules: [], cargoSales: [], protections: { commercial_convoy: { charges: 1 } }, marketLedger: [], parcels: [] },
      pendingOrders: [{ id: 'o-old', facId: 'hall_of_emissaries', fnId: 'register_port_charter', chosen: { label: 'Port Charter: Goldport (Clan Molten)', charterId: 'c-gold' }, optionLabel: 'Goldport', notes: '', label: 'Hall of Emissaries: Register Port Charter (Goldport)', costGP: 0, issuedDay: 4, dueDay: 7 }]
    };
    await page.evaluate(o => { TSI.store.set('tsi.bastion.state', o); return TSI.store.flush(); }, old);
    await page.goto(H.fileUrl('index.html') + '?tool=bastion');
    await page.waitForSelector('[data-test=changes-box]');
    const box = await bare(page, '[data-test=changes-box]');
    assert(/Your Register Port Charter order carries on at the Dock, with the same due day\./.test(box), box);
    assert(/The Commercial Convoy you had ready for the next ship is gone with the Barracks/.test(box), box);
    assert(/Hall of Emissaries: Register Port Charter \(Goldport\) \(now at the Dock\)/.test(box), box);
    await H.ackChanges(page);
    const s = await page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
    const o = s.pendingOrders[0];
    equal([o.id, o.facId, o.fnId, o.label, o.issuedDay, o.dueDay, o.chosen.charterId, s.v], ['o-old', 'dock', 'register_port_charter', 'Dock: Register Port Charter (Goldport)', 4, 7, 'c-gold', 4]);
    equal(s.tradeNetwork.protections, {});
    await page.click('[data-test=tile-dock]');
    await page.waitForSelector('[data-test=dock-tabs]');
    assert(/Dock: Register Port Charter \(Goldport\)/.test(await bare(page, '.tsi-bas-facpanel__orders')), 'listed under Orders pending here');
    await page.click('[data-test=dock-tab-charters]');
    assert(/Being registered at the Dock \(ready Day 7\)/.test(await bare(page, '[data-test=dock-charters]')));
    equal(octx.log.errors, [], 'page errors');
    await octx.close();
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
