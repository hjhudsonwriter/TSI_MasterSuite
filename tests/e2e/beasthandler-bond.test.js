/* Scarlett Isles: Beast Handler — the bottom bar and the Bond page (Harry, 22 October 2026), from the test page with the
   internet off. Checks: the three tabs in order (Profile, Bond, Chronicle) with Bond the page a beast opens on; the bond
   pills follow the Bastion's bond as it changes; and a new snapshot arriving while a roll is playing (the subspecies roll
   or a personality die) does not cut it: the panel keeps its own state, finishes, and is redrawn from what is known only
   afterwards; the Bonding Days counter says how many days the beast has been on the road (and whether it is out now); the
   five pills FILL as the Bastion counts days (a full one says it is ready and waits for the DM, with a soft pulse that
   "reduce motion" switches off); each pill is a progress bar for a screen reader; and a new snapshot grows a pill in place
   instead of redrawing the page, so a greeting or a roll is never cut and a pill never jumps; and at the laptop's 1707 x 930
   and the TV's 1920 x 1080 the sticky tab bar covers nothing of the Bond card (the five bond names, the Bonding Days line,
   the "Ready" line and the kind line), whether the beast is away or a level is ready.
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
    const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
    s.partyLevel = 9; s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
    s.facilityLevels.beast_pen = 1;
    const mk = (id, species, name, home, bond, regional) => {
      const c = { id, species, owner: '', name, status: 'housed', home, grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira'; c.development.bond.level = bond;
      if (regional) c.development.regional = regional;
      return c;
    };
    s.creatures = [mk('cr-stormwing', 'wyvern', 'Stormwing', 'beast_pen', 3, 'Widowspine'), mk('cr-swiftwing', 'griffin', 'Swiftwing', 'beast_pen', 1, ''), mk('cr-late', 'wyvern', 'Latecomer', 'beast_pen', 1, '')];
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

  await check('a first meeting that becomes due while the beast\'s page is open does not cover the page: it waits until the beast is next opened from Home', async () => {
    await bh.reload();
    await bh.waitForSelector('[data-test=bh-viewas]');
    await bh.selectOption('[data-test=bh-viewas]', 'Mira');
    await bh.waitForSelector('[data-test=bh-beast-cr-late]');
    await bh.click('[data-test=bh-beast-cr-late]');
    await bh.waitForSelector('[data-test=bh-bond]');
    equal(await bare(bh, '[data-test=bh-subspecies]'), '\u2726Subspecies not known yet', 'the Bastion has not rolled for it yet');
    equal(await bh.$('[data-test=bh-meet]'), null);
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      const T = window.TSI_DATA;
      T.beastInitiation.regional.mode = 'fixed'; /* these tests pin the fixed answer; random mode is covered by the rules tests */
      const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
      TSI.bastion.rules.sweepInitiation(s, data, Math.random);
    }));
    await ba.evaluate(() => TSI.store.flush());
    await bh.evaluate(() => TSI.beasthandler.debug.refresh());
    await bh.waitForFunction(() => /Bloodcrest/.test(document.querySelector('[data-test=bh-subspecies]').textContent), null, { timeout: 8000 });
    equal(await bh.$('[data-test=bh-meet]'), null, 'the page stays as it was, now showing the subspecies');
    await bh.click('[data-test=bh-back]');
    await bh.click('[data-test=bh-beast-cr-late]');
    await bh.waitForSelector('[data-test=bh-meet][data-step="1"]');
  });

  /* ---------------- The Bonding Days counter and the filling pills (22 October 2026) ---------------- */
  const setBonding = async fields => {
    await ba.evaluate(f => TSI.bastion.debug.change(s => {
      const c = s.creatures.find(x => x.id === 'cr-stormwing');
      const d = c.development;
      if (f.bond !== undefined) d.bond.level = f.bond;
      if (f.ready !== undefined) d.bond.ready = f.ready;
      if (f.bonding === null) delete d.bonding; else if (f.bonding) d.bonding = f.bonding;
    }), fields);
    await ba.evaluate(() => TSI.store.flush());
    await bh.evaluate(() => TSI.beasthandler.debug.refresh());
    await bh.waitForTimeout(150);
  };
  const pillInfo = () => bh.$$eval('.tsi-bh-pill', n => n.map(x => ({ state: x.className.replace(/.*--/, ''), fill: x.getAttribute('data-fill'), now: x.getAttribute('aria-valuenow'), label: x.getAttribute('aria-label'), role: x.getAttribute('role'), width: x.querySelector('.tsi-bh-pill__fill').style.width })));

  await check('the Bonding Days counter: the total, and one line that says whether the beast is on the road or resting at the Pen', async () => {
    await bh.reload();
    await bh.waitForSelector('[data-test=bh-viewas]');
    await bh.selectOption('[data-test=bh-viewas]', 'Mira');
    await bh.waitForSelector('[data-test=bh-beast-cr-stormwing]');
    await setBonding({ bond: 3, ready: null, bonding: null });
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    await bh.waitForSelector('[data-test=bh-days]');
    equal(await bare(bh, '[data-test=bh-days]'), '20', 'a beast at Bond 3 has the 20 days that level means');
    equal(await bare(bh, '.tsi-bh-days__label'), 'Bonding Days');
    equal(await bare(bh, '[data-test=bh-days-line]'), 'Resting at the Beast Pen: bonding is paused');
    equal(await bare(bh, '[data-test=bh-kind]'), 'Wyvern \u00b7 At the Beast Pen');
    await setBonding({ bonding: { away: true, awaySince: 12, lastTick: 12, days: 24 } });
    equal(await bare(bh, '[data-test=bh-days]'), '24');
    equal(await bare(bh, '[data-test=bh-days-line]'), 'On the road with Mira since Day 12');
    equal(await bare(bh, '[data-test=bh-kind]'), 'Wyvern \u00b7 Away from the Ironbow');
    await bh.click('[data-test=bh-back]');
    equal(await bare(bh, '[data-test=bh-row-away-cr-stormwing]'), 'Away from the Ironbow', 'the directory shows who is out on the road');
    equal(await bh.$('[data-test=bh-row-away-cr-swiftwing]'), null);
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    await bh.waitForSelector('[data-test=bh-days]');
  });

  await check('the pills fill: reached ones are full, the next is as full as its days, each is a progress bar with its words, and the last ones are empty', async () => {
    const p = await pillInfo();
    equal(p.map(x => x.state), ['done', 'done', 'current', 'filling', 'todo']);
    equal(p.map(x => x.fill), ['100', '100', '100', '40', '0']);
    equal(p.map(x => x.now), ['100', '100', '100', '40', '0']);
    equal(p.map(x => x.width), ['100%', '100%', '100%', '40%', '0%']);
    equal(p.map(x => x.role), ['progressbar', 'progressbar', 'progressbar', 'progressbar', 'progressbar']);
    equal(p[3].label, 'Bond 4, Devoted: 4 of 10 days');
    equal(p[2].label, 'Bond 3, Bonded: reached');
    equal(await bh.$eval('[data-test=bh-ready]', n => n.hidden), true, 'nothing is ready yet');
    equal(await bh.$eval('[data-test=bh-pills]', n => n.getAttribute('role')), null, 'the list is no longer one picture: each pill speaks for itself');
  });

  await check('a new snapshot grows the pill in place: the same page, the same pill, no jump, the greeting not cut', async () => {
    await bh.click('[data-test=bh-greet-large]');
    await bh.evaluate(() => { document.querySelector('[data-test=bh-bond]').__mine = true; document.querySelector('[data-test=bh-pill-4]').__mine = true; });
    await setBonding({ bonding: { away: true, awaySince: 12, lastTick: 17, days: 27 } });
    equal(await bh.evaluate(() => !!(document.querySelector('[data-test=bh-bond]').__mine && document.querySelector('[data-test=bh-pill-4]').__mine)), true, 'nothing was redrawn');
    assert(await bh.$eval('[data-test=bh-portrait-large]', n => n.classList.contains('tsi-bh-hero2--greet')), 'the greeting is still playing');
    equal(await bare(bh, '[data-test=bh-days]'), '27');
    equal((await pillInfo())[3].width, '70%', 'the bar now says 7 of 10');
    equal((await pillInfo())[3].label, 'Bond 4, Devoted: 7 of 10 days');
    /* The width eases from 70% towards 80% rather than jumping: read it part-way through. */
    await bh.waitForTimeout(1200);
    await setBonding({ bonding: { away: true, awaySince: 12, lastTick: 18, days: 28 } });
    const ratio = await bh.$eval('[data-test=bh-pill-4]', n => {
      const f = n.querySelector('.tsi-bh-pill__fill').getBoundingClientRect().width, t = n.querySelector('.tsi-bh-pill__bar').getBoundingClientRect().width;
      return f / t;
    });
    assert(ratio > 0.69 && ratio < 0.795, 'part-way from 70% to 80%, not already there: ' + ratio);
    const css = await bh.$eval('[data-test=bh-pill-4] .tsi-bh-pill__fill', n => { const c = getComputedStyle(n); return { prop: c.transitionProperty, dur: c.transitionDuration }; });
    assert(/width/.test(css.prop) && parseFloat(css.dur) > 0, 'a width transition: ' + JSON.stringify(css));
    await bh.waitForTimeout(1200);
    equal((await pillInfo())[3].width, '80%');
  });

  await check('a full pill says it is ready and waits for the DM, with a soft pulse; "reduce motion" stops the pulse and the growing', async () => {
    await setBonding({ bonding: { away: true, awaySince: 12, lastTick: 22, days: 30 }, ready: 4 });
    const p = await pillInfo();
    equal(p.map(x => x.state), ['done', 'done', 'current', 'ready', 'todo']);
    equal(p[3].fill, '100');
    equal(p[3].label, 'Bond 4, Devoted: ready, waiting for a moment with your DM');
    equal(await bare(bh, '[data-test=bh-ready]'), 'Ready: waiting for a moment with your DM');
    equal(await bh.$eval('[data-test=bh-ready]', n => n.hidden), false);
    const anim = () => bh.$eval('[data-test=bh-pill-4] .tsi-bh-pill__bar', n => getComputedStyle(n).animationName);
    equal(await anim(), 'tsi-bh-ready-pulse', 'it pulses');
    await bh.emulateMedia({ reducedMotion: 'reduce' });
    equal(await anim(), 'none', 'no pulse with reduce motion');
    equal(await bh.$eval('[data-test=bh-pill-3] .tsi-bh-pill__fill', n => getComputedStyle(n).transitionDuration), '0s', 'and the fill no longer grows slowly');
    await bh.emulateMedia({ reducedMotion: 'no-preference' });
  });

  await check('once the DM confirms the level, the next pill starts empty; at Bond 5 all five are full and no pill is left to fill', async () => {
    await setBonding({ bond: 4, ready: null, bonding: { away: true, awaySince: 12, lastTick: 23, days: 31 } });
    const p = await pillInfo();
    equal(p.map(x => [x.state, x.fill]), [['done', '100'], ['done', '100'], ['done', '100'], ['current', '100'], ['filling', '5']]);
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 4 \u00b7 Devoted');
    equal(await bare(bh, '[data-test=bh-stage]'), 'Stage 4 of 5');
    equal(await bh.$eval('[data-test=bh-ready]', n => n.hidden), true);
    await setBonding({ bond: 5, ready: null, bonding: { away: true, awaySince: 12, lastTick: 40, days: 60 } });
    equal((await pillInfo()).map(x => x.fill), ['100', '100', '100', '100', '100']);
    equal(await bare(bh, '[data-test=bh-days]'), '60');
  });

  await check('a Bastion with no bonding block (an older snapshot) still draws the pills, and a damaged one never shows NaN', async () => {
    await setBonding({ bond: 3, ready: null, bonding: { away: false, awaySince: null, lastTick: null, days: 20 } });
    equal((await pillInfo()).map(x => x.fill), ['100', '100', '100', '0', '0']);
    assert(!/NaN|undefined/.test(await bare(bh, '[data-test=bh-bond]')), 'no code words in the card');
    await setBonding({ bonding: null });
    equal(await bare(bh, '[data-test=bh-days]'), '20', 'a beast at Bond 3 still has the days that level means');
  });

  /* ---------------- The tab bar covers nothing of the Bond card (22 October 2026, the review) ---------------- */
  /* For each thing the player must read on the Bond page: is it inside the window, and is it what the eye lands on at its
     middle (not the sticky tab bar, which is drawn over the bottom of the window)? */
  const coverage = page => page.evaluate(() => {
    window.scrollTo(0, 0);
    const nav = document.querySelector('.tsi-bh-nav');
    const things = [];
    document.querySelectorAll('.tsi-bh-pill__label').forEach((n, i) => things.push(['bond name ' + (i + 1) + ' (' + n.textContent + ')', n]));
    things.push(['Bonding Days line', document.querySelector('[data-test=bh-days-line]')]);
    things.push(['kind line', document.querySelector('[data-test=bh-kind]')]);
    const ready = document.querySelector('[data-test=bh-ready]');
    if (ready && !ready.hidden) things.push(['Ready line', ready]);
    return {
      vh: innerHeight, navTop: Math.round(nav.getBoundingClientRect().top), scrollY: Math.round(scrollY),
      bad: things.map(([label, n]) => {
        const r = n.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const ok = !!hit && !nav.contains(hit) && (n.contains(hit) || hit.contains(n)) && r.top >= 0 && r.bottom <= innerHeight;
        return ok ? null : label + ' at ' + Math.round(r.top) + '-' + Math.round(r.bottom) + ' under ' + (hit ? (hit.className || hit.tagName) : 'nothing');
      }).filter(Boolean),
      count: things.length
    };
  });
  await check('laptop (1707 x 930, pixel ratio 1.5): the tab bar covers none of the Bond card, with a beast away on the road and with a level ready (Bond 3 and Bond 4)', async () => {
    await bh.click('[data-test=bh-back]').catch(() => {});
    await bh.waitForSelector('[data-test=bh-beast-cr-stormwing]');
    await setBonding({ bond: 3, ready: null, bonding: { away: true, awaySince: 12, lastTick: 12, days: 24 } });
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    await bh.waitForSelector('[data-test=bh-bond]');
    await bh.waitForTimeout(500);
    equal(await bh.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]), [1707, 930, 1.5]);
    let c = await coverage(bh);
    equal(c.bad, [], 'away: ' + JSON.stringify(c));
    equal(c.count, 7, 'the five bond names, the Bonding Days line and the kind line');
    await H.shot(bh, 'beasthandler-bond-laptop-away');
    await setBonding({ bond: 3, ready: 4, bonding: { away: true, awaySince: 12, lastTick: 22, days: 30 } });
    c = await coverage(bh);
    equal(c.bad, [], 'ready: ' + JSON.stringify(c));
    equal(c.count, 8, 'and the Ready line');
    equal(await bare(bh, '[data-test=bh-ready]'), 'Ready: waiting for a moment with your DM');
    /* The page may scroll a little (the connection line under the bar), but never sideways. */
    equal(await bh.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    await H.shot(bh, 'beasthandler-bond-laptop-ready');
    /* The same on the laptop in full screen (1707 x 1067). */
    await bh.setViewportSize({ width: 1707, height: 1067 });
    await bh.waitForTimeout(300);
    c = await coverage(bh);
    equal(c.bad, [], 'full screen: ' + JSON.stringify(c));
    await bh.setViewportSize({ width: 1707, height: 930 });
    await bh.waitForTimeout(200);
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.net, []);
    equal(ctx.log.failed, []);
    equal(ctx.log.errors, []);
    equal(ctx.log.consoleErrors.filter(e => !/Failed to load resource/.test(e)), []);
  });

  /* The TV: an extended second screen at 1920 x 1080, pixel ratio 1. */
  const tvCtx = await H.newContext(browser, 'tv', { backedUp: true });
  await tvCtx.setOffline(true);
  const tex = await tvCtx.newPage();
  await tex.goto(HARNESS + '?tool=explorer');
  await tex.waitForSelector('[data-test=camp]');
  const tba = await tvCtx.newPage();
  await tba.goto(HARNESS + '?tool=bastion');
  await tba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  const tvState = fields => tba.evaluate(f => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    if (!s.creatures.length) {
      s.partyLevel = 9; s.treasuryGP = 400;
      s.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
      s.facilityLevels.beast_pen = 1;
      const c = { id: 'cr-stormwing', species: 'wyvern', owner: '', name: 'Stormwing', status: 'housed', home: 'beast_pen', grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira'; c.development.regional = 'Widowspine';
      s.creatures = [c];
    }
    const d = s.creatures[0].development;
    d.bond.level = f.bond; d.bond.ready = f.ready; d.bonding = f.bonding;
  }), fields).then(() => tba.evaluate(() => TSI.store.flush()));
  await tvState({ bond: 3, ready: null, bonding: { away: true, awaySince: 12, lastTick: 12, days: 24 } });
  await tba.waitForTimeout(500);
  const tbh = await tvCtx.newPage();
  await tbh.goto(HARNESS + '?tool=beasthandler');
  await tbh.waitForSelector('[data-test=bh-viewas]');
  await tbh.selectOption('[data-test=bh-viewas]', 'Mira');
  await tbh.waitForSelector('[data-test=bh-beast-cr-stormwing][data-mine=yes]');
  await check('TV (1920 x 1080, pixel ratio 1): the tab bar covers none of the Bond card, with a beast away and with a level ready', async () => {
    await tbh.click('[data-test=bh-beast-cr-stormwing]');
    await tbh.waitForSelector('[data-test=bh-bond]');
    await tbh.waitForTimeout(500);
    equal(await tbh.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]), [1920, 1080, 1]);
    let c = await coverage(tbh);
    equal(c.bad, [], 'away: ' + JSON.stringify(c));
    equal(c.count, 7);
    await tvState({ bond: 3, ready: 4, bonding: { away: true, awaySince: 12, lastTick: 22, days: 30 } });
    await tbh.evaluate(() => TSI.beasthandler.debug.refresh());
    await tbh.waitForTimeout(500);
    c = await coverage(tbh);
    equal(c.bad, [], 'ready: ' + JSON.stringify(c));
    equal(c.count, 8);
    await H.shot(tbh, 'beasthandler-bond-tv-ready');
    equal(tvCtx.log.net, []);
    equal(tvCtx.log.failed, []);
    equal(tvCtx.log.errors, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
