/* Scarlett Isles: Beast Handler — the Bastion's own calls to the first-meeting sweep, and the old request queue's cleanup
   (Harry, 22 October 2026; the independent review of the Beast Handler steps, fix 13), clicked through from a double-clicked
   index.html with the internet off.
   The first meeting of a beast is rolled by the BASTION, once (R.sweepInitiation, tested on its own in the rules page). Here
   the three places where the Bastion calls it are checked in the real tool:
   - when it opens: a beast that has passed acclimatisation (Bond 1) and has no subspecies is introduced once; one that
     is not acclimatised, and one that already has a subspecies, are left alone; opening again changes nothing;
   - when a conversion report is waiting to be read (a Bastion from before the Strip Back Overhaul): nothing is rolled
     while it is unread, not even after the box is closed with Esc or the page is reloaded; "I've read this" rolls it, once;
   - when a day passes: a beast that became acclimatised since the Bastion opened is introduced as the day passes, once,
     and the next day rolls nothing more.
   And the Beast Handler's old request queue (tsi.beasthandler.queue, from before the app became read-only): a copy left in
   the browser is not read, is deleted when the Bastion or the Beast Handler opens, and is not in Back up everything.
   Run with:  node tests/e2e/beasthandler-sweep.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const BASTION = INDEX + '?tool=bastion';
const QUEUE = 'tsi.beasthandler.queue';
const FIXTURES = path.join(__dirname, '..', 'fixtures');
const HEAVY = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'bastion-v3-heavy.json'), 'utf8')).records.find(r => r.key === 'tsi.bastion.state').value;

const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exDay = page => page.evaluate(() => TSI.explorer.debug.state().travel.day);
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const beast = (s, id) => s.creatures.filter(c => c.id === id)[0];
/* The same value with every object's keys in order (a save and a load can reorder keys; the content is what is compared). */
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
/* The Day Log lines the first meeting wrote for one beast. */
const metLines = (s, name) => s.log.filter(l => l.title === 'Beast Handler' && l.body.indexOf(name + ': first meeting prepared.') === 0).length;

async function newContext(browser) {
  const ctx = await H.newContext(browser, 'laptop', { acceptDownloads: true, backedUp: true });
  await ctx.setOffline(true);
  /* No travel or campfire events and no weather; every die comes up the same (so the first meeting's rolls are known). */
  await ctx.addInitScript(() => { Math.random = () => 0.99; window.TSI_TEST_FIXED_INITIATION = true; });
  return ctx;
}
async function openExplorer(ctx) {
  const p = await ctx.newPage();
  await p.goto(INDEX + '?tool=explorer');
  await p.waitForSelector('[data-test=camp]');
  return p;
}
async function openBastion(ctx) {
  const p = await ctx.newPage();
  await p.goto(BASTION);
  await p.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  return p;
}
async function closeAll(page) {
  for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}
async function camp(ex) {
  await ex.waitForTimeout(400);
  await ex.click('[data-test=camp]');
  for (let n = 0; n < 20; n++) {
    await ex.waitForTimeout(200);
    if (!(await ex.$('.tsi-modal'))) { if (n > 2) break; continue; }
    await ex.click('.tsi-modal__foot button:last-child');
  }
}
/* The Bastion reaches a day by itself; "The Ironbow sends word…" is read and closed on the way. */
async function bastionReaches(ba, day) {
  for (let n = 0; n < 200; n++) {
    if (await ba.$('[data-test=ironbow-word]')) await ba.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary');
    const ok = await ba.evaluate(d => { const s = TSI.bastion.debug.state(); return s.day === d && !s.dayInProgress && !TSI.bastion.debug.busy(); }, day);
    if (ok && !(await ba.$('[data-test=ironbow-word]'))) return;
    await ba.waitForTimeout(250);
  }
  throw new Error('The Bastion didn\'t reach Day ' + day);
}
/* Beasts as the DM's tools leave them: the Pen built, the beasts housed with a handler, at the Bond given. Nothing is rolled by this. */
function setUpBeasts(ba) {
  return ba.evaluate(() => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    s.partyLevel = 9; s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
    s.facilityLevels.beast_pen = 1;
    const mk = (id, species, name, bond, regional) => {
      const c = { id, species, owner: '', name, status: 'housed', home: 'beast_pen', grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira'; c.development.bond.level = bond;
      if (regional) c.development.regional = regional;
      return c;
    };
    s.creatures = [mk('cr-a', 'wyvern', 'Stormwing', 1, ''), mk('cr-b', 'griffin', 'Swiftwing', 0, ''), mk('cr-c', 'dire_wolf', 'Ashfang', 1, 'Icepelt')];
  }));
}

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('The Bastion opens: a beast that has passed acclimatisation and has no subspecies is introduced, once');
  {
    const ctx = await newContext(browser);
    await openExplorer(ctx);
    let ba = await openBastion(ctx);
    let frozen = null;

    await check('putting the beasts in (as the DM tools do) rolls nothing by itself', async () => {
      await setUpBeasts(ba);
      await ba.evaluate(() => TSI.store.flush());
      const s = await bas(ba);
      equal(['cr-a', 'cr-b', 'cr-c'].map(id => !!beast(s, id).development.initiation), [false, false, false]);
      equal(beast(s, 'cr-a').development.regional, undefined, 'no subspecies yet');
    });

    await check('opening the Bastion introduces the Bond 1 beast with no subspecies: a subspecies, three personality lines, the die numbers, one change note, one Day Log line', async () => {
      await ba.reload();
      await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
      const s = await bas(ba);
      const a = beast(s, 'cr-a').development;
      equal([a.initiation.regional, a.regional], ['bloodcrest', 'Bloodcrest']);
      equal(a.initiation.rolls, { dominant: 12, attachment: 8, trigger: 8 }, 'every die comes up the same in this test');
      assert(a.temperament.dominant && a.temperament.attachment && a.temperament.trigger, 'the three lines are written');
      equal(a.profileLog.length, 1, 'one change note');
      equal(metLines(s, 'Stormwing'), 1, 'one Day Log line');
      frozen = canon(a);
    });

    await check('the others are left alone: a beast that is not acclimatised, and one that already has a subspecies', async () => {
      const s = await bas(ba);
      const b = beast(s, 'cr-b').development;
      equal([!!b.initiation, b.regional, b.profileLog || []], [false, undefined, []]);
      const c = beast(s, 'cr-c').development;
      equal([!!c.initiation, c.regional, c.profileLog || []], [false, 'Icepelt', []]);
      equal(metLines(s, 'Swiftwing') + metLines(s, 'Ashfang'), 0);
    });

    await check('opening it again, three times, rolls nothing more: the same numbers, the same lines, one note, one Day Log line', async () => {
      for (let i = 0; i < 3; i++) {
        await ba.reload();
        await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
        await ba.waitForTimeout(2300);   /* longer than the Bastion's own two-second look */
        const s = await bas(ba);
        equal(canon(beast(s, 'cr-a').development), frozen, 'open number ' + (i + 2));
        equal(metLines(s, 'Stormwing'), 1);
      }
    });
    await ctx.close();
  }

  /* ------------------------------------------------------------------ */
  section('A Bastion from before the Strip Back Overhaul: nothing is rolled while its report is unread; "I\'ve read this" rolls once');
  {
    const ctx = await newContext(browser);
    const home = await ctx.newPage();
    await home.goto(INDEX);
    await home.waitForSelector('.tsi-card');
    /* The heavy Bastion (version 3, Day 40) has Elara's wyvern at Bond 1 with no subspecies, and two beasts that already have one. */
    await home.evaluate(s => { TSI.store.set('tsi.bastion.state', s); return TSI.store.flush(); }, HEAVY);
    const ba = await ctx.newPage();
    const elara = async () => beast(await bas(ba), 'elara_wyvern').development;
    const stored = () => ba.evaluate(() => TSI.store.get('tsi.bastion.state', null).creatures.filter(c => c.id === 'elara_wyvern')[0].development);

    await check('the report box is up and Elara\'s wyvern is not introduced: nothing changes under a report that describes the Bastion as converted', async () => {
      await ba.goto(BASTION);
      await ba.waitForSelector('[data-test=changes-box]');
      await ba.waitForTimeout(2600);
      const d = await elara();
      equal([!!d.initiation, d.regional || null], [false, null]);
      equal(metLines(await bas(ba), 'Elara\'s wyvern'), 0);
      equal(!!(await stored()).initiation, false, 'and nothing is saved either');
    });

    await check('closing the box with Esc does not mark it read, and still nothing is rolled', async () => {
      await ba.keyboard.press('Escape');
      await ba.waitForTimeout(2600);
      equal(await ba.$('[data-test=changes-box]'), null, 'the box is closed');
      const d = await elara();
      equal([!!d.initiation, d.regional || null], [false, null]);
      equal((await bas(ba)).migration.v4.shown, false);
    });

    await check('reloading shows the box again (it was never read), and still nothing is rolled', async () => {
      await ba.reload();
      await ba.waitForSelector('[data-test=changes-box]');
      await ba.waitForTimeout(2600);
      const d = await elara();
      equal([!!d.initiation, d.regional || null], [false, null]);
    });

    let frozen = null;
    await check('"I\'ve read this" introduces Elara\'s wyvern, once; the two beasts that already had a subspecies are untouched', async () => {
      await H.ackChanges(ba);
      await ba.waitForFunction(() => { const c = TSI.bastion.debug.state().creatures.filter(x => x.id === 'elara_wyvern')[0]; return c.development.initiation; }, null, { timeout: 8000 });
      const s = await bas(ba);
      const d = beast(s, 'elara_wyvern').development;
      equal([d.initiation.regional, d.regional], ['bloodcrest', 'Bloodcrest']);
      equal(d.profileLog.length, 1);
      equal(metLines(s, 'Elara\'s wyvern'), 1, 'one Day Log line');
      equal(beast(s, 'cr-hv-griffin-swiftwing').development.regional, 'Highland');
      equal(beast(s, 'cr-hv-wolf-ashfang').development.regional, 'Northern Moor');
      equal([!!beast(s, 'cr-hv-griffin-swiftwing').development.initiation, !!beast(s, 'cr-hv-wolf-ashfang').development.initiation], [false, false]);
      /* The Bastion saves a moment after each change; wait for that before the page is reloaded (a person takes longer than this). */
      await ba.evaluate(() => TSI.store.flush());
      equal((await stored()).regional, 'Bloodcrest', 'it was saved');
      frozen = canon(d);
    });

    await check('opening it again rolls nothing more', async () => {
      for (let i = 0; i < 2; i++) {
        await ba.reload();
        await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
        await ba.waitForTimeout(2300);
        equal(await ba.$('[data-test=changes-box]'), null, 'the read report does not come back');
        const s = await bas(ba);
        equal(canon(beast(s, 'elara_wyvern').development), frozen);
        equal(metLines(s, 'Elara\'s wyvern'), 1);
      }
    });
    await ctx.close();
  }

  /* ------------------------------------------------------------------ */
  section('A day passes: a beast that has become acclimatised since the Bastion opened is introduced as the day passes, once');
  {
    const ctx = await newContext(browser);
    const ex = await openExplorer(ctx);
    const ba = await openBastion(ctx);
    await setUpBeasts(ba);
    await ba.evaluate(() => TSI.store.flush());
    /* Open it again so the open-time sweep has already done its work; then a beast becomes acclimatised while it is open. */
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    let day0 = 0;

    await check('while the Bastion is open, a beast reaching Bond 1 is not introduced by merely being saved', async () => {
      await ba.evaluate(() => TSI.bastion.debug.change(s => { s.creatures.filter(c => c.id === 'cr-b')[0].development.bond.level = 1; }));
      await ba.evaluate(() => TSI.store.flush());
      await ba.waitForTimeout(2600);   /* the Bastion looks at its clock every two seconds */
      const s = await bas(ba);
      day0 = s.day;
      equal([!!beast(s, 'cr-b').development.initiation, beast(s, 'cr-b').development.regional], [false, undefined]);
      equal(metLines(s, 'Swiftwing'), 0);
    });

    let frozen = null;
    await check('the Explorer makes camp: the Bastion passes the day and introduces it, once', async () => {
      await closeAll(ex); await closeAll(ba);
      await camp(ex);
      const day = await exDay(ex);
      equal(day, day0 + 1);
      await bastionReaches(ba, day);
      const s = await bas(ba);
      const d = beast(s, 'cr-b').development;
      equal([d.initiation && d.initiation.regional, d.regional], ['dawnmantle', 'Dawnmantle'], 'a griffin meets as a Dawnmantle');
      equal(d.profileLog.length, 1);
      equal(metLines(s, 'Swiftwing'), 1);
      equal(s.day, day0 + 1, 'and the day did pass');
      frozen = canon(d);
    });

    await check('the next day rolls nothing more, for anyone', async () => {
      const before = canon((await bas(ba)).creatures.map(c => [c.id, c.development && c.development.initiation, c.development && c.development.regional]));
      await closeAll(ex); await closeAll(ba);
      await camp(ex);
      await bastionReaches(ba, await exDay(ex));
      const s = await bas(ba);
      equal(canon(beast(s, 'cr-b').development.initiation), canon(JSON.parse(frozen).initiation));
      equal(canon(s.creatures.map(c => [c.id, c.development && c.development.initiation, c.development && c.development.regional])), before);
      equal(metLines(s, 'Swiftwing'), 1);
      equal(beast(s, 'cr-b').development.profileLog.length, 1);
    });
    await ctx.close();
  }

  /* ------------------------------------------------------------------ */
  section('The old request queue: ignored, deleted when the Bastion or the Beast Handler opens, and never in Back up everything');
  {
    const ctx = await newContext(browser);
    const home = await ctx.newPage();
    await home.goto(INDEX);
    await home.waitForSelector('[data-test=backup-everything]');
    const seed = () => home.evaluate(key => { TSI.store.set(key, { v: 1, items: [{ id: 'old-request', text: 'from before the app became read-only' }] }); return TSI.store.flush(); }, QUEUE);
    const backupKeys = async () => JSON.parse((await H.download(home, '[data-test=backup-everything]')).text).records.map(r => r.key);
    const there = page => page.evaluate(key => TSI.store.get(key, null) !== null, QUEUE);
    const gone = page => page.waitForFunction(key => TSI.store.get(key, null) === null, QUEUE, { timeout: 8000 });

    await check('(the check has teeth) a queue left in the browser IS in Back up everything until something deletes it', async () => {
      await seed();
      equal(await there(home), true);
      assert((await backupKeys()).indexOf(QUEUE) !== -1, 'the seeded key is in the backup');
    });

    await check('opening the Beast Handler on the laptop deletes it, and the app does not use it', async () => {
      const bh = await ctx.newPage();
      await bh.goto(INDEX + '?tool=beasthandler');
      await bh.waitForSelector('[data-test=bh-root]');
      await gone(bh);
      await bh.evaluate(() => TSI.store.flush());
      equal(await bh.evaluate(key => TSI.store.fresh(key, null), QUEUE), null, 'gone from the saved copy too');
      equal(await bh.$('[data-test=bh-queue], [data-test=bh-outbox], [data-test=bh-submit]'), null, 'and nothing of it is on the screen');
      equal(await bh.$$eval('.tsi-bh button', n => n.map(b => b.getAttribute('data-test')).filter(Boolean)).then(a => a.filter(t => /queue|request|submit|outbox/.test(t))), []);
      await bh.close();
    });

    await check('Back up everything no longer holds it', async () => {
      await home.reload();
      await home.waitForSelector('[data-test=backup-everything]');
      equal(await there(home), false);
      equal((await backupKeys()).indexOf(QUEUE), -1);
    });

    await check('opening the Bastion deletes a queue left behind too', async () => {
      await seed();
      equal(await there(home), true);
      const ex = await openExplorer(ctx);
      const ba = await openBastion(ctx);
      await gone(ba);
      await ba.evaluate(() => TSI.store.flush());
      await home.reload();
      await home.waitForSelector('[data-test=backup-everything]');
      equal(await there(home), false);
      equal((await backupKeys()).indexOf(QUEUE), -1);
      await ex.close(); await ba.close();
    });

    await check('nothing went wrong or reached for the internet', async () => {
      equal(ctx.log.net, []);
      equal(ctx.log.failed, []);
      equal(ctx.log.errors, []);
    });
    await ctx.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
