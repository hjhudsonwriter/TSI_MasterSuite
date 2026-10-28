/* The Tidal Sequence cinematic clips (28 October 2026): from a double-clicked index.html, internet off.
   With the players' window connected the clip plays there (full-bleed, muted) and the DM's window plays none, only a
   note and Skip; with no players' window it plays in the DM's window as an overlay. A missing or failing clip is
   skipped silently. The Absence's third ripple is drawn on the third knock. Reduced motion plays no clips.
   Run:  node tests/e2e/pelagosi-cinematics.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const PEL = H.fileUrl('index.html') + '?tool=pelagosi';
const t = page => page.evaluate(() => TSI.pelagosi.debug.tidal());
const vis = (page, sel) => page.evaluate(s => { const n = document.querySelector(s); return !!n && !n.hidden && getComputedStyle(n).display !== 'none'; }, sel);
const activeClip = page => page.evaluate(() => { const v = document.querySelector('.tsi-pel-cine-video--on'); return v ? v.src.split('/').pop() : null; });

async function setup(browser, name, extra, routeVideos) {
  const context = await H.newContext(browser, name, extra);
  await context.setOffline(true);
  if (routeVideos) await context.route(/assets\/video\//, r => r.abort());
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
  await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected', null, { timeout: 8000 });
  await pv.waitForFunction(() => document.querySelectorAll('.tsi-pel-cine-video').length === 3, null, { timeout: 8000 });
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
async function setBasin(page, rune) {
  for (let i = 0; i < 9; i++) {
    if ((await page.getAttribute('[data-test=basin]', 'data-rune')) === rune) return;
    await page.click('[data-test=basin]');
  }
}
async function toSolve(page) {
  await solveOuter(page);
  await page.waitForTimeout(700);
  await page.click('[data-test=check]');
  await page.waitForTimeout(700);
  await setBasin(page, 'current');
  await page.click('[data-test=check]');
  await H.clickModal(page, 'Take it out');
}

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('With the players\' window connected (' + name + ')');
    const { context, page } = await setup(browser, name);
    const pv = await openPlayer(page, size);

    await check('the clips are preloaded in the players\' window once connected, and muted', async () => {
      equal(await pv.$$eval('.tsi-pel-cine-video', v => v.map(x => x.muted)), [true, true, true]);
      equal(await pv.$$eval('.tsi-pel-cine-video', v => v.map(x => x.src.split('/').pop()).sort()), ['pov-absence.mp4', 'pov-anchor-lift.mp4', 'pov-arrival.mp4']);
    });

    await check('START SEQUENCE plays the arrival clip full-bleed in the players\' window; this window plays none and shows a note', async () => {
      await begin(page);
      await pv.waitForFunction(() => { const r = document.querySelector('[data-test=pv-cine]'); return r && !r.hidden; });
      equal(await activeClip(pv), 'pov-arrival.mp4');
      equal(await vis(page, '[data-test=cine]'), false, 'no overlay on the DM screen');
      equal(await vis(page, '[data-test=cine-note]'), true);
      const r = await pv.$eval('[data-test=pv-cine]', n => { const b = n.getBoundingClientRect(); return { w: b.width, h: b.height }; });
      assert(r.w >= size.width - 1 && r.h >= size.height - 1, 'full-bleed ' + JSON.stringify(r));
      await pv.waitForFunction(() => document.querySelector('.tsi-pel-cine-video--on').currentTime > 0.3, null, { timeout: 8000 });
      await H.shot(pv, 'pelagosi-cine-arrival-' + name);
    });

    await check('the DM view stays usable while it plays (the puzzle is never blocked)', async () => {
      await page.click('[data-test=pillar-arrow-topRight]');
      equal(await page.isDisabled('[data-test=check]'), false);
    });

    await check('Skip (and Esc) end it at once: the players\' window fades back to the board and the note goes', async () => {
      await page.click('[data-test=cine-note-skip]');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-cine]').hidden, null, { timeout: 3000 });
      equal(await vis(page, '[data-test=cine-note]'), false);
      await page.click('[data-test=reset]');
      await begin(page);
      await pv.waitForFunction(() => !document.querySelector('[data-test=pv-cine]').hidden);
      await page.keyboard.press('Escape');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-cine]').hidden, null, { timeout: 3000 });
    });

    await check('a clip that plays to its end hides itself and the note goes (about six seconds)', async () => {
      await page.click('[data-test=reset]');
      await begin(page);
      await pv.waitForFunction(() => !document.querySelector('[data-test=pv-cine]').hidden);
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-cine]').hidden, null, { timeout: 12000 });
      equal(await vis(page, '[data-test=cine-note]'), false);
    });

    await check('the Anchor clip plays before the solved bar, which then appears', async () => {
      await toSolve(page);
      await pv.waitForFunction(() => document.querySelector('.tsi-pel-cine-video--on') && document.querySelector('.tsi-pel-cine-video--on').src.includes('anchor-lift'));
      equal(await page.isVisible('[data-test=release]'), false, 'the bar waits for the clip');
      await page.waitForSelector('[data-test=release]:not(.tsi-pel-hidden)', { timeout: 12000 });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-cine]').hidden, null, { timeout: 3000 });
    });

    await check('the Absence: the clip plays at 0.81, the third ripple is drawn on the third knock, the screen stays dark at the end', async () => {
      await page.click('[data-test=release]');
      await pv.waitForFunction(() => { const v = document.querySelector('.tsi-pel-cine-video--on'); return v && v.src.includes('absence'); }, null, { timeout: 8000 });
      equal(await pv.$eval('.tsi-pel-cine-video--on', v => Math.round(v.playbackRate * 100)), 81);
      equal(await pv.evaluate(() => document.querySelectorAll('[data-test=cine-ripple]').length), 0);
      await pv.waitForFunction(() => { const v = document.querySelector('.tsi-pel-cine-video--on'); return v && v.currentTime > 3.3; }, null, { timeout: 10000 });
      await H.shot(pv, 'pelagosi-cine-absence-clip-' + name);
      await pv.waitForSelector('[data-test=cine-ripple]', { timeout: 13000 });
      await pv.waitForTimeout(800);
      equal(await pv.evaluate(() => { const r = document.querySelector('[data-test=cine-ripple]'); const b = r.getBoundingClientRect(); return b.width > 100 && parseFloat(getComputedStyle(r).opacity) > 0.1; }), true, 'the third ripple is visible on the black');
      await H.shot(pv, 'pelagosi-cine-ripple-' + name);
      await page.waitForSelector('[data-test=absence-btns] button', { timeout: 16000 });
      equal(await pv.evaluate(() => document.querySelector('[data-test=pv-cine]').hidden), true, 'clip layer gone at the end');
      equal(await pv.evaluate(() => document.querySelector('[data-test=pv-veil]').className.includes('--black')), true, 'the players\' screen stays dark');
      equal(await vis(page, '[data-test=cine]'), false);
    });

    await check('Reset returns the board to the players\' window', async () => {
      await page.click('[data-test=absence-reset]');
      await pv.waitForFunction(() => !document.querySelector('[data-test=pv-veil]').className.includes('--on'));
      await H.clickModal(page, 'Not Yet');
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  section('With no players\' window: the clip plays in the DM window');
  {
    const { context, page } = await setup(browser, 'laptop');
    await check('the arrival clip is an overlay with its own Skip; the puzzle stays usable underneath', async () => {
      await begin(page);
      await page.waitForFunction(() => { const r = document.querySelector('[data-test=cine]'); return r && !r.hidden; });
      equal(await page.$$eval('.tsi-pel-cine-video', v => v.every(x => x.muted)), true);
      await page.click('[data-test=pillar-arrow-topRight]'); /* clicks go through the picture */
      await page.click('[data-test=cine-skip]');
      await page.waitForFunction(() => document.querySelector('[data-test=cine]').hidden, null, { timeout: 3000 });
    });
    await check('ticking off "Play cinematic videos" plays no clip, and the solved bar keeps its old 3.6 s', async () => {
      await page.click('[data-test=reset]');
      await page.uncheck('[data-test=cine-on]');
      await begin(page);
      await page.waitForTimeout(500);
      equal(await vis(page, '[data-test=cine]'), false);
      await toSolve(page);
      const t0 = Date.now();
      await page.waitForSelector('[data-test=release]:not(.tsi-pel-hidden)', { timeout: 6000 });
      const dt = Date.now() - t0;
      assert(dt > 2400 && dt < 5200, 'bar after ' + dt + ' ms');
      await page.click('[data-test=release]');
      await page.waitForTimeout(4200);
      equal(await vis(page, '[data-test=cine]'), false);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-test=absence-btns] button');
    });
    await context.close();
  }

  section('Clips that are missing or will not play are skipped silently');
  {
    const { context, page } = await setup(browser, 'laptop', undefined, true);
    await check('with every clip blocked, START SEQUENCE and the solve carry on exactly as before', async () => {
      await begin(page);
      await page.waitForTimeout(3200);
      equal(await vis(page, '[data-test=cine]'), false);
      await toSolve(page);
      const t0 = Date.now();
      await page.waitForSelector('[data-test=release]:not(.tsi-pel-hidden)', { timeout: 8000 });
      const dt = Date.now() - t0;
      assert(dt > 2400, 'the bar must still wait its 3.6 s (' + dt + ' ms)');
      await page.click('[data-test=release]');
      await page.waitForSelector('[data-test=absence-btns] button', { timeout: 28000 });
      equal(context.log.errors, []);
    });
    await context.close();
  }

  section('Reduced motion and clean-up');
  {
    const { context, page } = await setup(browser, 'laptop', { reducedMotion: 'reduce' });
    await check('with reduced motion no clip autoplays', async () => {
      await begin(page);
      await page.waitForTimeout(1500);
      equal(await vis(page, '[data-test=cine]'), false);
    });
    await check('leaving the puzzle mid-clip leaves nothing running', async () => {
      await page.selectOption('[data-test=puzzle]', 'memory');
      const c = await page.evaluate(() => TSI.pelagosi.debug.timers());
      equal([c.tidal.timeouts, c.finale.timeouts, c.fade.timeouts], [0, 0, 0]);
    });
    await context.close();
  }
  {
    const { context, page } = await setup(browser, 'laptop');
    await check('switching puzzle mid-clip stops the clip', async () => {
      await begin(page);
      await page.waitForFunction(() => { const r = document.querySelector('[data-test=cine]'); return r && !r.hidden; });
      await page.selectOption('[data-test=puzzle]', 'memory');
      await page.waitForFunction(() => document.querySelector('[data-test=cine]').hidden);
      equal(await page.$$eval('.tsi-pel-cine-video', v => v.every(x => x.paused)), true);
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
