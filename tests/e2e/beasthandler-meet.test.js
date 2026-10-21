/* Scarlett Isles: Beast Handler — meeting a beast for the first time (Harry, 22 October 2026), from files with
   the internet off. A beast whose subspecies has not been chosen is not shown at all: the player is walked through
   "It's time to meet…", the subspecies, and the personality, then the screen fades to black, "Welcome to the Ironbow,
   Name!" shows, and the beast's page fades in with its picture for the first time.
   Checks (laptop, then a phone with the code swap): no picture or page of the beast before the end; the panels and
   their buttons; Roll and the five tap choices; one request with all four lines (sent once); the black screen and the
   welcome words in order; the picture appears at once while the Bastion's answer is awaited, marked as waiting, and the
   marks go when it answers; Skip for now (laptop only); closing the page mid-way sends nothing; reduced motion; the
   black screen never outlives the tool; every button fits a phone.
   Run with:  node tests/e2e/beasthandler-meet.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');
const PHONE = H.fileUrl('beasthandler.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const QUICK = () => { window.TSI_BH_SPEED = 0.02; };

(async () => {
  const browser = await H.chromium.launch();
  section('Beast Handler: meeting a beast');

  /* ---- The DM's laptop: a Bastion with three beasts that have not been introduced ---- */
  const ctx = await H.newContext(browser, 'laptop', { backedUp: true });
  await ctx.setOffline(true);
  await ctx.addInitScript(QUICK);
  const ex = await ctx.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await ctx.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    s.partyLevel = 9; s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }, { facId: 'griffin_tower', status: 'built' }, { facId: 'dire_wolf_den', status: 'built' }];
    s.facilityLevels.wyvern_roost = 3; s.facilityLevels.griffin_tower = 2; s.facilityLevels.dire_wolf_den = 2;
    const mk = (id, species, name, home, handler) => {
      const c = { id, species, owner: '', name, status: 'housed', home, grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = handler;
      return c;
    };
    s.creatures = [mk('cr-stormwing', 'wyvern', 'Stormwing', 'wyvern_roost', 'Mira'), mk('cr-swiftwing', 'griffin', 'Swiftwing', 'griffin_tower', 'Mira'), mk('cr-ashfang', 'dire_wolf', 'Ashfang', 'dire_wolf_den', 'Mira')];
  }));
  await ba.evaluate(() => TSI.store.flush());
  await ba.waitForTimeout(500);
  const state = () => bas(ba);
  const creature = async id => (await state()).creatures.find(c => c.id === id);
  const requests = async () => Object.keys((await state()).beast.done).length;
  const bh = await ctx.newPage();
  await bh.goto(HARNESS + '?tool=beasthandler');
  await bh.waitForSelector('[data-test=bh-viewas]');
  const home = async () => { for (let i = 0; i < 3 && !(await bh.$('[data-test=bh-viewas]')); i++) { await bh.click('[data-test=bh-back]'); await bh.waitForTimeout(150); } };
  const viewAs = async who => { await home(); await bh.selectOption('[data-test=bh-viewas]', who); await bh.waitForTimeout(300); };
  const step = async n => bh.waitForSelector('[data-test=bh-meet][data-step="' + n + '"]', { timeout: 8000 });
  const noPicture = () => bh.$$eval('.tsi-bh img', n => n.length);
  await viewAs('Mira');

  await check('a beast with no subspecies is not shown: the first panel comes instead, with no picture and no page', async () => {
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    await step(1);
    equal(await bare(bh, '[data-test=bh-meet-title]'), 'It’s time to meet Stormwing…');
    equal(await noPicture(), 0, 'no picture anywhere');
    equal(await bh.$('[data-test=bh-portrait-large]'), null, 'no hero frame');
    equal(await bh.$('[data-test=bh-bond]'), null, 'no bond card yet');
    equal(await bh.$('.tsi-bh-nav'), null, 'no Profile / Orders / Chronicle buttons yet');
    equal(await bh.$('[data-test=bh-sync]'), null, 'no connection line over the panel');
    assert(await bh.$('[data-test=bh-meet-continue]') && await bh.$('[data-test=bh-meet-skip]') && await bh.$('[data-test=bh-meet-leave]'), 'Continue, Skip for now and All beasts');
    equal(await requests(), 0, 'nothing is asked of the Bastion by looking');
    await H.shot(bh, 'beasthandler-meet-1');
  });

  await check('subspecies: Save is off until there is a name; five tap choices fill it and say about the variety; an unknown name warns; Roll picks one of the five', async () => {
    await bh.click('[data-test=bh-meet-continue]');
    await step(2);
    assert(/There are many subspecies of wyvern in The Scarlett Isles, but which one is Stormwing\?/.test(await bare(bh, '[data-test=bh-meet-title]')), await bare(bh, '[data-test=bh-meet-title]'));
    equal(await bh.$eval('[data-test=bh-meet-save-subspecies]', b => b.disabled), true, 'Save waits for a name');
    equal(await bh.$$eval('.tsi-bh-meet__chip', n => n.map(x => x.textContent)), ['Widowspine', 'Bleakhook', 'Ironcrown', 'Bloodcrest', 'Shadowmount']);
    equal(await noPicture(), 0, 'choosing a subspecies shows no picture yet');
    await bh.click('[data-test=bh-meet-chip-bleakhook]');
    equal(await bh.$eval('[data-test=bh-meet-in-regional]', i => i.value), 'Bleakhook');
    equal(await bh.$eval('[data-test=bh-meet-chip-bleakhook]', n => n.getAttribute('aria-pressed')), 'true');
    assert(/North Isle/.test(await bare(bh, '[data-test=bh-meet-about]')), 'it says where that variety lives: ' + await bare(bh, '[data-test=bh-meet-about]'));
    equal(await bh.$eval('[data-test=bh-meet-save-subspecies]', b => b.disabled), false);
    await bh.fill('[data-test=bh-meet-in-regional]', 'Moonlit Rift');
    await bh.waitForSelector('[data-test=bh-meet-warn]:not([hidden])');
    assert(/no picture for it/.test(await bare(bh, '[data-test=bh-meet-warn]')), await bare(bh, '[data-test=bh-meet-warn]'));
    equal(await bh.$eval('[data-test=bh-meet-save-subspecies]', b => b.disabled), false, 'a name of your own can still be kept');
    await bh.click('[data-test=bh-meet-roll-regional]');
    const rolled = await bh.$eval('[data-test=bh-meet-in-regional]', i => i.value);
    assert(['Widowspine', 'Bleakhook', 'Ironcrown', 'Bloodcrest', 'Shadowmount'].indexOf(rolled) !== -1, 'a roll gives one of the five: ' + rolled);
    assert(/Suggestion \(rolled \d of 5\): not saved yet/.test(await bare(bh, '[data-test=bh-meet-sugg-regional]')), await bare(bh, '[data-test=bh-meet-sugg-regional]'));
    await bh.fill('[data-test=bh-meet-in-regional]', '');
    equal(await bh.$eval('[data-test=bh-meet-save-subspecies]', b => b.disabled), true, 'emptied again, Save is off');
    await bh.click('[data-test=bh-meet-chip-widowspine]');
    await H.shot(bh, 'beasthandler-meet-2');
    await bh.click('[data-test=bh-meet-back]');
    await step(1);
    await bh.click('[data-test=bh-meet-continue]');
    await step(2);
    equal(await bh.$eval('[data-test=bh-meet-in-regional]', i => i.value), 'Widowspine', 'Back and forward keeps the choice');
    equal(await requests(), 0, 'still nothing asked of the Bastion');
  });

  await check('personality: the three lines are typed or rolled; Save needs all three; nothing is sent before the last Save', async () => {
    await bh.click('[data-test=bh-meet-save-subspecies]');
    await step(3);
    assert(/Every wyvern has its own unique personality\. What is Stormwing’s like\?/.test(await bare(bh, '[data-test=bh-meet-title]')), await bare(bh, '[data-test=bh-meet-title]'));
    equal(await bh.$eval('[data-test=bh-meet-save-personality]', b => b.disabled), true);
    await bh.fill('[data-test=bh-meet-in-dominant]', 'Proud');
    equal(await bh.$eval('[data-test=bh-meet-save-personality]', b => b.disabled), true, 'one line is not enough');
    await bh.click('[data-test=bh-meet-roll-all]');
    const t = await bh.evaluate(() => window.TSI_DATA.beastProfile);
    const vals = await bh.evaluate(() => ['dominant', 'attachment', 'trigger'].map(k => document.querySelector('[data-test=bh-meet-in-' + k + ']').value));
    assert(t.dominant.entries.some(e => e.label === vals[0]) && t.species.wyvern.attachment.entries.some(e => e.label === vals[1]) && t.species.wyvern.trigger.entries.some(e => e.label === vals[2]), 'all three come from the tables: ' + vals);
    equal(await bh.$eval('[data-test=bh-meet-save-personality]', b => b.disabled), false);
    await bh.fill('[data-test=bh-meet-in-dominant]', 'Proud');
    await bh.fill('[data-test=bh-meet-in-trigger]', 'x'.repeat(121));
    equal(await bh.$eval('[data-test=bh-meet-save-personality]', b => b.disabled), true, 'a line that is too long cannot be saved');
    await bh.fill('[data-test=bh-meet-in-trigger]', 'Loud metallic ringing');
    await bh.fill('[data-test=bh-meet-in-attachment]', 'Lowers its head');
    equal(await noPicture(), 0, 'no picture before the end');
    equal(await requests(), 0, 'nothing has been asked of the Bastion yet');
    await H.shot(bh, 'beasthandler-meet-3');
  });

  await check('Save and continue: the screen goes black, "Welcome to the Ironbow, Stormwing!" shows, it goes black again, then the beast fades in with its picture', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { TSI.bastion.rules.beastState(s).accept = false; }));   /* the Bastion is not answering yet */
    await ba.evaluate(() => TSI.store.flush());
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.3; });
    await bh.click('[data-test=bh-meet-save-personality]');
    await bh.waitForSelector('[data-test=bh-curtain]', { timeout: 8000 });
    await bh.waitForSelector('.tsi-bh-curtain--on', { timeout: 8000 });
    await bh.waitForSelector('.tsi-bh-curtain__text--on', { timeout: 8000 });
    equal(await bare(bh, '[data-test=bh-curtain-text]'), 'Welcome to the Ironbow, Stormwing!');
    const cur = await bh.$eval('[data-test=bh-curtain]', n => { const cs = getComputedStyle(n); return { op: cs.opacity, pos: cs.position, bg: cs.backgroundColor }; });
    assert(cur.pos === 'fixed', 'the curtain covers the screen: ' + cur.pos);
    equal(await noPicture(), 0, 'the beast has not been shown yet while "Welcome" is on screen');
    await bh.waitForSelector('.tsi-bh-curtain__text--on', { state: 'detached', timeout: 8000 });
    await bh.waitForSelector('[data-test=bh-curtain]', { state: 'detached', timeout: 8000 });
    equal(await bare(bh, '[data-test=bh-name]'), 'Stormwing');
    await bh.waitForFunction(() => { const i = document.querySelector('[data-test=bh-portrait-large] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
    assert(/wyvern\/widowspine\.webp$/.test(await bh.$eval('[data-test=bh-portrait-large] img', i => i.getAttribute('src'))), 'the chosen subspecies is the picture');
    equal(await bare(bh, '[data-test=bh-subspecies]'), '✦Widowspine');
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.02; });
  });

  await check('while the Bastion has not answered the picture is already there, marked as waiting, and the Profile lines say so; the Bastion has nothing yet', async () => {
    equal(await bare(bh, '[data-test=bh-hero-pending]'), 'Waiting for the Bastion to confirm.');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 0 · Unfamiliar');
    assert(await bh.$eval('[data-test=bh-portrait-large] img', i => i.getBoundingClientRect().height > 200), 'a big picture, not a collapsed one');
    await bh.click('[data-test=bh-tab-profile]');
    assert(/Widowspine/.test(await bare(bh, '[data-test=bh-p-regional]')) && /waiting/.test(await bare(bh, '[data-test=bh-p-regional]')), await bare(bh, '[data-test=bh-p-regional]'));
    assert(!(await creature('cr-stormwing')).development.regional, 'the Bastion has not been changed yet');
    equal(await requests(), 0, 'and has not answered anything');
    await bh.click('[data-test=bh-back]');
    await H.shot(bh, 'beasthandler-meet-reveal-waiting');
  });

  await check('when the Bastion answers, the request is applied once, all four lines are saved, and the waiting marks go', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.beast.accept = true; }));
    await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.find(c => c.id === 'cr-stormwing').development.regional === 'Widowspine', null, { timeout: 12000 });
    await bh.waitForSelector('[data-test=bh-hero-pending]', { state: 'detached', timeout: 12000 });
    await bh.waitForTimeout(3000);
    const c = await creature('cr-stormwing');
    equal([c.development.regional, c.development.temperament.dominant, c.development.temperament.attachment, c.development.temperament.trigger], ['Widowspine', 'Proud', 'Lowers its head', 'Loud metallic ringing']);
    equal(await requests(), 1, 'one request in all');
    equal(c.development.profileLog.length, 1, 'one change note');
    equal(c.development.bond.level, 0, 'the bond is untouched');
    assert(/wyvern\/widowspine\.webp$/.test(await bh.$eval('[data-test=bh-portrait-large] img', i => i.getAttribute('src'))), 'the picture stays');
    equal(await bh.$('[data-test=bh-meet]'), null, 'the meeting does not come back');
  });

  await check('opening the same beast later goes straight to its page; another beast with no subspecies gets the meeting', async () => {
    await home();
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    await bh.waitForSelector('[data-test=bh-portrait-large] img');
    equal(await bh.$('[data-test=bh-meet]'), null);
    await home();
    await bh.click('[data-test=bh-beast-cr-swiftwing]');
    await step(1);
    equal(await bare(bh, '[data-test=bh-meet-title]'), 'It’s time to meet Swiftwing…');
  });

  await check('closing the page part-way sends nothing and the sequence starts again at the beginning', async () => {
    await bh.click('[data-test=bh-meet-continue]');
    await step(2);
    await bh.click('[data-test=bh-meet-chip-embermantle]');
    await bh.click('[data-test=bh-meet-save-subspecies]');
    await step(3);
    const before = await requests();
    await bh.reload();
    await bh.waitForSelector('[data-test=bh-viewas]');
    await viewAs('Mira');
    await bh.click('[data-test=bh-beast-cr-swiftwing]');
    await step(1);
    equal(await requests(), before, 'nothing was sent');
    assert(!(await creature('cr-swiftwing')).development.regional, 'nothing was saved');
  });

  await check('Skip for now (laptop only): the beast opens with an empty frame and "Subspecies not chosen yet"; nothing is sent; a reload brings the meeting back', async () => {
    await bh.click('[data-test=bh-meet-skip]');
    await bh.waitForSelector('[data-test=bh-portrait-large][data-state=blank]');
    equal(await noPicture(), 0, 'no picture');
    equal(await bare(bh, '[data-test=bh-subspecies]'), '✦Subspecies not chosen yet');
    equal(await bh.$('[data-test=bh-greet-large]'), null, 'nothing to tap');
    assert(await bh.$('.tsi-bh-nav') && await bh.$('[data-test=bh-bond]'), 'the rest of the page is there');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 0 · Unfamiliar');
    await bh.click('[data-test=bh-tab-profile]');
    assert(await bh.$('[data-test=bh-edit]'), 'the subspecies can still be set from Profile');
    equal(await requests(), 1, 'nothing new was sent');
    await H.shot(bh, 'beasthandler-meet-skipped');
    await bh.reload();
    await bh.waitForSelector('[data-test=bh-viewas]');
    await viewAs('Mira');
    await bh.click('[data-test=bh-beast-cr-swiftwing]');
    await step(1);
  });

  await check('the Profile page can still set a subspecies for a beast that was skipped, and the picture follows (as before)', async () => {
    await bh.click('[data-test=bh-meet-skip]');
    await bh.waitForSelector('[data-test=bh-portrait-large][data-state=blank]');
    await bh.click('[data-test=bh-tab-profile]');
    await bh.click('[data-test=bh-edit]');
    await bh.fill('[data-test=bh-in-regional]', 'Dawnmantle');
    await bh.click('[data-test=bh-save]');
    await bh.waitForSelector('[data-test=bh-requests] [data-state=saved]', { timeout: 14000 });
    await bh.click('[data-test=bh-back]');
    await bh.waitForFunction(() => { const i = document.querySelector('[data-test=bh-portrait-large] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
    assert(/griffin\/dawnmantle\.webp$/.test(await bh.$eval('[data-test=bh-portrait-large] img', i => i.getAttribute('src'))));
    equal(await bare(bh, '[data-test=bh-subspecies]'), '✦Dawnmantle');
  });

  await check('reduced motion: the screens do not fade and the black screen does not fade (it still shows the words)', async () => {
    await bh.emulateMedia({ reducedMotion: 'reduce' });
    await home();
    await bh.click('[data-test=bh-beast-cr-ashfang]');
    await step(1);
    equal(await bh.$eval('.tsi-bh', n => getComputedStyle(n).animationName), 'none', 'no screen fade');
    await bh.click('[data-test=bh-meet-continue]'); await step(2);
    await bh.click('[data-test=bh-meet-chip-icepelt]');
    await bh.click('[data-test=bh-meet-save-subspecies]'); await step(3);
    await bh.click('[data-test=bh-meet-roll-all]');
    await bh.evaluate(() => { window.TSI_BH_SPEED = 0.3; });
    await bh.click('[data-test=bh-meet-save-personality]');
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

  await check('leaving the tool in the middle of the black screen removes it: nothing is left over another tool', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      const R = TSI.bastion.rules;
      const c = { id: 'cr-newcomer', species: 'griffin', owner: '', name: 'Newcomer', status: 'housed', home: 'griffin_tower', grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira';
      s.creatures.push(c);
    }));
    await ba.evaluate(() => TSI.store.flush());
    await bh.waitForTimeout(2600);
    await home();
    await bh.click('[data-test=bh-beast-cr-newcomer]');
    await step(1);
    await bh.click('[data-test=bh-meet-continue]'); await step(2);
    await bh.click('[data-test=bh-meet-chip-galeclaw]');
    await bh.click('[data-test=bh-meet-save-subspecies]'); await step(3);
    await bh.click('[data-test=bh-meet-roll-all]');
    await bh.evaluate(() => { window.TSI_BH_SPEED = 5; });
    await bh.click('[data-test=bh-meet-save-personality]');
    await bh.waitForSelector('[data-test=bh-curtain]');
    await bh.evaluate(() => TSI.shell.current().life.stop());
    equal(await bh.$('[data-test=bh-curtain]'), null, 'the black screen is gone');
    equal(await bh.evaluate(() => TSI.shell.current().life.counts()), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
  });

  await check('on the laptop the first-meeting panels fit with their buttons in view and no sideways scroll', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      const R = TSI.bastion.rules;
      const c = { id: 'cr-fit', species: 'griffin', owner: '', name: 'Fitting', status: 'housed', home: 'griffin_tower', grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira';
      s.creatures.push(c);
    }));
    await ba.evaluate(() => TSI.store.flush());
    const p = await ctx.newPage();
    await p.goto(HARNESS + '?tool=beasthandler');
    await p.waitForSelector('[data-test=bh-viewas]');
    await p.selectOption('[data-test=bh-viewas]', 'Mira');
    await p.waitForSelector('[data-test=bh-beast-cr-fit]');
    await p.click('[data-test=bh-beast-cr-fit]');
    await p.waitForSelector('[data-test=bh-meet][data-step="1"]');
    let lay = await H.layoutCheck(p, ['[data-test=bh-meet-continue]', '[data-test=bh-meet-skip]']);
    equal(lay.outOfView, [], 'panel 1'); assert(lay.scrollWidth <= lay.clientWidth);
    await p.click('[data-test=bh-meet-continue]');
    await p.waitForSelector('[data-test=bh-meet][data-step="2"]');
    await p.click('[data-test=bh-meet-chip-galeclaw]');
    lay = await H.layoutCheck(p, ['[data-test=bh-meet-save-subspecies]', '[data-test=bh-meet-back]']);
    equal(lay.outOfView, [], 'panel 2'); assert(lay.scrollWidth <= lay.clientWidth);
    await p.click('[data-test=bh-meet-save-subspecies]');
    await p.waitForSelector('[data-test=bh-meet][data-step="3"]');
    await p.click('[data-test=bh-meet-roll-all]');
    lay = await H.layoutCheck(p, ['[data-test=bh-meet-save-personality]', '[data-test=bh-meet-back]']);
    equal(lay.outOfView, [], 'panel 3'); assert(lay.scrollWidth <= lay.clientWidth);
    await p.close();
  });

  /* ---- A player's phone: the same sequence, then the request goes back as a code ---- */
  const ph = await H.newContext(browser, 'laptop', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ph.setOffline(true);
  await ph.addInitScript(QUICK);
  const pp = await ph.newPage();
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
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    const c = { id: 'cr-cloudy', species: 'dire_wolf', owner: '', name: 'Cloudy', status: 'housed', home: 'dire_wolf_den', grantedDay: 1, housedDay: 1, msgId: '' };
    c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira';
    s.creatures = [c];
  }));
  await ba.evaluate(() => TSI.store.flush());

  await check('phone: the beast is hidden behind the meeting; no Skip button; every button and choice is at least 44 px; nothing scrolls sideways', async () => {
    await pp.goto(PHONE);
    await pp.waitForSelector('[data-test=bhp-screen-link]');
    await pp.fill('[data-test=bhp-pair-input]', await dmCode('beast-pair-mira', 'beast-pair-dialog'));
    await pp.click('[data-test=bhp-link]');
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    await pp.fill('[data-test=bhp-first-snap]', await dmCode('beast-snap-mira', 'beast-snap-dialog'));
    await pp.click('[data-test=bhp-first-go]');
    await pp.waitForSelector('[data-test=bh-beast-cr-cloudy][data-mine=yes]');
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
    await pp.click('[data-test=bh-meet-chip-hollowhowl]');
    await fit('2');
    await pp.click('[data-test=bh-meet-save-subspecies]');
    await pp.waitForSelector('[data-test=bh-meet][data-step="3"]');
    await pp.click('[data-test=bh-meet-roll-all]');
    await fit('3');
  });

  let code;
  await check('phone: Save and continue plays the black screen and welcome, shows the picture marked "not confirmed yet", then offers the request code to send', async () => {
    await pp.click('[data-test=bh-meet-save-personality]');
    await pp.waitForSelector('[data-test=bh-curtain]');
    equal(await bare(pp, '[data-test=bh-curtain-text]'), 'Welcome to the Ironbow, Cloudy!');
    await pp.waitForSelector('[data-test=bhp-request-dialog]', { timeout: 10000 });
    equal(await pp.$('[data-test=bh-curtain]'), null, 'the black screen is gone before the code is offered');
    code = await pp.$eval('[data-test=bhp-request]', t => t.value);
    assert(/^BHC1\./.test(code));
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForSelector('[data-test=bh-portrait-large] img');
    equal(await bare(pp, '[data-test=bh-hero-pending]'), 'Not confirmed yet: send your request code to the DM.');
    assert(/dire-wolf\/hollowhowl\.webp$/.test(await pp.$eval('[data-test=bh-portrait-large] img', i => i.getAttribute('src'))), 'the chosen subspecies is the picture');
    equal(await bare(pp, '[data-test=bh-subspecies]'), '✦Hollowhowl');
    assert(!(await creature('cr-cloudy')).development.regional, 'the Bastion has not been told yet');
    await H.shot(pp, 'beasthandler-meet-phone-reveal');
  });

  await check('phone: the DM applies the code once; the new snapshot takes the waiting mark away and keeps the picture', async () => {
    const before = await requests();
    await openBox();
    await ba.click('[data-test=beast-paste]');
    await ba.waitForSelector('[data-test=beast-paste-dialog]');
    await ba.fill('[data-test=beast-paste-text]', code);
    await ba.click('.tsi-modal__foot .tsi-btn--primary');
    await ba.waitForSelector('[data-test=beast-result-dialog]');
    const answer = await ba.$eval('[data-test=beast-result]', t => t.value);
    await closeDialog();
    const c = await creature('cr-cloudy');
    equal(c.development.regional, 'Hollowhowl');
    assert(c.development.temperament.dominant && c.development.temperament.attachment && c.development.temperament.trigger, 'all three lines are saved');
    equal(await requests(), before + 1, 'the request was applied once: one more receipt');
    await pp.click('[data-test=bh-back]');   /* from the beast's page to the list */
    await pp.click('[data-test=bhp-update]');
    await pp.fill('[data-test=bhp-snap-input]', answer);
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForTimeout(500);
    await pp.click('[data-test=bh-beast-cr-cloudy]');
    await pp.waitForSelector('[data-test=bh-portrait-large] img');
    equal(await pp.$('[data-test=bh-hero-pending]'), null, 'the waiting mark is gone');
    equal(await pp.$('[data-test=bh-meet]'), null, 'and the meeting does not come back');
    assert(/dire-wolf\/hollowhowl\.webp$/.test(await pp.$eval('[data-test=bh-portrait-large] img', i => i.getAttribute('src'))));
  });

  await check('nothing went wrong or reached for the internet, on either device', async () => {
    equal(ctx.log.net, []); equal(ph.log.net, []);
    equal(ctx.log.failed, []); equal(ph.log.failed, []);
    equal(ctx.log.errors, []); equal(ph.log.errors, []);
    equal(ctx.log.consoleErrors.filter(e => !/Failed to load resource/.test(e)), []);
    equal(ph.log.consoleErrors.filter(e => !/Failed to load resource/.test(e)), []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
