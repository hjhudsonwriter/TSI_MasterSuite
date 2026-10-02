/* Phase 9: The Ironbow Bastion Manager, clicked through from a double-clicked
   index.html with the internet off, at Harry's laptop size and on the TV.
   Then the same campaign, with the same dice, in the old Bastion and the
   rebuild, compared step by step.
   Run with:  node tests/e2e/phase9.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const BASTION = INDEX + '?tool=bastion';
const LEGACY_ROOT = path.join(H.ROOT, '_legacy');
const HAS_LEGACY = fs.existsSync(path.join(LEGACY_ROOT, 'bastion_manager/app.js'));

/* Before the page loads: seedable dice. */
function setup() {
  window.__seed = function (a) {
    Math.random = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
}

async function newPage(browser, size, extra) {
  const context = await H.newContext(browser, size || 'laptop', Object.assign({ acceptDownloads: true }, extra || {}));
  await context.setOffline(true);
  await context.addInitScript(setup);
  const page = await context.newPage();
  return { context, page };
}
async function openBastion(page) {
  await page.goto(BASTION);
  await page.waitForSelector('[data-test=advance]');
}
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
/* Change the Bastion directly to set up a check. fn is run in the page with the state. */
const setUp = (page, fn) => page.evaluate(src => TSI.bastion.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const text = (page, test) => page.textContent('[data-test="' + test + '"]');
const pause = page => page.waitForTimeout(400);
async function modalOpen(page) { return !!(await page.$('.tsi-modal')); }
/* Waits briefly for the pop-up: some open only after a file has been read. */
async function modalTitle(page) {
  await page.waitForSelector('.tsi-modal__title', { timeout: 5000 }).catch(() => {});
  const m = await page.$('.tsi-modal__title'); return m ? m.textContent() : null;
}
async function clickModal(page, label) { await page.click('.tsi-modal__foot button:text-is("' + label + '")'); await page.waitForTimeout(150); }
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
    else { await page.click('.tsi-modal__foot button.tsi-btn--primary'); await page.waitForTimeout(150); }
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
        summary: o.summary, battle: o.battle ? o.battle.phase : null, specUnits: o.spec ? o.spec.player.units.length : 0, inert: (o.inert || []).length
      };
      return open.apply(this, arguments);
    };
    wt.__spied = true;
  });
}
async function advance(page, rolls) {
  await pause(page);
  await page.click('[data-test=advance]');
  await answerAll(page, rolls);
  await page.waitForFunction(() => !TSI.bastion.debug.busy());
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
  await page.click('.tsi-modal__foot button.tsi-btn--primary');
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
const crestInfo = page => page.evaluate(() => {
  const i = document.querySelector('[data-test=crest]');
  return { shown: !!(i && i.offsetWidth), w: i ? i.naturalWidth : 0, h: i ? i.naturalHeight : 0, alt: i ? i.alt : '' };
});

async function reopen(page) {
  await page.evaluate(() => TSI.store.flush());
  await page.reload();
  await page.waitForSelector('[data-test=advance]');
}
const ALL_EXTRAS = ['arcane_study', 'library', 'smithy', 'garden', 'menagerie', 'laboratory', 'war_room', 'gaming_hall', 'greenhouse', 'shrine_telluria', 'shrine_aurush', 'shrine_pelagos', 'hall_of_emissaries'];

/* A tiny web server for the old tool, which loads its data with fetch(). It
   builds paths from the first folder in the address, so it's served from _legacy/. */
function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(dir, rel);
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('Opening it, and fitting Harry\'s screens (internet off)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');

    await check('the home card says Open; every tool is now built', async () => {
      const card = await page.textContent('.tsi-card[href*="bastion"]');
      assert(/Open/.test(card) && !/Coming/.test(card), card);
      equal(await page.$$eval('.tsi-card', cs => cs.filter(c => /Coming in phase/.test(c.textContent)).length), 0);
    });

    await check('it opens from its card at turn 1, level 7, with the five starting facilities', async () => {
      await page.click('.tsi-card[href*="bastion"]');
      await page.waitForSelector('[data-test=advance]');
      equal(await text(page, 'turn'), 'Turn 1');
      equal(await page.inputValue('[data-test=level]'), '7');
      equal(await page.$$eval('.tsi-bas-fac', cs => cs.map(c => c.dataset.fac)), ['workshop', 'barracks', 'watchtower', 'dock', 'armoury']);
      equal(await text(page, 'slot-meta'), 'Level 7 → 2 slot(s). Used: 0/2');
    });

    for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
      await check('fits ' + size + ' with no sideways scrolling, the main controls in view', async () => {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(250);
        await page.evaluate(() => window.scrollTo(0, 0));
        const lc = await H.layoutCheck(page, ['[data-test=advance]', '[data-test=level]', '[data-test=roll-event]', '[data-test=compendium]', '[data-test=download-save]', '[data-test=import-save]', '[data-test=map]']);
        equal(lc.scrollWidth, lc.clientWidth, 'no sideways scroll');
        if (size !== 'smallWindow') equal(lc.outOfView, [], 'in view');
        /* The tool's bar stays in view when the page scrolls down. */
        await page.evaluate(() => window.scrollTo(0, 2500));
        await page.waitForTimeout(100);
        equal((await H.layoutCheck(page, ['[data-test=advance]'])).outOfView, [], 'Advance in view after scrolling');
        if (size !== 'smallWindow') equal((await H.layoutCheck(page, ['.tsi-bas-side'])).outOfView, [], 'the Favour panel sticks in view');
        await page.evaluate(() => window.scrollTo(0, 0));
      });
    }
    await page.setViewportSize(H.SIZES.laptop.viewport);
    await H.shot(page, 'p9-01-laptop');

    await check('every facility picture and all eight map overlays load with no internet', async () => {
      await setUp(page, (s) => { s.partyLevel = 17; s.builtExtras = ['arcane_study', 'library', 'smithy', 'garden', 'menagerie', 'laboratory', 'war_room', 'gaming_hall', 'greenhouse', 'shrine_telluria', 'shrine_aurush', 'shrine_pelagos', 'hall_of_emissaries'].map(id => ({ facId: id, status: 'built' })); });
      await page.waitForFunction(() => Array.from(document.images).every(i => i.complete));
      const imgs = await page.$$eval('.tsi-bas-fac__img, .tsi-bas-map__overlay, .tsi-bas-map__img, .tsi-bas-hall__img img', is => is.map(i => [i.getAttribute('src').split('/').pop(), i.naturalWidth]));
      equal(imgs.filter(i => !i[1]), [], 'all loaded');
      equal(await page.$$eval('.tsi-bas-fac', cs => cs.length), 17, 'the Hall has its own panel');
      equal(await page.$$eval('.tsi-bas-map__overlay', os => os.map(o => o.dataset.fac).sort()), ['arcane_study', 'garden', 'greenhouse', 'hall_of_emissaries', 'laboratory', 'library', 'smithy', 'war_room']);
      equal(await page.$$eval('.tsi-bas-map__overlay', os => os.map(o => o.naturalWidth)), [1152, 1152, 1152, 1152, 1152, 1152, 1152, 1152]);
      await H.shot(page, 'p9-02-everything-built');
    });

    await check('nothing reached for the internet, and nothing failed', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });

    await check('the TV: the same page, wider, with the Favour panel beside it', async () => {
      await page.setViewportSize(H.SIZES.tv.viewport);
      await page.waitForTimeout(250);
      const box = await page.evaluate(() => { const r = document.querySelector('.tsi-bas-side').getBoundingClientRect(); const m = document.querySelector('.tsi-bas-card--map').getBoundingClientRect(); return { side: r.width, map: m.width }; });
      assert(box.side === 300 && box.map > 700, JSON.stringify(box));
      await H.shot(page, 'p9-03-tv');
      await page.setViewportSize(H.SIZES.laptop.viewport);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Construction slots');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);

    await check('slots by party level: 0 / 2 / 4 / 5 / 6', async () => {
      const out = [];
      for (const lvl of ['4', '5', '9', '13', '17']) {
        await page.selectOption('[data-test=level]', lvl);
        out.push(await text(page, 'slot-meta'));
      }
      equal(out, ['Level 4 → 0 slot(s). Used: 0/0', 'Level 5 → 2 slot(s). Used: 0/2', 'Level 9 → 4 slot(s). Used: 0/4', 'Level 13 → 5 slot(s). Used: 0/5', 'Level 17 → 6 slot(s). Used: 0/6']);
    });

    await check('locked facilities stay listed but can\'t be picked', async () => {
      await page.selectOption('[data-test=level]', '9');
      const opts = await page.$$eval('[data-test=slot-select-0] option', os => os.map(o => [o.textContent, o.disabled]));
      assert(opts.some(o => o[0] === 'Menagerie (Locked: Lvl 13)' && o[1]), JSON.stringify(opts));
      assert(opts.some(o => o[0] === 'Library' && !o[1]));
    });

    await check('the slot list shows what a facility does on hover', async () => {
      await page.selectOption('[data-test=slot-select-0]', 'library');
      await page.hover('[data-test=slot-select-0]');
      await page.waitForSelector('[data-test=tooltip]:not([hidden])');
      assert(/Library/.test(await text(page, 'tooltip')) && /What it does/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
    });

    await check('building takes 3, 4 or 5 turns, then the facility joins the carousel and the map', async () => {
      await page.click('[data-test=build-0]');
      await page.selectOption('[data-test=slot-select-1]', 'laboratory');
      await page.click('[data-test=build-1]');
      const slots = await text(page, 'slots');
      assert(/LibraryUnder construction • 3 turn\(s\) remaining/.test(slots) && /LaboratoryUnder construction • 4 turn\(s\) remaining/.test(slots), slots);
      assert(/Library \(Already chosen\)/.test(await page.textContent('[data-test=slot-select-2]')));
      for (let i = 0; i < 3; i++) await advance(page, []);
      assert(/LibraryBuilt • Active/.test(await text(page, 'slots')));
      equal(await page.$$eval('.tsi-bas-fac[data-fac=library]', c => c.length), 1);
      equal(await page.$$eval('.tsi-bas-map__overlay', os => os.map(o => o.dataset.fac)), ['library']);
      assert((await st(page)).log.some(l => l.title === 'Construction Complete' && l.body === 'Library is now built and active.'));
    });

    await check('lowering the level keeps every building, marked over capacity (BAS-04, B8)', async () => {
      await page.selectOption('[data-test=slot-select-2]', 'smithy'); await page.click('[data-test=build-2]');
      await page.selectOption('[data-test=slot-select-3]', 'garden'); await page.click('[data-test=build-3]');
      await page.selectOption('[data-test=level]', '5');
      equal(await text(page, 'slot-meta'), 'Level 5 → 2 slot(s). Used: 4/2 (2 over capacity)');
      equal(await page.$$eval('[data-test=over-capacity]', os => os.length), 2);
      equal(await page.$$eval('[data-test^=build-]', b => b.length), 0, 'no room to build');
      equal((await st(page)).builtExtras.filter(Boolean).length, 4);
      await reopen(page);
      await page.selectOption('[data-test=level]', '9');
      equal(await text(page, 'slot-meta'), 'Level 9 → 4 slot(s). Used: 4/4');
      equal(await page.$$eval('[data-test=over-capacity]', os => os.length), 0);
      await H.shot(page, 'p9-04-slots');
    });

    await check('Clear extra builds asks first; Cancel keeps them', async () => {
      await page.click('[data-test=clear-builds]');
      assert(/Your 5 starting facilities remain/.test(await H.modalText(page)));
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
  section('Orders');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await page.fill('[data-test=treasury]', '1000');

    await check('an order charges its gold once, even on a double click', async () => {
      await page.selectOption('[data-test="sel-dock__charter_berth"]', '1');
      await page.dblclick('[data-test="issue-dock__charter_berth"]');
      await page.waitForTimeout(300);
      equal(await modalOpen(page), false);
      const s = await st(page);
      equal([s.treasuryGP, s.pendingOrders.map(o => o.label)], [800, ['Dock: Charter Berth (Longship)']]);
      assert(/Completes on Turn 2/.test(await text(page, 'pending')));
    });

    await check('the same order again, or one you can\'t afford, is refused with a message', async () => {
      await issue(page, 'dock', 'charter_berth');
      equal(await H.modalText(page).then(t => /That order is already pending\./.test(t)), true);
      await clickModal(page, 'OK');
      await issue(page, 'armoury', 'arm_defenders');
      await page.fill('[data-test=treasury]', '50');
      await issue(page, 'barracks', 'recruit_defenders');
      equal((await st(page)).pendingOrders.length, 3, 'Recruit Defenders is free');
      await setUp(page, (s) => { s.defenders.count = 2; });
      await pause(page);
      await page.click('[data-test=cancel-1]');
      await issue(page, 'armoury', 'arm_defenders');
      assert(/Not enough gp\. Need 300gp, you have 50gp\./.test(await H.modalText(page)));
      await clickModal(page, 'OK');
    });

    await check('cancelling keeps the gold spent (B9, kept)', async () => {
      await page.fill('[data-test=treasury]', '500');
      await issue(page, 'armoury', 'arm_defenders');
      equal((await st(page)).treasuryGP, 200);
      await pause(page);
      await page.click('[data-test=cancel-2]');
      const s = await st(page);
      equal([s.treasuryGP, s.pendingOrders.length, s.log[0].body], [200, 2, 'Cancelled an order.']);
    });

    await check('orders complete next turn: defenders recruited, the ship in the warehouse', async () => {
      await page.evaluate(() => window.__seed(4));
      await advance(page, []);
      const s = await st(page);
      equal(s.pendingOrders, []);
      assert(s.defenders.count > 2);
      assert(s.warehouse.some(w => w.item === 'Longship' && w.notes === 'Dock'), JSON.stringify(s.warehouse));
      assert(/Recruited \d defenders/.test(s.log.map(l => l.body).join('|')));
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Advance Bastion Turn (BAS-02, BAS-03, BAS-10, BAS-12, BAS-13)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await setUp(page, (s) => { s.partyLevel = 9; s.treasuryGP = 5000; s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }, '', '', '']; });

    await check('a double click advances one turn, not two (BAS-12)', async () => {
      await page.dblclick('[data-test=advance]');
      await page.waitForTimeout(500);
      equal(await text(page, 'turn'), 'Turn 2');
      equal((await st(page)).log.filter(l => l.title === 'Turn Advanced').length, 1);
    });

    await check('while a dice box is open, Advance is off and Enter or Space can\'t start another turn (BAS-10)', async () => {
      await planHall(page, 'secure_trade_agreement', 0);
      await pause(page);
      await page.click('[data-test=advance]');
      await page.waitForSelector('[data-test=d20]');
      equal(await page.isDisabled('[data-test=advance]'), true);
      equal(await text(page, 'advance'), 'Finish Bastion Turn 3');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      equal((await st(page)).turn, 3);
      equal(await page.$$eval('.tsi-modal', m => m.length), 1);
      await H.shot(page, 'p9-05-dice');
    });

    await check('a cancelled roll keeps the order; the turn still finishes (BAS-02)', async () => {
      await clickModal(page, 'Cancel');
      await page.waitForFunction(() => !TSI.bastion.debug.busy());
      const s = await st(page);
      equal(s.turn, 3);
      equal(s.turnInProgress, null);
      equal(s.pendingOrders.map(o => [o.label, o.completeTurn]), [['Hall of Emissaries: Secure Trade Agreement (Clan Blackstone)', 3]]);
      equal(s.log[1].body, 'Hall of Emissaries: Secure Trade Agreement (Clan Blackstone) → Roll cancelled. The order stays pending for the next Bastion Turn.');
      equal(await text(page, 'advance'), 'Advance Bastion Turn (+7 days)');
      equal(s.treasuryGP, 4750, 'paid once');
    });

    await check('next turn it asks again and completes (BAS-13)', async () => {
      await advance(page, [15]);
      const s = await st(page);
      equal(s.pendingOrders, []);
      equal(s.diplomacy.agreements.length, 1);
      equal(s.treasuryGP, 4750);
    });

    await check('closing the window mid-turn loses nothing: it reopens ready to finish', async () => {
      await planHall(page, 'host_delegation', 1, { tone: 'assertive' });
      await pause(page);
      await page.click('[data-test=advance]');
      await page.waitForSelector('[data-test=d20]');
      const mid = await st(page);
      equal([mid.turn, mid.turnInProgress.stage], [5, 'orders']);
      await reopen(page);
      await H.waitForNotice(page, /Bastion Turn 5 was left part-way through/);
      equal(await text(page, 'advance'), 'Finish Bastion Turn 5');
      const s1 = await st(page);
      equal([s1.turn, s1.pendingOrders.length, s1.treasuryGP], [5, 1, mid.treasuryGP]);
      await page.click('[data-test=advance]');
      await answerAll(page, [12, 14, 13]);
      await page.waitForFunction(() => !TSI.bastion.debug.busy());
      const s2 = await st(page);
      equal([s2.turn, s2.turnInProgress, s2.pendingOrders.length, s2.diplomacy.delegations.length], [5, null, 0, 1]);
      equal(s2.log.filter(l => l.body === 'Bastion Turn is now 5.').length, 1);
      equal(await text(page, 'advance'), 'Advance Bastion Turn (+7 days)');
    });

    await check('every 4th turn rolls a Bastion event into the event box', async () => {
      await page.evaluate(() => window.__seed(12));
      for (let i = 0; i < 3; i++) await advance(page, []);
      equal(await text(page, 'turn'), 'Turn 8');
      const ev = await text(page, 'event');
      assert(/Roll: \d+/.test(ev), ev);
      assert((await st(page)).log.some(l => /^Auto event \(Turn 8\)/.test(l.body)));
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
  section('The Hall of Emissaries');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await page.fill('[data-test=treasury]', '5000');

    await check('before it\'s built: "Not built yet", and Upgrade is off', async () => {
      assert(/Not built yet/.test(await text(page, 'hall')));
      equal(await page.isDisabled('[data-test=hall-upgrade]'), true);
    });

    await setUp(page, (s) => { s.partyLevel = 9; s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }, '', '', '']; });

    await check('its actions show their notes on hover, and lock until the Hall is upgraded', async () => {
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
      await H.shot(page, 'p9-06-planning');
      await clickModal(page, 'Cancel');
      equal([(await st(page)).treasuryGP, (await st(page)).pendingOrders.length], [5000, 0]);
    });

    await check('Host Delegation: three dice boxes, Political Capital changes once (B2)', async () => {
      await planHall(page, 'host_delegation', 0, { tone: 'conciliatory' });
      equal((await st(page)).treasuryGP, 4850);
      await pause(page);
      await page.click('[data-test=advance]');
      const titles = [];
      for (const r of [20, 12, 11]) { await page.waitForSelector('[data-test=d20]'); titles.push(await modalTitle(page)); await d20(page, r); }
      equal(titles, ['Host Delegation (Clan Blackstone)', 'Diplomacy Roll (conciliatory)', 'Insight Roll (conciliatory)']);
      assert(/Critical Success/.test(await text(page, 'result-roll')));
      const changes = await text(page, 'result-changes');
      assert(/Political Capital: \+15 \(Clan Blackstone\)/.test(changes) && (changes.match(/Political Capital/g) || []).length === 1, changes);
      await H.shot(page, 'p9-07-result');
      await clickModal(page, 'Continue');
      await page.waitForFunction(() => !TSI.bastion.debug.busy());
      equal(await text(page, 'pc-blackstone'), '15');
      equal(await text(page, 'tokens'), '1');
    });

    await check('a bad failure: no deal, −20 Political Capital, and a 2-turn cooldown on the button', async () => {
      await planHall(page, 'secure_trade_agreement', 1);
      await advance(page, [5]);
      const s = await st(page);
      equal([s.diplomacy.agreements.length, s.politicalCapital.rowthorn, s.diplomacy.cooldowns.trade_agreement], [0, -20, 2]);
      equal(await text(page, 'issue-hall_of_emissaries__secure_trade_agreement'), 'Cooldown: 2 turns');
      equal(await page.isDisabled('[data-test="issue-hall_of_emissaries__secure_trade_agreement"]'), true);
    });

    await check('the upgrade is free (B4, kept) and raises the Hall\'s bonus', async () => {
      const gp = (await st(page)).treasuryGP;
      await pause(page);
      await page.click('[data-test=hall-upgrade]');
      equal((await st(page)).treasuryGP, gp);
      await advance(page, []);
      equal(await text(page, 'hall-level'), 'L2');
      equal(await page.isDisabled('[data-test="issue-hall_of_emissaries__inter_clan_summit"]'), false);
    });

    await check('Clear Diplomacy Records asks first', async () => {
      await pause(page);
      await page.click('[data-test=clear-diplomacy]');
      assert(/Does not undo gold already gained/.test(await H.modalText(page)));
      await clickModal(page, 'Cancel');
      equal((await st(page)).diplomacy.delegations.length, 1);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Trade routes and the Council Ledger (BAS-05, BAS-11)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await setUp(page, (s) => {
      s.partyLevel = 9; s.turn = 3;
      s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }, '', '', ''];
      s.tradeNetwork.active = true;
      s.diplomacy.consortiums = [{ id: 'c1', title: 'Form Trade Consortium', clan: 'Blackstone', turnsLeft: 5, incomePerTurn: 100 }, { id: 'c2', title: 'Form Trade Consortium', clan: 'Karr', turnsLeft: 5, incomePerTurn: 200 }];
      s.tradeNetwork.routes = [
        { id: 'r1', clan: 'Blackstone', commodity: 'Timber', risk: 'low', expiresTurn: 8, yieldGP: 100, stabilityDC: 12, status: 'active' },
        { id: 'r2', clan: 'Karr', commodity: 'Wool & Furs', risk: 'high', expiresTurn: 8, yieldGP: 200, stabilityDC: 12, status: 'active' }
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
      equal(await page.$$eval('.tsi-modal', m => m.length), 1, 'Enter didn\'t start another');
      await d20(page, 15);
      assert(/Total Collected: 200 gp/.test(await text(page, 'routes-total')));
      await clickModal(page, 'Continue');
      equal((await st(page)).treasuryGP, 300, '100 + 200, not 100 + 100 + 200');
    });

    await check('a third Resolve says they\'re done for this turn', async () => {
      await pause(page);
      await page.click('[data-test=resolve]');
      assert(/already been resolved/.test(await H.modalText(page)));
      await clickModal(page, 'Close');
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

    await check('next turn: a disaster at sea disrupts Karr and files a dispute', async () => {
      await advance(page, [3]);
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
      assert(/Karr route status: Restored \(Active\)\./.test(await H.modalText(page)));
      await clickModal(page, 'Continue');
      const s = await st(page);
      equal([s.tradeNetwork.routes[1].status, s.arbitration.queue.length, s.politicalCapital.karr], ['active', 0, -4]);
      equal(await text(page, 'ledger'), 'Council Ledger');
    });

    await check('an empty ledger says so', async () => {
      await pause(page);
      await page.click('[data-test=ledger]');
      assert(/No disputes await judgement\./.test(await H.modalText(page)));
      await clickModal(page, 'Close');
    });

    await check('network investments are orders that complete next turn', async () => {
      await setUp(page, (s) => { s.treasuryGP = 500; });
      await pause(page);
      await page.click('[data-test=invest-stability]');
      await advance(page, [15]);
      equal((await st(page)).treasuryGP > 0, true);
      assert((await st(page)).log.some(l => l.body === 'Ironbow Trade Network: Stability Investment resolved.'));
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Party identity and the War Council');
  {
    const { context, page } = await newPage(browser, 'laptop');
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
      assert(/Clan Name is required\./.test(await H.modalText(page)));
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
      equal(await page.textContent('[data-test=crest-add]'), 'Add crest…');
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
      equal((await crestInfo(page)).shown, false);
      equal(await page.evaluate(() => TSI.store.has('tsi.bastion.crest')), false);
      await H.shot(page, 'p9-crest-none');
    });

    await check('the War Turn: target, objective, enemy force, and a box for each kind of force with what\'s free (war phase 2)', async () => {
      await setUp(page, (s) => {
        s.defenders.count = 4;
        s.defenders.armed = true;
        s.defenderBeasts = [{ name: 'Giant Vulture', qty: 5 }];
        s.military = [{ name: 'Lieutenant (1)', qty: 1 }, { name: 'Regiment (100)', qty: 1 }, { name: 'Line Infantry (100)', qty: 1 }, { name: 'Archers (50)', qty: 1 }];
      });
      equal(await page.$$eval('[data-test=war-objective] option', os => os.map(o => o.textContent)), ['Raid', 'Skirmish', 'Defend Bastion', 'Seize Outpost']);
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
      equal(await focusTip(), ['war-lieutenants', 'tsi-bas-tip', true]);
      assert(/^Lieutenant/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
      await page.keyboard.press('Tab');
      equal(await focusTip(), ['war-unit-line', 'tsi-bas-tip', true]);
      assert(/^Line Infantry/.test(await text(page, 'tooltip')) && /Cohesion5/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
      equal((await H.layoutCheck(page, ['[data-test=tooltip]'])).outOfView, [], 'beside the box, in view');
      await H.shot(page, 'p9-war-turn-keys');
      await page.keyboard.press('Escape');
      equal(await focusTip(), ['war-unit-line', null, false], 'Escape hides it');
      await page.keyboard.press('Tab');
      assert(/^Archers/.test(await text(page, 'tooltip')) && (await focusTip())[2], await text(page, 'tooltip'));
      await page.keyboard.press('Tab');
      equal(await focusTip(), ['war-beast-giant-vulture', 'tsi-bas-tip', true]);
      assert(/^Giant Vulture/.test(await text(page, 'tooltip')) && /Flight/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
      await page.keyboard.press('Tab');
      equal(await page.isHidden('[data-test=tooltip]'), true, 'gone when the focus moves on');
    });

    await check('nothing that fights is refused; each box keeps to what\'s free once typed; Lieutenants typed first are kept', async () => {
      await page.selectOption('[data-test=war-target]', 'bacca');
      for (const t of ['war-defenders', 'war-lieutenants', 'war-unit-line', 'war-unit-archers', 'war-beast-giant-vulture']) await page.fill('[data-test=' + t + ']', '0');
      await page.click('[data-test=queue-war]');
      assert(/Commit at least one force that fights/.test(await H.modalText(page)));
      await clickModal(page, 'OK');
      /* A Lieutenant alone can't fight; the hint says why. */
      await page.fill('[data-test=war-lieutenants]', '1');
      await page.press('[data-test=war-lieutenants]', 'Tab');
      equal(await page.inputValue('[data-test=war-lieutenants]'), '1', 'kept, though nothing is committed for it to lead yet');
      assert(/Each Lieutenant leads one regiment or defender detachment, so none of them can march with these forces\./.test(await text(page, 'war-hint')), await text(page, 'war-hint'));
      await pause(page);
      await page.click('[data-test=queue-war]');
      assert(/Commit at least one force that fights/.test(await H.modalText(page)));
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
      await page.evaluate(() => document.querySelector('[data-card=war]').scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -130));
      await H.shot(page, 'p9-war-turn');
    });

    await check('a double click queues one war action (BAS-15), against the mission shown', async () => {
      await pause(page);
      await page.dblclick('[data-test=queue-war]');
      await page.waitForTimeout(300);
      const s = await st(page);
      equal(s.pendingOrders.map(o => [o.label, o.meta.objective, o.meta.targetName, o.meta.tier, o.meta.missionKey, o.meta.commit]),
        [['War Action', 'raid', 'Bacca', 'established', 'bacca|raid|established', { defenders: 4, lieutenants: 1, units: { line: 2, archers: 1 }, beasts: { 'Giant Vulture': 5 } }]]);
      equal(s.log[0].title + ': ' + s.log[0].body, 'War Action Queued: Raid vs Bacca (resolves next Bastion Turn).');
      equal(await text(page, 'war-avail-unit-line'), 'None free: committed to a war action');
    });

    await check('on Advance Bastion Turn the war becomes a Military Action: Begin, or Later from the War Council', async () => {
      await pause(page);
      await page.click('[data-test=advance]');
      /* On screen and in the log the objective has its own name: "Raid vs Bacca". */
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal__title'); return t && /^War Turn: Raid vs Bacca$/.test(t.textContent); });
      const t = await H.modalText(page);
      assert(/Your forces muster for battle/.test(t) && /Committed: 4 defenders, 1 Lieutenant, Line Infantry ×2, Archers, Giant Vulture ×5\./.test(t) && /Enemy: Established local force\. Estimated enemy: /.test(t), t);
      equal((await H.layoutCheck(page, ['.tsi-modal', '.tsi-modal__foot button'])).outOfView, []);
      await H.shot(page, 'p9-war-muster');
      await clickModal(page, 'Later');
      await page.waitForFunction(() => !TSI.bastion.debug.busy());
      const s = await st(page);
      equal(s.pendingOrders, [], 'the order is gone, so it can\'t come due twice');
      const ma = s.militaryActions[0];
      equal([s.militaryActions.length, ma.v, ma.step, ma.objective, ma.targetName, ma.tier, ma.missionKey], [1, 2, 'weather', 'raid', 'Bacca', 'established', 'bacca|raid|established']);
      equal([ma.spec.player.units.map(u => u.name), ma.spec.player.leaders.length, ma.spec.player.defenders.count],
        [['Line Infantry', 'Line Infantry', 'Archers', 'Giant Vulture', 'Giant Vulture', 'Giant Vulture', 'Giant Vulture', 'Giant Vulture'], 1, 4]);
      equal(ma.spec.enemy, s.warMissions['bacca|raid|established'].enemy, 'the enemy the scouts saw');
      assert(s.log.some(l => l.body === 'Raid vs Bacca: your forces muster for battle. The Military Action is ready to begin.'));
      equal(await page.textContent('[data-test=ma-continue-0]'), 'Begin Military Action');
      equal(await page.textContent('[data-test=ma-0] .tsi-bas-item__name'), 'Raid vs Bacca');
      equal(await page.textContent('[data-test=ma-status-0]'), 'Ready to begin. First: the Weather Conditions roll.');
      equal(await page.isVisible('[data-test=ma-calloff-0]'), true);
      equal(await page.$eval('[data-test=queue-war]', b => b.classList.contains('tsi-btn--primary')), false, 'one main action in the panel');
      equal(await page.isDisabled('[data-test=advance]'), false);
    });

    await check('a waiting Military Action survives reopening, and a notice says where it is', async () => {
      await reopen(page);
      await H.waitForNotice(page, /A Military Action \(Raid vs Bacca\) is waiting/);
      equal((await st(page)).militaryActions.length, 1);
    });

    await check('Weather (DC 12), Morale (DC 12) and Luck (DC 10), each with its story; a double click can\'t make the next roll', async () => {
      await spyTable(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=d20]');
      equal((await H.noticeTexts(page)).filter(t => /is waiting/.test(t)), [], 'the notice goes once it has done its job');
      let t = await H.modalText(page);
      assert(/Weather Conditions: Raid vs Bacca/.test(t) && /Modifier: \+0/.test(t) && /DC 12/.test(t), t);
      await d20(page, 15);
      await page.waitForSelector('[data-test=ma-result]');
      t = await H.modalText(page);
      assert(/Clear Day/.test(t) && /d20 15 vs DC 12: Passed/.test(t) && /The sky holds clear and bright/.test(t), t);
      equal(await page.$('.tsi-bas-ma-pop__video'), null, 'no storm, no film');
      await page.dblclick('.tsi-modal__foot button:text-is("Continue")');
      await page.waitForTimeout(500);
      equal([(await st(page)).militaryActions[0].step, !!(await page.$('[data-test=d20]'))], ['morale', true], 'the second click didn\'t press the Morale dice box');
      t = await H.modalText(page);
      assert(/Morale: Raid vs Bacca/.test(t) && /DC 12/.test(t), t);
      await d20(page, 9);
      t = await H.modalText(page);
      assert(/Morale: Low/.test(t) && /d20 9 vs DC 12: Failed/.test(t) && /Even under a clear sky, doubt spreads/.test(t), t);
      await clickModal(page, 'Continue');
      t = await H.modalText(page);
      assert(/Luck: Raid vs Bacca/.test(t) && /DC 10/.test(t), t);
      await d20(page, 3);
      t = await H.modalText(page);
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
      equal(await page.evaluate(() => document.querySelector('.tsi-bas-layout').inert), true, 'the Bastion behind is out of reach');
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
      equal(await page.evaluate(() => document.querySelector('.tsi-bas-layout').inert), false);
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
      const turn = (await st(page)).turn;
      await spyTable(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=wt-root]');
      equal((await page.evaluate(() => window.__wtOpts)).canCallOff, false);
      await page.waitForTimeout(400);
      await page.click('[data-test=wt-withdraw]');
      await page.waitForSelector('[data-test=wt-withdraw-preview]');
      const pre = await text(page, 'wt-withdraw-preview');
      assert(/the battle counts as lost/.test(pre) && /Clan Honour: −4/.test(pre) && /Separated for 1 turn: Giant Vulture 1/.test(pre), pre);
      await H.shot(page, 'p9-war-withdraw');
      await clickModal(page, 'Withdraw');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal__title'); return t && t.textContent === 'War Report'; }, null, { timeout: 10000 });
      await page.waitForTimeout(450);
      const t = await H.modalText(page);
      assert(/Withdrawal: Raid vs Bacca/.test(t) && /Result: Withdrawal in round 1 of 6/.test(t) && /Clan Honour: −4 \(now 36\)/.test(t), t);
      assert(/Line Infantry 1: 100 soldiers → .*10 lost/.test(t) && /Line Infantry 2: 100 soldiers → .*60 lost/.test(t), t);
      equal((await H.layoutCheck(page, ['.tsi-modal', '.tsi-modal__foot button'])).outOfView, [], 'the report fits the laptop (it scrolls inside)');
      await H.shot(page, 'p9-war-report');
      await clickModal(page, 'Close');
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'));
      equal(await page.evaluate(() => document.querySelector('.tsi-bas-layout').inert), false);
      const s = await st(page);
      equal([s.militaryActions.length, s.warLog.length, s.warLog[0].title, s.clanHonor], [0, 1, 'Withdrawal: Raid vs Bacca', 36]);
      equal(s.military.filter(r => r.depleted).map(r => r.strength).sort((a, b) => a - b), [40, 90]);
      equal(s.military.filter(r => !r.depleted && /lieutenant/i.test(r.name)).map(r => r.qty), [1], 'the Lieutenant came home');
      equal(s.warRecovery.map(r => [r.kind, r.name, r.status, r.untilTurn]), [['beast', 'Giant Vulture', 'separated', turn + 1]]);
      const mil = await text(page, 'military');
      assert(/Depleted: 90\/100/.test(mil) && /Depleted: 40\/100/.test(mil), mil);
      assert(new RegExp('5 beasts • Flight \\(1 separated: back on Turn ' + (turn + 1) + '\\)').test(await text(page, 'beasts')), await text(page, 'beasts'));
      equal(await text(page, 'war-avail-beast-giant-vulture'), '4 available');
      /* Applied once: nothing more after reopening. */
      await reopen(page);
      const again = await st(page);
      equal([again.warLog.length, again.log.filter(l => l.title === 'War Turn Resolved').length, again.military, again.clanHonor], [1, 1, s.military, 36]);
      await page.evaluate(() => document.querySelector('[data-card=management]').scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -130));
      await page.hover('[data-test^=military-type-]:has-text("Depleted: 90/100")');
      await page.waitForSelector('[data-test=tooltip]:not([hidden])');
      assert(/Depleted: \d+ of 100 soldiers came home/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
      await H.shot(page, 'p9-war-depleted');
      await page.mouse.move(5, 5);
    });

    await check('recovery: the separated Giant Vulture is back after Advance Bastion Turn', async () => {
      await advance(page, []);
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
        await pause(page);
        await page.click('[data-test=advance]');
        await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal__title'); return t && /^War Turn:/.test(t.textContent); });
        return H.modalText(page);
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
      assert(new RegExp('DC ' + dc).test(await H.modalText(page)), 'Morale DC ' + dc);
      await clickModal(page, 'Cancel');
      await page.waitForFunction(() => !TSI.bastion.debug.busy());
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
      assert(/Call off the Military Action \(Raid vs Bacca\)\?/.test(await H.modalText(page)) && /The enemy army and the conditions rolled so far stay the same for the next attempt/.test(await H.modalText(page)), await H.modalText(page));
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
      await page.waitForFunction(() => !TSI.bastion.debug.busy());
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=d20]');
      equal(await page.$('[data-test=ma-unchanged]'), null, 'said once, in the muster pop-up');
      assert(new RegExp('Morale: Raid vs Bacca[\\s\\S]*DC ' + dc).test(await H.modalText(page)), 'the storm still raises the Morale DC');
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
      await H.waitForNotice(page, /was left part-way through/);
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
      await advance(page, []);
      equal((await st(page)).turnInProgress, null, 'the turn left part-way is finished');
    });

    await check('identity, war log and diplomacy survive reopening (BAS-01)', async () => {
      await setUp(page, (s) => { s.diplomacy.agreements = [{ id: 'a', title: 'Trade Agreement', clan: 'Clan Karr', turnsLeft: 3, incomePerTurn: 90 }]; s.diplomacy.tokens = 2; });
      const before = await st(page);
      await reopen(page);
      const after = await st(page);
      ['organization', 'clanHonor', 'honourRespectByClan', 'trustedClientsByClan', 'warLog', 'diplomacy', 'politicalCapital'].forEach(k => equal(after[k], before[k], k));
      equal(await text(page, 'org'), 'Clan: Clan Ironbow');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A crest from the Crest Creator (Harry\'s request, 2 October 2026)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await setUp(page, (s) => { s.partyLevel = 7; s.defenders.count = 3; });

    await check('Unsworn: the Lieutenants and regiment boxes look switched off and say why (Harry\'s report)', async () => {
      await setUp(page, (s) => { s.military = [{ name: 'Lieutenant (1)', qty: 3 }, { name: 'Regiment (100)', qty: 3 }, { name: 'Heavy Infantry (50)', qty: 1 }]; });
      equal([await page.isDisabled('[data-test=war-lieutenants]'), await page.isDisabled('[data-test=war-unit-line]'), await page.isDisabled('[data-test=war-unit-heavy]')], [true, true, true]);
      equal([await text(page, 'war-avail-lieutenants'), await text(page, 'war-avail-unit-line'), await text(page, 'war-avail-unit-heavy')], ['Clan or Brigade only', 'Clan or Brigade only', 'Clan or Brigade only']);
      assert(Number(await page.$eval('[data-test=war-lieutenants]', i => getComputedStyle(i).opacity)) < 0.6, 'greyed out');
      assert(/Only a Clan or Mercenary Brigade/.test(await page.getAttribute('[data-test=war-unit-line]', 'title')));
      assert(/Unsworn war is limited to defenders and beasts/.test(await text(page, 'war-hint')));
      await setUp(page, (s) => { s.military = []; });
      equal(await text(page, 'war-avail-regiments'), 'Clan or Brigade only', 'with no regiments, one line says so');
    });

    await check('Form Mercenary Brigade links to the Crest Creator, which opens in a new tab with no "Already open" warning', async () => {
      await pause(page);
      await page.click('[data-test=form-merc]');
      await page.waitForSelector('[data-test=crest-field]');
      equal([await page.getAttribute('[data-test=crest-creator-link]', 'href'), await page.getAttribute('[data-test=crest-creator-link]', 'target')], ['index.html?tool=crest', '_blank']);
      const [tab] = await Promise.all([context.waitForEvent('page'), page.click('[data-test=crest-creator-link]')]);
      await tab.waitForSelector('[data-test=download]');
      await tab.waitForTimeout(1500);
      const warned = async p => (await H.noticeTexts(p)).some(t => /Already open/.test(t));
      equal([await warned(tab), await warned(page)], [false, false]);
      await tab.close();
    });

    await check('the crest picked in the pop-up shows there; Cancel saves nothing', async () => {
      await H.chooseFile(page, '[data-test=crest-upload]', writeCrest('crest-pop.png', 1200));
      await page.waitForSelector('[data-test=crest-preview]:not([hidden])');
      equal(await page.textContent('[data-test=crest-upload]'), 'Change crest…');
      await clickModal(page, 'Cancel');
      equal(await page.evaluate(() => TSI.store.has('tsi.bastion.crest')), false);
      equal((await st(page)).organization.type, 'unsworn');
    });

    await check('a refused file is explained; the crest is kept with the Brigade, beside its name', async () => {
      await pause(page);
      await page.click('[data-test=form-merc]');
      await H.chooseFile(page, '[data-test=crest-upload]', H.writeTemp('not-a-crest.txt', 'hello'));
      await page.waitForFunction(() => /PNG, JPG, WebP or GIF/.test(document.body.textContent));
      await clickModal(page, 'OK');
      await page.waitForTimeout(200);
      equal(await page.isVisible('[data-test=crest-preview]'), false);
      await H.chooseFile(page, '[data-test=crest-upload]', writeCrest('crest-brigade.png', 1200));
      await page.waitForSelector('[data-test=crest-preview]:not([hidden])');
      await page.fill('[data-test=merc-name]', 'The Ironbow Freeblades');
      await clickModal(page, 'Confirm Formation');
      await page.waitForFunction(() => { const i = document.querySelector('[data-test=crest]'); return i && i.offsetWidth && i.naturalWidth; });
      const c = await crestInfo(page);
      equal([c.w, c.h, c.alt], [512, 512, 'Crest of The Ironbow Freeblades']);
      equal(await text(page, 'org'), 'Brigade: The Ironbow Freeblades');
      await page.evaluate(() => document.querySelector('[data-card=identity]').scrollIntoView({ block: 'center' }));
      await H.shot(page, 'p9-crest-brigade');
    });

    await check('Download Save includes the crest and the War Table\'s terrain; Reset clears them with the rest of the Bastion', async () => {
      await page.evaluate(() => { TSI.store.set('tsi.bastion.warTerrain', { none: { cols: 2, rows: 1, cells: 'w.' } }); return TSI.store.flush(); });
      const d = await H.download(page, '[data-test=download-save]');
      const keys = JSON.parse(d.text).records.map(r => r.key);
      assert(keys.indexOf('tsi.bastion.crest') !== -1 && keys.indexOf('tsi.bastion.warTerrain') !== -1, keys.join(','));
      await pause(page);
      await page.click('[data-test=reset]');
      await clickModal(page, 'Reset');
      await page.waitForSelector('[data-test=advance]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().organization.type === 'unsworn');
      equal(await page.evaluate(() => TSI.store.has('tsi.bastion.crest')), false);
      equal(await page.evaluate(() => TSI.store.has('tsi.bastion.warTerrain')), false, 'the painted terrain goes too');
      equal((await crestInfo(page)).shown, false);
    });

    await check('leaving the Bastion while the War Table is open leaves nothing behind', async () => {
      await setUp(page, (s) => { s.defenders.count = 2; });
      await page.fill('[data-test=war-defenders]', '2');
      await page.selectOption('[data-test=war-objective]', 'seize_outpost');
      await pause(page);
      await page.click('[data-test=queue-war]');
      await pause(page);
      await page.click('[data-test=advance]');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal__title'); return t && /^War Turn:/.test(t.textContent); });
      equal(await modalTitle(page), 'War Turn: Seize Outpost vs Blackstone', 'the objective\'s own name, not its id');
      await clickModal(page, 'Begin Military Action');
      for (let i = 0; i < 3; i++) { await d20(page, 15); await page.waitForSelector('[data-test=ma-result]'); await clickModal(page, 'Continue'); }
      await page.waitForSelector('[data-test=wt-root]');
      assert(/Seize Outpost vs Blackstone/.test(await text(page, 'wt-title')), await text(page, 'wt-title'));
      await page.click('[data-test=home]');
      await page.waitForSelector('[data-test=backup-everything]');
      equal(await page.$('[data-test=wt-root]'), null);
      equal(await page.evaluate(() => !!(window.TSI.bastion && (TSI.bastion.debug || (TSI.bastion.warTable && TSI.bastion.warTable.current)))), false);
      equal(context.log.errors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The War Room, the Military panel and the Menagerie (war phase 2)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await setUp(page, (s) => {
      s.partyLevel = 17;
      s.builtExtras = [{ facId: 'war_room', status: 'built' }, { facId: 'menagerie', status: 'built' }, '', '', '', ''];
      s.defenderBeasts = [{ name: 'Owlbear', qty: 1, source: 'Menagerie' }];
    });
    const showWarRoom = () => page.evaluate(() => {
      document.querySelector('.tsi-bas-fac[data-fac=war_room]').scrollIntoView({ block: 'center', inline: 'center' });
    }).then(() => page.waitForTimeout(500));
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
      await advance(page, []);
      s = await st(page);
      equal(s.military, [{ name: 'Line Infantry (100)', qty: 1, source: 'War Room' }]);
      assert(s.log.some(l => l.body === 'War Room: Recruit (Line Infantry (100)) → Recruited: Line Infantry (100).'), JSON.stringify(s.log.slice(0, 3)));
      equal(await text(page, 'military-type-0'), 'Line Infantry • 100 soldiers');
      await setUp(page, (st2) => { st2.military.push({ name: 'Line Infantry (100)', qty: 1, depleted: true, strength: 60, id: 'reg-x', source: 'War Room' }); });
      equal(await text(page, 'military-type-1'), 'Line Infantry • Depleted: 60/100');
      await page.evaluate(() => document.querySelector('[data-card=management]').scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -130));
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
        ['military-row-1', 'group', 'Line Infantry (100): Line Infantry • Depleted: 60/100', 'tsi-bas-tip']);
      assert(await page.isVisible('[data-test=tooltip]') && /Military unit • 60 of 100 soldiers/.test(await text(page, 'tooltip')), await text(page, 'tooltip'));
      equal((await H.layoutCheck(page, ['[data-test=tooltip]'])).outOfView, []);
      await page.keyboard.press('Tab');
      equal([await page.evaluate(() => document.activeElement.dataset.test), await page.isHidden('[data-test=tooltip]')], ['military-remove-1', true]);
      await showWarRoom();
      await page.click('[data-test=wr-recruit]');
      await page.click('[data-test=wr-option-3]');
      await issue(page, 'war_room', 'recruit');
      await advance(page, []);
      s = await st(page);
      assert(s.log.some(l => l.body === 'War Room: Recruit (Line Infantry (100)) → Replacements bring Line Infantry back to 100.'), JSON.stringify(s.log.slice(0, 3)));
      equal(s.military.map(r => [r.name, r.qty, !!r.depleted]), [['Line Infantry (100)', 2, false]]);
      equal(await text(page, 'military-type-0'), 'Line Infantry • 2 × 100 soldiers');
    });

    await check('the Menagerie\'s beasts and the Lieutenants show their stat blocks, and who is away recovering', async () => {
      await setUp(page, (s) => {
        s.military.unshift({ name: 'Lieutenant (1)', qty: 2, source: 'War Room' });
        s.warRecovery = [{ id: 'r1', kind: 'lieutenant', name: 'Lieutenant 2', status: 'wounded', untilTurn: s.turn + 2 }, { id: 'r2', kind: 'beast', name: 'Owlbear', status: 'recovered', untilTurn: s.turn + 1 }];
      });
      const turn = (await st(page)).turn;
      equal(await text(page, 'military-type-0'), '2 Lieutenants (1 recovering: back on Turn ' + (turn + 2) + ')');
      equal(await text(page, 'beast-type-0'), '1 beast • Terror (1 recovering: back on Turn ' + (turn + 1) + ')');
      await page.hover('[data-test=beast-row-0]');
      await page.waitForSelector('[data-test=tooltip]:not([hidden])');
      const tip = await text(page, 'tooltip');
      assert(/^Owlbear/.test(tip) && /Menagerie beast/.test(tip) && /Terror: A unit it damages/.test(tip) && /Owlbear: recovering, back on turn/.test(tip), tip);
      await page.hover('[data-test=military-row-0]');
      assert(/^Lieutenant/.test(await text(page, 'tooltip')) && /Lieutenant 2: wounded, back on turn/.test(await text(page, 'tooltip')));
      await page.mouse.move(5, 5);
    });

    await check('the guide\'s "come back after" for wounded Lieutenants and beasts matches the recovery table', async () => {
      /* Shortest and longest time away for a Lieutenant or beast that lives: separated, recovered, wounded, badly wounded. */
      const span = await page.evaluate(() => {
        const W = TSI_DATA.bastionWar;
        const turns = W.recovery.filter(r => r.turns).map(r => r.turns).concat([W.separatedTurns, W.badlyWoundedTurns]);
        return [Math.min.apply(null, turns), Math.max.apply(null, turns)];
      });
      const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
      const said = span[0] === span[1] ? words[span[0]] : words[span[0]] + ' to ' + words[span[1]];
      const guide = fs.readFileSync(path.join(H.ROOT, 'guide.html'), 'utf8');
      const m = /Wounded Lieutenants and beasts come back after ([^:<]+):/.exec(guide);
      assert(m, 'the guide has no "Wounded Lieutenants and beasts come back after" sentence');
      equal(m[1], said + ' Bastion turn' + (span[1] === 1 ? '' : 's'));
    });

    await check('the War Council and the War Room fit the laptop and the TV with no sideways scrolling', async () => {
      await setUp(page, (s) => {
        s.organization = { type: 'clan', name: 'Clan Ironbow', chief: '', motto: '', foundedAtTurn: 1 };
        s.defenders.count = 30;
        s.military.push({ name: 'Archers (50)', qty: 1 }, { name: 'Heavy Infantry (50)', qty: 2 }, { name: 'Light Cavalry (50)', qty: 1 }, { name: 'Shock Cavalry (25)', qty: 1 }, { name: 'Levy Infantry (150)', qty: 1 });
        s.defenderBeasts.push({ name: 'Giant Vulture', qty: 3 }, { name: 'Dire Wolf', qty: 2 });
      });
      for (const size of ['laptop', 'laptopFull', 'tv']) {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(300);
        await page.evaluate(() => document.querySelector('[data-card=war]').scrollIntoView({ block: 'start' }));
        await page.evaluate(() => window.scrollBy(0, -130));
        const lc = await H.layoutCheck(page, ['[data-test=war-forces]']);
        equal(lc.scrollWidth, lc.clientWidth, size + ': no sideways scroll');
        const fit = await page.evaluate(() => {
          const card = document.querySelector('[data-card=war]').getBoundingClientRect();
          return Array.from(document.querySelectorAll('[data-test=war-forces] > *, [data-test=war-intel], [data-test=war-army-bv], [data-test=queue-war]')).filter(e => { const r = e.getBoundingClientRect(); return r.left < card.left || r.right > card.right; }).length;
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
  section('Warehouse, artisan tools, panels and the Compendium');
  {
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

    await check('a closed panel stays closed after reopening (BAS-16)', async () => {
      await page.click('[data-test=collapse-diplomacy]');
      equal(await page.isVisible('[data-test=diplomacy-records]'), false);
      await reopen(page);
      equal(await page.isVisible('[data-test=diplomacy-records]'), false);
      equal(await page.getAttribute('[data-test=collapse-diplomacy]', 'aria-expanded'), 'false');
      await page.click('[data-test=collapse-diplomacy]');
      equal(await page.isVisible('[data-test=diplomacy-records]'), true);
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
  section('Saving: download, import, damaged files, reset');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await page.fill('[data-test=treasury]', '1234');
    await advance(page, []);
    let exported = null;

    await check('Download Save (JSON) downloads the Bastion and logs it', async () => {
      const d = await H.download(page, '[data-test=download-save]');
      exported = d.text;
      assert(/bastion/.test(d.name), d.name);
      const rec = JSON.parse(d.text).records.find(r => r.key === 'tsi.bastion.state');
      equal([rec.value.treasuryGP, rec.value.turn], [1234, 2]);
      await page.waitForFunction(() => TSI.bastion.debug.state().log[0].title === 'Save File');
    });

    await check('Import asks first, and Cancel changes nothing', async () => {
      const f = H.writeTemp('bastion-backup.json', exported);
      await page.fill('[data-test=treasury]', '99');
      await H.chooseFile(page, '[data-test=import-save]', f);
      equal(await modalTitle(page), 'Import into The Ironbow Bastion Manager');
      await clickModal(page, 'Cancel');
      equal((await st(page)).treasuryGP, 99);
      await H.chooseFile(page, '[data-test=import-save]', f);
      await clickModal(page, 'Import');
      await page.waitForSelector('[data-test=advance]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().treasuryGP === 1234);
    });

    await check('another tool\'s file or a damaged Bastion is refused, and nothing changes (BAS-14)', async () => {
      const otherFile = JSON.parse(exported);
      otherFile.tool = 'arenas';
      otherFile.records = [Object.assign({}, otherFile.records[0], { key: 'tsi.arenas.state', value: { players: [], prizeTotal: 300 } })];
      await H.chooseFile(page, '[data-test=import-save]', H.writeTemp('arenas.json', otherFile));
      const t1 = await H.modalText(page);
      assert(/This file is from the Arenas of The Scarlett Isles, not The Ironbow Bastion Manager\./.test(t1), t1);
      await clickModal(page, 'OK');
      const file = JSON.parse(exported);
      file.records.find(r => r.key === 'tsi.bastion.state').value.pendingOrders = 'lost';
      const bad = H.writeTemp('bastion-bad.json', file);
      await H.chooseFile(page, '[data-test=import-save]', bad);
      const t2 = await H.modalText(page);
      assert(/pendingOrders list is damaged/.test(t2), t2);
      await clickModal(page, 'OK');
      equal((await st(page)).treasuryGP, 1234);
    });

    await check('a damaged save in the browser is set aside, and the Bastion still opens', async () => {
      await page.evaluate(() => TSI.store.set('tsi.bastion.state', { heroes: [] }));
      await reopen(page);
      equal((await st(page)).turn, 1);
      assert((await page.evaluate(() => TSI.store.keys())).some(k => k.indexOf('tsi.quarantine.bastion.state') === 0));
    });

    await check('Reset asks first; Reset clears the Bastion', async () => {
      await page.fill('[data-test=treasury]', '777');
      await pause(page);
      await page.click('[data-test=reset]');
      await clickModal(page, 'Cancel');
      equal((await st(page)).treasuryGP, 777);
      await pause(page);
      await page.click('[data-test=reset]');
      await clickModal(page, 'Reset');
      await page.waitForSelector('[data-test=advance]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().treasuryGP === 0);
    });

    await check('Back up everything includes the Bastion', async () => {
      await page.fill('[data-test=treasury]', '321');
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

  /* ------------------------------------------------------------------ */
  section('Compared with the old Bastion (same dice, same campaign)');
  if (!HAS_LEGACY) {
    await check('the old Bastion is in _legacy/ (clone it to run this part)', async () => { throw new Error('not found: ' + LEGACY_ROOT); });
  } else {
    const srv = await serve(LEGACY_ROOT);
    const oldCtx = await browser.newContext(H.SIZES.laptop);
    await oldCtx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await oldCtx.addInitScript(setup);
    const old = await oldCtx.newPage();
    const oldErrors = [];
    old.on('pageerror', e => oldErrors.push(e.message));
    old.on('dialog', d => d.accept());
    await old.goto('http://127.0.0.1:' + srv.address().port + '/bastion_manager/index.html');
    await old.waitForSelector('#advanceTurnBtn');
    await old.waitForTimeout(1200);
    const { context, page } = await newPage(browser, 'laptop');
    await openBastion(page);
    await old.evaluate(() => window.__seed(909));
    await page.evaluate(() => window.__seed(909));

    function strip(o) {
      if (Array.isArray(o)) return o.map(strip);
      if (o && typeof o === 'object') { const r = {}; Object.keys(o).sort().forEach(k => { if (k !== 'id' && k !== 'at' && k !== 'routeId') r[k] = strip(o[k]); }); return r; }
      return o;
    }
    const pick = s => strip({
      turn: s.turn, treasuryGP: s.treasuryGP, partyLevel: s.partyLevel, builtExtras: s.builtExtras, facilityLevels: s.facilityLevels,
      pending: s.pendingOrders.map(o => [o.label, o.completeTurn, o.costGP === undefined ? null : o.costGP, o.optionLabel === undefined ? null : o.optionLabel]),
      defenders: s.defenders, beasts: s.defenderBeasts, military: s.military,
      warehouse: s.warehouse.map(w => [w.item, w.qty, w.notes]), artisanTools: s.artisanTools, favour: s.favour, pc: s.politicalCapital,
      diplomacy: s.diplomacy,
      network: { active: s.tradeNetwork.active, stability: s.tradeNetwork.stability, yieldBonusPct: s.tradeNetwork.yieldBonusPct || 0, highRisk: !!s.tradeNetwork.highRiskRouting, routes: s.tradeNetwork.routes, last: s.tradeNetwork.lastResolvedTurn },
      disputes: s.arbitration.queue, lastEvent: s.lastEvent ? [s.lastEvent.roll, s.lastEvent.name] : null,
      organization: s.organization, clanHonor: s.clanHonor, warLog: (s.warLog || []).map(w => [w.title, w.subtitle, w.details]),
      log: s.log.map(l => l.title + ': ' + l.body)
    });
    const O = {
      /* The old tool saves some changes only on its next save, so nudge one first. */
      async state() {
        await old.evaluate(() => document.getElementById('treasuryInput').dispatchEvent(new Event('input')));
        return old.evaluate(() => JSON.parse(localStorage.getItem('ironbow_bastion_state_v1_TEST')));
      },
      async answerAll(rolls) {
        rolls = rolls.slice();
        for (let n = 0; n < 30; n++) {
          await old.waitForTimeout(150);
          if (!(await old.$('.siModalOverlay'))) return;
          if (await old.$('#siManualD20')) { await old.fill('#siManualD20', String(rolls.shift())); await old.click('.siModalPrimary'); }
          else if (await old.$('.siModalClose')) await old.click('.siModalClose');
          else await old.click('.siModalPrimary');
        }
      },
      async issue(fac, fn, idx) {
        if (idx !== undefined) await old.selectOption('#sel_' + fac + '__' + fn, String(idx));
        await old.click('[data-action=runFn][data-fac=' + fac + '][data-fn=' + fn + ']');
        await old.waitForTimeout(60);
      },
      async build(slot, id) { await old.selectOption('#slot_' + slot, id); await old.click('button[data-slot="' + slot + '"]'); await old.waitForTimeout(60); },
      async hall(fn, idx, extra) {
        await old.click('[data-action=runFn][data-fac=hall_of_emissaries][data-fn=' + fn + ']');
        await old.waitForSelector('#hallClanSel');
        await old.selectOption('#hallClanSel', String(idx));
        if (extra && extra.dur) await old.selectOption('#hallDurSel', String(extra.dur));
        if (extra && extra.tone) await old.selectOption('#hallToneSel', extra.tone);
        await old.click('.siModalPrimary');
        await old.waitForTimeout(80);
      },
      async advance(rolls) { await old.click('#advanceTurnBtn'); await O.answerAll(rolls); }
    };
    const N = {
      async build(slot, id) { await page.selectOption('[data-test=slot-select-' + slot + ']', id); await page.click('[data-test=build-' + slot + ']'); await page.waitForTimeout(60); }
    };
    const steps = [];
    async function compare(label, allow) {
      const o = pick(await O.state());
      const n = pick(await st(page));
      if (allow) allow(o, n);
      equal(n, o, label);
      steps.push(label);
    }
    async function bothIssue(fac, fn, idx) { await O.issue(fac, fn, idx); await issue(page, fac, fn, idx); }
    async function bothHall(fn, idx, extra) { await O.hall(fn, idx, extra); await planHall(page, fn, idx, extra); }
    async function bothAdvance(rolls) { await O.advance(rolls); await advance(page, rolls); }
    async function bothUpgrade() { await old.click('#hallUpgradePill'); await old.waitForTimeout(60); await pause(page); await page.click('[data-test=hall-upgrade]'); }

    await check('the same campaign gives the same Bastion, turn by turn', async () => {
      await old.selectOption('#levelSelect', '13'); await old.fill('#treasuryInput', '20000');
      await page.selectOption('[data-test=level]', '13'); await page.fill('[data-test=treasury]', '20000');
      await compare('level 13, 20,000 gp');
      for (const [slot, id] of [[0, 'hall_of_emissaries'], [1, 'library'], [2, 'shrine_telluria'], [3, 'menagerie'], [4, 'garden']]) { await O.build(slot, id); await N.build(slot, id); }
      await compare('five buildings started');
      for (const [f, fn, i] of [['barracks', 'recruit_defenders'], ['dock', 'charter_berth', 1], ['workshop', 'craft_magic_item', 3], ['armoury', 'arm_defenders'], ['watchtower', 'patrol']]) await bothIssue(f, fn, i);
      await compare('five orders');
      await bothAdvance([]); await compare('turn 2');
      await bothAdvance([]); await compare('turn 3');
      await bothAdvance([]); await compare('turn 4: buildings finished, the automatic event');
      await old.selectOption('#artisanSel_0', 'Smith’s Tools'); await old.selectOption('#artisanSel_1', 'Alchemist’s Supplies'); await old.click('#saveArtisanToolsBtn');
      await page.selectOption('[data-test=artisan-0]', 'Smith’s Tools'); await page.selectOption('[data-test=artisan-1]', 'Alchemist’s Supplies'); await page.click('[data-test=save-artisan]');
      await compare('artisan tools');
      for (const [f, fn, i] of [['workshop', 'craft', 2], ['library', 'research', 1], ['garden', 'harvest', 3], ['shrine_telluria', 'pray', 2], ['shrine_telluria', 'craft', 0]]) await bothIssue(f, fn, i);
      await bothHall('secure_trade_agreement', 2, { dur: 6 });
      await bothUpgrade();
      await compare('crafting, research, harvest, prayer, a Trade Agreement with Karr, a Hall upgrade');
      await bothAdvance([16]); await compare('turn 5: the agreement signed, the shrine\'s blessing');
      await bothUpgrade();
      await bothHall('inter_clan_summit', 1);
      await bothAdvance([13]); await compare('turn 6: a summit, the Hall at level 3');
      await bothHall('trade_consortium', 1);
      await bothAdvance([18]); await compare('turn 7: a consortium opens the Karr route');
      await bothAdvance([5]); await compare('turn 8: the Karr route lost at sea, a dispute filed');
      await old.click('#btnHearDisputes'); await old.click('.siDisputeCard button:has-text("Split Claims")'); await O.answerAll([15]);
      await pause(page); await page.click('[data-test=ledger]'); await page.click('[data-test=rule-s]'); await answerAll(page, [15]);
      await compare('the Council Ledger splits the claims');
      /* No war in either: the old Bastion settled a war with one roll, and
         this one fights it on the War Table (war phase 2), so there is
         nothing left to compare. The War Council's intelligence draws up
         enemy armies with its own seeded dice, never Math.random, so both
         Bastions' dice stay in step. */
      await bothIssue('menagerie', 'recruit_beast', 0);
      await compare('a beast ordered');
      await bothAdvance([12]); await compare('turn 9: routes, the beast');
      await old.click('#rollEventBtn'); await pause(page); await page.click('[data-test=roll-event]');
      await compare('Roll Bastion Event');
      await bothAdvance([14]); await compare('turn 10');
      await bothAdvance([14]); await compare('turn 11');
      await bothAdvance([14]); await compare('turn 12: the automatic event');
      /* The campaign really did all this. */
      const s = await st(page);
      assert(s.warLog.length === 0 && s.defenderBeasts.length === 1 && s.facilityLevels.hall_of_emissaries === 3, JSON.stringify([s.warLog.length, s.defenderBeasts, s.facilityLevels]));
      assert(Object.keys(s.warMissions).length > 0, 'the War Council drew up the enemy it showed, without touching Math.random');
      assert(s.diplomacy.summits.length + s.log.filter(l => /Inter-Clan Summit/.test(l.body)).length > 0);
      assert(s.log.some(l => l.title === 'Arbitration') && s.log.some(l => /catastrophic|Routes resolved/.test(l.body)));
      assert(s.warehouse.length >= 6, JSON.stringify(s.warehouse));
      console.log('      (' + steps.length + ' steps compared)');
    });

    await check('Host Delegation: the only difference is the old double Political Capital (B2)', async () => {
      await bothHall('host_delegation', 1, { tone: 'assertive' });
      await bothAdvance([15, 14, 13]);
      await compare('a delegation to Rowthorn', (o, n) => {
        /* The old tool also added the first roll's +15 (a Great Success: 15 + 6 vs DC 13). */
        equal(o.pc.rowthorn - n.pc.rowthorn, 15, 'the old tool added it twice');
        o.pc.rowthorn = n.pc.rowthorn;
      });
    });

    await check('neither Bastion had an error', async () => {
      equal(oldErrors, []);
      equal(context.log.errors, []);
    });
    await oldCtx.close();
    await context.close();
    srv.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
