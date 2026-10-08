/* The Explorer and the Bastion together, in two windows, from a double-
   clicked index.html with the internet off (the days overhaul, Harry,
   8 October 2026): the Bastion follows the Explorer's day; making camp
   passes the day at the Bastion, even in another window; "The Ironbow sends
   word…" shows in both; one campaign file carries both; and Reset Travel
   moves the Bastion's days back with the Explorer's.
   Run with:  node tests/e2e/bastion-days.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exDay = page => page.evaluate(() => TSI.explorer.debug.state().travel.day);

/* Make Camp in the Explorer, and close what the night brings. Resolves with
   the text of "The Ironbow sends word…", if it showed (null if not). */
async function camp(ex) {
  await ex.waitForTimeout(400);
  await ex.click('[data-test=camp]');
  let word = null;
  for (let n = 0; n < 20; n++) {
    await ex.waitForTimeout(250);
    if (!(await ex.$('.tsi-modal'))) { if (n > 2) break; continue; }
    if (await ex.$('[data-test=ironbow-word]')) {
      word = await bare(ex, '[data-test=ironbow-word]');
      await ex.click('[data-test=ironbow-word] .tsi-modal__foot button:text-is("Close")');
    } else {
      await ex.click('.tsi-modal__foot button:last-child');
    }
  }
  return word;
}
/* Wait for the Bastion to reach a day by itself (it looks every 2 seconds). */
async function bastionReaches(ba, day) {
  await ba.waitForFunction(d => {
    const s = TSI.bastion.debug.state();
    return s.day === d && !s.dayInProgress && !TSI.bastion.debug.busy();
  }, day, { timeout: 8000 });
}
/* Since the new screen (Build 2), orders are given in a facility's panel,
   opened from its tile, and the Orders and Day Log panels open from the
   top bar and the bottom bar. */
async function recruit(ba) {
  await ba.click('[data-test=tile-barracks]');
  await ba.waitForSelector('[data-test="issue-barracks__recruit_defenders"]');
  await ba.click('[data-test="issue-barracks__recruit_defenders"]');
  await ba.waitForTimeout(300);
  await ba.keyboard.press('Escape');
}
async function panelText(ba, button, test) {
  await ba.click('[data-test=' + button + ']');
  await ba.waitForSelector('[data-test=' + test + ']');
  const t = await bare(ba, '[data-test=' + test + ']');
  await ba.keyboard.press('Escape');
  return t;
}
async function closeWord(ba) {
  await ba.waitForSelector('[data-test=ironbow-word]', { timeout: 8000 });
  const t = await bare(ba, '[data-test=ironbow-word]');
  await ba.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary');
  return t;
}

(async () => {
  const browser = await H.chromium.launch();
  const context = await H.newContext(browser, 'laptop', { acceptDownloads: true });
  await context.setOffline(true);
  /* No campfire events or weather at camp, and the Bastion's d4s roll 4:
     the checks are about the days, not the dice. */
  await context.addInitScript(() => { Math.random = () => 0.99; });

  /* ------------------------------------------------------------------ */
  section('Two windows: the Bastion follows the Explorer\'s day');
  const ex = await context.newPage();
  let ba = null;

  await check('the Explorer opens on Day 1 and saves it straight away, so the Bastion can read it', async () => {
    await ex.goto(INDEX + '?tool=explorer');
    await ex.waitForSelector('[data-test=camp]');
    equal(await ex.textContent('[data-test=day]'), 'Day 1');
    await ex.waitForFunction(() => { const s = TSI.store.get('tsi.explorer.save', null); return s && s.travel && s.travel.day === 1; });
  });

  await check('the Bastion, opened in a second window, starts on the Explorer\'s day, with no button to move time on', async () => {
    ba = await context.newPage();
    await ba.goto(INDEX + '?tool=bastion');
    await ba.waitForSelector('[data-test=day-status]');
    await ba.waitForFunction(() => TSI.bastion.debug.state().anchored, null, { timeout: 5000 });
    equal((await bas(ba)).day, 1);
    equal(await ba.textContent('[data-test=day-status]'), 'Day 1');
    equal(await ba.isVisible('[data-test=advance]'), false, 'Finish Day only shows for a day left part-way');
  });

  await check('Open the Bastion ↗ in the Explorer says the Bastion is already open, and opens no third window', async () => {
    const before = context.pages().length;
    await ex.click('[data-test=open-bastion]');
    await ex.waitForFunction(() => /already open in another window/.test(document.querySelector('[data-test=notice]').textContent));
    await ex.waitForTimeout(500);
    equal(context.pages().length, before);
  });

  await check('an order issued at the Bastion says the day it\'s due', async () => {
    await ba.waitForTimeout(400);
    await recruit(ba);
    const o = (await bas(ba)).pendingOrders.find(p => p.fnId === 'recruit_defenders');
    equal([o.issuedDay, o.dueDay], [1, 6], 'Recruit Defenders takes 5 days');
    const pending = await panelText(ba, 'orders-count', 'pending');
    assert(/Due Day 6 \(in 5 days\)/.test(pending), pending);
  });

  await check('each Make Camp in the Explorer passes that day at the Bastion, in the other window', async () => {
    for (let d = 2; d <= 5; d++) {
      const w = await camp(ex);
      equal(await exDay(ex), d);
      await bastionReaches(ba, d);
      equal(w, null, 'nothing to send word about on Day ' + d);
      equal(await ba.textContent('[data-test=day-status]'), 'Day ' + d);
    }
    equal((await bas(ba)).pendingOrders.length, 1, 'the order is still running');
  });

  await check('the day the order is due, the Explorer shows "The Ironbow sends word…" at camp, and its Close closes it', async () => {
    const w = await camp(ex);
    assert(w, 'no word at camp on Day 6');
    assert(/^The Ironbow sends word…/.test(w), w);
    assert(/Recruit Defenders/.test(w), w);
    equal(await ex.$('.tsi-modal'), null);
  });

  await check('the Bastion passes Day 6 by itself: the order completes once, and its own word pop-up says so', async () => {
    const t = await closeWord(ba);
    assert(/Recruit Defenders/.test(t), t);
    await bastionReaches(ba, 6);
    const s = await bas(ba);
    equal(s.pendingOrders.length, 0);
    equal(s.defenders.count, 4, 'one 1d4 of defenders (the dice roll 4), counted once');
    assert(s.log.some(l => l.day === 6 && /Recruit Defenders/.test(l.title + ' ' + l.body)), 'the Day Log has it');
    assert(/Day 6/.test(await panelText(ba, 'open-log', 'log')), 'the Day Log shows Day 6');
  });

  await check('a day with nothing to report brings no word in either window', async () => {
    const w = await camp(ex);
    equal(w, null);
    await bastionReaches(ba, 7);
    await ba.waitForTimeout(600);
    equal(await ba.$('[data-test=ironbow-word]'), null);
  });

  /* ------------------------------------------------------------------ */
  section('One campaign file, from the Explorer');
  let exported = null;

  await check('Export Save downloads one campaign file holding the Explorer and the Bastion, each on Day 7', async () => {
    const d = await H.download(ex, '[data-test=export-save]');
    exported = JSON.parse(d.text);
    assert(/^tsi-campaign-\d{4}-\d\d-\d\d-\d{4}\.json$/.test(d.name), d.name);
    equal([exported.kind, exported.tools], ['campaign', ['explorer', 'bastion']]);
    const rec = k => (exported.records.find(r => r.key === k) || {}).value;
    equal(rec('tsi.explorer.save').travel.day, 7);
    equal(rec('tsi.bastion.state').day, 7);
    equal(rec('tsi.bastion.state').defenders.count, 4);
  });

  await check('Import Save refuses while the Bastion is open in the other window, and nothing changes', async () => {
    const f = H.writeTemp('campaign-days.json', exported);
    await camp(ex);
    await bastionReaches(ba, 8);
    await H.chooseFile(ex, '[data-test=import-save]', f);
    const t = await H.modalText(ex);
    assert(/The Ironbow Bastion Manager is open in another window\. Close it first: a campaign file replaces the Explorer and the Bastion together\. Nothing was changed\./.test(t), t);
    await H.clickModal(ex, 'OK');
    equal(await exDay(ex), 8);
    equal((await bas(ba)).day, 8);
  });

  await check('with the Bastion closed, Import asks first, then puts back both: the Explorer and the Bastion on Day 7', async () => {
    await ba.close();
    ba = null;
    await ex.waitForTimeout(500);
    const f = H.writeTemp('campaign-days.json', exported);
    await H.chooseFile(ex, '[data-test=import-save]', f);
    const t = await H.modalText(ex);
    assert(/replaces what the Explorer and the Bastion have saved now, together/.test(t), t);
    await H.clickModal(ex, 'Import');
    await ex.waitForSelector('[data-test=camp]');
    await ex.waitForFunction(() => TSI.explorer && TSI.explorer.debug && TSI.explorer.debug.state().travel.day === 7);
    equal(await ex.textContent('[data-test=day]'), 'Day 7');
    const b = await ex.evaluate(() => TSI.store.fresh('tsi.bastion.state', null));
    equal([b.day, b.defenders.count], [7, 4]);
  });

  /* ------------------------------------------------------------------ */
  section('Reset Travel moves the Bastion\'s days back too');

  await check('reopened, the Bastion is on Day 7; an order issued now is due Day 12', async () => {
    ba = await context.newPage();
    await ba.goto(INDEX + '?tool=bastion');
    await ba.waitForSelector('[data-test=day-status]');
    await bastionReaches(ba, 7);
    await ba.waitForTimeout(400);
    await recruit(ba);
    equal((await bas(ba)).pendingOrders.map(o => o.dueDay), [12]);
  });

  await check('Reset Travel asks first; then the Explorer is on Day 1 and the Bastion moves back 6 days with it, the order still 5 days off', async () => {
    await ex.waitForTimeout(400);
    await ex.click('[data-test=reset-travel]');
    assert(/Reset travel back to Day 1/.test(await H.modalText(ex)));
    await H.clickModal(ex, 'OK');
    await ex.waitForTimeout(300);
    equal(await exDay(ex), 1);
    await bastionReaches(ba, 1);
    const s = await bas(ba);
    equal(s.pendingOrders.map(o => [o.issuedDay, o.dueDay]), [[1, 6]]);
    equal(await ba.textContent('[data-test=day-status]'), 'Day 1');
    const pending = await panelText(ba, 'orders-count', 'pending');
    assert(/Due Day 6 \(in 5 days\)/.test(pending), pending);
  });

  await check('camping on from there passes the days as before', async () => {
    await camp(ex);
    await bastionReaches(ba, 2);
    equal((await bas(ba)).pendingOrders.length, 1);
  });

  await check('nothing reached for the internet, and nothing failed', async () => {
    equal(context.log.net, []);
    equal(context.log.failed, []);
    equal(context.log.errors, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
