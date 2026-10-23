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
  return { v: 3, day: 1, anchored: true, treasuryGP: 100, partyLevel: 7, builtExtras: [], pendingOrders: [], warehouse: [], log: [] };
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

/* A browser set up the way the "copy first" tests need it: no built-in database, so the suite saves to the
   browser's plain storage (where a copy can really fail for lack of room), and a log of every write to it.
   What goes wrong is chosen from the test with setEnv (below), which puts it in window.__tsiEnv for every page
   opened afterwards (an init script, not sessionStorage: that was sometimes empty on the next page on a busy machine):
     quota       how many characters of plain storage the browser allows (a write past it fails, as a full browser does)
     failStart   the Bastion's start-up throws once the copy is kept (an error part-way through opening)
     noWar       the War Table is not part of the Bastion, so its leftover saves are set aside
     breakAudit  a fault is put into the conversion, so the safety check fails
   Everything looks at window.__tsiEnv when it happens, so it does not matter which init script ran first. */
const safetyBrowser = () => {
  try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (e) { /* already gone */ }
  const env = () => window.__tsiEnv || {};
  window.__writes = [];
  const realSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage) {
      const quota = env().quota;
      if (quota) {
        let total = 0;
        for (let i = 0; i < this.length; i++) { const kk = this.key(i); total += kk.length + (this.getItem(kk) || '').length; }
        const old = this.getItem(k);
        total += String(k).length + String(v).length - (old === null ? 0 : String(k).length + old.length);
        if (total > quota) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      let ver = null;
      try { const r = JSON.parse(v); ver = r && r.value && typeof r.value === 'object' ? (r.value.v === undefined ? null : r.value.v) : null; } catch (e) { ver = null; }
      if (!/^tsi\.suite\./.test(String(k))) window.__writes.push({ k: String(k), ver });
    }
    return realSet.call(this, k, v);
  };
  /* Run something the moment a given file of the suite has been loaded, before any later file or the tool itself starts
     (no timer to lose a race on a busy machine). */
  const afterScript = (pattern, then) => {
    const append = Node.prototype.appendChild;
    Node.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && pattern.test(n.src || '')) n.addEventListener('load', then);
      return append.call(this, n);
    };
  };
  afterScript(/tools\/bastion\/strip-back-rules\.js$/, () => {
    if (env().failStart) TSI.bastion.rules.settlePlots = function () { throw new Error('A fault put in on purpose, once the copy was kept.'); };
    if (env().breakAudit) TSI.bastion.rules.stripBackSteps.splice(0, 0, { id: 'broken', detect: () => [], run: s => { s.treasuryGP = (parseInt(s.treasuryGP, 10) || 0) - 1; } });
  });
  afterScript(/war-table\.js$/, () => { if (env().noWar && window.TSI && TSI.bastion) delete TSI.bastion.warTable; });
};
/* A browser that keeps nothing at all (no built-in database and no plain storage): saves live in memory only. */
const keepsNothing = () => {
  try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (e) { /* already gone */ }
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage is turned off.', 'SecurityError'); } });
};
/* Puts a Bastion into a memory-only browser's saves (the way Import or Restore would) once the Bastion's first file has loaded, before it opens. */
const seedMemory = state => {
  const append = Node.prototype.appendChild;
  let done = false;
  Node.prototype.appendChild = function (n) {
    if (!done && n && n.tagName === 'SCRIPT' && /tools\/bastion\//.test(n.src || '')) {
      done = true;
      TSI.store.set('tsi.bastion.state', state);
    }
    return append.call(this, n);
  };
};
/* From the next page this window opens (the one it is on is left as it is). */
const setEnv = (page, env) => page.context().addInitScript(e => { window.__tsiEnv = e; }, env);
/* Everything the suite has saved in plain storage, exactly as written (not the window heartbeat the suite keeps beside it). */
const plainStorage = page => page.evaluate(() => Object.keys(localStorage).filter(k => !/^tsi\.suite\./.test(k)).sort().map(k => [k, localStorage.getItem(k)]));
const WAR_KEYS = ['warMap', 'warTable', 'warTerrain'];
async function putWarSaves(page) {
  await page.evaluate(() => {
    TSI.store.set('tsi.bastion.warMap', { dataUrl: 'data:image/png;base64,AAAA', key: 'k', name: 'map.png' });
    TSI.store.set('tsi.bastion.warTable', { cols: 22 });
    TSI.store.set('tsi.bastion.warTerrain', {});
    return TSI.store.flush();
  });
}
const warSavesLeft = page => page.evaluate(names => names.map(k => TSI.store.has('tsi.bastion.' + k)), WAR_KEYS);
const writeLog = page => page.evaluate(() => window.__writes.slice());

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
      equal(s.treasuryGP, 3765, '2,000 gp, the 1,495 gp the war game\'s cancelled orders and the Riding Harness cost, and the 120 gp of the Old Mill\'s');
      equal(s.pendingOrders.length, 20, 'the 28 orders the Bastion knows, less the eight cancelled (seven for the war game, the harness) and the Old Mill\'s; the Roost\'s House order moved');
      equal(s.migration.v4.shown, false);
      equal('lastEvent' in s || 'lastEventDay' in s, false, 'the Bastion keeps no event record any more (S05)');
    });

    await check('the box has the headline, the lines in plain English, and two buttons', async () => {
      const text = await bare(page, '[data-test=changes-box]');
      assert(text.indexOf('The Bastion has changed. Here is exactly what happened to yours.') !== -1, text);
      assert(/Gold\. 1,765 gp went back into the treasury \(on Day 40 it went from 2,000 gp to 3,765 gp\): Armoury: Arm Defenders, 300 gp; War Room: Recruit \(Archers \(50\)\), 120 gp; War Room: Drill a Regiment \(Line Infantry I → Trained\), 75 gp; Menagerie: Recruit Beast \(Tiger\), 1,000 gp; Dire Wolf Den: Riding Harness \(Ashfang\), 150 gp; Old Mill: Grind Grain, 120 gp\./.test(text), text);
      assert(/Trade\. The Commercial Convoy you had ready for the next ship is gone with the Barracks\. It was a charge for the next ship, not gold, so nothing goes back to the treasury\. The Protected Maritime Approaches, in force until Day 44, are gone with the Watchtower\. Ships already at sea are not affected\./.test(text), text);
      equal(await bare(page, '[data-test=changes-now]'), 'Right now the treasury holds 3,765 gp.', 'the balance as it is now is worked out live, on the first reading only');
      assert(/Goods\. 3 lots of Raw Timber went back to the Warehouse\./.test(text), text);
      assert(/Orders\. 9 orders were cancelled: Barracks: Recruit Defenders \(the Barracks is gone with the war game\); /.test(text), text);
      assert(/War Action \(the war game was removed; what declaring war cost you in Honour\/Respect and Political Capital is not given back\)/.test(text), text);
      assert(/Dire Wolf Den: Riding Harness \(Ashfang\) \(training and riding are gone: beasts now bond day by day on the road\); Old Mill: Grind Grain \(the Old Mill is no longer part of the Bastion\)\. One order moved with its place, keeping its due day: Wyvern Roost: House a Wyvern \(Skyrender\) \(now at the Beast Pen\)\./.test(text), text);
      assert(/Places that joined others\. The Wyvern Roost, Griffin Tower and Dire Wolf Den have become one Beast Pen\. It keeps one beast of each kind: a wyvern, a griffin, a dire wolf, a buckbear and a fellcat\. The other slots are free\./.test(text), text);
      assert(/Beasts\. All 4 of your beasts are still here, with their names, handlers, bonds and Chronicles: Elara's wyvern, Swiftwing, Ashfang and Skyrender\./.test(text), text);
      assert(/Places that are gone\. Barracks, Armoury, Watchtower, War Room and Menagerie are gone with the war game\. The War Room's and the Menagerie's slots are free\. The Old Mill is no longer part of the Bastion; its slot is free\./.test(text), text);
      assert(/The army and the war\. 6 defenders, 1 tiger \(bought for 1,000 gp\), 1 giant vulture \(bought for 1,000 gp\), 4 regiments and 2 Lieutenants are gone with the war game\. What was spent on them is not given back\. /.test(text), text);
      assert(/Clan Bacca was at war with you, and that war is over\. The Honour\/Respect and Political Capital the war had already cost you are not changed\. Use Change a score in the DM doc if you want them back\./.test(text), text);
      assert(/Your Party\. A party can no longer found a Clan, so yours, \u201cClan Ironbow\u201d, is not one any more\. Its name is now your Party Name, and shows above your crest\. Its chief \(Harry\), its motto \(\u201cRoot and Steel\u201d\) and its Clan Honour \(55\) are not kept in the Bastion, but the copy of your Bastion that was set aside has everything\. Your crest stays as it is\./.test(text), text);
      assert(/Bastion events\. The Bastion no longer has events, so the last one it rolled \(Friendly Visitors, Day 29\) is not kept\. It was only a note for you; nothing in it changed the Bastion's numbers\./.test(text), text);
      assert(/A copy of your Bastion exactly as it was is kept in "Back up everything"/.test(text), text);
      assert(!/undefined|null|NaN|old_mill|\[object/.test(text), 'no code words');
      equal(await page.$$eval('[data-test=changes-line]', n => n.length), 10);
      equal(await page.$$eval('[data-test=changes-line] strong', n => n.map(x => x.textContent)), ['Gold.', 'Trade.', 'Goods.', 'Orders.', 'Places that are gone.', 'Places that joined others.', 'The army and the war.', 'Your Party.', 'Beasts.', 'Bastion events.']);
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
      assert(d.text.indexOf('Gold. 1,765 gp went back into the treasury') !== -1);
      assert(d.text.indexOf('"Back up everything"') !== -1);
      equal(await page.isVisible('[data-test=changes-box]'), true, 'the box is still there');
    });

    await check('the copy is the Bastion exactly as it was (version 3, 2,000 gp, 28 orders plus the Old Mill\'s, the army and the war still in it) and is in "Back up everything"', async () => {
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

    await check('Management\'s "What changed" opens the same words again, with Close (not "I\'ve read this"), and it stays read; after play the words are still true', async () => {
      /* The party spends and earns: the treasury is no longer what it was when the conversion happened. */
      await page.evaluate(() => TSI.bastion.debug.change(s => { s.treasuryGP = 9999; }));
      await page.click('[data-test=open-management]');
      await page.waitForSelector('[data-test=changes-row]');
      assert(/The Bastion's change of 22 October 2026 \(Day 40\): The three beast buildings became one Beast Pen; 1,765 gp went back into the treasury; 9 orders were cancelled/.test(await bare(page, '[data-test=changes-row]')), await bare(page, '[data-test=changes-row]'));
      await page.click('[data-test=show-changes]');
      await page.waitForSelector('[data-test=changes-box]');
      const text = await bare(page, '[data-test=changes-box]');
      assert(/Gold\. 1,765 gp went back into the treasury \(on Day 40 it went from 2,000 gp to 3,765 gp\)/.test(text), text);
      assert(!/\b(it is now|is now at|which is now)\b/i.test(text), 'nothing in it claims what a balance is now, as it has moved on: ' + text);
      equal(await page.$('[data-test=changes-now]'), null, 'the live balance is only for the first reading');
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
  section('A report with nothing in it: a short box that still needs reading');
  {
    /* No real Bastion has one since the war game went (every version 3 Bastion had the Barracks, Armoury and Watchtower to say goodbye to),
       but the short box is still there for a report with no lines, so it is made here by hand. */
    const { context, page } = await seeded(browser, 'laptop', plain());
    await openBastion(page);
    await page.waitForSelector('[data-test=changes-box]');
    await H.ackChanges(page);
    await page.evaluate(() => TSI.bastion.debug.change(s => { s.migration.v4 = { day: 1, lines: [], summary: 'Nothing of yours changed.', changed: false, again: false, shown: false }; }));
    await page.evaluate(() => TSI.store.flush());

    await check('it says nothing of yours changed, with no lines; and nothing is lost', async () => {
      await page.reload();
      await page.waitForSelector('[data-test=changes-box]');
      equal(await page.textContent('.tsi-modal__title'), 'The Bastion has been updated; nothing of yours changed.');
      equal(await page.$$eval('[data-test=changes-line]', n => n.length), 0);
      const s = await st(page);
      equal([s.v, s.treasuryGP, s.migration.v4.changed, s.migration.v4.summary], [4, 100, false, 'Nothing of yours changed.']);
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
    /* The heavy Bastion after its conversion, as the Bastion saves it (made by opening it once). */
    const base = await (async () => {
      const first = await seeded(browser, 'laptop', clone(HEAVY));
      await openBastion(first.page);
      await first.page.waitForSelector('[data-test=changes-box]');
      await H.ackChanges(first.page);
      await first.page.evaluate(() => TSI.store.flush());
      const s = await stored(first.page);
      await first.context.close();
      return s;
    })();
    const converted = clone(base);
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
      equal([s.treasuryGP, s.pendingOrders.length, s.migration.v4.again, s.migration.v4.shown], [base.treasuryGP + 45, base.pendingOrders.length, true, false]);
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
      assert(/The treasury (would go down|changes by)/.test(await page.$eval('.tsi-bas-unsafe__why', n => n.textContent)), 'what the check found');
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
  section('The War Table\'s saves are set aside every time the Bastion opens (the War Table is gone)');
  {
    const WAR_KEYS = ['warMap', 'warTable', 'warTerrain'];
    const has = page => page.evaluate(ks => ks.map(k => TSI.store.has('tsi.bastion.' + k)), WAR_KEYS);
    const plantWarSaves = page => page.evaluate(() => {
      TSI.store.set('tsi.bastion.warMap', { dataUrl: 'data:image/png;base64,AAAA', key: 'k', name: 'map.png' });
      TSI.store.set('tsi.bastion.warTable', { cols: 22 });
      TSI.store.set('tsi.bastion.warTerrain', {});
      return TSI.store.flush();
    });
    const { context, page } = await seeded(browser, 'laptop', clone(HEAVY));
    await check('opening the Bastion converts it and then sets the three saves aside in quarantine: never deleted, with their contents', async () => {
      await plantWarSaves(page);
      equal(await has(page), [true, true, true]);
      await openBastion(page);
      await H.ackChanges(page);
      await page.waitForFunction(ks => ks.every(k => !TSI.store.has('tsi.bastion.' + k)), WAR_KEYS);
      await page.evaluate(() => TSI.store.flush());
      equal(await has(page), [false, false, false]);
      const keys = await page.evaluate(() => TSI.store.keys('quarantine'));
      equal(WAR_KEYS.map(n => keys.filter(k => k.indexOf('tsi.quarantine.bastion.' + n + '.') === 0).length), [1, 1, 1], 'each set aside, not deleted: ' + keys.join());
      assert(await page.evaluate(k => TSI.store.get(k).cols === 22, keys.find(k => k.indexOf('.warTable.') !== -1)), 'with its contents');
      equal((await st(page)).v, 4);
    });
    await check('a Restore of an old backup brings them back, and the next open sets them aside again (a second copy each)', async () => {
      await plantWarSaves(page);
      await page.reload();
      await page.waitForSelector('[data-test=day-status]');
      await page.waitForFunction(ks => ks.every(k => !TSI.store.has('tsi.bastion.' + k)), WAR_KEYS);
      await page.evaluate(() => TSI.store.flush());
      const keys = await page.evaluate(() => TSI.store.keys('quarantine'));
      equal(WAR_KEYS.map(n => keys.filter(k => k.indexOf('tsi.quarantine.bastion.' + n + '.') === 0).length), [2, 2, 2], keys.join());
      equal(await page.evaluate(() => TSI.bastion.debug.sweepOrphans()), [], 'nothing to do when they are gone');
    });
    await context.close();

    /* A conversion that cannot be proved safe changes nothing: not even these. */
    const breakIt = () => {
      const t = setInterval(() => {
        const R = window.TSI && TSI.bastion && TSI.bastion.rules;
        if (!R || !R.stripBackSteps) return;
        clearInterval(t);
        R.stripBackSteps.splice(0, 0, { id: 'broken', detect: () => [], run: s => { s.treasuryGP = (parseInt(s.treasuryGP, 10) || 0) - 1; } });
      }, 0);
    };
    const unsafe = await seeded(browser, 'laptop', clone(HEAVY), null, breakIt);
    await check('when the conversion fails its check, the three saves are left exactly where they are', async () => {
      await plantWarSaves(unsafe.page);
      await unsafe.page.goto(BASTION);
      await unsafe.page.waitForSelector('[data-test=convert-unsafe]');
      await unsafe.page.waitForTimeout(500);
      equal(await has(unsafe.page), [true, true, true]);
      equal((await quarantined(unsafe.page)).length, 0);
    });
    await unsafe.context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A copy that cannot be kept stops the conversion before anything is written (the browser\'s storage is full)');
  {
    const { context, page } = await seeded(browser, 'laptop', withGhost(), null, safetyBrowser);
    await putWarSaves(page);
    const before = await plainStorage(page);
    const room = await page.evaluate(() => Object.keys(localStorage).reduce((n, k) => n + k.length + localStorage.getItem(k).length, 0));
    await setEnv(page, { quota: room + 300, noWar: true });

    await check('the Bastion says it could not convert, that nothing has been changed, and that no safe copy could be confirmed', async () => {
      equal(await page.evaluate(() => TSI.store.mode), 'local', 'the browser is saving to its plain storage');
      await page.goto(BASTION);
      await page.waitForSelector('[data-test=convert-unsafe]');
      const text = await bare(page, '[data-test=convert-unsafe]');
      assert(/The Bastion couldn't be converted safely\. Nothing has been changed\./.test(text), text);
      assert(/that copy could not be kept, so it stopped/.test(text), 'says why: ' + text);
      assert(/storage space for the suite is full/.test(text), 'the reason: ' + text);
      assert(/No safe copy of your Bastion could be confirmed, so nothing was converted and nothing was written\./.test(text), text);
      equal(await page.$('[data-test=changes-box]'), null);
      equal(await page.$('[data-test=day-status]'), null, 'the Bastion itself did not open');
      await H.shot(page, 'migration-copy-failed');
    });

    await check('nothing was written: the saved Bastion and everything else is byte for byte as it was, nothing set aside, nothing marked converted', async () => {
      await page.waitForTimeout(600);
      await page.evaluate(() => TSI.store.flush());
      equal(await plainStorage(page), before);
      const writes = await writeLog(page);
      equal(writes.filter(w => /tsi\.bastion\.state$/.test(w.k)), [], 'the Bastion was never written');
      equal(writes.filter(w => w.ver === 4), [], 'nothing version 4 was written');
      equal(writes.filter(w => /quarantine/.test(w.k)).length, 0, 'nothing set aside');
      equal(await page.evaluate(() => TSI.store.get('tsi.bastion.state').v), 3);
    });

    await check('the War Table\'s saves were not touched either (they are only set aside once the converted Bastion is safely saved)', async () => {
      equal(await warSavesLeft(page), [true, true, true]);
    });

    await check('"Download my Bastion as a file" gives the raw record', async () => {
      const d = await H.download(page, '[data-test=convert-download]');
      equal(JSON.stringify(JSON.parse(d.text)), JSON.stringify(withGhost()));
    });

    await check('with room again it converts: the copy is kept first, then the converted Bastion is saved, and only then are the War Table\'s saves set aside', async () => {
      await setEnv(page, { noWar: true });
      await page.goto(BASTION);
      await page.waitForSelector('[data-test=changes-box]');
      /* By the time the box is on screen, the converted Bastion is already saved. */
      const live = await page.evaluate(() => { const k = Object.keys(localStorage).find(x => /tsi\.bastion\.state$/.test(x)); return JSON.parse(localStorage.getItem(k)).value.v; });
      equal(live, 4, 'the saved Bastion is version 4 when the box appears');
      await page.waitForFunction(() => ['warMap', 'warTable', 'warTerrain'].every(k => !TSI.store.has('tsi.bastion.' + k)), null, { timeout: 4000 });
      await page.evaluate(() => TSI.store.flush());
      const writes = await writeLog(page);
      const at = f => writes.findIndex(f);
      const copyAt = at(w => /quarantine\.bastion\.state\./.test(w.k));
      const stateAt = at(w => /tsi\.bastion\.state$/.test(w.k) && w.ver === 4);
      const warAt = at(w => /quarantine\.bastion\.war/.test(w.k));
      assert(copyAt !== -1 && stateAt !== -1 && warAt !== -1, 'all three happened: ' + JSON.stringify(writes.map(w => w.k.slice(-34))));
      assert(copyAt < stateAt, 'the copy was written before the converted Bastion');
      assert(stateAt < warAt, 'the converted Bastion was written before the War Table\'s saves were moved');
      const copies = await quarantined(page);
      equal(copies.length, 1);
      equal(JSON.stringify(await page.evaluate(k => TSI.store.get(k), copies[0])), JSON.stringify(withGhost()), 'the copy is the Bastion exactly as it was');
      await H.ackChanges(page);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A browser that keeps nothing cannot claim a copy exists (memory only)');
  {
    const { context, page } = await seeded(browser, 'laptop', withGhost(), null, keepsNothing);
    await check('the store says it is holding saves in memory only, and keepCopy gives no copy and says why', async () => {
      equal(await page.evaluate(() => TSI.store.mode), 'memory');
      const out = await page.evaluate(() => TSI.store.keepCopy('tsi.bastion.state', 'test').then(k => ({ k, why: TSI.store.copyProblem(), copies: TSI.store.keys('quarantine'), v: TSI.store.get('tsi.bastion.state').v })));
      equal(out.k, null);
      assert(/not keeping the suite's saves at all/.test(out.why), out.why);
      equal(out.copies, [], 'nothing claimed as kept');
      equal(out.v, 3, 'the Bastion in memory is untouched');
    });
    await context.close();
  }
  {
    /* The Bastion itself, opened in such a browser with a Bastion from before the change in its memory. */
    const context = await H.newContext(browser, 'laptop', { acceptDownloads: true });
    await context.setOffline(true);
    await context.addInitScript(keepsNothing);
    await context.addInitScript(seedMemory, withGhost());
    const page = await context.newPage();
    await check('the Bastion does not convert: it says plainly that nothing is kept in this browser, that no safe copy could be confirmed, and that nothing has been changed', async () => {
      await page.goto(BASTION);
      await page.waitForSelector('[data-test=convert-unsafe]');
      equal(await page.evaluate(() => TSI.store.mode), 'memory');
      const text = await bare(page, '[data-test=convert-unsafe]');
      assert(/The Bastion couldn't be converted safely\. Nothing has been changed\./.test(text), text);
      assert(/not keeping the suite's saves between visits at all/.test(text), 'says what is wrong: ' + text);
      assert(/no copy of your Bastion can be kept/.test(text), text);
      assert(/that file is the only copy that will last/.test(text), text);
      assert(!/making room/.test(text), 'no advice about making room, which would not help here: ' + text);
      assert(/No safe copy of your Bastion could be confirmed, so nothing was converted and nothing was written\./.test(text), text);
      equal(await page.$('[data-test=changes-box]'), null);
      equal(await page.$('[data-test=day-status]'), null, 'the Bastion itself did not open');
    });
    await check('the Bastion in memory is exactly as it was (version 3), no copy and nothing set aside is claimed, and the download gives it back', async () => {
      await page.waitForTimeout(600);
      const out = await page.evaluate(() => ({ v: TSI.store.get('tsi.bastion.state').v, copies: TSI.store.keys('quarantine'), migration: !!TSI.store.get('tsi.bastion.state').migration }));
      equal(out.v, 3);
      equal(out.copies, []);
      equal(out.migration, false, 'nothing marked converted');
      const d = await H.download(page, '[data-test=convert-download]');
      equal(JSON.stringify(JSON.parse(d.text)), JSON.stringify(withGhost()));
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A conversion that fails its check leaves the War Table\'s saves alone');
  {
    const { context, page } = await seeded(browser, 'laptop', withGhost(), null, safetyBrowser);
    await putWarSaves(page);
    const before = await plainStorage(page);
    await setEnv(page, { breakAudit: true, noWar: true });
    await check('the unsafe page shows, nothing is written, and the War Table\'s saves are still where they were', async () => {
      await page.goto(BASTION);
      await page.waitForSelector('[data-test=convert-unsafe]');
      await page.waitForTimeout(600);
      await page.evaluate(() => TSI.store.flush());
      equal(await plainStorage(page), before);
      equal(await warSavesLeft(page), [true, true, true]);
      equal((await writeLog(page)).length, 0, 'not one write');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A start-up that fails part-way never leaves the box over an error page');
  {
    const { context, page } = await seeded(browser, 'laptop', withGhost(), null, safetyBrowser);
    await setEnv(page, { failStart: true, noWar: true });
    await check('the Bastion says it could not open, and the box never opens over it', async () => {
      await page.goto(BASTION);
      await page.waitForSelector('.tsi-modal__details');
      assert(/on purpose/.test(await bare(page, '.tsi-modal__details')), 'it is the fault that was put in');
      await page.waitForTimeout(800);
      equal(await page.$('[data-test=changes-box]'), null);
      equal(await page.$('[data-test=day-status]'), null);
    });
    await check('the copy of the Bastion as it was is safe, and next time (the fault gone) the box opens and says what changed', async () => {
      await page.evaluate(() => TSI.store.flush());
      await setEnv(page, { noWar: true });
      await page.goto(BASTION);
      await page.waitForSelector('[data-test=changes-box]');
      equal(await page.evaluate(() => !!TSI.store.get('tsi.bastion.state').migration.v4.lines.length), true, 'it has its lines');
      const copies = await quarantined(page);
      assert(copies.length >= 1, 'a copy is kept');
      for (const k of copies) equal(JSON.stringify(await page.evaluate(k2 => TSI.store.get(k2), k)), JSON.stringify(withGhost()), 'each copy is the Bastion exactly as it was');
      await H.ackChanges(page);
      equal(await page.evaluate(() => TSI.store.get('tsi.bastion.state').migration.v4.shown), true);
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
