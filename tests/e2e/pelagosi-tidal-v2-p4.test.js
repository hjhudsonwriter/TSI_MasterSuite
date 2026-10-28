/* Tidal Sequence v2, phase 4 click-through: the ambient bed and the Absence
   finale (cues run ten times faster here). Internet off.
   Run:  node tests/e2e/pelagosi-tidal-v2-p4.test.js */
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


const plays = page => page.evaluate(() => window.__plays.map(p => p.file));
const speedUp = page => page.evaluate(() => { TSI_DATA.pelagosi.tidal.finale.cues.forEach(c => { c.at = Math.round(c.at / 10); }); });
const veil = page => page.isVisible('[data-test=absence]');
const buttons = page => page.$$eval('[data-test=absence-btns] button', b => b.map(x => x.textContent));

async function toSolved(page) {
  await begin(page);
  await solveOuter(page);
  await page.click('[data-test=check]');
  await page.waitForTimeout(700);
  await setBasin(page, 'current');
  await page.click('[data-test=check]');
  await H.clickModal(page, 'Take it out');
  await page.waitForSelector('[data-test=release]:not(.tsi-pel-hidden)', { timeout: 5000 });
}

(async () => {
  const browser = await H.chromium.launch();

  for (const size of ['laptop', 'tv']) {
    section('The ambient bed and a normal solve (' + size + ')');
    const { context, page } = await open(browser, size);
    await speedUp(page);

    await check('the bed starts when the sequence begins', async () => {
      await begin(page);
      assert((await plays(page)).includes('chamber-bed.mp3'), 'no bed');
    });

    await check('RELEASE THE ABSENCE: the cues play in order, then the end card offers Replay and Reset only', async () => {
      await solveOuter(page);
      await page.click('[data-test=check]');
      await page.waitForTimeout(700);
      await setBasin(page, 'current');
      await page.click('[data-test=check]');
      await H.clickModal(page, 'Take it out');
      await page.waitForSelector('[data-test=release]:not(.tsi-pel-hidden)', { timeout: 5000 });
      await page.evaluate(() => { window.__plays.length = 0; });
      await page.click('[data-test=release]');
      assert(await veil(page), 'veil should show');
      await page.waitForSelector('[data-test=absence-btns] button', { timeout: 6000 });
      const order = (await plays(page)).filter(f => /absence-void|knock|water-backward/.test(f));
      equal(order, ['absence-void.mp3', 'knock-1.mp3', 'knock-2.mp3', 'knock-3.mp3', 'water-backward.mp3']);
      equal(await page.textContent('[data-test=absence-note]'), 'End of session. Read the cliffhanger.');
      equal(await buttons(page), ['REPLAY THE ABSENCE', 'RESET']);
      equal(await page.evaluate(() => document.activeElement.tagName), 'BODY', 'nothing focused by itself');
      await H.shot(page, 'pelagosi-absence-end');
    });

    await check('the knock gaps are uneven (about 2.6 s then 3.5 s, scaled)', async () => {
      const cues = await page.evaluate(() => TSI_DATA.pelagosi.tidal.finale.cues.filter(c => c.type === 'knock').map(c => c.at));
      const a = cues[1] - cues[0], b = cues[2] - cues[1];
      assert(b > a, 'gaps ' + a + ', ' + b);
    });

    await check('REPLAY plays it again from the start', async () => {
      await page.evaluate(() => { window.__plays.length = 0; });
      await page.click('[data-test=absence-replay]');
      await page.waitForSelector('[data-test=absence-btns] button', { timeout: 6000 });
      assert((await plays(page)).includes('knock-3.mp3'), 'no knocks on replay');
    });

    await check('RESET goes back to the start and shows the rules', async () => {
      await page.click('[data-test=absence-reset]');
      await page.waitForSelector('.tsi-modal');
      equal(await veil(page), false);
      equal((await t(page)).phase, 'idle');
      await H.clickModal(page, 'Not Yet');
    });
    await context.close();
  }

  section('The bed never leaves a gap');
  {
    const { context, page } = await open(browser, 'laptop');
    await begin(page);
    await check('near the end of the bed, a second copy fades in before the first stops', async () => {
      const d = await page.evaluate(() => TSI.pelagosi.debug.sounds.chamberBed.duration);
      assert(d > 8, 'bed duration ' + d);
      await page.evaluate(() => { const b = TSI.pelagosi.debug.sounds.chamberBed; b.currentTime = b.duration - 3; });
      await page.waitForFunction(() => window.__plays.filter(p => p.file === 'chamber-bed.mp3').length >= 2, null, { timeout: 6000 });
      await page.waitForTimeout(800);
      const vols = await page.evaluate(() => TSI.pelagosi.debug.bedState());
      assert(vols.a.paused === false && vols.b.paused === false, 'both should be sounding during the crossfade: ' + JSON.stringify(vols));
    });
    await context.close();
  }

  section('Skip and Esc');
  {
    const { context, page } = await open(browser, 'laptop');
    await begin(page);
    await solveOuter(page);
    await page.click('[data-test=check]');
    await page.waitForTimeout(700);
    await setBasin(page, 'current');
    await page.click('[data-test=check]');
    await H.clickModal(page, 'Take it out');
    await page.waitForSelector('[data-test=release]:not(.tsi-pel-hidden)', { timeout: 5000 });

    await check('Esc during the real-speed finale jumps to the end card and stops every sound and timer', async () => {
      await page.click('[data-test=release]');
      await page.waitForTimeout(400);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-test=absence-btns] button');
      equal(await buttons(page), ['REPLAY THE ABSENCE', 'RESET']);
      const c = await page.evaluate(() => TSI.pelagosi.debug.timers());
      equal(c.finale.timeouts, 0);
      const playing = await page.evaluate(() => Object.keys(TSI.pelagosi.debug.sounds).filter(n => !TSI.pelagosi.debug.sounds[n].paused));
      equal(playing, []);
      await page.waitForTimeout(1500);
      equal(await page.evaluate(() => window.__plays.filter(p => /knock/.test(p.file)).length), 0, 'a knock sounded after Skip');
    });
    await context.close();
  }

  section('Play the Absence anyway, and return');
  {
    const { context, page } = await open(browser, 'laptop');
    await speedUp(page);
    await check('it is off before BEGIN', async () => {
      equal(await page.isDisabled('[data-test=absence-anyway]'), true);
    });

    let before;
    await check('mid-puzzle it locks the puzzle, plays, and offers Replay, Return and Reset', async () => {
      await begin(page);
      await page.click('[data-test=reading-fragment-tl]');
      await page.click('[data-test=pillar-rune-topLeft]');
      await page.click('[data-test=ring-rune-tide]');
      await page.click('[data-test=pillar-arrow-topRight]');
      await page.click('[data-test=check]');
      await page.waitForTimeout(2200);
      before = await t(page);
      assert(before.pressure === 1, 'pressure ' + before.pressure);
      await page.click('[data-test=absence-anyway]');
      await page.waitForSelector('[data-test=absence-btns] button', { timeout: 6000 });
      equal(await buttons(page), ['REPLAY THE ABSENCE', 'RETURN TO THE PUZZLE', 'RESET']);
      equal(await page.evaluate(() => document.activeElement.tagName), 'BODY');
    });

    await check('RETURN restores the pillars, pressure, wall lines and attempts exactly, and the puzzle works again', async () => {
      await page.click('[data-test=absence-return]');
      equal(await veil(page), false);
      const after = await t(page);
      ['pillars', 'basinRuneIndex', 'pressure', 'lines', 'attempts', 'phase', 'solved'].forEach(k => equal(after[k], before[k], k));
      equal(after.locked, false);
      equal(await page.isDisabled('[data-test=check]'), false);
      equal(await page.isDisabled('[data-test=pillar-rune-topLeft]'), false);
      equal(await page.evaluate(() => !TSI.pelagosi.debug.sounds.chamberBed.paused), true, 'bed resumed');
    });

    await check('after returning, the tide timer restarts fresh', async () => {
      equal((await t(page)).tideMs, 0);
    });

    await check('leaving the tool mid-finale leaves no timers or sounds running', async () => {
      await page.click('[data-test=absence-anyway]');
      await page.waitForTimeout(150);
      await page.selectOption('[data-test=puzzle]', 'memory');
      const c = await page.evaluate(() => TSI.pelagosi.debug.timers());
      equal([c.tidal.timeouts, c.finale.timeouts, c.fade.timeouts], [0, 0, 0]);
      equal(await veil(page), false);
      equal(await page.evaluate(() => Object.keys(TSI.pelagosi.debug.sounds).filter(n => !TSI.pelagosi.debug.sounds[n].paused)), []);
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
      equal(context.log.failed, []);
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
