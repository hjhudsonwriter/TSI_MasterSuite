/* Negotiated Charter terms and the Barracks and Watchtower protections
   (Harry, 20 October 2026), from the test page with the internet off:
   - the Hall's Port Charters box shows the terms and a worked estimate;
   - Amend terms… needs valid numbers and a reason, saves, logs and keeps a
     history; Reset to standard terms asks for a reason too;
   - the Dock shows the terms and the three protections;
   - Guard Commercial Convoy can be ordered once (the button says so while
     one is pending).
   Run with:  node tests/e2e/charter-terms.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));

(async () => {
  const browser = await H.chromium.launch();
  section('Charter terms and commercial protections');
  const ctx = await H.newContext(browser, 'laptop', { backedUp: true });
  await ctx.setOffline(true);
  /* The Bastion reads the Explorer's day, so the Explorer is open beside it. */
  const ex = await ctx.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await ctx.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    s.partyLevel = 9;
    s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }, { facId: 'barracks', status: 'built' }, { facId: 'watchtower', status: 'built' }];
    s.facilityLevels.hall_of_emissaries = 2;
    s.facilityLevels.barracks = 2;
    s.facilityLevels.watchtower = 2;
    s.facilityLevels.dock = 4;
    s.tradeNetwork.portCharters = [{ id: 'chartr-gold00000:dm:0', port: 'goldport', clan: 'molten', mode: 'cargo', status: 'registered', earnedDay: 1, registeredDay: 1, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' }];
  }));
  await ba.waitForTimeout(600);
  const close = async () => { for (let i = 0; i < 4 && (await ba.$('.tsi-modal')); i++) { await ba.keyboard.press('Escape'); await ba.waitForTimeout(300); } };

  await check('the Hall shows standard terms and a worked estimate', async () => {
    await ba.click('[data-test=tile-hall_of_emissaries]');
    await ba.waitForSelector('[data-test=charter-terms]');
    equal(await bare(ba, '[data-test=charter-terms]'), 'Terms: ×1.00 price · 0 gp shipping a lot · 0% tariff (standard).');
    assert(/Estimate at current market conditions/.test(await bare(ba, '[data-test=charter-terms-estimate]')));
    equal(await ba.$('[data-test=reset-terms]'), null, 'no reset while standard');
  });

  await check('Amend terms… needs valid numbers and a reason, then saves, logs and keeps a history', async () => {
    await ba.click('[data-test=amend-terms]');
    await ba.waitForSelector('[data-test=terms-dialog]');
    const dis = () => ba.$eval('[data-test=terms-dialog] .tsi-modal__foot .tsi-btn--primary', b => b.disabled);
    equal(await dis(), true, 'no change yet');
    await ba.fill('[data-test=terms-price]', '3');
    await ba.fill('[data-test=terms-why]', 'A feast');
    assert(/×0.50 to ×2.00/.test(await bare(ba, '[data-test=terms-problem]')));
    equal(await dis(), true);
    await ba.fill('[data-test=terms-price]', '1.25');
    await ba.fill('[data-test=terms-fee]', '5');
    await ba.fill('[data-test=terms-tariff]', '10');
    await ba.fill('[data-test=terms-why]', '');
    assert(/Say why/.test(await bare(ba, '[data-test=terms-problem]')));
    await ba.fill('[data-test=terms-why]', 'The party saved the harbour master\'s daughter.');
    equal(await dis(), false);
    await ba.click('[data-test=terms-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    equal(s.tradeNetwork.portCharters[0].terms, { priceMult: 1.25, feePerLot: 5, tariffPct: 10 });
    equal(s.tradeNetwork.portCharters[0].termsLog.map(e => [e.kind, e.why]), [['amend', 'The party saved the harbour master\'s daughter.']]);
    assert(s.log.some(l => /Charter terms amended/.test(l.body || l.text || '')), 'a Day Log entry');
    await ba.waitForSelector('[data-test=terms-history]');
    equal(await bare(ba, '[data-test=charter-terms]'), 'Terms: ×1.25 price · 5 gp shipping a lot · 10% tariff (negotiated).');
  });

  await check('Reset to standard terms asks for a reason and restores them, keeping the history', async () => {
    await ba.click('[data-test=reset-terms]');
    await ba.waitForSelector('[data-test=terms-dialog]');
    equal(await ba.$eval('[data-test=terms-dialog] .tsi-modal__foot .tsi-btn--primary', b => b.disabled), true, 'a reason is required');
    await ba.fill('[data-test=terms-why]', 'The harbour master was replaced.');
    await ba.click('[data-test=terms-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    equal([s.tradeNetwork.portCharters[0].terms, s.tradeNetwork.portCharters[0].termsLog.length], [{}, 2]);
    equal(await bare(ba, '[data-test=charter-terms]'), 'Terms: ×1.00 price · 0 gp shipping a lot · 0% tariff (standard).');
  });

  await check('the Dock shows the Charter terms and the three protections', async () => {
    await close();
    await ba.click('[data-test=tile-dock]');
    await ba.waitForSelector('[data-test=dock-cargo]');
    assert(/Terms: ×1.00 price/.test(await bare(ba, '[data-test=dock-charter-goldport]')));
    equal(await ba.$$eval('[data-test=dock-protections] li', l => l.length), 3);
    assert(/Commercial Convoy: none ready/.test(await bare(ba, '[data-test=dock-protection-commercial_convoy]')));
  });

  await check('Guard Commercial Convoy can be ordered once; a second one is refused while it is pending', async () => {
    await close();
    await ba.click('[data-test=tile-barracks]');
    const sel = '[data-test="issue-barracks__guard_commercial_convoy"]';
    await ba.waitForSelector(sel);
    equal(await ba.$eval(sel, b => b.disabled), false);
    await ba.click(sel);
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    equal(s.pendingOrders.filter(o => o.fnId === 'guard_commercial_convoy').map(o => o.dueDay - o.issuedDay), [3]);
    await ba.click(sel);
    await ba.waitForSelector('.tsi-modal:not(.tsi-bas-panel)');
    assert(/already pending/.test(await ba.$eval('.tsi-modal:not(.tsi-bas-panel)', n => n.textContent)), 'a second order is refused');
    equal((await bas(ba)).pendingOrders.filter(o => o.fnId === 'guard_commercial_convoy').length, 1);
  });

  await check('the Hall shows the Trade Agreement retirement, a running agreement\'s days left, and the archive (kept when records are cleared)', async () => {
    await close();
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.diplomacy.agreements = [{ id: 'run', title: 'Trade Agreement', clan: 'Clan Slade', startDay: s.day, endDay: s.day + 14, income: 80, lastShipmentDay: s.day }];
      s.diplomacy.archivedAgreements = [{ id: 'old', title: 'Trade Agreement', clan: 'Clan Karr', startDay: 1, endDay: 22, income: 90, lastShipmentDay: 22, status: 'expired', archivedDay: 22, shipmentsPaid: 3, goldPaid: 270 }];
    }));
    await ba.waitForTimeout(300);
    await ba.click('[data-test=tile-hall_of_emissaries]');
    await ba.waitForSelector('[data-test=diplomacy-records]');
    const text = await bare(ba, '[data-test=diplomacy-records]');
    assert(/Retired: no new Trade Agreements/.test(text), text);
    assert(/Clan Slade • 14 days remaining \(2 shipments\)/.test(text), text);
    assert(/Expired \/ Archived Trade Agreements/.test(text) && /Clan Karr • Day 1 to Day 22 • 3 shipments paid, 270 gp in all/.test(text) && /Expired \/ Archived/.test(text), text);
    await ba.click('[data-test=clear-diplomacy]');
    await ba.waitForSelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button');
    await ba.click('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button.tsi-btn--primary');
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    equal([s.diplomacy.agreements.length, (s.diplomacy.archivedAgreements || []).length], [0, 1], 'running records cleared as before; the archive stays');
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'page errors');
    equal(ctx.log.net, [], 'internet');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
