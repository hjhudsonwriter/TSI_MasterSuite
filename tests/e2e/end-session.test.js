/* End session (2 November 2026): one click makes a snapshot and a named backup of everything, then reminds the DM to copy the file
   off the laptop. Run:  node tests/e2e/end-session.test.js */
'use strict';

const fs = require('fs');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const HOME = H.fileUrl('index.html');

(async () => {
  const browser = await H.chromium.launch();
  for (const [name] of [['laptop'], ['tv']]) {
    section('End session at ' + name);
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(HOME + '?tool=explorer');
    await page.waitForSelector('[data-test=camp]');
    await page.evaluate(() => TSI.explorer.debug.change(s => { s.travel.day = 4; }));
    await page.waitForTimeout(400);

    await check('the Explorer\'s top bar and the home screen both have an End session button', async () => {
      assert(await page.isVisible('[data-test=end-session]'));
      const fits = await page.evaluate(() => { const b = document.querySelector('[data-test=end-session]').getBoundingClientRect(); return b.right <= innerWidth && b.left >= 0; });
      assert(fits, 'on screen');
      const home = await context.newPage();
      await home.goto(HOME);
      await home.waitForSelector('[data-test=end-session]');
      await home.close();
    });

    await check('it suggests a name with the date; Cancel makes nothing', async () => {
      let downloaded = false;
      page.once('download', () => { downloaded = true; });
      await page.waitForTimeout(500);
      await page.click('[data-test=end-session]');
      await page.waitForSelector('.tsi-modal [data-test=backup-name]');
      const v = await page.inputValue('.tsi-modal [data-test=backup-name]');
      assert(/^Session end \d{1,2} [A-Z][a-z]{2} \d{4}$/.test(v), v);
      assert(/copy it somewhere safe/.test(await H.modalText(page)));
      await page.waitForTimeout(380);
      await H.clickModal(page, 'Cancel');
      await page.waitForTimeout(600);
      equal(downloaded, false);
    });

    await check('Back up and finish keeps a "Session ended" snapshot, downloads the named backup, then reminds you to copy it', async () => {
      await page.waitForTimeout(500);
      await page.click('[data-test=end-session]');
      await page.waitForSelector('.tsi-modal [data-test=backup-name]');
      await page.waitForTimeout(380);
      await page.fill('.tsi-modal [data-test=backup-name]', 'Session 8, end');
      const [d] = await Promise.all([page.waitForEvent('download'), H.clickModal(page, 'Back up and finish')]);
      assert(/^tsi-backup-everything-\d{4}-\d{2}-\d{2}-\d{4}-session-8-end\.json$/.test(d.suggestedFilename()), d.suggestedFilename());
      const file = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
      equal(file.label, 'Session 8, end');
      assert(file.records.some(r => r.key === 'tsi.explorer.save' && r.value.travel.day === 4), 'it holds the Explorer as it is');
      await page.waitForSelector('.tsi-modal [data-test=session-ended]');
      const t = await H.modalText(page);
      assert(t.includes(d.suggestedFilename()) && /not this laptop/.test(t) && /USB stick/.test(t), t);
      const snaps = await page.evaluate(() => TSI.snapshots.list().then(l => l.map(s => s.why)));
      assert(snaps.includes('Session ended'), snaps.join(' | '));
      await page.waitForTimeout(380);
      await H.clickModal(page, 'Done');
    });

    await check('leaving the name as suggested works, and the home screen then says it was backed up today', async () => {
      const home = page;
      await home.goto(HOME);
      await home.waitForSelector('[data-test=end-session]');
      await home.waitForTimeout(500);
      await home.click('[data-test=end-session]');
      await home.waitForSelector('.tsi-modal [data-test=backup-name]');
      await home.waitForTimeout(380);
      const [d] = await Promise.all([home.waitForEvent('download'), H.clickModal(home, 'Back up and finish')]);
      assert(/-session-end-\d{1,2}-[a-z]{3}-\d{4}\.json$/.test(d.suggestedFilename()), d.suggestedFilename());
      await home.waitForSelector('.tsi-modal [data-test=session-ended]');
      await home.waitForTimeout(380);
      await H.clickModal(home, 'Done');
      equal(await home.textContent('[data-test=last-backup]'), 'Last backed up: today');
    });

    await check('an empty name falls back to the suggestion; nothing failed', async () => {
      await page.waitForTimeout(500);
      await page.click('[data-test=end-session]');
      await page.waitForSelector('.tsi-modal [data-test=backup-name]');
      await page.waitForTimeout(380);
      await page.fill('.tsi-modal [data-test=backup-name]', '');
      const [d] = await Promise.all([page.waitForEvent('download'), H.clickModal(page, 'Back up and finish')]);
      assert(/-session-end-\d{1,2}-[a-z]{3}-\d{4}\.json$/.test(d.suggestedFilename()), d.suggestedFilename());
      await page.waitForSelector('.tsi-modal [data-test=session-ended]');
      await page.waitForTimeout(380);
      await H.clickModal(page, 'Done');
      equal(context.log.errors, []);
    });
    await context.close();
  }
  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
