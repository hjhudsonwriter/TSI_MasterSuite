/* Phase 8: the Scarlett Isles Explorer, clicked through from a double-clicked
   index.html with the internet off, at Harry's laptop size, full screen and
   the TV. Then the same journey, with the same dice, in the old Explorer and
   the rebuild, compared step by step.
   Run with:  node tests/e2e/phase8.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const EXPLORER = INDEX + '?tool=explorer';
const LEGACY_DIR = path.join(H.ROOT, '_legacy/scarlett-isles-explorer');
const HAS_LEGACY = fs.existsSync(path.join(LEGACY_DIR, 'app.js'));
const MAP_SRC = path.join(H.ROOT, 'tools/arenas/assets/maps/middlemount_lions_crown.png');
const BIG = path.join(H.ROOT, 'tools/explorer/assets/submaps/goldport.png');   /* 5.97 MB */

/* Before the page loads: seedable dice, and a storage that can pretend to be full. */
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
      if (window.__failSaves && value && typeof value.key === 'string' && value.key.indexOf('tsi.explorer.') === 0) {
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
async function openExplorer(page) {
  await page.goto(EXPLORER);
  await page.waitForSelector('[data-test=camp]');
}
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const text = (page, test) => page.textContent('[data-test=' + test + ']');
const pause = page => page.waitForTimeout(400);
async function loadMap(page, id) {
  await page.selectOption('[data-test=map-select]', id);
  await page.click('[data-test=load]');
  await page.waitForTimeout(150);
}
async function tokHex(page, id) {
  return page.evaluate(id => {
    const R = TSI.explorer.rules, s = TSI.explorer.debug.state();
    return R.tokenHex(s, TSI.explorer.debug.board(), R.token(s, id));
  }, id);
}
/* One hex step on screen, for the current map size. */
async function hexVector(page, dq, dr) {
  return page.evaluate(([dq, dr]) => {
    const s = TSI.explorer.debug.state(), v = TSI.explorer.debug.view();
    const r = TSI.explorer.rules.hexSize(s.grid) * v.fit;
    return { x: r * Math.sqrt(3) * (dq + dr / 2), y: r * 1.5 * dr };
  }, [dq, dr]);
}
async function drag(page, from, by) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(from.x + by.x * i / 20, from.y + by.y * i / 20);
  await page.mouse.up();
  await page.waitForTimeout(120);
}
async function dragHex(page, id, dq, dr) {
  const at = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), id);
  await drag(page, at, await hexVector(page, dq, dr));
}
async function leaveFullscreen(page) {
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.waitForTimeout(200);
}
async function modalOpen(page) { return !!(await page.$('.tsi-modal')); }
/* What an event pop-up shows. */
async function eventView(page) {
  return page.evaluate(() => {
    const m = document.querySelector('.tsi-modal');
    if (!m) return null;
    const img = m.querySelector('.tsi-exp-event-media:not([hidden]) img');
    const q = s => { const e = m.querySelector(s); return e ? e.textContent : ''; };
    return {
      meta: q('.tsi-modal__title'),
      title: q('.tsi-exp-event-title'),
      desc: q('.tsi-exp-event-desc'),
      img: img ? img.getAttribute('src').split('/').pop() : '',
      choices: Array.from(m.querySelectorAll('.tsi-exp-choice')).map(b => b.textContent),
      roll: !!m.querySelector('[data-test=roll]')
    };
  });
}
async function closePopup(page) {
  await pause(page);
  /* Harry's new event window: skip it if nothing has happened yet, otherwise close it and end it. */
  if (await page.$('.tsi-modal [data-test=skip-event]:not([hidden])')) {
    await page.click('.tsi-modal [data-test=skip-event]');
  } else if (await page.$('.tsi-modal.tsi-exp-journey')) {
    await page.click('.tsi-modal.tsi-exp-journey .tsi-modal__foot button:text-is("Close")');
    await page.waitForTimeout(450);
    await H.clickModal(page, 'End it now');
  } else if (await page.$('.tsi-modal__foot button:text-is("Close")')) {
    await page.click('.tsi-modal__foot button:text-is("Close")');
  } else {
    await page.click('.tsi-modal__foot button');
  }
  await page.waitForTimeout(150);
}
/* A Bastion save (in days, following the Explorer) with one order due on
   the given day, for "The Ironbow sends word…" at Make Camp. The Explorer
   only reads it. */
async function seedBastion(page, dueDay, today) {
  await page.evaluate(([due, d]) => TSI.store.set('tsi.bastion.state', {
    v: 2, day: d, anchored: true, treasuryGP: 0, partyLevel: 7, builtExtras: [], warehouse: [], defenders: { count: 0, armed: false, patrolUntil: 0 },
    pendingOrders: [{ id: 'o1', facId: 'barracks', fnId: 'recruit_defenders', label: 'Barracks: Recruit Defenders', costGP: 0, issuedDay: d, dueDay: due }]
  }), [dueDay, today]);
}
/* Force the event dice: travelChance and campChance (0 to 1). */
async function chances(page, travel, camp) {
  await page.evaluate(([t, c]) => { TSI_DATA.journeyEvents.settings.travelChance = t; TSI_DATA.journeyEvents.settings.campChance = c; }, [travel, camp]);
}
/* What the new event window shows. */
async function journeyView(page) {
  return page.evaluate(() => {
    const m = document.querySelector('.tsi-modal.tsi-exp-journey');
    if (!m) return null;
    const q = s => { const e = m.querySelector(s); return e && !e.hidden ? e.textContent : ''; };
    return {
      meta: q('.tsi-modal__title'), title: q('[data-test=journey-title]'), line: q('[data-test=journey-line]'),
      text: q('[data-test=journey-text]'), verse: q('[data-test=journey-verse]'), check: q('[data-test=check-line]'),
      changes: q('[data-test=journey-changes]'),
      buttons: Array.from(m.querySelectorAll('[data-test=journey-act] button')).map(b => b.textContent),
      skip: !!m.querySelector('[data-test=skip-event]:not([hidden])')
    };
  });
}
async function jClick(page, test) {
  await page.waitForTimeout(380);
  await page.click('.tsi-modal.tsi-exp-journey [data-test="' + test + '"]');
  await page.waitForTimeout(80);
}
async function firstChoice(page) { await pause(page); await page.click('.tsi-exp-choice >> nth=0'); await page.waitForTimeout(120); }
async function closeAll(page) { let n = 0; while (await modalOpen(page) && n++ < 12) await closePopup(page); }

/* A tiny web server for the old tool, which loads its events with fetch(). */
function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
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

    await check('the home card says Open', async () => {
      const card = await page.textContent('.tsi-card[href*="explorer"]');
      assert(/Open/.test(card) && !/Coming/.test(card), card);
    });

    await check('it opens from its card, with the painted art behind', async () => {
      await page.click('.tsi-card[href*="explorer"]');
      await page.waitForSelector('[data-test=camp]');
      assert(await page.evaluate(() => document.body.classList.contains('tsi-page--art')));
      equal(await text(page, 'day'), 'Day 1');
    });

    for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
      await check('fits ' + size + ' with no sideways scrolling and every control in view', async () => {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(200);
        const lc = await H.layoutCheck(page, ['[data-test=camp]', '[data-test=free-move]', '[data-test=queue]', '[data-test=export-save]', '[data-test=fullscreen]', '.tsi-exp-stage']);
        equal(lc.scrollWidth, lc.clientWidth, 'no sideways scroll');
        if (size !== 'smallWindow') equal(lc.outOfView, [], 'in view');
        const inner = await page.evaluate(() => Array.from(document.querySelectorAll('.tsi-exp-side')).map(s => s.scrollHeight - s.clientHeight));
        if (size !== 'smallWindow') equal(inner, [0, 0], 'the side columns need no scrolling');
      });
    }
    await page.setViewportSize(H.SIZES.laptop.viewport);
    await H.shot(page, 'p8-01-laptop');

    await check('all ten maps load with no internet', async () => {
      const ids = await page.$$eval('[data-test=map-select] option', os => os.map(o => o.value).filter(Boolean));
      equal(ids.length, 10);
      for (const id of ids) {
        await loadMap(page, id);
        await page.waitForFunction(() => { const i = document.querySelector('.tsi-exp-map'); return i.complete && i.naturalWidth > 0; });
        equal(await page.evaluate(() => document.querySelector('.tsi-exp-map').naturalWidth), 2048, id);
        assert((await text(page, 'notice')).indexOf('Map loaded: ' + id) === 0, await text(page, 'notice'));
      }
    });

    await check('the 15 town pins show and open their town maps', async () => {
      let seen = 0;
      for (const id of await page.$$eval('[data-test=map-select] option', os => os.map(o => o.value).filter(Boolean))) {
        await loadMap(page, id);
        const pins = await page.$$('.tsi-exp-pin');
        for (let i = 0; i < pins.length; i++) {
          const label = await pins[i].getAttribute('title');
          await pause(page);
          await page.click('.tsi-exp-pin >> nth=' + i);
          await page.waitForFunction(() => { const i = document.querySelector('.tsi-exp-place-media img'); return i && i.complete && i.naturalWidth > 0; });
          const v = await page.evaluate(() => ({ t: document.querySelector('.tsi-modal .tsi-exp-event-title').textContent, w: document.querySelector('.tsi-exp-place-media img').naturalWidth }));
          equal(v.t, label);
          equal(v.w, 2048);
          seen++;
          await closePopup(page);
        }
      }
      equal(seen, 15);
    });

    await check('nothing reached for the internet, and nothing failed', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Moving the heroes: 6 miles a hex, 30 a day');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openExplorer(page);
    await page.evaluate(() => window.__seed(11));
    await loadMap(page, 'the_north_isle');
    await page.click('[data-test=snap]');

    await check('one hex costs 6 miles and the travel line follows the hero', async () => {
      /* Push today's event mark out of reach first, so no event interrupts. */
      await page.evaluate(() => { TSI.explorer.debug.state().travel.nextTravelEventAtMiles = 99; });
      await dragHex(page, 'kaelen', 1, 0);
      equal((await st(page)).tokens.map(t => t.milesUsed), [6, 0, 0, 0, 0]);
      equal([await text(page, 'miles'), await text(page, 'miles-left'), await text(page, 'mode'), await text(page, 'effects')], ['6', '24', 'Slow (≤18 miles)', '+Stealth']);
      equal(await page.$$eval('.tsi-exp-pill', ps => ps.map(p => p.textContent)), ['K 6/30', 'U 0/30', 'M 0/30', 'E 0/30', 'C 0/30']);
    });

    await check('a grouped move charges each hero in the group once', async () => {
      const k = await page.evaluate(() => TSI.explorer.debug.tokenScreen('kaelen'));
      const u = await page.evaluate(() => TSI.explorer.debug.tokenScreen('umbrys'));
      await page.mouse.click(k.x, k.y);
      await page.keyboard.down('Control');
      await page.mouse.click(u.x, u.y);
      await page.keyboard.up('Control');
      equal((await page.evaluate(() => TSI.explorer.debug.selected())).sort(), ['kaelen', 'umbrys']);
      await pause(page);
      await page.click('[data-test=group]');
      const s = await st(page);
      assert(s.tokens[0].groupId && s.tokens[0].groupId === s.tokens[1].groupId, 'grouped');
      await dragHex(page, 'umbrys', 0, 1);
      equal((await st(page)).tokens.map(t => t.milesUsed), [12, 6, 0, 0, 0]);
    });

    await check('a move that takes anyone past 30 miles is refused and undone', async () => {
      const before = await tokHex(page, 'kaelen');
      await dragHex(page, 'kaelen', 4, 0);
      equal((await st(page)).tokens.map(t => t.milesUsed), [12, 6, 0, 0, 0]);
      equal(await tokHex(page, 'kaelen'), before);
      equal(await text(page, 'notice'), 'Too far. One or more heroes would exceed 30 miles. Make Camp to reset.');
    });

    await check('Group needs two heroes selected; Ungroup splits them', async () => {
      await page.mouse.click(700, 500);   /* empty map: clears the selection */
      await pause(page);
      await page.click('[data-test=group]');
      assert(/Select 2\+ tokens first/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      const k = await page.evaluate(() => TSI.explorer.debug.tokenScreen('kaelen'));
      await page.mouse.click(k.x, k.y);
      await pause(page);
      await page.click('[data-test=ungroup]');
      equal((await st(page)).tokens.slice(0, 2).map(t => t.groupId), [null, null]);
    });

    await check('Free Move repositions for nothing', async () => {
      await page.click('[data-test=free-move]');
      equal(await text(page, 'notice'), 'Free Move enabled: miles/events paused.');
      await dragHex(page, 'magnus', 4, 0);
      equal((await st(page)).tokens[2].milesUsed, 0);
      equal(await text(page, 'notice'), 'Free Move: repositioned without spending miles.');
      await pause(page);
      await page.click('[data-test=free-move]');
      equal(await text(page, 'free-move'), 'Free Move: OFF');
    });

    await check('at 30 miles a hero stops, and says so', async () => {
      await dragHex(page, 'elara', 5, 0);
      equal((await st(page)).tokens[3].milesUsed, 30);
      equal(await text(page, 'notice'), 'E has reached 30 miles. Make Camp to reset.');
      const before = await tokHex(page, 'elara');
      await dragHex(page, 'elara', -1, 0);
      equal(await tokHex(page, 'elara'), before, 'a tired hero can\'t be dragged');
    });

    await check('box select: drag across empty map picks the heroes inside', async () => {
      const a = await page.evaluate(() => TSI.explorer.debug.tokenScreen('magnus'));
      const b = await page.evaluate(() => TSI.explorer.debug.tokenScreen('charles'));
      const x0 = Math.min(a.x, b.x) - 30, y0 = Math.min(a.y, b.y) - 30, x1 = Math.max(a.x, b.x) + 30, y1 = Math.max(a.y, b.y) + 30;
      await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 5 }); await page.mouse.up();
      const sel = await page.evaluate(() => TSI.explorer.debug.selected());
      assert(sel.includes('magnus') && sel.includes('charles'), JSON.stringify(sel));
    });

    await check('Token − / + and the mouse wheel resize the selected heroes', async () => {
      await pause(page);
      await page.click('[data-test=token-up]');
      const s = await st(page);
      equal([s.tokens[2].size, s.tokens[4].size, s.tokens[0].size], [48, 48, 46]);
      const m = await page.evaluate(() => TSI.explorer.debug.tokenScreen('magnus'));
      await page.mouse.move(m.x, m.y);
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(100);
      equal((await st(page)).tokens[2].size, 46);
    });

    await check('the grid buttons: Hex ± by 2, nudges by 2, on/off, opacity', async () => {
      await page.click('[data-test=hex-up]');
      await pause(page); await page.click('[data-test=nudge-right]');
      await pause(page); await page.click('[data-test=nudge-down]');
      let g = (await st(page)).grid;
      equal([g.r, g.offsetX, g.offsetY], [40, 2, 2]);
      equal(await text(page, 'readout'), 'Hex: r=40px (≈ 69px wide)');
      await page.fill('[data-test=opacity]', '0.6');
      await page.dispatchEvent('[data-test=opacity]', 'input');
      equal((await st(page)).grid.opacity, 0.6);
      await pause(page); await page.click('[data-test=grid]');
      equal(await text(page, 'grid'), 'Hex Grid: Off');
      await pause(page); await page.click('[data-test=grid]');
    });
    await H.shot(page, 'p8-02-moving');
    equal(context.log.errors, []);
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Pins, grid, fog and heroes stay on the map picture (EXP-10, EXP-11)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openExplorer(page);
    await loadMap(page, 'the_north_isle');
    await page.click('[data-test=snap]');
    await page.evaluate(() => { TSI.explorer.debug.state().travel.nextTravelEventAtMiles = 99; });

    /* Where each hero, pin and one hex sit, as fractions of the map picture on screen. */
    const onPicture = () => page.evaluate(() => {
      const img = document.querySelector('.tsi-exp-map').getBoundingClientRect();
      const out = {};
      document.querySelectorAll('.tsi-exp-token').forEach(t => { const r = t.getBoundingClientRect(); out[t.dataset.id] = [(r.left + r.width / 2 - img.left) / img.width, (r.top + r.height / 2 - img.top) / img.height, r.width / img.width]; });
      document.querySelectorAll('.tsi-exp-pin').forEach(t => { const r = t.getBoundingClientRect(); out[t.title] = [(r.left + r.width / 2 - img.left) / img.width, (r.bottom - img.top) / img.height]; });
      const s = TSI.explorer.debug.state(), v = TSI.explorer.debug.view();
      out.hex = [TSI.explorer.rules.hexSize(s.grid) * v.fit / img.width];
      return out;
    });
    const base = await onPicture();
    const settings = [['laptopFull', false], ['tv', false], ['smallWindow', false], ['tv', true], ['laptop', true]];
    for (const [size, full] of settings) {
      await check('same spots at ' + size + (full ? ' in full screen' : ''), async () => {
        await page.setViewportSize(H.SIZES[size].viewport);
        if (full) { await page.click('[data-test=fullscreen]'); await page.waitForFunction(() => !!document.fullscreenElement); }
        await page.waitForTimeout(300);
        const now = await onPicture();
        const off = [];
        Object.keys(base).forEach(k => base[k].forEach((v, i) => { if (Math.abs(v - now[k][i]) > 0.002) off.push(k + ' ' + base[k] + ' → ' + now[k]); }));
        equal(off, []);
        if (full) await leaveFullscreen(page);
      });
    }

    await check('with Snap on, a one-hex drag in full screen still costs 6 miles (EXP-11)', async () => {
      await page.setViewportSize(H.SIZES.laptop.viewport);
      await page.click('[data-test=fullscreen]');
      await page.waitForFunction(() => !!document.fullscreenElement);
      await page.waitForTimeout(300);
      await dragHex(page, 'kaelen', 1, 0);
      equal((await st(page)).tokens[0].milesUsed, 6);
      await leaveFullscreen(page);
    });

    await check('arriving on a linked map with Snap on: heroes drawn where they are (EXP-04)', async () => {
      await loadMap(page, 'northern_province_east');
      assert(/Spawn applied/.test(await text(page, 'notice')), await text(page, 'notice'));
      const bad = await page.evaluate(() => {
        const R = TSI.explorer.rules, s = TSI.explorer.debug.state(), b = TSI.explorer.debug.board();
        const spots = R.layoutTokens(s, b, null);
        return s.tokens.filter(t => { const a = R.tokenHex(s, b, t), d = R.hexAt(s.grid, spots[t.id].x + t.size / 2, spots[t.id].y + t.size / 2); return a.q !== d.q || a.r !== d.r; }).map(t => t.id);
      });
      equal(bad, []);
      /* The party's centre is at the entry point from the North Isle. */
      const c = await page.evaluate(() => { const s = TSI.explorer.debug.state(); let x = 0, y = 0; s.tokens.forEach(t => { x += t.x; y += t.y; }); return [x / 5, y / 5]; });
      const entry = await page.evaluate(() => TSI_DATA.explorer.spawns.the_north_isle.northern_province_east);
      assert(Math.abs(c[0] - entry.x) < 0.08 && Math.abs(c[1] - entry.y) < 0.12, JSON.stringify([c, entry]));
    });

    await check('the grid is redrawn sharply for the screen\'s sharpness', async () => {
      const dpr = await page.evaluate(() => { const c = document.querySelector('.tsi-exp-canvas--grid'); return c.width / c.clientWidth; });
      assert(Math.abs(dpr - 1.5) < 0.01, String(dpr));
    });
    equal(context.log.errors, []);
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Fog of war and Pick Marker XY');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openExplorer(page);
    await loadMap(page, 'midland_province');

    await check('fog on: the map is dark except two hexes round the hero; pins hide', async () => {
      equal(await page.$$eval('.tsi-exp-pin', ps => ps.map(p => p.title)), ['Middlemount']);
      await page.click('[data-test=fog]');
      equal(await text(page, 'fog'), 'Fog of War: On');
      const s = await st(page);
      equal(Object.keys(s.fog.revealedByMapKey['preset:midland_province']).length, 19);
      equal(await page.$$('.tsi-exp-pin').then(p => p.length), 0);
    });

    await check('walking to a town uncovers its pin', async () => {
      await page.click('[data-test=free-move]');
      const pin = await page.evaluate(() => { const m = TSI_DATA.explorer.markersByMapId.midland_province[0], b = TSI.explorer.debug.board(); return TSI.explorer.debug.toScreen(m.x * b.w, m.y * b.h); });
      const k = await page.evaluate(() => TSI.explorer.debug.tokenScreen('kaelen'));
      await drag(page, k, { x: pin.x - k.x, y: pin.y - k.y });
      equal(await page.$$eval('.tsi-exp-pin', ps => ps.map(p => p.title)), ['Middlemount']);
    });

    await check('fog is kept per map, and after reopening (the button reads Off, EXP-19 kept)', async () => {
      const cells = Object.keys((await st(page)).fog.revealedByMapKey['preset:midland_province']).length;
      assert(cells > 19, String(cells));
      await loadMap(page, 'the_east_isle');
      equal(Object.keys((await st(page)).fog.revealedByMapKey['preset:the_east_isle'] || {}).length, 0);
      await loadMap(page, 'midland_province');
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      equal(Object.keys((await st(page)).fog.revealedByMapKey['preset:midland_province']).length, cells);
      equal(await text(page, 'fog'), 'Fog of War: Off');
      equal(await page.$$('.tsi-exp-pin').then(p => p.length), 1);
    });

    await check('Reset Fog clears this map at once (E14 kept)', async () => {
      await page.click('[data-test=reset-fog]');
      equal(await modalOpen(page), false, 'no question');
      equal(await text(page, 'notice'), 'Fog reset for this map.');
      equal(Object.keys((await st(page)).fog.revealedByMapKey['preset:midland_province']).length, 19);
    });

    await check('Pick Marker XY gives the position on the map picture', async () => {
      await pause(page);
      await page.click('[data-test=pick]');
      equal(await text(page, 'notice'), 'Pick mode ON: click the map where you want the marker.');
      const at = await page.evaluate(() => { const b = TSI.explorer.debug.board(); return TSI.explorer.debug.toScreen(0.25 * b.w, 0.5 * b.h); });
      await page.mouse.click(at.x, at.y);
      const box = await page.inputValue('.tsi-exp-pickbox');
      const m = box.match(/"x": ([\d.]+), "y": ([\d.]+)/);
      assert(m && Math.abs(Number(m[1]) - 0.25) < 0.002 && Math.abs(Number(m[2]) - 0.5) < 0.002, box);
      await H.clickModal(page, 'OK');
      await pause(page);
      await page.click('[data-test=pick]');
    });
    equal(context.log.errors, []);
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Make Camp, events and weather');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openExplorer(page);
    await loadMap(page, 'the_east_isle');
    /* A seed that brings weather on day 8 (and so no campfire event). */
    const seed = await page.evaluate(() => {
      for (let s = 1; s < 500; s++) {
        window.__seed(s);
        const st = JSON.parse(JSON.stringify(TSI.explorer.debug.state()));
        st.travel.day = 7;
        const q = TSI.explorer.rules.makeCamp(st, TSI_DATA.explorer, TSI_DATA.journeyEvents, Math.random);
        if (q.map(i => i.kind).join() === 'weather') return s;
      }
      return null;
    });

    await check('day 8: the weather, then "The Ironbow sends word…" (the Bastion has an order due), none lost (EXP-01)', async () => {
      await page.evaluate(s => { TSI.explorer.debug.state().travel.day = 7; window.__seed(s); }, seed);
      await seedBastion(page, 8, 7);
      await page.click('[data-test=camp]');
      await page.waitForSelector('.tsi-modal');
      const shown = [];
      let v = await eventView(page);
      shown.push(v.meta.split(' • ')[0] + ': ' + v.title);
      equal(await text(page, 'day'), 'Day 8');
      assert(v.roll, 'the weather asks for a roll');
      assert(/ROLL: /.test(v.desc) && /Enter the final table roll result below/.test(v.desc), v.desc);
      equal(v.choices, ['Close'], 'a Close as well as the roll (EXP-22 kept)');
      await page.fill('[data-test=roll]', '20');
      await page.click('[data-test=resolve]');
      v = await eventView(page);
      assert(/\((Great Success|Success)\)$/.test(v.title), v.title);
      assert(/EFFECT: /.test(v.desc), v.desc);
      const s = await st(page);
      assert(s.travel.activeWeather && s.travel.activeWeather.day === 8, JSON.stringify(s.travel.activeWeather));
      const src = await page.getAttribute('.tsi-exp-weather', 'src');
      assert(/tools\/explorer\/assets\/overlays\/\w+_overlay\.mp4$/.test(src), src);
      equal(await page.isVisible('.tsi-exp-weather'), true);
      await firstChoice(page);
      await page.waitForSelector('[data-test=ironbow-word]');
      v = await eventView(page);
      shown.push(v.meta);
      equal(await page.$$eval('[data-test=ironbow-word] [data-test=word-lines] li', ls => ls.map(l => l.textContent)), ['Barracks: Recruit Defenders is complete.']);
      await closePopup(page);
      equal(await modalOpen(page), false);
      equal(shown.map(x => x.split(':')[0]), ['Weather', 'The Ironbow sends word…']);
      await page.evaluate(() => TSI.store.remove('tsi.bastion.state'));
    });

    await check('Enter or Space after Make Camp doesn\'t camp again (EXP-02)', async () => {
      await chances(page, 0, 1);
      await page.evaluate(() => { const s = TSI.explorer.debug.state(); s.travel.lastWeatherDay = s.travel.day; });
      await page.focus('[data-test=camp]');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.tsi-modal');
      const focusIn = await page.evaluate(() => !!document.activeElement.closest('.tsi-modal'));
      assert(focusIn, 'focus moved into the pop-up');
      equal(await text(page, 'day'), 'Day 9');
      await page.waitForTimeout(400);
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      await closeAll(page);
      equal(await text(page, 'day'), 'Day 9');
    });

    await check('yesterday\'s weather video goes at the next camp', async () => {
      equal(await page.isVisible('.tsi-exp-weather'), false);
      equal((await st(page)).travel.activeWeather, null);
    });

    await check('a double click on Make Camp camps once, and the event stays up (EXP-14)', async () => {
      await page.evaluate(() => { const s = TSI.explorer.debug.state(); s.travel.lastWeatherDay = s.travel.day; });
      await page.dblclick('[data-test=camp]');
      await page.waitForTimeout(200);
      equal(await text(page, 'day'), 'Day 10');
      equal(await modalOpen(page), true);
      await closeAll(page);
    });

    await check('no weekly Bastion reminder any more (Harry, 8 October 2026): Days 11 to 15 bring none, with no Bastion saved', async () => {
      const days = [];
      for (let d = 11; d <= 15; d++) {
        await pause(page);
        await page.click('[data-test=camp]');
        await page.waitForTimeout(600);
        let n = 0;
        while (await modalOpen(page) && n++ < 6) {
          const v = await eventView(page);
          if (v.title === 'Bastion Turn' || /The Ironbow sends word/.test(v.meta)) days.push(d);
          await closePopup(page);
        }
      }
      equal(days, []);
    });

    await check('Enter can\'t resolve the weather by accident; an empty box counts as 0, as before', async () => {
      /* The night's first dice decide the weather: 0.01 brings it. */
      await page.evaluate(() => { const s = TSI.explorer.debug.state(); s.travel.lastWeatherDay = -999; window.__seed(3); Math.random = (() => { const r = Math.random; let i = 0; return () => (i++ === 0 ? 0.01 : r()); })(); });
      await pause(page);
      await page.click('[data-test=camp]');
      await page.waitForSelector('.tsi-modal');
      let v = await eventView(page);
      while (!v.roll) { await closePopup(page); v = await eventView(page); }
      /* The heading has the focus, so an Enter meant for the last pop-up does nothing. */
      equal(await page.evaluate(() => document.activeElement.className), 'tsi-exp-event-title');
      await page.keyboard.press('Enter');
      equal(await page.isVisible('[data-test=roll]'), true, 'still waiting for a roll');
      /* A letter can't go in a number box, so the box stays empty and counts as 0. */
      await page.type('[data-test=roll]', 'e');
      equal(await page.inputValue('[data-test=roll]'), '');
      await page.click('[data-test=resolve]');
      v = await eventView(page);
      assert(/\((Failure)\)$/.test(v.title), v.title);
      await closeAll(page);
    });

    await check('a campfire event comes before "The Ironbow sends word…", none lost (EXP-01)', async () => {
      await page.evaluate(() => { const s = TSI.explorer.debug.state(); s.travel.day = 21; s.travel.lastWeatherDay = 21; });
      await seedBastion(page, 22, 21);
      await pause(page);
      await page.click('[data-test=camp]');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      const j = await journeyView(page);
      assert(/^Campfire event • The East Isle • C\d+$/.test(j.meta), j.meta);
      await closePopup(page);
      await page.waitForSelector('[data-test=ironbow-word]');
      equal(await page.textContent('[data-test=ironbow-word] .tsi-modal__title'), 'The Ironbow sends word…');
      equal(await page.$$eval('[data-test=ironbow-word] [data-test=word-lines] li', ls => ls.map(l => l.textContent)), ['Barracks: Recruit Defenders is complete.']);
      equal(await page.$$eval('[data-test=ironbow-word] .tsi-modal__foot button', bs => bs.map(b => b.textContent)), ['Open the Bastion ↗', 'Close']);
      await closeAll(page);
      equal(await page.evaluate(() => TSI.store.get('tsi.bastion.state').pendingOrders.length), 1, 'the Explorer never changes the Bastion');
      await page.evaluate(() => TSI.store.remove('tsi.bastion.state'));
      await chances(page, 0.3, 0.25);
    });

    await check('a travel event: the day\'s roll, at the day\'s mark, once a day', async () => {
      await chances(page, 1, 0);
      await page.click('[data-test=snap]');
      await page.evaluate(() => { const s = TSI.explorer.debug.state(); s.travel.nextTravelEventAtMiles = 12; s.travel.travelEventDay = 0; s.journey.lastTravelDay = 0; s.journey.rolledDay = 0; });
      await dragHex(page, 'charles', 1, 0);
      equal(await modalOpen(page), false, '6 miles: not yet');
      await dragHex(page, 'charles', 1, 0);
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      const j = await journeyView(page);
      assert(/^Travel event • The East Isle • T\d+$/.test(j.meta), j.meta);
      const titles = await page.evaluate(() => { const J = TSI.explorer.journey; return J.pool(TSI_DATA.journeyEvents, 'travel', J.context(TSI.explorer.debug.state(), TSI_DATA.journeyEvents)).map(e => e.title); });
      assert(titles.includes(j.title), j.title);
      assert(j.skip, 'Skip this event is offered before anything happens');
      await closePopup(page);
      assert(/skipped/.test(await text(page, 'notice')), await text(page, 'notice'));
      await dragHex(page, 'charles', 1, 0);
      equal(await modalOpen(page), false, 'one roll a day');
      await chances(page, 0.3, 0.25);
    });

    await check('Queue plays a main event at once, with all its pictures', async () => {
      for (const [id, pics] of [['tide_remembers_prologue', 3], ['turning_tide', 8]]) {
        await page.selectOption('[data-test=main-select]', id);
        await pause(page);
        await page.click('[data-test=queue]');
        equal(await text(page, 'notice'), 'Main Campaign event triggered.');
        const seen = [];
        for (let i = 0; i < pics; i++) {
          await page.waitForFunction(() => { const i = document.querySelector('.tsi-exp-event-media:not([hidden]) img'); return i && i.complete && i.naturalWidth > 0; });
          const v = await eventView(page);
          assert(v.meta.indexOf('Main Campaign • ') === 0, v.meta);
          assert(await page.evaluate(() => document.querySelector('.tsi-modal').classList.contains('tsi-exp-event--main')));
          seen.push(v.img);
          await firstChoice(page);
        }
        equal(await modalOpen(page), false);
        equal(seen.length, pics);
        assert(seen.every(s => /^(tide_remembers|turning_tide)_\d\.png$/.test(s)), seen.join());
      }
    });

    await check('a double click on Continue moves on one step only', async () => {
      await page.selectOption('[data-test=main-select]', 'turning_tide');
      await pause(page);
      await page.click('[data-test=queue]');
      await pause(page);
      await page.dblclick('.tsi-exp-choice');
      await page.waitForTimeout(150);
      equal((await eventView(page)).img, 'turning_tide_2.png');
      await closeAll(page);
    });

    await check('the letter from Maerys Vell reads as written', async () => {
      await page.selectOption('[data-test=main-select]', 'tide_remembers_prologue');
      await pause(page);
      await page.click('[data-test=queue]');
      await firstChoice(page); await firstChoice(page);
      const v = await eventView(page);
      assert(v.desc.indexOf('Friends of the East...') > 0 && /Maerys Vell, The Voice of The Tide$/.test(v.desc), v.desc);
      await closeAll(page);
    });

    await check('Reset Travel asks first, then goes back to day 1 with no miles', async () => {
      await pause(page);
      await page.click('[data-test=reset-travel]');
      assert(/Reset travel back to Day 1/.test(await H.modalText(page)));
      await H.clickModal(page, 'Cancel');
      assert((await text(page, 'day')) !== 'Day 1');
      await pause(page);
      await page.click('[data-test=reset-travel]');
      await H.clickModal(page, 'OK');
      equal(await text(page, 'day'), 'Day 1');
      equal((await st(page)).tokens.map(t => t.milesUsed), [0, 0, 0, 0, 0]);
    });
    await H.shot(page, 'p8-03-camp');
    equal(context.log.errors, []);
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Harry\'s new events (6 October 2026)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openExplorer(page);
    await loadMap(page, 'the_east_isle');
    await page.evaluate(() => { TSI.explorer.debug.state().travel.nextTravelEventAtMiles = 99; });
    const start = (id, kind) => page.evaluate(([id, kind]) => TSI.explorer.debug.startEvent(id, kind), [id, kind]).then(async ok => { assert(ok, 'started ' + id); await page.waitForSelector('.tsi-modal.tsi-exp-journey'); });
    const listText = test => page.textContent('[data-test=' + test + ']');

    await check('the travel panel: event gold with Clear, Active Effects, Threads, Roll an event now; no rations anywhere', async () => {
      equal(await text(page, 'gold'), '0');
      equal((await listText('effects-list')).trim(), 'None.');
      equal((await listText('threads-list')).trim(), 'None.');
      equal(await text(page, 'roll-now'), 'Roll an event now');
      assert(await page.isVisible('[data-test=gold-clear]'));
      assert(!/ration|forag/i.test(await page.evaluate(() => document.body.innerText)), 'no rations or foraging');
      const lay = await H.layoutCheck(page, ['[data-test=camp]', '[data-test=roll-now]']);
      equal(lay.scrollWidth, lay.clientWidth, 'no sideways scroll');
      equal(lay.outOfView, [], 'Make Camp and Roll an event now in view');
    });

    await check('Roll an event now, then Skip this event: the card goes back in the pool', async () => {
      await page.click('[data-test=roll-now]');
      await H.clickModal(page, 'Travel event');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      const j = await journeyView(page);
      assert(/^Travel event • The East Isle • T\d+$/.test(j.meta), j.meta);
      assert(j.skip);
      await jClick(page, 'skip-event');
      equal(await modalOpen(page), false);
      const s = await st(page);
      equal([s.journey.current, s.journey.used.travel], [null, []]);
      assert(/skipped: it goes back into the pool/.test(await text(page, 'notice')));
    });

    await check('T1 step by step: the check and its DC, the hero who rolled, then what changed', async () => {
      await start('t1');
      let j = await journeyView(page);
      equal([j.title, j.line], ['The Wardens\' Toll', 'Insight, then Intimidation, Stealth or Persuasion']);
      assert(/Wisdom \(Insight\), DC 14/.test(j.check), j.check);
      equal(j.buttons, ['Success', 'Failure']);
      equal(await page.$$eval('.tsi-modal [data-test=hero-select] option', o => o.map(x => x.textContent)), ['Kaelen', 'Umbrys', 'Magnus', 'Elara', 'Charles']);
      await page.selectOption('.tsi-modal [data-test=hero-select]', 'elara');
      await jClick(page, 'check-success');
      j = await journeyView(page);
      assert(/Elara gains Toll-Wise: advantage on Insight against road-thieves \(ends Day 8\)/.test(j.changes), j.changes);
      equal(j.skip, false, 'no skipping once something has happened');
      assert(/Toll-Wise · Elara/.test(await listText('effects-list')), await listText('effects-list'));
      await jClick(page, 'choice-0');
      await jClick(page, 'check-success');
      j = await journeyView(page);
      assert(/^What changed/.test(j.changes) && /\+120 gold\. Party gold: 120\./.test(j.changes), j.changes);
      equal(j.buttons, ['Done']);
      await jClick(page, 'event-done');
      equal(await modalOpen(page), false);
      equal(await text(page, 'gold'), '120');
      equal(await text(page, 'notice'), 'T1 The Wardens\' Toll: done.');
    });

    await check('an effect can be removed by hand, after asking', async () => {
      await page.click('[data-test=effect-remove]');
      assert(/Remove Toll-Wise \(Elara\)\?/.test(await H.modalText(page)));
      await H.clickModal(page, 'Remove');
      equal((await listText('effects-list')).trim(), 'None.');
    });

    await check('a thread with a reward: Resolve says what it gives, then pays once', async () => {
      await start('t6');
      assert(/in Rowthorn colours/.test((await journeyView(page)).text));
      await jClick(page, 'check-success');
      await jClick(page, 'next');
      await jClick(page, 'choice-0');
      await jClick(page, 'event-done');
      assert(/The Sealed Dispatch/.test(await listText('threads-list')));
      await page.click('[data-test=thread-resolve]');
      const msg = await H.modalText(page);
      assert(/\+250 gold/.test(msg) && /Clan Rowthorn/.test(msg), msg);
      await H.clickModal(page, 'Resolve');
      equal(await text(page, 'gold'), '370');
      equal((await listText('threads-list')).trim(), 'None.');
    });

    await check('Clear sets the party gold back to 0, after asking', async () => {
      await page.click('[data-test=gold-clear]');
      await H.clickModal(page, 'Cancel');
      equal(await text(page, 'gold'), '370');
      await page.click('[data-test=gold-clear]');
      await H.clickModal(page, 'Clear');
      equal(await text(page, 'gold'), '0');
    });

    await check('a riddle: the verse, one hint, the DM\'s peek, two tries', async () => {
      await start('t8');
      let j = await journeyView(page);
      assert(/I grip the hill but have no hand/.test(j.verse), j.verse);
      await jClick(page, 'hint-success');
      equal(await page.textContent('.tsi-modal [data-test=hint-text]'), 'Read out: "Look down, not up."');
      equal(await page.$('.tsi-modal [data-test=hint-success]'), null, 'one hint only');
      await jClick(page, 'riddle-reveal');
      equal(await page.textContent('.tsi-modal [data-test=answer]'), 'Answer: Roots (or a root).');
      await jClick(page, 'riddle-wrong');
      equal(await page.textContent('.tsi-modal [data-test=wrong-text]'), 'The stone hums. One more try.');
      await jClick(page, 'riddle-right');
      j = await journeyView(page);
      assert(/\+100 gold/.test(j.changes) && /potion of greater healing/.test(j.changes), j.changes);
      await jClick(page, 'event-done');
    });

    await check('a fight: who\'s surprised, the suggested enemies, and Set up opens the Combat Tracker in a new window', async () => {
      await start('t2');
      await jClick(page, 'check-failure');
      await page.check('.tsi-modal [data-test=failed-kaelen]');
      await jClick(page, 'each-continue');
      const j = await journeyView(page);
      assert(/Surprised in the first round: Kaelen\./.test(j.changes), j.changes);
      assert(/Suggested enemies: Levels 7–10/.test(await page.textContent('.tsi-modal [data-test=journey-act]')));
      /* The full set-up and report back is in tests/e2e/fights.test.js. */
      assert(/Surprised in the first round: Kaelen\./.test(await page.textContent('.tsi-modal [data-test=fight-setup]')));
      await page.waitForTimeout(380);
      const [win] = await Promise.all([context.waitForEvent('page'), page.click('.tsi-modal [data-test=fight-send]')]);
      await win.waitForLoadState();
      assert(/\?tool=encounter$/.test(win.url()), win.url());
      await win.waitForSelector('.tsi-modal__title:text-is("A fight from the Explorer")');
      await win.close();
      await jClick(page, 'fight-won');
      assert(/\+150 gold/.test((await journeyView(page)).changes));
      await jClick(page, 'event-done');
    });

    await check('a contest: the knight\'s roll is shown, best of three', async () => {
      await start('t4');
      await jClick(page, 'choice-0');
      const act = await page.textContent('.tsi-modal [data-test=journey-act]');
      assert(/Round 1/.test(act) && /The knight rolls \d+ \+ 7 = \d+\./.test(act), act);
      await page.selectOption('.tsi-modal [data-test=hero-select]', 'magnus');
      await jClick(page, 'round-hero');
      await jClick(page, 'round-hero');
      const j = await journeyView(page);
      assert(/\+200 gold/.test(j.changes) && /Magnus gains Inspiration/.test(j.changes) && /Clan Rowthorn/.test(j.changes), j.changes);
      await jClick(page, 'event-done');
    });

    await check('pace: a Stealth check on a slow day says so', async () => {
      await page.evaluate(() => { TSI.explorer.debug.state().tokens.forEach(t => { t.milesUsed = 12; }); });
      await start('t2');
      await jClick(page, 'check-success');
      await jClick(page, 'choice-0');
      assert(/Slow pace: advantage on Stealth checks\./.test(await page.textContent('.tsi-modal [data-test=journey-act]')));
      await closePopup(page);
    });

    await check('closing part-way: keep it for later, or end it', async () => {
      await start('t7');
      await page.waitForTimeout(400);
      await page.click('.tsi-modal.tsi-exp-journey .tsi-modal__foot button:text-is("Close")');
      await page.waitForTimeout(400);
      await H.clickModal(page, 'Keep it for later');
      equal(await modalOpen(page), false);
      equal(await text(page, 'roll-now'), 'Back to the event');
      await page.click('[data-test=camp]');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      assert(/Finish or end the event in progress/.test(await text(page, 'notice')));
      equal((await journeyView(page)).title, 'Rootfall');
      equal((await st(page)).travel.day, 1, 'the day didn\'t move on');
      await page.waitForTimeout(400);
      await page.click('.tsi-modal.tsi-exp-journey .tsi-modal__foot button:text-is("Close")');
      await page.waitForTimeout(400);
      await H.clickModal(page, 'End it now');
      const s = await st(page);
      equal(s.journey.current, null);
      assert(/^Day 1 · T7 Rootfall/.test(s.journey.log[0]), s.journey.log[0]);
      equal(await text(page, 'roll-now'), 'Roll an event now');
    });

    await check('an event part-way through comes back after a reload, at the same step', async () => {
      await start('t7');
      await page.check('.tsi-modal [data-test=failed-umbrys]');
      await jClick(page, 'each-continue');
      await page.waitForTimeout(300);
      await page.reload();
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      const j = await journeyView(page);
      equal(j.title, 'Rootfall');
      assert(/Umbrys fell 20 feet/.test(j.text), j.text);
      equal(await page.$$eval('.tsi-modal .tsi-exp-failed', l => l.map(x => x.textContent)), ['Umbrys failed']);
      await closePopup(page);
    });

    await check('the Main Campaign list has no DM-only events (The Second Marker is removed)', async () => {
      const opts = await page.$$eval('[data-test=main-select] option', o => o.map(x => x.textContent));
      assert(!opts.some(t => /Second Marker/.test(t)), opts.join());
      equal(await page.$('[data-test=main-select] optgroup'), null);
    });

    await check('the event window fits the laptop, full screen and the TV', async () => {
      for (const size of ['laptop', 'laptopFull', 'tv']) {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(200);
        await start('t4');
        await jClick(page, 'choice-0');
        const fit = await page.evaluate(() => {
          const d = document.querySelector('.tsi-modal.tsi-exp-journey');
          const b = d.querySelector('.tsi-modal__body');
          return { bottom: d.getBoundingClientRect().bottom, h: innerHeight, scroll: b.scrollHeight - b.clientHeight };
        });
        assert(fit.bottom <= fit.h && fit.scroll <= 2, size + ' ' + JSON.stringify(fit));
        await H.shot(page, 'p8-new-event-' + size);
        await closePopup(page);
      }
      await page.setViewportSize(H.SIZES.laptop.viewport);
    });

    await check('the events record is saved with the journey', async () => {
      const before = Number(await text(page, 'gold'));
      await start('t3');
      await jClick(page, 'check-success');
      await jClick(page, 'next');
      await jClick(page, 'choice-1');
      await jClick(page, 'choice-1');
      await jClick(page, 'event-done');
      await page.waitForTimeout(300);
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      equal(Number(await text(page, 'gold')), before + 75);
      const saved = await page.evaluate(() => TSI.store.get('tsi.explorer.save'));
      equal(saved.journey.gold, before + 75);
      assert(saved.journey.log.length >= 5, saved.journey.log.length);
    });

    await check('a campfire event rolled on the road waits for tonight\'s camp', async () => {
      await page.evaluate(() => { const s = TSI.explorer.debug.state(); s.tokens.forEach(t => { t.milesUsed = 12; }); s.travel.lastWeatherDay = s.travel.day; });
      await page.click('[data-test=roll-now]');
      await H.clickModal(page, 'Campfire event');
      await page.waitForTimeout(300);
      equal(await modalOpen(page), false, 'not now');
      const tonight = (await st(page)).journey.tonight;
      assert(tonight && /^c\d+$/.test(tonight.event), JSON.stringify(tonight));
      assert(/will come at tonight's camp\.$/.test(await text(page, 'notice')), await text(page, 'notice'));
      await pause(page);
      await page.click('[data-test=camp]');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      const j = await journeyView(page);
      assert(/^Campfire event • /.test(j.meta) && /^C\d+$/.test(j.meta.split(' • ')[2]), j.meta);
      equal((await st(page)).journey.current.id, tonight.event);
      await closeAll(page);
    });

    await check('Open the Bastion ↗ (the Travel panel, and "The Ironbow sends word…") opens the Bastion Manager in a new window, once', async () => {
      await chances(page, 0, 0);
      await page.evaluate(() => { const s = TSI.explorer.debug.state(); s.travel.day = 7; s.travel.lastWeatherDay = 7; });
      equal(await page.textContent('[data-test=open-bastion]'), 'Open the Bastion ↗');
      await pause(page);
      const [win] = await Promise.all([context.waitForEvent('page'), page.click('[data-test=open-bastion]')]);
      await win.waitForLoadState();
      assert(/\?tool=bastion$/.test(win.url()), win.url());
      equal(await text(page, 'notice'), 'The Bastion Manager opened in a new window.');
      /* While it's open, a second press says so instead of opening another. */
      await win.waitForSelector('[data-test=day-status]');
      await page.waitForTimeout(1700);
      let opened = 0;
      const count = () => { opened += 1; };
      context.on('page', count);
      await page.click('[data-test=open-bastion]');
      await page.waitForTimeout(800);
      context.off('page', count);
      equal(opened, 0, 'no second Bastion window');
      equal(await text(page, 'notice'), 'The Bastion Manager is already open in another window. It follows the Explorer\'s day by itself.');
      await win.close();
      /* From the word at Make Camp. */
      await seedBastion(page, 8, 7);
      await page.waitForTimeout(1700);
      await pause(page);
      await page.click('[data-test=camp]');
      await page.waitForSelector('[data-test=ironbow-word]');
      const [win2] = await Promise.all([context.waitForEvent('page'), page.click('[data-test=ironbow-word] .tsi-modal__foot button:text-is("Open the Bastion ↗")')]);
      await win2.waitForLoadState();
      assert(/\?tool=bastion$/.test(win2.url()), win2.url());
      await win2.close();
      await closeAll(page);
      await page.evaluate(() => TSI.store.remove('tsi.bastion.state'));
      await chances(page, 0.3, 0.25);
    });
    await H.shot(page, 'p8-new-panel');
    equal(context.log.errors, []);
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Full screen, Hide UI and the H key');
  {
    const { context, page } = await newPage(browser, 'tv');
    await openExplorer(page);
    await loadMap(page, 'southern_province_east');

    await check('Fullscreen fills the TV with the map and both panels', async () => {
      await page.click('[data-test=fullscreen]');
      await page.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.classList.contains('tsi-exp-wrap'));
      await page.waitForTimeout(300);
      const v = await page.evaluate(() => TSI.explorer.debug.view());
      assert(v.fit > 0.9, JSON.stringify(v));
      await H.shot(page, 'p8-04-tv-fullscreen');
    });

    await check('H hides everything but the map, and brings it back', async () => {
      await page.keyboard.press('h');
      await page.waitForTimeout(200);
      equal(await page.isVisible('.tsi-exp-controls'), false);
      equal(await page.isVisible('[data-test=show-ui]'), true);
      const v = await page.evaluate(() => TSI.explorer.debug.view());
      equal(Math.round(v.fit * 1080), 1080, 'the 4:3 map is the TV\'s full height');
      await H.shot(page, 'p8-05-tv-bare');
      await page.keyboard.press('H');
      equal(await page.isVisible('.tsi-exp-controls'), true);
    });

    await check('pop-ups and notices show inside full screen (EXP-15)', async () => {
      /* Make sure tonight brings a campfire event. */
      await chances(page, 0, 1);
      await page.evaluate(() => { const s = TSI.explorer.debug.state(); s.travel.lastWeatherDay = s.travel.day; });
      await page.click('[data-test=camp]');
      await page.waitForSelector('.tsi-modal');
      assert(await page.evaluate(() => document.fullscreenElement.contains(document.querySelector('.tsi-modal'))));
      await closeAll(page);
      await chances(page, 0.3, 0.25);
      await page.evaluate(() => TSI.notify('Test notice'));
      assert(await page.evaluate(() => document.fullscreenElement.contains(document.querySelector('.tsi-notices'))));
      equal(await page.evaluate(() => !!document.fullscreenElement), true, 'still full screen');
    });

    await check('H does nothing while typing in a box', async () => {
      await leaveFullscreen(page);
      await page.click('[data-test=pick]');
      const at = await page.evaluate(() => TSI.explorer.debug.toScreen(300, 300));
      await page.mouse.click(at.x, at.y);
      await page.waitForSelector('.tsi-exp-pickbox');
      await page.focus('.tsi-exp-pickbox');
      await page.keyboard.press('h');
      await H.clickModal(page, 'OK');
      equal(await page.isVisible('.tsi-exp-controls'), true);
      await page.focus('[data-test=region]');
      await page.keyboard.press('h');
      equal(await page.isVisible('.tsi-exp-controls'), true, 'nor in a list');
    });

    await check('the Hide UI button works in a window too', async () => {
      await page.click('[data-test=hide-ui]');
      equal(await page.isVisible('.tsi-exp-controls'), false);
      await page.click('[data-test=show-ui]');
      equal(await page.isVisible('.tsi-exp-controls'), true);
    });
    equal(context.log.errors, []);
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Saving: reopening, uploads, backups and damaged files');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openExplorer(page);
    await loadMap(page, 'eastern_province_north');
    await page.click('[data-test=snap]');
    await page.evaluate(() => { TSI.explorer.debug.state().travel.nextTravelEventAtMiles = 99; });
    await dragHex(page, 'kaelen', 2, 0);
    await dragHex(page, 'magnus', 0, 1);
    await page.click('[data-test=fog]');
    await page.click('[data-test=hex-up]');

    await check('everything survives reopening, heroes\' miles included (EXP-03)', async () => {
      const before = await st(page);
      await page.evaluate(() => TSI.store.flush());
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      const after = await st(page);
      ['tokens', 'grid', 'fog', 'snap', 'travel', 'mapPresetId', 'freeMove'].forEach(k => equal(after[k], before[k], k));
      equal(await page.$$eval('.tsi-exp-pill', ps => ps.map(p => p.textContent)), ['K 12/30', 'U 0/30', 'M 6/30', 'E 0/30', 'C 0/30']);
    });

    await check('an uploaded map (under 4 MB) is kept after reopening', async () => {
      await page.setInputFiles('[data-test=upload-input]', MAP_SRC);
      await page.waitForFunction(() => TSI.explorer.debug.state().mapUploadKey);
      await page.evaluate(() => TSI.store.flush());
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      await page.waitForFunction(() => { const i = document.querySelector('.tsi-exp-map'); return i.complete && i.naturalWidth > 0; });
      assert((await page.getAttribute('.tsi-exp-map', 'src')).indexOf('data:image/png') === 0);
      equal((await st(page)).mapPresetId, null);
    });

    await check('a picture over 4 MB is refused with a message', async () => {
      await page.setInputFiles('[data-test=upload-input]', BIG);
      assert(/over ~4MB/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
    });

    await check('a full storage warns, and the Explorer keeps working (EXP-05)', async () => {
      await page.evaluate(() => { window.__failSaves = true; });
      await pause(page);
      await page.click('[data-test=token-up]');
      await H.waitForNotice(page, /couldn|save/i);
      await pause(page);
      await page.click('[data-test=token-down]');
      await page.evaluate(() => { window.__failSaves = false; });
      await H.dismissNotices(page);
    });

    await check('Clear map asks first', async () => {
      await pause(page);
      await page.click('[data-test=clear-map]');
      assert(/Clear the uploaded map\? \(Tokens\/grid will remain\.\)/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      const s = await st(page);
      equal([s.mapPresetId, s.mapUploadKey], [null, null]);
      await page.evaluate(() => TSI.store.flush());
      equal(await page.evaluate(() => TSI.store.has('tsi.explorer.mapImage')), false);
    });

    let exported = null;
    await check('Export Save downloads the journey, as the campaign file', async () => {
      await loadMap(page, 'the_north_isle');
      const d = await H.download(page, '[data-test=export-save]');
      exported = d.text;
      await page.waitForFunction(() => document.querySelector('[data-test=notice]').textContent === 'Save exported.');
      const file = JSON.parse(d.text);
      assert(/^tsi-campaign-\d{4}-\d\d-\d\d-\d{4}\.json$/.test(d.name), d.name);
      equal([file.kind, file.tools], ['campaign', ['explorer', 'bastion']], 'one campaign save: the Explorer and the Bastion together (Harry, 8 October 2026)');
      assert(JSON.stringify(file).indexOf('the_north_isle') > 0);
      equal(await text(page, 'notice'), 'Save exported.');
    });

    await check('Import asks first, and Cancel changes nothing (EXP-09)', async () => {
      const f = H.writeTemp('explorer-backup.json', exported);
      await loadMap(page, 'the_east_isle');
      await H.chooseFile(page, '[data-test=import-save]', f);
      assert(/Import into/.test(await page.textContent('.tsi-modal__title')));
      await H.clickModal(page, 'Cancel');
      equal((await st(page)).mapPresetId, 'the_east_isle');
      await H.chooseFile(page, '[data-test=import-save]', f);
      await H.clickModal(page, 'Import');
      await page.waitForSelector('[data-test=camp]');
      await page.waitForFunction(() => TSI.explorer && TSI.explorer.debug && TSI.explorer.debug.state().mapPresetId === 'the_north_isle');
    });

    await check('a damaged backup is refused, and nothing changes (EXP-12)', async () => {
      const file = JSON.parse(exported);
      const rec = file.records.find(r => r.key === 'tsi.explorer.save');
      rec.value.tokens = [null];
      const f = H.writeTemp('explorer-bad.json', file);
      await H.chooseFile(page, '[data-test=import-save]', f);
      assert(/isn't in the right form/.test(await H.modalText(page)), await H.modalText(page));
      await H.clickModal(page, 'OK');
      equal((await st(page)).mapPresetId, 'the_north_isle');
    });

    await check('a damaged save is set aside and the Explorer still opens', async () => {
      await page.evaluate(() => TSI.store.set('tsi.explorer.save', { grid: {}, tokens: [null], travel: {} }));
      await page.evaluate(() => TSI.store.flush());
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      await H.waitForNotice(page, /set aside/);
      equal(await text(page, 'day'), 'Day 1');
      const keys = await page.evaluate(() => TSI.store.keys());
      assert(keys.some(k => /^tsi\.quarantine\.explorer\.save\./.test(k)), keys.join());
    });
    equal(context.log.errors, []);
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The pin-check page (tests/pin-check.html)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await check('it shows all ten maps with all 33 pins, 18 of them marked hidden', async () => {
      await page.goto(H.fileUrl('tests/pin-check.html'));
      await page.waitForFunction(() => Array.from(document.querySelectorAll('img.pc-picture')).every(i => i.complete && i.naturalWidth > 0));
      equal(await page.$$eval('img.pc-picture', is => is.length), 10);
      equal(await page.$$eval('.pc-pin', ps => ps.length), 33);
      equal(await page.$$eval('.pc-pin--hidden', ps => ps.length), 18);
      equal(context.log.errors, []);
      equal(context.log.failed, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Leaving the Explorer');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openExplorer(page);
    await check('Home leaves cleanly: nothing from the Explorer is left running', async () => {
      await page.evaluate(() => { const s = TSI.explorer.debug.state(); s.travel.activeWeather = { kind: 'rain', day: 1 }; });
      const counts = await page.evaluate(() => TSI.shell.current().life.counts());
      assert(counts.media >= 1, JSON.stringify(counts));
      await page.click('.tsi-topbar__home');
      await page.waitForSelector('.tsi-card');
      equal(await page.evaluate(() => !!(window.TSI.explorer && window.TSI.explorer.debug)), false);
    });
    await check('H does nothing on the home screen', async () => {
      await page.keyboard.press('h');
      equal(context.log.errors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Compared with the old Explorer (same dice, same journey)');
  if (!HAS_LEGACY) {
    await check('the old Explorer is in _legacy/ (clone it to run this part)', async () => { throw new Error('not found: ' + LEGACY_DIR); });
  } else {
    const srv = await serve(LEGACY_DIR);
    const oldCtx = await browser.newContext(H.SIZES.laptop);
    await oldCtx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await oldCtx.addInitScript(setup);
    const old = await oldCtx.newPage();
    const oldErrors = [];
    old.on('pageerror', e => oldErrors.push(e.message));
    old.on('dialog', d => d.accept());
    await old.goto('http://127.0.0.1:' + srv.address().port + '/');
    await old.waitForTimeout(1500);
    const { context, page } = await newPage(browser, 'laptop');
    await openExplorer(page);

    const O = {
      state: () => old.evaluate(() => JSON.parse(localStorage.getItem('scarlettIsles.explorer.v1') || '{}')),
      hud: () => old.evaluate(() => ({
        day: document.getElementById('explorerDayLabel').textContent,
        miles: document.getElementById('explorerMilesUsed').textContent,
        left: document.getElementById('explorerMilesLeft').textContent,
        mode: document.getElementById('explorerMode').textContent,
        effects: document.getElementById('explorerEffects').textContent,
        pills: Array.from(document.querySelectorAll('.milesPill')).map(p => p.textContent.replace(/\s+/g, ' ').trim()),
        notice: document.getElementById('explorerNotice').textContent
      })),
      modal: () => old.evaluate(() => {
        const m = document.getElementById('evModal');
        if (!m.classList.contains('isOpen')) return null;
        const img = document.querySelector('#evMedia img');
        return {
          meta: document.getElementById('evMeta').textContent,
          title: document.getElementById('evTitle').textContent,
          desc: document.getElementById('evDesc').textContent,
          img: img && document.getElementById('evMedia').style.display !== 'none' ? img.getAttribute('src').split('/').pop() : '',
          choices: Array.from(document.querySelectorAll('#evChoices button')).map(b => b.textContent),
          roll: !!document.getElementById('weatherRollInput')
        };
      }),
      async dragHex(id, dq, dr) {
        const at = await old.evaluate(id => { const r = document.querySelector('.explorer-token[data-id="' + id + '"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
        await drag(old, at, { x: 38 * Math.sqrt(3) * (dq + dr / 2), y: 38 * 1.5 * dr });
      },
      firstChoice: async () => { await old.click('#evChoices button >> nth=0'); await old.waitForTimeout(80); },
      close: async () => { await old.click('#evClose'); await old.waitForTimeout(80); }
    };
    const N = {
      hud: async () => ({
        day: await text(page, 'day'), miles: await text(page, 'miles'), left: await text(page, 'miles-left'),
        mode: await text(page, 'mode'), effects: await text(page, 'effects'),
        pills: await page.$$eval('.tsi-exp-pill', ps => ps.map(p => p.textContent.replace(/\s+/g, ' ').trim())),
        notice: await text(page, 'notice')
      }),
      async dragHex(id, dq, dr) { await dragHex(page, id, dq, dr); }
    };
    /* Harry's new events (6 October 2026) replace the old travel and
       campfire events, and draw their dice differently, so the event and
       weather records no longer match the old tool's. What's compared is
       everything the new events didn't change: days, miles, pace, the
       panel, groups, Free Move, refused moves, main events, Reset Travel. */
    const pick = s => ({
      travel: ['day', 'provinceId', 'forcedMainEvent', 'forcedMainEventFired'].reduce((o, k) => { o[k] = s.travel[k]; return o; }, {}),
      miles: s.tokens.map(t => t.milesUsed),
      grouped: s.tokens.map(t => !!t.groupId),
      freeMove: s.freeMove,
      snap: s.snap.enabled,
      map: s.mapPresetId
    });
    const steps = [];
    const met = {};
    async function compare(label) {
      const [oh, nh] = [await O.hud(), await N.hud()];
      /* The old tool's pills put a space inside: "K 6/30". Slow's "good
         foraging" went with the rations (Harry, 6 October 2026). */
      oh.pills = oh.pills.map(p => p.replace(/\s*\/\s*/, '/'));
      oh.effects = oh.effects.replace(' • good foraging', '');
      equal(nh, oh, label + ' (travel panel)');
      equal(pick(await st(page)), pick(await O.state()), label + ' (saved journey)');
      steps.push(label);
    }
    /* Both show an event: compare, pick the first choice until the result, compare, close. */
    async function bothEvent(label) {
      let ov = await O.modal();
      /* The old weekly Bastion reminder: gone from the rebuild (Harry, 8 October 2026). */
      if (ov && ov.title === 'Bastion Turn') {
        met['Bastion prompt (old only)'] = (met['Bastion prompt (old only)'] || 0) + 1;
        await O.close();
        ov = await O.modal();
      }
      /* The old travel events: closed unanswered (the rebuild's new events are kept off here). */
      if (ov && / Event • /.test(ov.meta) && ov.meta.indexOf('Main Campaign') !== 0) {
        met[ov.meta.split(' • ')[0] + ' (old only)'] = (met[ov.meta.split(' • ')[0] + ' (old only)'] || 0) + 1;
        await O.close();
        ov = await O.modal();
      }
      const nv = await eventView(page);
      assert(!!ov === !!nv, label + ': a pop-up in one but not the other: ' + JSON.stringify([ov, nv]));
      if (!ov) return;
      const kind = ov.title === 'Bastion Turn' ? 'Bastion prompt' : ov.meta.split(' • ')[0];
      met[kind] = (met[kind] || 0) + 1;
      equal({ meta: nv.meta, title: nv.title, desc: nv.desc, img: nv.img, choices: nv.choices }, { meta: ov.meta, title: ov.title, desc: ov.desc, img: ov.img, choices: ov.choices }, label + ' (pop-up)');
      let n = 0;
      while (n++ < 8) {
        const o = await O.modal();
        if (!o || o.title === 'Result' || o.roll) break;
        const ch = o.choices[0];
        await O.firstChoice();
        await firstChoice(page);
        const o2 = await O.modal(), n2 = await eventView(page);
        if (!o2) { assert(!n2, label + ': closed in one only'); break; }
        equal({ meta: n2.meta, title: n2.title, desc: n2.desc, img: n2.img }, { meta: o2.meta, title: o2.title, desc: o2.desc, img: o2.img }, label + ' after "' + ch + '"');
      }
      if (await O.modal()) { await O.close(); await closePopup(page); }
    }
    /* The night's pop-ups (campfire, weather, and the old tool's Bastion
       prompt) are closed unanswered in both, so both end the night in the
       same state. */
    async function bothCamp(label) {
      await old.click('#explorerMakeCamp');
      await pause(page);
      await page.click('[data-test=camp]');
      await page.waitForTimeout(150);
      let n = 0;
      while (await O.modal() && n++ < 6) await O.close();
      const kinds = [];
      n = 0;
      while (await modalOpen(page) && n++ < 6) {
        const v = await eventView(page);
        if (v) kinds.push(v.meta.split(' • ')[0]);
        await closePopup(page);
      }
      return kinds;
    }

    await check('the same journey gives the same days, miles, pace and panel, step by step (events aside)', async () => {
      await old.evaluate(() => window.__seed(2026));
      await page.evaluate(() => window.__seed(2026));
      await chances(page, 0, 0);
      await old.selectOption('#explorerMapPreset', 'the_north_isle'); await old.click('#explorerLoadPreset');
      await loadMap(page, 'the_north_isle');
      await old.click('#explorerSnapToggle');
      await page.click('[data-test=snap]');
      await compare('load the North Isle, Snap on');
      /* The heroes start in different hexes in the two tools (the old one
         measured the window), so first put each on the same hex in both,
         with Free Move so it costs nothing. */
      const spots = { kaelen: [2, 2], umbrys: [8, 2], magnus: [2, 7], elara: [8, 7], charles: [13, 4] };
      await old.click('#explorerFreeMove'); await pause(page); await page.click('[data-test=free-move]');
      for (const id of Object.keys(spots)) {
        const oh = (await O.state()).tokens.find(t => t.id === id).axial;
        await O.dragHex(id, spots[id][0] - oh.q, spots[id][1] - oh.r);
        const nh = await tokHex(page, id);
        await N.dragHex(id, spots[id][0] - nh.q, spots[id][1] - nh.r);
      }
      equal((await O.state()).tokens.map(t => [t.axial.q, t.axial.r]), Object.values(spots), 'old tool placed');
      const placed = [];
      for (const id of Object.keys(spots)) { const h = await tokHex(page, id); placed.push([h.q, h.r]); }
      equal(placed, Object.values(spots), 'rebuild placed');
      await old.click('#explorerFreeMove'); await pause(page); await page.click('[data-test=free-move]');
      await compare('heroes placed on the same hexes');
      /* Kaelen and Umbrys travel as a group. */
      for (const p of [old, page]) {
        const pos = p === old
          ? await old.evaluate(() => ['kaelen', 'umbrys'].map(id => { const r = document.querySelector('.explorer-token[data-id="' + id + '"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }))
          : await page.evaluate(() => ['kaelen', 'umbrys'].map(id => TSI.explorer.debug.tokenScreen(id)));
        await p.mouse.click(pos[0].x, pos[0].y);
        await p.keyboard.down('Control'); await p.mouse.click(pos[1].x, pos[1].y); await p.keyboard.up('Control');
        await p.waitForTimeout(400);
        await p.click(p === old ? '#explorerGroup' : '[data-test=group]');
      }
      await compare('group Kaelen and Umbrys');
      const kinds = {};
      for (let day = 1; day <= 10; day++) {
        const sign = day % 2 ? 1 : -1;
        const moves = [['kaelen', sign, 0], ['magnus', 0, sign], ['elara', sign, sign], ['charles', 2 * sign, 0]];
        if (day === 3) moves.push(['elara', 3 * sign, 0], ['elara', 3 * sign, 0]);   /* the second is too far */
        for (const [id, dq, dr] of moves) {
          await O.dragHex(id, dq, dr);
          await N.dragHex(id, dq, dr);
          await bothEvent('day ' + day + ' ' + id + ' move');
          await compare('day ' + day + ': ' + id + ' moves ' + dq + ',' + dr);
        }
        if (day === 5) {
          await old.click('#explorerFreeMove'); await pause(page); await page.click('[data-test=free-move]');
          await O.dragHex('umbrys', 2, 0); await N.dragHex('umbrys', 2, 0);
          await compare('day 5: Free Move');
          await old.click('#explorerFreeMove'); await pause(page); await page.click('[data-test=free-move]');
          await compare('day 5: Free Move off');
        }
        (await bothCamp('camp after day ' + day)).forEach(k => { kinds[k] = (kinds[k] || 0) + 1; });
        await compare('camp after day ' + day);
      }
      /* The run met the old travel events (closed unanswered), weather, and
         a refused move. */
      assert(kinds.Weather >= 1, JSON.stringify(kinds));
      assert(met['Travel Event (old only)'] >= 1, JSON.stringify(met));
      assert(steps.some(s => /day 3: elara moves 3,0/.test(s)), 'the too-far move was compared');
      console.log('      (met in both: ' + JSON.stringify(met) + ')');
    });

    await check('the main events show the same pictures and words at every step', async () => {
      for (const id of ['tide_remembers_prologue', 'turning_tide']) {
        await old.selectOption('#explorerMainEventSelect', id); await old.click('#explorerQueueMainEvent');
        await page.selectOption('[data-test=main-select]', id); await pause(page); await page.click('[data-test=queue]');
        await bothEvent(id);
        await compare('main event ' + id);
      }
    });

    await check('Reset Travel matches', async () => {
      await old.click('#explorerResetTravel');
      await pause(page); await page.click('[data-test=reset-travel]'); await H.clickModal(page, 'OK');
      await compare('Reset Travel');
      console.log('      (' + steps.length + ' steps compared)');
    });

    await check('neither Explorer had an error', async () => {
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
