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
   opened from its tile, and the Orders panel opens from the
   top bar. */
async function recruit(ba) {
  /* The Dock's Charter Berth (7 days; the war game's Barracks was the example until 22 October 2026). It costs gold, so the treasury is topped up first. */
  await ba.evaluate(() => TSI.bastion.debug.change(s => { if (s.treasuryGP < 500) s.treasuryGP = 500; }));
  await ba.click('[data-test=tile-dock]');
  await ba.click('[data-test=dock-tab-orders]'); /* the Dock opens on Cargo (step S08): its orders are under Orders */
  await ba.waitForSelector('[data-test="issue-dock__charter_berth"]');
  await ba.click('[data-test="issue-dock__charter_berth"]');
  await ba.waitForTimeout(300);
  await ba.keyboard.press('Escape');
}
const berths = s => s.warehouse.filter(w => w.notes === 'Dock').reduce((n, w) => n + w.qty, 0);
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
    const o = (await bas(ba)).pendingOrders.find(p => p.fnId === 'charter_berth');
    equal([o.issuedDay, o.dueDay], [1, 8], 'Charter Berth takes 7 days');
    const pending = await panelText(ba, 'orders-count', 'pending');
    assert(/Due Day 8 \(in 7 days\)/.test(pending), pending);
  });

  await check('each Make Camp in the Explorer passes that day at the Bastion, in the other window', async () => {
    for (let d = 2; d <= 7; d++) {
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
    assert(w, 'no word at camp on Day 8');
    assert(/^The Ironbow sends word…/.test(w), w);
    assert(/Charter Berth/.test(w), w);
    equal(await ex.$('.tsi-modal'), null);
  });

  await check('the Bastion passes Day 8 by itself: the order completes once, and its own word pop-up says so', async () => {
    const t = await closeWord(ba);
    assert(/Charter Berth/.test(t), t);
    await bastionReaches(ba, 8);
    const s = await bas(ba);
    equal(s.pendingOrders.length, 0);
    equal(berths(s), 1, 'one chartered vessel in the Warehouse, counted once');
    equal(await ba.$('[data-test=open-log]'), null, 'there is no log panel: the word pop-up above is where it was said');
  });

  await check('a day with nothing to report brings no word in either window', async () => {
    const w = await camp(ex);
    equal(w, null);
    await bastionReaches(ba, 9);
    await ba.waitForTimeout(600);
    equal(await ba.$('[data-test=ironbow-word]'), null);
  });

  await check('the Bastion saving a change of its own never makes it misread the Explorer\'s day (SUI-29)', async () => {
    /* The Bastion opened on Day 1, so that's its own copy of the Explorer's
       save. Before the fix, a read while any save of its own was being
       written gave that copy: the Bastion took it for a Reset Travel, moved
       every day back to Day 1 and passed them all again. */
    const r = await ba.evaluate(async () => {
      const ui = () => Object.assign({}, TSI.store.get('tsi.bastion.ui', {}));
      TSI.store.set('tsi.bastion.ui', Object.assign(ui(), { sui29: 1 }));
      TSI.store.flush();
      const during = await TSI.store.fresh('tsi.explorer.save', null);
      /* A change this page makes while its read is under way wins over
         the older value the read brings back. */
      await TSI.store.flush();
      const reading = TSI.store.fresh('tsi.bastion.ui', null);
      TSI.store.set('tsi.bastion.ui', Object.assign(ui(), { sui29: 2 }));
      const own = await reading;
      TSI.store.set('tsi.bastion.ui', Object.assign(ui(), { sui29: 3 }));
      TSI.store.flush();
      TSI.bastion.debug.clock();
      await new Promise(res => setTimeout(res, 400));
      return {
        during: during && during.travel.day,
        own: own && own.sui29,
        day: TSI.bastion.debug.state().day
      };
    });
    equal(r.during, 9, 'read while a Bastion save was being written: the Explorer\'s day as saved now');
    equal(r.own, 2, 'a change of the same key made while reading it wins');
    equal(r.day, 9, 'the clock read then left the Bastion on Day 9');
    await ba.waitForTimeout(2500);
    const s = await bas(ba);
    equal(s.day, 9);
  });

  /* ------------------------------------------------------------------ */
  section('One campaign file, from the Explorer');
  let exported = null;

  await check('Export Save downloads one campaign file holding the Explorer and the Bastion, each on Day 9', async () => {
    const d = await H.download(ex, '[data-test=export-save]');
    exported = JSON.parse(d.text);
    assert(/^tsi-campaign-\d{4}-\d\d-\d\d-\d{4}\.json$/.test(d.name), d.name);
    equal([exported.kind, exported.tools], ['campaign', ['explorer', 'bastion']]);
    const rec = k => (exported.records.find(r => r.key === k) || {}).value;
    equal(rec('tsi.explorer.save').travel.day, 9);
    equal(rec('tsi.bastion.state').day, 9);
    equal(berths(rec('tsi.bastion.state')), 1);
  });

  await check('Import Save refuses while the Bastion is open in the other window, and nothing changes', async () => {
    const f = H.writeTemp('campaign-days.json', exported);
    await camp(ex);
    await bastionReaches(ba, 10);
    await H.chooseFile(ex, '[data-test=import-save]', f);
    const t = await H.modalText(ex);
    assert(/The Ironbow Bastion Manager is open in another window\. Close it first: a campaign file replaces the Explorer and the Bastion together\. Nothing was changed\./.test(t), t);
    await H.clickModal(ex, 'OK');
    equal(await exDay(ex), 10);
    equal((await bas(ba)).day, 10);
  });

  await check('with the Bastion closed, Import asks first, then puts back both: the Explorer and the Bastion on Day 9', async () => {
    await ba.close();
    ba = null;
    await ex.waitForTimeout(500);
    const f = H.writeTemp('campaign-days.json', exported);
    await H.chooseFile(ex, '[data-test=import-save]', f);
    const t = await H.modalText(ex);
    assert(/replaces what the Explorer and the Bastion have saved now, together/.test(t), t);
    await H.clickModal(ex, 'Import');
    await ex.waitForSelector('[data-test=camp]');
    await ex.waitForFunction(() => TSI.explorer && TSI.explorer.debug && TSI.explorer.debug.state().travel.day === 9);
    equal(await ex.textContent('[data-test=day]'), 'Day 9');
    const b = await ex.evaluate(() => TSI.store.fresh('tsi.bastion.state', null));
    equal([b.day, berths(b)], [9, 1]);
  });

  /* ------------------------------------------------------------------ */
  section('Reset Travel moves the Bastion\'s days back too');

  await check('reopened, the Bastion is on Day 9; an order issued now is due Day 16', async () => {
    ba = await context.newPage();
    await ba.goto(INDEX + '?tool=bastion');
    await ba.waitForSelector('[data-test=day-status]');
    await bastionReaches(ba, 9);
    await ba.waitForTimeout(400);
    await recruit(ba);
    equal((await bas(ba)).pendingOrders.map(o => o.dueDay), [16]);
  });

  await check('Reset Travel asks first; then the Explorer is on Day 1 and the Bastion moves back 8 days with it, the order still 7 days off', async () => {
    await ex.waitForTimeout(400);
    await ex.click('[data-test=reset-travel]');
    assert(/Start again from Day 1/.test(await H.modalText(ex)));
    await H.clickModal(ex, 'OK');
    await ex.waitForTimeout(300);
    equal(await exDay(ex), 1);
    await bastionReaches(ba, 1);
    const s = await bas(ba);
    equal(s.pendingOrders.map(o => [o.issuedDay, o.dueDay]), [[1, 8]]);
    equal(await ba.textContent('[data-test=day-status]'), 'Day 1');
    const pending = await panelText(ba, 'orders-count', 'pending');
    assert(/Due Day 8 \(in 7 days\)/.test(pending), pending);
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
