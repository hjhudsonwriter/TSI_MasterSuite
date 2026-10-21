/* Griffin Tower and Dire Wolf Den: bonding, training and riding preparation
   (21 October 2026), from the test page with the internet off: a granted,
   housed griffin and dire wolf each show a profile; a handler is assigned in
   the dialog; Safe Acclimatisation is ordered; at Bond 4 the next step names
   the harness; and the wolf's outing is a ride, the griffin's a flight.
   Run with:  node tests/e2e/beast-bonding.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));

(async () => {
  const browser = await H.chromium.launch();
  section('Griffin Tower and Dire Wolf Den: bonding');
  const ctx = await H.newContext(browser, 'laptop', { backedUp: true });
  await ctx.setOffline(true);
  const ex = await ctx.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await ctx.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    s.partyLevel = 13; s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'griffin_tower', status: 'built' }, { facId: 'dire_wolf_den', status: 'built' }];
    s.facilityLevels.griffin_tower = 5;
    s.facilityLevels.dire_wolf_den = 5;
    s.creatures = [
      { id: 'cr-griffin-1', species: 'griffin', owner: '', name: 'Swiftwing', status: 'housed', home: 'griffin_tower', grantedDay: 1, housedDay: 1, msgId: '' },
      { id: 'cr-wolf-1', species: 'dire_wolf', owner: '', name: 'Greyfang', status: 'housed', home: 'dire_wolf_den', grantedDay: 1, housedDay: 1, msgId: '' }
    ];
  }));
  await ba.waitForTimeout(500);
  const close = async () => { for (let i = 0; i < 4 && (await ba.$('.tsi-modal')); i++) { await ba.keyboard.press('Escape'); await ba.waitForTimeout(300); } };
  const open = async (fac, id) => { await close(); await ba.click('[data-test=tile-' + fac + ']'); await ba.waitForSelector('[data-test=creature-profile-' + id + ']'); };

  const BEASTS = [
    { fac: 'griffin_tower', id: 'cr-griffin-1', pre: 'grf', noun: 'flight', sentinel: 'Aerial Sentinel Training' },
    { fac: 'dire_wolf_den', id: 'cr-wolf-1', pre: 'dwf', noun: 'ride', sentinel: 'Pack Sentinel Training' }
  ];
  for (const B of BEASTS) {
    await check(B.fac + ': the profile shows Bond 0, no handler and the first step; assigning a handler and ordering Safe Acclimatisation works', async () => {
      await open(B.fac, B.id);
      equal(await bare(ba, '[data-test=creature-handler-' + B.id + ']'), 'None yet');
      equal(await bare(ba, '[data-test=creature-bond-' + B.id + ']'), '0: Unfamiliar');
      assert(/Assign a handler, then Safe Acclimatisation/.test(await bare(ba, '[data-test=creature-next-' + B.id + ']')), await bare(ba, '[data-test=creature-next-' + B.id + ']'));
      assert(new RegExp('Not ready for a first ' + B.noun + ' yet').test(await bare(ba, '[data-test=creature-riding-' + B.id + ']')));
      await ba.click('[data-test=creature-assign-' + B.id + ']');
      await ba.waitForSelector('[data-test=handler-dialog]');
      await ba.fill('[data-test=handler-name]', 'Mira');
      await ba.click('[data-test=handler-dialog] .tsi-modal__foot .tsi-btn--primary');
      await ba.waitForTimeout(500);
      await open(B.fac, B.id);
      equal(await bare(ba, '[data-test=creature-handler-' + B.id + ']'), 'Mira');
      const sel = '[data-test="issue-' + B.fac + '__' + B.pre + '_safe_acclimatisation"]';
      await ba.waitForSelector(sel);
      equal(await ba.$eval(sel, b => b.disabled), false);
      await ba.click(sel);
      await ba.waitForTimeout(500);
      const s = await bas(ba);
      equal(s.pendingOrders.filter(o => o.fnId === B.pre + '_safe_acclimatisation').map(o => [o.dueDay - o.issuedDay, o.chosen.trainCreatureId, o.costGP]), [[5, B.id, 0]]);
      await ba.evaluate(() => TSI.bastion.debug.change(s => { s.pendingOrders = []; }));
    });

    await check(B.fac + ': at Bond 4 the next step is the 150 gp harness, a Level 4 programme at a Level 3 building says why, and everything is kept after a reload', async () => {
      await ba.evaluate(({ id }) => TSI.bastion.debug.change(s => {
        const c = s.creatures.filter(x => x.id === id)[0];
        c.development.bond = { level: 4, ready: null };
      }), { id: B.id });
      await open(B.fac, B.id);
      assert(/Next for riding: Commission Riding Harness \(Level 4, 7 days, 150 gp\)/.test(await bare(ba, '[data-test=creature-next-' + B.id + ']')), await bare(ba, '[data-test=creature-next-' + B.id + ']'));
      await ba.evaluate(({ fac }) => TSI.bastion.debug.change(s => { s.facilityLevels[fac] = 3; }), { fac: B.fac });
      await open(B.fac, B.id);
      assert(/Needs the .* at Level 4 \(it's Level 3\)/.test(await bare(ba, '[data-test="why-' + B.fac + '__' + B.pre + '_riding_harness"]')), 'level reason shown');
      await ba.evaluate(({ fac }) => TSI.bastion.debug.change(s => { s.facilityLevels[fac] = 5; }), { fac: B.fac });
      await ba.reload();
      await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().creatures.length === 2, null, { timeout: 8000 });
      const c = (await bas(ba)).creatures.filter(x => x.id === B.id)[0];
      equal([c.development.handlerId, c.development.bond.level], ['Mira', 4]);
    });
  }

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'page errors');
    equal(ctx.log.net, [], 'internet');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
