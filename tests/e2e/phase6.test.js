/* Phase 6 click-through: Arenas of The Scarlett Isles.
   Opens index.html?tool=arenas from its files with the internet off, checks it
   fits Harry's screens with the arena picture, turn panel and Play Turn in
   view, then plays the rounds: the party and portraits (and a full storage),
   saving, Export and Import, a turn's rolls and Apply (once per turn), a
   round's prize (once), the Beast-Pen, the Lion Totems, the Lion's Mark,
   overtime, Forfeit, Back to Start, leaving and shutting down. When the old
   tool is in _legacy/, it plays the same moves in the old tool (served on this
   machine) with the same dice and compares the two screens step by step.
   Run:  node tests/e2e/phase6.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const ARENAS = INDEX + '?tool=arenas';
const LEGACY_DIR = path.join(H.ROOT, '_legacy/arenas-of-the-scarlett-isles');
const HAS_LEGACY = fs.existsSync(path.join(LEGACY_DIR, 'app.js'));
const PORTRAIT = path.join(H.ROOT, 'tools/arenas/assets/overlays/lions_mark_icon.png');
const SWYTH = 'swyth_salt_ring_trials';
const MM = 'middlemount_lions_crown';

/* Before the page loads: seedable or fixed dice, a record of every sound
   played, and (when asked) a storage that pretends to be full. */
function setup() {
  window.__seed = function (a) {
    Math.random = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  window.__dice = function (list) {
    let i = 0;
    Math.random = function () { const v = list[i % list.length]; i++; return v; };
  };
  window.__sounds = [];
  window.__media = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__sounds.push(String(this.getAttribute('src') || this.currentSrc || '').split('/').pop());
    if (window.__media.indexOf(this) < 0) window.__media.push(this);
    return play.apply(this, arguments);
  };
  if (window.IDBObjectStore) {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value) {
      if (window.__failSaves && value && typeof value.key === 'string' && value.key.indexOf('tsi.arenas.') === 0) {
        throw new DOMException('Pretend the storage is full', 'QuotaExceededError');
      }
      return put.apply(this, arguments);
    };
  }
}

/* The page's clock is under the test's control, so timed pictures can be
   moved on without waiting (it still runs at normal speed otherwise). */
async function newPage(browser, size, extra, clock) {
  const context = await H.newContext(browser, size || 'laptop', extra);
  await context.setOffline(true);
  await context.addInitScript(setup);
  const page = await context.newPage();
  await page.clock.install(clock || {});
  return { context, page };
}

async function openArenas(page) {
  await page.goto(ARENAS);
  await page.waitForSelector('[data-test=enter]');
}

const st = page => page.evaluate(() => TSI.arenas.debug.state());
const layers = page => page.evaluate(() => TSI.arenas.debug.layers());
const dockKind = page => page.evaluate(() => TSI.arenas.debug.dock());
const text = (page, test) => page.textContent('[data-test=' + test + ']');
const press = (page, test) => page.$eval('[data-test=' + test + ']', b => b.click());
const dice = (page, list) => page.evaluate(l => window.__dice(l), list);
const sounds = page => page.evaluate(() => window.__sounds.splice(0));
const lastLog = async page => (await text(page, 'console')).trim().split('\n').pop().replace(/^\[\d\d:\d\d\] /, '');
/* Move the page's clock on by at least ms (the test browser's fast-forward
   sometimes moves it less, so check and repeat). */
async function passTime(page, ms) {
  const start = await page.evaluate(() => Date.now());
  for (let i = 0; i < 5 && (await page.evaluate(() => Date.now())) - start < ms; i++) await page.clock.fastForward(ms);
}
/* A person's pause before pressing Play Turn again (double-click protection is 350 ms). */
const gap = page => passTime(page, 400);
const hp = (S, name) => (S.players.concat(S.enemies).filter(x => x.name === name)[0] || {}).hp;

async function waitSaved(page) {
  await page.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
}

/* Open Add Player; the form puts the cursor in Name a moment after it opens. */
async function openAdd(page) {
  await page.click('[data-test=add-player]');
  await page.waitForFunction(() => document.activeElement && document.activeElement.dataset.test === 'ap-name');
}

async function addPlayer(page, name, maxHp, opts) {
  opts = opts || {};
  await openAdd(page);
  await page.fill('[data-test=ap-name]', name);
  await page.fill('[data-test=ap-hp]', String(maxHp));
  if (opts.tag) await page.fill('[data-test=ap-tag]', opts.tag);
  if (opts.image) await page.setInputFiles('[data-test=ap-image]', opts.image);
  await page.click('[data-test=ap-add]');
  await page.waitForFunction(n => TSI.arenas.debug.state().players.some(p => p.name === n), name);
}

async function enter(page, arenaId, roundId) {
  if (arenaId && (await page.inputValue('[data-test=arena]')) !== arenaId) await page.selectOption('[data-test=arena]', arenaId);
  if (roundId && (await page.inputValue('[data-test=round]')) !== roundId) await page.selectOption('[data-test=round]', roundId);
  await page.click('[data-test=enter]');
  await page.click('[data-test=begin-round]');
}

/* One turn: o = { action, dc, skill (modifier), attack (modifier, or false to skip), target (label start), dmg, apply, resolve } */
async function turn(page, o) {
  o = o || {};
  await gap(page);
  await page.click('[data-test=play-turn]');
  await page.waitForSelector('[data-test=t-resolve]');
  if (o.action) await page.selectOption('[data-test=t-action]', o.action);
  if (o.dc) await page.selectOption('[data-test=t-dc]', o.dc);
  if (o.target) {
    const label = await page.$$eval('[data-test=t-target] option', (os, t) => (os.filter(x => x.textContent.indexOf(t) === 0)[0] || {}).textContent, o.target);
    await page.selectOption('[data-test=t-target]', { label });
  }
  await page.fill('[data-test=t-skill-mod]', String(o.skill == null ? 30 : o.skill));
  await page.click('[data-test=t-skill-roll]');
  if (o.attack !== false && o.attack != null) {
    await page.fill('[data-test=t-atk-mod]', String(o.attack));
    await page.click('[data-test=t-atk-roll]');
    if (o.dmg) await page.fill('[data-test=t-dmg]', String(o.dmg));
    if (o.apply !== false) await page.click('[data-test=t-apply]');
  }
  if (o.resolve !== false) await page.click('[data-test=t-resolve]');
}

/* A tiny web server for the old tool, which loads its arenas with fetch(). */
function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg' };
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
      equal(await page.textContent('.tsi-card[data-tool=arenas] .tsi-card__cta'), 'Open');
      await Promise.all([page.waitForURL(/\?tool=arenas$/), page.click('.tsi-card[data-tool=arenas]')]);
      await page.waitForSelector('[data-test=enter]');
      equal(await page.textContent('.tsi-topbar__tool'), 'Arenas of The Scarlett Isles');
      equal(await page.$$eval('[data-test=export], [data-test=import]', x => x.length), 2);
    });

    await check('it starts ready, at Swyth Round 1 with the arena picture and no opponents yet', async () => {
      equal(await page.inputValue('[data-test=arena]'), SWYTH);
      equal(await page.inputValue('[data-test=round]'), 'r1');
      equal(await page.$$eval('[data-test=arena] option', os => os.map(o => o.textContent)), ['Swyth: The Salt-Ring Trials', 'Middlemount: The Lion’s Crown']);
      equal(await page.$$eval('[data-test=round] option', os => os.map(o => o.textContent)), ['Round 1 — Arena Duelists', 'Round 2 — The Beast-Pen', 'Round 3 — Wyvern Rite (Finale)']);
      equal(await text(page, 'status'), 'Ready. Add players, then Enter The Arena.');
      equal(await lastLog(page), 'Loaded Arenas (POV mini-game mode).');
      equal(await layers(page), { base: 'swyth_base_rounds_1_2.png', boss: null, boss2: null });
      equal(await page.textContent('[data-test=party]'), 'No players yet. Click Add Player.');
      equal(await page.textContent('[data-test=enemies]'), 'Opponents appear after you Enter The Arena.');
      await page.waitForFunction(() => document.querySelector('[data-test=scene-base]').naturalWidth > 0);
    });

    await check('headings are in Cinzel and text in Cormorant Garamond, loaded from the suite folder', async () => {
      await page.evaluate(() => document.fonts.ready);
      const f = await page.evaluate(() => ({
        loaded: Array.from(document.fonts).filter(x => x.status === 'loaded').map(x => x.family.replace(/"/g, '')),
        title: getComputedStyle(document.querySelector('.tsi-arn-brand-title')).fontFamily,
        mark: getComputedStyle(document.querySelector('[data-test=mark-name]')).fontFamily,
        body: getComputedStyle(document.querySelector('[data-test=status]')).fontFamily
      }));
      assert(f.loaded.includes('Cinzel') && f.loaded.includes('Cormorant Garamond'), f.loaded.join());
      assert(/^"?Cinzel/.test(f.title) && /^"?Cinzel/.test(f.mark), f.title + ' / ' + f.mark);
      assert(/^"?Cormorant Garamond/.test(f.body), f.body);
    });

    await check('no two things on the page share an id; its styles only touch the Arenas; no Firebase here', async () => {
      const dupes = await page.evaluate(() => {
        const seen = {};
        document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
        return Object.keys(seen).filter(k => seen[k] > 1);
      });
      equal(dupes, []);
      const css = fs.readFileSync(path.join(H.ROOT, 'tools/arenas/arenas.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{([^{}]*\{[^}]*\})*[^}]*\}/g, '');
      const selectors = [];
      css.replace(/([^{}]+)\{[^{}]*\}/g, (m, sel) => { selectors.push(sel.trim()); return m; });
      selectors.filter(s => s && !s.startsWith('@')).forEach(s => s.split(',').forEach(one => {
        one = one.trim();
        assert(one.startsWith('.tsi-tool--arenas'), 'unscoped rule: ' + one);
        (one.match(/\.[\w-]+/g) || []).forEach(cls => assert(/^\.tsi-(arn|tool--arenas|btn|input)/.test(cls), 'unprefixed class: ' + cls));
      }));
      equal(await page.evaluate(() => typeof window.firebase), 'undefined');
    });
    await context.close();
  }

  const MAIN = ['[data-test=arena]', '[data-test=round]', '[data-test=enter]', '[data-test=add-player]', '[data-test=back-to-start]', '[data-test=reset-run]',
    '[data-test=scene]', '[data-test=stats]', '[data-test=view-rules]', '[data-test=play-turn]', '[data-test=end-round]', '[data-test=forfeit]'];
  const TURN = ['[data-test=t-target]', '[data-test=t-skill-roll]', '[data-test=t-atk-roll]', '[data-test=t-dmg]', '[data-test=t-apply]', '[data-test=t-resolve]', '[data-test=t-cancel]'];
  for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
    const { context, page } = await newPage(browser, size);
    await openArenas(page);
    await addPlayer(page, 'Runa', 60, { tag: 'Blue Team', image: PORTRAIT });
    await addPlayer(page, 'Borin', 50);
    await addPlayer(page, 'Cael', 40);
    await page.evaluate(() => document.fonts.ready);
    const inView = size !== 'smallWindow';

    await check(size + ': it fits' + (inView ? ', with the arena, its controls and Play Turn in view' : ' with no sideways scroll'), async () => {
      const l = await H.layoutCheck(page, inView ? MAIN : []);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll: ' + l.scrollWidth);
      equal(l.outOfView, []);
    });
    await check(size + ': the arena picture keeps the old tool\'s 16:9 frame', async () => {
      const r = await page.$eval('[data-test=scene]', s => { const b = s.getBoundingClientRect(); return [b.width, b.height]; });
      assert(Math.abs(r[0] / r[1] - 16 / 9) < 0.01, 'shape ' + r);
      assert(r[0] >= (size === 'tv' ? 1000 : size === 'smallWindow' ? 500 : 850), 'width ' + r[0]);
    });
    await check(size + ': the rules panel shows everything down to the DCs, with Begin Round in view (ARN-10)', async () => {
      await page.click('[data-test=enter]');
      await page.$eval('[data-test=dock-body] .tsi-arn-badges', b => b.scrollIntoView({ block: 'nearest' }));
      const r = await page.evaluate(() => {
        const body = document.querySelector('[data-test=dock-body]').getBoundingClientRect();
        const dcs = document.querySelector('[data-test=dock-body] .tsi-arn-badges').getBoundingClientRect();
        return { inside: dcs.top >= body.top - 1 && dcs.bottom <= body.bottom + 1, text: document.querySelector('[data-test=dock-body] .tsi-arn-badges').textContent };
      });
      assert(r.inside, 'the DCs are hidden');
      equal(r.text, 'Easy 13Standard 15Hard 17');
      if (inView) equal((await H.layoutCheck(page, ['[data-test=begin-round]', '[data-test=not-yet]'])).outOfView, []);
      await H.shot(page, 'arenas-rules-' + size);
      await page.click('[data-test=begin-round]');
    });
    await check(size + ': a turn\'s rolls, Apply and Resolve Turn are all in view', async () => {
      await page.click('[data-test=play-turn]');
      await page.click('[data-test=t-skill-roll]');
      await page.click('[data-test=t-atk-roll]');
      const l = await H.layoutCheck(page, inView ? MAIN.concat(TURN) : []);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll');
      equal(l.outOfView, []);
      await H.shot(page, 'arenas-turn-' + size);
    });
    await check(size + ': nothing from the internet, no missing files, no errors', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The party, portraits and saving');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openArenas(page);

    await check('Add Player adds a player with a small portrait, a tag and full HP', async () => {
      await addPlayer(page, 'Runa', 60, { tag: 'Blue Team', image: PORTRAIT });
      const p = (await st(page)).players[0];
      equal([p.name, p.tag, p.hp, p.maxHp], ['Runa', 'Blue Team', 60, 60]);
      assert(/^data:image\/webp;base64,/.test(p.image), 'portrait: ' + p.image.slice(0, 30));
      const size = await page.$eval('[data-test=player] img.tsi-arn-portrait', i => [i.naturalWidth, i.naturalHeight]);
      equal(size, [96, 96], 'shrunk to 96 px, as before');
      equal(await page.textContent('[data-test=player][data-name=Runa] [data-test=player-hp]'), 'HP 60/60');
      equal(await dockKind(page), null, 'the form closes');
    });

    await check('a double click on Add adds the player once (ARN-08)', async () => {
      await openAdd(page);
      await page.fill('[data-test=ap-name]', 'Borin');
      await page.fill('[data-test=ap-hp]', '50');
      await page.setInputFiles('[data-test=ap-image]', PORTRAIT);
      await page.$eval('.tsi-arn-form', f => { f.requestSubmit(); f.requestSubmit(); });
      await page.waitForFunction(() => TSI.arenas.debug.dock() === null);
      await page.waitForTimeout(300);
      equal((await st(page)).players.map(p => p.name), ['Runa', 'Borin']);
    });

    await check('a picture the browser can\'t open: Add does nothing and the form stays open, as before (ARN-24: kept)', async () => {
      const fake = H.writeTemp('not-a-picture.png', 'this is not a picture');
      await openAdd(page);
      await page.fill('[data-test=ap-name]', 'Nobody');
      await page.setInputFiles('[data-test=ap-image]', fake);
      await page.click('[data-test=ap-add]');
      await page.waitForTimeout(400);
      equal(await dockKind(page), 'add');
      equal((await st(page)).players.length, 2);
      assert(!(await page.$eval('[data-test=ap-add]', b => b.disabled)), 'Add can be pressed again');
      await page.click('[data-test=ap-cancel]');
      equal(context.log.errors, []);
    });

    await check('+5, −5, +10, −10 and Set HP change HP within 0 and the maximum', async () => {
      const card = '[data-test=player][data-name=Borin] ';
      await page.click(card + '[data-test=dmg-10]');
      await page.click(card + '[data-test=dmg-5]');
      equal(hp(await st(page), 'Borin'), 35);
      await page.click(card + '[data-test=heal-10]');
      await page.click(card + '[data-test=heal-5]');
      await page.click(card + '[data-test=heal-5]');
      equal(hp(await st(page), 'Borin'), 50, 'never above the maximum');
      await page.click(card + '[data-test=set-hp]');
      assert(/Set HP for Borin \(0-50\)/.test(await H.modalText(page)));
      await page.fill('[data-test=prompt-input]', '-7');
      await H.clickModal(page, 'Set');
      equal(hp(await st(page), 'Borin'), 0, 'never below 0');
      await page.click(card + '[data-test=set-hp]');
      await page.fill('[data-test=prompt-input]', '31');
      await page.press('[data-test=prompt-input]', 'Enter');
      await page.waitForFunction(() => !document.querySelector('.tsi-modal'));
      equal(hp(await st(page), 'Borin'), 31);
      equal(await page.textContent(card + '[data-test=player-hp]'), 'HP 31/50');
      assert(/width:\s*62%/.test(await page.getAttribute(card + '.tsi-arn-hp-fill', 'style')), 'health bar');
    });

    await check('Remove asks first; Cancel keeps the player', async () => {
      await addPlayer(page, 'Cael', 40);
      await page.click('[data-test=player][data-name=Cael] [data-test=remove-player]');
      assert(/Remove Cael\?/.test(await H.modalText(page)));
      await H.clickModal(page, 'Cancel');
      equal((await st(page)).players.length, 3);
      await page.click('[data-test=player][data-name=Cael] [data-test=remove-player]');
      await H.clickModal(page, 'Remove');
      equal((await st(page)).players.map(p => p.name), ['Runa', 'Borin']);
    });

    await check('the party, portraits, gold and chosen round survive closing and reopening', async () => {
      await page.selectOption('[data-test=round]', 'r4');
      await waitSaved(page);
      equal(await text(page, 'save-status'), 'Saved ✓');
      const before = (await st(page)).players;
      await openArenas(page);
      const after = await st(page);
      equal(after.players, before);
      equal([after.arenaId, after.roundId, after.totalGold], [SWYTH, 'r4', 0]);
      equal(await page.inputValue('[data-test=round]'), 'r4');
      equal(await page.$$eval('[data-test=player] img.tsi-arn-portrait', i => i.length), 2);
    });

    await check('its save is named tsi.arenas.state in the browser\'s database', async () => {
      equal(await page.evaluate(() => TSI.store.keys('arenas')), ['tsi.arenas.state']);
    });

    await check('a full storage: a clear warning, nothing lost, and no portrait dropped (ARN-05)', async () => {
      await page.evaluate(() => { window.__failSaves = true; });
      await addPlayer(page, 'Dara', 45, { image: PORTRAIT });
      await page.waitForFunction(() => document.querySelector('[data-test=save-status]').textContent === 'Not saved');
      await H.waitForNotice(page, /Your latest changes couldn't be saved\. The browser's storage space for the suite is full\./);
      equal((await st(page)).players.map(p => p.name), ['Runa', 'Borin', 'Dara'], 'Dara stays on screen');
      equal((await st(page)).players.filter(p => p.image).length, 3);
      await H.dismissNotices(page);
      await page.evaluate(() => { window.__failSaves = false; });
      await page.click('[data-test=player][data-name=Dara] [data-test=dmg-5]');
      await waitSaved(page);
      await openArenas(page);
      const S = await st(page);
      equal(S.players.map(p => p.name + ' ' + p.hp + ' ' + (p.image ? 'portrait' : 'none')), ['Runa 60 portrait', 'Borin 31 portrait', 'Dara 40 portrait']);
    });

    let exported;
    await check('Export downloads the party and gold', async () => {
      const d = await H.download(page, '[data-test=export]');
      assert(/^tsi-arenas-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(d.name), d.name);
      exported = JSON.parse(d.text);
      equal([exported.kind, exported.tool, exported.records.map(r => r.key)], ['tool', 'arenas', ['tsi.arenas.state']]);
      equal(exported.records[0].value.players.map(p => p.name), ['Runa', 'Borin', 'Dara']);
    });

    await check('Import refuses a file whose party is damaged, changing nothing', async () => {
      const bad = Object.assign({}, exported, { records: [{ key: 'tsi.arenas.state', value: { players: 'Runa', totalGold: 0 }, savedAt: exported.savedAt }] });
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('bad-arenas.json', bad));
      assert(/party and gold aren't in the right form/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      equal((await st(page)).players.length, 3);
    });

    await check('Import refuses another tool\'s file', async () => {
      const other = Object.assign({}, exported, { tool: 'quests', records: [{ key: 'tsi.quests.accepted', value: [], savedAt: exported.savedAt }] });
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('quests-file.json', other));
      assert(/Notice Board/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      equal((await st(page)).players.length, 3);
    });

    const twoPlayers = () => Object.assign({}, exported, { records: [{ key: 'tsi.arenas.state', value: Object.assign({}, exported.records[0].value, { players: exported.records[0].value.players.slice(0, 2), totalGold: 750 }), savedAt: exported.savedAt }] });
    await check('Import asks first; Cancel changes nothing', async () => {
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('two-players.json', twoPlayers()));
      assert(/Import into the Arenas of The Scarlett Isles/.test(await H.modalText(page)));
      await H.clickModal(page, 'Cancel');
      equal((await st(page)).players.length, 3);
    });

    await check('Import replaces the party and gold', async () => {
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('two-players2.json', twoPlayers()));
      await page.waitForSelector('.tsi-modal');
      await page.uncheck('.tsi-modal input[type=checkbox]');
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Import')]);
      await page.waitForSelector('[data-test=enter]');
      const S = await st(page);
      equal([S.players.map(p => p.name), S.totalGold], [['Runa', 'Borin'], 750]);
      equal(await text(page, 'gold'), '750');
    });

    await check('"Back up everything" includes the Arenas', async () => {
      await page.click('[data-test=home]');
      await page.waitForSelector('[data-test=backup-everything]');
      const d = await H.download(page, '[data-test=backup-everything]');
      const keys = JSON.parse(d.text).records.map(r => r.key);
      assert(keys.includes('tsi.arenas.state'), keys.join());
    });

    await check('a damaged save is set aside, not deleted, and the Arenas start fresh', async () => {
      await page.evaluate(() => { TSI.store.set('tsi.arenas.state', { players: 'broken' }); return TSI.store.flush(); });
      await openArenas(page);
      await H.waitForNotice(page, /set aside/);
      equal((await st(page)).players, []);
      const kept = await page.evaluate(() => TSI.store.keys('quarantine').map(k => TSI.store.get(k)));
      equal(kept, [{ players: 'broken' }]);
      await addPlayer(page, 'Runa', 60);
      equal((await st(page)).players.length, 1);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A round: Swyth\'s Arena Duelists');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openArenas(page);
    await addPlayer(page, 'Runa', 90);
    await addPlayer(page, 'Borin', 80);
    await addPlayer(page, 'Cael', 70);
    await sounds(page);

    await check('Enter The Arena loads the round, its opponents and the crowd, and shows the rules', async () => {
      await page.click('[data-test=enter]');
      equal(await dockKind(page), 'rules');
      equal(await text(page, 'dock-title'), 'Enter The Arena: Round 1 — Arena Duelists');
      equal(await text(page, 'dock-sub'), 'Prize: 500 GP');
      equal(await page.$$eval('[data-test=dock-body] li', l => l.length), 9, 'three notes and six approaches');
      equal(await text(page, 'status'), 'Round loaded. Begin when ready.');
      equal(await lastLog(page), '--- Round 1 — Arena Duelists loaded ---');
      equal(await layers(page), { base: 'swyth_base_rounds_1_2.png', boss: 'arena_duelists_standard.png', boss2: null });
      equal(await page.$$eval('[data-test=enemy]', e => e.map(x => x.dataset.name)), ['Arena Duelist 1', 'Arena Duelist 2']);
      equal(await page.evaluate(() => TSI.arenas.debug.crowd()), { paused: false });
      assert((await sounds(page)).includes('crowd_standard.mp3'));
    });

    await check('Begin Round, then a double click on Play Turn opens one turn, for the first player (ARN-07)', async () => {
      await page.click('[data-test=begin-round]');
      equal(await text(page, 'status'), 'Round started. Click Play Turn.');
      equal(await lastLog(page), '--- Round 1 — Arena Duelists begins ---');
      await page.dblclick('[data-test=play-turn]');
      await gap(page);
      await page.click('[data-test=play-turn]');
      const S = await st(page);
      equal([S.turn, S.turnIndex], [1, 1]);
      equal(await page.$eval('[data-test=t-player] strong', s => s.textContent), 'Runa');
      equal(await text(page, 'dock-sub'), 'Turn 1 | Success 0/6 | Fail 0/3');
      equal(await text(page, 'turn'), '1');
    });

    await check('Apply before an attack roll says so', async () => {
      await page.click('[data-test=t-apply]');
      equal(await H.modalText(page), 'Apply damageRoll an attack first.OK');
      await H.clickModal(page, 'OK');
    });

    await check('a hit: Apply deals the damage once, with the hit picture and sounds; a second Apply is refused (ARN-02)', async () => {
      await sounds(page);
      await page.fill('[data-test=t-atk-mod]', '30');
      await page.click('[data-test=t-atk-roll]');
      assert(/\(Hit\)$/.test(await text(page, 't-atk-out')));
      await page.fill('[data-test=t-dmg]', '10');
      await page.click('[data-test=t-apply]');
      equal(hp(await st(page), 'Arena Duelist 1'), 35);
      equal((await layers(page)).boss, 'arena_duelists_hit.png');
      equal(await sounds(page), ['arena_duelist_hit.mp3', 'crowd_hit.mp3']);
      assert(/Damage applied: 10$/.test(await text(page, 't-atk-out')));
      equal(await lastLog(page), 'Attack damage to Arena Duelist 1: -10 HP.');
      await page.click('[data-test=t-apply]');
      equal(await H.modalText(page), 'Apply damageDamage has already been applied this turn.OK');
      await H.clickModal(page, 'OK');
      equal(hp(await st(page), 'Arena Duelist 1'), 35);
      equal(await sounds(page), []);
    });

    await check('re-rolling the attack doesn\'t allow a second Apply either (Harry\'s answer A5)', async () => {
      await page.click('[data-test=t-atk-roll]');
      await page.click('[data-test=t-apply]');
      equal(await H.modalText(page), 'Apply damageDamage has already been applied this turn.OK');
      await H.clickModal(page, 'OK');
      equal(hp(await st(page), 'Arena Duelist 1'), 35);
    });

    await check('the hit picture gives way to the standing duelists after 5.2 seconds', async () => {
      await passTime(page, 5300);
      equal((await layers(page)).boss, 'arena_duelists_standard.png');
    });

    await check('Resolve Turn without a skill roll says so; with a pass it counts a success', async () => {
      await page.click('[data-test=t-resolve]');
      equal(await H.modalText(page), 'Resolve TurnRoll the Skill check first.OK');
      await H.clickModal(page, 'OK');
      await page.fill('[data-test=t-skill-mod]', '30');
      await page.click('[data-test=t-skill-roll]');
      assert(/^✅ Skill: \d+ \+ 30 = \d+ vs DC 15\.$/.test(await text(page, 't-skill-out')), await text(page, 't-skill-out'));
      await page.click('[data-test=t-resolve]');
      equal(await dockKind(page), null);
      equal((await st(page)).successes, 1);
      equal(await text(page, 'status'), 'Turn resolved. Click Play Turn for the next player.');
      equal(await lastLog(page), 'Runa succeeded: +1 success.');
      equal(await text(page, 'successes'), '1');
    });

    await check('a failed check: Borin takes the round\'s 2d6 and a failure is counted', async () => {
      await dice(page, [0.5]);
      await turn(page, { skill: -30 });
      const S = await st(page);
      equal([S.failures, hp(S, 'Borin')], [1, 72]);
      equal(await lastLog(page), 'Borin failed: -8 HP (2d6: 4, 4).');
      equal((await layers(page)).boss, 'arena_duelists_fail.png');
      equal(await page.textContent('[data-test=player][data-name=Borin] [data-test=player-hp]'), 'HP 72/80');
    });

    await check('a missed attack before a duelist falls shows no picture but plays the sounds (ARN-16: kept)', async () => {
      await passTime(page, 5300);
      await sounds(page);
      await dice(page, [0.0]);
      await turn(page, { attack: 0, apply: false, resolve: false });
      assert(/\(Miss\)$/.test(await text(page, 't-atk-out')));
      equal((await layers(page)).boss, 'arena_duelists_standard.png');
      equal(await sounds(page), ['arena_duelist_fail.mp3', 'crowd_fail.mp3']);
      await page.click('[data-test=t-apply]');
      equal(await H.modalText(page), 'Apply damageAttack missed. No damage to apply.OK');
      await H.clickModal(page, 'OK');
      await page.click('[data-test=t-cancel]');
    });

    await check('a cancelled turn still counts and moves to the next player, as before (ARN-14: kept)', async () => {
      const S = await st(page);
      equal([S.turn, S.turnIndex], [3, 3]);
      await gap(page);
      await page.click('[data-test=play-turn]');
      equal(await page.$eval('[data-test=t-player] strong', s => s.textContent), 'Runa');
      await page.click('[data-test=t-cancel]');
    });

    await check('the first duelist to fall stays fallen in the picture, and hits show the one left', async () => {
      await passTime(page, 5300);
      await turn(page, { attack: 30, target: 'Arena Duelist 2', dmg: 45 });
      equal(hp(await st(page), 'Arena Duelist 2'), 0);
      assert((await text(page, 'console')).includes('Arena Duelist 2 is defeated.'));
      equal((await layers(page)).boss, 'arena_duelists_hit.png', 'the picture chosen before the fall');
      await passTime(page, 5300);
      equal((await layers(page)).boss, 'arena_duelists_defeated_2.png');
      await turn(page, { attack: 30, dmg: 5 });
      equal((await layers(page)).boss, 'arena_duelists_hit_1.png');
      equal(await page.$$eval('[data-test=t-target] option', o => o.length), 0, 'the turn panel has closed');
    });

    await check('reaching 6 successes clears the round and pays 500 GP once; the round\'s buttons turn off (ARN-03, ARN-04)', async () => {
      for (let i = 0; i < 3; i++) await turn(page, {});
      equal((await st(page)).successes, 6 - 0);
      equal(await dockKind(page), 'end');
      equal([await text(page, 'dock-title'), await text(page, 'dock-sub')], ['Round Cleared', 'You win 500 GP.']);
      equal(await text(page, 'prize'), '500 GP');
      const S = await st(page);
      equal([S.totalGold, S.roundOver], [500, true]);
      equal(await page.$$eval('[data-test=play-turn], [data-test=end-round], [data-test=forfeit]', b => b.map(x => x.disabled)), [true, true, true]);
      await page.$eval('[data-test=end-round]', b => b.click());
      await page.$eval('[data-test=play-turn]', b => b.click());
      equal((await st(page)).totalGold, 500, 'no second prize');
      equal(await dockKind(page), 'end');
      await waitSaved(page);
      equal(await page.evaluate(() => TSI.store.get('tsi.arenas.state').totalGold), 500, 'the prize is saved');
    });

    await check('the footer gold catches up only on the next change, as before (ARN-25: kept)', async () => {
      equal(await text(page, 'gold'), '0');
    });

    await check('Proceed to Next Round loads the Beast-Pen; the Round list stays on Round 1, as before (ARN-20: kept)', async () => {
      /* Back to varied dice: opponents' ids are made from a roll, so fixed dice would give them all the same id. */
      await page.evaluate(() => window.__seed(4));
      await page.click('[data-test=proceed]');
      equal(await dockKind(page), 'rules');
      equal(await text(page, 'dock-title'), 'Enter The Arena: Round 2 — The Beast-Pen');
      equal(await layers(page), { base: 'swyth_beast_pen_round_4.png', boss: 'beast_pen_standard.png', boss2: null });
      equal(await page.$$eval('[data-test=play-turn], [data-test=end-round], [data-test=forfeit]', b => b.map(x => x.disabled)), [false, false, false]);
      equal(await page.inputValue('[data-test=round]'), 'r1');
      await page.click('[data-test=begin-round]');
    });

    await check('the Beast-Pen: Hard Animal Handling counts double, once per player', async () => {
      await turn(page, { action: 'animal_handling', dc: 'hard' });
      equal((await st(page)).successes, 2);
      equal(await lastLog(page), 'Runa mastered the beast line (Hard): +2 successes (once per player).');
      await turn(page, { action: 'animal_handling', dc: 'standard' });
      equal(await lastLog(page), 'Borin succeeded: +1 success.');
      await gap(page);
      await page.click('[data-test=play-turn]');
      await page.click('[data-test=t-cancel]');
      await turn(page, { action: 'animal_handling', dc: 'hard' });
      equal(await lastLog(page), 'Runa succeeded: +1 success.');
      equal((await st(page)).successes, 4);
    });

    await check('the Beast-Pen picture follows the fallen, and a failure picks a living beast to attack', async () => {
      await turn(page, { attack: 30, target: 'Hooked Hyena 1', dmg: 55 });
      equal((await layers(page)).boss, 'beast_pen_hit_standard.png');
      await passTime(page, 5300);
      equal((await layers(page)).boss, 'beast_pen_standard_hyena_1_dead.png');
      await dice(page, [0.1]);
      await turn(page, { skill: -30 });
      equal((await layers(page)).boss, 'beast_pen_boar_fail_hyena_1_dead.png');
      equal((await st(page)).r4Dead, { boar: false, hyena1: true, hyena2: false });
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Middlemount: the Lion Totems and the Lion\'s Mark');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openArenas(page);
    await addPlayer(page, 'Runa', 90);
    await addPlayer(page, 'Borin', 80);
    await addPlayer(page, 'Cael', 70);

    await check('the Lion Totems: the swordsmen stand over the three totems', async () => {
      await enter(page, MM, 'mm_r2');
      equal(await layers(page), { base: 'middlemount_lions_crown.png', boss: 'lion_swordsman_standard.png', boss2: 'lions_totems_standard.png' });
      equal(await page.$$eval('[data-test=enemy]', e => e.map(x => x.dataset.name)), ['Lion Totem 1', 'Lion Totem 2', 'Lion Totem 3', 'Lion Swordsman (Lion-Helm Duelist) 1', 'Lion Swordsman (Lion-Helm Duelist) 2']);
    });

    await check('a hit on a totem flashes the totems\' layer; a miss on a totem shows nothing and plays nothing', async () => {
      await sounds(page);
      await turn(page, { attack: 30, target: 'Lion Totem 1', dmg: 45 });
      equal(await layers(page), { base: 'middlemount_lions_crown.png', boss: 'lion_swordsman_standard.png', boss2: 'lions_totems_hit.png' });
      equal(await sounds(page), ['lions_totems_hit.mp3', 'crowd_hit.mp3']);
      await passTime(page, 5300);
      equal((await layers(page)).boss2, 'lions_totems_standard_1_dead.png');
      await dice(page, [0.0]);
      await turn(page, { attack: 0, target: 'Lion Totem 2', apply: false, resolve: false });
      equal((await layers(page)).boss2, 'lions_totems_standard_1_dead.png');
      equal(await sounds(page), []);
      await page.click('[data-test=t-resolve]');
    });

    await check('shattering the third totem topples the guardians; the round can then be ended as a win', async () => {
      await turn(page, { attack: 30, target: 'Lion Totem 2', dmg: 45 });
      await turn(page, { attack: 30, target: 'Lion Totem 3', dmg: 45 });
      assert((await text(page, 'console')).includes('All three Lion Totems are shattered. The guardians falter and withdraw.'));
      equal((await st(page)).enemies.map(e => e.hp), [0, 0, 0, 0, 0]);
      equal(await text(page, 'status'), 'Opponents defeated. Round can end now.');
      await passTime(page, 5300);
      equal(await layers(page), { base: 'middlemount_lions_crown.png', boss: 'lion_swordsman_both_dead.png', boss2: 'lions_totems_standard_3_dead.png' });
      await page.click('[data-test=end-round]');
      equal(await text(page, 'dock-sub'), 'All opponents appear defeated. End this round now?');
      await page.click('[data-test=count-win]');
      equal([await text(page, 'dock-title'), (await st(page)).totalGold], ['Round Cleared', 8000]);
    });

    await check('playing the Lion Totems again starts with both swordsmen standing (ARN-09)', async () => {
      await page.evaluate(() => window.__seed(5));
      await page.click('[data-test=leave-arena]');
      await enter(page, MM, 'mm_r2');
      equal(await layers(page), { base: 'middlemount_lions_crown.png', boss: 'lion_swordsman_standard.png', boss2: 'lions_totems_standard.png' });
      equal((await st(page)).mmR2Dead, { swordsman1: false, swordsman2: false });
    });

    await check('the Lion\'s Mark: the first turn marks a player with the horn and a big announcement', async () => {
      await page.selectOption('[data-test=round]', 'mm_r3');
      await page.click('[data-test=enter]');
      await page.click('[data-test=begin-round]');
      equal(await layers(page), { base: 'middlemount_lions_crown.png', boss: 'lions_mark_standard.png', boss2: null });
      await sounds(page);
      await dice(page, [0.5]);
      await gap(page);
      await page.click('[data-test=play-turn]');
      equal(await text(page, 'announce-text'), 'Borin, you have The Lion\'s Mark...');
      assert(await page.isVisible('[data-test=announce]'));
      equal(await text(page, 'mark-name'), 'Borin');
      assert(await page.isVisible('[data-test=mark]'));
      equal(await sounds(page), ['horn_blast.mp3']);
      equal(await page.$eval('[data-test=t-player] strong', s => s.textContent), 'Runa');
    });

    await check('a failure strikes the marked player, and the Mark pulses', async () => {
      await page.fill('[data-test=t-skill-mod]', '-30');
      await page.click('[data-test=t-skill-roll]');
      await page.click('[data-test=t-resolve]');
      equal(await lastLog(page), 'Runa failed: the Lion Knight strikes Borin for -24 HP (6d6: 4, 4, 4, 4, 4, 4).');
      const S = await st(page);
      equal([hp(S, 'Runa'), hp(S, 'Borin')], [90, 56]);
      assert(await page.$eval('[data-test=mark]', m => m.classList.contains('tsi-arn-mark--pulse')), 'pulse');
      equal((await layers(page)).boss, 'lions_mark_fail.png');
      assert((await sounds(page)).includes('lions_mark_fail_1.mp3'));
    });

    await check('the announcement clears after 5 seconds and the pulse after 5; the Mark stays', async () => {
      await passTime(page, 5300);
      assert(!(await page.isVisible('[data-test=announce]')), 'announcement');
      assert(!(await page.$eval('[data-test=mark]', m => m.classList.contains('tsi-arn-mark--pulse'))), 'pulse');
      assert(await page.isVisible('[data-test=mark]'));
    });

    await check('the Mark moves on only after everyone has had a turn, to someone new', async () => {
      await dice(page, [0.5]);
      await turn(page, {});
      await turn(page, {});
      equal((await st(page)).mmR3LastMarkedId !== null, true);
      await gap(page);
      await page.click('[data-test=play-turn]');
      const S = await st(page);
      const marked = S.players.filter(p => p.id === S.mmR3MarkPlayerId)[0].name;
      assert(marked !== 'Borin', 'marked again: ' + marked);
      equal(await text(page, 'mark-name'), marked);
      await page.click('[data-test=t-cancel]');
    });

    await check('Forfeit asks first; the defeat names the Salt-Ring Trials even here, as before (A8: kept)', async () => {
      await page.click('[data-test=forfeit]');
      assert(/Forfeit this round\?/.test(await H.modalText(page)));
      await H.clickModal(page, 'Cancel');
      equal(await dockKind(page), null);
      await page.click('[data-test=forfeit]');
      await H.clickModal(page, 'Forfeit');
      equal([await text(page, 'dock-title'), await text(page, 'dock-sub')], ['Defeat', 'The Salt-Ring Trials end here.']);
      equal(await page.$$eval('[data-test=dock-actions] button', b => b.map(x => x.textContent)), ['Leave Arena']);
      equal((await st(page)).totalGold, 8000);
    });

    await check('Leave Arena ends the run and stops the crowd; the last picture stays, as before (ARN-15: kept)', async () => {
      await page.click('[data-test=leave-arena]');
      equal(await text(page, 'status'), 'Run ended. Enter The Arena to start again.');
      equal(await page.evaluate(() => TSI.arenas.debug.crowd()), { paused: true });
      equal(await page.textContent('[data-test=enemies]'), 'Opponents appear after you Enter The Arena.');
      assert(await page.isVisible('[data-test=mark]'), 'the Mark stays');
    });

    await check('Back to Start asks, then restores HP, clears the gold and goes back to Round 1', async () => {
      await page.click('[data-test=back-to-start]');
      assert(/restore party HP, clear all gold earned/.test(await H.modalText(page)));
      await H.clickModal(page, 'Back to Start');
      const S = await st(page);
      equal([S.totalGold, S.roundId, S.players.map(p => p.hp)], [0, 'mm_r1', [90, 80, 70]]);
      equal(await page.inputValue('[data-test=round]'), 'mm_r1');
      equal(await text(page, 'status'), 'Fresh start. Enter The Arena to begin.');
      equal(await layers(page), { base: 'middlemount_lions_crown.png', boss: null, boss2: null });
      assert(!(await page.isVisible('[data-test=mark]')));
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Overtime, defeat and the Wyvern Rite');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openArenas(page);
    await addPlayer(page, 'Runa', 200);
    await addPlayer(page, 'Borin', 200);
    await enter(page, SWYTH, 'r5');

    await check('after the tempo limit, the turn panel warns of OVERTIME and resolving adds the extra failure and damage (A9: kept)', async () => {
      for (let i = 0; i < 8; i++) {
        await gap(page);
        await page.click('[data-test=play-turn]');
        await page.click('[data-test=t-cancel]');
      }
      /* The dice: the skill roll (19), who is battered (Borin), then 2d8 (8 and 5). */
      await dice(page, [0.9, 0.5]);
      await turn(page, { resolve: false });
      assert((await text(page, 'dock-body')).includes('OVERTIME'));
      await page.click('[data-test=t-resolve]');
      const S = await st(page);
      equal([S.turn, S.successes, S.failures], [9, 1, 1]);
      const log = (await text(page, 'console')).trim().split('\n').slice(-2).map(l => l.replace(/^\[\d\d:\d\d\] /, ''));
      equal(log, ['OVERTIME: crowd turns. +1 failure(s).', 'OVERTIME: Borin is battered by the tempo: -13 HP (2d8).']);
      equal(hp(S, 'Borin'), 187);
    });

    await check('a second failure loses the Wyvern Rite: Defeat, no prize, and no Proceed', async () => {
      await dice(page, [0.5]);
      await turn(page, { skill: -30 });
      equal([await text(page, 'dock-title'), await text(page, 'dock-sub')], ['Defeat', 'The Salt-Ring Trials end here.']);
      equal((await st(page)).totalGold, 0);
      equal(await page.$$eval('[data-test=play-turn], [data-test=end-round], [data-test=forfeit]', b => b.map(x => x.disabled)), [true, true, true]);
      equal((await layers(page)).boss, 'wyvern_tail_strike.png');
    });

    await check('a finished round leaves without asking', async () => {
      await Promise.all([page.waitForURL(/index\.html$/), page.click('[data-test=home]')]);
      await openArenas(page);
    });

    await check('End Round with opponents left asks, and Count as Loss is a defeat', async () => {
      await page.evaluate(() => window.__seed(6));
      await enter(page, SWYTH, 'r1');
      await page.click('[data-test=end-round]');
      equal(await text(page, 'dock-sub'), 'There are still 2 opponent(s) with HP remaining. End anyway?');
      await page.click('[data-test=end-cancel]');
      equal(await dockKind(page), null);
      await page.click('[data-test=end-round]');
      await page.click('[data-test=count-loss]');
      equal(await text(page, 'dock-title'), 'Defeat');
    });

    await check('Reset Run asks, then clears the round and its opponents', async () => {
      await enter(page, SWYTH, 'r1');
      await turn(page, {});
      await page.click('[data-test=reset-run]');
      assert(/Reset current run/.test(await H.modalText(page)));
      await H.clickModal(page, 'Reset');
      const S = await st(page);
      equal([S.runActive, S.turn, S.successes, S.enemies.length], [false, 0, 0, 0]);
      equal(await text(page, 'status'), 'Run reset. Enter The Arena to start again.');
      equal(await layers(page), { base: 'swyth_base_rounds_1_2.png', boss: null, boss2: null });
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Leaving and shutting down');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openArenas(page);
    await addPlayer(page, 'Runa', 90);

    await check('with no round running it leaves without asking; mid-round it asks first', async () => {
      await Promise.all([page.waitForURL(/index\.html$/), page.click('[data-test=home]')]);
      await openArenas(page);
      await enter(page, SWYTH, 'r1');
      await page.click('[data-test=home]');
      assert(/This will end the arena round in progress\./.test(await H.modalText(page)));
      equal(await page.textContent('.tsi-modal__title'), 'Leave the Arenas of The Scarlett Isles?');
      await H.clickModal(page, 'Stay');
      equal(await page.evaluate(() => location.search), '?tool=arenas');
    });

    await check('closing it mid-round stops every timer, sound and listener, the crowd included', async () => {
      await turn(page, { attack: 30, resolve: false });
      await page.evaluate(() => TSI.shell.stopTool());
      equal(await page.evaluate(() => TSI.shell.current().life.counts()), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
      equal(await page.evaluate(() => window.__media.every(m => m.paused)), true);
      equal(await page.evaluate(() => TSI.arenas.debug), null);
    });
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, 'laptop', { reducedMotion: 'reduce' });
    await openArenas(page);
    await check('with "reduce motion" on, the Lion\'s Mark pulses more slowly', async () => {
      const d = await page.evaluate(() => {
        document.querySelector('[data-test=mark]').classList.add('tsi-arn-mark--pulse');
        return [getComputedStyle(document.querySelector('.tsi-arn-mark-icon')).animationDuration, getComputedStyle(document.querySelector('.tsi-arn-announce-icon')).animationDuration];
      });
      equal(d, ['2.25s', '3s']);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Faithful to the old tool' + (HAS_LEGACY ? '' : ' (skipped: _legacy/arenas-of-the-scarlett-isles is missing)'));
  if (HAS_LEGACY) {
    const srv = await serve(LEGACY_DIR);
    const OLD = 'http://127.0.0.1:' + srv.address().port + '/index.html';
    const oldCtx = await H.newContext(browser, 'tv');
    await oldCtx.addInitScript(setup);
    await oldCtx.route(/googleapis|gstatic/, r => r.abort());
    const old = await oldCtx.newPage();
    old.on('dialog', d => d.accept());
    const T0 = new Date('2026-09-26T19:00:00');
    const { context, page } = await newPage(browser, 'tv', undefined, { time: T0 });
    await old.clock.install({ time: T0 });

    /* What each screen shows, in the same shape. Log times are left out
       (the old tool wrote them in the browser's style, the suite in 24-hour). */
    const oldView = () => old.evaluate(() => {
      const q = s => document.querySelector(s);
      const vis = s => !!q(s) && !q(s).classList.contains('hidden');
      const layer = s => (vis(s) && q(s).getAttribute('src')) ? q(s).getAttribute('src').split('/').pop() : null;
      const name = id => (state.players.find(p => p.id === id) || {}).name || null;
      const r4 = state.r4Dead || { boar: false, hyena1: false, hyena2: false };
      return {
        state: {
          arena: state.arenaId, round: state.roundId, run: state.runActive, turn: state.turn, turnIndex: state.turnIndex,
          successes: state.successes, failures: state.failures, gold: state.totalGold,
          players: state.players.map(p => p.name + ' ' + p.hp + '/' + p.maxHp + (p._beastBonusUsed ? ' beast' : '')),
          enemies: state.enemies.map(e => e.name + ' ' + e.hp + '/' + e.maxHp),
          r1: state.r1FirstDefeated || null, r4: [!!r4.boar, !!r4.hyena1, !!r4.hyena2], totems: state.mmR2TotemsDown || 0,
          mark: name(state.mmR3MarkPlayerId), lastMark: name(state.mmR3LastMarkedId)
        },
        selects: [q('#arenaSelect').value, q('#roundSelect').value],
        status: q('#statusPill').textContent,
        stats: ['#goldTotal', '#succCount', '#succTarget', '#failCount', '#failMax', '#turnCount'].map(s => q(s).textContent),
        dock: vis('#turnDock') ? [q('#dockTitle').textContent, q('#dockSub').textContent, Array.from(document.querySelectorAll('#dockActions button')).map(b => b.textContent)] : null,
        player: q('#t_player') ? (state.players.find(p => p.id === q('#t_player').value) || {}).name : null,
        targets: q('#t_target') ? Array.from(q('#t_target').options).map(o => o.textContent) : null,
        skillOut: q('#t_skillOut') ? q('#t_skillOut').textContent.trim() : null,
        atkOut: q('#t_atkOut') ? q('#t_atkOut').textContent.replace(/\s+/g, ' ').trim() : null,
        layers: [layer('#sceneBase'), layer('#sceneBoss'), layer('#sceneBoss2')],
        hud: vis('#lionsMarkHud') ? q('#lionsMarkHudName').textContent : null,
        announce: vis('#lionsMarkAnnounce') ? q('#lionsMarkAnnounceText').textContent : null,
        pulse: q('#lionsMarkHud').classList.contains('pulse'),
        log: q('#console').textContent.split('\n').filter(Boolean).map(l => l.replace(/^\[[^\]]*\] /, '')),
        sounds: window.__sounds.splice(0)
      };
    });
    const newView = () => page.evaluate(() => {
      const S = TSI.arenas.debug.state();
      const L = TSI.arenas.debug.layers();
      const t = x => document.querySelector('[data-test=' + x + ']');
      const name = id => (S.players.find(p => p.id === id) || {}).name || null;
      const r4 = S.r4Dead;
      return {
        state: {
          arena: S.arenaId, round: S.roundId, run: S.runActive, turn: S.turn, turnIndex: S.turnIndex,
          successes: S.successes, failures: S.failures, gold: S.totalGold,
          players: S.players.map(p => p.name + ' ' + p.hp + '/' + p.maxHp + (p._beastBonusUsed ? ' beast' : '')),
          enemies: S.enemies.map(e => e.name + ' ' + e.hp + '/' + e.maxHp),
          r1: S.r1FirstDefeated || null, r4: [!!r4.boar, !!r4.hyena1, !!r4.hyena2], totems: S.mmR2TotemsDown || 0,
          mark: name(S.mmR3MarkPlayerId), lastMark: name(S.mmR3LastMarkedId)
        },
        selects: [t('arena').value, t('round').value],
        status: t('status').textContent,
        stats: ['gold', 'successes', 'success-target', 'failures', 'failure-max', 'turn'].map(x => t(x).textContent),
        dock: t('dock').hidden ? null : [t('dock-title').textContent, t('dock-sub').textContent, Array.from(t('dock-actions').querySelectorAll('button')).map(b => b.textContent)],
        player: t('t-player') ? t('t-player').querySelector('strong').textContent : null,
        targets: t('t-target') ? Array.from(t('t-target').options).map(o => o.textContent) : null,
        skillOut: t('t-skill-out') ? t('t-skill-out').textContent.trim() : null,
        atkOut: t('t-atk-out') ? t('t-atk-out').textContent.replace(/\s+/g, ' ').trim() : null,
        layers: [L.base, L.boss, L.boss2],
        hud: t('mark').hidden ? null : t('mark-name').textContent,
        announce: t('announce').hidden ? null : t('announce-text').textContent,
        pulse: t('mark').classList.contains('tsi-arn-mark--pulse'),
        log: t('console').textContent.split('\n').filter(Boolean).map(l => l.replace(/^\[[^\]]*\] /, '')),
        sounds: window.__sounds.splice(0)
      };
    });

    const OLDS = {
      arena: '#arenaSelect', round: '#roundSelect', enter: '#enterArenaBtn', playTurn: '#playTurnBtn', endRound: '#endRoundBtn',
      action: '#t_action', dc: '#t_dc', skillMod: '#t_skillMod', atkMod: '#t_atkMod', dmg: '#t_dmg', target: '#t_target',
      skillRoll: '#t_skillRoll', atkRoll: '#t_atkRoll', apply: '#t_applyDmg',
      resolve: '#dockActions button:text-is("Resolve Turn")', cancel: '#dockActions button:text-is("Cancel")',
      begin: '#dockActions button:text-is("Begin Round")', proceed: '#dockActions button:text-is("Proceed to Next Round")',
      leave: '#dockActions button:text-is("Leave Arena")', countWin: '#dockActions button:text-is("Count as Win")'
    };
    const NEWS = {
      arena: '[data-test=arena]', round: '[data-test=round]', enter: '[data-test=enter]', playTurn: '[data-test=play-turn]', endRound: '[data-test=end-round]',
      action: '[data-test=t-action]', dc: '[data-test=t-dc]', skillMod: '[data-test=t-skill-mod]', atkMod: '[data-test=t-atk-mod]', dmg: '[data-test=t-dmg]', target: '[data-test=t-target]',
      skillRoll: '[data-test=t-skill-roll]', atkRoll: '[data-test=t-atk-roll]', apply: '[data-test=t-apply]',
      resolve: '[data-test=t-resolve]', cancel: '[data-test=t-cancel]', begin: '[data-test=begin-round]', proceed: '[data-test=proceed]',
      leave: '[data-test=leave-arena]', countWin: '[data-test=count-win]'
    };

    /* Do the same thing in both, then let the same time pass in both. */
    let steps = 0;
    const diffs = [];
    async function both(fn, label) {
      await fn(old, OLDS);
      await fn(page, NEWS);
      await old.clock.runFor(400);
      await page.clock.runFor(400);
      const a = await oldView();
      const b = await newView();
      steps++;
      for (const k of Object.keys(a)) {
        if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffs.push(label + ' › ' + k + ': old ' + JSON.stringify(a[k]) + ' / new ' + JSON.stringify(b[k]));
      }
      return b;
    }
    const click = sel => (p, S) => p.click(S[sel]);

    await check('the old tool and the rebuild start the same', async () => {
      await old.goto(OLD);
      await old.waitForFunction(() => document.querySelectorAll('#roundSelect option').length > 0);
      await openArenas(page);
      await old.clock.pauseAt(new Date(T0.getTime() + 60000));
      await page.clock.pauseAt(new Date(T0.getTime() + 60000));
      await old.evaluate(() => window.__seed(20260926));
      await page.evaluate(() => window.__seed(20260926));
      await both(async () => {}, 'start');
      equal(diffs, []);
    });

    await check('adding the same party gives the same party', async () => {
      for (const [n, h] of [['Runa', 90], ['Borin', 80], ['Cael', 70]]) {
        await both(async (p, S) => {
          await p.click(S === OLDS ? '#addPlayerBtn' : '[data-test=add-player]');
          await p.fill(S === OLDS ? '#addPlayerForm [name=name]' : '[data-test=ap-name]', n);
          await p.fill(S === OLDS ? '#addPlayerForm [name=maxHp]' : '[data-test=ap-hp]', String(h));
          await p.click(S === OLDS ? '#addPlayerForm button[type=submit]' : '[data-test=ap-add]');
          await p.waitForFunction(() => !document.querySelector('#addPlayerForm, [data-test=ap-name]'));
        }, 'add ' + n);
      }
      equal(diffs, []);
    });

    /* A turn's settings, varied from turn to turn. */
    async function playTurn(k, label) {
      await both(click('playTurn'), label + ' play');
      if (await dockKind(page) !== 'turn') return;
      await both(async (p, S) => {
        const n = await p.$$eval(S.action + ' option', o => o.length);
        await p.selectOption(S.action, { index: k % n });
        await p.selectOption(S.dc, ['standard', 'easy', 'hard'][k % 3]);
        const t = await p.$$eval(S.target + ' option', o => o.length);
        await p.selectOption(S.target, { index: (k * 7) % t });
        await p.fill(S.skillMod, String([4, 7, 2, 9, 0, 5][k % 6]));
        await p.fill(S.atkMod, String([3, 6, 1, 8][k % 4]));
        if (k % 4 === 3) await p.fill(S.dmg, '30');
      }, label + ' settings');
      await both(click('skillRoll'), label + ' skill');
      const b = await both(click('atkRoll'), label + ' attack');
      if (/\(Hit\)/.test(b.atkOut) && k % 5 !== 4) await both(click('apply'), label + ' apply');
      await both(click('resolve'), label + ' resolve');
    }
    /* Play a round until it ends (or 18 turns), then move on the same way in both. */
    let k = 0;
    async function playRound(label) {
      for (let i = 0; i < 18 && (await dockKind(page)) !== 'end'; i++) {
        await playTurn(k++, label + ' turn ' + (i + 1));
        if ((await dockKind(page)) === null && (await text(page, 'status')) === 'Opponents defeated. Round can end now.') {
          await both(click('endRound'), label + ' end round');
          await both(click('countWin'), label + ' count as win');
        }
      }
      return (await text(page, 'dock-title'));
    }

    for (const [arenaId, rounds] of [[SWYTH, ['r1', 'r4', 'r5']], [MM, ['mm_r1', 'mm_r2', 'mm_r3']]]) {
      await check('the same dice give the same game in ' + (arenaId === SWYTH ? 'Swyth' : 'Middlemount') + ', round by round and step by step', async () => {
        if ((await page.inputValue('[data-test=arena]')) !== arenaId) await both((p, S) => p.selectOption(S.arena, arenaId), 'arena ' + arenaId);
        let proceeded = false;
        for (const roundId of rounds) {
          if (!proceeded) {
            if ((await page.inputValue('[data-test=round]')) !== roundId) await both((p, S) => p.selectOption(S.round, roundId), 'round ' + roundId);
            await both(click('enter'), roundId + ' enter');
          }
          await both(click('begin'), roundId + ' begin');
          const result = await playRound(roundId);
          if (result === 'Round Cleared' && roundId !== rounds[rounds.length - 1]) {
            await both(click('proceed'), roundId + ' proceed');
            proceeded = true;
          } else {
            if ((await dockKind(page)) === 'end') await both(click('leave'), roundId + ' leave');
            proceeded = false;
          }
        }
        equal(diffs.slice(0, 8), []);
      });
    }
    await check('the comparison covered wins, losses and every round (' + steps + ' steps compared)', async () => {
      assert(steps > 150, 'only ' + steps + ' steps');
      const logs = await text(page, 'console');
      for (const r of ['Round 1 — Arena Duelists', 'Round 2 — The Beast-Pen', 'Round 3 — Wyvern Rite (Finale)', 'Round 1 — Arena Duelists (Opening Bout)', 'Round 2 — The Lion Totems', 'Round 3 — The Lion’s Mark']) {
        assert(logs.includes('--- ' + r + ' begins ---'), r + ' was not played');
      }
      assert(/failed: /.test(logs) && /succeeded: /.test(logs) && /Attack damage to/.test(logs), 'successes, failures and damage all happened');
    });
    await H.shot(page, 'arenas-compare-new');
    await old.screenshot({ path: path.join(H.SHOTS, 'arenas-compare-old.png') });
    await oldCtx.close();
    await context.close();
    srv.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
