/* The War Room's regiments (pull request 8a of the facilities overhaul;
   Harry's proposal, approved 15 October 2026), and the creature guards,
   from a double-clicked file, on the test page with Harry's sample file
   (tests/fixtures/bastion-pr8a-sample.json):
   - the sample's counted regiments become one record each, numbered;
   - the War Room lists them with their grade and Recouping, and its drill
     places; Drill a Regiment pays once and fills the only place at Level 2;
   - Rename… names a regiment, here and in Management;
   - Grant a creature… asks first (Cancel sends nothing); Release… frees a
     griffin still waiting, and the Explorer says so;
   - Recouping refills day by day; the drill gives Trained on its day;
   - at Level 3, a Coordinated Muster raises two formations;
   - a reload changes nothing; the War Room fits the laptop and the TV.
   Run with:  node tests/e2e/war-room.test.js */
'use strict';

const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
/* The test page, where Harry tries the sample file (it only takes test-page files). */
const HARNESS = H.fileUrl('tests/harness.html');
const SAMPLE = path.join(__dirname, '..', 'fixtures', 'bastion-pr8a-sample.json');

const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exs = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const lastModal = page => page.$$eval('.tsi-modal', ms => ms[ms.length - 1].textContent.replace(/\s+/g, ' ').trim());
const logText = s => s.log.map(l => l.body).join(' | ');
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
  await p.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
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

const regsOf = s => s.military.filter(r => typeof r.num === 'number');
const regText = page => page.$eval('[data-test=regiments]', n => n.innerText.replace(/\s+/g, ' ').trim());
async function grantWithAsk(ex, species, name, answer) {
  await closeAll(ex);
  await ex.waitForTimeout(400);
  await ex.click('[data-test=creature-open]');
  await ex.waitForSelector('[data-test=creature-dialog]');
  await ex.selectOption('[data-test=creature-species]', species);
  await ex.fill('[data-test=creature-name]', name || '');
  await ex.click('[data-test=creature-dialog] .tsi-modal__foot .tsi-btn--primary');
  await ex.waitForTimeout(300);
  const asked = await lastModal(ex);
  await ex.locator('.tsi-modal').last().locator('.tsi-modal__foot button', { hasText: answer }).click();
  await ex.waitForTimeout(400);
  return asked;
}

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  let ba = null;
  let ex = null;
  let first = null;

  section('Harry\'s sample on the test page');

  await check('the sample imports; its regiments become one record each, numbered by kind; the one at 30 of 50 is Recouping', async () => {
    ba = await ctx.newPage();
    await ba.goto(HARNESS + '?tool=bastion');
    await ba.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug, null, { timeout: 8000 });
    await H.chooseFile(ba, '[data-test=import-save]', SAMPLE);
    await H.clickModal(ba, 'Import');
    await ba.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().partyLevel === 17, null, { timeout: 8000 });
    ex = await openExplorer(ctx, HARNESS);
    await ba.waitForFunction(() => TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    const s = await bas(ba);
    equal(s.military.map(r => [r.name, r.num || null, r.strength || null, r.recoup || null]), [
      ['Lieutenant (1)', null, null, null], ['Line Infantry (100)', 1, null, null], ['Line Infantry (100)', 2, null, null],
      ['Archers (50)', 1, null, null], ['Heavy Infantry (50)', 1, 30, { days: 7, left: 7, from: 30 }]
    ]);
    equal(s.treasuryGP, 2000);
    first = regsOf(s)[0].id;
  });

  section('The War Room');

  await check('its panel lists each regiment with its grade and Recouping, and one drill place; Drill a Regiment lists those at full strength', async () => {
    await openTile(ba, 'war_room');
    equal(await regText(ba), 'REGIMENTS Drill places: 0 of 1 in use. Trained: +1 Resolve, +0.5 Battle Value; Veteran: +1 Cohesion, +0.5 Battle Value more. Line Infantry I Regular · 100 soldiers Rename… Line Infantry II Regular · 100 soldiers Rename… Archers I Regular · 50 soldiers Rename… Heavy Infantry I RECOUPING Regular · Recouping: 30 of 50, full on Day 8 Rename…');
    equal(await ba.$eval('[data-test=sel-war_room__drill]', n => [...n.options].map(o => o.text)), ['Line Infantry I → Trained (7 days) (125gp)', 'Line Infantry II → Trained (7 days) (125gp)', 'Archers I → Trained (7 days) (125gp)']);
    equal((await orderState(ba, 'war_room__coordinated_muster')).button, 'Needs Level 3.');
    const fit = await H.layoutCheck(ba, ['[data-test=issue-war_room__drill]']);
    assert(fit.scrollWidth <= fit.clientWidth, 'no sideways scroll');
  });

  await check('Drill a Regiment: 125 gp once (a double click drills once), ready on Day 8; the only place is taken', async () => {
    await ba.dblclick('[data-test=issue-war_room__drill]');
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    equal(s.treasuryGP, 1875);
    equal(s.pendingOrders.map(o => [o.label, o.dueDay, o.costGP]), [['War Room: Drill a Regiment (Line Infantry I → Trained)', 8, 125]]);
    equal(await orderState(ba, 'war_room__drill'), { button: 'Can\'t drill now', off: true, why: 'Every drill place is taken (1 of 1). Upgrading the War Room adds more.' });
    assert(/Line Infantry I Regular · 100 soldiers · Drilling to Trained: ready on Day 8/.test(await regText(ba)), await regText(ba));
  });

  await check('Rename… names a regiment, in the War Room and in Management', async () => {
    await ba.click('[data-test=regiment-rename-' + first + ']');
    await ba.waitForSelector('[data-test=regiment-name]');
    await ba.fill('[data-test=regiment-name]', 'The Ironbow Guard');
    await H.clickModal(ba, 'Rename');
    await ba.waitForTimeout(400);
    assert(/The Ironbow Guard Line Infantry • Regular · 100 soldiers · Drilling/.test(await regText(ba)), await regText(ba));
    equal(regsOf(await bas(ba))[0].label, 'The Ironbow Guard');
  });

  section('The creature guards');

  await check('Grant a creature… asks first: Cancel sends nothing; Grant sends it once', async () => {
    const asked = await grantWithAsk(ex, 'griffin', 'Oops', 'Cancel');
    equal(asked.replace(/^Scarlett Isles Explorer/, ''), 'Grant a griffin (Oops) to the Ironbow? Once the Bastion has it, it can only be released while it waits for a home.CancelGrant');
    equal((await exs(ex)).journey.outbox.filter(m => m.type === 'creature').length, 0, 'Cancel sends nothing');
    await grantWithAsk(ex, 'griffin', 'Oops', 'Grant');
    await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.length === 1, null, { timeout: 15000 });
    equal((await exs(ex)).journey.outbox.filter(m => m.type === 'creature').length, 1);
  });

  await check('Release… frees a griffin still waiting (it asks first); the Explorer says it was released', async () => {
    await H.dismissNotices(ba).catch(() => {});
    await openTile(ba, 'griffin_tower');
    const cid = (await bas(ba)).creatures[0].id;
    await ba.click('[data-test=creature-release-' + cid + ']');
    await ba.waitForTimeout(400);
    equal(await lastModal(ba), 'Release a creatureRelease Oops? It leaves the Ironbow for good: the grant isn\'t sent again, so to have it back the DM grants a new one in the Explorer.CancelRelease');
    await H.clickModal(ba, 'Release');
    await ba.waitForTimeout(500);
    equal((await bas(ba)).creatures, []);
    await closeAll(ba);
    await ex.waitForFunction(() => /released/.test((document.querySelector('[data-test=sent-line]') || {}).textContent || ''), null, { timeout: 8000 });
    equal(await bare(ex, '[data-test=sent-line]'), 'Applied on Day 1: the Bastion held the griffin (Oops), and has since released it.');
  });

  section('Days passing');

  await check('3 camps (Day 4): Heavy Infantry I refills to 38 of 50, full on Day 8', async () => {
    await passDays(ex, ba, 3);
    const h = regsOf(await bas(ba)).filter(r => /Heavy/.test(r.name))[0];
    equal([h.strength, h.recoup.left], [38, 4]);
  });

  await check('4 camps more (Day 8): the drill is done (The Ironbow Guard is Trained) and Heavy Infantry I is back to full strength', async () => {
    const r = await passDays(ex, ba, 4);
    const s = await bas(ba);
    equal(regsOf(s).map(x => [x.label || x.name, x.grade, x.strength || null]), [['The Ironbow Guard', 'trained', null], ['Line Infantry (100)', 'regular', null], ['Archers (50)', 'regular', null], ['Heavy Infantry (50)', 'regular', null]]);
    assert(/Heavy Infantry I is back to full strength\./.test(r.baWord + r.exWord), r.baWord);
    assert(/The Ironbow Guard is now Trained/.test(s.log.map(l => l.body).join(' | ')));
    equal(s.pendingOrders, []);
  });

  await check('at Level 3, a Coordinated Muster raises two formations in 7 days, numbered on', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.facilityLevels.war_room = 3; }));
    await openTile(ba, 'war_room');
    await ba.selectOption('[data-test=sel-war_room__coordinated_muster-0]', '3');
    await ba.selectOption('[data-test=sel-war_room__coordinated_muster-1]', '1');
    await ba.click('[data-test=issue-war_room__coordinated_muster]');
    await ba.waitForTimeout(500);
    equal((await bas(ba)).pendingOrders.map(o => [o.label, o.dueDay]), [['War Room: Coordinated Muster (Line Infantry (100), Archers (50))', 15]]);
    await closeAll(ba);
    await passDays(ex, ba, 7);
    await openTile(ba, 'war_room');
    assert(/Line Infantry III Regular · 100 soldiers .*Archers II Regular · 50 soldiers/.test(await regText(ba)), await regText(ba));
    assert(/Drill places: 0 of 2 in use/.test(await regText(ba)));
  });

  await check('a reload of both windows changes nothing', async () => {
    const before = await bas(ba);
    await ba.reload();
    await ba.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    await ex.reload();
    await ex.waitForSelector('[data-test=camp]');
    await ex.waitForTimeout(2000);
    const after = await bas(ba);
    equal([after.military, after.treasuryGP, after.creatures, after.pendingOrders], [before.military, before.treasuryGP, before.creatures, before.pendingOrders]);
  });

  section('The TV (1920 × 1080)');

  await check('the War Room panel fits the TV, with nothing scrolling sideways', async () => {
    const tv = await context(browser, 'tv');
    const p = await tv.newPage();
    await p.goto(HARNESS + '?tool=bastion');
    await p.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug, null, { timeout: 8000 });
    await H.chooseFile(p, '[data-test=import-save]', SAMPLE);
    await H.clickModal(p, 'Import');
    await p.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().partyLevel === 17, null, { timeout: 8000 });
    await p.waitForTimeout(600);
    await openTile(p, 'war_room');
    const fit = await H.layoutCheck(p, ['[data-test=regiments]']);
    assert(fit.scrollWidth <= fit.clientWidth, 'no sideways scroll');
    await H.shot(p, 'war-room-tv');
    await tv.close();
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'no page errors');
    equal(ctx.log.net, [], 'nothing online');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
