/* The Bastion's conversion to version 4 (the Strip Back Overhaul, Harry,
   22 October 2026), clicked through from a double-clicked index.html with the
   internet off: a Bastion from before it opens, a box says what changed and
   stays until "I've read this" is pressed (and shows again if the window is
   closed without pressing it), a copy of the old Bastion is kept in "Back up
   everything", nothing moves on while the box is open, and a conversion that
   can't be proved safe changes nothing and says so.
   The heavy fixture (tests/fixtures/bastion-v3-heavy.json) is made by
   tests/fixtures/make-heavy.js.
   Run with:  node tests/e2e/migration-v4.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const BASTION = INDEX + '?tool=bastion';
const FIXTURES = path.join(__dirname, '..', 'fixtures');
const record = file => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8')).records.find(r => r.key === 'tsi.bastion.state').value;
const HEAVY = record('bastion-v3-heavy.json');
const clone = v => JSON.parse(JSON.stringify(v));
/* A heavy Bastion with an order at a facility the Bastion has never heard of: so there IS something to convert (gold, Favour... come back). */
function withGhost() {
  const s = clone(HEAVY);
  s.pendingOrders.push({ id: 'hv-ghost', facId: 'old_mill', fnId: 'grind', chosen: null, optionLabel: null, notes: '', label: 'Old Mill: Grind Grain', costGP: 120, issuedDay: 38, dueDay: 45, inputs: [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 3 }] });
  s.builtExtras.push({ facId: 'old_mill', status: 'built' });
  return s;
}
/* The smallest Bastion that is still a Bastion, from before the change (version 3), on Day 1. */
function plain() {
  return { v: 3, day: 1, anchored: true, treasuryGP: 100, partyLevel: 7, builtExtras: [], pendingOrders: [], defenders: { count: 0, armed: false, patrolUntil: 0 }, warehouse: [], log: [] };
}

const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const stored = page => page.evaluate(() => TSI.store.get('tsi.bastion.state', null));
const quarantined = page => page.evaluate(() => TSI.store.keys('quarantine').filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0));
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());

/* A new browser window on the home page, with the Bastion's save (and the Explorer's, if given) already in the browser. */
async function seeded(browser, size, state, explorer, init) {
  const context = await H.newContext(browser, size || 'laptop', { acceptDownloads: true });
  await context.setOffline(true);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.goto(INDEX);
  await page.waitForSelector('.tsi-card');
  await page.evaluate(([b, e]) => {
    TSI.store.set('tsi.bastion.state', b);
    if (e) TSI.store.set('tsi.explorer.save', e);
    return TSI.store.flush();
  }, [state, explorer || null]);
  return { context, page };
}
async function openBastion(page) {
  await page.goto(BASTION);
  await page.waitForSelector('[data-test=day-status]');
}

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('A Bastion from before the change opens: the box says what changed');
  {
    const { context, page } = await seeded(browser, 'laptop', withGhost());

    await check('a copy of the Bastion as it was is kept before anything is saved, and the converted Bastion is version 4', async () => {
      await openBastion(page);
      await page.waitForSelector('[data-test=changes-box]');
      await page.waitForFunction(() => TSI.store.keys('quarantine').some(k => k.indexOf('tsi.quarantine.bastion.state') === 0));
      const s = await st(page);
      equal(s.v, 4);
      equal(s.treasuryGP, 2120, '2,000 gp and the 120 gp the Old Mill\'s order cost');
      equal(s.pendingOrders.length, 28, 'the 28 orders the Bastion knows; the Old Mill\'s is cancelled');
      equal(s.migration.v4.shown, false);
    });

    await check('the box has the headline, the lines in plain English, and two buttons', async () => {
      const text = await bare(page, '[data-test=changes-box]');
      assert(text.indexOf('The Bastion has changed. Here is exactly what happened to yours.') !== -1, text);
      assert(/Gold\. 120 gp went back into the treasury \(it was 2,000 gp, it is now 2,120 gp\): Old Mill: Grind Grain, 120 gp\./.test(text), text);
      assert(/Goods\. 3 lots of Raw Timber went back to the Warehouse\./.test(text), text);
      assert(/Orders\. One order was cancelled: Old Mill: Grind Grain \(the Old Mill is no longer part of the Bastion\)\./.test(text), text);
      assert(/Places that are gone\. The Old Mill is no longer part of the Bastion; its slot is free\./.test(text), text);
      assert(/A copy of your Bastion exactly as it was is kept in "Back up everything"/.test(text), text);
      assert(!/undefined|null|NaN|old_mill|\[object/.test(text), 'no code words');
      equal(await page.$$eval('[data-test=changes-line]', n => n.length), 4);
      equal(await page.$$eval('[data-test=changes-line] strong', n => n.map(x => x.textContent)), ['Gold.', 'Goods.', 'Orders.', 'Places that are gone.']);
      equal(await page.textContent('[data-test=changes-ok]'), 'I\'ve read this');
      equal(await page.isVisible('[data-test=changes-save]'), true);
      await H.shot(page, 'migration-box');
    });

    await check('the box fits the laptop window, with its buttons in view', async () => {
      const r = await H.layoutCheck(page, ['[data-test=changes-box]', '[data-test=changes-ok]']);
      equal([r.scrollWidth <= r.clientWidth, r.outOfView], [true, []]);
    });

    await check('"Save this as a text file" downloads exactly what the box says', async () => {
      const d = await H.download(page, '[data-test=changes-save]');
      assert(/^bastion-what-changed-day-40\.txt$/.test(d.name), d.name);
      assert(d.text.indexOf('The Bastion has changed. Here is exactly what happened to yours.\n') === 0, d.text);
      assert(d.text.indexOf('Gold. 120 gp went back into the treasury') !== -1);
      assert(d.text.indexOf('"Back up everything"') !== -1);
      equal(await page.isVisible('[data-test=changes-box]'), true, 'the box is still there');
    });

    await check('the copy is the Bastion exactly as it was (version 3, 2,000 gp, 28 orders plus the Old Mill\'s) and is in "Back up everything"', async () => {
      const keys = await quarantined(page);
      equal(keys.length, 1, keys.join());
      assert(/^tsi\.quarantine\.bastion\.state\.\d{8}-\d{6}$/.test(keys[0]), keys[0]);
      const copy = await page.evaluate(k => TSI.store.get(k), keys[0]);
      equal([copy.v, copy.treasuryGP, copy.pendingOrders.length, copy.log.length], [3, 2000, 29, 200]);
      equal(JSON.stringify(copy), JSON.stringify(withGhost()), 'byte for byte');
      await page.evaluate(() => TSI.store.flush());
      await H.ackChanges(page);
      await page.goto(INDEX);
      await page.waitForSelector('.tsi-card');
      const d = await H.download(page, '[data-test=backup-everything]');
      const file = JSON.parse(d.text);
      const rec = file.records.find(r => r.key === keys[0]);
      assert(rec, 'the copy is in the backup file');
      equal([rec.value.v, rec.note.copy, rec.note.from], [3, true, 'tsi.bastion.state']);
      assert(/Strip Back Overhaul/.test(rec.note.reason), rec.note.reason);
      equal(file.records.find(r => r.key === 'tsi.bastion.state').value.v, 4, 'and the live Bastion is the converted one');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Pressing "I\'ve read this", closing without it, and What changed');
  {
    const { context, page } = await seeded(browser, 'laptop', withGhost());
    await openBastion(page);
    await page.waitForSelector('[data-test=changes-box]');

    await check('closing the box without pressing "I\'ve read this" (Esc) does not mark it read: it shows again after a reload', async () => {
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-test=changes-box]', { state: 'detached' });
      await page.evaluate(() => TSI.store.flush());
      equal((await stored(page)).migration.v4.shown, false, 'saved as not read');
      await page.reload();
      await page.waitForSelector('[data-test=changes-box]');
      equal((await st(page)).migration.v4.shown, false);
      equal(await quarantined(page).then(k => k.length), 1, 'and no second copy is made (it is a version 4 Bastion now)');
    });

    await check('"I\'ve read this" closes it, and it is saved as read', async () => {
      await page.click('[data-test=changes-ok]');
      await page.waitForSelector('[data-test=changes-box]', { state: 'detached' });
      await page.evaluate(() => TSI.store.flush());
      equal((await stored(page)).migration.v4.shown, true);
    });

    await check('a reload does not show it again, and no second copy is kept', async () => {
      await page.reload();
      await page.waitForSelector('[data-test=day-status]');
      await page.waitForTimeout(900);
      equal(await page.$('[data-test=changes-box]'), null);
      equal((await quarantined(page)).length, 1);
      equal((await st(page)).v, 4);
    });

    await check('Management\'s "What changed" opens the same words again, with Close (not "I\'ve read this"), and it stays read', async () => {
      await page.click('[data-test=open-management]');
      await page.waitForSelector('[data-test=changes-row]');
      assert(/The Bastion's change of 22 October 2026 \(Day 40\): 120 gp went back into the treasury; 1 order was cancelled/.test(await bare(page, '[data-test=changes-row]')), await bare(page, '[data-test=changes-row]'));
      await page.click('[data-test=show-changes]');
      await page.waitForSelector('[data-test=changes-box]');
      const text = await bare(page, '[data-test=changes-box]');
      assert(/Gold\. 120 gp went back into the treasury/.test(text), text);
      equal(await page.isVisible('[data-test=changes-ok]'), true);
      equal(await page.textContent('[data-test=changes-ok]'), 'Close');
      await page.click('[data-test=changes-ok]');
      await page.waitForSelector('[data-test=changes-box]', { state: 'detached' });
      await page.evaluate(() => TSI.store.flush());
      equal((await stored(page)).migration.v4.shown, true);
      await page.keyboard.press('Escape');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Nothing of yours changed: a short box that still needs reading');
  {
    const { context, page } = await seeded(browser, 'laptop', HEAVY);
    await openBastion(page);

    await check('the heavy Bastion needs nothing taken out yet, so the box is one line, and nothing is lost: 28 orders, 4 beasts, 200 log lines, 2,000 gp', async () => {
      await page.waitForSelector('[data-test=changes-box]');
      equal(await page.textContent('.tsi-modal__title'), 'The Bastion has been updated; nothing of yours changed.');
      equal(await page.$$eval('[data-test=changes-line]', n => n.length), 0);
      const s = await st(page);
      equal([s.v, s.treasuryGP, s.pendingOrders.length, s.creatures.length, s.log.length, s.migration.v4.changed, s.migration.v4.summary], [4, 2000, 28, 4, 200, false, 'Nothing of yours changed.']);
      await page.waitForFunction(() => TSI.store.keys('quarantine').some(k => k.indexOf('tsi.quarantine.bastion.state') === 0));
    });

    await check('it is read like the long one: it stays until pressed, then is saved as read', async () => {
      await page.reload();
      await page.waitForSelector('[data-test=changes-box]');
      await H.ackChanges(page);
      await page.evaluate(() => TSI.store.flush());
      equal((await stored(page)).migration.v4.shown, true);
      equal((await stored(page)).v, 4);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Nothing moves on while the box is waiting');
  {
    const explorer = { tokens: [], travel: { day: 3 }, grid: {} };
    const { context, page } = await seeded(browser, 'laptop', plain(), explorer);
    await openBastion(page);

    await check('the Explorer is on Day 3 and the Bastion on Day 1, but no day passes until "I\'ve read this" is pressed', async () => {
      await page.waitForSelector('[data-test=changes-box]');
      await page.waitForTimeout(2600);
      equal((await st(page)).day, 1, 'still Day 1 after more than one look at the Explorer');
      await H.ackChanges(page);
      await page.waitForFunction(() => TSI.bastion.debug.state().day === 3 && !TSI.bastion.debug.busy(), null, { timeout: 12000 });
      equal((await st(page)).day, 3);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A version 4 Bastion that an older copy of the suite saved over');
  {
    const converted = clone(HEAVY);
    converted.v = 4;
    converted.migration = { v4: { day: 40, lines: [], summary: 'Nothing of yours changed.', changed: false, again: false, shown: true } };
    converted.pendingOrders.push({ id: 'late', facId: 'old_mill', fnId: 'grind', chosen: null, optionLabel: null, notes: '', label: 'Old Mill: Grind Grain', costGP: 45, issuedDay: 39, dueDay: 44 });
    const { context, page } = await seeded(browser, 'laptop', converted);
    await check('it is cleaned again, with a short box that says why, and a copy is kept', async () => {
      await openBastion(page);
      await page.waitForSelector('[data-test=changes-box]');
      equal(await page.textContent('.tsi-modal__title'), 'The Bastion has been tidied again.');
      const text = await bare(page, '[data-test=changes-box]');
      assert(/An older copy of the suite had saved over your Bastion, so it was converted again\. Nothing was lost\./.test(text), text);
      assert(/Gold\. 45 gp went back into the treasury/.test(text), text);
      const s = await st(page);
      equal([s.treasuryGP, s.pendingOrders.length, s.migration.v4.again, s.migration.v4.shown], [2045, 28, true, false]);
      await page.waitForFunction(() => TSI.store.keys('quarantine').length === 1);
      await H.ackChanges(page);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A Bastion from before the facilities overhaul (version 2) goes through both changes in one go');
  {
    const { context, page } = await seeded(browser, 'laptop', record('bastion-before-overhaul.json'));
    await check('the earlier change\'s corner notice still shows, and the box holds both lists', async () => {
      await openBastion(page);
      await page.waitForSelector('[data-test=changes-box]');
      await H.waitForNotice(page, /The Bastion's facilities have changed: The Smithy joined the Workshop/);
      const text = await bare(page, '[data-test=changes-box]');
      assert(/Facilities \(the change of 13 October 2026\)\. The Smithy joined the Workshop/.test(text), text);
      const s = await st(page);
      equal([s.v, s.treasuryGP, s.pendingOrders.map(o => o.fnId).sort()], [4, 400, ['alchemy', 'smithing']]);
      equal([s.migration.v3.shown, s.migration.v4.shown], [true, false]);
      equal(await quarantined(page).then(k => k.length), 1);
      const copy = await page.evaluate(k => TSI.store.get(k), (await quarantined(page))[0]);
      equal(copy.v, 2, 'the copy is the version 2 Bastion, untouched');
      await H.ackChanges(page);
      await H.dismissNotices(page);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A conversion that cannot be proved safe changes nothing');
  {
    /* A fault put in the conversion on purpose: an extra step that quietly takes 1 gp. */
    const breakIt = () => {
      const t = setInterval(() => {
        const R = window.TSI && TSI.bastion && TSI.bastion.rules;
        if (!R || !R.stripBackSteps) return;
        clearInterval(t);
        R.stripBackSteps.splice(0, 0, { id: 'broken', detect: () => [], run: s => { s.treasuryGP = (parseInt(s.treasuryGP, 10) || 0) - 1; } });
      }, 0);
    };
    const { context, page } = await seeded(browser, 'laptop', clone(HEAVY), null, breakIt);

    await check('the Bastion says it could not convert safely and that nothing has been changed', async () => {
      await page.goto(BASTION);
      await page.waitForSelector('[data-test=convert-unsafe]');
      const text = await bare(page, '[data-test=convert-unsafe]');
      assert(/The Bastion couldn't be converted safely\. Nothing has been changed\./.test(text), text);
      assert(/The treasury would go down/.test(await page.$eval('.tsi-bas-unsafe__why', n => n.textContent)), 'what the check found');
      equal(await page.$('[data-test=changes-box]'), null);
      equal(await page.$('[data-test=day-status]'), null, 'the Bastion itself did not open');
      await H.shot(page, 'migration-unsafe');
    });

    await check('nothing was written and nothing was set aside: the saved Bastion is exactly as it was', async () => {
      await page.waitForTimeout(500);
      await page.evaluate(() => TSI.store.flush());
      const s = await stored(page);
      equal(JSON.stringify(s), JSON.stringify(HEAVY));
      equal((await quarantined(page)).length, 0);
    });

    await check('"Download my Bastion as a file" gives the raw record', async () => {
      const d = await H.download(page, '[data-test=convert-download]');
      equal(d.name, 'tsi-bastion-as-it-was.json');
      equal(JSON.stringify(JSON.parse(d.text)), JSON.stringify(HEAVY));
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The War Table\'s saves are set aside every time the Bastion opens (once the War Table is gone)');
  {
    const converted = clone(HEAVY);
    const { context, page } = await seeded(browser, 'laptop', converted);
    await check('while the War Table is still part of the Bastion its saves are left alone; asked to, the sweep moves them to quarantine', async () => {
      await page.evaluate(() => {
        TSI.store.set('tsi.bastion.warMap', { dataUrl: 'data:image/png;base64,AAAA', key: 'k', name: 'map.png' });
        TSI.store.set('tsi.bastion.warTable', { cols: 22 });
        TSI.store.set('tsi.bastion.warTerrain', {});
        return TSI.store.flush();
      });
      await openBastion(page);
      await H.ackChanges(page);
      equal(await page.evaluate(() => ['warMap', 'warTable', 'warTerrain'].map(k => TSI.store.has('tsi.bastion.' + k))), [true, true, true], 'left alone');
      const moved = await page.evaluate(() => TSI.bastion.debug.sweepOrphans(true));
      equal(moved, ['warMap', 'warTable', 'warTerrain']);
      await page.evaluate(() => TSI.store.flush());
      equal(await page.evaluate(() => ['warMap', 'warTable', 'warTerrain'].map(k => TSI.store.has('tsi.bastion.' + k))), [false, false, false]);
      const keys = await page.evaluate(() => TSI.store.keys('quarantine'));
      equal(['warMap', 'warTable', 'warTerrain'].map(n => keys.filter(k => k.indexOf('tsi.quarantine.bastion.' + n + '.') === 0).length), [1, 1, 1], 'each set aside, not deleted: ' + keys.join());
      assert(await page.evaluate(k => TSI.store.get(k).cols === 22, keys.find(k => k.indexOf('.warTable.') !== -1)), 'with its contents');
      equal(await page.evaluate(() => TSI.bastion.debug.sweepOrphans(true)), [], 'nothing to do when they are gone');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The box on the TV and in a small window');
  for (const size of ['tv', 'smallWindow']) {
    const { context, page } = await seeded(browser, size, withGhost());
    await check('the box fits the ' + size + ' window with its buttons in view, and the page does not scroll sideways', async () => {
      await openBastion(page);
      await page.waitForSelector('[data-test=changes-box]');
      const r = await H.layoutCheck(page, ['[data-test=changes-box]', '[data-test=changes-ok]']);
      equal([r.scrollWidth <= r.clientWidth, r.outOfView], [true, []]);
      await H.shot(page, 'migration-box-' + size);
      await H.ackChanges(page);
    });
    await check('no page errors on the ' + size + ' window', async () => { equal(context.log.errors, []); });
    await context.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
