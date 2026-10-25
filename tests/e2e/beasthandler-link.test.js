/* Scarlett Isles: Beast Handler — linking a phone by QR code, and the optional online link (S17, 22 October 2026),
   from files, with a made-up database standing in for the real one. Nothing in this test can reach a real database:
   the pages that could use the online link only ever talk to "tsi-test-relay.invalid" (a name that never exists),
   every request is caught by this test and answered here, and anything else that tries to leave is stopped and counted.

   Checks:
   1. The DM's box (Bastion): Show QR per handler, the phone page address, "Online link: off (not set up)", the Offline
      backup (shut), the QR code itself (read back from the picture with an independent reader: it holds exactly the
      expected address), nothing in the Day Log, the layout at 390 px, 1707 x 930 (ratio 1.5) and 1920 x 1080 (ratio 1).
   2. The phone page: opened from a link it links itself and removes the # part from the address bar; it keeps the link
      after a reload; a damaged link gives a friendly message; a different link asks first; the Offline backup (codes)
      still works; Copy my link; no DM tool or QR maker is loaded; it fits a phone.
   3. Dormant: with the switch off, or no address set up, not one request leaves any page (the test page, a Bastion
      page from the real suite, the phone page), and the test page always uses a stand-in in memory.
   4. The online link end to end, in two pages that share only the made-up database: switch on, Test the link, the
      phone shows the beasts by itself, a change arrives, Check now, switch off stops it, Take back code removes the copy.
   Run with:  node tests/e2e/beasthandler-link.test.js */
'use strict';

const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const HARNESS = H.fileUrl('tests/harness.html');
const INDEX = H.fileUrl('index.html');
const PHONE = H.fileUrl('beasthandler.html');
const TEST_HOST = 'tsi-test-relay.invalid';
const TEST_URL = 'https://' + TEST_HOST;
const DEFAULT_URL = 'https://hjhudsonwriter.github.io/TSI_MasterSuite/beasthandler.html';
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const b64u = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/* Counts anything a page does that could send something out: fetch, XMLHttpRequest, EventSource, WebSocket, beacons. Copying is recorded too. */
const SPY = () => {
  window.__net = [];
  const note = (kind, u) => window.__net.push(kind + ' ' + String(u && u.url ? u.url : u));
  const f = window.fetch;
  if (f) window.fetch = function (u) { note('fetch', u); return f.apply(this, arguments); };
  const o = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { note('xhr', u); return o.apply(this, arguments); };
  if (window.EventSource) { const E = window.EventSource; window.EventSource = function (u) { note('eventsource', u); return new E(...arguments); }; }
  if (window.WebSocket) { const W = window.WebSocket; window.WebSocket = function (u) { note('websocket', u); return new W(...arguments); }; }
  if (navigator.sendBeacon) { const b = navigator.sendBeacon; navigator.sendBeacon = function (u) { note('beacon', u); return b.apply(navigator, arguments); }; }
  window.__copied = [];
  try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } } }); } catch (e) { /* the real clipboard */ }
};
/* Settings for the online link, set before the page's own scripts run, and kept even when relay-config.js assigns its empty ones.
   arg: the made-up address (the file's on-switch is then on), or { enabled, databaseURL } to choose the on-switch too. */
const CONFIG = arg => {
  const cfg = typeof arg === 'string' ? { enabled: true, databaseURL: arg } : arg;
  let data = {};
  Object.defineProperty(window, 'TSI_DATA', { configurable: true, get: () => data, set: v => { data = v; Object.defineProperty(data, 'beastRelay', { configurable: true, get: () => ({ enabled: cfg.enabled, databaseURL: cfg.databaseURL }), set: () => {} }); } });
  window.TSI_DATA = data;
};

async function decodeQr(browser, png) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.setContent('<canvas id="c"></canvas>');
  await p.addScriptTag({ path: path.join(H.ROOT, 'tests/vendor/jsQR.js') });
  const text = await p.evaluate(async b64 => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.getElementById('c');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    const r = window.jsQR(d.data, d.width, d.height);
    return r ? r.data : null;
  }, png.toString('base64'));
  await ctx.close();
  return text;
}

/* The made-up post box: the same rules as the real database's (docs/ONLINE-LINK-SETUP.md), answered in this test. */
async function fakeRelay(context, db) {
  /* Anything else on the internet is stopped and counted (registered first, so the specific route below wins). */
  await context.route(/^(https?|wss?):\/\//, r => { db.stray.push(r.request().url()); return r.abort(); });
  /* An EventSource is a web request (caught above); a WebSocket has its own kind of route. */
  await context.routeWebSocket(/.*/, ws => { db.stray.push('websocket ' + ws.url()); ws.close(); });
  await context.route(new RegExp('^https://' + TEST_HOST.replace(/\./g, '\\.') + '/'), async route => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    const method = req.method();
    if (db.down) { db.refused = (db.refused || 0) + 1; return route.abort('connectionrefused'); }
    db.log.push(method + ' ' + url.pathname + url.search);
    const json = (status, body) => route.fulfill({ status, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: body === undefined ? '' : JSON.stringify(body) });
    const denied = () => json(401, { error: 'Permission denied' });
    const m = /^\/tsi\/state\/([A-Za-z0-9_-]{32,64})(\/t)?\.json$/.exec(url.pathname);
    if (!m) return denied();
    const chan = m[1];
    if (method === 'GET') {
      const doc = Object.prototype.hasOwnProperty.call(db.docs, chan) ? db.docs[chan] : null;
      return json(200, m[2] ? (doc ? doc.t : null) : doc);
    }
    if (method === 'PUT' && !m[2]) {
      let body = null;
      try { body = JSON.parse(req.postData() || 'null'); } catch (e) { return denied(); }
      const keys = body && typeof body === 'object' ? Object.keys(body).sort() : [];
      if (keys.join() !== 'd,t' || typeof body.t !== 'number' || typeof body.d !== 'string' || body.d.length >= 120000) return denied();
      db.docs[chan] = body;
      return url.searchParams.get('print') === 'silent' ? route.fulfill({ status: 204, headers: cors }) : json(200, body);
    }
    if (method === 'DELETE' && !m[2]) { delete db.docs[chan]; return route.fulfill({ status: 204, headers: cors }); }
    return denied();
  });
}
const newDb = () => ({ docs: {}, log: [], stray: [] });

(async () => {
  const browser = await H.chromium.launch();

  /* ====================================================================================================
     1. The DM's box
     ==================================================================================================== */
  section('The DM\'s box: QR code, phone page address, online link status, Offline backup');
  const dm = await H.newContext(browser, 'laptop', { backedUp: true, acceptDownloads: true });
  await dm.setOffline(true);
  await dm.addInitScript(SPY);
  const ex = await dm.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await dm.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    s.partyLevel = 9; s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
    s.facilityLevels.beast_pen = 1;
    const mk = (id, species, name, home, handler) => {
      const c = { id, species, owner: '', name, status: 'housed', home, grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = handler;
      c.development.bond.level = 1; c.development.regional = 'Widowspine';
      return c;
    };
    s.creatures = [mk('cr-stormwing', 'wyvern', 'Stormwing', 'beast_pen', 'Mira'), mk('cr-ashwing', 'griffin', 'Ashwing', 'beast_pen', 'Joss')];
  }));
  await ba.evaluate(() => TSI.store.flush());
  await ba.waitForTimeout(500);
  const state = () => bas(ba);
  const closeDialog = async () => { await ba.locator('.tsi-modal__foot .tsi-btn--primary').last().click(); await ba.waitForTimeout(250); };
  const openBox = async () => {
    if (!(await ba.$('[data-test=beast-box]:visible'))) { await ba.click('[data-test=tile-beast_pen]'); await ba.waitForSelector('[data-test=beast-box]'); }
  };
  const openBackup = async () => {
    await openBox();
    if (!(await ba.$eval('[data-test=beast-backup]', d => d.open))) await ba.click('[data-test=beast-backup-toggle]');
  };
  /* Show the QR code for a handler and read the link text from the window. */
  const showQr = async name => {
    await openBox();
    await ba.click('[data-test=beast-qr-' + name.toLowerCase() + ']');
    await ba.waitForSelector('[data-test=beast-qr-dialog]');
    return ba.$eval('[data-test=beast-qr-link]', n => n.textContent);
  };

  await check('the box offers Show QR for each handler, the standard phone page address, "Online link: off (not set up)" with a guide link and no switch, and an Offline backup that is shut', async () => {
    await openBox();
    equal(await bare(ba, '[data-test=beast-qr-mira]'), 'Show QR to Mira');
    equal(await bare(ba, '[data-test=beast-qr-joss]'), 'Show QR to Joss');
    equal(await bare(ba, '[data-test=beast-phoneurl-value]'), DEFAULT_URL);
    equal(await bare(ba, '[data-test=beast-online-status]'), 'Online link: off (not set up).');
    assert(/guide\.html#beasthandler-online$/.test(await ba.$eval('[data-test=beast-online-guide]', a => a.getAttribute('href'))), 'a link to the setup guide');
    equal(await ba.$$eval('[data-test=beast-online-on], [data-test=beast-online-off], [data-test=beast-online-test], [data-test=beast-online-send]', n => n.length), 0, 'no switch while it is not set up');
    equal(await ba.$eval('[data-test=beast-backup]', d => d.open), false, 'Offline backup is shut');
    equal(await ba.locator('[data-test=beast-pair-mira]').isVisible(), false, 'the pairing code button is out of sight until it is opened');
    equal(await ba.locator('[data-test=beast-snap-mira]').isVisible(), false, 'and so is the snapshot code button');
  });

  let miraLink;
  await check('Show QR to Mira makes her pairing once, says to show it only to her, and gives the plain link with the iPhone Home Screen tip; the Day Log never holds the secret', async () => {
    equal((await state()).beast.handlers.length, 0, 'no pairing yet');
    miraLink = await showQr('Mira');
    const s = await state();
    const mira = s.beast.handlers.filter(h => h.id === 'mira')[0];
    assert(mira && /^[A-Za-z0-9]{24}$/.test(mira.secret), 'a pairing was made');
    equal(miraLink, DEFAULT_URL + '#L1.' + s.beast.campaignId + '.' + mira.secret + '.' + b64u('Mira'), 'the link is the address, then # and the pairing');
    equal(await bare(ba, '[data-test=beast-qr-caption]'), 'Show this only to Mira.');
    const text = await bare(ba, '[data-test=beast-qr-dialog]');
    assert(/camera/.test(text) && /Home Screen/.test(text) && /Safari/.test(text), 'the iPhone tip: ' + text.slice(0, 400));
    assert(/Take back code/.test(text), 'and what to do if it gets out');
    equal(await ba.$eval('[data-test=beast-qr] svg', n => n.getAttribute('role')), 'img');
    equal(await ba.$$eval('[data-test=beast-qr-dialog] canvas', n => n.length), 0, 'drawn as a picture, not on a canvas');
    assert(JSON.stringify(s.log).indexOf(mira.secret) === -1, 'the secret is not in the Day Log');
  });

  await check('the QR picture, read back by an independent reader, holds exactly that link', async () => {
    const png = await ba.locator('[data-test=beast-qr] svg').screenshot({ animations: 'disabled' });
    equal(await decodeQr(browser, png), miraLink);
    const box = await ba.$eval('[data-test=beast-qr] svg', n => { const r = n.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    assert(box[0] >= 240 && box[0] === box[1], 'big and square enough to scan from across a table: ' + box.join(' x '));
    await H.shot(ba, 'beasthandler-link-qr');
  });

  await check('Copy link copies the address; showing the QR again changes nothing and writes nothing to the Day Log', async () => {
    await ba.click('[data-test=beast-qr-copy]');
    await ba.waitForTimeout(250);
    equal(await ba.evaluate(() => window.__copied), [miraLink]);
    await closeDialog();
    const before = await state();
    const again = await showQr('Mira');
    equal(again, miraLink, 'the very same link');
    await closeDialog();
    const after = await state();
    equal(after.beast.handlers[0].secret, before.beast.handlers[0].secret, 'the secret did not change');
    equal(after.log.length, before.log.length, 'nothing written to the Day Log');
  });

  await check('the QR link opened as a file URL is the address of the phone page plus the # part: it never carries a ? part (which a server would see)', async () => {
    const u = new URL(miraLink);
    equal([u.origin + u.pathname, u.search, u.hash.length > 20], [DEFAULT_URL, '', true]);
  });

  await check('the phone page address is a setting (shown as text, changed in a small window, with no text box in the panel itself): a bad one is refused in plain words, a good one is saved and used by the next QR code, and the standard one comes back', async () => {
    await openBox();
    equal(await bare(ba, '[data-test=beast-phoneurl-value]'), DEFAULT_URL);
    equal(await ba.$('[data-test=beast-box] input, [data-test=beast-box] textarea'), null, 'no text box sits in the panel (it would take the keyboard focus when the Pen\'s panel opens)');
    equal(await ba.$('[data-test=beast-phoneurl-default]'), null, 'no "standard address" button while it is the standard');
    await ba.click('[data-test=beast-phoneurl-change]');
    await ba.waitForSelector('[data-test=beast-phoneurl-input]');
    await ba.fill('[data-test=beast-phoneurl-input]', 'http://example.org/x.html');
    await ba.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await ba.waitForFunction(() => /won't work/.test(document.body.textContent) && /https/.test(document.body.textContent));
    equal((await state()).beast.phoneUrl, undefined, 'nothing was saved');
    await ba.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await ba.waitForSelector('[data-test=beast-phoneurl-input]');
    equal(await ba.$eval('[data-test=beast-phoneurl-input]', n => n.value), 'http://example.org/x.html', 'the window comes back with what was typed');
    await ba.fill('[data-test=beast-phoneurl-input]', 'https://example.org/play/beasthandler.html?x=1#y');
    await ba.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await ba.waitForSelector('[data-test=beast-phoneurl-input]', { state: 'detached' });
    await ba.waitForTimeout(300);
    equal((await state()).beast.phoneUrl, 'https://example.org/play/beasthandler.html');
    await openBox();
    equal(await bare(ba, '[data-test=beast-phoneurl-value]'), 'https://example.org/play/beasthandler.html');
    const link = await showQr('Mira');
    assert(link.indexOf('https://example.org/play/beasthandler.html#L1.') === 0, link);
    await closeDialog();
    await openBox();
    await ba.click('[data-test=beast-phoneurl-change]');
    await ba.waitForSelector('[data-test=beast-phoneurl-input]');
    await ba.locator('.tsi-modal__foot button', { hasText: 'Cancel' }).last().click();
    equal((await state()).beast.phoneUrl, 'https://example.org/play/beasthandler.html', 'Cancel changes nothing');
    await ba.click('[data-test=beast-phoneurl-default]');
    await ba.waitForTimeout(300);
    equal((await state()).beast.phoneUrl, undefined);
    equal(await showQr('Mira'), miraLink);
    await closeDialog();
  });

  await check('Offline backup opens and still makes the old pairing and snapshot codes; Take back code is in the main list and asks first', async () => {
    await openBackup();
    equal(await ba.$eval('[data-test=beast-backup]', d => d.open), true);
    await ba.click('[data-test=beast-pair-joss]');
    await ba.waitForSelector('[data-test=beast-pair-dialog]');
    assert(/^BHP1\./.test(await ba.$eval('[data-test=beast-pair]', n => n.value)), 'a BHP1 pairing code for Joss');
    await closeDialog();
    await openBackup();
    equal(await ba.$eval('[data-test=beast-backup]', d => d.open), true, 'it stays open across the redraw');
    await ba.click('[data-test=beast-snap-joss]');
    await ba.waitForSelector('[data-test=beast-snap-dialog]');
    assert(/^BHS1\./.test(await ba.$eval('[data-test=beast-snap]', n => n.value)), 'a BHS1 snapshot code');
    await closeDialog();
    await openBox();
    assert(await ba.$('[data-test=beast-revoke-joss]:visible'), 'Take back code is visible without opening anything');
    equal(await ba.$('[data-test=beast-revoke-mira]') !== null, true);
  });

  await check('the QR window fits a phone (390 px wide), the laptop (1707 x 930, ratio 1.5) and the TV (1920 x 1080, ratio 1): nothing scrolls sideways, buttons are 44 px, the picture is square and big, and Done is in view', async () => {
    const sizes = [{ w: 390, h: 844, min: 200 }, { w: 1707, h: 930, min: 280 }, { w: 1920, h: 1080, min: 280 }];
    for (const sz of sizes) {
      await ba.setViewportSize({ width: sz.w, height: sz.h });
      await ba.waitForTimeout(250);
      await showQr('Mira');
      await ba.waitForTimeout(250);
      const r = await ba.evaluate(() => {
        const modal = document.querySelector('[data-test=beast-qr-dialog]');
        const m = modal.getBoundingClientRect();
        const svg = modal.querySelector('[data-test=beast-qr] svg').getBoundingClientRect();
        const small = [];
        modal.querySelectorAll('button').forEach(n => { const b = n.getBoundingClientRect(); if (b.height < 43.5) small.push(n.textContent.trim() + ' ' + Math.round(b.height)); });
        const done = modal.querySelector('.tsi-modal__foot .tsi-btn--primary').getBoundingClientRect();
        return {
          modal: [Math.round(m.left), Math.round(m.right), Math.round(m.top), Math.round(m.bottom)], vw: innerWidth, vh: innerHeight,
          modalScroll: modal.scrollWidth - modal.clientWidth, pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          svg: [Math.round(svg.width), Math.round(svg.height)], small, doneIn: done.top >= 0 && done.bottom <= innerHeight + 0.5 && done.left >= 0 && done.right <= innerWidth + 0.5,
          linkBox: (() => { const b = modal.querySelector('[data-test=beast-qr-link]').getBoundingClientRect(); return b.left >= m.left && b.right <= m.right; })()
        };
      });
      const where = sz.w + ' x ' + sz.h;
      assert(r.modal[0] >= 0 && r.modal[1] <= r.vw + 0.5 && r.modal[2] >= 0 && r.modal[3] <= r.vh + 0.5, where + ': the window is inside the screen ' + JSON.stringify(r.modal));
      assert(r.modalScroll <= 0, where + ': the window scrolls sideways');
      equal(r.small, [], where + ': small buttons');
      assert(r.svg[0] >= sz.min && r.svg[0] === r.svg[1], where + ': the picture is ' + r.svg.join(' x '));
      assert(r.doneIn, where + ': Done is in view');
      assert(r.linkBox, where + ': the link box is inside the window');
      const png = await ba.locator('[data-test=beast-qr] svg').screenshot({ animations: 'disabled' });
      equal(await decodeQr(browser, png), miraLink, where + ': the picture still reads back');
      await H.shot(ba, 'beasthandler-link-qr-' + sz.w);
      await closeDialog();
    }
    await ba.setViewportSize({ width: 1707, height: 930 });
  });

  /* ====================================================================================================
     2. The phone page
     ==================================================================================================== */
  section('The phone page: linking from the QR link, the Offline backup, Copy my link');
  const phoneCtx = async (extra, o) => {
    const ctx = await H.newContext(browser, 'laptop', Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, extra || {}));
    if (!o || o.offline !== false) await ctx.setOffline(true);
    await ctx.addInitScript(SPY);
    ctx.consoleAll = [];
    ctx.on('page', p => p.on('console', m => ctx.consoleAll.push(m.text())));
    return ctx;
  };
  const ph = await phoneCtx();
  const pp = await ph.newPage();
  const openPB = () => pp.evaluate(() => { const d = document.querySelector('[data-test=bhp-backup]'); if (d) d.open = true; });
  const fragment = link => link.slice(link.indexOf('#'));
  const mira = (await state()).beast.handlers.filter(h => h.id === 'mira')[0];
  const campaign = (await state()).beast.campaignId;
  const stored = page => page.evaluate(() => { const p = localStorage.getItem('tsi.beasthandler.phone.pairing'); return p ? JSON.parse(p) : null; });

  await check('a link opened on the phone links it, says so, and removes the # part from the address bar; the secret is nowhere on the page or in the console', async () => {
    await pp.goto(PHONE + fragment(miraLink));
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    assert(/Hello, Mira/.test(await bare(pp, '[data-test=bhp-screen-snap]')));
    assert(/Linked\. This phone now shows Mira's beasts\./.test(await bare(pp, '[data-test=bhp-flash]')), await bare(pp, '[data-test=bhp-flash]'));
    assert(await pp.$('[data-test=bhp-mylink-button]'), 'Copy my link is there on the very first screen after linking');
    assert(await pp.$eval('[data-test=bhp-iphone-help]', d => /Safari/.test(d.textContent) && /Add to Home Screen/.test(d.textContent) && /Copy my link/.test(d.textContent) && !d.open), 'and the shut iPhone Home Screen help');
    equal(await pp.evaluate(() => [location.hash, location.href.indexOf('#'), location.href.indexOf('L1.')]), ['', -1, -1], 'the address bar holds no # part');
    equal(await stored(pp), { campaign, handler: 'mira', name: 'Mira', secret: mira.secret }, 'the same pairing a pasted pairing code gives');
    equal((await pp.evaluate(() => document.documentElement.innerHTML)).indexOf(mira.secret), -1, 'the secret is not in the page');
    equal(ph.consoleAll.filter(t => t.indexOf(mira.secret) !== -1).length, 0, 'nor in the console');
  });

  await check('the link is still there after a reload (no # part this time)', async () => {
    await pp.reload();
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    equal((await stored(pp)).secret, mira.secret);
    equal(await pp.$('[data-test=bhp-screen-link]'), null);
    equal(await pp.$('[data-test=bhp-flash]'), null, 'the "linked" message is not shown again');
  });

  await check('the Offline backup on the phone is shut; a snapshot code pasted there shows the beasts, with the usual "Snapshot of Day N" line', async () => {
    equal(await pp.$eval('[data-test=bhp-backup]', d => d.open), false);
    await openBackup();
    await ba.click('[data-test=beast-snap-mira]');
    await ba.waitForSelector('[data-test=beast-snap-dialog]');
    const snap = await ba.$eval('[data-test=beast-snap]', n => n.value);
    await closeDialog();
    await openPB();
    await pp.fill('[data-test=bhp-first-snap]', snap);
    await pp.click('[data-test=bhp-first-go]');
    await pp.waitForSelector('[data-test=bh-beast-cr-stormwing][data-mine=yes]');
    assert(/Snapshot of Day \d+, got just now/.test(await bare(pp, '[data-test=bh-sync]')), await bare(pp, '[data-test=bh-sync]'));
    equal(await pp.$eval('[data-test=bhp-backup]', d => d.open), false, 'and on the home screen the Offline backup is shut again');
  });

  await check('opening the very same link again changes nothing and says the phone is already linked; the # part is removed again', async () => {
    await pp.goto(PHONE + fragment(miraLink));
    await pp.waitForSelector('.tsi-modal');
    assert(/already linked to Mira/.test(await bare(pp, '.tsi-modal')), await bare(pp, '.tsi-modal'));
    await pp.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await pp.waitForSelector('.tsi-modal', { state: 'detached' });
    equal(await pp.evaluate(() => location.href.indexOf('#')), -1);
    await pp.waitForSelector('[data-test=bh-beast-cr-stormwing]');
    equal((await stored(pp)).secret, mira.secret);
  });

  await check('a damaged link on a linked phone says so in a pop-up, repeats nothing of it, and changes nothing', async () => {
    await pp.goto(PHONE + '#L1.' + campaign + '.SHORT.TWlyYQ');
    await pp.waitForSelector('.tsi-modal');
    const text = await bare(pp, '.tsi-modal');
    assert(/didn't work/.test(text) && /still linked to Mira/.test(text) && /damaged/.test(text), text);
    assert(text.indexOf('SHORT') === -1 && text.indexOf(campaign) === -1, 'nothing of the link is repeated');
    await pp.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    equal(await pp.evaluate(() => location.hash), '', 'the damaged # part is removed too');
    equal((await stored(pp)).secret, mira.secret);
    await pp.waitForSelector('[data-test=bh-beast-cr-stormwing]');
  });

  let jossLink;
  await check('a different link on a linked phone asks first: Keep what I have changes nothing; Replace the link swaps the handler and clears the old snapshot', async () => {
    jossLink = await showQr('Joss');
    await closeDialog();
    await pp.goto(PHONE + fragment(jossLink));
    await pp.waitForSelector('.tsi-modal');
    const text = await bare(pp, '.tsi-modal');
    assert(/linked to Mira's beasts/.test(text) && /Replace that with the link for Joss's beasts\?/.test(text), text);
    await pp.locator('.tsi-modal__foot button', { hasText: 'Keep what I have' }).click();
    await pp.waitForSelector('.tsi-modal', { state: 'detached' });
    equal((await stored(pp)).handler, 'mira', 'kept');
    await pp.waitForSelector('[data-test=bh-beast-cr-stormwing]');
    await pp.goto(PHONE + fragment(jossLink));
    await pp.waitForSelector('.tsi-modal');
    await pp.locator('.tsi-modal__foot button', { hasText: 'Replace the link' }).click();
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    assert(/Hello, Joss/.test(await bare(pp, '[data-test=bhp-screen-snap]')));
    equal((await stored(pp)).handler, 'joss');
    equal(await pp.evaluate(() => localStorage.getItem('tsi.beasthandler.phone.snapshot')), null, 'Mira\'s snapshot is not kept for Joss');
    await pp.waitForSelector('[data-test=bhp-flash]');
  });

  await check('Copy my link copies this page\'s address plus the # part, which reads back as the same pairing; the Home Screen help names Safari and the icon', async () => {
    await pp.goto(PHONE + fragment(miraLink));
    await pp.waitForSelector('.tsi-modal');
    await pp.locator('.tsi-modal__foot button', { hasText: 'Replace the link' }).click();
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    await openBackup();
    await ba.click('[data-test=beast-snap-mira]');
    await ba.waitForSelector('[data-test=beast-snap-dialog]');
    const snap = await ba.$eval('[data-test=beast-snap]', n => n.value);
    await closeDialog();
    await openPB();
    await pp.fill('[data-test=bhp-first-snap]', snap);
    await pp.click('[data-test=bhp-first-go]');
    await pp.waitForSelector('[data-test=bhp-mylink-button]');
    await pp.click('[data-test=bhp-mylink-button]');
    await pp.waitForSelector('.tsi-modal');
    assert(/Link copied/.test(await bare(pp, '.tsi-modal')));
    await pp.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    const copied = await pp.evaluate(() => window.__copied);
    equal(copied.length, 1);
    assert(copied[0].indexOf('beasthandler.html#L1.') !== -1 && copied[0].indexOf('?') === -1, copied[0].replace(mira.secret, '…'));
    equal(await pp.evaluate(c => TSI.beasthandler.codes.decodeLink(c), copied[0]), { ok: true, pairing: { campaign, handler: 'mira', name: 'Mira', secret: mira.secret } });
  });

  await check('a link arriving by hashchange while a first-meeting reveal plays does not restart or cut it: the same link is ignored, a different one waits (asking nothing) until the reveal has ended, then asks first', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      const R = TSI.bastion.rules;
      const T = window.TSI_DATA;
      const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
      const c = { id: 'cr-prowl', species: 'fellcat', owner: '', name: 'Prowl', status: 'housed', home: 'beast_pen', grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira';
      c.development.bond.level = 1;
      s.creatures.push(c);
      R.rollInitiation(s, data, 'cr-prowl', Math.random);
    }));
    await openBackup();
    await ba.click('[data-test=beast-snap-mira]');
    await ba.waitForSelector('[data-test=beast-snap-dialog]');
    const snap = await ba.$eval('[data-test=beast-snap]', n => n.value);
    await closeDialog();
    const rc = await phoneCtx();
    await rc.addInitScript(() => { window.TSI_BH_SPEED = 0.02; });
    const rp = await rc.newPage();
    await rp.goto(PHONE + fragment(miraLink));
    await rp.waitForSelector('[data-test=bhp-screen-snap]');
    await rp.evaluate(() => { const d = document.querySelector('[data-test=bhp-backup]'); if (d) d.open = true; });
    await rp.fill('[data-test=bhp-first-snap]', snap);
    await rp.click('[data-test=bhp-first-go]');
    await rp.click('[data-test=bh-beast-cr-prowl]');
    await rp.waitForSelector('[data-test=bh-meet]');
    await rp.evaluate(() => { document.querySelector('[data-test=bh-meet]').__mark = 1; });
    const setHash = h => rp.evaluate(x => { location.hash = x; }, h);
    const marked = () => rp.evaluate(() => { const n = document.querySelector('[data-test=bh-meet]'); return !!(n && n.__mark); });
    await setHash(fragment(miraLink));
    await rp.waitForTimeout(900);
    equal([await marked(), await rp.$('.tsi-modal'), await rp.evaluate(() => location.hash)], [true, null, ''], 'the same link: nothing happened, and the # part is wiped');
    await setHash(fragment(jossLink));
    await rp.waitForTimeout(1200);
    equal([await marked(), await rp.$('.tsi-modal'), await rp.evaluate(() => location.hash)], [true, null, ''], 'a different link: the reveal is untouched and nothing is asked yet');
    equal((await stored(rp)).handler, 'mira', 'and nothing was changed');
    await rp.click('[data-test=bh-meet-continue]');
    await rp.waitForSelector('[data-test=bh-meet][data-step="2"]');
    await rp.click('[data-test=bh-meet-roll-regional]');
    await rp.waitForSelector('[data-test=bh-meet-next]:not([hidden])', { timeout: 15000 });
    await rp.click('[data-test=bh-meet-next]');
    await rp.waitForSelector('[data-test=bh-meet-roll-all]');
    await rp.click('[data-test=bh-meet-roll-all]');
    await rp.waitForSelector('[data-test=bh-meet-finish]:not([hidden])', { timeout: 15000 });
    equal(await rp.$('.tsi-modal'), null, 'still nothing asked during the reveal');
    await rp.click('[data-test=bh-meet-finish]');
    await rp.waitForSelector('.tsi-modal', { timeout: 20000 });
    assert(/Replace that with the link for Joss's beasts\?/.test(await bare(rp, '.tsi-modal')), await bare(rp, '.tsi-modal'));
    await rp.locator('.tsi-modal__foot button', { hasText: 'Keep what I have' }).click();
    await rp.waitForSelector('.tsi-modal', { state: 'detached' });
    equal((await stored(rp)).handler, 'mira', 'Keep what I have kept it');
    await rc.close();
  });

  /* A phone that has never been linked. */
  const ph2 = await phoneCtx();
  const p2 = await ph2.newPage();
  const open2 = () => p2.evaluate(() => { const d = document.querySelector('[data-test=bhp-backup]'); if (d) d.open = true; });

  await check('a phone that is not linked and opens a damaged link shows a friendly message on the link screen, repeats nothing of the link, and removes it from the address', async () => {
    await p2.goto(PHONE + '#L1.' + campaign + '.' + mira.secret.slice(0, 10));
    await p2.waitForSelector('[data-test=bhp-screen-link]');
    const text = await bare(p2, '[data-test=bhp-flash]');
    assert(/damaged/.test(text) && /QR code/.test(text), text);
    equal(await p2.$eval('[data-test=bhp-flash]', n => n.getAttribute('role')), 'alert');
    assert((await p2.evaluate(() => document.documentElement.innerHTML)).indexOf(mira.secret.slice(0, 10)) === -1, 'none of it is on the page');
    equal(await p2.evaluate(() => location.hash), '');
    equal(await stored(p2), null, 'nothing was linked');
  });

  await check('the link screen explains the QR way first; the iPhone help and the Offline backup are shut; a pasted link, a pasted pairing code and a wrong paste all behave', async () => {
    const text = await bare(p2, '[data-test=bhp-screen-link]');
    assert(/QR code/.test(text) && /camera/.test(text), text.slice(0, 300));
    equal(await p2.$eval('[data-test=bhp-iphone-help]', d => d.open), false);
    equal(await p2.$eval('[data-test=bhp-backup]', d => d.open), false);
    assert(await p2.$eval('[data-test=bhp-iphone-help]', d => /Safari/.test(d.textContent) && /Home Screen/.test(d.textContent) && /Copy my link/.test(d.textContent)), 'the help says Safari, Home Screen and Copy my link');
    await open2();
    await p2.fill('[data-test=bhp-pair-input]', 'hello there');
    await p2.click('[data-test=bhp-link]');
    assert(/isn't a pairing code or a link/.test(await bare(p2, '[data-test=bhp-pair-problem]')), await bare(p2, '[data-test=bhp-pair-problem]'));
    await p2.fill('[data-test=bhp-pair-input]', '  “' + miraLink.slice(0, 60) + '\n' + miraLink.slice(60) + '”  ');
    await p2.click('[data-test=bhp-link]');
    await p2.waitForSelector('[data-test=bhp-screen-snap]');
    equal((await stored(p2)).secret, mira.secret, 'a whole pasted link links the phone (this is how a Home Screen icon gets its link)');
    equal(await p2.evaluate(() => location.href.indexOf('#')), -1);
    await p2.click('[data-test=bhp-unlink]');
    await p2.waitForSelector('.tsi-modal');
    await p2.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await p2.waitForSelector('[data-test=bhp-screen-link]');
    await openBackup();
    await ba.click('[data-test=beast-pair-mira]');
    await ba.waitForFunction(() => /old one stops working/.test(document.body.textContent));
    await ba.locator('.tsi-modal__foot button', { hasText: 'Cancel' }).last().click();
    await ba.waitForTimeout(250);
    /* The old pairing code (BHP1) still works the old way: made for Joss, who has no snapshot yet. */
    await ba.click('[data-test=beast-revoke-joss]');
    await ba.waitForFunction(() => document.querySelectorAll('.tsi-modal').length === 2);
    await closeDialog();
    await ba.waitForTimeout(250);
    await ba.click('[data-test=beast-pair-joss]');
    await ba.waitForSelector('[data-test=beast-pair-dialog]');
    const bhp = await ba.$eval('[data-test=beast-pair]', n => n.value);
    await closeDialog();
    await open2();
    await p2.fill('[data-test=bhp-pair-input]', bhp);
    await p2.click('[data-test=bhp-link]');
    await p2.waitForSelector('[data-test=bhp-screen-snap]');
    assert(/Hello, Joss/.test(await bare(p2, '[data-test=bhp-screen-snap]')));
  });

  await check('the phone page loads no DM tool, no QR maker and nothing for sending; the Beast Handler files it needs are the only ones', async () => {
    const loaded = await pp.evaluate(() => Array.from(document.scripts).map(s => s.getAttribute('src')));
    assert(loaded.every(s => !/lib\/qrcode|\/qr\.js|publisher|tools\/(bastion|explorer|encounter|quests|crest|arenas|ritual|pelagosi)\//.test(s)), loaded.join(', '));
    assert(loaded.some(s => /relay-config\.js$/.test(s)) && loaded.some(s => /puller\.js$/.test(s)), 'the settings and the receiver are there');
    equal(await pp.evaluate(() => [typeof window.qrcode, typeof TSI.beasthandler.publisher, typeof TSI.beasthandler.qr, typeof TSI.bastion]), ['undefined', 'undefined', 'undefined', 'undefined']);
  });

  await check('the link screen, the waiting screen and the home screen fit a phone (390, 360 and 320 px): no sideways scroll, every button and summary 44 px, code boxes 16 px', async () => {
    const screens = [
      [p2, 'link screen', async () => { await p2.evaluate(() => { localStorage.clear(); }); await p2.goto(PHONE); await p2.waitForSelector('[data-test=bhp-screen-link]'); }],
      [p2, 'link screen, helps open', async () => { await p2.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; })); }],
      [pp, 'waiting screen', async () => { await pp.evaluate(() => { localStorage.removeItem('tsi.beasthandler.phone.snapshot'); }); await pp.goto(PHONE); await pp.waitForSelector('[data-test=bhp-screen-snap]'); }],
      [pp, 'waiting screen, backup open', async () => { await pp.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; })); }]
    ];
    for (const w of [390, 360, 320]) {
      for (const [page, name, setup] of screens) {
        await page.setViewportSize({ width: w, height: 740 });
        await setup();
        await page.waitForTimeout(150);
        const m = await page.evaluate(() => {
          const small = [];
          document.querySelectorAll('button, summary').forEach(n => { const b = n.getBoundingClientRect(); if (b.width && b.height && b.height < 43.5 && n.offsetParent !== null) small.push((n.getAttribute('data-test') || n.className) + ' ' + Math.round(b.height)); });
          const small16 = []; document.querySelectorAll('textarea, input').forEach(n => { if (n.offsetParent !== null && parseFloat(getComputedStyle(n).fontSize) < 16) small16.push(n.getAttribute('data-test')); });
          return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, small, small16 };
        });
        assert(m.sw <= m.cw, name + ' scrolls sideways at ' + w + ': ' + m.sw + ' > ' + m.cw);
        equal(m.small, [], name + ' has small targets at ' + w);
        equal(m.small16, [], name + ' has a code box under 16 px at ' + w);
        if (w === 390) await H.shot(page, 'beasthandler-link-phone-' + name.replace(/[ ,]+/g, '-'));
      }
    }
    await pp.setViewportSize({ width: 390, height: 844 });
    await p2.setViewportSize({ width: 390, height: 844 });
  });

  await check('the phone page also fits the laptop window (1707 x 930, ratio 1.5) and the TV (1920 x 1080, ratio 1) when someone opens it there: no sideways scroll, 44 px buttons', async () => {
    for (const size of ['laptop', 'tv']) {
      const c = await H.newContext(browser, size);
      await c.setOffline(true);
      const p = await c.newPage();
      const measure = () => p.evaluate(() => {
        const small = [];
        document.querySelectorAll('button, summary').forEach(n => { const b = n.getBoundingClientRect(); if (b.width && b.height && b.height < 43.5 && n.offsetParent !== null) small.push((n.getAttribute('data-test') || n.className) + ' ' + Math.round(b.height)); });
        const r = document.querySelector('.tsi-bhp-card').getBoundingClientRect();
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, small, inView: r.left >= 0 && r.right <= innerWidth + 0.5 };
      });
      await p.goto(PHONE);
      await p.waitForSelector('[data-test=bhp-screen-link]');
      await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
      for (const [name, m] of [['link screen', await measure()]]) {
        assert(m.sw <= m.cw && m.inView, size + ' ' + name + ' scrolls sideways: ' + JSON.stringify(m));
        equal(m.small, [], size + ' ' + name + ' small targets');
      }
      await p.goto(PHONE + fragment(miraLink));
      await p.waitForSelector('[data-test=bhp-screen-snap]');
      await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
      const m2 = await measure();
      assert(m2.sw <= m2.cw && m2.inView, size + ' waiting screen scrolls sideways: ' + JSON.stringify(m2));
      equal(m2.small, [], size + ' waiting screen small targets');
      await H.shot(p, 'beasthandler-link-phone-on-' + size);
      await c.close();
    }
  });

  /* ====================================================================================================
     3. Dormant: nothing goes out unless it is switched on and set up
     ==================================================================================================== */
  section('Dormant: no request of any kind unless the online link is switched on and an address is set up');

  await check('with the switch off and no address (as shipped) no request left the DM\'s pages or the phone pages, over everything done so far', async () => {
    for (const [name, page] of [['Explorer', ex], ['Bastion', ba], ['phone', pp], ['second phone', p2]]) {
      equal(await page.evaluate(() => window.__net), [], name + ': no fetch, XMLHttpRequest, EventSource, WebSocket or beacon');
    }
    equal([dm.log.net, ph.log.net, ph2.log.net], [[], [], []], 'and the browser saw no request that wasn\'t for a file');
  });

  await check('the switch on but no address set up: still nothing leaves, and the box still says it is not set up', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { TSI.bastion.rules.setBeastOnlineLink(s, true); }));
    await ba.waitForTimeout(7500);
    equal(await ba.evaluate(() => window.__net), []);
    equal(dm.log.net, []);
    await ba.keyboard.press('Escape');
    await ba.waitForTimeout(250);
    await openBox();
    equal(await bare(ba, '[data-test=beast-online-status]'), 'Online link: off (not set up).');
    equal(await ba.$$eval('[data-test=beast-online-on], [data-test=beast-online-off]', n => n.length), 0);
    await ba.evaluate(() => TSI.bastion.debug.change(s => { TSI.bastion.rules.setBeastOnlineLink(s, false); }));
    equal((await state()).beast.onlineLink, undefined, 'and switching it off leaves nothing in the save');
  });

  await check('a phone that is linked, with no address set up, makes no timer and no request even after a minute of being open and visible again', async () => {
    await pp.goto(PHONE);
    await pp.waitForSelector('[data-test=bhp-screen-snap], [data-test=bh-beast-cr-stormwing]');
    await pp.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online')); });
    await pp.waitForTimeout(1500);
    equal(await pp.evaluate(() => window.__net), []);
    equal(await pp.$('[data-test=bhp-live]'), null, 'no live-update line and no Check now button');
    equal(await pp.$('[data-test=bhp-check]'), null);
  });

  /* The phone's own on-switch: the file's "enabled". An address alone does nothing on a phone, however it was linked. */
  const db0 = newDb();
  await check('a phone that is linked (by QR) and whose settings file holds an address but says enabled: false makes no request of any kind, not at start, not when the page comes back to the front, not when the phone comes back online; with enabled: true the same phone looks', async () => {
    const off = await phoneCtx({}, { offline: false });
    await fakeRelay(off, db0);
    await off.addInitScript(CONFIG, { enabled: false, databaseURL: TEST_URL });
    const op = await off.newPage();
    await op.goto(PHONE + fragment(miraLink));
    await op.waitForSelector('[data-test=bhp-screen-snap]');
    equal((await stored(op)).secret, mira.secret, 'it is linked');
    await op.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online')); });
    await op.waitForTimeout(2500);
    equal(await op.evaluate(() => window.__net), [], 'no fetch, XMLHttpRequest, EventSource, WebSocket or beacon');
    equal([db0.log, db0.stray, off.log.net], [[], [], []], 'the made-up database and the browser saw nothing');
    equal([await op.$('[data-test=bhp-live]'), await op.$('[data-test=bhp-check]')], [null, null], 'no live-update line and no Check now button');
    const on = await phoneCtx({}, { offline: false });
    await fakeRelay(on, db0);
    await on.addInitScript(CONFIG, { enabled: true, databaseURL: TEST_URL });
    const np = await on.newPage();
    await np.goto(PHONE + fragment(miraLink));
    await np.waitForSelector('[data-test=bhp-screen-snap]');
    await np.waitForSelector('[data-test=bhp-check]', { timeout: 8000 });
    for (let i = 0; i < 20 && !db0.log.length; i++) await np.waitForTimeout(250);
    assert(db0.log.length >= 1 && db0.log.every(l => /^GET \/tsi\/state\//.test(l)), 'with both set it looks in the post box: ' + JSON.stringify(db0.log));
    equal(db0.stray, [], 'and only in the made-up one');
    await off.close();
    await on.close();
  });

  /* The test page never makes a request, even when it is set up and switched on: it gets a stand-in kept in memory. */
  const tctx = await H.newContext(browser, 'laptop', { backedUp: true });
  await tctx.route(/^(https?|wss?):\/\//, r => r.abort());
  await tctx.addInitScript(SPY);
  await tctx.addInitScript(CONFIG, TEST_URL);
  const tex = await tctx.newPage();
  await tex.goto(HARNESS + '?tool=explorer');
  await tex.waitForSelector('[data-test=camp]');
  const tba = await tctx.newPage();
  await tba.goto(HARNESS + '?tool=bastion');
  await tba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await check('the test page, even set up and switched on, uses a stand-in in memory and still sends nothing: the browser sees no request', async () => {
    await tba.evaluate(() => TSI.bastion.debug.change(s => {
      const R = TSI.bastion.rules;
      s.partyLevel = 9; s.builtExtras = [{ facId: 'beast_pen', status: 'built' }]; s.facilityLevels.beast_pen = 1;
      const T = window.TSI_DATA;
      const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
      R.beastEnsurePaired(s, data, 'Mira');
      R.setBeastOnlineLink(s, true);
    }));
    await tba.waitForFunction(() => Object.keys(TSI.beasthandler.relay.standIn.docs).length === 1, null, { timeout: 9000 });
    const log = await tba.evaluate(() => TSI.beasthandler.relay.standIn.log.map(x => x.method));
    assert(log.indexOf('PUT') !== -1, 'it "sent" to the stand-in: ' + log.join());
    equal(await tba.evaluate(() => window.__net), []);
    equal(tctx.log.net, [], 'nothing left the page');
  });

  /* ====================================================================================================
     4. The online link, end to end, in two pages sharing only the made-up database
     ==================================================================================================== */
  section('The online link end to end (a made-up database, two separate browsers)');
  const db = newDb();
  const odm = await H.newContext(browser, 'laptop', { backedUp: true });
  await fakeRelay(odm, db);
  await odm.addInitScript(SPY);
  await odm.addInitScript(CONFIG, TEST_URL);
  const oex = await odm.newPage();
  await oex.goto(INDEX + '?tool=explorer');
  await oex.waitForSelector('[data-test=camp]');
  const oba = await odm.newPage();
  await oba.goto(INDEX + '?tool=bastion');
  await oba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await oba.evaluate(() => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    s.partyLevel = 9; s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
    s.facilityLevels.beast_pen = 1;
    const c = { id: 'cr-stormwing', species: 'wyvern', owner: '', name: 'Stormwing', status: 'housed', home: 'beast_pen', grantedDay: 1, housedDay: 1, msgId: '' };
    c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira';
    c.development.bond.level = 1; c.development.regional = 'Widowspine';
    s.creatures = [c];
  }));
  await oba.evaluate(() => TSI.store.flush());
  const ostate = () => bas(oba);
  const oBox = async () => {
    if (!(await oba.$('[data-test=beast-box]:visible'))) { await oba.click('[data-test=tile-beast_pen]'); await oba.waitForSelector('[data-test=beast-box]'); }
  };
  const oClose = async () => { await oba.locator('.tsi-modal__foot .tsi-btn--primary').last().click(); await oba.waitForTimeout(250); };
  let oLink, oSecret, oChan;

  await check('the real suite page (not the test page) with the address set up but the switch off: it offers Switch on, and sends nothing', async () => {
    await oBox();
    oLink = await (async () => { await oba.click('[data-test=beast-qr-mira]'); await oba.waitForSelector('[data-test=beast-qr-link]'); return oba.$eval('[data-test=beast-qr-link]', n => n.textContent); })();
    await oClose();
    oSecret = (await ostate()).beast.handlers[0].secret;
    oChan = await oba.evaluate(s => TSI.beasthandler.seal.chan(s), oSecret);
    await oBox();
    assert(/off\. It is set up/.test(await bare(oba, '[data-test=beast-online-status]')), await bare(oba, '[data-test=beast-online-status]'));
    assert(await oba.$('[data-test=beast-online-on]'), 'a Switch on button');
    equal(await oba.$$eval('[data-test=beast-online-test], [data-test=beast-online-off]', n => n.length), 0);
    await oba.waitForTimeout(4000);
    equal([db.log, await oba.evaluate(() => window.__net)], [[], []], 'nothing requested while it is off');
  });

  await check('Switch on asks first; then the Bastion puts Mira\'s scrambled snapshot in the post box (once), and the box holds nothing readable', async () => {
    await oba.click('[data-test=beast-online-on]');
    await oba.waitForSelector('.tsi-modal');
    assert(/scrambled/.test(await bare(oba, '.tsi-modal')));
    await oba.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    for (let i = 0; i < 40 && !db.docs[oChan]; i++) await oba.waitForTimeout(250);
    assert(db.docs[oChan], 'a copy arrived: ' + JSON.stringify(db.log));
    equal((await ostate()).beast.onlineLink, true);
    const raw = JSON.stringify(db.docs);
    ['Mira', 'Stormwing', oSecret, '"handler"', 'Widowspine'].forEach(w => equal(raw.indexOf(w.replace(/"/g, '\\"')), -1, 'not readable: ' + w));
    equal(Object.keys(db.docs[oChan]).sort(), ['d', 't']);
    assert(/Online link: on\. Last sent/.test(await bare(oba, '[data-test=beast-online-status]')), await bare(oba, '[data-test=beast-online-status]'));
    equal(db.stray, [], 'nothing else left the page');
    const puts = db.log.filter(l => /^PUT/.test(l));
    equal(puts.length, 1, 'one send so far');
    assert(puts[0].indexOf('/tsi/state/' + oChan + '.json') !== -1 && /print=silent/.test(puts[0]), puts[0]);
  });

  await check('Test the link runs the four checks against the post box and all pass; the test message is cleared away', async () => {
    await oba.click('[data-test=beast-online-test]');
    await oba.waitForSelector('[data-test=beast-online-checks]', { timeout: 10000 });
    equal(await oba.$$eval('[data-test=beast-online-checks] li', n => n.map(x => x.getAttribute('data-test'))), ['beast-online-check-send', 'beast-online-check-read', 'beast-online-check-list', 'beast-online-check-junk']);
    equal(await oba.$$eval('[data-test=beast-online-checks] li', n => n.map(x => x.textContent.trim().charAt(0))), ['✓', '✓', '✓', '✓']);
    assert(db.log.some(l => l === 'GET /.json') && db.log.some(l => l === 'GET /tsi/state.json'), 'it asked for the lists, as a stranger would');
    equal(Object.keys(db.docs), [oChan], 'only Mira\'s copy is left');
  });

  const oph = await phoneCtx({}, { offline: false });
  await fakeRelay(oph, db);
  await oph.addInitScript(CONFIG, TEST_URL);
  const opp = await oph.newPage();
  await check('a phone linked from the QR link shows the beasts by itself, with "As of Day N, updated…" and no code pasted', async () => {
    await opp.goto(PHONE + fragment(oLink));
    await opp.waitForSelector('[data-test=bh-beast-cr-stormwing][data-mine=yes]', { timeout: 15000 });
    equal(await opp.evaluate(() => location.href.indexOf('#')), -1);
    assert(/^As of Day \d+, updated (just now|\d+ minutes? ago)$/.test(await bare(opp, '[data-test=bh-sync]')), await bare(opp, '[data-test=bh-sync]'));
    assert(await opp.$('[data-test=bhp-live]'), 'the live-update line is there');
    assert(/Updates arrive by themselves/.test(await bare(opp, '[data-test=bhp-live]')), await bare(opp, '[data-test=bhp-live]'));
    assert(await opp.$('[data-test=bhp-check]'), 'and Check now');
    const gets = db.log.filter(l => /^GET \/tsi\/state\/.+\.json$/.test(l));
    assert(gets.length >= 1);
    equal(db.stray, []);
  });

  await check('a change in the Bastion reaches the phone (Check now makes it quick) and nothing is sent when nothing changed', async () => {
    const t1 = db.docs[oChan].t;
    await oba.evaluate(() => TSI.bastion.debug.change(s => { s.creatures[0].name = 'Stormwing the Second'; }));
    await oba.evaluate(() => TSI.store.flush());
    for (let i = 0; i < 80 && db.docs[oChan].t === t1; i++) await oba.waitForTimeout(250);
    assert(db.docs[oChan].t > t1, 'a newer copy was sent');
    const putsNow = db.log.filter(l => /^PUT/.test(l)).length;
    await oba.waitForTimeout(8000);
    equal(db.log.filter(l => /^PUT/.test(l)).length, putsNow, 'and nothing more while nothing changes');
    await opp.click('[data-test=bhp-check]');
    await opp.waitForFunction(() => /Stormwing the Second/.test(document.body.textContent), null, { timeout: 8000 });
  });

  await check('offline, the phone keeps what it has and says so quietly; back online it catches up', async () => {
    db.down = true;
    await oph.setOffline(true);
    await opp.click('[data-test=bhp-check]');
    await opp.waitForFunction(() => /No connection|Could not reach/.test(document.querySelector('[data-test=bhp-live]').textContent), null, { timeout: 15000 });
    assert(await opp.$('[data-test=bh-beast-cr-stormwing]'), 'the beasts are still there');
    db.down = false;
    await oph.setOffline(false);
    await opp.click('[data-test=bhp-check]');
    await opp.waitForFunction(() => /Updates arrive by themselves/.test(document.querySelector('[data-test=bhp-live]').textContent), null, { timeout: 10000 });
  });

  await check('an older copy put back in the post box is not taken: the phone keeps the newer one', async () => {
    const good = JSON.parse(JSON.stringify(db.docs[oChan]));
    const older = await oba.evaluate(async ({ secret, chan }) => {
      const S = TSI.beasthandler.seal;
      const R = TSI.bastion.rules;
      const s = TSI.bastion.debug.state();
      const data = { bastion: TSI_DATA.bastion, facilities: TSI_DATA.bastionFacilities, tools: TSI_DATA.bastionTools, research: TSI_DATA.bastionResearch, goods: TSI_DATA.bastionGoods, commerce: TSI_DATA.bastionCommerce, courier: TSI_DATA.bastionCourier, creatures: TSI_DATA.bastionCreatures };
      const body = R.beastSnapshotBody(s, data, 'mira');
      body.snapshot.madeAt = 1000;
      body.snapshot.creatures['cr-stormwing'].name = 'An Old Name';
      return S.seal(TSI.beasthandler.codes.encodeSnapshot(body.snapshot, secret), secret, S.aadState(chan));
    }, { secret: oSecret, chan: oChan });
    db.docs[oChan] = { t: good.t + 5, d: older };
    await opp.click('[data-test=bhp-check]');
    await opp.waitForTimeout(1500);
    assert(!/An Old Name/.test(await opp.evaluate(() => document.body.textContent)), 'the old copy is not shown');
    assert(/Stormwing the Second/.test(await opp.evaluate(() => document.body.textContent)), 'the newer one is still shown');
    db.docs[oChan] = good;
  });

  await check('Switch off stops it: a change afterwards is not sent', async () => {
    await oBox();
    await oba.click('[data-test=beast-online-off]');
    await oba.waitForFunction(() => /Online link: off\. It is set up/.test(document.querySelector('[data-test=beast-online-status]').textContent));
    assert(await oba.$('[data-test=beast-online-on]'), 'Switch on is offered again');
    equal((await ostate()).beast.onlineLink, undefined);
    const writes = () => db.log.filter(l => /^(PUT|DELETE)/.test(l)).length;
    const n = writes();
    await oba.evaluate(() => TSI.bastion.debug.change(s => { s.creatures[0].name = 'Stormwing the Third'; }));
    await oba.waitForTimeout(14000);
    equal(writes(), n, 'not one send after switching off');
  });

  await check('Take back code removes that handler\'s copy from the post box (when the link is on) and the phone keeps its last snapshot', async () => {
    await oba.click('[data-test=beast-online-on]');
    await oba.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await oba.waitForTimeout(4500);
    assert(db.docs[oChan], 'the copy is there');
    await oba.click('[data-test=beast-revoke-mira]');
    await oba.waitForFunction(() => document.querySelectorAll('.tsi-modal').length === 2);
    await oba.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    for (let i = 0; i < 60 && db.docs[oChan]; i++) await oba.waitForTimeout(250);
    equal(db.docs[oChan], undefined, 'the copy is gone');
    assert(await opp.$('[data-test=bh-beast-cr-stormwing]'), 'the phone still shows what it had');
  });

  await check('through the whole online run only the made-up database was ever asked: nothing else left either browser', async () => {
    equal(db.stray, []);
    const urls = odm.log.net.concat(oph.log.net);
    assert(urls.length > 5, 'it did use the made-up database');
    assert(urls.every(u => u.indexOf('https://' + TEST_HOST + '/') === 0), urls.filter(u => u.indexOf('https://' + TEST_HOST + '/') !== 0).join(', '));
    equal([odm.log.errors, oph.log.errors], [[], []]);
  });

  await check('the isolation itself works: a WebSocket, an EventSource, a beacon, a fetch and an XMLHttpRequest to a real-looking address from an online browser are all stopped and counted, and none of them reaches it', async () => {
    const probe = await odm.newPage();
    await probe.goto(HARNESS + '?tool=explorer');
    await probe.evaluate(() => {
      try { new WebSocket('wss://real-database.example/.ws'); } catch (e) { /* refused is fine */ }
      try { const es = new EventSource('https://real-database.example/x.json'); es.onerror = () => es.close(); } catch (e) { /* refused is fine */ }
      try { navigator.sendBeacon('https://real-database.example/b', 'x'); } catch (e) { /* refused is fine */ }
      fetch('https://real-database.example/f').catch(() => {});
      const x = new XMLHttpRequest(); x.open('GET', 'https://real-database.example/xhr'); try { x.send(); } catch (e) { /* refused is fine */ }
    });
    for (let i = 0; i < 40 && db.stray.length < 5; i++) await probe.waitForTimeout(100);
    const kinds = db.stray.map(u => /^websocket /.test(u) ? 'websocket' : /\/\.ws$|\/x\.json$|\/b$|\/f$|\/xhr$/.exec(u)[0]).sort();
    equal(kinds, ['/b', '/f', '/x.json', '/xhr', 'websocket'].sort(), 'all five were caught: ' + db.stray.join(', '));
    equal(await probe.evaluate(() => window.__net.map(x => x.split(' ')[0]).sort()), ['beacon', 'eventsource', 'fetch', 'websocket', 'xhr'], 'and the request spy saw all five kinds');
    db.stray.length = 0;
    await probe.close();
  });

  await check('in the online run the pages\' own request spy saw nothing but requests for the made-up database: no XMLHttpRequest, EventSource, WebSocket or beacon, and no other address', async () => {
    for (const [name, page] of [['Explorer', oex], ['Bastion', oba], ['phone', opp]]) {
      const net = await page.evaluate(() => window.__net);
      assert(net.every(x => x.indexOf('fetch https://' + TEST_HOST + '/') === 0), name + ': ' + net.filter(x => x.indexOf('fetch https://' + TEST_HOST + '/') !== 0).join(', '));
    }
    equal(db.stray, [], 'and nothing was stopped on its way to anywhere else');
  });

  await check('nothing went wrong in any browser: no page errors, no missing files', async () => {
    for (const c of [dm, ph, ph2, tctx, odm, oph]) {
      equal(c.log.errors, []);
      equal(c.log.failed, []);
      equal(c.log.consoleErrors.filter(e => !/Failed to load resource|net::ERR/.test(e)), []);
    }
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
