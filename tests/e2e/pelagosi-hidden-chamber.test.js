/* Act 7: "Show the hidden chamber" on the Tidal Sequence (28 October 2026; docs/ABSENT-TIDE-SCENE-DECKS.md, part D).
   Once the puzzle is solved and before RELEASE THE ABSENCE the DM can show the cutaway on the players' view (its clip
   first, muted, then the still), or over the DM's own window when no players' window is open. Not part of the finale.
   Run:  node tests/e2e/pelagosi-hidden-chamber.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const PEL = H.fileUrl('index.html') + '?tool=pelagosi';
const t = page => page.evaluate(() => TSI.pelagosi.debug.tidal());
const vis = (page, sel) => page.evaluate(s => { const n = document.querySelector(s); return !!n && !n.hidden && getComputedStyle(n).display !== 'none'; }, sel);

async function setup(browser, name, extra, routes) {
  const context = await H.newContext(browser, name, extra);
  await context.setOffline(true);
  (routes || []).forEach(r => context.route(r, route => route.abort()));
  await context.addInitScript(() => {
    if (/player\.html/.test(location.pathname)) return;
    window.__plays = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__plays.push(String(this.currentSrc || this.src).split('/').pop()); return play.apply(this, arguments); };
  });
  const page = await context.newPage();
  await page.goto(PEL);
  await page.waitForSelector('[data-test=rune-anchor]');
  await page.selectOption('[data-test=puzzle]', 'tidal');
  await page.uncheck('[data-test=cine-on]').catch(() => {});
  return { context, page };
}
async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected', null, { timeout: 8000 });
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
async function toSolved(page) {
  await begin(page);
  await solveOuter(page);
  await page.waitForTimeout(700);
  await page.click('[data-test=check]');
  await page.waitForTimeout(700);
  await setBasin(page, 'current');
  await page.click('[data-test=check]');
  await H.clickModal(page, 'Take it out');
  await page.waitForSelector('[data-test=release]:not(.tsi-pel-hidden)', { timeout: 8000 });
}

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The hidden chamber on the players\' view (' + name + ')');
    const { context, page } = await setup(browser, name);
    const pv = await openPlayer(page, size);

    await check('the button is off until the puzzle is solved', async () => {
      equal(await page.isDisabled('[data-test=hidden-chamber]'), true);
      await begin(page);
      equal(await page.isDisabled('[data-test=hidden-chamber]'), true);
    });

    await check('once solved it is on, and nothing of the chamber is in the players\' window before it is shown', async () => {
      await page.click('[data-test=reset]');
      await toSolved(page);
      equal(await page.isDisabled('[data-test=hidden-chamber]'), false);
      equal(await pv.evaluate(() => document.documentElement.outerHTML.includes('hidden-chamber')), false);
    });

    let before;
    await check('Show puts the cutaway on the TV full-bleed on black: the clip plays muted, then the still', async () => {
      before = { timers: await page.evaluate(() => TSI.pelagosi.debug.timers()), plays: await page.evaluate(() => window.__plays.length), finale: (await t(page)).finale };
      await page.check('[data-test=cine-on]'); /* the clip follows "Play cinematic videos" */
      await page.click('[data-test=hidden-chamber]');
      await pv.waitForFunction(() => { const r = document.querySelector('[data-test=pv-cut]'); return r && !r.hidden; }, null, { timeout: 5000 });
      await pv.waitForFunction(() => { const i = document.querySelector('[data-test=pv-cut-still]'); return i && i.complete && i.naturalWidth > 0; });
      equal(await pv.$eval('[data-test=pv-cut]', n => { const b = n.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }), [size.width, size.height]);
      equal(await pv.$eval('[data-test=pv-cut-video]', v => [v.muted, v.classList.contains('tsi-pel-cut-video--on')]), [true, true]);
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-cut-video]').currentTime > 0.3, null, { timeout: 8000 });
      equal(await page.textContent('[data-test=hidden-chamber]'), 'Hide the hidden chamber');
      equal(await vis(page, '[data-test=cut]'), false, 'nothing over the DM window while the TV shows it');
      await H.shot(pv, 'hidden-chamber-' + name);
    });

    await check('it changes no timer, cue or sound', async () => {
      equal((await t(page)).finale, before.finale);
      equal(await page.evaluate(() => TSI.pelagosi.debug.timers()), before.timers);
      equal(await page.evaluate(() => window.__plays.length), before.plays, 'no sound played');
      equal(await pv.$$eval('audio', a => a.length), 0);
    });

    await check('Hide returns the board; showing it again works', async () => {
      await page.click('[data-test=hidden-chamber]');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-cut]').hidden, null, { timeout: 4000 });
      equal(await page.textContent('[data-test=hidden-chamber]'), 'Show the hidden chamber');
      await page.click('[data-test=hidden-chamber]');
      await pv.waitForFunction(() => !document.querySelector('[data-test=pv-cut]').hidden);
    });

    await check('a refresh of the players\' window brings it back by itself', async () => {
      await pv.reload();
      await pv.waitForFunction(() => { const r = document.querySelector('[data-test=pv-cut]'); return r && !r.hidden; }, null, { timeout: 8000 });
    });

    await check('RELEASE THE ABSENCE takes it away and the finale runs as always', async () => {
      await page.click('[data-test=release]');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-cut]').hidden, null, { timeout: 3000 });
      equal((await t(page)).finale, 'running');
      equal(await page.isDisabled('[data-test=hidden-chamber]'), true, 'off during the finale');
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-test=absence-btns] button');
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  section('With no players\' window: it shows over the DM window');
  {
    const { context, page } = await setup(browser, 'laptop');
    await toSolved(page);
    await check('Show covers this window with its own Hide button; Esc hides it', async () => {
      await page.click('[data-test=hidden-chamber]');
      await page.waitForFunction(() => { const r = document.querySelector('[data-test=cut]'); return r && !r.hidden; });
      equal(await page.isVisible('[data-test=cut-hide]'), true);
      await page.click('[data-test=cut-hide]');
      await page.waitForFunction(() => document.querySelector('[data-test=cut]').hidden);
      await page.click('[data-test=hidden-chamber]');
      await page.waitForFunction(() => !document.querySelector('[data-test=cut]').hidden);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('[data-test=cut]').hidden);
    });
    await check('leaving the puzzle takes it down and leaves nothing running', async () => {
      await page.click('[data-test=hidden-chamber]');
      await page.selectOption('[data-test=puzzle]', 'memory');
      await page.waitForFunction(() => document.querySelector('[data-test=cut]').hidden);
      equal(await page.$$eval('[data-test=cut] video', v => v.every(x => x.paused)), true);
    });
    await context.close();
  }

  section('Reduced motion, and the clip missing');
  {
    const { context, page } = await setup(browser, 'laptop', { reducedMotion: 'reduce' });
    await toSolved(page);
    await check('with reduced motion only the still is shown, no clip', async () => {
      await page.click('[data-test=hidden-chamber]');
      await page.waitForFunction(() => { const r = document.querySelector('[data-test=cut]'); return r && !r.hidden; });
      equal(await page.$eval('[data-test=cut-video]', v => v.classList.contains('tsi-pel-cut-video--on') || !!v.getAttribute('src')), false);
    });
    await context.close();
  }
  {
    const { context, page } = await setup(browser, 'laptop', undefined, [/hidden-chamber\.mp4/]);
    await toSolved(page);
    await check('with the clip missing the still is shown and nothing throws', async () => {
      await page.check('[data-test=cine-on]');
      await page.click('[data-test=hidden-chamber]');
      await page.waitForFunction(() => { const r = document.querySelector('[data-test=cut]'); return r && !r.hidden; });
      await page.waitForFunction(() => { const v = document.querySelector('[data-test=cut-video]'); return !v.classList.contains('tsi-pel-cut-video--on'); }, null, { timeout: 4000 });
      await page.waitForFunction(() => document.querySelector('[data-test=cut-still]').naturalWidth > 0, null, { timeout: 4000 });
      equal(context.log.errors, []);
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
