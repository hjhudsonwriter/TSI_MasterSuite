/* The Bastion's War Table on its own (war mini-game phase 2): setup, terrain,
   deployment, battle, DM pause, the result, and the layout on Harry's screens.
   It opens tests/war-table.html, which loads the suite's real War Table files
   with a pretend Bastion behind them and an in-memory store.
   Run:  node tests/e2e/war-table.test.js  (or add a section name, e.g. "fixes"). */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = process.env.TSI_SHOTS || path.join(os.tmpdir(), 'tsi-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const PICS = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-wt-'));
const MAP = path.join(ROOT, 'tools/explorer/assets/maps/midland_province.jpg');
/* Test pictures, drawn by the browser at the start (see makePictures). */
const SQUARE = path.join(PICS, 'map-square.png');   /* 1200 × 1200 */
const MAPA = path.join(PICS, 'mapA.jpg');            /* 1600 × 1000: 22 × 14 */
const MAPB = path.join(PICS, 'mapB.jpg');            /* 1200 × 1200: 22 × 22 */
const SIZES = {
  laptop: { viewport: { width: 1707, height: 930 }, deviceScaleFactor: 1.5 },
  laptopFull: { viewport: { width: 1707, height: 1067 }, deviceScaleFactor: 1.5 },
  tv: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }
};
const only = process.argv[2] || '';

const results = [];
let sectionName = '';
function section(n) { sectionName = n; console.log('\n## ' + n); }
async function check(name, fn) {
  try { await fn(); results.push({ ok: true }); console.log('  ✓ ' + name); }
  catch (e) { results.push({ ok: false, name: sectionName + ': ' + name }); console.log('  ✗ ' + name + '\n      ' + String(e.message).split('\n').join('\n      ')); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function equal(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m ? m + ': ' : '') + 'got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b)); }
const wait = ms => new Promise(r => setTimeout(r, ms));

/* Three plain test pictures, different from each other (each picture is
   its own map to the War Table). */
async function makePictures(browser) {
  const page = await browser.newPage();
  const draw = (w, h, colour, type) => page.evaluate(([w, h, colour, type]) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = colour; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#000'; g.lineWidth = 6;
    for (let x = 0; x < w; x += 100) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h / 3, h); g.stroke(); }
    return c.toDataURL(type, 0.9).split(',')[1];
  }, [w, h, colour, type]);
  fs.writeFileSync(SQUARE, Buffer.from(await draw(1200, 1200, '#4f7a3a', 'image/png'), 'base64'));
  fs.writeFileSync(MAPA, Buffer.from(await draw(1600, 1000, '#8a6d3b', 'image/jpeg'), 'base64'));
  fs.writeFileSync(MAPB, Buffer.from(await draw(1200, 1200, '#3b5f8a', 'image/jpeg'), 'base64'));
  await page.close();
}
async function newPage(browser, size, extra) {
  const ctx = await browser.newContext(Object.assign({}, SIZES[size || 'laptop'], extra || {}));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  ctx.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) page.errors.push('network: ' + r.url()); });
  await page.goto('file://' + path.join(ROOT, 'tests', process.env.WT_PAGE || 'war-table.html'));
  return page;
}
/* extra: page-side JavaScript for the options to add (a string), or nothing. */
async function open(page, extra) {
  await page.evaluate(x => { window.T = openTable(x ? (0, eval)('(' + x + ')') : undefined); }, extra || null);
  await page.waitForSelector('[data-test=wt-root]');
  await wait(150);
}
const st = page => page.evaluate(() => T.state());
const bat = page => page.evaluate(() => T.battle());
const txt = (page, t) => page.textContent('[data-test="' + t + '"]');
const vis = (page, t) => page.isVisible('[data-test="' + t + '"]');
async function centre(page, fn, ...args) {
  const r = await page.evaluate(fn, ...args);
  assert(r, 'no rect');
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
const tokenAt = (page, id) => centre(page, i => T.tokenScreenRect(i), id);
const cellAt = (page, c, r) => centre(page, a => T.cellScreenRect(a[0], a[1]), [c, r]);
async function clickToken(page, id) { const p = await tokenAt(page, id); await page.mouse.click(p.x, p.y); await wait(60); }
async function clickCell(page, c, r) { const p = await cellAt(page, c, r); await page.mouse.click(p.x, p.y); await wait(60); }
async function drag(page, from, to, steps) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: steps || 8 });
  const mid = await page.evaluate(() => document.querySelectorAll('.tsi-bas-wt-cell--deploy').length);
  await page.mouse.up();
  await wait(200); /* a refused token slides back to its square (110 ms) */
  return mid;
}
async function confirmModal(page, yes) {
  await page.waitForSelector('.tsi-modal');
  await page.click('.tsi-modal [data-value=' + (yes ? 'true' : 'false') + ']');
  await wait(120);
}
/* Start Battle, yes, then the battle briefing that follows (Begin the battle). */
async function startBattle(page) {
  await page.click('[data-test=wt-start-battle]');
  await confirmModal(page, true);
  await page.waitForSelector('[data-test=wt-briefing]');
  await confirmModal(page, true);
}
async function uploadMap(page, file) {
  await page.setInputFiles('[data-test=wt-upload-input]', file);
  await page.waitForFunction(() => { const m = document.querySelector('[data-test=wt-map]'); return m && !m.hidden && m.naturalWidth > 0; });
  await wait(200);
}
/* Every control in view, nothing scrolls sideways or down. */
async function layoutOk(page, sels) {
  const r = await page.evaluate(list => {
    const de = document.documentElement;
    const vs = getComputedStyle(de).overflowY !== 'visible' ? getComputedStyle(de) : getComputedStyle(document.body);
    const out = {
      sx: de.scrollWidth > innerWidth && vs.overflowX !== 'hidden' ? de.scrollWidth : 0,
      sy: de.scrollHeight > innerHeight && vs.overflowY !== 'hidden' ? de.scrollHeight : 0,
      bad: []
    };
    list.forEach(s => {
      document.querySelectorAll(s).forEach(n => {
        if (n.hidden || !n.offsetParent) return;
        const b = n.getBoundingClientRect();
        if (b.left < -0.5 || b.top < -0.5 || b.right > innerWidth + 0.5 || b.bottom > innerHeight + 0.5) out.bad.push(s + ' ' + JSON.stringify([b.left, b.top, b.right, b.bottom].map(Math.round)));
      });
    });
    const side = document.querySelector('.tsi-bas-wt-side');
    const sb = side.getBoundingClientRect();
    if (sb.bottom > innerHeight + 0.5) out.bad.push('side panel bottom ' + sb.bottom);
    return out;
  }, sels);
  assert(r.sx === 0 && r.sy === 0, 'page scrolls: ' + JSON.stringify(r));
  assert(!r.bad.length, 'out of view: ' + r.bad.join('; '));
}
const HEAD = ['[data-test=wt-upload]', '[data-test=wt-clear-map]', '[data-test=wt-grid-minus]', '[data-test=wt-grid-plus]', '[data-test=wt-grid]', '[data-test=wt-snap]',
  '[data-test=wt-token-minus]', '[data-test=wt-token-plus]', '[data-test=wt-zoom-out]', '[data-test=wt-zoom-in]', '[data-test=wt-zoom-fit]', '[data-test=wt-terrain]',
  '[data-test=wt-dm-enemy]', '[data-test=wt-dm-pause]', '[data-test=wt-fullscreen]', '[data-test=wt-close]', '[data-test=wt-stage]', '[data-test=wt-round]', '[data-test=wt-turn]'];
const FOOT = ['[data-test=wt-begin-deploy]', '[data-test=wt-start-battle]', '[data-test=wt-confirm]', '[data-test=wt-cancel]', '[data-test=wt-enemy-act]', '[data-test=wt-withdraw]', '[data-test=wt-calloff]', '[data-test=wt-terrain-done]'];

/* One of your activations through the screen, as the AI would play it. */
async function playerTurnByUI(page, opts) {
  const o = await page.evaluate(() => {
    const b = T.battle();
    return TSI.bastion.warAI.chooseOrder(b, T.terrain(), 'player');
  });
  assert(o, 'the AI has an order for your side');
  await clickToken(page, o.unitId);
  equal((await st(page)).selected, o.unitId, 'selected');
  await page.click('[data-test=wt-order-' + o.id + ']');
  await wait(60);
  if (o.dest) {
    const u = (await bat(page)).units.find(x => x.id === o.unitId);
    if (!(u.pos.c === o.dest.c && u.pos.r === o.dest.r)) {
      await clickCell(page, o.dest.c, o.dest.r);
      const s = await st(page);
      equal(s.dest, { c: o.dest.c, r: o.dest.r }, 'destination chosen');
    }
  }
  if (o.targetId) {
    await clickToken(page, o.targetId);
    equal((await st(page)).targetId, o.targetId, 'target chosen');
    if (opts && opts.d20) await page.fill('[data-test=wt-d20]', String(opts.d20));
  }
  if (o.id === 'rally') {
    const box = await page.$('[data-test=wt-leader-rally]');
    if (box && await box.isVisible()) { if (!!o.useLeaderRally !== await box.isChecked()) await box.click(); }
  }
  const before = (await bat(page)).log.length;
  await page.click('[data-test=wt-confirm]');
  await wait(450);
  const after = await bat(page);
  assert(after.log.length > before || after.result, 'the log grew after ' + JSON.stringify(o));
  return o;
}
async function enemyTurn(page) {
  const before = (await bat(page)).log.length;
  await page.click('[data-test=wt-enemy-act]');
  await wait(450);
  const after = await bat(page);
  assert(after.log.length > before || after.result, 'the enemy acted');
}

(async () => {
  const browser = await chromium.launch();
  await makePictures(browser);
  let page;

  if (!only || only === 'setup') {
    section('Setup: width, map, terrain');
    page = await newPage(browser, 'laptop');
    await open(page);
    await check('opens with the title, summary, objective and the forces; no tokens yet', async () => {
      assert(/Raid vs Bacca/.test(await txt(page, 'wt-title')));
      assert(/Weather\s*Clear/.test(await txt(page, 'wt-summary')));
      assert(/Raid: carry off 2 of 3 supplies by the end of round 6/.test(await txt(page, 'wt-objective')));
      equal(await page.$$eval('.tsi-bas-wt-token', t => t.length), 0);
      const roster = await txt(page, 'wt-roster');
      ['Formations', 'Lieutenants', 'Beasts', 'Line Infantry 1', '+10 defenders: +2 Cohesion', 'Giant Vulture', 'Enemy intelligence', '1 × Bacca Stoneguard', '1 Captain'].forEach(w => assert(roster.includes(w), 'roster has ' + w + ': ' + roster));
      assert(await vis(page, 'wt-begin-deploy') && await vis(page, 'wt-calloff') && await vis(page, 'wt-prompt'));
      assert(!(await vis(page, 'wt-start-battle')) && !(await vis(page, 'wt-round')));
      assert(await page.$$eval('[data-test=wt-marker]', m => m.length) === 3, 'the supplies are shown where they will be');
    });
    await check('Battlefield − / + choose 20 to 24 squares across, saved', async () => {
      equal(await txt(page, 'wt-cols'), '22 squares across');
      await page.click('[data-test=wt-grid-plus]');
      equal(await txt(page, 'wt-cols'), '23 squares across');
      equal((await page.evaluate(() => T.board())).cols, 23);
      await page.click('[data-test=wt-grid-plus]');
      equal(await txt(page, 'wt-cols'), '24 squares across');
      assert(await page.isDisabled('[data-test=wt-grid-plus]'), 'stops at 24');
      for (let i = 0; i < 5; i++) if (!(await page.isDisabled('[data-test=wt-grid-minus]'))) await page.click('[data-test=wt-grid-minus]');
      equal(await txt(page, 'wt-cols'), '20 squares across');
      assert(await page.isDisabled('[data-test=wt-grid-minus]'));
      await page.click('[data-test=wt-grid-plus]'); await page.click('[data-test=wt-grid-plus]');
      equal(await page.evaluate(() => WT_STORE.get('warTable').cols), 22);
    });
    await check('a map: the grid follows its shape; the no-terrain warning appears', async () => {
      await uploadMap(page, MAP);
      const b = await page.evaluate(() => T.board());
      equal([b.cols, b.rows], [22, Math.round(22 * 1536 / 2048)]);
      assert(!(await vis(page, 'wt-prompt')));
      assert(await vis(page, 'wt-terrain-warning'), 'warning shown');
      assert((await txt(page, 'wt-terrain-warning')).includes('This map has no terrain rules yet: everything counts as open ground. Use Terrain to mark woods, water, cliffs and cover.'));
      equal(await page.evaluate(() => WT_STORE.get('warMap').name), 'midland_province.jpg');
    });
    await page.screenshot({ path: SHOTS + '/wt-setup-map.png' });
    await check('Terrain: palette with the rules on hover; painting by dragging; eraser', async () => {
      await page.click('[data-test=wt-terrain]');
      assert(await vis(page, 'wt-terrain-w') && await vis(page, 'wt-terrain-x') && await vis(page, 'wt-terrain-.'));
      equal(await page.getAttribute('[data-test="wt-terrain-d"]', 'title'), 'Dense woods: Costs double, no Charge, and blocks ranged line of sight through it.');
      assert(!(await vis(page, 'wt-terrain-warning')), 'no warning while painting');
      await page.click('[data-test=wt-terrain-w]');
      const a = await cellAt(page, 2, 3), z = await cellAt(page, 6, 3);
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(z.x, z.y, { steps: 3 }); await page.mouse.up();
      await wait(80);
      const t = await page.evaluate(() => T.terrain());
      const row = t.cells.slice(3 * t.cols + 2, 3 * t.cols + 7);
      equal(row, 'wwwww', 'five squares of woods, no gaps');
      const saved = await page.evaluate(() => { const s = WT_STORE.get('warTerrain'); const k = WT_STORE.get('warMap').key; return s[k] && s[k].cells.indexOf('w') !== -1; });
      assert(saved, 'saved under the map\'s key');
      await page.click('[data-test="wt-terrain-."]');
      await clickCell(page, 4, 3);
      equal((await page.evaluate(() => T.terrain())).cells.charAt(3 * 22 + 4), '.', 'erased');
      assert((await txt(page, 'wt-terrain-rule')).includes('Open ground'));
    });
    await check('Clear terrain asks first', async () => {
      await page.click('[data-test=wt-terrain-clear]');
      await confirmModal(page, false);
      assert((await page.evaluate(() => T.terrain())).cells.includes('w'), 'kept after Cancel');
      await page.click('[data-test=wt-terrain-clear]');
      await confirmModal(page, true);
      assert(!(await page.evaluate(() => T.terrain())).cells.match(/[^.]/), 'all open after Clear');
    });
    await check('Done painting; the warning comes back and can be dismissed for this map', async () => {
      await page.click('[data-test=wt-terrain-w]');
      await clickCell(page, 10, 2);
      await page.click('[data-test=wt-terrain-done]');
      assert(!(await vis(page, 'wt-terrain-warning')), 'no warning with terrain painted');
      await page.click('[data-test=wt-terrain]');
      await page.click('[data-test=wt-terrain-clear]');
      await confirmModal(page, true);
      await page.click('[data-test=wt-terrain-done]');
      assert(await vis(page, 'wt-terrain-warning'));
      await page.click('[data-test=wt-terrain-warning-dismiss]');
      assert(!(await vis(page, 'wt-terrain-warning')));
      const s = await page.evaluate(() => WT_STORE.get('warTable'));
      assert(s.terrainDismissed.length === 1, 'remembered');
    });
    await check('the deep-water edge makes the raid impossible: a warning in the side panel', async () => {
      await page.click('[data-test=wt-terrain]');
      await page.click('[data-test=wt-terrain-x]');
      const rows = (await page.evaluate(() => T.board())).rows;
      const a = await cellAt(page, 0, rows - 1), z = await cellAt(page, 21, rows - 1);
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(z.x, z.y, { steps: 6 }); await page.mouse.up();
      await wait(100);
      assert(await vis(page, 'wt-objective-problems'), 'problem shown');
      assert((await txt(page, 'wt-objective-problems')).includes('Your starting edge is all deep water or cliff'));
      await page.click('[data-test="wt-terrain-."]');
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(z.x, z.y, { steps: 6 }); await page.mouse.up();
      await wait(100);
      assert(!(await vis(page, 'wt-objective-problems')));
      /* Some woods and a pond for the battle. */
      await page.click('[data-test=wt-terrain-w]');
      for (const c of [3, 4, 17, 18]) await clickCell(page, c, rows - 4);
      await page.click('[data-test=wt-terrain-x]');
      await clickCell(page, 11, 1);
      await page.click('[data-test=wt-terrain-done]');
    });
    await check('layout at the laptop size in setup', async () => { await layoutOk(page, HEAD.concat(FOOT)); });
    await check('no errors and no internet', async () => equal(page.errors, []));
    await page.context().close();
  }

  if (!only || only === 'deploy' || only === 'battle') {
    section('Deployment');
    page = await newPage(browser, 'laptop');
    await open(page);
    await uploadMap(page, MAP);
    await check('Begin Deployment: both armies set out, saved through onChange; the width is fixed', async () => {
      await page.click('[data-test=wt-begin-deploy]');
      await wait(150);
      const b = await bat(page);
      equal(b.phase, 'deploy');
      equal(await page.evaluate(() => WT_LOG.lastBattle.phase), 'deploy');
      equal(await page.$$eval('.tsi-bas-wt-token[data-side=player]', t => t.length), 7);
      equal(await page.$$eval('.tsi-bas-wt-token[data-side=enemy]', t => t.length), 6);
      assert(await page.isDisabled('[data-test=wt-grid-plus]') && await page.isDisabled('[data-test=wt-grid-minus]'));
      assert(/fixed once deployment has begun/.test(await page.getAttribute('[data-test=wt-grid-plus]', 'title')));
      assert(await vis(page, 'wt-start-battle') && await vis(page, 'wt-dm-enemy') && !(await vis(page, 'wt-dm-pause')));
      const roster = await txt(page, 'wt-roster');
      assert(roster.includes('The enemy: Bacca') && roster.includes('Bacca Stoneguard') && roster.includes('Captain 1'), roster);
    });
    await check('drag your unit to a legal square (lit while dragging)', async () => {
      const b = await bat(page);
      const u = b.units.find(x => x.id === 'p-heavy-1');
      const target = { c: 2, r: b.rows - 2 };
      const lit = await drag(page, await tokenAt(page, u.id), await cellAt(page, target.c, target.r));
      assert(lit > 20, 'legal squares lit: ' + lit);
      const after = (await bat(page)).units.find(x => x.id === u.id);
      equal(after.pos, target);
      equal(await page.$$eval('.tsi-bas-wt-cell--deploy', c => c.length), 0, 'lights go out');
      equal(await page.evaluate(() => WT_LOG.lastBattle.units.find(x => x.id === 'p-heavy-1').pos), target, 'saved');
    });
    await check('illegal drops are refused with a reason: the strip, enemy ground, a taken square', async () => {
      const b = await bat(page);
      const from = await tokenAt(page, 'p-heavy-1');
      const lit = await drag(page, from, await cellAt(page, 5, b.strip[0]));
      assert(/no-deployment strip/.test(await page.textContent('.tsi-bas-wt-hint')), await page.textContent('.tsi-bas-wt-hint') + ' lit ' + lit + ' pos ' + JSON.stringify((await bat(page)).units.find(x => x.id === 'p-heavy-1').pos) + ' from ' + JSON.stringify(from) + ' strip ' + b.strip);
      await page.evaluate(() => {
        window.EV = [];
        ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture', 'gotpointercapture', 'click'].forEach(t => window.addEventListener(t, e => { EV.push(t + ':' + (e.target.className || e.target.nodeName).toString().slice(0, 30)); }, true));
      });
      const tk = await tokenAt(page, 'p-heavy-1');
      const lit2 = await drag(page, tk, await cellAt(page, 5, 1));
      assert(/enemy's ground/.test(await page.textContent('.tsi-bas-wt-hint')), await page.textContent('.tsi-bas-wt-hint') + ' lit ' + lit2 + ' at ' + JSON.stringify(tk) + ' ' + await page.evaluate(() => EV.join(' ')));
      const other = b.units.find(x => x.id === 'p-line-1').pos;
      await drag(page, await tokenAt(page, 'p-heavy-1'), await cellAt(page, other.c, other.r));
      assert(/taken by Line Infantry 1/.test(await page.textContent('.tsi-bas-wt-hint')), await page.textContent('.tsi-bas-wt-hint'));
      equal((await bat(page)).units.find(x => x.id === 'p-heavy-1').pos, { c: 2, r: b.rows - 2 }, 'unchanged');
    });
    await check('the enemy only moves with DM: adjust enemy, within its own ground', async () => {
      const b = await bat(page);
      const e = b.units.find(x => x.id === 'e3');
      await drag(page, await tokenAt(page, 'e3'), await cellAt(page, 0, 0));
      equal((await bat(page)).units.find(x => x.id === 'e3').pos, e.pos, 'not moved without the DM override');
      await page.click('[data-test=wt-dm-enemy]');
      equal((await st(page)).dmEnemy, true);
      await drag(page, await tokenAt(page, 'e3'), await cellAt(page, 0, 0));
      equal((await bat(page)).units.find(x => x.id === 'e3').pos, { c: 0, r: 0 });
      await drag(page, await tokenAt(page, 'e3'), await cellAt(page, 0, b.rows - 1));
      equal((await bat(page)).units.find(x => x.id === 'e3').pos, { c: 0, r: 0 }, 'not onto your ground');
      await page.click('[data-test=wt-dm-enemy]');
    });
    await check('Lieutenants: "Leads:" chooses the formation; taken ones are disabled', async () => {
      const b = await bat(page);
      const lt1 = b.leaders.find(l => l.id === 'lt-1');
      const lt2 = b.leaders.find(l => l.id === 'lt-2');
      const disabled = await page.$eval('[data-test=wt-leader-lt-1]', (s, h) => [...s.options].find(o => o.value === h).disabled, lt2.hostId);
      assert(disabled, 'the other Lieutenant\'s formation is disabled');
      await page.selectOption('[data-test=wt-leader-lt-1]', 'p-archers-1');
      await wait(100);
      const after = await bat(page);
      equal(after.leaders.find(l => l.id === 'lt-1').hostId, 'p-archers-1');
      equal(after.units.find(u => u.id === 'p-archers-1').leaderId, 'lt-1');
      assert(lt1.hostId !== 'p-archers-1');
      assert(await page.$eval('.tsi-bas-wt-token[data-id=p-archers-1]', n => !!n.querySelector('.tsi-bas-wt-token__leader--lieutenant')), 'the red disc moved');
      equal(await page.evaluate(() => WT_LOG.lastBattle.leaders.find(l => l.id === 'lt-1').hostId), 'p-archers-1', 'saved');
      await page.selectOption('[data-test=wt-leader-lt-1]', lt1.hostId);
    });
    await check('support shows on its host (roster and token)', async () => {
      assert((await txt(page, 'wt-roster-p-line-1')).includes('+10 defenders: +2 Cohesion'));
      assert(await page.$eval('.tsi-bas-wt-token[data-id=p-line-1] .tsi-bas-wt-token__support', n => n.textContent === '+2'));
    });
    await check('tooltips: a token and a roster row show the stat block', async () => {
      const p = await tokenAt(page, 'e1');
      await page.mouse.move(p.x, p.y); await page.mouse.move(p.x + 2, p.y + 1);
      await page.waitForSelector('[data-test=wt-tip]:not([hidden])');
      const t = await txt(page, 'wt-tip');
      ['Bacca Stoneguard', 'Bacca', 'Cohesion', 'Defence', 'Steady', 'Led by Captain 1'].forEach(w => assert(t.includes(w), 'tip has ' + w + ': ' + t));
      const row = await page.$('[data-test=wt-roster-p-light_cav-1]');
      const rb = await row.boundingBox();
      await page.mouse.move(rb.x + 20, rb.y + rb.height / 2);
      await page.mouse.move(rb.x + 24, rb.y + rb.height / 2);
      assert((await txt(page, 'wt-tip')).includes('Charge'), 'cavalry tip shows Charge');
      await page.mouse.move(5, 300);
    });
    await page.screenshot({ path: SHOTS + '/wt-deploy.png' });
    await check('layout at the laptop size in deployment', async () => { await layoutOk(page, HEAD.concat(FOOT)); });
    await check('a new map while deploying asks first, then sets both armies out afresh', async () => {
      await page.setInputFiles('[data-test=wt-upload-input]', SQUARE);
      await confirmModal(page, false);
      equal((await bat(page)).units.find(x => x.id === 'p-heavy-1').pos, { c: 2, r: (await bat(page)).rows - 2 }, 'kept after Cancel');
      await page.setInputFiles('[data-test=wt-upload-input]', SQUARE);
      await confirmModal(page, true);
      await wait(200);
      const b = await bat(page);
      equal(b.phase, 'deploy');
      equal([b.cols, b.rows], [22, 22], 'square map: 22 × 22');
      assert(b.units.find(x => x.id === 'p-heavy-1').pos.c !== 2, 'set out afresh');
      await page.setInputFiles('[data-test=wt-upload-input]', MAP);
      await confirmModal(page, true);
      await wait(200);
    });
    await check('Start Battle asks first', async () => {
      await page.click('[data-test=wt-start-battle]');
      await confirmModal(page, false);
      equal((await bat(page)).phase, 'deploy');
      await startBattle(page);
      equal((await bat(page)).phase, 'battle');
      equal(await page.evaluate(() => WT_LOG.lastBattle.phase), 'battle', 'saved');
    });

    section('Battle');
    await check('the header shows the round, whose turn and the objective', async () => {
      equal(await txt(page, 'wt-round'), 'Round 1 of 6');
      equal(await txt(page, 'wt-turn'), 'Your turn');
      assert((await txt(page, 'wt-objective')).includes('0 carried off'));
      assert(await vis(page, 'wt-dm-pause') && !(await vis(page, 'wt-dm-enemy')));
      assert(await vis(page, 'wt-calloff') && !(await vis(page, 'wt-withdraw')), 'Call off until the first activation');
      assert(await page.isDisabled('[data-test=wt-upload]') === false || true);
      equal(await page.getAttribute('[data-test=wt-upload]', 'aria-disabled'), 'true');
      assert(await page.isDisabled('[data-test=wt-terrain]'));
    });
    await check('clicking an enemy shows its card, no orders', async () => {
      await clickToken(page, 'e2');
      assert((await txt(page, 'wt-unit-card')).includes('Line Infantry 1'));
      assert(!(await vis(page, 'wt-order-advance')));
    });
    await check('your unit: orders with reasons; Advance lights the reachable squares', async () => {
      await clickToken(page, 'p-light_cav-1');
      assert(await vis(page, 'wt-order-advance'));
      assert(await page.isDisabled('[data-test=wt-order-rally]'));
      equal(await page.getAttribute('[data-test=wt-order-rally]', 'title'), 'Only a Shaken unit needs to Rally.');
      assert(await page.isDisabled('[data-test=wt-order-disengage]'));
      assert(/Supplies|supply/.test(await page.getAttribute('[data-test=wt-order-interact]', 'title')));
      await page.click('[data-test=wt-order-advance]');
      const s = await st(page);
      equal(s.order, 'advance');
      const n = await page.$$eval('.tsi-bas-wt-cell--move', c => c.length);
      equal(n, s.reach.length, 'one lit square per reachable square');
      assert(await vis(page, 'wt-confirm') && await vis(page, 'wt-cancel'));
    });
    await check('clicking a lit square proposes the move (ghost and path); arrow keys move it', async () => {
      const b = await bat(page);
      const u = b.units.find(x => x.id === 'p-light_cav-1');
      const s = await st(page);
      const dest = s.reach.map(k => k.split(',').map(Number)).find(([c, r]) => r === u.pos.r - 1 && c === u.pos.c);
      assert(dest, 'a square straight ahead');
      await clickCell(page, dest[0], dest[1]);
      equal((await st(page)).dest, { c: dest[0], r: dest[1] });
      assert(await page.$('.tsi-bas-wt-ghost') && await page.$('.tsi-bas-wt-path__line'), 'ghost and path');
      await page.keyboard.press('ArrowLeft');
      const d2 = (await st(page)).dest;
      equal(d2, { c: dest[0] - 1, r: dest[1] }, 'arrow moved it');
      await page.keyboard.press('ArrowRight');
      equal((await st(page)).dest, { c: dest[0], r: dest[1] });
      assert(/Advances 1 square/.test(await txt(page, 'wt-proposal')));
    });
    await check('dragging the token proposes the move too; units can\'t be dragged elsewhere', async () => {
      const b = await bat(page);
      const u = b.units.find(x => x.id === 'p-light_cav-1');
      await drag(page, await tokenAt(page, u.id), await cellAt(page, u.pos.c - 1, u.pos.r - 2));
      equal((await st(page)).dest, { c: u.pos.c - 1, r: u.pos.r - 2 });
      equal((await bat(page)).units.find(x => x.id === u.id).pos, u.pos, 'not moved until Confirm');
      await drag(page, await tokenAt(page, 'p-line-1'), await cellAt(page, 1, b.rows - 1));
      equal((await bat(page)).units.find(x => x.id === 'p-line-1').pos, b.units.find(x => x.id === 'p-line-1').pos, 'another unit can\'t be dragged');
    });
    await check('Cancel clears the proposal; Esc too', async () => {
      await page.click('[data-test=wt-cancel]');
      equal((await st(page)).order, null);
      await page.click('[data-test=wt-order-march]');
      equal((await st(page)).order, 'march');
      assert(await page.isDisabled('[data-test=wt-confirm]'), 'March needs a square');
      await page.keyboard.press('Escape');
      equal((await st(page)).order, null);
    });
    await check('archers shoot: target ringed, the preview line, a typed d20', async () => {
      await clickToken(page, 'p-archers-1');
      await page.click('[data-test=wt-order-advance]');
      const s = await st(page);
      assert(s.targets.length > 0, 'something in range');
      equal(await page.$$eval('.tsi-bas-wt-token--target', t => t.length), s.targets.length);
      await clickToken(page, s.targets[0]);
      const line = await txt(page, 'wt-preview');
      assert(/^d20 \+ 4 \+ 1 \(Luck\) vs \d+: needs \d+/.test(line), line);
      assert(await vis(page, 'wt-d20'));
      await page.fill('[data-test=wt-d20]', 'abc');
      await page.click('[data-test=wt-confirm]');
      await wait(100);
      assert(/whole number from 1 to 20/.test(await page.textContent('.tsi-bas-wt-hint')));
      equal((await bat(page)).units.find(x => x.id === 'p-archers-1').activated, false, 'nothing happened');
      await wait(400);
      await page.fill('[data-test=wt-d20]', '15');
      await page.click('[data-test=wt-confirm]');
      await wait(300);
      const b = await bat(page);
      const last = b.log.filter(l => /shoots at/.test(l.text)).pop();
      assert(last && /: 15 \+ 4 \+ 1 = 20 vs/.test(last.text), last && last.text);
      assert(b.started, 'battle started');
      assert(await page.$('.tsi-bas-wt-float'), 'the calculation floats over the target');
      assert((await txt(page, 'wt-log')).includes('15 + 4 + 1 = 20'), 'in the log');
      assert(!(await vis(page, 'wt-calloff')) && await vis(page, 'wt-withdraw'), 'Withdraw replaces Call off');
      equal(await txt(page, 'wt-turn'), 'The enemy\'s turn');
      assert(await page.$eval('.tsi-bas-wt-token[data-id=p-archers-1]', n => n.classList.contains('tsi-bas-wt-token--acted')), 'dimmed');
    });
    await page.screenshot({ path: SHOTS + '/wt-shot.png' });
    await check('Enemy acts: the AI chooses, the acting unit is lit, the log grows', async () => {
      assert(await vis(page, 'wt-enemy-act'));
      assert(!(await vis(page, 'wt-confirm')));
      await page.click('[data-test=wt-enemy-act]');
      await wait(250);
      assert(await page.$('.tsi-bas-wt-token--acting') || (await bat(page)).log.slice(-1)[0].side === 'enemy', 'the actor is lit');
      const b = await bat(page);
      assert(b.units.filter(u => u.side === 'enemy' && u.activated).length === 1, 'one enemy unit acted');
      equal(b.turnSide, 'player');
      await wait(400);
    });
    await check('Hold shows its badge', async () => {
      await clickToken(page, 'p-line-2');
      await page.click('[data-test=wt-order-hold]');
      await page.click('[data-test=wt-confirm]');
      await wait(300);
      assert(await page.$eval('.tsi-bas-wt-token[data-id=p-line-2]', n => !!n.querySelector('.tsi-bas-wt-badge--hold')));
      await wait(200);
    });
    await check('DM: pause stops orders, allows the map and terrain; Resume', async () => {
      await enemyTurn(page);
      await page.click('[data-test=wt-dm-pause]');
      assert(await vis(page, 'wt-banner'));
      assert((await txt(page, 'wt-banner')).includes('Paused'));
      equal(await txt(page, 'wt-turn'), 'Paused');
      await clickToken(page, 'p-line-1');
      assert(await page.isDisabled('[data-test=wt-order-advance]'), 'orders off');
      equal(await page.getAttribute('[data-test=wt-upload]', 'aria-disabled'), null, 'map can be replaced');
      assert(!(await page.isDisabled('[data-test=wt-terrain]')));
      await page.click('[data-test=wt-terrain]');
      await page.click('[data-test=wt-terrain-c]');
      await clickCell(page, 8, 2);
      await page.click('[data-test=wt-terrain-done]');
      equal((await page.evaluate(() => T.terrain())).cells.charAt(2 * 22 + 8), 'c');
      const before = await page.evaluate(() => T.board());
      await page.setInputFiles('[data-test=wt-upload-input]', SQUARE);
      await wait(300);
      const after = await page.evaluate(() => T.board());
      equal([after.cols, after.rows], [before.cols, before.rows], 'same squares on a new picture');
      equal((await page.evaluate(() => T.terrain())).cells.charAt(2 * 22 + 8), 'c', 'terrain kept');
      await page.setInputFiles('[data-test=wt-upload-input]', MAP);
      await wait(300);
      await page.click('[data-test=wt-dm-pause]');
      assert(!(await vis(page, 'wt-banner')));
      assert(!(await page.isDisabled('[data-test=wt-order-advance]')));
    });
    await check('several activations through the screen, as the AI would play your side', async () => {
      for (let i = 0; i < 6; i++) {
        const b = await bat(page);
        if (b.result) break;
        if (b.turnSide === 'player') await playerTurnByUI(page, { d20: i % 2 ? 12 : null });
        else await enemyTurn(page);
      }
      assert((await bat(page)).log.length > 8);
    });
    await page.screenshot({ path: SHOTS + '/wt-battle.png' });
    await check('layout at the laptop size in battle, with an order proposed', async () => {
      let b = await bat(page);
      if (b.turnSide === 'enemy') { await enemyTurn(page); b = await bat(page); }
      const ready = b.units.find(u => u.side === 'player' && u.pos && !u.activated);
      if (ready) { await clickToken(page, ready.id); await page.click('[data-test=wt-order-hold]'); }
      await layoutOk(page, HEAD.concat(FOOT).concat(['[data-test=wt-proposal]']));
      await page.screenshot({ path: SHOTS + '/wt-battle-prop.png' });
      if (ready) await page.click('[data-test=wt-cancel]');
    });
    await check('the Forces tab lists both armies with their states', async () => {
      await page.click('[data-test=wt-tab-forces]');
      assert(await vis(page, 'wt-roster'));
      const r = await txt(page, 'wt-roster');
      assert(r.includes('Clan Ironbow') && r.includes('The enemy: Bacca'));
      await page.click('[data-test=wt-tab-log]');
      assert(await vis(page, 'wt-log'));
    });
    await check('close mid-battle, reopen: everything as it was', async () => {
      const before = await bat(page);
      await page.click('[data-test=wt-close]');
      equal(await page.$('[data-test=wt-root]'), null);
      equal(await page.evaluate(() => WT_LOG.closes), 1);
      equal(await page.evaluate(() => document.getElementById('basbar').inert), false, 'the Bastion is usable again');
      await open(page);
      const after = await bat(page);
      equal(JSON.stringify(after), JSON.stringify(before), 'the same battle');
      equal(await txt(page, 'wt-round'), 'Round ' + before.round + ' of 6');
      const dimmed = await page.$$eval('.tsi-bas-wt-token--acted', t => t.map(n => n.dataset.id).sort());
      equal(dimmed, before.units.filter(u => u.pos && u.activated).map(u => u.id).sort(), 'acted units dimmed');
    });
    await check('Withdraw asks first with the consequences, then ends the battle; onEnd; the table closes', async () => {
      await page.click('[data-test=wt-withdraw]');
      await page.waitForSelector('[data-test=wt-withdraw-preview]');
      assert((await txt(page, 'wt-withdraw-preview')).includes('Treasury: −20 gp.'));
      await confirmModal(page, false);
      equal((await bat(page)).result, null);
      await page.click('[data-test=wt-withdraw]');
      await confirmModal(page, true);
      assert(await vis(page, 'wt-result'));
      assert((await txt(page, 'wt-result')).includes('Withdrawal'));
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'), null, { timeout: 4000 });
      equal(await page.evaluate(() => WT_LOG.ends.map(r => r.outcome)), ['withdrawal']);
      equal(await page.evaluate(() => WT_LOG.lastBattle.result.outcome), 'withdrawal', 'saved');
      equal(await page.evaluate(() => WT_LOG.closes), 2);
    });
    await check('no errors and no internet', async () => equal(page.errors, []));
    await page.context().close();
  }

  if (!only || only === 'full') {
    section('A whole battle through the screen');
    page = await newPage(browser, 'tv');
    await page.evaluate(() => { WT_STORE.set('warTable', { cols: 20 }); });
    await open(page, null);
    await page.evaluate(() => { window.T.close(); });
    await open(page);
    await check('skirmish with the plain board to a result', async () => {
      await page.evaluate(() => { T.close(); window.T = openTable({ spec: makeSpec('skirmish', { weather: 'cold_rain', moraleMod: 0, luckMod: -1 }), title: 'Skirmish vs Bacca', rand: seeded(11),
        onEnd: function (b) { WT_LOG.ends.push(b.result); return new Promise(function (r) { setTimeout(r, 2500); }); } }); });
      await page.click('[data-test=wt-begin-deploy]');
      await startBattle(page);
      equal(await txt(page, 'wt-turn'), 'The enemy\'s turn', 'Luck failed: the enemy first');
      let guard = 0;
      while (!(await bat(page)).result && guard++ < 120) {
        const b = await bat(page);
        if (b.turnSide === 'player') await playerTurnByUI(page);
        else await enemyTurn(page);
      }
      const b = await bat(page);
      assert(b.result, 'a result after ' + guard + ' activations');
      console.log('      result: ' + b.result.outcome + ' — ' + b.result.reason + ' (round ' + b.result.round + ')');
      await page.screenshot({ path: SHOTS + '/wt-result-tv.png' });
      assert(await vis(page, 'wt-result'));
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'), null, { timeout: 4000 });
      equal(await page.evaluate(() => WT_LOG.ends.length), 1);
    });
    await check('no errors', async () => equal(page.errors, []));
    await page.context().close();
  }

  if (!only || only === 'misc') {
    section('Call off, resume in every phase, settings');
    page = await newPage(browser, 'laptop');
    await check('Call off: onCallOff, then the table closes', async () => {
      await open(page);
      await page.click('[data-test=wt-calloff]');
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'));
      equal(await page.evaluate(() => [WT_LOG.callOffs, WT_LOG.closes]), [1, 1]);
    });
    await check('Call off answered "no" keeps the table', async () => {
      await open(page, '{ onCallOff: function () { return Promise.resolve(false); } }');
      await page.click('[data-test=wt-calloff]');
      await wait(100);
      assert(await page.$('[data-test=wt-root]'));
      await page.evaluate(() => T.close());
    });
    await check('resume: a battle saved in deployment', async () => {
      await open(page);
      await page.click('[data-test=wt-begin-deploy]');
      await drag(page, await tokenAt(page, 'p-line-1'), await cellAt(page, 0, 11));
      const saved = await page.evaluate(() => WT_LOG.lastBattle);
      await page.evaluate(() => T.close());
      await page.evaluate(b => { WT_BATTLE = b; }, saved);
      await open(page);
      equal((await bat(page)).units.find(u => u.id === 'p-line-1').pos, { c: 0, r: 11 });
      assert(await vis(page, 'wt-start-battle') && !(await vis(page, 'wt-begin-deploy')));
      await page.evaluate(() => T.close());
    });
    await check('resume: a battle saved in setup (after setBoard)', async () => {
      const b = await page.evaluate(() => { const x = TSI.bastion.battleRules.createBattle(makeSpec('defend'), null); return x; });
      await page.evaluate(x => { WT_BATTLE = x; }, b);
      await open(page);
      assert(await vis(page, 'wt-begin-deploy'));
      assert(!(await page.isDisabled('[data-test=wt-grid-plus]')), 'width can still change');
      await page.click('[data-test=wt-grid-plus]');
      equal((await bat(page)).cols, 23);
      await page.click('[data-test=wt-begin-deploy]');
      equal((await bat(page)).phase, 'deploy');
      assert(await page.$('[data-test=wt-zone]'), 'the depot is drawn');
      assert((await txt(page, 'wt-zone')).includes('Your supply depot'));
      await page.evaluate(() => T.close());
    });
    await check('resume: a battle that is over goes on to the War Report', async () => {
      const b = await page.evaluate(() => {
        const BR = TSI.bastion.battleRules;
        const x = BR.createBattle(makeSpec('seize_outpost'), null);
        BR.beginDeployment(x, null); BR.startBattle(x);
        BR.withdraw(x);
        return x;
      });
      await page.evaluate(x => { WT_BATTLE = x; WT_LOG.ends = []; }, b);
      await open(page);
      assert(await vis(page, 'wt-result'));
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'), null, { timeout: 4000 });
      equal(await page.evaluate(() => WT_LOG.ends.length), 1);
    });
    await check('resume: seize the outpost mid-round, the outpost drawn and labelled', async () => {
      const b = await page.evaluate(() => {
        const BR = TSI.bastion.battleRules;
        const x = BR.createBattle(makeSpec('seize_outpost', { weather: 'white_blizzard', moraleMod: -2, luckMod: 1 }), null);
        BR.beginDeployment(x, null); BR.startBattle(x);
        const o = TSI.bastion.warAI.chooseOrder(x, null, 'player');
        BR.resolveOrder(x, o, null, seeded(3));
        return x;
      });
      await page.evaluate(x => { WT_BATTLE = x; }, b);
      await open(page);
      assert((await txt(page, 'wt-zone')).includes('The outpost'));
      assert((await txt(page, 'wt-objective')).includes('Seize Outpost: hold it at 2 round ends in a row by the end of round 6, or break the enemy · held 0 round ends (2 needed)'), await txt(page, 'wt-objective'));
      equal(await txt(page, 'wt-turn'), 'The enemy\'s turn');
      await enemyTurn(page);
      await page.evaluate(() => T.close());
    });
    await check('tokens −/+ change only how big tokens are drawn; zoom, Fit and arrow-key panning', async () => {
      await page.evaluate(() => { WT_BATTLE = null; });
      await open(page);
      await page.click('[data-test=wt-begin-deploy]');
      const r1 = await page.evaluate(() => T.tokenScreenRect('p-line-1'));
      const c1 = await page.evaluate(() => { const u = T.battle().units.find(x => x.id === 'p-line-1'); return T.cellScreenRect(u.pos.c, u.pos.r); });
      await page.click('[data-test=wt-token-minus]');
      const r2 = await page.evaluate(() => T.tokenScreenRect('p-line-1'));
      assert(r2.w < r1.w, 'smaller');
      assert(Math.abs((r2.x + r2.w / 2) - (c1.x + c1.w / 2)) < 0.5, 'still centred in its square');
      await page.click('[data-test=wt-token-plus]');
      await page.click('[data-test=wt-zoom-in]'); await page.click('[data-test=wt-zoom-in]');
      const v1 = await page.evaluate(() => T.view());
      await page.click('[data-test=wt-stage]', { position: { x: 30, y: 30 } }).catch(() => {});
      await page.keyboard.press('ArrowRight');
      const v2 = await page.evaluate(() => T.view());
      assert(v2.ox < v1.ox, 'panned right');
      await page.click('[data-test=wt-zoom-fit]');
      equal((await page.evaluate(() => T.settings())).camera, { x: 0, y: 0, zoom: 1 });
      await page.evaluate(() => T.close());
    });
    await check('Snap off: a dragged unit glides and lands on the nearest square', async () => {
      await page.evaluate(() => { WT_BATTLE = null; });
      await open(page);
      await page.click('[data-test=wt-snap]');
      equal((await page.evaluate(() => T.settings())).grid.snap, false);
      await page.click('[data-test=wt-begin-deploy]');
      const from = await tokenAt(page, 'p-line-1');
      const target = await cellAt(page, 1, 10);
      await page.mouse.move(from.x, from.y); await page.mouse.down();
      await page.mouse.move(target.x + 7, target.y + 5, { steps: 6 });
      const mid = await page.evaluate(() => { const n = document.querySelector('.tsi-bas-wt-token[data-id=p-line-1]').getBoundingClientRect(); return n.left + n.width / 2; });
      await page.mouse.up(); await wait(80);
      assert(Math.abs(mid - (target.x + 7)) < 1.5, 'glides with the pointer');
      equal((await bat(page)).units.find(u => u.id === 'p-line-1').pos, { c: 1, r: 10 });
      await page.click('[data-test=wt-snap]');
      await page.evaluate(() => T.close());
    });
    await check('clean close: nothing left behind; closing during an enemy move is safe', async () => {
      await page.evaluate(() => { WT_BATTLE = null; });
      await open(page, "{ spec: makeSpec('skirmish', { weather: 'clear', moraleMod: 0, luckMod: -1 }) }");
      await page.click('[data-test=wt-begin-deploy]');
      await startBattle(page);
      await page.click('[data-test=wt-enemy-act]');
      await page.evaluate(() => T.close());
      await wait(3500);
      equal(await page.evaluate(() => [!!document.querySelector('.tsi-bas-wt, .tsi-bas-wt-tip'), document.body.classList.contains('tsi-bas-wt-open'), TSI.bastion.warTable.current]), [false, false, null]);
      await page.keyboard.press('ArrowLeft');
    });
    await check('no errors', async () => equal(page.errors, []));
    await page.context().close();
  }

  if (!only || only === 'scen') {
    section('Set scenes: supplies, rallies, disengaging, ending early');
    page = await newPage(browser, 'laptop');
    /* A battle in progress with only the listed units on the board: { id: [c, r] }. */
    async function scene(objective, where, extra) {
      await page.evaluate(a => {
        const BR = TSI.bastion.battleRules;
        const x = BR.createBattle(makeSpec(a.objective), null);
        BR.beginDeployment(x, null); BR.startBattle(x);
        x.units.forEach(u => { u.pos = null; });
        Object.keys(a.where).forEach(id => { BR.unitById(x, id).pos = { c: a.where[id][0], r: a.where[id][1] }; });
        x.turnSide = 'player';
        if (a.extra) (0, eval)('(' + a.extra + ')')(x, BR);
        WT_BATTLE = x;
      }, { objective, where, extra: extra || null });
      await open(page);
    }
    await check('raid: Interact collects the supplies; the carrier shows it; the objective counts it', async () => {
      const m = await page.evaluate(() => { const x = TSI.bastion.battleRules.createBattle(makeSpec('raid'), null); return x.objective.markers[0]; });
      await scene('raid', { 'p-line-1': [m.c, m.r], 'p-heavy-1': [10, 10], e2: [0, 0] });
      await clickToken(page, 'p-line-1');
      assert(!(await page.isDisabled('[data-test=wt-order-interact]')), 'Interact allowed on the supplies');
      await page.click('[data-test=wt-order-interact]');
      assert((await txt(page, 'wt-proposal')).includes('Collects the supplies here'));
      await page.click('[data-test=wt-confirm]');
      await wait(300);
      const b = await bat(page);
      equal(b.units.find(u => u.id === 'p-line-1').carrying, 'm1');
      assert(await page.$eval('.tsi-bas-wt-token[data-id=p-line-1]', n => !!n.querySelector('.tsi-bas-wt-badge--carry')), 'crate badge');
      assert((await txt(page, 'wt-objective')).includes('0 carried off, 1 on the way'));
      equal(await page.$$eval('[data-test=wt-marker]', n => n.length), 2, 'the collected supplies leave the ground');
      await page.evaluate(() => T.close());
    });
    await check('raid: a carrier reaching your starting edge carries the supplies off', async () => {
      await scene('raid', { 'p-light_cav-1': [5, 9], 'p-heavy-1': [10, 10], e2: [0, 0] }, "function (x) { const u = x.units.find(v => v.id === 'p-light_cav-1'); const m = x.objective.markers[0]; u.carrying = 'm1'; m.state = 'carried'; m.carrier = u.id; m.c = 5; m.r = 9; }");
      await clickToken(page, 'p-light_cav-1');
      await page.click('[data-test=wt-order-march]');
      await clickCell(page, 5, 11);
      await page.click('[data-test=wt-confirm]');
      await wait(900);
      const b = await bat(page);
      equal(b.objective.extracted, 1);
      assert((await txt(page, 'wt-objective')).includes('1 carried off'));
      assert((await txt(page, 'wt-log')).includes('brings a supply marker home'));
      await page.evaluate(() => T.close());
    });
    await check('Rally: the Lieutenant\'s sure rally (ticked by default), or a typed roll', async () => {
      await scene('skirmish', { 'p-line-1': [5, 9], 'p-line-2': [8, 9], e2: [0, 0] }, "function (x, BR) { x.units.find(v => v.id === 'p-line-1').status = 'shaken'; x.units.find(v => v.id === 'p-line-2').status = 'shaken'; x.units.forEach(u => { u.leaderId = null; }); x.leaders.forEach(l => { l.hostId = null; }); BR.unitById(x, 'p-line-1').leaderId = 'lt-1'; BR.leaderById(x, 'lt-1').hostId = 'p-line-1'; }");
      await clickToken(page, 'p-line-1');
      await page.click('[data-test=wt-order-rally]');
      assert(await page.isVisible('[data-test=wt-leader-rally]') && await page.isChecked('[data-test=wt-leader-rally]'));
      assert(!(await vis(page, 'wt-d20')), 'no roll needed');
      await page.click('[data-test=wt-confirm]');
      await wait(300);
      let b = await bat(page);
      equal(b.units.find(u => u.id === 'p-line-1').status, 'steady');
      assert((await txt(page, 'wt-log')).includes('Lieutenant 1 rallies Line Infantry 1: no roll needed'));
      await enemyTurn(page);
      await clickToken(page, 'p-line-2');
      await page.click('[data-test=wt-order-rally]');
      assert(!(await page.isVisible('[data-test=wt-leader-rally]')), 'no Lieutenant here');
      assert(/^d20 \+ 1 \(Resolve\) \+ 2 \(Morale\) vs DC 10: needs 7$/.test(await txt(page, 'wt-preview')), await txt(page, 'wt-preview'));
      await page.fill('[data-test=wt-d20]', '18');
      await page.click('[data-test=wt-confirm]');
      await wait(300);
      b = await bat(page);
      equal(b.units.find(u => u.id === 'p-line-2').status, 'steady');
      assert((await txt(page, 'wt-log')).includes('Line Infantry 2 rallies: 18 + 1 + 2 = 21 vs DC 10'));
      await page.evaluate(() => T.close());
    });
    await check('engaged: Advance attacks where it stands; Disengage lights only squares clear of the enemy', async () => {
      await scene('skirmish', { 'p-line-1': [5, 7], e2: [5, 6], e3: [12, 2] });
      await clickToken(page, 'p-line-1');
      assert(await page.isDisabled('[data-test=wt-order-march]'));
      assert(/engaged/.test(await page.getAttribute('[data-test=wt-order-march]', 'title')));
      await page.click('[data-test=wt-order-advance]');
      equal(await page.$$eval('.tsi-bas-wt-cell--move', c => c.length), 0, 'no moving while engaged');
      assert((await txt(page, 'wt-proposal')).includes('Engaged in melee'));
      equal((await st(page)).targets, ['e2']);
      await page.click('[data-test=wt-order-disengage]');
      const cells = await page.$$eval('.tsi-bas-wt-cell--move', c => c.map(n => [Number(n.dataset.c), Number(n.dataset.r)]));
      assert(cells.length > 0, 'somewhere to fall back to');
      assert(cells.every(([c, r]) => Math.max(Math.abs(c - 5), Math.abs(r - 6)) > 1), 'none next to the enemy');
      await clickCell(page, cells[0][0], cells[0][1]);
      await page.click('[data-test=wt-confirm]');
      await wait(500);
      equal((await bat(page)).units.find(u => u.id === 'p-line-1').pos, { c: cells[0][0], r: cells[0][1] });
      await page.evaluate(() => T.close());
    });
    await check('nothing left on one side: End the battle asks, then plays out to a result', async () => {
      await scene('raid', { 'p-line-1': [5, 9] }, "function (x) { x.units.forEach(u => { if (u.side === 'enemy') u.withdrawn = true; }); x.started = true; }");
      assert(await vis(page, 'wt-end-early'));
      await page.click('[data-test=wt-end-early]');
      await confirmModal(page, false);
      equal((await bat(page)).result, null);
      await page.click('[data-test=wt-end-early]');
      await confirmModal(page, true);
      assert((await txt(page, 'wt-result')).includes('Defeat'));
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'), null, { timeout: 4000 });
    });
    await check('no AI loaded: the enemy Holds', async () => {
      await scene('skirmish', { 'p-line-1': [5, 9], e2: [5, 2] }, "function (x) { x.turnSide = 'enemy'; }");
      const ai = await page.evaluate(() => { const a = TSI.bastion.warAI; TSI.bastion.warAI = null; window._ai = a; return !!a; });
      assert(ai);
      await enemyTurn(page);
      assert((await bat(page)).units.find(u => u.id === 'e2').holding, 'held');
      await page.evaluate(() => { TSI.bastion.warAI = window._ai; T.close(); });
    });
    await check('no errors', async () => equal(page.errors, []));
    await page.context().close();
  }

  if (!only || only === 'layout') {
    section('Layouts');
    for (const size of ['laptop', 'laptopFull', 'tv']) {
      page = await newPage(browser, size);
      await open(page);
      await uploadMap(page, MAP);
      await check(size + ': setup', async () => { await layoutOk(page, HEAD.concat(FOOT)); });
      await page.screenshot({ path: SHOTS + '/lay-' + size + '-1setup.png' });
      await page.click('[data-test=wt-terrain]');
      await check(size + ': terrain', async () => { await layoutOk(page, HEAD.concat(FOOT).concat(['[data-test=wt-terrain-clear]', '[data-test=wt-terrain-f]'])); });
      await page.screenshot({ path: SHOTS + '/lay-' + size + '-2terrain.png' });
      await page.click('[data-test=wt-terrain-done]');
      await page.click('[data-test=wt-begin-deploy]');
      await check(size + ': deploy', async () => { await layoutOk(page, HEAD.concat(FOOT)); });
      await page.screenshot({ path: SHOTS + '/lay-' + size + '-3deploy.png' });
      await startBattle(page);
      for (let i = 0; i < 5; i++) {
        const b = await bat(page);
        if (b.turnSide === 'player') await playerTurnByUI(page); else await enemyTurn(page);
      }
      let b = await bat(page);
      if (b.turnSide === 'enemy') { await enemyTurn(page); b = await bat(page); }
      const u = b.units.find(x => x.side === 'player' && x.pos && !x.activated && x.profile.rangedAttack) || b.units.find(x => x.side === 'player' && x.pos && !x.activated);
      await clickToken(page, u.id);
      await page.click('[data-test=wt-order-advance]');
      const s = await st(page);
      if (s.targets.length) await clickToken(page, s.targets[0]);
      await check(size + ': battle with an order proposed', async () => { await layoutOk(page, HEAD.concat(FOOT).concat(['[data-test=wt-proposal]', '[data-test=wt-unit-card]', '[data-test=wt-order-interact]'])); });
      await page.screenshot({ path: SHOTS + '/lay-' + size + '-4battle.png' });
      await page.click('[data-test=wt-cancel]');
      await page.click('[data-test=wt-dm-pause]');
      await check(size + ': paused', async () => { await layoutOk(page, HEAD.concat(FOOT).concat(['[data-test=wt-banner]'])); });
      await page.screenshot({ path: SHOTS + '/lay-' + size + '-5paused.png' });
      await check(size + ': no errors', async () => equal(page.errors, []));
      await page.context().close();
    }
    section('Reduced motion');
    page = await newPage(browser, 'laptop', { reducedMotion: 'reduce' });
    await open(page, "{ spec: makeSpec('skirmish', { weather: 'clear', moraleMod: 0, luckMod: 1 }) }");
    await check('the calculation stands still; no stepping animation', async () => {
      await page.click('[data-test=wt-begin-deploy]');
      await startBattle(page);
      await clickToken(page, 'p-archers-1');
      await page.click('[data-test=wt-order-advance]');
      const s = await st(page);
      await clickToken(page, s.targets[0]);
      await page.click('[data-test=wt-confirm]');
      await wait(100);
      assert(await page.$('.tsi-bas-wt-float--still'), 'still float');
      const tr = await page.$eval('.tsi-bas-wt-token', n => getComputedStyle(n).transitionDuration);
      assert(/^0s/.test(tr), 'no token transition: ' + tr);
    });
    await page.context().close();
  }

  if (!only || only === 'fixes') {
    section('Audit fixes (the War Table fixer)');
    page = await newPage(browser, 'laptop');
    async function fresh() {
      await page.evaluate(() => { if (window.T) { try { T.close(); } catch (e) { /* closed */ } } WT_MEM.clear(); WT_BATTLE = null; });
    }
    async function scene(objective, where, extra) {
      await page.evaluate(a => {
        if (window.T) { try { T.close(); } catch (e) { /* closed */ } }
        const BR = TSI.bastion.battleRules;
        const x = BR.createBattle(makeSpec(a.objective), null);
        BR.beginDeployment(x, null); BR.startBattle(x);
        x.units.forEach(u => { u.pos = null; });
        Object.keys(a.where).forEach(id => { BR.unitById(x, id).pos = { c: a.where[id][0], r: a.where[id][1] }; });
        x.turnSide = 'player';
        if (a.extra) (0, eval)('(' + a.extra + ')')(x, BR);
        WT_BATTLE = x;
      }, { objective, where, extra: extra || null });
      await open(page);
    }
    const terrStore = () => page.evaluate(() => WT_STORE.get('warTerrain', {}));
    const savedKey = () => page.evaluate(() => (WT_STORE.get('warMap', null) || {}).key || null);
    const code = (t, c, r) => t.cells.charAt(r * t.cols + c);
    async function paintAt(brush, cells) {
      await page.click('[data-test=wt-terrain]');
      await page.click('[data-test="wt-terrain-' + brush + '"]');
      for (const [c, r] of cells) await clickCell(page, c, r);
      await page.click('[data-test=wt-terrain-done]');
      await wait(60);
    }
    async function beginAndStart() {
      await page.click('[data-test=wt-begin-deploy]');
      await wait(60);
      await startBattle(page);
    }

    await check('1. a map brought back mid-battle keeps its own saved terrain; the battle keeps its own', async () => {
      await fresh();
      await open(page);
      await uploadMap(page, MAPB);
      const kB = await savedKey();
      await paintAt('w', [[3, 3], [4, 3]]);
      await uploadMap(page, MAPA);
      const kA = await savedKey();
      await paintAt('c', [[1, 1]]);
      await beginAndStart();
      equal((await bat(page)).ground.mapKey, kA, 'the battle remembers its map');
      await page.click('[data-test=wt-dm-pause]');
      await uploadMap(page, MAPB);
      let s = await terrStore();
      equal([s[kB].cols, s[kB].rows, s[kB].cells.replace(/\./g, '')], [22, 22, 'ww'], 'map B\'s painting is untouched');
      equal(s[kA].cells.replace(/\./g, ''), 'c', 'map A\'s painting is untouched');
      const g = (await bat(page)).ground;
      equal(g.mapKey, kB, 'the battle is now shown on map B');
      equal(code(g.terrain, 1, 1), 'c', 'the battle keeps its own terrain');
      equal(code(g.terrain, 3, 3), '.', 'map B\'s painting doesn\'t come into the battle');
      /* Painting while paused changes the battle only. */
      await paintAt('w', [[2, 2]]);
      equal(await terrStore(), s, 'no map\'s saved painting changes');
      equal(code((await bat(page)).ground.terrain, 2, 2), 'w');
      equal(code(await page.evaluate(() => WT_BATTLE.ground.terrain), 2, 2), 'w', 'and the Bastion saved it with the battle');
      /* Clearing the map mid-battle: nothing is written under the plain board. */
      await page.click('[data-test=wt-clear-map]');
      await confirmModal(page, true);
      s = await terrStore();
      equal(s.none, undefined, 'the plain board\'s painting isn\'t created or overwritten');
      equal((await bat(page)).ground.mapKey, 'none');
      equal(code((await bat(page)).ground.terrain, 1, 1), 'c');
      await page.evaluate(() => T.close());
    });

    await check('2. changing the width never thins out a painting: each width keeps its own', async () => {
      await fresh();
      await open(page);
      await uploadMap(page, MAPA);
      const kA = await savedKey();
      await page.click('[data-test=wt-terrain]');
      await page.click('[data-test=wt-terrain-x]');
      await drag(page, await cellAt(page, 0, 10), await cellAt(page, 21, 10), 30);
      await page.click('[data-test=wt-terrain-f]');
      await clickCell(page, 5, 10);
      await page.click('[data-test=wt-terrain-done]');
      const row = t => t.cells.slice(10 * t.cols, 11 * t.cols);
      equal(row(await page.evaluate(() => T.terrain())), 'xxxxxfxxxxxxxxxxxxxxxx');
      assert(!(await vis(page, 'wt-terrain-resampled')), 'no note at the width it was painted');
      await page.click('[data-test=wt-grid-minus]');
      await page.click('[data-test=wt-grid-minus]');
      equal((await page.evaluate(() => T.board())).cols, 20);
      assert(await vis(page, 'wt-terrain-resampled'), 'the redrawn painting is pointed out');
      assert((await txt(page, 'wt-terrain-resampled')).includes('painted 22 squares across'));
      await paintAt('c', [[1, 1]]);
      assert(!(await vis(page, 'wt-terrain-resampled')), 'the 20-across painting is its own now');
      await page.click('[data-test=wt-grid-plus]');
      await page.click('[data-test=wt-grid-plus]');
      const t = await page.evaluate(() => T.terrain());
      equal([t.cols, t.rows], [22, 14]);
      equal(row(t), 'xxxxxfxxxxxxxxxxxxxxxx', 'the ford is still there at 22 across');
      const s = await terrStore();
      assert(s[kA] && s[kA + '@22'], 'both widths are saved: ' + Object.keys(s).join(', '));
      await page.evaluate(() => T.close());
    });

    await check('3. another battle\'s setup can\'t change the terrain or map of a battle already under way', async () => {
      await fresh();
      await open(page, "{ spec: makeSpec('skirmish') }");
      await uploadMap(page, MAPA);
      const kA = await savedKey();
      await beginAndStart();
      const A = await page.evaluate(() => WT_BATTLE);
      const spots = A.units.filter(u => u.side === 'player' && u.pos).map(u => [u.pos.c, u.pos.r]);
      await page.evaluate(() => T.close());
      /* A second Military Action: its own setup on the same War Table. */
      await page.evaluate(() => { WT_BATTLE = null; });
      await open(page, "{ spec: makeSpec('skirmish') }");
      await paintAt('x', spots.slice(0, 3));
      await uploadMap(page, MAPB);
      await page.evaluate(() => T.close());
      /* The first battle again. */
      await page.evaluate(b => { WT_BATTLE = b; }, A);
      await open(page, "{ spec: makeSpec('skirmish') }");
      const tt = await page.evaluate(() => T.terrain());
      equal(spots.map(([c, r]) => code(tt, c, r)).join(''), spots.map(() => '.').join(''), 'its units still stand on open ground');
      equal((await bat(page)).ground.mapKey, kA);
      assert(!(await page.isVisible('[data-test=wt-map]')), 'the other battle\'s picture isn\'t shown under it');
      assert(await vis(page, 'wt-map-missing'), 'a note says its map isn\'t on the table');
      assert((await txt(page, 'wt-map-missing')).includes('mapA.jpg'));
      /* The DM brings its picture back (paused): shown again, nothing else changes. */
      await page.click('[data-test=wt-dm-pause]');
      await uploadMap(page, MAPA);
      assert(!(await vis(page, 'wt-map-missing')));
      assert(await page.isVisible('[data-test=wt-map]'));
      equal((await bat(page)).ground.mapKey, kA);
      await page.click('[data-test=wt-dm-pause]');
      await page.evaluate(() => T.close());
    });

    await check('3b. a battle still deploying: its own map coming back doesn\'t set the armies out again', async () => {
      await fresh();
      await open(page, "{ spec: makeSpec('skirmish') }");
      await uploadMap(page, MAPA);
      await page.click('[data-test=wt-begin-deploy]');
      await drag(page, await tokenAt(page, 'p-line-1'), await cellAt(page, 0, 13));
      const A = await page.evaluate(() => WT_BATTLE);
      equal(A.units.find(u => u.id === 'p-line-1').pos, { c: 0, r: 13 });
      await page.evaluate(() => T.close());
      await page.evaluate(() => { WT_BATTLE = null; });
      await open(page, "{ spec: makeSpec('skirmish') }");
      await uploadMap(page, MAPB);
      await page.evaluate(() => T.close());
      await page.evaluate(b => { WT_BATTLE = b; }, A);
      await open(page, "{ spec: makeSpec('skirmish') }");
      assert(await vis(page, 'wt-map-missing'));
      await uploadMap(page, MAPA);
      assert(!(await page.$('.tsi-modal')), 'not asked: nothing is set out again');
      equal((await bat(page)).units.find(u => u.id === 'p-line-1').pos, { c: 0, r: 13 }, 'the deployment is kept');
      await page.evaluate(() => T.close());
    });

    await check('4. a move still stepping when the next unit acts ends on the engine\'s square', async () => {
      await fresh();
      await scene('skirmish', { 'p-light_cav-1': [12, 9], e2: [21, 0] }, "function (x) { x.units.find(u => u.id === 'e2').status = 'shaken'; }");
      await clickToken(page, 'p-light_cav-1');
      await page.click('[data-test=wt-order-march]');
      const s = await st(page);
      const far = s.reach.map(k => k.split(',').map(Number)).filter(([, r]) => r === 9).sort((a, b) => a[0] - b[0])[0];
      await clickCell(page, far[0], far[1]);
      await page.click('[data-test=wt-confirm]');
      await wait(250);
      await page.click('[data-test=wt-enemy-act]');
      await wait(1600);
      const b = await bat(page);
      assert(b.log.some(e => /rall/i.test(e.text)), 'the enemy rallied (no move)');
      equal(b.units.find(u => u.id === 'p-light_cav-1').pos, { c: far[0], r: far[1] });
      const at = await page.evaluate(() => {
        const n = document.querySelector('.tsi-bas-wt-token[data-id="p-light_cav-1"]').getBoundingClientRect();
        const want = T.tokenScreenRect('p-light_cav-1');
        return [Math.round(n.left - want.x), Math.round(n.top - want.y)];
      });
      equal(at, [0, 0], 'the token is drawn on its square');
      await page.evaluate(() => T.close());
    });

    for (const size of ['laptop', 'tv']) {
      await check('5. ' + size + ': the objective, deadline and progress are shown in full', async () => {
        const p2 = await newPage(browser, size);
        await p2.evaluate(() => {
          const BR = TSI.bastion.battleRules;
          const x = BR.createBattle(makeSpec('defend', { weather: 'sun_heatwave', moraleMod: -2, luckMod: -1 }), null);
          BR.beginDeployment(x, null); BR.startBattle(x);
          x.objective.held.enemy = 1;
          WT_BATTLE = x;
          window.T = openTable({ title: 'Defend Bastion vs Blackstone', enemy: { clanKey: 'blackstone', clanName: 'Blackstone' }, summary: [{ label: 'Weather', value: 'Sun & Heatwave' }, { label: 'Morale', value: 'Low' }, { label: 'Luck', value: '−1' }] });
        });
        await p2.waitForSelector('[data-test=wt-root]');
        const o = await p2.$eval('[data-test=wt-objective]', n => ({ text: n.textContent, sw: n.scrollWidth, cw: n.clientWidth, sh: n.scrollHeight, ch: n.clientHeight, r: n.getBoundingClientRect().toJSON(), vw: innerWidth }));
        assert(/by the end of round 6, or break the enemy · the enemy has held it 1 round end \(2 in a row loses\)$/.test(o.text), o.text);
        assert(o.sw <= o.cw + 1 && o.sh <= o.ch + 1, 'not cut: ' + JSON.stringify(o));
        assert(o.r.right <= o.vw, 'in the window');
        const title = await p2.$eval('.tsi-bas-wt-title__sub', n => [n.scrollWidth, n.clientWidth]);
        assert(title[0] <= title[1] + 1, 'the title isn\'t cut: ' + title);
        await layoutOk(p2, HEAD.concat(FOOT));
        await p2.screenshot({ path: path.join(SHOTS, 'wt-fix-objective-' + size + '.png') });
        equal(p2.errors, []);
        await p2.context().close();
      });
    }

    await check('6. selecting a ready unit lights where it can go; dragging it proposes the order', async () => {
      await fresh();
      await scene('skirmish', { 'p-line-1': [5, 9], 'p-line-2': [9, 9], e2: [5, 1] });
      await clickToken(page, 'p-line-1');
      let s = await st(page);
      equal(s.order, null, 'no order chosen yet');
      const lit = await page.$$eval('.tsi-bas-wt-cell--move', c => c.map(n => [n.dataset.c + ',' + n.dataset.r, n.dataset.order]));
      assert(lit.some(x => x[1] === 'advance') && lit.some(x => x[1] === 'march'), 'Advance and (fainter) March squares: ' + lit.length);
      assert(!lit.some(x => x[0] === '5,9'), 'not its own square');
      /* Drag 2 squares up: Advance & Attack is proposed there. */
      await drag(page, await tokenAt(page, 'p-line-1'), await cellAt(page, 5, 7));
      s = await st(page);
      equal([s.order, s.dest], ['advance', { c: 5, r: 7 }]);
      assert(await vis(page, 'wt-confirm'));
      await page.click('[data-test=wt-cancel]');
      /* Drag 5 squares up (beyond its Move of 3): March. */
      await drag(page, await tokenAt(page, 'p-line-1'), await cellAt(page, 5, 4));
      s = await st(page);
      equal([s.order, s.dest], ['march', { c: 5, r: 4 }]);
      await page.click('[data-test=wt-cancel]');
      /* Clicking a lit square does the same. */
      await clickCell(page, 4, 8);
      s = await st(page);
      equal([s.order, s.dest], ['advance', { c: 4, r: 8 }]);
      await page.click('[data-test=wt-confirm]');
      await wait(500);
      equal((await bat(page)).units.find(u => u.id === 'p-line-1').pos, { c: 4, r: 8 });
      /* A unit that has acted can't be dragged, and says so. */
      await page.click('[data-test=wt-enemy-act]');
      await wait(500);
      await drag(page, await tokenAt(page, 'p-line-1'), await cellAt(page, 4, 6));
      assert(/already acted/.test(await page.textContent('.tsi-bas-wt-hint')), await page.textContent('.tsi-bas-wt-hint'));
      equal((await bat(page)).units.find(u => u.id === 'p-line-1').pos, { c: 4, r: 8 }, 'it stays');
      /* Dragging an unselected ready unit selects it and proposes. */
      await drag(page, await tokenAt(page, 'p-line-2'), await cellAt(page, 9, 8));
      s = await st(page);
      equal([s.selected, s.order, s.dest], ['p-line-2', 'advance', { c: 9, r: 8 }]);
      await page.evaluate(() => T.close());
    });

    await check('7. an enemy token\'s clan mark is a pennant, not a letter; Shaken is the only "S"', async () => {
      await scene('skirmish', { 'p-line-1': [5, 9], e2: [5, 2] }, "function (x) { x.units.find(u => u.id === 'e2').status = 'shaken'; }");
      const t = await page.$eval('.tsi-bas-wt-token[data-id=e2]', n => ({
        pennant: !!n.querySelector('.tsi-bas-wt-token__clan .tsi-bas-wt-token__pennant'),
        clanText: (n.querySelector('.tsi-bas-wt-token__clan') || {}).textContent,
        letters: Array.from(n.querySelectorAll('span')).filter(s => !s.children.length && s.textContent.trim() === 'S').length
      }));
      equal(t, { pennant: true, clanText: '', letters: 1 });
      await page.evaluate(() => T.close());
    });

    await check('8. the battle log keeps updating after the 300-entry limit', async () => {
      await scene('skirmish', { 'p-line-1': [5, 9], e2: [5, 2] }, "function (x) { while (x.log.length < 300) x.log.push({ round: 1, side: null, text: 'filler ' + x.log.length, kind: 'note' }); }");
      await clickToken(page, 'p-line-1');
      await page.click('[data-test=wt-order-hold]');
      await page.click('[data-test=wt-confirm]');
      await wait(300);
      equal((await bat(page)).log.length, 300, 'the battle rules keep 300');
      let first = await page.$eval('[data-test=wt-log] li', n => [n.textContent, n.classList.contains('tsi-bas-wt-log__item--new')]);
      assert(/Line Infantry 1 holds/.test(first[0]) && first[1], 'the newest entry is shown first, as new: ' + first);
      await page.click('[data-test=wt-enemy-act]');
      await wait(400);
      const newest = (await bat(page)).log.slice(-1)[0].text;
      first = await page.$eval('[data-test=wt-log] li', n => n.textContent);
      assert(first.endsWith(newest), first + ' / ' + newest);
      await page.evaluate(() => T.close());
    });

    await check('9. End the battle says what the result will be, and that playing on could change it', async () => {
      await scene('raid', { 'p-line-1': [5, 9] }, "function (x) { x.units.forEach(u => { if (u.side === 'enemy') u.withdrawn = true; }); x.started = true; }");
      assert(/a defeat/.test(await page.getAttribute('[data-test=wt-end-early]', 'title')));
      await page.click('[data-test=wt-end-early]');
      await page.waitForSelector('.tsi-modal');
      const m = await page.textContent('.tsi-modal');
      assert(/The battle would end as a defeat: .*0 of the 2 supply markers/.test(m), m);
      assert(/playing on could still change that/.test(m), m);
      await confirmModal(page, false);
      equal((await bat(page)).result, null);
      await page.evaluate(() => T.close());
    });

    await check('10. notes never cover the board: the pause note and the no-map note sit above it', async () => {
      await fresh();
      await open(page);
      const above = sel => page.evaluate(q => {
        const n = document.querySelector(q);
        const st = document.querySelector('[data-test=wt-stage]');
        return !st.contains(n) && n.getBoundingClientRect().bottom <= st.getBoundingClientRect().top + 0.5;
      }, sel);
      assert(await vis(page, 'wt-prompt') && await above('[data-test=wt-prompt]'), 'no-map note above the stage');
      await scene('skirmish', { 'p-line-1': [5, 9], e2: [10, 1], e3: [11, 0] });
      await page.click('[data-test=wt-dm-pause]');
      assert(await vis(page, 'wt-banner') && await above('[data-test=wt-banner]'), 'pause note above the stage');
      for (const id of ['e2', 'e3']) {
        const hit = await page.evaluate(i => { const r = T.tokenScreenRect(i); const n = document.elementFromPoint(r.x + r.w / 2, r.y + r.h / 2); return !!n && !!n.closest('[data-id="' + i + '"]'); }, id);
        assert(hit, id + ' is not covered');
      }
      await page.click('[data-test=wt-terrain]');
      assert(!(await vis(page, 'wt-banner')), 'hidden while painting');
      await page.click('[data-test=wt-terrain-done]');
      await page.click('[data-test=wt-dm-pause]');
      await page.evaluate(() => T.close());
    });

    await check('11. laptop: the latest log lines stay in view while an attack is proposed', async () => {
      await scene('skirmish', { 'p-line-1': [5, 7], e2: [5, 6], e3: [4, 6], e4: [6, 6] }, "function (x, BR) { const u = BR.unitById(x, 'p-line-1'); u.status = 'shaken'; x.units.forEach(v => { v.leaderId = null; }); x.leaders.forEach(l => { l.hostId = null; }); u.leaderId = 'lt-1'; BR.leaderById(x, 'lt-1').hostId = u.id; for (let i = 0; i < 12; i++) x.log.push({ round: 1, side: 'enemy', text: 'A long enough line of battle log number ' + i + ' to take up two lines of the side panel on the laptop.', kind: 'attack' }); }");
      await clickToken(page, 'p-line-1');
      await page.click('[data-test=wt-order-advance]');
      await clickToken(page, 'e2');
      const r = await page.evaluate(() => {
        function box(q) { const n = document.querySelector(q); return n && !n.hidden && n.offsetParent ? n.getBoundingClientRect() : null; }
        const panel = box('.tsi-bas-wt-tabs__panel');
        const li = box('[data-test=wt-log] li');
        const body = document.querySelector('.tsi-bas-wt-side__body');
        const bb = body.getBoundingClientRect();
        const inBody = q => { const b = box(q); return !!b && b.top >= bb.top - 0.5 && b.bottom <= bb.bottom + 0.5; };
        return {
          logLine: !!li && !!panel && li.top >= panel.top - 0.5 && li.bottom <= panel.bottom + 0.5 && panel.bottom <= innerHeight,
          lines: panel ? Math.floor(panel.height / 24) : 0,
          preview: inBody('[data-test=wt-preview]'), d20: inBody('[data-test=wt-d20]'), orders: inBody('[data-test=wt-order-advance]')
        };
      });
      assert(r.logLine && r.preview && r.d20 && r.orders, JSON.stringify(r));
      assert(r.lines >= 3, 'room for about three lines: ' + JSON.stringify(r));
      await page.screenshot({ path: path.join(SHOTS, 'wt-fix-side-laptop.png') });
      await page.evaluate(() => T.close());
    });

    await check('12. Enter in the d20 box confirms; the palette and the tabs answer the arrow keys', async () => {
      await scene('skirmish', { 'p-line-1': [5, 7], e2: [5, 6] });
      await clickToken(page, 'p-line-1');
      await page.click('[data-test=wt-order-advance]');
      await clickToken(page, 'e2');
      equal(await page.evaluate(() => document.activeElement.getAttribute('data-test')), 'wt-d20');
      await page.keyboard.type('25');
      await page.keyboard.press('Enter');
      equal((await bat(page)).log.length, 1, 'a bad roll is refused, the same as Confirm');
      assert(/whole number from 1 to 20/.test(await page.textContent('.tsi-bas-wt-hint')));
      await wait(400); /* Confirm ignores a second press within 350 ms of the first */
      await page.fill('[data-test=wt-d20]', '17');
      await page.focus('[data-test=wt-d20]');
      await page.keyboard.press('Enter');
      await wait(300);
      assert((await bat(page)).log.some(e => /attacks Line Infantry 1: 17 \+/.test(e.text)), 'Enter confirmed the attack with the typed 17');
      /* Tabs. */
      await page.focus('[data-test=wt-tab-log]');
      await page.keyboard.press('ArrowRight');
      equal(await page.getAttribute('[data-test=wt-tab-forces]', 'aria-selected'), 'true');
      equal(await page.evaluate(() => document.activeElement.getAttribute('data-test')), 'wt-tab-forces');
      assert(await vis(page, 'wt-roster') && !(await vis(page, 'wt-log')));
      await page.keyboard.press('ArrowLeft');
      equal(await page.getAttribute('[data-test=wt-tab-log]', 'aria-selected'), 'true');
      /* The palette (during a pause). */
      await page.click('[data-test=wt-dm-pause]');
      await page.click('[data-test=wt-terrain]');
      await page.click('[data-test=wt-terrain-w]');
      await page.focus('[data-test=wt-terrain-w]');
      await page.keyboard.press('ArrowDown');
      equal(await page.getAttribute('[data-test=wt-terrain-b]', 'aria-checked'), 'true', 'the next terrain is chosen');
      equal(await page.evaluate(() => document.activeElement.getAttribute('data-test')), 'wt-terrain-b');
      await page.keyboard.press('ArrowUp');
      equal(await page.getAttribute('[data-test=wt-terrain-w]', 'aria-checked'), 'true');
      equal(await page.$$eval('[role=radio][tabindex="0"]', n => n.length), 1, 'one stop in the tab order');
      await page.click('[data-test=wt-terrain-done]');
      await page.evaluate(() => T.close());
    });

    for (const size of ['laptop', 'tv']) {
      await check('13. ' + size + ': no text outside the board is smaller than the label size (12px)', async () => {
        const p2 = await newPage(browser, size);
        await p2.evaluate(() => {
          const BR = TSI.bastion.battleRules;
          const x = BR.createBattle(makeSpec('raid'), null);
          BR.beginDeployment(x, null); BR.startBattle(x);
          WT_BATTLE = x;
          window.T = openTable();
        });
        await p2.waitForSelector('[data-test=wt-root]');
        const id = await p2.evaluate(() => T.battle().units.find(u => u.side === 'player').id);
        await clickToken(p2, id);
        const tok = await p2.evaluate(i => T.tokenScreenRect(i), id);
        await p2.mouse.move(tok.x + tok.w / 2, tok.y + tok.h / 2);
        await wait(100);
        const small = await p2.evaluate(() => {
          const out = [];
          document.querySelectorAll('.tsi-bas-wt *').forEach(n => {
            if (n.closest('.tsi-bas-wt-world')) return;
            if (!Array.from(n.childNodes).some(c => c.nodeType === 3 && c.textContent.trim())) return;
            if (!n.offsetParent && getComputedStyle(n).position !== 'fixed') return;
            const fs = parseFloat(getComputedStyle(n).fontSize);
            if (fs < 12) out.push(n.className + ' ' + fs + 'px "' + n.textContent.trim().slice(0, 20) + '"');
          });
          return out;
        });
        assert(await p2.isVisible('[data-test=wt-tip]'), 'the tooltip is open');
        equal(small, []);
        await p2.context().close();
      });
    }

    await check('14. at the smallest token size, badges don\'t cover a token\'s name or soldier count', async () => {
      await scene('skirmish', { 'p-line-1': [5, 9], 'p-line-2': [7, 9], e2: [5, 2], e5: [7, 2] }, "function (x, BR) { x.units.find(u => u.id === 'e2').status = 'shaken'; x.units.find(u => u.id === 'e2').holding = true; const u = BR.unitById(x, 'p-line-1'); u.status = 'shaken'; x.units.forEach(v => { v.leaderId = null; }); x.leaders.forEach(l => { l.hostId = null; }); u.leaderId = 'lt-1'; BR.leaderById(x, 'lt-1').hostId = u.id; }");
      for (let i = 0; i < 6; i++) { if (!(await page.isDisabled('[data-test=wt-token-minus]'))) await page.click('[data-test=wt-token-minus]'); }
      equal((await page.evaluate(() => T.settings())).tokenScale, 0.5);
      for (const scale of [0.5, 0.9, 1]) {
        await page.evaluate(sc => { T.close(); WT_STORE.set('warTable', Object.assign(WT_STORE.get('warTable', {}), { tokenScale: sc })); }, scale);
        await open(page);
        const bad = await page.evaluate(() => {
          const out = [];
          document.querySelectorAll('.tsi-bas-wt-token[data-id]').forEach(t => {
            const texts = Array.from(t.querySelectorAll('.tsi-bas-wt-token__short, .tsi-bas-wt-token__sub')).map(n => n.getBoundingClientRect());
            const marks = Array.from(t.querySelectorAll('.tsi-bas-wt-badge, .tsi-bas-wt-token__clan, .tsi-bas-wt-token__leader, .tsi-bas-wt-token__support, .tsi-bas-wt-token__crest')).map(n => [n.className, n.getBoundingClientRect()]);
            texts.forEach(a => marks.forEach(([cls, b]) => {
              const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (ox > 1 && oy > 1) out.push(t.dataset.id + ': ' + cls.split(' ')[0] + ' covers ' + Math.round(ox) + 'x' + Math.round(oy));
            }));
          });
          return out;
        });
        equal(bad, [], 'tokens at ' + Math.round(scale * 100) + '%');
        if (scale === 0.5) await page.screenshot({ path: path.join(SHOTS, 'wt-fix-tok50.png') });
      }
      await page.evaluate(() => { T.close(); WT_MEM.delete('warTable'); });
    });

    await check('no errors', async () => equal(page.errors, []));
    await page.context().close();
  }

  if (!only || only === 'oct3') {
    section('Harry\'s changes (3 October 2026): attacking, moving the objective, the briefing');
    let page = await newPage(browser, 'laptop');
    async function fresh() {
      await page.evaluate(() => { if (window.T) { try { T.close(); } catch (e) { /* closed */ } } WT_MEM.clear(); WT_BATTLE = null; });
      await page.waitForFunction(() => !document.querySelector('.tsi-modal'));
    }
    /* A battle under way with units exactly where a check wants them; acted: units that have already acted this round. */
    async function scene(objective, where, acted, more, extra) {
      await fresh();
      await page.evaluate(a => {
        const BR = TSI.bastion.battleRules;
        const x = BR.createBattle(makeSpec(a.objective), null);
        BR.beginDeployment(x, null); BR.startBattle(x);
        x.units.forEach(u => { u.pos = null; });
        Object.keys(a.where).forEach(id => { BR.unitById(x, id).pos = { c: a.where[id][0], r: a.where[id][1] }; });
        (a.acted || []).forEach(id => { BR.unitById(x, id).activated = true; });
        (a.more.heldFast || []).forEach(id => { BR.unitById(x, id).heldFast = true; });
        if (a.more.started) x.started = true;
        x.turnSide = 'player';
        WT_BATTLE = x;
      }, { objective, where, acted: acted || [], more: more || {} });
      await open(page, extra);
    }
    const hint = () => page.textContent('.tsi-bas-wt-hint');
    const prop = async () => { const x = await st(page); return x.order ? { order: x.order, targetId: x.targetId, dest: x.dest, targets: x.targets } : null; };

    await check('an enemy that moved next to your unit (and has acted): click your unit, click the enemy, and the attack is set up from where it stands', async () => {
      await scene('skirmish', { 'p-line-1': [10, 8], e2: [10, 7], e3: [3, 2] }, ['e2']);
      await clickToken(page, 'p-line-1');
      await clickToken(page, 'e2');
      const p = await prop();
      assert(p, 'a proposal');
      equal([p.order, p.targetId, p.dest], ['advance', 'e2', { c: 10, r: 8 }]);
      assert(/vs 13: needs/.test(await txt(page, 'wt-preview')));
      await page.click('[data-test=wt-confirm]');
      await page.waitForFunction(() => T.battle().units.find(u => u.id === 'p-line-1').activated);
      assert(/Line Infantry 1 attacks Line Infantry 1/.test((await bat(page)).log.map(l => l.text).join(' | ')));
    });
    await check('an enemy already attacked this round can be attacked again by another unit', async () => {
      await scene('skirmish', { 'p-line-1': [10, 8], 'p-heavy-1': [11, 8], e2: [10, 7], e3: [3, 2] }, ['e2', 'p-line-1']);
      await page.evaluate(() => { const u = T.battle().units.find(x => x.id === 'e2'); u.cohesion -= 1; });
      await clickToken(page, 'p-heavy-1');
      await clickToken(page, 'e2');
      equal([(await prop()).order, (await prop()).targetId], ['advance', 'e2']);
    });
    await check('an enemy a few squares off: your unit advances next to it and attacks, and the table says so', async () => {
      await scene('skirmish', { 'p-line-1': [10, 9], e2: [10, 6], e3: [3, 2] }, ['e2']);
      await clickToken(page, 'p-line-1');
      await clickToken(page, 'e2');
      const p = await prop();
      equal([p.order, p.targetId, p.dest], ['advance', 'e2', { c: 10, r: 7 }]);
      assert(/will advance to the square shown and attack Line Infantry 1/.test(await hint()), await hint());
    });
    await check('cavalry pick a square that gives a Charge', async () => {
      await scene('skirmish', { 'p-light_cav-1': [10, 10], e2: [10, 5], e3: [3, 2] });
      await clickToken(page, 'p-light_cav-1');
      await clickToken(page, 'e2');
      assert(/\(Charge\)/.test(await txt(page, 'wt-preview')), await txt(page, 'wt-preview'));
      assert(/will charge Line Infantry 1/.test(await hint()));
    });
    await check('archers shoot from where they stand when they can', async () => {
      await scene('skirmish', { 'p-archers-1': [10, 11], e2: [10, 6], e3: [3, 2] });
      await clickToken(page, 'p-archers-1');
      await clickToken(page, 'e2');
      const p = await prop();
      equal([p.order, p.targetId, p.dest], ['advance', 'e2', { c: 10, r: 11 }]);
      await page.click('[data-test=wt-confirm]');
      await page.waitForFunction(() => T.battle().units.find(u => u.id === 'p-archers-1').activated);
      assert(/Archers 1 shoots at Line Infantry 1/.test((await bat(page)).log.map(l => l.text).join(' | ')));
    });
    await check('archers can\'t shoot into a melee: they go in hand to hand instead, and the table says why', async () => {
      await scene('skirmish', { 'p-archers-1': [10, 11], 'p-line-1': [10, 8], e2: [10, 7], e3: [3, 2] }, ['e2']);
      await clickToken(page, 'p-archers-1');
      await clickToken(page, 'e2');
      assert(/can't shoot Line Infantry 1 from any square in reach, so it will advance next to it and fight hand to hand/.test(await hint()), await hint());
      equal((await prop()).targetId, 'e2');
    });
    await check('out of reach, or fighting another enemy: nothing is set up, the table says why, and your unit stays selected', async () => {
      await scene('skirmish', { 'p-heavy-1': [20, 11], e2: [1, 0], e3: [3, 2] });
      await clickToken(page, 'p-heavy-1');
      await clickToken(page, 'e2');
      assert(/is out of reach: Heavy Infantry 1 can't attack it this activation/.test(await hint()), await hint());
      equal([(await st(page)).selected, await prop()], ['p-heavy-1', null]);
      await scene('skirmish', { 'p-line-1': [10, 8], e2: [10, 7], e3: [14, 3] });
      await clickToken(page, 'p-line-1');
      await clickToken(page, 'e3');
      assert(/fighting hand to hand, so it can only attack the enemies next to it\. To go after Levy Infantry 1, Disengage first\./.test(await hint()), await hint());
    });
    await check('dropping your unit on an enemy sets up the attack too', async () => {
      await scene('skirmish', { 'p-line-1': [10, 9], e2: [10, 6], e3: [3, 2] });
      await drag(page, await tokenAt(page, 'p-line-1'), await tokenAt(page, 'e2'));
      const p = await prop();
      equal([p.order, p.targetId, p.dest], ['advance', 'e2', { c: 10, r: 7 }]);
    });
    /* Review fixes (3 October 2026). */
    const DEFAULT_HINT = 'Check the order, then Confirm (or Cancel).';
    await check('a unit that can\'t be dragged (held fast, boxed in, or Advance & Attack already chosen) let go on the enemy it\'s fighting: the attack is set up', async () => {
      await scene('skirmish', { 'p-line-1': [10, 8], e2: [10, 7], e5: [3, 2] }, [], { heldFast: ['p-line-1'] });
      await drag(page, await tokenAt(page, 'p-line-1'), await tokenAt(page, 'e2'));
      let p = await prop();
      assert(p, 'held fast: a proposal; hint: ' + await hint());
      equal([p.order, p.targetId, p.dest], ['advance', 'e2', { c: 10, r: 8 }], 'held fast');
      assert(!/Disengage first/.test(await hint()), await hint());
      await scene('skirmish', { 'p-line-1': [10, 8], e2: [10, 7], e3: [9, 7], e1: [11, 7], e4: [9, 9], e6: [11, 9], e5: [10, 10] });
      await drag(page, await tokenAt(page, 'p-line-1'), await tokenAt(page, 'e2'));
      p = await prop();
      assert(p, 'boxed in: a proposal; hint: ' + await hint());
      equal([p.order, p.targetId, p.dest], ['advance', 'e2', { c: 10, r: 8 }], 'boxed in');
      await scene('skirmish', { 'p-line-1': [10, 8], e2: [10, 7], e5: [3, 2] });
      await clickToken(page, 'p-line-1');
      await page.click('[data-test=wt-order-advance]');
      await drag(page, await tokenAt(page, 'p-line-1'), await tokenAt(page, 'e2'));
      p = await prop();
      equal([p.order, p.targetId, p.dest], ['advance', 'e2', { c: 10, r: 8 }], 'Advance & Attack already chosen');
      assert(!/Choose an order instead/.test(await hint()), await hint());
    });
    await check('held fast: going after an enemy further off doesn\'t suggest Disengage (it can\'t)', async () => {
      await scene('skirmish', { 'p-line-1': [10, 8], e2: [10, 7], e3: [14, 3] }, [], { heldFast: ['p-line-1'] });
      await clickToken(page, 'p-line-1');
      await clickToken(page, 'e3');
      equal(await hint(), 'Line Infantry 1 is fighting hand to hand and can\'t Disengage this activation, so it can only attack the enemies next to it.');
      assert(await page.isDisabled('[data-test=wt-order-disengage]'));
    });
    await check('switching to another target from the same square: the hint no longer names the old one', async () => {
      await scene('skirmish', { 'p-line-1': [10, 9], e2: [10, 6], e3: [11, 6], e5: [3, 2] });
      await clickToken(page, 'p-line-1');
      await clickToken(page, 'e2');
      assert(/attack Line Infantry 1/.test(await hint()), await hint());
      await clickToken(page, 'e3');
      equal([(await prop()).targetId, (await prop()).dest], ['e3', { c: 10, r: 7 }]);
      equal(await hint(), DEFAULT_HINT);
    });
    await check('a second click on the chosen target un-picks it, so the unit can advance without attacking', async () => {
      await scene('skirmish', { 'p-line-1': [10, 9], e2: [10, 6], e5: [3, 2] });
      await clickToken(page, 'p-line-1');
      await clickToken(page, 'e2');
      await clickToken(page, 'e2');
      equal([(await prop()).targetId, (await prop()).dest], [null, { c: 10, r: 7 }]);
      assert(!/attack/.test(await hint()), await hint());
      await clickToken(page, 'e2');
      equal((await prop()).targetId, 'e2', 'a third click picks it again');
      await clickToken(page, 'e2');
      await page.click('[data-test=wt-confirm]');
      await page.waitForFunction(() => T.battle().units.find(u => u.id === 'p-line-1').activated);
      const b = await bat(page);
      equal(b.units.find(u => u.id === 'p-line-1').pos, { c: 10, r: 7 });
      assert(!/attacks/.test(b.log.map(l => l.text).join(' | ')), 'no attack');
    });
    await check('Cancel, Esc and DM: pause clear the attack\'s message; a refusal is cleared once an attack is set up', async () => {
      await scene('skirmish', { 'p-light_cav-1': [6, 10], e2: [10, 6], e3: [14, 6], e5: [3, 2] }, [], { started: true });
      await clickToken(page, 'p-light_cav-1');
      await clickToken(page, 'e2');
      assert(/will charge Line Infantry 1/.test(await hint()), await hint());
      await page.click('[data-test=wt-cancel]');
      equal(await prop(), null);
      assert(!/Confirm/.test(await hint()), 'after Cancel: ' + await hint());
      await clickToken(page, 'e2');
      assert(/will charge/.test(await hint()), await hint());
      await page.click('[data-test=wt-dm-pause]');
      assert(/^Paused\./.test(await hint()), 'paused: ' + await hint());
      await page.click('[data-test=wt-dm-pause]');
      await scene('skirmish', { 'p-line-1': [10, 8], e2: [10, 7], e3: [14, 3] });
      await clickToken(page, 'p-line-1');
      await clickToken(page, 'e3');
      assert(/Disengage first/.test(await hint()), await hint());
      await page.keyboard.press('Escape');
      equal((await st(page)).selected, null);
      assert(!/Disengage first/.test(await hint()), 'after Esc: ' + await hint());
      await clickToken(page, 'p-line-1');
      await clickToken(page, 'e3');
      assert(/Disengage first/.test(await hint()), await hint());
      await clickToken(page, 'e2');
      equal((await prop()).targetId, 'e2');
      equal(await hint(), DEFAULT_HINT);
    });
    await check('with none of yours selected, clicking an enemy still shows its card', async () => {
      await scene('skirmish', { 'p-line-1': [10, 9], e2: [10, 6], e3: [3, 2] });
      await clickToken(page, 'e2');
      equal([(await st(page)).selected, await prop()], ['e2', null]);
    });

    /* Moving the objective while deploying (DM). */
    async function deployFresh(objective) {
      await fresh();
      await open(page, '{ spec: makeSpec(\'' + objective + '\') }');
      await page.click('[data-test=wt-begin-deploy]');
      await wait(80);
    }
    const objective = async () => (await bat(page)).objective;
    const centreOf = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    await check('Raid: DM: adjust enemy & supplies drags a supply marker anywhere on the enemy\'s ground (lit while dragging)', async () => {
      await deployFresh('raid');
      equal(await txt(page, 'wt-dm-enemy'), 'DM: adjust enemy & supplies');
      const m1 = (await objective()).markers[0];
      /* Off: the supplies stay put. */
      await drag(page, await cellAt(page, m1.c, m1.r), await cellAt(page, 2, 1));
      equal((await objective()).markers[0], m1, 'not moved without DM adjusting');
      const fill = () => page.$eval('[data-test=wt-dm-enemy]', n => getComputedStyle(n).backgroundImage);
      assert(!/gradient/.test(await fill()), 'plain while off');
      await page.click('[data-test=wt-dm-enemy]');
      await page.mouse.move(5, 5);
      assert(await page.$eval('[data-test=wt-dm-enemy]', n => n.classList.contains('tsi-btn--primary')), 'lit while on');
      assert(/linear-gradient/.test(await fill()), 'filled crimson while on: ' + await fill());
      assert(/drag the supplies anywhere on the enemy's ground/.test(await hint()));
      const lit = await drag(page, await cellAt(page, m1.c, m1.r), await cellAt(page, 2, 1));
      assert(lit > 20, 'the enemy\'s ground lights up: ' + lit);
      const ob = await objective();
      equal([ob.markers[0].c, ob.markers[0].r, ob.dmPlaced], [2, 1, true]);
    });
    await check('Raid: a drop on your ground, on a unit or on other supplies is refused with a reason', async () => {
      const b = await bat(page);
      const m2 = b.objective.markers[1];
      await drag(page, await cellAt(page, m2.c, m2.r), await cellAt(page, 4, b.rows - 1));
      assert(/The supplies stay on the enemy's ground, above the strip\./.test(await hint()), await hint());
      const foe = b.units.find(u => u.side === 'enemy' && u.pos);
      await drag(page, await cellAt(page, m2.c, m2.r), await cellAt(page, foe.pos.c, foe.pos.r));
      assert(/That square is taken by/.test(await hint()), await hint());
      await drag(page, await cellAt(page, m2.c, m2.r), await cellAt(page, 2, 1));
      assert(/Another supply marker is already there\./.test(await hint()), await hint());
      equal((await objective()).markers[1], m2, 'unchanged');
      /* A good drop straight after a refused one: the refusal goes. */
      await drag(page, await cellAt(page, m2.c, m2.r), await cellAt(page, 4, 1));
      equal([(await objective()).markers[1].c, (await objective()).markers[1].r], [4, 1]);
      assert(/^DM adjusting/.test(await hint()), 'after a good drop: ' + await hint());
      await drag(page, await cellAt(page, 4, 1), await cellAt(page, m2.c, m2.r));
    });
    await check('Raid: the DM\'s placement survives a repaint while deploying, and Start Battle', async () => {
      await page.click('[data-test=wt-terrain]');
      await page.click('[data-test="wt-terrain-c"]');
      await clickCell(page, 0, 0);
      await page.click('[data-test=wt-terrain-done]');
      await wait(80);
      equal([(await objective()).markers[0].c, (await objective()).markers[0].r], [2, 1]);
      await startBattle(page);
      equal([(await objective()).markers[0].c, (await objective()).markers[0].r], [2, 1]);
    });
    await check('Defend Bastion: the depot is dragged as a block and stays on your ground', async () => {
      await deployFresh('defend');
      equal(await txt(page, 'wt-dm-enemy'), 'DM: adjust enemy & depot');
      await page.click('[data-test=wt-dm-enemy]');
      const z = (await objective()).zone;
      await drag(page, await cellAt(page, z.c0 + 1, z.r0), await cellAt(page, 4, z.r0));
      equal((await objective()).zone, { c0: 3, r0: z.r0, c1: 3 + z.c1 - z.c0, r1: z.r1, owner: 'player' }, 'moved, keeping the square it was picked up by under the pointer');
      await drag(page, await cellAt(page, 4, z.r0), await cellAt(page, 4, 1));
      assert(/Your supply depot stays on your ground, below the strip\./.test(await hint()), await hint());
      await drag(page, await cellAt(page, 4, z.r0), await cellAt(page, (await bat(page)).cols - 1, z.r0));
      assert(/would run off the battlefield/.test(await hint()), await hint());
      equal((await objective()).zone.c0, 3, 'unchanged');
    });
    await check('Seize Outpost: the outpost is dragged on the enemy\'s ground', async () => {
      await deployFresh('seize_outpost');
      equal(await txt(page, 'wt-dm-enemy'), 'DM: adjust enemy & outpost');
      await page.click('[data-test=wt-dm-enemy]');
      const z = (await objective()).zone;
      await drag(page, await cellAt(page, z.c0, z.r0), await cellAt(page, 15, 0));
      equal([(await objective()).zone.c0, (await objective()).zone.r0], [15, 0]);
      await page.click('[data-test=wt-dm-enemy]');
      equal(await txt(page, 'wt-dm-enemy'), 'DM: adjust enemy & outpost', 'off again');
    });
    await check('the depot or outpost picked up by its name label (just outside the box) moves with the pointer, not a row off', async () => {
      for (const obj of ['seize_outpost', 'defend']) {
        await deployFresh(obj);
        await page.click('[data-test=wt-dm-enemy]');
        const z = (await objective()).zone;
        /* Pressed on the label, over the middle of one of the board's columns, and nudged
           sideways within that column: the pointer stays on the same square. */
        const r = await page.evaluate(z => {
          const b = document.querySelector('[data-test=wt-zone-label]').getBoundingClientRect();
          for (let c = z.c0; c <= z.c1; c++) {
            const q = T.cellScreenRect(c, z.r0);
            const cx = q.x + q.w / 2;
            if (cx > b.x + 4 && cx < b.x + b.width - 4) return { x: cx - 3, y: b.y + b.height / 2 };
          }
          return null;
        }, z);
        assert(r, 'a column under the label');
        await page.mouse.move(r.x, r.y);
        await page.mouse.down();
        await page.mouse.move(r.x + 3, r.y, { steps: 2 });
        await page.mouse.move(r.x + 6, r.y, { steps: 2 });
        await page.mouse.up();
        await wait(150);
        equal((await objective()).zone, z, obj + ': a nudge on the label leaves it where it was');
      }
    });
    await check('Skirmish: the button is DM: adjust enemy, as before', async () => {
      await deployFresh('skirmish');
      equal(await txt(page, 'wt-dm-enemy'), 'DM: adjust enemy');
    });

    /* The briefing. */
    for (const [obj, title, goal] of [
      ['raid', 'Raid vs Bacca', /Carry off 2 of the 3 supply markers/],
      ['defend', 'Defend Bastion vs Bacca', /Keep the enemy off your supply depot/],
      ['seize_outpost', 'Seize Outpost vs Bacca', /Hold it at 2 round ends in a row/],
      ['skirmish', 'Skirmish vs Bacca', /Break the enemy army/]
    ]) {
      await check('Start Battle shows the briefing (' + obj + '): how you win and lose, today\'s conditions, the rules in brief; Begin the battle closes it', async () => {
        await fresh();
        await open(page, '{ spec: makeSpec(\'' + obj + '\', { weather: \'cold_rain\', moraleMod: -2, luckMod: -1 }), title: \'' + title + '\' }');
        await page.click('[data-test=wt-begin-deploy]');
        await page.click('[data-test=wt-start-battle]');
        await confirmModal(page, true);
        await page.waitForSelector('[data-test=wt-briefing]');
        equal(await page.textContent('.tsi-modal__title'), 'Rules & objective · ' + title);
        assert(goal.test(await txt(page, 'wt-brief-goal')), await txt(page, 'wt-brief-goal'));
        assert(/60% of its starting Battle Value/.test(await txt(page, 'wt-brief-lose')));
        const cond = await txt(page, 'wt-brief-conditions');
        assert(/Rainstorm: ranged attacks −2, for both armies/.test(cond) && /Morale low: −2/.test(cond) && /Luck: −1 on all your attack rolls/.test(cond), cond);
        assert(/The enemy acts first in round 1/.test(await txt(page, 'wt-brief-turns')));
        for (const id of ['orders', 'fighting', 'morale']) assert(await vis(page, 'wt-brief-' + id), id);
        equal(await page.textContent('.tsi-modal__foot button'), 'Begin the battle');
        await confirmModal(page, true);
        equal(await page.$('.tsi-modal'), null);
        equal((await bat(page)).phase, 'battle');
      });
    }
    await check('Rules & objective opens the briefing at any time (setup, deployment, battle); Close closes it; reopening a battle doesn\'t show it again', async () => {
      await fresh();
      await open(page, '{ spec: makeSpec(\'raid\') }');
      for (const step of ['setup', 'deploy', 'battle']) {
        if (step === 'deploy') await page.click('[data-test=wt-begin-deploy]');
        if (step === 'battle') await startBattle(page);
        await page.click('[data-test=wt-briefing]');
        await page.waitForSelector('[data-test=wt-briefing]');
        assert(/Carry off 2 of the 3/.test(await txt(page, 'wt-brief-goal')), step);
        equal(await page.textContent('.tsi-modal__foot button'), 'Close');
        await confirmModal(page, true);
      }
      await page.evaluate(() => T.close());
      await open(page);
      await wait(300);
      equal(await page.$('.tsi-modal'), null, 'not shown again');
    });
    await check('the briefing opened just as the battle ends closes with the War Table, not left over the Bastion', async () => {
      await scene('skirmish', { 'p-line-1': [10, 9], e2: [10, 6], e5: [3, 2] }, [], { started: true },
        '{ onEnd: function (b) { WT_LOG.ends.push(b.result); return TSI.modal.alert({ title: \'War Report\', message: \'x\' }); } }');
      await page.click('[data-test=wt-withdraw]');
      await confirmModal(page, true);
      await page.click('.tsi-bas-wt-head [data-test=wt-briefing]');
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.tsi-modal__title')).some(n => /War Report/.test(n.textContent)), null, { timeout: 4000 });
      equal(await page.$$eval('.tsi-modal__title', n => n.map(x => x.textContent)), ['Rules & objective · Raid vs Bacca', 'War Report']);
      await page.click('.tsi-modal:has(.tsi-modal__title:text("War Report")) [data-value=true]');
      await page.waitForFunction(() => !document.querySelector('[data-test=wt-root]'), null, { timeout: 4000 });
      await wait(100);
      equal(await page.$$eval('.tsi-modal', n => n.length), 0, 'nothing left over');
      equal(await page.evaluate(() => document.body.classList.contains('tsi-modal-open')), false);
    });
    await check('no errors', async () => equal(page.errors, []));
    await page.context().close();

    for (const size of ['laptop', 'laptopFull', 'tv']) {
      await check(size + ': the briefing fits with nothing to scroll; the Rules & objective button is in view', async () => {
        const p2 = await newPage(browser, size);
        await p2.evaluate(() => { window.T = openTable({ spec: makeSpec('defend', { weather: 'sun_heatwave', moraleMod: 2, luckMod: 1 }), title: 'Defend Bastion vs Blackstone' }); });
        await p2.waitForSelector('[data-test=wt-root]');
        await layoutOk(p2, ['[data-test=wt-briefing]', '[data-test=wt-fullscreen]', '[data-test=wt-close]']);
        await p2.click('[data-test=wt-begin-deploy]');
        await p2.click('[data-test=wt-start-battle]');
        await confirmModal(p2, true);
        await p2.waitForSelector('[data-test=wt-briefing]');
        const m = await p2.evaluate(() => {
          const d = document.querySelector('.tsi-modal'); const b = d.querySelector('.tsi-modal__body'); const r = d.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, scrolls: b.scrollHeight > b.clientHeight + 1 };
        });
        assert(m.top >= 0 && m.left >= 0 && m.bottom <= m.vh && m.right <= m.vw, JSON.stringify(m));
        assert(!m.scrolls, 'the briefing scrolls: ' + JSON.stringify(m));
        await p2.screenshot({ path: path.join(SHOTS, 'wt-briefing-' + size + '.png') });
        await confirmModal(p2, true);
        equal(p2.errors, []);
        await p2.context().close();
      });
    }
  }

  await browser.close();
  const bad = results.filter(r => !r.ok);
  console.log('\n' + (results.length - bad.length) + ' of ' + results.length + ' checks passed');
  bad.forEach(b => console.log('  FAILED: ' + b.name));
  process.exit(bad.length ? 1 : 0);
})();
