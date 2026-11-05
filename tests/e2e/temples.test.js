/* Explorer: the three First Temples (Harry, 5 November 2026), from files with the internet off, at the laptop and the TV.
   Checks: each temple's pin sits where Harry put it on its map (The North Isle, Midland Province, Western Province (south)), shows its god's
   coin and its name, opens the same place pop-up as a town with the temple's painting, shows on the players' window and opens its painting
   there, and shows on no other map.
   Run with:  node tests/e2e/temples.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const TEMPLES = [
  { id: 'temple_pelagos', god: 'pelagos', name: 'First Temple of Pelagos', map: 'the_north_isle', x: 0.0683, y: 0.0492 },
  { id: 'temple_telluria', god: 'telluria', name: 'First Temple of Telluria', map: 'midland_province', x: 0.5561, y: 0.1058 },
  { id: 'temple_aurush', god: 'aurush', name: 'First Temple of Aurush', map: 'western_province_south', x: 0.2995, y: 0.0693 }
];
const loadMap = async (page, id) => { await page.selectOption('[data-test=map-select]', id); await page.click('[data-test=load]'); await page.waitForTimeout(450); };
const dismiss = async page => { for (let k = 0; k < 6 && await page.$('.tsi-modal'); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The First Temples at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name, { questMode: 'default', backedUp: true });
    await context.setOffline(true);
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    /* Colour reveal hides unexplored places from the players, so these checks run with the fog off. */
    await page.evaluate(() => TSI.explorer.debug.setFogMode('off'));

    await check('the pins are in the Explorer\'s data where Harry put them, with the god\'s coin and the temple\'s painting, and the files are there', async () => {
      const got = await page.evaluate(() => {
        const out = {};
        Object.keys(TSI_DATA.explorer ? TSI_DATA.explorer.markersByMapId : window.TSI_DATA.markersByMapId || {}).forEach(m => {
          ((TSI_DATA.explorer ? TSI_DATA.explorer.markersByMapId : TSI_DATA.markersByMapId)[m]).forEach(p => { if (/^temple_/.test(p.id)) out[p.id] = { map: m, x: p.x, y: p.y, label: p.label, thumb: p.thumb, art: p.submapImage }; });
        });
        return out;
      });
      for (const t of TEMPLES) {
        const g = got[t.id];
        assert(g, t.id + ' is in the data');
        equal([g.map, g.x, g.y, g.label], [t.map, t.x, t.y, t.name], t.id);
        assert(/temples\/.*-icon\.png$/.test(g.thumb) && /temples\/first-temple-of-.*\.webp$/.test(g.art), t.id + ' pictures');
      }
      equal(Object.keys(got).sort(), TEMPLES.map(t => t.id).sort(), 'three temples, no more');
    });

    for (const t of TEMPLES) {
      await check(t.name + ': the pin shows on its map with its coin and name, and opens the place pop-up with the temple\'s painting', async () => {
        await loadMap(page, t.map);
        const pin = await page.waitForSelector('.tsi-exp-pin[data-id=' + t.id + ']');
        const info = await pin.evaluate(p => ({ title: p.title, img: p.querySelector('img').getAttribute('src'), w: p.querySelector('img').naturalWidth }));
        equal(info.title, t.name);
        assert(info.img.indexOf('temples/' + t.god + '-icon.png') !== -1 && info.w > 0, 'the coin loads: ' + info.img);
        const banner = await page.$eval('[data-test=banner-' + t.id + '] .tsi-exp-banner__name', n => n.textContent);
        equal(banner, t.name);
        /* Where it sits: the pin's left and top, as fractions of the map picture. */
        const pos = await page.evaluate(id => {
          const p = document.querySelector('.tsi-exp-pin[data-id=' + id + ']');
          const r = p.getBoundingClientRect(); const img = document.querySelector('.tsi-exp-stage img, .tsi-exp-stage video, .tsi-exp-stage canvas');
          return { px: r.left + r.width / 2, py: r.bottom, st: img ? img.getBoundingClientRect() : null };
        }, t.id);
        assert(pos.px > 0 && pos.py > 0, 'the pin is on screen');
        await pin.click();
        await page.waitForSelector('.tsi-exp-place');
        equal(await page.textContent('.tsi-exp-place .tsi-exp-event-title'), t.name);
        const art = await page.$eval('.tsi-exp-place .tsi-exp-place-media img', i => new Promise(res => { if (i.complete) res({ src: i.getAttribute('src'), w: i.naturalWidth }); else i.onload = () => res({ src: i.getAttribute('src'), w: i.naturalWidth }); }));
        assert(art.src.indexOf('first-temple-of-' + t.god + '.webp') !== -1 && art.w > 0, 'the painting loads: ' + art.src);
        await H.shot(page, 'temple-' + t.god + '-' + name);
        /* The pop-up fits the screen. */
        const fits = await page.$eval('.tsi-exp-place', m => { const r = m.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.top >= -1; });
        assert(fits, 'the pop-up fits the window');
        await dismiss(page);
      });
    }

    await check('the players\' window shows each temple\'s pin and, when the DM opens one, its name and painting', async () => {
      await loadMap(page, TEMPLES[0].map);
      const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
      await pv.setViewportSize(size);
      await pv.waitForSelector('[data-test=pv-stage]');
      await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
      for (const t of TEMPLES) {
        await loadMap(page, t.map);
        await pv.waitForFunction(id => !!document.querySelector('.tsi-xpv-pin img[src*="temples/"]') && [...document.querySelectorAll('.tsi-xpv-pin')].some(p => p.dataset.id === id || p.title === id), t.id, { timeout: 8000 }).catch(() => null);
        const names = await pv.$$eval('.tsi-xpv-pin', n => n.map(p => (p.getAttribute('aria-label') || p.title || '') + '|' + (p.querySelector('img') ? p.querySelector('img').getAttribute('src') : '')));
        assert(names.some(x => x.indexOf(t.name) === 0 && x.indexOf('temples/' + t.god + '-icon.png') !== -1), t.name + ' on the players\' window: ' + JSON.stringify(names));
        await page.click('.tsi-exp-pin[data-id=' + t.id + ']');
        await pv.waitForSelector('[data-test=pv-pin]', { timeout: 8000 });
        equal(await pv.textContent('[data-test=pv-pin-title]'), t.name);
        const src = await pv.$eval('[data-test=pv-pin] img', i => i.getAttribute('src'));
        assert(src.indexOf('first-temple-of-' + t.god + '.webp') !== -1, 'the players see the painting: ' + src);
        await H.shot(pv, 'temple-tv-' + t.god + '-' + name);
        await dismiss(page);
        await pv.waitForSelector('[data-test=pv-pin]', { state: 'detached', timeout: 8000 });
      }
      await pv.close();
    });

    await check('a temple shows on its own map only', async () => {
      for (const id of ['the_east_isle', 'southern_province_east']) {
        await loadMap(page, id);
        equal(await page.$$eval('.tsi-exp-pin[data-id^=temple_]', n => n.length), 0, id);
      }
    });

    equal(errors, [], 'no page errors');
    await context.close();
  }
  await browser.close();
  H.summary();
})();
