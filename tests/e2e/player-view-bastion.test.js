/* The Bastion's Player View (26 October 2026; docs/PLAYER-VIEW-PLAN.md, phases P1 to P3), from a double-clicked
   index.html with the internet off: the DM's Bastion opens the players' window (player.html?view=bastion), which shows the
   map filling the screen, the row of numbers, the crest, the facility tray and the simple illustrated facility panels, follows
   everything the DM does, writes nothing, and holds nothing DM-only.
   Run with:  node tests/e2e/player-view-bastion.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const BASTION = H.fileUrl('index.html') + '?tool=bastion';
const PLAYER = H.fileUrl('player.html') + '?view=bastion';
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const change = (page, fn) => page.evaluate(src => TSI.bastion.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const pause = page => page.waitForTimeout(400);
const rect = (page, sel) => page.$eval(sel, n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; });
const bare = (page, sel) => page.$eval(sel, n => { const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); const a = []; while (w.nextNode()) a.push(w.currentNode.textContent); return a.join(' ').replace(/\s+/g, ' ').trim(); });
const pill = (pv, test) => pv.$eval('[data-test=' + test + '] .tsi-bpv-pill__n', n => n.textContent);
async function setExplorerDay(page, day) {
  await page.evaluate(d => {
    const ex = TSI.store.get('tsi.explorer.save', null) || { tokens: [], travel: {}, grid: {} };
    ex.travel = Object.assign({}, ex.travel, { day: d });
    TSI.store.set('tsi.explorer.save', ex);
    TSI.bastion.debug.clock();
  }, day);
}
async function openDm(page) {
  await page.goto(BASTION);
  await page.waitForSelector('[data-test=day-status]');
  await setExplorerDay(page, 1);
  await page.waitForFunction(() => TSI.bastion.debug.state().anchored);
  await page.waitForTimeout(300);
}
/* A small crest picture, saved as the Bastion's crest (drawn on a blank canvas: nothing bundled). */
async function giveCrest(page) {
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#b1122a'; g.fillRect(4, 4, 56, 56); g.fillStyle = '#d6b25e'; g.fillRect(24, 4, 16, 56);
    TSI.store.set('tsi.bastion.crest', { dataUrl: c.toDataURL('image/png'), key: 'testcrest1', name: 'crest.png' });
    return TSI.store.flush();
  });
}
/* The players' window, opened by the DM's button. */
async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  await pv.waitForFunction(() => [...document.images].every(i => i.complete));
  return pv;
}
const SECRETS = ['ZZWAREHOUSE', 'ZZDMNOTE', 'ZZPRISONER', 'ZZBEAST', 'ZZPAIRCODE', 'ZZNOTICE', 'ZZRECORD'];

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The Player View at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name, { acceptDownloads: true });
    await context.setOffline(true);
    /* Watch every write the players' window makes (storage, databases, cookies). */
    await context.addInitScript(() => {
      if (!/view=bastion/.test(location.search) || !/player\.html/.test(location.pathname)) return;
      window.__writes = [];
      const log = what => window.__writes.push(what);
      try {
        const set = Storage.prototype.setItem, rem = Storage.prototype.removeItem, clr = Storage.prototype.clear;
        Storage.prototype.setItem = function (k) { log('setItem ' + k); return set.apply(this, arguments); };
        Storage.prototype.removeItem = function (k) { log('removeItem ' + k); return rem.apply(this, arguments); };
        Storage.prototype.clear = function () { log('clear'); return clr.apply(this, arguments); };
        if (window.indexedDB) { const open = indexedDB.open; indexedDB.open = function (n) { log('indexedDB ' + n); return open.apply(this, arguments); }; }
        const d = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
        if (d && d.set) Object.defineProperty(document, 'cookie', { get() { return d.get.call(document); }, set(v) { log('cookie'); d.set.call(document, v); } });
      } catch (e) { log('spy failed: ' + e.message); }
    });
    const page = await context.newPage();
    await openDm(page);
    await giveCrest(page);
    await page.reload();
    await page.waitForSelector('[data-test=day-status]');
    await setExplorerDay(page, 1);
    await page.waitForFunction(() => TSI.bastion.debug.state().anchored);
    await change(page, s => {
      s.partyName = 'The Ember Company'; s.treasuryGP = 250;
      s.warehouse = [{ name: 'ZZWAREHOUSE', qty: 9 }];
      s.notes = 'ZZDMNOTE'; s.beast = { campaignId: 'ZZPAIRCODE' }; s.notices = [{ text: 'ZZNOTICE' }];
      s.diplomaticRecords = { next: 2, list: [{ id: 1, text: 'ZZRECORD' }] };
      s.creatures = [{ id: 'c9', name: 'ZZBEAST', kind: 'wyvern' }];
    });
    const dmStore = await page.evaluate(() => Object.keys(localStorage).sort().join('|'));

    await check('the DM view has an Open Player View button, with a status that says Not open', async () => {
      equal(await page.textContent('[data-test=open-player-view]'), 'Open Player View');
      equal(await page.textContent('[data-test=player-view-status]'), 'Not open');
    });

    const pv = await openPlayer(page, size);

    await check('the DM status says Connected', async () => {
      await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected');
    });

    await check('the whole screen is the map picture: as large as it can be, centred, the whole picture showing', async () => {
      const m = await rect(pv, '[data-test=pv-map]');
      const want = Math.min(size.width, size.height * 3000 / 1250);
      assert(Math.abs(m.w - want) < 2, 'width ' + m.w + ' vs ' + want);
      assert(Math.abs(m.h - m.w * 1250 / 3000) < 2, 'the picture\'s shape is kept');
      assert(Math.abs((m.x + m.w / 2) - size.width / 2) < 2 && Math.abs((m.y + m.h / 2) - size.height / 2) < 2, 'centred');
      assert(m.x >= -1 && m.right <= size.width + 1 && m.y >= -1 && m.bottom <= size.height + 1, 'all of it in view');
      equal(await pv.$eval('.tsi-bpv-map__img', i => [i.naturalWidth, i.naturalHeight]), [3000, 1250]);
      equal(await pv.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true, 'no scrolling');
      await H.shot(pv, 'pv-bastion-' + name);
    });

    await check('no management screen: no top bar, no bottom bar, no panels, no inputs and no buttons but the tray\'s arrow and Full screen', async () => {
      equal(await pv.$$eval('input, select, textarea, a[href]', n => n.length), 0);
      equal(await pv.$$eval('button', bs => bs.map(b => b.dataset.test).sort()), ['pv-arrow', 'pv-fullscreen']);
      equal(await pv.$('.tsi-topbar, .tsi-bas-head, .tsi-bas-topbar, .tsi-bas-bottom, .tsi-modal'), null);
    });

    await check('top left, in one row: Day, Treasury GP, Facilities, Orders, with the DM\'s numbers', async () => {
      equal(await bare(pv, '[data-test=pv-row]'), 'Day 1 Treasury GP 250 Facilities 2 Orders 0');
      const r = await rect(pv, '[data-test=pv-row]');
      assert(r.x < 60 && r.y < 40 && r.right < size.width / 2, 'top left: ' + JSON.stringify(r));
      const ys = await pv.$$eval('.tsi-bpv-pill', ps => ps.map(p => Math.round(p.getBoundingClientRect().top)));
      assert(new Set(ys).size === 1, 'one row');
    });

    await check('the crest and the Party Name are top right, view only', async () => {
      equal(await pv.isVisible('[data-test=pv-crest]'), true);
      equal(await bare(pv, '[data-test=pv-badge-name]'), 'The Ember Company');
      const r = await rect(pv, '[data-test=pv-badge]');
      assert(r.right > size.width - 60 && r.y < 40, 'top right: ' + JSON.stringify(r));
      assert((await pv.$eval('[data-test=pv-crest]', i => i.naturalWidth)) === 64, 'the DM\'s crest picture');
      equal(await pv.$eval('[data-test=pv-badge]', n => getComputedStyle(n).pointerEvents), 'none');
      equal(await pv.$eval('[data-test=pv-badge]', n => n.tagName), 'DIV', 'not a button');
    });

    await check('the arrow is at the bottom centre; the tray starts folded away with no labels on the map', async () => {
      const a = await rect(pv, '[data-test=pv-arrow]');
      assert(Math.abs(a.x + a.w / 2 - size.width / 2) < 3 && a.bottom > size.height - 40, 'bottom centre: ' + JSON.stringify(a));
      equal(await pv.isVisible('[data-test=pv-grid]'), false);
      equal(await pv.$$eval('.tsi-bpv-maplabel', ls => ls.filter(l => getComputedStyle(l.parentElement).visibility !== 'hidden').length), 0);
    });

    await check('the arrow opens the tray: three starting tiles, four slots, six plots, and the map labels appear', async () => {
      await pv.click('[data-test=pv-arrow]');
      await pv.waitForSelector('[data-test=pv-grid]', { state: 'visible' });
      equal(await pv.$$eval('[data-test=pv-grid-slots] .tsi-bpv-tile', ts => ts.map(t => t.dataset.test)), ['pv-tile-workshop', 'pv-tile-dock', 'pv-tile-party_quarters', 'pv-slot', 'pv-slot', 'pv-slot', 'pv-slot']);
      equal(await pv.$$eval('[data-test=pv-grid-plots] .tsi-bpv-tile', ts => ts.length), 6);
      equal(await pv.$$eval('.tsi-bpv-tile--empty', ts => ts.length), 2, 'party level 7: two open slots');
      equal(await pv.$$eval('.tsi-bpv-tile--locked', ts => ts.length), 2 + 6);
      await pv.waitForFunction(() => getComputedStyle(document.querySelector('.tsi-bpv-map__labels')).visibility === 'visible');
      equal(await pv.$$eval('.tsi-bpv-maplabel', ls => ls.map(l => l.dataset.fac).sort()), ['dock', 'workshop']);
      equal(await pv.$$eval('.tsi-bpv-maplabel', ls => ls.map(l => [...l.children].map(c => c.textContent).join(' ')).sort()), ['Dock Level 1', 'Workshop Level 1']);
      const g = await rect(pv, '[data-test=pv-tray]');
      assert(g.right <= size.width + 1 && g.bottom <= size.height + 1 && g.x >= -1, 'the tray fits');
      equal(await pv.$$eval('.tsi-bpv-tile img, .tsi-bpv-tile', ns => ns.every(n => n.tagName !== 'IMG' || n.naturalWidth > 0)), true, 'tile pictures loaded');
      await H.shot(pv, 'pv-bastion-tray-' + name);
    });

    await check('clicking tiles, the map, the crest and the numbers does nothing (no panel, nothing written)', async () => {
      for (const sel of ['[data-test=pv-tile-workshop]', '[data-test=pv-slot]', '[data-test=pv-map]', '[data-test=pv-badge]', '[data-test=pv-row]', '[data-test=pv-tile-party_quarters]']) await pv.click(sel, { force: true });
      equal(await pv.isVisible('[data-test=pv-panel]'), false);
      equal(await page.evaluate(() => TSI.bastion.debug.panel()), null, 'and the DM\'s Bastion is untouched');
    });

    await check('advancing a day in the DM view shows at once in the Player View', async () => {
      await setExplorerDay(page, 3);
      await page.waitForFunction(() => TSI.bastion.debug.state().day >= 3 && !TSI.bastion.debug.busy());
      for (let k = 0; k < 40; k++) {
        if (await page.$('[data-test=ironbow-word]')) await page.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary');
        await page.waitForTimeout(100);
      }
      const day = (await st(page)).day;
      assert(day >= 3, 'the day passed');
      await pv.waitForFunction(d => document.querySelector('[data-test=pv-day] .tsi-bpv-pill__n').textContent === String(d), day);
    });

    await check('changing the treasury, an order and the Party Name in the DM view shows at once', async () => {
      await change(page, s => {
        s.treasuryGP = 975; s.partyName = 'The Cinder Wardens';
        s.pendingOrders.push({ id: 'zz1', facId: 'dock', fnId: 'x', chosen: null, optionLabel: null, notes: '', label: 'Dock: Ship cargo to Bolt Isle', costGP: 0, issuedDay: s.day, dueDay: s.day + 5 });
      });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-gp] .tsi-bpv-pill__n').textContent === '975' && document.querySelector('[data-test=pv-orders] .tsi-bpv-pill__n').textContent === '1');
      equal(await bare(pv, '[data-test=pv-badge-name]'), 'The Cinder Wardens');
      equal(await pv.textContent('[data-test=pv-tile-dock] .tsi-bpv-tile__count'), '1');
    });

    await check('building in the DM view: the new facility shows in the tray as under construction; when it is built, in the count, on the map and in its label', async () => {
      await page.click('[data-test=slot-0]');
      await page.click('[data-test=build-beast_pen]');
      await H.clickModal(page, 'Construct');
      await page.waitForFunction(() => TSI.bastion.debug.state().builtExtras.some(e => e && e.facId === 'beast_pen'));
      await page.waitForFunction(() => !document.querySelector('.tsi-modal'));
      await pv.waitForSelector('.tsi-bpv-tile--building[data-fac=beast_pen]');
      assert(Number(await pv.textContent('.tsi-bpv-tile--building .tsi-bpv-tile__days')) > 0, 'days left shown');
      equal(await pill(pv, 'pv-facilities'), '2', 'not counted until it is built');
      await change(page, s => { s.builtExtras[0] = { facId: 'beast_pen', status: 'built' }; });
      await pv.waitForSelector('.tsi-bpv-tile--built[data-fac=beast_pen]');
      equal(await pill(pv, 'pv-facilities'), '3');
      assert(await pv.$('.tsi-bpv-map__overlay[data-fac=beast_pen]'), 'its building is painted on the map');
      equal(await bare(pv, '[data-test=pv-label-beast_pen]'), 'Beast Pen One level');
      await H.shot(pv, 'pv-bastion-built-' + name);
    });

    section('Facility panels at ' + name);
    await check('opening the Workshop in the DM view opens the illustrated panel: name, tagline, picture, level, orders pending, staff and a line of text', async () => {
      await change(page, s => {
        s.facilityLevels.workshop = 1;
        s.pendingOrders.push({ id: 'zz2', facId: 'workshop', fnId: 'x', chosen: null, optionLabel: null, notes: 'ZZDMNOTE', label: 'Workshop: Craft: Longsword', costGP: 12, issuedDay: s.day, dueDay: s.day + 3 });
      });
      await page.click('[data-test=tile-workshop]');
      await pv.waitForSelector('[data-test=pv-panel]');
      equal(await bare(pv, '[data-test=pv-panel-title]'), 'Workshop');
      equal(await bare(pv, '[data-test=pv-panel-tagline]'), 'Need something? Craft it here...');
      equal(await bare(pv, '[data-test=pv-panel-level]'), 'Level 1');
      equal(await bare(pv, '[data-test=pv-panel-orders]'), 'Orders pending: Workshop: Craft: Longsword');
      equal(await bare(pv, '[data-test=pv-panel-staff]'), 'Staff: Handyman Smith Scholar Alchemist Artisan');
      equal(await pv.$$eval('.tsi-bpv-staff__one.is-locked', n => n.map(x => x.textContent)), ['Smith', 'Scholar', 'Alchemist', 'Artisan']);
      equal(await bare(pv, '[data-test=pv-panel-blurb]'), 'Hand your plans to the staff and they will see them made.');
      equal(await pv.$eval('.tsi-bpv-panel__art', i => i.naturalWidth > 0), true, 'the facility\'s painting');
      equal(await pv.$$eval('.tsi-bpv-panel button, .tsi-bpv-panel input, .tsi-bpv-panel select', n => n.length), 0, 'nothing to press');
      const p = await rect(pv, '[data-test=pv-panel]');
      assert(p.x >= 0 && p.y >= 0 && p.right <= size.width && p.bottom <= size.height, 'the panel fits the screen: ' + JSON.stringify(p));
      await H.shot(pv, 'pv-panel-workshop-' + name);
      await H.shot(pv, 'pv-panel-workshop-level1-' + name);
    });

    await check('the Workshop\'s picture is the one for its level, fills the picture area (cropped to fit, no letterboxing) and the header and info strip are clear of it', async () => {
      equal(await pv.$$eval('.tsi-bpv-panel__art', n => n.map(x => x.dataset.art)), ['workshop-level-1.jpg']);
      const art = await rect(pv, '.tsi-bpv-panel__art'), wrap = await rect(pv, '.tsi-bpv-panel__art-wrap');
      assert(Math.abs(art.w - wrap.w) < 3 && Math.abs(art.h - wrap.h) < 3, 'the picture fills its area');
      equal(await pv.$eval('.tsi-bpv-panel__art', n => [getComputedStyle(n).objectFit, getComputedStyle(n).objectPosition]), ['cover', '50% 62%']);
      assert(wrap.h > size.height * 0.7 && wrap.w > size.width * 0.95, 'big: ' + JSON.stringify(wrap));
      const head = await rect(pv, '.tsi-bpv-panel__head'), info = await rect(pv, '.tsi-bpv-panel__info'), blurb = await rect(pv, '.tsi-bpv-panel__blurb');
      assert(head.bottom <= wrap.y + 1 && info.y >= wrap.bottom - 1 && blurb.bottom <= size.height, 'header above, strip below, all on screen');
      assert(await pv.evaluate(() => document.documentElement.scrollHeight <= innerHeight), 'no scrolling');
    });

    await check('upgrading the Workshop while the panel is open changes the picture, fading the next one in; level 5 shows all five workers\' picture', async () => {
      await change(page, s => { s.facilityLevels.workshop = 2; });
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-bpv-panel__art').length === 1 && document.querySelector('.tsi-bpv-panel__art').dataset.art === 'workshop-level-2.jpg', null, { timeout: 5000 });
      await change(page, s => { s.facilityLevels.workshop = 3; });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-panel-level]').textContent.trim() === 'Level 3');
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-bpv-panel__art').length === 1 && document.querySelector('.tsi-bpv-panel__art').dataset.art === 'workshop-level-3.jpg', null, { timeout: 5000 });
      await H.shot(pv, 'pv-panel-workshop-level3-' + name);
      /* A level with no picture of its own uses the nearest lower level's (the data's level 3 taken out for a moment). */
      await pv.evaluate(() => { window.__l3 = TSI_DATA.bastionPlayerPanels[0].art.levels[3]; delete TSI_DATA.bastionPlayerPanels[0].art.levels[3]; });
      await change(page, s => { s.facilityLevels.workshop = 2; });
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-bpv-panel__art').length === 1 && document.querySelector('.tsi-bpv-panel__art').dataset.art === 'workshop-level-2.jpg', null, { timeout: 5000 });
      await change(page, s => { s.facilityLevels.workshop = 3; });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-panel-level]').textContent.trim() === 'Level 3');
      await pv.waitForTimeout(1200);
      equal(await pv.$$eval('.tsi-bpv-panel__art', n => n.map(x => x.dataset.art)), ['workshop-level-2.jpg'], 'no picture for the level: the lower one stays');
      await pv.evaluate(() => { TSI_DATA.bastionPlayerPanels[0].art.levels[3] = window.__l3; });
      await change(page, s => { s.facilityLevels.workshop = 4; });
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-bpv-panel__art').length === 1 && document.querySelector('.tsi-bpv-panel__art').dataset.art === 'workshop-level-4.jpg', null, { timeout: 5000 });
      await change(page, s => { s.facilityLevels.workshop = 5; });
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-bpv-panel__art').length === 1 && document.querySelector('.tsi-bpv-panel__art').dataset.art === 'workshop-level-5.jpg', null, { timeout: 5000 });
      equal(await pv.$eval('.tsi-bpv-panel__art', i => i.naturalWidth), 2000);
      equal(await pv.$$eval('.tsi-bpv-staff__one.is-locked', n => n.length), 0);
      await H.shot(pv, 'pv-panel-workshop-level5-' + name);
    });

    await check('the DM\'s own panel text (buttons, order notes, gold costs) is not in it', async () => {
      const t = await pv.$eval('[data-test=pv-panel]', n => n.textContent);
      for (const w of ['Cancel', 'Resolve', 'Upgrade', 'ZZDMNOTE', 'Craft Magic Item', 'Due Day']) assert(t.indexOf(w) === -1, w + ' is DM only');
    });

    await check('closing the DM\'s panel closes the Player View\'s; opening another follows', async () => {
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached' });
      await pause(page);
      await page.click('[data-test=tile-dock]');
      await pv.waitForSelector('[data-test=pv-panel][data-fac=dock]');
      equal(await bare(pv, '[data-test=pv-panel-title]'), 'Dock');
      equal(await bare(pv, '[data-test=pv-panel-orders]'), 'Orders pending: Dock: Ship cargo to Bolt Isle');
      equal(await pv.$('[data-test=pv-panel-staff]'), null, 'only the Workshop shows staff');
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached' });
    });

    await check('the Party Quarters tile opens a small DM panel, and the players see only its name and picture, filling the panel', async () => {
      await pause(page);
      const before = await page.evaluate(() => JSON.stringify(TSI.bastion.rules.toSave(TSI.bastion.debug.state())));
      await page.click('[data-test=tile-party_quarters]');
      await page.waitForSelector('[data-test=panel-party_quarters]');
      equal(await page.textContent('[data-test=panel-party_quarters] .tsi-bas-card__body'), 'Your party\'s own rooms. Nothing to manage here yet.');
      await pv.waitForSelector('[data-test=pv-panel][data-fac=party_quarters]');
      equal(await bare(pv, '[data-test=pv-panel-title]'), 'Party Quarters');
      equal(await pv.$$eval('[data-test=pv-panel] > *', n => n.map(x => x.className.replace('tsi-bpv-panel__', ''))), ['head', 'art-wrap']);
      equal(await pv.$('[data-test=pv-panel-tagline], [data-test=pv-panel-level], [data-test=pv-panel-orders], [data-test=pv-panel-blurb]'), null);
      equal(await pv.$$eval('.tsi-bpv-panel__art', n => n.map(x => x.dataset.art)), ['party_quarters.jpg']);
      const art = await rect(pv, '.tsi-bpv-panel__art'), wrap = await rect(pv, '.tsi-bpv-panel__art-wrap');
      assert(Math.abs(art.w - wrap.w) < 3 && Math.abs(art.h - wrap.h) < 3 && wrap.h > size.height * 0.8, 'the picture fills the rest of the panel');
      await H.shot(pv, 'pv-panel-party-quarters-' + name);
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached' });
      equal(await page.evaluate(() => JSON.stringify(TSI.bastion.rules.toSave(TSI.bastion.debug.state()))), before, 'nothing in the save changed');
    });

    await check('the Beast Pen\'s panel is its picture with only a list of the beasts housed there (name, kind, handler): no level, orders or blurb; it follows housing, renaming, handlers and release', async () => {
      await pause(page);
      await page.click('[data-test=tile-beast_pen]');
      await pv.waitForSelector('[data-test=pv-panel][data-fac=beast_pen]');
      equal(await bare(pv, '[data-test=pv-panel-title]'), 'Beast Pen');
      equal(await bare(pv, '[data-test=pv-panel-tagline]'), 'Something stirs in the stalls...');
      equal(await pv.$('[data-test=pv-panel-level], [data-test=pv-panel-orders], [data-test=pv-panel-blurb], [data-test=pv-panel-staff]'), null);
      equal(await bare(pv, '[data-test=pv-panel-beasts]'), 'No beasts housed yet.', 'a beast only granted (ZZBEAST) is not listed');
      equal(await pv.$$eval('.tsi-bpv-panel__art', n => n.map(x => x.dataset.art)), ['beast_pen.jpg']);
      await change(page, s => {
        const R = TSI.bastion.rules;
        s.creatures = [
          { id: 'b1', name: 'Stormwing', species: 'wyvern', variety: 'ZZVARIETY', status: 'housed', home: 'beast_pen', grantedDay: 1, notes: 'ZZBEAST' },
          { id: 'b2', name: 'Ashfang', species: 'dire_wolf', status: 'housed', home: 'beast_pen', grantedDay: 1 },
          { id: 'b3', name: 'Quillfeather', species: 'griffin', status: 'housed', home: 'beast_pen', grantedDay: 1 }
        ];
        s.creatures.forEach(c => R.ensureDev(s, c));
        s.creatures[0].development.handlerId = 'Mira';
        s.creatures[0].development.temperament.dominant = 'ZZTEMPER';
        s.creatures[0].development.bond.level = 2;
        s.creatures[2].development.handlerId = 'Tobin';
      });
      await pv.waitForSelector('[data-test=pv-beast-2]');
      equal(await pv.$$eval('.tsi-bpv-beasts__one', n => n.map(x => x.textContent.replace(/\s+/g, ' ').trim())), ['Stormwing · Wyvern · Mira', 'Ashfang · Dire Wolf · no handler yet', 'Quillfeather · Griffin · Tobin']);
      const t = await pv.$eval('[data-test=pv-panel]', n => n.textContent);
      for (const w of ['ZZBEAST', 'ZZVARIETY', 'ZZTEMPER', 'Bond']) assert(t.indexOf(w) === -1, w + ' is DM only');
      const art = await rect(pv, '.tsi-bpv-panel__art'), wrap = await rect(pv, '.tsi-bpv-panel__art-wrap'), info = await rect(pv, '.tsi-bpv-panel__info');
      assert(Math.abs(art.w - wrap.w) < 3 && wrap.h > size.height * 0.7 && info.bottom <= size.height, 'the picture fills the area and the list is on screen');
      await H.shot(pv, 'pv-panel-beast-pen-' + name);
      await change(page, s => { s.creatures[1].name = 'Emberjaw'; s.creatures[1].development.handlerId = 'Rook'; s.creatures[2].status = 'gone'; });
      await pv.waitForFunction(() => [...document.querySelectorAll('.tsi-bpv-beasts__one')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).join('|') === 'Stormwing · Wyvern · Mira|Emberjaw · Dire Wolf · Rook');
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached' });
    });

    await check('the Temple shows Telluria, Aurush and Pelagos with green, orange and blue favour bars from the real bars, and the prayer line', async () => {
      await change(page, s => { s.builtExtras[1] = { facId: 'temple', status: 'built' }; s.partyLevel = 9; s.favour = { telluria: 80, aurush: 25, pelagos: 50 }; });
      await pause(page);
      await page.click('[data-test=tile-temple]');
      await pv.waitForSelector('[data-test=pv-panel][data-fac=temple]');
      equal(await pv.$$eval('.tsi-bpv-god__name', n => n.map(x => x.textContent)), ['Telluria', 'Aurush', 'Pelagos']);
      equal(await pv.$$eval('.tsi-bpv-bar__fill', n => n.map(x => x.style.width)), ['80%', '25%', '50%']);
      equal(await pv.$$eval('.tsi-bpv-bar__fill', n => n.map(x => getComputedStyle(x).backgroundColor)), ['rgb(95, 168, 74)', 'rgb(224, 138, 44)', 'rgb(74, 143, 208)']);
      equal(await bare(pv, '[data-test=pv-panel-blurb]'), 'Say a prayer at a shrine and the gods may respond.');
      equal(await pv.$$eval('.tsi-bpv-panel__art img', n => n.length), 3, 'the three shrine paintings');
      await H.shot(pv, 'pv-panel-temple-' + name);
      /* A prayer in the DM view moves the bar in the Player View. */
      await change(page, s => { s.favour.aurush = 60; });
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-bpv-bar__fill')[1].style.width === '60%');
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached' });
    });

    await check('the Prison Tower\'s panel: the empty-cells picture, then the occupied one when a prisoner is locked up (fading, live), back when the last is released; only which cells are in use is sent', async () => {
      const art = () => pv.$$eval('.tsi-bpv-panel__art', n => n.map(x => x.dataset.art));
      await change(page, s => { s.builtExtras[2] = { facId: 'prison_tower', status: 'built' }; });
      await pause(page);
      await page.click('[data-test=tile-prison_tower]');
      await pv.waitForSelector('[data-test=pv-panel][data-fac=prison_tower]');
      equal(await art(), ['prison_tower-empty.jpg']);
      equal(await bare(pv, '[data-test=pv-panel-orders]'), 'Orders pending: None');
      equal(await bare(pv, '[data-test=pv-panel-level]'), 'One level');
      const wrap = await rect(pv, '.tsi-bpv-panel__art-wrap');
      assert(wrap.h > size.height * 0.7 && wrap.w > size.width * 0.95, 'the picture fills the panel');
      await H.shot(pv, 'pv-panel-prison-empty-' + name);
      await page.evaluate(() => TSI.bastion.debug.change(function (s) { TSI.bastion.rules.prisonLockUp(s, { bastion: TSI_DATA.bastion, facilities: TSI_DATA.bastionFacilities }, 1, { name: 'ZZPRISONER', thread: 'ZZTHREAD', days: 7, conditions: '' }); }));
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-bpv-panel__art').length === 1 && document.querySelector('.tsi-bpv-panel__art').dataset.art === 'prison_tower-occupied-1.jpg', null, { timeout: 6000 });
      await H.shot(pv, 'pv-panel-prison-occupied-' + name);
      const t = await pv.$eval('[data-test=pv-panel]', n => n.textContent);
      assert(!/ZZ|prisoner/i.test(t.replace(/Lock up captives here, and question them if you dare\./, '')), 'nothing about the prisoner: ' + t);
      const html = await pv.content();
      assert(html.indexOf('ZZPRISONER') === -1 && html.indexOf('ZZTHREAD') === -1, 'not in the page');
      const sent = await page.evaluate(() => JSON.stringify(TSI.bastion.rules.playerSnapshot(TSI.bastion.debug.state(), { bastion: TSI_DATA.bastion, facilities: TSI_DATA.bastionFacilities }, {}).facilities.prison_tower.cells));
      equal(sent, '[false,true,false]');
      await page.evaluate(() => TSI.bastion.debug.change(function (s) { s.prison.cells[1] = null; }));
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-bpv-panel__art').length === 1 && document.querySelector('.tsi-bpv-panel__art').dataset.art === 'prison_tower-empty.jpg', null, { timeout: 6000 });
      await page.evaluate(() => TSI.bastion.debug.change(function (s) { TSI.bastion.rules.prisonLockUp(s, { bastion: TSI_DATA.bastion, facilities: TSI_DATA.bastionFacilities }, 0, { name: 'ZZPRISONER', thread: 'ZZTHREAD', days: 7, conditions: '' }); }));
      await pv.waitForFunction(() => document.querySelector('.tsi-bpv-panel__art').dataset.art === 'prison_tower-occupied-1.jpg', null, { timeout: 6000 });
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached' });
    });

    section('The Fishery\'s pictures and ledger at ' + name);
    await check('the Fishery\'s room picture follows its level (Level 5 shows Level 4\'s), and the hotspot sits over the book', async () => {
      await change(page, s => { s.partyLevel = 13; s.builtPlots[0] = { facId: 'fishery_smokehouse', status: 'built' }; s.facilityLevels.fishery_smokehouse = 1; });
      await pause(page);
      await page.click('[data-test=tile-fishery_smokehouse]');
      await pv.waitForSelector('[data-test=pv-panel][data-fac=fishery_smokehouse]');
      const art = () => pv.$$eval('.tsi-bpv-panel__art', n => n.map(x => x.dataset.art));
      equal(await art(), ['fishery-level-1.jpg']);
      equal(await bare(pv, '[data-test=pv-panel-tagline]'), 'The catch comes in with every tide...');
      equal(await bare(pv, '[data-test=pv-panel-level]'), 'Level 1');
      equal(await pv.$eval('[data-test=pv-ledger-hotspot]', b => [b.title, b.tagName, b.hidden]), ['Open the ledger', 'BUTTON', false]);
      /* The book sits at about x 72 to 84, y 58 to 67 percent of the picture: inside the hotspot, on the screen. */
      const inside = await pv.evaluate(() => {
        const img = document.querySelector('.tsi-bpv-panel__art'), wrap = document.querySelector('.tsi-bpv-panel__art-wrap').getBoundingClientRect();
        const W = wrap.width, H = wrap.height, iw = img.naturalWidth, ih = img.naturalHeight, sc = Math.max(W / iw, H / ih), w = iw * sc, h = ih * sc;
        const ox = wrap.x + (W - w) * 0.5, oy = wrap.y + (H - h) * 0.55;
        const hs = document.querySelector('[data-test=pv-ledger-hotspot]').getBoundingClientRect();
        const bx0 = ox + w * 0.72, bx1 = ox + w * 0.84, by0 = oy + h * 0.58, by1 = oy + h * 0.67;
        return { ok: hs.x <= bx0 && hs.right >= bx1 && hs.y <= by0 && hs.bottom >= by1, hs: [hs.x, hs.y, hs.right, hs.bottom], book: [bx0, by0, bx1, by1], vis: hs.right <= innerWidth && hs.bottom <= innerHeight };
      });
      assert(inside.ok && inside.vis, 'the hotspot covers the book: ' + JSON.stringify(inside));
      equal(await pv.$eval('[data-test=pv-ledger]', n => getComputedStyle(n).visibility), 'hidden');
      await H.shot(pv, 'pv-panel-fishery-level1-' + name);
      for (const lv of [2, 3, 4, 5]) {
        await page.evaluate(l => TSI.bastion.debug.change(function (s) { s.facilityLevels.fishery_smokehouse = l; }), lv);
        const want = 'fishery-level-' + Math.min(lv, 4) + '.jpg';
        await pv.waitForFunction(w => document.querySelectorAll('.tsi-bpv-panel__art').length === 1 && document.querySelector('.tsi-bpv-panel__art').dataset.art === w, want, { timeout: 6000 });
      }
      await page.evaluate(() => TSI.bastion.debug.change(function (s) { s.facilityLevels.fishery_smokehouse = 1; }));
      await pv.waitForFunction(() => document.querySelector('.tsi-bpv-panel__art').dataset.art === 'fishery-level-1.jpg' && document.querySelectorAll('.tsi-bpv-panel__art').length === 1, null, { timeout: 6000 });
    });

    await check('clicking the hotspot (or Enter) opens that level\'s ledger over the panel; a click or Escape closes it', async () => {
      const open = () => pv.$eval('[data-test=pv-ledger]', n => n.classList.contains('is-open'));
      await pv.click('[data-test=pv-ledger-hotspot]');
      await pv.waitForFunction(() => getComputedStyle(document.querySelector('[data-test=pv-ledger]')).visibility === 'visible');
      equal(await pv.$eval('[data-test=pv-ledger]', n => n.dataset.ledger), 'fishery-ledger-1.jpg');
      equal(await pv.$eval('.tsi-bpv-ledger__img', i => [i.naturalWidth, getComputedStyle(i).objectFit]), [2400, 'contain']);
      const l = await rect(pv, '[data-test=pv-ledger]'), w = await rect(pv, '.tsi-bpv-panel__art-wrap');
      assert(Math.abs(l.w - w.w) < 4 && Math.abs(l.h - w.h) < 4, 'it fills the picture area');
      await pv.waitForTimeout(700);
      await H.shot(pv, 'pv-panel-fishery-ledger-' + name);
      await pv.click('[data-test=pv-ledger]');
      equal(await open(), false);
      await pv.focus('[data-test=pv-ledger-hotspot]');
      await pv.keyboard.press('Enter');
      equal(await open(), true);
      await pv.keyboard.press('Escape');
      equal(await open(), false);
      equal(await pv.$('.tsi-bpv-panel [data-test=pv-panel-title]') !== null, true, 'Escape only closed the ledger');
    });

    await check('the DM\'s Show ledger to players button mirrors it, and an upgrade or another facility closes it; Level 5\'s ledger shows although its room picture is awaited', async () => {
      const open = () => pv.$eval('[data-test=pv-ledger]', n => n.classList.contains('is-open'));
      equal(await page.textContent('[data-test=ledger-toggle]'), 'Show ledger to players');
      await page.click('[data-test=ledger-toggle]');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-ledger]').classList.contains('is-open'));
      equal(await page.textContent('[data-test=ledger-toggle]'), 'Hide ledger from players');
      await pause(page);
      await page.click('[data-test=ledger-toggle]');
      await pv.waitForFunction(() => !document.querySelector('[data-test=pv-ledger]').classList.contains('is-open'));
      equal(await page.textContent('[data-test=ledger-toggle]'), 'Show ledger to players');
      await pause(page);
      await page.click('[data-test=ledger-toggle]');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-ledger]').classList.contains('is-open'));
      /* The player closes it by hand; the DM's next change overrides. */
      await pv.click('[data-test=pv-ledger]');
      equal(await open(), false);
      await pause(page);
      await page.click('[data-test=ledger-toggle]');
      await pause(page);
      await page.click('[data-test=ledger-toggle]');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-ledger]').classList.contains('is-open'));
      /* An upgrade closes it. */
      await page.evaluate(() => TSI.bastion.debug.change(function (s) { s.facilityLevels.fishery_smokehouse = 5; }));
      await pv.waitForFunction(() => !document.querySelector('[data-test=pv-ledger]').classList.contains('is-open'));
      await pv.waitForFunction(() => document.querySelector('.tsi-bpv-panel__art').dataset.art === 'fishery-level-4.jpg' && document.querySelectorAll('.tsi-bpv-panel__art').length === 1, null, { timeout: 6000 });
      await pv.click('[data-test=pv-ledger-hotspot]');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-ledger]').dataset.ledger === 'fishery-ledger-5.jpg' && document.querySelector('[data-test=pv-ledger]').classList.contains('is-open'));
      await pv.waitForTimeout(700);
      await H.shot(pv, 'pv-panel-fishery-ledger5-' + name);
      /* Another facility, then back: closed. */
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached' });
      await pause(page);
      await page.click('[data-test=tile-workshop]');
      await pv.waitForSelector('[data-test=pv-panel][data-fac=workshop]');
      equal(await page.$('[data-test=ledger-toggle]'), null, 'no ledger button where there is no ledger');
      equal(await pv.$('[data-test=pv-ledger-hotspot], [data-test=pv-ledger]'), null);
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached' });
      await pause(page);
      await page.click('[data-test=tile-fishery_smokehouse]');
      await pv.waitForSelector('[data-test=pv-panel][data-fac=fishery_smokehouse]');
      equal(await open(), false);
      equal(await page.textContent('[data-test=ledger-toggle]'), 'Show ledger to players');
      const sent = await page.evaluate(() => { const s = TSI.bastion.rules.playerSnapshot(TSI.bastion.debug.state(), { bastion: TSI_DATA.bastion, facilities: TSI_DATA.bastionFacilities }, { focus: 'fishery_smokehouse', ledger: true }); return [s.ledger, JSON.stringify(s).indexOf('ledger-')]; });
      equal(sent, [true, -1]);
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached' });
    });

    await check('the DM\'s other panels (Orders, Warehouse, Construction) show nothing on the Player View', async () => {
      await pause(page);
      await page.click('[data-test=orders-count]');
      await page.waitForSelector('[data-test=panel-orders]');
      await pv.waitForTimeout(300);
      equal(await pv.isVisible('[data-test=pv-panel]'), false);
      await page.keyboard.press('Escape');
      await pause(page);
      await page.click('[data-test=open-warehouse]');
      await page.waitForSelector('[data-test=panel-warehouse]');
      await pv.waitForTimeout(300);
      equal(await pv.isVisible('[data-test=pv-panel]'), false);
      await page.keyboard.press('Escape');
    });

    section('Nothing written, nothing DM-only, ' + name);
    await check('the Player View wrote nothing: no storage, no database, no cookie', async () => {
      equal(await pv.evaluate(() => window.__writes), []);
      equal(await pv.evaluate(() => typeof TSI.store), 'undefined', 'the save code is not even loaded');
      const srcs = await pv.$$eval('script[src]', s => s.map(x => x.getAttribute('src')));
      assert(!srcs.some(s => /store|tool\.js|rules\.js|dmdoc|backup/.test(s)), 'scripts: ' + srcs.join(', '));
      equal(await page.evaluate(() => Object.keys(localStorage).sort().join('|')).then(k => k.split('|').filter(x => !dmStore.split('|').includes(x))), [], 'no new saves anywhere');
    });

    await check('nothing DM-only is in its page: not in the HTML, the data it loaded or its variables', async () => {
      const html = await pv.content();
      const dump = await pv.evaluate(() => JSON.stringify(window.TSI_DATA) + JSON.stringify(Object.keys(window.TSI)));
      for (const w of SECRETS) { assert(html.indexOf(w) === -1, w + ' in the HTML'); assert(dump.indexOf(w) === -1, w + ' in its data'); }
      const names = await pv.evaluate(() => Object.keys(window.TSI).sort());
      assert(!names.includes('bastion') && !names.includes('store'), 'no Bastion code or store: ' + names.join(','));
    });

    await check('the DM tool sends only the snapshot: what it sent has none of the secrets', async () => {
      const sent = await page.evaluate(() => JSON.stringify(TSI.bastion.rules.playerSnapshot(TSI.bastion.debug.state(), { bastion: TSI_DATA.bastion, facilities: TSI_DATA.bastionFacilities }, {})));
      for (const w of SECRETS) assert(sent.indexOf(w) === -1, w);
    });

    section('Full screen, waiting, reconnecting and closing, ' + name);
    await check('a small Full screen button fades away after a few seconds and returns when the mouse moves', async () => {
      await pv.mouse.move(100, 100); await pv.mouse.move(120, 120);
      equal(await pv.$eval('[data-test=pv-fullscreen]', b => b.classList.contains('is-faded')), false);
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-fullscreen]').classList.contains('is-faded'), null, { timeout: 8000 });
      equal(await pv.$eval('[data-test=pv-fullscreen]', b => getComputedStyle(b).pointerEvents), 'none');
      await pv.mouse.move(300, 300); await pv.mouse.move(320, 330);
      equal(await pv.$eval('[data-test=pv-fullscreen]', b => b.classList.contains('is-faded')), false);
      equal(await pv.textContent('[data-test=pv-fullscreen]'), 'Full screen');
    });

    await check('refreshing the Player View reconnects and shows the same picture', async () => {
      const before = await pv.evaluate(() => [...document.querySelectorAll('.tsi-bpv-pill')].map(p => p.textContent).join('|'));
      await pv.reload();
      await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
      equal(await pv.evaluate(() => [...document.querySelectorAll('.tsi-bpv-pill')].map(p => p.textContent).join('|')), before);
      equal(await pv.isVisible('[data-test=pv-crest]'), true);
    });

    await check('an open facility panel is there again after a refresh', async () => {
      await page.click('[data-test=tile-dock]');
      await pv.waitForSelector('[data-test=pv-panel][data-fac=dock]');
      await pv.reload();
      await pv.waitForSelector('[data-test=pv-panel][data-fac=dock]', { timeout: 10000 });
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached' });
    });

    await check('the same button brings the same window forward instead of opening another', async () => {
      await pause(page);
      let extra = 0;
      context.on('page', () => { extra++; });
      await page.click('[data-test=open-player-view]');
      await page.waitForTimeout(500);
      equal(extra, 0);
    });

    await check('leaving the Bastion leaves the Player View open, with its last picture (more in player-view-keep-open.test.js)', async () => {
      await page.evaluate(() => { location.href = location.href.replace(/\?.*$/, ''); });
      await page.waitForSelector('.tsi-card');
      await page.waitForTimeout(1500);
      assert(!pv.isClosed(), 'the window stays');
      equal(await pv.isVisible('[data-test=pv-waiting]'), false, 'and still shows the map');
    });

    const bad = context.log.net.concat(context.log.failed, context.log.errors);
    await check('nothing went online, no file was missing, no errors', async () => { equal(bad.filter(x => !/ERR_ABORTED/.test(x)), []); });
    await context.close();
  }

  section('The window on its own, and reduced motion');
  {
    const context = await H.newContext(browser, 'tv');
    await context.setOffline(true);
    const pv = await context.newPage();
    await pv.emulateMedia({ reducedMotion: 'reduce' });
    await pv.goto(PLAYER);
    await check('with no DM it waits calmly, still and without a map or numbers', async () => {
      await pv.waitForSelector('[data-test=pv-waiting]');
      equal(await bare(pv, '[data-test=pv-waiting]'), 'Waiting for the DM...');
      equal(await pv.$eval('.tsi-bpv-waiting__text', n => getComputedStyle(n).animationName), 'none', 'no breathing with reduced motion');
      equal(await pv.isVisible('[data-test=pv-waiting]'), true);
    });
    await check('the Explorer view waits too', async () => {
      await pv.goto(H.fileUrl('player.html') + '?view=explorer');
      await pv.waitForSelector('[data-test=pv-waiting]');
      equal(await bare(pv, '[data-test=pv-waiting]'), 'Waiting for the DM...');
    });
    await context.close();
  }

  await browser.close();
  H.summary();
})();
