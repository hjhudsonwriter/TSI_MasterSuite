/* Restore only some of a backup (2 November 2026): the backup's saved items are listed by tool in a shut-away "Restore only some of
   it…"; untick a tool to leave what is saved now alone. Run:  node tests/e2e/restore-some.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const HOME = H.fileUrl('index.html');
const get = (page, key) => page.evaluate(k => TSI.store.fresh(k, null), key);
const put = (page, key, value) => page.evaluate(async ([k, v]) => { TSI.store.set(k, v); await TSI.store.flush(); }, [key, value]);

(async () => {
  const browser = await H.chromium.launch();
  for (const [name] of [['laptop'], ['tv']]) {
    section('Restore only some at ' + name);
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(HOME);
    await page.waitForSelector('[data-test=restore]');
    const arenas = n => ({ players: [], totalGold: n, arenaId: null, roundId: null });

    let backupPath;
    await check('make a backup holding the Notice Board\'s accepted quests and the Arenas\' gold', async () => {
      await put(page, 'tsi.quests.accepted', []);
      await put(page, 'tsi.arenas.state', arenas(100));
      const d = await H.download(page, '[data-test=backup-everything]');
      backupPath = H.writeTemp('restore-some.json', JSON.parse(d.text));
      assert(JSON.parse(d.text).records.some(r => r.key === 'tsi.arenas.state'));
    });

    async function openRestore() {
      await H.chooseFile(page, '[data-test=restore]', backupPath);
      await page.waitForSelector('.tsi-modal');
    }

    await check('the choice is shut away by default and everything in it is ticked', async () => {
      await put(page, 'tsi.arenas.state', arenas(555));
      await openRestore();
      assert(await page.isVisible('.tsi-modal [data-test=restore-pick] summary'));
      equal(await page.getAttribute('.tsi-modal [data-test=restore-pick]', 'open'), null, 'shut');
      await page.click('.tsi-modal [data-test=restore-pick] summary');
      equal(await page.isChecked('.tsi-modal [data-test=restore-tick-quests]'), true);
      equal(await page.isChecked('.tsi-modal [data-test=restore-tick-arenas]'), true);
      const t = await H.modalText(page);
      assert(/Arenas of The Scarlett Isles: 1 saved item/.test(t), t);
      await H.clickModal(page, 'Cancel');
    });

    await check('nothing ticked: refused, nothing changes', async () => {
      await openRestore();
      await page.click('.tsi-modal [data-test=restore-pick] summary');
      for (const id of await page.$$eval('.tsi-modal [data-test^=restore-tick-]', n => n.map(x => x.getAttribute('data-test')))) await page.uncheck('.tsi-modal [data-test=' + id + ']');
      await page.waitForTimeout(380);
      await H.clickModal(page, 'Restore');
      await page.waitForFunction(() => /Nothing is ticked/.test(document.querySelector('.tsi-modal').textContent), null, { timeout: 5000 });
      await H.clickModal(page, 'OK').catch(() => H.clickModal(page, 'Close'));
      equal((await get(page, 'tsi.arenas.state')).totalGold, 555);
    });

    await check('unticking the Arenas restores the quests and leaves the Arenas\' gold as it is now', async () => {
      await put(page, 'tsi.quests.accepted', [{ junk: true }]);
      await openRestore();
      await page.click('.tsi-modal [data-test=restore-pick] summary');
      await page.uncheck('.tsi-modal [data-test=restore-tick-arenas]');
      const box = await page.$('.tsi-modal input[name=tsi-backup-first]');
      if (box) await box.uncheck();
      await page.waitForTimeout(380);
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Restore')]);
      await page.waitForSelector('[data-test=restore]');
      equal(await get(page, 'tsi.quests.accepted'), [], 'the quests came back');
      equal((await get(page, 'tsi.arenas.state')).totalGold, 555, 'the Arenas were left alone');
      await H.waitForNotice(page, /Restored part of the backup/);
    });

    await check('with everything ticked (the default) it restores everything, as it always did', async () => {
      await put(page, 'tsi.arenas.state', arenas(777));
      await openRestore();
      const box = await page.$('.tsi-modal input[name=tsi-backup-first]');
      if (box) await box.uncheck();
      await page.waitForTimeout(380);
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Restore')]);
      await page.waitForSelector('[data-test=restore]');
      equal((await get(page, 'tsi.arenas.state')).totalGold, 100);
      await H.waitForNotice(page, /Restored the backup/);
    });

    await check('nothing failed', async () => { equal(context.log.errors, []); });
    await context.close();
  }
  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
