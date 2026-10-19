/* Session safety and clarity (18 October 2026): the "Last backed up" line on
   the home screen, Reset offering a copy first, (the Bastion's Clear
   buttons asking first are in phase9.test.js). Run with:  node tests/e2e/session-safety.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const INDEX = H.fileUrl('index.html');

(async () => {
  const browser = await H.chromium.launch();
  const context = await H.newContext(browser, 'laptop', { acceptDownloads: true });
  await context.setOffline(true);
  const page = await context.newPage();

  section('Last backed up, on the home screen');
  await page.goto(INDEX);
  await page.waitForSelector('[data-test=last-backup]');
  await check('before any backup it says so', async () => {
    assert(/never/i.test(await page.textContent('[data-test=last-backup]')), await page.textContent('[data-test=last-backup]'));
  });
  await check('Back up everything stamps it as today', async () => {
    await H.download(page, '[data-test=backup-everything]');
    await page.waitForTimeout(300);
    assert(/today|just now/i.test(await page.textContent('[data-test=last-backup]')), await page.textContent('[data-test=last-backup]'));
  });
  await check('the stamp survives a reload', async () => {
    await page.reload();
    await page.waitForSelector('[data-test=last-backup]');
    assert(!/never/i.test(await page.textContent('[data-test=last-backup]')));
  });

  section('Reset offers a copy first');
  await page.goto(INDEX + '?tool=encounter');
  await page.waitForSelector('[data-test=reset-all]');
  await check('Reset asks, the copy box is ticked, and Cancel changes nothing', async () => {
    await page.click('[data-test=reset-all]');
    await page.waitForSelector('[data-test=reset-copy]');
    equal(await page.isChecked('[data-test=reset-copy]'), true);
    await H.clickModal(page, 'Cancel');
    equal(await page.$('[data-test=reset-copy]'), null);
  });
  await check('with the box ticked, Reset downloads a copy', async () => {
    await page.click('[data-test=reset-all]');
    await page.waitForSelector('[data-test=reset-copy]');
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), H.clickModal(page, 'Reset')]);
    assert(/\.json$/i.test(d.suggestedFilename()), d.suggestedFilename());
  });

  await check('nothing reached for the internet, and nothing failed', async () => {
    equal(context.log.net, []);
    equal(context.log.failed, []);
    equal(context.log.errors, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
