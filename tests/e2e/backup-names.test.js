/* Backups: named, easier to find, and harder to forget (2 November 2026): Back up everything and Export ask for a name that goes
   into the file; a "Back up all" button in every tool; the home screen's "last backed up" line warns when a backup is due; and the home
   screen says whether the browser has promised to keep the saves.
   Run:  node tests/e2e/backup-names.test.js */
'use strict';

const fs = require('fs');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const HOME = H.fileUrl('index.html');
const DAY = 86400000;

(async () => {
  const browser = await H.chromium.launch();
  for (const [name] of [['laptop'], ['tv']]) {
    section('Backups at ' + name);
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(HOME);
    await page.waitForSelector('[data-test=backup-everything]');
    /* Something saved, so there is something to lose. */
    await page.evaluate(async () => { TSI.store.set('tsi.arenas.state', { players: [], totalGold: 0, arenaId: null, roundId: null }); await TSI.store.flush(); });

    await check('Back up everything asks for a name, and the name is in the file name and in the file', async () => {
      await page.waitForTimeout(400);
      await page.click('[data-test=backup-everything]');
      await page.waitForSelector('.tsi-modal [data-test=backup-name]');
      await page.waitForTimeout(380);
      await page.fill('.tsi-modal [data-test=backup-name]', 'Session 7, end');
      const [d] = await Promise.all([page.waitForEvent('download'), page.click('.tsi-modal__foot .tsi-btn--primary')]);
      assert(/^tsi-backup-everything-\d{4}-\d{2}-\d{2}-\d{4}-session-7-end\.json$/.test(d.suggestedFilename()), d.suggestedFilename());
      const file = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
      equal(file.label, 'Session 7, end');
      equal(file.kind, 'suite');
    });

    await check('Enter in the name box confirms; leaving it empty gives the plain name', async () => {
      await page.waitForTimeout(500);
      await page.click('[data-test=backup-everything]');
      await page.waitForSelector('.tsi-modal [data-test=backup-name]');
      await page.waitForTimeout(380);
      const [d] = await Promise.all([page.waitForEvent('download'), page.press('.tsi-modal [data-test=backup-name]', 'Enter')]);
      assert(/^tsi-backup-everything-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(d.suggestedFilename()), d.suggestedFilename());
    });

    await check('Cancel makes no backup and says nothing was saved', async () => {
      await page.waitForTimeout(500);
      let downloaded = false;
      page.once('download', () => { downloaded = true; });
      await page.click('[data-test=backup-everything]');
      await page.waitForSelector('.tsi-modal [data-test=backup-name]');
      await page.waitForTimeout(380);
      await H.clickModal(page, 'Cancel');
      await page.waitForTimeout(600);
      equal(downloaded, false);
    });

    await check('Restore shows the name of the file it is about to load', async () => {
      const d = await H.download(page, '[data-test=backup-everything]');
      assert(!JSON.parse(d.text).label, 'this one has no name');
      await page.waitForTimeout(500);
      await page.click('[data-test=backup-everything]');
      await page.waitForSelector('.tsi-modal [data-test=backup-name]');
      await page.waitForTimeout(380);
      await page.fill('.tsi-modal [data-test=backup-name]', 'Before the siege');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.tsi-modal__foot .tsi-btn--primary')]);
      const path = await dl.path();
      await page.waitForTimeout(500);
      await H.chooseFile(page, '[data-test=restore]', path);
      await page.waitForSelector('.tsi-modal');
      const text = await H.modalText(page);
      assert(/Its name: Before the siege/.test(text), text);
      await H.clickModal(page, 'Cancel');
    });

    await check('"Last backed up" turns to a warning when none was made in the last two days, and clears after a backup', async () => {
      await page.evaluate(() => localStorage.setItem(TSI.storeRules.spaceNames(TSI.space).lastBackup, String(Date.now() - 3 * 86400000)));
      await page.reload();
      await page.waitForSelector('[data-test=last-backup]');
      await page.waitForFunction(() => document.querySelector('[data-test=last-backup]').classList.contains('is-due'), null, { timeout: 5000 });
      assert(/3 days ago/.test(await page.textContent('[data-test=last-backup]')));
      await page.waitForTimeout(500);
      await page.click('[data-test=backup-everything]');
      await page.waitForSelector('.tsi-modal [data-test=backup-name]');
      await page.waitForTimeout(380);
      await Promise.all([page.waitForEvent('download'), page.click('.tsi-modal__foot .tsi-btn--primary')]);
      await page.waitForFunction(() => !document.querySelector('[data-test=last-backup]').classList.contains('is-due'), null, { timeout: 5000 });
      equal(await page.textContent('[data-test=last-backup]'), 'Last backed up: today');
    });
    await context.close();

    /* The browser's promise to keep the saves, with the answer pretended. */
    for (const [answer, expect] of [[true, /protected from automatic cleanup/], [false, /not protected/]]) {
      await check('the home screen says the saves are ' + (answer ? 'protected' : 'not protected') + ' when the browser says ' + (answer ? 'yes' : 'no'), async () => {
        const c = await H.newContext(browser, name);
        await c.addInitScript(a => {
          Object.defineProperty(navigator, 'storage', { value: { persisted: () => Promise.resolve(a), persist: () => Promise.resolve(a), estimate: () => Promise.resolve({}) }, configurable: true });
        }, answer);
        const p = await c.newPage();
        await p.goto(HOME);
        await p.waitForFunction(() => { const e = document.querySelector('[data-test=storage-protection]'); return e && !e.hidden && e.textContent; }, null, { timeout: 5000 });
        assert(expect.test(await p.textContent('[data-test=storage-protection]')), await p.textContent('[data-test=storage-protection]'));
        await c.close();
      });
    }

    await check('inside a tool: a "Back up all" button asks for a name and downloads everything; it is marked when a backup is due', async () => {
      const c = await H.newContext(browser, name);
      const p = await c.newPage();
      await p.goto(HOME + '?tool=quests');
      await p.waitForSelector('[data-test=backup-all]');
      await p.evaluate(async () => { TSI.store.set('tsi.arenas.state', { players: [], totalGold: 0, arenaId: null, roundId: null }); await TSI.store.flush(); });
      await p.reload();
      await p.waitForSelector('[data-test=backup-all]');
      await p.waitForFunction(() => document.querySelector('[data-test=backup-all]').classList.contains('is-due'), null, { timeout: 5000 });
      await p.waitForTimeout(500);
      await p.click('[data-test=backup-all]');
      await p.waitForSelector('.tsi-modal [data-test=backup-name]');
      await p.waitForTimeout(380);
      await p.fill('.tsi-modal [data-test=backup-name]', 'From a tool');
      const [d] = await Promise.all([p.waitForEvent('download'), p.click('.tsi-modal__foot .tsi-btn--primary')]);
      assert(/-from-a-tool\.json$/.test(d.suggestedFilename()), d.suggestedFilename());
      const file = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
      equal(file.kind, 'suite');
      await p.waitForFunction(() => !document.querySelector('[data-test=backup-all]').classList.contains('is-due'), null, { timeout: 5000 });
      assert(await p.evaluate(() => { const b = document.querySelector('[data-test=backup-all]').getBoundingClientRect(); return b.right <= innerWidth && b.left >= 0; }), 'on screen');
      await c.close();
    });

    await check('Export in a tool also asks for a name', async () => {
      const c = await H.newContext(browser, name);
      const p = await c.newPage();
      await p.goto(HOME + '?tool=quests');
      await p.waitForSelector('[data-test=export]');
      await p.waitForTimeout(500);
      await p.click('[data-test=export]');
      await p.waitForSelector('.tsi-modal [data-test=backup-name]');
      await p.waitForTimeout(380);
      await p.fill('.tsi-modal [data-test=backup-name]', 'My quests');
      const [d] = await Promise.all([p.waitForEvent('download'), p.click('.tsi-modal__foot .tsi-btn--primary')]);
      assert(/^tsi-quests-.*-my-quests\.json$/.test(d.suggestedFilename()), d.suggestedFilename());
      await c.close();
    });
  }
  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
