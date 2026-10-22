/* Scarlett Isles: Beast Handler (BH-1b, Harry's approvals of 21 October 2026; read-only since 22 October 2026),
   from the test page with the internet off. The Bastion is built in one
   window (a Roost with Elara's wyvern and a second wyvern, a Griffin Tower
   with two griffins and one that is not acclimatised yet, no Dire Wolf Den)
   and the companion is opened in another.
   It checks: the Home directory; "Viewing as"; other players' beasts as plain
   lines, and a Bond 0 beast as a line that says "Not acclimatised yet" and
   shows nothing else; the three tabs along the bottom (Profile, Bond,
   Chronicle) with Bond as the page it opens on; the harmless greeting; a
   Profile that only shows the Bastion's words; the read-only Chronicle
   without DM-only notes; that there are no Orders and nothing to type; a
   phone-sized screen, the laptop and the TV (no sideways scroll, 44 px
   targets); reduced motion; and that nothing in the Bastion changed.
   Run with:  node tests/e2e/beasthandler.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const texts = (page, sel) => page.$$eval(sel, ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));

(async () => {
  const browser = await H.chromium.launch();
  section('Beast Handler');
  const ctx = await H.newContext(browser, 'laptop', { backedUp: true });
  await ctx.setOffline(true);

  /* ---- The Bastion, built to order ---- */
  const ex = await ctx.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await ctx.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    s.partyLevel = 9;
    s.treasuryGP = 7654321;
    s.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }, { facId: 'griffin_tower', status: 'built' }];
    s.facilityLevels.wyvern_roost = 3;
    s.facilityLevels.griffin_tower = 2;
    const mk = (id, species, name, home, handler) => {
      const c = { id, species, owner: '', name, status: 'housed', home, grantedDay: 1, housedDay: 1, msgId: '' };
      if (id === 'elara_wyvern') { c.owner = 'elara'; c.development = R.newDevelopment(c, s.day); }
      else if (handler) { c.development = R.newDevelopment(c, s.day); c.development.handlerId = handler; }
      /* Every acclimatised beast here has already been introduced (its subspecies is set), so its page opens at once; meeting a beast for the first time is tested in beasthandler-meet.test.js. */
      if (c.development) c.development.regional = species === 'wyvern' ? 'Widowspine' : 'Embermantle';
      return c;
    };
    s.creatures = [
      mk('elara_wyvern', 'wyvern', '', 'wyvern_roost'),
      mk('cr-stormwing', 'wyvern', 'Stormwing', 'wyvern_roost', 'Mira'),
      mk('cr-swiftwing', 'griffin', 'Swiftwing', 'griffin_tower', 'Mira'),
      mk('cr-loose', 'griffin', 'Unhandled', 'griffin_tower', ''),
      mk('cr-newcomer', 'griffin', 'Newcomer', 'griffin_tower', 'Mira')
    ];
    s.creatures[1].development.bond.level = 2;
    s.creatures[2].development.bond.level = 3;
    s.creatures[4].development.bond.level = 0;
    s.creatures[4].development.temperament.dominant = 'SECRET-NEWCOMER-LINE';
    const data = { bastion: window.TSI_DATA.bastion, facilities: window.TSI_DATA.bastionFacilities, tools: window.TSI_DATA.bastionTools, research: window.TSI_DATA.bastionResearch, goods: window.TSI_DATA.bastionGoods, commerce: window.TSI_DATA.bastionCommerce, courier: window.TSI_DATA.bastionCourier, creatures: window.TSI_DATA.bastionCreatures };
    R.setTemperament(s, data, 'elara_wyvern', { dominant: 'Proud', attachment: 'Lowers its head', trigger: 'Loud metallic ringing' });
    R.addChronicleNote(s, data, 'elara_wyvern', 'She came back to the tower at dusk.');
    R.addChronicleNote(s, data, 'elara_wyvern', 'SECRET-DM-NOTE who sent the storm', true);
  }));
  await ba.evaluate(() => TSI.store.flush());
  await ba.waitForTimeout(400);
  const before = JSON.stringify(await bas(ba));

  /* ---- The companion ---- */
  const bh = await ctx.newPage();
  await bh.goto(HARNESS + '?tool=beasthandler');
  await bh.waitForSelector('[data-test=bh-root] .tsi-bh-title');
  const view = async who => {
    await bh.selectOption('[data-test=bh-viewas]', who);
    await bh.waitForTimeout(250);
  };
  const home = async () => { if (await bh.$('[data-test=bh-back]')) { await bh.click('[data-test=bh-back]'); await bh.waitForTimeout(120); } if (await bh.$('[data-test=bh-back]')) { await bh.click('[data-test=bh-back]'); await bh.waitForTimeout(120); } };

  await check('Home: opens as the directory only (nobody\'s detail is open until the DM chooses), with the heading and the buildings that stand, and no Dire Wolf Den', async () => {
    equal(await bh.$eval('[data-test=bh-viewas]', n => n.value), '');
    equal(await bh.$$eval('.tsi-bh-beast--mine', n => n.length), 0);
    assert(/Choose a handler/.test(await bare(bh, '[data-test=bh-message]')));
    equal(await bare(bh, '.tsi-bh-title__main'), 'Scarlett Isles: Beast Handler');
    equal(await bare(bh, '.tsi-bh-title__sub'), 'The Companions of Ironbow');
    equal(await texts(bh, '.tsi-bh-card__title'), ['Wyvern Roost', 'Griffin Tower']);
    equal(await texts(bh, '.tsi-bh-card__head .tsi-pill'), ['Level 3', 'Level 2']);
    equal(await bh.$('[data-test=bh-fac-dire_wolf_den]'), null, 'an unbuilt building is not listed');
    equal(await texts(bh, '[data-test=bh-fac-wyvern_roost] .tsi-bh-beast__name'), ['Elara\'s wyvern', 'Stormwing']);
    equal(await texts(bh, '[data-test=bh-fac-griffin_tower] .tsi-bh-beast__name'), ['Swiftwing', 'Unhandled', 'Newcomer']);
    assert(/Read from the Bastion saved on this device · Day \d+/.test(await bare(bh, '[data-test=bh-sync]')), await bare(bh, '[data-test=bh-sync]'));
  });

  await check('Viewing as Elara: her wyvern is a tap-through entry; everyone else\'s is a plain line (no buttons, no detail)', async () => {
    await view('elara');
    equal(await bh.$eval('[data-test=bh-beast-elara_wyvern]', n => n.tagName), 'BUTTON');
    equal(await bh.$eval('[data-test=bh-beast-cr-stormwing]', n => n.tagName), 'LI');
    equal(await bh.$eval('[data-test=bh-beast-cr-stormwing]', n => n.getAttribute('data-mine')), 'no');
    assert(/Handler: Mira/.test(await bare(bh, '[data-test=bh-beast-cr-stormwing]')), 'the directory names the handler');
    assert(/Bond 1 · Acclimatised/.test(await bare(bh, '[data-test=bh-row-bond-elara_wyvern]')), 'Elara\'s bond is on her line');
    equal(await bh.$('[data-test=bh-row-bond-cr-swiftwing]') === null, false, 'a creature with a bond record shows it');
    equal(await bh.$('[data-test=bh-row-bond-cr-loose]'), null, 'a creature with no bond record shows none');
  });

  await check('Elara\'s Bond page (where a beast opens): name, handler, Bond 1 of 0 to 5, a harmless greeting, three tabs with Bond lit', async () => {
    await bh.click('[data-test=bh-beast-elara_wyvern]');
    equal(await bh.$eval('[data-test=bh-root]', n => n.getAttribute('data-screen')), 'creature-bond');
    equal(await bare(bh, '[data-test=bh-name]'), 'Elara\'s wyvern');
    equal(await bare(bh, '[data-test=bh-handler]'), 'Handler: Elara');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 1 \u00b7 Acclimatised');
    equal(await bare(bh, '[data-test=bh-stage]'), 'Stage 1 of 5');
    equal(await texts(bh, '.tsi-bh-pill__label'), ['Acclimatised', 'Trusting', 'Bonded', 'Devoted', 'Legendary']);
    equal(await bh.$$eval('.tsi-bh-pill', n => n.map(x => x.className.replace(/.*--/, ''))), ['current', 'todo', 'todo', 'todo', 'todo']);
    equal(await bare(bh, '[data-test=bh-subspecies]'), '\u2726Widowspine', 'the subspecies is named under the picture');
    await bh.click('[data-test=bh-greet-large]');
    assert(await bh.$eval('[data-test=bh-portrait-large]', n => n.classList.contains('tsi-bh-hero2--greet')), 'the picture reacts');
    await bh.waitForTimeout(1200);
    assert(!(await bh.$eval('[data-test=bh-portrait-large]', n => n.classList.contains('tsi-bh-hero2--greet'))), 'and settles');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 1 \u00b7 Acclimatised', 'a tap on the picture does not move the bond');
    equal(await texts(bh, '.tsi-bh-nav__btn'), ['Profile', 'Bond', 'Chronicle'], 'the bottom bar, left to right');
    equal(await bh.$eval('[data-test=bh-tab-bond]', n => n.getAttribute('aria-current')), 'page');
    equal(await bh.$('[data-test=bh-training]'), null, 'no training line');
    equal(await bh.$('[data-test=bh-waiting]'), null, 'no requests line');
    equal(await bh.$('[data-test=bh-tab-orders]'), null, 'no Orders tab');
  });

  await check('Profile shows the Bastion\'s words as read-only lines: nothing to type, no Edit, nothing to roll', async () => {
    await bh.click('[data-test=bh-tab-profile]');
    equal(await bh.$eval('[data-test=bh-root]', n => n.getAttribute('data-screen')), 'creature-profile');
    equal(await bare(bh, '[data-test=bh-p-beast]'), 'Wyvern');
    equal(await bare(bh, '[data-test=bh-p-dominant]'), 'Proud');
    equal(await bare(bh, '[data-test=bh-p-attachment]'), 'Lowers its head');
    equal(await bare(bh, '[data-test=bh-p-trigger]'), 'Loud metallic ringing');
    equal(await bare(bh, '[data-test=bh-p-regional]'), 'Widowspine');
    equal(await bh.$$eval('.tsi-bh input, .tsi-bh textarea, .tsi-bh select', n => n.length), 0, 'no fields to type in');
    equal(await bh.$('[data-test=bh-edit]'), null, 'no Edit button');
    equal(await bh.$('[data-test=bh-roll-all]'), null, 'no Roll');
    assert(!/Edit or roll|Save profile|Send request|waiting/i.test(await bare(bh, '.tsi-bh')), 'no words about editing, saving or sending');
    equal(await bh.$eval('[data-test=bh-tab-profile]', n => n.getAttribute('aria-current')), 'page');
  });

  await check('Chronicle: the Bastion\'s record in order, DM-only notes left out, no way to change it', async () => {
    await bh.click('[data-test=bh-tab-chronicle]');
    const items = await texts(bh, '.tsi-bh-chron__text');
    equal(items, ['Existing relationship credited; Bond 1 per campaign decision.', 'She came back to the tower at dusk.']);
    assert((await bh.content()).indexOf('SECRET-DM-NOTE') === -1, 'the DM-only note is nowhere on the page');
    equal(await bh.$$eval('[data-test=bh-chronicle] button, [data-test=bh-chronicle] input, [data-test=bh-chronicle] textarea, [data-test=bh-chronicle] a', n => n.length), 0);
    equal(await texts(bh, '.tsi-bh-chron__by'), ['Written by DM', 'Written by DM']);
  });

  await check('Viewing as Mira: her two acclimatised beasts open; the one that is not acclimatised is a line that says so, with nothing else; Elara\'s wyvern is now a plain line', async () => {
    await home();
    await view('Mira');
    equal(await bh.$eval('[data-test=bh-beast-cr-stormwing]', n => n.tagName), 'BUTTON');
    equal(await bh.$eval('[data-test=bh-beast-cr-swiftwing]', n => n.tagName), 'BUTTON');
    equal(await bh.$eval('[data-test=bh-beast-elara_wyvern]', n => n.tagName), 'LI');
    equal(await bh.$eval('[data-test=bh-beast-cr-newcomer]', n => n.tagName), 'LI', 'no button: there is nothing to open');
    equal(await bh.$eval('[data-test=bh-beast-cr-newcomer]', n => n.getAttribute('data-mine')), 'yes');
    equal(await bare(bh, '[data-test=bh-row-wait-cr-newcomer]'), 'Not acclimatised yet');
    equal(await bh.$('[data-test=bh-row-bond-cr-newcomer]'), null, 'no bond chip on it');
    assert(/Handler: Mira/.test(await bare(bh, '[data-test=bh-beast-cr-newcomer]')), 'it still names its handler');
    assert((await bh.content()).indexOf('SECRET-NEWCOMER-LINE') === -1, 'nothing of its profile is on the page (or in what the page was given)');
    assert(!(await bh.$('[data-test=bh-message]')), 'no "no beasts" message when you have some');
  });

  await check('there are no orders and nothing to ask for: Mira\'s beasts have Profile, Bond and Chronicle and nothing else, and the app leaves nothing for the Bastion to read', async () => {
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 2 \u00b7 Trusting');
    equal(await bh.$$eval('.tsi-bh-pill', n => n.map(x => x.className.replace(/.*--/, ''))), ['done', 'current', 'todo', 'todo', 'todo']);
    equal(await texts(bh, '.tsi-bh-nav__btn'), ['Profile', 'Bond', 'Chronicle']);
    equal(await bh.$$eval('.tsi-bh button', n => n.map(b => b.getAttribute('data-test')).filter(Boolean)), ['bh-back', 'bh-greet-large', 'bh-tab-profile', 'bh-tab-bond', 'bh-tab-chronicle'], 'every button on the page');
    equal(await bh.evaluate(() => TSI.store.fresh('tsi.beasthandler.queue', null)), null, 'no queue of requests is kept');
    await bh.click('[data-test=bh-back]');
    await bh.click('[data-test=bh-beast-cr-swiftwing]');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 3 \u00b7 Bonded');
    equal(await bare(bh, '[data-test=bh-subspecies]'), '\u2726Embermantle');
  });

  await check('No handler chosen: the directory only, with a friendly note; a handler with no beasts is told why', async () => {
    await home();
    await view('');
    assert(/Choose a handler/.test(await bare(bh, '[data-test=bh-message]')), await bare(bh, '[data-test=bh-message]'));
    equal(await bh.$$eval('.tsi-bh-beast--mine', n => n.length), 0);
    equal(await texts(bh, '.tsi-bh-card__title').then(a => a.length), 2);
  });

  await check('the Bastion itself was not changed by looking or greeting', async () => {
    const s = await bas(ba);
    equal(s.pendingOrders.length, 0, 'no order was made');
    equal(s.creatures.map(c => c.development ? c.development.bond.level : -1), [1, 2, 3, -1, 0], 'every bond is as the DM set it');
    equal(s.creatures[4].development.bond.level, 0);
    equal(s.creatures[0].development.regional, 'Widowspine');
    equal(s.log.filter(l => /Beast Handler/.test(l.title)).length, 0, 'the Day Log has nothing from the app');
  });

  for (const [label, size, opts] of [
    ['a phone (390 × 844)', 'laptop', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }],
    ['the laptop (1707 × 930)', 'laptop', {}],
    ['the TV (1920 × 1080)', 'tv', {}]
  ]) {
    await check('fits ' + label + ': no sideways scroll, every button and field at least 44 px tall, on every screen', async () => {
      const c2 = await H.newContext(browser, size, Object.assign({ backedUp: true }, opts));
      await c2.setOffline(true);
      /* The same browser profile cannot be shared across contexts, so build the Bastion afresh with the same shape. */
      const e2 = await c2.newPage();
      await e2.goto(HARNESS + '?tool=explorer');
      await e2.waitForSelector('[data-test=camp]');
      const b2 = await c2.newPage();
      await b2.goto(HARNESS + '?tool=bastion');
      await b2.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
      await b2.evaluate(() => TSI.bastion.debug.change(s => {
        const R = TSI.bastion.rules;
        s.partyLevel = 9;
        s.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }, { facId: 'griffin_tower', status: 'built' }, { facId: 'dire_wolf_den', status: 'built' }];
        s.facilityLevels.wyvern_roost = 3;
        const c = { id: 'elara_wyvern', species: 'wyvern', owner: 'elara', name: '', status: 'housed', home: 'wyvern_roost', grantedDay: 1, housedDay: 1, msgId: '' };
        c.development = R.newDevelopment(c, s.day);
        c.development.regional = 'Widowspine';
        for (let i = 0; i < 40; i++) c.development.chronicle.push({ id: 'ch-x' + i, day: 2 + i, cat: 'note', text: 'A long entry number ' + i + ' that keeps going to be sure that a long Chronicle wraps and scrolls and never pushes the page sideways.', by: 'DM', link: '' });
        s.creatures = [c];
      }));
      await b2.evaluate(() => TSI.store.flush());
      await b2.waitForTimeout(400);
      const p = await c2.newPage();
      await p.goto(HARNESS + '?tool=beasthandler');
      await p.waitForSelector('[data-test=bh-viewas]');
      await p.selectOption('[data-test=bh-viewas]', 'elara');
      await p.waitForSelector('[data-test=bh-beast-elara_wyvern][data-mine=yes]');
      async function inspect(name) {
        const r = await p.evaluate(() => {
          const small = [];
          document.querySelectorAll('.tsi-bh button, .tsi-bh select, .tsi-bh summary').forEach(n => {
            const b = n.getBoundingClientRect();
            if (b.width && b.height < 43.5) small.push((n.getAttribute('data-test') || n.className) + ' ' + Math.round(b.height));
          });
          /* The companion's own content must stay inside the page's width. (The suite's shared top bar is wider than a phone; the phone page of BH-3 has its own slim bar.) */
          const box = document.querySelector('.tsi-bh');
          const edge = document.documentElement.clientWidth;
          const out = [];
          box.querySelectorAll('*').forEach(n => { const b = n.getBoundingClientRect(); if (b.width && b.right > edge + 0.5) out.push((n.getAttribute('data-test') || n.className) + ' ' + Math.round(b.right)); });
          return { sw: box.scrollWidth, cw: box.clientWidth, out, small };
        });
        assert(r.sw <= r.cw, name + ' scrolls sideways: ' + r.sw + ' > ' + r.cw);
        equal(r.out, [], name + ' has something past the edge');
        equal(r.small, [], name + ' has small targets');
        await H.shot(p, 'beasthandler-' + size + '-' + (opts.viewport ? 'phone-' : '') + name);
      }
      /* The test page's top bar is wider than a phone, which makes the emulated phone zoom out, so the buttons are pressed directly rather than aimed at with the mouse. */
      const tap = sel => p.$eval(sel, n => { n.scrollIntoView({ block: 'center' }); n.click(); });
      await inspect('home');
      await tap('[data-test=bh-beast-elara_wyvern]'); await inspect('bond');
      await tap('[data-test=bh-tab-profile]'); await inspect('profile');
      await tap('[data-test=bh-tab-chronicle]'); await inspect('chronicle');
      await tap('[data-test=bh-tab-bond]'); await inspect('bond-again');
      await c2.close();
    });
  }

  await check('reduced motion stops the greeting and the screen fade', async () => {
    await bh.emulateMedia({ reducedMotion: 'reduce' });
    await home();
    await view('elara');
    await bh.click('[data-test=bh-beast-elara_wyvern]');
    await bh.click('[data-test=bh-greet-large]');
    const img = await bh.$eval('[data-test=bh-portrait-large] .tsi-bh-hero2__img', n => getComputedStyle(n).animationName);
    equal(img, 'none', 'the picture does not move');
    const fade = await bh.$eval('.tsi-bh', n => getComputedStyle(n).animationName);
    equal(fade, 'none', 'screens do not fade');
    await bh.emulateMedia({ reducedMotion: 'no-preference' });
    await bh.click('[data-test=bh-tab-profile]');
    const fade2 = await bh.$eval('.tsi-bh', n => getComputedStyle(n).animationName);
    assert(/fade-in/.test(fade2), 'with motion allowed, a new screen fades in: ' + fade2);
  });

  await check('a Bastion that has never been saved gets a plain message', async () => {
    const c3 = await H.newContext(browser, 'laptop', { backedUp: true });
    await c3.setOffline(true);
    const p = await c3.newPage();
    await p.goto(HARNESS + '?tool=beasthandler');
    await p.waitForSelector('[data-test=bh-message]');
    assert(/hasn't been saved yet/.test(await bare(p, '[data-test=bh-message]')), await bare(p, '[data-test=bh-message]'));
    await c3.close();
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
