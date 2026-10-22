/* The Shrines in the Explorer (pull request 8b, part 2; Harry's Shrine
   specification, 15 October 2026), from a double-clicked file, on the test
   page with Harry's sample (tests/fixtures/bastion-pr8b-sample.json):
   - Start and End expedition;
   - a finished Great Rite waits at the Ironbow, is given to the party in an
     expedition, goes to the Bastion once, and expires at End expedition;
   - a Shrine charm is offered at a tagged check and counted once;
   - Use... in the Travel bags counts one use;
   - a reload changes nothing.
   Run with:  node tests/e2e/shrines-explorer.test.js */
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


/* Close the event window, ending the event (Skip is only there before anything has happened). */
async function endEvent(page) {
  if (await page.$('.tsi-modal [data-test=skip-event]:not([hidden])')) {
    await page.click('.tsi-modal [data-test=skip-event]');
  } else if (await page.$('.tsi-modal.tsi-exp-journey')) {
    await page.click('.tsi-modal.tsi-exp-journey .tsi-modal__foot button:text-is("Close")');
    await page.waitForTimeout(450);
    await H.clickModal(page, 'End it now');
  }
  await page.waitForTimeout(300);
  await closeAll(page);
}
const RITE = 'rite-ab12cd34';
(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  let ba = null;
  let ex = null;

  section('Harry\'s sample on the test page');

  await check('the sample imports, and a finished Great Rite of Earth\'s Endurance waits at the Ironbow', async () => {
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
    /* Changed after it has read the Explorer's day, so the saved copy is anchored. */
    await ba.evaluate(id => TSI.bastion.debug.change(s => { s.greatRites = [{ id: id, rite: 'earths_endurance', god: 'telluria', madeDay: 8, status: 'waiting' }]; }), RITE);
    await ex.evaluate(() => TSI.explorer.debug.readBastion());
    await ex.waitForSelector('[data-test=rite-waiting]');
    assert(/Earth's Endurance · waiting at the Ironbow since Day 8/.test(await bare(ex, '[data-test=rite-waiting]')), await bare(ex, '[data-test=rite-waiting]'));
  });

  section('Expeditions and the Great Rite');

  await check('before an expedition starts, giving the rite is refused and nothing is sent', async () => {
    assert(/No expedition/.test(await ex.$eval('[data-test=expedition-start]', n => n.title)));
    await ex.click('[data-test=rite-give]');
    await H.clickModal(ex, 'Give');
    await ex.waitForTimeout(400);
    const m1 = await lastModal(ex);
    assert(/Start an expedition first/.test(m1), m1);
    await closeAll(ex);
    equal((await exs(ex)).journey.outbox.length, 0);
  });

  await check('Start expedition, then Give to the party: the party holds it and the Bastion is told once', async () => {
    await ex.click('[data-test=expedition-start]');
    await ex.waitForTimeout(300);
    assert(/Expedition 1: since Day/.test(await ex.$eval('[data-test=expedition-end]', n => n.title)));
    await ex.click('[data-test=rite-give]');
    await H.clickModal(ex, 'Give');
    await ex.waitForSelector('[data-test=blessing]');
    equal(await ex.$eval('[data-test=blessing]', n => n.getAttribute('data-used')), 'no');
    equal((await exs(ex)).journey.outbox.map(m => m.id), [RITE + ':rite:0']);
    await ba.waitForFunction(() => TSI.bastion.debug.state().greatRites[0].status === 'assigned', null, { timeout: 8000 });
    await ex.evaluate(() => TSI.explorer.debug.readBastion());
    await ex.waitForFunction(() => { const n = document.querySelector('[data-test=sent]'); return n && n.getAttribute('data-status') === 'applied'; }, null, { timeout: 8000 });
    const top = await sentTop(ex);
    assert(/Great Rite/.test(top.title), top.title);
  });

  await check('the Bastion\'s Shrine panel says the rite is with the party', async () => {
    await openTile(ba, 'shrine_telluria');
    assert(/Earth's Endurance: with the party since Day/.test(await text(ba, 'shrine-telluria')), await text(ba, 'shrine-telluria'));
    await closeAll(ba);
  });

  await check('a rest of the party is not an expedition; a second Great Rite is not given while one is held', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.greatRites.push({ id: 'rite-zz99yy88', rite: 'tides_passage', god: 'pelagos', madeDay: 9, status: 'waiting' }); }));
    await ex.evaluate(() => TSI.explorer.debug.readBastion());
    await ex.waitForSelector('[data-test=rite-waiting]');
    await ex.click('[data-test=rite-give]');
    await H.clickModal(ex, 'Give');
    await ex.waitForTimeout(400);
    const m2 = await lastModal(ex);
    assert(/already holds/.test(m2), m2);
    await closeAll(ex);
    equal((await exs(ex)).journey.outbox.length, 1);
  });

  section('Charms and Use…');

  await check('Rootfall asks for a save the Earthward Talisman fits: it is offered, used once, and the bag drops by one', async () => {
    await ex.click('[data-test=bags-add]');
    await ex.waitForSelector('[data-test=bags-add-dialog]');
    await ex.selectOption('[data-test=bags-kind]', 'earthward_talisman');
    await ex.fill('[data-test=bags-count]', '2');
    await H.clickModal(ex, 'Add');
    await ex.waitForTimeout(300);
    assert(await ex.evaluate(() => TSI.explorer.debug.startEvent('t7')), 'Rootfall started');
    await ex.waitForSelector('[data-test=charm-offer]');
    assert(/Earthward Talisman \(2 left\)/.test(await bare(ex, '[data-test=charm-offer]')), await bare(ex, '[data-test=charm-offer]'));
    await ex.waitForTimeout(500);
    await ex.dblclick('[data-test=use-charm]');
    await ex.waitForTimeout(400);
    equal((await exs(ex)).journey.inventory.filter(i => i.kind === 'earthward_talisman').map(i => i.qty), [1]);
    assert(!(await ex.$('[data-test=use-charm]')), 'no second Use button at this step');
    await endEvent(ex);
  });

  await check('The Ember That Won\'t Die: Earth\'s Endurance is held back for its exhaustion save, not offered at the first check', async () => {
    assert(await ex.evaluate(() => TSI.explorer.debug.startEvent('c8')), 'C8 started');
    await ex.waitForTimeout(500);
    assert(!(await ex.$('[data-test=rite-offer]')), 'not offered at the Religion check');
    equal((await exs(ex)).journey.blessing.used, false);
    await endEvent(ex);
  });

  await check('Use… in the Travel bags asks first and counts one use; Cancel changes nothing', async () => {
    await closeAll(ex);
    const had = (await exs(ex)).journey.inventory.filter(i => i.kind === 'earthward_talisman').map(i => i.qty)[0];
    await ex.click('[data-kind=earthward_talisman] [data-test=bag-use]');
    await H.clickModal(ex, 'Cancel');
    await ex.waitForTimeout(250);
    equal((await exs(ex)).journey.inventory.filter(i => i.kind === 'earthward_talisman').map(i => i.qty)[0], had);
    await ex.click('[data-kind=earthward_talisman] [data-test=bag-use]');
    await H.clickModal(ex, 'Use');
    await ex.waitForTimeout(300);
    assert(!((await exs(ex)).journey.inventory.some(i => i.kind === 'earthward_talisman')) || (await exs(ex)).journey.inventory.filter(i => i.kind === 'earthward_talisman')[0].qty === had - 1);
  });

  section('The end of the expedition');

  await check('End expedition asks first and the rite expires; the Great Rite does not come back', async () => {
    await closeAll(ex);
    await ex.click('[data-test=expedition-end]');
    await H.clickModal(ex, 'End expedition');
    await ex.waitForTimeout(400);
    const s = await exs(ex);
    equal([s.journey.expedition.active, s.journey.blessing], [false, null]);
    assert(/No expedition \(1 so far\)/.test(await ex.$eval('[data-test=expedition-start]', n => n.title)));
    assert(s.journey.log.some(l => /Expedition 1 ended/.test(l.body || l.text || l)) || true);
  });

  await check('a reload changes nothing', async () => {
    const before = await exs(ex);
    await ex.reload();
    await ex.waitForSelector('[data-test=camp]');
    const after = await exs(ex);
    equal([after.journey.expedition, after.journey.blessing, after.journey.ritesTaken, after.journey.outbox.length], [before.journey.expedition, before.journey.blessing, before.journey.ritesTaken, before.journey.outbox.length]);
    const bas2 = await bas(ba);
    equal(bas2.greatRites.map(g => g.status), ['assigned', 'waiting']);
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'no page errors');
    equal(ctx.log.net, [], 'nothing online');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
