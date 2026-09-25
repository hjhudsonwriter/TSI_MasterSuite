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

function demoRecord(count, note) {
  return { key: 'tsi.demo.state', value: { count: count, note: note || '' }, savedAt: '2026-09-25T13:03:00.000Z' };
}
function toolFile(tool, records) {
  return { format: 'tsi-backup', version: 1, kind: 'tool', tool: tool, suite: 'The Scarlett Isles: D&D Tool Suite', savedAt: '2026-09-25T13:03:00.000Z', records: records };
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

      await check('all eight tools, in their groups, each saying its phase', async () => {
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
          equal(c[2], 'Coming in phase ' + EXPECTED_CARDS[i][2], c[0] + ' label');
          assert(c[3] === 'DIV' && c[4] === 'true', c[0] + ' should not be openable yet');
        });
      });

      await check('an unbuilt tool can\'t be opened', async () => {
        await page.click('.tsi-card[data-tool=crest]');
        await page.waitForTimeout(300);
        equal(page.url(), INDEX);
      });

      await check('opening an unbuilt tool by its address shows home and says when it\'s coming', async () => {
        const p2 = await context.newPage();
        await p2.goto(INDEX + '?tool=crest');
        await H.waitForNotice(p2, /The Clan Crest Creator is coming in phase 2/);
        equal(await p2.$$eval('.tsi-card', c => c.length), 8);
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

    await check('lists Home and all eight tools, grouped, unbuilt ones not clickable', async () => {
      await page.click('[data-test=switch-tool]');
      await page.waitForSelector('.tsi-menu:not([hidden])');
      const items = await page.$$eval('.tsi-menu__item', xs => xs.map(x => [x.dataset.tool, x.getAttribute('aria-disabled'), x.textContent]));
      equal(items.length, 9);
      equal(items[0][0], 'home');
      const groups = await page.$$eval('.tsi-menu__group', gs => gs.map(g => g.textContent));
      equal(groups, ['DM Tool', 'World', 'Players', 'Set Pieces']);
      items.slice(1).forEach(i => assert(i[1] === 'true' && /Coming in phase \d/.test(i[2]), i[2]));
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
      equal(await page.title(), 'Demo tool · The Scarlett Isles');
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
      assert(/^tsi-demo-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(d.name), d.name);
      const b = JSON.parse(d.text);
      equal([b.kind, b.tool, b.records.length, b.records[0].value.count], ['tool', 'demo', 1, 3]);
    });

    await check('Import refuses another tool\'s file, a whole-suite backup and a bad file, changing nothing', async () => {
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('quests.json', toolFile('quests', [{ key: 'tsi.quests.accepted', value: [], savedAt: '2026-09-25T13:03:00.000Z' }])));
      assert(/from the Notice Board Quest Generator, not the Demo tool/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('suite.json', { format: 'tsi-backup', version: 1, kind: 'suite', savedAt: '2026-09-25T13:03:00.000Z', records: [] }));
      assert(/whole-suite backup/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('bad-demo.json', toolFile('demo', [{ key: 'tsi.demo.state', value: { count: 'lots', note: '' }, savedAt: '2026-09-25T13:03:00.000Z' }])));
      assert(/isn't a number/.test(await H.modalText(page)));
      await H.clickModal(page, 'OK');
      equal(await demoCount(page), 3);
      equal(await savedCount(page), 3);
    });

    const goodImport = H.writeTemp('good-demo.json', toolFile('demo', [demoRecord(7, 'Imported note')]));

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
      await H.chooseFile(page, '[data-test=import]', H.writeTemp('good-demo2.json', toolFile('demo', [demoRecord(9)])));
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
      assert(/^tsi-backup-everything-/.test(copy.suggestedFilename()), 'copy of current data first');
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
      await two.goto(INDEX);
      await H.waitForNotice(two, /Already open\./, 4000);
      await H.waitForNotice(one, /Already open\./, 4000);
      await H.shot(two, 'second-tab-warning');
    });

    await check('the warning goes once the other tab is closed', async () => {
      await two.close();
      await one.waitForFunction(() => !Array.from(document.querySelectorAll('.tsi-notice')).some(n => /Already open/.test(n.textContent)), null, { timeout: 12000 });
    });
    await context.close();
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
        const r = indexedDB.open('tsi.suite', 1);
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
      assert(raw.includes('tsi.demo.state'), raw);
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
