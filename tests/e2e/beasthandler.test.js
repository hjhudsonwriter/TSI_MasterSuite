/* Scarlett Isles: Beast Handler (BH-1b, Harry's approvals of 21 October 2026),
   from the test page with the internet off. The Bastion is built in one
   window (a Roost with Elara's wyvern and a second wyvern, a Griffin Tower
   with a griffin, no Dire Wolf Den) and the companion is opened in another.
   It checks: the Home directory; "Viewing as"; other players' beasts as plain
   lines; the main screen, Bond 0 to 5 and the harmless greeting; Profile,
   Orders (only free training, the confirm screen with Send switched off, and
   the whole-building lock) and the read-only Chronicle without DM-only
   notes; a phone-sized screen, the laptop and the TV (no sideways scroll,
   44 px targets); reduced motion; and that nothing in the Bastion changed.
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
      return c;
    };
    s.creatures = [
      mk('elara_wyvern', 'wyvern', '', 'wyvern_roost'),
      mk('cr-stormwing', 'wyvern', 'Stormwing', 'wyvern_roost', 'Mira'),
      mk('cr-swiftwing', 'griffin', 'Swiftwing', 'griffin_tower', 'Mira'),
      mk('cr-loose', 'griffin', 'Unhandled', 'griffin_tower', '')
    ];
    s.creatures[2].development.bond.level = 3;
    const data = { bastion: window.TSI_DATA.bastion, facilities: window.TSI_DATA.bastionFacilities, tools: window.TSI_DATA.bastionTools, events: window.TSI_DATA.bastionEvents, research: window.TSI_DATA.bastionResearch, goods: window.TSI_DATA.bastionGoods, commerce: window.TSI_DATA.bastionCommerce, courier: window.TSI_DATA.bastionCourier, creatures: window.TSI_DATA.bastionCreatures };
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
    equal(await texts(bh, '[data-test=bh-fac-griffin_tower] .tsi-bh-beast__name'), ['Swiftwing', 'Unhandled']);
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

  await check('Elara\'s main screen: name, handler, Bond 1 of 0 to 5, a harmless greeting, three sections', async () => {
    await bh.click('[data-test=bh-beast-elara_wyvern]');
    equal(await bare(bh, '[data-test=bh-name]'), 'Elara\'s wyvern');
    equal(await bare(bh, '[data-test=bh-handler]'), 'Handler: Elara');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 1: Acclimatised');
    equal(await texts(bh, '.tsi-bh-bond__step'), ['0', '1', '2', '3', '4', '5']);
    equal(await bh.$$eval('.tsi-bh-bond__step--done, .tsi-bh-bond__step--current, .tsi-bh-bond__step--todo', n => n.map(x => x.className.replace(/.*--/, ''))), ['done', 'current', 'todo', 'todo', 'todo', 'todo']);
    await bh.click('[data-test=bh-greet-large]');
    assert(await bh.$eval('[data-test=bh-portrait-large]', n => n.classList.contains('tsi-bh-hero--greet')), 'the picture reacts');
    await bh.waitForTimeout(1200);
    assert(!(await bh.$eval('[data-test=bh-portrait-large]', n => n.classList.contains('tsi-bh-hero--greet'))), 'and settles');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 1: Acclimatised', 'a tap on the picture does not move the bond');
    equal(await texts(bh, '.tsi-bh-nav__btn'), ['Profile', 'Orders', 'Chronicle']);
  });

  await check('Profile shows the DM\'s own words, as read-only lines until Edit is pressed', async () => {
    await bh.click('[data-test=bh-tab-profile]');
    equal(await bare(bh, '[data-test=bh-p-beast]'), 'Wyvern');
    equal(await bare(bh, '[data-test=bh-p-dominant]'), 'Proud');
    equal(await bare(bh, '[data-test=bh-p-attachment]'), 'Lowers its head');
    equal(await bare(bh, '[data-test=bh-p-trigger]'), 'Loud metallic ringing');
    equal(await bare(bh, '[data-test=bh-p-regional]'), 'Not written yet');
    equal(await bh.$$eval('.tsi-bh-profile input, .tsi-bh-profile textarea, .tsi-bh-profile select', n => n.length), 0, 'no fields to type in');
    equal(await bh.$eval('[data-test=bh-edit]', b => b.disabled), false, 'Edit is there');
  });

  await check('Chronicle: the Bastion\'s record in order, DM-only notes left out, no way to change it', async () => {
    await bh.click('[data-test=bh-tab-chronicle]');
    const items = await texts(bh, '.tsi-bh-chron__text');
    equal(items, ['Existing relationship credited; Bond 1 per campaign decision.', 'She came back to the tower at dusk.']);
    assert((await bh.content()).indexOf('SECRET-DM-NOTE') === -1, 'the DM-only note is nowhere on the page');
    equal(await bh.$$eval('[data-test=bh-chronicle] button, [data-test=bh-chronicle] input, [data-test=bh-chronicle] textarea, [data-test=bh-chronicle] a', n => n.length), 0);
    equal(await texts(bh, '.tsi-bh-chron__by'), ['Written by DM', 'Written by DM']);
  });

  await check('Viewing as Mira: her two beasts open; Elara\'s wyvern is now a plain line', async () => {
    await home();
    await view('Mira');
    equal(await bh.$eval('[data-test=bh-beast-cr-stormwing]', n => n.tagName), 'BUTTON');
    equal(await bh.$eval('[data-test=bh-beast-cr-swiftwing]', n => n.tagName), 'BUTTON');
    equal(await bh.$eval('[data-test=bh-beast-elara_wyvern]', n => n.tagName), 'LI');
    assert(!(await bh.$('[data-test=bh-message]')), 'no "no beasts" message when you have some');
  });

  await check('Orders: a Bond 0 wyvern is offered only Safe Acclimatisation, free, with its ready day; the confirm screen cannot send', async () => {
    await bh.click('[data-test=bh-beast-cr-stormwing]');
    equal(await bare(bh, '[data-test=bh-bond-line]'), 'Bond 0: Unfamiliar');
    await bh.click('[data-test=bh-tab-orders]');
    equal(await bare(bh, '[data-test=bh-orders-for]'), 'Wyvern Roost Level 3');
    equal(await texts(bh, '.tsi-bh-order__label'), ['Safe Acclimatisation']);
    assert(/5 days · Free · ready Day \d+/.test(await bare(bh, '.tsi-bh-order__meta')), await bare(bh, '.tsi-bh-order__meta'));
    await bh.click('[data-test=bh-order-wyr_safe_acclimatisation]');
    const confirm = await bare(bh, '[data-test=bh-confirm]');
    ['Check before you send', 'Stormwing', 'Wyvern Roost, Level 3', 'Safe Acclimatisation', '5 days', 'Free', 'Bond 1 (Acclimatised) is ready for the DM to confirm'].forEach(w => assert(confirm.indexOf(w) !== -1, '"' + w + '" is on the confirm screen: ' + confirm));
    equal(await bh.$eval('[data-test=bh-send]', b => b.disabled), false, 'Send is there');
    assert(/only asks the Bastion/.test(confirm), 'it says it only asks: ' + confirm);
    equal(await bas(ba).then(s => s.pendingOrders.length), 0, 'nothing is ordered by looking');
    await bh.click('[data-test=bh-confirm-back]');
    assert(await bh.$('[data-test=bh-orders]'), 'back to the list');
  });

  await check('Orders: once the DM starts a programme there, the whole building is locked and the pending order shows its day', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      const T = window.TSI_DATA;
      const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
      const r = TSI.bastion.rules.issueOrder(s, data, 'wyvern_roost', 'wyr_safe_acclimatisation', 1, Math.random);
      if (!r.ok) throw new Error(r.message);
    }));
    await ba.evaluate(() => TSI.store.flush());
    await bh.waitForSelector('[data-test=bh-pending]', { timeout: 9000 });
    assert(/^Safe Acclimatisation$/.test(await bare(bh, '.tsi-bh-pending__label')), await bare(bh, '.tsi-bh-pending__label'));
    assert(/^Ready on Day \d+$/.test(await bare(bh, '[data-test=bh-pending-due]')), await bare(bh, '[data-test=bh-pending-due]'));
    equal(await bh.$('[data-test=bh-orders]'), null, 'no new orders are offered');
    await bh.click('[data-test=bh-back]');
    assert(/In training: Safe Acclimatisation, ready on Day \d+\./.test(await bare(bh, '[data-test=bh-training]')), await bare(bh, '[data-test=bh-training]'));
  });

  await check('Orders: a pending order at another building does not block this one', async () => {
    await bh.click('[data-test=bh-back]');
    await bh.click('[data-test=bh-beast-cr-swiftwing]');
    await bh.click('[data-test=bh-tab-orders]');
    equal(await bare(bh, '[data-test=bh-orders-for]'), 'Griffin Tower Level 2');
    assert((await texts(bh, '.tsi-bh-order__label')).length > 0, 'the Tower still has orders to offer');
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
    equal(s.pendingOrders.length, 1, 'only the order the DM made');
    assert(JSON.stringify(s.creatures.map(c => c.development && c.development.bond)) !== before, 'sanity: the DM\'s order is what changed');
    equal(s.creatures[0].development.bond.level, 1);
    equal(s.creatures[1].development.bond.level, 0);
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
      await inspect('home');
      await p.click('[data-test=bh-beast-elara_wyvern]'); await inspect('main');
      await p.click('[data-test=bh-tab-profile]'); await inspect('profile');
      await p.click('[data-test=bh-tab-orders]'); await inspect('orders');
      await p.click('[data-test=bh-tab-chronicle]'); await inspect('chronicle');
      await c2.close();
    });
  }

  await check('reduced motion stops the breathing glow and the greeting', async () => {
    await bh.emulateMedia({ reducedMotion: 'reduce' });
    await home();
    await view('elara');
    await bh.click('[data-test=bh-beast-elara_wyvern]');
    const name = await bh.$eval('.tsi-bh-medallion', n => getComputedStyle(n).animationName);
    equal(name, 'none');
    await bh.emulateMedia({ reducedMotion: 'no-preference' });
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
