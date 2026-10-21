/* Wyvern Roost: bonding and training (P1 and P2, Harry's approvals of 20
   October 2026), from the test page with the internet off: Elara's wyvern
   shows Bond 1 and her handler; a training programme is ordered for it; its
   completion makes the Bond 2 milestone ready (the bond does not move); the
   DM confirms it with a reason; an order the Roost's level doesn't allow says
   exactly why; the handler and temperament dialogs work; everything is still
   there after a reload.
   Run with:  node tests/e2e/wyvern-bonding.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));

(async () => {
  const browser = await H.chromium.launch();
  section('Wyvern Roost: bonding and training');
  const ctx = await H.newContext(browser, 'laptop', { backedUp: true });
  await ctx.setOffline(true);
  const ex = await ctx.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await ctx.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    s.partyLevel = 9;
    s.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }];
    s.facilityLevels.wyvern_roost = 1;
    const c = { id: 'elara_wyvern', species: 'wyvern', owner: 'elara', name: '', status: 'housed', home: 'wyvern_roost', grantedDay: 1, housedDay: 1, msgId: '' };
    c.development = R.newDevelopment(c, s.day);
    s.creatures = [c];
  }));
  await ba.waitForTimeout(500);
  const close = async () => { for (let i = 0; i < 4 && (await ba.$('.tsi-modal')); i++) { await ba.keyboard.press('Escape'); await ba.waitForTimeout(300); } };
  const openRoost = async () => { await close(); await ba.click('[data-test=tile-wyvern_roost]'); await ba.waitForSelector('[data-test=creature-profile-elara_wyvern]'); };
  const completeLast = () => ba.evaluate(() => TSI.bastion.debug.change(s => {
    const T = window.TSI_DATA, R = TSI.bastion.rules;
    const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
    const o = s.pendingOrders[s.pendingOrders.length - 1];
    s.day = o.dueDay;
    R.completeSimpleOrder(s, data, o, Math.random);
    R.removeOrder(s, o.id);
  }));

  await check('Elara\'s profile shows her handler, Bond 1 and what comes next', async () => {
    await openRoost();
    equal(await bare(ba, '[data-test=creature-handler-elara_wyvern]'), 'Elara');
    equal(await bare(ba, '[data-test=creature-bond-elara_wyvern]'), '1: Acclimatised');
    assert(/Establish Keeper's Routine/.test(await bare(ba, '[data-test=creature-next-elara_wyvern]')), await bare(ba, '[data-test=creature-next-elara_wyvern]'));
    assert(/Riding Not ready for a first flight yet/.test(await bare(ba, '[data-test=creature-profile-elara_wyvern]')), 'riding is shown as not ready');
    equal(await ba.$('[data-test=creature-confirm-elara_wyvern]'), null, 'nothing to confirm yet');
  });

  await check('a Level 2 programme at a Level 1 Roost says exactly why it can\'t go ahead', async () => {
    const sel = '[data-test="issue-wyvern_roost__wyr_signal_recall"]';
    await ba.waitForSelector(sel);
    equal(await ba.$eval(sel, b => b.disabled), true);
    assert(/Needs the Wyvern Roost at Level 2 \(it's Level 1\)/.test(await bare(ba, '[data-test="why-wyvern_roost__wyr_signal_recall"]')), await bare(ba, '[data-test="why-wyvern_roost__wyr_signal_recall"]'));
  });

  await check('Establish Keeper\'s Routine is ordered for Elara\'s wyvern: 7 days, no gold, one at a time', async () => {
    const sel = '[data-test="issue-wyvern_roost__wyr_keeper_routine"]';
    equal(await ba.$eval(sel, b => b.disabled), false);
    const gold = (await bas(ba)).treasuryGP;
    await ba.click(sel);
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    equal(s.pendingOrders.filter(o => o.fnId === 'wyr_keeper_routine').map(o => [o.dueDay - o.issuedDay, o.label, o.chosen.trainCreatureId]), [[7, 'Wyvern Roost: Establish Keeper\'s Routine (Elara\'s wyvern)', 'elara_wyvern']]);
    equal(s.treasuryGP, gold, 'no gold');
    await openRoost();
    assert(/Training Wyvern Roost: Establish Keeper's Routine \(Elara's wyvern\), ready on Day/.test(await bare(ba, '[data-test=creature-profile-elara_wyvern]')), await bare(ba, '[data-test=creature-profile-elara_wyvern]'));
  });

  await check('when it finishes, Bond 2 is READY (not given); Confirm bond milestone asks for the scene and raises it exactly one level', async () => {
    await completeLast();
    await openRoost();
    equal(await bare(ba, '[data-test=creature-bond-elara_wyvern]'), '1: Acclimatised');
    await ba.waitForSelector('[data-test=creature-confirm-elara_wyvern]');
    await ba.click('[data-test=creature-confirm-elara_wyvern]');
    await ba.waitForSelector('[data-test=bond-dialog]');
    equal(await ba.$eval('[data-test=bond-dialog] .tsi-modal__foot .tsi-btn--primary', b => b.disabled), true, 'a reason is required');
    await ba.fill('[data-test=bond-why]', 'She answered Elara\'s whistle among the arena crowds.');
    await ba.click('[data-test=bond-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    const d = (await bas(ba)).creatures[0].development;
    equal([d.bond.level, d.bond.ready, d.chronicle.length], [2, null, 3]);
    await openRoost();
    equal(await bare(ba, '[data-test=creature-bond-elara_wyvern]'), '2: Trusting');
    equal(await ba.$('[data-test=creature-confirm-elara_wyvern]'), null);
  });

  await check('the temperament dialog and a Chronicle note keep the DM\'s own words', async () => {
    await ba.click('[data-test=creature-temper-edit-elara_wyvern]');
    await ba.waitForSelector('[data-test=temperament-dialog]');
    await ba.fill('[data-test=temperament-dominant]', 'Proud');
    await ba.fill('[data-test=temperament-trigger]', 'Drums');
    await ba.click('[data-test=temperament-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    await openRoost();
    assert(/Dominant: Proud · Trigger: Drums/.test(await bare(ba, '[data-test=creature-temper-elara_wyvern]')), await bare(ba, '[data-test=creature-temper-elara_wyvern]'));
    await ba.click('[data-test=creature-chronicle-elara_wyvern] summary');
    await ba.click('[data-test=creature-note-elara_wyvern]');
    await ba.waitForSelector('[data-test=note-dialog]');
    await ba.fill('[data-test=note-text]', 'Slept on the tower in the rain.');
    await ba.click('[data-test=note-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    const d = (await bas(ba)).creatures[0].development;
    equal([d.temperament.dominant, d.chronicle[d.chronicle.length - 1].text], ['Proud', 'Slept on the tower in the rain.']);
    equal(d.chronicle[d.chronicle.length - 1].private, undefined, 'an ordinary note is not flagged');
    /* Beast Handler (D6): a note ticked "DM only" is flagged, and the list says so. */
    await openRoost();
    await ba.click('[data-test=creature-chronicle-elara_wyvern] summary');
    await ba.click('[data-test=creature-note-elara_wyvern]');
    await ba.waitForSelector('[data-test=note-dialog]');
    await ba.fill('[data-test=note-text]', 'Who really sent the storm.');
    await ba.check('[data-test=note-private]');
    await ba.click('[data-test=note-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    const e = (await bas(ba)).creatures[0].development;
    equal([e.chronicle[e.chronicle.length - 1].text, e.chronicle[e.chronicle.length - 1].private], ['Who really sent the storm.', true]);
    await openRoost();
    await ba.click('[data-test=creature-chronicle-elara_wyvern] summary');
    assert(/Who really sent the storm\. \(DM only\)/.test(await bare(ba, '[data-test=creature-chronicle-elara_wyvern]')), await bare(ba, '[data-test=creature-chronicle-elara_wyvern]'));
  });

  await check('the handler dialog changes the handler with a reason; the new pairing starts at Bond 0', async () => {
    await openRoost();
    await ba.click('[data-test=creature-assign-elara_wyvern]');
    await ba.waitForSelector('[data-test=handler-dialog]');
    await ba.fill('[data-test=handler-name]', 'Mira');
    await ba.fill('[data-test=handler-why]', 'Elara handed the keeping to Mira.');
    await ba.click('[data-test=handler-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    const d = (await bas(ba)).creatures[0].development;
    equal([d.handlerId, d.bond.level, d.handlerHistory.length, d.handlerHistory[0].handlerId, d.handlerHistory[0].bond], ['Mira', 0, 1, 'elara', 2]);
  });

  await check('everything is still there after a reload, and the day log has the confirmation', async () => {
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().creatures.length === 1, null, { timeout: 8000 });
    const s = await bas(ba);
    const d = s.creatures[0].development;
    equal([d.handlerId, d.bond.level, Object.keys(d.training), d.temperament.dominant], ['Mira', 0, ['wyr_keeper_routine'], 'Proud']);
    assert(s.log.some(l => /Bond 2/.test(l.body || l.text || '')), 'the Day Log has the confirmation');
  });

  section('Riding preparation (phase 3)');

  await check('the harness is ordered for 150 gp; cancelling warns that it isn\'t refunded', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.partyLevel = 13; s.treasuryGP = 400; s.facilityLevels.wyvern_roost = 5;
      s.pendingOrders = [];
      const d = s.creatures[0].development;
      d.handlerId = 'elara'; d.bond = { level: 4, ready: null }; d.training = {}; d.firstFlight = { approved: false, day: null, handlerId: null };
    }));
    await openRoost();
    const sel = '[data-test="issue-wyvern_roost__wyr_riding_harness"]';
    await ba.waitForSelector(sel);
    equal(await ba.$eval(sel, b => b.disabled), false);
    await ba.click(sel);
    await ba.waitForTimeout(500);
    equal((await bas(ba)).treasuryGP, 250);
    await close();
    await ba.click('[data-test=orders-count]');
    await ba.waitForSelector('[data-test=cancel-0]');
    const cancel = await ba.$('[data-test=cancel-0]');
    assert(cancel, 'the pending order has a Cancel button');
    if (cancel) {
      await cancel.click({ force: true });
      await ba.waitForSelector('.tsi-modal:not(.tsi-bas-panel)');
      assert(/150 gp already paid is not refunded/.test(await ba.$eval('.tsi-modal:not(.tsi-bas-panel)', n => n.textContent)), 'warns first');
      await H.clickModal(ba, 'Cancel order');
      await ba.waitForTimeout(500);
      equal([(await bas(ba)).treasuryGP, (await bas(ba)).pendingOrders.length], [250, 0], 'cancelled, not refunded');
    }
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.treasuryGP = 400; }));
  });

  await check('the flight programmes are done, the checks tick, and Confirm first flight records story permission only', async () => {
    await openRoost();
    await ba.click('[data-test="issue-wyvern_roost__wyr_riding_harness"]');
    await ba.waitForTimeout(400);
    await completeLast();
    await ba.evaluate(() => TSI.bastion.debug.change(s => { const d = s.creatures[0].development; d.training.wyr_ascent_landing = { day: 1 }; d.training.wyr_emergency_recall = { day: 1 }; }));
    await openRoost();
    assert(/First flight ready, awaiting the DM's milestone/.test(await bare(ba, '[data-test=creature-riding-elara_wyvern]')), await bare(ba, '[data-test=creature-riding-elara_wyvern]'));
    assert(!/✗|○/.test(await bare(ba, '[data-test=creature-flightchecks-elara_wyvern]')), 'every check ticked');
    await ba.click('[data-test=creature-flight-elara_wyvern]');
    await ba.waitForSelector('[data-test=flight-dialog]');
    equal(await ba.$eval('[data-test=flight-dialog] .tsi-modal__foot .tsi-btn--primary', b => b.disabled), true, 'a reason is required');
    await ba.fill('[data-test=flight-why]', 'Elara and the wyvern crossed the bay at dawn.');
    await ba.click('[data-test=flight-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    const d = (await bas(ba)).creatures[0].development;
    equal([d.firstFlight.approved, d.firstFlight.handlerId, d.harness.fitted, d.harness.paidGP], [true, 'elara', true, 150]);
    await openRoost();
    assert(/Mounted Flight Qualified/.test(await bare(ba, '[data-test=creature-riding-elara_wyvern]')) && /not part of the Bastion yet/.test(await bare(ba, '[data-test=creature-riding-elara_wyvern]')));
    equal(await ba.$('[data-test=creature-flight-elara_wyvern]'), null, 'no second confirmation');
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'page errors');
    equal(ctx.log.net, [], 'internet');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
