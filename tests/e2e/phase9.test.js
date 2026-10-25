/* Phase 9: The Ironbow Bastion Manager, clicked through from a double-clicked
   index.html with the internet off, at Harry's laptop size and on the TV.
   Since the days overhaul (8 October 2026) the Bastion follows the
   Explorer's day: these checks write the day into the Explorer's save, as
   Make Camp does, and the Bastion passes the days. (The side-by-side run
   against the old Bastion is retired: the rules now deliberately differ.
   The two windows together are checked in tests/e2e/bastion-days.test.js.)
   Run with:  node tests/e2e/phase9.test.js   (P9_ONLY=word runs only the
   sections whose names contain it) */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
/* P9_ONLY=word runs only the sections whose names contain it. */
const want = name => !process.env.P9_ONLY || name.toLowerCase().indexOf(process.env.P9_ONLY.toLowerCase()) !== -1;
const BASTION = INDEX + '?tool=bastion';

/* Before the page loads: seedable dice. window.__dice: the next values
   Math.random gives, before its usual ones (a test's own dice). */
function setup() {
  const native = Math.random;
  let base = native;
  window.__dice = [];
  Math.random = function () { return window.__dice.length ? window.__dice.shift() : base(); };
  window.__seed = function (a) {
    base = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
}

async function newPage(browser, size, extra, opts) {
  const context = await H.newContext(browser, size || 'laptop', Object.assign({ acceptDownloads: true }, extra || {}));
  await context.setOffline(true);
  await context.addInitScript(setup);
  const page = await context.newPage();
  panels(page);
  return { context, page };
}
/* Since the new screen (Build 2, 8 October 2026) most controls live in
   panels that open over the map. Before a check clicks, types into or
   reads a control, the panel holding it is opened by pressing that
   panel's own button (its tile in the facility grid, the Party Identity
   badge, or a button in the bottom bar), as Harry would: see
   TSI.bastion.debug.reveal. tests/e2e/bastion-screen.test.js checks the
   panels themselves. */
const DATA_TEST = /\[data-test="?([^"\]=]+)"?\]/;
async function reveal(page, selector) {
  const m = typeof selector === 'string' && DATA_TEST.exec(selector);
  if (!m) return false;
  return page.evaluate(t => { const d = window.TSI && TSI.bastion && TSI.bastion.debug; return !!(d && d.reveal && d.reveal(t)); }, m[1]).catch(() => false);
}
function panels(page) {
  ['click', 'dblclick', 'fill', 'selectOption', '$$eval', 'textContent', '$eval', 'check', 'uncheck', 'press', 'hover', 'focus', 'inputValue', 'getAttribute', 'isDisabled', 'isEnabled', 'innerText', 'waitForSelector', 'dispatchEvent', 'setInputFiles'].forEach(name => {
    const own = page[name].bind(page);
    page[name] = async (selector, ...rest) => { await reveal(page, selector); return own(selector, ...rest); };
  });
}
/* The treasury, in the map's top bar: saved when you press Enter. */
async function treasury(page, value) {
  await page.fill('[data-test=treasury]', String(value));
  await page.press('[data-test=treasury]', 'Enter');
  await page.waitForTimeout(80);
}
/* The Explorer's day, as the Bastion reads it from the Explorer's save. There's
   no Explorer window in these checks: the day is written into its save, as
   Make Camp does, and the Bastion is told to look at once (it looks every 2
   seconds anyway). */
async function setExplorerDay(page, day) {
  await page.evaluate(d => {
    const ex = TSI.store.get('tsi.explorer.save', null) || { tokens: [], travel: {}, grid: {} };
    ex.travel = Object.assign({}, ex.travel, { day: d });
    TSI.store.set('tsi.explorer.save', ex);
    TSI.bastion.debug.clock();
  }, day);
}
const explorerDay = page => page.evaluate(() => { const ex = TSI.store.get('tsi.explorer.save', null); return ex && ex.travel ? ex.travel.day : null; });
async function openBastion(page, opts) {
  await page.goto(BASTION);
  await page.waitForSelector('[data-test=day-status]');
  /* The Explorer on Day 1: the Bastion starts counting from it. */
  if (!opts || opts.anchor !== false) {
    await setExplorerDay(page, 1);
    await page.waitForFunction(() => TSI.bastion.debug.state().anchored);
  }
}
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
/* Change the Bastion directly to set up a check. fn is run in the page with the state. */
const setUp = (page, fn) => page.evaluate(src => TSI.bastion.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const text = (page, test) => page.textContent('[data-test="' + test + '"]');
const pause = page => page.waitForTimeout(400);
/* The pop-up on top that isn't a panel (a panel is a pop-up too, since Build 2). */
async function popText(page) {
  await page.waitForSelector('.tsi-modal:not(.tsi-bas-panel)', { timeout: 5000 });
  return page.$eval('.tsi-modal:not(.tsi-bas-panel)', m => m.textContent);
}
async function modalOpen(page) { return !!(await page.$('.tsi-modal:not(.tsi-bas-panel)')); }
/* Waits briefly for the pop-up: some open only after a file has been read. */
async function modalTitle(page) {
  await page.waitForSelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title', { timeout: 5000 }).catch(() => {});
  const m = await page.$('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'); return m ? m.textContent() : null;
}
async function clickModal(page, label) { await page.click('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button:text-is("' + label + '")'); await page.waitForTimeout(150); }
async function d20(page, v) {
  await page.waitForSelector('[data-test=d20]');
  await page.fill('[data-test=d20]', String(v));
  await clickModal(page, 'Continue');
}
/* Answer every pop-up: type the next roll into dice boxes, press the main button on the rest. */
async function answerAll(page, rolls) {
  rolls = (rolls || []).slice();
  for (let n = 0; n < 60; n++) {
    await page.waitForTimeout(150);
    if (!(await modalOpen(page))) return;
    if (await page.$('[data-test=d20]')) await d20(page, rolls.shift());
    else { await page.click('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button.tsi-btn--primary'); await page.waitForTimeout(150); }
  }
}
/* Pass n days (the Explorer making camp n times), answering every pop-up on
   the way: the next roll in a dice box, the main button on the rest (the
   results, and "The Ironbow sends word…" at the end). */
async function days(page, n, rolls) {
  rolls = (rolls || []).slice();
  const target = ((await explorerDay(page)) || 1) + n;
  await setExplorerDay(page, target);
  for (let k = 0; k < 600; k++) {
    await page.waitForTimeout(100);
    if (await modalOpen(page)) {
      if (await page.$('[data-test=d20]')) await d20(page, rolls.shift());
      else { await page.click('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button.tsi-btn--primary'); await page.waitForTimeout(120); }
      continue;
    }
    const passed = await page.evaluate(t => { const s = TSI.bastion.debug.state(); return s.day >= t && !s.dayInProgress && !TSI.bastion.debug.busy(); }, target);
    if (passed) { await page.waitForTimeout(150); if (!(await modalOpen(page))) return; }
  }
  throw new Error('the days didn\'t pass (the Bastion is on Day ' + (await st(page)).day + ', not ' + target + ')');
}
/* Close "The Ironbow sends word…" once it shows; resolves with its text. */
async function word(page) {
  await page.waitForSelector('[data-test=ironbow-word]', { timeout: 8000 });
  const t = await bare(page, '[data-test=ironbow-word]');
  await page.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary');
  await page.waitForFunction(() => !TSI.bastion.debug.busy());
  return t;
}
async function issue(page, fac, fn, idx) {
  await pause(page);
  if (idx !== undefined) await page.selectOption('[data-test="sel-' + fac + '__' + fn + '"]', String(idx));
  await page.click('[data-test="issue-' + fac + '__' + fn + '"]');
  await page.waitForTimeout(100);
}
/* A see-through PNG crest (a gold disc on nothing), like the Crest Creator's download. */
function crestPng(size) {
  const zlib = require('zlib');
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2, dy = y - size / 2;
      if (dx * dx + dy * dy < (size * 0.4) * (size * 0.4)) row.set([214, 178, 94, 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
function writeCrest(name, size) {
  const p = path.join(require('os').tmpdir(), 'tsi-p9-' + name);
  fs.writeFileSync(p, crestPng(size));
  return p;
}
const crestInfo = async page => (await reveal(page, '[data-test=crest]'), page.evaluate(() => {
  const i = document.querySelector('[data-test=crest]');
  return { shown: !!(i && i.offsetWidth), w: i ? i.naturalWidth : 0, h: i ? i.naturalHeight : 0, alt: i ? i.alt : '' };
}));

async function reopen(page) {
  await page.evaluate(() => TSI.store.flush());
  await page.reload();
  await page.waitForSelector('[data-test=day-status]');
}
/* The text of a part of the page. */
const bare = (page, sel) => page.$eval(sel, e => e.textContent);
async function bareModal(page) { await page.waitForSelector('.tsi-modal:not(.tsi-bas-panel)', { timeout: 5000 }); return bare(page, '.tsi-modal:not(.tsi-bas-panel)'); }
/* The facilities that could be built when this phase was written (the facilities overhaul, 13 October 2026, when the
   eight new ones were still in development; the Fishery, Timber Yard, Courier Exchange and, in pull request 7, the
   three creature buildings have opened since). */
const ALL_EXTRAS = ['beast_pen', 'herbal_gardens', 'temple', 'hall_of_emissaries'];

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  if (want('Opening it, and fitting Harry\'s screens (internet off)')) {
    section('Opening it, and fitting Harry\'s screens (internet off)');
    const { context, page } = await newPage(browser, 'laptop');
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');

    await check('the home card says Open; every tool is now built', async () => {
      const card = await page.textContent('.tsi-card[href*="bastion"]');
      assert(/Open/.test(card) && !/Coming/.test(card), card);
      equal(await page.$$eval('.tsi-card', cs => cs.filter(c => /Coming in phase/.test(c.textContent)).length), 0);
    });

    await check('it opens from its card on Day 1 (until the Explorer sets the day), level 7, with the two starting facilities in the grid (the Workshop and the Dock)', async () => {
      await page.click('.tsi-card[href*="bastion"]');
      await page.waitForSelector('[data-test=day-status]');
      equal(await text(page, 'day-status'), 'Day 1 · the Explorer sets the day');
      equal(await page.isHidden('[data-test=advance]'), true, 'no button to pass a day: the Explorer\'s Make Camp does that');
      equal(await page.inputValue('[data-test=level]'), '7');
      equal(await page.$$eval('.tsi-bas-tile', ts => ts.slice(0, 2).map(t => t.dataset.fac)), ['workshop', 'dock']);
      equal(await page.$$eval('.tsi-bas-tile--slot', ts => ts.length), 2, 'two slots to build in at level 7');
    });

    for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
      await check('fits ' + size + ' with no scrolling either way, the main controls in view', async () => {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(250);
        const lc = await H.layoutCheck(page, ['[data-test=day-status]', '[data-test=level]', '[data-test=treasury]', '[data-test=compendium]', '[data-test=download-save]', '[data-test=import-save]', '[data-test=map]', '[data-test=open-log]', '[data-test=open-war]', '.tsi-bas-tile']);
        equal(lc.scrollWidth, lc.clientWidth, 'no sideways scroll');
        equal(lc.outOfView, [], 'in view');
        equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, 'the page itself never scrolls down');
      });
    }
    await page.setViewportSize(H.SIZES.laptop.viewport);
    await H.shot(page, 'p9-01-laptop');

    await check('every facility picture, the new map and its ten overlays load with no internet; every label fits on the painting, none over another', async () => {
      /* (The Courier Exchange is put on a plot by hand, as it can't be built yet, to check its overlay and label beside the Temple's.) */
      await setUp(page, (s) => {
        s.partyLevel = 17;
        s.builtExtras = ['beast_pen', 'temple', 'hall_of_emissaries'].map(id => ({ facId: id, status: 'built' }));
        s.builtPlots = ['herbal_gardens', 'fishery_smokehouse', 'timber_sawmill', 'courier_exchange'].map(id => ({ facId: id, status: 'built' }));
      });
      await page.waitForFunction(() => Array.from(document.images).every(i => i.complete));
      /* (The Fishery's and Timber Yard's tiles are cut from their map pictures, as backgrounds, until Harry paints tiles for them.) */
      const imgs = await page.$$eval('img.tsi-bas-tile__img, .tsi-bas-map__overlay, .tsi-bas-map__img', is => is.map(i => [i.getAttribute('src').split('/').pop(), i.naturalWidth]));
      equal(imgs.filter(i => !i[1]), [], 'all loaded');
      equal(await page.$$eval('[data-test=tile-fishery_smokehouse] [data-art=crop], [data-test=tile-timber_sawmill] [data-art=crop]', cs => cs.length), 2, 'the two crops');
      equal(await page.$$eval('.tsi-bas-tile--built', ts => ts.length), 9, 'every facility that can be built has a tile, the Hall and the Temple too (the Temple is one tile for the three Shrines)');
      equal(await page.$$eval('[data-test=grid-plots] .tsi-bas-tile--built', ts => ts.map(t => t.dataset.fac)), ['herbal_gardens', 'fishery_smokehouse', 'timber_sawmill', 'courier_exchange'], 'the production facilities on the plots, in the row below');
      equal(await page.$eval('.tsi-bas-map__img', i => [i.naturalWidth, i.naturalHeight]), [3000, 1250], 'Harry\'s new painting');
      equal(await page.$$eval('.tsi-bas-map__overlay', os => os.map(o => o.dataset.fac)), ['herbal_gardens', 'hall_of_emissaries', 'temple', 'temple', 'temple', 'beast_pen', 'fishery_smokehouse', 'timber_sawmill', 'courier_exchange'], 'the Temple draws the three Shrine buildings; nothing for the war game\'s facilities, which are gone');
      equal(await page.$$eval('.tsi-bas-map__overlay', os => os.map(o => o.naturalWidth + 'x' + o.naturalHeight)), Array(9).fill('3000x1250'));
      equal((await H.layoutCheck(page, ['.tsi-bas-tile'])).scrollWidth, H.SIZES.laptop.viewport.width, 'no sideways scroll');
      for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(250);
        const m = await page.evaluate(() => {
          const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
          const map = box(document.querySelector('[data-test=map]'));
          const badge = box(document.querySelector('[data-test=identity-badge]'));
          const tray = box(document.querySelector('[data-test=grid-tray]'));
          const ls = Array.from(document.querySelectorAll('.tsi-bas-maplabel')).map(l => Object.assign({ fac: l.dataset.fac }, box(l)));
          const hit = (a, b) => a.x < b.right - 1 && b.x < a.right - 1 && a.y < b.bottom - 1 && b.y < a.bottom - 1;
          const clash = [];
          ls.forEach((a, i) => ls.slice(i + 1).forEach(b => { if (hit(a, b)) clash.push(a.fac + '/' + b.fac); }));
          /* All fourteen tiles (two starting facilities, six slots and six plots, built or empty) whole and square inside the grid. */
          const grid = box(document.querySelector('[data-test=grid]'));
          const tiles = Array.from(document.querySelectorAll('[data-test=grid] .tsi-bas-tile')).map(t => Object.assign({ t: t.dataset.test }, box(t)));
          const cut = tiles.filter(t => t.x < grid.x - 0.5 || t.right > grid.right + 0.5 || t.y < grid.y - 0.5 || t.bottom > grid.bottom + 0.5 || Math.abs((t.right - t.x) - (t.bottom - t.y)) > 1 || t.right - t.x < 40).map(t => t.t);
          return {
            tiles: tiles.length, cut,
            n: ls.length, clash,
            off: ls.filter(l => l.x < map.x - 1 || l.right > map.right + 1 || l.y < map.y - 1 || l.bottom > map.bottom + 1).map(l => l.fac),
            onBadge: ls.filter(l => hit(l, badge)).map(l => l.fac),
            onTray: ls.filter(l => hit(l, tray)).map(l => l.fac)
          };
        });
        equal(m, { tiles: 14, cut: [], n: 12, clash: [], off: [], onBadge: [], onTray: [] }, size + ': fourteen whole, square tiles (two starting facilities, six slots and six plots); twelve labels (one for each facility built, the Temple\'s at each of its three buildings), each clear of the others, the badge and the tray');
        await H.shot(page, 'p9-02-everything-built-' + size);
      }
      await page.setViewportSize(H.SIZES.laptop.viewport);
    });

    await check('nothing reached for the internet, and nothing failed', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });

    await check('the TV: the same screen, with a bigger painting', async () => {
      await page.setViewportSize(H.SIZES.tv.viewport);
      await page.waitForTimeout(250);
      const w = await page.evaluate(() => document.querySelector('.tsi-bas-map').getBoundingClientRect().width);
      assert(w > 1100, 'the painting is ' + w + ' wide');
      await H.shot(page, 'p9-03-tv');
      await page.setViewportSize(H.SIZES.laptop.viewport);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('Construction slots')) {
    section('Construction slots');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    const slotsOpen = () => page.$$eval('.tsi-bas-tile--slot', ts => ts.length);
    /* Build through the grid: an empty slot, the facility, then Construct. */
    async function construct(slot, facId) {
      await pause(page);
      await page.click('[data-test=slot-' + slot + ']');
      await page.waitForSelector('[data-test=build-' + facId + ']');
      await page.click('[data-test=build-' + facId + ']');
      await clickModal(page, 'Construct');
      await page.waitForFunction(() => !TSI.bastion.debug.panel());
    }

    await check('slots open to build by party level: 0 / 2 / 4 / 5 / 6', async () => {
      const out = [];
      for (const lvl of ['4', '5', '9', '13', '17']) {
        await page.selectOption('[data-test=level]', lvl);
        await page.waitForTimeout(80);
        out.push(await slotsOpen());
      }
      equal(out, [0, 2, 4, 5, 6]);
    });

    await check('locked facilities stay listed but can\'t be picked', async () => {
      await page.selectOption('[data-test=level]', '7');
      await pause(page);
      await page.click('[data-test=slot-0]');
      await page.waitForSelector('[data-test=build-temple]');
      equal(await page.getAttribute('[data-test=build-temple]', 'aria-disabled'), 'true');
      assert(/Locked: level 8/.test(await text(page, 'build-temple')));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.selectOption('[data-test=level]', '9');
      await pause(page);
      await page.click('[data-test=slot-0]');
      await page.waitForSelector('[data-test=build-hall_of_emissaries]');
      equal(await page.getAttribute('[data-test=build-hall_of_emissaries]', 'aria-disabled'), null);
      assert(/Party level 9: 4 construction slots, 0 in use\./.test(await text(page, 'build-panel')));
    });

    await check('the build panel shows what a facility does, and how long it takes to build, on hover', async () => {
      await page.hover('[data-test=build-beast_pen]');
      await page.waitForFunction(() => /Beast Pen/.test(document.querySelector('[data-test=tooltip]').textContent));
      const tip = await text(page, 'tooltip');
      assert(/Beast Pen/.test(tip) && /What it does/.test(tip) && /Takes 21 days to build/.test(tip), tip);
      await page.keyboard.press('Escape');
      await page.mouse.move(5, 400);
    });

    await check('building takes 21 days (none takes 28 since the overhaul, and the Menagerie\'s 35 went on 22 October 2026), then the facility joins the grid and the map', async () => {
      await construct(0, 'hall_of_emissaries');
      await page.selectOption('[data-test=level]', '13');
      await page.waitForTimeout(80);
      await construct(1, 'beast_pen');
      equal(await page.$$eval('.tsi-bas-tile--building', ts => ts.map(t => [t.dataset.test, t.textContent])), [['tile-hall_of_emissaries', '21'], ['tile-beast_pen', '21']]);
      equal((await st(page)).builtExtras.slice(0, 2), [{ facId: 'hall_of_emissaries', status: 'building', startDay: 1, readyDay: 22 }, { facId: 'beast_pen', status: 'building', startDay: 1, readyDay: 22 }]);
      await pause(page);
      await page.click('[data-test=slot-2]');
      await page.waitForSelector('[data-test=build-panel]');
      equal(await page.$('[data-test=build-hall_of_emissaries]'), null, 'no longer offered');
      await page.keyboard.press('Escape');
      await days(page, 20, []);
      equal(await text(page, 'tile-hall_of_emissaries'), '1', 'Day 21: one day to go');
      await days(page, 1, []);
      equal(await page.$eval('[data-test=tile-hall_of_emissaries]', t => [t.tagName, t.classList.contains('tsi-bas-tile--built')]), ['BUTTON', true]);
      equal(await page.$$eval('.tsi-bas-map__overlay', os => os.map(o => o.dataset.fac)), ['hall_of_emissaries', 'beast_pen'], 'the Beast Pen was built beside it, and is finished on the same day');
      assert((await st(page)).log.some(l => l.title === 'Construction Complete' && l.body === 'Hall of Emissaries is now built and active.'));
    });

    await check('lowering the level keeps every building, marked over capacity (BAS-04, B8)', async () => {
      await construct(2, 'temple');
      await page.selectOption('[data-test=level]', '5');
      await page.waitForTimeout(100);
      equal(await page.$$eval('[data-test=over-capacity]', os => os.length), 1);
      equal(await slotsOpen(), 0, 'no room to build');
      await pause(page);
      await page.click('[data-test=facilities-count]');
      assert(/Party level 5: 2 construction slots, 3 in use \(1 over capacity\)\. 0 Development Plots, 0 in use\. There's no free slot/.test(await text(page, 'build-panel')), await text(page, 'build-panel'));
      await page.keyboard.press('Escape');
      equal((await st(page)).builtExtras.filter(Boolean).length, 3);
      await reopen(page);
      await page.selectOption('[data-test=level]', '9');
      await page.waitForTimeout(100);
      equal(await page.$$eval('[data-test=over-capacity]', os => os.length), 0);
      await H.shot(page, 'p9-04-slots');
    });

    await check('a production facility goes on a Development Plot (pull request 3): the Timber Yard builds on plot 0 in 21 days, never in a construction slot', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      await pause(page);
      await page.click('[data-test=plot-0]');
      await page.waitForSelector('[data-test=build-timber_sawmill]');
      equal(await page.getAttribute('[data-test=build-timber_sawmill]', 'aria-disabled'), null);
      await page.click('[data-test=build-timber_sawmill]');
      await clickModal(page, 'Construct');
      await page.waitForFunction(() => !TSI.bastion.debug.panel());
      const s = await st(page);
      equal(s.builtPlots[0], { facId: 'timber_sawmill', status: 'building', startDay: s.day, readyDay: s.day + 21 });
      equal(s.builtExtras.filter(Boolean).length, 3, 'no construction slot used');
      await pause(page);
      await page.click('[data-test=facilities-count]');
      await page.waitForSelector('[data-test=clear-builds]');
    });

    await check('Clear extra builds asks first; Cancel keeps them; Clear empties the slots and the Development Plots', async () => {
      await page.click('[data-test=clear-builds]');
      assert(/\(slots and Development Plots\) only\? Your starting facilities \(the Workshop and the Dock\) remain/.test(await popText(page)));
      await clickModal(page, 'Cancel');
      equal((await st(page)).builtExtras.filter(Boolean).length, 4);
      await page.waitForTimeout(400);
      await page.click('[data-test=clear-builds]');
      await clickModal(page, 'Clear');
      const s = await st(page);
      equal([s.builtExtras.filter(Boolean).length, s.builtPlots.filter(Boolean).length], [0, 0]);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('Orders')) {
    section('Orders');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await treasury(page, '1000');

    await check('an order charges its gold once, even on a double click', async () => {
      await page.selectOption('[data-test="sel-dock__charter_berth"]', '1');
      await page.dblclick('[data-test="issue-dock__charter_berth"]');
      await page.waitForTimeout(300);
      equal(await modalOpen(page), false);
      const s = await st(page);
      equal([s.treasuryGP, s.pendingOrders.map(o => o.label)], [800, ['Dock: Charter Berth (Longship)']]);
      assert(/Due Day 8 \(in 7 days\)/.test(await text(page, 'pending')), await text(page, 'pending'));
      equal(await text(page, 'days-dock__charter_berth'), 'Takes 7 days');
    });

    await check('the same order again, or one you can\'t afford, is refused with a message', async () => {
      await issue(page, 'dock', 'charter_berth');
      equal(await popText(page).then(t => /That order is already pending\./.test(t)), true);
      await clickModal(page, 'OK');
      await pause(page);
      await page.click('[data-test=cancel-0]');
      await treasury(page, '50');
      await issue(page, 'dock', 'charter_berth');
      assert(/Not enough gp\. Need 200gp, you have 50gp\./.test(await popText(page)));
      await clickModal(page, 'OK');
      equal((await st(page)).pendingOrders.length, 0, 'nothing was ordered');
    });

    await check('cancelling keeps the gold spent (B9, kept)', async () => {
      await treasury(page, '500');
      await issue(page, 'dock', 'charter_berth');
      equal((await st(page)).treasuryGP, 300);
      await pause(page);
      await page.click('[data-test=cancel-0]');
      const s = await st(page);
      equal([s.treasuryGP, s.pendingOrders.length, s.log[0].body], [300, 0, 'Cancelled an order.']);
    });

    await check('orders complete on their days: the ship is in the warehouse on Day 8', async () => {
      await issue(page, 'dock', 'charter_berth');
      await page.evaluate(() => window.__seed(4));
      await days(page, 5, []);
      equal((await st(page)).pendingOrders.map(o => o.label), ['Dock: Charter Berth (Longship)'], 'Day 6: still on its way');
      await days(page, 2, []);
      const s = await st(page);
      equal(s.pendingOrders, []);
      assert(s.warehouse.some(w => w.item === 'Longship' && w.notes === 'Dock'), JSON.stringify(s.warehouse));
      assert(/Dock: Charter Berth \(Longship\) → Added to Warehouse\./.test(s.log.map(l => l.body).join('|')));
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('Passing days (BAS-02, BAS-03, BAS-10, BAS-12, BAS-13)')) {
    section('Passing days (BAS-02, BAS-03, BAS-10, BAS-12, BAS-13)');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await setUp(page, (s) => { s.partyLevel = 9; s.treasuryGP = 5000; s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }, '', '', '']; });

    await check('the Bastion follows the Explorer\'s day: Day 4 there, and the Bastion passes Days 2 to 4', async () => {
      equal(await text(page, 'day-status'), 'Day 1');
      await days(page, 3, []);
      equal(await text(page, 'day-status'), 'Day 4');
      equal(await text(page, 'day-status'), 'Day 4');
      equal((await st(page)).dayInProgress, null);
    });

    await check('looking at the Explorer\'s day twice at once passes each day once (BAS-12)', async () => {
      await setUp(page, (s) => { s.pendingOrders.push({ id: 'p1', facId: 'dock', fnId: 'charter_berth', chosen: { label: 'Longship' }, optionLabel: 'Longship', notes: '', label: 'Dock: Charter Berth (Longship)', costGP: 0, issuedDay: 1, dueDay: 5 }); });
      await page.evaluate(() => {
        const ex = TSI.store.get('tsi.explorer.save', null);
        ex.travel.day = 5;
        TSI.store.set('tsi.explorer.save', ex);
        TSI.bastion.debug.clock(); TSI.bastion.debug.clock(); TSI.bastion.debug.clock();
      });
      await word(page);
      const s = await st(page);
      equal(s.day, 5);
      equal(s.log.filter(l => /Dock: Charter Berth \(Longship\) → Added to Warehouse\./.test(l.body)).length, 1, 'the order completed once');
      equal(s.warehouse.filter(w => w.item === 'Longship' && w.notes === 'Dock').reduce((n, w) => n + w.qty, 0), 1, 'and one ship came');
    });

    /* The Hall's actions were the only orders that asked for a typed d20 inside a day (the War Council's War Actions the
       other), so the checks that paused a day on a dice box (Enter and Space can't start anything else, BAS-10; a
       cancelled roll keeps the order due with Resolve, BAS-02 and BAS-13; closing the window mid-day, BAS-02) went with
       them in step S09 (Strip Back Overhaul, 22 October 2026): see docs/strip-back/S08-S09-known-issues-draft.md. */

    await check('Day 29 passes like any other day: no Bastion event is rolled and there is no Events button (S05)', async () => {
      equal(await page.$('[data-test=open-events]'), null, 'no Events button in the bottom bar');
      equal(await page.$('[data-test=event]'), null, 'no event box');
      await page.evaluate(() => window.__seed(12));
      await days(page, 29 - (await st(page)).day, []);
      equal(await text(page, 'day-status'), 'Day 29');
      const s = await st(page);
      equal('lastEvent' in s || 'lastEventDay' in s, false, 'the Bastion keeps no event record');
      assert(!s.log.some(l => /Auto event|Bastion Event/.test(l.title + ' ' + l.body)), 'nothing in the Day Log: ' + JSON.stringify(s.log.slice(0, 2)));
      assert(JSON.stringify(s.word).indexOf('Bastion event') === -1, 'and no word from the Ironbow about one');
    });

    await check('Reset Travel in the Explorer moves every Bastion day back, and the log says so', async () => {
      await issue(page, 'dock', 'charter_berth', 0);
      const before = await st(page);
      equal([before.day, before.pendingOrders[0].dueDay], [29, 36]);
      await setExplorerDay(page, 1);
      await page.waitForFunction(() => TSI.bastion.debug.state().day === 1);
      const s = await st(page);
      equal(s.pendingOrders[0].dueDay, 8, 'still 7 days off');
      equal(s.log[0].body, 'The Explorer\'s day went back (Reset Travel): the Bastion moves from Day 29 to Day 1, and everything due keeps its days.');
      equal(await text(page, 'day-status'), 'Day 1');
    });

    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('The Hall of Emissaries')) {
    section('The Hall of Emissaries');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await treasury(page, '5000');

    await check('before it\'s built it has no tile, and the build panel offers it', async () => {
      equal(await page.$('[data-test=tile-hall_of_emissaries]'), null);
      await page.click('[data-test=slot-0]');
      await page.waitForSelector('[data-test=build-hall_of_emissaries]');
      equal(await text(page, 'build-hall_of_emissaries'), 'Hall of Emissaries21 days', 'open from party level 5, 21 days to build');
      await page.keyboard.press('Escape');
    });

    await setUp(page, (s) => { s.partyLevel = 9; s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }, '', '', '']; });

    await check('its tile opens the Hall of Emissaries: one level, no orders, no Upgrade; the Clans\' scores to read and the Diplomatic Events (step S09)', async () => {
      await page.click('[data-test=tile-hall_of_emissaries]');
      await page.waitForSelector('[data-test=panel-diplomacy] [data-test=hall]');
      equal(await text(page, 'hall-level'), 'One level only');
      equal(await page.$$('[data-test^="issue-hall_of_emissaries__"], [data-test=hall-upgrade]').then(l => l.length), 0, 'no orders and no Upgrade');
      equal(await page.$$eval('[data-test=clan-relations] .tsi-bas-rel__row', r => r.length), 7);
      assert(/Diplomatic Events/.test(await text(page, 'dip-records-ledger')));
      equal([(await st(page)).treasuryGP, (await st(page)).pendingOrders.length], [5000, 0]);
      await page.keyboard.press('Escape');
    });

    await check('days pass with nothing from the Hall: no shipment, no roll, no word, no Diplomacy line in the Day Log', async () => {
      const gp = (await st(page)).treasuryGP;
      await days(page, 7, []);
      const s = await st(page);
      equal(s.treasuryGP, gp);
      equal(s.log.filter(l => l.title === 'Diplomacy').length, 0);
      equal(s.word.length, 0);
    });

    await check('Demolish… is in the Hall\'s panel and asks first', async () => {
      await pause(page);
      await page.click('[data-test=tile-hall_of_emissaries]');
      await page.waitForSelector('[data-test=demolish-hall_of_emissaries]');
      await page.click('[data-test=demolish-hall_of_emissaries]');
      const said = await popText(page);
      assert(/Demolish the Hall of Emissaries\?/.test(said) && !/agreements, contracts and sea routes/.test(said), said);
      await clickModal(page, 'Cancel');
      equal((await st(page)).builtExtras.filter(e => e && e.facId === 'hall_of_emissaries').length, 1);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('Party identity')) {
    section('Party identity (a Party Name, no Clan)');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);

    await check('Honour/Respect edits change support at once (the Clan Influence panel)', async () => {
      await page.fill('[data-test=hr-karr]', '2');
      await page.press('[data-test=hr-karr]', 'Tab');
      equal(await text(page, 'support-karr'), '58/100');
      equal((await st(page)).honourRespectByClan.karr, 2);
    });

    await check('a party can no longer found a Clan: the Party Identity panel has a Party Name, the crest and its buttons, and no Form Clan, Clan Honour or Unsworn (22 October 2026)', async () => {
      await page.click('[data-test=identity-badge]');
      await page.waitForSelector('[data-test=panel-identity]');
      equal(await page.$('[data-test=form-clan]'), null);
      equal(await page.$('[data-test=honour-box]'), null);
      equal(await page.$('[data-test=org]'), null);
      equal(await page.isVisible('[data-test=party-name]'), true);
      equal(await page.textContent('[data-test=crest-add]'), 'Upload a picture…');
      assert(!/Unsworn|Form Clan|Found a Clan|Clan Honour|Clan requirements/.test(await bare(page, '[data-test=panel-identity]')), await bare(page, '[data-test=panel-identity]'));
      await page.keyboard.press('Escape');
      equal(await page.$('[data-test=panel-identity]'), null);
    });

    await check('a Party Name is typed in the panel (Enter saves it) and shows above the crest', async () => {
      await page.click('[data-test=identity-badge]');
      await page.fill('[data-test=party-name]', 'The Ironbow Company');
      await page.press('[data-test=party-name]', 'Enter');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === 'The Ironbow Company');
      equal(await text(page, 'party-name-shown'), 'The Ironbow Company');
      await page.keyboard.press('Escape');
    });

    await check('a crest can be added later, shrunk to 512 pixels, shown under the Party Name, kept after reopening, and removed', async () => {
      await page.click('[data-test=identity-badge]');
      await H.chooseFile(page, '[data-test=crest-add]', writeCrest('crest-later.png', 2048));
      await page.waitForFunction(() => { const i = document.querySelector('[data-test=crest]'); return i && i.offsetWidth && i.naturalWidth; });
      const c = await crestInfo(page);
      equal([c.shown, c.w, c.h, c.alt], [true, 512, 512, 'Crest of The Ironbow Company']);
      const saved = await page.evaluate(() => TSI.store.get('tsi.bastion.crest'));
      assert(/^data:image\/(webp|png);base64,/.test(saved.dataUrl) && saved.dataUrl.length < 700000 && saved.name === 'tsi-p9-crest-later.png', JSON.stringify([saved.dataUrl.slice(0, 30), saved.dataUrl.length, saved.name]));
      /* The name is directly above the crest, in the same column. */
      const box = await page.evaluate(() => {
        const a = document.querySelector('[data-test=crest]').getBoundingClientRect();
        const b = document.querySelector('[data-test=party-name-shown]').getBoundingClientRect();
        return { gap: a.top - b.bottom, overlapX: Math.min(a.right, b.right) - Math.max(a.left, b.left) };
      });
      assert(box.gap >= -1 && box.gap < 40 && box.overlapX > 0, JSON.stringify(box));
      await reopen(page);
      equal((await crestInfo(page)).w, 512);
      await pause(page);
      await page.click('[data-test=crest-delete]');
      await clickModal(page, 'Cancel');
      equal((await crestInfo(page)).shown, true);
      await pause(page);
      await page.click('[data-test=crest-delete]');
      await clickModal(page, 'Remove');
      equal(await page.evaluate(() => document.activeElement.dataset.test), 'crest-add', 'Remove has gone, so the focus stays in the panel, on Upload');
      equal((await crestInfo(page)).shown, false);
      equal(await page.evaluate(() => TSI.store.has('tsi.bastion.crest')), false);
      await H.shot(page, 'p9-crest-none');
    });

    await check('the Party Name and the Hall\'s history survive reopening (BAS-01)', async () => {
      await setUp(page, (s) => { s.legacyDiplomacy = { records: [{ kind: 'Trade Agreement', title: 'Trade Agreement', clan: 'Clan Karr', startDay: 1, endDay: s.day + 21, endedDay: s.day, income: 90, shipments: 3, paid: 270, note: '' }] }; });
      const before = await st(page);
      await reopen(page);
      const after = await st(page);
      ['partyName', 'honourRespectByClan', 'diplomacy', 'legacyDiplomacy', 'politicalCapital'].forEach(k => equal(after[k], before[k], k));
      equal(after.partyName, 'The Ironbow Company');
      equal(await page.$eval('[data-test=badge-name]', n => n.textContent), 'The Ironbow Company');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('The crest, at any time (Build 3)')) {
    section('The crest, at any time (Build 3)');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await setUp(page, (s) => { s.partyLevel = 7; });
    const crestKey = () => page.evaluate(() => { const c = TSI.store.get('tsi.bastion.crest', null); return c ? c.key : null; });
    /* What the badge shows: the Party Name above the crest (or nothing), "Add a crest" only while there is no crest, and what it says aloud. */
    const badge = () => page.evaluate(() => {
      const b = document.querySelector('[data-test=identity-badge]');
      const img = b.querySelector('img');
      const name = b.querySelector('.tsi-bas-badge__name');
      const label = b.querySelector('.tsi-bas-badge__label');
      return { name: name.hidden ? '' : name.textContent, label: label.hidden ? '' : label.textContent, aria: b.getAttribute('aria-label'), img: !img.hidden && !!img.naturalWidth, empty: b.classList.contains('tsi-bas-badge--empty') };
    });

    await check('with no crest, the badge says "Add a crest"; Party Identity has a Party Name box, a faint shield and the crest\'s buttons, and nothing about a Clan or a Brigade', async () => {
      equal(await badge(), { name: '', label: 'Add a crest', aria: 'Crest of the Ironbow: no crest yet. Open Party Identity.', img: false, empty: true });
      await page.click('[data-test=identity-badge]');
      await page.waitForSelector('[data-test=panel-identity]');
      equal(await page.isVisible('[data-test=crest-empty]'), true);
      equal([await page.textContent('[data-test=crest-create]'), await page.textContent('[data-test=crest-add]'), await page.isVisible('[data-test=crest-delete]')], ['Create in the Clan Crest Creator ↗', 'Upload a picture…', false]);
      equal([await page.isVisible('[data-test=party-name]'), await page.$('[data-test=form-box]'), await page.$('[data-test=honour-box]'), await page.$('[data-test=org]'), await page.$('[data-test=requirements]')], [true, null, null, null, null]);
      equal(await page.$('[data-test=form-merc]'), null);
      equal(await page.$('[data-test=trust-box]'), null);
      assert(!/Brigade|Merc|Unsworn|Form Clan/.test(await page.evaluate(() => document.body.textContent)), 'no Brigade, Unsworn or Form Clan on the page');
      await H.shot(page, 'p9-identity-no-crest');
      await page.keyboard.press('Escape');
    });

    let creator = null;
    await check('Create in the Clan Crest Creator ↗ opens the Creator in a new window, with no "Already open" warning; again, it says it\'s open', async () => {
      await pause(page);
      const [tab] = await Promise.all([context.waitForEvent('page'), page.click('[data-test=crest-create]')]);
      creator = tab;
      await creator.waitForSelector('[data-test=use-for-bastion]');
      assert(/index\.html\?tool=crest$/.test(creator.url()), creator.url());
      await creator.waitForTimeout(1500);
      const warned = async p => (await H.noticeTexts(p)).some(t => /Already open/.test(t));
      equal([await warned(creator), await warned(page)], [false, false]);
      equal(await text(page, 'crest-status'), 'The Clan Crest Creator opened in a new window: design your crest, then press Use for the Bastion there.');
      const before = context.pages().length;
      await page.waitForTimeout(1600);
      await page.click('[data-test=crest-create]');
      await page.waitForFunction(() => /already open in another window/.test(document.querySelector('[data-test=crest-status]').textContent));
      equal((await H.layoutCheck(page, ['[data-test=crest-status]'])).outOfView, [], 'in the panel, where it can be seen (a corner notice would be under the panel\'s backdrop)');
      await page.waitForTimeout(400);
      equal(context.pages().length, before, 'no second Creator');
    });

    await check('Use for the Bastion: the Bastion asks at once, showing the crest; No leaves the Bastion as it was and asks no more', async () => {
      await creator.click('[data-test=use-for-bastion]');
      await creator.waitForFunction(() => /Crest sent to the Bastion\..*The Bastion's window asks whether to use it\./.test(document.body.textContent));
      await page.waitForSelector('[data-test=crest-offer]', { timeout: 5000 });
      assert(/Use this crest for the Bastion\?/.test(await popText(page)));
      equal(await page.$eval('[data-test=crest-offer-img]', i => [i.naturalWidth, i.naturalHeight]), [512, 512]);
      await H.shot(page, 'p9-crest-offer');
      await clickModal(page, 'No');
      equal(await crestKey(), null);
      equal(await page.evaluate(() => TSI.handoff.read('crest')), null, 'answered, so it\'s cleared');
      await page.waitForTimeout(2500);
      equal(await modalOpen(page), false, 'not asked again');
    });

    await check('sent again and used: it\'s the Bastion\'s crest, with the Creator\'s design, on the badge and in Party Identity', async () => {
      await creator.fill('#tsi-crest-field-clan-name', 'Wardens of the Ironbow');
      await creator.click('[data-test=use-for-bastion]');
      await page.waitForSelector('[data-test=crest-offer]', { timeout: 5000 });
      await clickModal(page, 'Use this crest');
      const c = await page.evaluate(() => TSI.store.get('tsi.bastion.crest'));
      equal([c.name, c.design.clanName, Object.keys(c.design).length > 20, /^data:image\/png;base64,/.test(c.dataUrl)], ['Wardens of the Ironbow (Crest Creator).png', 'Wardens of the Ironbow', true, true]);
      await page.waitForFunction(() => { const i = document.querySelector('[data-test=identity-badge] img'); return i && !i.hidden && i.naturalWidth; });
      equal(await badge(), { name: '', label: '', aria: 'Crest of the Ironbow. Open Party Identity.', img: true, empty: false });
      const info = await crestInfo(page);
      equal([info.shown, info.w, info.alt], [true, 512, 'Crest of the Ironbow']);
      equal([await page.textContent('[data-test=crest-add]'), await page.isVisible('[data-test=crest-delete]')], ['Upload another…', true]);
      await page.keyboard.press('Escape');
      await creator.close();
      creator = null;
    });

    await check('a crest sent while the Bastion is shut is asked about when it next opens', async () => {
      await page.evaluate(() => TSI.store.flush());
      const other = await context.newPage();
      await other.goto(H.fileUrl('index.html') + '?tool=crest');
      await other.waitForSelector('[data-test=use-for-bastion]');
      await page.goto(H.fileUrl('index.html'));
      await page.waitForSelector('[data-test=backup-everything]');
      await other.click('[data-test=random-crest]');
      await other.click('[data-test=use-for-bastion]');
      await other.waitForFunction(() => /The Bastion asks whether to use it when you next open it\./.test(document.body.textContent));
      equal(await other.isVisible('.tsi-notice button:text-is("Open the Bastion ↗")'), true);
      await other.close();
      const key = await crestKey();
      /* The party made camp twice meanwhile. */
      const day0 = await page.evaluate(() => { const b = TSI.store.get('tsi.bastion.state', null); return b.day; });
      await page.evaluate(d => { const ex = TSI.store.get('tsi.explorer.save', null) || { tokens: [], travel: {}, grid: {} }; ex.travel = Object.assign({}, ex.travel, { day: d }); TSI.store.set('tsi.explorer.save', ex); return TSI.store.flush(); }, day0 + 2);
      await page.goto(H.fileUrl('index.html') + '?tool=bastion');
      await page.waitForSelector('[data-test=crest-offer]', { timeout: 8000 });
      assert(/It replaces the crest the Bastion has now\./.test(await popText(page)));
      await page.waitForTimeout(4500);
      equal((await st(page)).day, day0, 'no day passes while the question is open');
      await clickModal(page, 'No');
      equal(await crestKey(), key, 'kept');
      await page.waitForFunction(d => { const s = TSI.bastion.debug.state(); return s.day === d && !s.dayInProgress && !TSI.bastion.debug.busy(); }, day0 + 2, { timeout: 10000 });
    });

    /* Since pull request 4 of the facilities overhaul, a second Bastion
       window waits (one window per campaign tool), so it's never asked. */
    await check('a crest that isn\'t a picture is never offered; a second Bastion window waits, and is never asked', async () => {
      const key = await crestKey();
      await page.evaluate(() => TSI.handoff.write('crest', { id: 'crest-bad', at: 1, name: 'Bad', dataUrl: 'data:image/png;base64,SGVsbG8gd29ybGQ=' }));
      await page.waitForFunction(() => TSI.handoff.read('crest') === null, null, { timeout: 6000 });
      equal(await modalOpen(page), false, 'not offered');
      equal(await crestKey(), key);
      const second = await context.newPage();
      await second.goto(H.fileUrl('index.html') + '?tool=bastion');
      await second.waitForSelector('[data-test=tool-waiting]');
      const writer = await context.newPage();
      await writer.goto(H.fileUrl('index.html'));
      await writer.waitForSelector('[data-test=backup-everything]');
      await writer.evaluate(() => {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const g = c.getContext('2d'); g.fillStyle = '#d6b25e'; g.fillRect(4, 4, 24, 24);
        TSI.handoff.write('crest', { id: 'crest-two', at: 1, name: 'Two windows', dataUrl: c.toDataURL('image/png') });
      });
      await page.waitForSelector('[data-test=crest-offer]', { timeout: 6000 });
      equal(await second.$('[data-test=crest-offer]'), null, 'the waiting window isn\'t asked');
      await clickModal(page, 'No');
      equal(await crestKey(), key, 'nothing taken');
      /* Sent again and taken in this window: the other one's question closes, and it shows the new crest. */
      await writer.evaluate(() => {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const g = c.getContext('2d'); g.fillStyle = '#b1122a'; g.fillRect(2, 2, 28, 28);
        TSI.handoff.write('crest', { id: 'crest-two-b', at: 2, name: 'Two windows again', dataUrl: c.toDataURL('image/png') });
      });
      await page.waitForSelector('[data-test=crest-offer]', { timeout: 6000 });
      await clickModal(page, 'Use this crest');
      const taken = await crestKey();
      assert(taken && taken !== key, 'taken');
      equal(await second.$('[data-test=crest-offer]'), null);
      equal(await second.evaluate(() => !!(TSI.bastion && TSI.bastion.debug)), false, 'still waiting: none of the Bastion runs there');
      await writer.close();
      await second.close();
      await page.waitForTimeout(500);
    });

    await check('a refused file is explained; a picture can be uploaded from the panel, replacing the Creator\'s', async () => {
      await H.chooseFile(page, '[data-test=crest-add]', H.writeTemp('not-a-crest.txt', 'hello'));
      await page.waitForFunction(() => /PNG, JPG, WebP or GIF/.test(document.body.textContent));
      await clickModal(page, 'OK');
      await H.chooseFile(page, '[data-test=crest-add]', writeCrest('crest-upload.png', 1200));
      await page.waitForFunction(() => { const c = TSI.store.get('tsi.bastion.crest', null); return c && c.name === 'tsi-p9-crest-upload.png'; });
      const c = await page.evaluate(() => TSI.store.get('tsi.bastion.crest'));
      equal('design' in c, false, 'an uploaded picture has no design');
      await page.waitForFunction(() => { const i = document.querySelector('[data-test=crest]'); return i && i.naturalWidth === 512; });
      equal(await st(page).then(x => x.partyName), '', 'no Party Name was made up');
    });

    await check('a Party Name sits above the crest on the badge, and the crest is "Crest of <name>" (spoken and in the panel)', async () => {
      const key = await crestKey();
      await pause(page);
      await page.click('[data-test=identity-badge]');
      await page.fill('[data-test=party-name]', 'Wardens of the Ironbow');
      await page.press('[data-test=party-name]', 'Enter');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === 'Wardens of the Ironbow');
      equal(await crestKey(), key, 'the crest is untouched');
      equal(await badge(), { name: 'Wardens of the Ironbow', label: '', aria: 'Crest of Wardens of the Ironbow. Open Party Identity.', img: true, empty: false });
      equal((await crestInfo(page)).alt, 'Crest of Wardens of the Ironbow');
      const order = await page.evaluate(() => { const n = document.querySelector('[data-test=badge-name]').getBoundingClientRect(); const i = document.querySelector('.tsi-bas-badge__img').getBoundingClientRect(); return n.bottom <= i.top + 1; });
      equal(order, true, 'the name is above the crest');
      await H.shot(page, 'p9-identity-named');
      await page.keyboard.press('Escape');
    });

    await check('Download Save includes the crest and the Party Name; Reset clears them with the rest of the Bastion', async () => {
      const d = await H.download(page, '[data-test=download-save]');
      const keys = JSON.parse(d.text).records.map(r => r.key);
      assert(keys.indexOf('tsi.bastion.crest') !== -1, keys.join(','));
      equal(JSON.parse(d.text).records.find(r => r.key === 'tsi.bastion.state').value.partyName, 'Wardens of the Ironbow', 'the Party Name is in the saved Bastion');
      await pause(page);
      await page.click('[data-test=reset]');
      await clickModal(page, 'Reset');
      await page.waitForSelector('[data-test=day-status]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().partyName === '');
      equal(await page.evaluate(() => TSI.store.has('tsi.bastion.crest')), false);
      equal((await crestInfo(page)).shown, false);
    });

    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('Warehouse, panels and the Compendium')) {
    section('Warehouse, panels and the Compendium');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);

    await check('warehouse edits save as they\'re typed, no Save needed (BAS-17)', async () => {
      await page.fill('[data-test=wh-item-0]', 'Rope');
      await page.fill('[data-test=wh-qty-0]', '3');
      await page.fill('[data-test=wh-notes-0]', 'from the dock');
      await pause(page);
      await page.click('[data-test=add-item]');
      await page.fill('[data-test=wh-item-1]', 'Lantern');
      await reopen(page);
      equal((await st(page)).warehouse.map(w => [w.item, w.qty, w.notes]), [['Rope', 3, 'from the dock'], ['Lantern', 1, '']]);
      equal(await page.inputValue('[data-test=wh-item-0]'), 'Rope');
    });

    await check('Warehouse sort: Grouped lists the supplies, ingredients, trade goods and general items together; the saved order is unchanged; it is remembered', async () => {
      await setUp(page, (s) => {
        s.warehouse.push({ id: 'g1', goodId: 'raw_timber', item: 'Raw Timber', qty: 1, gp: '', notes: '' });
        s.warehouse.push({ id: 'g2', goodId: 'expedition_provision_pack', item: 'Expedition Provision Pack', qty: 2, gp: '', notes: '' });
        s.warehouse.push({ id: 'g3', goodId: 'restorative_herbs', item: 'Restorative Herbs', qty: 10, gp: '', notes: '' });
      });
      await pause(page);
      const savedOrder = (await st(page)).warehouse.map(w => w.item);
      await page.selectOption('[data-test=wh-sort]', 'grouped');
      await pause(page);
      const shown = () => page.evaluate(() => [...document.querySelectorAll('[data-test=warehouse] > *')].map(n => n.getAttribute('data-test') && n.getAttribute('data-test').startsWith('wh-group-') ? n.textContent : (n.querySelector('[data-test^=wh-item-]') ? (n.querySelector('[data-test^=wh-item-]').value || n.querySelector('[data-test^=wh-item-]').textContent) : '?')));
      const g = await shown();
      assert(/^Supplies \(1\)/.test(g[0]) && /Expedition Provision Pack/.test(g[1]), g.join(' | '));
      assert(/^Ingredients \(1\)/.test(g[2]) && /^Trade goods \(1\)/.test(g[4]) && /^General items/.test(g[6]), g.join(' | '));
      equal((await st(page)).warehouse.map(w => w.item), savedOrder, 'the saved order is untouched');
      await page.reload();
      await page.waitForSelector('[data-test=day-status]');
      equal(await page.$eval('[data-test=wh-sort]', e => e.value), 'grouped', 'remembered after a reload');
      await page.selectOption('[data-test=wh-sort]', 'entered');
      await pause(page);
      equal(await page.$$eval('[data-test^=wh-group-]', n => n.length), 0, 'no headings as entered');
      await setUp(page, (s) => { s.warehouse = s.warehouse.filter(w => !w.goodId); });
      await pause(page);
    });

    await check('Hand to the party: asks first, takes only what is handed over, once, and the Day Log says so', async () => {
      await page.click('[data-test=wh-hand-0]');
      await page.waitForTimeout(500);
      const t = await popText(page);
      assert(/D&D sheet/.test(t) && /Courier Exchange/.test(t), t);
      await page.locator('[data-test=hand-qty]').fill('2');
      await page.locator('[data-test=hand-who]').fill('Borin');
      await clickModal(page, 'Cancel');
      equal((await st(page)).warehouse.map(w => [w.item, w.qty]), [['Rope', 3], ['Lantern', 1]], 'Cancel changes nothing');
      await page.click('[data-test=wh-hand-0]');
      await popText(page);
      await page.locator('[data-test=hand-qty]').fill('2');
      await page.locator('[data-test=hand-who]').fill('Borin');
      await clickModal(page, 'Hand over');
      await pause(page);
      const s = await st(page);
      equal(s.warehouse.map(w => [w.item, w.qty]), [['Rope', 1], ['Lantern', 1]], 'five-less-two style: 3 less 2');
      equal(s.log.filter(l => /Handed to the party/.test(l.body)).length, 1, 'logged once');
      assert(/2 \u00d7 Rope \(to Borin\) on Day 1/.test(s.log[0].body) && /D&D sheet/.test(s.log[0].body), s.log[0].body);
    });

    await check('Remove and Clear (Clear is logged twice, as before: BAS-31, kept)', async () => {
      await page.click('[data-test=wh-remove-1]');
      equal((await st(page)).warehouse.length, 1);
      await page.click('[data-test=clear-warehouse]');
      assert(/Clear the whole Warehouse \(1 row\)\?/.test(await page.$eval('.tsi-modal:not(.tsi-bas-panel)', m => m.textContent)), 'it asks first');
      await clickModal(page, 'Cancel');
      equal((await st(page)).warehouse.map(w => w.item), ['Rope'], 'Cancel keeps it');
      await page.click('[data-test=clear-warehouse]');
      await clickModal(page, 'Clear');
      await pause(page);
      const s = await st(page);
      equal(s.warehouse.map(w => w.item), ['New Item']);
      equal(s.log.slice(0, 2).map(l => l.body), ['Cleared warehouse.', 'Cleared warehouse.']);
    });

    await check('the Workshop has no Artisan Tools picker: the Handyman\'s Craft list is fixed (the full staff click-through is tests/e2e/workshop.test.js)', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      await pause(page);
      await page.click('[data-test=tile-workshop]');
      await page.waitForSelector('[data-test=panel-fac-workshop] [data-test=staff-handyman]');
      equal(await page.$('[data-test=artisan-0]'), null);
      const opts = await page.$$eval('[data-test="sel-workshop__craft"] option', os => os.map(o => o.textContent));
      assert(opts.length > 90 && opts.indexOf('Backpack') !== -1 && opts.indexOf('Battleaxe') === -1, opts.length + '');
      await page.keyboard.press('Escape');
    });

    await check('the facility grid, folded away, stays folded after reopening (BAS-16: the panels\' arrows are now the grid\'s)', async () => {
      await page.keyboard.press('Escape');
      await page.click('[data-test=grid-toggle]');
      equal(await page.isVisible('[data-test=grid]'), false);
      equal(await page.getAttribute('[data-test=grid-toggle]', 'aria-expanded'), 'false');
      await reopen(page);
      equal(await page.isVisible('[data-test=grid]'), false);
      await page.click('[data-test=grid-toggle]');
      equal(await page.isVisible('[data-test=grid]'), true);
    });

    await check('Clan Influence: at -100 Honour Change resets Political Capital to neutral (the Favour bars are in the Temple now: see temple.test.js)', async () => {
      await setUp(page, (s) => { s.favour.pelagos = 100; s.politicalCapital.molten = -100; });
      equal(await page.$('[data-test=open-favour]'), null, 'no Favour of the Gods panel any more');
      await pause(page);
      await page.click('[data-test=open-influence]');
      await page.waitForSelector('[data-test=honour-molten]');
      await page.click('[data-test=honour-molten]');
      equal((await st(page)).politicalCapital.molten, 0);
    });

    await check('the Compendium: it lists what the facilities offer, with search, details, card and Roll20 link', async () => {
      await pause(page);
      await page.click('[data-test=compendium]');
      await page.waitForSelector('[data-test=comp-list]');
      const listed = await page.evaluate(() => TSI.bastion.rules.compendiumIndex(TSI_DATA.bastionFacilities, TSI_DATA.bastionTools).items.length);
      equal(await page.$$eval('.tsi-bas-comp__item', b => b.length), listed);
      await page.fill('[data-test=comp-search]', 'regiment');
      equal(await page.$$eval('.tsi-bas-comp__item', b => b.length), 0, 'the old Regiment (100) is no longer recruited');
      await page.fill('[data-test=comp-search]', 'bag of');
      equal(await page.$$eval('.tsi-bas-comp__item', b => b.map(x => x.textContent)), ['Bag of Holding']);
      await page.click('.tsi-bas-comp__item');
      await page.waitForFunction(() => { const i = document.querySelector('[data-test=comp-card] img'); return i && i.complete && i.naturalWidth > 0; });
      const d = await text(page, 'comp-detail');
      assert(/Wondrous item \(Uncommon\)/.test(d) && /Craftable at:/.test(d), d);
      equal(await page.getAttribute('[data-test=roll20]', 'href'), 'https://roll20.net/compendium/dnd5e/Bag%20of%20Holding');
      await page.fill('[data-test=comp-search]', 'acid');
      await page.click('.tsi-bas-comp__item');
      equal(await page.$$eval('[data-test=comp-card]', c => c.length), 0, 'no card for this one');
      await H.shot(page, 'p9-10-compendium');
    });

    await check('Export Compendium JSON downloads the list with no internet lookup (B15)', async () => {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-test=comp-export]')]);
      equal(dl.suggestedFilename(), 'compendium_items.json');
      const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
      const exp = await page.evaluate(() => { const R = TSI.bastion.rules; const o = R.compendiumExport(R.compendiumIndex(TSI_DATA.bastionFacilities, TSI_DATA.bastionTools), TSI_DATA.bastionCompendium.items); return { n: Object.keys(o.file.items).length, kept: o.kept, stubbed: o.stubbed }; });
      equal([file.version, Object.keys(file.items).length], [1, exp.n]);
      equal(await text(page, 'comp-status'), 'Done. Filled: 0 • Kept: ' + exp.kept + ' • Stubbed: ' + exp.stubbed + '. Downloading…');
      assert(/^https:\/\/roll20\.net\//.test(file.items['Bag of Holding'].roll20), 'other items keep theirs');
      await clickModal(page, 'Close');
      equal(context.log.net, []);
      equal(context.log.failed, []);
    });

    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('Saving: download, import, damaged files, reset')) {
    section('Saving: download, import, damaged files, reset');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await treasury(page, '1234');
    await days(page, 1, []);
    let exported = null;

    await check('Download Save (JSON) downloads the campaign: the Bastion and the Explorer together, and logs it', async () => {
      const d = await H.download(page, '[data-test=download-save]');
      exported = d.text;
      assert(/^tsi-campaign-\d{4}-\d\d-\d\d-\d{4}\.json$/.test(d.name), d.name);
      const file = JSON.parse(d.text);
      equal([file.kind, file.tools], ['campaign', ['explorer', 'bastion']]);
      const rec = file.records.find(r => r.key === 'tsi.bastion.state');
      equal([rec.value.treasuryGP, rec.value.day, rec.value.v], [1234, 2, 4]);
      equal(file.records.find(r => r.key === 'tsi.explorer.save').value.travel.day, 2, 'the Explorer\'s half');
      await page.waitForFunction(() => TSI.bastion.debug.state().log[0].title === 'Save File');
    });

    await check('Import asks first, and Cancel changes nothing', async () => {
      const f = H.writeTemp('bastion-backup.json', exported);
      await treasury(page, '99');
      await H.chooseFile(page, '[data-test=import-save]', f);
      equal(await modalTitle(page), 'Import into The Ironbow Bastion Manager');
      assert(/Importing replaces what the Explorer and the Bastion have saved now, together/.test(await popText(page)), await popText(page));
      await clickModal(page, 'Cancel');
      equal((await st(page)).treasuryGP, 99);
      /* Both halves come back: the Explorer's day moves on meanwhile, and goes back with the import. */
      await setExplorerDay(page, 3);
      await page.waitForFunction(() => TSI.bastion.debug.state().day === 3 && !TSI.bastion.debug.busy());
      await H.chooseFile(page, '[data-test=import-save]', f);
      await clickModal(page, 'Import');
      await page.waitForSelector('[data-test=day-status]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().treasuryGP === 1234);
      equal([(await st(page)).day, await explorerDay(page)], [2, 2]);
    });

    await check('another tool\'s file or a damaged Bastion is refused, and nothing changes (BAS-14)', async () => {
      const otherFile = JSON.parse(exported);
      otherFile.kind = 'tool';
      otherFile.tool = 'arenas';
      otherFile.records = [Object.assign({}, otherFile.records[0], { key: 'tsi.arenas.state', value: { players: [], prizeTotal: 300 } })];
      await H.chooseFile(page, '[data-test=import-save]', H.writeTemp('arenas.json', otherFile));
      const t1 = await popText(page);
      assert(/This file is from the Arenas of The Scarlett Isles, not The Ironbow Bastion Manager\./.test(t1), t1);
      await clickModal(page, 'OK');
      const file = JSON.parse(exported);
      file.records.find(r => r.key === 'tsi.bastion.state').value.pendingOrders = 'lost';
      const bad = H.writeTemp('bastion-bad.json', file);
      await H.chooseFile(page, '[data-test=import-save]', bad);
      const t2 = await popText(page);
      assert(/pendingOrders list is damaged/.test(t2), t2);
      await clickModal(page, 'OK');
      /* A Bastion file from before the days overhaul (in Bastion turns). */
      const old = JSON.parse(exported);
      old.kind = 'tool'; old.tool = 'bastion';
      old.records = [{ key: 'tsi.bastion.state', value: { treasuryGP: 50, partyLevel: 7, turn: 4, builtExtras: [], pendingOrders: [], defenders: { count: 0 }, warehouse: [], turnInProgress: null }, savedAt: old.records[0].savedAt }];
      await H.chooseFile(page, '[data-test=import-save]', H.writeTemp('bastion-turns.json', old));
      const t3 = await popText(page);
      assert(/This file is from before the Bastion counted in days, so it can't be imported\. Nothing was changed\./.test(t3), t3);
      await clickModal(page, 'OK');
      equal((await st(page)).treasuryGP, 1234);
    });

    await check('a damaged save in the browser is set aside, and the Bastion still opens', async () => {
      await page.evaluate(() => TSI.store.set('tsi.bastion.state', { heroes: [] }));
      await reopen(page);
      equal([(await st(page)).treasuryGP, (await st(page)).v], [0, 4]);
      assert((await page.evaluate(() => TSI.store.keys())).some(k => k.indexOf('tsi.quarantine.bastion.state') === 0));
    });

    await check('a Bastion saved in Bastion turns is set aside (kept, not deleted) and a new one starts on the Explorer\'s day, saying so', async () => {
      await page.evaluate(() => TSI.store.set('tsi.bastion.state', { treasuryGP: 500, partyLevel: 9, turn: 6, builtExtras: [], pendingOrders: [{ id: 'x', completeTurn: 7 }], defenders: { count: 3 }, warehouse: [], turnInProgress: null }));
      const before = (await page.evaluate(() => TSI.store.keys())).filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0).length;
      await reopen(page);
      await H.waitForNotice(page, /Your Bastion was saved in Bastion turns, before the Bastion counted in days, so it has been set aside/);
      await page.waitForFunction(() => TSI.bastion.debug.state().anchored);
      const s = await st(page);
      equal([s.v, s.treasuryGP, s.partyLevel, s.pendingOrders, s.day], [4, 0, 7, [], 2]);
      const keys = (await page.evaluate(() => TSI.store.keys())).filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0);
      equal(keys.length, before + 1, 'the old Bastion is kept aside');
      equal((await page.evaluate(k => TSI.store.get(k), keys[keys.length - 1])).turn, 6);
      await H.dismissNotices(page);
    });

    /* A Bastion saved before the facilities overhaul (Harry, 13 October 2026), on the Explorer's day. */
    const beforeOverhaul = d => ({
      v: 2, day: d, anchored: true, treasuryGP: 400, partyLevel: 13, defenders: { count: 2, armed: false, patrolUntil: 0 }, warehouse: [], log: [],
      builtExtras: [{ facId: 'arcane_study', status: 'built' }, { facId: 'laboratory', status: 'built' }, { facId: 'smithy', status: 'built' }, { facId: 'gaming_hall', status: 'built' }, { facId: 'garden', status: 'building', startDay: 1, readyDay: d + 9 }],
      facilityLevels: { arcane_study: 1, laboratory: 2, smithy: 1, gaming_hall: 1 },
      repairs: { laboratory: d + 4 },
      pendingOrders: [
        { id: 'o1', facId: 'laboratory', fnId: 'craft', chosen: { label: 'Potion of Healing' }, optionLabel: 'Potion of Healing', notes: '', label: 'Laboratory: Craft (Potion of Healing)', costGP: 25, issuedDay: d, dueDay: d + 6 },
        { id: 'o2', facId: 'smithy', fnId: 'craft', chosen: { label: 'Dagger' }, optionLabel: 'Dagger', notes: '', label: 'Smithy: Craft (Dagger)', costGP: 0, issuedDay: d, dueDay: d + 5 },
        { id: 'o3', facId: 'gaming_hall', fnId: 'trade', notes: '', label: 'Gaming Hall: Trade', costGP: 0, issuedDay: d, dueDay: d + 7 }
      ]
    });

    await check('a Bastion from before the facilities overhaul is converted once: a notice and a Day Log entry say what changed, and the Bastion as it was is kept aside', async () => {
      await H.dismissNotices(page);
      const d = (await st(page)).day;
      await page.evaluate(v => TSI.store.set('tsi.bastion.state', v), beforeOverhaul(d));
      const before = (await page.evaluate(() => TSI.store.keys())).filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0).length;
      await reopen(page);
      await H.waitForNotice(page, /Facilities\. The Bastion's facilities have changed: The Smithy joined the Workshop: its slot is free, and the Workshop keeps the Smithy's order\. The Gaming Hall is no longer part of the Bastion; its slot is free\./);
      const s = await st(page);
      equal(s.v, 4, 'version 2 goes on to version 4 (the Strip Back Overhaul, 22 October 2026)');
      equal(s.builtExtras, ['', '', '', '', ''], 'the Arcane Laboratory joined the Workshop: its slot is free (step S12)');
      /* The Garden became the Herbal Gardens, and moved to a Development Plot (open at party level 13), still being built. */
      equal(s.builtPlots, [{ facId: 'herbal_gardens', status: 'building', startDay: 1, readyDay: d + 9 }, '', '', '']);
      assert(s.log.some(l => l.title === 'Development Plots' && l.body === 'The Herbal Gardens moved to a Development Plot; its construction slot is free.'), 'the Day Log says so');
      equal(s.pendingOrders.map(o => [o.id, o.facId, o.fnId, o.dueDay]), [['o1', 'workshop', 'alchemy', d + 6], ['o2', 'workshop', 'smithing', d + 5]]);
      equal([s.facilityLevels.arcane_laboratory, s.repairs.arcane_laboratory, s.legacyFacilities, s.artisanTools, s.treasuryGP], [undefined, undefined, undefined, undefined, 400], 'the Laboratory\'s level and repair are gone (step S12), so are the Artisan Tools and the list of retired buildings');
      equal(s.archivedFacilities.map(a => a.name), ['Gaming Hall', 'Barracks', 'Armoury', 'Watchtower', 'Arcane Laboratory']);
      equal(s.migration.v3.shown, true, 'the notice has been shown');
      const entry = s.log.find(l => l.title === 'Facilities');
      assert(entry && /^The facilities overhaul \(13 October 2026\): /.test(entry.body) && /The Arcane Study and the Laboratory are now one Arcane Laboratory: the other slot is free\./.test(entry.body), JSON.stringify(entry));
      const keys = (await page.evaluate(() => TSI.store.keys())).filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0);
      equal(keys.length, before + 1, 'the Bastion as it was is set aside');
      const kept = await page.evaluate(k => TSI.store.get(k), keys[keys.length - 1]);
      equal([kept.v, kept.builtExtras.length, kept.builtExtras[2].facId, kept.pendingOrders.length], [2, 5, 'smithy', 3], 'untouched');
      await H.shot(page, 'p9-90-facilities-converted');
      /* The grid and the panels show the new facilities. */
      equal(await page.$$eval('[data-test=tile-arcane_laboratory]', ts => ts.length), 0, 'no tile for the Laboratory any more');
      await H.dismissNotices(page);
      await pause(page);
      await page.click('[data-test=tile-workshop]');
      await page.waitForSelector('[data-test=panel-fac-workshop]');
      assert(/Smithy: Craft \(Dagger\)/.test(await page.textContent('[data-test=panel-fac-workshop]')), 'the Smithy\'s order carries on at the Workshop');
      await page.keyboard.press('Escape');
    });

    await check('opened again, nothing is converted twice: no notice, no second copy, no second Day Log entry', async () => {
      const keysBefore = (await page.evaluate(() => TSI.store.keys())).filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0).length;
      const was = await st(page);
      await reopen(page);
      await page.waitForTimeout(600);
      equal(await page.evaluate(() => Array.from(document.querySelectorAll('.tsi-notice')).filter(n => /facilities have changed|moved to a Development Plot/.test(n.textContent)).length), 0);
      const s = await st(page);
      equal([s.builtExtras, s.builtPlots, s.pendingOrders.map(o => o.fnId), s.log.filter(l => l.title === 'Facilities').length, s.log.filter(l => l.title === 'Development Plots').length],
        [was.builtExtras, was.builtPlots, was.pendingOrders.map(o => o.fnId), 1, 1]);
      equal((await page.evaluate(() => TSI.store.keys())).filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0).length, keysBefore);
    });

    await check('an imported Bastion file from before the overhaul is converted the same way', async () => {
      const file = JSON.parse(exported);
      file.records.find(r => r.key === 'tsi.bastion.state').value = beforeOverhaul((await st(page)).day);
      await H.chooseFile(page, '[data-test=import-save]', H.writeTemp('bastion-v2.json', file));
      await clickModal(page, 'Import');
      await page.waitForSelector('[data-test=day-status]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().v === 4);
      await H.waitForNotice(page, /The Bastion's facilities have changed/);
      const s = await st(page);
      equal([s.builtExtras.filter(Boolean).map(e => e.facId).includes('arcane_laboratory'), s.legacyFacilities, s.pendingOrders.length], [false, undefined, 2]);
      await H.dismissNotices(page);
    });

    await check('the sample file for Harry (tests/fixtures/bastion-before-overhaul.json) imports, converts and moves to the Explorer\'s day; the Explorer is untouched', async () => {
      const exDay = await explorerDay(page);
      await H.chooseFile(page, '[data-test=import-save]', require('path').join(__dirname, '..', 'fixtures', 'bastion-before-overhaul.json'));
      await clickModal(page, 'Import');
      await page.waitForSelector('[data-test=day-status]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().v === 4);
      await H.waitForNotice(page, /The Bastion's facilities have changed: The Smithy joined the Workshop/);
      /* The box that says what changed holds the Bastion until it is read. */
      await H.ackChanges(page);
      await page.waitForFunction(() => TSI.bastion.debug.state().anchored && !TSI.bastion.debug.busy());
      const s = await st(page);
      equal([s.builtExtras.filter(Boolean).map(e => e.facId).includes('arcane_laboratory'), s.legacyFacilities, s.pendingOrders.map(o => o.fnId).sort(), s.treasuryGP, s.facilityLevels.arcane_laboratory], [false, undefined, ['alchemy', 'smithing'], 400, undefined]);
      equal([s.day, await explorerDay(page)], [exDay, exDay]);
      await H.dismissNotices(page);
    });

    await check('a Bastion saved by pull request 2 (v 3) with its Herbal Gardens in a slot, at party level 13: on opening it moves to a plot, is saved there, and is announced once', async () => {
      await H.dismissNotices(page);
      const saved = await page.evaluate(() => {
        const v = JSON.parse(JSON.stringify(TSI.bastion.rules.toSave(TSI.bastion.debug.state())));
        v.partyLevel = 13;
        v.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }, { facId: 'herbal_gardens', status: 'built' }];
        delete v.builtPlots;
        v.facilityLevels = Object.assign({}, v.facilityLevels, { herbal_gardens: 3 });
        v.log = [];
        v.v = 3;
        TSI.store.set('tsi.bastion.state', v);
        return v;
      });
      equal(saved.v, 3, 'a version 3 Bastion, as pull request 2 saved it (it is converted to version 4 when it opens)');
      await reopen(page);
      await H.waitForNotice(page, /The Herbal Gardens moved to a Development Plot; its construction slot is free\./);
      let s = await st(page);
      equal([s.builtExtras.filter(Boolean).map(e => e.facId), s.builtPlots[0], s.facilityLevels.herbal_gardens], [['hall_of_emissaries'], { facId: 'herbal_gardens', status: 'built' }, 3]);
      await page.evaluate(() => TSI.store.flush());
      const stored = await page.evaluate(() => TSI.store.get('tsi.bastion.state'));
      equal(stored.builtPlots[0], { facId: 'herbal_gardens', status: 'built' }, 'saved there at once');
      equal(s.log.filter(l => l.title === 'Development Plots').length, 1);
      await H.dismissNotices(page);
      await reopen(page);
      await page.waitForTimeout(600);
      s = await st(page);
      equal(s.log.filter(l => l.title === 'Development Plots').length, 1, 'opened again: no second entry');
      equal(await page.evaluate(() => Array.from(document.querySelectorAll('.tsi-notice')).filter(n => /moved to a Development Plot/.test(n.textContent)).length), 0, 'and no second notice');
    });

    await check('the pull request 3 sample for Harry (tests/fixtures/bastion-pr3-sample.json) imports: three production facilities on plots, goods in the Warehouse, one plot free', async () => {
      await H.chooseFile(page, '[data-test=import-save]', require('path').join(__dirname, '..', 'fixtures', 'bastion-pr3-sample.json'));
      await clickModal(page, 'Import');
      await page.waitForSelector('[data-test=day-status]');
      await H.ackChanges(page);
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored && !TSI.bastion.debug.busy());
      const s = await st(page);
      equal([s.partyLevel, s.treasuryGP, s.builtPlots.filter(Boolean).map(e => e.facId)], [13, 3000, ['herbal_gardens', 'timber_sawmill', 'fishery_smokehouse']]);
      equal(s.warehouse.map(w => [w.goodId || w.item, w.qty]), [['Rope (50 ft)', 2], ['raw_timber', 2], ['fresh_fish', 1], ['preserved_fish', 1], ['restorative_herbs', 20], ['antivenom_roots', 5], ['alchemical_flowers', 20]]);
      equal(await page.$$eval('[data-test=grid-plots] .tsi-bas-tile--plot', ts => ts.map(t => t.dataset.test)), ['plot-3']);
      equal(await page.$$eval('.tsi-bas-maplabel', ls => ls.length), 11, 'the starting two, four in slots (the Shrine of Aurush is the Temple now, labelled at each of its three buildings) and three on plots, each labelled');
      await H.dismissNotices(page);
    });

    await check('Reset asks first; Reset clears the Bastion', async () => {
      await treasury(page, '777');
      await pause(page);
      await page.click('[data-test=reset]');
      await clickModal(page, 'Cancel');
      equal((await st(page)).treasuryGP, 777);
      await pause(page);
      await page.click('[data-test=reset]');
      await clickModal(page, 'Reset');
      await page.waitForSelector('[data-test=day-status]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().treasuryGP === 0);
    });

    await check('Back up everything includes the Bastion', async () => {
      await treasury(page, '321');
      await page.evaluate(() => TSI.store.flush());
      await page.click('[data-test=home]');
      await page.waitForSelector('[data-test=backup-everything]');
      const d = await H.download(page, '[data-test=backup-everything]');
      const rec = JSON.parse(d.text).records.find(r => r.key === 'tsi.bastion.state');
      equal(rec.value.treasuryGP, 321);
    });

    await check('Restore, with a Bastion from before the facilities overhaul: it\'s converted when the Bastion opens, saying so', async () => {
      const backup = JSON.parse((await H.download(page, '[data-test=backup-everything]')).text);
      const rec = backup.records.find(r => r.key === 'tsi.bastion.state');
      rec.value = beforeOverhaul(rec.value.day);
      await H.chooseFile(page, '[data-test=restore]', H.writeTemp('suite-v2-bastion.json', backup));
      await page.waitForSelector('.tsi-modal');
      await Promise.all([page.waitForEvent('download'), page.waitForEvent('load'), clickModal(page, 'Restore')]);
      await H.waitForNotice(page, /Restored the backup saved on/);
      await page.click('.tsi-card[href*="bastion"]');
      await page.waitForSelector('[data-test=day-status]');
      await H.waitForNotice(page, /The Bastion's facilities have changed/);
      const s = await st(page);
      equal([s.v, s.builtExtras.filter(Boolean).length, s.legacyFacilities, s.pendingOrders.map(o => o.fnId)], [4, 0, undefined, ['alchemy', 'smithing']]);
      await H.dismissNotices(page);
      await page.evaluate(() => TSI.store.flush());
      await page.click('[data-test=home]');
      await page.waitForSelector('[data-test=backup-everything]');
    });

    await check('leaving: nothing from the Bastion is left behind', async () => {
      equal(await page.evaluate(() => !!(window.TSI.bastion && window.TSI.bastion.debug)), false);
      equal(context.log.errors, []);
    });
    await context.close();
  }

  /* The side-by-side run against the old Bastion (same dice, same campaign)
     is retired: since the days overhaul (8 October 2026) the rules
     deliberately differ (docs/KNOWN_ISSUES.md, BAS-61). */

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
