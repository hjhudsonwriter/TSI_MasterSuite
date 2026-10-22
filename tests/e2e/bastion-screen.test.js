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
    await check(size + ': no scrolling either way, every tile and button in view, the painting fitted at 2.4 : 1, the crest badge clear of the Hall', async () => {
      await page.setViewportSize(H.SIZES[size].viewport);
      await page.waitForTimeout(300);
      const lc = await H.layoutCheck(page, MAIN);
      equal(lc.scrollWidth, lc.clientWidth, 'no sideways scroll');
      equal(lc.outOfView, [], 'in view');
      equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, 'the page doesn\'t scroll down');
      equal(await page.$$eval('.tsi-bas-tile', ts => ts.length), 17, 'five facilities, six slots and six Development Plots');
      equal(await page.$$eval('[data-test=grid-slots] .tsi-bas-tile', ts => ts.length), 11, 'the top row: the facilities and slots');
      equal(await page.$$eval('[data-test=grid-plots] .tsi-bas-tile', ts => ts.length), 6, 'the row below: the plots');
      const map = await rect(page, '.tsi-bas-map');
      assert(Math.abs(map.w / map.h - 3000 / 1250) < 0.01, 'fitted, not stretched: ' + JSON.stringify(map));
      /* The badge may sit over the painting's top-right sky, but never over
         the Hall of Emissaries (x 2595-2943, y 376-649 on the 3000 x 1250
         painting: docs/BASTION-MAP-ART.md section 4). */
      const badge = await rect(page, '[data-test=identity-badge]');
      const k = map.w / 3000;
      const hall = { x: map.x + 2595 * k, y: map.y + 376 * k, right: map.x + 2943 * k, bottom: map.y + 649 * k };
      assert(badge.bottom <= hall.y || badge.right <= hall.x || badge.x >= hall.right, size + ': the badge is clear of the Hall: ' + JSON.stringify([badge, hall]));
      /* ...and sits inside the painting, so it never meets the panel's edge (Harry, 13 October 2026). */
      assert(badge.x >= map.x && badge.right <= map.right - 8 && badge.y >= map.y && badge.bottom <= map.bottom, size + ': the badge is inside the painting: ' + JSON.stringify([badge, map]));
      const over = await rect(page, '.tsi-bas-map__overlays');
      equal([Math.round(over.x), Math.round(over.y), Math.round(over.w), Math.round(over.h)], [Math.round(map.x), Math.round(map.y), Math.round(map.w), Math.round(map.h)], 'the building overlays sit exactly on the painting');
      /* The haze covers the painting while the grid is open; the tiles sit in
         a tray that rises a little over the sea at the painting's foot
         (Harry, 13 October 2026): never above y 1150 on the painting (the
         dock's boat ends about y 1010), and never over a label. */
      const haze = await rect(page, '[data-test=map-haze]');
      equal([Math.round(haze.x), Math.round(haze.y), Math.round(haze.w), Math.round(haze.h)], [Math.round(map.x), Math.round(map.y), Math.round(map.w), Math.round(map.h)], 'the haze sits exactly on the painting');
      const tray = await rect(page, '[data-test=grid-tray]');
      const bar = await rect(page, '.tsi-bas-bottom');
      assert(tray.y >= map.y + 1150 * k && tray.y >= map.bottom - 45, size + ': the tray rises only a little over the painting: ' + JSON.stringify([tray, map]));
      assert(tray.bottom <= bar.bottom, size + ': the tray ends inside the bar');
      const labels = await page.$$eval('.tsi-bas-maplabel', ls => ls.map(l => { const r = l.getBoundingClientRect(); return { fac: l.dataset.fac, x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
      equal(labels.map(l => l.fac).sort(), ['armoury', 'barracks', 'dock', 'watchtower', 'workshop'], 'a label for each built facility');
      for (const l of labels) {
        assert(!overlaps(l, tray), size + ': the tray is clear of the ' + l.fac + '\'s label');
        assert(l.x >= map.x - 1 && l.right <= map.right + 1 && l.y >= map.y - 1 && l.bottom <= map.bottom + 1, size + ': the ' + l.fac + '\'s label is on the painting');
        assert(!overlaps(l, badge), size + ': the ' + l.fac + '\'s label is clear of the badge');
      }
      const want = { laptop: 900, laptopFull: 1100, tv: 1150, smallWindow: 600 }[size];
      assert(map.w >= want, size + ': the painting is ' + Math.round(map.w) + ' wide');
      await H.shot(page, 'bs-01-' + size);
    });
  }
  await check('a notice sits on the left above the bottom bar: never over its buttons, the badge or the DM doc, on the laptop, in full screen and on the TV', async () => {
    for (const size of ['laptop', 'laptopFull', 'tv']) {
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
      const tray = await rect(page, '[data-test=grid-tray]');
      assert(!overlaps(n, tray), size + ': and clear of the open tray of tiles: ' + JSON.stringify([n, tray]));
      const badge = await rect(page, '[data-test=identity-badge]');
      assert(n.right <= badge.x, size + ': clear of the badge');
      /* The DM doc opens on the right: its own edges and grip stay clear. */
      await page.click('[data-test=dm-doc]');
      await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden])');
      const doc = await rect(page, '[data-test=dmdoc-panel]');
      assert(n.right <= doc.x, size + ': clear of the DM doc: ' + JSON.stringify([n, doc]));
      await page.click('[data-test=dm-doc]');
      await page.waitForSelector('[data-test=dmdoc-panel]', { state: 'hidden' });
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

  await check('the five starting facilities first (Workshop, Barracks, Watchtower, Dock, Armoury), then the six slots; the six Development Plots in the row below', async () => {
    equal(await page.$$eval('[data-test=grid-slots] .tsi-bas-tile', ts => ts.slice(0, 5).map(t => t.dataset.fac)), ['workshop', 'barracks', 'watchtower', 'dock', 'armoury']);
    equal(await page.$$eval('[data-test=grid-slots] .tsi-bas-tile', ts => ts.slice(5).map(t => t.dataset.test)), ['slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5']);
    equal(await page.$$eval('[data-test=grid-plots] .tsi-bas-tile', ts => ts.map(t => t.dataset.test)), ['plot-0', 'plot-1', 'plot-2', 'plot-3', 'plot-4', 'plot-5']);
    const a = await rect(page, '[data-test=tile-workshop]');
    const b = await rect(page, '[data-test=plot-0]');
    assert(b.y >= a.bottom, 'the plots sit below');
    assert(Math.abs(a.w - a.h) < 1 && a.w >= 48 && a.w <= 66, 'square tiles, smaller than before: ' + JSON.stringify(a));
  });

  await check('at level 7 the plots are locked until party levels 9, 9, 13, 13, 17 and 17', async () => {
    const locked = [];
    for (const i of [0, 1, 2, 3, 4, 5]) {
      await page.hover('[data-test=plot-' + i + ']');
      await page.waitForFunction(() => /Development Plot/.test(document.querySelector('[data-test=tooltip]').textContent) && !document.querySelector('[data-test=tooltip]').hidden);
      locked.push((/Unlocks at party level (\d+)/.exec(await bare(page, '[data-test=tooltip]')) || [])[1]);
    }
    equal(locked, ['9', '9', '13', '13', '17', '17']);
    await page.mouse.move(5, 500);
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

  await check('▼ folds the grid away (the painting grows, and the haze and labels go), ▲ brings it back, and it\'s remembered', async () => {
    const before = await rect(page, '.tsi-bas-map');
    equal(await page.isVisible('[data-test=map-labels]'), true, 'the labels show while the grid is open');
    equal(await text(page, 'map-label-barracks'), 'BarracksLevel 1');
    assert(await page.$eval('[data-test=map]', e => getComputedStyle(e).filter !== 'none'), 'the painting is hazed');
    await page.click('[data-test=grid-toggle]');
    await page.waitForTimeout(200);
    equal(await page.isHidden('[data-test=grid]'), true);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-test=map-labels]')).visibility === 'hidden' && getComputedStyle(document.querySelector('[data-test=map]')).filter === 'none');
    equal([await page.isHidden('[data-test=map-labels]'), await page.isHidden('[data-test=map-haze]')], [true, true], 'the painting as it was: no haze, no labels');
    const after = await rect(page, '.tsi-bas-map');
    assert(after.h > before.h + 40, JSON.stringify([before, after]));
    equal((await H.layoutCheck(page, ['[data-test^=open-]', '[data-test=grid-toggle]'])).outOfView, [], 'the buttons stay in view');
    await page.evaluate(() => TSI.store.flush());
    await page.reload();
    await page.waitForSelector('[data-test=day-status]');
    equal(await page.isHidden('[data-test=grid]'), true, 'still folded after reopening');
    equal(await page.$eval('[data-test=map-labels]', e => getComputedStyle(e).visibility), 'hidden', 'no labels after reopening either');
    await page.click('[data-test=grid-toggle]');
    await page.waitForTimeout(150);
    equal(await page.isVisible('[data-test=grid]'), true);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-test=map-labels]')).visibility === 'visible');
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
    equal(await page.getAttribute('[data-test=build-library_scriptorium]', 'aria-disabled'), null);
    await page.hover('[data-test=build-library_scriptorium]');
    await page.waitForFunction(() => /Library & Scriptorium/.test(document.querySelector('[data-test=tooltip]').textContent));
    assert(/Takes 21 days to build/.test(await bare(page, '[data-test=tooltip]')));
    /* The production facilities go on Development Plots, which open at party level 9 (pull request 3). */
    equal(await page.getAttribute('[data-test=build-herbal_gardens]', 'aria-disabled'), 'true');
    assert(/Plots open at party level 9/.test(await text(page, 'build-herbal_gardens')));
    await H.shot(page, 'bs-02-build');
  });

  await check('a locked facility can\'t be chosen', async () => {
    await page.click('[data-test=build-war_room]', { force: true });
    await page.waitForTimeout(250);
    equal(await page.$(POP), null, 'no question');
    equal((await st(page)).builtExtras.filter(Boolean), []);
  });

  await check('the overhaul (13 October 2026): none is "In development" any more; the old ones are gone', async () => {
    const ids = await page.$$eval('[data-test^=build-]', bs => bs.map(b => b.dataset.test.slice(6)));
    equal(ids.filter(id => ['smithy', 'library', 'garden', 'greenhouse', 'laboratory', 'arcane_study', 'gaming_hall'].includes(id)), [], 'the old facilities are gone');
    /* The Courier Exchange left this list in pull request 6 (14 October 2026): it's built on a Development Plot.
       The Wyvern Roost, Griffin Tower and Dire Wolf Den left it in pull request 7 (14 October 2026): they can be built now. */
    /* The Stone Quarry and the Weavers' Hall left it too (19 October 2026): Development Plot facilities, built on a plot. */
    for (const id of ['stone_masonworks', 'weavers_hall']) {
      equal(await page.$eval('[data-test=build-' + id + ']', e => e.tagName), 'BUTTON', id + ': can be built now');
      assert(!/In development/.test(await text(page, 'build-' + id)), id);
      assert(/Plots open at party level 9/.test(await text(page, 'build-' + id)), id + ': on a Development Plot');
    }
    assert(!ids.some(id => id === 'nothing_in_development'), 'nothing is listed as in development');
    for (const id of ['wyvern_roost', 'griffin_tower', 'dire_wolf_den']) {
      equal(await page.$eval('[data-test=build-' + id + ']', e => e.tagName), 'BUTTON', id + ': can be built (pull request 7)');
      assert(!/In development/.test(await text(page, 'build-' + id)), id);
    }
    equal(await page.$eval('[data-test=build-wyvern_roost] [data-art]', e => [e.dataset.art, /wyvern_roost\.png/.test(e.style.backgroundImage)]), ['crop', true], 'its building cut from the map painting');
    equal(await page.$eval('[data-test=build-courier_exchange] img', e => [e.getAttribute('src').split('/').pop(), e.naturalWidth > 0]), ['courier_exchange.png', true], 'Harry\'s picture (13 October 2026)');
    equal(await page.$eval('[data-test=build-courier_exchange]', e => e.tagName), 'BUTTON', 'the Courier Exchange can be built (pull request 6)');
    assert(/Plots open at party level 9/.test(await text(page, 'build-courier_exchange')), 'on a Development Plot');
    await page.click('[data-test=build-weavers_hall]', { force: true });
    await page.waitForTimeout(250);
    equal((await st(page)).builtExtras.filter(Boolean), [], 'a plot facility isn\'t built in a special slot');
  });

  await check('Construct asks first ("Construct the Library & Scriptorium? It takes 21 days."); Cancel builds nothing', async () => {
    await page.click('[data-test=build-library_scriptorium]');
    await page.waitForSelector(POP);
    equal(await bare(page, POP + ' .tsi-modal__body'), 'Construct the Library & Scriptorium? It takes 21 days.');
    await page.click(POP + ' .tsi-modal__foot button:text-is("Cancel")');
    await page.waitForTimeout(200);
    equal((await st(page)).builtExtras.filter(Boolean), []);
    equal(await panelOpen(page), 'build', 'the panel is still open');
  });

  await check('Construct: the panel closes, and the slot shows the Library & Scriptorium with an hourglass and 21 days', async () => {
    await pause(page);
    await page.click('[data-test=build-library_scriptorium]');
    await page.waitForSelector(POP);
    await page.click(POP + ' .tsi-modal__foot button:text-is("Construct")');
    await page.waitForFunction(() => !TSI.bastion.debug.panel());
    equal((await st(page)).builtExtras[0], { facId: 'library_scriptorium', status: 'building', startDay: 1, readyDay: 22 });
    equal(await page.$$eval('[data-test=tile-library_scriptorium]', ts => ts.map(t => [t.tagName, t.className.includes('building'), t.textContent])), [['BUTTON', true, '21']]);
    await page.hover('[data-test=tile-library_scriptorium]');
    await page.waitForFunction(() => /Library & Scriptorium/.test(document.querySelector('[data-test=tooltip]').textContent));
    assert(/Under construction: 21 days left/.test(await bare(page, '[data-test=tooltip]')) && /Ready on Day 22/.test(await bare(page, '[data-test=tooltip]')));
    await page.hover('[data-test=facilities-count]');
    await page.waitForFunction(() => /Library & Scriptorium: building, 21 days left/.test(document.querySelector('[data-test=tooltip]').textContent));
    await page.mouse.move(5, 500);
    equal(await page.$('[data-test=map-label-library_scriptorium]'), null, 'no label until it\'s built');
  });

  await check('clicking a building asks whether to stop building it (Cancel keeps it); 21 days later it\'s built, its tile opens it, and its label shows on the map', async () => {
    await page.click('[data-test=tile-library_scriptorium]');
    await page.waitForSelector(POP);
    equal(await bare(page, POP + ' .tsi-modal__body'), 'Stop building the Library & Scriptorium? Its slot is freed, and the days of work so far are lost.');
    await page.click(POP + ' .tsi-modal__foot button:text-is("Cancel")');
    await page.waitForTimeout(200);
    equal(await panelOpen(page), null);
    equal((await st(page)).builtExtras[0].status, 'building', 'still being built');
    await days(page, 21);
    equal(await page.$eval('[data-test=tile-library_scriptorium]', t => t.tagName), 'BUTTON');
    equal(await text(page, 'facilities-n'), '6');
    equal(await text(page, 'map-label-library_scriptorium'), 'Library & ScriptoriumLevel 1');
    await page.click('[data-test=tile-library_scriptorium]');
    await page.waitForSelector('[data-test=panel-fac-library_scriptorium]');
    equal(await bare(page, '[data-test=panel-fac-library_scriptorium] .tsi-modal__title'), 'Library & Scriptorium');
    await page.keyboard.press('Escape');
  });

  await check('Demolish (Harry, 13 October 2026): it asks first, saying an order here is cancelled; then the slot is free, the order gone, and the Day Log says so', async () => {
    await pause(page);
    await setUp(page, (s) => { s.pendingOrders.push({ id: 'dm1', facId: 'library_scriptorium', fnId: 'research', chosen: { label: 'Arcana' }, optionLabel: 'Arcana', notes: '', label: 'Library & Scriptorium: Research (Arcana)', costGP: 0, issuedDay: s.day, dueDay: s.day + 5 }); });
    await page.click('[data-test=tile-library_scriptorium]');
    await page.waitForSelector('[data-test=demolish-library_scriptorium]');
    await pause(page);
    await page.click('[data-test=demolish-library_scriptorium]');
    await page.waitForSelector(POP);
    const msg = await bare(page, POP + ' .tsi-modal__body');
    assert(/^Demolish the Library & Scriptorium\? It goes from the Bastion and its slot is freed\. 1 order pending here is cancelled, and the gold spent isn't given back\./.test(msg), msg);
    await page.click(POP + ' .tsi-modal__foot button:text-is("Cancel")');
    await page.waitForTimeout(200);
    equal((await st(page)).builtExtras[0].facId, 'library_scriptorium', 'Cancel keeps it');
    await pause(page);
    await page.click('[data-test=demolish-library_scriptorium]');
    await page.waitForSelector(POP);
    await page.click(POP + ' .tsi-modal__foot button:text-is("Demolish")');
    await page.waitForFunction(() => !TSI.bastion.debug.panel());
    const s = await st(page);
    equal(s.builtExtras.filter(Boolean), [], 'the slot is free');
    equal(s.pendingOrders.filter(o => o.facId === 'library_scriptorium'), [], 'its order is cancelled');
    equal([s.log[0].title, s.log[0].body], ['Facility Demolished', 'The Library & Scriptorium was demolished; its slot is free. Cancelled: Library & Scriptorium: Research (Arcana).']);
    equal(await text(page, 'facilities-n'), '5');
    equal(await page.$('[data-test=tile-library_scriptorium]'), null);
    equal(await page.$('[data-test=map-label-library_scriptorium]'), null, 'its label goes too');
  });

  await check('stopping a building: its slot is free again, and the Day Log says so', async () => {
    await pause(page);
    await page.click('[data-test=slot-0]');
    await page.waitForSelector('[data-test=build-library_scriptorium]');
    await pause(page);
    await page.click('[data-test=build-library_scriptorium]');
    await page.waitForSelector(POP);
    await page.click(POP + ' .tsi-modal__foot button:text-is("Construct")');
    await page.waitForFunction(() => !TSI.bastion.debug.panel());
    await pause(page);
    await page.click('[data-test=tile-library_scriptorium]');
    await page.waitForSelector(POP);
    await page.click(POP + ' .tsi-modal__foot button:text-is("Stop building")');
    await page.waitForTimeout(300);
    const s = await st(page);
    equal(s.builtExtras.filter(Boolean), []);
    equal([s.log[0].title, s.log[0].body], ['Construction Stopped', 'Building work on the Library & Scriptorium stopped; its slot is free.']);
  });

  /* ------------------------------------------------------------------ */
  section('Development Plots, goods and production (pull request 3)');

  await check('at level 9 a Development Plot opens Construction with the production facilities first; the Herbal Gardens builds there in 21 days, in the row below', async () => {
    await page.selectOption('[data-test=level]', '9');
    await page.waitForTimeout(200);
    equal(await page.$$eval('[data-test=grid-plots] .tsi-bas-tile--plot', ts => ts.map(t => t.dataset.test)), ['plot-0', 'plot-1']);
    await pause(page);
    await page.click('[data-test=plot-0]');
    await page.waitForSelector('[data-test=panel-build]');
    const head = await text(page, 'build-panel');
    assert(/Party level 9: 4 construction slots, 0 in use\. 2 Development Plots, 0 in use\./.test(head), head);
    const ids = await page.$$eval('.tsi-bas-buildopt', bs => bs.map(b => b.dataset.test.slice(6)));
    equal(ids.slice(0, 6), ['herbal_gardens', 'fishery_smokehouse', 'timber_sawmill', 'stone_masonworks', 'weavers_hall', 'courier_exchange'], 'the production facilities first');
    equal(await page.getAttribute('[data-test=build-timber_sawmill]', 'aria-disabled'), null);
    await pause(page);
    await page.click('[data-test=build-herbal_gardens]');
    await page.waitForSelector(POP);
    equal(await bare(page, POP + ' .tsi-modal__body'), 'Construct the Herbal Gardens? It takes 21 days.');
    await page.click(POP + ' .tsi-modal__foot button:text-is("Construct")');
    await page.waitForFunction(() => !TSI.bastion.debug.panel());
    const s = await st(page);
    equal(s.builtPlots[0], { facId: 'herbal_gardens', status: 'building', startDay: s.day, readyDay: s.day + 21 });
    equal(s.builtExtras.filter(Boolean), [], 'no construction slot used');
    equal(await page.$eval('[data-test=grid-plots] [data-test=tile-herbal_gardens]', t => [t.dataset.plot, t.textContent]), ['0', '21']);
    await days(page, 21);
    equal(await page.$eval('[data-test=tile-herbal_gardens]', t => t.className.includes('tsi-bas-tile--onplot')), true);
    equal(await text(page, 'map-label-herbal_gardens'), 'Herbal GardensLevel 1');
  });

  await check('Demolish on a plot says its plot is freed (Cancel keeps it)', async () => {
    await pause(page);
    await page.click('[data-test=tile-herbal_gardens]');
    await page.waitForSelector('[data-test=demolish-herbal_gardens]');
    await pause(page);
    await page.click('[data-test=demolish-herbal_gardens]');
    await page.waitForSelector(POP);
    const msg = await bare(page, POP + ' .tsi-modal__body');
    assert(/^Demolish the Herbal Gardens\? It goes from the Bastion and its plot is freed\./.test(msg), msg);
    await page.click(POP + ' .tsi-modal__foot button:text-is("Cancel")');
    await page.waitForTimeout(200);
    equal((await st(page)).builtPlots[0].facId, 'herbal_gardens');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  });

  await check('an Herbal Gardens built in a construction slot moves to a free plot when the party reaches level 9, keeping its level', async () => {
    await setUp(page, (s) => { s.builtPlots = []; s.builtExtras = [{ facId: 'herbal_gardens', status: 'built' }]; s.facilityLevels.herbal_gardens = 2; s.partyLevel = 7; });
    await page.waitForTimeout(200);
    equal(await page.$eval('[data-test=tile-herbal_gardens]', t => !!t.closest('[data-test=grid-slots]')), true, 'in a slot at level 7');
    await page.selectOption('[data-test=level]', '9');
    await page.waitForTimeout(250);
    const s = await st(page);
    equal([s.builtExtras.filter(Boolean), s.builtPlots[0], s.facilityLevels.herbal_gardens], [[], { facId: 'herbal_gardens', status: 'built' }, 2]);
    equal(await page.$eval('[data-test=tile-herbal_gardens]', t => !!t.closest('[data-test=grid-plots]')), true, 'now in the plots row');
    equal(await text(page, 'map-label-herbal_gardens'), 'Herbal GardensLevel 2');
    assert(s.log.some(l => /The Herbal Gardens moved to a Development Plot; its construction slot is free\./.test(l.body)), 'the Day Log says so');
  });

  await check('with every construction slot in use but a plot free, the other facilities say "No free slot" and can\'t be chosen', async () => {
    await setUp(page, (s) => { s.builtExtras = ['library_scriptorium', 'arcane_laboratory', 'shrine_aurush', 'hall_of_emissaries'].map(id => ({ facId: id, status: 'built' })); });
    await pause(page);
    await page.click('[data-test=plot-1]');
    await page.waitForSelector('[data-test=build-panel]');
    try {
      assert(/; every construction slot is in use\./.test(await text(page, 'build-panel')), await text(page, 'build-panel'));
      equal([await page.getAttribute('[data-test=build-shrine_telluria]', 'aria-disabled'), await text(page, 'build-shrine_telluria')], ['true', 'Shrine of TelluriaNo free slot']);
      equal(await page.getAttribute('[data-test=build-timber_sawmill]', 'aria-disabled'), null, 'a plot facility still can');
      await page.click('[data-test=build-shrine_telluria]', { force: true });
      await page.waitForTimeout(250);
      equal(await page.$(POP), null, 'no question');
    } finally {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
    await setUp(page, (s) => { s.builtExtras = []; });
  });

  const rowsOf = (page, fac) => page.$$eval('[data-test^="issue-' + fac + '__"]', bs => bs.map(b => b.dataset.test.slice('issue-'.length)));

  await check('the Stone Quarry and the Weavers\' Hall (Strip Back Overhaul, S04): each shows only its level\'s order, the Upgrade says what it replaces, an empty Warehouse is enough, and goods land in the Warehouse', async () => {
    const saved = (await st(page)).builtPlots.slice(0, 3);
    await setUp(page, (s) => {
      s.builtPlots[0] = { facId: 'stone_masonworks', status: 'built' };
      s.builtPlots[2] = { facId: 'weavers_hall', status: 'built' };
      s.facilityLevels.stone_masonworks = 2; s.facilityLevels.weavers_hall = 1; s.warehouse = []; s.pendingOrders = [];
    });
    await pause(page);
    await page.click('[data-test=tile-stone_masonworks]');
    await page.waitForSelector('[data-test=panel-fac-stone_masonworks]');
    const lines = sel => page.$eval(sel, e => Array.from(e.children).map(c => c.textContent));
    equal(await rowsOf(page, 'stone_masonworks'), ['stone_masonworks__produce_dressed_stone'], 'Level 2: only Produce Dressed Stone; Extract Raw Stone is replaced, the later orders are not shown');
    equal(await lines('[data-test=goods-stone_masonworks__produce_dressed_stone]'), ['Makes: 1 lot of Dressed Stone'], 'it uses nothing, so no "Uses" line and no reason');
    equal([await page.isDisabled('[data-test=issue-stone_masonworks__produce_dressed_stone]'), await text(page, 'issue-stone_masonworks__produce_dressed_stone')], [false, 'Issue Order'], 'with an empty Warehouse');
    equal(await text(page, 'days-stone_masonworks__produce_dressed_stone'), 'Takes 4 days');
    equal(await text(page, 'upgrade-unlocks-stone_masonworks'), 'Level 3 replaces Produce Dressed Stone with Produce Structural Masonry.');
    equal((await H.layoutCheck(page, ['[data-test=panel-fac-stone_masonworks]', '[data-test=panel-fac-stone_masonworks] .tsi-modal__foot button'])).outOfView, [], 'the panel fits');
    await H.shot(page, 'bs-06-stone');
    await pause(page);
    await page.click('[data-test=issue-stone_masonworks__produce_dressed_stone]');
    await page.waitForFunction(() => TSI.bastion.debug.state().pendingOrders.some(o => o.fnId === 'produce_dressed_stone'));
    assert(!/Taken from the Warehouse/.test((await st(page)).log[0].body), 'nothing was taken');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await days(page, 4);
    equal((await st(page)).warehouse.filter(w => w.goodId).map(w => [w.goodId, w.qty]), [['dressed_stone', 1]]);
    await page.click('[data-test=tile-weavers_hall]');
    await page.waitForSelector('[data-test=panel-fac-weavers_hall]');
    equal(await rowsOf(page, 'weavers_hall'), ['weavers_hall__produce_ordinary_textiles'], 'Level 1: only Produce Ordinary Textiles');
    equal(await text(page, 'days-weavers_hall__produce_ordinary_textiles'), 'Takes 4 days');
    equal(await text(page, 'upgrade-unlocks-weavers_hall'), 'Level 2 replaces Produce Ordinary Textiles with Produce Sailcloth.');
    equal((await H.layoutCheck(page, ['[data-test=panel-fac-weavers_hall]'])).outOfView, [], 'the panel fits');
    await page.keyboard.press('Escape');
    /* Level 5 offers both its orders, one running at a time. */
    await setUp(page, (s) => { s.facilityLevels.weavers_hall = 5; s.pendingOrders = []; });
    await pause(page);
    await page.click('[data-test=tile-weavers_hall]');
    await page.waitForSelector('[data-test=panel-fac-weavers_hall]');
    equal(await rowsOf(page, 'weavers_hall'), ['weavers_hall__bulk_textile_production', 'weavers_hall__bulk_sailcloth_production'], 'Level 5: both orders');
    equal(await lines('[data-test=goods-weavers_hall__bulk_sailcloth_production]'), ['Makes: 3 lots of Sailcloth'], 'Bulk Sailcloth Production needs no Ordinary Textiles');
    await page.click('[data-test=issue-weavers_hall__bulk_sailcloth_production]');
    await page.waitForFunction(() => TSI.bastion.debug.state().pendingOrders.some(o => o.fnId === 'bulk_sailcloth_production'));
    equal([await page.isDisabled('[data-test=issue-weavers_hall__bulk_textile_production]'), await text(page, 'issue-weavers_hall__bulk_textile_production')], [true, 'Can\'t order yet'], 'only one runs at a time');
    assert(/is busy: one production order at a time/.test(await text(page, 'why-weavers_hall__bulk_textile_production')), 'and it says why');
    await H.shot(page, 'bs-06-weavers-l5');
    await page.keyboard.press('Escape');
    await setUp(page, (s) => { s.pendingOrders = []; s.warehouse = []; });
    const keep = JSON.stringify(saved);
    await page.evaluate(k => TSI.bastion.debug.change(s => { const b = JSON.parse(k); [0, 1, 2].forEach(i => { s.builtPlots[i] = b[i]; }); }), keep);
  });

  await check('the Timber Yard: Level 1 shows Harvest Timber only; the Upgrade asks first; Level 2 shows Saw Lumber only; an order pending across the upgrade finishes and counts as the one running', async () => {
    await setUp(page, (s) => { s.builtPlots[1] = { facId: 'timber_sawmill', status: 'built' }; s.facilityLevels.timber_sawmill = 1; s.warehouse = []; s.pendingOrders = []; });
    await pause(page);
    await page.click('[data-test=tile-timber_sawmill]');
    await page.waitForSelector('[data-test=panel-fac-timber_sawmill]');
    const lines = sel => page.$eval(sel, e => Array.from(e.children).map(c => c.textContent));
    equal(await rowsOf(page, 'timber_sawmill'), ['timber_sawmill__harvest_timber'], 'Level 1: Harvest Timber only');
    equal(await lines('[data-test=goods-timber_sawmill__harvest_timber]'), ['Makes: 1 lot of Raw Timber']);
    equal(await text(page, 'days-timber_sawmill__harvest_timber'), 'Takes 4 days');
    equal(await text(page, 'upgrade-text-timber_sawmill'), 'To Level 2: takes 7 days, no gold.');
    equal(await text(page, 'upgrade-unlocks-timber_sawmill'), 'Level 2 replaces Harvest Timber with Saw Lumber.');
    equal((await H.layoutCheck(page, ['[data-test=panel-fac-timber_sawmill]', '[data-test=panel-fac-timber_sawmill] .tsi-modal__foot button'])).outOfView, [], 'the panel fits');
    await H.shot(page, 'bs-06-timber');
    await pause(page);
    await page.click('[data-test=issue-timber_sawmill__harvest_timber]');
    await page.waitForFunction(() => TSI.bastion.debug.state().pendingOrders.some(o => o.fnId === 'harvest_timber'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await days(page, 4);
    equal((await st(page)).warehouse.filter(w => w.goodId).map(w => [w.goodId, w.qty]), [['raw_timber', 1]], 'Harvest Timber made a lot');

    /* The Upgrade asks first: Cancel changes nothing, Upgrade orders it. */
    await pause(page);
    await page.click('[data-test=tile-timber_sawmill]');
    await page.waitForSelector('[data-test=panel-fac-timber_sawmill]');
    await pause(page);
    await page.click('[data-test=upgrade-timber_sawmill]');
    await page.waitForSelector(POP);
    equal(await bare(page, POP + ' .tsi-modal__body'), 'Upgrade the Timber Yard & Sawmill to Level 2? Level 2 replaces Harvest Timber with Saw Lumber. Once the upgrade finishes, Harvest Timber can no longer be started; an order already running will still finish.');
    await H.shot(page, 'bs-06-timber-upgrade-ask');
    await page.click(POP + ' .tsi-modal__foot button:text-is("Cancel")');
    await page.waitForTimeout(250);
    equal((await st(page)).pendingOrders.length, 0, 'Cancel orders nothing');
    await pause(page);
    await page.click('[data-test=upgrade-timber_sawmill]');
    await page.waitForSelector(POP);
    await page.click(POP + ' .tsi-modal__foot button:text-is("Upgrade")');
    await page.waitForFunction(() => TSI.bastion.debug.state().pendingOrders.some(o => o.fnId === 'upgrade'));
    equal(await text(page, 'fac-level'), 'Level 1 of 5', 'still Level 1 until it finishes');
    equal(await rowsOf(page, 'timber_sawmill'), ['timber_sawmill__harvest_timber'], 'and Harvest Timber is still on offer until then');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    /* Harvest Timber is ordered late, so it is still pending when the upgrade finishes. */
    await days(page, 6);
    await pause(page);
    await page.click('[data-test=tile-timber_sawmill]');
    await page.waitForSelector('[data-test=panel-fac-timber_sawmill]');
    await page.click('[data-test=issue-timber_sawmill__harvest_timber]');
    await page.waitForFunction(() => TSI.bastion.debug.state().pendingOrders.some(o => o.fnId === 'harvest_timber'));
    const due = (await st(page)).pendingOrders.find(o => o.fnId === 'harvest_timber').dueDay;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await days(page, 1);
    await pause(page);
    await page.click('[data-test=tile-timber_sawmill]');
    await page.waitForSelector('[data-test=panel-fac-timber_sawmill]');
    equal(await text(page, 'fac-level'), 'Level 2 of 5');
    equal(await rowsOf(page, 'timber_sawmill'), ['timber_sawmill__saw_lumber'], 'Level 2: Saw Lumber only; Harvest Timber is replaced');
    equal(await lines('[data-test=goods-timber_sawmill__saw_lumber]').then(l => l.slice(0, 2)), ['Makes: 1 lot of Sawn Lumber', 'The Timber Yard & Sawmill is busy: one production order at a time (Timber Yard & Sawmill: Harvest Timber, due on Day ' + due + ').'], 'no "Uses" line; the order still running holds it back');
    equal([await page.isDisabled('[data-test=issue-timber_sawmill__saw_lumber]'), await text(page, 'issue-timber_sawmill__saw_lumber')], [true, 'Can\'t order yet']);
    assert(/Harvest Timber/.test(await bare(page, '.tsi-bas-facpanel__orders')), 'the old order is still pending here');
    equal(await text(page, 'upgrade-unlocks-timber_sawmill'), 'Level 3 replaces Saw Lumber with Prepare Construction Timber.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await days(page, 3);
    equal((await st(page)).warehouse.filter(w => w.goodId).map(w => [w.goodId, w.qty]), [['raw_timber', 2]], 'the pending Harvest Timber finished, once, into the same row');
  });

  await check('Saw Lumber needs nothing from the Warehouse; Cancel gives nothing extra back and frees the slot', async () => {
    await pause(page);
    await page.click('[data-test=tile-timber_sawmill]');
    await page.waitForSelector('[data-test=panel-fac-timber_sawmill]');
    equal(await page.isDisabled('[data-test=issue-timber_sawmill__saw_lumber]'), false);
    await pause(page);
    await page.click('[data-test=issue-timber_sawmill__saw_lumber]');
    await page.waitForFunction(() => TSI.bastion.debug.state().pendingOrders.some(o => o.fnId === 'saw_lumber'));
    let s = await st(page);
    equal(s.warehouse.filter(w => w.goodId).map(w => [w.goodId, w.qty]), [['raw_timber', 2]], 'the Raw Timber is untouched');
    assert(!/Taken from the Warehouse/.test(s.log[0].body), s.log[0].body);
    assert(!/Holding/.test(await bare(page, '[data-test=panel-fac-timber_sawmill]')), 'the order holds nothing');
    const i = s.pendingOrders.findIndex(o => o.fnId === 'saw_lumber');
    equal(s.pendingOrders[i].inputs, undefined);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await pause(page);
    await page.click('[data-test=orders-count]');
    await page.waitForSelector('[data-test=cancel-' + i + ']');
    equal(await page.$('[data-test=pending-held-' + i + ']'), null, 'no "Holding" line');
    await pause(page);
    await page.click('[data-test=cancel-' + i + ']');
    await page.waitForTimeout(250);
    s = await st(page);
    equal(s.warehouse.filter(w => w.goodId).map(w => [w.goodId, w.qty]), [['raw_timber', 2]], 'nothing extra came back');
    equal([s.log[0].title, s.log[0].body], ['Orders', 'Cancelled an order.']);
    equal(s.pendingOrders.length, 0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await page.click('[data-test=tile-timber_sawmill]');
    await page.waitForSelector('[data-test=panel-fac-timber_sawmill]');
    equal(await page.isDisabled('[data-test=issue-timber_sawmill__saw_lumber]'), false, 'the slot is free again');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  });

  await check('the Warehouse shows goods with what a lot holds and their value; only the count and notes can be changed', async () => {
    await pause(page);
    await page.click('[data-test=open-warehouse]');
    await page.waitForSelector('[data-test=panel-warehouse] [data-test=warehouse]');
    const i = (await st(page)).warehouse.findIndex(w => w.goodId === 'raw_timber');
    equal(await page.$eval('[data-test=wh-item-' + i + ']', e => Array.from(e.children).map(c => c.textContent)), ['Raw Timber', '1 lot = 20 logs']);
    equal(await text(page, 'wh-value-' + i), '200 gp (100 a lot)');
    equal(await page.$$eval('[data-test=wh-item-' + i + '] input', is => is.length), 0, 'its name can\'t be typed over');
    equal(await page.$('[data-test=wh-gp-' + i + ']'), null, 'nor its value');
    await page.fill('[data-test=wh-qty-' + i + ']', '5');
    await page.waitForTimeout(200);
    equal((await st(page)).warehouse[i].qty, 5);
    equal(await text(page, 'wh-value-' + i), '500 gp (100 a lot)');
    equal((await H.layoutCheck(page, ['[data-test=panel-warehouse]', '[data-test=panel-warehouse] .tsi-modal__foot button'])).outOfView, []);
    await H.shot(page, 'bs-07-warehouse-goods');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  });

  await check('the Herbal Gardens at Level 5: its four new orders say what they use and make; a recipe waiting for research says so; each recipe has its own days', async () => {
    await setUp(page, (s) => { s.facilityLevels.herbal_gardens = 5; s.research = {}; });
    await pause(page);
    await page.click('[data-test=tile-herbal_gardens]');
    await page.waitForSelector('[data-test=panel-fac-herbal_gardens]');
    try {
      equal(await page.$$eval('[data-test^="goods-herbal_gardens__"]', gs => gs.map(g => g.dataset.test.replace('goods-herbal_gardens__', ''))),
        ['cultivate_specialist', 'field_medical_supplies', 'commercial_medicinal_crops', 'major_botanical_production']);
      equal(await page.$$eval('[data-test="sel-herbal_gardens__commercial_medicinal_crops"] option', os => os.map(o => o.textContent)),
        ['Medicinal Herbs (1 lot)', 'Refined Botanical Reagents (1 lot) (needs Botanical Extraction)']);
      await page.selectOption('[data-test="sel-herbal_gardens__commercial_medicinal_crops"]', '1');
      await page.waitForTimeout(100);
      equal(await text(page, 'why-herbal_gardens__commercial_medicinal_crops'), 'Needs the research Botanical Extraction.');
      equal(await page.isDisabled('[data-test=issue-herbal_gardens__commercial_medicinal_crops]'), true);
      equal(await text(page, 'days-herbal_gardens__field_medical_supplies'), 'Takes 6 days');
      await page.selectOption('[data-test="sel-herbal_gardens__field_medical_supplies"]', '1');
      await page.waitForTimeout(100);
      equal(await text(page, 'days-herbal_gardens__field_medical_supplies'), 'Takes 7 days');
      equal(await page.$eval('[data-test=goods-herbal_gardens__cultivate_specialist]', e => e.textContent), 'Makes: 10 portions of Restorative Herbs');
    } finally {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
    /* Back to the start for what follows. */
    await setUp(page, (s) => { s.builtPlots = []; s.builtExtras = []; s.warehouse = []; s.pendingOrders = []; s.research = {}; });
    await page.selectOption('[data-test=level]', '7');
    await page.waitForTimeout(200);
    equal((await st(page)).partyLevel, 7);
  });

  /* ------------------------------------------------------------------ */
  section('A facility\'s panel');

  await check('the Barracks: its painting, level, orders pending here, and its orders with their days', async () => {
    await pause(page);
    await page.click('[data-test=tile-barracks]');
    await page.waitForSelector('[data-test=panel-fac-barracks]');
    equal(await page.$('[data-test=demolish-barracks]'), null, 'a starting facility can\'t be demolished');
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

  await check('levels (step 1b): a facility\'s panel shows its level and an Upgrade, first among its orders, which takes 7 days and no gold; then it\'s Level 2', async () => {
    await pause(page);
    await page.click('[data-test=tile-watchtower]');
    await page.waitForSelector('[data-test=panel-fac-watchtower]');
    equal(await text(page, 'fac-level'), 'Level 1 of 5');
    equal(await page.$eval('.tsi-bas-facpanel__fns > .tsi-bas-fn', e => e.dataset.test), 'upgrade-row-watchtower', 'Upgrade comes first');
    equal(await text(page, 'upgrade-text-watchtower'), 'To Level 2: takes 7 days, no gold.');
    const gp = (await st(page)).treasuryGP;
    await page.click('[data-test=upgrade-watchtower]');
    await page.waitForTimeout(250);
    const s = await st(page);
    const up = s.pendingOrders.find(o => o.facId === 'watchtower');
    equal([up.label, up.dueDay - s.day, s.treasuryGP], ['Watchtower: Upgrade to Level 2', 7, gp]);
    equal([await text(page, 'upgrade-watchtower'), await page.isDisabled('[data-test=upgrade-watchtower]')], ['Upgrading', true]);
    equal(await text(page, 'upgrade-text-watchtower'), 'Upgrading to Level 2: ready on Day ' + up.dueDay + '.');
    assert(/Upgrade to Level 2/.test(await bare(page, '.tsi-bas-facpanel__orders')), 'it\'s pending here, with Cancel');
    equal(await page.isDisabled('[data-test="issue-watchtower__patrol"]'), false, 'its other orders carry on');
    await page.keyboard.press('Escape');
    await days(page, 7);
    await pause(page);
    await page.click('[data-test=tile-watchtower]');
    await page.waitForSelector('[data-test=panel-fac-watchtower]');
    equal(await text(page, 'fac-level'), 'Level 2 of 5');
    equal(await text(page, 'upgrade-text-watchtower'), 'To Level 3: takes 14 days, no gold.');
    assert((await st(page)).log.some(l => l.body === 'Watchtower: Upgrade to Level 2 → The Watchtower is now Level 2.'));
    await H.shot(page, 'bs-04-upgrade');
    await page.keyboard.press('Escape');
  });

  await check('no upgrading while Under Repair (D6); at Level 5, no Upgrade button', async () => {
    await setUp(page, (s) => { s.repairs = { watchtower: s.day + 3 }; s.facilityLevels.armoury = 5; });
    await pause(page);
    await page.click('[data-test=tile-watchtower]');
    await page.waitForSelector('[data-test=panel-fac-watchtower]');
    equal([await text(page, 'upgrade-watchtower'), await page.isDisabled('[data-test=upgrade-watchtower]')], ['Under Repair', true]);
    await page.keyboard.press('Escape');
    await pause(page);
    await page.click('[data-test=tile-armoury]');
    await page.waitForSelector('[data-test=panel-fac-armoury]');
    equal(await text(page, 'fac-level'), 'Level 5 of 5');
    equal(await text(page, 'upgrade-text-armoury'), 'Level 5 is the highest.');
    equal(await page.$('[data-test=upgrade-armoury]'), null);
    await page.keyboard.press('Escape');
    await setUp(page, (s) => { s.repairs = {}; s.facilityLevels.armoury = 1; });
  });

  /* ------------------------------------------------------------------ */
  await check('research (pull request 2): the Herbal Gardens\' Research box; at Level 1 it says research opens at Level 2, and nothing can be researched', async () => {
    await setUp(page, (s) => { s.builtExtras = [{ facId: 'herbal_gardens', status: 'built' }]; s.facilityLevels.herbal_gardens = 1; s.treasuryGP = 500; s.research = {}; });
    await pause(page);
    await page.click('[data-test=tile-herbal_gardens]');
    await page.waitForSelector('[data-test=panel-fac-herbal_gardens]');
    equal(await page.$$eval('.tsi-bas-facpanel__fns > .tsi-bas-fn', es => es.slice(0, 2).map(e => e.dataset.test)), ['upgrade-row-herbal_gardens', 'research-row-herbal_gardens'], 'after Upgrade');
    equal(await text(page, 'research-tokens-herbal_gardens'), 'Tokens: 0 of 0 free');
    equal(await text(page, 'research-text-herbal_gardens'), 'Research opens at Level 2: upgrade the Herbal Gardens to earn its first token.');
    equal(await page.$('[data-test=research-row-watchtower]'), null);
    await page.click('[data-test=open-research-herbal_gardens]');
    await page.waitForSelector('[data-test=panel-research-herbal_gardens]');
    equal(await page.$$eval('[data-test^=branch-]', bs => bs.map(b => b.querySelector('.tsi-bas-research__bname').textContent)), ['Agricultural Development', 'Herbal Medicine', 'Botanical Research', 'Commercial Cultivation']);
    equal(await page.$$eval('[data-test^=choice-]', cs => cs.length), 24);
    equal(await page.isDisabled('[data-test=research-fertile_soil]'), true);
    await page.keyboard.press('Escape');
  });

  await check('at Level 2: Research asks first (gold, a token, 7 days), then it runs as an order; 7 days later it\'s researched; the Harvest takes a day less with Efficient Planting', async () => {
    await setUp(page, (s) => { s.facilityLevels.herbal_gardens = 2; });
    await pause(page);
    await page.click('[data-test=tile-herbal_gardens]');
    await page.waitForSelector('[data-test=panel-fac-herbal_gardens]');
    equal(await text(page, 'research-tokens-herbal_gardens'), 'Tokens: 1 of 1 free');
    equal(await text(page, 'days-herbal_gardens__harvest'), 'Takes 7 days');
    await page.click('[data-test=open-research-herbal_gardens]');
    await page.waitForSelector('[data-test=panel-research-herbal_gardens]');
    for (const size of ['laptop', 'tv']) {
      await page.setViewportSize(H.SIZES[size].viewport);
      await page.waitForTimeout(250);
      const lc = await H.layoutCheck(page, ['[data-test=research-head]', '[data-test=branch-agricultural] .tsi-bas-research__bname', '[data-test=branch-commercial] .tsi-bas-research__bname', '[data-test=research-fertile_soil]']);
      equal(lc.scrollWidth, lc.clientWidth, size + ': no sideways scroll');
      equal(lc.outOfView, [], size + ': the four branches\' names and the first choices in view (the rest scroll inside the panel)');
    }
    await page.setViewportSize(H.SIZES.laptop.viewport);
    await H.shot(page, 'bs-05-research');
    await page.click('[data-test=research-efficient_planting]');
    await page.waitForSelector(POP);
    const day = (await st(page)).day;
    equal(await bare(page, POP + ' .tsi-modal__body'), 'Research Efficient Planting? It costs 150 gp and a research token, and takes 7 days (ready on Day ' + (day + 7) + '). The other choice at this stage can\'t be taken as well.');
    await page.click(POP + ' .tsi-modal__foot button:text-is("Cancel")');
    await page.waitForTimeout(200);
    equal((await st(page)).treasuryGP, 500, 'Cancel spends nothing');
    await pause(page);
    await page.click('[data-test=research-efficient_planting]');
    await page.waitForSelector(POP);
    await page.click(POP + ' .tsi-modal__foot button:text-is("Research")');
    await page.waitForTimeout(300);
    const s = await st(page);
    equal([s.treasuryGP, s.pendingOrders.filter(o => o.meta && o.meta.kind === 'research').map(o => o.label)], [350, ['Herbal Gardens: Research Efficient Planting (Agricultural Development, Stage I)']]);
    equal(await page.getAttribute('[data-test=choice-efficient_planting]', 'data-state'), 'running');
    equal(await page.getAttribute('[data-test=choice-fertile_soil]', 'data-state'), 'other');
    assert(/research tokens: 0 of 1 free/.test(await text(page, 'research-head')));
    equal(await page.getAttribute('[data-test=choice-fortifying_draughts]', 'data-state'), 'coming');
    equal(await page.$('[data-test=research-fortifying_draughts]'), null, 'nothing to press on a "coming" choice');
    await page.keyboard.press('Escape');
    await days(page, 7);
    await pause(page);
    await page.click('[data-test=tile-herbal_gardens]');
    await page.waitForSelector('[data-test=panel-fac-herbal_gardens]');
    equal(await text(page, 'days-herbal_gardens__harvest'), 'Takes 6 days', 'Efficient Planting');
    await page.click('[data-test=open-research-herbal_gardens]');
    await page.waitForSelector('[data-test=panel-research-herbal_gardens]');
    equal(await page.getAttribute('[data-test=choice-efficient_planting]', 'data-state'), 'done');
    equal(await page.getAttribute('[data-test=choice-crop_rotation]', 'data-state'), 'open', 'Stage II opens');
    equal(await page.isDisabled('[data-test=research-crop_rotation]'), true, 'but no token is free');
    assert((await st(page)).log.some(l => l.title === 'Research Complete'));
  });

  await check('Undo asks first; then the token is free again, the gold isn\'t given back, and the Harvest is back to 7 days', async () => {
    await page.click('[data-test=undo-efficient_planting]');
    await page.waitForSelector(POP);
    equal(await bare(page, POP + ' .tsi-modal__body'), 'Undo Efficient Planting? Its token is free again; the gold and days spent aren\'t given back.');
    await page.click(POP + ' .tsi-modal__foot button:text-is("Undo")');
    await page.waitForTimeout(300);
    const s = await st(page);
    equal([s.research, s.treasuryGP], [{}, 350]);
    equal(await page.getAttribute('[data-test=choice-efficient_planting]', 'data-state'), 'open');
    assert(/research tokens: 1 of 1 free/.test(await text(page, 'research-head')));
    await page.keyboard.press('Escape');
    await setUp(page, (s) => { s.builtExtras = []; s.research = {}; s.treasuryGP = 0; });
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
    ['open-log', 'log', 'Day Log', 'log'],
    ['open-influence', 'influence', 'Clan Influence', 'influence'], ['open-favour', 'favour', 'Favour of the Gods', 'favour-telluria']];
  await check('the bottom bar has no Events button any more (S05): Warehouse, Management and Day Log on the left; Clan Influence, Favour and War Council on the right', async () => {
    equal(await page.$$eval('.tsi-bas-pbtns--left [data-test^=open-]', bs => bs.map(b => b.getAttribute('data-test'))), ['open-warehouse', 'open-management', 'open-log']);
    equal(await page.$$eval('.tsi-bas-pbtns--right [data-test^=open-]', bs => bs.map(b => b.getAttribute('data-test'))), ['open-influence', 'open-favour', 'open-war']);
    equal(await page.$('[data-test=open-events]'), null);
    equal(await page.evaluate(() => TSI.bastion.debug.reveal('roll-event')), false, 'and nothing to reveal for the old button');
  });
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
    assert(/Day 22 ·/.test(await text(page, 'log')), 'the Herbal Gardens finished on Day 22');
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
