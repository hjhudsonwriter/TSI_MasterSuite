/* Tidal Sequence v2, phase 5 click-through: chalk marks and floor caustics.
   Run:  node tests/e2e/pelagosi-tidal-v2-p5.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const PEL = H.fileUrl('index.html') + '?tool=pelagosi';
const t = page => page.evaluate(() => TSI.pelagosi.debug.tidal());
const modalTitle = page => page.textContent('.tsi-modal h2, .tsi-modal [class*=title]');

async function open(browser, size) {
  const context = await H.newContext(browser, size);
  await context.setOffline(true);
  await context.addInitScript(() => {
    window.__plays = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__plays.push({ file: String(this.currentSrc || this.src).split('/').pop(), t: performance.now() });
      return play.apply(this, arguments);
    };
  });
  const page = await context.newPage();
  await page.goto(PEL);
  await page.waitForSelector('[data-test=rune-anchor]');
  await page.selectOption('[data-test=puzzle]', 'tidal');
  return { context, page };
}
async function begin(page) {
  await page.click('[data-test=begin]');
  await page.waitForSelector('.tsi-modal');
  await H.clickModal(page, 'START SEQUENCE');
  await page.waitForSelector('.tsi-modal', { state: 'detached' });
}
async function solveOuter(page) {
  const clicks = await page.evaluate(() => {
    const D = TSI_DATA.pelagosi.tidal;
    const s = TSI.pelagosi.debug.tidal();
    return D.pillarOrder.map(id => {
      const want = D.solution[id];
      const r = (D.runes.indexOf(want.rune) - s.pillars[id].runeIndex + D.runes.length) % D.runes.length;
      const d = (D.directions.indexOf(want.direction) - s.pillars[id].directionIndex + D.directions.length) % D.directions.length;
      return [id, r, d, want.rune];
    });
  });
  for (const [id, r, d, rune] of clicks) {
    if (r > 0) {
      await page.click('[data-test=pillar-rune-' + id + ']');
      await page.click('[data-test=ring-rune-' + rune + ']');
    }
    for (let i = 0; i < d; i++) await page.click('[data-test=pillar-arrow-' + id + ']');
  }
}
async function setBasin(page, rune) {
  for (let i = 0; i < 9; i++) {
    if ((await page.getAttribute('[data-test=basin]', 'data-rune')) === rune) return;
    await page.click('[data-test=basin]');
  }
  throw new Error('basin never showed ' + rune);
}
const levels = page => page.$$eval('[data-test=wall] li', l => l.map(x => x.dataset.level));



(async () => {
  const browser = await H.chromium.launch();
  for (const size of ['laptop', 'tv']) {
    section('Chalk marks and caustics (' + size + ')');
    const { context, page } = await open(browser, size);
    await begin(page);

    await check('two chalk marks sit on the floor beside the top-right and bottom-left pillars, on by default', async () => {
      equal(await page.isChecked('[data-test=chalk-on]'), true);
      const marks = await page.$$eval('.tsi-pel-chalk', m => m.map(x => ({ id: x.dataset.test, v: x.getBoundingClientRect().width > 4 })));
      equal(marks.map(m => m.id), ['chalk-a', 'chalk-b']);
      equal(marks.every(m => m.v), true);
      const pos = await page.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        const tr = r('[data-test=pillar-rune-topRight]'), ta = r('[data-test=chalk-a]');
        const bl = r('[data-test=pillar-rune-bottomLeft]'), sm = r('[data-test=chalk-b]');
        return { aRight: ta.left > tr.right - 2, bLeft: sm.right < bl.left + 2 };
      });
      equal(pos, { aRight: true, bLeft: true });
      await H.shot(page, 'pelagosi-chalk-' + size);
    });

    await check('the DM can switch the chalk off and on; Stage Mode keeps the marks', async () => {
      await page.uncheck('[data-test=chalk-on]');
      equal(await page.isVisible('[data-test=chalk-a]'), false);
      await page.check('[data-test=chalk-on]');
      equal(await page.isVisible('[data-test=chalk-b]'), true);
      await page.keyboard.press('s');
      equal(await page.isVisible('[data-test=chalk-b]'), true);
      await page.keyboard.press('s');
    });

    await check('the marks never move or change with runes, checks, pressure, shuffles or Reset', async () => {
      const snap = () => page.$$eval('.tsi-pel-chalk', m => { const f = document.querySelector('[data-test=tidal-frame]').getBoundingClientRect(); return m.map(x => { const r = x.getBoundingClientRect(); return [x.className, x.getAttribute('style'), Math.round(r.left - f.left), Math.round(r.top - f.top), x.getAttribute('title')]; }); });
      const before = await snap();
      await page.click('[data-test=pillar-rune-topLeft]');
      await page.click('[data-test=ring-rune-tide]');
      await page.waitForTimeout(700);
      await page.click('[data-test=check]');
      await page.waitForTimeout(700);
      await page.click('[data-test=shuffle]');
      await page.click('[data-test=ask]');
      equal(await snap(), before);
      await page.click('[data-test=reset]');
      equal(await snap(), before);
      await begin(page);
    });

    await check('the chalk has no text, label or tooltip', async () => {
      equal(await page.$$eval('.tsi-pel-chalk', m => m.every(x => x.textContent === '' && !x.getAttribute('title'))), true);
    });

    await check('the caustics sit behind the pillars and never block a click', async () => {
      equal(await page.$eval('.tsi-pel-caustics', e => getComputedStyle(e).pointerEvents), 'none');
      await page.click('[data-test=pillar-arrow-topLeft]');
    });
    await context.close();
  }

  {
    const { context, page } = await open(browser, 'laptop');
    const rm = await H.newContext(browser, 'laptop', { reducedMotion: 'reduce' });
    const rp = await rm.newPage();
    await rp.goto(PEL);
    await rp.waitForSelector('[data-test=rune-anchor]');
    await rp.selectOption('[data-test=puzzle]', 'tidal');
    await check('with reduced motion the caustics stand still', async () => {
      equal(await rp.$eval('.tsi-pel-caustics', e => getComputedStyle(e).animationName), 'none');
    });
    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await rm.close();
    await context.close();
  }

  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(2);
});
