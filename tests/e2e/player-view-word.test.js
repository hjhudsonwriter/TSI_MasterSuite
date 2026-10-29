/* "The Ironbow sends word…" on the Explorer's Player View (29 October 2026): while the DM's pop-up is open the TV shows the same
   days and lines, read only; it goes when the pop-up closes. Run:  node tests/e2e/player-view-word.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const NEWS = [{ day: 4, lines: ['A cart of timber reaches the Dock.', 'The Weavers’ Hall finishes a bolt of cloth.'] }];

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The Ironbow’s word on the Player View at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.selectOption('[data-test=map-select]', 'the_east_isle');
    await page.click('[data-test=load]');
    await page.waitForTimeout(300);
    const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
    await pv.setViewportSize(size);
    await pv.waitForSelector('[data-test=pv-stage]');
    await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected');

    await check('with no pop-up the TV shows no word', async () => {
      equal(await pv.isHidden('[data-test=pv-word-host]'), true);
    });

    await check('the word appears on the TV with the same lines as the DM’s pop-up, and not its note about the Bastion', async () => {
      page.evaluate(n => TSI.explorer.debug.showWord(n), NEWS);
      await page.waitForSelector('[data-test=ironbow-word]');
      await pv.waitForSelector('[data-test=pv-word]', { timeout: 4000 });
      equal(await pv.$$eval('[data-test=pv-word-lines] li', l => l.map(x => x.textContent)), NEWS[0].lines);
      equal(await pv.textContent('[data-test=pv-word-title]'), 'The Ironbow sends word…');
      assert(!/Bastion works these out/.test(await pv.evaluate(() => document.body.innerText)), 'the DM’s note must stay with the DM');
      equal(await pv.$$eval('[data-test=pv-word-host] button, [data-test=pv-word-host] a, [data-test=pv-word-host] input', n => n.length), 0, 'nothing to click');
      const fs = await pv.$eval('[data-test=pv-word-lines] li', n => parseFloat(getComputedStyle(n).fontSize));
      assert(fs >= 24, 'readable from the room: ' + fs + 'px');
      await H.shot(pv, 'explorer-word-' + name);
    });

    await check('closing the DM’s pop-up takes it off the TV', async () => {
      await page.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary');
      await pv.waitForSelector('[data-test=pv-word-host]', { state: 'hidden', timeout: 4000 });
    });

    await check('several days are each headed, and Esc closes it too', async () => {
      page.evaluate(() => TSI.explorer.debug.showWord([{ day: 5, lines: ['One.'] }, { day: 6, lines: ['Two.'] }]));
      await pv.waitForSelector('[data-test=pv-word]');
      equal(await pv.$$eval('.tsi-xpv-word__day', d => d.map(x => x.textContent)), ['Day 5', 'Day 6']);
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-word-host]', { state: 'hidden', timeout: 4000 });
    });

    await check('a refreshed players’ window shows it again while the pop-up is open', async () => {
      page.evaluate(n => TSI.explorer.debug.showWord(n), NEWS);
      await pv.waitForSelector('[data-test=pv-word]');
      await pv.reload();
      await pv.waitForSelector('[data-test=pv-word]', { timeout: 8000 });
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-word-host]', { state: 'hidden', timeout: 4000 });
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
})().catch(err => { console.error(err); process.exit(2); });
