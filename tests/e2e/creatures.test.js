/* The creatures and the Beast Pen (pull request 7 of the facilities overhaul,
   Harry's answers of 14 October 2026; the Beast Pen replaced the Wyvern Roost,
   Griffin Tower and Dire Wolf Den on 22 October 2026), clicked through from a
   double-clicked index.html with the internet off, with the Explorer and the
   Bastion open side by side:
   - the Scholar (Workshop Level 3): Prepare Overland Travel Charts
     makes 1 Overland chart in 4 days, with no gold;
   - the Beast Pen builds in a construction slot in 21 days and brings no beast;
   - Grant a creature… in the Explorer: five kinds, "the Beast Pen" named once;
     the Bastion holds a named griffin waiting for a home, with a notice and a
     row in Management's Changes from the Explorer, and the Explorer's Sent to
     the Bastion says Applied;
   - House Beast Here (3 days) houses it; a second griffin waits ("The Beast
     Pen keeps one griffin at a time"); a dire wolf, a buckbear and a fellcat
     are housed beside it;
   - rename and release; Demolish is refused while a beast lives there;
   - a reload adds nothing;
   - the panel and the Grant dialog fit the laptop and the TV;
   - Harry's sample file imports on the test page and its three old buildings
     become the one Pen, and the real suite refuses it.
   The Pen itself (acclimatising, going out on the road, Bonding Days) is in
   tests/e2e/beast-pen.test.js.
   Run with:  node tests/e2e/creatures.test.js */
'use strict';

const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
/* The test page, where Harry tries the sample file (it only takes test-page files). */
const HARNESS = H.fileUrl('tests/harness.html');
const SAMPLE = path.join(__dirname, '..', 'fixtures', 'bastion-pr7-sample.json');
const CHART = 'overland_chart';
const CHART_ORDER = 'workshop__prepare_overland_travel_charts';
const HOUSE = 'beast_pen__house_beast';

const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exs = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const qty = (s, id) => s.warehouse.filter(w => w.goodId === id).reduce((n, w) => n + w.qty, 0);
const lastModal = page => page.$$eval('.tsi-modal', ms => ms[ms.length - 1].textContent.replace(/\s+/g, ' ').trim());
const logText = s => s.log.map(l => l.body).join(' | ');
const byName = (s, name) => s.creatures.filter(c => c.name === name)[0];
/* The creatures as the Bastion keeps them: [id, kind, name, status, home]. */
const register = s => s.creatures.map(c => [c.id, c.species, c.name, c.status, c.home]);
const sentTop = page => page.$eval('[data-test=sent]', n => ({
  status: n.getAttribute('data-status'),
  title: n.querySelector('strong').textContent,
  line: n.querySelector('[data-test=sent-line]').textContent
}));

async function context(browser, size) {
  const ctx = await H.newContext(browser, size || 'laptop', { acceptDownloads: true, backedUp: true });
  await ctx.setOffline(true);
  /* No travel or campfire events and no weather, like the courier test.
     window.__dice: the next values Math.random gives, before its usual 0.99
     (set on the Bastion's page only, for the attack and the battle). */
  await ctx.addInitScript(() => {
    window.__dice = [];
    Math.random = function () { return window.__dice && window.__dice.length ? window.__dice.shift() : 0.99; };
  });
  return ctx;
}
async function openExplorer(ctx, page) {
  const p = await ctx.newPage();
  await p.goto((page || INDEX) + '?tool=explorer');
  await p.waitForSelector('[data-test=camp]');
  return p;
}
async function openBastion(ctx, page) {
  const p = await ctx.newPage();
  await p.goto((page || INDEX) + '?tool=bastion');
  await p.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  return p;
}
async function closeAll(page) {
  for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}
/* Make Camp in the Explorer, closing whatever the night brings. Resolves
   with "The Ironbow sends word…" as the Explorer showed it. */
async function camp(ex) {
  await ex.waitForTimeout(400);
  await ex.click('[data-test=camp]');
  let word = null;
  for (let n = 0; n < 20; n++) {
    await ex.waitForTimeout(200);
    if (!(await ex.$('.tsi-modal'))) { if (n > 2) break; continue; }
    if (await ex.$('[data-test=ironbow-word]')) word = (word || '') + (await bare(ex, '[data-test=ironbow-word]'));
    await ex.click('.tsi-modal__foot button:last-child');
  }
  return word;
}
/* The Bastion reaches a day by itself; its "The Ironbow sends word…" is
   read and closed on the way. Resolves with the word's text. */
async function bastionReaches(ba, day) {
  let word = '';
  for (let n = 0; n < 160; n++) {
    if (await ba.$('[data-test=ironbow-word]')) {
      word += ' ' + (await bare(ba, '[data-test=ironbow-word]'));
      await ba.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary');
    }
    const ok = await ba.evaluate(d => {
      const s = TSI.bastion.debug.state();
      return s.day === d && !s.dayInProgress && !TSI.bastion.debug.busy();
    }, day);
    if (ok && !(await ba.$('[data-test=ironbow-word]'))) return word;
    await ba.waitForTimeout(250);
  }
  throw new Error('The Bastion didn\'t reach Day ' + day);
}
async function passDays(ex, ba, n) {
  await closeAll(ex);
  await closeAll(ba);
  let exWord = '';
  for (let i = 0; i < n; i++) exWord += ' ' + ((await camp(ex)) || '');
  const day = await ex.evaluate(() => TSI.explorer.debug.state().travel.day);
  const baWord = await bastionReaches(ba, day);
  return { exWord, baWord, day };
}
/* A facility's panel, opened from its tile. */
async function openTile(ba, fac) {
  await closeAll(ba);
  await ba.waitForTimeout(300);
  await ba.click('[data-test=tile-' + fac + ']');
  await ba.waitForSelector('[data-test=panel-fac-' + fac + ']');
  await ba.waitForTimeout(300);
}
/* The Workshop's panel with the Scholar's chart job chosen (the Library's order moved to the Scholar, step S12). */
async function showChart(ba) {
  await openTile(ba, 'workshop');
  await ba.selectOption('[data-test=staff-job-scholar]', '2');
  await ba.waitForSelector('[data-test=issue-' + CHART_ORDER + ']');
}
/* Construct a facility from the first empty construction slot. Resolves with the question. */
async function construct(ba, fac) {
  await closeAll(ba);
  await ba.waitForTimeout(400);
  const slot = await ba.$eval('button.tsi-bas-tile--slot', b => b.dataset.test);
  await ba.click('[data-test=' + slot + ']');
  await ba.waitForSelector('[data-test=build-' + fac + ']');
  await ba.waitForTimeout(400);
  await ba.click('[data-test=build-' + fac + ']');
  await ba.waitForSelector('.tsi-modal__foot button:text-is("Construct")');
  const q = await lastModal(ba);
  await H.clickModal(ba, 'Construct');
  await ba.waitForTimeout(400);
  return q;
}
/* An order's button in its facility's panel (the panel opened first). */
async function issue(ba, fac, key, choice) {
  await openTile(ba, fac);
  if (choice !== undefined) {
    await ba.selectOption('[data-test=sel-' + key + ']', String(choice));
    await ba.waitForTimeout(200);
  }
  await ba.click('[data-test=issue-' + key + ']');
  await ba.waitForTimeout(450);
}
/* What an order's button says and whether it can be pressed, and the sentence under it. */
async function orderState(ba, key) {
  return ba.evaluate(k => {
    const b = document.querySelector('[data-test="issue-' + k + '"]');
    const w = document.querySelector('[data-test="why-' + k + '"]');
    return { button: b.textContent, off: b.disabled, why: w && !w.hidden ? w.textContent : '' };
  }, key);
}
/* The beasts the Beast Pen's panel lists, stall by stall: { room, stalls: { griffin: [[name, status]] } }. */
async function panelCreatures(ba) {
  return ba.evaluate(() => {
    const stalls = {};
    document.querySelectorAll('[data-test^="stall-"][data-count]').forEach(st => {
      stalls[st.getAttribute('data-test').slice(6)] = Array.from(st.querySelectorAll('[data-creature]'))
        .map(r => [r.querySelector('.tsi-bas-creature__name').textContent, r.querySelector('.tsi-bas-creature__status').textContent]);
    });
    const room = document.querySelector('[data-test="creature-room-beast_pen"]');
    return { room: room ? room.textContent : null, stalls };
  });
}
/* Grant a creature… in the Explorer: its kind, name and what it's for. */
async function grant(ex, species, name, why) {
  await closeAll(ex);
  await ex.waitForTimeout(400);
  await ex.click('[data-test=creature-open]');
  await ex.waitForSelector('[data-test=creature-dialog]');
  await ex.selectOption('[data-test=creature-species]', species);
  await ex.fill('[data-test=creature-name]', name || '');
  await ex.fill('[data-test=creature-why]', why || '');
  await ex.click('[data-test=creature-dialog] .tsi-modal__foot .tsi-btn--primary');
  /* Pull request 8a: Grant asks first. */
  await ex.waitForTimeout(300);
  await ex.locator('.tsi-modal').last().locator('.tsi-modal__foot .tsi-btn--primary').click();
  await ex.waitForTimeout(400);
}
/* The panel opens with its House order in view, above the footer, and nothing scrolls sideways. */
async function panelFits(ba, key) {
  const lay = await H.layoutCheck(ba, ['[data-test=issue-' + key + ']']);
  const box = await ba.$eval('[data-test=issue-' + key + ']', b => {
    const r = b.getBoundingClientRect();
    const f = b.closest('.tsi-modal').querySelector('.tsi-modal__foot');
    return { bottom: r.bottom, footTop: f ? f.getBoundingClientRect().top : 99999 };
  });
  return { sideways: lay.scrollWidth > lay.clientWidth, outOfView: lay.outOfView, underFooter: box.bottom > box.footTop };
}
const modalOpen = async page => !!(await page.$('.tsi-modal:not(.tsi-bas-panel)'));
async function clickPop(page, label) {
  await page.click('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button:text-is("' + label + '")');
  await page.waitForTimeout(150);
}

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  let ex = null;
  let ba = null;
  let gp = 0;
  let swift = null;   /* Swiftwing, the first griffin (its id in the Bastion) */
  let storm = null;   /* Stormfeather, the second */
  let wolf = null;    /* the dire wolf, granted with no name */

  /* ------------------------------------------------------------------ */
  section('The Scholar\'s chart order (the Library & Scriptorium\'s, moved to the Workshop)');

  await check('the Explorer and the Bastion open side by side; at Workshop Level 1 the Scholar\'s Prepare Overland Travel Charts says "Needs Level 3"', async () => {
    ex = await openExplorer(ctx);
    await ex.waitForTimeout(600);
    ba = await openBastion(ctx);
    await ba.selectOption('[data-test=level]', '9');
    await ba.waitForTimeout(400);
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.treasuryGP = 100;
      s.builtExtras = [];
      s.facilityLevels.workshop = 3;
    }));
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.facilityLevels.workshop = 1; }));
    await openTile(ba, 'workshop');
    equal(await bare(ba, '[data-test=staff-level-scholar]'), 'Opens at Level 3', 'the Scholar is not open yet');
    equal(await ba.$('[data-test=issue-' + CHART_ORDER + ']'), null);
    await closeAll(ba);
  });

  await check('at Workshop Level 3: it takes 4 days, makes 1 Overland chart and costs nothing; Issue Order takes no gold, and the Scholar does one job at a time', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.facilityLevels.workshop = 3; }));
    await showChart(ba);
    equal(await bare(ba, '[data-test=days-' + CHART_ORDER + ']'), 'Takes 4 days');
    assert(/Makes: 1 Overland chart/.test(await bare(ba, '[data-test=goods-' + CHART_ORDER + ']')), await bare(ba, '[data-test=goods-' + CHART_ORDER + ']'));
    equal((await orderState(ba, CHART_ORDER)).button, 'Issue Order');
    await ba.click('[data-test=issue-' + CHART_ORDER + ']');
    await ba.waitForTimeout(450);
    const s = await bas(ba);
    const o = s.pendingOrders.filter(x => x.fnId === 'prepare_overland_travel_charts');
    equal([o.length, o[0].label, o[0].dueDay, s.treasuryGP], [1, 'Workshop: Scholar - Prepare Overland Travel Charts', 5, 100]);
    await showChart(ba);
    const again = await orderState(ba, CHART_ORDER);
    equal([again.button, again.off], ['Busy', true], 'one chart order at a time: the Scholar is busy');
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Building the Beast Pen');

  await check('it builds in a construction slot in 21 days, for no gold ("Construct the Beast Pen? It takes 21 days."), and building it brings no beast', async () => {
    const asked = await construct(ba, 'beast_pen');
    assert(asked.includes('Construct the Beast Pen? It takes 21 days.'), asked);
    const s = await bas(ba);
    equal(s.builtExtras.filter(Boolean).map(e => [e.facId, e.status, e.startDay, e.readyDay]), [['beast_pen', 'building', 1, 22]]);
    equal([s.builtPlots.filter(Boolean), s.treasuryGP, s.creatures], [[], 100, []], 'no plot used, no gold, and no beast');
  });

  await check('4 camps later the Scholar has made 1 Overland chart, into the Warehouse, with no gold spent', async () => {
    const w = await passDays(ex, ba, 4);
    assert(/Workshop: Scholar - Prepare Overland Travel Charts is complete\./.test(w.exWord), 'the Explorer\'s word: ' + w.exWord);
    const s = await bas(ba);
    equal([s.day, qty(s, CHART), s.treasuryGP, s.pendingOrders.filter(o => o.fnId === 'prepare_overland_travel_charts').length], [5, 1, 100, 0]);
    assert(s.log.some(l => l.body === 'Workshop: Scholar - Prepare Overland Travel Charts → Added to Warehouse: 1 Overland chart.'), logText(s));
  });

  await check('17 camps more (Day 22): the Pen is built, at its one level, with nobody living in it', async () => {
    await passDays(ex, ba, 17);
    const s = await bas(ba);
    equal([s.day, s.builtExtras.filter(Boolean).map(e => e.facId + ' ' + e.status)], [22, ['beast_pen built']]);
    equal(s.facilityLevels.beast_pen, 1);
    equal(s.creatures, []);
  });

  await check('the Pen\'s panel: Harry\'s picture across the top, one level, no Upgrade row, five empty stalls, House Beast Here with nothing waiting; the panel fits the laptop', async () => {
    await openTile(ba, 'beast_pen');
    equal(await bare(ba, '[data-test=fac-level]'), 'One level only');
    equal(await ba.$('[data-test=upgrade-row-beast_pen]'), null, 'no Upgrade row');
    equal(await orderState(ba, HOUSE), { button: 'None waiting', off: true, why: 'No beast is waiting for a home. The DM grants one in the Explorer.' });
    const p = await panelCreatures(ba);
    equal(Object.keys(p.stalls), ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat']);
    equal(Object.values(p.stalls), [[], [], [], [], []]);
    assert(p.room.startsWith('The Beast Pen keeps one beast of each kind: wyvern, griffin, dire wolf, buckbear'), p.room);
    equal(await panelFits(ba, HOUSE), { sideways: false, outOfView: [], underFooter: false });
    await H.shot(ba, 'creatures-pen-empty-laptop');
  });

  /* ------------------------------------------------------------------ */
  section('Grant a creature… in the Explorer');

  await check('Grant a creature… sits under Sent to the Bastion; a double-click opens one dialog (the five kinds, a name, what for) that says "the Beast Pen" once; it fits the laptop; Cancel sends nothing', async () => {
    const before = await exs(ex);
    await ex.waitForTimeout(400);
    await ex.dblclick('[data-test=creature-open]');
    await ex.waitForSelector('[data-test=creature-dialog]');
    await ex.waitForTimeout(300);
    equal(await ex.$$eval('[data-test=creature-dialog]', l => l.length), 1, 'one dialog');
    equal(await ex.$$eval('[data-test=creature-species] option', o => o.map(x => x.value + ' ' + x.textContent)), ['wyvern Wyvern', 'griffin Griffin', 'dire_wolf Dire Wolf', 'buckbear Buckbear', 'fellcat Fellcat']);
    equal(await ex.$$eval('[data-test=creature-dialog] .tsi-modal__foot button', l => l.map(b => b.textContent)), ['Cancel', 'Grant']);
    const body = await bare(ex, '[data-test=creature-dialog] .tsi-modal__body');
    assert(/^Grant the Ironbow a wyvern, a griffin, a dire wolf, a buckbear or a fellcat when the party has won one\. The Bastion holds it, waiting for a home, until the Beast Pen houses it \(House Beast Here: 3 days\)\. The Beast Pen keeps one beast of each kind\./.test(body), body);
    equal(body.split('Beast Pen').length - 1, 2, '"the Beast Pen" is said once in the sentence about the home and once about the limit, never five times');
    equal((await H.layoutCheck(ex, ['[data-test=creature-dialog]'])).outOfView, [], 'the dialog fits the laptop');
    await ex.click('[data-test=creature-dialog] .tsi-modal__foot button:text-is("Cancel")');
    await ex.waitForTimeout(400);
    equal((await exs(ex)).journey.outbox, before.journey.outbox, 'nothing sent');
  });

  await check('Grant a griffin named Swiftwing: the Explorer sends it once ("Sent to the Bastion: a griffin (Swiftwing)…"), listed as "Creature: Griffin (Swiftwing)"', async () => {
    await grant(ex, 'griffin', 'Swiftwing', 'Won at the Ember Fair');
    const s = await exs(ex);
    const sent = s.journey.outbox.filter(m => m.type === 'creature');
    equal(sent.map(m => [m.type, m.day, m.species, m.name, m.text]), [['creature', 22, 'griffin', 'Swiftwing', 'Griffin for the Ironbow (Swiftwing): Won at the Ember Fair.']], 'one grant');
    assert(/^[A-Za-z0-9-]+:dm:0$/.test(sent[0].id), sent[0].id);
    equal(await bare(ex, '[data-test=notice]'), 'Sent to the Bastion: a griffin (Swiftwing) for the Ironbow, to be housed at the Beast Pen.');
    equal((await sentTop(ex)).title, 'Creature: Griffin (Swiftwing)');
  });

  await check('the Bastion holds Swiftwing once, waiting for a home: a notice, the Day Log, and "Creature granted: Griffin (Swiftwing)" in Management\'s Changes from the Explorer', async () => {
    await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.length === 1, null, { timeout: 8000 });
    await H.waitForNotice(ba, /From the Explorer: a griffin \(Swiftwing\) for the Ironbow, waiting for a home at the Beast Pen\./);
    const s = await bas(ba);
    const c = s.creatures[0];
    swift = c.id;
    const msg = (await exs(ex)).journey.outbox.filter(m => m.type === 'creature')[0];
    equal(c, { id: 'cr-' + msg.id.replace(/:/g, '-'), species: 'griffin', owner: '', name: 'Swiftwing', status: 'waiting', home: '', grantedDay: 22, housedDay: null, msgId: msg.id });
    equal(Object.values(s.bridge.done).map(r => [r.r, r.type, r.species, r.name, r.creatureId, r.held]), [['applied', 'creature', 'griffin', 'Swiftwing', swift, false]], 'one receipt');
    assert(s.log.some(l => l.body === 'Creature granted (DM, Day 22): a griffin (Swiftwing), waiting for a home at the Beast Pen. Griffin for the Ironbow (Swiftwing): Won at the Ember Fair.'), logText(s));
    equal(s.treasuryGP, gp = 100, 'no gold');
    await H.dismissNotices(ba);
    await closeAll(ba);
    await ba.click('[data-test=open-management]');
    await ba.waitForSelector('[data-test=explorer-change]');
    assert(/^Creature granted: Griffin \(Swiftwing\)/.test(await bare(ba, '[data-test=explorer-change]')), await bare(ba, '[data-test=explorer-change]'));
    equal(await ba.$('[data-test=creatures]'), null, 'Management has no creature list any more: the beasts are in the Beast Pen\'s panel');
    equal(await ba.$('[data-test=beast-box]'), null, 'nor the Beast Handler box');
    await closeAll(ba);
  });

  await check('the Explorer\'s Sent to the Bastion says Applied: "the Bastion holds the griffin (Swiftwing); house it at the Beast Pen"', async () => {
    await ex.waitForFunction(() => document.querySelector('[data-test=sent]').getAttribute('data-status') === 'applied', null, { timeout: 8000 });
    equal(await sentTop(ex), { status: 'applied', title: 'Creature: Griffin (Swiftwing)', line: 'Applied on Day 22: the Bastion holds the griffin (Swiftwing); house it at the Beast Pen.' });
    equal(await bare(ex, '[data-test=sent-status]'), 'Applied');
  });

  /* ------------------------------------------------------------------ */
  section('House Beast Here');

  await check('the Pen\'s panel: Swiftwing waits in the griffin stall, and House Beast Here offers Swiftwing with its kind; the panel fits the laptop', async () => {
    await openTile(ba, 'beast_pen');
    const p = await panelCreatures(ba);
    equal(p.stalls.griffin, [['Swiftwing', 'Waiting for a home at the Beast Pen.']]);
    equal(await ba.$$eval('[data-test=sel-' + HOUSE + '] option', o => o.map(x => x.textContent)), ['Swiftwing (Griffin)']);
    equal(await orderState(ba, HOUSE), { button: 'Issue Order', off: false, why: '' });
    equal(await bare(ba, '[data-test=days-' + HOUSE + ']'), 'Takes 3 days');
    equal(await ba.$eval('[data-test=stall-state-griffin]', n => n.textContent), 'Empty');
    equal(await panelFits(ba, HOUSE), { sideways: false, outOfView: [], underFooter: false });
    await H.shot(ba, 'creatures-pen-waiting-laptop');
  });

  await check('House Beast Here (Swiftwing): ready on Day 25, no gold; a second griffin can\'t go in meanwhile', async () => {
    await ba.click('[data-test=issue-' + HOUSE + ']');
    await ba.waitForTimeout(450);
    const s = await bas(ba);
    const o = s.pendingOrders.filter(x => x.fnId === 'house_beast');
    equal([o.length, o[0].label, o[0].dueDay, o[0].chosen.creatureId, s.treasuryGP], [1, 'Beast Pen: House Beast Here (Swiftwing)', 25, swift, gp]);
    await openTile(ba, 'beast_pen');
    const p = await panelCreatures(ba);
    equal(p.stalls.griffin, [['Swiftwing', 'Being housed at the Beast Pen: ready on Day 25.']]);
    equal(await ba.$eval('[data-test=stall-state-griffin]', n => n.textContent), 'Being housed');
    await closeAll(ba);
  });

  await check('a dire wolf with no name is granted and housed beside it: several beasts can be housed at once, one of each kind (ready on Day 25)', async () => {
    await grant(ex, 'dire_wolf', '', 'To guard the gate');
    equal(await bare(ex, '[data-test=notice]'), 'Sent to the Bastion: a dire wolf for the Ironbow, to be housed at the Beast Pen.');
    await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.length === 2, null, { timeout: 8000 });
    await H.waitForNotice(ba, /From the Explorer: a dire wolf for the Ironbow, waiting for a home at the Beast Pen\./);
    await H.dismissNotices(ba);
    wolf = (await bas(ba)).creatures[1].id;
    await openTile(ba, 'beast_pen');
    equal(await ba.$$eval('[data-test=sel-' + HOUSE + '] option', o => o.map(x => x.textContent)), ['Dire Wolf (granted Day 22)']);
    await ba.click('[data-test=issue-' + HOUSE + ']');
    await ba.waitForTimeout(450);
    const s = await bas(ba);
    const o = s.pendingOrders.filter(x => x.fnId === 'house_beast');
    equal(o.map(x => [x.label, x.dueDay, x.chosen.creatureId]), [['Beast Pen: House Beast Here (Swiftwing)', 25, swift], ['Beast Pen: House Beast Here (granted Day 22)', 25, wolf]]);
    equal(s.treasuryGP, gp);
    await ex.waitForFunction(() => document.querySelector('[data-test=sent]').getAttribute('data-status') === 'applied', null, { timeout: 8000 });
    equal(await sentTop(ex), { status: 'applied', title: 'Creature: Dire Wolf', line: 'Applied on Day 22: the Bastion holds the dire wolf; house it at the Beast Pen.' });
  });

  await check('3 camps later (Day 25) both are home: the forecast said so, no roll was asked for, and nothing was made by building', async () => {
    const w = await passDays(ex, ba, 3);
    assert(/Beast Pen: House Beast Here \(Swiftwing\) is complete\./.test(w.exWord) && /Beast Pen: House Beast Here \(granted Day 22\) is complete\./.test(w.exWord), 'the Explorer\'s word: ' + w.exWord);
    assert(!/needs your roll/.test(w.exWord), 'no roll asked for: ' + w.exWord);
    const s = await bas(ba);
    equal([s.day, s.treasuryGP], [25, gp]);
    equal(register(s), [[swift, 'griffin', 'Swiftwing', 'housed', 'beast_pen'], [wolf, 'dire_wolf', '', 'housed', 'beast_pen']]);
    assert(s.log.some(l => l.body === 'Beast Pen: House Beast Here (Swiftwing) → Swiftwing has a home at the Beast Pen. Acclimatise it with its handler (Acclimatise With Beast) before it can go out on the road.'), logText(s));
    equal(s.creatures.filter(c => c.id === 'elara_wyvern').length, 0, 'Elara\'s wyvern is not made by the Bastion any more');
    await openTile(ba, 'beast_pen');
    const p = await panelCreatures(ba);
    equal([p.stalls.griffin, p.stalls.dire_wolf], [[['Swiftwing', 'At the Beast Pen. Not acclimatised yet']], [['Dire Wolf (granted Day 22)', 'At the Beast Pen. Not acclimatised yet']]]);
    await H.shot(ba, 'creatures-pen-housed-laptop');
    await closeAll(ba);
  });

  await check('Rename… on a housed beast (Harry, 18 October 2026): the wolf becomes "Greyfang"; an empty name gives the usual one back; Cancel changes nothing', async () => {
    const rename = async (text, button) => {
      await openTile(ba, 'beast_pen');
      await ba.click('[data-test=creature-rename-' + wolf + ']');
      await ba.waitForSelector('[data-test=creature-rename-dialog]');
      await ba.fill('[data-test=creature-name]', text);
      await H.clickModal(ba, button);
      await ba.waitForTimeout(500);
    };
    await rename('Greyfang', 'Cancel');
    await openTile(ba, 'beast_pen');
    equal((await panelCreatures(ba)).stalls.dire_wolf[0][0], 'Dire Wolf (granted Day 22)');
    await rename('Greyfang', 'Rename');
    await openTile(ba, 'beast_pen');
    equal((await panelCreatures(ba)).stalls.dire_wolf[0][0], 'Greyfang');
    assert((await bas(ba)).log.some(l => /Dire Wolf \(granted Day 22\) is now called Greyfang/.test(l.body)), 'the Day Log says so');
    await rename('', 'Rename');
    await openTile(ba, 'beast_pen');
    equal((await panelCreatures(ba)).stalls.dire_wolf[0][0], 'Dire Wolf (granted Day 22)');
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('One of each kind');

  await check('a second griffin, Stormfeather, waits: House Beast Here says "The Beast Pen keeps one griffin at a time: Swiftwing lives here."; a buckbear and a fellcat are housed beside the griffin and wolf', async () => {
    await grant(ex, 'griffin', 'Stormfeather', '');
    await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.length === 3, null, { timeout: 8000 });
    await H.dismissNotices(ba);
    storm = (await bas(ba)).creatures[2].id;
    await openTile(ba, 'beast_pen');
    equal(await ba.$$eval('[data-test=sel-' + HOUSE + '] option', o => o.map(x => x.textContent)), ['Stormfeather (Griffin)']);
    equal(await orderState(ba, HOUSE), { button: 'Kind is full', off: true, why: 'The Beast Pen keeps one griffin at a time: Swiftwing lives here.' });
    equal((await panelCreatures(ba)).stalls.griffin, [['Swiftwing', 'At the Beast Pen. Not acclimatised yet'], ['Stormfeather', 'Waiting for a home at the Beast Pen.']], 'it waits in the griffin stall, never sent away');
    equal(await ba.$('[data-test=creature-release-' + storm + ']') !== null, true, 'and can be released while it waits');
    await closeAll(ba);
    await grant(ex, 'buckbear', 'Bramble', '');
    await grant(ex, 'fellcat', 'Lichen', '');
    await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.length === 5, null, { timeout: 8000 });
    await H.dismissNotices(ba);
    await openTile(ba, 'beast_pen');
    equal(await ba.$$eval('[data-test=sel-' + HOUSE + '] option', o => o.map(x => x.textContent)), ['Stormfeather (Griffin)', 'Bramble (Buckbear)', 'Lichen (Fellcat)']);
    await ba.selectOption('[data-test=sel-' + HOUSE + ']', '1');
    await ba.waitForTimeout(200);
    equal((await orderState(ba, HOUSE)).off, false, 'the buckbear can go in');
    await ba.click('[data-test=issue-' + HOUSE + ']');
    await ba.waitForTimeout(450);
    await openTile(ba, 'beast_pen');
    await ba.selectOption('[data-test=sel-' + HOUSE + ']', '1');
    await ba.waitForTimeout(200);
    await ba.click('[data-test=issue-' + HOUSE + ']');
    await ba.waitForTimeout(450);
    equal((await bas(ba)).pendingOrders.map(o => o.label), ['Beast Pen: House Beast Here (Bramble)', 'Beast Pen: House Beast Here (Lichen)']);
    await closeAll(ba);
  });

  await check('3 camps later (Day 28) the buckbear and the fellcat live there too; four kinds are full, and the wyvern stall is empty; Release asks first and the griffin that waited goes', async () => {
    await passDays(ex, ba, 3);
    const s = await bas(ba);
    equal(register(s).map(r => r.slice(1)), [['griffin', 'Swiftwing', 'housed', 'beast_pen'], ['dire_wolf', '', 'housed', 'beast_pen'], ['griffin', 'Stormfeather', 'waiting', ''], ['buckbear', 'Bramble', 'housed', 'beast_pen'], ['fellcat', 'Lichen', 'housed', 'beast_pen']]);
    await openTile(ba, 'beast_pen');
    equal(await ba.$$eval('[data-test^=stall-state-]', n => n.map(x => x.getAttribute('data-test').slice(12) + ':' + x.textContent)), ['wyvern:Empty', 'griffin:Full', 'dire_wolf:Full', 'buckbear:Full', 'fellcat:Full']);
    await ba.click('[data-test=creature-release-' + storm + ']');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Release")');
    assert(/Release Stormfeather\?/.test(await lastModal(ba)), await lastModal(ba));
    await H.clickModal(ba, 'Cancel');
    await ba.waitForTimeout(300);
    equal((await bas(ba)).creatures.length, 5, 'Cancel keeps it');
    await ba.click('[data-test=creature-release-' + storm + ']');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Release")');
    await H.clickModal(ba, 'Release');
    await ba.waitForTimeout(500);
    equal((await bas(ba)).creatures.map(c => c.name), ['Swiftwing', '', 'Bramble', 'Lichen']);
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Demolishing the Beast Pen');

  await check('Demolish… is refused while beasts live there, and says why; they and the Pen stay', async () => {
    await openTile(ba, 'beast_pen');
    const before = (await bas(ba)).creatures;
    await ba.click('[data-test=demolish-beast_pen]');
    await ba.waitForTimeout(500);
    assert(/The Beast Pen can't be demolished while 4 beasts live in it: there is nowhere else for them to go\./.test(await lastModal(ba)), await lastModal(ba));
    await H.clickModal(ba, 'OK');
    const s = await bas(ba);
    equal(s.builtExtras.filter(Boolean).map(e => e.facId), ['beast_pen'], 'still standing');
    equal(s.creatures, before, 'nobody moved');
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('A reload');

  await check('a reload of both windows adds nothing: the same beasts, receipts and Sent to the Bastion, and no new notice', async () => {
    const e0 = await exs(ex);
    const b0 = await bas(ba);
    await ex.reload();
    await ex.waitForSelector('[data-test=camp]');
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    await ex.waitForTimeout(2600);
    const e1 = await exs(ex);
    const b1 = await bas(ba);
    equal([e1.journey.outbox.length, e1.journey.inventory], [e0.journey.outbox.length, e0.journey.inventory]);
    equal([b1.creatures, b1.bridge.done, b1.treasuryGP, qty(b1, CHART)], [b0.creatures, b0.bridge.done, b0.treasuryGP, qty(b0, CHART)]);
    equal(await ba.$$eval('.tsi-notice', ns => ns.filter(n => /From the Explorer: a/.test(n.textContent)).length), 0, 'no grant notice again');
    equal(await ex.$$eval('[data-test=sent]', l => l.filter(n => /^Creature/.test(n.querySelector('strong').textContent)).map(n => n.getAttribute('data-status'))), ['applied', 'applied', 'applied', 'applied', 'applied']);
  });

  /* ------------------------------------------------------------------ */
  section('Harry\'s sample file (tests/fixtures/bastion-pr7-sample.json), on the test page');

  await check('on the test page, with only the Bastion open, the sample imports and its Roost, Tower and Den become the one Beast Pen (the Library joins the Workshop, 300 gp, no beasts); then the Explorer opens beside it, and a griffin granted earlier is skipped, not held', async () => {
    const c2 = await context(browser, 'laptop');
    /* Earlier testing on the test page: a griffin granted and held. */
    const e0 = await openExplorer(c2, HARNESS);
    await e0.waitForTimeout(600);
    const b0 = await openBastion(c2, HARNESS);
    await grant(e0, 'griffin', 'Old Test', '');
    await b0.waitForFunction(() => TSI.bastion.debug.state().creatures.length === 1, null, { timeout: 8000 });
    await e0.close();
    await b0.close();
    /* The sample, with only the Bastion open. */
    const b3 = await c2.newPage();
    await b3.goto(HARNESS + '?tool=bastion');
    await b3.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug, null, { timeout: 8000 });
    await H.chooseFile(b3, '[data-test=import-save]', SAMPLE);
    await H.clickModal(b3, 'Import');
    await b3.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().v === 4 && TSI.bastion.debug.state().treasuryGP === 300, null, { timeout: 8000 });
    /* The box that says what changed holds the Bastion until it is read (the Strip Back Overhaul). */
    await H.ackChanges(b3);
    const e3 = await openExplorer(c2, HARNESS);
    await e3.waitForTimeout(500);
    await b3.waitForFunction(() => TSI.bastion.debug.state().anchored && !TSI.bastion.debug.state().bridge.fresh, null, { timeout: 8000 });
    const s = await bas(b3);
    equal([s.treasuryGP, s.partyLevel, s.builtExtras.filter(Boolean), s.builtPlots.filter(Boolean), s.creatures],
      [300, 9, ['beast_pen'].map(id => ({ facId: id, status: 'built' })), [], []]);
    equal(['library_scriptorium', 'beast_pen', 'wyvern_roost', 'griffin_tower', 'dire_wolf_den'].map(f => s.facilityLevels[f]), [undefined, 1, undefined, undefined, undefined]);
    equal(Object.values(s.bridge.done).map(r => [r.r, r.type, r.species, r.name]), [['skipped', 'creature', 'griffin', 'Old Test']], 'the earlier grant is skipped');
    assert(/1 creature grant, sent before this Bastion started, was skipped, so nothing counts twice\./.test(logText(s)), logText(s));
    assert(/A sample Bastion for trying the creatures/.test(logText(s)), logText(s));
    await e3.waitForFunction(() => { const n = document.querySelector('[data-test=sent]'); return n && n.getAttribute('data-status') === 'skipped'; }, null, { timeout: 8000 });
    equal(await bare(e3, '[data-test=sent-line]'), 'Skipped: sent before this Bastion started. Grant it again if it should count.');
    /* The sample works: the chart order can be given; the Pen has nobody waiting. */
    await b3.evaluate(() => TSI.bastion.debug.change(s => { s.facilityLevels.workshop = 3; }));
    await showChart(b3);
    equal((await orderState(b3, CHART_ORDER)).button, 'Issue Order');
    await openTile(b3, 'beast_pen');
    equal((await orderState(b3, HOUSE)).why, 'No beast is waiting for a home. The DM grants one in the Explorer.');
    await closeAll(b3);
    equal(c2.log.errors, [], 'no page errors');
    equal(c2.log.net, [], 'nothing online');
    await c2.close();
  });

  await check('the real suite (index.html) refuses the sample, which is a test-page file, and changes nothing', async () => {
    const c3 = await context(browser, 'laptop');
    const b4 = await c3.newPage();
    await b4.goto(INDEX + '?tool=bastion');
    await b4.waitForFunction(() => TSI.bastion && TSI.bastion.debug, null, { timeout: 8000 });
    const b0 = await bas(b4);
    await H.chooseFile(b4, '[data-test=import-save]', SAMPLE);
    assert(/came from the suite's test page/.test(await H.modalText(b4)), await H.modalText(b4));
    await H.clickModal(b4, 'OK');
    const b1 = await bas(b4);
    equal([b1.treasuryGP, b1.builtExtras, b1.creatures], [b0.treasuryGP, b0.builtExtras, b0.creatures]);
    await c3.close();
  });

  /* ------------------------------------------------------------------ */
  section('The TV (1920 × 1080)');

  await check('the Beast Pen\'s panel, with all five kinds and a long name, and the Grant dialog fit the TV, with nothing scrolling sideways', async () => {
    await ex.close();
    await ba.close();
    const tv = await context(browser, 'tv');
    const e2 = await openExplorer(tv);
    await e2.waitForTimeout(500);
    const b2 = await openBastion(tv);
    await b2.evaluate(() => TSI.bastion.debug.change(s => {
      s.partyLevel = 9;
      s.builtExtras = ['beast_pen'].map(id => ({ facId: id, status: 'built' }));
      s.facilityLevels.workshop = 3;
      const C = (id, species, name, status) => ({ id, species, owner: '', name, status, home: status === 'housed' ? 'beast_pen' : '', grantedDay: 1, housedDay: status === 'housed' ? 1 : null, msgId: id.slice(3) + ':dm:0' });
      s.creatures = [
        C('cr-tvwyvern', 'wyvern', 'Stormtalon', 'housed'), C('cr-tvgriffin1', 'griffin', 'Swiftwing', 'housed'),
        C('cr-tvgriffin2', 'griffin', 'A griffin with a long name of forty lett', 'waiting'),
        C('cr-tvwolf', 'dire_wolf', 'Greyfang', 'housed'), C('cr-tvbuck', 'buckbear', 'Bramble', 'housed'), C('cr-tvcat', 'fellcat', '', 'waiting')
      ];
    }));
    await openTile(b2, 'beast_pen');
    equal(await panelFits(b2, HOUSE), { sideways: false, outOfView: [], underFooter: false });
    equal(await ba_count(b2), 6);
    await H.shot(b2, 'creatures-pen-tv');
    await closeAll(b2);
    await e2.waitForTimeout(400);
    await e2.click('[data-test=creature-open]');
    await e2.waitForSelector('[data-test=creature-dialog]');
    equal((await H.layoutCheck(e2, ['[data-test=creature-dialog]'])).outOfView, [], 'the Grant dialog');
    await H.shot(e2, 'creatures-grant-dialog-tv');
    await e2.click('[data-test=creature-dialog] .tsi-modal__foot button:text-is("Cancel")');
    await closeAll(e2);
    const el = await H.layoutCheck(e2, ['[data-test=camp]', '[data-test=creature-open]']);
    equal([el.scrollWidth <= el.clientWidth, el.outOfView], [true, []], 'the Explorer');
    equal(tv.log.errors, [], 'no page errors on the TV');
    equal(tv.log.net, [], 'nothing online on the TV');
    await tv.close();
    async function ba_count(page) { return page.$$eval('[data-creature]', l => l.length); }
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, []);
    equal(ctx.log.net, []);
    equal(ctx.log.failed, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
