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
async function modalTitle(page) { const m = await page.$('.tsi-modal__title'); return m ? m.textContent() : null; }
async function clickModal(page, label) { await page.click('.tsi-modal__foot button:text-is("' + label + '")'); await page.waitForTimeout(150); }
async function d20(page, v) {
  await page.waitForSelector('[data-test=d20]');
  await page.fill('[data-test=d20]', String(v));
  await clickModal(page, 'Continue');
}
/* Answer every pop-up: type the next roll into dice boxes, press the main button on the rest.
   A Military Action's War Table is answered too: Begin Deployment, then Start Battle. */
async function answerAll(page, rolls) {
  rolls = (rolls || []).slice();
  for (let n = 0; n < 60; n++) {
    await page.waitForTimeout(150);
    if (await modalOpen(page)) {
      if (await page.$('[data-test=d20]')) await d20(page, rolls.shift());
      else { await page.click('.tsi-modal__foot button.tsi-btn--primary'); await page.waitForTimeout(150); }
      continue;
    }
    if (!(await page.$('[data-test=wt-root]'))) return;
    await page.waitForTimeout(400);
    if (await page.isVisible('[data-test=wt-begin-deploy]')) await page.click('[data-test=wt-begin-deploy]');
    else if (await page.isVisible('[data-test=wt-start-battle]')) await page.click('[data-test=wt-start-battle]');
    else return;
  }
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

    await check('five Giant Vultures can all be committed (BAS-25); a double click queues one war action (BAS-15); committing nothing is refused', async () => {
      await setUp(page, (s) => {
        s.defenders.count = 4;
        s.defenderBeasts = [{ name: 'Giant Vulture', qty: 5 }];
        s.military = [{ name: 'Lieutenant (1)', qty: 1 }, { name: 'Regiment (100)', qty: 2 }];
      });
      await page.selectOption('[data-test=war-target]', 'bacca');
      await page.fill('[data-test=war-defenders]', '0');
      await page.fill('[data-test=war-beasts]', '0');
      await page.click('[data-test=queue-war]');
      assert(/Commit at least something/.test(await H.modalText(page)));
      await clickModal(page, 'OK');
      await page.fill('[data-test=war-defenders]', '9');
      await page.press('[data-test=war-defenders]', 'Tab');
      equal(await page.inputValue('[data-test=war-defenders]'), '4', 'kept to what\'s available once typed');
      await page.fill('[data-test=war-beasts]', '9');
      await page.press('[data-test=war-beasts]', 'Tab');
      equal(await page.inputValue('[data-test=war-beasts]'), '5', 'all five vultures, not just one');
      assert(/Available: 4 defenders, 5 beasts, 1 lieutenants, 2 regiments/.test(await text(page, 'war-hint')), await text(page, 'war-hint'));
      equal([await text(page, 'war-avail-defenders'), await text(page, 'war-avail-beasts'), await text(page, 'war-avail-lieutenants'), await text(page, 'war-avail-regiments')],
        ['4 available', '5 available', '1 available', '2 available']);
      /* Typed as a person does (Harry's report: they wouldn't take a number): never rewritten mid-typing. */
      await page.click('[data-test=war-lieutenants]');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('1');
      equal(await page.inputValue('[data-test=war-lieutenants]'), '1');
      await page.click('[data-test=war-regiments]');
      await page.keyboard.press('Control+A');
      await page.keyboard.type('2');
      equal(await page.inputValue('[data-test=war-regiments]'), '2');
      await page.press('[data-test=war-regiments]', 'ArrowUp');
      equal(await page.inputValue('[data-test=war-regiments]'), '2', 'the arrows stop at what\'s available');
      await pause(page);
      await page.dblclick('[data-test=queue-war]');
      await page.waitForTimeout(300);
      equal((await st(page)).pendingOrders.map(o => [o.label, o.meta.commitDefenders, o.meta.commitBeasts, o.meta.commitLieutenants, o.meta.commitRegiments]), [['War Action', 4, 5, 1, 2]]);
    });

    await check('on Advance Bastion Turn the war becomes a Military Action: Begin, or Later from the War Council', async () => {
      await pause(page);
      await page.click('[data-test=advance]');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal__title'); return t && /^War Turn: RAID vs Bacca$/.test(t.textContent); });
      const t = await H.modalText(page);
      assert(/Your forces muster for battle/.test(t) && /Committed: 4 defenders, 5 beasts, 1 Lieutenant, 2 Regiments\./.test(t), t);
      await clickModal(page, 'Later');
      await page.waitForFunction(() => !TSI.bastion.debug.busy());
      const s = await st(page);
      equal(s.pendingOrders, [], 'the order is gone, so it can\'t come due twice');
      equal(s.militaryActions.map(m => [m.step, m.objective, m.targetName, m.forces.length]), [['weather', 'raid', 'Bacca', 9]]);
      assert(s.log.some(l => l.body === 'RAID vs Bacca: your forces muster for battle. The Military Action is ready to begin.'));
      equal(await page.textContent('[data-test=ma-continue-0]'), 'Begin Military Action');
      equal(await page.textContent('[data-test=ma-status-0]'), 'Ready to begin. First: the Weather Conditions roll.');
      equal(await page.$eval('[data-test=queue-war]', b => b.classList.contains('tsi-btn--primary')), false, 'one main action in the panel');
      equal(await page.isDisabled('[data-test=advance]'), false);
    });

    await check('a waiting Military Action survives reopening, and a notice says where it is', async () => {
      await reopen(page);
      await H.waitForNotice(page, /A Military Action \(RAID vs Bacca\) is waiting/);
      equal((await st(page)).militaryActions.length, 1);
    });

    await check('Weather (DC 12), Morale (DC 12) and Luck (DC 10), each with its story; a double click can\'t make the next roll', async () => {
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=d20]');
      equal((await H.noticeTexts(page)).filter(t => /is waiting/.test(t)), [], 'the notice goes once it has done its job');
      let t = await H.modalText(page);
      assert(/Weather Conditions: RAID vs Bacca/.test(t) && /Modifier: \+0/.test(t) && /DC 12/.test(t), t);
      await d20(page, 15);
      await page.waitForSelector('[data-test=ma-result]');
      t = await H.modalText(page);
      assert(/Clear Day/.test(t) && /d20 15 vs DC 12: Passed/.test(t) && /The sky holds clear and bright/.test(t), t);
      equal(await page.$('.tsi-bas-ma-pop__video'), null, 'no storm, no film');
      await page.dblclick('.tsi-modal__foot button:text-is("Continue")');
      await page.waitForTimeout(500);
      equal([(await st(page)).militaryActions[0].step, !!(await page.$('[data-test=d20]'))], ['morale', true], 'the second click didn\'t press the Morale dice box');
      t = await H.modalText(page);
      assert(/Morale: RAID vs Bacca/.test(t) && /DC 12/.test(t), t);
      await d20(page, 9);
      t = await H.modalText(page);
      assert(/Morale: Low/.test(t) && /d20 9 vs DC 12: Failed/.test(t) && /Even under a clear sky, doubt spreads/.test(t), t);
      await clickModal(page, 'Continue');
      t = await H.modalText(page);
      assert(/Luck: RAID vs Bacca/.test(t) && /DC 10/.test(t), t);
      await d20(page, 3);
      t = await H.modalText(page);
      assert(/Luck: −1/.test(t) && /the Gods do not look kindly upon this needless bloodshed/.test(t), t);
      await clickModal(page, 'Continue');
      await page.waitForSelector('[data-test=wt-root]');
      equal((await st(page)).militaryActions[0].step, 'deploy');
    });

    /* Where each force sits, in board units, against the midline. */
    const tokenBoxes = () => page.evaluate(() => {
      const h = TSI.bastion.warTable.current, W = TSI.bastion.warTableRules;
      const b = h.board(), set = h.settings(), d = h.deployment();
      const ma = TSI.bastion.debug.state().militaryActions[0];
      return ma.forces.filter(f => d.positions[f.id]).map(f => {
        const p = d.positions[f.id], dim = W.tokenDims(f, set.grid, set.tokenScale);
        return { id: f.id, top: p.y * b.h - dim.h / 2, bottom: p.y * b.h + dim.h / 2, left: p.x * b.w - dim.w / 2, right: p.x * b.w + dim.w / 2, mid: b.h / 2, w: b.w, h: b.h };
      });
    });
    const allOnOurGround = boxes => boxes.every(x => x.top >= x.mid - 0.5 && x.bottom <= x.h + 0.5 && x.left >= -0.5 && x.right <= x.w + 0.5);

    await check('the War Table: the conditions, the forces listed, then Begin Deployment sets every force on your ground', async () => {
      assert(/RAID vs Bacca/.test(await text(page, 'wt-title')));
      const sum = await text(page, 'wt-summary');
      assert(/Clear Day/.test(sum) && /Low/.test(sum) && /−1/.test(sum), sum);
      equal(await page.$$eval('.tsi-bas-wt-token', t => t.length), 0, 'no forces on the map before deployment');
      const roster = await text(page, 'wt-roster');
      assert(/Regiment 1/.test(roster) && /Bastion Defenders/.test(roster) && /Lieutenant 1/.test(roster) && /Giant Vulture 5/.test(roster), roster);
      equal(await page.evaluate(() => document.querySelector('.tsi-bas-layout').inert), true, 'the Bastion behind is out of reach');
      equal(await page.isVisible('[data-test=wt-start-battle]'), false);
      await pause(page);
      await page.click('[data-test=wt-begin-deploy]');
      await page.waitForTimeout(300);
      equal(await page.$$eval('.tsi-bas-wt-token', t => t.map(x => x.dataset.kind).sort()), ['beast', 'beast', 'beast', 'beast', 'beast', 'defenders', 'lieutenant', 'regiment', 'regiment']);
      const boxes = await tokenBoxes();
      equal(boxes.length, 9);
      assert(allOnOurGround(boxes), JSON.stringify(boxes));
      const s = await st(page);
      equal([s.militaryActions[0].deployment.started, Object.keys(s.militaryActions[0].deployment.positions).length], [true, 9], 'saved');
      equal(await page.isVisible('[data-test=wt-start-battle]'), true);
      await H.shot(page, 'p9-war-table-deployed');
    });

    await check('a force dragged towards the enemy stops at the midline; the move is saved and kept after closing and reopening', async () => {
      const r = await page.evaluate(() => TSI.bastion.warTable.current.tokenScreenRect('reg-1'));
      await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
      await page.mouse.down();
      await page.mouse.move(r.x + r.w / 2 + 40, r.y - 600, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const reg = (await tokenBoxes()).find(b => b.id === 'reg-1');
      assert(Math.abs(reg.top - reg.mid) < 1, JSON.stringify(reg));
      const saved = (await st(page)).militaryActions[0].deployment.positions['reg-1'];
      const live = await page.evaluate(() => TSI.bastion.warTable.current.deployment().positions['reg-1']);
      equal(saved, live);
      const before = await page.evaluate(() => TSI.bastion.warTable.current.tokenScreenRect('reg-1'));
      await pause(page);
      await page.click('[data-test=wt-close]');
      await page.waitForTimeout(200);
      equal(await page.$('[data-test=wt-root]'), null);
      equal(await page.evaluate(() => document.querySelector('.tsi-bas-layout').inert), false);
      equal(await page.textContent('[data-test=ma-status-0]'), 'Deploying on the War Table.');
      await reopen(page);
      await H.dismissNotices(page);
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=wt-root]');
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => TSI.bastion.warTable.current.tokenScreenRect('reg-1'));
      ['x', 'y', 'w', 'h'].forEach(k => assert(Math.abs(after[k] - before[k]) < 1, k + ' ' + JSON.stringify([before, after])));
      equal(await page.isVisible('[data-test=wt-begin-deploy]'), false, 'deployment carries on where it was');
    });

    await check('the War Table fits the laptop and the TV, with its controls in view, and a battle map can be uploaded', async () => {
      for (const size of ['laptop', 'laptopFull', 'tv']) {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(250);
        const lc = await H.layoutCheck(page, ['[data-test=wt-upload]', '[data-test=wt-grid]', '[data-test=wt-zoom-fit]', '[data-test=wt-fullscreen]', '[data-test=wt-close]', '[data-test=wt-start-battle]', '[data-test=wt-stage]']);
        equal(lc.scrollWidth, lc.clientWidth, size + ': no sideways scroll');
        equal(lc.outOfView, [], size + ': in view');
        assert(allOnOurGround(await tokenBoxes()), size);
      }
      await page.setViewportSize(H.SIZES.laptop.viewport);
      await page.waitForTimeout(250);
      await H.chooseFile(page, '[data-test=wt-upload]', writeCrest('battle-map.png', 900));
      await page.waitForFunction(() => { const m = document.querySelector('[data-test=wt-map]'); return m && !m.hidden && m.naturalWidth > 0; });
      equal(await page.evaluate(() => TSI.store.get('tsi.bastion.warMap').name), 'tsi-p9-battle-map.png');
      assert(allOnOurGround(await tokenBoxes()), 'still on our ground on a square map');
      await H.shot(page, 'p9-war-table-map');
    });

    await check('Start Battle asks first, locks the deployment, and the battle is settled by the single roll with Luck on it', async () => {
      await pause(page);
      await page.click('[data-test=wt-start-battle]');
      assert(/Lock in your deployment\?/.test(await H.modalText(page)));
      await clickModal(page, 'Cancel');
      equal((await st(page)).militaryActions[0].step, 'deploy');
      await pause(page);
      await page.click('[data-test=wt-start-battle]');
      await clickModal(page, 'Start Battle');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal__title'); return t && t.textContent === 'The Battle Is Joined'; });
      assert(/Luck −1 is included/.test(await H.modalText(page)));
      equal(await page.isVisible('[data-test=wt-banner]'), true);
      equal((await st(page)).militaryActions[0].step, 'resolve');
      await clickModal(page, 'Continue');
      let t = await H.modalText(page);
      assert(/War Turn: RAID vs Bacca/.test(t) && /Modifier: \+4/.test(t) && /DC 14/.test(t), t);
      await clickModal(page, 'Cancel');
      await page.waitForTimeout(200);
      assert((await st(page)).log[0].body === 'RAID vs Bacca: the battle roll was cancelled. Press Continue in the War Council to roll it.');
      equal((await st(page)).warLog, [], 'nothing settled yet');
      /* The locked table offers the roll again. */
      equal(await page.textContent('[data-test=wt-locked-action]'), 'Roll for the battle');
      await pause(page);
      await page.click('[data-test=wt-locked-action]');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal__title'); return t && t.textContent === 'The Battle Is Joined'; });
      await clickModal(page, 'Continue');
      await page.waitForSelector('[data-test=d20]');
      await clickModal(page, 'Cancel');
      await page.waitForTimeout(200);
      equal((await st(page)).warLog, [], 'still nothing settled');
      /* Locked: a drag moves nothing. */
      const r = await page.evaluate(() => TSI.bastion.warTable.current.tokenScreenRect('def'));
      const was = (await st(page)).militaryActions[0].deployment.positions.def;
      await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
      await page.mouse.down();
      await page.mouse.move(r.x + r.w / 2 + 120, r.y + r.h / 2, { steps: 6 });
      await page.mouse.up();
      equal((await st(page)).militaryActions[0].deployment.positions.def, was);
      await pause(page);
      await page.click('[data-test=wt-close]');
      equal(await page.textContent('[data-test=ma-status-0]'), 'Deployment locked. Next: the battle roll.');
      await pause(page);
      await page.click('[data-test=ma-continue-0]');
      await page.waitForSelector('[data-test=wt-root]');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal__title'); return t && t.textContent === 'The Battle Is Joined'; });
      await clickModal(page, 'Continue');
      await d20(page, 15);
      t = await H.modalText(page);
      assert(/War Report/.test(t) && /Success: RAID vs Bacca/.test(t) && /Roll: d20 15 \+ mod 4 = 19 vs DC 14/.test(t) && /Clan Honour: \+6/.test(t), t);
      assert(/Weather: Clear Day \(d20 15 vs DC 12\)/.test(t) && /Morale: Low \(d20 9 vs DC 12\)/.test(t) && /Luck: −1 to the roll \(d20 3 vs DC 10\)/.test(t) && /Deployment: 9 of 9 units placed on the War Table/.test(t), t);
      await clickModal(page, 'Close');
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'));
      const s = await st(page);
      equal([s.militaryActions.length, s.warLog.length, s.warLog[0].title, s.clanHonor], [0, 1, 'Success: RAID vs Bacca', 46]);
      equal(await page.evaluate(() => document.querySelector('.tsi-bas-layout').inert), false);
      await pause(page);
      await page.click('[data-test=war-view-0]');
      assert(/Morale: Low/.test(await H.modalText(page)));
      await clickModal(page, 'Close');
    });

    await check('a storm raises the Morale DC and shows its film; a cancelled roll waits; Call off asks, then wins and loses nothing', async () => {
      await page.selectOption('[data-test=war-target]', 'bacca');
      await page.fill('[data-test=war-defenders]', '2');
      await page.fill('[data-test=war-beasts]', '0');
      await page.fill('[data-test=war-lieutenants]', '0');
      await page.fill('[data-test=war-regiments]', '0');
      await pause(page);
      await page.click('[data-test=queue-war]');
      await pause(page);
      await page.click('[data-test=advance]');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal__title'); return t && /^War Turn:/.test(t.textContent); });
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
      const s = await st(page);
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
      await clickModal(page, 'Call off');
      const after = await st(page);
      equal(after.militaryActions, []);
      equal([after.treasuryGP, after.defenders.count, after.warLog.length], before);
      equal(after.log[0].body, 'RAID vs Bacca: the Military Action was called off. Nothing was won or lost.');
      equal(await page.isVisible('[data-test=military-actions]'), false);
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

    await check('Unsworn: the Lieutenants and Regiments boxes look switched off and say why (Harry\'s report)', async () => {
      await setUp(page, (s) => { s.military = [{ name: 'Lieutenant (1)', qty: 3 }, { name: 'Regiment (100)', qty: 3 }]; });
      equal([await page.isDisabled('[data-test=war-lieutenants]'), await page.isDisabled('[data-test=war-regiments]')], [true, true]);
      equal([await text(page, 'war-avail-lieutenants'), await text(page, 'war-avail-regiments')], ['Clan or Brigade only', 'Clan or Brigade only']);
      assert(Number(await page.$eval('[data-test=war-lieutenants]', i => getComputedStyle(i).opacity)) < 0.6, 'greyed out');
      assert(/Only a Clan or Mercenary Brigade/.test(await page.getAttribute('[data-test=war-lieutenants]', 'title')));
      assert(/Unsworn war is limited to defenders and beasts/.test(await text(page, 'war-hint')));
      await setUp(page, (s) => { s.military = []; });
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

    await check('Download Save includes the crest; Reset clears it with the rest of the Bastion', async () => {
      await page.evaluate(() => TSI.store.flush());
      const d = await H.download(page, '[data-test=download-save]');
      const keys = JSON.parse(d.text).records.map(r => r.key);
      assert(keys.indexOf('tsi.bastion.crest') !== -1, keys.join(','));
      await pause(page);
      await page.click('[data-test=reset]');
      await clickModal(page, 'Reset');
      await page.waitForSelector('[data-test=advance]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().organization.type === 'unsworn');
      equal(await page.evaluate(() => TSI.store.has('tsi.bastion.crest')), false);
      equal((await crestInfo(page)).shown, false);
    });

    await check('leaving the Bastion while the War Table is open leaves nothing behind', async () => {
      await setUp(page, (s) => { s.defenders.count = 2; });
      await page.fill('[data-test=war-defenders]', '2');
      await pause(page);
      await page.click('[data-test=queue-war]');
      await pause(page);
      await page.click('[data-test=advance]');
      await page.waitForFunction(() => { const t = document.querySelector('.tsi-modal__title'); return t && /^War Turn:/.test(t.textContent); });
      await clickModal(page, 'Begin Military Action');
      for (let i = 0; i < 3; i++) { await d20(page, 15); await page.waitForSelector('[data-test=ma-result]'); await clickModal(page, 'Continue'); }
      await page.waitForSelector('[data-test=wt-root]');
      await page.click('[data-test=home]');
      await page.waitForSelector('[data-test=backup-everything]');
      equal(await page.$('[data-test=wt-root]'), null);
      equal(await page.evaluate(() => !!(window.TSI.bastion && (TSI.bastion.debug || (TSI.bastion.warTable && TSI.bastion.warTable.current)))), false);
      equal(context.log.errors, []);
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

    await check('the Compendium: 265 items, search, details, card and Roll20 link', async () => {
      await pause(page);
      await page.click('[data-test=compendium]');
      await page.waitForSelector('[data-test=comp-list]');
      equal(await page.$$eval('.tsi-bas-comp__item', b => b.length), 265);
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
      equal([file.version, Object.keys(file.items).length], [1, 265]);
      equal(await text(page, 'comp-status'), 'Done. Filled: 0 • Kept: 62 • Stubbed: 203. Downloading…');
      await clickModal(page, 'Close');
      equal(context.log.net, []);
      equal(context.log.failed, []);
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
    /* The raid's only differences: the Military Action's line in the log, and
       its war-log entry, which adds Luck's +1 to the roll and notes the
       weather, morale, luck and deployment. Everything else must match. */
    function militaryAllow(o, n) {
      n.log = n.log.filter(l => !/^War Turn: RAID vs Bacca: your forces muster for battle\./.test(l));
      equal(n.warLog.length, o.warLog.length, 'war log length');
      n.warLog.forEach((w, i) => {
        const ow = o.warLog[i];
        equal([w[0], w[1]], [ow[0], ow[1]], 'war log title');
        const lines = w[2].split('\n');
        const oldLines = ow[2].split('\n');
        const roll = /^Roll: d20 (\d+) \+ mod (-?\d+) = (-?\d+) vs DC (\d+)$/;
        const a = lines[0].match(roll), b = oldLines[0].match(roll);
        assert(a && b && a[1] === b[1] && a[4] === b[4] && +a[2] === +b[2] + 1 && +a[3] === +b[3] + 1, 'the roll gains Luck\'s +1: ' + lines[0] + ' / ' + oldLines[0]);
        equal(lines.filter(l => !/^(Weather|Morale|Luck|Deployment): /.test(l)).slice(1), oldLines.slice(1), 'the rest of the report');
        equal(lines.filter(l => /^(Weather|Morale|Luck|Deployment): /.test(l)).length, 4, 'weather, morale, luck and deployment noted');
        w[2] = ow[2];
      });
    }
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
      await old.selectOption('#warTargetSelect', 'bacca'); await old.fill('#warDefendersInput', '2'); await old.click('#btnQueueWarAction');
      await page.selectOption('[data-test=war-target]', 'bacca'); await page.fill('[data-test=war-defenders]', '2'); await page.click('[data-test=queue-war]');
      await bothIssue('menagerie', 'recruit_beast', 0);
      await compare('a raid queued, a beast ordered');
      /* The raid is now a Military Action (Harry's request, 2 October 2026):
         Weather 15 (a clear day, so no dice are drawn for a storm), Morale 15,
         Luck 15 (+1), the War Table, then the same single roll of 15. */
      await O.advance([12, 15]); await advance(page, [12, 15, 15, 15, 15]);
      await compare('turn 9: routes, the raid, the beast', militaryAllow);
      await old.click('#rollEventBtn'); await pause(page); await page.click('[data-test=roll-event]');
      await compare('Roll Bastion Event', militaryAllow);
      await bothAdvance([14]); await compare('turn 10', militaryAllow);
      await bothAdvance([14]); await compare('turn 11', militaryAllow);
      await bothAdvance([14]); await compare('turn 12: the automatic event', militaryAllow);
      /* The campaign really did all this. */
      const s = await st(page);
      assert(s.warLog.length === 1 && s.defenderBeasts.length === 1 && s.facilityLevels.hall_of_emissaries === 3, JSON.stringify([s.warLog.length, s.defenderBeasts, s.facilityLevels]));
      assert(s.diplomacy.summits.length + s.log.filter(l => /Inter-Clan Summit/.test(l.body)).length > 0);
      assert(s.log.some(l => l.title === 'Arbitration') && s.log.some(l => /catastrophic|Routes resolved/.test(l.body)));
      assert(s.warehouse.length >= 6, JSON.stringify(s.warehouse));
      console.log('      (' + steps.length + ' steps compared)');
    });

    await check('Host Delegation: the only difference is the old double Political Capital (B2)', async () => {
      await bothHall('host_delegation', 1, { tone: 'assertive' });
      await bothAdvance([15, 14, 13]);
      await compare('a delegation to Rowthorn', (o, n) => {
        militaryAllow(o, n);
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
