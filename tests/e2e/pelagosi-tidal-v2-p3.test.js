/* Tidal Sequence v2, phase 3 click-through: Ask the Chamber, the optional tide
   timer, the Anchor question and the solved bar. Internet off.
   Run:  node tests/e2e/pelagosi-tidal-v2-p3.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const PEL = H.fileUrl('index.html') + '?tool=pelagosi';
const t = page => page.evaluate(() => TSI.pelagosi.debug.tidal());
const modalTitle = page => page.textContent('.tsi-modal h2, .tsi-modal [class*=title]');

async function open(browser, size) {
  const context = await H.newContext(browser, size);
  await context.setOffline(true);
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
    section('Ask the Chamber (' + size + ')');
    const { context, page } = await open(browser, size);
    await page.evaluate(() => { window.__plays = []; });

    await check('Ask the Chamber is off until the puzzle begins', async () => {
      equal(await page.isDisabled('[data-test=ask]'), true);
      await begin(page);
      equal(await page.isDisabled('[data-test=ask]'), false);
    });

    await check('each ask raises pressure one step and reveals the next wall line (cut, then fragment, then whole)', async () => {
      await page.click('[data-test=ask]');
      let s = await t(page);
      equal(s.pressure, 1);
      equal((await levels(page))[0], 'fragment');
      await page.click('[data-test=ask]');
      s = await t(page);
      equal(s.pressure, 2);
      equal((await levels(page))[0], 'whole');
      assert(/water remembers that you asked/.test(await page.textContent('[data-test=readings-note]')));
    });

    await check('a third ask is refused above the limit, and costs nothing', async () => {
      await page.click('[data-test=ask]'); /* pressure 2 is still allowed: this is the last one */
      equal((await t(page)).pressure, 3);
      equal(await page.isDisabled('[data-test=ask]'), true);
      equal((await t(page)).pressure, 3);
    });
    await context.close();
  }

  section('The rules text keeps the answer hidden');
  {
    const { context, page } = await open(browser, 'laptop');
    await check('the rules pop-up, the Sequence Rules panel and the console never give the order, the direction or the basin answer', async () => {
      await page.click('[data-test=begin]');
      await page.waitForSelector('.tsi-modal');
      const popup = await page.textContent('.tsi-modal');
      assert(/Each pillar carries a rune and a current/.test(popup), popup);
      assert(/The chamber remembers what was cut away\./.test(popup), popup);
      await H.clickModal(page, 'START SEQUENCE');
      await page.waitForSelector('.tsi-modal', { state: 'detached' });
      const all = await page.evaluate(() => document.body.textContent);
      assert(!/Flow\s*→|clockwise|Stone returns the Current|Let no current end/i.test(all), 'a giveaway is on the page');
      assert(/Align the four pillars until the chamber remembers/.test(all), 'panel copy missing');
    });
    await context.close();
  }

  section('The optional tide');
  {
    const { context, page } = await open(browser, 'laptop');
    await page.evaluate(() => { TSI_DATA.pelagosi.tidal.timer.seconds = 2; });
    await begin(page);

    await check('the tide is off by default, so nothing rises on its own', async () => {
      equal(await page.isChecked('[data-test=tide-on]'), false);
      await page.waitForTimeout(3500);
      equal((await t(page)).pressure, 0);
    });

    await check('switched on, the tide raises pressure every few seconds but never past Reversing (no surge)', async () => {
      await page.check('[data-test=tide-on]');
      await page.waitForTimeout(8500);
      const s = await t(page);
      equal(s.pressure, 3);
      equal(s.locked, false);
      equal(s.phase, 'outer');
    });

    await check('switched off again, it stops', async () => {
      await page.click('[data-test=reset]');
      await begin(page);
      await page.uncheck('[data-test=tide-on]');
      await page.waitForTimeout(3000);
      equal((await t(page)).pressure, 0);
    });

    await check('closing the tool leaves no timers running', async () => {
      await page.check('[data-test=tide-on]');
      await page.click('[data-test=reset]');
      const c = await page.evaluate(() => TSI.pelagosi.debug.timers());
      equal(c.tidal.timeouts || 0, 0);
    });
    await context.close();
  }

  section('The Anchor question and the solved bar');
  {
    const { context, page } = await open(browser, 'laptop');
    await begin(page);
    await solveOuter(page);
    await page.click('[data-test=check]');
    await page.waitForTimeout(700); /* double-click guard */

    await check('Anchor + Attune raises pressure and says the basin holds (no question asked)', async () => {
      await page.click('[data-test=check]');
      equal((await t(page)).pressure, 1);
      equal(await page.$('.tsi-modal'), null);
      assert(/content to hold/.test(await page.textContent('[data-test=event] span')));
    });

    await check('Current + Attune asks first; "Leave it" changes nothing', async () => {
      await page.waitForTimeout(2000);
      await setBasin(page, 'current');
      const before = await t(page);
      await page.click('[data-test=check]');
      await page.waitForSelector('.tsi-modal');
      equal(await modalTitle(page), 'Remove the Anchor?');
      await H.clickModal(page, 'Leave it');
      await page.waitForSelector('.tsi-modal', { state: 'detached' });
      const after = await t(page);
      equal([after.pressure, after.solved, after.phase, after.attempts], [before.pressure, false, 'basin', before.attempts]);
    });

    await check('Escape also means "Leave it"', async () => {
      await page.waitForTimeout(700);
      await page.click('[data-test=check]');
      await page.waitForSelector('.tsi-modal');
      await page.keyboard.press('Escape');
      await page.waitForSelector('.tsi-modal', { state: 'detached' });
      equal((await t(page)).solved, false);
    });

    await check('"Take it out" solves; the crimson release button and Read success text appear, nothing pops up by itself', async () => {
      await page.waitForTimeout(700);
      await page.click('[data-test=check]');
      await H.clickModal(page, 'Take it out');
      equal((await t(page)).solved, true);
      await page.waitForSelector('[data-test=release]:not(.tsi-pel-hidden)', { timeout: 5000 });
      equal(await page.isVisible('[data-test=read-success]'), true);
      equal(await page.isVisible('[data-test=check]'), false);
      equal(await page.$('.tsi-modal'), null);
      assert(!/northern arch|Maerys/.test(await page.innerText('[data-test=stage]')), 'old text still shown');
      await H.shot(page, 'pelagosi-tidal-solved-bar');
    });

    await check('Read success text opens it; RESET SEQUENCE clears the solved bar', async () => {
      await page.click('[data-test=read-success]');
      await page.waitForSelector('.tsi-modal');
      equal(await modalTitle(page), 'The Anchor Lifts');
      await H.clickModal(page, 'RESET SEQUENCE');
      await page.waitForSelector('.tsi-modal');
      await H.clickModal(page, 'Not Yet');
      equal(await page.isVisible('[data-test=release]'), false);
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
