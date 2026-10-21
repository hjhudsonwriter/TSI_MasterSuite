/* Scarlett Isles: Beast Handler — asking the Bastion from the companion on the laptop (BH-2b and BH-2c,
   Harry's approvals of 21 October 2026), from the test page with the internet off. The Bastion is open in one
   window and the companion in another. It checks: rolling gives only a suggestion; Save asks and the Bastion
   answers once (the Chronicle, bond and stats untouched, a change note and Day Log line made); a double
   press, a reload and a second tab never make a second order; the Bastion's window being shut or its
   "take requests" switched off leaves a request waiting, honestly; a request that no longer qualifies is
   refused with the reason; and the Regional Variety's painted portrait appears.
   Run with:  node tests/e2e/beasthandler-write.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const texts = (page, sel) => page.$$eval(sel, ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));

(async () => {
  const browser = await H.chromium.launch();
  section('Beast Handler: asking the Bastion');
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
    s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }, { facId: 'griffin_tower', status: 'built' }, { facId: 'dire_wolf_den', status: 'built' }];
    s.facilityLevels.wyvern_roost = 3; s.facilityLevels.griffin_tower = 2; s.facilityLevels.dire_wolf_den = 2;
    const mk = (id, species, name, home, handler) => {
      const c = { id, species, owner: '', name, status: 'housed', home, grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = handler;
      return c;
    };
    s.creatures = [mk('cr-stormwing', 'wyvern', 'Stormwing', 'wyvern_roost', 'Mira'), mk('cr-swiftwing', 'griffin', 'Swiftwing', 'griffin_tower', 'Mira'), mk('cr-ashfang', 'dire_wolf', 'Ashfang', 'dire_wolf_den', 'Joss')];
  }));
  await ba.evaluate(() => TSI.store.flush());
  await ba.waitForTimeout(500);
  const bh = await ctx.newPage();
  await bh.goto(HARNESS + '?tool=beasthandler');
  await bh.waitForSelector('[data-test=bh-viewas]');
  const home = async () => { for (let i = 0; i < 3 && !(await bh.$('[data-test=bh-viewas]')); i++) { await bh.click('[data-test=bh-back]'); await bh.waitForTimeout(150); } };
  const viewAs = async who => { await home(); await bh.selectOption('[data-test=bh-viewas]', who); await bh.waitForTimeout(300); };
  const waitFor = (page, sel, ms) => page.waitForSelector(sel, { timeout: ms || 12000 });
  const state = () => bas(ba);
  const stormwing = async () => (await state()).creatures.find(c => c.id === 'cr-stormwing');
  await viewAs('Mira');

  await check('rolling only suggests: values appear marked "not saved yet", and nothing reaches the Bastion', async () => {
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    await bh.click('[data-test=bh-tab-profile]');
    await bh.click('[data-test=bh-edit]');
    await waitFor(bh, '[data-test=bh-edit-form]');
    equal(await bh.$eval('[data-test=bh-save]', b => b.disabled), true, 'Save waits for a change');
    await bh.click('[data-test=bh-roll-all]');
    await bh.waitForSelector('[data-test=bh-sugg-dominant]:not([hidden])');
    const vals = await bh.evaluate(() => ['dominant', 'attachment', 'trigger'].map(k => document.querySelector('[data-test=bh-in-' + k + ']').value));
    assert(vals.every(v => v.length > 2), 'all three have a value: ' + vals);
    assert(/Suggestion \(rolled \d+\): not saved yet/.test(await bare(bh, '[data-test=bh-sugg-trigger]')), await bare(bh, '[data-test=bh-sugg-trigger]'));
    const tables = await bh.evaluate(() => window.TSI_DATA.beastProfile);
    assert(tables.dominant.entries.some(e => e.label === vals[0]), 'the temperament is from the d12 table');
    assert(tables.species.wyvern.attachment.entries.some(e => e.label === vals[1]), 'the cue is a wyvern cue');
    assert(tables.species.wyvern.trigger.entries.some(e => e.label === vals[2]), 'the trigger is a wyvern trigger');
    const s = await stormwing();
    equal([s.development.temperament.dominant, s.development.temperament.attachment, s.development.temperament.trigger], ['', '', ''], 'the Bastion has nothing');
    equal(await bas(ba).then(x => Object.keys(x.beast.done).length), 0);
    await bh.click('[data-test=bh-roll-dominant]');
    assert(/rolled \d+/.test(await bare(bh, '[data-test=bh-sugg-dominant]')), 'a single line can be rolled again');
    await bh.fill('[data-test=bh-in-dominant]', 'Curious');
    equal(await bh.$eval('[data-test=bh-sugg-dominant]', n => n.hidden), true, 'typing over a suggestion makes it your own');
  });

  await check('too long a line is refused on screen before anything is sent', async () => {
    await bh.fill('[data-test=bh-in-trigger]', 'x'.repeat(121));
    await bh.waitForSelector('[data-test=bh-edit-problem]:not([hidden])');
    assert(/at most 120 letters/.test(await bare(bh, '[data-test=bh-edit-problem]')), await bare(bh, '[data-test=bh-edit-problem]'));
    equal(await bh.$eval('[data-test=bh-save]', b => b.disabled), true);
    await bh.fill('[data-test=bh-in-trigger]', 'Thick smoke');
    await bh.fill('[data-test=bh-in-regional]', 'Widowspine');
  });

  await check('Save asks the Bastion, shows "waiting", then the Bastion\'s answer: saved once, with its change note and Day Log line', async () => {
    const before = await stormwing();
    const chron = JSON.stringify(before.development.chronicle);
    const bond = JSON.stringify(before.development.bond);
    await bh.click('[data-test=bh-save]');
    await bh.waitForSelector('[data-test=bh-requests] [data-state=waiting], [data-test=bh-requests] [data-state=saved]');
    await bh.waitForSelector('[data-test=bh-requests] [data-state=saved]', { timeout: 12000 });
    assert(/Saved in the Bastion/.test(await bare(bh, '[data-test=bh-requests]')), await bare(bh, '[data-test=bh-requests]'));
    const s = await state();
    const c = s.creatures.find(x => x.id === 'cr-stormwing');
    equal([c.development.temperament.trigger, c.development.regional, c.development.temperament.dominant], ['Thick smoke', 'Widowspine', 'Curious']);
    equal(JSON.stringify(c.development.chronicle), chron, 'the Chronicle is untouched');
    equal(JSON.stringify(c.development.bond), bond, 'the bond is untouched');
    equal(c.development.profileLog.length, 1);
    assert(/Stormwing's profile was changed by Mira/.test(s.log[0].body), s.log[0].body);
    equal(Object.keys(s.beast.done).length, 1);
    await bh.waitForSelector('[data-test=bh-p-trigger]');
    equal(await bare(bh, '[data-test=bh-p-trigger]'), 'Thick smoke');
    equal(await bare(bh, '[data-test=bh-p-regional]'), 'Widowspine');
    assert(await bh.$('[data-test=bh-p-about]'), 'its variety is explained');
  });

  await check('the Bastion\'s own screen shows the DM the change, in the Management box', async () => {
    await ba.evaluate(() => TSI.bastion.debug.reveal && TSI.bastion.debug.reveal('open-management'));
    await ba.click('[data-test=open-management]').catch(() => {});
    await ba.waitForSelector('[data-test=beast-box]', { timeout: 5000 });
    assert(/Mira · Stormwing \(profile\): accepted/.test(await bare(ba, '[data-test=beast-recent]')), await bare(ba, '[data-test=beast-recent]'));
    await ba.keyboard.press('Escape');
  });

  await check('Send request asks for the order: waiting, then accepted and scheduled; exactly one order, no gold', async () => {
    await bh.click('[data-test=bh-tab-orders]');
    await bh.waitForSelector('[data-test=bh-orders]');
    await bh.click('[data-test=bh-order-wyr_safe_acclimatisation]');
    await bh.waitForSelector('[data-test=bh-confirm]');
    await bh.click('[data-test=bh-send]');
    await bh.waitForSelector('[data-test=bh-requests] [data-state=waiting], [data-test=bh-requests] [data-state=scheduled]');
    await bh.waitForSelector('[data-test=bh-requests] [data-state=scheduled]', { timeout: 12000 });
    const s = await state();
    equal(s.pendingOrders.filter(o => o.chosen && o.chosen.trainCreatureId).length, 1);
    equal(s.treasuryGP, 400);
    assert(/Accepted and scheduled in the Bastion: ready on Day \d+\./.test(await bare(bh, '[data-test=bh-requests]')), await bare(bh, '[data-test=bh-requests]'));
    await bh.waitForSelector('[data-test=bh-pending]', { timeout: 8000 });
    assert(/Safe Acclimatisation \(Stormwing\)/.test(await bare(bh, '.tsi-bh-pending__label')));
  });

  await check('reloading the companion, or opening it twice, never makes a second order', async () => {
    await bh.reload();
    await bh.waitForSelector('[data-test=bh-viewas]');
    await bh.waitForTimeout(5000);
    equal((await state()).pendingOrders.filter(o => o.chosen && o.chosen.trainCreatureId).length, 1);
    const bh2 = await ctx.newPage();
    await bh2.goto(HARNESS + '?tool=beasthandler');
    await bh2.waitForSelector('[data-test=bh-viewas]');
    await bh2.waitForTimeout(5000);
    equal((await state()).pendingOrders.filter(o => o.chosen && o.chosen.trainCreatureId).length, 1);
    await bh2.close();
    await viewAs('Mira');
  });

  await check('a double press on Save or Send makes one request', async () => {
    /* Profile again, pressing Save twice quickly. */
    await bh.click('[data-test=bh-beast-cr-swiftwing]');
    await bh.click('[data-test=bh-tab-profile]');
    await bh.click('[data-test=bh-edit]');
    await bh.fill('[data-test=bh-in-dominant]', 'Proud');
    const before = Object.keys((await state()).beast.done).length;
    await bh.dblclick('[data-test=bh-save]');
    await bh.waitForSelector('[data-test=bh-requests] [data-state=saved]', { timeout: 12000 });
    await bh.waitForTimeout(3000);
    equal(Object.keys((await state()).beast.done).length, before + 1);
    equal((await state()).creatures.find(c => c.id === 'cr-swiftwing').development.profileLog.length, 1);
  });

  await check('with the Bastion not taking requests, a request waits and says so; switched back on, it is answered once', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { TSI.bastion.rules.beastState(s).accept = false; }));
    await ba.evaluate(() => TSI.store.flush());
    await bh.click('[data-test=bh-edit]');
    await bh.fill('[data-test=bh-in-attachment]', 'Folds wings close');
    await bh.click('[data-test=bh-save]');
    await bh.waitForSelector('[data-test=bh-requests] [data-state=waiting]');
    assert(/waiting for the Bastion to pick up/.test(await bare(bh, '[data-test=bh-sync]')), await bare(bh, '[data-test=bh-sync]'));
    await bh.waitForTimeout(5000);
    assert(await bh.$('[data-test=bh-requests] [data-state=waiting]'), 'still waiting');
    equal((await state()).creatures.find(c => c.id === 'cr-swiftwing').development.temperament.attachment, '', 'nothing was changed');
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.beast.accept = true; }));
    await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.find(c => c.id === 'cr-swiftwing').development.temperament.attachment === 'Folds wings close', null, { timeout: 12000 });
    await bh.waitForSelector('[data-test=bh-requests] [data-state=waiting]', { state: 'detached', timeout: 12000 });
    equal(Object.values((await state()).beast.done).filter(r => r.label === 'Swiftwing (profile)').length, 2, 'two profile requests in all, each once');
  });

  await check('a request that no longer qualifies is refused with the reason, and nothing changes', async () => {
    await home();
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.beast.accept = false; }));
    await ba.evaluate(() => TSI.store.flush());
    await bh.click('[data-test=bh-tab-profile]');
    await bh.click('[data-test=bh-edit]');
    await bh.fill('[data-test=bh-in-dominant]', 'Fiercely Loyal');
    await bh.click('[data-test=bh-save]');
    await bh.waitForSelector('[data-test=bh-requests] [data-state=waiting]');
    /* Meanwhile the DM gives the beast to someone else, then switches requests back on. */
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      const R = TSI.bastion.rules, T = window.TSI_DATA;
      const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
      R.trainingOrders(s).slice().forEach(o => R.removeOrder(s, o.id));
      const r = R.assignHandler(s, data, 'cr-stormwing', 'Joss', 'Mira has gone home');
      if (!r.ok) throw new Error(r.message);
      s.beast.accept = true;
    }));
    await bh.waitForTimeout(6000);
    const s = await state();
    const rec = Object.values(s.beast.done).filter(r => r.r === 'refused');
    equal(rec.length, 1);
    assert(/isn't yours any more/.test(rec[0].why), rec[0].why);
    equal(s.creatures.find(c => c.id === 'cr-stormwing').development.temperament.dominant, 'Curious', 'the change was not made');
    await viewAs('Mira');
    equal(await bh.$eval('[data-test=bh-beast-cr-stormwing]', n => n.getAttribute('data-mine')), 'no', 'it is a plain directory line now: no longer in Mira\'s hands');
  });

  await check('Regional Variety shows Harry\'s painted portrait for a Dire Wolf, and the medallion for a beast with none', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.creatures.find(c => c.id === 'cr-ashfang').development.regional = 'Icepelt'; }));
    await ba.evaluate(() => TSI.store.flush());
    await viewAs('Joss');
    await bh.click('[data-test=bh-beast-cr-ashfang]');
    await bh.waitForSelector('[data-test=bh-portrait-large] img');
    const src = await bh.$eval('[data-test=bh-portrait-large] img', i => i.getAttribute('src'));
    assert(/tools\/beasthandler\/assets\/dire-wolf\/icepelt\.webp$/.test(src), src);
    assert(await bh.$eval('[data-test=bh-portrait-large] img', i => i.complete && i.naturalWidth === 941), 'the picture really loaded');
    await H.shot(bh, 'beasthandler-wolf-icepelt');
    await viewAs('Mira');
    await bh.click('[data-test=bh-beast-cr-swiftwing]');
    assert(await bh.$('[data-test=bh-portrait-large] .tsi-bh-medallion'), 'a griffin with no picture matched yet shows the medallion');
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.net, []);
    equal(ctx.log.failed, []);
    equal(ctx.log.errors, []);
    equal(ctx.log.consoleErrors.filter(e => !/Failed to load resource/.test(e)), []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
