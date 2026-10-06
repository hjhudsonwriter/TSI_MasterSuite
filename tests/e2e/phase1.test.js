/* Phase 1 click-through: the shell (home screen, top bar, saving, backups,
   player windows, the "already open" warning, tidy shutdown).
   Uses index.html for the home screen and tests/harness.html, which adds a
   pretend "Demo tool", for everything that needs a tool.
   Run:  node tests/e2e/phase1.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const HARNESS = H.fileUrl('tests/harness.html');
const SHOP = 'https://mattjowen1991-hue.github.io/scarlett-isles-companion/';
const EXPECTED_CARDS = [
  ['Combat Tracker & VTT Battlemap', 'DM Tool', '7'],
  ['Notice Board Quest Generator', 'DM Tool', '4'],
  ['The Ironbow Bastion Manager', 'DM Tool', '9'],
  ['Scarlett Isles Explorer', 'World', '8'],
  ['Clan Crest Creator', 'Players', '2'],
  ['Arenas of The Scarlett Isles', 'Set Pieces', '6'],
  ['The Heartwood Ritual', 'Set Pieces', '5'],
  ['Pelagosi Puzzle Trials', 'Set Pieces', '3']
];
/* Which tools are built so far comes from shared/data/tools.js, so these
   checks keep working as each phase lands. */
const TOOLS = H.toolList();
const BUILT = new Set(TOOLS.filter(t => t.built).map(t => t.name));
const UNBUILT = TOOLS.find(t => !t.built) || null;

function demoRecord(count, note) {
  return { key: 'tsi.demo.state', value: { count: count, note: note || '' }, savedAt: '2026-09-25T13:03:00.000Z' };
}
/* A tool export. space: 'suite' (the real suite; files from phase 1 have no space
   at all) or 'test' (the test page, tests/harness.html). */
function toolFile(tool, records, space) {
  const f = { format: 'tsi-backup', version: 1, kind: 'tool', tool: tool, suite: 'The Scarlett Isles: D&D Tool Suite', savedAt: '2026-09-25T13:03:00.000Z', records: records };
  if (space) f.space = space;
  return f;
}

async function openDemo(page) {
  await page.goto(HARNESS + '?tool=demo');
  await page.waitForSelector('[data-test=count]');
}

async function demoCount(page) {
  return Number(await page.textContent('[data-test=count]'));
}

async function savedCount(page) {
  return page.evaluate(() => TSI.store.ready.then(() => (TSI.store.get('tsi.demo.state') || {}).count));
}

async function waitSaved(page) {
  await page.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
}

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('Home screen, with the internet off');
  for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
    const context = await H.newContext(browser, size);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    if (size === 'laptop') {
      await check('title, logo and tagline', async () => {
        equal(await page.textContent('.tsi-home__title'), 'The Scarlett Isles: D&D Tool Suite');
        equal(await page.textContent('.tsi-home__tagline'), 'One doorway. Many wonders. Choose your tool.');
        equal(await page.title(), 'The Scarlett Isles: D&D Tool Suite');
        const logoOk = await page.$eval('.tsi-home__logo', i => i.complete && i.naturalWidth > 0);
        assert(logoOk, 'the hub logo did not load');
        const artOk = await page.evaluate(() => new Promise(res => {
          const url = getComputedStyle(document.querySelector('.tsi-art__img')).backgroundImage.slice(5, -2);
          const img = new Image();
          img.onload = () => res(img.naturalWidth > 0 && /shared\/art\/hero\.png$/.test(url));
          img.onerror = () => res(false);
          img.src = url;
        }));
        assert(artOk, 'the painted art did not load');
        const covered = await page.evaluate(() => {
          const b = getComputedStyle(document.body);
          return b.backgroundColor !== 'rgba(0, 0, 0, 0)' || b.backgroundImage !== 'none';
        });
        assert(!covered, 'the page body has a background that hides the painted art');
      });

      await check('headings in Cinzel and body text in Cormorant Garamond, loaded from the suite folder', async () => {
        const f = await page.evaluate(() => ({
          loaded: Array.from(document.fonts).filter(x => x.status === 'loaded').map(x => x.family.replace(/"/g, '')),
          h1: getComputedStyle(document.querySelector('.tsi-home__title')).fontFamily,
          body: getComputedStyle(document.querySelector('.tsi-card__desc')).fontFamily
        }));
        assert(f.loaded.includes('Cinzel'), 'Cinzel not loaded: ' + f.loaded);
        assert(f.loaded.includes('Cormorant Garamond'), 'Cormorant Garamond not loaded: ' + f.loaded);
        assert(/^"?Cinzel/.test(f.h1), 'heading font ' + f.h1);
        assert(/^"?Cormorant Garamond/.test(f.body), 'body font ' + f.body);
      });

      await check('all eight tools, in their groups; built ones open, the rest say their phase', async () => {
        const cards = await page.$$eval('.tsi-card', cs => cs.map(c => [
          c.querySelector('.tsi-card__title').textContent,
          c.querySelector('.tsi-pill').textContent,
          c.querySelector('.tsi-card__cta').textContent,
          c.tagName, c.getAttribute('aria-disabled')
        ]));
        equal(cards.length, 8, 'cards');
        cards.forEach((c, i) => {
          equal(c[0], EXPECTED_CARDS[i][0], 'card ' + (i + 1) + ' name');
          equal(c[1], EXPECTED_CARDS[i][1], c[0] + ' group');
          if (BUILT.has(c[0])) {
            equal(c[2], 'Open', c[0] + ' label');
            assert(c[3] === 'A' && c[4] === null, c[0] + ' should open');
          } else {
            equal(c[2], 'Coming in phase ' + EXPECTED_CARDS[i][2], c[0] + ' label');
            assert(c[3] === 'DIV' && c[4] === 'true', c[0] + ' should not be openable yet');
          }
        });
      });

      if (UNBUILT) await check('an unbuilt tool can\'t be opened', async () => {
        await page.click('.tsi-card[data-tool=' + UNBUILT.id + ']');
        await page.waitForTimeout(300);
        equal(page.url(), INDEX);
      });

      await check('opening an unbuilt tool by its address shows home and says when it\'s coming', async () => {
        const p2 = await context.newPage();
        if (UNBUILT) {
          await p2.goto(INDEX + '?tool=' + UNBUILT.id);
          const the = /^The /.test(UNBUILT.name) ? UNBUILT.name : 'The ' + UNBUILT.name;
          await H.waitForNotice(p2, new RegExp(the.replace(/[&]/g, '\\$&') + ' is coming in phase ' + UNBUILT.phase));
          equal(await p2.$$eval('.tsi-card', c => c.length), 8);
        }
        await p2.goto(INDEX + '?tool=nonsense');
        await H.waitForNotice(p2, /no tool called "nonsense"/);
        await p2.close();
      });

      await check('Knightly Treasures shop link in the footer', async () => {
        const a = await page.$eval('[data-test=shop-link]', l => ({ href: l.href, target: l.target, rel: l.rel, text: l.textContent }));
        equal(a.href, SHOP);
        equal(a.target, '_blank');
        equal(a.rel, 'noopener');
        equal(a.text, 'Knightly Treasures shop ↗');
        const note = await page.textContent('.tsi-home__shop .tsi-extlink__note');
        equal(note, '(needs internet)');
      });
    }

    await check(size + ': fits with no sideways scroll, cards and footer in view', async () => {
      const inView = size === 'smallWindow' ? [] : ['.tsi-card', '.tsi-home__footer button', '.tsi-topbar [data-test=switch-tool]'];
      const l = await H.layoutCheck(page, inView);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll: ' + l.scrollWidth + ' > ' + l.clientWidth);
      equal(l.outOfView, [], 'out of view');
    });
    await H.shot(page, 'home-' + size);

    await check(size + ': nothing loaded from the internet, nothing missing, no errors', async () => {
      equal(context.log.net, [], 'internet requests');
      equal(context.log.failed, [], 'missing files');
      equal(context.log.errors, [], 'page errors');
      equal(context.log.consoleErrors, [], 'console errors');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Knightly Treasures shop link');
  {
    const context = await H.newContext(browser, 'laptop');
    const page = await context.newPage();
    await page.goto(INDEX);
    await page.waitForSelector('[data-test=shop-link]');
    await check('clicking it opens the shop in a new tab (the page itself needs internet)', async () => {
      const [tab] = await Promise.all([context.waitForEvent('page'), page.click('[data-test=shop-link]')]);
      await page.waitForTimeout(1000);
      assert(context.log.net.some(u => u.startsWith(SHOP)), 'no request for the shop: ' + context.log.net);
      assert(page.url() === INDEX, 'the suite should stay open');
      await tab.close();
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Top bar: Switch tool');
  {
    const context = await H.newContext(browser, 'laptop');
    const page = await context.newPage();
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');

    await check('lists Home and all eight tools, grouped; unbuilt ones not clickable', async () => {
      await page.click('[data-test=switch-tool]');
      await page.waitForSelector('.tsi-menu:not([hidden])');
      const items = await page.$$eval('.tsi-menu__item', xs => xs.map(x => [x.dataset.tool, x.getAttribute('aria-disabled'), x.textContent]));
      equal(items.length, 9);
      equal(items[0][0], 'home');
      const groups = await page.$$eval('.tsi-menu__group', gs => gs.map(g => g.textContent));
      equal(groups, ['DM Tool', 'World', 'Players', 'Set Pieces']);
      items.slice(1).forEach(i => {
        const built = TOOLS.find(t => t.id === i[0]).built;
        if (built) assert(i[1] === null && !/Coming in phase/.test(i[2]), i[2]);
        else assert(i[1] === 'true' && /Coming in phase \d/.test(i[2]), i[2]);
      });
      equal(await page.getAttribute('[data-test=switch-tool]', 'aria-expanded'), 'true');
      await H.shot(page, 'switch-tool-menu');
    });

    await check('arrow keys move through it and Esc closes it', async () => {
      const before = await page.evaluate(() => document.activeElement.dataset.tool);
      await page.keyboard.press('ArrowDown');
      const after = await page.evaluate(() => document.activeElement.dataset.tool);
      assert(before !== after, 'focus did not move');
      await page.keyboard.press('Escape');
      assert(await page.$eval('.tsi-menu', m => m.hidden), 'menu still open');
      equal(await page.evaluate(() => document.activeElement.dataset.test), 'switch-tool');
    });

    await check('clicking elsewhere closes it', async () => {
      await page.click('[data-test=switch-tool]');
      await page.mouse.click(20, 500);
      assert(await page.$eval('.tsi-menu', m => m.hidden), 'menu still open');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Top bar: Switch tool, opening a tool in a new window');
  {
    /* Inside a tool, each other built tool's row has a small ↗ button that
       opens it in a separate window (TSI.shell.openWindow). Not the open
       tool, Home, unbuilt tools, or anything on the home screen's menu: those
       would set off the "Already open" warning. */
    const ALREADY = /Already open\./;
    const CREST_TOO = /Already open\. The Clan Crest Creator is also open in another tab or window\./;
    const warned = async p => (await H.noticeTexts(p)).some(t => ALREADY.test(t));
    const menuRows = p => p.$$eval('.tsi-menu__item', xs => xs.map(x => {
      const row = x.parentNode.classList.contains('tsi-menu__row') ? x.parentNode : null;
      const nw = row ? row.querySelector('.tsi-menu__newwin') : null;
      return { tool: x.dataset.tool, newwin: nw ? { test: nw.dataset.test, title: nw.title, hidden: nw.querySelector('.tsi-sr-only').textContent, glyph: nw.querySelector('[aria-hidden=true]').textContent, role: nw.getAttribute('role') } : null };
    }));
    const others = id => TOOLS.filter(t => t.built && t.id !== id).map(t => t.id);

    for (const size of ['laptop', 'tv']) {
      const context = await H.newContext(browser, size);
      const page = await context.newPage();

      if (size === 'laptop') await check('the home screen\'s menu has no new-window buttons', async () => {
        await page.goto(INDEX);
        await page.waitForSelector('.tsi-card');
        await page.click('[data-test=switch-tool]');
        await page.waitForSelector('.tsi-menu:not([hidden])');
        equal(await page.$$eval('.tsi-menu__newwin', b => b.length), 0);
        equal(await page.$$eval('.tsi-menu__item', b => b.length), 9);
        await page.keyboard.press('Escape');
      });

      await page.goto(INDEX + '?tool=crest');
      await page.waitForSelector('.tsi-topbar__tool');

      await check(size + ': inside a tool, every other built tool has a ↗ new-window button; the open tool and Home don\'t', async () => {
        await page.click('[data-test=switch-tool]');
        await page.waitForSelector('.tsi-menu:not([hidden])');
        const rows = await menuRows(page);
        equal(rows.length, 9, 'Home and the eight tools, as before');
        equal(rows.filter(r => r.newwin).map(r => r.tool), others('crest'));
        equal(rows.find(r => r.tool === 'home').newwin, null, 'Home');
        equal(rows.find(r => r.tool === 'crest').newwin, null, 'the open tool');
        rows.filter(r => r.newwin).forEach(r => {
          const name = TOOLS.find(t => t.id === r.tool).name;
          equal(r.newwin, { test: 'newwin-' + r.tool, title: 'Open ' + name + ' in a new window', hidden: 'Open ' + name + ' in a new window', glyph: '↗', role: 'menuitem' });
        });
      });

      await check(size + ': the menu is tidy: names on one line, nothing sideways, all in view', async () => {
        const m = await page.evaluate(() => {
          const menu = document.querySelector('.tsi-menu');
          const r = menu.getBoundingClientRect();
          const labels = Array.from(menu.querySelectorAll('.tsi-menu__label')).map(l => {
            const lh = parseFloat(getComputedStyle(l).lineHeight) || 17;
            return [l.textContent, l.getClientRects().length, l.getBoundingClientRect().height <= lh * 1.5];
          });
          const rowTops = Array.from(menu.querySelectorAll('.tsi-menu__row')).every(row => {
            const a = row.querySelector('.tsi-menu__item').getBoundingClientRect();
            const b = row.lastElementChild.getBoundingClientRect();
            return Math.abs(a.top - b.top) < 1 && b.left >= a.right;
          });
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: innerWidth, h: innerHeight, sw: menu.scrollWidth, cw: menu.clientWidth, labels, rowTops, page: [document.documentElement.scrollWidth, document.documentElement.clientWidth] };
        });
        m.labels.forEach(l => assert(l[1] === 1 && l[2], 'wrapped: ' + l[0]));
        assert(m.rowTops, 'a ↗ button isn\'t at the right end of its row');
        assert(m.sw <= m.cw, 'the menu scrolls sideways: ' + m.sw + ' > ' + m.cw);
        assert(m.left >= 0 && m.right <= m.w && m.top >= 0 && m.bottom <= m.h, 'out of view: ' + JSON.stringify(m));
        assert(m.page[0] <= m.page[1], 'the page scrolls sideways');
        await H.shot(page, 'menu-newwin-' + size);
      });

      if (size === 'tv') { await context.close(); continue; }

      await check('arrow keys go through the ↗ buttons too; → and ← move along a row', async () => {
        const order = await page.$$eval('.tsi-menu__item, .tsi-menu__newwin', xs => xs.map(x => x.dataset.test || x.dataset.tool));
        await page.keyboard.press('Home');
        const seen = [];
        for (let i = 0; i < order.length; i++) {
          seen.push(await page.evaluate(() => document.activeElement.dataset.test || document.activeElement.dataset.tool));
          await page.keyboard.press('ArrowDown');
        }
        equal(seen, order);
        equal(await page.evaluate(() => document.activeElement.dataset.tool), 'home', 'ArrowDown wraps round');
        await page.keyboard.press('End');
        equal(await page.evaluate(() => document.activeElement.dataset.test), 'newwin-' + order[order.length - 1].replace('newwin-', ''));
        await page.focus('.tsi-menu__item[data-tool=quests]');
        await page.keyboard.press('ArrowRight');
        equal(await page.evaluate(() => document.activeElement.dataset.test), 'newwin-quests');
        await page.keyboard.press('ArrowLeft');
        equal(await page.evaluate(() => document.activeElement.dataset.tool), 'quests');
        await page.keyboard.press('ArrowUp');
        equal(await page.evaluate(() => document.activeElement.dataset.test), 'newwin-encounter');
        await page.keyboard.press('Escape');
      });

      let bastion = null;
      await check('clicking ↗ opens the tool in a new window the size of the screen, and closes the menu', async () => {
        await page.evaluate(() => {
          window.__opened = [];
          const real = window.open;
          window.open = function (url, name, features) { window.__opened.push([url, name, features]); return real.apply(this, arguments); };
        });
        await page.click('[data-test=switch-tool]');
        [bastion] = await Promise.all([context.waitForEvent('page'), page.click('[data-test=newwin-bastion]')]);
        await bastion.waitForSelector('.tsi-topbar__tool');
        equal(await bastion.evaluate(() => [location.pathname.split('/').pop(), location.search, document.querySelector('.tsi-topbar__tool').textContent, TSI.tabGuard.tool(), window.opener]),
          ['index.html', '?tool=bastion', 'The Ironbow Bastion Manager', 'bastion', null]);
        const opened = await page.evaluate(() => [window.__opened, screen.availLeft, screen.availTop, screen.availWidth, screen.availHeight]);
        equal(opened[0].length, 1);
        equal(opened[0][0].slice(0, 2), ['index.html?tool=bastion', '_blank']);
        equal(opened[0][0][2], 'noopener,popup,left=' + opened[1] + ',top=' + opened[2] + ',width=' + opened[3] + ',height=' + opened[4]);
        assert(await page.$eval('.tsi-menu', m => m.hidden), 'the menu stayed open');
        equal(await page.getAttribute('[data-test=switch-tool]', 'aria-expanded'), 'false');
        equal(await page.evaluate(() => document.activeElement.dataset.test), 'switch-tool');
        equal(await page.evaluate(() => location.search), '?tool=crest', 'this window stays on the Crest');
      });

      await check('the new window has its own tab id; the two different tools don\'t warn "Already open"', async () => {
        const ids = await Promise.all([page, bastion].map(p => p.evaluate(() => [TSI.tabGuard.id, sessionStorage.getItem('tsi.suite.tab-id')])));
        assert(ids[0][0] !== ids[1][0], 'the new window shares the Crest\'s tab id');
        equal([ids[0][0], ids[1][0]], [ids[0][1], ids[1][1]], 'each keeps its own id in its own sessionStorage');
        await bastion.waitForTimeout(2600); /* more than one heartbeat */
        const beats = await page.evaluate(() => JSON.parse(localStorage.getItem('tsi.suite.tabs')));
        equal([beats[ids[0][0]].tool, beats[ids[1][0]].tool], ['crest', 'bastion'], 'neither overwrote the other\'s heartbeat');
        for (const p of [page, bastion]) {
          assert(!(await warned(p)), 'false warning: ' + (await H.noticeTexts(p)));
          equal(await p.evaluate(() => [TSI.tabGuard.otherCount(), TSI.tabGuard.clashCount()]), [1, 0]);
        }
      });

      await check('Enter on a ↗ button opens it too (here the Crest again, from the Bastion\'s window), and the same tool twice still warns', async () => {
        await bastion.click('[data-test=switch-tool]');
        await bastion.waitForSelector('.tsi-menu:not([hidden])');
        equal((await menuRows(bastion)).filter(r => r.newwin).map(r => r.tool), others('bastion'));
        await bastion.focus('[data-test=newwin-crest]');
        const [crest2] = await Promise.all([context.waitForEvent('page'), bastion.keyboard.press('Enter')]);
        await crest2.waitForSelector('.tsi-topbar__tool');
        equal(await crest2.evaluate(() => location.search), '?tool=crest');
        assert(await bastion.$eval('.tsi-menu', m => m.hidden), 'the menu stayed open');
        await H.waitForNotice(page, CREST_TOO, 4000);
        await H.waitForNotice(crest2, CREST_TOO, 4000);
        await bastion.waitForTimeout(500);
        assert(!(await warned(bastion)), 'the Bastion warned: ' + (await H.noticeTexts(bastion)));
        await H.shot(crest2, 'newwin-crest-twice');
        await crest2.close();
        await page.waitForFunction(() => !Array.from(document.querySelectorAll('.tsi-notice')).some(n => /Already open/.test(n.textContent)), null, { timeout: 12000 });
      });

      await check('Space on a ↗ button opens it too', async () => {
        await page.click('[data-test=switch-tool]');
        await page.focus('[data-test=newwin-pelagosi]');
        const [pel] = await Promise.all([context.waitForEvent('page'), page.keyboard.press('Space')]);
        await pel.waitForSelector('.tsi-topbar__tool');
        equal(await pel.textContent('.tsi-topbar__tool'), 'Pelagosi Puzzle Trials');
        await pel.close();
      });

      await check('TSI.shell.openWindow opens built tools only, and returns nothing', async () => {
        let extra = 0;
        const count = () => { extra++; };
        context.on('page', count);
        const r = await page.evaluate(() => [TSI.shell.openWindow('nonsense'), TSI.shell.openWindow(null), TSI.shell.openWindow(''), TSI.shell.openWindow()]);
        await page.waitForTimeout(800);
        equal(extra, 0, 'windows opened');
        const [enc] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => { window.__r = TSI.shell.openWindow('encounter'); })]);
        equal(await page.evaluate(() => window.__r), undefined);
        await enc.waitForSelector('.tsi-topbar__tool');
        equal(await enc.textContent('.tsi-topbar__tool'), 'Combat Tracker & VTT Battlemap');
        context.off('page', count);
        equal(r, [null, null, null, null]);
        await enc.close();
      });

      await check('no errors on the way', async () => {
        equal(context.log.errors, []);
        equal(context.log.consoleErrors, []);
        equal(context.log.failed, []);
      });
      await context.close();
    }

    const context = await H.newContext(browser, 'laptop');
    /* Pretend the Arenas aren't built yet (before the shell builds its menu). */
    await context.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => { window.TSI_DATA.tools.find(t => t.id === 'arenas').built = false; });
    });
    const page = await context.newPage();
    await check('an unbuilt tool gets no ↗ button', async () => {
      await page.goto(INDEX + '?tool=crest');
      await page.waitForSelector('.tsi-topbar__tool');
      await page.click('[data-test=switch-tool]');
      const rows = await menuRows(page);
      equal(await page.getAttribute('.tsi-menu__item[data-tool=arenas]', 'aria-disabled'), 'true');
      equal(rows.find(r => r.tool === 'arenas').newwin, null);
      equal(rows.filter(r => r.newwin).length, 6);
      equal(await page.evaluate(() => { TSI.shell.openWindow('arenas'); return 'ok'; }), 'ok');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The DM doc: a floating panel on every screen');
  {
    const KEY = 'tsi.dmdoc.layout';
    const PLACEHOLDER = 'Your DM doc will hold campaign notes for your eyes only. What goes in it comes in the next build.';
    const box = (p, sel) => p.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const rect = p => p.evaluate(() => TSI.dmDoc.rect());
    const saved = p => p.evaluate(k => TSI.store.ready.then(() => TSI.store.get(k, null)), KEY);
    const view = p => p.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, top: document.querySelector('.tsi-topbar').getBoundingClientRect().bottom }));
    const isOpen = p => p.$eval('[data-test=dmdoc-panel]', d => !d.hidden).catch(() => false);
    const focused = p => p.evaluate(() => document.activeElement && (document.activeElement.dataset.test || document.activeElement.tagName));
    function inside(r, v) { return r.x >= 0 && r.y >= v.top && r.x + r.w <= v.width && r.y + r.h <= v.height; }
    /* Drag something from a point on it (default: its middle) to (x, y) in the window, or by (dx, dy). */
    async function drag(p, sel, to, from) {
      const b = await box(p, sel);
      const sx = b.x + (from ? from.x : b.w / 2);
      const sy = b.y + (from ? from.y : b.h / 2);
      const ex = to.dx !== undefined ? sx + to.dx : to.x;
      const ey = to.dy !== undefined ? sy + to.dy : to.y;
      await p.mouse.move(sx, sy);
      await p.mouse.down();
      await p.mouse.move((sx + ex) / 2, (sy + ey) / 2, { steps: 3 });
      await p.mouse.move(ex, ey, { steps: 3 });
      await p.mouse.up();
    }
    const BAR_GRAB = { x: 60, y: 20 };
    /* Wait for the opening fade (200 ms) to finish, so what's measured is where it really is. */
    const settled = p => p.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => null))));
    /* Drag the title bar so the panel's top-left corner ends at (x, y). */
    async function moveTo(p, x, y) {
      await settled(p);
      const r = await rect(p);
      const b = await box(p, '[data-test=dmdoc-bar]');
      await drag(p, '[data-test=dmdoc-bar]', { x: x + (b.x - r.x) + BAR_GRAB.x, y: y + (b.y - r.y) + BAR_GRAB.y }, BAR_GRAB);
    }
    async function panelMatches(p) {
      await settled(p);
      const r = await rect(p);
      const b = await box(p, '[data-test=dmdoc-panel]');
      equal([b.x, b.y, b.w, b.h].map(Math.round), [r.x, r.y, r.w, r.h], 'on screen vs TSI.dmDoc.rect()');
      return r;
    }

    for (const size of ['laptop', 'tv']) {
      const context = await H.newContext(browser, size);
      const page = await context.newPage();

      await check(size + ': the home screen has a "DM doc" button just left of Switch tool; nothing is saved until it\'s used', async () => {
        await page.goto(INDEX);
        await page.waitForSelector('.tsi-card');
        const b = await page.$eval('[data-test=dm-doc]', x => ({ text: x.textContent, expanded: x.getAttribute('aria-expanded'), controls: x.getAttribute('aria-controls'), next: x.nextElementSibling.querySelector('[data-test=switch-tool]') !== null, inBar: !!x.closest('.tsi-topbar') }));
        equal(b, { text: 'DM doc', expanded: 'false', controls: 'tsi-dmdoc', next: true, inBar: true });
        assert(!(await isOpen(page)), 'open by itself');
        equal(await page.evaluate(() => TSI.store.ready.then(() => TSI.store.keys())), []);
        const l = await H.layoutCheck(page, ['.tsi-topbar button']);
        assert(l.scrollWidth <= l.clientWidth, 'sideways scroll');
        equal(l.outOfView, []);
      });

      await check(size + ': on the home screen it opens, takes focus, sits below the top bar, and closes again', async () => {
        await page.click('[data-test=dm-doc]');
        await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden])');
        equal(await focused(page), 'dmdoc-bar');
        const r = await panelMatches(page);
        assert(inside(r, await view(page)), JSON.stringify(r));
        await H.shot(page, 'dmdoc-home-' + size);
        await page.click('[data-test=dm-doc]');
        assert(!(await isOpen(page)), 'still open');
        equal(await page.getAttribute('[data-test=dm-doc]', 'aria-expanded'), 'false');
      });

      await page.goto(INDEX + '?tool=bastion');
      await page.waitForSelector('.tsi-topbar__tool');
      await page.waitForTimeout(600);

      await check(size + ': in a tool, the button opens it as a non-modal dialog, with focus on its title bar', async () => {
        assert(!(await isOpen(page)), 'reopened by itself after being closed');
        await page.click('[data-test=dm-doc]');
        await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden])');
        const a = await page.$eval('[data-test=dmdoc-panel]', d => ({
          role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), label: d.getAttribute('aria-label'),
          title: d.querySelector('.tsi-dmdoc__title').textContent, font: getComputedStyle(d.querySelector('.tsi-dmdoc__title')).fontFamily,
          close: d.querySelector('[data-test=dmdoc-close]').getAttribute('aria-label'),
          body: d.querySelector('.tsi-dmdoc__body').textContent, z: getComputedStyle(d).zIndex, position: getComputedStyle(d).position
        }));
        equal(a, { role: 'dialog', modal: 'false', label: 'DM doc', title: 'DM doc', font: a.font, close: 'Close the DM doc', body: PLACEHOLDER, z: '695', position: 'fixed' });
        assert(/^"?Cinzel/.test(a.font), a.font);
        equal(await page.getAttribute('[data-test=dm-doc]', 'aria-expanded'), 'true');
        equal(await focused(page), 'dmdoc-bar');
        const r = await panelMatches(page);
        const v = await view(page);
        equal(r, { x: v.width - 440 - 24, y: v.top + 24, w: 440, h: 520 }, 'it first opens near the right edge, below the top bar');
        await H.shot(page, 'dmdoc-' + size);
      });

      await check(size + ': it sits above the tool and its overlays, but below pop-ups and notices', async () => {
        const top = (x, y) => page.evaluate(([x, y]) => {
          const e = document.elementFromPoint(x, y);
          return e.closest('.tsi-dmdoc') ? 'dmdoc' : e.closest('.tsi-modal-scrim') ? 'modal' : e.closest('.tsi-notice') ? 'notice' : e.closest('.tsi-dmdoc-test-overlay') ? 'overlay' : 'tool';
        }, [x, y]);
        const r = await rect(page);
        const mid = [r.x + r.w / 2, r.y + r.h / 2];
        equal(await top(r.x + 30, r.y + 20), 'dmdoc', 'over the Bastion\'s own bar');
        /* A full-window overlay at the tools' highest layer (the Ritual's go up to 690; the War Table is at 80). */
        await page.evaluate(() => {
          const o = document.createElement('div');
          o.className = 'tsi-dmdoc-test-overlay';
          o.style.cssText = 'position:fixed;inset:0;z-index:690;background:rgba(0,0,0,.2)';
          document.getElementById('tsi-main').appendChild(o);
        });
        equal(await top(mid[0], mid[1]), 'dmdoc', 'over a tool overlay');
        equal(await top(20, r.y + 20), 'overlay');
        await page.evaluate(() => document.querySelector('.tsi-dmdoc-test-overlay').remove());
        await page.evaluate(() => { TSI.modal.alert({ title: 'A pop-up', message: 'Over the DM doc.' }); });
        await page.waitForSelector('.tsi-modal');
        equal(await top(mid[0], mid[1]), 'modal', 'a pop-up covers it');
        await H.clickModal(page, 'OK');
        equal(await isOpen(page), true, 'a pop-up doesn\'t close it');
        const v = await view(page);
        await drag(page, '[data-test=dmdoc-bar]', { x: v.width - 2, y: v.height - 2 }, BAR_GRAB);
        await page.evaluate(() => { TSI.notify('A notice over the DM doc.', { id: 'dmdoc-test' }); });
        const n = await box(page, '.tsi-notice');
        const r2 = await rect(page);
        assert(n.x < r2.x + r2.w && n.y + n.h > r2.y, 'the notice should overlap the panel for this check');
        equal(await top(n.x + n.w - 10, n.y + n.h - 6), 'notice', 'a notice shows over it');
        await H.dismissNotices(page);
      });

      await check(size + ': the Switch tool menu shows over it', async () => {
        const v = await view(page);
        await moveTo(page, v.width - 600, v.top + 10);
        await page.click('[data-test=switch-tool]');
        const m = await box(page, '.tsi-menu');
        const r = await rect(page);
        assert(m.x < r.x + r.w && m.x + m.w > r.x && m.y + m.h > r.y, 'the menu should overlap the panel for this check: ' + JSON.stringify([m, r]));
        const ox = Math.max(m.x, r.x) + 20;
        const oy = Math.max(m.y, r.y) + 20;
        equal(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y).closest('.tsi-menu'), [ox, oy]), true);
        await page.keyboard.press('Escape');
      });

      await check(size + ': dragging the title bar moves it, and it\'s saved', async () => {
        await moveTo(page, 840, 280);
        const start = await panelMatches(page);
        equal([start.x, start.y], [840, 280]);
        await drag(page, '[data-test=dmdoc-bar]', { dx: -300, dy: 120 }, BAR_GRAB);
        const r = await panelMatches(page);
        equal(r, { x: start.x - 300, y: start.y + 120, w: start.w, h: start.h });
        await page.waitForTimeout(200);
        equal(await saved(page), r);
      });

      await check(size + ': dragging from the close button doesn\'t move it', async () => {
        const before = await rect(page);
        await drag(page, '[data-test=dmdoc-close]', { dx: -200, dy: 80 });
        equal(await rect(page), before);
        assert(await isOpen(page), 'it closed');
      });

      await check(size + ': the corner grip resizes it, no smaller than 280 × 200', async () => {
        await moveTo(page, 300, 150);
        const before = await rect(page);
        equal(before, { x: 300, y: 150, w: 440, h: 520 });
        await drag(page, '[data-test=dmdoc-grip]', { dx: 80, dy: 60 });
        const r = await panelMatches(page);
        equal(r, { x: before.x, y: before.y, w: before.w + 80, h: before.h + 60 });
        await drag(page, '[data-test=dmdoc-grip]', { x: before.x + 10, y: before.y + 10 });
        const small = await panelMatches(page);
        equal([small.x, small.y, small.w, small.h], [before.x, before.y, 280, 200]);
        await page.waitForTimeout(200);
        equal(await saved(page), small);
        await drag(page, '[data-test=dmdoc-grip]', { dx: 200, dy: 250 });
        equal(await panelMatches(page), { x: before.x, y: before.y, w: 480, h: 450 });
      });

      await check(size + ': it can\'t be dragged or resized out of the window, or over the top bar', async () => {
        const v = await view(page);
        await drag(page, '[data-test=dmdoc-bar]', { x: v.width - 2, y: v.height - 2 }, BAR_GRAB);
        let r = await panelMatches(page);
        equal([r.x + r.w, r.y + r.h], [v.width, v.height], 'bottom-right corner');
        await drag(page, '[data-test=dmdoc-grip]', { x: v.width - 1, y: v.height - 1 }, { x: 4, y: 4 });
        equal(await rect(page), r, 'no room to grow past the corner');
        await drag(page, '[data-test=dmdoc-bar]', { x: 2, y: 2 }, BAR_GRAB);
        r = await panelMatches(page);
        equal([r.x, r.y], [0, v.top], 'top-left, just below the top bar');
        await drag(page, '[data-test=dmdoc-grip]', { x: v.width - 1, y: v.height - 1 }, { x: 4, y: 4 });
        r = await panelMatches(page);
        equal([r.w, r.h], [v.width, v.height - v.top], 'no larger than the window');
        assert(inside(r, v));
        await drag(page, '[data-test=dmdoc-grip]', { dx: 520 - r.w, dy: 520 - r.h });
        r = await panelMatches(page);
        equal([r.x, r.y, r.w, r.h], [0, v.top, 520, 520]);
      });

      await check(size + ': arrow keys on the title bar move it (Shift: further), without scrolling the page', async () => {
        await moveTo(page, 700, 200);
        await page.focus('[data-test=dmdoc-bar]');
        const before = await rect(page);
        const scroll = await page.evaluate(() => document.scrollingElement.scrollTop);
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Shift+ArrowLeft');
        await page.keyboard.press('Shift+ArrowDown');
        const r = await panelMatches(page);
        equal([r.x, r.y], [before.x + 10 - 50, before.y + 10 + 50]);
        equal(await page.evaluate(() => document.scrollingElement.scrollTop), scroll, 'the page scrolled');
        await page.waitForTimeout(200);
        equal(await saved(page), r);
      });

      await check(size + ': a smaller window keeps it inside; back to full size, it goes back where it was', async () => {
        const before = await rect(page);
        const full = H.SIZES[size].viewport;
        await page.setViewportSize({ width: 1100, height: 600 });
        await page.waitForTimeout(150);
        const r = await panelMatches(page);
        assert(inside(r, await view(page)), JSON.stringify(r));
        await page.setViewportSize({ width: 600, height: 380 });
        await page.waitForTimeout(150);
        const tiny = await panelMatches(page);
        const tv = await view(page);
        assert(inside(tiny, tv) && tiny.w <= tv.width && tiny.h <= tv.height - tv.top, JSON.stringify([tiny, tv]));
        await page.setViewportSize(full);
        await page.waitForTimeout(150);
        equal(await rect(page), before);
        equal(await saved(page), before, 'resizing the window doesn\'t change what was saved');
      });

      await check(size + ': ✕ closes it and puts focus back on the button', async () => {
        await page.click('[data-test=dmdoc-close]');
        assert(!(await isOpen(page)), 'still open');
        equal(await focused(page), 'dm-doc');
        equal(await page.getAttribute('[data-test=dm-doc]', 'aria-expanded'), 'false');
        equal(await page.evaluate(() => sessionStorage.getItem('tsi.suite.dmdoc-open')), null);
      });

      let placed;
      await check(size + ': after switching tool it reopens in the same place, at the same size, without taking focus', async () => {
        await page.click('[data-test=dm-doc]');
        await moveTo(page, 610, 230);
        await drag(page, '[data-test=dmdoc-grip]', { dx: -40, dy: -30 });
        placed = await rect(page);
        equal(placed, { x: 610, y: 230, w: 480, h: 490 });
        await page.click('[data-test=switch-tool]');
        await Promise.all([page.waitForNavigation(), page.click('.tsi-menu__item[data-tool=crest]')]);
        await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden])');
        equal(await page.evaluate(() => location.search), '?tool=crest');
        equal(await panelMatches(page), placed);
        equal(await page.getAttribute('[data-test=dm-doc]', 'aria-expanded'), 'true');
        assert(await page.evaluate(() => !document.querySelector('.tsi-dmdoc').contains(document.activeElement)), 'it took focus');
        await H.shot(page, 'dmdoc-after-switch-' + size);
      });

      await check(size + ': closed, it stays closed after switching tool', async () => {
        await page.click('[data-test=dm-doc]');
        await page.click('[data-test=switch-tool]');
        await Promise.all([page.waitForNavigation(), page.click('.tsi-menu__item[data-tool=pelagosi]')]);
        await page.waitForSelector('.tsi-topbar__tool');
        await page.evaluate(() => TSI.store.ready);
        await page.waitForTimeout(300);
        assert(!(await isOpen(page)), 'it reopened');
        equal(await saved(page), placed, 'its place is still remembered');
        await page.click('[data-test=dm-doc]');
        equal(await panelMatches(page), placed);
      });

      await check(size + ': another window shares its place but doesn\'t open it by itself', async () => {
        const other = await context.newPage();
        await other.goto(INDEX + '?tool=crest');
        await other.waitForSelector('.tsi-topbar__tool');
        await other.evaluate(() => TSI.store.ready);
        await other.waitForTimeout(300);
        assert(!(await isOpen(other)), 'it opened by itself in another window');
        await other.click('[data-test=dm-doc]');
        equal(await panelMatches(other), placed);
        await other.close();
      });

      if (size === 'laptop') {
        await check('moving the window between the laptop (1707 × 930 at 1.5) and the TV (1920 × 1080 at 1) keeps it on screen', async () => {
          const cdp = await context.newCDPSession(page);
          const to = (width, height, deviceScaleFactor) => cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
          await to(1920, 1080, 1);
          await page.waitForTimeout(200);
          equal(await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]), [1920, 1080, 1]);
          equal(await panelMatches(page), placed, 'it fits on the TV as it was');
          await drag(page, '[data-test=dmdoc-bar]', { x: 1918, y: 1078 }, BAR_GRAB);
          const onTv = await panelMatches(page);
          equal([onTv.x + onTv.w, onTv.y + onTv.h], [1920, 1080]);
          await to(1707, 930, 1.5);
          await page.waitForTimeout(200);
          equal(await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]), [1707, 930, 1.5]);
          const onLaptop = await panelMatches(page);
          equal([onLaptop.x + onLaptop.w, onLaptop.y + onLaptop.h, onLaptop.w, onLaptop.h], [1707, 930, onTv.w, onTv.h], 'pulled into the laptop\'s window, same size');
          await to(1920, 1080, 1);
          await page.waitForTimeout(200);
          equal(await rect(page), onTv, 'back on the TV, it goes back where it was');
          await to(1707, 930, 1.5);
          await page.waitForTimeout(200);
          await H.shot(page, 'dmdoc-moved-to-laptop');
          await cdp.detach();
        });
      }

      await check(size + ': Back up everything includes it; Restore brings it back, named "DM doc"', async () => {
        await page.click('[data-test=home]');
        await page.waitForSelector('.tsi-card');
        await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden])');
        /* It floats over whatever is under it, so move it off the footer's buttons first. */
        await moveTo(page, 20, 76);
        await page.waitForTimeout(200);
        const now = await saved(page);
        equal([now.x, now.y], [20, 76]);
        const d = await H.download(page, '[data-test=backup-everything]');
        const b = JSON.parse(d.text);
        const rec = b.records.find(r => r.key === KEY);
        assert(rec, 'not in the backup: ' + b.records.map(r => r.key));
        equal(rec.value, now);
        rec.value = { x: 120, y: 150, w: 360, h: 300 };
        await H.chooseFile(page, '[data-test=restore]', H.writeTemp('dmdoc-backup-' + size + '.json', b));
        assert(/DM doc: 1 saved item/.test(await H.modalText(page)), await H.modalText(page));
        await page.uncheck('.tsi-modal input[type=checkbox]');
        await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Restore')]);
        await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden])');
        equal(await saved(page), { x: 120, y: 150, w: 360, h: 300 });
        equal(await panelMatches(page), { x: 120, y: 150, w: 360, h: 300 });
      });

      await check(size + ': no errors on the way', async () => {
        equal(context.log.errors, []);
        equal(context.log.consoleErrors, []);
        equal(context.log.failed, []);
        equal(context.log.net, []);
      });
      await context.close();
    }

    const context = await H.newContext(browser, 'laptop');
    const page = await context.newPage();
    await check('the tool underneath keeps working while it\'s open (Demo tool)', async () => {
      await openDemo(page);
      await page.click('[data-test=dm-doc]');
      await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden])');
      await page.click('[data-test=add]');
      await page.click('[data-test=add]');
      equal(await demoCount(page), 2);
      await page.fill('[data-test=note]', 'Typed with the DM doc open');
      equal(await page.inputValue('[data-test=note]'), 'Typed with the DM doc open');
      assert(await isOpen(page), 'it closed');
      equal(await page.evaluate(() => [sessionStorage.getItem('tsi.test:dmdoc-open'), sessionStorage.getItem('tsi.suite.dmdoc-open')]), ['1', null], 'the test page keeps its own');
      equal(await page.evaluate(() => TSI.store.ready.then(() => TSI.store.keys('dmdoc'))), [], 'nothing saved until it\'s moved');
      await drag(page, '[data-test=dmdoc-bar]', { dx: -100, dy: 40 }, BAR_GRAB);
      await page.waitForTimeout(200);
      equal(await page.evaluate(() => TSI.store.keys('dmdoc')), [KEY]);
      const exported = JSON.parse((await H.download(page, '[data-test=export]')).text);
      equal(exported.records.map(r => r.key), ['tsi.demo.state'], 'a tool\'s Export leaves the DM doc out');
    });
    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Back up everything and Restore (home screen)');
  {
    const context = await H.newContext(browser, 'laptop');
    const page = await context.newPage();
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');

    await check('Back up everything downloads a dated file, even when nothing is saved', async () => {
      const d = await H.download(page, '[data-test=backup-everything]');
      assert(/^tsi-backup-everything-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(d.name), d.name);
      const b = JSON.parse(d.text);
      equal([b.format, b.kind, b.records.length], ['tsi-backup', 'suite', 0]);
      await H.waitForNotice(page, /Backup downloaded/);
    });

    await check('Restore refuses a random file and changes nothing', async () => {
      await H.chooseFile(page, '[data-test=restore]', H.writeTemp('shopping.txt', 'eggs, flour, a dragon'));
      const text = await H.modalText(page);
      assert(/isn't a suite backup/.test(text) && /Nothing was changed/.test(text), text);
      await H.shot(page, 'restore-refused');
      await H.clickModal(page, 'OK');
      await H.chooseFile(page, '[data-test=restore]', H.writeTemp('other.json', { hello: 'world' }));
      assert(/isn't a backup from The Scarlett Isles/.test(await H.modalText(page)));
      await page.keyboard.press('Escape');
    });

    await check('Restore refuses a single tool\'s export and says where to use it', async () => {
      await H.chooseFile(page, '[data-test=restore]', H.writeTemp('tool.json', toolFile('quests', [])));
      const text = await H.modalText(page);
      assert(/backup of just the Notice Board Quest Generator/.test(text), text);
      await H.clickModal(page, 'OK');
      equal(await page.evaluate(() => TSI.store.keys()), []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A tool: opening, saving, Export and Import (Demo tool in tests/harness.html)');
  {
    const context = await H.newContext(browser, 'laptop');
    const page = await context.newPage();

    await check('the harness loads the same shared files as index.html', async () => {
      const read = f => fs.readFileSync(path.join(H.ROOT, f), 'utf8');
      const scripts = html => Array.from(html.matchAll(/<script src="([^"]+)"/g)).map(m => m[1].replace(/^\.\.\//, ''));
      const styles = html => Array.from(html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)).map(m => m[1].replace(/^\.\.\//, ''));
      const idx = read('index.html');
      const har = read('tests/harness.html');
      equal(scripts(har).filter(s => !s.startsWith('fixtures/')), scripts(idx));
      equal(styles(har), styles(idx));
    });

    await page.goto(HARNESS);
    await page.waitForSelector('.tsi-card');

    await check('its card opens it; the top bar shows its name, Export, Import and save status', async () => {
      await Promise.all([page.waitForURL(/\?tool=demo$/), page.click('.tsi-card[data-tool=demo]')]);
      await page.waitForSelector('[data-test=count]');
      equal(await page.textContent('.tsi-topbar__tool'), 'Demo tool');
      equal(await page.title(), 'Test page · Demo tool · The Scarlett Isles');
      equal(await page.textContent('.tsi-topbar__test'), 'Test page');
      assert(await page.isVisible('[data-test=export]') && await page.isVisible('[data-test=import]'), 'Export/Import missing');
      equal(await page.textContent('[data-test=save-status]'), 'Saved ✓');
      assert(await page.$eval('.tsi-art', a => getComputedStyle(a).display === 'none'), 'home art should be hidden in a tool');
    });

    await check('saves survive reopening', async () => {
      for (let i = 0; i < 3; i++) await page.click('[data-test=add]');
      await page.fill('[data-test=note]', 'Remember the Salt-Ring');
      await waitSaved(page);
      await page.reload();
      await page.waitForSelector('[data-test=count]');
      equal(await demoCount(page), 3);
      equal(await page.inputValue('[data-test=note]'), 'Remember the Salt-Ring');
      const keys = await page.evaluate(() => TSI.store.keys());
      equal(keys, ['tsi.demo.state']);
      await H.shot(page, 'demo-tool');
    });

    await check('keyboard shortcut works, but not while typing', async () => {
      await page.click('[data-test=note]');
      await page.keyboard.type('kkk');
      equal(await page.textContent('[data-test=keys]'), '0');
      await page.click('.tsi-panel__title >> nth=0');
      await page.keyboard.press('k');
      equal(await page.textContent('[data-test=keys]'), '1');
    });

    await check('the tool fits the laptop with no sideways scroll', async () => {
      const l = await H.layoutCheck(page, ['.tsi-topbar button']);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll');
      equal(l.outOfView, []);
    });

    await check('Export downloads just this tool\'s data', async () => {
      const d = await H.download(page, '[data-test=export]');
      assert(/^tsi-test-demo-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(d.name), d.name);
      const b = JSON.parse(d.text);
      equal([b.kind, b.space, b.tool, b.records.length, b.records[0].value.count], ['tool', 'test', 'demo', 1, 3]);
    });

    await check('Import refuses another tool\'s file, a whole-suite backup and a bad file, changing nothing', async () => {
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('quests.json', toolFile('quests', [{ key: 'tsi.quests.accepted', value: [], savedAt: '2026-09-25T13:03:00.000Z' }], 'test')));
      assert(/from the Notice Board Quest Generator, not the Demo tool/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('suite.json', { format: 'tsi-backup', version: 1, kind: 'suite', space: 'test', savedAt: '2026-09-25T13:03:00.000Z', records: [] }));
      assert(/whole-suite backup/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('bad-demo.json', toolFile('demo', [{ key: 'tsi.demo.state', value: { count: 'lots', note: '' }, savedAt: '2026-09-25T13:03:00.000Z' }], 'test')));
      assert(/isn't a number/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      equal(await demoCount(page), 3);
      equal(await savedCount(page), 3);
    });

    const goodImport = H.writeTemp('good-demo.json', toolFile('demo', [demoRecord(7, 'Imported note')], 'test'));

    await check('Import shows what\'s in the file and asks first; Cancel changes nothing', async () => {
      await H.chooseFile(page, '[data-test=import]', goodImport);
      const text = await H.modalText(page);
      assert(/Import into the Demo tool/i.test(text), text);
      assert(/Demo tool: 1 saved item/.test(text), text);
      assert(/First, download a copy of the Demo tool's current data/.test(text), text);
      assert(await page.$eval('.tsi-modal input[type=checkbox]', b => b.checked), 'the copy-first box should start ticked');
      await H.shot(page, 'import-confirm');
      await H.clickModal(page, 'Cancel');
      equal(await savedCount(page), 3);
    });

    await check('the pop-up keeps keyboard focus inside it, and Esc cancels', async () => {
      await H.chooseFile(page, '[data-test=import]', goodImport);
      await page.waitForSelector('.tsi-modal');
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        assert(await page.evaluate(() => !!document.activeElement.closest('.tsi-modal')), 'focus left the pop-up');
      }
      await page.keyboard.press('Escape');
      await page.waitForSelector('.tsi-modal', { state: 'detached' });
      equal(await savedCount(page), 3);
    });

    await check('Import replaces the data after saving a copy of the old data first', async () => {
      await H.chooseFile(page, '[data-test=import]', goodImport);
      await page.waitForSelector('.tsi-modal');
      const [copy] = await Promise.all([
        page.waitForEvent('download'),
        page.waitForEvent('load'),
        H.clickModal(page, 'Import')
      ]);
      const old = JSON.parse(fs.readFileSync(await copy.path(), 'utf8'));
      equal(old.records[0].value.count, 3, 'the copy of the old data');
      await page.waitForSelector('[data-test=count]');
      equal(await demoCount(page), 7);
      await H.waitForNotice(page, /Imported the file exported on/);
    });

    await check('other tools\' data is untouched by an import', async () => {
      await page.evaluate(() => { TSI.store.set('tsi.other.thing', { keep: true }); return TSI.store.flush(); });
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('good-demo2.json', toolFile('demo', [demoRecord(9)], 'test')));
      await page.waitForSelector('.tsi-modal');
      await page.uncheck('.tsi-modal input[type=checkbox]');
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Import')]);
      await page.waitForSelector('[data-test=count]');
      equal(await demoCount(page), 9);
      equal(await page.evaluate(() => TSI.store.get('tsi.other.thing')), { keep: true });
      await page.evaluate(() => { TSI.store.remove('tsi.other.thing'); return TSI.store.flush(); });
    });

    /* ---------------------------------------------------------------- */
    section('Whole-suite Restore with real data');

    await check('Restore shows the backup, asks, and Cancel changes nothing; Restore replaces it', async () => {
      await page.goto(HARNESS);
      await page.waitForSelector('.tsi-card');
      const backup = await H.download(page, '[data-test=backup-everything]');
      const file = H.writeTemp('everything.json', backup.text);
      equal(JSON.parse(backup.text).records[0].value.count, 9);

      await openDemo(page);
      await page.click('[data-test=add]');
      await waitSaved(page);
      await page.goto(HARNESS);
      await page.waitForSelector('.tsi-card');

      await H.chooseFile(page, '[data-test=restore]', file);
      const text = await H.modalText(page);
      assert(/was saved on \w+day \d+ \w+ \d{4} at \d\d:\d\d/.test(text), text);
      assert(/Demo tool: 1 saved item/.test(text), text);
      assert(/replaces everything the suite has saved/.test(text), text);
      await H.shot(page, 'restore-confirm');
      await H.clickModal(page, 'Cancel');
      equal(await savedCount(page), 10);

      await H.chooseFile(page, '[data-test=restore]', file);
      await page.waitForSelector('.tsi-modal');
      const [copy] = await Promise.all([page.waitForEvent('download'), page.waitForEvent('load'), H.clickModal(page, 'Restore')]);
      assert(/^tsi-test-backup-everything-/.test(copy.suggestedFilename()), 'copy of current data first');
      await H.waitForNotice(page, /Restored the backup saved on/);
      equal(await savedCount(page), 9);
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
      equal(context.log.net, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Leaving a tool');
  {
    const context = await H.newContext(browser, 'laptop');
    const page = await context.newPage();
    await openDemo(page);

    await check('"ask before leaving": Stay keeps you in the tool, Leave goes home', async () => {
      await page.check('[data-test=leave-check]');
      await page.click('[data-test=home]');
      const text = await H.modalText(page);
      assert(/Leave the Demo tool\?/.test(text) && /This will end the demo in progress/.test(text), text);
      await H.shot(page, 'leave-confirm');
      await H.clickModal(page, 'Stay');
      await page.waitForTimeout(200);
      assert(/\?tool=demo$/.test(page.url()), 'should still be in the tool');
      await page.click('[data-test=home]');
      await page.waitForSelector('.tsi-modal');
      await Promise.all([page.waitForURL(/harness\.html$/), H.clickModal(page, 'Leave')]);
      await page.waitForSelector('.tsi-card');
    });

    await check('Switch tool from inside a tool goes home through the same check', async () => {
      await openDemo(page);
      await page.click('[data-test=switch-tool]');
      equal(await page.getAttribute('.tsi-menu__item[data-tool=demo]', 'aria-current'), 'page');
      await Promise.all([page.waitForURL(/harness\.html$/), page.click('.tsi-menu__item[data-tool=home]')]);
    });

    await check('closing a tool stops its timers, sound, listeners and shortcuts', async () => {
      await openDemo(page);
      await page.click('[data-test=start-timers]');
      await page.waitForTimeout(300);
      const running = await page.evaluate(() => ({ ticks: TSI_DEMO.live.ticks, counts: TSI_DEMO.ctx.life.counts(), paused: TSI_DEMO.live.sound.paused }));
      assert(running.ticks > 0, 'timer not running');
      /* the demo's timer, plus the player link's own check that its window is still open */
      assert(running.counts.intervals === 2 && running.counts.media === 1, JSON.stringify(running.counts));
      await page.evaluate(() => TSI.shell.stopTool());
      const after = await page.evaluate(() => ({ counts: TSI_DEMO.ctx.life.counts(), ticks: TSI_DEMO.live.ticks, paused: TSI_DEMO.live.sound.paused, src: TSI_DEMO.live.sound.getAttribute('src'), stopped: window.TSI_DEMO_STOPPED }));
      equal(after.counts, { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
      assert(after.paused && !after.src, 'sound still playing');
      equal(after.stopped, 1, 'the tool\'s own stop() ran once');
      await page.waitForTimeout(300);
      equal(await page.evaluate(() => TSI_DEMO.live.ticks), after.ticks, 'timer kept ticking');
      await page.keyboard.press('k');
      equal(await page.textContent('[data-test=keys]'), '0', 'shortcut still working');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Player windows (postMessage, from a double-clicked file)');
  {
    const context = await H.newContext(browser, 'laptop');
    const page = await context.newPage();
    await openDemo(page);
    let popup;

    await check('opens and shows what the tool sends', async () => {
      [popup] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player]')]);
      await popup.waitForSelector('[data-test=text]');
      await popup.waitForFunction(() => /^Count is \d+$/.test(document.querySelector('[data-test=text]').textContent));
      assert(/player\.html\?view=check$/.test(popup.url()), popup.url());
      await page.waitForFunction(() => document.querySelector('[data-test=link-status]').textContent === 'connected');
      await popup.waitForSelector('#tsi-player-status', { state: 'hidden' });
    });

    await check('updates straight away when the tool changes', async () => {
      await page.click('[data-test=add]');
      const n = await demoCount(page);
      await popup.waitForFunction(v => document.querySelector('[data-test=text]').textContent === 'Count is ' + v, n, { timeout: 2000 });
    });

    await check('can send a message back to the tool', async () => {
      await popup.click('[data-test=reply]');
      await page.waitForFunction(() => document.querySelector('[data-test=replies]').textContent === '1', null, { timeout: 2000 });
    });

    await check('recovers when the player window is refreshed', async () => {
      await popup.reload();
      const n = await demoCount(page);
      await popup.waitForFunction(v => document.querySelector('[data-test=text]').textContent === 'Count is ' + v, n, { timeout: 4000 });
    });

    await check('reconnects when the tool\'s page is reloaded', async () => {
      await page.reload();
      await page.waitForSelector('[data-test=count]');
      await page.waitForFunction(() => document.querySelector('[data-test=link-status]').textContent === 'connected', null, { timeout: 5000 });
      await page.click('[data-test=add]');
      const n = await demoCount(page);
      await popup.waitForFunction(v => document.querySelector('[data-test=text]').textContent === 'Count is ' + v, n, { timeout: 2000 });
      await H.shot(popup, 'player-window');
    });

    await check('closes when you leave the tool', async () => {
      const closed = popup.waitForEvent('close', { timeout: 5000 });
      await page.click('[data-test=home]');
      await closed;
    });

    await check('a player window for an unknown view says so', async () => {
      const p = await context.newPage();
      await p.goto(H.fileUrl('player.html') + '?view=nothing');
      await p.waitForFunction(() => /doesn't know the view "nothing"/.test(document.getElementById('tsi-player-status').textContent));
      await p.close();
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Two tabs');
  {
    const context = await H.newContext(browser, 'laptop');
    const one = await context.newPage();

    await check('one tab alone never warns, even when switching tools and reloading', async () => {
      await one.goto(HARNESS);
      await one.waitForTimeout(2500);
      await openDemo(one);
      await one.waitForTimeout(2500);
      await one.reload();
      await one.waitForTimeout(2500);
      await one.click('[data-test=home]');
      await one.waitForSelector('.tsi-card');
      await one.waitForTimeout(2500);
      const texts = await H.noticeTexts(one);
      assert(!texts.some(t => /Already open/.test(t)), 'false warning: ' + texts);
    });

    let two;
    await check('a second tab shows a warning in both', async () => {
      two = await context.newPage();
      await two.goto(HARNESS);
      await H.waitForNotice(two, /Already open\./, 4000);
      await H.waitForNotice(one, /Already open\./, 4000);
      await H.shot(two, 'second-tab-warning');
    });

    await check('the warning goes once the other tab is closed', async () => {
      await two.close();
      await one.waitForFunction(() => !Array.from(document.querySelectorAll('.tsi-notice')).some(n => /Already open/.test(n.textContent)), null, { timeout: 12000 });
    });

    await check('the real suite open twice warns too', async () => {
      const a = await context.newPage();
      const b = await context.newPage();
      await a.goto(INDEX);
      await b.goto(INDEX);
      await H.waitForNotice(a, /Already open\./, 4000);
      await H.waitForNotice(b, /Already open\./, 4000);
      await a.close();
      await b.close();
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Two tabs: only the same tool, or the home screen, warns');
  {
    /* Saves are written one name at a time and each tool only writes its own,
       so two different tools can be open side by side (the Bastion opens the
       Crest in a new tab). The home screen's Restore and Back up everything
       cover every tool, so a home tab still warns alongside anything. Each
       check gets a fresh browser, so a tab closed in one can't affect the next. */
    const ALREADY = /Already open\./;
    const TAIL = ' is also open in another tab or window\\. If both stay open, one can overwrite the other\'s saves\\. Close one of them\\.';
    const BASTION_TOO = new RegExp('Already open\\. The Ironbow Bastion Manager' + TAIL);
    const DEMO_TOO = new RegExp('Already open\\. The Demo tool' + TAIL);
    const HOME_TOO = new RegExp('Already open\\. The suite\'s home screen' + TAIL);
    const SUITE_TOO = new RegExp('Already open\\. The suite' + TAIL);
    const warned = async p => (await H.noticeTexts(p)).some(t => ALREADY.test(t));
    const waitClear = (p, ms) => p.waitForFunction(() => !Array.from(document.querySelectorAll('.tsi-notice')).some(n => /Already open/.test(n.textContent)), null, { timeout: ms || 12000 });
    const heartbeats = (p, space) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), space === 'test' ? 'tsi.test:tabs' : 'tsi.suite.tabs');
    const counts = p => p.evaluate(() => [TSI.tabGuard.otherCount(), TSI.tabGuard.clashCount()]);
    async function open(context, url) {
      const p = await context.newPage();
      await p.goto(url);
      await p.waitForSelector('.tsi-topbar');
      return p;
    }
    async function switchTo(p, toolId) {
      await p.click('[data-test=switch-tool]');
      await Promise.all([p.waitForNavigation(), p.click('.tsi-menu__item[data-tool=' + toolId + ']')]);
      await p.waitForSelector('.tsi-topbar');
    }
    async function fresh(name, fn) {
      const context = await H.newContext(browser, 'laptop');
      await check(name, () => fn(context));
      await context.close();
    }

    await fresh('two home tabs warn in both', async context => {
      const a = await open(context, INDEX);
      const b = await open(context, INDEX);
      await H.waitForNotice(a, HOME_TOO, 4000);
      await H.waitForNotice(b, HOME_TOO, 4000);
      equal(await counts(a), [1, 1]);
    });

    await fresh('the Bastion in one tab and the Crest in another don\'t warn', async context => {
      const bastion = await open(context, INDEX + '?tool=bastion');
      const crest = await open(context, INDEX + '?tool=crest');
      await crest.waitForTimeout(2600); /* more than one heartbeat */
      for (const p of [bastion, crest]) {
        assert(!(await warned(p)), 'false warning: ' + (await H.noticeTexts(p)));
        equal(await counts(p), [1, 0], 'each sees the other tab, but they don\'t clash');
      }
      const beats = await heartbeats(crest);
      equal([beats[await bastion.evaluate(() => TSI.tabGuard.id)].tool, beats[await crest.evaluate(() => TSI.tabGuard.id)].tool], ['bastion', 'crest']);
      await H.shot(bastion, 'tabs-bastion-and-crest');
    });

    await fresh('the Bastion in two tabs warns in both, naming it; closing one clears the other', async context => {
      const a = await open(context, INDEX + '?tool=bastion');
      const b = await open(context, INDEX + '?tool=bastion');
      await H.waitForNotice(a, BASTION_TOO, 4000);
      await H.waitForNotice(b, BASTION_TOO, 4000);
      await H.shot(b, 'tabs-bastion-twice');
      await b.close();
      await waitClear(a);
      equal(await counts(a), [0, 0]);
    });

    await fresh('home plus the Bastion warns in both, each naming the other; closing home clears it', async context => {
      const home = await open(context, INDEX);
      const bastion = await open(context, INDEX + '?tool=bastion');
      await H.waitForNotice(home, BASTION_TOO, 4000);
      await H.waitForNotice(bastion, HOME_TOO, 4000);
      equal(await home.evaluate(() => TSI.tabGuard.tool()), '');
      equal(await bastion.evaluate(() => TSI.tabGuard.tool()), 'bastion');
      const beats = await heartbeats(home);
      equal(beats[await home.evaluate(() => TSI.tabGuard.id)].tool, '', 'home is recorded as \'\'');
      await home.close();
      await waitClear(bastion);
    });

    await fresh('switching tool updates the heartbeat at once', async context => {
      const a = await open(context, INDEX + '?tool=bastion');
      const b = await open(context, INDEX + '?tool=crest');
      await b.waitForTimeout(2600);
      assert(!(await warned(a)) && !(await warned(b)), 'false warning');
      const id = await b.evaluate(() => TSI.tabGuard.id);

      await switchTo(b, 'bastion');
      const t0 = Date.now();
      await H.waitForNotice(a, BASTION_TOO, 1500);
      await H.waitForNotice(b, BASTION_TOO, 1500);
      equal(await b.evaluate(() => TSI.tabGuard.id), id, 'the tab keeps its id');
      equal((await heartbeats(a))[id].tool, 'bastion');
      assert(Date.now() - t0 < 1500);

      await switchTo(b, 'crest');
      /* Well under the 7 seconds an old heartbeat takes to go stale. */
      await waitClear(a, 2000);
      await b.waitForTimeout(500);
      assert(!(await warned(b)), 'false warning in the Crest');
      equal((await heartbeats(a))[id].tool, 'crest');

      await switchTo(b, 'home');
      await H.waitForNotice(a, HOME_TOO, 1500);
      await H.waitForNotice(b, BASTION_TOO, 1500);
      equal((await heartbeats(a))[id].tool, '');
    });

    await fresh('a tab that doesn\'t say which tool it has open (an older heartbeat) still warns', async context => {
      const crest = await open(context, INDEX + '?tool=crest');
      await crest.evaluate(() => {
        const map = JSON.parse(localStorage.getItem('tsi.suite.tabs') || '{}');
        map.tOlderTab = { at: Date.now() };
        localStorage.setItem('tsi.suite.tabs', JSON.stringify(map));
      });
      await H.waitForNotice(crest, SUITE_TOO, 3000); /* at the next heartbeat */
      /* It stops beating, so the warning goes once it's stale. */
      await waitClear(crest, 12000);
    });

    await fresh('Dismiss hides it until the other tabs change', async context => {
      const a = await open(context, INDEX + '?tool=bastion');
      const b = await open(context, INDEX + '?tool=bastion');
      await H.waitForNotice(a, BASTION_TOO, 4000);
      await H.waitForNotice(b, BASTION_TOO, 4000);
      await a.click('.tsi-notice button:text-is("Dismiss")');
      await a.waitForTimeout(4500); /* two heartbeats */
      assert(!(await warned(a)), 'came back after Dismiss');
      assert(await warned(b), 'the other tab\'s warning went too');
      /* A home tab opens: the dismissed tab warns again, and the other tab's
         wording changes, as each now clashes with a Bastion and a home screen. */
      const c = await open(context, INDEX);
      await H.waitForNotice(a, SUITE_TOO, 4000);
      await H.waitForNotice(b, SUITE_TOO, 4000);
      await H.waitForNotice(c, BASTION_TOO, 4000);
      equal((await H.noticeTexts(b)).filter(t => ALREADY.test(t)).length, 1, 'one warning, not two');
    });

    await fresh('a link that opens the Crest in a new tab from the Bastion (TSI.shell.pageUrl) doesn\'t warn', async context => {
      const bastion = await open(context, INDEX + '?tool=bastion');
      equal(await bastion.evaluate(() => [TSI.shell.pageUrl('crest'), TSI.shell.pageUrl(), TSI.shell.pageUrl(null), TSI.shell.pageUrl('')]),
        ['index.html?tool=crest', 'index.html', 'index.html', 'index.html']);
      /* A new tab opened by a link copies sessionStorage (and so this tab's id); the guard still gives it its own. */
      const [crest] = await Promise.all([
        context.waitForEvent('page'),
        bastion.evaluate(() => {
          const a = document.createElement('a');
          a.href = TSI.shell.pageUrl('crest');
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          a.remove();
        })
      ]);
      await crest.waitForSelector('.tsi-topbar');
      equal(await crest.evaluate(() => [location.pathname.split('/').pop(), location.search, TSI.tabGuard.tool()]), ['index.html', '?tool=crest', 'crest']);
      assert(await crest.evaluate(() => TSI.tabGuard.id) !== await bastion.evaluate(() => TSI.tabGuard.id), 'the new tab shares the Bastion\'s id');
      await crest.waitForTimeout(2600);
      for (const p of [bastion, crest]) {
        assert(!(await warned(p)), 'false warning: ' + (await H.noticeTexts(p)));
        equal(await counts(p), [1, 0]);
      }
    });

    await fresh('the test page works the same: the Demo tool and the Crest don\'t warn, two Demo tabs do', async context => {
      const demo = await open(context, HARNESS + '?tool=demo');
      equal(await demo.evaluate(() => [TSI.shell.pageUrl('crest'), TSI.shell.pageUrl()]), ['harness.html?tool=crest', 'harness.html']);
      const crest = await open(context, HARNESS + '?tool=crest');
      await crest.waitForTimeout(2600);
      for (const p of [demo, crest]) {
        assert(!(await warned(p)), 'false warning: ' + (await H.noticeTexts(p)));
        equal(await counts(p), [1, 0]);
      }
      equal((await heartbeats(demo, 'test'))[await demo.evaluate(() => TSI.tabGuard.id)].tool, 'demo');
      const demo2 = await open(context, HARNESS + '?tool=demo');
      await H.waitForNotice(demo, DEMO_TOO, 4000);
      await H.waitForNotice(demo2, DEMO_TOO, 4000);
      assert(!(await warned(crest)), 'the Crest warned about the Demo tool');
      /* The real suite's Crest in this same browser isn't warned about by the test page's Crest. */
      const realCrest = await open(context, INDEX + '?tool=crest');
      await realCrest.waitForTimeout(2600);
      assert(!(await warned(realCrest)), 'the test page set off the real suite\'s warning');
    });
  }

  /* ------------------------------------------------------------------ */
  section('Errors, failed saves and damaged saves');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.addInitScript(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value) {
        if (window.__failSaves && value && typeof value.key === 'string' && value.key.indexOf('tsi.demo.') === 0) {
          throw new DOMException('Pretend the storage is full', 'QuotaExceededError');
        }
        return put.apply(this, arguments);
      };
    });
    const page = await context.newPage();
    await openDemo(page);

    await check('an error shows a plain-English bar with details', async () => {
      await page.click('[data-test=throw]');
      await H.waitForNotice(page, /Something went wrong \(in Demo tool\)/);
      await H.shot(page, 'error-bar');
      await page.click('.tsi-notice button:text-is("Details")');
      assert(/Demo error, on purpose\./.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      await H.dismissNotices(page);
    });

    await check('a failed save shows "Not saved" and a warning with Export', async () => {
      await page.evaluate(() => { window.__failSaves = true; });
      await page.click('[data-test=add]');
      await page.waitForFunction(() => document.querySelector('[data-test=save-status]').textContent === 'Not saved');
      await H.waitForNotice(page, /Your latest changes couldn't be saved\. The browser's storage space for the suite is full\./);
      const buttons = await page.$$eval('.tsi-notice--error button', bs => bs.map(b => b.textContent));
      assert(buttons.includes('Export'), buttons);
      await H.shot(page, 'save-failed');
      await H.dismissNotices(page);
    });

    await check('saving recovers on the next change, and nothing was lost', async () => {
      await page.evaluate(() => { window.__failSaves = false; });
      await page.click('[data-test=add]');
      await page.waitForFunction(() => document.querySelector('[data-test=save-status]').textContent === 'Saved ✓');
      await H.waitForNotice(page, /Saving works again/);
      const n = await demoCount(page);
      await page.reload();
      await page.waitForSelector('[data-test=count]');
      equal(await demoCount(page), n);
    });

    await check('a damaged save is set aside (not deleted) and the tool starts fresh', async () => {
      await page.evaluate(() => { TSI.store.set('tsi.demo.state', { count: 'lots', note: '' }); return TSI.store.flush(); });
      await page.reload();
      await page.waitForSelector('[data-test=count]');
      await H.waitForNotice(page, /Damaged save set aside/);
      equal(await demoCount(page), 0);
      const q = await page.evaluate(() => TSI.store.keys('quarantine').map(k => TSI.store.get(k)));
      equal(q, [{ count: 'lots', note: '' }]);
    });

    await check('a record damaged inside the browser\'s database is set aside too', async () => {
      await page.evaluate(() => new Promise((res, rej) => {
        const r = indexedDB.open('tsi.test', 1);
        r.onsuccess = () => {
          const tx = r.result.transaction('records', 'readwrite');
          tx.objectStore('records').put({ key: 'tsi.demo.extra', value: 1 }); /* no savedAt */
          tx.oncomplete = () => { r.result.close(); res(); };
          tx.onerror = () => rej(tx.error);
        };
      }));
      await page.reload();
      await page.waitForSelector('[data-test=count]');
      await page.waitForFunction(() => TSI.store.keys('quarantine').length === 2 && !TSI.store.has('tsi.demo.extra'));
    });

    await check('set-aside saves are included in Back up everything', async () => {
      await page.goto(HARNESS);
      await page.waitForSelector('.tsi-card');
      const d = await H.download(page, '[data-test=backup-everything]');
      const keys = JSON.parse(d.text).records.map(r => r.key);
      equal(keys.filter(k => k.startsWith('tsi.quarantine.')).length, 2);
    });
    await context.close();
  }

  {
    const context = await H.newContext(browser, 'laptop');
    await context.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined }); });
    const page = await context.newPage();
    await check('if the browser\'s database is unavailable, it says so and still saves in the smaller storage', async () => {
      await openDemo(page);
      await H.waitForNotice(page, /Small save space/);
      equal(await page.textContent('[data-test=save-status]'), 'Saved (small storage)');
      await page.click('[data-test=add]');
      await page.waitForTimeout(300);
      await page.reload();
      await page.waitForSelector('[data-test=count]');
      equal(await demoCount(page), 1);
      const raw = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('tsi.')).sort());
      assert(raw.includes('tsi.test:tsi.demo.state'), raw);
      assert(!raw.includes('tsi.demo.state'), 'the test page wrote a real save name: ' + raw);
      const real = await context.newPage();
      await real.goto(INDEX);
      await real.waitForSelector('.tsi-card');
      equal(await real.evaluate(() => TSI.store.ready.then(() => [TSI.store.mode, TSI.store.keys()])), ['local', []], 'the real suite saw test data');
      await real.close();
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The test page is kept apart from the real suite');
  {
    const context = await H.newContext(browser, 'laptop');
    const test = await context.newPage();
    const real = await context.newPage();

    await check('each uses its own database; test saves never show in the real suite', async () => {
      await openDemo(test);
      await test.click('[data-test=add]');
      await test.click('[data-test=add]');
      await waitSaved(test);
      equal(await test.evaluate(() => [TSI.space, TSI.store.databaseName]), ['test', 'tsi.test']);
      await real.goto(INDEX);
      await real.waitForSelector('.tsi-card');
      equal(await real.evaluate(() => TSI.store.ready.then(() => [TSI.space, TSI.store.databaseName, TSI.store.keys()])), ['suite', 'tsi.suite', []]);
      const b = JSON.parse((await H.download(real, '[data-test=backup-everything]')).text);
      equal([b.space, b.records.length], ['suite', 0]);
    });

    await check('the two don\'t warn "Already open" about each other', async () => {
      await real.waitForTimeout(3000);
      for (const p of [test, real]) {
        const texts = await H.noticeTexts(p);
        assert(!texts.some(t => /Already open/.test(t)), 'false warning: ' + texts);
      }
    });

    await check('the real suite refuses the test page\'s backups, and the other way round', async () => {
      await test.goto(HARNESS);
      await test.waitForSelector('.tsi-card');
      const testBackup = await H.download(test, '[data-test=backup-everything]');
      assert(/^tsi-test-backup-everything-/.test(testBackup.name), testBackup.name);
      await H.chooseFile(real, '[data-test=restore]', H.writeTemp('from-test.json', testBackup.text));
      assert(/came from the suite's test page/.test(await H.modalText(real)));
      await H.clickModal(real, 'OK');
      equal(await real.evaluate(() => TSI.store.keys()), []);

      const realBackup = await H.download(real, '[data-test=backup-everything]');
      await H.chooseFile(test, '[data-test=restore]', H.writeTemp('from-real.json', realBackup.text));
      assert(/came from the real suite/.test(await H.modalText(test)));
      await H.clickModal(test, 'OK');
      equal(await savedCount(test), 2);
    });

    await check('test data left in the real database by phase 1 is removed', async () => {
      await real.evaluate(() => new Promise((res, rej) => {
        const r = indexedDB.open('tsi.suite', 1);
        r.onsuccess = () => {
          const tx = r.result.transaction('records', 'readwrite');
          tx.objectStore('records').put({ key: 'tsi.demo.state', value: { count: 4, note: '' }, savedAt: '2026-09-25T13:03:00.000Z' });
          tx.objectStore('records').put({ key: 'tsi.other.thing', value: 1, savedAt: '2026-09-25T13:03:00.000Z' });
          tx.oncomplete = () => { r.result.close(); res(); };
          tx.onerror = () => rej(tx.error);
        };
      }));
      await real.reload();
      await real.waitForSelector('.tsi-card');
      equal(await real.evaluate(() => TSI.store.ready.then(() => TSI.store.flush()).then(() => TSI.store.keys())), ['tsi.other.thing']);
      const left = await real.evaluate(() => new Promise(res => {
        const r = indexedDB.open('tsi.suite', 1);
        r.onsuccess = () => {
          const q = r.result.transaction('records').objectStore('records').getAllKeys();
          q.onsuccess = () => { r.result.close(); res(q.result); };
        };
      }));
      equal(left, ['tsi.other.thing']);
    });

    await check('an older backup holding test data restores without it, and says so', async () => {
      const old = { format: 'tsi-backup', version: 1, kind: 'suite', savedAt: '2026-09-25T13:03:00.000Z', records: [
        demoRecord(5), { key: 'tsi.other.thing', value: 2, savedAt: '2026-09-25T13:03:00.000Z' }
      ] };
      await H.chooseFile(real, '[data-test=restore]', H.writeTemp('phase1-backup.json', old));
      const text = await H.modalText(real);
      assert(/1 item of test data from the test page, which will be left out/.test(text), text);
      assert(!/Demo tool/.test(text), text);
      await real.uncheck('.tsi-modal input[type=checkbox]');
      await Promise.all([real.waitForEvent('load'), H.clickModal(real, 'Restore')]);
      await real.waitForSelector('.tsi-card');
      equal(await real.evaluate(() => TSI.store.ready.then(() => [TSI.store.keys(), TSI.store.get('tsi.other.thing')])), [['tsi.other.thing'], 2]);
      await real.evaluate(() => { TSI.store.remove('tsi.other.thing'); return TSI.store.flush(); });
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Reduce motion');
  for (const reduce of [false, true]) {
    const context = await H.newContext(browser, 'laptop', { reducedMotion: reduce ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    await page.goto(HARNESS);
    await page.waitForSelector('.tsi-card[data-tool=demo]');
    await check(reduce ? 'with "reduce motion" on, cards don\'t move on hover' : 'normally, cards lift slightly on hover', async () => {
      await page.hover('.tsi-card[data-tool=demo]');
      await page.waitForTimeout(400);
      const t = await page.$eval('.tsi-card[data-tool=demo]', c => getComputedStyle(c).transform);
      if (reduce) equal(t, 'none');
      else assert(/matrix\(1, 0, 0, 1, 0, -3\)/.test(t), t);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Rules tests page');
  {
    const context = await H.newContext(browser, 'laptop');
    const page = await context.newPage();
    await page.goto(H.fileUrl('tests/rules.html'));
    await check('tests/rules.html passes', async () => {
      await page.waitForFunction(() => window.TSI_TEST_RESULT, null, { timeout: 20000 });
      const r = await page.evaluate(() => window.TSI_TEST_RESULT);
      equal(r.failures, []);
      assert(r.total > 0);
      assert(/^All \d+ tests passed/.test(await page.textContent('#summary')));
    });
    await context.close();
  }

  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(2);
});
