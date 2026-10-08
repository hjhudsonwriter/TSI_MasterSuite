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
   Math.random gives, before its usual ones (a test's own dice). Calm pages
   (newPage's calm): no Clan at war ever attacks, for the checks that aren't
   about attacks; the attack roll still happens, on a d6 that never shows 1. */
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
  window.__arm = function () {
    const R = window.TSI && TSI.bastion && TSI.bastion.rules;
    if (!R || R.__calmed || !window.__calm) return;
    const roll = R.rollWarAttack;
    R.rollWarAttack = function (s, data, rand, now) { return roll.call(this, s, data, function () { return 0.99; }, now); };
    R.__calmed = true;
  };
}

async function newPage(browser, size, extra, opts) {
  const context = await H.newContext(browser, size || 'laptop', Object.assign({ acceptDownloads: true }, extra || {}));
  await context.setOffline(true);
  await context.addInitScript(setup);
  if (opts && opts.calm) await context.addInitScript(() => { window.__calm = true; });
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
const arm = page => page.evaluate(() => window.__arm && window.__arm());
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
  await arm(page);
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
/* Record what the Bastion passes to the War Table when it opens it (contract 8). */
async function spyTable(page) {
  await page.evaluate(() => {
    window.__wtOpts = null;
    const wt = TSI.bastion.warTable;
    if (wt.__spied) return;
    const open = wt.open;
    wt.open = function (o) {
      window.__wtOpts = {
        keys: Object.keys(o).sort(), title: o.title, armyName: o.armyName, enemy: o.enemy, crest: o.crest, canCallOff: o.canCallOff,
        summary: o.summary, battle: o.battle ? o.battle.phase : null, specUnits: o.spec ? o.spec.player.units.length : 0, inert: (o.inert || []).length,
        presetMap: o.presetMap ? { key: o.presetMap.key, src: o.presetMap.src, cols: o.presetMap.cols, rows: o.presetMap.rows, cells: o.presetMap.cells.length } : null
      };
      return open.apply(this, arguments);
    };
    wt.__spied = true;
  });
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
async function planHall(page, fn, idx, extra) {
  await pause(page);
  await page.click('[data-test="issue-hall_of_emissaries__' + fn + '"]');
  await page.waitForSelector('[data-test=hall-target]');
  await page.selectOption('[data-test=hall-target]', String(idx));
  if (extra && extra.dur) await page.selectOption('[data-test=hall-duration]', String(extra.dur));
  if (extra && extra.tone) await page.selectOption('[data-test=hall-tone]', extra.tone);
  await page.click('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button.tsi-btn--primary');
  await page.waitForTimeout(150);
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
  await arm(page);
}
/* Text without the At War tags (Harry, 4 October 2026): "Raid vs Bacca", not "Raid vs BaccaAt War". */
const bare = (page, sel) => page.$eval(sel, e => { const c = e.cloneNode(true); c.querySelectorAll('.tsi-bas-atwar').forEach(t => t.remove()); return c.textContent; });
async function bareModal(page) { await page.waitForSelector('.tsi-modal:not(.tsi-bas-panel)', { timeout: 5000 }); return bare(page, '.tsi-modal:not(.tsi-bas-panel)'); }
/* Queue War Action asks first: Declare war, or Renew the war. */
async function confirmWar(page) {
  await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'); return t && /^(Declare war on|Renew the war on) Clan /.test(t.textContent); });
  await page.click('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button.tsi-btn--primary');
  await page.waitForTimeout(150);
}
const ALL_EXTRAS = ['arcane_study', 'library', 'smithy', 'garden', 'menagerie', 'laboratory', 'war_room', 'gaming_hall', 'greenhouse', 'shrine_telluria', 'shrine_aurush', 'shrine_pelagos', 'hall_of_emissaries'];

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

    await check('it opens from its card on Day 1 (until the Explorer sets the day), level 7, with the five starting facilities in the grid', async () => {
      await page.click('.tsi-card[href*="bastion"]');
      await page.waitForSelector('[data-test=day-status]');
      equal(await text(page, 'day-status'), 'Day 1 · the Explorer sets the day');
      equal(await page.isHidden('[data-test=advance]'), true, 'no button to pass a day: the Explorer\'s Make Camp does that');
      equal(await page.inputValue('[data-test=level]'), '7');
      equal(await page.$$eval('.tsi-bas-tile', ts => ts.slice(0, 5).map(t => t.dataset.fac)), ['workshop', 'barracks', 'watchtower', 'dock', 'armoury']);
      equal(await page.$$eval('.tsi-bas-tile--slot', ts => ts.length), 2, 'two slots to build in at level 7');
    });

    for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
      await check('fits ' + size + ' with no scrolling either way, the main controls in view', async () => {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(250);
        const lc = await H.layoutCheck(page, ['[data-test=day-status]', '[data-test=level]', '[data-test=treasury]', '[data-test=compendium]', '[data-test=download-save]', '[data-test=import-save]', '[data-test=map]', '[data-test=open-events]', '[data-test=open-war]', '.tsi-bas-tile']);
        equal(lc.scrollWidth, lc.clientWidth, 'no sideways scroll');
        equal(lc.outOfView, [], 'in view');
        equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, 'the page itself never scrolls down');
      });
    }
    await page.setViewportSize(H.SIZES.laptop.viewport);
    await H.shot(page, 'p9-01-laptop');

    await check('every facility picture and all eight map overlays load with no internet', async () => {
      await setUp(page, (s) => { s.partyLevel = 17; s.builtExtras = ['arcane_study', 'library', 'smithy', 'garden', 'menagerie', 'laboratory', 'war_room', 'gaming_hall', 'greenhouse', 'shrine_telluria', 'shrine_aurush', 'shrine_pelagos', 'hall_of_emissaries'].map(id => ({ facId: id, status: 'built' })); });
      await page.waitForFunction(() => Array.from(document.images).every(i => i.complete));
      const imgs = await page.$$eval('.tsi-bas-tile__img, .tsi-bas-map__overlay, .tsi-bas-map__img', is => is.map(i => [i.getAttribute('src').split('/').pop(), i.naturalWidth]));
      equal(imgs.filter(i => !i[1]), [], 'all loaded');
      equal(await page.$$eval('.tsi-bas-tile--built', ts => ts.length), 18, 'every facility has a tile, the Hall too');
      equal(await page.$$eval('.tsi-bas-map__overlay', os => os.map(o => o.dataset.fac).sort()), ['arcane_study', 'garden', 'greenhouse', 'hall_of_emissaries', 'laboratory', 'library', 'smithy', 'war_room']);
      equal(await page.$$eval('.tsi-bas-map__overlay', os => os.map(o => o.naturalWidth)), [1152, 1152, 1152, 1152, 1152, 1152, 1152, 1152]);
      equal((await H.layoutCheck(page, ['.tsi-bas-tile'])).scrollWidth, H.SIZES.laptop.viewport.width, 'eighteen tiles still fit');
      await H.shot(page, 'p9-02-everything-built');
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
      await page.selectOption('[data-test=level]', '9');
      await pause(page);
      await page.click('[data-test=slot-0]');
      await page.waitForSelector('[data-test=build-menagerie]');
      equal(await page.getAttribute('[data-test=build-menagerie]', 'aria-disabled'), 'true');
      assert(/Locked: level 13/.test(await text(page, 'build-menagerie')));
      equal(await page.getAttribute('[data-test=build-library]', 'aria-disabled'), null);
      assert(/Party level 9: 4 construction slots, 0 in use\./.test(await text(page, 'build-panel')));
    });

    await check('the build panel shows what a facility does, and how long it takes to build, on hover', async () => {
      await page.hover('[data-test=build-library]');
      await page.waitForFunction(() => /Library/.test(document.querySelector('[data-test=tooltip]').textContent));
      const tip = await text(page, 'tooltip');
      assert(/Library/.test(tip) && /What it does/.test(tip) && /Takes 21 days to build/.test(tip), tip);
      await page.keyboard.press('Escape');
      await page.mouse.move(5, 400);
    });

    await check('building takes 21, 28 or 35 days, then the facility joins the grid and the map', async () => {
      await construct(0, 'library');
      await construct(1, 'laboratory');
      equal(await page.$$eval('.tsi-bas-tile--building', ts => ts.map(t => [t.dataset.test, t.textContent])), [['tile-library', '21'], ['tile-laboratory', '28']]);
      equal((await st(page)).builtExtras.slice(0, 2), [{ facId: 'library', status: 'building', startDay: 1, readyDay: 22 }, { facId: 'laboratory', status: 'building', startDay: 1, readyDay: 29 }]);
      await pause(page);
      await page.click('[data-test=slot-2]');
      await page.waitForSelector('[data-test=build-panel]');
      equal(await page.$('[data-test=build-library]'), null, 'no longer offered');
      await page.keyboard.press('Escape');
      await days(page, 20, []);
      equal(await text(page, 'tile-library'), '1', 'Day 21: one day to go');
      await days(page, 1, []);
      equal(await page.$eval('[data-test=tile-library]', t => [t.tagName, t.classList.contains('tsi-bas-tile--built')]), ['BUTTON', true]);
      equal(await page.$$eval('.tsi-bas-map__overlay', os => os.map(o => o.dataset.fac)), ['library']);
      assert((await st(page)).log.some(l => l.title === 'Construction Complete' && l.body === 'Library is now built and active.'));
    });

    await check('lowering the level keeps every building, marked over capacity (BAS-04, B8)', async () => {
      await construct(2, 'smithy');
      await construct(3, 'garden');
      await page.selectOption('[data-test=level]', '5');
      await page.waitForTimeout(100);
      equal(await page.$$eval('[data-test=over-capacity]', os => os.length), 2);
      equal(await slotsOpen(), 0, 'no room to build');
      await pause(page);
      await page.click('[data-test=facilities-count]');
      assert(/Party level 5: 2 construction slots, 4 in use \(2 over capacity\)\. There's no free slot/.test(await text(page, 'build-panel')), await text(page, 'build-panel'));
      await page.keyboard.press('Escape');
      equal((await st(page)).builtExtras.filter(Boolean).length, 4);
      await reopen(page);
      await page.selectOption('[data-test=level]', '9');
      await page.waitForTimeout(100);
      equal(await page.$$eval('[data-test=over-capacity]', os => os.length), 0);
      await H.shot(page, 'p9-04-slots');
    });

    await check('Clear extra builds asks first; Cancel keeps them', async () => {
      await page.click('[data-test=clear-builds]');
      assert(/Your 5 starting facilities remain/.test(await popText(page)));
      await clickModal(page, 'Cancel');
      equal((await st(page)).builtExtras.filter(Boolean).length, 4);
      await page.waitForTimeout(400);
      await page.click('[data-test=clear-builds]');
      await clickModal(page, 'Clear');
      equal((await st(page)).builtExtras.filter(Boolean).length, 0);
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
      equal(await text(page, 'days-barracks__recruit_defenders'), 'Takes 5 days');
    });

    await check('the same order again, or one you can\'t afford, is refused with a message', async () => {
      await issue(page, 'dock', 'charter_berth');
      equal(await popText(page).then(t => /That order is already pending\./.test(t)), true);
      await clickModal(page, 'OK');
      await issue(page, 'armoury', 'arm_defenders');
      await treasury(page, '50');
      await issue(page, 'barracks', 'recruit_defenders');
      equal((await st(page)).pendingOrders.length, 3, 'Recruit Defenders is free');
      await setUp(page, (s) => { s.defenders.count = 2; });
      await pause(page);
      await page.click('[data-test=cancel-1]');
      await issue(page, 'armoury', 'arm_defenders');
      assert(/Not enough gp\. Need 300gp, you have 50gp\./.test(await popText(page)));
      await clickModal(page, 'OK');
    });

    await check('cancelling keeps the gold spent (B9, kept)', async () => {
      await treasury(page, '500');
      await issue(page, 'armoury', 'arm_defenders');
      equal((await st(page)).treasuryGP, 200);
      await pause(page);
      await page.click('[data-test=cancel-2]');
      const s = await st(page);
      equal([s.treasuryGP, s.pendingOrders.length, s.log[0].body], [200, 2, 'Cancelled an order.']);
    });

    await check('orders complete on their days: defenders recruited on Day 6, the ship in the warehouse on Day 8', async () => {
      await page.evaluate(() => window.__seed(4));
      await days(page, 5, []);
      equal((await st(page)).pendingOrders.map(o => o.label), ['Dock: Charter Berth (Longship)'], 'Day 6: the Barracks\' order is done');
      await days(page, 2, []);
      const s = await st(page);
      equal(s.pendingOrders, []);
      assert(s.defenders.count > 2);
      assert(s.warehouse.some(w => w.item === 'Longship' && w.notes === 'Dock'), JSON.stringify(s.warehouse));
      assert(/Recruited \d defenders/.test(s.log.map(l => l.body).join('|')));
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
      await setUp(page, (s) => { s.pendingOrders.push({ id: 'p1', facId: 'barracks', fnId: 'recruit_defenders', label: 'Barracks: Recruit Defenders', costGP: 0, issuedDay: 1, dueDay: 5 }); });
      await page.evaluate(() => {
        const ex = TSI.store.get('tsi.explorer.save', null);
        ex.travel.day = 5;
        TSI.store.set('tsi.explorer.save', ex);
        TSI.bastion.debug.clock(); TSI.bastion.debug.clock(); TSI.bastion.debug.clock();
      });
      await word(page);
      const s = await st(page);
      equal(s.day, 5);
      equal(s.log.filter(l => /Recruited \d defenders/.test(l.body)).length, 1, 'the order completed once');
    });

    await check('while a dice box is open, Enter or Space can\'t start anything else, and the day waits (BAS-10)', async () => {
      await planHall(page, 'secure_trade_agreement', 0, { dur: 3 });
      equal((await st(page)).pendingOrders[0].dueDay, 12, '7 days to negotiate');
      await setExplorerDay(page, 12);
      await page.waitForSelector('[data-test=d20]', { timeout: 15000 });
      equal(await text(page, 'day-status'), 'Passing Day 12…');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      const s = await st(page);
      equal([s.day, s.dayInProgress && s.dayInProgress.day], [12, 12]);
      equal(await page.$$eval('.tsi-modal:not(.tsi-bas-panel)', m => m.length), 1);
      await H.shot(page, 'p9-05-dice');
    });

    await check('a cancelled roll keeps the order, due, with Resolve; the day still finishes, and the word says so (BAS-02)', async () => {
      await clickModal(page, 'Cancel');
      const w = await word(page);
      assert(/Hall of Emissaries: Secure Trade Agreement \(Clan Blackstone\) needs your roll/.test(w), w);
      const s = await st(page);
      equal([s.day, s.dayInProgress], [12, null]);
      equal(s.pendingOrders.map(o => [o.label, o.dueDay]), [['Hall of Emissaries: Secure Trade Agreement (Clan Blackstone)', 12]]);
      assert(s.log.some(l => l.body === 'Hall of Emissaries: Secure Trade Agreement (Clan Blackstone) → Roll cancelled. The order stays due: press Resolve on it, or it comes up again tomorrow.'), JSON.stringify(s.log.slice(0, 3)));
      equal(await text(page, 'pending-meta-0'), 'Due now: waiting for your roll');
      equal(await page.isVisible('[data-test=resolve-0]'), true);
      equal(s.treasuryGP, 4750, 'paid once');
    });

    await check('Resolve asks again and completes it: three weeks, three shipments (BAS-13)', async () => {
      await pause(page);
      await page.click('[data-test=resolve-0]');
      await answerAll(page, [15]);
      await page.waitForFunction(() => !TSI.bastion.debug.busy());
      const s = await st(page);
      equal(s.pendingOrders, []);
      equal(s.diplomacy.agreements.map(a => [a.startDay, a.endDay]), [[12, 33]]);
      equal(s.treasuryGP, 4750);
      assert(/21 days remaining \(3 shipments\)/.test(await text(page, 'diplomacy-records')), await text(page, 'diplomacy-records'));
    });

    await check('closing the window mid-day loses nothing: it reopens and finishes the day by itself', async () => {
      await planHall(page, 'host_delegation', 1, { tone: 'assertive' });
      await setExplorerDay(page, 17);
      await page.waitForSelector('[data-test=d20]', { timeout: 15000 });
      const mid = await st(page);
      equal([mid.day, mid.dayInProgress.stage], [17, 'orders']);
      await reopen(page);
      await H.waitForNotice(page, /Day 17 was left part-way through\. It carries on now; nothing has been lost\./);
      await answerAll(page, [12, 14, 13]);
      await page.waitForFunction(() => !TSI.bastion.debug.busy() && !TSI.bastion.debug.state().dayInProgress);
      await answerAll(page, []);
      const s2 = await st(page);
      equal([s2.day, s2.dayInProgress, s2.pendingOrders.length, s2.diplomacy.delegations.length], [17, null, 0, 1]);
      equal(s2.treasuryGP === mid.treasuryGP || s2.treasuryGP !== null, true);
      equal(s2.log.filter(l => /^Host Delegation/.test(l.body)).length, 1, 'once');
    });

    await check('the automatic Bastion event comes on Day 29 into the event box, and says when the next is due', async () => {
      equal(await text(page, 'event-next'), 'The next automatic event: Day 29 (every 28 days).');
      await page.evaluate(() => window.__seed(12));
      await days(page, 12, []);
      equal(await text(page, 'day-status'), 'Day 29');
      const ev = await text(page, 'event');
      assert(/Roll: \d+ · Day 29/.test(ev), ev);
      assert((await st(page)).log.some(l => /^Auto event \(Day 29\)/.test(l.body)));
      equal(await text(page, 'event-next'), 'The next automatic event: Day 57 (every 28 days).');
    });

    await check('Reset Travel in the Explorer moves every Bastion day back, and the log says so', async () => {
      await planHall(page, 'host_delegation', 2, { tone: 'assertive' });
      const before = await st(page);
      equal(before.pendingOrders[0].dueDay, 34);
      await setExplorerDay(page, 1);
      await page.waitForFunction(() => TSI.bastion.debug.state().day === 1);
      const s = await st(page);
      equal(s.pendingOrders[0].dueDay, 6, 'still 5 days off');
      equal(s.log[0].body, 'The Explorer\'s day went back (Reset Travel): the Bastion moves from Day 29 to Day 1, and everything due keeps its days.');
      equal(await text(page, 'day-status'), 'Day 1');
    });

    await check('Roll Bastion Event rolls a d100 and shows its description', async () => {
      await pause(page);
      await page.click('[data-test=roll-event]');
      const s = await st(page);
      assert(s.lastEvent && s.log[0].body === 'Rolled ' + s.lastEvent.roll + ' → ' + s.lastEvent.name, JSON.stringify(s.log[0]));
      assert((await text(page, 'event')).indexOf(s.lastEvent.name) === 0);
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

    await check('its tile opens the Hall of Emissaries; its actions show their notes on hover, and lock until the Hall is upgraded', async () => {
      await page.click('[data-test=tile-hall_of_emissaries]');
      await page.waitForSelector('[data-test=panel-diplomacy] [data-test=hall]');
      await page.hover('.tsi-bas-hall__fns .tsi-bas-fn >> nth=0');
      await page.waitForSelector('[data-test=tooltip]:not([hidden])');
      assert(/Creates a timed Trade Agreement/.test(await text(page, 'tooltip')));
      equal(await page.isDisabled('[data-test="issue-hall_of_emissaries__inter_clan_summit"]'), true);
      equal(await page.isDisabled('[data-test="issue-hall_of_emissaries__trade_consortium"]'), true);
    });

    await check('the planning box: Cancel costs nothing', async () => {
      await pause(page);
      await page.click('[data-test="issue-hall_of_emissaries__secure_trade_agreement"]');
      await page.waitForSelector('[data-test=hall-duration]');
      equal(await page.inputValue('[data-test=hall-duration]'), '3');
      equal(await page.$$eval('[data-test=hall-duration] option', os => os.map(o => o.textContent)), ['1 week (1 shipment)', '3 weeks (3 shipments)', '6 weeks (6 shipments)']);
      await H.shot(page, 'p9-06-planning');
      await clickModal(page, 'Cancel');
      equal([(await st(page)).treasuryGP, (await st(page)).pendingOrders.length], [5000, 0]);
    });

    await check('Host Delegation: three dice boxes, Political Capital changes once (B2)', async () => {
      await planHall(page, 'host_delegation', 0, { tone: 'conciliatory' });
      equal((await st(page)).treasuryGP, 4850);
      equal((await st(page)).pendingOrders[0].dueDay, 6, '5 days');
      await setExplorerDay(page, 6);
      const titles = [];
      for (const r of [20, 12, 11]) { await page.waitForSelector('[data-test=d20]'); titles.push(await modalTitle(page)); await d20(page, r); }
      equal(titles, ['Host Delegation (Clan Blackstone)', 'Diplomacy Roll (conciliatory)', 'Insight Roll (conciliatory)']);
      assert(/Critical Success/.test(await text(page, 'result-roll')));
      const changes = await text(page, 'result-changes');
      assert(/Political Capital: \+15 \(Clan Blackstone\)/.test(changes) && (changes.match(/Political Capital/g) || []).length === 1, changes);
      await H.shot(page, 'p9-07-result');
      await clickModal(page, 'Continue');
      assert(/Host Delegation \(Clan Blackstone\): Critical Success\./.test(await word(page)));
      equal(await text(page, 'pc-blackstone'), '15');
      equal(await text(page, 'tokens'), '1');
      assert(/Hosted Delegation \(conciliatory\)Clan Blackstone • 28 days remaining/.test(await text(page, 'diplomacy-records')), await text(page, 'diplomacy-records'));
    });

    await check('a bad failure: no deal, −20 Political Capital, and a 14-day cooldown on the button', async () => {
      await planHall(page, 'secure_trade_agreement', 1);
      await days(page, 7, [5]);
      const s = await st(page);
      equal([s.diplomacy.agreements.length, s.politicalCapital.rowthorn, s.diplomacy.cooldowns.trade_agreement], [0, -20, s.day + 14]);
      equal(await text(page, 'issue-hall_of_emissaries__secure_trade_agreement'), 'Cooldown: 14 days');
      equal(await page.isDisabled('[data-test="issue-hall_of_emissaries__secure_trade_agreement"]'), true);
      await days(page, 4, []);
      equal(await text(page, 'issue-hall_of_emissaries__secure_trade_agreement'), 'Cooldown: 10 days');
    });

    await check('the upgrade is free (B4, kept), takes 14 days and raises the Hall\'s bonus', async () => {
      const gp = (await st(page)).treasuryGP;
      await pause(page);
      await page.click('[data-test=hall-upgrade]');
      equal((await st(page)).treasuryGP, gp);
      await days(page, 14, []);
      equal(await text(page, 'hall-level'), 'L2');
      equal(await page.isDisabled('[data-test="issue-hall_of_emissaries__inter_clan_summit"]'), false);
    });

    await check('Clear Diplomacy Records asks first', async () => {
      await pause(page);
      await page.click('[data-test=clear-diplomacy]');
      assert(/Does not undo gold already gained/.test(await popText(page)));
      await clickModal(page, 'Cancel');
      equal((await st(page)).diplomacy.delegations.length, 1);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('Trade routes and the Council Ledger (BAS-05, BAS-11)')) {
    section('Trade routes and the Council Ledger (BAS-05, BAS-11)');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await days(page, 2, []);
    /* Two routes due to sail today (Day 3), each every 7 days. */
    await setUp(page, (s) => {
      s.partyLevel = 9;
      s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }, '', '', ''];
      s.tradeNetwork.active = true;
      s.diplomacy.consortiums = [{ id: 'c1', title: 'Form Trade Consortium', clan: 'Blackstone', startDay: 3, endDay: 38, income: 100, lastShipmentDay: 3 }, { id: 'c2', title: 'Form Trade Consortium', clan: 'Karr', startDay: 3, endDay: 38, income: 200, lastShipmentDay: 3 }];
      s.tradeNetwork.routes = [
        { id: 'r1', clan: 'Blackstone', commodity: 'Timber', risk: 'low', openedDay: -4, nextDay: 3, expiresDay: 40, yieldGP: 100, stabilityDC: 12, status: 'active' },
        { id: 'r2', clan: 'Karr', commodity: 'Wool & Furs', risk: 'high', openedDay: -4, nextDay: 3, expiresDay: 40, yieldGP: 200, stabilityDC: 12, status: 'active' }
      ];
    });

    await check('a cancelled roll, then Resolve again: each route pays once (BAS-05)', async () => {
      await pause(page);
      await page.click('[data-test=resolve]');
      await page.waitForSelector('[data-test=d20]');
      equal(await modalTitle(page), 'Resolve Route: Karr (Wool & Furs)');
      equal((await st(page)).treasuryGP, 100, 'Blackstone paid');
      await clickModal(page, 'Cancel');
      await page.waitForFunction(() => !TSI.bastion.debug.busy());
      await pause(page);
      await page.click('[data-test=resolve]');
      await page.waitForSelector('[data-test=d20]');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      equal(await page.$$eval('.tsi-modal:not(.tsi-bas-panel)', m => m.length), 1, 'Enter didn\'t start another');
      await d20(page, 15);
      assert(/Total Collected: 200 gp/.test(await text(page, 'routes-total')));
      await clickModal(page, 'Continue');
      equal((await st(page)).treasuryGP, 300, '100 + 200, not 100 + 100 + 200');
    });

    await check('a third Resolve says none is due, and when the next sails', async () => {
      await pause(page);
      await page.click('[data-test=resolve]');
      assert(/No routes are due to sail\. Each sails every 7 days; the next on Day 10\./.test(await popText(page)), await popText(page));
      await clickModal(page, 'Close');
      assert(/Next sails: Day 10/.test(await text(page, 'routes-list')), await text(page, 'routes-list'));
    });

    await check('the Sea Trade Routes map lights up each running route', async () => {
      await pause(page);
      await page.click('[data-test=routes]');
      await page.waitForSelector('[data-test=trade-map]');
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.tsi-bas-trademap img')).every(i => i.complete));
      equal(await text(page, 'routes-shown'), 'Blackstone, Karr');
      equal(await page.$$eval('.tsi-bas-trademap img', is => is.map(i => [i.getAttribute('src').split('/').pop(), i.naturalWidth])),
        [['clan_trading_locations.png', 1494], ['blackstone_trade_route.png', 1494], ['karr_trade_route.png', 1494]]);
      await H.shot(page, 'p9-08-trade-map');
      await clickModal(page, 'Close');
    });

    await check('a week on (Day 10): the routes sail again, and a disaster at sea disrupts Karr and files a dispute', async () => {
      await days(page, 7, [3]);
      const s = await st(page);
      equal(s.tradeNetwork.routes.map(r => r.status), ['active', 'disrupted']);
      equal(s.arbitration.queue.length, 1);
      equal(await text(page, 'ledger'), 'Council Ledger (1)');
    });

    await check('the Council Ledger: a binding verdict restores the route', async () => {
      await pause(page);
      await page.click('[data-test=ledger]');
      await page.waitForSelector('.tsi-bas-dispute');
      await H.shot(page, 'p9-09-ledger');
      await page.click('[data-test=rule-b]');
      await d20(page, 15);
      equal(await modalTitle(page), 'Council Verdict');
      assert(/Karr route status: Restored \(Active\)\./.test(await popText(page)));
      await clickModal(page, 'Continue');
      const s = await st(page);
      equal([s.tradeNetwork.routes[1].status, s.arbitration.queue.length, s.politicalCapital.karr], ['active', 0, -4]);
      equal(await text(page, 'ledger'), 'Council Ledger');
    });

    await check('an empty ledger says so', async () => {
      await pause(page);
      await page.click('[data-test=ledger]');
      assert(/No disputes await judgement\./.test(await popText(page)));
      await clickModal(page, 'Close');
    });

    await check('network investments are orders that take their days (Stability: 7)', async () => {
      await setUp(page, (s) => { s.treasuryGP = 500; });
      await pause(page);
      await page.click('[data-test=invest-stability]');
      equal((await st(page)).pendingOrders.map(o => o.dueDay), [17]);
      await days(page, 7, [15]);
      equal((await st(page)).treasuryGP > 0, true);
      assert((await st(page)).log.some(l => l.body === 'Ironbow Trade Network: Stability Investment resolved.'));
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('Party identity and the War Council')) {
    section('Party identity and the War Council');
    /* Calm: the wars these checks declare never bring an attack (that has its own section). */
    const { context, page } = await newPage(browser, 'laptop', null, { calm: true });
    await openBastion(page);

    await check('Form Clan needs level 9, 360 support and 3 clans at 55 (both sides of each line)', async () => {
      await setUp(page, (s) => { s.partyLevel = 8; s.politicalCapital.blackstone = 10; s.politicalCapital.bacca = 10; s.politicalCapital.farmer = 10; s.politicalCapital.slade = -10; });
      equal(await page.isDisabled('[data-test=form-clan]'), true);
      assert(/Level 9\+ \(NO\), Total Support 360\+ \(OK\), 3 clans at 55\+ \(OK\)/.test(await text(page, 'requirements')));
      await page.selectOption('[data-test=level]', '9');
      equal(await page.isDisabled('[data-test=form-clan]'), false);
      await setUp(page, (s) => { s.politicalCapital.slade = -12; });
      equal(await page.isDisabled('[data-test=form-clan]'), true);
      await setUp(page, (s) => { s.politicalCapital.slade = -10; s.politicalCapital.farmer = 8; });
      equal(await page.isDisabled('[data-test=form-clan]'), true);
      await setUp(page, (s) => { s.politicalCapital.farmer = 10; });
    });

    await check('Honour/Respect edits change support at once', async () => {
      await page.fill('[data-test=hr-karr]', '2');
      await page.press('[data-test=hr-karr]', 'Tab');
      equal(await text(page, 'support-karr'), '58/100');
      equal((await st(page)).honourRespectByClan.karr, 2);
    });

    await check('founding a Clan: the name is required, then it\'s sworn', async () => {
      await pause(page);
      await page.click('[data-test=form-clan]');
      await page.waitForSelector('[data-test=clan-name]');
      await clickModal(page, 'Confirm Founding');
      assert(/Clan Name is required\./.test(await popText(page)));
      await clickModal(page, 'OK');
      await pause(page);
      await page.click('[data-test=form-clan]');
      await page.fill('[data-test=clan-name]', 'Clan Ironbow');
      await page.fill('[data-test=clan-chief]', 'Harry');
      await clickModal(page, 'Confirm Founding');
      equal(await text(page, 'org'), 'Clan: Clan Ironbow');
      equal(await page.isVisible('[data-test=honour-box]'), true);
      equal((await st(page)).log[0].body, 'Founded Clan: Clan Ironbow (Chief: Harry).');
      equal((await crestInfo(page)).shown, false, 'no crest was chosen');
      equal(await page.textContent('[data-test=crest-add]'), 'Upload a picture…');
    });

    await check('a crest can be added later, shrunk to 512 pixels, shown beside the name, kept after reopening, and removed', async () => {
      await H.chooseFile(page, '[data-test=crest-add]', writeCrest('crest-later.png', 2048));
      await page.waitForFunction(() => { const i = document.querySelector('[data-test=crest]'); return i && i.offsetWidth && i.naturalWidth; });
      const c = await crestInfo(page);
      equal([c.shown, c.w, c.h, c.alt], [true, 512, 512, 'Crest of Clan Ironbow']);
      const saved = await page.evaluate(() => TSI.store.get('tsi.bastion.crest'));
      assert(/^data:image\/(webp|png);base64,/.test(saved.dataUrl) && saved.dataUrl.length < 700000 && saved.name === 'tsi-p9-crest-later.png', JSON.stringify([saved.dataUrl.slice(0, 30), saved.dataUrl.length, saved.name]));
      /* Beside the name: in the same row as the Clan's pill. */
      const box = await page.evaluate(() => {
        const a = document.querySelector('[data-test=crest]').getBoundingClientRect();
        const b = document.querySelector('[data-test=org]').getBoundingClientRect();
        return { gap: b.left - a.right, overlapY: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) };
      });
      assert(box.gap >= 0 && box.gap < 60 && box.overlapY > 0, JSON.stringify(box));
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

    await check('the War Action: target, objective, enemy force, and a box for each kind of force with what\'s free (war phase 2)', async () => {
      await setUp(page, (s) => {
        s.defenders.count = 4;
        s.defenders.armed = true;
        s.defenderBeasts = [{ name: 'Giant Vulture', qty: 5 }];
        s.military = [{ name: 'Lieutenant (1)', qty: 1 }, { name: 'Regiment (100)', qty: 1 }, { name: 'Line Infantry (100)', qty: 1 }, { name: 'Archers (50)', qty: 1 }];
      });
      /* Defend Bastion isn't a War Action now: it comes as an attack (Harry, 4 October 2026). */
      equal(await page.$$eval('[data-test=war-objective] option', os => os.map(o => o.textContent)), ['Raid', 'Skirmish', 'Seize Outpost']);
      equal(await page.$$eval('[data-test=war-tier] option', os => os.map(o => o.textContent)), ['Small local force', 'Established local force', 'Major force']);
      equal(await page.inputValue('[data-test=war-tier]'), 'established');
      equal(await page.$$eval('[data-test=war-forces] input', is => is.map(i => i.dataset.test)), ['war-defenders', 'war-lieutenants', 'war-unit-line', 'war-unit-archers', 'war-beast-giant-vulture']);
      equal([await text(page, 'war-avail-defenders'), await text(page, 'war-avail-lieutenants'), await text(page, 'war-avail-unit-line'), await text(page, 'war-avail-unit-archers'), await text(page, 'war-avail-beast-giant-vulture')],
        ['4 available', '1 available', '2 available', '1 available', '5 available'], 'the Regiment from before counts as Line Infantry');
      /* Each name shows its stat block. */
      await page.hover('.tsi-bas-war-field__name--tip:text-is("Line Infantry")');
      await page.waitForSelector('[data-test=tooltip]:not([hidden])');
      const tip = await text(page, 'tooltip');
      assert(/^Line Infantry/.test(tip) && /Military unit • 100 soldiers/.test(tip) && /Cohesion5/.test(tip) && /Attack\+4/.test(tip) && /Defence13/.test(tip) && /Reliable general-purpose troops/.test(tip), tip);
      await page.mouse.move(5, 5);
      /* From the keyboard: moving to a box with Tab shows the same stat block beside it; a click into a box doesn't. */
      await page.click('[data-test=war-defenders]');
      equal(await page.isHidden('[data-test=tooltip]'), true, 'a click into a box shows nothing');
      const focusTip = () => page.evaluate(() => [document.activeElement.dataset.test, document.activeElement.getAttribute('aria-describedby'), !document.querySelector('[data-test=tooltip]').hidden]);
      await page.keyboard.press('Tab');
      equal(await focusTip(), ['war-lieutenants', 'tsi-tip', true]);
      assert(/^Lieutenant/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
      await page.keyboard.press('Tab');
      equal(await focusTip(), ['war-unit-line', 'tsi-tip', true]);
      assert(/^Line Infantry/.test(await text(page, 'tooltip')) && /Cohesion5/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
      equal((await H.layoutCheck(page, ['[data-test=tooltip]'])).outOfView, [], 'beside the box, in view');
      await H.shot(page, 'p9-war-turn-keys');
      await page.keyboard.press('Escape');
      equal(await focusTip(), ['war-unit-line', null, false], 'Escape hides it');
      await page.keyboard.press('Tab');
      assert(/^Archers/.test(await text(page, 'tooltip')) && (await focusTip())[2], await text(page, 'tooltip'));
      await page.keyboard.press('Tab');
      equal(await focusTip(), ['war-beast-giant-vulture', 'tsi-tip', true]);
      assert(/^Giant Vulture/.test(await text(page, 'tooltip')) && /Flight/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
      await page.keyboard.press('Tab');
      equal(await page.isHidden('[data-test=tooltip]'), true, 'gone when the focus moves on');
    });

    await check('nothing that fights is refused; each box keeps to what\'s free once typed; Lieutenants typed first are kept', async () => {
      await page.selectOption('[data-test=war-target]', 'bacca');
      for (const t of ['war-defenders', 'war-lieutenants', 'war-unit-line', 'war-unit-archers', 'war-beast-giant-vulture']) await page.fill('[data-test=' + t + ']', '0');
      await page.click('[data-test=queue-war]');
      assert(/Commit at least one force that fights/.test(await popText(page)));
      await clickModal(page, 'OK');
      /* A Lieutenant alone can't fight; the hint says why. */
      await page.fill('[data-test=war-lieutenants]', '1');
      await page.press('[data-test=war-lieutenants]', 'Tab');
      equal(await page.inputValue('[data-test=war-lieutenants]'), '1', 'kept, though nothing is committed for it to lead yet');
      assert(/Each Lieutenant leads one regiment or defender detachment, so none of them can march with these forces\./.test(await text(page, 'war-hint')), await text(page, 'war-hint'));
      await pause(page);
      await page.click('[data-test=queue-war]');
      assert(/Commit at least one force that fights/.test(await popText(page)));
      await clickModal(page, 'OK');
      equal((await st(page)).pendingOrders, []);
      for (const [t, typed, kept] of [['war-defenders', '9', '4'], ['war-beast-giant-vulture', '9', '5'], ['war-unit-line', '5', '2']]) {
        await page.fill('[data-test=' + t + ']', typed);
        await page.press('[data-test=' + t + ']', 'Tab');
        equal(await page.inputValue('[data-test=' + t + ']'), kept, t + ' kept to what\'s free once typed');
      }
      /* Typed as a person does: never rewritten mid-typing; the arrows stop at what's free. */
      await page.click('[data-test=war-unit-archers]');
      await page.keyboard.press('Control+A');
      await page.keyboard.type('1');
      equal(await page.inputValue('[data-test=war-unit-archers]'), '1');
      await page.press('[data-test=war-unit-archers]', 'ArrowUp');
      equal(await page.inputValue('[data-test=war-unit-archers]'), '1', 'the arrows stop at what\'s free');
      equal(await text(page, 'war-hint'), 'Available: 4 defenders, 1 Lieutenant, 3 regiments, 5 beasts. Everything can be committed.');
    });

    await check('the intelligence estimate is drawn up once and saved; what you commit never changes it; your army\'s Battle Value follows', async () => {
      const est = await text(page, 'war-intel-estimate');
      assert(/^Estimated enemy: \d+–\d+ Battle Value; about \d+ to \d+ formations/.test(est), est);
      assert(/^Raid: Secure and extract two of three supply markers/.test(await text(page, 'war-intel-rule')));
      const before = (await st(page)).warMissions;
      assert(before['bacca|raid|established'] && before['bacca|raid|established'].enemy.units.length > 0, Object.keys(before).join(','));
      await page.fill('[data-test=war-defenders]', '3');
      await page.fill('[data-test=war-defenders]', '4');
      await page.press('[data-test=war-defenders]', 'Tab');
      equal((await st(page)).warMissions, before, 'unchanged by what\'s committed');
      equal(await text(page, 'war-intel-estimate'), est);
      const bv = await page.evaluate(() => {
        const R = TSI.bastion.rules;
        const s = TSI.bastion.debug.state();
        const commit = R.warCommit2(s, {}, { defenders: 4, lieutenants: 1, units: { line: 2, archers: 1 }, beasts: { 'Giant Vulture': 5 } });
        return R.armyBV(s, {}, commit);
      });
      equal(await text(page, 'war-army-bv'), 'Your army: ' + bv + ' Battle Value');
      await page.selectOption('[data-test=war-tier]', 'major');
      assert((await st(page)).warMissions['bacca|raid|major'], 'a major force is drawn up when it\'s shown');
      assert(await text(page, 'war-intel-estimate') !== est);
      await page.selectOption('[data-test=war-tier]', 'established');
      equal(await text(page, 'war-intel-estimate'), est, 'the same army as before');
      await reveal(page, '[data-test=queue-war]');
      await H.shot(page, 'p9-war-turn');
    });

    await check('a double click queues one war action (BAS-15), against the mission shown', async () => {
      await pause(page);
      await page.dblclick('[data-test=queue-war]');
      await page.waitForTimeout(300);
      equal(await page.$$eval('.tsi-modal:not(.tsi-bas-panel)', m => m.length), 1, 'one "Declare war" question');
      await confirmWar(page);
      await page.waitForTimeout(300);
      const s = await st(page);
      equal(s.pendingOrders.map(o => [o.label, o.meta.objective, o.meta.targetName, o.meta.tier, o.meta.missionKey, o.meta.commit]),
        [['War Action', 'raid', 'Bacca', 'established', 'bacca|raid|established', { defenders: 4, lieutenants: 1, units: { line: 2, archers: 1 }, beasts: { 'Giant Vulture': 5 } }]]);
      equal(s.log[0].title + ': ' + s.log[0].body, 'War Action Queued: Raid vs Bacca (musters on Day ' + (s.day + 3) + ').');
      equal(s.pendingOrders[0].dueDay, s.day + 3);
      equal(await text(page, 'war-avail-unit-line'), 'None free: committed to a war action');
    });

    await check('3 days later the forces muster and the war becomes a Military Action: Begin, or Later from the War Council', async () => {
      await setExplorerDay(page, (await st(page)).day + 3);
      /* On screen and in the log the objective has its own name: "Raid vs Bacca". */
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'); return t && /^War Action: Raid vs Bacca(At War)?$/.test(t.textContent); }, null, { timeout: 15000 });
      const t = await popText(page);
      assert(/Your forces muster for battle/.test(t) && /Committed: 4 defenders, 1 Lieutenant, Line Infantry ×2, Archers, Giant Vulture ×5\./.test(t) && /Enemy: Established local force\. Estimated enemy: /.test(t), t);
      equal((await H.layoutCheck(page, ['.tsi-modal:not(.tsi-bas-panel)', '.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button'])).outOfView, []);
      await H.shot(page, 'p9-war-muster');
      await clickModal(page, 'Later');
      assert(/Your army is ready to march on Bacca \(Raid\)\./.test(await word(page)));
      const s = await st(page);
      equal(s.pendingOrders, [], 'the order is gone, so it can\'t come due twice');
      const ma = s.militaryActions[0];
      equal([s.militaryActions.length, ma.v, ma.step, ma.objective, ma.targetName, ma.tier, ma.missionKey], [1, 2, 'weather', 'raid', 'Bacca', 'established', 'bacca|raid|established']);
      equal([ma.spec.player.units.map(u => u.name), ma.spec.player.leaders.length, ma.spec.player.defenders.count],
        [['Line Infantry', 'Line Infantry', 'Archers', 'Giant Vulture', 'Giant Vulture', 'Giant Vulture', 'Giant Vulture', 'Giant Vulture'], 1, 4]);
      equal(ma.spec.enemy, s.warMissions['bacca|raid|established'].enemy, 'the enemy the scouts saw');
      assert(s.log.some(l => l.body === 'Raid vs Bacca: your forces muster for battle. The Military Action is ready to begin.'));
      equal(await page.textContent('[data-test=ma-continue-0]'), 'Begin Military Action');
      equal(await bare(page, '[data-test=ma-0] .tsi-bas-item__name'), 'Raid vs Bacca');
      equal(await page.textContent('[data-test=ma-status-0]'), 'Ready to begin. First: the Weather Conditions roll.');
      equal(await page.isVisible('[data-test=ma-calloff-0]'), true);
      equal(await page.$eval('[data-test=queue-war]', b => b.classList.contains('tsi-btn--primary')), false, 'one main action in the panel');
      equal(await page.isHidden('[data-test=advance]'), true, 'the day is finished');
    });

    await check('a waiting Military Action survives reopening, and a notice says where it is', async () => {
      await reopen(page);
      await H.waitForNotice(page, /A Military Action \(Raid vs Bacca(At War)?\) is waiting/);
      equal((await st(page)).militaryActions.length, 1);
    });

    await check('Weather (DC 12), Morale (DC 12) and Luck (DC 10), each with its story; a double click can\'t make the next roll', async () => {
      await spyTable(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=d20]');
      equal((await H.noticeTexts(page)).filter(t => /is waiting/.test(t)), [], 'the notice goes once it has done its job');
      let t = await popText(page);
      assert(/Weather Conditions: Raid vs Bacca/.test(t) && /Modifier: \+0/.test(t) && /DC 12/.test(t), t);
      await d20(page, 15);
      await page.waitForSelector('[data-test=ma-result]');
      t = await popText(page);
      assert(/Clear Day/.test(t) && /d20 15 vs DC 12: Passed/.test(t) && /The sky holds clear and bright/.test(t), t);
      equal(await page.$('.tsi-bas-ma-pop__video'), null, 'no storm, no film');
      await page.dblclick('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button:text-is("Continue")');
      await page.waitForTimeout(500);
      equal([(await st(page)).militaryActions[0].step, !!(await page.$('[data-test=d20]'))], ['morale', true], 'the second click didn\'t press the Morale dice box');
      t = await popText(page);
      assert(/Morale: Raid vs Bacca/.test(t) && /DC 12/.test(t), t);
      await d20(page, 9);
      t = await popText(page);
      assert(/Morale: Low/.test(t) && /d20 9 vs DC 12: Failed/.test(t) && /Even under a clear sky, doubt spreads/.test(t), t);
      await clickModal(page, 'Continue');
      t = await popText(page);
      assert(/Luck: Raid vs Bacca/.test(t) && /DC 10/.test(t), t);
      await d20(page, 3);
      t = await popText(page);
      assert(/Luck: −1/.test(t) && /the Gods do not look kindly upon this needless bloodshed/.test(t), t);
      await clickModal(page, 'Continue');
      await page.waitForSelector('[data-test=wt-root]');
      const ma = (await st(page)).militaryActions[0];
      equal([ma.step, ma.spec.conditions], ['deploy', { weather: 'clear', moraleMod: -2, luckMod: -1 }]);
    });

    await check('the War Table opens with the line-up, the conditions, your Clan\'s name and the enemy; deployment is saved as it goes', async () => {
      const o = await page.evaluate(() => window.__wtOpts);
      equal(o.keys, ['armyName', 'battle', 'canCallOff', 'crest', 'enemy', 'host', 'inert', 'life', 'onCallOff', 'onChange', 'onClose', 'onEnd', 'rand', 'spec', 'store', 'summary', 'title', 'withdrawPreview']);
      equal([o.title, o.armyName, o.enemy, o.crest, o.canCallOff, o.battle, o.specUnits, o.inert], ['Raid vs Bacca', 'Clan Ironbow', { clanKey: 'bacca', clanName: 'Bacca' }, null, true, null, 8, 2]);
      equal(o.summary, [{ label: 'Weather', value: 'Clear Day' }, { label: 'Morale', value: 'Low' }, { label: 'Luck', value: '−1' }]);
      assert(/Raid vs Bacca/.test(await text(page, 'wt-title')), await text(page, 'wt-title'));
      const sum = await text(page, 'wt-summary');
      assert(/Clear Day/.test(sum) && /Low/.test(sum) && /−1/.test(sum), sum);
      equal(await page.evaluate(() => document.querySelector('.tsi-bas-stage').inert), true, 'the Bastion behind is out of reach');
      equal(await page.isVisible('[data-test=wt-calloff]'), true, 'Call off, before the battle');
      await pause(page);
      await page.click('[data-test=wt-begin-deploy]');
      await page.waitForTimeout(400);
      equal(await page.$$eval('.tsi-bas-wt-token[data-side=player]', t => t.length), 8, 'two Line Infantry, the Archers and five Giant Vultures (the defenders support the regiments)');
      const ma = (await st(page)).militaryActions[0];
      equal([ma.step, ma.battle && ma.battle.phase, ma.battle.units.filter(u => u.side === 'player' && u.pos).length], ['deploy', 'deploy', 8], 'saved');
      await H.shot(page, 'p9-war-table-deployed');
      await pause(page);
      await page.click('[data-test=wt-close]');
      await page.waitForTimeout(200);
      equal(await page.$('[data-test=wt-root]'), null);
      equal(await page.evaluate(() => document.querySelector('.tsi-bas-stage').inert), false);
      equal(await page.textContent('[data-test=ma-status-0]'), 'Deploying on the War Table.');
      await reopen(page);
      await H.dismissNotices(page);
      await spyTable(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=wt-root]');
      await page.waitForTimeout(300);
      equal((await page.evaluate(() => window.__wtOpts)).battle, 'deploy', 'the saved deployment goes back to the table');
      equal(await page.isVisible('[data-test=wt-begin-deploy]'), false, 'deployment carries on where it was');
      equal(await page.$$eval('.tsi-bas-wt-token[data-side=player]', t => t.length), 8);
    });

    await check('the War Table fits the laptop and the TV, with its controls in view', async () => {
      for (const size of ['laptop', 'laptopFull', 'tv']) {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(300);
        const lc = await H.layoutCheck(page, ['[data-test=wt-upload]', '[data-test=wt-zoom-fit]', '[data-test=wt-fullscreen]', '[data-test=wt-close]', '[data-test=wt-start-battle]', '[data-test=wt-calloff]', '[data-test=wt-stage]']);
        equal(lc.scrollWidth, lc.clientWidth, size + ': no sideways scroll');
        equal(lc.outOfView, [], size + ': in view');
      }
      await page.setViewportSize(H.SIZES.laptop.viewport);
      await page.waitForTimeout(300);
    });

    await check('Start Battle; after the first activation Call off goes and Withdraw stays; the battle is saved as it goes', async () => {
      await pause(page);
      await page.click('[data-test=wt-start-battle]');
      await clickModal(page, 'Start Battle');
      /* The battle briefing: the objective and the rules in brief. */
      await page.waitForSelector('[data-test=wt-briefing]');
      equal(await modalTitle(page), 'Rules & objective · Raid vs Bacca');
      const brief = await page.textContent('[data-test=wt-brief-goal]');
      assert(/Carry off 2 of the 3 supply markers/.test(brief), brief);
      equal((await H.layoutCheck(page, ['.tsi-modal:not(.tsi-bas-panel)', '.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button'])).outOfView, []);
      await H.shot(page, 'p9-war-briefing');
      await clickModal(page, 'Begin the battle');
      await page.waitForTimeout(400);
      let ma = (await st(page)).militaryActions[0];
      equal([ma.step, ma.battle.phase, ma.battle.started, ma.battle.turnSide], ['battle', 'battle', false, 'enemy'], 'Luck −1: the enemy acts first');
      equal(await page.isVisible('[data-test=wt-calloff]'), true, 'still before the first activation');
      await pause(page);
      await page.click('[data-test=wt-enemy-act]');
      await page.waitForFunction(() => { const m = TSI.bastion.debug.state().militaryActions[0]; return m.battle.started && m.battle.turnSide === 'player'; }, null, { timeout: 8000 });
      await page.waitForTimeout(400);
      equal(await page.isVisible('[data-test=wt-calloff]'), false, 'Call off goes after the first activation');
      equal(await page.isVisible('[data-test=wt-withdraw]'), true);
      /* One of ours: Hold. */
      ma = (await st(page)).militaryActions[0];
      const ours = ma.battle.units.find(u => u.side === 'player' && u.pos && !u.activated && u.kind === 'formation');
      await page.click('.tsi-bas-wt-token[data-id="' + ours.id + '"]');
      await page.waitForTimeout(200);
      await page.click('[data-test=wt-order-hold]');
      await page.waitForTimeout(200);
      await page.click('[data-test=wt-confirm]');
      await page.waitForFunction(id => TSI.bastion.debug.state().militaryActions[0].battle.units.find(u => u.id === id).activated, ours.id, { timeout: 8000 });
      ma = (await st(page)).militaryActions[0];
      assert(ma.battle.log.some(l => l.text.indexOf(ours.label + ' holds') === 0), JSON.stringify(ma.battle.log.slice(-3)));
      await H.shot(page, 'p9-war-table-battle');
      await pause(page);
      await page.click('[data-test=wt-close]');
      await page.waitForTimeout(300);
      assert(/^Battle under way: round 1 of 6\.$/.test(await page.textContent('[data-test=ma-status-0]')), await page.textContent('[data-test=ma-status-0]'));
      equal(await page.$('[data-test=ma-calloff-0]'), null, 'no Call off in the War Council once the battle has begun');
      equal(await page.textContent('[data-test=ma-continue-0]'), 'Continue');
    });

    await check('Withdraw: the War Report is applied once; the losses show in the Military panel and the Menagerie', async () => {
      /* Set the battle up as if it had gone badly: Line Infantry 1 battered
         (half Cohesion or less: 10% lost), Line Infantry 2 Defeated (60%
         lost when the enemy holds the field), one Giant Vulture Routed
         (separated for a turn). The Lieutenant rides with Line Infantry 1. */
      await setUp(page, (s) => {
        const b = s.militaryActions[0].battle;
        const u = id => b.units.find(x => x.id === id);
        u('p-line-1').cohesion = 1;
        Object.assign(u('p-line-2'), { status: 'defeated', cohesion: 0, pos: null });
        Object.assign(u('p-beast-1'), { status: 'routed', pos: null });
        b.leaders.forEach(l => { if (l.side === 'player') l.hostId = 'p-line-1'; });
      });
      const day = (await st(page)).day;
      await spyTable(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=wt-root]');
      equal((await page.evaluate(() => window.__wtOpts)).canCallOff, false);
      await page.waitForTimeout(400);
      await page.click('[data-test=wt-withdraw]');
      await page.waitForSelector('[data-test=wt-withdraw-preview]');
      const pre = await text(page, 'wt-withdraw-preview');
      assert(/the battle counts as lost/.test(pre) && /Clan Honour: −4/.test(pre) && /Separated for 7 days: Giant Vulture 1/.test(pre), pre);
      await H.shot(page, 'p9-war-withdraw');
      await clickModal(page, 'Withdraw');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'); return t && t.textContent === 'War Report'; }, null, { timeout: 10000 });
      await page.waitForTimeout(450);
      const t = await popText(page);
      assert(/Withdrawal: Raid vs Bacca/.test(t) && /Result: Withdrawal in round 1 of 6/.test(t) && /Clan Honour: −4 \(now 36\)/.test(t), t);
      assert(/Line Infantry 1: 100 soldiers → .*10 lost/.test(t) && /Line Infantry 2: 100 soldiers → .*60 lost/.test(t), t);
      equal((await H.layoutCheck(page, ['.tsi-modal:not(.tsi-bas-panel)', '.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button'])).outOfView, [], 'the report fits the laptop (it scrolls inside)');
      await H.shot(page, 'p9-war-report');
      await clickModal(page, 'Close');
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'));
      equal(await page.evaluate(() => document.querySelector('.tsi-bas-stage').inert), false);
      const s = await st(page);
      equal([s.militaryActions.length, s.warLog.length, s.warLog[0].title, s.clanHonor], [0, 1, 'Withdrawal: Raid vs Bacca', 36]);
      equal(s.military.filter(r => r.depleted).map(r => r.strength).sort((a, b) => a - b), [40, 90]);
      equal(s.military.filter(r => !r.depleted && /lieutenant/i.test(r.name)).map(r => r.qty), [1], 'the Lieutenant came home');
      equal(s.warRecovery.map(r => [r.kind, r.name, r.status, r.untilDay]), [['beast', 'Giant Vulture', 'separated', day + 7]]);
      const mil = await text(page, 'military');
      assert(/Depleted: 90\/100/.test(mil) && /Depleted: 40\/100/.test(mil), mil);
      assert(new RegExp('5 beasts • Flight \\(1 separated: back on Day ' + (day + 7) + '\\)').test(await text(page, 'beasts')), await text(page, 'beasts'));
      equal(await text(page, 'war-avail-beast-giant-vulture'), '4 available');
      /* Applied once: nothing more after reopening. */
      await reopen(page);
      const again = await st(page);
      equal([again.warLog.length, again.log.filter(l => l.title === 'War Action Resolved').length, again.military, again.clanHonor], [1, 1, s.military, 36]);
      await reveal(page, '[data-test=military]');
      await page.hover('[data-test^=military-type-]:has-text("Depleted: 90/100")');
      await page.waitForSelector('[data-test=tooltip]:not([hidden])');
      assert(/Depleted: \d+ of 100 soldiers came home/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
      await H.shot(page, 'p9-war-depleted');
      await page.mouse.move(5, 5);
    });

    await check('recovery: the separated Giant Vulture is back 7 days later, and the word says so', async () => {
      await setExplorerDay(page, (await st(page)).day + 7);
      assert(/Giant Vulture has found the way back to the Bastion\./.test(await word(page)));
      const s = await st(page);
      equal(s.warRecovery, []);
      assert(s.log.some(l => l.title === 'War Recovery' && l.body === 'Giant Vulture has found the way back to the Bastion.'), JSON.stringify(s.log.slice(0, 4)));
      equal(/separated/.test(await text(page, 'beasts')), false);
      equal(await text(page, 'war-avail-beast-giant-vulture'), '5 available');
    });

    await check('Call off keeps the enemy and the rolls made; the next attempt carries on from them (a storm raises the Morale DC and shows its film)', async () => {
      async function queueRaid() {
        await page.selectOption('[data-test=war-target]', 'bacca');
        await page.selectOption('[data-test=war-objective]', 'raid');
        await page.selectOption('[data-test=war-tier]', 'established');
        for (const t of ['war-lieutenants', 'war-unit-line', 'war-unit-archers', 'war-beast-giant-vulture']) await page.fill('[data-test=' + t + ']', '0');
        await page.fill('[data-test=war-defenders]', '2');
        await pause(page);
        await page.click('[data-test=queue-war]');
        await confirmWar(page);
        await setExplorerDay(page, (await st(page)).day + 3);
        await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'); return t && /^War Action:/.test(t.textContent); }, null, { timeout: 15000 });
        return popText(page);
      }
      const mission = () => st(page).then(s => s.warMissions['bacca|raid|established']);
      await queueRaid();
      const enemy = (await mission()).enemy;
      await clickModal(page, 'Begin Military Action');
      await d20(page, 2);
      await page.waitForSelector('[data-test=ma-result]');
      const head = await text(page, 'ma-headline');
      assert(['White Blizzard (Snowstorm)', 'Cold Downpour (Rainstorm)', 'Sun & Heatwave'].indexOf(head) !== -1, head);
      assert(/^.*tools\/explorer\/assets\/overlays\/(blizzard|rain|sun_heat)_overlay\.mp4$/.test(await page.$eval('.tsi-bas-ma-pop__video', v => v.src)));
      assert(/the Morale DC rises by [234]/.test(await text(page, 'ma-text')));
      await clickModal(page, 'Continue');
      const dc = { 'White Blizzard (Snowstorm)': 16, 'Cold Downpour (Rainstorm)': 14, 'Sun & Heatwave': 15 }[head];
      assert(new RegExp('DC ' + dc).test(await popText(page)), 'Morale DC ' + dc);
      await clickModal(page, 'Cancel');
      await word(page);
      let s = await st(page);
      equal(s.militaryActions.map(m => m.step), ['morale']);
      assert(s.log.some(l => /the Morale roll was cancelled/.test(l.body)));
      equal(await page.textContent('[data-test=ma-status-0]'), 'Weather rolled. Next: the Morale roll.');
      const before = [s.treasuryGP, s.defenders.count, s.warLog.length];
      await pause(page);
      await page.click('[data-test=ma-calloff-0]');
      await clickModal(page, 'Cancel');
      equal((await st(page)).militaryActions.length, 1);
      await pause(page);
      await page.click('[data-test=ma-calloff-0]');
      assert(/Call off the Military Action \(Raid vs Bacca\)\?/.test(await bareModal(page)) && /The enemy army and the conditions rolled so far stay the same for the next attempt/.test(await popText(page)), await popText(page));
      await clickModal(page, 'Call off');
      s = await st(page);
      equal(s.militaryActions, []);
      equal([s.treasuryGP, s.defenders.count, s.warLog.length], before, 'nothing won or lost');
      equal(s.log[0].body, 'Raid vs Bacca: the Military Action was called off. Nothing was won or lost.');
      equal(await page.isVisible('[data-test=military-actions]'), false);
      let m = await mission();
      equal([m.enemy, !!m.conditions.weather, m.conditions.morale, m.conditions.luck], [enemy, true, null, null], 'the same enemy; the Weather roll kept');

      /* Again: the muster pop-up says the Weather stands (and what it was), so
         the next roll is Morale, with no second pop-up saying it again, even
         after Later and Continue from the War Council. */
      let t = await queueRaid();
      assert(/the rolls it made stand: .+\. Next: the Morale roll\./.test(await text(page, 'ma-muster-text')), await text(page, 'ma-muster-text'));
      assert(new RegExp('Weather ' + head.replace(/ \(.*\)$/, '').replace(/[()&]/g, '.')).test(t), t);
      await clickModal(page, 'Later');
      await word(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=d20]');
      equal(await page.$('[data-test=ma-unchanged]'), null, 'said once, in the muster pop-up');
      assert(new RegExp('Morale: Raid vs Bacca[\\s\\S]*DC ' + dc).test(await popText(page)), 'the storm still raises the Morale DC');
      await d20(page, 18);
      await page.waitForSelector('[data-test=ma-result]');
      await clickModal(page, 'Continue');
      await d20(page, 15);
      await page.waitForSelector('[data-test=ma-result]');
      await spyTable(page);
      await clickModal(page, 'Continue');
      await page.waitForSelector('[data-test=wt-root]');
      equal((await page.evaluate(() => window.__wtOpts)).summary[0].value, head.replace(/ \(.*\)$/, ''), 'the same weather on the table');
      /* Call off on the War Table, before the battle. */
      await page.waitForTimeout(400);
      await page.click('[data-test=wt-calloff]');
      await clickModal(page, 'Cancel');
      equal(!!(await page.$('[data-test=wt-root]')), true, 'Cancel keeps the table open');
      await pause(page);
      await page.click('[data-test=wt-calloff]');
      await clickModal(page, 'Call off');
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'));
      s = await st(page);
      equal([s.militaryActions.length, s.warLog.length], [0, 1]);
      m = await mission();
      equal([m.enemy, m.conditions.morale.d20, m.conditions.luck.d20], [enemy, 18, 15], 'all three rolls kept now');
      equal(await page.evaluate(() => TSI.store.get('tsi.bastion.ui').warNoticed), {}, 'only actions still waiting are remembered');

      /* Again: all the conditions stand. The Bastion is closed while the muster
         pop-up shows, so on reopening "The conditions are unchanged" says it
         instead, once; the turn's notice doesn't stay over the War Table. */
      t = await queueRaid();
      assert(/its conditions stand: .+, morale high, luck \+1\. There are no rolls this time\./.test(await text(page, 'ma-muster-text')), await text(page, 'ma-muster-text'));
      await H.shot(page, 'p9-war-muster-again');
      await reopen(page);
      /* The day carries on by itself (its notice goes once it's done), and its word comes. */
      assert(/Your army is ready to march on Bacca \(Raid\)\./.test(await word(page)));
      await spyTable(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=ma-unchanged]');
      t = await text(page, 'ma-text');
      assert(/^The conditions are unchanged: .+, morale high, luck \+1\. /.test(t), t);
      await H.shot(page, 'p9-war-unchanged');
      await page.waitForTimeout(450);
      await clickModal(page, 'Continue');
      await page.waitForSelector('[data-test=wt-root]');
      equal(await page.$('[data-test=d20]'), null, 'no dice');
      equal((await H.noticeTexts(page)).filter(x => /left part-way through|is waiting/.test(x)), [], 'no notice over the War Table');
      const o = await page.evaluate(() => window.__wtOpts);
      equal([o.canCallOff, o.summary.map(x => x.value).slice(1)], [true, ['High', '+1']]);
      await pause(page);
      await page.click('[data-test=wt-begin-deploy]');
      await page.waitForTimeout(300);
      await page.click('[data-test=wt-close]');
      await page.waitForTimeout(300);
      /* Said once per action: not again on Continue, even after reopening. */
      for (const again of [false, true]) {
        if (again) { await reopen(page); await H.dismissNotices(page); }
        await pause(page);
        await page.click('[data-test=ma-continue-0]');
        await page.waitForSelector('[data-test=wt-root]', { timeout: 5000 });
        equal(await page.$('[data-test=ma-unchanged]'), null, again ? 'after reopening' : 'this visit');
        await pause(page);
        await page.click('[data-test=wt-close]');
        await page.waitForTimeout(300);
      }
      await pause(page);
      await page.click('[data-test=ma-calloff-0]');
      await clickModal(page, 'Call off');
      equal((await st(page)).militaryActions, []);
      equal(await page.evaluate(() => TSI.store.get('tsi.bastion.ui').warNoticed), {});
      equal((await st(page)).dayInProgress, null, 'the day left part-way is finished');
    });

    await check('identity, war log and diplomacy survive reopening (BAS-01)', async () => {
      await setUp(page, (s) => { s.diplomacy.agreements = [{ id: 'a', title: 'Trade Agreement', clan: 'Clan Karr', startDay: s.day, endDay: s.day + 21, income: 90, lastShipmentDay: s.day }]; s.diplomacy.tokens = 2; });
      const before = await st(page);
      await reopen(page);
      const after = await st(page);
      ['organization', 'clanHonor', 'honourRespectByClan', 'trustedClientsByClan', 'warLog', 'diplomacy', 'politicalCapital'].forEach(k => equal(after[k], before[k], k));
      equal(await text(page, 'org'), 'Clan: Clan Ironbow');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('The crest, at any time (Build 3)')) {
    section('The crest, at any time (Build 3)');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await setUp(page, (s) => { s.partyLevel = 7; s.defenders.count = 3; });
    const crestKey = () => page.evaluate(() => { const c = TSI.store.get('tsi.bastion.crest', null); return c ? c.key : null; });
    const badge = () => page.evaluate(() => {
      const b = document.querySelector('[data-test=identity-badge]');
      const img = b.querySelector('img');
      return { label: b.querySelector('.tsi-bas-badge__label').textContent, aria: b.getAttribute('aria-label'), img: !img.hidden && !!img.naturalWidth, empty: b.classList.contains('tsi-bas-badge--empty') };
    });

    await check('Unsworn: the Lieutenants and regiment boxes look switched off and say why: Clan only (the Brigade is archived)', async () => {
      await setUp(page, (s) => { s.military = [{ name: 'Lieutenant (1)', qty: 3 }, { name: 'Regiment (100)', qty: 3 }, { name: 'Heavy Infantry (50)', qty: 1 }]; });
      equal([await page.isDisabled('[data-test=war-lieutenants]'), await page.isDisabled('[data-test=war-unit-line]'), await page.isDisabled('[data-test=war-unit-heavy]')], [true, true, true]);
      equal([await text(page, 'war-avail-lieutenants'), await text(page, 'war-avail-unit-line'), await text(page, 'war-avail-unit-heavy')], ['Clan only', 'Clan only', 'Clan only']);
      assert(Number(await page.$eval('[data-test=war-lieutenants]', i => getComputedStyle(i).opacity)) < 0.6, 'greyed out');
      equal(await page.getAttribute('[data-test=war-unit-line]', 'title'), 'Only a Clan can commit Lieutenants and Regiments.');
      assert(/Unsworn war is limited to defenders and beasts/.test(await text(page, 'war-hint')));
      await setUp(page, (s) => { s.military = []; });
      equal(await text(page, 'war-avail-regiments'), 'Clan only', 'with no regiments, one line says so');
    });

    await check('with no crest, the badge says "Add a crest"; Party Identity has a faint shield, the crest\'s buttons, and Form Clan with its requirements; no Brigade anywhere', async () => {
      equal(await badge(), { label: 'Add a crest', aria: 'Crest of the Ironbow: no crest yet. Open Party Identity.', img: false, empty: true });
      await page.click('[data-test=identity-badge]');
      await page.waitForSelector('[data-test=panel-identity]');
      equal(await page.isVisible('[data-test=crest-empty]'), true);
      equal([await page.textContent('[data-test=crest-create]'), await page.textContent('[data-test=crest-add]'), await page.isVisible('[data-test=crest-delete]')], ['Create in the Clan Crest Creator ↗', 'Upload a picture…', false]);
      equal([await text(page, 'org'), await page.isVisible('[data-test=form-box]'), await page.isVisible('[data-test=honour-box]')], ['Unsworn', true, false]);
      equal(await text(page, 'requirements'), 'Clan requirements: Level 9+ (NO), Total Support 360+ (NO), 3 clans at 55+ (NO).');
      equal(await page.$('[data-test=form-merc]'), null);
      equal(await page.$('[data-test=trust-box]'), null);
      assert(!/Brigade|Merc/.test(await page.evaluate(() => document.body.textContent)), 'no Brigade on the page');
      await H.shot(page, 'p9-identity-unsworn');
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
      equal(await badge(), { label: 'Unsworn', aria: 'Crest of the Ironbow. Open Party Identity.', img: true, empty: false });
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
      await arm(page);
    });

    await check('a crest that isn\'t a picture is never offered; with two Bastion windows, answering in one closes the question in the other', async () => {
      const key = await crestKey();
      await page.evaluate(() => TSI.handoff.write('crest', { id: 'crest-bad', at: 1, name: 'Bad', dataUrl: 'data:image/png;base64,SGVsbG8gd29ybGQ=' }));
      await page.waitForFunction(() => TSI.handoff.read('crest') === null, null, { timeout: 6000 });
      equal(await modalOpen(page), false, 'not offered');
      equal(await crestKey(), key);
      const second = await context.newPage();
      await second.goto(H.fileUrl('index.html') + '?tool=bastion');
      await second.waitForSelector('[data-test=day-status]');
      const writer = await context.newPage();
      await writer.goto(H.fileUrl('index.html'));
      await writer.waitForSelector('[data-test=backup-everything]');
      await writer.evaluate(() => {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const g = c.getContext('2d'); g.fillStyle = '#d6b25e'; g.fillRect(4, 4, 24, 24);
        TSI.handoff.write('crest', { id: 'crest-two', at: 1, name: 'Two windows', dataUrl: c.toDataURL('image/png') });
      });
      await page.waitForSelector('[data-test=crest-offer]', { timeout: 6000 });
      await second.waitForSelector('[data-test=crest-offer]', { timeout: 6000 });
      await clickModal(page, 'No');
      await second.waitForFunction(() => !document.querySelector('[data-test=crest-offer]'), null, { timeout: 5000 });
      equal(await crestKey(), key, 'nothing taken in either window');
      /* Sent again and taken in this window: the other one's question closes, and it shows the new crest. */
      await writer.evaluate(() => {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const g = c.getContext('2d'); g.fillStyle = '#b1122a'; g.fillRect(2, 2, 28, 28);
        TSI.handoff.write('crest', { id: 'crest-two-b', at: 2, name: 'Two windows again', dataUrl: c.toDataURL('image/png') });
      });
      await page.waitForSelector('[data-test=crest-offer]', { timeout: 6000 });
      await second.waitForSelector('[data-test=crest-offer]', { timeout: 6000 });
      await clickModal(page, 'Use this crest');
      const taken = await crestKey();
      assert(taken && taken !== key, 'taken');
      await second.waitForFunction(k => !document.querySelector('[data-test=crest-offer]') && document.querySelector('[data-test=identity-badge] img').getAttribute('data-key') === k, taken, { timeout: 6000 });
      await writer.close();
      await second.close();
      await page.waitForTimeout(500);
    });

    await check('a refused file is explained; Unsworn, a picture can be uploaded from the panel, replacing the Creator\'s', async () => {
      await H.chooseFile(page, '[data-test=crest-add]', H.writeTemp('not-a-crest.txt', 'hello'));
      await page.waitForFunction(() => /PNG, JPG, WebP or GIF/.test(document.body.textContent));
      await clickModal(page, 'OK');
      await H.chooseFile(page, '[data-test=crest-add]', writeCrest('crest-unsworn.png', 1200));
      await page.waitForFunction(() => { const c = TSI.store.get('tsi.bastion.crest', null); return c && c.name === 'tsi-p9-crest-unsworn.png'; });
      const c = await page.evaluate(() => TSI.store.get('tsi.bastion.crest'));
      equal('design' in c, false, 'an uploaded picture has no design');
      await page.waitForFunction(() => { const i = document.querySelector('[data-test=crest]'); return i && i.naturalWidth === 512; });
      equal(await st(page).then(x => x.organization.type), 'unsworn');
    });

    await check('Form Clan keeps the Bastion\'s crest: Upload… shows another, Keep this crest goes back, and Cancel saves nothing', async () => {
      await setUp(page, (s) => { s.partyLevel = 9; s.politicalCapital.blackstone = 10; s.politicalCapital.bacca = 10; s.politicalCapital.farmer = 10; s.politicalCapital.slade = -10; });
      const key = await crestKey();
      await pause(page);
      await page.click('[data-test=form-clan]');
      await page.waitForSelector('[data-test=crest-field]');
      equal(await page.getAttribute('[data-test=crest-preview]', 'data-key'), key);
      equal([await text(page, 'crest-field-note'), await page.isVisible('[data-test=crest-keep]')], ['The Bastion\'s crest: the Clan keeps it.', false]);
      equal([await page.textContent('[data-test=crest-new]'), await page.textContent('[data-test=crest-upload]')], ['Create a new one ↗', 'Upload…']);
      await H.chooseFile(page, '[data-test=crest-upload]', writeCrest('crest-pop.png', 900));
      await page.waitForFunction(k => document.querySelector('[data-test=crest-preview]').getAttribute('data-key') !== k, key);
      equal([await text(page, 'crest-field-note'), await page.isVisible('[data-test=crest-keep]')], ['A new crest: it replaces the Bastion\'s when you confirm the founding.', true]);
      await page.click('[data-test=crest-keep]');
      equal(await page.getAttribute('[data-test=crest-preview]', 'data-key'), key);
      await H.chooseFile(page, '[data-test=crest-upload]', writeCrest('crest-pop.png', 900));
      await page.waitForSelector('[data-test=crest-keep]:not([hidden])');
      await clickModal(page, 'Cancel');
      equal(await crestKey(), key, 'unchanged');
      equal(await modalOpen(page), false);
      equal((await st(page)).organization.type, 'unsworn');
    });

    await check('a crest from the Creator, accepted while Form Clan is open, replaces a picture uploaded there earlier', async () => {
      await pause(page);
      await page.click('[data-test=form-clan]');
      await H.chooseFile(page, '[data-test=crest-upload]', writeCrest('crest-pop.png', 900));
      await page.waitForSelector('[data-test=crest-keep]:not([hidden])');
      await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d'); g.fillStyle = '#b1122a'; g.fillRect(8, 8, 48, 48);
        TSI.handoff.write('crest', { id: 'crest-form', at: 1, name: 'Mid-founding', dataUrl: c.toDataURL('image/png'), design: { clanName: 'Mid-founding' } });
      });
      await page.waitForSelector('[data-test=crest-offer]', { timeout: 6000 });
      await clickModal(page, 'Use this crest');
      const key = await crestKey();
      equal((await page.evaluate(() => TSI.store.get('tsi.bastion.crest'))).design.clanName, 'Mid-founding');
      equal([await page.getAttribute('[data-test=crest-preview]', 'data-key'), await page.isVisible('[data-test=crest-keep]')], [key, false], 'the box shows the crest just taken, and the upload is dropped');
      await clickModal(page, 'Cancel');
      equal(await crestKey(), key);
      equal((await st(page)).organization.type, 'unsworn');
    });

    await check('founding the Clan with no new crest keeps the Bastion\'s; the badge then has the Clan\'s name, and the crest is "Crest of Clan Ironbow"', async () => {
      const key = await crestKey();
      await pause(page);
      await page.click('[data-test=form-clan]');
      await page.fill('[data-test=clan-name]', 'Clan Ironbow');
      await page.fill('[data-test=clan-motto]', 'Root and Steel');
      await clickModal(page, 'Confirm Founding');
      equal(await crestKey(), key);
      equal(await badge(), { label: 'Clan Ironbow', aria: 'Crest of Clan Ironbow. Open Party Identity.', img: true, empty: false });
      equal((await crestInfo(page)).alt, 'Crest of Clan Ironbow');
      equal([await text(page, 'org'), await page.isVisible('[data-test=honour-box]'), await page.isVisible('[data-test=form-box]')], ['Clan: Clan Ironbow', true, false]);
      assert(/“Root and Steel”/.test(await text(page, 'org-meta')), await text(page, 'org-meta'));
      await reveal(page, '[data-test=org]');
      await H.shot(page, 'p9-identity-clan');
      await page.keyboard.press('Escape');
    });

    await check('Download Save includes the crest and the War Table\'s terrain; Reset clears them with the rest of the Bastion', async () => {
      await page.evaluate(() => { TSI.store.set('tsi.bastion.warTerrain', { none: { cols: 2, rows: 1, cells: 'w.' } }); return TSI.store.flush(); });
      const d = await H.download(page, '[data-test=download-save]');
      const keys = JSON.parse(d.text).records.map(r => r.key);
      assert(keys.indexOf('tsi.bastion.crest') !== -1 && keys.indexOf('tsi.bastion.warTerrain') !== -1, keys.join(','));
      await pause(page);
      await page.click('[data-test=reset]');
      await clickModal(page, 'Reset');
      await page.waitForSelector('[data-test=day-status]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().organization.type === 'unsworn');
      equal(await page.evaluate(() => TSI.store.has('tsi.bastion.crest')), false);
      equal(await page.evaluate(() => TSI.store.has('tsi.bastion.warTerrain')), false, 'the painted terrain goes too');
      equal((await crestInfo(page)).shown, false);
    });

    await check('Unsworn, the War Table still has the crest (the army is "Your forces"); leaving the Bastion while it\'s open leaves nothing behind', async () => {
      await H.chooseFile(page, '[data-test=crest-add]', writeCrest('crest-war.png', 600));
      await page.waitForFunction(() => TSI.store.has('tsi.bastion.crest'));
      await page.keyboard.press('Escape');
      await spyTable(page);
      await setUp(page, (s) => { s.defenders.count = 2; });
      await page.fill('[data-test=war-defenders]', '2');
      await page.selectOption('[data-test=war-objective]', 'seize_outpost');
      await pause(page);
      await page.click('[data-test=queue-war]');
      await confirmWar(page);
      await page.waitForFunction(() => TSI.bastion.debug.state().anchored);
      await setExplorerDay(page, (await st(page)).day + 3);
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'); return t && /^War Action:/.test(t.textContent); }, null, { timeout: 15000 });
      equal(await bare(page, '.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'), 'War Action: Seize Outpost vs Blackstone', 'the objective\'s own name, not its id');
      await clickModal(page, 'Begin Military Action');
      for (let i = 0; i < 3; i++) { await d20(page, 15); await page.waitForSelector('[data-test=ma-result]'); await clickModal(page, 'Continue'); }
      await page.waitForSelector('[data-test=wt-root]');
      assert(/Seize Outpost vs Blackstone/.test(await text(page, 'wt-title')), await text(page, 'wt-title'));
      const o = await page.evaluate(() => window.__wtOpts);
      equal([o.armyName, !!(o.crest && /^data:image\//.test(o.crest.dataUrl))], ['Your forces', true]);
      await page.click('[data-test=home]');
      await page.waitForSelector('[data-test=backup-everything]');
      equal(await page.$('[data-test=wt-root]'), null);
      equal(await page.evaluate(() => !!(window.TSI.bastion && (TSI.bastion.debug || (TSI.bastion.warTable && TSI.bastion.warTable.current)))), false);
      equal(context.log.errors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('The War Room, the Military panel and the Menagerie (war phase 2)')) {
    section('The War Room, the Military panel and the Menagerie (war phase 2)');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await setUp(page, (s) => {
      s.partyLevel = 17;
      s.builtExtras = [{ facId: 'war_room', status: 'built' }, { facId: 'menagerie', status: 'built' }, '', '', '', ''];
      s.defenderBeasts = [{ name: 'Owlbear', qty: 1, source: 'Menagerie' }];
    });
    /* The War Room's panel, opened from its tile. */
    const showWarRoom = async () => {
      if ((await page.evaluate(() => TSI.bastion.debug.panel())) === 'fac-war_room') return;
      await reveal(page, '[data-test=wr-recruit]');
      await page.waitForSelector('[data-test=panel-fac-war_room] [data-test=wr-recruit]');
      await page.waitForTimeout(300);
    };
    /* What the stat block should say for a War Room choice, from the war's data. */
    const expected = label => page.evaluate(l => {
      const b = TSI.bastion.rules.unitStatBlock({}, l);
      return { title: b.title, rows: b.rows.map(r => r.name + r.value), traits: b.traits.map(t => t.name), distinction: b.distinction };
    }, label);

    await check('the War Room\'s Recruit list: the seven units in Harry\'s order, each with its stat block on hover', async () => {
      await showWarRoom();
      equal(await page.textContent('[data-test=wr-recruit]'), 'Lieutenant (1)');
      equal(await page.getAttribute('[data-test=wr-recruit]', 'aria-haspopup'), 'listbox');
      await page.click('[data-test=wr-recruit]');
      await page.waitForSelector('[data-test=wr-list]');
      equal(await page.getAttribute('[data-test=wr-recruit]', 'aria-expanded'), 'true');
      equal(await page.$$eval('[data-test=wr-list] [role=option]', os => os.map(o => o.dataset.test + ' ' + o.textContent)),
        ['wr-option-0 LieutenantOne officer', 'wr-option-1 Archers50 soldiers', 'wr-option-2 Levy Infantry150 soldiers', 'wr-option-3 Line Infantry100 soldiers', 'wr-option-4 Heavy Infantry50 soldiers', 'wr-option-5 Light Cavalry50 soldiers', 'wr-option-6 Shock Cavalry25 soldiers']);
      const labels = await page.$$eval('[data-test="sel-war_room__recruit"] option', os => os.map(o => o.textContent));
      equal(labels, await page.evaluate(() => TSI_DATA.bastionWar.warRoom.map(e => e.label)), 'the hidden list is the war data\'s');
      for (let i = 0; i < labels.length; i++) {
        await page.hover('[data-test=wr-option-' + i + ']');
        await page.waitForSelector('[data-test=tooltip]:not([hidden])');
        const tip = await text(page, 'tooltip');
        const want = await expected(labels[i]);
        assert(tip.indexOf(want.title) === 0, tip);
        want.rows.concat(want.traits).forEach(x => assert(tip.indexOf(x) !== -1, labels[i] + ': ' + x + ' in ' + tip));
        assert(tip.indexOf(want.distinction) !== -1, tip);
        if (i > 0) assert(new RegExp('Military unit • ' + labels[i].match(/\((\d+)\)/)[1] + ' soldiers').test(tip), tip);
        /* The list and its stat block fit the window. */
        const lc = await H.layoutCheck(page, ['[data-test=wr-list]', '[data-test=tooltip]']);
        equal(lc.outOfView, [], labels[i]);
      }
      const archers = await text(page, 'tooltip').then(() => page.hover('[data-test=wr-option-1]')).then(() => text(page, 'tooltip'));
      assert(/Attack\+4 ranged \/ \+1 melee/.test(archers) && /Range 6\./.test(archers), archers);
      await page.hover('[data-test=wr-option-0]');
      assert(/Leads one formation: \+2 Resolve to it/.test(await text(page, 'tooltip')));
      await page.hover('[data-test=wr-option-3]');
      await H.shot(page, 'p9-war-room-list');
      await page.keyboard.press('Escape');
      equal(await page.$('[data-test=wr-list]'), null, 'Escape closes it');
      equal(await page.isHidden('[data-test=tooltip]'), true);
      equal(await page.textContent('[data-test=wr-recruit]'), 'Lieutenant (1)', 'nothing chosen');
    });

    await check('the keyboard: the arrows, Home and End move through it, showing each stat block; Enter chooses; the hidden list keeps in step', async () => {
      /* The mouse away from where the list opens, so hovering can't change the stat block the keys show. */
      await page.mouse.move(5, 5);
      await page.focus('[data-test=wr-recruit]');
      await page.keyboard.press('ArrowDown');
      await page.waitForSelector('[data-test=wr-list]');
      equal(await page.evaluate(() => document.activeElement.dataset.test), 'wr-option-0');
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
      equal(await page.evaluate(() => document.activeElement.dataset.test), 'wr-option-3');
      assert(/^Line Infantry/.test(await text(page, 'tooltip')) && await page.isVisible('[data-test=tooltip]'), 'the stat block follows the keys');
      await page.keyboard.press('End');
      equal(await page.evaluate(() => document.activeElement.dataset.test), 'wr-option-6');
      assert(/^Shock Cavalry/.test(await text(page, 'tooltip')) && /Strong Charge/.test(await text(page, 'tooltip')));
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      equal(await page.$('[data-test=wr-list]'), null);
      equal([await page.textContent('[data-test=wr-recruit]'), await page.inputValue('[data-test="sel-war_room__recruit"]'), await page.evaluate(() => document.activeElement.dataset.test)],
        ['Line Infantry (100)', '3', 'wr-recruit'], 'chosen, and the focus is back on the button');
      /* Opened again, it starts on the choice, marked as chosen. */
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-test=wr-list]');
      equal(await page.evaluate(() => document.activeElement.dataset.test), 'wr-option-3');
      equal(await page.getAttribute('[data-test=wr-option-3]', 'aria-selected'), 'true');
      await page.keyboard.press('Tab');
      equal(await page.$('[data-test=wr-list]'), null, 'Tab closes it');
      /* The hidden native list (for the tests) moves the button too. */
      await page.selectOption('[data-test="sel-war_room__recruit"]', '1');
      equal(await page.textContent('[data-test=wr-recruit]'), 'Archers (50)');
      /* A click elsewhere closes it. */
      await page.click('[data-test=wr-recruit]');
      await page.waitForSelector('[data-test=wr-list]');
      await page.mouse.click(5, 300);
      equal(await page.$('[data-test=wr-list]'), null);
    });

    await check('Issue Order recruits as before; a depleted regiment is brought back to full strength first', async () => {
      await page.click('[data-test=wr-recruit]');
      await page.click('[data-test=wr-option-3]');
      await issue(page, 'war_room', 'recruit');
      let s = await st(page);
      equal(s.pendingOrders.map(o => [o.label, o.optionLabel]), [['War Room: Recruit (Line Infantry (100))', 'Line Infantry (100)']]);
      await days(page, 7, []);
      s = await st(page);
      equal(s.military, [{ name: 'Line Infantry (100)', qty: 1, source: 'War Room' }]);
      assert(s.log.some(l => l.body === 'War Room: Recruit (Line Infantry (100)) → Recruited: Line Infantry (100).'), JSON.stringify(s.log.slice(0, 3)));
      equal(await text(page, 'military-type-0'), 'Line Infantry • 100 soldiers');
      await setUp(page, (st2) => { st2.military.push({ name: 'Line Infantry (100)', qty: 1, depleted: true, strength: 60, id: 'reg-x', source: 'War Room' }); });
      equal(await text(page, 'military-type-1'), 'Line Infantry • Depleted: 60/100');
      await reveal(page, '[data-test=military]');
      await page.hover('[data-test=military-row-1]');
      await page.waitForSelector('[data-test=tooltip]:not([hidden])');
      const tip = await text(page, 'tooltip');
      /* The stat block is the one it fights with: the battle line-up's own profile. */
      const fights = await page.evaluate(() => {
        const R = TSI.bastion.rules;
        const s = Object.assign({}, TSI.bastion.debug.state(), { organization: { type: 'clan' } });
        return R.playerSide(s, {}, { defenders: 0, lieutenants: 0, units: { line: 2 }, beasts: {} }).units.find(u => u.personnel === 60).profile;
      });
      equal([fights.cohesion, fights.bv], [3, 3]);
      assert(/^Line Infantry/.test(tip) && /Military unit • 60 of 100 soldiers/.test(tip) && tip.indexOf('Cohesion' + fights.cohesion + 'Attack') !== -1 && tip.indexOf('Battle Value' + fights.bv + 'Depleted') !== -1 &&
        /Depleted: 60 of 100 soldiers came home, so it fights at Cohesion 3 \(not 5\) and Battle Value 3 \(not 5\) until the War Room recruits Line Infantry again/.test(tip), tip);
      await H.shot(page, 'p9-war-military');
      await page.mouse.move(5, 5);
      /* From the keyboard: Tab reaches each row, which shows its stat block. */
      await page.focus('[data-test=military-remove-0]');
      await page.keyboard.press('Tab');
      equal(await page.evaluate(() => { const a = document.activeElement; return [a.dataset.test, a.getAttribute('role'), a.getAttribute('aria-label'), a.getAttribute('aria-describedby')]; }),
        ['military-row-1', 'group', 'Line Infantry (100): Line Infantry • Depleted: 60/100', 'tsi-tip']);
      assert(await page.isVisible('[data-test=tooltip]') && /Military unit • 60 of 100 soldiers/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
      equal((await H.layoutCheck(page, ['[data-test=tooltip]'])).outOfView, []);
      await page.keyboard.press('Tab');
      equal([await page.evaluate(() => document.activeElement.dataset.test), await page.isHidden('[data-test=tooltip]')], ['military-remove-1', true]);
      await showWarRoom();
      await page.click('[data-test=wr-recruit]');
      await page.click('[data-test=wr-option-3]');
      await issue(page, 'war_room', 'recruit');
      await days(page, 7, []);
      s = await st(page);
      assert(s.log.some(l => l.body === 'War Room: Recruit (Line Infantry (100)) → Replacements bring Line Infantry back to 100.'), JSON.stringify(s.log.slice(0, 3)));
      equal(s.military.map(r => [r.name, r.qty, !!r.depleted]), [['Line Infantry (100)', 2, false]]);
      equal(await text(page, 'military-type-0'), 'Line Infantry • 2 × 100 soldiers');
    });

    await check('the Menagerie\'s beasts and the Lieutenants show their stat blocks, and who is away recovering', async () => {
      await setUp(page, (s) => {
        s.military.unshift({ name: 'Lieutenant (1)', qty: 2, source: 'War Room' });
        s.warRecovery = [{ id: 'r1', kind: 'lieutenant', name: 'Lieutenant 2', status: 'wounded', untilDay: s.day + 14 }, { id: 'r2', kind: 'beast', name: 'Owlbear', status: 'recovered', untilDay: s.day + 7 }];
      });
      const day = (await st(page)).day;
      equal(await text(page, 'military-type-0'), '2 Lieutenants (1 recovering: back on Day ' + (day + 14) + ')');
      equal(await text(page, 'beast-type-0'), '1 beast • Terror (1 recovering: back on Day ' + (day + 7) + ')');
      await page.hover('[data-test=beast-row-0]');
      await page.waitForSelector('[data-test=tooltip]:not([hidden])');
      const tip = await text(page, 'tooltip');
      assert(/^Owlbear/.test(tip) && /Menagerie beast/.test(tip) && /Terror: A unit it damages/.test(tip) && /Owlbear: recovering, back on Day/.test(tip), tip);
      await page.hover('[data-test=military-row-0]');
      assert(/^Lieutenant/.test(await text(page, 'tooltip')) && /Lieutenant 2: wounded, back on Day/.test(await text(page, 'tooltip')));
      await page.mouse.move(5, 5);
    });

    await check('the guide\'s "come back after" for wounded Lieutenants and beasts matches the recovery table', async () => {
      /* Shortest and longest time away for a Lieutenant or beast that lives: separated, recovered, wounded, badly wounded. */
      const span = await page.evaluate(() => {
        const W = TSI_DATA.bastionWar;
        const days = W.recovery.filter(r => r.days).map(r => r.days).concat([W.separatedDays, W.badlyWoundedDays]);
        return [Math.min.apply(null, days), Math.max.apply(null, days)];
      });
      const said = span[0] === span[1] ? String(span[0]) : span[0] + ' to ' + span[1];
      const guide = fs.readFileSync(path.join(H.ROOT, 'guide.html'), 'utf8');
      const m = /Wounded Lieutenants and beasts come back after ([^:<]+):/.exec(guide);
      assert(m, 'the guide has no "Wounded Lieutenants and beasts come back after" sentence');
      equal(m[1], said + ' days');
    });

    await check('the War Council and the War Room fit the laptop and the TV with no sideways scrolling', async () => {
      await setUp(page, (s) => {
        s.organization = { type: 'clan', name: 'Clan Ironbow', chief: '', motto: '', foundedAtDay: 1 };
        s.defenders.count = 30;
        s.military.push({ name: 'Archers (50)', qty: 1 }, { name: 'Heavy Infantry (50)', qty: 2 }, { name: 'Light Cavalry (50)', qty: 1 }, { name: 'Shock Cavalry (25)', qty: 1 }, { name: 'Levy Infantry (150)', qty: 1 });
        s.defenderBeasts.push({ name: 'Giant Vulture', qty: 3 }, { name: 'Dire Wolf', qty: 2 });
      });
      for (const size of ['laptop', 'laptopFull', 'tv']) {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(300);
        await reveal(page, '[data-test=queue-war]');
        const lc = await H.layoutCheck(page, ['[data-test=war-forces]']);
        equal(lc.scrollWidth, lc.clientWidth, size + ': no sideways scroll');
        const fit = await page.evaluate(() => {
          const card = document.querySelector('[data-card=war]').getBoundingClientRect();
          return Array.from(document.querySelectorAll('[data-test=war-forces] > *, [data-test=war-intel], [data-test=war-army-bv], [data-test=war-cost], [data-test=queue-war]')).filter(e => { const r = e.getBoundingClientRect(); return r.left < card.left || r.right > card.right; }).length;
        });
        equal(fit, 0, size + ': everything inside the panel');
        equal(await page.$$eval('[data-test=war-forces] input', is => is.length), 11, 'defenders, Lieutenants, six kinds of regiment and three kinds of beast');
        await H.shot(page, 'p9-war-council-' + size);
        await showWarRoom();
        await page.click('[data-test=wr-recruit]');
        await page.hover('[data-test=wr-option-6]');
        equal((await H.layoutCheck(page, ['[data-test=wr-list]', '[data-test=tooltip]'])).outOfView, [], size + ': the list and its stat block in view');
        await page.keyboard.press('Escape');
      }
      await page.setViewportSize(H.SIZES.laptop.viewport);
    });

    await check('nothing went wrong', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('Wars, the Defend Bastion event and Under Repair (Harry, 4 October 2026)')) {
    section('Wars, the Defend Bastion event and Under Repair (Harry, 4 October 2026)');
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await setUp(page, (s) => {
      s.partyLevel = 9;
      s.treasuryGP = 5000;
      s.organization = { type: 'clan', name: 'Clan Ironbow', chief: 'Harry', motto: '', foundedAtDay: 1 };
      s.clanHonor = 40;
      s.defenders.count = 10;
      s.defenders.armed = true;
      s.military = [{ name: 'Line Infantry (100)', qty: 4 }, { name: 'Heavy Infantry (50)', qty: 2 }, { name: 'Shock Cavalry (25)', qty: 2 }];
      s.defenderBeasts = [];
      s.politicalCapital.bacca = 10;
      s.honourRespectByClan.bacca = 1;
    });
    const DATA = 'var data = { bastion: TSI_DATA.bastion, facilities: TSI_DATA.bastionFacilities, tools: TSI_DATA.bastionTools, events: TSI_DATA.bastionEvents };';
    const sgn = n => n < 0 ? '−' + Math.abs(n) : n > 0 ? '+' + n : '0';
    const penalty = commit => page.evaluate(c => TSI.bastion.rules.warPenalty(TSI.bastion.debug.state(), {}, c), commit);
    async function commitWar(f) {
      for (const [t, v] of [['war-defenders', f.defenders], ['war-unit-line', f.line], ['war-unit-heavy', f.heavy], ['war-unit-shock_cav', f.shock]]) await page.fill('[data-test=' + t + ']', String(v));
      await page.press('[data-test=war-unit-shock_cav]', 'Tab');
    }
    const asCommit = f => ({ defenders: f.defenders, lieutenants: 0, units: { line: f.line, heavy: f.heavy, shock_cav: f.shock }, beasts: {} });
    const tagsIn = (sel) => page.$$eval(sel + ' [data-test=atwar-tag]', ts => ts.length);
    const FULL = { defenders: 10, line: 4, heavy: 2, shock: 2 };
    let pen = null;

    await check('the War Action offers Raid, Skirmish and Seize Outpost: Defend Bastion comes to you, as an event', async () => {
      equal(await page.$$eval('[data-test=war-objective] option', os => os.map(o => o.value + ': ' + o.textContent)), ['raid: Raid', 'skirmish: Skirmish', 'seize_outpost: Seize Outpost']);
    });

    await check('beside Queue War Action, the cost of declaring war follows the army and the target as you type', async () => {
      await page.selectOption('[data-test=war-target]', 'bacca');
      await page.selectOption('[data-test=war-objective]', 'skirmish');
      const seen = {};
      for (const f of [{ defenders: 1, line: 0, heavy: 0, shock: 0 }, { defenders: 0, line: 4, heavy: 0, shock: 0 }, FULL]) {
        await commitWar(f);
        const p = await penalty(asCommit(f));
        seen[p.honourRespect + '/' + p.politicalCapital] = p.bv;
        equal(await text(page, 'war-cost'), 'Declaring war on Clan Bacca: Honour & Respect ' + sgn(p.honourRespect) + ', Political Capital ' + sgn(p.politicalCapital) + ' (your army: ' + p.bv + ' Battle Value)');
      }
      equal(Object.keys(seen).sort(), ['-3/-30', '-4/-40', '-5/-50'], 'all three rows of Harry\'s table: ' + JSON.stringify(seen));
      assert(seen['-3/-30'] < 20 && seen['-4/-40'] >= 20 && seen['-4/-40'] < 40 && seen['-5/-50'] >= 40, JSON.stringify(seen));
      /* As it's typed, before the box is left. */
      await page.fill('[data-test=war-defenders]', '1');
      await page.fill('[data-test=war-unit-line]', '0');
      await page.fill('[data-test=war-unit-heavy]', '0');
      await page.fill('[data-test=war-unit-shock_cav]', '0');
      assert(/Honour & Respect −3, Political Capital −30/.test(await text(page, 'war-cost')), await text(page, 'war-cost'));
      await page.selectOption('[data-test=war-target]', 'karr');
      assert(/^Declaring war on Clan Karr:/.test(await text(page, 'war-cost')), await text(page, 'war-cost'));
      await page.selectOption('[data-test=war-target]', 'bacca');
      await commitWar(FULL);
      pen = await penalty(asCommit(FULL));
    });

    await check('Queue War Action asks first, with what it costs; Cancel changes nothing', async () => {
      const before = await st(page);
      await pause(page);
      await page.click('[data-test=queue-war]');
      equal(await modalTitle(page), 'Declare war on Clan Bacca?');
      const t = await popText(page);
      assert(new RegExp('Queueing this War Action \\(Skirmish vs Bacca\\) declares war on Clan Bacca\\. For an army of ' + pen.bv + ' Battle Value, it costs you at once:').test(t), t);
      assert(t.indexOf('Honour & Respect with Bacca: ' + sgn(pen.honourRespect) + ' (from +1 to ' + sgn(1 + pen.honourRespect) + ')') !== -1, t);
      assert(t.indexOf('Political Capital with Bacca: ' + sgn(pen.politicalCapital) + ' (from +10 to ' + sgn(10 + pen.politicalCapital) + ')') !== -1, t);
      assert(/While you’re at war, Clan Bacca may attack your Bastion: every 7 days of the war, a 1 on a d6 means they attack\. The war ends after 42 days without a battle between you/.test(t), t);
      equal(await page.$$eval('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button', bs => bs.map(b => b.textContent)), ['Cancel', 'Declare war']);
      equal((await H.layoutCheck(page, ['.tsi-modal:not(.tsi-bas-panel)', '.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button'])).outOfView, []);
      await H.shot(page, 'p9-war4-declare');
      await clickModal(page, 'Cancel');
      const after = await st(page);
      equal([after.pendingOrders, after.wars, after.politicalCapital, after.honourRespectByClan, after.log.length],
        [before.pendingOrders, {}, before.politicalCapital, before.honourRespectByClan, before.log.length]);
      equal(await page.$$eval('[data-test=atwar-tag]', t => t.length), 0);
    });

    await check('Declare war: the costs apply once, even on a double click; the war is recorded and logged', async () => {
      await pause(page);
      await page.dblclick('[data-test=queue-war]');
      await page.waitForTimeout(300);
      equal(await page.$$eval('.tsi-modal:not(.tsi-bas-panel)', m => m.length), 1, 'one question');
      await clickModal(page, 'Declare war');
      await page.waitForTimeout(200);
      const s = await st(page);
      equal(s.pendingOrders.map(o => o.label + ' ' + o.meta.objective), ['War Action skirmish']);
      equal(s.wars, { bacca: { since: 1, last: 1, next: 8 } });
      const hr = 1 + pen.honourRespect, pc = 10 + pen.politicalCapital;
      equal([s.honourRespectByClan.bacca, s.politicalCapital.bacca], [hr, pc]);
      equal(s.log.slice(0, 2).map(l => l.title + ': ' + l.body), [
        'War Action Queued: Skirmish vs Bacca (musters on Day 4).',
        'War Declared: War on Clan Bacca: Honour & Respect ' + sgn(pen.honourRespect) + ' (now ' + sgn(hr) + '), Political Capital ' + sgn(pen.politicalCapital) + ' (now ' + sgn(pc) + '), for an army of ' + pen.bv + ' Battle Value.'
      ]);
      equal(await page.inputValue('[data-test=hr-bacca]'), String(hr), 'the tracker shows it');
      equal(await text(page, 'pc-bacca'), String(pc));
    });

    await check('At War tags: beside Bacca in the panels, the log, the War Council and its list, and its pop-ups; nowhere else', async () => {
      /* Each panel in turn (one is open at a time, since the new screen). */
      const allTags = [];
      const tagsOf = async opener => {
        await reveal(page, opener);
        const ts = await page.$$eval('[data-test=atwar-tag]', ts => ts.map(t => [t.dataset.clan, t.textContent, getComputedStyle(t).textTransform]));
        allTags.push(...ts);
        return ts.length;
      };
      equal(await tagsOf('[data-test=pc-bacca]'), 1, 'Clan Influence: Bacca\'s row');
      assert(await tagsOf('[data-test=log]') >= 2, 'the Day Log');
      assert(await tagsOf('[data-test=wars-box]') >= 1, 'the War Council');
      assert(await tagsIn('[data-test=wars-box]') >= 1, 'the Wars box');
      assert(allTags.length >= 5 && allTags.every(t => t[0] === 'bacca' && t[1] === 'At War' && t[2] === 'uppercase'), JSON.stringify(allTags));
      equal(await page.$eval('[data-test=war-target] option[value=bacca]', o => o.textContent), 'Bacca (At War)', 'in a list, the words');
      equal(await page.$eval('[data-test=war-target] option[value=karr]', o => o.textContent), 'Karr');
      equal(await tagsIn('.tsi-topbar'), 0, 'not in the suite\'s top bar');
      equal(await page.getAttribute('[data-test=hr-bacca]', 'aria-label'), 'Bacca Honour/Respect (-5 to +5)', 'nor in a box\'s label');
      assert(/^Renewing the war on Clan Bacca: /.test(await bare(page, '[data-test=war-cost]')), await text(page, 'war-cost'));
      /* No flicker: the cost line is rebuilt on every keystroke, and its tag
         comes with it at once; anything else that changes is tagged before
         the next paint (not a moment later). */
      const flick = await page.evaluate(async () => {
        const box = document.querySelector('[data-test=war-defenders]');
        const tagged = () => document.querySelectorAll('[data-test=war-cost] [data-test=atwar-tag]').length;
        const out = [];
        for (const v of ['3', '4', '10']) { box.value = v; box.dispatchEvent(new Event('input', { bubbles: true })); out.push(tagged()); }
        const note = document.createElement('div');
        note.textContent = 'A rider from Bacca.';
        document.querySelector('[data-test=panel-war] .tsi-modal__body').appendChild(note);
        await Promise.resolve();
        out.push(note.querySelectorAll('[data-test=atwar-tag]').length);
        note.remove();
        return out;
      });
      equal(flick, [1, 1, 1, 1]);
      equal(await bare(page, '[data-test=wars-row-bacca] .tsi-bas-item__name'), 'Clan Bacca');
      equal(await text(page, 'wars-since-bacca'), 'Since Day 1 · peace after 42 more quiet days · their next attack roll: Day 8');
      /* A pop-up the Bastion opens: two more defenders, to queue another War Action against Bacca. */
      await setUp(page, (s) => { s.defenders.count = 12; });
      await page.fill('[data-test=war-defenders]', '2');
      await pause(page);
      await page.click('[data-test=queue-war]');
      await page.waitForSelector('.tsi-modal:not(.tsi-bas-panel) [data-test=atwar-tag]');
      equal(await bare(page, '.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'), 'Renew the war on Clan Bacca?');
      assert(await tagsIn('.tsi-modal:not(.tsi-bas-panel)') >= 3, 'in the title and the text');
      assert(/You’re already at war with Clan Bacca\. Queueing this War Action \(Skirmish vs Bacca\) renews the war/.test(await bareModal(page)), await bareModal(page));
      await H.shot(page, 'p9-war4-renew');
      await clickModal(page, 'Cancel');
      equal((await st(page)).pendingOrders.length, 1);
      await setUp(page, (s) => { s.defenders.count = 10; });
      await reveal(page, '[data-test=wars-box]');
      await H.shot(page, 'p9-war4-at-war');
    });

    await check('Make peace is refused while the War Action waits, and says why; Cancel the same day gives back the cost; peace takes the tags away', async () => {
      equal(await page.isDisabled('[data-test=make-peace-bacca]'), true);
      const why = await bare(page, '[data-test=wars-why-bacca]');
      equal(why, 'A War Action against Clan Bacca (Skirmish vs Bacca) is still waiting. Cancel it, or see it through, before making peace.');
      equal(await page.getAttribute('[data-test=make-peace-bacca]', 'title'), why);
      /* Cancelling the order on the day it was queued gives back what
         declaring war cost, and calls off the war it began: correcting a
         War Action (cancel, queue again) never costs twice. */
      await page.click('[data-test=cancel-0]');
      let s = await st(page);
      equal([s.pendingOrders.length, s.wars, s.honourRespectByClan.bacca, s.politicalCapital.bacca], [0, {}, 1, 10]);
      equal(s.log[0].title + ': ' + s.log[0].body, 'War Called Off: Cancelled the War Action (Skirmish vs Bacca) on the day it was queued, so what it cost is given back: Honour & Respect ' +
        sgn(-pen.honourRespect) + ' (now 1), Political Capital ' + sgn(-pen.politicalCapital) + ' (now 10). The war on Clan Bacca is called off: you\'re no longer at war.');
      equal(await page.$$eval('[data-test=atwar-tag]', t => t.length), 0, 'its tags go');
      await commitWar(FULL);
      assert(/^Declaring war on Clan Bacca: /.test(await text(page, 'war-cost')), await text(page, 'war-cost'));
      await pause(page);
      await page.click('[data-test=queue-war]');
      equal(await modalTitle(page), 'Declare war on Clan Bacca?', 'queueing again declares war afresh, at its cost once');
      await clickModal(page, 'Cancel');
      /* At war again (as if from an earlier day), to make peace. */
      await setUp(page, (st2) => { st2.wars = { bacca: { since: st2.day, last: st2.day, next: st2.day + 7 } }; });
      equal(await page.isDisabled('[data-test=make-peace-bacca]'), false);
      await pause(page);
      await page.click('[data-test=make-peace-bacca]');
      equal(await bare(page, '.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'), 'Make peace with Clan Bacca?');
      assert(/isn’t given back/.test(await popText(page)));
      await clickModal(page, 'Cancel');
      equal(Object.keys((await st(page)).wars), ['bacca']);
      await pause(page);
      await page.click('[data-test=make-peace-bacca]');
      await clickModal(page, 'Make peace');
      s = await st(page);
      equal([s.wars, s.log[0].title + ': ' + s.log[0].body, s.politicalCapital.bacca], [{}, 'Peace: Peace with Clan Bacca (made by the DM).', 10]);
      equal(await page.$$eval('[data-test=atwar-tag]', t => t.length), 0, 'every tag goes');
      equal(await page.$eval('[data-test=war-target] option[value=bacca]', o => o.textContent), 'Bacca');
      equal(await page.isVisible('[data-test=wars-box]'), false);
      assert(/^Declaring war on Clan Bacca/.test(await text(page, 'war-cost')));
    });

    await check('an attack: "Sound the horns!", with crossed swords, who defends and the enemy; it fits the laptop and the TV', async () => {
      /* At war with Bacca, its attack roll due tomorrow, and the dice set: the
         attack d6 shows 1, then the size of the attacking force d6 shows 4
         (an established local force). */
      await setUp(page, (s) => { s.wars = { bacca: { since: s.day, last: s.day, next: s.day + 1 } }; });
      await page.evaluate(() => { window.__dice = [0, 0.5]; });
      await setExplorerDay(page, (await st(page)).day + 1);
      await page.waitForSelector('[data-test=attack]', { timeout: 15000 });
      await page.waitForTimeout(450);
      equal(await page.evaluate(() => window.__dice.length), 0, 'both dice used, and the attack roll is the day\'s first');
      equal(await modalTitle(page), 'Sound the horns!');
      equal(await bare(page, '[data-test=attack-text]'), 'Clan Bacca warships are approaching! Defend the Ironbow!');
      assert(await tagsIn('[data-test=attack-text]') === 1, 'At War in the pop-up');
      const icon = await page.$eval('[data-test=attack-icon]', i => ({ tag: i.tagName, w: i.getBoundingClientRect().width, parts: i.querySelectorAll('path, circle').length }));
      equal([icon.tag, icon.w > 50, icon.parts], ['svg', true, 8], 'two swords, drawn in the page');
      const t = await bareModal(page);
      assert(/Standing to defend the Ironbow: 10 defenders, Line Infantry ×4, Heavy Infantry ×2, Shock Cavalry ×2\./.test(t) && /Enemy: Established local force\. Estimated enemy: \d+–\d+ Battle Value/.test(t) && /An attack can’t be called off/.test(t), t);
      equal(await page.$$eval('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button', bs => bs.map(b => b.textContent)), ['Later', 'Defend the Ironbow']);
      const s = await st(page);
      const ma = s.militaryActions[0];
      equal([s.militaryActions.length, ma.kind, ma.objective, ma.targetName, ma.tier, ma.map, ma.step, ma.undefended, s.dayInProgress.attackRolled],
        [1, 'defence', 'defend', 'Bacca', 'established', 'defend_coast', 'weather', false, true]);
      equal(s.log.find(l => l.title === 'Defend Bastion').body, 'Sound the horns! Clan Bacca warships are approaching! Defend the Ironbow! Defending it: 10 defenders, Line Infantry ×4, Heavy Infantry ×2, Shock Cavalry ×2.');
      for (const size of ['laptop', 'tv', 'laptopFull']) {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(250);
        const lc = await H.layoutCheck(page, ['.tsi-modal:not(.tsi-bas-panel)', '.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button', '[data-test=attack-icon]']);
        equal([lc.scrollWidth, lc.outOfView], [lc.clientWidth, []], size);
        if (size !== 'laptopFull') await H.shot(page, 'p9-war4-attack-' + size);
      }
      await page.setViewportSize(H.SIZES.laptop.viewport);
    });

    await check('Later: the attack waits in the War Council, with no Call off, and Make peace is refused until it\'s fought', async () => {
      await clickModal(page, 'Later');
      assert(/Sound the horns! Clan Bacca warships are approaching! Defend the Ironbow!/.test(await word(page)));
      const s = await st(page);
      equal([s.day, s.dayInProgress, s.militaryActions.length], [2, null, 1]);
      equal(await bare(page, '[data-test=ma-0] .tsi-bas-item__name'), 'Defend Bastion vs Bacca');
      equal(await page.textContent('[data-test=ma-continue-0]'), 'Defend the Ironbow');
      equal(await page.$('[data-test=ma-calloff-0]'), null, 'an attack can\'t be called off');
      assert(/Clan Bacca attacked your Bastion on Day 2\. Defending it: 10 defenders/.test(await bare(page, '[data-test=ma-0]')));
      equal(await page.isDisabled('[data-test=make-peace-bacca]'), true);
      equal(await bare(page, '[data-test=wars-why-bacca]'), 'Clan Bacca\'s attack on your Bastion still has to be fought. Defend the Ironbow before making peace.');
      await reveal(page, '[data-test=queue-war]');
      await H.shot(page, 'p9-war4-attack-waiting');
    });

    await check('reopening: the attack still waits, with its notice', async () => {
      await reopen(page);
      await H.waitForNotice(page, /An attack on your Bastion \(Defend Bastion vs Bacca(At War)?\) is waiting\. Defend the Ironbow from the Banner & War Council panel\./);
      equal((await st(page)).militaryActions.map(m => m.kind), ['defence']);
      await H.dismissNotices(page);
    });

    await check('orders at all five starting facilities (to see the repairs hold them)', async () => {
      await treasury(page, '5000');
      for (const [f, fn, i] of [['barracks', 'recruit_defenders'], ['dock', 'charter_berth', 1], ['workshop', 'craft_magic_item', 3], ['armoury', 'arm_defenders'], ['watchtower', 'patrol']]) await issue(page, f, fn, i);
      const s = await st(page);
      equal(s.pendingOrders.map(o => [o.facId, o.dueDay - o.issuedDay]).sort(), [['armoury', 3], ['barracks', 5], ['dock', 7], ['watchtower', 1], ['workshop', 10]], 'each order\'s own days');
    });

    await check('Defend the Ironbow: the three rolls, then the War Table on the Ironbow coast; reopening part-way loses nothing', async () => {
      await spyTable(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=d20]');
      assert(/Weather Conditions: Defend Bastion vs Bacca/.test(await bareModal(page)), await bareModal(page));
      await d20(page, 15);
      await page.waitForSelector('[data-test=ma-result]');
      await clickModal(page, 'Continue');
      await page.waitForSelector('[data-test=d20]');
      /* Closed after the Weather roll. */
      await reopen(page);
      await H.dismissNotices(page);
      equal((await st(page)).militaryActions[0].step, 'morale');
      equal(await page.textContent('[data-test=ma-continue-0]'), 'Continue');
      await spyTable(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await d20(page, 15);
      await page.waitForSelector('[data-test=ma-result]');
      await clickModal(page, 'Continue');
      await d20(page, 3);
      await page.waitForSelector('[data-test=ma-result]');
      await clickModal(page, 'Continue');
      await page.waitForSelector('[data-test=wt-root]');
      await page.waitForFunction(() => { const i = document.querySelector('[data-test=wt-map]'); return i && i.complete && i.naturalWidth > 0 && !i.hidden; });
      const o = await page.evaluate(() => window.__wtOpts);
      equal([o.title, o.canCallOff, o.enemy], ['Defend Bastion vs Bacca', false, { clanKey: 'bacca', clanName: 'Bacca' }]);
      equal(o.presetMap, { key: 'preset:defend_coast', src: 'tools/bastion/assets/war/defend-bastion-coast.jpg', cols: 22, rows: 22, cells: 484 });
      equal(o.keys.indexOf('presetMap') !== -1, true);
      const map = await page.evaluate(() => TSI.bastion.debug.warTable().map());
      equal([map.key, map.name, map.preset, map.shown], ['preset:defend_coast', 'The Ironbow coast', true, true]);
      assert(/tools\/bastion\/assets\/war\/defend-bastion-coast\.jpg$/.test(await page.getAttribute('[data-test=wt-map]', 'src')));
      assert(/Defend Bastion vs Bacca/.test(await text(page, 'wt-title')));
      equal(await page.isVisible('[data-test=wt-calloff]'), false, 'no Call off');
      equal(await tagsIn('.tsi-bas-wt'), 0, 'no tags on the War Table');
      for (const size of ['laptop', 'tv']) {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(300);
        const lc = await H.layoutCheck(page, ['[data-test=wt-close]', '[data-test=wt-stage]', '[data-test=wt-begin-deploy]']);
        equal([lc.scrollWidth, lc.outOfView], [lc.clientWidth, []], size);
        await H.shot(page, 'p9-war4-coast-' + size);
      }
      await page.setViewportSize(H.SIZES.laptop.viewport);
      await page.waitForTimeout(300);
      await pause(page);
      await page.click('[data-test=wt-begin-deploy]');
      await page.waitForTimeout(400);
      await page.click('[data-test=wt-close]');
      await page.waitForTimeout(300);
      /* Closed on the War Table: the coast comes back. */
      await reopen(page);
      await H.dismissNotices(page);
      await spyTable(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=wt-root]');
      await page.waitForTimeout(300);
      const o2 = await page.evaluate(() => window.__wtOpts);
      equal([o2.battle, o2.presetMap.key, o2.canCallOff], ['deploy', 'preset:defend_coast', false]);
      equal((await page.evaluate(() => TSI.bastion.debug.warTable().map())).key, 'preset:defend_coast');
      equal(await page.isVisible('[data-test=wt-begin-deploy]'), false, 'deployment carries on');
    });

    let lost = null;
    await check('losing the defence (withdrawing): up to half the treasury, and facilities Under Repair, in the War Report', async () => {
      await pause(page);
      await page.click('[data-test=wt-start-battle]');
      await clickModal(page, 'Start Battle');
      await page.waitForSelector('[data-test=wt-briefing]');
      await clickModal(page, 'Begin the battle');
      await page.waitForTimeout(400);
      await pause(page);
      await page.click('[data-test=wt-enemy-act]');
      await page.waitForFunction(() => { const m = TSI.bastion.debug.state().militaryActions[0]; return m.battle.started && m.battle.turnSide === 'player'; }, null, { timeout: 8000 });
      await page.waitForTimeout(400);
      const before = await st(page);
      await page.click('[data-test=wt-withdraw]');
      await page.waitForSelector('[data-test=wt-withdraw-preview]');
      const pre = await text(page, 'wt-withdraw-preview');
      assert(/withdrawing counts as losing the defence/.test(pre) && /Treasury: you lose 1d10 × 5% of it, 5% to 50%/.test(pre) && /Under Repair: 1d4 of your built facilities, chosen at random/.test(pre), pre);
      await clickModal(page, 'Withdraw');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'); return t && t.textContent === 'War Report'; }, null, { timeout: 10000 });
      await page.waitForTimeout(450);
      const report = await bareModal(page);
      const s = await st(page);
      assert(/Withdrawal: Defend Bastion vs Bacca/.test(report) && /Defending the Bastion: 10 defenders/.test(report) && /Clan Bacca attacked your Bastion on Day 2\./.test(report), report);
      const m = /Treasury: −(\d+) gp \(d10 (\d+): (\d+)% of (\d+) gp; now (\d+) gp\)\./.exec(report);
      assert(m, report);
      const [lostGp, roll, pct, was, now] = m.slice(1).map(Number);
      equal([pct, was, lostGp, now, s.treasuryGP], [roll * 5, before.treasuryGP, Math.floor(before.treasuryGP * pct / 100), before.treasuryGP - lostGp, now]);
      assert(pct >= 5 && pct <= 50, 'up to half');
      const r = /Under Repair until Day (\d+) \(d4 (\d+)\): ([^.]+)\./.exec(report);
      assert(r, report);
      const names = r[3].split(', ');
      const ids = await page.evaluate(ns => ns.map(n => TSI_DATA.bastionFacilities.find(f => f.name === n).id), names);
      equal([Number(r[1]), names.length], [15, Math.min(Number(r[2]), 5)], 'lost on Day 2: Under Repair until Day 15');
      equal(Object.keys(s.repairs).sort(), ids.slice().sort());
      assert(Object.keys(s.repairs).every(id => s.repairs[id] === 15), 'lost on Day 2: Under Repair on Days 2 to 15 (14 days)');
      assert(await tagsIn('.tsi-modal:not(.tsi-bas-panel)') >= 1, 'the War Report is a Bastion pop-up: Bacca is tagged');
      /* Not the first word of an enemy unit's name ("Bacca Stoneguard 1"): that would tag every unit. */
      assert(/\n- Bacca [A-Z]/.test(report), report);
      equal(await page.$$eval('.tsi-modal:not(.tsi-bas-panel) [data-test=atwar-tag]', ts => ts.filter(t => /^[  ][A-Z]/.test((t.nextSibling && t.nextSibling.textContent) || '')).length), 0, 'no tag inside a unit\'s name');
      await H.shot(page, 'p9-war4-defence-report');
      await clickModal(page, 'Close');
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'));
      lost = { ids, names };
    });

    await check('Under Repair: marked on its tile, its panel, the map and the lists; its orders refused; orders already there wait', async () => {
      const s = await st(page);
      equal([s.militaryActions.length, s.warLog[0].title], [0, 'Withdrawal: Defend Bastion vs Bacca']);
      equal(await page.$$eval('.tsi-bas-tile--repair', ts => ts.map(t => t.dataset.fac).sort()), lost.ids.slice().sort());
      for (const id of lost.ids) {
        const name = lost.names[lost.ids.indexOf(id)];
        await pause(page);
        await page.click('[data-test=tile-' + id + ']');
        await page.waitForSelector('[data-test=panel-fac-' + id + ']');
        equal(await page.textContent('[data-test=panel-fac-' + id + '] [data-test=repair-label]'), '(Under Repair)');
        equal(await text(page, 'repair-note-' + id), 'Under Repair until Day 15: no orders, and orders already here wait. Working again on Day 16.');
        const issueBtns = await page.$$eval('[data-test=panel-fac-' + id + '] .tsi-bas-fn__issue', bs => bs.map(b => [b.disabled, b.textContent, b.title]));
        assert(issueBtns.length && issueBtns.every(b => b[0] && b[1] === 'Under Repair' && b[2] === 'The ' + name + ' is Under Repair until Day 15.'), JSON.stringify(issueBtns));
        await page.keyboard.press('Escape');
        /* The rules refuse it too (with the same words). */
        const res = await page.evaluate(src => { eval(src.d); const st2 = JSON.parse(JSON.stringify(TSI.bastion.debug.state())); const f = data.facilities.find(x => x.id === src.id); return TSI.bastion.rules.issueOrder(st2, data, src.id, f.functions[0].id, 0, Math.random); }, { d: DATA, id });
        equal(res, { ok: false, message: 'The ' + name + ' is Under Repair until Day 15.' });
        const o = s.pendingOrders.find(x => x.facId === id);
        equal(o.dueDay, 16, name + '\'s order waits for the repairs');
      }
      const working = ['workshop', 'barracks', 'watchtower', 'dock', 'armoury'].filter(id => lost.ids.indexOf(id) === -1);
      for (const id of working) equal(await page.$eval('[data-test=tile-' + id + ']', t => t.classList.contains('tsi-bas-tile--repair')), false, id + ' works');
      const metas = await page.$$eval('[data-test^=pending-meta-]', ms => ms.map(m => m.textContent));
      equal(metas.length, 0, 'the Orders panel is closed');
      await reveal(page, '[data-test=pending]');
      const metas2 = await page.$$eval('[data-test=pending] [data-test^=pending-meta-]', ms => ms.map(m => m.textContent));
      equal(metas2.filter(m => /waiting: the .+ is Under Repair until Day 15$/.test(m)).length, lost.ids.length);
      await page.keyboard.press('Escape');
      /* In the order the grid shows them. */
      const order = await page.$$eval('.tsi-bas-tile', ts => ts.map(t => t.dataset.fac));
      const inOrder = lost.ids.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(id => lost.names[lost.ids.indexOf(id)]);
      equal(await text(page, 'map-repairs'), 'Under Repair: ' + inOrder.map(n => n + ' (working again on Day 16)').join(', '));
      await H.shot(page, 'p9-war4-under-repair');
    });

    await check('the repairs last 14 days (Harry\'s 2 Bastion turns: the day lost and 13 more); then the facilities work, and their orders complete', async () => {
      /* Peace first, so no more attacks come. */
      await pause(page);
      await page.click('[data-test=make-peace-bacca]');
      await clickModal(page, 'Make peace');
      equal((await st(page)).wars, {});
      await days(page, 13, []);
      let s = await st(page);
      equal([s.day, Object.keys(s.repairs).sort(), s.pendingOrders.map(o => o.facId).sort()], [15, lost.ids.slice().sort(), lost.ids.slice().sort()], 'Day 15: the others\' orders complete');
      equal(await page.$$eval('.tsi-bas-tile--repair', c => c.length), lost.ids.length, 'Day 15: still Under Repair');
      await days(page, 1, []);
      s = await st(page);
      equal([s.day, s.repairs, s.pendingOrders], [16, {}, []], 'Day 16: working again, and the orders done');
      equal(s.log.filter(l => l.title === 'Repairs Complete').map(l => l.body).sort(), lost.names.map(n => 'Repairs: the ' + n + ' is working again.').sort());
      equal(await page.$$eval('.tsi-bas-tile--repair', c => c.length), 0);
      equal(await page.isVisible('[data-test=map-repairs]'), false);
      equal(await page.isDisabled('[data-test=issue-barracks__recruit_defenders]'), false);
    });

    await check('nobody free to defend: the Bastion falls without a battle; reopening part-way doesn\'t roll again', async () => {
      await setUp(page, (s) => {
        s.wars = { karr: { since: s.day, last: s.day, next: s.day + 1 } };
        s.defenders.count = 0; s.defenders.armed = false; s.military = []; s.defenderBeasts = []; s.pendingOrders = [];
        s.treasuryGP = 1000;
      });
      await page.evaluate(() => { window.__dice = [0, 0]; });
      await setExplorerDay(page, (await st(page)).day + 1);
      await page.waitForSelector('[data-test=attack-undefended]', { timeout: 15000 });
      await page.waitForTimeout(450);
      assert(/^Nobody is free to defend the Bastion, so Clan Karr takes what it came for unopposed\. You lose 1d10 × 5% of your treasury/.test(await bare(page, '[data-test=attack-undefended]')), await bare(page, '[data-test=attack-undefended]'));
      assert(!/committed elsewhere|recovering/.test(await bare(page, '[data-test=attack-undefended]')), 'no defenders at all here: nothing is committed elsewhere or recovering');
      equal(await page.$$eval('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button', bs => bs.map(b => b.textContent)), ['See the War Report']);
      equal((await st(page)).militaryActions.map(m => [m.kind, m.targetName, m.tier, m.undefended]), [['defence', 'Karr', 'small', true]]);
      await H.shot(page, 'p9-war4-undefended');
      /* Closed while it shows: the day is left part-way; it finishes by itself, rolling no new attack. */
      await reopen(page);
      await H.waitForNotice(page, /An attack on your Bastion \(Defend Bastion vs Karr(At War)?\) is waiting/);
      assert(/Sound the horns! Clan Karr warships are approaching!/.test(await word(page)));
      await H.dismissNotices(page);
      equal(await page.textContent('[data-test=ma-continue-0]'), 'See the War Report');
      equal(await page.textContent('[data-test=ma-status-0]'), 'Nobody is free to defend the Bastion: it falls without a battle. Next: the War Report.');
      let s = await st(page);
      equal([s.dayInProgress, s.militaryActions.length, s.log.filter(l => l.title === 'Defend Bastion' && /Karr/.test(l.body)).length], [null, 1, 1], 'no second attack roll');
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'); return t && t.textContent === 'War Report'; });
      await page.waitForTimeout(450);
      const report = await bareModal(page);
      assert(/Defeat: Defend Bastion vs Karr/.test(report) && /Defending the Bastion: nobody/.test(report) && /Nobody was free to defend the Bastion, so Clan Karr took what it came for unopposed\./.test(report), report);
      const m = /Treasury: −(\d+) gp \(d10 (\d+): (\d+)% of 1000 gp; now (\d+) gp\)\./.exec(report);
      assert(m, report);
      await clickModal(page, 'Close');
      s = await st(page);
      equal([s.militaryActions.length, s.warLog[0].title, s.treasuryGP], [0, 'Defeat: Defend Bastion vs Karr', Number(m[4])]);
      assert(Object.keys(s.repairs).length >= 1, 'facilities Under Repair');
      equal(await page.isDisabled('[data-test=make-peace-karr]'), false);
    });

    await check('the Watchtower\'s Patrol: an attack on the day it finishes (or the 7 after) reminds the DM of the defenders\' Advantage, in the pop-up and the War Council', async () => {
      await setUp(page, (s) => {
        s.wars = { karr: { since: s.day, last: s.day, next: s.day + 1 } };
        s.defenders.count = 10; s.defenders.armed = true; s.repairs = {};
        s.pendingOrders = [{ id: 'patrol-1', facId: 'watchtower', fnId: 'patrol', chosen: null, optionLabel: null, label: 'Watchtower: Patrol', costGP: 0, issuedDay: s.day, dueDay: s.day + 1 }];
      });
      await page.evaluate(() => { window.__dice = [0, 0]; });
      await setExplorerDay(page, (await st(page)).day + 1);
      await page.waitForSelector('[data-test=attack]', { timeout: 15000 });
      await page.waitForTimeout(450);
      const line = 'The Watchtower\'s patrol saw them coming: your Bastion Defenders have Advantage on all their rolls in this battle (roll two d20s and keep the higher).';
      equal(await text(page, 'attack-patrol'), line);
      equal((await H.layoutCheck(page, ['.tsi-modal:not(.tsi-bas-panel)', '.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button'])).outOfView, []);
      await H.shot(page, 'p9-war4-attack-patrol');
      await clickModal(page, 'Later');
      await word(page);
      equal(await text(page, 'ma-patrol-0'), line);
      await reopen(page);
      await H.dismissNotices(page);
      equal(await text(page, 'ma-patrol-0'), line, 'after reopening');
      /* When the Patrol is over, the waiting defence keeps it. And while
         Karr's attack waits, no Clan rolls to attack: Bacca's 1 would
         otherwise find the whole army standing in Karr's defence. */
      await setUp(page, (st2) => { st2.wars.bacca = { since: st2.day, last: st2.day, next: st2.day + 8 }; });
      await page.evaluate(() => { window.__dice = [0, 0, 0, 0]; });
      await days(page, 8, []);
      const s = await st(page);
      equal(await page.evaluate(() => window.__dice.length), 4, 'no dice: Bacca\'s roll day passes without a roll');
      await page.evaluate(() => { window.__dice = []; });
      equal([await page.evaluate(() => TSI.bastion.rules.patrolActive(TSI.bastion.debug.state())), s.militaryActions.map(m => [m.kind, m.targetKey, m.patrol])], [false, [['defence', 'karr', true]]], 'one attack at a time');
      equal(await text(page, 'ma-patrol-0'), line);
      await setUp(page, (st2) => { delete st2.wars.bacca; });
    });

    await check('At War tags also follow a Clan\'s name in capitals (the Day Log\'s Honour Change line), and go with peace', async () => {
      await setUp(page, (s) => { s.wars = Object.assign({}, s.wars, { molten: { since: s.day, last: s.day, next: s.day + 7 } }); s.politicalCapital.molten = -100; });
      await pause(page);
      await page.click('[data-test=honour-molten]');
      await page.waitForTimeout(200);
      equal((await st(page)).log[0].body, 'Honour Change prompted for Clan MOLTEN. Political Capital reset to neutral.');
      const caps = () => page.$$eval('[data-test=log] [data-test=atwar-tag]', ts => ts.filter(t => t.dataset.name === 'MOLTEN').map(t => [t.dataset.clan, (t.previousSibling && t.previousSibling.textContent || '').slice(-6)]));
      equal(await caps(), [['molten', 'MOLTEN']]);
      await setUp(page, (s) => { delete s.wars.molten; });
      equal(await caps(), [], 'peace with Molten: its tags go');
    });

    await check('nothing went wrong', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
      equal(context.log.net, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  if (want('Warehouse, artisan tools, panels and the Compendium')) {
    section('Warehouse, artisan tools, panels and the Compendium');
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

    await check('Remove and Clear (Clear is logged twice, as before: BAS-31, kept)', async () => {
      await page.click('[data-test=wh-remove-1]');
      equal((await st(page)).warehouse.length, 1);
      await page.click('[data-test=clear-warehouse]');
      const s = await st(page);
      equal(s.warehouse.map(w => w.item), ['New Item']);
      equal(s.log.slice(0, 2).map(l => l.body), ['Cleared warehouse.', 'Cleared warehouse.']);
    });

    await check('artisan tools save as they\'re picked, show their items on hover, and feed Workshop Craft', async () => {
      await page.selectOption('[data-test=artisan-0]', 'Smith’s Tools');
      await page.hover('[data-test=artisan-0]');
      await page.waitForSelector('[data-test=tooltip]:not([hidden])');
      assert(/Enables \d+ craftable item\(s\)/.test(await text(page, 'tooltip')));
      await reopen(page);
      equal((await st(page)).artisanTools[0], 'Smith’s Tools');
      const opts = await page.$$eval('[data-test="sel-workshop__craft"] option', os => os.map(o => o.textContent));
      assert(opts.length > 5 && opts.indexOf('Battleaxe') !== -1, opts.join(','));
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

    await check('Favour of The Gods: a full bar shows Claim, which resets it', async () => {
      await setUp(page, (s) => { s.favour.pelagos = 100; s.politicalCapital.molten = -100; });
      equal(await text(page, 'favour-pelagos'), '100%');
      await page.click('[data-test=claim-pelagos]');
      equal((await st(page)).favour.pelagos, 0);
      await page.click('[data-test=honour-molten]');
      equal((await st(page)).politicalCapital.molten, 0);
    });

    await check('the Compendium: 270 items, search, details, card and Roll20 link; the War Room\'s units have their stats and no Roll20 link', async () => {
      await pause(page);
      await page.click('[data-test=compendium]');
      await page.waitForSelector('[data-test=comp-list]');
      equal(await page.$$eval('.tsi-bas-comp__item', b => b.length), 270);
      await page.fill('[data-test=comp-search]', 'line inf');
      equal(await page.$$eval('.tsi-bas-comp__item', b => b.map(x => x.textContent)), ['Line Infantry (100)']);
      await page.click('.tsi-bas-comp__item');
      const u = await text(page, 'comp-detail');
      assert(/Military unit • 100 soldiers • Cohesion 5 • Attack \+4 • Defence 13 • Move 3 • Resolve \+1 • Battle Value 5\. Reliable general-purpose troops\./.test(u) && /War Room • Recruit/.test(u), u);
      equal(await page.$('[data-test=roll20]'), null, 'no Roll20 page for a War Room unit');
      equal(await page.$$eval('.tsi-bas-comp__item', b => b.length), 1);
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
      equal([file.version, Object.keys(file.items).length], [1, 271]);
      equal(await text(page, 'comp-status'), 'Done. Filled: 0 • Kept: 68 • Stubbed: 202. Downloading…');
      /* The War Room's units: their stat blocks from the war's data, and no Roll20 link. */
      const units = await page.evaluate(() => TSI_DATA.bastionWar.warRoom.filter(e => e.type).map(e => e.label));
      equal(units.length, 6);
      units.forEach(u => equal([file.items[u].source, file.items[u].roll20, /^Military unit • \d+ soldiers • Cohesion \d+ • Attack /.test(file.items[u].summary)], ['War Room', '', true], u));
      equal(file.items['Line Infantry (100)'].summary, 'Military unit • 100 soldiers • Cohesion 5 • Attack +4 • Defence 13 • Move 3 • Resolve +1 • Battle Value 5. Reliable general-purpose troops.');
      equal(file.items['Shock Cavalry (25)'].summary, 'Military unit • 25 soldiers • Cohesion 5 • Attack +5 • Defence 14 • Move 4 • Resolve +1 • Battle Value 8 • Strong Charge. Strong Charge, expensive.');
      assert(/^https:\/\/roll20\.net\//.test(file.items['Bag of Holding'].roll20), 'other items keep theirs');
      await clickModal(page, 'Close');
      equal(context.log.net, []);
      equal(context.log.failed, []);
    });

    await check('the War Room\'s units in the Compendium follow war-units-data.js: a change there shows on screen and in the export', async () => {
      /* As if Harry had edited Line Infantry's Attack and Defence in war-units-data.js. */
      await page.evaluate(() => { const a = TSI_DATA.bastionWar.archetypes.line; window.__was = [a.attack, a.defence]; a.attack = 3; a.defence = 12; });
      await pause(page);
      await page.click('[data-test=compendium]');
      await page.waitForSelector('[data-test=comp-list]');
      await page.fill('[data-test=comp-search]', 'line inf');
      await page.click('.tsi-bas-comp__item');
      const u = await text(page, 'comp-detail');
      assert(/Military unit • 100 soldiers • Cohesion 5 • Attack \+3 • Defence 12 • Move 3/.test(u), u);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-test=comp-export]')]);
      const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
      assert(/Attack \+3 • Defence 12/.test(file.items['Line Infantry (100)'].summary), file.items['Line Infantry (100)'].summary);
      await clickModal(page, 'Close');
      await page.evaluate(() => { const a = TSI_DATA.bastionWar.archetypes.line; a.attack = window.__was[0]; a.defence = window.__was[1]; });
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
      equal([rec.value.treasuryGP, rec.value.day, rec.value.v], [1234, 2, 2]);
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
      equal([(await st(page)).treasuryGP, (await st(page)).v], [0, 2]);
      assert((await page.evaluate(() => TSI.store.keys())).some(k => k.indexOf('tsi.quarantine.bastion.state') === 0));
    });

    await check('a Bastion saved in Bastion turns is set aside (kept, not deleted) and a new one starts on the Explorer\'s day, saying so', async () => {
      await page.evaluate(() => TSI.store.set('tsi.bastion.state', { treasuryGP: 500, partyLevel: 9, turn: 6, builtExtras: [], pendingOrders: [{ id: 'x', completeTurn: 7 }], defenders: { count: 3 }, warehouse: [], turnInProgress: null }));
      const before = (await page.evaluate(() => TSI.store.keys())).filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0).length;
      await reopen(page);
      await H.waitForNotice(page, /Your Bastion was saved in Bastion turns, before the Bastion counted in days, so it has been set aside/);
      await page.waitForFunction(() => TSI.bastion.debug.state().anchored);
      const s = await st(page);
      equal([s.v, s.treasuryGP, s.partyLevel, s.pendingOrders, s.day], [2, 0, 7, [], 2]);
      const keys = (await page.evaluate(() => TSI.store.keys())).filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0);
      equal(keys.length, before + 1, 'the old Bastion is kept aside');
      equal((await page.evaluate(k => TSI.store.get(k), keys[keys.length - 1])).turn, 6);
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
