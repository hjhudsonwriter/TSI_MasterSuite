/* The Bastion's base painting as a loop (28 October 2026): Harry's short film of the same painting plays over the still, muted,
   on repeat, in the DM's Bastion and in its Player View. The still stays under it; a missing loop or "reduce motion" leaves
   the painting exactly as it was. Run:  node tests/e2e/bastion-map-loop.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const BASTION = H.fileUrl('index.html') + '?tool=bastion';
const rect = (page, sel) => page.$eval(sel, n => { const r = n.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; });

async function openDm(browser, name, extra, routes) {
  const context = await H.newContext(browser, name, extra);
  await context.setOffline(true);
  (routes || []).forEach(r => context.route(r, route => route.abort()));
  const page = await context.newPage();
  await page.goto(BASTION);
  await page.waitForSelector('[data-test=map]');
  await page.waitForTimeout(400);
  return { context, page };
}
async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  return pv;
}

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The Bastion map loop (' + name + ', internet off)');
    const { context, page } = await openDm(browser, name);

    await check('the loop plays over the painting: muted, on repeat, really moving, exactly the painting\'s size', async () => {
      await page.waitForFunction(() => { const v = document.querySelector('[data-test=map-loop]'); return v && !v.hidden && v.currentTime > 0.4; }, null, { timeout: 10000 });
      equal(await page.$eval('[data-test=map-loop]', v => [v.muted, v.loop, v.paused]), [true, true, false]);
      equal(await rect(page, '[data-test=map-loop]'), await rect(page, '[data-test=map]'));
      await H.shot(page, 'bastion-loop-dm-' + name);
    });

    await check('the loop really repeats: its time runs round to the start again', async () => {
      const wrapped = await page.evaluate(() => new Promise(resolve => {
        const v = document.querySelector('[data-test=map-loop]');
        let last = v.currentTime, plays = 0;
        const iv = setInterval(() => { if (v.currentTime < last - 1) { clearInterval(iv); resolve(true); } last = v.currentTime; if (++plays > 120) { clearInterval(iv); resolve(false); } }, 100);
      }));
      equal(wrapped, true);
      equal(await page.$eval('[data-test=map-loop]', v => v.paused), false);
    });

    await check('the facility pictures and the painting still line up (the loop is the painting\'s own shape)', async () => {
      const v = await page.$eval('[data-test=map-loop]', n => [n.videoWidth, n.videoHeight]);
      assert(Math.abs(v[0] / v[1] - 3000 / 1250) < 0.02, 'loop shape ' + v);
      equal(await rect(page, '[data-test=map-overlays]'), await rect(page, '[data-test=map]'));
    });

    await check('the Player View shows the same loop under its pictures', async () => {
      const pv = await openPlayer(page, size);
      await pv.waitForFunction(() => { const v = document.querySelector('[data-test=pv-map] video'); return v && !v.hidden && v.currentTime > 0.3; }, null, { timeout: 10000 });
      equal(await pv.$eval('[data-test=pv-map] video', v => [v.muted, v.loop]), [true, true]);
      equal(await rect(pv, '[data-test=pv-map] video'), await rect(pv, '[data-test=pv-map] .tsi-bpv-map__img'));
      await H.shot(pv, 'bastion-loop-pv-' + name);
    });

    await check('closing the Bastion stops the film', async () => {
      await page.goto(H.fileUrl('index.html'));
      await page.waitForTimeout(300);
      equal(await page.$('[data-test=map-loop]'), null);
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  section('The still is the fallback');
  {
    const { context, page } = await openDm(browser, 'laptop', undefined, [/bastion_base_loop\.mp4/]);
    await check('with the loop missing the painting shows as before and nothing throws', async () => {
      await page.waitForTimeout(1200);
      equal(await page.$eval('[data-test=map-loop]', v => v.hidden), true);
      equal(await page.$eval('[data-test=map]', i => i.complete && i.naturalWidth > 0), true);
      equal(context.log.errors, []);
    });
    await context.close();
  }
  {
    const { context, page } = await openDm(browser, 'laptop', { reducedMotion: 'reduce' });
    await check('with "reduce motion" there is no film at all, only the painting', async () => {
      equal(await page.$('[data-test=map-loop]'), null);
      equal(await page.$eval('[data-test=map]', i => i.complete && i.naturalWidth > 0), true);
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
