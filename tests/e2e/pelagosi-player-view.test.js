/* The Tidal Sequence player window (28 October 2026): from a double-clicked index.html with the internet off, the DM's
   Pelagosi tool opens a second window (player.html?view=tidal) that shows only the chamber, the pressure word, the wall
   and passing banner titles. It follows the DM, never shows what is not revealed, saves nothing and has nothing to click.
   Run:  node tests/e2e/pelagosi-player-view.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const PEL = H.fileUrl('index.html') + '?tool=pelagosi';
const SPOILERS = /flow follows|memory seeks|depth breaks|stone returns|held water|anchor holds|cannot speak/i;
const t = page => page.evaluate(() => TSI.pelagosi.debug.tidal());
const lineText = (pv, n) => pv.textContent('[data-test=pv-wall-line-' + n + ']');

async function setup(browser, name) {
  const context = await H.newContext(browser, name);
  await context.setOffline(true);
  await context.addInitScript(() => {
    if (/player\.html/.test(location.pathname)) {
      window.__writes = 0;
      ['setItem', 'removeItem', 'clear'].forEach(k => { const o = Storage.prototype[k]; Storage.prototype[k] = function () { window.__writes++; return o.apply(this, arguments); }; });
    } else {
      window.__plays = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__plays.push(String(this.currentSrc || this.src).split('/').pop()); return play.apply(this, arguments); };
    }
  });
  const page = await context.newPage();
  await page.goto(PEL);
  await page.waitForSelector('[data-test=rune-anchor]');
  await page.selectOption('[data-test=puzzle]', 'tidal');
  return { context, page };
}
async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForFunction(() => [...document.images].every(i => i.complete));
  return pv;
}
async function begin(page) {
  await page.click('[data-test=begin]');
  await page.waitForSelector('.tsi-modal');
  await H.clickModal(page, 'START SEQUENCE');
  await page.waitForSelector('.tsi-modal', { state: 'detached' });
}
async function solveOuter(page) {
  const clicks = await page.evaluate(() => {
    const D = TSI_DATA.pelagosi.tidal, s = TSI.pelagosi.debug.tidal();
    return D.pillarOrder.map(id => {
      const want = D.solution[id];
      const r = (D.runes.indexOf(want.rune) - s.pillars[id].runeIndex + D.runes.length) % D.runes.length;
      const d = (D.directions.indexOf(want.direction) - s.pillars[id].directionIndex + D.directions.length) % D.directions.length;
      return [id, r, d, want.rune];
    });
  });
  for (const [id, r, d, rune] of clicks) {
    if (r > 0) { await page.click('[data-test=pillar-rune-' + id + ']'); await page.click('[data-test=ring-rune-' + rune + ']'); }
    for (let i = 0; i < d; i++) await page.click('[data-test=pillar-arrow-' + id + ']');
  }
}

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The Tidal player window at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const { context, page } = await setup(browser, name);
    let pv;

    await check('the DM has an Open Player View button and a status chip; the window connects by itself', async () => {
      equal(await page.textContent('[data-test=player-view-status]'), 'Not open');
      pv = await openPlayer(page, size);
      await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected', null, { timeout: 8000 });
      equal(await pv.title(), 'The Tidal Sequence · The Scarlett Isles: D&D Tool Suite');
    });

    await check('the player window shows the chamber, the four pillars, the wall and the meter, and nothing else', async () => {
      await begin(page);
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-pel-pillar').length === 4);
      equal(await pv.$$eval('[data-test=pv-wall] li', l => l.length), 5);
      equal(await pv.textContent('[data-test=pv-pressure]'), 'Calm');
      const text = (await pv.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
      const wall = await pv.$$eval('[data-test=pv-wall] li', l => l.map(x => x.textContent));
      let left = text;
      wall.forEach(w => { left = left.replace(w, ''); });
      left = left.replace(/calm/i, '').replace(/[\u2191\u2192\u2193\u2190]/g, '').replace(/\s+/g, ' ').trim(); /* the four arrows are part of the pillars */
      equal(left, '', 'only the wall and the pressure word may be text; also shown: "' + left + '"');
      await H.shot(pv, 'pelagosi-player-' + name);
    });

    await check('nothing in it can be clicked, focused or scrolled; the cursor hides after two seconds', async () => {
      equal(await pv.$$eval('button, input, select, textarea, a, [tabindex]', n => n.length), 0, 'focusable things');
      equal(await pv.evaluate(() => getComputedStyle(document.querySelector('.tsi-pel-pv')).pointerEvents), 'none');
      equal(await pv.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), true, 'scrollbars');
      await pv.waitForTimeout(2300);
      equal(await pv.evaluate(() => document.querySelector('.tsi-pel-pv').classList.contains('tsi-pel-pv--idle')), true);
    });

    await check('the stage is 16:9 and fills the window; the wall text is large enough for a room', async () => {
      const r = await pv.$eval('[data-test=pv-stage]', n => { const b = n.getBoundingClientRect(); return { w: b.width, h: b.height }; });
      assert(Math.abs(r.w / r.h - 16 / 9) < 0.02, 'ratio ' + r.w / r.h);
      assert(r.w >= size.width * 0.95 || r.h >= size.height * 0.95, 'fills one side');
      const fs = await pv.$eval('[data-test=pv-wall-line-1]', n => parseFloat(getComputedStyle(n).fontSize));
      assert(fs >= (name === 'tv' ? 29 : 25), 'wall type ' + fs + 'px');
    });

    await check('the wall follows the DM: the fragment shows, then the whole line, and a cut line is only blocks', async () => {
      equal(/^[▒ .,]+$/.test(await lineText(pv, 1)), true);
      assert(!SPOILERS.test(await pv.evaluate(() => document.body.innerHTML)), 'a spoiler is already in the player window');
      await page.click('[data-test=reading-fragment-tl]');
      await pv.waitForFunction(() => /Flow follows/.test(document.querySelector('[data-test=pv-wall-line-1]').textContent));
      equal(await lineText(pv, 1), 'Flow follows ▒▒▒▒▒▒.');
      assert(!/Flow follows memory/.test(await pv.evaluate(() => document.body.innerHTML)), 'the whole line must not be in the DOM yet');
      await page.click('[data-test=reading-read-tl]');
      await pv.waitForFunction(() => /memory\./.test(document.querySelector('[data-test=pv-wall-line-1]').textContent));
      equal(await lineText(pv, 1), 'Flow follows memory.');
      assert(!/Memory seeks depth/.test(await pv.evaluate(() => document.body.innerHTML)), 'line 2 must still be hidden');
      await page.click('[data-test=reading-hide-tl]');
      await pv.waitForFunction(() => !/Flow follows/.test(document.querySelector('[data-test=pv-wall-line-1]').textContent));
    });

    await check('a rune change on the DM board appears on the players\' pillar; the arrow follows too', async () => {
      await page.click('[data-test=pillar-rune-topLeft]');
      await page.click('[data-test=ring-rune-tide]');
      await pv.waitForFunction(() => document.querySelector('.tsi-pel-pillar[data-pillar=topLeft] .tsi-pel-pillar-rune').dataset.rune === 'tide');
      const before = await pv.$eval('.tsi-pel-pillar[data-pillar=topRight] .tsi-pel-pillar-arrow', n => n.dataset.direction);
      await page.click('[data-test=pillar-arrow-topRight]');
      await pv.waitForFunction(b => document.querySelector('.tsi-pel-pillar[data-pillar=topRight] .tsi-pel-pillar-arrow').dataset.direction !== b, before);
    });

    await check('a wrong check raises the word and shows the banner title only (no sentence)', async () => {
      await page.waitForTimeout(700);
      await page.click('[data-test=check]');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-pressure]').textContent === 'Stirring');
      await pv.waitForSelector('[data-test=pv-event].tsi-pel-active');
      equal(await pv.$$eval('[data-test=pv-event] p', p => p.length), 1);
      equal(await pv.$$eval('[data-test=pv-event] span', s => s.length), 0, 'no sentence in the banner');
      equal(await pv.textContent('[data-test=pv-event] p'), 'THE BASIN RIPPLES');
      await pv.waitForSelector('[data-test=pv-event].tsi-pel-active', { state: 'detached', timeout: 4000 });
    });

    await check('the chalk marks and the pressure water follow the DM', async () => {
      equal(await pv.isVisible('[data-test=pv-chalk-a]'), true);
      await page.uncheck('[data-test=chalk-on]');
      await pv.waitForFunction(() => document.querySelector('.tsi-pel-chalk-layer').classList.contains('tsi-pel-hidden'));
      await page.check('[data-test=chalk-on]');
      await pv.waitForFunction(() => !document.querySelector('.tsi-pel-chalk-layer').classList.contains('tsi-pel-hidden'));
      equal(await pv.evaluate(() => document.querySelector('.tsi-pel-pv-stage').classList.contains('tsi-pel--tidal-pressure-1')), true);
    });

    await check('refreshing the players\' window re-syncs with no clicks', async () => {
      await pv.reload();
      await pv.waitForSelector('[data-test=pv-pressure]:not(:empty)', { timeout: 8000 });
      equal(await pv.textContent('[data-test=pv-pressure]'), 'Stirring');
      equal(await pv.evaluate(() => document.querySelectorAll('.tsi-pel-pillar').length), 4);
    });

    await check('reloading the DM tool re-finds the open window by itself', async () => {
      await page.reload();
      await page.waitForSelector('[data-test=rune-anchor]');
      await page.selectOption('[data-test=puzzle]', 'tidal');
      await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected', null, { timeout: 8000 });
    });

    await check('the solution never reaches the players\' window, even after the board wakes', async () => {
      await begin(page);
      await solveOuter(page);
      await page.waitForTimeout(700);
      await page.click('[data-test=check]');
      await pv.waitForFunction(() => document.querySelector('.tsi-pel-basin:not(.tsi-pel-hidden)'));
      const html = await pv.evaluate(() => document.documentElement.outerHTML);
      assert(!SPOILERS.test(html), 'a spoiler in the player window');
      assert(!/solution|basinSolution|Remove the Anchor|Maerys/i.test(html), 'a solution word in the player window');
      const data = await pv.evaluate(() => typeof window.TSI_DATA.pelagosi);
      equal(data, 'undefined', 'the puzzle data must not be loaded in the players\' window');
    });

    await check('the players\' window saves nothing', async () => {
      equal(await pv.evaluate(() => window.__writes), 0);
    });

    await check('nothing ran out of timers; closing the tool leaves none behind', async () => {
      await page.selectOption('[data-test=puzzle]', 'memory');
      const c = await page.evaluate(() => TSI.pelagosi.debug.timers());
      equal([c.tidal.timeouts, c.finale.timeouts, c.fade.timeouts], [0, 0, 0]);
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
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
