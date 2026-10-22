/* Scarlett Isles: Beast Handler — the bottom bar and the Bond page (Harry, 22 October 2026), from the test page with the
   internet off. Checks: the three tabs in order (Profile, Bond, Chronicle) with Bond the page a beast opens on; the bond
   pills follow the Bastion's bond as it changes; and a new snapshot arriving while a roll is playing (the subspecies roll
   or a personality die) does not cut it: the panel keeps its own state, finishes, and is redrawn from what is known only
   afterwards. (The Bonding Days counter and the filling pills come with the Beast Pen, in a later step.)
   Run with:  node tests/e2e/beasthandler-bond.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));

(async () => {
  const browser = await H.chromium.launch();
  section('Beast Handler: the tab bar and the Bond page');

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
    const T = window.TSI_DATA;
    const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
    s.partyLevel = 9; s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }, { facId: 'griffin_tower', status: 'built' }];
    s.facilityLevels.wyvern_roost = 3; s.facilityLevels.griffin_tower = 2;
    const mk = (id, species, name, home, bond, regional) => {
      const c = { id, species, owner: '', name, status: 'housed', home, grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira'; c.development.bond.level = bond;
      if (regional) c.development.regional = regional;
      return c;
    };
    s.creatures = [mk('cr-stormwing', 'wyvern', 'Stormwing', 'wyvern_roost', 3, 'Widowspine'), mk('cr-swiftwing', 'griffin', 'Swiftwing', 'griffin_tower', 1, '')];
    R.rollInitiation(s, data, 'cr-swiftwing', Math.random);
  }));
  await ba.evaluate(() => TSI.store.flush());
  await ba.waitForTimeout(500);
  const bh = await ctx.newPage();
  await bh.goto(HARNESS + '?tool=beasthandler');
  await bh.waitForSelector('[data-test=bh-viewas]');
  await bh.selectOption('[data-test=bh-viewas]', 'Mira');
  await bh.waitForSelector('[data-test=bh-beast-cr-stormwing][data-mine=yes]');

  await check('the three tabs run Profile, Bond, Chronicle from left to right, a beast opens on Bond, and each tab shows its own page', async () => {
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    await bh.waitForSelector('[data-test=bh-bond]');
    const bar = await bh.$$eval('.tsi-bh-nav__btn', n => n.map(b => ({ test: b.getAttribute('data-test'), text: b.textContent, left: Math.round(b.getBoundingClientRect().left), on: b.getAttribute('aria-current') === 'page' })));
    equal(bar.map(b => b.test), ['bh-tab-profile', 'bh-tab-bond', 'bh-tab-chronicle']);
    equal(bar.map(b => b.text), ['Profile', 'Bond', 'Chronicle']);
    assert(bar[0].left < bar[1].left && bar[1].left < bar[2].left, 'in that order across the screen: ' + JSON.stringify(bar.map(b => b.left)));
    equal(bar.map(b => b.on), [false, true, false], 'Bond is lit');
    equal(await bh.$eval('[data-test=bh-root]', n => n.getAttribute('data-screen')), 'creature-bond');
    equal(await bh.$('[data-test=bh-tab-orders]'), null, 'there is no Orders tab');
    await bh.click('[data-test=bh-tab-profile]');
    equal(await bh.$eval('[data-test=bh-root]', n => n.getAttribute('data-screen')), 'creature-profile');
    equal(await bare(bh, '.tsi-bh-head__title'), 'Profile');
    assert(await bh.$('[data-test=bh-tab-bond]') && await bh.$('[data-test=bh-tab-chronicle]'), 'the bar is on every page');
    await bh.click('[data-test=bh-tab-chronicle]');
    equal(await bare(bh, '.tsi-bh-head__title'), 'Chronicle');
    await bh.click('[data-test=bh-tab-bond]');
    equal(await bare(bh, '[data-test=bh-name]'), 'Stormwing');
    equal(await bh.evaluate(() => document.querySelectorAll('.tsi-bh-nav').length), 1);
  });

  await check('the Bond page follows the Bastion: Bond 3 fills three pills, and a change the DM makes shows without the page being left', async () => {
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 3 · Bonded');
    equal(await bh.$$eval('.tsi-bh-pill', n => n.map(x => x.className.replace(/.*--/, ''))), ['done', 'done', 'current', 'todo', 'todo']);
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.creatures.find(c => c.id === 'cr-stormwing').development.bond.level = 4; }));
    await ba.evaluate(() => TSI.store.flush());
    await bh.evaluate(() => TSI.beasthandler.debug.refresh());
    await bh.waitForFunction(() => /Bond 4/.test(document.querySelector('[data-test=bh-bond-line]').textContent), null, { timeout: 8000 });
    equal(await bh.$$eval('.tsi-bh-pill', n => n.map(x => x.className.replace(/.*--/, ''))), ['done', 'done', 'done', 'current', 'todo']);
    equal(await bare(bh, '[data-test=bh-stage]'), 'Stage 4 of 5');
  });

  await check('a new snapshot arriving while the subspecies roll plays does not cut it: the same medallions keep going, it lands, and only then is the screen redrawn', async () => {
    await bh.click('[data-test=bh-back]');
    await bh.click('[data-test=bh-beast-cr-swiftwing]');
    await bh.waitForSelector('[data-test=bh-meet][data-step="1"]');
    await bh.click('[data-test=bh-meet-continue]');
    await bh.waitForSelector('[data-test=bh-meet][data-step="2"]');
    await bh.evaluate(() => { window.TSI_BH_SPEED = 1; });
    await bh.evaluate(() => { document.querySelector('[data-test=bh-meet-medals]').__mine = true; });
    await bh.click('[data-test=bh-meet-roll-regional]');
    await bh.waitForTimeout(900);
    /* The DM changes something, and the companion's picture of the Bastion is refreshed right in the middle of the roll. */
    await ba.evaluate(() => TSI.bastion.debug.change(s => { TSI.bastion.rules.addChronicleNote(s, { bastion: TSI_DATA.bastion, facilities: TSI_DATA.bastionFacilities, creatures: TSI_DATA.bastionCreatures }, 'cr-swiftwing', 'A note that arrives mid-roll.'); }));
    await ba.evaluate(() => TSI.store.flush());
    await bh.evaluate(() => TSI.beasthandler.debug.refresh());
    await bh.waitForTimeout(600);
    equal(await bh.evaluate(() => !!document.querySelector('[data-test=bh-meet-medals]').__mine), true, 'the very same medallions are still on screen: nothing was redrawn');
    equal(await bh.$eval('[data-test=bh-meet-die]', n => n.getAttribute('data-state')), 'rolling', 'and the die is still going');
    assert(await bh.$('.tsi-bh-medal--lit'), 'with the marker on a medallion');
    await bh.waitForSelector('[data-test=bh-meet-next]:not([hidden])', { timeout: 15000 });
    equal(await bh.$eval('[data-test=bh-meet-die]', n => n.getAttribute('data-state')), 'landed');
    equal(await bare(bh, '[data-test=bh-meet-about] h2'), 'Dawnmantle');
    equal(await bh.$eval('.tsi-bh-medal--lit', n => n.getAttribute('data-variety')), 'dawnmantle', 'it landed on the Bastion\'s answer despite the refresh');
    await bh.waitForTimeout(300);
    equal(await bh.$eval('[data-test=bh-meet-next]', n => n.hidden), false, 'and the screen caught up, still showing the landed panel');
    equal(await bh.$eval('[data-test=bh-meet-die]', n => n.getAttribute('data-state')), 'landed');
  });

  await check('the same for the three personality dice: a refresh in the middle leaves them rolling, and every line is there afterwards', async () => {
    await bh.click('[data-test=bh-meet-next]');
    await bh.waitForSelector('[data-test=bh-meet][data-step="3"]');
    await bh.evaluate(() => { document.querySelector('[data-test=bh-meet-card-dominant]').__mine = true; });
    await bh.click('[data-test=bh-meet-roll-all]');
    await bh.waitForTimeout(500);
    await bh.evaluate(() => TSI.beasthandler.debug.refresh());
    await bh.waitForTimeout(300);
    equal(await bh.evaluate(() => !!document.querySelector('[data-test=bh-meet-card-dominant]').__mine), true, 'the cards were not redrawn');
    equal(await bh.$$eval('.tsi-bh-die[data-state=rolling]', n => n.length) > 0, true, 'a die is still tumbling');
    await bh.waitForSelector('[data-test=bh-meet-finish]:not([hidden])', { timeout: 10000 });
    equal(await bh.$$eval('.tsi-bh-pcard__line', n => n.length), 3, 'all three lines');
    const c = (await bas(ba)).creatures.find(x => x.id === 'cr-swiftwing');
    equal(await bh.$$eval('.tsi-bh-pcard .tsi-bh-die', n => n.map(x => x.textContent)), [c.development.initiation.rolls.dominant, c.development.initiation.rolls.attachment, c.development.initiation.rolls.trigger].map(String), 'each die shows the Bastion\'s number');
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.02; });
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
