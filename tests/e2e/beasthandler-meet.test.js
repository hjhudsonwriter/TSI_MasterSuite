/* Scarlett Isles: Beast Handler — meeting a beast for the first time (Harry, 21 and 22 October 2026), from files with
   the internet off. The app is read-only: the BASTION rolls a beast's first meeting once, when it passes acclimatisation,
   and the first time a player opens that beast the app plays a reveal of what the Bastion stored. Nothing is typed,
   chosen or sent.
   Checks (laptop, then a phone with the code swap): a beast with no first meeting (already introduced, or not
   acclimatised) gets none; no picture or page of the beast before the end; panel 1; panel 2 (the kind's subspecies as
   medallions in a fresh order, one button, no text box, the die and the gold marker that hops, slows and lands on the
   Bastion's fixed variety for all five kinds, the die settling on that medallion's place in the run's order, the timing
   at real speed, a path and a number that differ between runs, locked after rolling, never cut by a redraw); panel 3
   (three cards, Roll and Roll all, the die settling on the Bastion's real number, the line and its note); the curtain
   (the black, "Welcome to the Ironbow", black again, then the beast) in order and at real speed; the curtain waiting for a
   slow picture and giving up on one that never comes; a missing picture file; the Bastion not changed by any of it (no
   re-roll, one roll per beast); it never replays once seen; Skip for now (laptop only); closing the page part-way sends
   nothing and starts again; keyboard use and the focus ring; reduced motion; the black screen never outliving the tool;
   panels that fit the laptop; a phone that cannot skip, has 44 px targets, keeps "seen" until it is unlinked.
   Run with:  node tests/e2e/beasthandler-meet.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');
const PHONE = H.fileUrl('beasthandler.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const QUICK = () => { window.TSI_BH_SPEED = 0.02; };
const FIXED = { wyvern: 'bloodcrest', griffin: 'dawnmantle', dire_wolf: 'blacktide', buckbear: 'broadcrown', fellcat: 'lichenback' };
const NAMES = { bloodcrest: 'Bloodcrest', dawnmantle: 'Dawnmantle', blacktide: 'Blacktide', broadcrown: 'Broadcrown', lichenback: 'Lichenback' };
/* A failing check leaves a picture of each open companion window, so a failure can be seen rather than guessed at. */
const windows = [];
let failures = 0;
const checkS = (name, fn) => check(name, async () => {
  try { await fn(); } catch (e) {
    failures += 1;
    for (let i = 0; i < windows.length; i++) { try { await H.shot(windows[i], 'meet-failed-' + failures + '-' + i); } catch (x) { /* window gone */ } }
    throw e;
  }
});

(async () => {
  const browser = await H.chromium.launch();
  section('Beast Handler: meeting a beast');

  /* ---- The DM's laptop: a Bastion with beasts the Bastion has rolled a first meeting for ---- */
  const ctx = await H.newContext(browser, 'laptop', { backedUp: true });
  await ctx.setOffline(true);
  await ctx.addInitScript(QUICK);
  /* Two pictures can be made slow on purpose (set window.__slow in the page): the Bloodcrest wyvern's takes about 1.8 s to
     arrive, the Dawnmantle griffin's never arrives. */
  await ctx.addInitScript(() => {
    const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    const delayFor = u => window.__slow && /\/wyvern\/bloodcrest\.webp$/.test(u) ? 1800 : window.__slow && /\/griffin\/dawnmantle\.webp$/.test(u) ? 1e9 : 0;
    Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, get() { return desc.get.call(this); }, set(v) { const d = delayFor(String(v)); if (d) setTimeout(() => desc.set.call(this, v), d); else desc.set.call(this, v); } });
    const setAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) { if (this instanceof HTMLImageElement && n === 'src') { this.src = v; return; } return setAttr.call(this, n, v); };
  });
  const ex = await ctx.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await ctx.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  /* A Bastion beast, as the Bastion has it: acclimatised (bond 1), handled by Mira, its first meeting rolled (or not). */
  const addBeast = (id, species, name, home, opts) => ba.evaluate(([id, species, name, home, opts]) => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    const T = window.TSI_DATA;
    const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
    const c = { id, species, owner: '', name, status: 'housed', home, grantedDay: 1, housedDay: 1, msgId: '' };
    c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira';
    c.development.bond.level = opts.bond === undefined ? 1 : opts.bond;
    if (opts.regional) c.development.regional = opts.regional;
    if (opts.lines) Object.assign(c.development.temperament, opts.lines);
    s.creatures.push(c);
    if (opts.roll !== false && c.development.bond.level >= 1) R.rollInitiation(s, data, id, Math.random);
  }), [id, species, name, home, opts || {}]);
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    s.partyLevel = 9; s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }, { facId: 'griffin_tower', status: 'built' }, { facId: 'dire_wolf_den', status: 'built' }];
    s.facilityLevels.wyvern_roost = 3; s.facilityLevels.griffin_tower = 2; s.facilityLevels.dire_wolf_den = 2;
    s.creatures = [];
  }));
  await addBeast('cr-stormwing', 'wyvern', 'Stormwing', 'wyvern_roost');
  await addBeast('cr-swiftwing', 'griffin', 'Swiftwing', 'griffin_tower');
  await addBeast('cr-ashfang', 'dire_wolf', 'Ashfang', 'dire_wolf_den');
  /* The Buckbear and the Fellcat have no building yet (the Beast Pen comes later): the companion window is told they live in the Roost. */
  await addBeast('cr-tusk', 'buckbear', 'Tusk', 'wyvern_roost');
  await addBeast('cr-prowl', 'fellcat', 'Prowl', 'wyvern_roost');
  await addBeast('cr-known', 'wyvern', 'Veteran', 'wyvern_roost', { regional: 'Widowspine' });
  await addBeast('cr-fresh', 'griffin', 'Newcomer', 'griffin_tower', { bond: 0 });
  await ba.evaluate(() => TSI.store.flush());
  await ba.waitForTimeout(500);
  const state = () => bas(ba);
  const creature = async id => (await state()).creatures.find(c => c.id === id);
  const bh = await ctx.newPage();
  windows.push(bh);
  await bh.goto(HARNESS + '?tool=beasthandler');
  await bh.waitForSelector('[data-test=bh-viewas]');
  await bh.evaluate(() => {
    const sp = window.TSI_DATA.bastionCreatures.species;
    sp.buckbear = { name: 'Buckbear', plural: 'Buckbears', short: 'Bu', home: 'wyvern_roost' };
    sp.fellcat = { name: 'Fellcat', plural: 'Fellcats', short: 'Fe', home: 'wyvern_roost' };
  });
  /* Back to the list of beasts from wherever the window is. */
  const home = async () => {
    for (let i = 0; i < 4 && !(await bh.$('[data-test=bh-viewas]')); i++) {
      const sel = (await bh.$('[data-test=bh-meet-leave]')) ? 'bh-meet-leave' : 'bh-back';
      await bh.click('[data-test=' + sel + ']');
      await bh.waitForTimeout(150);
    }
  };
  const viewAs = async who => { await home(); await bh.selectOption('[data-test=bh-viewas]', who); await bh.waitForTimeout(400); };
  /* A new start: the page is loaded afresh (a part-played meeting is forgotten; "seen" beasts stay seen), and the beast is opened. */
  const reopen = async id => {
    await bh.reload();
    await bh.waitForSelector('[data-test=bh-viewas]');
    await bh.evaluate(() => {
      const sp = window.TSI_DATA.bastionCreatures.species;
      sp.buckbear = { name: 'Buckbear', plural: 'Buckbears', short: 'Bu', home: 'wyvern_roost' };
      sp.fellcat = { name: 'Fellcat', plural: 'Fellcats', short: 'Fe', home: 'wyvern_roost' };
    });
    await viewAs('Mira');
    await bh.waitForSelector('[data-test=bh-beast-' + id + ']');
    await bh.click('[data-test=bh-beast-' + id + ']');
  };
  const step = async n => bh.waitForSelector('[data-test=bh-meet][data-step="' + n + '"]', { timeout: 8000 });
  const noPicture = () => bh.$$eval('.tsi-bh img', n => n.length);
  /* Note every change of the lit medallion, with the time since it started. */
  const watchMarker = () => bh.evaluate(() => {
    window.__lit = [];
    const t0 = performance.now();
    new MutationObserver(() => {
      const l = document.querySelector('[data-test=bh-meet-medals]');
      if (!l) return;
      const v = l.getAttribute('data-lit');
      const last = window.__lit[window.__lit.length - 1];
      if (!last || last[1] !== v) window.__lit.push([Math.round(performance.now() - t0), v]);
    }).observe(document.body, { attributes: true, attributeFilter: ['data-lit'], subtree: true, childList: true });
  });
  /* Press Roll for subspecies and wait for the landing. */
  const rollSubspecies = async () => {
    const order = await bh.$$eval('.tsi-bh-medal', n => n.map(x => x.getAttribute('data-variety')));
    await watchMarker();
    await bh.click('[data-test=bh-meet-roll-regional]');
    await bh.waitForSelector('[data-test=bh-meet-next]:not([hidden])', { timeout: 15000 });
    return bh.evaluate(order => {
      const lit = document.querySelector('.tsi-bh-medal--lit');
      return { order, path: window.__lit.map(x => x[1]), times: window.__lit.map(x => x[0]), die: document.querySelector('[data-test=bh-meet-die]').textContent, variety: lit.getAttribute('data-variety'), n: lit.getAttribute('data-n'), about: document.querySelector('[data-test=bh-meet-about] h2').textContent };
    }, order);
  };
  const toPanel2 = async () => { await bh.click('[data-test=bh-meet-continue]'); await step(2); };
  const toPanel3 = async () => { await rollSubspecies(); await bh.click('[data-test=bh-meet-next]'); await step(3); };
  const personality = () => bh.evaluate(() => ['dominant', 'attachment', 'trigger'].map(k => [document.querySelector('[data-test=bh-meet-die-' + k + ']').textContent, document.querySelector('[data-test=bh-meet-line-' + k + ']') ? document.querySelector('[data-test=bh-meet-line-' + k + ']').textContent : null]));
  await viewAs('Mira');

  await checkS('a beast that was already introduced (it has a subspecies) opens at once with no meeting; one that is not acclimatised is a plain line with nothing to open', async () => {
    equal(await bh.$eval('[data-test=bh-beast-cr-fresh]', n => n.tagName), 'LI');
    equal(await bare(bh, '[data-test=bh-row-wait-cr-fresh]'), 'Not acclimatised yet');
    await bh.click('[data-test=bh-beast-cr-known]');
    await bh.waitForSelector('[data-test=bh-name]');
    equal(await bh.$('[data-test=bh-meet]'), null, 'no meeting');
    equal(await bare(bh, '[data-test=bh-subspecies]'), '✦Widowspine');
    const c = await creature('cr-known');
    equal(c.development.initiation, undefined, 'the Bastion never rolled for it');
    equal(await bh.evaluate(() => JSON.stringify(Object.keys(sessionStorage).filter(k => /beasthandler\.seen/.test(k)))), '[]', 'and nothing is marked seen');
  });

  await checkS('a beast with a first meeting is not shown: panel 1 comes instead, with no picture and no page; nothing is asked of the Bastion by looking', async () => {
    const before = JSON.stringify(await state());
    await home();
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    await step(1);
    equal(await bare(bh, '[data-test=bh-meet-title]'), 'It’s time to meet Stormwing…');
    equal(await bare(bh, '.tsi-bh-meet__lead'), 'Two quick rolls, then you will see Stormwing for the first time.');
    equal(await noPicture(), 0, 'no picture anywhere');
    equal(await bh.$('[data-test=bh-portrait-large]'), null, 'no hero frame');
    equal(await bh.$('[data-test=bh-bond]'), null, 'no bond card yet');
    equal(await bh.$('.tsi-bh-nav'), null, 'no Profile / Bond / Chronicle buttons yet');
    equal(await bh.$('[data-test=bh-sync]'), null, 'no connection line over the panel');
    assert(await bh.$('[data-test=bh-meet-continue]') && await bh.$('[data-test=bh-meet-skip]') && await bh.$('[data-test=bh-meet-leave]'), 'Continue, Skip for now and All beasts');
    equal(await bh.$$eval('.tsi-bh input, .tsi-bh textarea', n => n.length), 0, 'nothing to type in');
    equal(JSON.stringify(await state()), before, 'the Bastion is exactly as it was');
    await H.shot(bh, 'beasthandler-meet-1');
  });

  await checkS('panel 2: the wyvern\'s five subspecies as medallions (name only), a die, one button, no text box, nothing to tap; where it lives and how it looks stay hidden', async () => {
    await toPanel2();
    assert(/There are many subspecies of wyvern in The Scarlett Isles, but which one is Stormwing\?/.test(await bare(bh, '[data-test=bh-meet-title]')), await bare(bh, '[data-test=bh-meet-title]'));
    equal((await bh.$$eval('.tsi-bh-medal__name', n => n.map(x => x.textContent))).sort(), ['Bleakhook', 'Bloodcrest', 'Ironcrown', 'Shadowmount', 'Widowspine']);
    equal(await bh.$$eval('.tsi-bh-medal__n', n => n.map(x => x.textContent)), ['1', '2', '3', '4', '5'], 'numbered by place');
    equal(await bh.$$eval('.tsi-bh-medal', n => n.filter(x => x.matches('button, a, [tabindex], [role=button]')).length), 0, 'a medallion cannot be pressed');
    equal(await bh.$$eval('.tsi-bh input, .tsi-bh textarea, .tsi-bh datalist', n => n.length), 0, 'no text box and no list to pick from');
    equal(await bh.$$eval('.tsi-bh .tsi-btn--primary', n => n.filter(x => !x.hidden).map(x => x.textContent)), ['Roll for subspecies'], 'one main button');
    equal(await bare(bh, '[data-test=bh-meet-die]'), 'd5');
    equal(await bh.$eval('[data-test=bh-meet-medals]', n => n.getAttribute('data-lit')), '', 'the marker is not on any medallion yet');
    equal(await bare(bh, '[data-test=bh-meet-about]'), '', 'nothing is told about a variety before the roll');
    equal(await bh.$eval('[data-test=bh-meet-next]', n => n.hidden), true, 'no way on until it has landed');
    equal(await noPicture(), 0);
    await H.shot(bh, 'beasthandler-meet-2');
  });

  await checkS('the roll: the marker hops, the die tumbles, and it lands on the Bastion\'s subspecies (Bloodcrest); the die shows that medallion\'s place; then its name, home and look are told, and Continue appears', async () => {
    const r = await rollSubspecies();
    equal(r.variety, 'bloodcrest');
    equal(r.about, 'Bloodcrest');
    equal(r.die, r.n, 'the die shows the landing medallion\'s place');
    equal(Number(r.n), r.order.indexOf('bloodcrest') + 1, 'which is its place in this run\'s order');
    assert(r.path.length >= 10, 'the marker hopped from medallion to medallion: ' + r.path.length + ' stops');
    equal(r.path[r.path.length - 1], String(r.order.indexOf('bloodcrest')), 'and the last one is the answer');
    equal(await bh.$eval('[data-test=bh-meet-die]', n => n.getAttribute('data-state')), 'landed');
    assert(/East Isle: The red-cliff coastline/.test(await bare(bh, '[data-test=bh-meet-about]')), await bare(bh, '[data-test=bh-meet-about]'));
    assert(/Deep crimson to burnt-rust scales/.test(await bare(bh, '[data-test=bh-meet-about]')));
    equal(await bh.$('[data-test=bh-meet-roll-regional]') === null || await bh.$eval('[data-test=bh-meet-roll-regional]', n => n.hidden), true, 'the Roll button is gone: it cannot be rolled again');
    equal(await bh.$('[data-test=bh-meet-back]') === null || await bh.$eval('[data-test=bh-meet-back]', n => n.hidden), true, 'and there is no Back to roll again');
    equal(await noPicture(), 0, 'the picture is still not shown');
    await H.shot(bh, 'beasthandler-meet-2-landed');
  });

  await checkS('a redraw after the roll (a new snapshot arriving) leaves the landed panel as it was: same order, same marker, same die', async () => {
    const was = await bh.evaluate(() => ({ order: [...document.querySelectorAll('.tsi-bh-medal')].map(x => x.getAttribute('data-variety')), lit: document.querySelector('.tsi-bh-medal--lit').getAttribute('data-variety'), die: document.querySelector('[data-test=bh-meet-die]').textContent }));
    await bh.evaluate(() => TSI.beasthandler.debug.view().refresh());
    const now = await bh.evaluate(() => ({ order: [...document.querySelectorAll('.tsi-bh-medal')].map(x => x.getAttribute('data-variety')), lit: document.querySelector('.tsi-bh-medal--lit').getAttribute('data-variety'), die: document.querySelector('[data-test=bh-meet-die]').textContent }));
    equal(now, was);
    equal(await bh.$eval('[data-test=bh-meet-next]', n => n.hidden), false);
  });

  await checkS('panel 3: three cards (d12, d8, d8), each with its own Roll and a Roll all three; nothing is shown until it is rolled', async () => {
    await bh.click('[data-test=bh-meet-next]');
    await step(3);
    assert(/Every wyvern has its own unique personality\. What is Stormwing’s like\?/.test(await bare(bh, '[data-test=bh-meet-title]')), await bare(bh, '[data-test=bh-meet-title]'));
    equal(await bh.$$eval('.tsi-bh-pcard__label', n => n.map(x => x.textContent)), ['Dominant Temperament', 'Attachment Cue', 'Instinctive Trigger']);
    equal(await bh.$$eval('.tsi-bh-pcard__dice', n => n.map(x => x.textContent)), ['d12', 'd8', 'd8']);
    equal(await bh.$$eval('.tsi-bh-pcard .tsi-btn', n => n.map(x => x.textContent)), ['Roll', 'Roll', 'Roll']);
    assert(await bh.$('[data-test=bh-meet-roll-all]'), 'Roll all three');
    equal(await bh.$$eval('.tsi-bh-pcard__line', n => n.length), 0, 'no line yet');
    equal(await bh.$eval('[data-test=bh-meet-finish]', n => n.hidden), true, 'no way on until all three are rolled');
    equal(await bh.$$eval('.tsi-bh input, .tsi-bh textarea', n => n.length), 0, 'nothing to type in');
    await H.shot(bh, 'beasthandler-meet-3');
  });

  await checkS('each die settles on the number the Bastion really rolled, then the line (and the d12\'s note) appears; a card is locked once rolled; Roll all three does the rest', async () => {
    const c = await creature('cr-stormwing');
    const rolls = c.development.initiation.rolls;
    const t = c.development.temperament;
    const before = JSON.stringify(c.development.initiation);
    await bh.click('[data-test=bh-meet-roll-dominant]');
    await bh.waitForSelector('[data-test=bh-meet-line-dominant]', { timeout: 8000 });
    equal(await bare(bh, '[data-test=bh-meet-die-dominant]'), String(rolls.dominant));
    equal(await bare(bh, '[data-test=bh-meet-line-dominant]'), t.dominant);
    assert(await bh.$('[data-test=bh-meet-card-dominant] .tsi-bh-pcard__note'), 'the d12 line has its note');
    equal(await bh.$eval('[data-test=bh-meet-roll-dominant]', n => n.hidden), true, 'locked: no second roll');
    equal(await bh.$eval('[data-test=bh-meet-finish]', n => n.hidden), true, 'still two to roll');
    await bh.click('[data-test=bh-meet-roll-all]');
    await bh.waitForSelector('[data-test=bh-meet-finish]:not([hidden])', { timeout: 8000 });
    const got = await personality();
    equal(got, [[String(rolls.dominant), t.dominant], [String(rolls.attachment), t.attachment], [String(rolls.trigger), t.trigger]], 'every number and line is the Bastion\'s');
    equal((await creature('cr-stormwing')).development.initiation && JSON.stringify((await creature('cr-stormwing')).development.initiation), before, 'and what the Bastion stored has not moved');
    equal(await noPicture(), 0, 'no picture before the end');
    await H.shot(bh, 'beasthandler-meet-3-done');
  });

  await checkS('Continue: the panel fades to black, "Welcome to the Ironbow, Stormwing!" shows, it goes black again, then the beast fades in with its picture, at real speed', async () => {
    await bh.evaluate(() => { window.TSI_BH_SPEED = 1; });
    const opacity = () => bh.$eval('[data-test=bh-curtain]', n => Number(getComputedStyle(n).opacity));
    await bh.click('[data-test=bh-meet-finish]');
    await bh.waitForSelector('.tsi-bh-curtain--on', { timeout: 8000 });
    assert(await bh.$('[data-test=bh-meet]'), 'the panel is still there while the black comes over it (it does not blank first)');
    equal(await bh.$eval('[data-test=bh-meet]', n => n.classList.contains('tsi-bh-meet--fading')), true, 'and cannot be used meanwhile');
    equal(await bh.$eval('[data-test=bh-root]', n => n.hasAttribute('inert')), true, 'nothing behind the black can be reached');
    await bh.waitForSelector('.tsi-bh-curtain__text--on', { timeout: 8000 });
    equal(await bare(bh, '[data-test=bh-curtain-text]'), 'Welcome to the Ironbow, Stormwing!');
    equal(await opacity(), 1, 'fully black while the welcome words are on');
    equal(await bh.$eval('[data-test=bh-curtain]', n => getComputedStyle(n).position), 'fixed', 'the curtain covers the screen');
    equal(await noPicture(), 0, 'the beast has not been shown yet while "Welcome" is on screen');
    equal(await bh.$('[data-test=bh-meet]'), null, 'the panel has stepped aside behind the black');
    await bh.waitForSelector('.tsi-bh-curtain__text--on', { state: 'detached', timeout: 8000 });
    await bh.waitForTimeout(60);
    equal(await opacity(), 1, 'still black after the words have gone: it goes black again');
    equal(await noPicture(), 0, 'and the beast is still not shown (its page is only drawn behind the black once the words have faded, 650 ms later)');
    await bh.waitForFunction(() => { const c = document.querySelector('[data-test=bh-curtain]'); return !c || Number(getComputedStyle(c).opacity) < 1; }, null, { timeout: 8000 });
    await bh.waitForSelector('[data-test=bh-curtain]', { state: 'detached', timeout: 8000 });
    equal(await bh.$eval('[data-test=bh-root]', n => n.hasAttribute('inert')), false, 'the page is usable again');
    equal(await bare(bh, '[data-test=bh-name]'), 'Stormwing');
    await bh.waitForFunction(() => { const i = document.querySelector('[data-test=bh-portrait-large] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
    assert(/wyvern\/bloodcrest\.webp$/.test(await bh.$eval('[data-test=bh-portrait-large] img', i => i.getAttribute('src'))), 'the Bastion\'s subspecies is the picture');
    equal(await bare(bh, '[data-test=bh-subspecies]'), '✦Bloodcrest');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 1 · Acclimatised');
    equal(await bh.$eval('[data-test=bh-root]', n => n.getAttribute('data-screen')), 'creature-bond');
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.02; });
  });

  await checkS('the reveal changed nothing in the Bastion: one roll per beast, no re-roll, no request, nothing in the Day Log from the app', async () => {
    const s = await state();
    const c = s.creatures.find(x => x.id === 'cr-stormwing');
    equal(c.development.regional, 'Bloodcrest');
    equal(c.development.profileLog.length, 1, 'one change note: the first meeting');
    equal(s.log.filter(l => /Beast Handler/.test(l.title)).length >= 6, true, 'the Bastion\'s own lines about the first meetings are there');
    equal(s.log.filter(l => /Stormwing/.test(l.body) && /Beast Handler/.test(l.title)).length, 2, 'two lines about Stormwing: the profile change and the first meeting, both written when the Bastion rolled it');
    const swept = await ba.evaluate(() => { let r; TSI.bastion.debug.change(s => {
      const T = window.TSI_DATA;
      const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
      r = TSI.bastion.rules.sweepInitiation(s, data, Math.random);
    }); return r; });
    equal([swept.changed, swept.count], [false, 0], 'a sweep finds nobody left to roll for');
    equal(await bh.evaluate(() => TSI.store.fresh('tsi.beasthandler.queue', null)), null, 'the app made no queue and sent nothing');
  });

  await checkS('it never replays once seen: opening the beast again, and after a reload, goes straight to its page', async () => {
    await home();
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    await bh.waitForSelector('[data-test=bh-portrait-large] img');
    equal(await bh.$('[data-test=bh-meet]'), null);
    await reopen('cr-stormwing');
    await bh.waitForSelector('[data-test=bh-name]');
    equal(await bh.$('[data-test=bh-meet]'), null, 'not after a reload either');
  });

  await checkS('the marker\'s path and the die\'s number differ from run to run, and every run lands on the same subspecies; the order of the medallions is new each time', async () => {
    const runs = [];
    for (let i = 0; i < 4; i++) {
      await reopen('cr-swiftwing');
      await step(1);
      await toPanel2();
      runs.push(await rollSubspecies());
    }
    runs.forEach(r => { equal(r.variety, 'dawnmantle'); equal(r.die, String(r.order.indexOf('dawnmantle') + 1), 'the die is the place in that run\'s order'); equal(r.about, 'Dawnmantle'); });
    assert(new Set(runs.map(r => r.order.join())).size > 1, 'the medallions were not in the same order every time: ' + runs.map(r => r.order.join()).join(' | '));
    assert(new Set(runs.map(r => r.path.join('-'))).size > 1, 'the marker did not take the same path every time');
    assert(new Set(runs.map(r => r.die)).size > 1 || new Set(runs.map(r => r.order.join())).size > 1, 'the number on the die varies');
    equal((await creature('cr-swiftwing')).development.initiation.regional, 'dawnmantle', 'and the Bastion\'s answer never moved');
  });

  await checkS('the fixed varieties, all five kinds: Wyvern Bloodcrest, Griffin Dawnmantle, Dire Wolf Blacktide, Buckbear Broadcrown, Fellcat Lichenback', async () => {
    for (const [id, kind] of [['cr-stormwing', 'wyvern'], ['cr-swiftwing', 'griffin'], ['cr-ashfang', 'dire_wolf'], ['cr-tusk', 'buckbear'], ['cr-prowl', 'fellcat']]) {
      /* A beast already seen on this device is made new again, as if it were a new device. */
      await bh.evaluate(() => sessionStorage.clear());
      await reopen(id);
      await step(1);
      await toPanel2();
      const n = await bh.$$eval('.tsi-bh-medal', x => x.length);
      equal(n, kind === 'dire_wolf' ? 6 : 5, kind + ' medallions');
      const r = await rollSubspecies();
      equal(r.variety, FIXED[kind], kind + ' meets as ' + FIXED[kind]);
      equal(r.about, NAMES[FIXED[kind]]);
      equal(await bare(bh, '[data-test=bh-meet-die]'), String(r.order.indexOf(FIXED[kind]) + 1));
      equal((await creature(id)).development.regional, NAMES[FIXED[kind]], 'the Bastion\'s profile says the same');
    }
  });

  await checkS('real speed: it takes 3.5 to 4.5 seconds and slows down, the gaps growing from about 90 ms to about 420 ms', async () => {
    await bh.evaluate(() => sessionStorage.clear());
    await reopen('cr-ashfang');
    await step(1);
    await toPanel2();
    await bh.evaluate(() => { window.TSI_BH_SPEED = 1; });
    const t0 = Date.now();
    const r = await rollSubspecies();
    const took = Date.now() - t0;
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.02; });
    assert(took >= 3400 && took <= 5200, 'the roll took ' + took + ' ms');
    const gaps = r.times.slice(1).map((t, i) => t - r.times[i]);
    assert(gaps.length >= 10, 'enough hops: ' + gaps.length);
    const avg = list => list.reduce((a, b) => a + b, 0) / list.length;
    assert(avg(gaps.slice(0, 3)) < 200 && avg(gaps.slice(-4, -1)) > 250, 'it slows down: first gaps ' + gaps.slice(0, 3).join(',') + ' last gaps ' + gaps.slice(-4).join(','));
    assert(gaps[gaps.length - 1] >= 450, 'it rests on the near miss before the last step: ' + gaps[gaps.length - 1]);
    equal(r.variety, 'blacktide');
  });

  await checkS('closing the page part-way sends nothing and the sequence starts again at the beginning', async () => {
    await bh.evaluate(() => sessionStorage.clear());
    await reopen('cr-ashfang');
    await step(1);
    await toPanel2();
    await rollSubspecies();
    await bh.click('[data-test=bh-meet-next]');
    await step(3);
    await bh.click('[data-test=bh-meet-roll-dominant]');
    await bh.waitForSelector('[data-test=bh-meet-line-dominant]');
    const before = JSON.stringify(await state());
    await reopen('cr-ashfang');
    await step(1);
    equal(JSON.stringify(await state()), before, 'nothing was sent, nothing changed');
    equal(await bh.evaluate(() => Object.keys(sessionStorage).filter(k => /beasthandler\.seen/.test(k)).some(k => JSON.parse(sessionStorage.getItem(k))['cr-ashfang'] === true)), false, 'and it was not marked as seen');
  });

  await checkS('Skip for now (laptop only): the DM goes straight to the beast\'s page; nothing is sent and nothing is marked seen; a reload brings the meeting back', async () => {
    const before = JSON.stringify(await state());
    await bh.click('[data-test=bh-meet-skip]');
    await bh.waitForSelector('[data-test=bh-portrait-large] img');
    equal(await bh.evaluate(() => document.activeElement && document.activeElement.tagName), 'H1', 'keyboard focus goes to the new page\'s heading, not nowhere');
    equal(await bare(bh, '[data-test=bh-name]'), 'Ashfang');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 1 · Acclimatised');
    assert(await bh.$('.tsi-bh-nav') && await bh.$('[data-test=bh-bond]'), 'the rest of the page is there');
    await bh.click('[data-test=bh-tab-profile]');
    equal(await bh.$('[data-test=bh-edit]'), null, 'nothing can be set from Profile');
    equal(JSON.stringify(await state()), before, 'nothing was sent');
    await H.shot(bh, 'beasthandler-meet-skipped');
    await reopen('cr-ashfang');
    await step(1);
  });

  await checkS('the curtain waits for a slow picture, and gives up on one that never comes', async () => {
    await addBeast('cr-slow', 'wyvern', 'Slowcoach', 'wyvern_roost');
    await addBeast('cr-never', 'griffin', 'Neverland', 'griffin_tower');
    await ba.evaluate(() => TSI.store.flush());
    await bh.waitForTimeout(2600);
    await bh.evaluate(() => { window.__slow = true; });
    /* A picture that arrives after about 1.8 s: when the black starts to lift, the picture must already be there. */
    await reopen('cr-slow');
    await bh.evaluate(() => { window.__slow = true; });
    await step(1);
    await toPanel2();
    await rollSubspecies();
    await bh.click('[data-test=bh-meet-next]'); await step(3);
    await bh.click('[data-test=bh-meet-roll-all]');
    await bh.waitForSelector('[data-test=bh-meet-finish]:not([hidden])');
    await bh.evaluate(() => {
      window.TSI_BH_SPEED = 1; window.__lift = null; window.__seenOn = false;
      const tick = () => {
        const c = document.querySelector('[data-test=bh-curtain]');
        const img = document.querySelector('[data-test=bh-portrait-large] img');
        if (c && c.classList.contains('tsi-bh-curtain--on')) window.__seenOn = true;
        else if (c && window.__seenOn && !window.__lift) window.__lift = { complete: !!(img && img.complete && img.naturalWidth > 0) };
        if (!window.__lift) requestAnimationFrame(tick);
      };
      tick();
    });
    await bh.click('[data-test=bh-meet-finish]');
    await bh.waitForFunction(() => window.__lift, null, { timeout: 20000 });
    equal(await bh.evaluate(() => window.__lift.complete), true, 'the picture had arrived when the black began to lift');
    await bh.waitForSelector('[data-test=bh-curtain]', { state: 'detached', timeout: 8000 });
    /* A picture that never arrives: the black still lifts, after the wait runs out (shortened here by the test speed). */
    await reopen('cr-never');
    await bh.evaluate(() => { window.__slow = true; });
    await step(1);
    await toPanel2();
    await rollSubspecies();
    await bh.click('[data-test=bh-meet-next]'); await step(3);
    await bh.click('[data-test=bh-meet-roll-all]');
    await bh.waitForSelector('[data-test=bh-meet-finish]:not([hidden])');
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.3; });
    await bh.click('[data-test=bh-meet-finish]');
    await bh.waitForSelector('[data-test=bh-curtain]');
    await bh.waitForSelector('[data-test=bh-curtain]', { state: 'detached', timeout: 20000 });
    equal(await bare(bh, '[data-test=bh-name]'), 'Neverland', 'the beast\'s page is there');
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.02; window.__slow = false; });
  });

  await checkS('a picture file that cannot be loaded leaves an honest empty frame and says so', async () => {
    await reopen('cr-known');
    await bh.waitForSelector('[data-test=bh-portrait-large] img');
    await bh.evaluate(() => document.querySelector('[data-test=bh-portrait-large] img').dispatchEvent(new Event('error')));
    equal(await bh.$eval('[data-test=bh-portrait-large]', n => n.getAttribute('data-state')), 'blank');
    equal(await bh.$('[data-test=bh-portrait-large] img'), null);
    assert(/couldn.t be loaded here/.test(await bare(bh, '[data-test=bh-picture-lost]')), 'it says so');
    await bh.click('[data-test=bh-tab-profile]'); await bh.click('[data-test=bh-tab-bond]');
    await bh.waitForSelector('[data-test=bh-portrait-large] img');
  });

  await checkS('keyboard: focus lands on each panel\'s heading; Enter presses the focused button; Tab onto the picture shows a ring drawn over it, and focus never goes under the bars', async () => {
    await bh.evaluate(() => sessionStorage.clear());
    await reopen('cr-ashfang');
    await step(1);
    await bh.focus('[data-test=bh-meet-continue]');
    await bh.keyboard.press('Enter');
    await step(2);
    equal(await bh.evaluate(() => document.activeElement && document.activeElement.tagName), 'H1', 'focus is on the new panel\'s heading');
    await bh.focus('[data-test=bh-meet-roll-regional]');
    await bh.keyboard.press('Enter');
    await bh.waitForSelector('[data-test=bh-meet-next]:not([hidden])', { timeout: 15000 });
    equal(await bh.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-test')), 'bh-meet-next', 'when it lands, focus moves to Continue');
    await bh.keyboard.press('Enter');
    await step(3);
    await bh.focus('[data-test=bh-meet-roll-all]');
    await bh.keyboard.press('Enter');
    await bh.waitForSelector('[data-test=bh-meet-finish]:not([hidden])', { timeout: 8000 });
    equal(await bh.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-test')), 'bh-meet-finish', 'and to the last Continue');
    await bh.keyboard.press('Enter');
    await bh.waitForSelector('[data-test=bh-name]', { timeout: 20000 });
    await bh.waitForSelector('[data-test=bh-curtain]', { state: 'detached', timeout: 20000 });
    await bh.waitForSelector('[data-test=bh-greet-large]');
    await bh.keyboard.press('Tab');
    equal(await bh.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-test')), 'bh-greet-large');
    const ring = await bh.$eval('[data-test=bh-greet-large]', n => { const a = getComputedStyle(n, '::after'); return { content: a.content, shadow: a.boxShadow }; });
    assert(ring.content !== 'none' && /244, 205, 118/.test(ring.shadow), 'a gold ring is drawn: ' + JSON.stringify(ring));
    const margin = await bh.$eval('[data-test=bh-tab-profile]', n => parseFloat(getComputedStyle(n).scrollMarginBottom));
    assert(margin >= 80, 'room is left for the bottom bar when scrolling to a control: ' + margin);
  });

  await checkS('reduced motion: nothing hops or tumbles (the answer appears with a short fade), the screens do not fade and the black screen does not fade (it still shows the words)', async () => {
    await bh.emulateMedia({ reducedMotion: 'reduce' });
    await bh.evaluate(() => sessionStorage.clear());
    await reopen('cr-ashfang');
    await step(1);
    equal(await bh.$eval('.tsi-bh', n => getComputedStyle(n).animationName), 'none', 'no screen fade');
    await toPanel2();
    const r = await rollSubspecies();
    assert(r.path.length <= 2, 'the marker did not hop: ' + r.path.length + ' stops');
    equal(r.variety, 'blacktide');
    equal(r.die, String(r.order.indexOf('blacktide') + 1));
    equal(await bh.$eval('[data-test=bh-meet-die]', n => getComputedStyle(n).animationName), 'none', 'the die does not tumble');
    const fade = await bh.$eval('[data-test=bh-meet-about]', n => getComputedStyle(n).animationDuration);
    assert(parseFloat(fade) <= 0.2, 'the answer fades in quickly: ' + fade);
    await bh.click('[data-test=bh-meet-next]'); await step(3);
    await bh.click('[data-test=bh-meet-roll-all]');
    await bh.waitForSelector('[data-test=bh-meet-finish]:not([hidden])', { timeout: 8000 });
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.3; });
    await bh.click('[data-test=bh-meet-finish]');
    await bh.waitForSelector('[data-test=bh-curtain]');
    equal(await bh.$eval('[data-test=bh-curtain]', n => getComputedStyle(n).transitionDuration), '0s', 'the curtain does not fade');
    await bh.waitForSelector('.tsi-bh-curtain__text--on');
    equal(await bare(bh, '[data-test=bh-curtain-text]'), 'Welcome to the Ironbow, Ashfang!');
    await bh.waitForSelector('[data-test=bh-curtain]', { state: 'detached', timeout: 8000 });
    await bh.waitForSelector('[data-test=bh-portrait-large] img');
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.02; });
    await bh.emulateMedia({ reducedMotion: 'no-preference' });
    await home();
    await bh.click('[data-test=bh-beast-cr-ashfang]');
    equal(await bh.$eval('.tsi-bh', n => getComputedStyle(n).animationName), 'tsi-bh-fade-in', 'with motion allowed, screens fade in');
  });

  await checkS('leaving the tool in the middle of the black screen removes it, and in the middle of a roll leaves no timer behind: nothing is left over another tool', async () => {
    await bh.evaluate(() => sessionStorage.clear());
    await reopen('cr-prowl');
    await step(1);
    await toPanel2();
    await bh.evaluate(() => { window.TSI_BH_SPEED = 3; });
    await bh.click('[data-test=bh-meet-roll-regional]');
    await bh.waitForTimeout(300);
    await bh.evaluate(() => TSI.shell.current().life.stop());
    equal(await bh.evaluate(() => TSI.shell.current().life.counts()), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 }, 'a roll that was playing leaves nothing running');
    await reopen('cr-prowl');
    await step(1);
    await toPanel2();
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.02; });
    await toPanel3();
    await bh.click('[data-test=bh-meet-roll-all]');
    await bh.waitForSelector('[data-test=bh-meet-finish]:not([hidden])');
    await bh.evaluate(() => { window.TSI_BH_SPEED = 5; });
    await bh.click('[data-test=bh-meet-finish]');
    await bh.waitForSelector('[data-test=bh-curtain]');
    await bh.evaluate(() => TSI.shell.current().life.stop());
    equal(await bh.$('[data-test=bh-curtain]'), null, 'the black screen is gone');
    equal(await bh.evaluate(() => TSI.shell.current().life.counts()), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.02; });
  });

  await checkS('on the laptop and the TV the three panels fit with their buttons in view and no sideways scroll', async () => {
    /* Fit is measured in a new window of the same browser (which holds the Bastion's save) at both of Harry's sizes. */
    for (const [label, viewport, ratio] of [['laptop', { width: 1707, height: 930 }, 1.5], ['tv', { width: 1920, height: 1080 }, 1]]) {
      const p = await ctx.newPage();
      await p.setViewportSize(viewport);
      await p.goto(HARNESS + '?tool=beasthandler');
      await p.waitForSelector('[data-test=bh-viewas]');
      await p.selectOption('[data-test=bh-viewas]', 'Mira');
      await p.evaluate(() => sessionStorage.clear());
      await p.waitForSelector('[data-test=bh-beast-cr-stormwing]');
      await p.click('[data-test=bh-beast-cr-stormwing]');
      await p.waitForSelector('[data-test=bh-meet][data-step="1"]');
      let lay = await H.layoutCheck(p, ['[data-test=bh-meet-continue]', '[data-test=bh-meet-skip]']);
      equal(lay.outOfView, [], label + ' panel 1'); assert(lay.scrollWidth <= lay.clientWidth);
      await p.click('[data-test=bh-meet-continue]');
      await p.waitForSelector('[data-test=bh-meet][data-step="2"]');
      lay = await H.layoutCheck(p, ['[data-test=bh-meet-roll-regional]', '[data-test=bh-meet-back]']);
      equal(lay.outOfView, [], label + ' panel 2 before the roll'); assert(lay.scrollWidth <= lay.clientWidth);
      await p.click('[data-test=bh-meet-roll-regional]');
      await p.waitForSelector('[data-test=bh-meet-next]:not([hidden])', { timeout: 15000 });
      lay = await H.layoutCheck(p, ['[data-test=bh-meet-next]']);
      equal(lay.outOfView, [], label + ' panel 2 after the roll, with the subspecies told'); assert(lay.scrollWidth <= lay.clientWidth);
      await H.shot(p, 'beasthandler-meet-fit-' + label + '-2');
      await p.click('[data-test=bh-meet-next]');
      await p.waitForSelector('[data-test=bh-meet][data-step="3"]');
      lay = await H.layoutCheck(p, ['[data-test=bh-meet-roll-all]', '[data-test=bh-meet-roll-dominant]']);
      equal(lay.outOfView, [], label + ' panel 3 before the rolls'); assert(lay.scrollWidth <= lay.clientWidth);
      await p.click('[data-test=bh-meet-roll-all]');
      await p.waitForSelector('[data-test=bh-meet-finish]:not([hidden])', { timeout: 8000 });
      lay = await H.layoutCheck(p, ['[data-test=bh-meet-finish]']);
      equal(lay.outOfView, [], label + ' panel 3 after the rolls, with every line told'); assert(lay.scrollWidth <= lay.clientWidth);
      await H.shot(p, 'beasthandler-meet-fit-' + label + '-3');
      await p.close();
    }
  });

  /* ---- A player's phone: the same reveal, from a snapshot code ---- */
  const ph = await H.newContext(browser, 'laptop', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ph.setOffline(true);
  await ph.addInitScript(QUICK);
  const pp = await ph.newPage();
  windows.push(pp);
  const closeDialog = async () => { await ba.locator('.tsi-modal__foot .tsi-btn--primary').last().click(); await ba.waitForTimeout(250); };
  const openBox = async () => {
    if (!(await ba.$('[data-test=beast-box]:visible'))) { await ba.click('[data-test=open-management]'); await ba.waitForSelector('[data-test=beast-box]'); }
  };
  const dmCode = async (button, dialogTest) => {
    await openBox();
    await ba.click('[data-test=' + button + ']');
    await ba.waitForSelector('[data-test=' + dialogTest + ']');
    const code = await ba.$eval('[data-test=' + dialogTest.replace('-dialog', '') + ']', t => t.value);
    await closeDialog();
    return code;
  };
  await ba.evaluate(() => TSI.bastion.debug.change(s => { s.creatures = []; }));
  await addBeast('cr-cloudy', 'dire_wolf', 'Cloudy', 'dire_wolf_den');
  await addBeast('cr-wisp', 'griffin', 'Wisp', 'griffin_tower');
  await ba.evaluate(() => TSI.store.flush());
  const phoneSnapshot = async () => {
    const snap = await dmCode('beast-snap-mira', 'beast-snap-dialog');
    await pp.click('[data-test=bhp-update]');
    await pp.fill('[data-test=bhp-snap-input]', snap);
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForTimeout(500);
  };

  await checkS('phone: the beast is hidden behind the meeting; no Skip button; every button is at least 44 px; nothing scrolls sideways, on all three panels', async () => {
    await pp.goto(PHONE);
    await pp.waitForSelector('[data-test=bhp-screen-link]');
    await pp.fill('[data-test=bhp-pair-input]', await dmCode('beast-pair-mira', 'beast-pair-dialog'));
    await pp.click('[data-test=bhp-link]');
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    await pp.fill('[data-test=bhp-first-snap]', await dmCode('beast-snap-mira', 'beast-snap-dialog'));
    await pp.click('[data-test=bhp-first-go]');
    await pp.waitForSelector('[data-test=bh-beast-cr-cloudy][data-mine=yes]');
    equal(await pp.$eval('[data-test=bh-beast-cr-cloudy]', n => n.tagName), 'BUTTON');
    await pp.click('[data-test=bh-beast-cr-cloudy]');
    await pp.waitForSelector('[data-test=bh-meet][data-step="1"]');
    equal(await pp.$$eval('.tsi-bh img', n => n.length), 0, 'no picture');
    equal(await pp.$('[data-test=bh-meet-skip]'), null, 'a player cannot skip');
    const fit = async name => {
      const r = await pp.evaluate(() => {
        const small = [];
        document.querySelectorAll('.tsi-bh button, .tsi-bh input, .tsi-bh select').forEach(n => { const b = n.getBoundingClientRect(); if (b.width && b.height < 43.5) small.push((n.getAttribute('data-test') || n.className) + ' ' + Math.round(b.height)); });
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, small };
      });
      assert(r.sw <= r.cw, name + ' scrolls sideways: ' + r.sw + ' > ' + r.cw);
      equal(r.small, [], name + ' has small targets');
      await H.shot(pp, 'beasthandler-meet-phone-' + name);
    };
    await fit('1');
    await pp.click('[data-test=bh-meet-continue]');
    await pp.waitForSelector('[data-test=bh-meet][data-step="2"]');
    await fit('2');
    equal(await pp.$$eval('.tsi-bh-medal', n => n.length), 6, 'the six dire wolf subspecies');
    await pp.click('[data-test=bh-meet-roll-regional]');
    await pp.waitForSelector('[data-test=bh-meet-next]:not([hidden])', { timeout: 15000 });
    await fit('2-landed');
    equal(await bare(pp, '[data-test=bh-meet-about] h2'), 'Blacktide');
    await pp.click('[data-test=bh-meet-next]');
    await pp.waitForSelector('[data-test=bh-meet][data-step="3"]');
    await fit('3');
    await pp.click('[data-test=bh-meet-roll-all]');
    await pp.waitForSelector('[data-test=bh-meet-finish]:not([hidden])', { timeout: 8000 });
    await fit('3-done');
    equal(await pp.$$eval('.tsi-bh-pcard__line', n => n.length), 3);
  });

  await checkS('phone: Continue plays the black screen and "Welcome to the Ironbow, Cloudy!", then the picture; "seen" is kept on the phone, so it never plays again, even after a new snapshot', async () => {
    await pp.evaluate(() => {
      window.__welcome = '';
      new MutationObserver(() => { const t = document.querySelector('[data-test=bh-curtain-text]'); if (t && t.textContent) window.__welcome = t.textContent; }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    await pp.click('[data-test=bh-meet-finish]');
    await pp.waitForSelector('[data-test=bh-curtain]', { timeout: 8000 });
    await pp.waitForSelector('[data-test=bh-curtain]', { state: 'detached', timeout: 20000 });
    await pp.waitForSelector('[data-test=bh-portrait-large] img', { timeout: 15000 });
    equal(await pp.evaluate(() => window.__welcome), 'Welcome to the Ironbow, Cloudy!');
    equal(await pp.$('[data-test=bh-curtain]'), null, 'the black screen is gone');
    assert(/dire-wolf\/blacktide\.webp$/.test(await pp.$eval('[data-test=bh-portrait-large] img', i => i.getAttribute('src'))), 'the Bastion\'s subspecies is the picture');
    equal(await bare(pp, '[data-test=bh-subspecies]'), '✦Blacktide');
    equal(await pp.evaluate(() => JSON.parse(localStorage.getItem('tsi.beasthandler.phone.seen'))), { 'cr-cloudy': true });
    await H.shot(pp, 'beasthandler-meet-phone-reveal');
    await pp.reload();
    await pp.waitForSelector('[data-test=bh-beast-cr-cloudy]');
    await pp.click('[data-test=bh-beast-cr-cloudy]');
    await pp.waitForSelector('[data-test=bh-portrait-large] img');
    equal(await pp.$('[data-test=bh-meet]'), null, 'not after a reload');
    await pp.click('[data-test=bh-back]');
    await phoneSnapshot();
    await pp.click('[data-test=bh-beast-cr-cloudy]');
    await pp.waitForSelector('[data-test=bh-portrait-large] img');
    equal(await pp.$('[data-test=bh-meet]'), null, 'nor after a new snapshot');
    await pp.click('[data-test=bh-back]');
  });

  await checkS('phone: a second beast plays its own reveal, and closing the page part-way sends nothing and plays it again from the start', async () => {
    await pp.click('[data-test=bh-beast-cr-wisp]');
    await pp.waitForSelector('[data-test=bh-meet][data-step="1"]');
    await pp.click('[data-test=bh-meet-continue]');
    await pp.waitForSelector('[data-test=bh-meet][data-step="2"]');
    await pp.click('[data-test=bh-meet-roll-regional]');
    await pp.waitForSelector('[data-test=bh-meet-next]:not([hidden])', { timeout: 15000 });
    const before = JSON.stringify(await state());
    await pp.reload();
    await pp.waitForSelector('[data-test=bh-beast-cr-wisp]');
    await pp.click('[data-test=bh-beast-cr-wisp]');
    await pp.waitForSelector('[data-test=bh-meet][data-step="1"]');
    equal(JSON.stringify(await state()), before, 'nothing was sent');
    equal(await pp.evaluate(() => JSON.parse(localStorage.getItem('tsi.beasthandler.phone.seen'))), { 'cr-cloudy': true }, 'and it is not marked seen');
  });

  await checkS('phone: Unlink forgets which meetings were seen, so linking again plays them again', async () => {
    await pp.click('[data-test=bh-meet-leave]');
    await pp.click('[data-test=bhp-unlink]');
    await pp.waitForSelector('.tsi-modal');
    await pp.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await pp.waitForSelector('[data-test=bhp-screen-link]');
    equal(await pp.evaluate(() => localStorage.getItem('tsi.beasthandler.phone.seen')), null);
    /* Mira is already paired, so a new code is asked for with a question first. */
    await openBox();
    await ba.click('[data-test=beast-pair-mira]');
    await ba.waitForFunction(() => /the old one stops working|old one stops/.test(document.body.textContent) || document.querySelectorAll('.tsi-modal').length >= 2);
    await ba.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await ba.waitForSelector('[data-test=beast-pair-dialog]');
    const again = await ba.$eval('[data-test=beast-pair]', t => t.value);
    await closeDialog();
    await pp.fill('[data-test=bhp-pair-input]', again);
    await pp.click('[data-test=bhp-link]');
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    await pp.fill('[data-test=bhp-first-snap]', await dmCode('beast-snap-mira', 'beast-snap-dialog'));
    await pp.click('[data-test=bhp-first-go]');
    await pp.waitForSelector('[data-test=bh-beast-cr-cloudy]');
    await pp.click('[data-test=bh-beast-cr-cloudy]');
    await pp.waitForSelector('[data-test=bh-meet][data-step="1"]');
  });

  await checkS('nothing went wrong or reached for the internet, on either device', async () => {
    equal(ctx.log.net, []); equal(ph.log.net, []);
    equal(ctx.log.failed, []); equal(ph.log.failed, []);
    equal(ctx.log.errors, []); equal(ph.log.errors, []);
    equal(ctx.log.consoleErrors.filter(e => !/Failed to load resource/.test(e)), []);
    equal(ph.log.consoleErrors.filter(e => !/Failed to load resource/.test(e)), []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
