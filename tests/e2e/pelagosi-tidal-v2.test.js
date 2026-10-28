/* Tidal Sequence v2, phase 2 click-through: the scarred wall, the rune legend,
   the rune ring, the Readings panel and Stage Mode.
   Opens index.html?tool=pelagosi from its files with the internet off, at the
   laptop (1707 x 930, ratio 1.5) and the TV (1920 x 1080, ratio 1).
   Run:  node tests/e2e/pelagosi-tidal-v2.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const PEL = H.fileUrl('index.html') + '?tool=pelagosi';
const INSCRIPTION = /flow follows|memory seeks|depth breaks|stone returns the current|held water|anchor holds/i;
const t = page => page.evaluate(() => TSI.pelagosi.debug.tidal());
const sel = (kind, id) => '[data-test=' + kind + '-' + id + ']';
const lineText = (page, n) => page.textContent('[data-test=wall-line-' + n + ']');
const lineLevel = (page, n) => page.getAttribute('[data-test=wall-line-' + n + ']', 'data-level');

async function open(browser, size, extra) {
  const context = await H.newContext(browser, size, extra);
  await context.setOffline(true);
  const page = await context.newPage();
  await page.goto(PEL);
  await page.waitForSelector('[data-test=rune-anchor]');
  await page.selectOption('[data-test=puzzle]', 'tidal');
  await page.uncheck('[data-test=cine-on]'); /* the clips have their own test (pelagosi-cinematics) */
  return { context, page };
}

async function begin(page) {
  await page.click('[data-test=begin]');
  await page.waitForSelector('.tsi-modal');
  await H.clickModal(page, 'START SEQUENCE');
  await page.waitForSelector('.tsi-modal', { state: 'detached' });
}

(async () => {
  const browser = await H.chromium.launch();

  for (const size of ['laptop', 'tv']) {
    section('The wall, legend and Readings (' + size + ', internet off)');
    const { context, page } = await open(browser, size);

    await check('before BEGIN the wall already shows five cut lines and no inscription anywhere', async () => {
      equal(await page.$$eval('[data-test=wall] li', l => l.map(x => x.dataset.level)), ['cut', 'cut', 'cut', 'cut', 'cut']);
      assert(!INSCRIPTION.test(await page.innerText('body')), 'inscription text on the page');
      assert(!INSCRIPTION.test(await page.evaluate(() => document.body.textContent)), 'inscription text in the DOM');
    });

    await check('the rune legend lists all nine runes with real icons and Harry\'s meanings, no emoji', async () => {
      equal(await page.$$eval('[data-test=rune-legend] li', l => l.length), 9);
      equal(await page.$$eval('[data-test=rune-legend] img', i => i.every(x => /runes\/rune_[a-z]+\.png$/.test(x.getAttribute('src')) && x.naturalWidth > 0)), true);
      const txt = await page.textContent('[data-test=rune-legend]');
      assert(/Stone\s*Permanence/.test(txt) && /Echo\s*Memory, History/.test(txt) && /Anchor\s*Stability, Restraint/.test(txt), txt);
      assert(!/[\u{1F300}-\u{1FAFF}⚓☾]/u.test(txt), 'emoji in the legend');
      assert(await page.isVisible('[data-test=rune-legend]'));
    });

    await check('Memory mode keeps its own inscription and legend', async () => {
      await page.selectOption('[data-test=puzzle]', 'memory');
      assert(/What the sea takes, it names first/.test(await page.textContent('.tsi-pel--memory .tsi-pel-inscription')));
      assert(!(await page.isVisible('[data-test=wall]')));
      assert(await page.isVisible('.tsi-pel-legend:not(.tsi-pel-rune-legend)'));
      await page.selectOption('[data-test=puzzle]', 'tidal');
  await page.uncheck('[data-test=cine-on]'); /* the clips have their own test (pelagosi-cinematics) */
      assert(!(await page.isVisible('.tsi-pel-legend:not(.tsi-pel-rune-legend)')));
    });

    await check('after BEGIN every line is cut; Read on the First Voice makes line 1 whole', async () => {
      await begin(page);
      equal((await t(page)).lines, ['cut', 'cut', 'cut', 'cut', 'cut']);
      assert(!INSCRIPTION.test(await page.evaluate(() => document.body.textContent)), 'inscription text in the DOM after BEGIN');
      await page.click(sel('reading-read', 'tl'));
      equal(await lineText(page, 1), 'Flow follows memory.');
      equal(await lineLevel(page, 1), 'whole');
      equal(await page.textContent(sel('reading-chip', 'tl')), 'Read');
      equal(await lineLevel(page, 2), 'cut');
    });

    await check('Fragment shows the partly legible line, never goes down by itself, and Hide again undoes it', async () => {
      await page.click(sel('reading-fragment', 'tr'));
      equal(await lineLevel(page, 2), 'fragment');
      equal(await lineText(page, 2), '▒▒▒▒▒▒ seeks depth.');
      equal(await page.textContent(sel('reading-chip', 'tr')), 'Fragment');
      assert(await page.isDisabled(sel('reading-fragment', 'tr')), 'Fragment should be spent');
      await page.click(sel('reading-hide', 'tr'));
      equal(await lineLevel(page, 2), 'cut');
      equal((await lineText(page, 2)).length, 'Memory seeks depth.'.length);
      assert(!/[a-z]/i.test(await lineText(page, 2)));
      await page.click(sel('reading-read', 'tr'));
      assert(await page.isDisabled(sel('reading-fragment', 'tr')), 'a whole line cannot be dropped to a fragment by a button');
      await page.click(sel('reading-hide', 'tr'));
      await page.click(sel('reading-hide', 'tl'));
      equal((await t(page)).lines, ['cut', 'cut', 'cut', 'cut', 'cut']);
    });

    await check('Misread costs a step of pressure up to Reversing, then changes nothing and never surges', async () => {
      for (let i = 1; i <= 3; i++) {
        await page.click(sel('reading-misread', 'br'));
        equal((await t(page)).pressure, i);
      }
      equal(await page.textContent('[data-test=readings-note]'), 'The chamber hears the wrong word.');
      const before = await t(page);
      await page.click(sel('reading-misread', 'bl'));
      await page.click(sel('reading-misread', 'basin'));
      const after = await t(page);
      equal(after.pressure, 3);
      equal(after.attempts, before.attempts);
      equal(after.phase, 'outer');
      assert(!after.locked, 'must not have locked into a surge');
      assert(/wrong word/.test(await page.textContent('[data-test=status]')));
    });

    await check('the wall and legend fit with the main controls in view', async () => {
      const bad = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out = [];
        if (document.documentElement.scrollWidth > vw) out.push('sideways scroll');
        ['[data-test=check]', '[data-test=pressure]', '[data-test=pillar-rune-topLeft]', '[data-test=pillar-rune-bottomRight]', '[data-test=reading-read-tl]'].forEach(s => {
          const r = document.querySelector(s).getBoundingClientRect();
          if (r.bottom > innerHeight || r.right > vw || r.top < 0) out.push(s + ' ' + Math.round(r.bottom) + '/' + innerHeight);
        });
        return out;
      });
      equal(bad, []);
    });

    section('The rune ring (' + size + ')');
    await page.click('[data-test=reset]');
    await begin(page);

    await check('clicking a pillar rune opens the ring with nine runes; picking one sets it and closes the ring', async () => {
      await page.click(sel('pillar-rune', 'topLeft'));
      assert(await page.isVisible('[data-test=ring] button'));
      equal(await page.getAttribute('[data-test=ring]', 'role'), 'dialog');
      assert(/top-left/.test(await page.getAttribute('[data-test=ring]', 'aria-label')));
      equal(await page.$$eval('[data-test=ring] button', b => b.length), 9);
      assert(await page.evaluate(() => document.activeElement.classList.contains('tsi-pel-ring-btn')), 'focus should move into the ring');
      if (size === 'tv') {
        await H.shot(page, 'pelagosi-tidal-v2-ring-tv');
      }
      await page.click(sel('ring-rune', 'life'));
      equal(await page.getAttribute(sel('pillar-rune', 'topLeft'), 'data-rune'), 'life');
      equal((await t(page)).pillars.topLeft.runeIndex, 6);
      assert(!(await page.isVisible('[data-test=ring] button')));
      assert(await page.evaluate(() => document.activeElement.dataset.test === 'pillar-rune-topLeft'), 'focus should return to the pillar');
    });

    await check('Escape closes the ring without changing anything; so does a click elsewhere', async () => {
      await page.click(sel('pillar-rune', 'topRight'));
      assert(await page.isVisible('[data-test=ring] button'));
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Escape');
      assert(!(await page.isVisible('[data-test=ring] button')));
      equal((await t(page)).pillars.topRight.runeIndex, 5);
      await page.click(sel('pillar-rune', 'topRight'));
      assert(await page.isVisible('[data-test=ring] button'));
      await page.click('[data-test=status]');
      assert(!(await page.isVisible('[data-test=ring] button')));
      equal((await t(page)).pillars.topRight.runeIndex, 5);
      /* the same pillar button toggles it */
      await page.click(sel('pillar-rune', 'topRight'));
      await page.click(sel('pillar-rune', 'topRight'));
      assert(!(await page.isVisible('[data-test=ring] button')));
    });

    await check('Left and Right keys still step a focused pillar rune, round all nine', async () => {
      await page.focus(sel('pillar-rune', 'bottomLeft'));
      const start = (await t(page)).pillars.bottomLeft.runeIndex;
      await page.keyboard.press('ArrowRight');
      equal((await t(page)).pillars.bottomLeft.runeIndex, (start + 1) % 9);
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      equal((await t(page)).pillars.bottomLeft.runeIndex, (start + 8) % 9);
      assert(!(await page.isVisible('[data-test=ring] button')));
    });

    await check('the arrow button still rotates the direction one step', async () => {
      const start = (await t(page)).pillars.topLeft.directionIndex;
      await page.click(sel('pillar-arrow', 'topLeft'));
      equal((await t(page)).pillars.topLeft.directionIndex, (start + 1) % 4);
    });

    await check('the ring does not open once the pillars are locked (the basin step)', async () => {
      await page.click('[data-test=reset]');
      equal((await t(page)).phase, 'idle');
      assert(await page.isDisabled(sel('pillar-rune', 'topLeft')));
    });

    section('Stage Mode (' + size + ')');
    await begin(page);
    await page.click(sel('reading-read', 'tl'));
    await page.click(sel('reading-fragment', 'tr'));
    await page.click(sel('pillar-rune', 'topLeft'));
    await page.click(sel('ring-rune', 'flow'));

    await check('S hides the Readings panel and the console, and keeps the wall, stage, pillars, pips and pressure meter', async () => {
      const before = await t(page);
      await page.click('[data-test=status]');
      await page.keyboard.press('s');
      assert(await page.evaluate(() => document.querySelector('.tsi-pel').classList.contains('tsi-pel--stage')));
      for (const s of ['[data-test=reading-tl]', '[data-test=check]', '[data-test=shuffle]', '[data-test=tidal-description]', '[data-test=attempts]']) {
        assert(!(await page.isVisible(s)), s + ' should be hidden');
      }
      for (const s of ['[data-test=wall]', '[data-test=tidal-frame]', sel('pillar-rune', 'topLeft'), sel('pillar-arrow', 'bottomRight'), '.tsi-pel-tidal-pip', '[data-test=pressure]', '.tsi-pel-pressure-track']) {
        assert(await page.isVisible(s), s + ' should be shown');
      }
      equal((await t(page)).pillars, before.pillars);
      if (size === 'tv') await H.shot(page, 'pelagosi-tidal-v2-stage-tv');
    });

    await check('Enter in Stage Mode checks the alignment, and a second quick Enter counts once', async () => {
      const before = await t(page);
      await page.waitForTimeout(650);
      await page.keyboard.press('Enter');
      const after = await t(page);
      equal(after.attempts, before.attempts + 1);
      equal(after.pressure, before.pressure + 1);
      await page.keyboard.press('Enter');
      equal((await t(page)).attempts, before.attempts + 1);
    });

    await check('the exit button appears on mouse movement and fades; S toggles back with everything as it was', async () => {
      await page.mouse.move(300, 300);
      await page.mouse.move(320, 320);
      assert(await page.evaluate(() => document.querySelector('[data-test=stage-exit]').classList.contains('tsi-pel-stage-exit--on')));
      await page.waitForFunction(() => !document.querySelector('[data-test=stage-exit]').classList.contains('tsi-pel-stage-exit--on'), null, { timeout: 5000 });
      equal((await page.evaluate(() => TSI.pelagosi.debug.timers())).ui, { timeouts: 0, frames: 0 });
      await page.keyboard.press('S');
      assert(!(await page.evaluate(() => document.querySelector('.tsi-pel').classList.contains('tsi-pel--stage'))));
      assert(await page.isVisible('[data-test=reading-tl]') && await page.isVisible('[data-test=check]'));
      const s = await t(page);
      equal(s.lines, ['whole', 'fragment', 'cut', 'cut', 'cut']);
      equal(s.pillars.topLeft.runeIndex, 0);
      equal(await lineText(page, 1), 'Flow follows memory.');
    });

    await check('the Stage Mode button and the exit button also work; typing and pop-ups do not trigger the keys', async () => {
      await page.click('[data-test=stage-mode]');
      assert(await page.evaluate(() => document.querySelector('.tsi-pel').classList.contains('tsi-pel--stage')));
      await page.focus('[data-test=stage-exit]');
      await page.keyboard.press('Enter');
      assert(!(await page.evaluate(() => document.querySelector('.tsi-pel').classList.contains('tsi-pel--stage'))));
      await page.focus('[data-test=puzzle]');
      await page.keyboard.press('s');
      assert(!(await page.evaluate(() => document.querySelector('.tsi-pel').classList.contains('tsi-pel--stage'))), 'S while a drop-down has focus');
      await page.click('[data-test=begin]');
      await page.waitForSelector('.tsi-modal');
      await page.keyboard.press('s');
      assert(!(await page.evaluate(() => document.querySelector('.tsi-pel').classList.contains('tsi-pel--stage'))), 'S with a pop-up open');
      await H.clickModal(page, 'Not Yet');
    });

    if (size === 'tv') {
      await check('screenshot: a mix of cut, fragment and whole lines', async () => {
        await page.click(sel('reading-read', 'br'));
        await page.click(sel('reading-fragment', 'bl'));
        await page.click(sel('pillar-rune', 'bottomRight'));
        await H.shot(page, 'pelagosi-tidal-v2-wall-ring-tv');
        await page.keyboard.press('Escape');
      });
    }

    await check('nothing from the internet, no missing files, no errors', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
    });
    await context.close();
  }

  section('Shutting down and reduced motion');
  {
    const { context, page } = await open(browser, 'laptop');
    await check('closing the tool leaves no timers, listeners or sounds, even from Stage Mode', async () => {
      await begin(page);
      await page.click(sel('reading-read', 'tl'));
      await page.keyboard.press('s');
      await page.mouse.move(200, 200);
      await page.mouse.move(210, 215);
      await page.click(sel('pillar-rune', 'topLeft')).catch(() => {});
      await page.evaluate(() => TSI.shell.stopTool());
      equal(await page.evaluate(() => TSI.shell.current().life.counts()), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
      /* the S key does nothing once the tool has gone */
      await page.keyboard.press('s');
    });
    await context.close();
  }
  {
    const { context, page } = await open(browser, 'laptop', { reducedMotion: 'reduce' });
    await check('with reduced motion the ring and the wall reveal do not animate', async () => {
      await begin(page);
      await page.click(sel('reading-read', 'tl'));
      equal(await page.$eval('[data-test=wall-line-1]', e => getComputedStyle(e).animationName), 'none');
      await page.click(sel('pillar-rune', 'topLeft'));
      equal(await page.$eval('[data-test=ring]', e => getComputedStyle(e, '::before').animationName), 'none');
      assert(await page.isVisible(sel('ring-rune', 'tide')));
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
