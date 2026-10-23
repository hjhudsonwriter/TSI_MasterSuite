/* Negotiated Charter terms and the voyage protections (Harry, 20 October
   2026; the Barracks' and Watchtower's went with the war game on 22 October
   2026), from the test page with the internet off:
   - the Hall's Port Charters box shows the terms and a worked estimate;
   - Amend terms… needs valid numbers and a reason, saves, logs and keeps a
     history; Reset to standard terms asks for a reason too;
   - the Dock shows the terms and the one protection left, the Blessing of
     Pelagos.
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
    s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }];
    s.facilityLevels.hall_of_emissaries = 2;
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

  await check('the Dock shows the Charter terms and the one protection left, the Blessing of Pelagos', async () => {
    await close();
    await ba.click('[data-test=tile-dock]');
    await ba.waitForSelector('[data-test=dock-cargo]');
    assert(/Terms: ×1.00 price/.test(await bare(ba, '[data-test=dock-charter-goldport]')));
    equal(await ba.$$eval('[data-test=dock-protections] li', l => l.length), 1);
    assert(/Blessing of Pelagos: none ready/.test(await bare(ba, '[data-test=dock-protection-pelagos_blessing]')));
    equal(await ba.$('[data-test=dock-protection-commercial_convoy]'), null, 'no Commercial Convoy any more');
  });

  await check('the Hall hides the Secure Trade Agreement, lists Register Port Charter first, and still shows a running agreement\'s days left', async () => {
    await close();
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.diplomacy.agreements = [{ id: 'run', title: 'Trade Agreement', clan: 'Clan Slade', startDay: s.day, endDay: s.day + 14, income: 80, lastShipmentDay: s.day }];
    }));
    await ba.waitForTimeout(300);
    await ba.click('[data-test=tile-hall_of_emissaries]');
    await ba.waitForSelector('[data-test=diplomacy-records]');
    const text = await bare(ba, '[data-test=diplomacy-records]');
    assert(/Clan Slade • 14 days remaining \(2 shipments\)/.test(text), text);
    assert(!/Retired|Archived/.test(text), text);
    equal(await ba.$('[data-test="issue-hall_of_emissaries__secure_trade_agreement"]'), null);
    equal(await ba.$$eval('[data-test^="issue-hall_of_emissaries__"]', bs => bs.map(b => b.getAttribute('data-test').replace('issue-hall_of_emissaries__', '')).slice(0, 2)), ['register_port_charter', 'host_delegation']);
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'page errors');
    equal(ctx.log.net, [], 'internet');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
