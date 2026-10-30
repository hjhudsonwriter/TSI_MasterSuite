/* Explorer: sound effects (30 October 2026). Footsteps while heroes move, the campfire at Make Camp (and through a campfire event),
   rain and storm while that weather lasts, the wing flap and raven together when the Ironbow sends word; all from the DM window, with an on/off and a volume.
   These use Harry's real sound files in tools/explorer/assets/sfx/.
   Run:  node tests/e2e/explorer-sfx.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const sfx = page => page.evaluate(() => TSI.explorer.debug.sfx());
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const change = (page, fn) => page.evaluate(src => TSI.explorer.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const until = (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 5000 });
const playing = name => (n => TSI.explorer.debug.sfx()[n].playing);

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Sound effects at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    /* No random camp or weather event on the night: the dice always roll high. */
    await context.addInitScript(() => { Math.random = () => 0.99; });
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.selectOption('[data-test=map-select]', 'the_east_isle');
    await page.click('[data-test=load]');
    await page.waitForTimeout(300);
    await change(page, s => { s.travel.travelEventDay = s.travel.day; s.snap.enabled = true; });

    await check('the Sound panel lists the six clips, all ready, and a group for the Ironbow\'s message; a missing file says so', async () => {
      await page.evaluate(() => { TSI_DATA.explorerSfx.sounds.rain.file = 'not-there.mp3'; });
      await page.click('[data-test=sfx-toggle]');
      await page.waitForSelector('[data-test=sfx-panel]', { state: 'visible' });
      for (const n of ['footsteps', 'campfire', 'rain', 'storm', 'wingflap', 'raven']) {
        await page.waitForFunction(n => document.querySelector('[data-test=sfx-status-' + n + ']').textContent !== 'checking…', n, { timeout: 5000 });
        equal(await page.textContent('[data-test=sfx-status-' + n + ']'), n === 'rain' ? 'file missing' : 'ready', n);
      }
      assert(await page.isVisible('[data-test=sfx-test-word]'));
      await page.click('[data-test=sfx-test-rain]');
      await page.click('[data-test=sfx-close]');
      await page.evaluate(() => { TSI_DATA.explorerSfx.sounds.rain.file = 'rain.mp3'; });
    });

    /* After a reload, so the one we pointed at a missing file is forgotten. */
    await page.reload();
    await page.waitForSelector('[data-test=camp]');
    await change(page, s => { s.travel.travelEventDay = s.travel.day; s.snap.enabled = true; });

    await check('footsteps play while a hero is dragged, and stop soon after it stops', async () => {
      equal((await sfx(page)).footsteps.playing, false);
      const id = (await st(page)).tokens[0].id;
      const at = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), id);
      const to = await page.evaluate(() => TSI.explorer.debug.hexScreen(6, 6));
      await page.mouse.move(at.x, at.y); await page.mouse.down();
      await page.mouse.move((at.x + to.x) / 2, (at.y + to.y) / 2, { steps: 5 });
      await until(page, playing('footsteps'), 'footsteps');
      await page.mouse.move(to.x, to.y, { steps: 5 });
      await page.mouse.up();
      await until(page, n => !TSI.explorer.debug.sfx()[n].playing, 'footsteps');
    });

    await check('footsteps play through a click-to-move walk and stop when it ends', async () => {
      await change(page, s => { s.tokens.forEach(t => { t.milesUsed = 0; }); });
      const id = (await st(page)).tokens[0].id;
      const at = await page.evaluate(id => TSI.explorer.debug.tokenScreen(id), id);
      await page.mouse.click(at.x, at.y);
      const hx = await page.evaluate(id => { const R = TSI.explorer.rules, s = TSI.explorer.debug.state(); const t = R.token(s, id); return R.tokenHex(s, R.board(R.aspect(s, TSI_DATA.explorer)), t); }, id);
      const dest = await page.evaluate(h => TSI.explorer.debug.hexScreen(h.q + 3, h.r), hx);
      await page.mouse.click(dest.x, dest.y);
      await until(page, () => !!TSI.explorer.debug.walking(), null);
      await until(page, playing('footsteps'), 'footsteps');
      await until(page, () => !TSI.explorer.debug.walking(), null, 8000);
      await until(page, n => !TSI.explorer.debug.sfx()[n].playing, 'footsteps');
    });

    await check('nothing plays while heroes stand still', async () => {
      await page.waitForTimeout(600);
      const s = await sfx(page);
      for (const n of Object.keys(s)) equal(s[n].playing, false, n);
    });

    await check('Make Camp plays the campfire through the fade, then it stops', async () => {
      await page.click('[data-test=camp]');
      await until(page, playing('campfire'), 'campfire');
      await page.evaluate(() => { document.querySelectorAll('.tsi-modal__foot button').forEach(b => b.click()); });
      await until(page, n => !TSI.explorer.debug.sfx()[n].playing, 'campfire', 9000);
    });

    await check('a campfire event keeps the campfire on until the event is finished', async () => {
      await page.evaluate(() => { document.querySelectorAll('.tsi-modal__foot button').forEach(b => b.click()); });
      await change(page, s => { s.journey.current = null; });
      await page.evaluate(() => TSI.explorer.debug.startEvent('c1'));
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await until(page, playing('campfire'), 'campfire');
      await page.waitForTimeout(4500);
      equal((await sfx(page)).campfire.playing, true, 'still on after the fade time, the event is open');
      await page.click('.tsi-modal.tsi-exp-journey [data-test=skip-event]');
      await page.waitForTimeout(300);
      const b = await page.$('.tsi-modal__foot button:last-child');
      if (b) await b.click().catch(() => {});
      await until(page, n => !TSI.explorer.debug.sfx()[n].playing, 'campfire', 6000);
    });

    await check('rain loops while rain weather lasts; storm swaps it for the storm; clearing the weather stops it', async () => {
      await change(page, s => { s.journey.current = null; s.travel.activeWeather = { kind: 'rain', day: s.travel.day }; });
      await until(page, playing('rain'), 'rain');
      equal((await sfx(page)).storm.playing, false);
      await change(page, s => { s.travel.activeWeather = { kind: 'storm', day: s.travel.day }; });
      await until(page, playing('storm'), 'storm');
      await until(page, n => !TSI.explorer.debug.sfx()[n].playing, 'rain');
      await change(page, s => { s.travel.activeWeather = { kind: 'blizzard', day: s.travel.day }; });
      await until(page, n => !TSI.explorer.debug.sfx()[n].playing && !TSI.explorer.debug.sfx().rain.playing, 'storm');
    });

    await check('the wing flap and the raven\'s caw start together when "The Ironbow sends word" opens', async () => {
      await page.evaluate(() => { TSI.explorer.debug.showWord([{ day: 1, lines: ['A raven brings word from the Ironbow.'] }]); });
      await until(page, () => { const s = TSI.explorer.debug.sfx(); return s.wingflap.playing && s.raven.playing; }, null);
      const s = await sfx(page);
      assert(/wing-flap\.mp3$/.test(s.wingflap.src) && /raven\.mp3$/.test(s.raven.src), s.wingflap.src + ' ' + s.raven.src);
      assert(Math.abs(s.wingflap.time - s.raven.time) < 0.5, 'started within half a second of each other: ' + s.wingflap.time + ' vs ' + s.raven.time);
      await page.waitForSelector('[data-test=ironbow-word]');
      await page.evaluate(() => { document.querySelectorAll('.tsi-modal__foot button').forEach(b => b.click()); });
      await until(page, () => { const s = TSI.explorer.debug.sfx(); return !s.wingflap.playing && !s.raven.playing; }, null, 8000);
    });

    await check('sound off silences everything and is remembered; the volume sets how loud, and is remembered', async () => {
      await page.click('[data-test=sfx-toggle]');
      await change(page, s => { s.travel.activeWeather = { kind: 'rain', day: s.travel.day }; });
      await until(page, playing('rain'), 'rain');
      await page.fill('[data-test=sfx-volume]', '0.5');
      await page.dispatchEvent('[data-test=sfx-volume]', 'input');
      await until(page, () => Math.abs(TSI.explorer.debug.sfx().rain.volume - 0.25) < 0.01, null);
      await page.uncheck('[data-test=sfx-on]');
      await until(page, n => !TSI.explorer.debug.sfx()[n].playing, 'rain');
      equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tsi.explorer.sfx'))), { on: false, volume: 0.5 });
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      equal(await page.evaluate(() => TSI.explorer.debug.sfxSettings()), { on: false, volume: 0.5 });
      await page.evaluate(() => localStorage.removeItem('tsi.explorer.sfx'));
    });

    await check('the Sound panel and the terrain brush take turns on the map; nothing sideways', async () => {
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      await page.click('[data-test=sfx-toggle]');
      assert(await page.isVisible('[data-test=sfx-panel]'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sideways scroll');
      const z = await page.evaluate(() => { const r = document.querySelector('.tsi-exp-zoombox').getBoundingClientRect(); const s = document.querySelector('.tsi-exp-stage').getBoundingClientRect(); return r.bottom <= s.bottom + 1 && r.right <= s.right + 1; });
      assert(z, 'the toolbar is inside the map area');
    });
    await context.close();
  }
  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
