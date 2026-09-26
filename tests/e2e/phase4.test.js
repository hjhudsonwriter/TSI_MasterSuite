/* Phase 4 click-through: the Notice Board Quest Generator.
   Opens index.html?tool=quests from its files, checks it fits Harry's screens,
   generates, accepts, stars and removes quests, checks they're saved and
   backed up, drives the players' pop-out board, and checks the ★ → Knightly
   Treasures link. The link is tested against a stand-in for Matt's database
   (Playwright plays the database's part on the WebSocket), so nothing is ever
   written to the real one. When the old tool is in _legacy/, it's served on
   this machine and compared with the rebuild: the quests each Generate picks,
   the notices' tilts and wording, the pool counts, outlines, the accepted list
   and every message sent to the shop.
   Run:  node tests/e2e/phase4.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const QUESTS = INDEX + '?tool=quests';
const HARNESS = H.fileUrl('tests/harness.html');
const LEGACY_DIR = path.join(H.ROOT, '_legacy/scarlett-isles-quest-generator');
const HAS_LEGACY = fs.existsSync(path.join(LEGACY_DIR, 'app.js'));
const DB_HOST = /scarlett-isles-companion-default-rtdb\.firebaseio\.com/;

/* A seeded Math.random, so the old and new tools can be given the same dice. */
function seedable() {
  window.__seed = function (a) {
    Math.random = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
}

/* Play the part of Matt's database: answer the library's handshake, record
   every message and acknowledge it (after ackMs, or never if ackMs is null). */
async function fakeDatabase(context, options) {
  const db = { frames: [], connections: 0, ackMs: (options && 'ackMs' in options) ? options.ackMs : 0 };
  await context.routeWebSocket(DB_HOST, ws => {
    db.connections++;
    ws.onMessage(m => {
      let d;
      try { d = JSON.parse(String(m)); } catch (e) { return; }
      if (!d || d.t !== 'd' || !d.d || !d.d.r) return;
      if (d.d.a === 'p') db.frames.push({ path: d.d.b.p, data: d.d.b.d, at: Date.now() });
      const reply = () => ws.send(JSON.stringify({ t: 'd', d: { r: d.d.r, b: { s: 'ok', d: '' } } }));
      if (d.d.a !== 'p' || db.ackMs === 0) reply();
      else if (db.ackMs !== null) setTimeout(reply, db.ackMs);
    });
    ws.send(JSON.stringify({ t: 'c', d: { t: 'h', d: { ts: Date.now(), v: '5', h: new URL(ws.url()).host, s: 'stand-in' } } }));
  });
  /* The messages, without their time stamps, with Firebase's lists turned back into lists. */
  db.messages = () => db.frames.map(f => normalise(f.data));
  return db;
}
function normalise(d) {
  if (!d || !d.primaryQuest) return { primaryQuest: null };
  const p = sortKeys(d.primaryQuest);
  if (p.tags && !Array.isArray(p.tags)) p.tags = Object.keys(p.tags).sort((a, b) => a - b).map(k => p.tags[k]);
  return { primaryQuest: p };
}
/* Firebase sends an object's fields in alphabetical order. */
function sortKeys(o) {
  const out = {};
  Object.keys(o).sort().forEach(k => { out[k] = o[k]; });
  return out;
}

async function newPage(browser, size, opts) {
  opts = opts || {};
  const context = await H.newContext(browser, size || 'laptop');
  if (opts.offline !== false) await context.setOffline(true);
  await context.addInitScript(seedable);
  const db = opts.db ? await fakeDatabase(context, opts.db) : null;
  const page = await context.newPage();
  return { context, page, db };
}

async function openQuests(page, url) {
  await page.goto(url || QUESTS);
  await page.waitForSelector('[data-test=generate]');
}

const dbg = (page, what) => page.evaluate(w => TSI.quests.debug[w](), what);
const text = (page, test) => page.textContent('[data-test=' + test + ']');
const noticeIds = page => page.$$eval('[data-test=parchments] [data-test=notice]', ns => ns.map(n => Number(n.dataset.id)));
const noticeTilts = page => page.$$eval('[data-test=parchments] [data-test=notice]', ns => ns.map(n => n.dataset.rot));
const acceptedIds = page => page.$$eval('[data-test=acc-item]', ns => ns.map(n => Number(n.dataset.id)));

async function setFilters(page, f) {
  if ('province' in f) await page.selectOption('[data-test=province]', f.province);
  if ('faction' in f) await page.selectOption('[data-test=faction]', f.faction);
  if ('qtype' in f) await page.selectOption('[data-test=qtype]', f.qtype);
  if ('clan' in f) await page.selectOption('[data-test=clan-honour]', String(f.clan));
  if ('temple' in f) await page.selectOption('[data-test=temple-honour]', String(f.temple));
  if ('level' in f) await page.fill('[data-test=level]', String(f.level));
  if ('count' in f) await page.fill('[data-test=count]', String(f.count));
}

async function generate(page, f, seed) {
  if (f) await setFilters(page, f);
  if (seed !== undefined) await page.evaluate(s => window.__seed(s), seed);
  await page.click('[data-test=generate]');
  return noticeIds(page);
}

async function accept(page, id) {
  await page.click('[data-test=notice][data-id="' + id + '"] [data-test=accept]');
}

async function waitSaved(page) {
  await page.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
}

/* Only the database may be reached, and only by the Notice Board. */
function onlyDatabase(net) {
  return net.filter(u => !DB_HOST.test(u));
}

/* A tiny web server for the old tool, which can't load its quests from a double-clicked file. */
function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(dir, rel === '/' ? 'index.html' : rel);
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

    await check('its card says Open and opens it, with Export and Import in the top bar', async () => {
      equal(await page.textContent('.tsi-card[data-tool=quests] .tsi-card__cta'), 'Open');
      await Promise.all([page.waitForURL(/\?tool=quests$/), page.click('.tsi-card[data-tool=quests]')]);
      await page.waitForSelector('[data-test=generate]');
      equal(await page.textContent('.tsi-topbar__tool'), 'Notice Board Quest Generator');
      assert(await page.isVisible('[data-test=export]') && await page.isVisible('[data-test=import]'), 'Export/Import missing');
    });

    await check('it shows "Loaded 180" with the internet off, and 97 eligible quests at level 7', async () => {
      equal(await text(page, 'loaded-count'), '180');
      equal(await text(page, 'pool-count'), '97');
    });

    await check('the filters start as the old tool\'s did', async () => {
      const v = await page.evaluate(() => ['province', 'level', 'clan-honour', 'temple-honour', 'faction', 'qtype', 'count'].map(t => document.querySelector('[data-test=' + t + ']').value));
      equal(v, ['ALL', '7', '0', '0', 'ALL', 'ALL', '3']);
      equal(await page.$$eval('[data-test=clan-honour] option', o => o.map(x => x.value)), ['-3', '-2', '-1', '0', '1', '2', '3']);
    });

    await check('the headings and notices use the suite\'s fonts, loaded from the suite folder', async () => {
      await page.evaluate(() => document.fonts.ready);
      await generate(page);
      const f = await page.evaluate(() => ({
        loaded: Array.from(document.fonts).filter(x => x.status === 'loaded').map(x => x.family.replace(/"/g, '')),
        heading: getComputedStyle(document.querySelector('.tsi-quests-heading')).fontFamily,
        notice: getComputedStyle(document.querySelector('.tsi-quests-parchment')).fontFamily
      }));
      assert(f.loaded.includes('Cinzel') && f.loaded.includes('Cormorant Garamond'), f.loaded.join());
      assert(/^"?Cinzel/.test(f.heading), f.heading);
      assert(/^"?Cormorant Garamond/.test(f.notice), f.notice);
    });

    await check('no two things on the page share an id; its styles only touch the Notice Board', async () => {
      const dupes = await page.evaluate(() => {
        const seen = {};
        document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
        return Object.keys(seen).filter(k => seen[k] > 1);
      });
      equal(dupes, []);
      ['tools/quests/quests.css', 'tools/quests/board.css', 'tools/quests/player.css'].forEach(file => {
        const css = fs.readFileSync(path.join(H.ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        const selectors = [];
        css.replace(/([^{}]+)\{[^{}]*\}/g, (m, sel) => { selectors.push(sel.trim()); return m; });
        selectors.filter(s => s && !s.startsWith('@')).forEach(s => s.split(/,(?![^(]*\))/).forEach(one => {
          one = one.trim();
          assert(/^(\.tsi-tool--quests|\.tsi-player--noticeboard|:is\(\.tsi-tool--quests, \.tsi-player--noticeboard\))/.test(one), file + ' unscoped rule: ' + one);
          (one.match(/\.[\w-]+/g) || []).forEach(cls => assert(/^\.tsi-(quests|tool--quests|player--noticeboard|input|btn|field|extlink)/.test(cls), file + ' unprefixed class: ' + cls));
        }));
      });
    });

    await check('the Firebase library is the one the old tool used (9.22.0), unchanged, and loads only here', async () => {
      equal(await page.evaluate(() => firebase.SDK_VERSION), '9.22.0');
      const lib = fs.readFileSync(path.join(H.ROOT, 'tools/quests/lib/firebase/firebase-app-compat.js'), 'utf8');
      assert(lib.startsWith('!function(e,t){"object"==typeof exports'), 'the library file was changed');
      const tools = H.toolList();
      tools.filter(t => t.id !== 'quests').forEach(t => assert(!JSON.stringify(t.files).includes('firebase'), t.id + ' loads Firebase'));
    });

    await check('Matt\'s database settings are in shop-link.js and nowhere else in the suite', async () => {
      /* Read the settings from shop-link.js rather than writing them here, so this file doesn't hold a copy. */
      const link = fs.readFileSync(path.join(H.ROOT, 'tools/quests/shop-link.js'), 'utf8');
      const secrets = ['apiKey', 'appId', 'messagingSenderId'].map(k => (link.match(new RegExp(k + ": '([^']+)'")) || [])[1]);
      secrets.forEach(v => assert(v && v.length > 8, 'a setting is missing from shop-link.js'));
      const hits = [];
      const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        if (['.git', '_legacy', '_reference', 'node_modules'].includes(e.name)) return;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(js|html|css|md|json|txt)$/.test(e.name)) {
          const body = fs.readFileSync(p, 'utf8');
          if (secrets.some(v => body.includes(v))) hits.push(path.relative(H.ROOT, p));
        }
      });
      walk(H.ROOT);
      equal(hits, ['tools/quests/shop-link.js']);
    });
    await context.close();
  }

  for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
    const { context, page } = await newPage(browser, size);
    await openQuests(page);
    await page.evaluate(() => document.fonts.ready);
    await generate(page, { count: 6 }, 11);
    await accept(page, (await noticeIds(page))[0]);
    const inView = size === 'smallWindow' ? [] : ['[data-test=generate]', '[data-test=clear]', '[data-test=popout]', '[data-test=count]', '[data-test=province]', '[data-test=pool-count]', '[data-test=board]', '[data-test=outline]', '[data-test=accepted-list]', '[data-test=shop-link]'];
    await check(size + ': it fits' + (size === 'smallWindow' ? ' with no sideways scroll' : ' with the filters, Generate, the board and both side panels in view'), async () => {
      const l = await H.layoutCheck(page, inView);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll: ' + l.scrollWidth);
      equal(l.outOfView, []);
    });
    if (size !== 'smallWindow') {
      await check(size + ': six notices fit on the board three across', async () => {
        const tops = await page.$$eval('[data-test=parchments] [data-test=notice]', ns => ns.map(n => Math.round(n.getBoundingClientRect().top / 20)));
        equal(new Set(tops).size, 2, 'rows');
        const scroll = await page.$eval('.tsi-quests-scroll', s => s.scrollHeight - s.clientHeight);
        assert(scroll <= 40, 'the board needs scrolling by ' + scroll + 'px');
      });
    }
    await H.shot(page, 'quests-' + size);
    await check(size + ': no missing files or errors; only Matt\'s database is tried (it can\'t be reached)', async () => {
      equal(onlyDatabase(context.log.net), []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors.filter(e => !/firebaseio\.com|ERR_INTERNET_DISCONNECTED/.test(e)), []);
      equal(await page.$$eval('.tsi-notice--error', n => n.length), 0);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Generating, accepting, starring and removing');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openQuests(page);
    const all = await page.evaluate(() => window.TSI_DATA.quests.quests);
    const byId = id => all.find(q => q.id === id);

    await check('Generate pins 3 notices, one of them a bounty, each slightly tilted', async () => {
      const ids = await generate(page);
      equal(ids.length, 3);
      equal(ids.filter(id => byId(id).quest_type === 'Bounty').length, 1);
      (await noticeTilts(page)).forEach(r => assert(Math.abs(Number(r)) <= 1.2, r));
      equal(await page.$eval('[data-test=notice]', n => n.querySelector('.tsi-quests-bounty-head').textContent), 'BOUNTY');
    });

    await check('Count 6 pins 6; Count 1 pins just the bounty; Quest Type Bounty pins one (N1: kept)', async () => {
      equal((await generate(page, { count: 6 })).length, 6);
      const one = await generate(page, { count: 1 });
      equal([one.length, byId(one[0]).quest_type], [1, 'Bounty']);
      equal((await generate(page, { count: 6, qtype: 'Bounty' })).length, 1);
      await setFilters(page, { qtype: 'ALL' });
    });

    await check('at level 11 no bounty appears; honour opens more quests', async () => {
      await setFilters(page, { level: 11 });
      equal(await text(page, 'pool-count'), '4');
      await setFilters(page, { clan: 3, temple: 3 });
      equal(await text(page, 'pool-count'), '28');
      const ids = await generate(page, { count: 6 });
      equal(ids.filter(id => byId(id).quest_type === 'Bounty').length, 0);
      await setFilters(page, { level: 7, clan: 0, temple: 0 });
    });

    await check('the Party Level box can show 20 while the tool uses 16 (QST-20: kept)', async () => {
      await setFilters(page, { level: 20 });
      equal(await page.inputValue('[data-test=level]'), '20');
      await setFilters(page, { level: 16 });
      const at16 = await text(page, 'pool-count');
      await setFilters(page, { level: 20 });
      equal(await text(page, 'pool-count'), at16);
      await setFilters(page, { level: 7 });
    });

    await check('Decline takes a notice down and re-tilts the rest (QST-22: kept)', async () => {
      const ids = await generate(page, { count: 6 }, 3);
      const tilts = await noticeTilts(page);
      await page.click('[data-test=notice][data-id="' + ids[2] + '"] [data-test=decline]');
      equal(await noticeIds(page), ids.filter(id => id !== ids[2]));
      assert(JSON.stringify(await noticeTilts(page)) !== JSON.stringify(tilts.filter((t, i) => i !== 2)), 'tilts unchanged');
    });

    await check('Clear empties the board', async () => {
      await page.click('[data-test=clear]');
      equal(await noticeIds(page), []);
    });

    let first, second;
    await check('Accept adds the quest to Accepted Quests under its province and shows its outline', async () => {
      const ids = await generate(page, { count: 6 }, 5);
      first = ids[1];
      second = ids[2];
      await accept(page, first);
      equal(await acceptedIds(page), [first]);
      equal(await page.textContent('.tsi-quests-acc-prov'), byId(first).province);
      equal(await text(page, 'outline-title'), byId(first).title);
      equal(await page.getAttribute('[data-test=acc-item]', 'aria-pressed'), 'true');
      const saved = await page.evaluate(id => TSI.quests.debug.outlines()[String(id)], first);
      equal(saved, await page.evaluate(id => TSI.quests.rules.buildOutline(window.TSI_DATA.quests.quests.find(q => q.id === id)), first));
    });

    await check('accepting the same quest twice keeps one copy', async () => {
      await accept(page, first);
      equal(await acceptedIds(page), [first]);
    });

    await check('clicking an accepted quest shows its outline', async () => {
      await accept(page, second);
      equal((await acceptedIds(page)).sort(), [first, second].sort());
      await page.click('[data-test=acc-item][data-id="' + first + '"]');
      equal(await text(page, 'outline-title'), byId(first).title);
      const headings = await page.$$eval('.tsi-quests-qo-heading', h => h.map(x => x.textContent));
      equal(headings, ['Premise', 'Beats', 'Encounter', 'Key checks', 'Complication', 'Resolution']);
    });

    await check('the ★ marks the main quest for the shop, and a second click clears it', async () => {
      const star = '[data-test=star][data-id="' + second + '"]';
      equal(await page.getAttribute(star, 'title'), 'Set as primary quest');
      await page.click(star);
      equal(await dbg(page, 'primaryId'), second);
      equal(await page.getAttribute(star, 'title'), 'Primary quest for shop');
      assert(await page.$eval('[data-test=acc-item][data-id="' + second + '"]', e => e.classList.contains('tsi-quests-acc-item--primary')), 'not marked');
      await page.click(star);
      equal(await dbg(page, 'primaryId'), null);
      await page.click(star);
    });

    await check('✕ removes a quest at once; removing the selected one clears the outline', async () => {
      await page.click('[data-test=acc-item][data-id="' + first + '"]');
      await page.click('[data-test=remove][data-id="' + first + '"]');
      equal(await acceptedIds(page), [second]);
      equal(await page.textContent('[data-test=outline]'), 'Accept a quest, then click it to view an outline here.');
      equal(await dbg(page, 'primaryId'), second);
    });

    await check('the ★ quest\'s ★ goes when it\'s removed', async () => {
      await page.click('[data-test=remove][data-id="' + second + '"]');
      equal(await acceptedIds(page), []);
      equal(await dbg(page, 'primaryId'), null);
      equal(await page.textContent('[data-test=accepted-list]'), 'No accepted quests yet.');
    });

    await check('an accepted quest can be chosen with the keyboard', async () => {
      await accept(page, first);
      await page.click('[data-test=outline]');
      await page.focus('[data-test=acc-item][data-id="' + first + '"]');
      await page.keyboard.press('Enter');
      equal(await dbg(page, 'selected'), first);
    });

    await check('"Open shop ↗" links to the Knightly Treasures shop in a new tab', async () => {
      const a = await page.$eval('[data-test=shop-link]', l => [l.href, l.target, l.rel]);
      equal(a, ['https://mattjowen1991-hue.github.io/scarlett-isles-companion/', '_blank', 'noopener']);
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(await page.$$eval('.tsi-notice--error', n => n.length), 0);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Saving, Export and Import');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openQuests(page);
    const ids = await generate(page, { count: 6 }, 21);

    await check('accepted quests, their outlines and the ★ survive closing and reopening', async () => {
      await accept(page, ids[0]);
      await accept(page, ids[3]);
      await page.click('[data-test=star][data-id="' + ids[3] + '"]');
      await waitSaved(page);
      equal(await text(page, 'save-status'), 'Saved ✓');
      const before = await page.evaluate(() => ({ a: TSI.quests.debug.accepted(), o: TSI.quests.debug.outlines(), p: TSI.quests.debug.primaryId() }));
      await openQuests(page);
      const after = await page.evaluate(() => ({ a: TSI.quests.debug.accepted(), o: TSI.quests.debug.outlines(), p: TSI.quests.debug.primaryId() }));
      equal(after, before);
      equal((await acceptedIds(page)).sort(), [ids[0], ids[3]].sort());
      assert(await page.$eval('[data-test=star][data-id="' + ids[3] + '"]', s => s.classList.contains('tsi-quests-star--on')), 'the ★ was lost');
    });

    await check('its saves are named tsi.quests.… in the browser\'s database', async () => {
      equal(await page.evaluate(() => TSI.store.keys('quests')), ['tsi.quests.accepted', 'tsi.quests.outlines', 'tsi.quests.primaryId']);
    });

    let exported;
    await check('Export downloads the Notice Board\'s data', async () => {
      const d = await H.download(page, '[data-test=export]');
      assert(/^tsi-quests-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(d.name), d.name);
      exported = JSON.parse(d.text);
      equal([exported.kind, exported.tool, exported.records.map(r => r.key)], ['tool', 'quests', ['tsi.quests.accepted', 'tsi.quests.outlines', 'tsi.quests.primaryId']]);
    });

    await check('Import refuses a file with damaged quests, changing nothing', async () => {
      const bad = Object.assign({}, exported, { records: [{ key: 'tsi.quests.accepted', value: 'broken', savedAt: exported.savedAt }] });
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('bad-quests.json', bad));
      assert(/accepted quests aren't in the right form/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      equal((await acceptedIds(page)).length, 2);
    });

    await check('Import asks first; Cancel changes nothing', async () => {
      const one = Object.assign({}, exported, { records: [{ key: 'tsi.quests.accepted', value: [exported.records[0].value[0]], savedAt: exported.savedAt }] });
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('one-quest.json', one));
      assert(/Import into the Notice Board Quest Generator/.test(await H.modalText(page)));
      await H.clickModal(page, 'Cancel');
      equal((await acceptedIds(page)).length, 2);
    });

    await check('Import replaces the Notice Board\'s data', async () => {
      const one = Object.assign({}, exported, { records: [{ key: 'tsi.quests.accepted', value: [exported.records[0].value[0]], savedAt: exported.savedAt }] });
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('one-quest2.json', one));
      await page.waitForSelector('.tsi-modal');
      await page.uncheck('.tsi-modal input[type=checkbox]');
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Import')]);
      await page.waitForSelector('[data-test=generate]');
      equal(await acceptedIds(page), [exported.records[0].value[0].id]);
      equal(await dbg(page, 'primaryId'), null);
    });

    await check('"Back up everything" includes the Notice Board', async () => {
      await page.click('[data-test=home]');
      await page.waitForSelector('[data-test=backup-everything]');
      const d = await H.download(page, '[data-test=backup-everything]');
      const keys = JSON.parse(d.text).records.map(r => r.key);
      assert(keys.includes('tsi.quests.accepted'), keys.join());
    });

    await check('a damaged save is set aside, not deleted, and Accept still works (QST-05, QST-12)', async () => {
      await page.evaluate(() => { TSI.store.set('tsi.quests.accepted', null); TSI.store.set('tsi.quests.outlines', 'x'); return TSI.store.flush(); });
      await openQuests(page);
      await H.waitForNotice(page, /set aside/);
      equal(await acceptedIds(page), []);
      const ids2 = await generate(page, { count: 3 }, 2);
      await accept(page, ids2[0]);
      equal(await acceptedIds(page), [ids2[0]]);
      const kept = await page.evaluate(() => TSI.store.keys().filter(k => /quarantine|damaged|set-aside|unreadable/i.test(k) || /^tsi\.quests\..+\./.test(k)));
      assert(kept.length >= 2, 'the damaged saves were not kept: ' + kept.join());
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The players\' pop-out board');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openQuests(page);
    const player = async () => {
      const [p] = await Promise.all([context.waitForEvent('page'), page.click('[data-test=popout]')]);
      await p.waitForSelector('.tsi-quests-board');
      return p;
    };
    const playerIds = p => p.$$eval('[data-test=notice]', ns => ns.map(n => Number(n.dataset.id)));
    const playerTilts = p => p.$$eval('[data-test=notice]', ns => ns.map(n => n.dataset.rot));
    let pop;

    await check('Pop-out Board opens the players\' window with the same notices and tilts, and no buttons (N4)', async () => {
      await generate(page, { count: 6 }, 8);
      pop = await player();
      await pop.waitForFunction(() => document.querySelectorAll('[data-test=notice]').length === 6);
      equal(await playerIds(pop), await noticeIds(page));
      equal(await playerTilts(pop), await noticeTilts(page));
      equal(await pop.$$eval('button', b => b.length), 0);
      await pop.setViewportSize({ width: 1920, height: 1080 });
      await H.shot(pop, 'quests-player-tv');
    });

    await check('it follows Generate, Decline, Clear and an empty Generate straight away (QST-03)', async () => {
      const ids = await generate(page, { count: 4 }, 9);
      await pop.waitForFunction(n => document.querySelectorAll('[data-test=notice]').length === n, ids.length);
      equal(await playerIds(pop), ids);
      await page.click('[data-test=notice][data-id="' + ids[0] + '"] [data-test=decline]');
      await pop.waitForFunction(n => document.querySelectorAll('[data-test=notice]').length === n, ids.length - 1);
      equal(await playerTilts(pop), await noticeTilts(page));
      await page.click('[data-test=clear]');
      await pop.waitForFunction(() => document.querySelectorAll('[data-test=notice]').length === 0);
      await generate(page, { count: 4 });
      await pop.waitForFunction(() => document.querySelectorAll('[data-test=notice]').length === 4);
      await generate(page, { province: 'The Bolt Isle', faction: 'Clan Farmer' });
      equal(await noticeIds(page), []);
      await pop.waitForFunction(() => document.querySelectorAll('[data-test=notice]').length === 0);
      await setFilters(page, { province: 'ALL', faction: 'ALL' });
    });

    await check('refreshing the players\' window brings the board back (QST-08)', async () => {
      const ids = await generate(page, { count: 5 }, 10);
      await pop.reload();
      await pop.waitForFunction(n => document.querySelectorAll('[data-test=notice]').length === n, ids.length);
      equal(await playerIds(pop), ids);
    });

    await check('after the DM\'s page is reloaded, the players\' window reconnects and Pop-out Board still works (QST-06)', async () => {
      await openQuests(page);
      await pop.waitForFunction(() => document.querySelectorAll('[data-test=notice]').length === 0, null, { timeout: 8000 });
      await page.waitForFunction(() => TSI.quests.debug.link.isConnected(), null, { timeout: 8000 });
      const ids = await generate(page, { count: 3 }, 12);
      await pop.waitForFunction(n => document.querySelectorAll('[data-test=notice]').length === n, ids.length);
      const pages = context.pages().length;
      await page.click('[data-test=popout]');
      await page.waitForTimeout(300);
      equal(context.pages().length, pages, 'a second players\' window opened');
    });

    await check('leaving the Notice Board closes the players\' window', async () => {
      await page.click('[data-test=home]');
      await page.waitForSelector('.tsi-card');
      await page.waitForTimeout(300);
      assert(pop.isClosed(), 'still open');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The ★ → Knightly Treasures link (a stand-in plays Matt\'s database)');
  {
    const { context, page, db } = await newPage(browser, 'laptop', { offline: false, db: { ackMs: 0 } });
    const q = async id => sortKeys(await page.evaluate(i => { const x = window.TSI_DATA.quests.quests.find(y => y.id === i); return { id: x.id, title: x.title, quest_type: x.quest_type, tags: x.tags, province: x.province, settlement: x.settlement, difficulty: x.difficulty }; }, id));
    await openQuests(page);
    await page.waitForFunction(() => TSI.quests.debug.shop.isConnected());
    const ids = await generate(page, { count: 6 }, 31);
    const step = async fn => { const n = db.frames.length; await fn(); await page.waitForTimeout(250); return db.messages().slice(n); };

    await check('opening with nothing accepted sends nothing', async () => {
      equal(db.frames.length, 0);
    });

    await check('accepting a quest tells the shop it\'s the main quest, at activeQuests', async () => {
      const m = await step(() => accept(page, ids[1]));
      equal(m, [{ primaryQuest: await q(ids[1]) }]);
      equal(db.frames[0].path, '/activeQuests');
      assert(Math.abs(db.frames[0].data.updatedAt - Date.now()) < 5000, 'updatedAt is the time');
    });

    await check('a second accepted quest leaves the first as the main quest', async () => {
      equal(await step(() => accept(page, ids[2])), [{ primaryQuest: await q(ids[1]) }]);
    });

    await check('★ on the second makes it the main quest; ★ off goes back to the first', async () => {
      equal(await step(() => page.click('[data-test=star][data-id="' + ids[2] + '"]')), [{ primaryQuest: await q(ids[2]) }]);
      equal(await step(() => page.click('[data-test=star][data-id="' + ids[2] + '"]')), [{ primaryQuest: await q(ids[1]) }]);
    });

    await check('removing the ★ quest sends one message, not two (QST-13)', async () => {
      await page.click('[data-test=star][data-id="' + ids[2] + '"]');
      await page.waitForTimeout(250);
      equal(await step(() => page.click('[data-test=remove][data-id="' + ids[2] + '"]')), [{ primaryQuest: await q(ids[1]) }]);
    });

    await check('reopening the Notice Board with quests accepted catches the shop up', async () => {
      equal(await step(() => openQuests(page)), [{ primaryQuest: await q(ids[1]) }]);
      await page.waitForFunction(() => TSI.quests.debug.shop.isConnected());
    });

    await check('removing the last quest tells the shop there\'s no quest', async () => {
      equal(await step(() => page.click('[data-test=remove][data-id="' + ids[1] + '"]')), [{ primaryQuest: null }]);
    });

    await check('leaving straight after a ★ waits for the shop to get it (up to 2 seconds)', async () => {
      await generate(page, { count: 3 }, 32);
      const id = (await noticeIds(page))[0];
      await accept(page, id);
      await page.waitForTimeout(300);
      db.ackMs = 900;
      const n = db.frames.length;
      await page.click('[data-test=star][data-id="' + id + '"]');
      const t0 = Date.now();
      await Promise.all([page.waitForURL(/index\.html$/), page.click('[data-test=home]')]);
      const took = Date.now() - t0;
      equal(db.frames.length, n + 1);
      assert(took >= 700 && took < 2400, 'leaving took ' + took + ' ms');
    });

    await check('if the shop never answers, leaving still only waits about 2 seconds', async () => {
      await openQuests(page);
      await page.waitForFunction(() => TSI.quests.debug.shop.isConnected());
      db.ackMs = null;
      await page.click('[data-test=star]');
      const t0 = Date.now();
      await Promise.all([page.waitForURL(/index\.html$/), page.click('[data-test=home]')]);
      const took = Date.now() - t0;
      assert(took >= 1700 && took < 3200, 'leaving took ' + took + ' ms');
    });
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, 'laptop');
    await check('with no internet the ★ still works, with no error, and leaving doesn\'t wait', async () => {
      await openQuests(page);
      const ids = await generate(page, { count: 3 }, 40);
      await accept(page, ids[0]);
      await page.click('[data-test=star][data-id="' + ids[0] + '"]');
      await page.waitForTimeout(1500);
      equal(await dbg(page, 'primaryId'), ids[0]);
      equal(await page.$$eval('.tsi-notice', n => n.length), 0);
      equal(context.log.errors, []);
      const t0 = Date.now();
      await Promise.all([page.waitForURL(/index\.html$/), page.click('[data-test=home]')]);
      assert(Date.now() - t0 < 1500, 'leaving took ' + (Date.now() - t0) + ' ms');
    });
    await context.close();
  }
  {
    const { context, page, db } = await newPage(browser, 'laptop', { offline: false, db: { ackMs: 0 } });
    await check('the test page never contacts Matt\'s database: its stand-in records the message instead', async () => {
      await openQuests(page, HARNESS + '?tool=quests');
      const ids = await generate(page, { count: 3 }, 41);
      await accept(page, ids[0]);
      await page.waitForTimeout(800);
      equal(db.connections, 0);
      equal(await page.evaluate(() => TSI.quests.shopLink.standIn.messages.map(m => m.value.primaryQuest.id)), [ids[0]]);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Faithful to the old tool' + (HAS_LEGACY ? '' : ' (skipped: _legacy/scarlett-isles-quest-generator is missing)'));
  if (HAS_LEGACY) {
    const srv = await serve(LEGACY_DIR);
    const OLD = 'http://127.0.0.1:' + srv.address().port + '/index.html';
    const oldCtx = await H.newContext(browser, 'laptop');
    await oldCtx.addInitScript(seedable);
    await oldCtx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await oldCtx.route(/gstatic\.com\/firebasejs\/9\.22\.0\/(firebase-[a-z-]+\.js)/, r => {
      const name = r.request().url().split('/').pop();
      r.fulfill({ path: path.join(H.ROOT, 'tools/quests/lib/firebase', name), contentType: 'text/javascript' });
    });
    const oldDb = await fakeDatabase(oldCtx, { ackMs: 0 });
    const old = await oldCtx.newPage();
    await old.goto(OLD);
    await old.waitForFunction(() => document.getElementById('loadedCount').textContent === '180');

    const { context, page, db } = await newPage(browser, 'laptop', { offline: false, db: { ackMs: 0 } });
    await openQuests(page);
    await page.waitForFunction(() => TSI.quests.debug.shop.isConnected());

    async function oldFilters(f) {
      await old.evaluate(f => {
        const set = (id, v) => { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('change')); };
        if ('province' in f) set('province', f.province);
        if ('faction' in f) set('faction', f.faction);
        if ('qtype' in f) set('qtype', f.qtype);
        if ('clan' in f) set('clanHonour', f.clan);
        if ('temple' in f) set('templeHonour', f.temple);
        if ('level' in f) set('level', f.level);
        if ('count' in f) set('count', f.count);
      }, f);
    }
    const oldNotices = () => old.$$eval('#parchments .parchment', ns => ns.map(n => ({
      title: (n.querySelector('.bountyHead') || n.querySelector('.title')).textContent,
      text: (n.querySelector('.bountyTarget') || n.querySelector('.notice')).textContent,
      reward: n.querySelector('.bountyReward') ? n.querySelector('.bountyReward').textContent : null,
      tags: Array.from(n.querySelectorAll('.tag')).map(t => t.textContent),
      sig: n.querySelector('.sig').textContent,
      rot: n.style.getPropertyValue('--rot')
    })));
    const newNotices = () => page.$$eval('[data-test=parchments] [data-test=notice]', ns => ns.map(n => ({
      title: (n.querySelector('.tsi-quests-bounty-head') || n.querySelector('.tsi-quests-title')).textContent,
      text: (n.querySelector('.tsi-quests-bounty-target') || n.querySelector('.tsi-quests-notice-text')).textContent,
      reward: n.querySelector('.tsi-quests-bounty-reward') ? n.querySelector('.tsi-quests-bounty-reward').textContent : null,
      tags: Array.from(n.querySelectorAll('.tsi-quests-tag')).map(t => t.textContent),
      sig: n.querySelector('.tsi-quests-sig').textContent,
      rot: n.dataset.rot + 'deg'
    })));

    const setups = [
      {}, { count: 6 }, { count: 1 }, { province: 'The Bolt Isle', count: 6 }, { qtype: 'Bounty', count: 6 },
      { level: 11, clan: 3, temple: 3, count: 6 }, { faction: 'Wardens', level: 9, count: 4 }, { level: 16, count: 6, clan: 2, temple: -1 },
      { province: 'Northern Province', qtype: 'Intrigue', level: 10, count: 5 }, { level: 3, count: 20 }
    ];
    const reset = { province: 'ALL', faction: 'ALL', qtype: 'ALL', clan: 0, temple: 0, level: 7, count: 3 };

    await check('the same filters give the same pool count and, with the same dice, the same notices, wording and tilts', async () => {
      for (let i = 0; i < setups.length; i++) {
        const f = Object.assign({}, reset, setups[i]);
        await oldFilters(f);
        await setFilters(page, f);
        equal(await text(page, 'pool-count'), await old.textContent('#poolCount'), 'pool for ' + JSON.stringify(setups[i]));
        for (const seed of [1, 2, 3]) {
          await old.evaluate(s => window.__seed(s), 100 * i + seed);
          await old.click('#btnGenerate');
          await generate(page, null, 100 * i + seed);
          equal(await newNotices(page), await oldNotices(), 'board for ' + JSON.stringify(setups[i]) + ' seed ' + seed);
        }
      }
    });

    await check('Decline re-tilts the same way', async () => {
      await oldFilters(Object.assign({}, reset, { count: 6 }));
      await setFilters(page, Object.assign({}, reset, { count: 6 }));
      await old.evaluate(() => window.__seed(77));
      await old.click('#btnGenerate');
      await generate(page, null, 77);
      await old.evaluate(() => window.__seed(78));
      await page.evaluate(() => window.__seed(78));
      await old.click('#parchments .parchment:nth-child(3) .btn.decline');
      await page.click('[data-test=parchments] [data-test=notice]:nth-child(3) [data-test=decline]');
      equal(await newNotices(page), await oldNotices());
    });

    await check('every quest\'s outline is word for word the old tool\'s', async () => {
      const a = await old.evaluate(() => { /* global buildOutlineFromQuest, state */ return state.all.map(q => buildOutlineFromQuest(q)); });
      const b = await page.evaluate(() => window.TSI_DATA.quests.quests.map(q => TSI.quests.rules.buildOutline(q)));
      equal(b.length, 180);
      equal(b, a);
    });

    await check('accepting, starring and removing send the shop the same messages as the old tool (one fewer on removing the ★ quest)', async () => {
      await old.evaluate(() => window.__seed(500));
      await old.click('#btnGenerate');
      await generate(page, null, 500);
      const ids = await noticeIds(page);
      const oldStep = async fn => { const n = oldDb.frames.length; await fn(); await old.waitForTimeout(250); return oldDb.messages().slice(n); };
      const newStep = async fn => { const n = db.frames.length; await fn(); await page.waitForTimeout(250); return db.messages().slice(n); };
      const oldAccept = i => old.click('#parchments .parchment:nth-child(' + (i + 1) + ') .btn.accept');
      const steps = [
        ['accept 1', () => oldAccept(0), () => accept(page, ids[0])],
        ['accept 2', () => oldAccept(1), () => accept(page, ids[1])],
        ['accept 3', () => oldAccept(2), () => accept(page, ids[2])],
        ['★ 2 on', () => old.click('[data-primary="' + ids[1] + '"]'), () => page.click('[data-test=star][data-id="' + ids[1] + '"]')],
        ['★ 2 off', () => old.click('[data-primary="' + ids[1] + '"]'), () => page.click('[data-test=star][data-id="' + ids[1] + '"]')],
        ['★ 3 on', () => old.click('[data-primary="' + ids[2] + '"]'), () => page.click('[data-test=star][data-id="' + ids[2] + '"]')],
        ['remove 1', () => old.click('[data-rm="' + ids[0] + '"]'), () => page.click('[data-test=remove][data-id="' + ids[0] + '"]')],
        ['remove ★ 3', () => old.click('[data-rm="' + ids[2] + '"]'), () => page.click('[data-test=remove][data-id="' + ids[2] + '"]')],
        ['reopen', async () => { await old.reload(); await old.waitForFunction(() => document.getElementById('loadedCount').textContent === '180'); await old.waitForTimeout(800); },
          async () => { await openQuests(page); await page.waitForTimeout(800); }],
        ['remove last', () => old.click('[data-rm="' + ids[1] + '"]'), () => page.click('[data-test=remove][data-id="' + ids[1] + '"]')]
      ];
      for (const [name, o, n] of steps) {
        const a = await oldStep(o);
        const b = await newStep(n);
        if (name === 'remove ★ 3') {
          equal(a.length, 2, name + ': the old tool sent');
          equal(a[1], a[0], name + ': the old tool\'s two messages match');
          equal(b, [a[0]], name);
        } else {
          equal(b, a, name);
        }
      }
    });

    await check('the accepted list is grouped and ordered as in the old tool', async () => {
      await old.evaluate(() => window.__seed(600));
      await oldFilters(Object.assign({}, reset, { count: 6 }));
      await old.click('#btnGenerate');
      await generate(page, Object.assign({}, reset, { count: 6 }), 600);
      for (let i = 1; i <= 6; i++) {
        await old.click('#parchments .parchment:nth-child(' + i + ') .btn.accept');
        await page.click('[data-test=parchments] [data-test=notice]:nth-child(' + i + ') [data-test=accept]');
      }
      const oldList = await old.$$eval('#acceptedList .accGroup', gs => gs.map(g => [g.querySelector('.accProv').textContent].concat(Array.from(g.querySelectorAll('.accItem')).map(i => i.querySelector('.accTitle').textContent.replace('★', '').trim() + ' | ' + i.querySelector('.accMeta').firstChild.textContent.trim()))));
      const newList = await page.$$eval('.tsi-quests-acc-group', gs => gs.map(g => [g.querySelector('.tsi-quests-acc-prov').textContent].concat(Array.from(g.querySelectorAll('[data-test=acc-item]')).map(i => i.querySelector('.tsi-quests-acc-title span').textContent + ' | ' + i.querySelector('.tsi-quests-acc-meta span').textContent))));
      equal(newList, oldList);
    });

    await check('an accepted quest\'s outline panel shows the same text as the old tool\'s', async () => {
      const parts = (p, sel) => p.$eval(sel, b => ({
        lines: Array.from(b.querySelectorAll('li, h3, [class*=Pill], [class*=pill]')).map(x => x.textContent.replace(/\s+/g, ' ').trim()),
        title: (b.querySelector('.qoTitle, .tsi-quests-qo-title') || {}).textContent,
        meta: (b.querySelector('.qoMetaLine, .tsi-quests-qo-meta') || {}).textContent
      }));
      const oldItems = await old.$$eval('#acceptedList .accItem', xs => xs.map(x => x.dataset.acc));
      for (const id of oldItems) {
        await old.click('#acceptedList .accItem[data-acc="' + id + '"]');
        await page.click('[data-test=acc-item][data-id="' + id + '"]');
        const a = await parts(old, '#leftPanelBody');
        const b = await parts(page, '[data-test=outline]');
        equal(b, a, 'quest ' + id);
      }
    });

    await check('the old tool\'s saves hold the same quests, outlines and ★ as the rebuild\'s', async () => {
      const a = await old.evaluate(() => ({ a: JSON.parse(localStorage.getItem('si_noticeboard_accepted_v1')).map(q => q.id).sort(), o: JSON.parse(localStorage.getItem('si_noticeboard_outlines_v1')) }));
      const b = await page.evaluate(() => ({ a: TSI.quests.debug.accepted().map(q => q.id).sort(), o: TSI.quests.debug.outlines() }));
      equal(b.a, a.a);
      a.a.forEach(id => equal(b.o[String(id)], a.o[String(id)], 'outline ' + id));
    });

    await oldCtx.close();
    await context.close();
    srv.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
