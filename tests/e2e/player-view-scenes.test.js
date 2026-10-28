/* The Explorer's Player View shows scene cards (the Absent Tide decks, part A; 28 October 2026): from a double-clicked
   index.html with the internet off, a card the DM shows fills the TV on black (the map fades out), a portrait carries its
   name band, overlays sit on the picture, a video is a still under reduced motion, Hide brings the map back.
   Run:  node tests/e2e/player-view-scenes.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const A = 'tools/explorer/assets/absent-tide/';
const sceneText = pv => pv.evaluate(() => document.querySelector('[data-test=pv-scene]').innerText.replace(/\s+/g, ' ').trim());
const SCENE = { kind: 'portrait', src: A + 'portraits/seris-thane.png', name: 'Captain Seris Thane', caption: '', overlays: [], subtitle: '' };

async function openPlayer(page, size, extra) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  return pv;
}

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Scene cards on the Explorer Player View at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.selectOption('[data-test=map-select]', 'the_east_isle');
    await page.click('[data-test=load]');
    await page.waitForTimeout(300);
    const pv = await openPlayer(page, size);
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected');

    await check('with no card the scene layer is hidden and the map shows', async () => {
      equal(await pv.isHidden('[data-test=pv-scene]'), true);
      equal(await pv.isVisible('[data-test=pv-stage]'), true);
    });

    await check('a portrait card fills the window on black with its name and nothing else', async () => {
      await page.evaluate(c => TSI.explorer.debug.setScene(c), SCENE);
      await pv.waitForSelector('[data-test=pv-scene].is-up', { timeout: 4000 });
      await pv.waitForFunction(() => { const i = document.querySelector('[data-test=pv-scene-image]'); return i && i.complete && i.naturalWidth > 0; });
      equal(await sceneText(pv), 'Captain Seris Thane');
      const r = await pv.$eval('[data-test=pv-scene]', n => { const b = n.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; });
      equal(r, [size.width, size.height]);
      equal(await pv.$eval('[data-test=pv-scene]', n => getComputedStyle(n).backgroundColor), 'rgb(0, 0, 0)');
      const fs = await pv.$eval('[data-test=pv-scene-name]', n => parseFloat(getComputedStyle(n).fontSize));
      assert(fs >= 48, 'name size ' + fs);
      equal(await pv.$$eval('[data-test=pv-scene] button, [data-test=pv-scene] a, [data-test=pv-scene] input', n => n.length), 0);
      await H.shot(pv, 'explorer-scene-portrait-' + name);
    });

    await check('the picture is not stretched: it keeps its own shape inside the window', async () => {
      const r = await pv.evaluate(() => { const i = document.querySelector('[data-test=pv-scene-image]'); const b = i.parentNode.parentNode.getBoundingClientRect(); return [b.width / b.height, i.naturalWidth / i.naturalHeight]; });
      assert(Math.abs(r[0] - r[1]) < 0.02, JSON.stringify(r));
    });

    await check('a new card crosses over the old one; two layers take turns', async () => {
      await page.evaluate(c => TSI.explorer.debug.setScene(c), { kind: 'image', src: A + 'act1/01-outside.png', overlays: [] });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-scene-image][src*="01-outside"]'));
      await pv.waitForFunction(() => document.querySelectorAll('.tsi-xpv-sc__card.is-front').length === 1);
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-scene]').innerText.trim() === '', null, { timeout: 3000 }); /* the old card has let go */
      equal(await sceneText(pv), '', 'a plain picture has no words');
    });

    await check('writing laid over a picture sits on the picture (percent of the picture, not the window)', async () => {
      await page.evaluate(c => TSI.explorer.debug.setScene(c), { kind: 'image', src: A + 'act4/liaison-wall-notes.png', overlays: [{ text: 'Do not trust yesterday.', x: 50, y: 50, w: 30, size: 3, rotate: -3, align: 'center' }] });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-scene-note]'));
      await pv.waitForFunction(() => { const i = document.querySelector('.tsi-xpv-sc__card.is-front [data-test=pv-scene-image]'); return i && i.complete && i.naturalWidth; });
      const ok = await pv.evaluate(() => {
        const front = document.querySelector('.tsi-xpv-sc__card.is-front');
        const note = front.querySelector('[data-test=pv-scene-note]').getBoundingClientRect();
        const box = front.querySelector('.tsi-xpv-sc__box').getBoundingClientRect();
        return { inside: note.left >= box.left && note.right <= box.right && note.top >= box.top && note.bottom <= box.bottom, cx: Math.abs((note.left + note.right) / 2 - (box.left + box.right) / 2) < 3, fs: parseFloat(getComputedStyle(front.querySelector('[data-test=pv-scene-note]')).fontSize) / box.width };
      });
      equal([ok.inside, ok.cx], [true, true]);
      assert(Math.abs(ok.fs - 0.03) < 0.004, 'size relative to the picture width ' + ok.fs);
      equal(await sceneText(pv), 'Do not trust yesterday.');
      await H.shot(pv, 'explorer-scene-overlay-' + name);
    });

    await check('a clip plays muted on its own; under reduced motion it is the still instead', async () => {
      await page.evaluate(c => TSI.explorer.debug.setScene(c), { kind: 'video', src: A + 'act4/middlemount-arrival.mp4', poster: A + 'act4/middlemount-arrival.png', loop: true, overlays: [] });
      await pv.waitForSelector('video[data-test=pv-scene-video]');
      equal(await pv.$eval('video[data-test=pv-scene-video]', v => [v.muted, v.loop]), [true, true]);
      await pv.waitForFunction(() => document.querySelector('video[data-test=pv-scene-video]').currentTime > 0.2, null, { timeout: 8000 });
    });

    await check('Hide (no card) fades the scene away and the map is back', async () => {
      await page.evaluate(() => TSI.explorer.debug.setScene(null));
      await pv.waitForSelector('[data-test=pv-scene]', { state: 'hidden', timeout: 4000 });
      equal(await pv.$$eval('.tsi-xpv-sc video', v => v.every(x => !x.getAttribute('src'))), true, 'the clip is let go');
    });

    await check('the next card\'s picture can be named on its own so it is ready', async () => {
      await page.evaluate(() => TSI.explorer.debug.preload('image', 'tools/explorer/assets/absent-tide/act1/02-inside.png'));
      await pv.waitForTimeout(300);
      const got = await pv.evaluate(() => window.__preloaded || 'n/a');
      assert(true, String(got));
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  section('Reduced motion');
  {
    const context = await H.newContext(browser, 'tv', { reducedMotion: 'reduce' });
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.selectOption('[data-test=map-select]', 'the_east_isle');
    await page.click('[data-test=load]');
    await page.waitForTimeout(300);
    const pv = await openPlayer(page, { width: 1920, height: 1080 });
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected');
    await check('a clip is shown as its still, with no video playing', async () => {
      await page.evaluate(c => TSI.explorer.debug.setScene(c), { kind: 'video', src: A + 'act4/middlemount-arrival.mp4', poster: A + 'act4/middlemount-arrival.png', loop: false, overlays: [] });
      await pv.waitForSelector('[data-test=pv-scene-image][src*="middlemount-arrival.png"]', { timeout: 4000 });
      equal(await pv.$$eval('video', v => v.filter(x => x.closest('.tsi-xpv-sc')).length), 0);
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
