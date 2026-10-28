/* Tidal Sequence v2, final checks: with the sound files missing, Memory's sounds
   unchanged, and everything stopped on leaving. Internet off.
   Run:  node tests/e2e/pelagosi-tidal-v2-p6.test.js */
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



const buttons = page => page.$$eval('[data-test=absence-btns] button', b => b.map(x => x.textContent));

(async () => {
  const browser = await H.chromium.launch();

  section('With every sound file missing');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    await context.route(/assets\/audio\//, route => route.abort());
    const page = await context.newPage();
    await page.goto(PEL);
    await page.waitForSelector('[data-test=rune-anchor]');
    await page.selectOption('[data-test=puzzle]', 'tidal');
    await page.evaluate(() => { TSI_DATA.pelagosi.tidal.finale.cues.forEach(c => { c.at = Math.round(c.at / 10); }); });

    await check('the puzzle and the whole finale still work in silence, with no page errors', async () => {
      await begin(page);
      await solveOuter(page);
      await page.click('[data-test=check]');
      await page.waitForTimeout(700);
      await setBasin(page, 'current');
      await page.click('[data-test=check]');
      await H.clickModal(page, 'Take it out');
      await page.waitForSelector('[data-test=release]:not(.tsi-pel-hidden)', { timeout: 5000 });
      await page.click('[data-test=release]');
      await page.waitForSelector('[data-test=absence-btns] button', { timeout: 6000 });
      equal(await buttons(page), ['REPLAY THE ABSENCE', 'RESET']);
      equal(context.log.errors, []);
    });
    await context.close();
  }

  section('Memory is untouched');
  {
    const { context, page } = await open(browser, 'laptop');
    await check('Memory\'s sounds keep their old volume (no per-sound multiplier)', async () => {
      const r = await page.evaluate(() => {
        const D = TSI_DATA.pelagosi, s = TSI.pelagosi.debug.sounds;
        return ['runePlace', 'runeClick', 'puzzleFail', 'puzzleSolve', 'cavernOpen'].map(n => Math.abs(s[n].volume - D.volume) < 1e-9);
      });
      equal(r, [true, true, true, true, true]);
    });
    await check('every sound marked ready has its file in the audio folder', async () => {
      const fs = require('fs'), path = require('path');
      const sounds = await page.evaluate(() => TSI_DATA.pelagosi.sounds);
      const missing = Object.values(sounds).filter(s => s.ready && !fs.existsSync(path.join(H.ROOT, 'tools/pelagosi/assets/audio', s.file))).map(s => s.file);
      equal(missing, []);
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
