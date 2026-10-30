/* Explorer: the DM's settings are saved with the Explorer and travel in a backup (30 October 2026): sound on and volume, the voice
   lines playing by themselves, Click to move, and the three "show to the players" tick boxes.
   Run:  node tests/e2e/explorer-prefs.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const prefs = page => page.evaluate(() => TSI.explorer.debug.prefs());

(async () => {
  const browser = await H.chromium.launch();
  for (const [name] of [['laptop'], ['tv']]) {
    section('Settings at ' + name);
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');

    await check('a fresh Explorer starts with the usual settings', async () => {
      equal(await prefs(page), { sfxOn: true, sfxVolume: 0.8, autoplayVoice: true, clickMove: true, showCursor: true, showReach: true, showTerrain: false });
      equal(await page.isChecked('[data-test=cursor-on]'), true);
      equal(await page.isChecked('[data-test=reach-on]'), true);
      equal(await page.isChecked('[data-test=terrain-show]'), false);
    });

    await check('changing the tick boxes, Click to move and the sound settings is remembered after a reload', async () => {
      await page.uncheck('[data-test=cursor-on]');
      await page.uncheck('[data-test=reach-on]');
      await page.check('[data-test=terrain-show]');
      await page.click('[data-test=click-move]');
      await page.click('[data-test=sfx-toggle]');
      await page.fill('[data-test=sfx-volume]', '0.4');
      await page.dispatchEvent('[data-test=sfx-volume]', 'input');
      await page.uncheck('[data-test=sfx-on]');
      await page.waitForTimeout(300);
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      equal(await prefs(page), { sfxOn: false, sfxVolume: 0.4, autoplayVoice: true, clickMove: false, showCursor: false, showReach: false, showTerrain: true });
      equal(await page.isChecked('[data-test=cursor-on]'), false);
      equal(await page.isChecked('[data-test=reach-on]'), false);
      equal(await page.isChecked('[data-test=terrain-show]'), true);
      assert((await page.textContent('[data-test=click-move]')).includes('Off'), 'Click to move is still off');
    });

    await check('the settings are an item of the Explorer\'s save, so an Export, a campaign file and Back up everything hold them', async () => {
      const keys = await page.evaluate(async () => {
        await TSI.store.flush();
        const rules = TSI.backupRules;
        const campaign = rules.makeCampaignBackup(TSI.store.records('explorer'), new Date(), TSI.space);
        const suite = rules.makeSuiteBackup(await TSI.store.freshAll(), new Date(), TSI.space);
        return { campaign: campaign.records.map(r => r.key), suite: suite.records.map(r => r.key) };
      });
      assert(keys.campaign.includes('tsi.explorer.prefs'), keys.campaign.join());
      assert(keys.suite.includes('tsi.explorer.prefs'), keys.suite.join());
    });

    await check('a file from before this change (no settings in it) is fine: the usual settings come back', async () => {
      await page.evaluate(async () => { TSI.store.remove('tsi.explorer.prefs'); await TSI.store.flush(); });
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      equal(await prefs(page), { sfxOn: true, sfxVolume: 0.8, autoplayVoice: true, clickMove: true, showCursor: true, showReach: true, showTerrain: false });
    });

    await check('a setting kept the old way (the browser\'s small storage) is picked up once', async () => {
      await page.evaluate(async () => {
        TSI.store.remove('tsi.explorer.prefs'); await TSI.store.flush();
        localStorage.setItem('tsi.explorer.sfx', JSON.stringify({ on: false, volume: 0.25 }));
        localStorage.setItem('tsi.explorer.autoplayVoice', '0');
      });
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      const p = await prefs(page);
      equal([p.sfxOn, p.sfxVolume, p.autoplayVoice], [false, 0.25, false]);
    });

    await check('nothing failed', async () => {
      equal(context.log.errors, []);
    });
    await context.close();
  }
  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
