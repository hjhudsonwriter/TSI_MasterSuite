/* The creatures, and the Library's chart order (pull request 7 of the
   facilities overhaul, Harry's answers of 14 October 2026), clicked through
   from a double-clicked index.html with the internet off, with the Explorer
   and the Bastion open side by side:
   - the Library & Scriptorium at Level 2: Prepare Overland Travel Charts
     makes 1 Overland chart in 4 days, with no gold;
   - the Wyvern Roost, Griffin Tower and Dire Wolf Den build in construction
     slots in 21 days;
   - House Elara's Wyvern (3 days) records her wyvern once; a second is
     refused;
   - Grant a creature… in the Explorer: the Bastion holds a named griffin
     waiting for a home, with a notice and a Clan Influence row, and the
     Explorer's Sent to the Bastion says Applied;
   - House a Griffin (3 days) houses it; a second griffin waits ("No room")
     until the Tower is upgraded to Level 2 (7 days); a dire wolf is housed at
     the Den;
   - a Defend Bastion battle: the creatures stand with the defenders, one
     defeated creature is badly wounded (never killed), and after the
     withdrawal no creature has gone;
   - Demolish the Griffin Tower: the question says its griffins stay, and
     they do;
   - a reload adds nothing;
   - the panels and the Grant dialog fit the laptop and the TV;
   - Harry's sample file imports on the test page, and the real suite
     refuses it.
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
const CHART_ORDER = 'library_scriptorium__prepare_overland_travel_charts';
const ROOST = 'wyvern_roost__house_elara_wyvern';
const TOWER = 'griffin_tower__house_griffin';
const DEN = 'dire_wolf_den__house_dire_wolf';
const WYVERN = 'elara_wyvern';

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
  const ctx = await H.newContext(browser, size || 'laptop', { acceptDownloads: true });
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
/* The creatures a building's panel lists: { housed: [[name, status]], waiting: [...] }. */
async function panelCreatures(ba, fac) {
  return ba.evaluate(f => {
    const rows = test => Array.from(document.querySelectorAll('[data-test="' + test + '"] [data-creature]'))
      .map(r => [r.querySelector('.tsi-bas-creature__name').textContent, r.querySelector('.tsi-bas-creature__status').textContent]);
    const room = document.querySelector('[data-test="creature-room-' + f + '"]');
    return { room: room ? room.textContent : null, housed: rows('creatures-housed-' + f), waiting: rows('creatures-waiting-' + f) };
  }, fac);
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
  section('The Library & Scriptorium\'s chart order');

  await check('the Explorer and the Bastion open side by side; at Level 1 the Library\'s Prepare Overland Travel Charts says "Needs Level 2"', async () => {
    ex = await openExplorer(ctx);
    await ex.waitForTimeout(600);
    ba = await openBastion(ctx);
    await ba.selectOption('[data-test=level]', '9');
    await ba.waitForTimeout(400);
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.treasuryGP = 100;
      s.builtExtras = [{ facId: 'library_scriptorium', status: 'built' }];
      s.facilityLevels.library_scriptorium = 1;
    }));
    await openTile(ba, 'library_scriptorium');
    equal(await orderState(ba, CHART_ORDER), { button: 'Needs Level 2.', off: true, why: '' });
    await closeAll(ba);
  });

  await check('at Level 2: it takes 4 days, makes 1 Overland chart and costs nothing; Issue Order takes no gold, and a second chart order waits its turn', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.facilityLevels.library_scriptorium = 2; }));
    await openTile(ba, 'library_scriptorium');
    equal(await bare(ba, '[data-test=days-' + CHART_ORDER + ']'), 'Takes 4 days');
    assert(/Makes: 1 Overland chart/.test(await bare(ba, '[data-test=goods-' + CHART_ORDER + ']')), await bare(ba, '[data-test=goods-' + CHART_ORDER + ']'));
    equal((await orderState(ba, CHART_ORDER)).button, 'Issue Order');
    await ba.click('[data-test=issue-' + CHART_ORDER + ']');
    await ba.waitForTimeout(450);
    const s = await bas(ba);
    const o = s.pendingOrders.filter(x => x.fnId === 'prepare_overland_travel_charts');
    equal([o.length, o[0].label, o[0].dueDay, s.treasuryGP], [1, 'Library & Scriptorium: Prepare Overland Travel Charts', 5, 100]);
    await openTile(ba, 'library_scriptorium');
    const again = await orderState(ba, CHART_ORDER);
    equal([again.button, again.off], ['Can\'t order yet', true], 'one chart order at a time');
    equal(await ba.isDisabled('[data-test=issue-library_scriptorium__research]'), false, 'scripture Research still runs beside it');
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Building the Wyvern Roost, Griffin Tower and Dire Wolf Den');

  await check('each builds in a construction slot in 21 days, for no gold ("Construct the Wyvern Roost? It takes 21 days.")', async () => {
    const asked = [];
    for (const fac of ['wyvern_roost', 'griffin_tower', 'dire_wolf_den']) asked.push(await construct(ba, fac));
    assert(asked[0].includes('Construct the Wyvern Roost? It takes 21 days.'), asked[0]);
    assert(asked[1].includes('Construct the Griffin Tower? It takes 21 days.'), asked[1]);
    assert(asked[2].includes('Construct the Dire Wolf Den? It takes 21 days.'), asked[2]);
    const s = await bas(ba);
    equal(s.builtExtras.slice(1).map(e => [e.facId, e.status, e.startDay, e.readyDay]),
      [['wyvern_roost', 'building', 1, 22], ['griffin_tower', 'building', 1, 22], ['dire_wolf_den', 'building', 1, 22]]);
    equal([s.builtPlots.filter(Boolean), s.treasuryGP, s.creatures], [[], 100, []], 'no plot used, no gold, and building them brings no creature');
  });

  await check('4 camps later the Library has made 1 Overland chart, into the Warehouse, with no gold spent', async () => {
    const w = await passDays(ex, ba, 4);
    assert(/Library & Scriptorium: Prepare Overland Travel Charts is complete\./.test(w.exWord), 'the Explorer\'s word: ' + w.exWord);
    const s = await bas(ba);
    equal([s.day, qty(s, CHART), s.treasuryGP, s.pendingOrders.filter(o => o.facId === 'library_scriptorium').length], [5, 1, 100, 0]);
    assert(s.log.some(l => l.body === 'Library & Scriptorium: Prepare Overland Travel Charts → Added to Warehouse: 1 Overland chart.'), logText(s));
  });

  await check('17 camps more (Day 22): all three are built at Level 1, with nobody living in them', async () => {
    await passDays(ex, ba, 17);
    const s = await bas(ba);
    equal([s.day, s.builtExtras.map(e => e.facId + ' ' + e.status)], [22, ['library_scriptorium built', 'wyvern_roost built', 'griffin_tower built', 'dire_wolf_den built']]);
    equal(['wyvern_roost', 'griffin_tower', 'dire_wolf_den'].map(f => s.facilityLevels[f]), [1, 1, 1]);
    equal(s.creatures, []);
  });

  /* ------------------------------------------------------------------ */
  section('House Elara\'s Wyvern');

  await check('the Roost\'s panel: House Elara\'s Wyvern takes 3 days, costs nothing, and the Creatures list is empty; the panel fits the laptop', async () => {
    await openTile(ba, 'wyvern_roost');
    equal(await bare(ba, '[data-test=days-' + ROOST + ']'), 'Takes 3 days');
    equal(await orderState(ba, ROOST), { button: 'Issue Order', off: false, why: '' });
    equal(await panelCreatures(ba, 'wyvern_roost'), { room: null, housed: [], waiting: [] });
    assert(/None yet\. Give the order House Elara's Wyvern, above, to record Elara's wyvern here\./.test(await bare(ba, '[data-test=creatures-wyvern_roost]')), await bare(ba, '[data-test=creatures-wyvern_roost]'));
    equal(await panelFits(ba, ROOST), { sideways: false, outOfView: [], underFooter: false });
    await H.shot(ba, 'creatures-roost-empty-laptop');
  });

  await check('Issue Order: it\'s on its way (ready on Day 25), takes no gold, and a second can\'t be given', async () => {
    gp = (await bas(ba)).treasuryGP;
    await ba.dblclick('[data-test=issue-' + ROOST + ']');
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    const o = s.pendingOrders.filter(x => x.fnId === 'house_elara_wyvern');
    equal([o.length, o[0].label, o[0].dueDay, s.treasuryGP, s.creatures], [1, 'Wyvern Roost: House Elara\'s Wyvern', 25, gp, []], 'one order, nothing recorded yet');
    await openTile(ba, 'wyvern_roost');
    equal(await orderState(ba, ROOST), { button: 'Being housed', off: true, why: 'Elara\'s wyvern is already being housed at the Wyvern Roost: ready on Day 25.' });
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Grant a creature… in the Explorer');

  await check('Grant a creature… sits under Sent to the Bastion; a double-click opens one dialog (Griffin or Dire Wolf, a name, what for), which fits the laptop; Cancel sends nothing', async () => {
    const before = await exs(ex);
    await ex.waitForTimeout(400);
    await ex.dblclick('[data-test=creature-open]');
    await ex.waitForSelector('[data-test=creature-dialog]');
    await ex.waitForTimeout(300);
    equal(await ex.$$eval('[data-test=creature-dialog]', l => l.length), 1, 'one dialog');
    equal(await ex.$$eval('[data-test=creature-species] option', o => o.map(x => x.value + ' ' + x.textContent)), ['griffin Griffin', 'dire_wolf Dire Wolf']);
    equal(await ex.$$eval('[data-test=creature-dialog] .tsi-modal__foot button', l => l.map(b => b.textContent)), ['Cancel', 'Grant']);
    assert(/^Grant the Ironbow a griffin or a dire wolf when the party has won one\./.test(await bare(ex, '[data-test=creature-dialog] .tsi-modal__body')), await bare(ex, '[data-test=creature-dialog] .tsi-modal__body'));
    equal((await H.layoutCheck(ex, ['[data-test=creature-dialog]'])).outOfView, [], 'the dialog fits the laptop');
    await ex.click('[data-test=creature-dialog] .tsi-modal__foot button:text-is("Cancel")');
    await ex.waitForTimeout(400);
    equal((await exs(ex)).journey.outbox, before.journey.outbox, 'nothing sent');
  });

  await check('Grant a griffin named Swiftwing: the Explorer sends it once ("Sent to the Bastion: a griffin (Swiftwing)…"), listed as "Creature: Griffin (Swiftwing)"', async () => {
    await closeAll(ex);
    await ex.waitForTimeout(400);
    await ex.click('[data-test=creature-open]');
    await ex.waitForSelector('[data-test=creature-dialog]');
    await ex.selectOption('[data-test=creature-species]', 'griffin');
    await ex.fill('[data-test=creature-name]', 'Swiftwing');
    await ex.fill('[data-test=creature-why]', 'Won at the Ember Fair');
    await H.shot(ex, 'creatures-grant-dialog-laptop');
    await ex.dblclick('[data-test=creature-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ex.waitForTimeout(500);
    const s = await exs(ex);
    const sent = s.journey.outbox.filter(m => m.type === 'creature');
    equal(sent.map(m => [m.type, m.day, m.species, m.name, m.text]), [['creature', 22, 'griffin', 'Swiftwing', 'Griffin for the Ironbow (Swiftwing): Won at the Ember Fair.']], 'one grant');
    assert(/^[A-Za-z0-9-]+:dm:0$/.test(sent[0].id), sent[0].id);
    equal(await bare(ex, '[data-test=notice]'), 'Sent to the Bastion: a griffin (Swiftwing) for the Ironbow, to be housed at the Griffin Tower.');
    equal((await sentTop(ex)).title, 'Creature: Griffin (Swiftwing)');
  });

  await check('the Bastion holds Swiftwing once, waiting for a home: a notice, the Day Log, and "Creature granted: Griffin (Swiftwing)" in Clan Influence', async () => {
    await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.length === 1, null, { timeout: 8000 });
    await H.waitForNotice(ba, /From the Explorer: a griffin \(Swiftwing\) for the Ironbow, waiting for a home at the Griffin Tower\./);
    const s = await bas(ba);
    const c = s.creatures[0];
    swift = c.id;
    const msg = (await exs(ex)).journey.outbox.filter(m => m.type === 'creature')[0];
    equal(c, { id: 'cr-' + msg.id.replace(/:/g, '-'), species: 'griffin', owner: '', name: 'Swiftwing', status: 'waiting', home: '', grantedDay: 22, housedDay: null, msgId: msg.id });
    equal(Object.values(s.bridge.done).map(r => [r.r, r.type, r.species, r.name, r.creatureId, r.held]), [['applied', 'creature', 'griffin', 'Swiftwing', swift, false]], 'one receipt');
    assert(s.log.some(l => l.body === 'Creature granted (DM, Day 22): a griffin (Swiftwing), waiting for a home at the Griffin Tower. Griffin for the Ironbow (Swiftwing): Won at the Ember Fair.'), logText(s));
    equal(s.treasuryGP, gp, 'no gold');
    await H.shot(ba, 'creatures-grant-notice-laptop');
    await H.dismissNotices(ba);
    await closeAll(ba);
    await ba.click('[data-test=open-influence]');
    await ba.waitForSelector('[data-test=bridge-row]');
    assert(/^Creature granted: Griffin \(Swiftwing\)/.test(await bare(ba, '[data-test=bridge-row]')), await bare(ba, '[data-test=bridge-row]'));
    await closeAll(ba);
  });

  await check('the Explorer\'s Sent to the Bastion says Applied: "the Bastion holds the griffin (Swiftwing); house it at the Griffin Tower"', async () => {
    await ex.waitForFunction(() => document.querySelector('[data-test=sent]').getAttribute('data-status') === 'applied', null, { timeout: 8000 });
    equal(await sentTop(ex), { status: 'applied', title: 'Creature: Griffin (Swiftwing)', line: 'Applied on Day 22: the Bastion holds the griffin (Swiftwing); house it at the Griffin Tower.' });
    equal(await bare(ex, '[data-test=sent-status]'), 'Applied');
  });

  /* ------------------------------------------------------------------ */
  section('House a Griffin, and House a Dire Wolf');

  await check('the Griffin Tower\'s panel: Swiftwing waits for a home, Room 0 of 1, and House a Griffin offers Swiftwing; the panel fits the laptop', async () => {
    await openTile(ba, 'griffin_tower');
    equal(await panelCreatures(ba, 'griffin_tower'), {
      room: 'Room: 0 of 1. Each level of the Griffin Tower houses one griffin; upgrade it to house more.',
      housed: [],
      waiting: [['Swiftwing', 'Waiting for a home at the Griffin Tower.']]
    });
    equal(await ba.$$eval('[data-test=sel-' + TOWER + '] option', o => o.map(x => x.textContent)), ['Swiftwing']);
    equal(await orderState(ba, TOWER), { button: 'Issue Order', off: false, why: '' });
    equal(await bare(ba, '[data-test=days-' + TOWER + ']'), 'Takes 3 days');
    assert(/^Coming later/.test(await bare(ba, '[data-test=creatures-later-griffin_tower]')), 'Coming later');
    equal(await panelFits(ba, TOWER), { sideways: false, outOfView: [], underFooter: false });
    await H.shot(ba, 'creatures-tower-waiting-laptop');
  });

  await check('House a Griffin (Swiftwing): ready on Day 25, no gold; the room is taken, so another can\'t be given meanwhile', async () => {
    await ba.click('[data-test=issue-' + TOWER + ']');
    await ba.waitForTimeout(450);
    const s = await bas(ba);
    const o = s.pendingOrders.filter(x => x.fnId === 'house_griffin');
    equal([o.length, o[0].label, o[0].dueDay, o[0].chosen.creatureId, s.treasuryGP], [1, 'Griffin Tower: House a Griffin (Swiftwing)', 25, swift, gp]);
    await openTile(ba, 'griffin_tower');
    const p = await panelCreatures(ba, 'griffin_tower');
    equal([p.room, p.waiting], ['Room: 1 of 1 (1 being housed). Each level of the Griffin Tower houses one griffin; upgrade it to house more.', [['Swiftwing', 'Being housed at the Griffin Tower: ready on Day 25.']]]);
    equal(await orderState(ba, TOWER), { button: 'One at a time', off: true, why: 'The Griffin Tower houses one griffin at a time: Swiftwing is ready on Day 25.' });
    await closeAll(ba);
  });

  await check('a dire wolf with no name, granted and given House a Dire Wolf at the Den (ready on Day 25)', async () => {
    await grant(ex, 'dire_wolf', '', 'To guard the gate');
    equal(await bare(ex, '[data-test=notice]'), 'Sent to the Bastion: a dire wolf for the Ironbow, to be housed at the Dire Wolf Den.');
    await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.length === 2, null, { timeout: 8000 });
    await H.waitForNotice(ba, /From the Explorer: a dire wolf for the Ironbow, waiting for a home at the Dire Wolf Den\./);
    await H.dismissNotices(ba);
    wolf = (await bas(ba)).creatures[1].id;
    await openTile(ba, 'dire_wolf_den');
    equal(await ba.$$eval('[data-test=sel-' + DEN + '] option', o => o.map(x => x.textContent)), ['Dire Wolf (granted Day 22)']);
    await ba.click('[data-test=issue-' + DEN + ']');
    await ba.waitForTimeout(450);
    const s = await bas(ba);
    const o = s.pendingOrders.filter(x => x.fnId === 'house_dire_wolf');
    equal([o.length, o[0].label, o[0].dueDay, o[0].chosen.creatureId, s.treasuryGP], [1, 'Dire Wolf Den: House a Dire Wolf (granted Day 22)', 25, wolf, gp]);
    await ex.waitForFunction(() => document.querySelector('[data-test=sent]').getAttribute('data-status') === 'applied', null, { timeout: 8000 });
    equal(await sentTop(ex), { status: 'applied', title: 'Creature: Dire Wolf', line: 'Applied on Day 22: the Bastion holds the dire wolf; house it at the Dire Wolf Den.' });
  });

  await check('3 camps later (Day 25) all three are home: the forecast said so, and each panel lists its creature, guarding the Ironbow', async () => {
    const w = await passDays(ex, ba, 3);
    assert(/Wyvern Roost: House Elara's Wyvern is complete\./.test(w.exWord) && /Griffin Tower: House a Griffin \(Swiftwing\) is complete\./.test(w.exWord) && /Dire Wolf Den: House a Dire Wolf \(granted Day 22\) is complete\./.test(w.exWord), 'the Explorer\'s word: ' + w.exWord);
    assert(!/needs your roll/.test(w.exWord), 'no roll asked for: ' + w.exWord);
    const s = await bas(ba);
    equal([s.day, s.treasuryGP], [25, gp]);
    equal(register(s), [
      [swift, 'griffin', 'Swiftwing', 'housed', 'griffin_tower'],
      [wolf, 'dire_wolf', '', 'housed', 'dire_wolf_den'],
      [WYVERN, 'wyvern', '', 'housed', 'wyvern_roost']
    ]);
    equal(s.creatures[2], { id: WYVERN, species: 'wyvern', owner: 'elara', name: '', status: 'housed', home: 'wyvern_roost', grantedDay: 25, housedDay: 25, msgId: '' }, 'Elara\'s wyvern, recorded once');
    assert(s.log.some(l => l.body === 'Wyvern Roost: House Elara\'s Wyvern → Elara\'s wyvern lives at the Ironbow now, at the Wyvern Roost (Elara\'s). It guards the Ironbow when it is attacked.'), logText(s));
    assert(s.log.some(l => l.body === 'Griffin Tower: House a Griffin (Swiftwing) → Swiftwing has a home at the Griffin Tower. It guards the Ironbow when it is attacked.'), logText(s));
  });

  await check('the Roost\'s panel lists Elara\'s wyvern ("Defends the Ironbow: Battle Value 11, Flight"); a second House Elara\'s Wyvern is refused', async () => {
    await openTile(ba, 'wyvern_roost');
    equal(await panelCreatures(ba, 'wyvern_roost'), { room: null, housed: [['Elara\'s wyvern', 'Guarding the Ironbow.']], waiting: [] });
    equal(await bare(ba, '[data-test=creature-war-' + WYVERN + ']'), 'Defends the Ironbow: Battle Value 11, Flight');
    equal(await orderState(ba, ROOST), { button: 'Already at the Ironbow', off: true, why: 'Elara\'s wyvern already lives at the Ironbow.' });
    await ba.hover('[data-test=creature-' + WYVERN + ']');
    await ba.waitForFunction(() => /Elara's wyvern/.test(document.querySelector('[data-test=tooltip]').textContent), null, { timeout: 4000 });
    const tip = await bare(ba, '[data-test=tooltip]');
    assert(/Cohesion\s*7/.test(tip) && /Attack\s*\+6/.test(tip) && /Defence\s*13/.test(tip) && /Move\s*6/.test(tip) && /Resolve\s*\+2/.test(tip) && /Battle Value\s*11/.test(tip) && /Flight/.test(tip), tip);
    assert(/Fights only when the Ironbow is attacked \(Defend Bastion\), never on a War Action\. Never killed or captured: at worst badly wounded for 21 days\./.test(tip), tip);
    await H.shot(ba, 'creatures-roost-wyvern-laptop');
    await ba.click('[data-test=issue-' + ROOST + ']', { force: true });
    await ba.waitForTimeout(400);
    const s = await bas(ba);
    equal([s.pendingOrders.filter(o => o.fnId === 'house_elara_wyvern').length, s.creatures.filter(c => c.species === 'wyvern').length], [0, 1], 'no second order, no second wyvern');
    const res = await ba.evaluate(() => {
      const st = JSON.parse(JSON.stringify(TSI.bastion.debug.state()));
      const D = window.TSI_DATA;
      const data = { bastion: D.bastion, facilities: D.bastionFacilities, tools: D.bastionTools, events: D.bastionEvents, research: D.bastionResearch, goods: D.bastionGoods, commerce: D.bastionCommerce, courier: D.bastionCourier, creatures: D.bastionCreatures };
      return TSI.bastion.rules.issueOrder(st, data, 'wyvern_roost', 'house_elara_wyvern', 0, Math.random);
    });
    equal(res, { ok: false, message: 'Elara\'s wyvern already lives at the Ironbow.' }, 'the rules refuse it too');
    await closeAll(ba);
  });

  await check('Management lists every creature under Creatures, with no Remove button', async () => {
    await closeAll(ba);
    await ba.waitForTimeout(300);
    await ba.click('[data-test=open-management]');
    await ba.waitForSelector('[data-test=creatures]');
    await ba.waitForTimeout(300);
    equal(await ba.$$eval('[data-test=creatures] [data-creature]', l => l.map(r => r.getAttribute('data-test'))), ['mgmt-creature-' + swift, 'mgmt-creature-' + wolf, 'mgmt-creature-' + WYVERN]);
    equal(await bare(ba, '[data-test=mgmt-creature-' + WYVERN + ']'), 'Elara\'s wyvernWyvern • Elara\'s own • Wyvern Roost • Guarding the Ironbow.');
    equal(await ba.$$eval('[data-test=creatures] button', l => l.length), 0, 'no Remove');
    const lay = await H.layoutCheck(ba, []);
    assert(lay.scrollWidth <= lay.clientWidth, 'sideways scroll in Management');
    await H.shot(ba, 'creatures-management-laptop');
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('A second griffin: no room until the Tower is upgraded');

  await check('a second griffin, Stormfeather, waits: House a Griffin says "No room: a Level 1 Griffin Tower houses 1 griffin; upgrade it to house more."', async () => {
    await grant(ex, 'griffin', 'Stormfeather', '');
    await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.length === 4, null, { timeout: 8000 });
    await H.dismissNotices(ba);
    storm = byName(await bas(ba), 'Stormfeather').id;
    await openTile(ba, 'griffin_tower');
    equal(await panelCreatures(ba, 'griffin_tower'), {
      room: 'Room: 1 of 1. Each level of the Griffin Tower houses one griffin; upgrade it to house more.',
      housed: [['Swiftwing', 'Guarding the Ironbow.']],
      waiting: [['Stormfeather', 'Waiting for a home at the Griffin Tower.']]
    });
    equal(await orderState(ba, TOWER), { button: 'No room', off: true, why: 'No room: a Level 1 Griffin Tower houses 1 griffin; upgrade it to house more.' });
    await H.shot(ba, 'creatures-tower-no-room-laptop');
  });

  await check('Upgrade the Griffin Tower to Level 2 (7 days, no gold); Stormfeather still waits meanwhile', async () => {
    equal(await bare(ba, '[data-test=upgrade-text-griffin_tower]'), 'To Level 2: takes 7 days, no gold.');
    await ba.click('[data-test=upgrade-griffin_tower]');
    await ba.waitForTimeout(450);
    const s = await bas(ba);
    const up = s.pendingOrders.filter(o => o.facId === 'griffin_tower')[0];
    equal([up.label, up.dueDay, s.treasuryGP], ['Griffin Tower: Upgrade to Level 2', 32, gp]);
    await openTile(ba, 'griffin_tower');
    equal((await orderState(ba, TOWER)).button, 'No room');
    await closeAll(ba);
  });

  await check('7 camps later (Day 32) the Tower is Level 2: Room 1 of 2, and House a Griffin (Stormfeather) can be given', async () => {
    await passDays(ex, ba, 7);
    const s = await bas(ba);
    equal([s.day, s.facilityLevels.griffin_tower], [32, 2]);
    await openTile(ba, 'griffin_tower');
    equal((await panelCreatures(ba, 'griffin_tower')).room, 'Room: 1 of 2. Each level of the Griffin Tower houses one griffin; upgrade it to house more.');
    equal(await ba.$$eval('[data-test=sel-' + TOWER + '] option', o => o.map(x => x.textContent)), ['Stormfeather']);
    equal(await orderState(ba, TOWER), { button: 'Issue Order', off: false, why: '' });
    await ba.click('[data-test=issue-' + TOWER + ']');
    await ba.waitForTimeout(450);
    const o = (await bas(ba)).pendingOrders.filter(x => x.fnId === 'house_griffin');
    equal([o.length, o[0].label, o[0].dueDay, o[0].chosen.creatureId], [1, 'Griffin Tower: House a Griffin (Stormfeather)', 35, storm]);
    await closeAll(ba);
  });

  await check('3 camps later (Day 35) Stormfeather lives at the Tower too: Room 2 of 2', async () => {
    await passDays(ex, ba, 3);
    const s = await bas(ba);
    equal([s.day, byName(s, 'Stormfeather').status, byName(s, 'Stormfeather').home, byName(s, 'Stormfeather').housedDay, s.creatures.length], [35, 'housed', 'griffin_tower', 35, 4]);
    await openTile(ba, 'griffin_tower');
    const p = await panelCreatures(ba, 'griffin_tower');
    equal([p.room, p.housed, p.waiting], ['Room: 2 of 2. Each level of the Griffin Tower houses one griffin; upgrade it to house more.',
      [['Swiftwing', 'Guarding the Ironbow.'], ['Stormfeather', 'Guarding the Ironbow.']], []]);
    equal(await panelFits(ba, TOWER), { sideways: false, outOfView: [], underFooter: false });
    await H.shot(ba, 'creatures-tower-two-laptop');
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Defend Bastion: the creatures stand with the defenders');

  let before = null;
  await check('at war with Bacca, its attack comes the next day: the pop-up names the four creatures, and they stand in the defence', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.organization = { type: 'clan', name: 'Clan Ironbow', chief: 'Harry', motto: '', foundedAtDay: 1 };
      s.clanHonor = 40;
      s.defenders.count = 10;
      s.defenders.armed = true;
      s.politicalCapital.bacca = 10;
      s.wars = { bacca: { since: s.day, last: s.day, next: s.day + 1 } };
    }));
    await closeAll(ex);
    /* The attack d6 shows 1 and the attacking force's d6 shows 4 (the Bastion's dice only). */
    await ba.evaluate(() => { window.__dice = [0, 0.5]; });
    await camp(ex);
    await ba.waitForSelector('[data-test=attack]', { timeout: 15000 });
    await ba.waitForTimeout(450);
    equal(await ba.evaluate(() => window.__dice.length), 0, 'both dice used');
    const t = await bare(ba, '[data-test=attack]');
    assert(/Standing to defend the Ironbow: 10 defenders, Swiftwing, Dire Wolf \(granted Day 22\), Elara's wyvern, Stormfeather\./.test(t), t);
    const s = await bas(ba);
    equal([s.day, s.militaryActions.length, s.militaryActions[0].kind], [36, 1, 'defence']);
    equal(s.militaryActions[0].commit.creatures, [swift, wolf, WYVERN, storm]);
    before = s.creatures;
    await H.shot(ba, 'creatures-attack-laptop');
  });

  await check('Defend the Ironbow: after the three rolls, the War Table has one unit for each creature, by its name; hovering shows its stat block', async () => {
    await ba.click('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button.tsi-btn--primary');
    /* Weather 15, Morale 15, and Luck 3 (Luck −1: the enemy acts first, as in the war test). */
    const rolls = [15, 15, 3];
    for (let n = 0; n < 40; n++) {
      await ba.waitForTimeout(250);
      if (await ba.$('[data-test=wt-root]')) break;
      if (!(await modalOpen(ba))) continue;
      if (await ba.$('[data-test=d20]')) { await ba.fill('[data-test=d20]', String(rolls.shift())); await clickPop(ba, 'Continue'); }
      else await ba.click('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot button.tsi-btn--primary');
    }
    await ba.waitForSelector('[data-test=wt-root]');
    await ba.waitForTimeout(800);
    await ba.click('[data-test=wt-begin-deploy]');
    await ba.waitForTimeout(800);
    const units = await ba.evaluate(() => TSI.bastion.debug.warTable().battle().units.filter(u => u.source && u.source.creature).map(u => [u.id, u.name, u.source.creature, u.source.species]));
    equal(units, [['p-creature-1', 'Swiftwing', swift, 'griffin'], ['p-creature-2', 'Dire Wolf (granted Day 22)', wolf, 'dire_wolf'], ['p-creature-3', 'Elara\'s wyvern', WYVERN, 'wyvern'], ['p-creature-4', 'Stormfeather', storm, 'griffin']]);
    const r = await ba.evaluate(() => TSI.bastion.debug.warTable().tokenScreenRect('p-creature-3'));
    await ba.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
    await ba.waitForFunction(() => { const t = document.querySelector('[data-test=wt-tip]'); return t && !t.hidden && /Elara's wyvern/.test(t.textContent); }, null, { timeout: 4000 });
    const tip = await bare(ba, '[data-test=wt-tip]');
    assert(/Cohesion\s*7\s*\/\s*7/.test(tip) && /Battle Value\s*11/.test(tip) && /Flight/.test(tip), tip);
    equal(rolls, [], 'three rolls');
    await H.shot(ba, 'creatures-war-table-laptop');
    await ba.mouse.move(5, 5);
  });

  await check('the battle goes badly: Swiftwing is defeated, and after Withdraw the War Report says a creature is never killed; Swiftwing is badly wounded for 21 days', async () => {
    await ba.waitForTimeout(400);
    await ba.click('[data-test=wt-start-battle]');
    await clickPop(ba, 'Start Battle');
    await ba.waitForSelector('[data-test=wt-briefing]');
    await clickPop(ba, 'Begin the battle');
    await ba.waitForTimeout(400);
    if ((await bas(ba)).militaryActions[0].battle.turnSide === 'enemy') {
      await ba.waitForTimeout(400);
      await ba.click('[data-test=wt-enemy-act]');
    }
    await ba.waitForFunction(() => { const m = TSI.bastion.debug.state().militaryActions[0]; return m.battle.started && m.battle.turnSide === 'player'; }, null, { timeout: 10000 });
    await ba.waitForTimeout(400);
    await ba.click('[data-test=wt-close]');
    await ba.waitForTimeout(400);
    /* As if the enemy had beaten Swiftwing (as the war test sets a battle up). */
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      const u = s.militaryActions[0].battle.units.find(x => x.id === 'p-creature-1');
      Object.assign(u, { status: 'defeated', cohesion: 0, pos: null });
    }));
    await closeAll(ba);
    await ba.evaluate(() => TSI.bastion.debug.reveal('ma-continue-0'));
    await ba.waitForTimeout(400);
    await ba.click('[data-test=ma-continue-0]');
    await ba.waitForSelector('[data-test=wt-root]');
    await ba.waitForTimeout(600);
    await ba.click('[data-test=wt-withdraw]');
    await ba.waitForSelector('[data-test=wt-withdraw-preview]');
    const pre = await bare(ba, '[data-test=wt-withdraw-preview]');
    assert(/withdrawing counts as losing the defence/.test(pre) && /A d6 for Swiftwing: badly wounded, wounded or recovering \(a creature is never killed or captured\)\./.test(pre), pre);
    /* Swiftwing's d6 shows 1, which would kill anything else. */
    await ba.evaluate(() => { window.__dice = [0]; });
    await clickPop(ba, 'Withdraw');
    await ba.waitForFunction(() => { const t = document.querySelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__title'); return t && t.textContent === 'War Report'; }, null, { timeout: 10000 });
    await ba.waitForTimeout(450);
    const report = await ba.$eval('.tsi-modal:not(.tsi-bas-panel)', m => m.textContent.replace(/\s+/g, ' '));
    assert(/Withdrawal: Defend Bastion vs Bacca/.test(report), report);
    assert(/Swiftwing: badly wounded \(d6 1: a creature is never killed\), back on Day 57\./.test(report), report);
    await H.shot(ba, 'creatures-war-report-laptop');
    await clickPop(ba, 'Close');
    await ba.waitForFunction(() => !document.querySelector('[data-test=wt-root]'));
    const s = await bas(ba);
    equal(s.militaryActions.length, 0);
    equal(s.warRecovery.filter(r => r.kind === 'creature').map(r => [r.creatureId, r.name, r.status, r.untilDay]), [[swift, 'Swiftwing', 'badly_wounded', 57]]);
  });

  await check('no creature has gone: the register is exactly as before the battle, and the Tower shows Swiftwing badly wounded until Day 57', async () => {
    await closeAll(ba);
    const s = await bas(ba);
    equal(s.creatures, before);
    await openTile(ba, 'griffin_tower');
    equal((await panelCreatures(ba, 'griffin_tower')).housed, [['Swiftwing', 'Badly wounded: fit again on Day 57.'], ['Stormfeather', 'Guarding the Ironbow.']]);
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Demolishing the Griffin Tower');

  await check('Demolish… says the two griffins stay at the Ironbow; Demolish keeps them, still guarding it', async () => {
    await openTile(ba, 'griffin_tower');
    await ba.click('[data-test=demolish-griffin_tower]');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Demolish")');
    const q = await lastModal(ba);
    assert(q.includes('The 2 creatures living here stay at the Ironbow, still guarding it; rebuilding the Griffin Tower gives them a home again.'), q);
    await H.shot(ba, 'creatures-demolish-laptop');
    await H.clickModal(ba, 'Demolish');
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    equal(s.builtExtras.map(e => e ? e.facId : ''), ['library_scriptorium', 'wyvern_roost', '', 'dire_wolf_den'], 'its slot is free');
    equal(s.creatures, before, 'both griffins stay, still housed there');
    await closeAll(ba);
    await ba.click('[data-test=open-management]');
    await ba.waitForSelector('[data-test=creatures]');
    await ba.waitForTimeout(300);
    equal(await bare(ba, '[data-test=mgmt-creature-status-' + storm + ']'), 'Guarding the Ironbow (the Griffin Tower isn\'t standing: rebuilding it gives it a home again).');
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('A reload');

  await check('a reload of both windows adds nothing: the same creatures, receipts and Sent to the Bastion, and no new notice', async () => {
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
    equal(await ex.$$eval('[data-test=sent]', l => l.filter(n => /^Creature/.test(n.querySelector('strong').textContent)).map(n => n.getAttribute('data-status'))), ['applied', 'applied', 'applied']);
  });

  /* ------------------------------------------------------------------ */
  section('Harry\'s sample file (tests/fixtures/bastion-pr7-sample.json), on the test page');

  await check('on the test page, with only the Bastion open, the sample imports (the Library at Level 2, the Roost, Tower and Den at Level 1, 300 gp, no creatures); then the Explorer opens beside it, and a griffin granted earlier is skipped, not held', async () => {
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
    await b3.waitForFunction(() => TSI.bastion && TSI.bastion.debug, null, { timeout: 8000 });
    await H.chooseFile(b3, '[data-test=import-save]', SAMPLE);
    await H.clickModal(b3, 'Import');
    await b3.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().facilityLevels.library_scriptorium === 2, null, { timeout: 8000 });
    const e3 = await openExplorer(c2, HARNESS);
    await e3.waitForTimeout(500);
    await b3.waitForFunction(() => TSI.bastion.debug.state().anchored && !TSI.bastion.debug.state().bridge.fresh, null, { timeout: 8000 });
    const s = await bas(b3);
    equal([s.treasuryGP, s.partyLevel, s.builtExtras.filter(Boolean), s.builtPlots.filter(Boolean), s.creatures],
      [300, 9, ['library_scriptorium', 'wyvern_roost', 'griffin_tower', 'dire_wolf_den'].map(id => ({ facId: id, status: 'built' })), [], []]);
    equal(['library_scriptorium', 'wyvern_roost', 'griffin_tower', 'dire_wolf_den'].map(f => s.facilityLevels[f]), [2, 1, 1, 1]);
    equal(Object.values(s.bridge.done).map(r => [r.r, r.type, r.species, r.name]), [['skipped', 'creature', 'griffin', 'Old Test']], 'the earlier grant is skipped');
    assert(/1 creature grant, sent before this Bastion started, was skipped, so nothing counts twice\./.test(logText(s)), logText(s));
    assert(/A sample Bastion for trying the creatures/.test(logText(s)), logText(s));
    await e3.waitForFunction(() => { const n = document.querySelector('[data-test=sent]'); return n && n.getAttribute('data-status') === 'skipped'; }, null, { timeout: 8000 });
    equal(await bare(e3, '[data-test=sent-line]'), 'Skipped: sent before this Bastion started. Grant it again if it should count.');
    /* The sample works: House Elara's Wyvern and the chart order can be given; the Tower has nobody waiting. */
    await openTile(b3, 'wyvern_roost');
    equal((await orderState(b3, ROOST)).button, 'Issue Order');
    await openTile(b3, 'library_scriptorium');
    equal((await orderState(b3, CHART_ORDER)).button, 'Issue Order');
    await openTile(b3, 'griffin_tower');
    equal((await orderState(b3, TOWER)).why, 'No griffin is waiting for a home. The DM grants one in the Explorer.');
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

  await check('the Roost, Tower and Den panels, Management\'s Creatures and the Grant dialog fit the TV, with nothing scrolling sideways', async () => {
    await ex.close();
    await ba.close();
    const tv = await context(browser, 'tv');
    const e2 = await openExplorer(tv);
    await e2.waitForTimeout(500);
    const b2 = await openBastion(tv);
    await b2.evaluate(() => TSI.bastion.debug.change(s => {
      s.partyLevel = 9;
      s.builtExtras = ['library_scriptorium', 'wyvern_roost', 'griffin_tower', 'dire_wolf_den'].map(id => ({ facId: id, status: 'built' }));
      s.facilityLevels.library_scriptorium = 2;
      s.facilityLevels.griffin_tower = 3;
      s.facilityLevels.dire_wolf_den = 2;
      const C = (id, species, name, status, home) => ({ id, species, owner: '', name, status, home, grantedDay: 1, housedDay: status === 'housed' ? 1 : null, msgId: id.slice(3) + ':dm:0' });
      s.creatures = [
        { id: 'elara_wyvern', species: 'wyvern', owner: 'elara', name: '', status: 'housed', home: 'wyvern_roost', grantedDay: 1, housedDay: 1, msgId: '' },
        C('cr-tvgriffin1', 'griffin', 'Swiftwing', 'housed', 'griffin_tower'),
        C('cr-tvgriffin2', 'griffin', 'Stormfeather', 'housed', 'griffin_tower'),
        C('cr-tvgriffin3', 'griffin', 'A griffin with a long name of forty lett', 'waiting', ''),
        C('cr-tvwolf1', 'dire_wolf', 'Greyfang', 'housed', 'dire_wolf_den'),
        C('cr-tvwolf2', 'dire_wolf', '', 'waiting', '')
      ];
      s.warRecovery = [{ id: 'rec-tv', kind: 'creature', name: 'Stormfeather', status: 'badly_wounded', untilDay: 22, creatureId: 'cr-tvgriffin2' }];
    }));
    for (const [fac, key] of [['wyvern_roost', ROOST], ['griffin_tower', TOWER], ['dire_wolf_den', DEN]]) {
      await openTile(b2, fac);
      equal(await panelFits(b2, key), { sideways: false, outOfView: [], underFooter: false }, fac);
      await H.shot(b2, 'creatures-' + fac + '-tv');
    }
    await closeAll(b2);
    await b2.click('[data-test=open-management]');
    await b2.waitForSelector('[data-test=creatures]');
    await b2.waitForTimeout(300);
    equal(await b2.$$eval('[data-test=creatures] [data-creature]', l => l.length), 6);
    const lay = await H.layoutCheck(b2, []);
    assert(lay.scrollWidth <= lay.clientWidth, 'sideways scroll in Management');
    await H.shot(b2, 'creatures-management-tv');
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
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'page errors');
    equal(ctx.log.net, [], 'internet');
    equal(ctx.log.failed, [], 'missing files');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
