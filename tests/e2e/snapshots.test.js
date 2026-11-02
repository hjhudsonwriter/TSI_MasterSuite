/* Snapshots (2 November 2026): automatic copies of the Explorer and the Bastion kept in the browser, so a mistake at the table can be
   taken back a step. Run:  node tests/e2e/snapshots.test.js */
'use strict';

const fs = require('fs');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const HOME = H.fileUrl('index.html');
const EXPLORER = HOME + '?tool=explorer';
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const snaps = page => page.evaluate(() => TSI.snapshots.list().then(l => l.map(s => ({ why: s.why, at: s.at, day: s.items.explorer && s.items.explorer.travel.day }))));
async function until(fn, ms) { const end = Date.now() + (ms || 8000); while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 150)); } throw new Error('timed out waiting'); }
const day = (page, d) => page.evaluate(d => TSI.explorer.debug.change(s => { s.travel.day = d; }), d);

(async () => {
  const browser = await H.chromium.launch();
  for (const [name] of [['laptop'], ['tv']]) {
    section('Snapshots at ' + name);
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    await context.addInitScript(() => { Math.random = () => 0.99; });
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.waitForSelector('[data-test=snapshots]');

    await check('a brand new Explorer has nothing saved, so nothing is kept yet; the Snapshots button is in its top bar and on the home screen', async () => {
      equal((await snaps(page)).length, 0);
      await page.click('[data-test=snapshots]');
      await page.waitForSelector('.tsi-modal');
      assert(/Nothing has been kept yet/.test(await H.modalText(page)));
      await H.clickModal(page, 'Close');
      const home = await context.newPage();
      await home.goto(HOME);
      await home.waitForSelector('[data-test=snapshots]');
      await home.close();
    });

    await check('Make Camp keeps a snapshot named for it; the same thing twice is kept once', async () => {
      await page.click('[data-test=camp]');
      await until(async () => (await snaps(page)).some(s => /^Make Camp, Day 2/.test(s.why)));
      await page.evaluate(() => { document.querySelectorAll('.tsi-modal__foot button').forEach(b => b.click()); });
      const before = (await snaps(page)).length;
      await page.evaluate(() => TSI.snapshots.take('Again, nothing changed'));
      equal((await snaps(page)).length, before, 'no new one');
    });

    await check('only the newest twelve are kept', async () => {
      for (let i = 0; i < 14; i++) await page.evaluate(i => TSI.snapshots.take('Forced ' + i, { force: true }), i);
      const l = await snaps(page);
      equal(l.length, 12);
      equal(l[0].why, 'Forced 13');
    });

    await check('the list shows each one with its reason and the days it holds', async () => {
      await page.click('[data-test=snapshots]');
      await page.waitForSelector('.tsi-modal [data-test=snapshot-list]');
      const t = await page.textContent('.tsi-modal [data-test=snapshot-list]');
      assert(/Forced 13/.test(t) && /Explorer Day 2/.test(t), t.slice(0, 200));
      await H.clickModal(page, 'Close');
    });

    await check('going back asks first; Cancel changes nothing', async () => {
      await day(page, 9);
      await page.evaluate(() => TSI.snapshots.take('Day nine', { force: true }));
      await day(page, 12);
      await page.click('[data-test=snapshots]');
      await page.waitForSelector('.tsi-modal [data-test=snapshot-list]', { timeout: 6000 });
      await page.waitForTimeout(380);
      await page.click('.tsi-modal [data-test=snapshot-go-0]');
      await page.waitForSelector('.tsi-modal__foot button:text-is("Go back")');
      assert(/Everything since then is replaced/.test(await H.modalText(page)));
      await H.clickModal(page, 'Cancel');
      await page.waitForTimeout(400);
      equal((await st(page)).travel.day, 12);
    });

    await check('going back to the day-nine snapshot puts the Explorer back to day nine, after keeping a snapshot of now', async () => {
      await page.evaluate(() => TSI.snapshots.take('Day twelve', { force: true }));
      await page.click('[data-test=snapshots]');
      await page.waitForSelector('.tsi-modal [data-test=snapshot-list]');
      await page.waitForTimeout(380);
      const l = await snaps(page);
      const idx = l.findIndex(s => s.why === 'Day nine');
      assert(idx >= 0, JSON.stringify(l.map(s => s.why)));
      await page.click('.tsi-modal [data-test=snapshot-go-' + idx + ']');
      await page.waitForSelector('.tsi-modal__foot button:text-is("Go back")');
      await page.waitForTimeout(380);
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Go back')]);
      await page.waitForSelector('[data-test=camp]');
      equal((await st(page)).travel.day, 9);
      const after = await snaps(page);
      assert(after.some(s => /^Before going back to /.test(s.why)), 'a snapshot of the moment before going back: ' + after.map(s => s.why).join(' | '));
      await H.waitForNotice(page, /Went back to the snapshot from/);
    });

    await check('and that can be undone: going back to "Before going back" gives day twelve again', async () => {
      const l = await snaps(page);
      const idx = l.findIndex(s => /^Before going back to /.test(s.why));
      await page.click('[data-test=snapshots]');
      await page.waitForSelector('.tsi-modal [data-test=snapshot-list]');
      await page.waitForTimeout(380);
      await page.click('.tsi-modal [data-test=snapshot-go-' + idx + ']');
      await page.waitForSelector('.tsi-modal__foot button:text-is("Go back")');
      await page.waitForTimeout(380);
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Go back')]);
      await page.waitForSelector('[data-test=camp]');
      equal((await st(page)).travel.day, 12);
    });

    await check('going back leaves the Explorer\'s settings and other saved items alone', async () => {
      await page.uncheck('[data-test=cursor-on]');
      await page.waitForTimeout(400);
      const l = await snaps(page);
      await page.click('[data-test=snapshots]');
      await page.waitForSelector('.tsi-modal [data-test=snapshot-list]');
      await page.waitForTimeout(380);
      await page.click('.tsi-modal [data-test=snapshot-go-' + (l.length - 1) + ']');
      await page.waitForSelector('.tsi-modal__foot button:text-is("Go back")');
      await page.waitForTimeout(380);
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Go back')]);
      await page.waitForSelector('[data-test=camp]');
      equal(await page.isChecked('[data-test=cursor-on]'), false);
    });

    await check('going back is refused while the Bastion is open in another window', async () => {
      const ba = await context.newPage();
      await ba.goto(HOME + '?tool=bastion');
      await ba.waitForSelector('[data-test=day-status]', { timeout: 20000 });
      await page.waitForTimeout(500);
      await page.click('[data-test=snapshots]');
      await page.waitForSelector('.tsi-modal [data-test=snapshot-list]');
      await page.waitForTimeout(380);
      await page.click('.tsi-modal [data-test=snapshot-go-0]');
      await page.waitForSelector('.tsi-modal');
      await page.waitForFunction(() => /open in another window/.test(document.querySelector('.tsi-modal').textContent), null, { timeout: 5000 });
      await H.clickModal(page, 'OK').catch(() => H.clickModal(page, 'Close'));
      await ba.close();
    });

    await check('snapshots are not in a backup file, and Restore leaves them alone', async () => {
      /* Restore is refused while the Explorer is open in another window, so use this window for the home screen. */
      const home = page;
      await home.goto(HOME);
      await home.waitForSelector('[data-test=backup-everything]');
      const before = (await snaps(home)).length;
      const d = await H.download(home, '[data-test=backup-everything]');
      const text = d.text;
      assert(!/snapshots?"/i.test(JSON.stringify(JSON.parse(text).records.map(r => r.key))), 'no snapshot key');
      assert(text.indexOf('Forced 13') === -1, 'the snapshot reasons are not in the file');
      await H.chooseFile(home, '[data-test=restore]', H.writeTemp('snap-restore.json', JSON.parse(text)));
      await home.waitForSelector('.tsi-modal');
      await home.uncheck('.tsi-modal input[type=checkbox]').catch(() => {});
      await Promise.all([home.waitForEvent('load'), H.clickModal(home, 'Restore')]);
      await home.waitForSelector('[data-test=backup-everything]');
      equal((await snaps(home)).length, before);
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
