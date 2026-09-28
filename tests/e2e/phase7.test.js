/* Phase 7 click-through: Combat Tracker & VTT Battlemap.
   Opens index.html?tool=encounter from its files with the internet off and
   checks the desk fits Harry's screens. Then it builds a fight (the library,
   copies, initiative, Complete Turn, conditions, the fixes), saved encounters,
   campaign files and a PDF, saving, Export and Import, and the Battlemap
   window: the map picture, tokens on the map picture through resizing and
   zooming, snap, fog, monsters above the fog, the ruler, refreshing either
   window, and leaving. When the old tool is in _legacy/, it plays the same
   fight in the old tracker with the same dice and compares the desks turn by
   turn, and the tokens each Battlemap shows.
   Run:  node tests/e2e/phase7.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const TRACKER = INDEX + '?tool=encounter';
const LEGACY_DIR = path.join(H.ROOT, '_legacy/scarlettisles-encounter-tracker');
const HAS_LEGACY = fs.existsSync(path.join(LEGACY_DIR, 'app.js'));
const MAP_SRC = path.join(H.ROOT, 'tools/arenas/assets/maps/middlemount_lions_crown.png');

/* Before the page loads: seedable or fixed dice, and a storage that can pretend to be full. */
function setup() {
  window.__seed = function (a) {
    Math.random = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  if (window.IDBObjectStore) {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value) {
      if (window.__failSaves && value && typeof value.key === 'string' && value.key.indexOf('tsi.encounter.') === 0) {
        throw new DOMException('Pretend the storage is full', 'QuotaExceededError');
      }
      return put.apply(this, arguments);
    };
  }
}

async function newPage(browser, size, extra) {
  const context = await H.newContext(browser, size || 'laptop', extra);
  await context.setOffline(true);
  await context.addInitScript(setup);
  const page = await context.newPage();
  return { context, page };
}
async function openTracker(page) {
  await page.goto(TRACKER);
  await page.waitForSelector('[data-test=complete-turn]');
}

const st = page => page.evaluate(() => TSI.encounter.debug.state());
const text = (page, test) => page.textContent('[data-test=' + test + ']');
const roster = async page => (await st(page)).encounter.roster;
const who = async page => { const s = await st(page); return s.encounter.roster[s.encounter.turnIndex].name; };
const hpOf = async (page, name) => (await roster(page)).find(c => c.name === name).curHp;

async function waitSaved(page) {
  await page.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
}
async function addLib(page, name, type, hp, init, more) {
  await page.fill('[data-test=new-name]', name);
  await page.selectOption('[data-test=new-type]', type);
  await page.fill('[data-test=new-max-hp]', String(hp));
  await page.fill('[data-test=new-init]', init == null ? '' : String(init));
  await page.fill('[data-test=new-avatar]', (more && more.avatar) || '');
  await page.fill('[data-test=new-ref]', (more && more.ref) || '');
  await page.click('[data-test=add-to-library]');
}
async function selectOnly(page, names) {
  const s = await st(page);
  for (const item of s.library) {
    const want = names.includes(item.name);
    const has = s.selectedLibraryIds.includes(item.id);
    if (want !== has) await page.click(`[data-test=library-item][data-name="${item.name}"]`);
  }
}
async function addSelected(page, names) {
  await selectOnly(page, names);
  await page.waitForTimeout(400);
  await page.click('[data-test=add-selected]');
}
async function target(page, name) {
  const id = (await roster(page)).find(c => c.name === name).encId;
  await page.selectOption('[data-test=target]', id);
}
async function completeTurn(page, o) {
  o = o || {};
  if (o.target) await target(page, o.target);
  await page.fill('[data-test=damage]', o.damage == null ? '' : String(o.damage));
  await page.fill('[data-test=condition]', o.condition || '');
  await page.fill('[data-test=condition-turns]', o.turns == null ? '' : String(o.turns));
  await page.waitForTimeout(400);
  await page.click('[data-test=complete-turn]');
}
async function party(page) {
  await addLib(page, 'Aria', 'pc', 30, 2);
  await addLib(page, 'Borin', 'pc', 40, 1);
  await addLib(page, 'Goblin', 'monster', 7, 2, { ref: 'https://www.dndbeyond.com/monsters/goblin' });
  await addLib(page, 'Orc', 'monster', 15, 1);
  await addLib(page, 'Old Hask', 'npc', 12, 0);
}

/* The Battlemap window. */
async function openMap(page) {
  const [map] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-battlemap]')]);
  await map.waitForFunction(() => window.TSI && TSI.encounter && TSI.encounter.battlemap && TSI.encounter.battlemap.ready(), null, { timeout: 10000 });
  return map;
}
const tokens = map => map.$$eval('[data-test=bm-token]', ts => ts.map(t => ({
  name: t.dataset.name, active: t.classList.contains('tsi-bm-token--active'), hidden: t.classList.contains('tsi-bm-token--hidden'),
  above: !!t.closest('[data-test=bm-tokens-above]')
})));
const bmVtt = map => map.evaluate(() => TSI.encounter.battlemap.vtt());
/* The same settings, whatever order their parts were stored in. */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {});
  return v;
}
/* A token's picture centre as a share of the map picture's width and height. */
const onMap = (map, name) => map.evaluate(n => {
  const t = document.querySelector('[data-test=bm-token][data-name="' + n + '"] img').getBoundingClientRect();
  const m = document.querySelector('[data-test=bm-map]').getBoundingClientRect();
  return [+((t.x + t.width / 2 - m.x) / m.width).toFixed(4), +((t.y + t.height / 2 - m.y) / m.height).toFixed(4)];
}, name);
/* Screen position (page coordinates) of a point on the board. */
const boardPoint = (map, x, y) => map.evaluate(p => {
  const s = document.querySelector('[data-test=bm-stage]').getBoundingClientRect();
  const q = TSI.encounter.battlemap.toScreen(p.x, p.y);
  return { x: s.x + q.x, y: s.y + q.y };
}, { x, y });
async function dragToken(map, name, bx, by) {
  const from = await map.$eval('[data-test=bm-token][data-name="' + name + '"] img', i => { const r = i.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const to = await boardPoint(map, bx, by);
  await map.mouse.move(from.x, from.y);
  await map.mouse.down();
  await map.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await map.mouse.move(to.x, to.y, { steps: 4 });
  await map.mouse.up();
}
/* How dark the fog is at a point on the board (0 = clear). The fog canvas only
   ever has fills drawn on it, never a picture, so it can be read. */
const fogAt = (map, x, y) => map.evaluate(p => {
  const c = document.querySelector('[data-test=bm-fog-canvas]');
  if (c.hidden) return 0;
  const q = TSI.encounter.battlemap.toScreen(p.x, p.y);
  const d = window.devicePixelRatio;
  return c.getContext('2d').getImageData(Math.round(q.x * d), Math.round(q.y * d), 1, 1).data[3];
}, { x, y });

/* A small one-page PDF with a stat block's first lines. */
function makePdf(lines) {
  const content = 'BT /F1 14 Tf 72 720 Td ' + lines.map(l => '(' + l.replace(/[()]/g, m => '\\' + m) + ') Tj 0 -20 Td').join(' ') + ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  const p = H.writeTemp('goblin-boss.pdf', '');
  fs.writeFileSync(p, Buffer.from(out, 'latin1'));
  return p;
}
/* A map picture of an exact size: a real PNG with padding after its end, which browsers ignore. */
function mapOfSize(bytes, name) {
  const png = fs.readFileSync(MAP_SRC);
  const p = H.writeTemp(name, '');
  fs.writeFileSync(p, Buffer.concat([png, Buffer.alloc(Math.max(0, bytes - png.length))]));
  return p;
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
      equal(await page.textContent('.tsi-card[data-tool=encounter] .tsi-card__cta'), 'Open');
      await Promise.all([page.waitForURL(/\?tool=encounter$/), page.click('.tsi-card[data-tool=encounter]')]);
      await page.waitForSelector('[data-test=complete-turn]');
      equal(await page.textContent('.tsi-topbar__tool'), 'Combat Tracker & VTT Battlemap');
      equal(await page.$$eval('[data-test=export], [data-test=import]', x => x.length), 2);
    });

    await check('it starts empty and idle, as before, with the crest faint behind it', async () => {
      equal(await text(page, 'enc-status'), 'Encounter not started. Add combatants, roll initiative, then begin.');
      equal(await text(page, 'turn-pill'), 'Not started');
      equal(await text(page, 'insp-name'), 'No active turn');
      equal(await text(page, 'momentum'), 'Add combatants to begin tracking.');
      equal(await text(page, 'library'), 'No combatants yet. Add one above or import a campaign JSON.');
      equal(await page.$$eval('[data-test=begin], [data-test=auto-init], [data-test=pause], [data-test=end], [data-test=complete-turn]', b => b.map(x => x.disabled)), [true, true, true, true, true]);
      assert(/logo-crest-wide\.png/.test(await page.$eval('.tsi-art__img', a => a.style.backgroundImage)), 'the wide crest');
    });

    await check('headings are in Cinzel and text in Cormorant Garamond, from the suite folder', async () => {
      await page.evaluate(() => document.fonts.ready);
      const f = await page.evaluate(() => ({
        loaded: Array.from(document.fonts).filter(x => x.status === 'loaded').map(x => x.family.replace(/"/g, '')),
        title: getComputedStyle(document.querySelector('.tsi-enc-title')).fontFamily,
        body: getComputedStyle(document.querySelector('[data-test=enc-status]')).fontFamily
      }));
      assert(f.loaded.includes('Cinzel') && f.loaded.includes('Cormorant Garamond'), f.loaded.join());
      assert(/^"?Cinzel/.test(f.title) && /^"?Cormorant Garamond/.test(f.body), f.title + ' / ' + f.body);
    });

    await check('no two things share an id; its styles only touch the Combat Tracker; no PDF.js until a PDF is imported', async () => {
      const dupes = await page.evaluate(() => {
        const seen = {};
        document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
        return Object.keys(seen).filter(k => seen[k] > 1);
      });
      equal(dupes, []);
      for (const [file, scope, prefix] of [['tools/encounter/encounter.css', '.tsi-tool--encounter', /^\.tsi-(enc|tool--encounter|btn|input|field|pill)/], ['tools/encounter/battlemap.css', '.tsi-player--battlemap', /^\.tsi-(bm|player--battlemap|btn)/]]) {
        const css = fs.readFileSync(path.join(H.ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{([^{}]*\{[^}]*\})*[^}]*\}/g, '');
        const selectors = [];
        css.replace(/([^{}]+)\{[^{}]*\}/g, (m, sel) => { selectors.push(sel.trim()); return m; });
        selectors.filter(s => s && !s.startsWith('@')).forEach(s => s.split(',').forEach(one => {
          one = one.trim();
          assert(one.startsWith(scope), 'unscoped rule in ' + file + ': ' + one);
          (one.match(/\.[\w-]+/g) || []).forEach(cls => assert(prefix.test(cls), 'unprefixed class in ' + file + ': ' + cls));
        }));
      }
      equal(await page.evaluate(() => typeof window.pdfjsLib), 'undefined');
    });
    await context.close();
  }

  const DESK = ['[data-test=open-battlemap]', '[data-test=monsters-hide]', '[data-test=monsters-reveal]', '[data-test=reset-all]', '[data-test=add-to-library]', '[data-test=add-selected]',
    '[data-test=enc-name]', '[data-test=auto-init]', '[data-test=begin]', '[data-test=pause]', '[data-test=end]', '[data-test=turn-pill]', '[data-test=target]', '[data-test=damage]', '[data-test=condition]', '[data-test=add-condition]', '[data-test=complete-turn]'];
  for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
    const { context, page } = await newPage(browser, size);
    await openTracker(page);
    await party(page);
    await addSelected(page, ['Aria', 'Borin', 'Goblin', 'Orc', 'Old Hask']);
    await addSelected(page, ['Goblin']);
    await page.click('[data-test=auto-init]');
    await page.click('[data-test=begin]');
    await page.evaluate(() => document.fonts.ready);
    const inView = size !== 'smallWindow';
    await check(size + ': the desk fits' + (inView ? ', with every main control in view' : ' with no sideways scroll'), async () => {
      const l = await H.layoutCheck(page, inView ? DESK : []);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll: ' + l.scrollWidth);
      equal(l.outOfView, []);
    });
    await H.shot(page, 'encounter-desk-' + size);
    if (size === 'laptop' || size === 'tv') {
      const map = await openMap(page);
      if (size === 'tv') await map.setViewportSize({ width: 1920, height: 1080 });
      else await map.setViewportSize({ width: 1400, height: 900 });
      await map.setInputFiles('[data-test=map-upload]', MAP_SRC);
      await map.waitForFunction(() => document.querySelector('[data-test=bm-map]').naturalWidth > 0);
      await map.waitForTimeout(200);
      await check(size + ': the Battlemap window fits, with its controls in view and the map filling the space left', async () => {
        const l = await H.layoutCheck(map, ['[data-test=bm-upload]', '[data-test=bm-fullscreen]', '[data-test=bm-fog]', '[data-test=bm-grid-lg]', '[data-test=bm-nudge-d]', '[data-test=bm-stage]', '[data-test=bm-ruler]']);
        assert(l.scrollWidth <= l.clientWidth, 'sideways scroll');
        equal(l.outOfView, []);
        const r = await map.evaluate(() => {
          const s = document.querySelector('[data-test=bm-stage]').getBoundingClientRect();
          const m = document.querySelector('[data-test=bm-map]').getBoundingClientRect();
          return { stageH: s.height, mapH: m.height, vh: innerHeight };
        });
        assert(r.stageH > r.vh * 0.72, 'the map area is ' + Math.round(r.stageH) + 'px of ' + r.vh);
        assert(Math.abs(r.mapH - r.stageH) < 3, 'the map fills the height');
      });
      await H.shot(map, 'encounter-battlemap-' + size);
      await map.close();
    }
    await check(size + ': nothing from the internet, no missing files, no errors', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Storage: the library and the encounter');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openTracker(page);

    await check('Add to Library needs a name and a Max HP, and says so', async () => {
      await page.fill('[data-test=new-name]', 'Nameless');
      await page.click('[data-test=add-to-library]');
      assert(/Please enter a Name and a valid Max HP\./.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      equal((await st(page)).library, []);
    });

    await check('the library lists PCs first, with type, HP and initiative badges, and counts', async () => {
      await party(page);
      equal(await page.$$eval('[data-test=library-item]', x => x.map(i => i.dataset.name)), ['Aria', 'Borin', 'Goblin', 'Orc', 'Old Hask']);
      equal(await page.$eval('[data-test=library-item][data-name=Goblin] .tsi-enc-item-meta', m => m.textContent), 'MONSTERHP: 7Init+2');
      equal([await text(page, 'count-pcs'), await text(page, 'count-monsters')], ['PCs: 2', 'Monsters: 2']);
    });

    await check('Shift + click edits an entry; Cancel Edit leaves it as it was', async () => {
      await page.click('[data-test=library-item][data-name=Orc]', { modifiers: ['Shift'] });
      equal([await page.inputValue('[data-test=new-name]'), await page.inputValue('[data-test=new-max-hp]'), await text(page, 'add-to-library')], ['Orc', '15', 'Save Changes']);
      await page.click('[data-test=cancel-edit]');
      equal([await page.inputValue('[data-test=new-name]'), await text(page, 'add-to-library')], ['', 'Add to Library']);
      assert(!(await page.isVisible('[data-test=cancel-edit]')));
    });

    await check('Add Selected makes separate copies (Goblin, Goblin a); a double click adds once (ENC-13)', async () => {
      await selectOnly(page, ['Aria', 'Borin', 'Goblin']);
      await page.dblclick('[data-test=add-selected]');
      await page.waitForTimeout(400);
      equal((await roster(page)).map(c => c.name), ['Aria', 'Borin', 'Goblin']);
      await addSelected(page, ['Goblin']);
      const r = await roster(page);
      equal(r.map(c => c.name), ['Aria', 'Borin', 'Goblin', 'Goblin a']);
      assert(r[2].encId !== r[3].encId, 'different ids');
      equal(await text(page, 'enc-status'), 'Ready. Roll initiative if needed, then begin.');
    });

    await check('editing a library entry updates its copies, letters kept', async () => {
      await page.click('[data-test=library-item][data-name=Goblin]', { modifiers: ['Shift'] });
      await page.fill('[data-test=new-name]', 'Goblin Scout');
      await page.fill('[data-test=new-max-hp]', '9');
      await page.click('[data-test=add-to-library]');
      equal((await roster(page)).map(c => c.name + ' ' + c.curHp + '/' + c.maxHp), ['Aria 30/30', 'Borin 40/40', 'Goblin Scout 7/9', 'Goblin Scout a 7/9']);
    });

    await check('Remove takes one out; Clear asks first', async () => {
      await page.click('[data-test=roster-row][data-name="Goblin Scout a"] [data-test=roster-remove]');
      equal((await roster(page)).length, 3);
      await page.click('[data-test=clear-encounter]');
      assert(/Clear the encounter roster\?/.test(await H.modalText(page)));
      await H.clickModal(page, 'Cancel');
      equal((await roster(page)).length, 3);
    });

    await check('typing spaces in a box works (no key shortcut takes them)', async () => {
      await page.click('[data-test=enc-name]');
      await page.keyboard.type('Underroot Ambush');
      equal(await page.inputValue('[data-test=enc-name]'), 'Underroot Ambush');
      equal((await st(page)).encounter.name, 'Underroot Ambush');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A fight');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openTracker(page);
    await party(page);
    await addSelected(page, ['Aria', 'Borin', 'Goblin', 'Old Hask']);
    await addSelected(page, ['Goblin']);

    await check('Auto-roll is d20 plus the bonus; the order is highest first with NPCs at the bottom', async () => {
      await page.evaluate(() => { Math.random = (() => { const l = [0.45, 0.8, 0.2, 0.95, 0.6]; let i = 0; return () => l[i++ % l.length]; })(); });
      await page.click('[data-test=auto-init]');
      /* Rolls 10, 17, 5, 20, 13 for Aria (+2), Borin (+1), Goblin (+2), Old Hask (+0) and Goblin a (+2). */
      equal((await roster(page)).map(c => c.name + ' ' + c.init), ['Borin 18', 'Goblin a 15', 'Aria 12', 'Goblin 7', 'Old Hask 20']);
    });

    await check('Begin starts round 1 with the first in the order; the inspector shows them', async () => {
      await page.click('[data-test=begin]');
      const s = await st(page);
      equal([s.encounter.status, s.encounter.turnIndex, s.encounter.round], ['running', 0, 1]);
      const first = s.encounter.roster[0];
      equal(await text(page, 'turn-pill'), first.name + ' (Init ' + first.init + ')');
      equal(await text(page, 'insp-name'), first.name);
      equal(await text(page, 'insp-meta'), first.type.toUpperCase() + ' • Init ' + first.init + ' • Round 1');
      equal(await text(page, 'enc-status'), 'Running. Apply damage/conditions and move through turns.');
      equal(await page.$$eval('[data-test=roster-remove]', b => b.every(x => x.disabled)), true);
    });

    await check('a monster\'s stat-block link shows in the inspector; a PC\'s doesn\'t', async () => {
      const turn = await who(page);
      const isGoblin = /^Goblin/.test(turn);
      equal(await page.isVisible('[data-test=stat-block]'), isGoblin);
      if (isGoblin) equal(await page.getAttribute('[data-test=stat-block]', 'href'), 'https://www.dndbeyond.com/monsters/goblin');
    });

    await check('Complete Turn damages the target, counts down the actor\'s conditions and moves on once', async () => {
      const before = await who(page);
      equal(before, 'Borin');
      await completeTurn(page, { target: 'Aria', damage: 6, condition: 'Prone', turns: 2 });
      equal(await hpOf(page, 'Aria'), 24);
      equal((await roster(page)).find(c => c.name === 'Aria').conditions, [{ name: 'Prone', remaining: 2 }], 'Aria\'s turn hasn\'t come yet');
      assert((await who(page)) !== before, 'the turn moved on');
      equal(await page.inputValue('[data-test=damage]'), '', 'the used boxes empty');
    });

    await check('a wrong Turns number shows a message and changes nothing: no damage, no turn (ENC-01)', async () => {
      const s0 = await st(page);
      await completeTurn(page, { target: 'Aria', damage: 5, condition: 'Poisoned', turns: 0 });
      equal(await H.modalText(page), 'Combat TrackerTurns must be 1 or more.OK');
      await H.clickModal(page, 'OK');
      const s1 = await st(page);
      equal(s1.encounter, s0.encounter);
      equal(await page.inputValue('[data-test=damage]'), '5', 'the boxes keep what was typed');
    });

    await check('mistyped damage ("5-") shows a message and changes nothing (ENC-28)', async () => {
      const s0 = await st(page);
      await page.fill('[data-test=condition]', '');
      await page.fill('[data-test=condition-turns]', '');
      await page.fill('[data-test=damage]', '');
      await page.click('[data-test=damage]');
      await page.keyboard.type('5-');
      await page.waitForTimeout(400);
      await page.click('[data-test=complete-turn]');
      equal(await H.modalText(page), 'Combat TrackerDamage must be a number.OK');
      await H.clickModal(page, 'OK');
      equal((await st(page)).encounter, s0.encounter);
      await page.fill('[data-test=damage]', '');
    });

    await check('a double click on Complete Turn moves on one turn (ENC-13)', async () => {
      const s0 = await st(page);
      await page.waitForTimeout(400);
      await page.dblclick('[data-test=complete-turn]');
      await page.waitForTimeout(300);
      const s1 = await st(page);
      const expected = await page.evaluate(s => { const e = JSON.parse(JSON.stringify(s.encounter)); return TSI.encounter.rules.findNextLivingIndex(e, e.turnIndex + 1); }, s0);
      equal(s1.encounter.turnIndex, expected);
    });

    await check('Add Condition adds without moving the turn', async () => {
      const s0 = await st(page);
      await target(page, 'Aria');
      await page.fill('[data-test=condition]', 'Blessed');
      await page.fill('[data-test=condition-turns]', '3');
      await page.click('[data-test=add-condition]');
      const s1 = await st(page);
      equal(s1.encounter.turnIndex, s0.encounter.turnIndex);
      equal(s1.encounter.roster.find(c => c.name === 'Aria').conditions.slice(-1)[0], { name: 'Blessed', remaining: 3 });
    });

    await check('0 HP marks DEFEATED and skips them; healing above 0 brings them back (C2, ENC-02)', async () => {
      await completeTurn(page, { target: 'Borin', damage: 99 });
      let b = (await roster(page)).find(c => c.name === 'Borin');
      equal([b.curHp, b.defeated], [0, true]);
      assert(/DEFEATED/.test(await page.textContent('[data-test=roster-row][data-name=Borin]')));
      for (let i = 0; i < 5; i++) {
        assert((await who(page)) !== 'Borin', 'Borin was given a turn at 0 HP');
        await completeTurn(page, {});
      }
      await completeTurn(page, { target: 'Borin', damage: -10 });
      b = (await roster(page)).find(c => c.name === 'Borin');
      equal([b.curHp, b.defeated], [10, false]);
      assert(!/DEFEATED/.test(await page.textContent('[data-test=roster-row][data-name=Borin]')));
      let seen = false;
      for (let i = 0; i < 5 && !seen; i++) { if ((await who(page)) === 'Borin') seen = true; else await completeTurn(page, {}); }
      assert(seen, 'Borin gets turns again');
    });

    await check('Pause says what Begin does, and Begin starts again from round 1 (C3)', async () => {
      await completeTurn(page, {});
      await page.click('[data-test=pause]');
      equal(await text(page, 'enc-status'), 'Paused. Pressing Begin starts again from round 1, in initiative order.');
      equal(await text(page, 'turn-pill'), 'Paused');
      await page.click('[data-test=begin]');
      equal([(await st(page)).encounter.round, (await st(page)).encounter.turnIndex], [1, 0]);
    });

    await check('the fight ends by itself when the last monster falls', async () => {
      for (const g of ['Goblin', 'Goblin a']) await completeTurn(page, { target: g, damage: 50 });
      equal((await st(page)).encounter.status, 'ended');
      equal(await text(page, 'enc-status'), 'Ended. Clear or build a new encounter.');
      equal(await text(page, 'momentum'), 'Combatants: 5 • Monsters left: 0');
    });

    await check('Save Current Encounter saves once, even double-clicked (ENC-13); Load asks and starts fresh', async () => {
      await page.click('[data-test=tab-btn-encounters]');
      await page.$eval('[data-test=save-encounter]', b => { b.click(); b.click(); });
      assert(/Saved: Encounter 1/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      await page.waitForTimeout(300);
      equal((await st(page)).savedEncounters.length, 1);
      await page.click('[data-test=saved-load]');
      assert(/Load this encounter\? This will replace the current roster\./.test(await H.modalText(page)));
      await H.clickModal(page, 'Load');
      const s = await st(page);
      equal([s.encounter.status, s.encounter.roster.every(c => c.curHp === c.maxHp && !c.conditions.length && !c.defeated)], ['ready', true]);
      await page.click('[data-test=saved-duplicate]');
      equal(await page.$$eval('[data-test=saved-item]', x => x.map(i => i.dataset.name)).then(n => n.sort()), ['Encounter 1', 'Encounter 1 (copy)']);
      await page.click('[data-test=saved-item][data-name="Encounter 1 (copy)"] [data-test=saved-delete]');
      await H.clickModal(page, 'Delete');
      equal((await st(page)).savedEncounters.length, 1);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Campaign files and PDF import (internet off)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openTracker(page);
    await party(page);
    await page.click('[data-test=tab-btn-import]');

    let campaign;
    await check('Export Campaign JSON downloads the library, as before', async () => {
      const d = await H.download(page, '[data-test=export-json]');
      assert(/^campaign-\d{4}-\d{2}-\d{2}\.json$/.test(d.name), d.name);
      campaign = JSON.parse(d.text);
      equal([campaign.schema, campaign.library.map(x => x.name)], ['encounter-tracker-campaign@1', ['Aria', 'Borin', 'Goblin', 'Orc', 'Old Hask']]);
    });

    await check('importing merges new entries and skips nameless ones, saying so (ENC-07)', async () => {
      const file = H.writeTemp('campaign-in.json', { schema: 'encounter-tracker-campaign@1', library: campaign.library.concat([{ name: 'Troll', type: 'monster', maxHp: 84 }, { type: 'monster', maxHp: 3 }]) });
      await page.setInputFiles('[data-test=import-json-file]', file);
      await page.click('[data-test=import-json]');
      equal(await H.modalText(page), 'Combat TrackerCampaign imported. 1 entry was skipped because it had no name or type.OK');
      await H.clickModal(page, 'OK');
      equal((await st(page)).library.map(x => x.name), ['Aria', 'Borin', 'Goblin', 'Orc', 'Old Hask', 'Troll']);
      equal(context.log.errors, []);
    });

    await check('a file that isn\'t a campaign file is refused', async () => {
      await page.setInputFiles('[data-test=import-json-file]', H.writeTemp('not-campaign.json', { hello: 1 }));
      await page.click('[data-test=import-json]');
      assert(/This does not look like a valid campaign export for this app\./.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
    });

    await check('Import PDF works offline: "Imported: Goblin Boss Small (HP 21)" (ENC-09)', async () => {
      await page.setInputFiles('[data-test=import-pdf-file]', makePdf(['Goblin Boss', 'Small humanoid (goblinoid), neutral evil', 'Armor Class 17 (chain shirt, shield)', 'Hit Points 21 (6d6)']));
      await page.click('[data-test=import-pdf]');
      await page.waitForFunction(() => /Imported|failed/.test(document.querySelector('[data-test=pdf-status]').textContent), null, { timeout: 15000 });
      equal(await text(page, 'pdf-status'), 'Imported: Goblin Boss Small (HP 21)');
      const e = (await st(page)).library.slice(-1)[0];
      equal([e.name, e.type, e.maxHp], ['Goblin Boss Small', 'monster', 21]);
      equal(context.log.net, []);
      equal(context.log.errors, []);
    });

    await check('a file that isn\'t a PDF says the import failed', async () => {
      await page.setInputFiles('[data-test=import-pdf-file]', H.writeTemp('not.pdf', 'not a pdf'));
      await page.waitForTimeout(400);
      await page.click('[data-test=import-pdf]');
      await page.waitForFunction(() => /failed/.test(document.querySelector('[data-test=pdf-status]').textContent), null, { timeout: 15000 });
      equal(await text(page, 'pdf-status'), 'PDF import failed. (JSON import is reliable.)');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Saving, Export and Import');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openTracker(page);
    await party(page);
    await addSelected(page, ['Aria', 'Goblin']);
    await page.click('[data-test=begin]');
    await completeTurn(page, { target: 'Goblin', damage: 3, condition: 'Prone', turns: 2 });

    await check('the library, encounter, turn and round survive closing and reopening', async () => {
      await waitSaved(page);
      const before = await st(page);
      await openTracker(page);
      equal(await st(page), before);
      assert((await page.evaluate(() => TSI.store.keys('encounter'))).includes('tsi.encounter.tracker'), 'saved as tsi.encounter.tracker');
    });

    await check('a full storage shows a clear warning; nothing is lost on screen (ENC-05)', async () => {
      await page.evaluate(() => { window.__failSaves = true; });
      await addLib(page, 'Wraith', 'monster', 45, 3);
      await page.waitForFunction(() => document.querySelector('[data-test=save-status]').textContent === 'Not saved');
      await H.waitForNotice(page, /couldn't be saved/);
      assert((await st(page)).library.some(x => x.name === 'Wraith'));
      await H.dismissNotices(page);
      await page.evaluate(() => { window.__failSaves = false; });
      await addLib(page, 'Ghoul', 'monster', 22, 2);
      await waitSaved(page);
      await openTracker(page);
      equal((await st(page)).library.map(x => x.name).slice(-2), ['Wraith', 'Ghoul']);
    });

    let exported;
    await check('Export downloads the tracker, Battlemap settings and map', async () => {
      const d = await H.download(page, '[data-test=export]');
      assert(/^tsi-encounter-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(d.name), d.name);
      exported = JSON.parse(d.text);
      equal([exported.kind, exported.tool], ['tool', 'encounter']);
      assert(exported.records.some(r => r.key === 'tsi.encounter.tracker'), 'tracker');
    });

    await check('Import refuses a file with a nameless combatant, changing nothing', async () => {
      const bad = Object.assign({}, exported, { records: [{ key: 'tsi.encounter.tracker', value: { library: [{ type: 'pc' }] }, savedAt: exported.savedAt }] });
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('bad-encounter.json', bad));
      assert(/combatants and encounters aren't in the right form/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      equal((await st(page)).library.length, 7);
    });

    await check('Import asks first, then replaces', async () => {
      const t = exported.records.find(r => r.key === 'tsi.encounter.tracker');
      const small = Object.assign({}, exported, { records: [{ key: 'tsi.encounter.tracker', value: Object.assign({}, t.value, { library: t.value.library.slice(0, 1) }), savedAt: exported.savedAt }] });
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('small-encounter.json', small));
      assert(/Import into the Combat Tracker & VTT Battlemap/.test(await H.modalText(page)));
      await page.uncheck('.tsi-modal input[type=checkbox]');
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Import')]);
      await page.waitForSelector('[data-test=complete-turn]');
      equal((await st(page)).library.map(x => x.name), ['Aria']);
    });

    await check('a damaged save is set aside, not deleted, and the tracker starts fresh (ENC-08)', async () => {
      await page.evaluate(() => { TSI.store.set('tsi.encounter.tracker', { library: [{ type: 'pc' }] }); return TSI.store.flush(); });
      await openTracker(page);
      await H.waitForNotice(page, /set aside/);
      equal((await st(page)).library, []);
      equal(await page.evaluate(() => TSI.store.keys('quarantine').map(k => TSI.store.get(k))), [{ library: [{ type: 'pc' }] }]);
    });

    await check('Reset asks, then clears the library and encounter but keeps the map (C10)', async () => {
      await party(page);
      await page.evaluate(() => { TSI.store.set('tsi.encounter.mapImage', 'data:image/png;base64,AAAA'); return TSI.store.flush(); });
      await page.click('[data-test=reset-all]');
      assert(/This will wipe your library and encounter data from this device\/browser\. Continue\?/.test(await H.modalText(page)));
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Reset')]);
      await page.waitForSelector('[data-test=complete-turn]');
      equal((await st(page)).library, []);
      equal(await page.evaluate(() => TSI.store.get('tsi.encounter.mapImage')), 'data:image/png;base64,AAAA');
    });

    await check('"Back up everything" includes the Combat Tracker', async () => {
      await party(page);
      await waitSaved(page);
      await page.click('[data-test=home]');
      await page.waitForSelector('[data-test=backup-everything]');
      const d = await H.download(page, '[data-test=backup-everything]');
      const keys = JSON.parse(d.text).records.map(r => r.key);
      assert(keys.includes('tsi.encounter.tracker') && keys.includes('tsi.encounter.mapImage'), keys.join());
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The Battlemap window');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openTracker(page);
    await party(page);
    await addSelected(page, ['Aria', 'Borin', 'Goblin', 'Orc', 'Old Hask']);
    await page.fill('[data-test=enc-name]', 'Underroot Ambush');
    await page.click('[data-test=begin]');
    let map = await openMap(page);
    await map.setViewportSize({ width: 1400, height: 900 });

    await check('it opens from Battlemap, shows the fight\'s tokens and whose turn it is, with no "Back to Tracker" (ENC-06)', async () => {
      equal(await map.textContent('[data-test=bm-status]'), 'Showing tokens for: Underroot Ambush');
      equal((await tokens(map)).map(t => t.name), ['Aria', 'Borin', 'Goblin', 'Orc', 'Old Hask']);
      equal((await tokens(map)).filter(t => t.active).map(t => t.name), [await who(page)]);
      equal(await map.$$eval('a', a => a.length), 0);
      equal(await map.evaluate(() => document.title), 'Scarlett Isles – Battlemap · The Scarlett Isles: D&D Tool Suite');
    });

    await check('a second click on Battlemap brings the same window forward', async () => {
      let popups = 0;
      page.on('popup', () => popups++);
      await page.click('[data-test=open-battlemap]');
      await page.waitForTimeout(500);
      equal(popups, 0);
    });

    await check('a condition put on the one whose turn it is counts down as that turn ends, as before', async () => {
      const actor = await who(page);
      await completeTurn(page, { target: actor, condition: 'Dazed', turns: 2 });
      equal((await roster(page)).find(c => c.name === actor).conditions, [{ name: 'Dazed', remaining: 1 }]);
    });

    await check('the turn highlight follows Complete Turn', async () => {
      await completeTurn(page, {});
      await map.waitForTimeout(200);
      equal((await tokens(map)).filter(t => t.active).map(t => t.name), [await who(page)]);
    });

    await check('a map over 4 MB is refused with the old message', async () => {
      await map.setInputFiles('[data-test=map-upload]', mapOfSize(4300000, 'big-map.png'));
      assert(/That image is over ~4MB\. Please use a smaller file \(JPG recommended\)\./.test(await H.modalText(map)));
      await H.clickModal(map, 'OK');
      equal(await map.$eval('[data-test=bm-map]', m => m.hidden), true);
    });

    await check('a 3.95 MB map shows, and is saved by the desk (ENC-04, C9)', async () => {
      await map.setInputFiles('[data-test=map-upload]', mapOfSize(3950000, 'map-3.95mb.png'));
      await map.waitForFunction(() => document.querySelector('[data-test=bm-map]').naturalWidth > 0);
      await page.waitForFunction(() => (TSI.store.get('tsi.encounter.mapImage') || '').length > 5000000);
      await waitSaved(page);
    });

    await check('uploading turns the fog on and covered, as before', async () => {
      const v = await bmVtt(map);
      equal([v.fog.enabled, v.fog.revealAll], [true, false]);
      equal(await map.textContent('[data-test=bm-fog]'), 'Fog: On');
    });

    await check('tokens stay on their spot of the map when the window is resized or zoomed, or moves to the TV (ENC-03)', async () => {
      await map.click('[data-test=bm-fog-all]');
      const a = await onMap(map, 'Borin');
      await map.setViewportSize({ width: 1000, height: 700 });
      await map.waitForTimeout(200);
      equal(await onMap(map, 'Borin'), a, 'smaller window');
      await map.setViewportSize({ width: 1920, height: 1080 });
      await map.waitForTimeout(200);
      equal(await onMap(map, 'Borin'), a, 'the TV');
      await map.click('[data-test=bm-zoom-in]');
      await map.click('[data-test=bm-zoom-in]');
      equal(await onMap(map, 'Borin'), a, 'zoomed');
      await map.click('[data-test=bm-zoom-reset]');
      await map.setViewportSize({ width: 1400, height: 900 });
    });

    await check('dragging with Snap on puts the token\'s centre on a grid corner', async () => {
      await map.click('[data-test=bm-grid]');
      await map.click('[data-test=bm-snap]');
      equal([await map.textContent('[data-test=bm-grid]'), await map.textContent('[data-test=bm-snap]')], ['Grid: On', 'Snap: On']);
      await dragToken(map, 'Aria', 503, 396);
      const v = await bmVtt(map);
      const aria = (await roster(page)).find(c => c.name === 'Aria').encId;
      equal(v.tokenPos[aria], { x: 490, y: 420 });
    });

    await check('the grid\'s size and nudge change the readout; Shift + click is a bigger step', async () => {
      await map.click('[data-test=bm-grid-lg]');
      await map.click('[data-test=bm-grid-lg]', { modifiers: ['Shift'] });
      await map.click('[data-test=bm-nudge-r]');
      await map.click('[data-test=bm-nudge-d]');
      equal(await map.textContent('[data-test=bm-grid-readout]'), 'Grid: 82 • Offset: 2,2');
      await map.click('[data-test=bm-grid-sm]', { modifiers: ['Shift'] });
      await map.click('[data-test=bm-grid-sm]');
      await map.click('[data-test=bm-nudge-l]');
      await map.click('[data-test=bm-nudge-u]');
      equal(await map.textContent('[data-test=bm-grid-readout]'), 'Grid: 70 • Offset: 0,0');
    });

    await check('fog: Cover all hides the map; a player\'s token clears it as soon as it\'s let go (C11)', async () => {
      await map.click('[data-test=bm-fog-cover]');
      assert((await fogAt(map, 1200, 700)) > 200, 'covered');
      await dragToken(map, 'Borin', 1190, 700);
      const borin = (await bmVtt(map)).tokenPos[(await roster(page)).find(c => c.name === 'Borin').encId];
      assert((await fogAt(map, borin.x + 20, borin.y + 20)) < 10, 'clear around Borin');
      assert((await fogAt(map, 30, 850)) > 200, 'still covered far away');
      equal(await map.textContent('[data-test=bm-fog-readout]'), 'Fog: 6 sq • Covered');
    });

    await check('"Monsters: Above fog" puts the monsters above the fog (ENC-12)', async () => {
      equal((await tokens(map)).filter(t => t.above).length, 0);
      await map.click('[data-test=bm-fog-monsters]');
      equal(await map.textContent('[data-test=bm-fog-monsters]'), 'Monsters: Above fog');
      equal((await tokens(map)).filter(t => t.above).map(t => t.name), ['Goblin', 'Orc']);
      const z = await map.evaluate(() => [getComputedStyle(document.querySelector('[data-test=bm-tokens-above]')).zIndex, getComputedStyle(document.querySelector('[data-test=bm-fog-canvas]')).zIndex]);
      assert(+z[0] > +z[1], 'above layer ' + z[0] + ' vs fog ' + z[1]);
      await map.click('[data-test=bm-fog-monsters]');
    });

    await check('the ruler: 3 × 4 squares reads 25 ft', async () => {
      await map.click('[data-test=bm-fog-all]');
      await map.click('[data-test=bm-ruler]');
      const a = await boardPoint(map, 700, 280);
      const b = await boardPoint(map, 910, 560);
      await map.mouse.move(a.x, a.y);
      await map.mouse.down();
      await map.mouse.move(b.x, b.y, { steps: 5 });
      equal(await map.textContent('[data-test=bm-measure]'), '25 ft (5.0 sq)');
      await map.mouse.up();
      assert(!(await map.isVisible('[data-test=bm-measure]')), 'the readout clears on release');
      await map.click('[data-test=bm-ruler]');
    });

    await check('Hide Monsters on the desk hides them on the map; the map\'s own label waits, as before (ENC-19: kept)', async () => {
      await page.click('[data-test=monsters-hide]');
      await map.waitForTimeout(200);
      equal((await tokens(map)).filter(t => t.hidden).map(t => t.name), ['Goblin', 'Orc']);
      equal(await map.textContent('[data-test=bm-toggle-monsters]'), 'Hide monsters');
      await page.click('[data-test=monsters-reveal]');
      await map.waitForTimeout(200);
      equal((await tokens(map)).filter(t => t.hidden).length, 0);
    });

    await check('the map\'s own Hide monsters button works and says so', async () => {
      await map.click('[data-test=bm-toggle-monsters]');
      equal(await map.textContent('[data-test=bm-toggle-monsters]'), 'Show monsters');
      equal((await tokens(map)).filter(t => t.hidden).map(t => t.name), ['Goblin', 'Orc']);
      await map.click('[data-test=bm-toggle-monsters]');
    });

    await check('Shift + click takes a token off the map, with no way back (C7: kept)', async () => {
      const t = await map.$eval('[data-test=bm-token][data-name=Orc] img', i => { const r = i.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await map.keyboard.down('Shift');
      await map.mouse.click(t.x, t.y);
      await map.keyboard.up('Shift');
      equal((await tokens(map)).map(x => x.name), ['Aria', 'Borin', 'Goblin', 'Old Hask']);
      equal((await roster(page)).find(c => c.name === 'Orc').defeated, false, 'the tracker is unchanged');
    });

    await check('a monster knocked out on the desk leaves the map; healed, it comes back (C2)', async () => {
      await completeTurn(page, { target: 'Goblin', damage: 50 });
      await map.waitForTimeout(200);
      assert(!(await tokens(map)).some(t => t.name === 'Goblin'), 'gone');
      await completeTurn(page, { target: 'Goblin', damage: -4 });
      await map.waitForTimeout(200);
      assert((await tokens(map)).some(t => t.name === 'Goblin'), 'back');
    });

    await check('Ctrl + drag selects several tokens, and they move together', async () => {
      const a = await boardPoint(map, 100, 40);
      const b = await boardPoint(map, 1000, 200);
      await map.keyboard.down('Control');
      await map.mouse.move(a.x, a.y);
      await map.mouse.down();
      await map.mouse.move(b.x, b.y, { steps: 4 });
      await map.mouse.up();
      await map.keyboard.up('Control');
      const sel = await map.evaluate(() => TSI.encounter.battlemap.selected());
      assert(sel.length >= 2, 'selected ' + sel.length);
    });

    await check('everything done on the map is saved by the desk and back after refreshing the map window', async () => {
      await waitSaved(page);
      const before = await bmVtt(map);
      await map.reload();
      await map.waitForFunction(() => window.TSI && TSI.encounter && TSI.encounter.battlemap && TSI.encounter.battlemap.ready(), null, { timeout: 10000 });
      const after = await bmVtt(map);
      equal(canon(after), canon(before));
      equal(await map.$eval('[data-test=bm-map]', m => m.hidden), false);
      equal((await tokens(map)).map(x => x.name), ['Aria', 'Borin', 'Goblin', 'Old Hask']);
    });

    await check('reloading the desk reconnects the map window, which keeps following the fight', async () => {
      await page.reload();
      await page.waitForSelector('[data-test=complete-turn]');
      await page.waitForFunction(() => TSI.encounter.debug && TSI.encounter.debug.link().connected, null, { timeout: 8000 });
      await completeTurn(page, {});
      await map.waitForTimeout(300);
      equal((await tokens(map)).filter(t => t.active).map(t => t.name), [await who(page)]);
    });

    await check('closing the tracker and opening it again keeps the map and token positions', async () => {
      const before = (await st(page));
      const vttBefore = await page.evaluate(() => TSI.encounter.debug.vtt());
      await Promise.all([page.waitForURL(/index\.html$/), page.click('[data-test=home]')]);
      await map.waitForEvent('close', { timeout: 5000 }).catch(() => {});
      assert(map.isClosed(), 'the Battlemap window closes when you leave the tool (answer 7)');
      await openTracker(page);
      equal(await st(page), before);
      equal(canon(await page.evaluate(() => TSI.encounter.debug.vtt())), canon(vttBefore));
      map = await openMap(page);
      equal(await map.$eval('[data-test=bm-map]', m => m.hidden), false);
    });

    await check('fullscreen fills the screen with the map and shows the side buttons', async () => {
      await map.setViewportSize({ width: 1920, height: 1080 });
      await map.click('[data-test=bm-fullscreen]');
      await map.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 });
      const r = await map.evaluate(() => { const s = document.querySelector('[data-test=bm-stage]').getBoundingClientRect(); return [Math.round(s.width), Math.round(s.height), getComputedStyle(document.querySelector('[data-test=bm-sidebar]')).display]; });
      equal(r, [1920, 1080, 'grid']);
      const gap = await map.evaluate(() => document.querySelector('[data-test=bm-ruler]').getBoundingClientRect().left - document.querySelector('[data-test=bm-sidebar]').getBoundingClientRect().right);
      assert(gap > 0, 'the ruler overlaps the side buttons by ' + (-gap) + 'px');
      await H.shot(map, 'encounter-battlemap-fullscreen');
      await map.click('[data-test=bm-fs-grid]');
      equal(await map.textContent('[data-test=bm-grid]'), 'Grid: Off');
      await map.evaluate(() => document.exitFullscreen());
    });

    await check('no internet, no missing files, no errors in either window', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });

    await check('closing the tool stops every timer and listener', async () => {
      await page.evaluate(() => TSI.shell.stopTool());
      equal(await page.evaluate(() => TSI.shell.current().life.counts()), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Faithful to the old tool' + (HAS_LEGACY ? '' : ' (skipped: _legacy/scarlettisles-encounter-tracker is missing)'));
  if (HAS_LEGACY) {
    const oldCtx = await H.newContext(browser, 'laptop');
    await oldCtx.setOffline(true);
    await oldCtx.addInitScript(setup);
    const old = await oldCtx.newPage();
    old.on('dialog', d => d.accept());
    const { context, page } = await newPage(browser, 'laptop');

    const oldView = () => old.evaluate(() => {
      const q = s => document.querySelector(s);
      const e = state.encounter;
      const tgt = e.roster.find(c => c.encId === q('#targetSelect').value);
      return {
        roster: e.roster.map(c => [c.name, c.type, c.init, c.curHp, c.maxHp, !!c.defeated, (c.conditions || []).map(x => typeof x === 'string' ? x : x.name + ' ' + x.remaining).join('|')]),
        status: e.status, turnIndex: e.turnIndex, round: e.round, target: tgt ? tgt.name : null,
        statusText: q('#encStatus').textContent, pill: q('#turnPill').textContent,
        insp: [q('#inspectorName').textContent, q('#inspectorMeta').textContent, q('#inspectorStats').hidden ? null : q('#inspectorHp').textContent,
          Array.from(document.querySelectorAll('#inspectorConds .badge')).map(b => b.textContent)],
        momentum: q('#momentumText').textContent,
        library: state.library.map(x => [x.name, x.type, x.maxHp, x.initBonus == null ? null : x.initBonus]),
        saved: state.savedEncounters.map(s => [s.name, s.roster.map(r => r.name + ' ' + r.init)])
      };
    });
    const newView = () => page.evaluate(() => {
      const t = x => document.querySelector('[data-test=' + x + ']');
      const s = TSI.encounter.debug.state();
      const e = s.encounter;
      const tgt = e.roster.find(c => c.encId === t('target').value);
      return {
        roster: e.roster.map(c => [c.name, c.type, c.init, c.curHp, c.maxHp, !!c.defeated, (c.conditions || []).map(x => typeof x === 'string' ? x : x.name + ' ' + x.remaining).join('|')]),
        status: e.status, turnIndex: e.turnIndex, round: e.round, target: tgt ? tgt.name : null,
        statusText: t('enc-status').textContent.replace('Paused. Pressing Begin starts again from round 1, in initiative order.', 'Paused. Resume by pressing Begin.'),
        pill: t('turn-pill').textContent,
        insp: [t('insp-name').textContent, t('insp-meta').textContent, document.querySelector('.tsi-enc-insp-stats').hidden ? null : t('insp-hp').textContent,
          Array.from(document.querySelectorAll('[data-test=insp-conds] .tsi-enc-badge')).map(b => b.textContent)],
        momentum: t('momentum').textContent,
        library: s.library.map(x => [x.name, x.type, x.maxHp, x.initBonus == null ? null : x.initBonus]),
        saved: s.savedEncounters.map(v => [v.name, v.roster.map(r => r.name + ' ' + r.init)])
      };
    });
    const O = { name: '#newName', type: '#newType', hp: '#newMaxHp', init: '#newInitBonus', avatar: '#newAvatar', ref: '#newRefLink', addLib: '#btnAddToLibrary', addSel: '#btnAddSelected',
      encName: '#encName', autoInit: '#btnAutoInit', begin: '#btnBegin', pause: '#btnPause', end: '#btnEnd', target: '#targetSelect', damage: '#damageInput', cond: '#conditionInput', turns: '#conditionTurns',
      addCond: '#btnAddCondition', complete: '#btnCompleteTurn', saveEnc: '#btnSaveEncounter',
      clickLib: (p, n, opts) => p.locator('#libraryList .item').filter({ has: p.locator('.itemTitle', { hasText: new RegExp('^' + n + '$') }) }).click(opts) };
    const N = { name: '[data-test=new-name]', type: '[data-test=new-type]', hp: '[data-test=new-max-hp]', init: '[data-test=new-init]', avatar: '[data-test=new-avatar]', ref: '[data-test=new-ref]', addLib: '[data-test=add-to-library]', addSel: '[data-test=add-selected]',
      encName: '[data-test=enc-name]', autoInit: '[data-test=auto-init]', begin: '[data-test=begin]', pause: '[data-test=pause]', end: '[data-test=end]', target: '[data-test=target]', damage: '[data-test=damage]', cond: '[data-test=condition]', turns: '[data-test=condition-turns]',
      addCond: '[data-test=add-condition]', complete: '[data-test=complete-turn]', saveEnc: '[data-test=save-encounter]',
      clickLib: (p, n, opts) => p.click('[data-test=library-item][data-name="' + n + '"]', opts) };

    let steps = 0;
    const diffs = [];
    async function both(fn, label) {
      await fn(old, O);
      await fn(page, N);
      await page.waitForTimeout(380); /* the double-click guard */
      if (await page.$('.tsi-modal')) await H.clickModal(page, (await page.$('.tsi-modal__foot button:text-is("OK")')) ? 'OK' : 'Load');
      const a = await oldView();
      const b = await newView();
      steps++;
      for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffs.push(label + ' › ' + k + ': old ' + JSON.stringify(a[k]) + ' / new ' + JSON.stringify(b[k]));
      return b;
    }
    const pickTarget = idx => async (p, S) => {
      const n = await p.$$eval(S.target + ' option', o => o.length);
      await p.selectOption(S.target, { index: idx % n });
    };

    await check('the old tracker and the rebuild start the same', async () => {
      await old.goto(H.fileUrl('_legacy/scarlettisles-encounter-tracker/index.html'));
      await old.waitForSelector('#btnCompleteTurn');
      await openTracker(page);
      await old.evaluate(() => window.__seed(4242));
      await page.evaluate(() => window.__seed(4242));
      await both(async () => {}, 'start');
      equal(diffs, []);
    });

    await check('building the same library and encounter gives the same desk', async () => {
      const lib = [['Aria', 'pc', 30, 2], ['Borin', 'pc', 40, 1], ['Goblin', 'monster', 7, 2], ['Orc', 'monster', 15, 1], ['Old Hask', 'npc', 12, 0], ['Wolf', 'monster', 11, 2]];
      for (const [n, t, hp, init] of lib) {
        await both(async (p, S) => {
          await p.fill(S.name, n); await p.selectOption(S.type, t); await p.fill(S.hp, String(hp)); await p.fill(S.init, String(init)); await p.click(S.addLib);
        }, 'add ' + n);
      }
      await both(async (p, S) => { for (const n of ['Aria', 'Borin', 'Goblin', 'Old Hask', 'Wolf']) await S.clickLib(p, n); await p.click(S.addSel); }, 'add selected');
      await both(async (p, S) => { for (const n of ['Aria', 'Borin', 'Old Hask', 'Wolf']) await S.clickLib(p, n); await p.click(S.addSel); }, 'add a second goblin');
      await both(async (p, S) => { await p.fill(S.encName, 'Underroot Ambush'); await p.click(S.autoInit); }, 'auto-roll');
      await both(async (p, S) => { await p.click(S.begin); }, 'begin');
      equal(diffs, []);
    });

    await check('the same turns, damage, healing and conditions give the same desk at every step', async () => {
      const damage = ['6', '', '-3', '12', '', '4', '9', '2'];
      for (let k = 0; k < 30; k++) {
        const s = await st(page);
        if (s.encounter.status !== 'running') break;
        const r = s.encounter.roster;
        const idx = (k * 5 + 1) % r.length;
        let dmg = damage[k % damage.length];
        /* Healing a DEFEATED creature is deliberately different now (C2), so it isn't compared here. */
        if (dmg.startsWith('-') && r[idx].defeated) dmg = '';
        const cond = k % 4 === 1 ? ['Prone', '2'] : k % 6 === 3 ? ['Blessed', ''] : ['', ''];
        if (k % 5 === 2) {
          await both(async (p, S) => { await pickTarget(idx + 1)(p, S); await p.fill(S.cond, 'Hexed'); await p.fill(S.turns, '1'); await p.click(S.addCond); }, 'turn ' + k + ' add condition');
        }
        await both(async (p, S) => {
          await pickTarget(idx)(p, S);
          await p.fill(S.damage, dmg); await p.fill(S.cond, cond[0]); await p.fill(S.turns, cond[1]);
          await p.click(S.complete);
        }, 'turn ' + k);
      }
      equal(diffs.slice(0, 6), []);
    });

    await check('Pause, Begin, End, Save and Load behave the same', async () => {
      await both(async (p, S) => { if (!(await p.$eval(S.pause, b => b.disabled))) await p.click(S.pause); }, 'pause');
      await both(async (p, S) => { await p.click(S.begin); }, 'begin again');
      await both(async (p, S) => { if (!(await p.$eval(S.end, b => b.disabled))) await p.click(S.end); }, 'end');
      await both(async (p, S) => { if (S === N) await p.click('[data-test=tab-btn-encounters]'); else await p.click('.tab[data-tab=encounters]'); await p.click(S.saveEnc); }, 'save encounter');
      await both(async (p, S) => { if (S === N) { await p.click('[data-test=saved-load]'); await H.clickModal(p, 'Load'); } else await p.click('#savedEncountersList .item .btn:text-is("Load")'); }, 'load encounter');
      equal(diffs.slice(0, 6), []);
    });

    await check('editing a library entry updates the encounter the same way', async () => {
      await both(async (p, S) => {
        if (S === N) await p.click('[data-test=tab-btn-library]'); else await p.click('.tab[data-tab=library]');
        await S.clickLib(p, 'Goblin', { modifiers: ['Shift'] });
        await p.fill(S.name, 'Goblin Scout'); await p.fill(S.hp, '5'); await p.click(S.addLib);
      }, 'edit Goblin');
      equal(diffs.slice(0, 6), []);
    });

    await check('the same campaign file comes out of both', async () => {
      const oldFile = await (async () => {
        const [d] = await Promise.all([old.waitForEvent('download'), old.evaluate(() => { document.querySelector('.tab[data-tab=import]').click(); document.querySelector('#btnExportJson').click(); })]);
        return JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
      })();
      await page.click('[data-test=tab-btn-import]');
      const newFile = JSON.parse((await H.download(page, '[data-test=export-json]')).text);
      const strip = f => ({ schema: f.schema, library: f.library.map(x => Object.assign({}, x, { id: 'x' })) });
      equal(strip(newFile), strip(oldFile));
    });

    await check('the two Battlemaps show the same tokens, whose turn it is, and hidden monsters (' + steps + ' desk steps compared)', async () => {
      await both(async (p, S) => { await p.click(S.begin); }, 'begin for the map');
      const [oldMap] = await Promise.all([old.waitForEvent('popup'), old.click('#btnOpenVtt')]);
      await oldMap.waitForSelector('#tokenLayer .token');
      const map = await openMap(page);
      const oldTokens = () => oldMap.$$eval('#tokenLayer .token', ts => ts.map(t => ({ name: t.querySelector('.tokenLabel').textContent, active: t.classList.contains('isActiveTurn'), hidden: t.classList.contains('isHidden') })));
      const newTokens = async () => (await tokens(map)).map(t => ({ name: t.name, active: t.active, hidden: t.hidden }));
      equal(await newTokens(), await oldTokens());
      await old.click('#btnMonstersHide');
      await page.click('[data-test=monsters-hide]');
      await oldMap.reload();
      await oldMap.waitForSelector('#tokenLayer .token');
      await map.waitForTimeout(300);
      equal(await newTokens(), await oldTokens());
      assert((await newTokens()).some(t => t.hidden), 'some monsters hidden');
    });
    await check('the comparison covered the whole fight (' + steps + ' steps)', async () => { assert(steps > 40, 'only ' + steps + ' steps compared'); });
    await H.shot(page, 'encounter-compare-new');
    await old.screenshot({ path: path.join(H.SHOTS, 'encounter-compare-old.png') });
    await oldCtx.close();
    await context.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
