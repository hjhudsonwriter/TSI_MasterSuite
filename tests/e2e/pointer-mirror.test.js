/* The DM's cursor on the players' screens (29 October 2026): over the Explorer's map, the Bastion's painting and the Tidal
   chamber, the players' window draws a small gold arrow at the same place on the picture (as a fraction of it, so it holds on
   any screen shape and any zoom), a ring on a click, and nothing when the pointer leaves or the DM switches it off.
   Run:  node tests/e2e/pointer-mirror.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const URL = tool => H.fileUrl('index.html') + '?tool=' + tool;
const box = (page, sel) => page.$eval(sel, n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const tip = pv => pv.evaluate(() => { const c = document.querySelector('.tsi-pm-cursor'); if (!c || c.hidden) return null; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y }; });
const frac = (b, p) => ({ x: (p.x - b.x) / b.w, y: (p.y - b.y) / b.h });
function near(a, b, msg) { assert(a && b && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01, (msg || 'same place') + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)); }

async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected', null, { timeout: 8000 });
  return pv;
}

/* Run the same checks for one tool: dmSel is the picture on the DM's screen, pvSel the same picture on the TV. */
async function mirrorChecks(page, pv, dmSel, pvSel, label) {
  await check(label + ': the arrow appears on the TV at the same place on the picture', async () => {
    const b = await box(page, dmSel);
    const at = { x: b.x + b.w * 0.62, y: b.y + b.h * 0.4 };
    await page.mouse.move(at.x - 30, at.y - 30);
    await page.mouse.move(at.x, at.y, { steps: 6 });
    await pv.waitForFunction(() => { const c = document.querySelector('.tsi-pm-cursor'); return c && !c.hidden; }, null, { timeout: 4000 });
    await page.waitForTimeout(150);
    near(frac(await box(pv, pvSel), await tip(pv)), frac(b, at));
  });
  await check(label + ': a fast sweep ends exactly where the DM\'s pointer stopped (nothing is left behind)', async () => {
    const b = await box(page, dmSel);
    for (let i = 0; i < 30; i++) await page.mouse.move(b.x + b.w * (0.2 + i * 0.02), b.y + b.h * 0.7);
    await page.waitForTimeout(200);
    near(frac(await box(pv, pvSel), await tip(pv)), { x: (b.w * (0.2 + 29 * 0.02)) / b.w, y: 0.7 });
  });
  await check(label + ': a click shows a ring', async () => {
    await page.mouse.down();
    await pv.waitForFunction(() => document.querySelector('.tsi-pm-ring.is-on'), null, { timeout: 2000 });
    await page.mouse.up();
  });
  await check(label + ': it is only a picture: nothing to click or focus, and the pointer passes through it', async () => {
    equal(await pv.evaluate(() => getComputedStyle(document.querySelector('.tsi-pm-cursor')).pointerEvents), 'none');
    equal(await pv.$$eval('.tsi-pm-cursor button, .tsi-pm-cursor a, .tsi-pm-cursor [tabindex]', n => n.length), 0);
    const w = await pv.$eval('.tsi-pm-arrow', n => n.getBoundingClientRect().width);
    assert(w >= 18, 'arrow width ' + w);
  });
  await check(label + ': it goes when the pointer leaves the picture', async () => {
    await page.mouse.move(2, 400);
    await pv.waitForFunction(() => document.querySelector('.tsi-pm-cursor').hidden, null, { timeout: 3000 });
  });
  await check(label + ': "Show my cursor to players" off means no arrow, and on brings it back', async () => {
    await page.uncheck('[data-test=cursor-on]');
    const b = await box(page, dmSel);
    await page.mouse.move(b.x + b.w * 0.3, b.y + b.h * 0.3);
    await page.mouse.move(b.x + b.w * 0.35, b.y + b.h * 0.35);
    await page.waitForTimeout(300);
    equal(await pv.evaluate(() => document.querySelector('.tsi-pm-cursor').hidden), true);
    await page.check('[data-test=cursor-on]');
    await page.mouse.move(b.x + b.w * 0.4, b.y + b.h * 0.4);
    await pv.waitForFunction(() => !document.querySelector('.tsi-pm-cursor').hidden, null, { timeout: 3000 });
    await page.mouse.move(2, 400);
  });
}

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The DM\'s cursor on the Explorer\'s Player View (' + name + ')');
    {
      const context = await H.newContext(browser, name);
      await context.setOffline(true);
      const page = await context.newPage();
      await page.goto(URL('explorer'));
      await page.waitForSelector('[data-test=camp]');
      await page.selectOption('[data-test=map-select]', 'the_east_isle');
      await page.click('[data-test=load]');
      await page.waitForTimeout(300);
      const pv = await openPlayer(page, size);
      await pv.waitForFunction(() => [...document.images].every(i => i.complete));
      await mirrorChecks(page, pv, '.tsi-exp-map', '.tsi-xpv-map', 'Explorer');
      await check('Explorer: still in the right place when the DM has zoomed in', async () => {
        await page.click('[data-test=zoom-in]');
        await page.click('[data-test=zoom-in]');
        await page.waitForTimeout(900);
        const b = await box(page, '.tsi-exp-map');
        const stage = await box(page, '.tsi-exp-stage');
        const at = { x: stage.x + stage.w * 0.5, y: stage.y + stage.h * 0.5 };
        await page.mouse.move(at.x - 20, at.y);
        await page.mouse.move(at.x, at.y, { steps: 4 });
        await pv.waitForFunction(() => { const c = document.querySelector('.tsi-pm-cursor'); return c && !c.hidden; }, null, { timeout: 3000 });
        await page.waitForTimeout(1200);
        near(frac(await box(pv, '.tsi-xpv-map'), await tip(pv)), frac(await box(page, '.tsi-exp-map'), at), 'zoomed');
      });
      await check('no errors on the way', async () => { equal(context.log.errors, []); equal(context.log.consoleErrors, []); });
      await context.close();
    }

    section('The DM\'s cursor on the Bastion\'s Player View (' + name + ')');
    {
      const context = await H.newContext(browser, name);
      await context.setOffline(true);
      const page = await context.newPage();
      await page.goto(URL('bastion'));
      await page.waitForSelector('[data-test=map]');
      await page.waitForTimeout(400);
      const pv = await openPlayer(page, size);
      await pv.waitForFunction(() => [...document.images].every(i => i.complete));
      await mirrorChecks(page, pv, '[data-test=map]', '.tsi-bpv-map__img', 'Bastion');
      await check('no errors on the way', async () => { equal(context.log.errors, []); equal(context.log.consoleErrors, []); });
      await context.close();
    }

    section('The DM\'s cursor on the Tidal Sequence\'s Player View (' + name + ')');
    {
      const context = await H.newContext(browser, name);
      await context.setOffline(true);
      const page = await context.newPage();
      await page.goto(URL('pelagosi'));
      await page.waitForSelector('[data-test=rune-anchor]');
      await page.selectOption('[data-test=puzzle]', 'tidal');
      await page.uncheck('[data-test=cine-on]');
      const pv = await openPlayer(page, size);
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-pel-pillar').length === 4);
      await mirrorChecks(page, pv, '[data-test=tidal-frame]', '[data-test=pv-tidal-frame]', 'Tidal chamber');
      await check('no errors on the way', async () => { equal(context.log.errors, []); equal(context.log.consoleErrors, []); });
      await context.close();
    }
  }

  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
