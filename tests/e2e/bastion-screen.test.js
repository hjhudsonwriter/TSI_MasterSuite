/* The Ironbow Bastion Manager's new screen (the overhaul's Build 2, Harry,
   8 October 2026), from a double-clicked index.html with the internet off:
   the map filling the window on the laptop and the TV, the top bar (the
   day, the treasury, the counts), the facility grid and its tiles, the
   build panel, each facility's panel, the panels the bottom bar opens, the
   Banner & War Council lock, the Party Identity badge, the shared tooltip,
   and the keyboard. The Bastion's rules, played through these panels, are
   checked in tests/e2e/phase9.test.js.
   Run with:  node tests/e2e/bastion-screen.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const BASTION = H.fileUrl('index.html') + '?tool=bastion';
const POP = '.tsi-modal:not(.tsi-bas-panel)';
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const setUp = (page, fn) => page.evaluate(src => TSI.bastion.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const text = (page, test) => page.textContent('[data-test="' + test + '"]');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const pause = page => page.waitForTimeout(400);
const panelOpen = page => page.evaluate(() => TSI.bastion.debug.panel());
const rect = (page, sel) => page.$eval(sel, n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; });
const tipShown = page => page.$eval('[data-test=tooltip]', t => !t.hidden).catch(() => false);
async function setExplorerDay(page, day) {
  await page.evaluate(d => {
    const ex = TSI.store.get('tsi.explorer.save', null) || { tokens: [], travel: {}, grid: {} };
    ex.travel = Object.assign({}, ex.travel, { day: d });
    TSI.store.set('tsi.explorer.save', ex);
    TSI.bastion.debug.clock();
  }, day);
}
/* Pass days, closing "The Ironbow sends word…" as it comes. */
async function days(page, n) {
  const at = (await st(page)).day;
  await setExplorerDay(page, at + n);
  for (let k = 0; k < 300; k++) {
    await page.waitForTimeout(100);
    if (await page.$('[data-test=ironbow-word]')) { await page.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary'); continue; }
    const done = await page.evaluate(t => { const s = TSI.bastion.debug.state(); return s.day >= t && !s.dayInProgress && !TSI.bastion.debug.busy(); }, at + n);
    if (done && !(await page.$(POP))) return;
  }
  throw new Error('the days didn\'t pass');
}
async function open(page) {
  await page.goto(BASTION);
  await page.waitForSelector('[data-test=day-status]');
  await setExplorerDay(page, 1);
  await page.waitForFunction(() => TSI.bastion.debug.state().anchored);
  await page.waitForTimeout(300);
}
function overlaps(a, b) { return a.x < b.right - 1 && b.x < a.right - 1 && a.y < b.bottom - 1 && b.y < a.bottom - 1; }

(async () => {
  const browser = await H.chromium.launch();
  const context = await H.newContext(browser, 'laptop', { acceptDownloads: true });
  await context.setOffline(true);
  const page = await context.newPage();

  /* ------------------------------------------------------------------ */
  section('The map fills the window, on the laptop and the TV');
  await open(page);

  const MAIN = ['[data-test=level]', '[data-test=compendium]', '[data-test=reset]', '[data-test=download-save]', '[data-test=import-save]',
    '[data-test=day-status]', '[data-test=treasury]', '[data-test=facilities-count]', '[data-test=orders-count]', '[data-test=identity-badge]',
    '[data-test=map]', '[data-test=grid-toggle]', '.tsi-bas-tile', '[data-test^=open-]'];
  for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
    await check(size + ': no scrolling either way, every tile and button in view, the painting fitted at 3 : 2', async () => {
      await page.setViewportSize(H.SIZES[size].viewport);
      await page.waitForTimeout(300);
      const lc = await H.layoutCheck(page, MAIN);
      equal(lc.scrollWidth, lc.clientWidth, 'no sideways scroll');
      equal(lc.outOfView, [], 'in view');
      equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, 'the page doesn\'t scroll down');
      equal(await page.$$eval('.tsi-bas-tile', ts => ts.length), 11, 'five facilities and six slots');
      const map = await rect(page, '.tsi-bas-map');
      assert(Math.abs(map.w / map.h - 1.5) < 0.01, 'fitted, not stretched: ' + JSON.stringify(map));
      const over = await rect(page, '.tsi-bas-map__overlays');
      equal([Math.round(over.x), Math.round(over.y), Math.round(over.w), Math.round(over.h)], [Math.round(map.x), Math.round(map.y), Math.round(map.w), Math.round(map.h)], 'the building overlays sit exactly on the painting');
      const want = { laptop: 900, laptopFull: 1100, tv: 1150, smallWindow: 600 }[size];
      assert(map.w >= want, size + ': the painting is ' + Math.round(map.w) + ' wide');
      await H.shot(page, 'bs-01-' + size);
    });
  }
  await check('a notice sits above the bottom bar, never over its buttons, on the laptop and the TV', async () => {
    for (const size of ['laptop', 'tv']) {
      await page.setViewportSize(H.SIZES[size].viewport);
      await page.waitForTimeout(200);
      await page.evaluate(() => TSI.notify('A long notice, to see where it sits: it has two lines of words in it, at least, on both screens.', { type: 'info', title: 'Test.', id: 'tsi-bs-test' }));
      const hits = await page.evaluate(() => ['open-influence', 'open-favour', 'open-war', 'open-warehouse'].map(t => {
        const b = document.querySelector('[data-test=' + t + ']').getBoundingClientRect();
        const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return t + ':' + !!(hit && hit.closest('[data-test=' + t + ']'));
      }));
      equal(hits, ['open-influence:true', 'open-favour:true', 'open-war:true', 'open-warehouse:true'], size);
      const n = await rect(page, '.tsi-notices');
      const bar = await rect(page, '.tsi-bas-bottom');
      assert(n.bottom <= bar.y, size + ': the notices end above the bar: ' + JSON.stringify([n, bar]));
      await page.evaluate(() => document.querySelectorAll('.tsi-notice').forEach(x => x.remove()));
    }
    await page.setViewportSize(H.SIZES.laptop.viewport);
  });

  await check('moved from the laptop to the TV and back, the painting refits at once', async () => {
    await page.setViewportSize(H.SIZES.laptop.viewport);
    await page.waitForTimeout(200);
    const small = await rect(page, '.tsi-bas-map');
    await page.setViewportSize(H.SIZES.tv.viewport);
    await page.waitForTimeout(200);
    const big = await rect(page, '.tsi-bas-map');
    assert(big.w > small.w + 150, JSON.stringify([small, big]));
    await page.setViewportSize(H.SIZES.laptop.viewport);
    await page.waitForTimeout(200);
    equal(Math.round((await rect(page, '.tsi-bas-map')).w), Math.round(small.w));
  });

  /* ------------------------------------------------------------------ */
  section('The top bar: the day, the treasury and the counts');

  await check('the day, from the Explorer; Finish Day only for a day left part-way', async () => {
    equal(await text(page, 'day-status'), 'Day 1');
    equal(await page.isHidden('[data-test=advance]'), true);
  });

  await check('the treasury saves when you finish typing (Enter, or leaving the box), not on every key', async () => {
    await page.click('[data-test=treasury]');
    await page.fill('[data-test=treasury]', '1250');
    await page.waitForTimeout(200);
    equal((await st(page)).treasuryGP, 0, 'not yet, while typing');
    await page.press('[data-test=treasury]', 'Enter');
    await page.waitForTimeout(150);
    equal((await st(page)).treasuryGP, 1250);
    await page.fill('[data-test=treasury]', '-40');
    await page.click('[data-test=day-status]');
    await page.waitForTimeout(150);
    equal((await st(page)).treasuryGP, 0, 'leaving the box saves it, never below 0');
    equal(await page.inputValue('[data-test=treasury]'), '0');
    await page.fill('[data-test=treasury]', '1250');
    await page.press('[data-test=treasury]', 'Enter');
  });

  await check('Facilities and Orders count, and hovering lists them', async () => {
    equal(await text(page, 'facilities-n'), '5');
    equal(await text(page, 'orders-n'), '0');
    await page.hover('[data-test=facilities-count]');
    await page.waitForSelector('[data-test=tooltip]:not([hidden])');
    const tip = await bare(page, '[data-test=tooltip]');
    assert(/^Facilities/.test(tip) && /Barracks/.test(tip) && /Workshop/.test(tip), tip);
    assert(!overlaps(await rect(page, '[data-test=tooltip]'), await rect(page, '[data-test=facilities-count]')), 'the tooltip doesn\'t cover what it describes');
    await page.mouse.move(5, 500);
    equal(await tipShown(page), false);
  });

  /* ------------------------------------------------------------------ */
  section('The facility grid');

  await check('the five starting facilities first (Workshop, Barracks, Watchtower, Dock, Armoury), then the six slots', async () => {
    equal(await page.$$eval('.tsi-bas-tile', ts => ts.slice(0, 5).map(t => t.dataset.fac)), ['workshop', 'barracks', 'watchtower', 'dock', 'armoury']);
    equal(await page.$$eval('.tsi-bas-tile', ts => ts.slice(5).map(t => t.dataset.test)), ['slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5']);
  });

  await check('at level 7: two slots open to build, four locked until levels 9, 9, 13 and 17', async () => {
    equal(await page.$$eval('.tsi-bas-tile--slot', ts => ts.map(t => t.dataset.test)), ['slot-0', 'slot-1']);
    const locked = [];
    for (const i of [2, 3, 4, 5]) {
      await page.hover('[data-test=slot-' + i + ']');
      await page.waitForSelector('[data-test=tooltip]:not([hidden])');
      locked.push((/Unlocks at party level (\d+)/.exec(await bare(page, '[data-test=tooltip]')) || [])[1]);
    }
    equal(locked, ['9', '9', '13', '17']);
    await page.hover('[data-test=slot-0]');
    assert(/Click to build a new facility/.test(await bare(page, '[data-test=tooltip]')));
  });

  await check('a starting facility\'s tile: its name, level and orders on hover, never covering the tile', async () => {
    await page.hover('[data-test=tile-barracks]');
    await page.waitForFunction(() => /Barracks/.test(document.querySelector('[data-test=tooltip]').textContent));
    const tip = await bare(page, '[data-test=tooltip]');
    assert(/^Barracks/.test(tip) && /Level 1/.test(tip) && /No orders pending here/.test(tip), tip);
    assert(!overlaps(await rect(page, '[data-test=tooltip]'), await rect(page, '[data-test=tile-barracks]')), 'beside the tile, not over it');
    await page.mouse.move(5, 500);
  });

  await check('levels 4 and 17: no slot open below 5; all six at 17', async () => {
    await page.selectOption('[data-test=level]', '4');
    await page.waitForTimeout(150);
    equal(await page.$$eval('.tsi-bas-tile--slot', ts => ts.length), 0);
    await page.hover('[data-test=slot-0]');
    assert(/Unlocks at party level 5/.test(await bare(page, '[data-test=tooltip]')));
    await page.selectOption('[data-test=level]', '17');
    await page.waitForTimeout(150);
    equal(await page.$$eval('.tsi-bas-tile--slot', ts => ts.length), 6);
    await page.selectOption('[data-test=level]', '7');
    await page.waitForTimeout(150);
    await page.mouse.move(5, 500);
  });

  await check('▼ folds the grid away (the painting grows), ▲ brings it back, and it\'s remembered', async () => {
    const before = await rect(page, '.tsi-bas-map');
    await page.click('[data-test=grid-toggle]');
    await page.waitForTimeout(200);
    equal(await page.isHidden('[data-test=grid]'), true);
    const after = await rect(page, '.tsi-bas-map');
    assert(after.h > before.h + 40, JSON.stringify([before, after]));
    equal((await H.layoutCheck(page, ['[data-test^=open-]', '[data-test=grid-toggle]'])).outOfView, [], 'the buttons stay in view');
    await page.evaluate(() => TSI.store.flush());
    await page.reload();
    await page.waitForSelector('[data-test=day-status]');
    equal(await page.isHidden('[data-test=grid]'), true, 'still folded after reopening');
    await page.click('[data-test=grid-toggle]');
    await page.waitForTimeout(150);
    equal(await page.isVisible('[data-test=grid]'), true);
  });

  /* ------------------------------------------------------------------ */
  section('Building, from an empty slot');

  await check('an open slot opens Construction: every facility not yet built, with the ones the level allows', async () => {
    await pause(page);
    await page.click('[data-test=slot-0]');
    await page.waitForSelector('[data-test=panel-build]');
    equal(await panelOpen(page), 'build');
    assert(/Party level 7: 2 construction slots, 0 in use/.test(await text(page, 'build-panel')));
    equal(await page.getAttribute('[data-test=build-war_room]', 'aria-disabled'), 'true', 'the War Room needs level 17');
    assert(/Locked: level 17/.test(await text(page, 'build-war_room')));
    equal(await page.getAttribute('[data-test=build-smithy]', 'aria-disabled'), null);
    await page.hover('[data-test=build-smithy]');
    await page.waitForFunction(() => /Smithy/.test(document.querySelector('[data-test=tooltip]').textContent));
    assert(/Takes 21 days to build/.test(await bare(page, '[data-test=tooltip]')));
    await H.shot(page, 'bs-02-build');
  });

  await check('a locked facility can\'t be chosen', async () => {
    await page.click('[data-test=build-war_room]', { force: true });
    await page.waitForTimeout(250);
    equal(await page.$(POP), null, 'no question');
    equal((await st(page)).builtExtras.filter(Boolean), []);
  });

  await check('Construct asks first ("Construct the Smithy? It takes 21 days."); Cancel builds nothing', async () => {
    await page.click('[data-test=build-smithy]');
    await page.waitForSelector(POP);
    equal(await bare(page, POP + ' .tsi-modal__body'), 'Construct the Smithy? It takes 21 days.');
    await page.click(POP + ' .tsi-modal__foot button:text-is("Cancel")');
    await page.waitForTimeout(200);
    equal((await st(page)).builtExtras.filter(Boolean), []);
    equal(await panelOpen(page), 'build', 'the panel is still open');
  });

  await check('Construct: the panel closes, and the slot shows the Smithy with an hourglass and 21 days', async () => {
    await pause(page);
    await page.click('[data-test=build-smithy]');
    await page.waitForSelector(POP);
    await page.click(POP + ' .tsi-modal__foot button:text-is("Construct")');
    await page.waitForFunction(() => !TSI.bastion.debug.panel());
    equal((await st(page)).builtExtras[0], { facId: 'smithy', status: 'building', startDay: 1, readyDay: 22 });
    equal(await page.$$eval('[data-test=tile-smithy]', ts => ts.map(t => [t.tagName, t.className.includes('building'), t.textContent])), [['DIV', true, '21']]);
    await page.hover('[data-test=tile-smithy]');
    await page.waitForFunction(() => /Smithy/.test(document.querySelector('[data-test=tooltip]').textContent));
    assert(/Under construction: 21 days left/.test(await bare(page, '[data-test=tooltip]')) && /Ready on Day 22/.test(await bare(page, '[data-test=tooltip]')));
    await page.hover('[data-test=facilities-count]');
    await page.waitForFunction(() => /Smithy: building, 21 days left/.test(document.querySelector('[data-test=tooltip]').textContent));
    await page.mouse.move(5, 500);
  });

  await check('a building can\'t be clicked; 21 days later it\'s built, and its tile opens the Smithy', async () => {
    await page.click('[data-test=tile-smithy]');
    await page.waitForTimeout(200);
    equal(await panelOpen(page), null);
    await days(page, 21);
    equal(await page.$eval('[data-test=tile-smithy]', t => t.tagName), 'BUTTON');
    equal(await text(page, 'facilities-n'), '6');
    await page.click('[data-test=tile-smithy]');
    await page.waitForSelector('[data-test=panel-fac-smithy]');
    equal(await bare(page, '[data-test=panel-fac-smithy] .tsi-modal__title'), 'Smithy');
    await page.keyboard.press('Escape');
  });

  /* ------------------------------------------------------------------ */
  section('A facility\'s panel');

  await check('the Barracks: its painting, level, orders pending here, and its orders with their days', async () => {
    await pause(page);
    await page.click('[data-test=tile-barracks]');
    await page.waitForSelector('[data-test=panel-fac-barracks]');
    assert(/Level 1/.test(await text(page, 'fac-panel')));
    equal(await text(page, 'days-barracks__recruit_defenders'), 'Takes 5 days');
    await page.click('[data-test="issue-barracks__recruit_defenders"]');
    await page.waitForTimeout(200);
    const due = (await st(page)).day + 5;
    const here = await bare(page, '.tsi-bas-facpanel__orders');
    assert(/Recruit Defenders/.test(here) && here.indexOf('Due Day ' + due + ' (in 5 days)') !== -1, here);
    equal(await page.$$eval('.tsi-bas-facpanel__orders [data-test^=cancel-]', bs => bs.length), 1, 'with Cancel');
    await H.shot(page, 'bs-03-barracks');
  });

  await check('Escape closes it and puts the focus back on its tile; the tile counts its order, and so does the top bar', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    equal(await panelOpen(page), null);
    equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.test), 'tile-barracks');
    equal(await text(page, 'tile-orders-barracks'), '1');
    equal(await text(page, 'orders-n'), '1');
    await page.click('[data-test=orders-count]');
    await page.waitForSelector('[data-test=panel-orders]');
    assert(/Recruit Defenders/.test(await text(page, 'pending')));
    await page.keyboard.press('Escape');
  });

  await check('the Workshop\'s panel holds the Artisan Tools its Craft list uses', async () => {
    await pause(page);
    await page.click('[data-test=tile-workshop]');
    await page.waitForSelector('[data-test=panel-fac-workshop] [data-test=artisan-0]');
    await page.selectOption('[data-test=artisan-0]', { index: 1 });
    await page.waitForTimeout(150);
    assert((await st(page)).artisanTools[0], 'saved');
    equal(await page.$$eval('[data-test="sel-workshop__craft"] option', os => os.length > 1), true, 'Craft lists what the tools make');
    await page.keyboard.press('Escape');
  });

  await check('the keyboard: Tab reaches a tile, its tooltip shows, and Enter opens it', async () => {
    await page.focus('[data-test=tile-watchtower]');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => /Watchtower/.test(document.querySelector('[data-test=tooltip]').textContent) && !document.querySelector('[data-test=tooltip]').hidden);
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-test=panel-fac-watchtower]');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  });

  /* ------------------------------------------------------------------ */
  section('The panels the bottom bar opens');

  const PANELS = [['open-warehouse', 'warehouse', 'Warehouse', 'warehouse'], ['open-management', 'management', 'Management', 'defenders'],
    ['open-log', 'log', 'Day Log', 'log'], ['open-events', 'events', 'Bastion Events', 'roll-event'],
    ['open-influence', 'influence', 'Clan Influence', 'influence'], ['open-favour', 'favour', 'Favour of the Gods', 'favour-telluria']];
  for (const [button, id, title, inside] of PANELS) {
    await check(title + ': its button opens it over the map, and it fits', async () => {
      await pause(page);
      await page.click('[data-test=' + button + ']');
      await page.waitForSelector('[data-test=panel-' + id + '] [data-test=' + inside + ']');
      equal(await bare(page, '[data-test=panel-' + id + '] .tsi-modal__title'), title);
      equal((await H.layoutCheck(page, ['[data-test=panel-' + id + ']', '[data-test=panel-' + id + '] .tsi-modal__foot button'])).outOfView, []);
      await H.shot(page, 'bs-04-' + id);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      equal(await panelOpen(page), null);
    });
  }

  await check('one panel at a time: the Day Log keeps the day of each entry', async () => {
    await page.click('[data-test=open-log]');
    await page.waitForSelector('[data-test=panel-log]');
    assert(/Day 22 ·/.test(await text(page, 'log')), 'the Smithy finished on Day 22');
    equal(await page.$$eval('.tsi-bas-panel', ps => ps.length), 1);
    await page.keyboard.press('Escape');
  });

  await check('Clan Influence: each Clan\'s Political Capital, Honour/Respect and support on one row; Favour Tokens below', async () => {
    await setUp(page, (s) => { s.politicalCapital.karr = 40; s.honourRespectByClan.karr = 2; s.diplomacy.tokens = 3; });
    await page.click('[data-test=open-influence]');
    await page.waitForSelector('[data-test=panel-influence]');
    const support = await page.evaluate(() => TSI.bastion.rules.supportForClanKey(TSI.bastion.debug.state(), 'karr'));
    equal([await text(page, 'pc-karr'), await page.inputValue('[data-test=hr-karr]'), await text(page, 'support-karr'), await text(page, 'tokens')], ['40', '2', support + '/100', '3']);
    await page.fill('[data-test=hr-karr]', '9');
    await page.press('[data-test=hr-karr]', 'Tab');
    await page.waitForTimeout(150);
    equal((await st(page)).honourRespectByClan.karr, 5, 'kept within −5 to +5');
    await page.keyboard.press('Escape');
  });

  /* ------------------------------------------------------------------ */
  section('The Banner & War Council lock, and the crest badge');

  await check('locked while the Bastion has nothing that can fight: the padlock\'s tooltip says how to raise a banner', async () => {
    await setUp(page, (s) => { s.defenders.count = 0; s.defenderBeasts = []; s.military = []; s.pendingOrders = []; });
    equal(await page.$eval('[data-test=open-war]', b => b.classList.contains('is-locked')), true);
    await page.click('[data-test=open-war]');
    await page.waitForTimeout(200);
    equal(await panelOpen(page), null);
    assert(/Recruit defenders at the Barracks to raise your banner/.test(await bare(page, '[data-test=tooltip]')));
    await page.mouse.move(5, 500);
  });

  await check('one defender unlocks it', async () => {
    await page.click('[data-test=open-management]');
    await page.click('[data-test=add-defender]');
    await page.keyboard.press('Escape');
    equal(await page.$eval('[data-test=open-war]', b => b.classList.contains('is-locked')), false);
    await pause(page);
    await page.click('[data-test=open-war]');
    await page.waitForSelector('[data-test=panel-war] [data-test=queue-war]');
    await page.keyboard.press('Escape');
  });

  await check('Party Identity, Form Clan\'s pop-up and the question about a crest sent from the Creator fit the laptop, full screen, the TV and a small window (Build 3)', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const keep = await page.evaluate(() => { const s = TSI.bastion.debug.state(); return { level: s.partyLevel, pc: Object.assign({}, s.politicalCapital) }; });
    await setUp(page, (s) => { s.partyLevel = 9; s.politicalCapital.blackstone = 10; s.politicalCapital.bacca = 10; s.politicalCapital.farmer = 10; s.politicalCapital.slade = -10; });
    for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
      await page.setViewportSize(H.SIZES[size].viewport);
      await page.waitForTimeout(250);
      await pause(page);
      await page.click('[data-test=identity-badge]');
      await page.waitForSelector('[data-test=panel-identity] [data-test=crest-create]');
      equal((await H.layoutCheck(page, ['[data-test=panel-identity]', '[data-test=crest-create]', '[data-test=crest-add]', '[data-test=form-clan]', '[data-test=panel-identity] .tsi-modal__foot button'])).outOfView, [], size + ': Party Identity');
      await page.click('[data-test=form-clan]');
      await page.waitForSelector('[data-test=crest-field]');
      equal((await H.layoutCheck(page, ['[data-test=clan-name]', '[data-test=crest-field]', '[data-test=crest-new]', '[data-test=crest-upload]', POP + ' .tsi-modal__foot button'])).outOfView, [], size + ': Form Clan');
      if (size === 'laptop') await H.shot(page, 'bs-06-form-clan');
      await page.click(POP + ' .tsi-modal__foot button:text-is("Cancel")');
      await page.waitForTimeout(200);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.evaluate(p => TSI.handoff.write('crest', { id: 'crest-fit', at: 1, name: 'Fit', dataUrl: p, design: { clanName: 'Fit' } }), png);
      await page.waitForSelector('[data-test=crest-offer]', { timeout: 6000 });
      equal((await H.layoutCheck(page, ['[data-test=crest-offer]', POP + ' .tsi-modal__foot button'])).outOfView, [], size + ': the crest question');
      await page.click(POP + ' .tsi-modal__foot button:text-is("No")');
      await page.waitForTimeout(200);
    }
    await page.setViewportSize(H.SIZES.laptop.viewport);
    await page.evaluate(k => TSI.bastion.debug.change(s => { s.partyLevel = k.level; s.politicalCapital = k.pc; }), keep);
    equal(await page.evaluate(() => TSI.store.has('tsi.bastion.crest')), false, 'No each time: no crest');
    equal((await st(page)).organization.type, 'unsworn');
  });

  await check('the badge says "Add a crest" until there is one, and opens Party Identity; with a crest (even Unsworn) it shows it, then the Clan\'s name (Build 3)', async () => {
    equal(await bare(page, '[data-test=identity-badge]'), 'Add a crest');
    equal(await page.getAttribute('[data-test=identity-badge]', 'aria-label'), 'Crest of the Ironbow: no crest yet. Open Party Identity.');
    await page.focus('[data-test=identity-badge]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-test=panel-identity] [data-test=form-clan]');
    await page.waitForSelector('[data-test=panel-identity] [data-test=crest-create]');
    equal(await page.evaluate(() => !!document.activeElement.closest('[data-test=panel-identity]')), true, 'from the keyboard, the focus goes into the panel (Clan Honour is hidden until there\'s a Clan)');
    await page.keyboard.press('Escape');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await page.evaluate(p => TSI.store.set('tsi.bastion.crest', { dataUrl: p, key: 'k1', name: 'c.png' }), png);
    await page.evaluate(() => TSI.store.flush());
    await page.reload();
    await page.waitForSelector('[data-test=day-status]');
    equal(await bare(page, '[data-test=identity-badge]'), 'Unsworn');
    equal(await page.$eval('.tsi-bas-badge__img', i => !i.hidden && i.getAttribute('src').indexOf('data:image/png') === 0), true);
    equal(await page.getAttribute('[data-test=identity-badge]', 'aria-label'), 'Crest of the Ironbow. Open Party Identity.');
    await setUp(page, (s) => { s.organization = { type: 'clan', name: 'Clan Ironbow', chief: 'Harry', motto: '', foundedAtDay: 22 }; });
    await page.evaluate(() => TSI.store.flush());
    await page.reload();
    await page.waitForSelector('[data-test=day-status]');
    equal(await bare(page, '[data-test=identity-badge]'), 'Clan Ironbow');
    equal(await page.$eval('.tsi-bas-badge__img', i => !i.hidden && i.getAttribute('src').indexOf('data:image/png') === 0), true);
    equal(await page.getAttribute('[data-test=identity-badge]', 'aria-label'), 'Crest of Clan Ironbow. Open Party Identity.');
  });

  /* ------------------------------------------------------------------ */
  section('What the screen remembers');

  await check('the old panels\' open-or-closed settings are dropped; the grid\'s and the war pop-ups\' are kept', async () => {
    await page.evaluate(() => TSI.store.set('tsi.bastion.ui', { collapsed: { war: true, diplomacy: true }, gridOpen: false, warNoticed: { ma1: true } }));
    await page.evaluate(() => TSI.store.flush());
    await page.reload();
    await page.waitForSelector('[data-test=day-status]');
    await page.click('[data-test=grid-toggle]');
    await page.waitForTimeout(150);
    await page.evaluate(() => TSI.store.flush());
    const ui = await page.evaluate(() => TSI.store.get('tsi.bastion.ui', null));
    /* ("ma1" is no Military Action waiting, so the war pop-ups' list tidies it away, as before.) */
    equal(ui, { gridOpen: true, warNoticed: {} });
  });

  await check('nothing reached for the internet, and nothing failed', async () => {
    equal(context.log.net, []);
    equal(context.log.failed, []);
    equal(context.log.errors, []);
    equal(context.log.consoleErrors, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
