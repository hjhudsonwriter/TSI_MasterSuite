/* The Shrines at Levels 2 to 5, the Bastion's half (pull request 8b, part
   1; Harry's Shrine specification, 15 October 2026), from a double-clicked
   file, on the test page with Harry's sample file
   (tests/fixtures/bastion-pr8b-sample.json):
   - each Shrine's Favour, and orders that spend 5%, 10% or 25% of it when
     they start;
   - Bless Bastion Foundations listed but not yet available;
   - the items reach the Warehouse, and the Courier Exchange lists them;
   - a Great Rite waits at the Ironbow; a Blessing of Pelagos waits for the
     Dock's next ship;
   - a reload changes nothing.
   Run with:  node tests/e2e/shrines.test.js */
'use strict';

const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
/* The test page, where Harry tries the sample file (it only takes test-page files). */
const HARNESS = H.fileUrl('tests/harness.html');
const SAMPLE = path.join(__dirname, '..', 'fixtures', 'bastion-pr8b-sample.json');

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

const text = (page, test) => page.$eval('[data-test=' + test + ']', n => n.textContent.replace(/\s+/g, ' ').trim());

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  let ba = null;
  let ex = null;

  section('Harry\'s sample on the test page');

  await check('the sample imports: the three Shrines at Level 5, each god\'s Favour at 60%, the Courier Exchange at Level 2', async () => {
    ba = await ctx.newPage();
    await ba.goto(HARNESS + '?tool=bastion');
    await ba.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug, null, { timeout: 8000 });
    await H.chooseFile(ba, '[data-test=import-save]', SAMPLE);
    await H.clickModal(ba, 'Import');
    await ba.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && (TSI.bastion.debug.state().builtExtras || []).filter(Boolean).length === 3, null, { timeout: 8000 });
    /* The box that says what changed holds the Bastion until it is read (the Strip Back Overhaul). */
    await H.ackChanges(ba);
    ex = await openExplorer(ctx, HARNESS);
    await ba.waitForFunction(() => TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    const s = await bas(ba);
    equal([s.favour, s.facilityLevels.shrine_telluria, s.facilityLevels.courier_exchange], [{ telluria: 60, aurush: 60, pelagos: 60 }, 5, 2]);
  });

  section('The Shrines');

  await check('the Shrine of Telluria shows its Favour, its four new orders, and Bless Bastion Foundations not yet available, with the reason', async () => {
    await openTile(ba, 'shrine_telluria');
    equal(await text(ba, 'shrine-favour-telluria'), 'Telluria\'s Favour: 60%. Orders from Level 3 spend it when they start (5%, 10%, then 25% for the Great Rite).');
    equal((await orderState(ba, 'shrine_telluria__prepare_earthward_talisman')).button, 'Issue Order');
    equal(await orderState(ba, 'shrine_telluria__bless_bastion_foundations'), { button: 'Not available yet', off: true, why: 'Not available yet: no Bastion event damages a facility by natural causes yet (an attack\'s damage never counts). This order opens once one exists.' });
    const fit = await H.layoutCheck(ba, ['[data-test=issue-shrine_telluria__great_rite_telluria]']);
    assert(fit.scrollWidth <= fit.clientWidth, 'no sideways scroll');
  });

  await check('Prepare Rootguard Salve takes 5% of Telluria\'s Favour once (a double click gives one order); the Great Rite takes 25%', async () => {
    await ba.dblclick('[data-test=issue-shrine_telluria__prepare_rootguard_salve]');
    await ba.waitForTimeout(400);
    await ba.click('[data-test=issue-shrine_telluria__great_rite_telluria]');
    await ba.waitForTimeout(400);
    const s = await bas(ba);
    equal([s.favour.telluria, s.pendingOrders.map(o => [o.label, o.dueDay, o.favourCost])], [30, [['Shrine of Telluria: Prepare Rootguard Salve', 5, 5], ['Shrine of Telluria: Great Rite of Telluria', 8, 25]]]);
    assert(/25% of Telluria's Favour spent \(now 30%\)/.test(s.log.map(l => l.body).join(' | ')));
    equal(await text(ba, 'shrine-favour-telluria'), 'Telluria\'s Favour: 30%. Orders from Level 3 spend it when they start (5%, 10%, then 25% for the Great Rite).');
  });

  await check('not enough Favour: the order says so and gives nothing', async () => {
    await closeAll(ba);
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.favour.aurush = 4; }));
    await openTile(ba, 'shrine_aurush');
    equal(await orderState(ba, 'shrine_aurush__prepare_purification_incense'), { button: 'Can\'t order yet', off: true, why: 'Needs 5% of Aurush\'s Favour; the Ironbow has 4%.' });
    equal((await orderState(ba, 'shrine_aurush__great_rite_aurush')).why, 'Needs 25% of Aurush\'s Favour; the Ironbow has 4%.');
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.favour.aurush = 60; }));
  });

  await check('Bless Commercial Shipment and Bless Voyage at the Shrine of Pelagos', async () => {
    await openTile(ba, 'shrine_pelagos');
    await ba.click('[data-test=issue-shrine_pelagos__bless_commercial_shipment]');
    await ba.waitForTimeout(400);
    await ba.click('[data-test=issue-shrine_pelagos__bless_voyage]');
    await ba.waitForTimeout(400);
    equal((await bas(ba)).favour.pelagos, 50);
  });

  await check('7 camps later (Day 8): the salve and the blessing are in the Warehouse, Earth\'s Endurance waits at the Ironbow, and a Blessing of Pelagos waits for the Dock', async () => {
    await closeAll(ba);
    await passDays(ex, ba, 7);
    const s = await bas(ba);
    equal(s.warehouse.filter(w => w.goodId).map(w => [w.goodId, w.qty]).sort(), [['rootguard_salve', 2], ['voyage_blessing', 1]]);
    equal(s.greatRites.map(g => [g.rite, g.god, g.madeDay, g.status]), [['earths_endurance', 'telluria', 8, 'waiting']]);
    equal(s.tradeNetwork.protections, { pelagos_blessing: { charges: 1 } });
    await openTile(ba, 'shrine_telluria');
    assert(/Earth's Endurance: waiting at the Ironbow since Day 8/.test(await text(ba, 'shrine-telluria')), await text(ba, 'shrine-telluria'));
    await openTile(ba, 'shrine_pelagos');
    assert(/Blessings of Pelagos held for the Dock: 1\. The next ship sent with cargo takes one/.test(await text(ba, 'shrine-pelagos')), await text(ba, 'shrine-pelagos'));
  });

  await check('the Courier Exchange lists the Shrines\' items beside packs and charts', async () => {
    await closeAll(ba);
    await openTile(ba, 'courier_exchange');
    await ba.click('[data-test=send-parcel]');
    await ba.waitForTimeout(500);
    const t = await lastModal(ba);
    assert(/Rootguard Salvein the Warehouse: 2 doses/.test(t) && /Voyage Blessingin the Warehouse: 1 blessing/.test(t) && /Aquatic Protection Charmin the Warehouse: 0 charms/.test(t), t);
    await closeAll(ba);
  });

  await check('a reload changes nothing', async () => {
    const before = await bas(ba);
    await ba.reload();
    await ba.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    const after = await bas(ba);
    equal([after.favour, after.greatRites, after.tradeNetwork.protections, after.warehouse], [before.favour, before.greatRites, before.tradeNetwork.protections, before.warehouse]);
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'no page errors');
    equal(ctx.log.net, [], 'nothing online');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
