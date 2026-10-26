/* The Prison Tower (Harry, 26 October 2026), clicked through from a double-clicked index.html with the internet off, with the
   Explorer and the Bastion open side by side, at the laptop (1707 x 930, pixel ratio 1.5) and the TV (1920 x 1080, ratio 1):
   - it is built from a construction slot at party level 9 (21 days), one level only, with its map art and a tile picture;
   - the panel shows three cells; a cell is locked up by hand with a name, a thread or quest (both required), a sentence of
     7, 14, 21 or 28 days (required) and release conditions (optional); the panel shows the day the prisoner is released;
   - Interrogate and Release appear once a cell is in use; Release needs a reason; Interrogate asks whether the check was
     passed: a fail says "(name) holds their tongue." and closes, a pass says "(name) starts talking." and takes the notes,
     which are kept on the prisoner and added to by interrogating again;
   - the sentence ends when days pass in the Explorer: the Explorer tells the players ("The Ironbow sends word…"), the
     Bastion releases the prisoner once, and several days at once, a reload and Reset Travel never release or tell twice;
   - the panel fits both screens with no sideways scroll.
   Run with:  node tests/e2e/prison.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const ID = 'prison_tower';

const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exDay = page => page.evaluate(() => TSI.explorer.debug.state().travel.day);

async function context(browser, size) {
  const ctx = await H.newContext(browser, size, { acceptDownloads: true, backedUp: true });
  await ctx.setOffline(true);
  /* No travel or campfire events and no weather. */
  await ctx.addInitScript(() => { Math.random = () => 0.99; });
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
  await p.goto(INDEX + '?tool=bastion');
  await p.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  return p;
}
async function closeAll(page) {
  for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}
/* Make Camp in the Explorer; resolves with the words of "The Ironbow sends word…" if it showed one. */
async function camp(ex) {
  await ex.waitForTimeout(400);
  await ex.click('[data-test=camp]');
  let word = '';
  for (let n = 0; n < 20; n++) {
    await ex.waitForTimeout(200);
    if (!(await ex.$('.tsi-modal'))) { if (n > 2) break; continue; }
    if (await ex.$('[data-test=ironbow-word]')) word += ' ' + (await bare(ex, '[data-test=ironbow-word]'));
    await ex.click('.tsi-modal__foot button:last-child');
  }
  return word;
}
/* The Bastion reaches a day by itself; "The Ironbow sends word…" is read and closed on the way. */
async function bastionReaches(ba, day) {
  let word = '';
  for (let n = 0; n < 200; n++) {
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
async function openPrison(ba) {
  await closeAll(ba);
  await ba.waitForTimeout(300);
  await ba.click('[data-test=tile-' + ID + ']');
  await ba.waitForSelector('[data-test=panel-fac-' + ID + '] [data-test=prison]');
  await ba.waitForTimeout(300);
}
/* The Tower built at party level 9, as the Beast Pen's test sets up its Pen. */
async function setUp(ba) {
  await ba.selectOption('[data-test=level]', '9');
  await ba.waitForTimeout(300);
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    s.builtExtras = [{ facId: 'prison_tower', status: 'built' }];
    s.facilityLevels.prison_tower = 1;
    s.prison = { cells: [null, null, null], freed: [] };
  }));
  await ba.evaluate(() => TSI.store.flush());
}
const cell = async (ba, i) => ba.evaluate(n => {
  const c = document.querySelector('[data-test=prison-cell-' + n + ']');
  const t = k => { const x = c.querySelector('[data-test="' + k + '-' + n + '"]'); return x ? x.textContent.replace(/\s+/g, ' ').trim() : null; };
  const b = k => { const x = c.querySelector('[data-test="' + k + '-' + n + '"]'); return x ? !x.disabled : null; };
  return { state: c.getAttribute('data-state'), who: t('prisoner-name'), thread: t('prisoner-thread'), sentence: t('prisoner-sentence'), release: t('prisoner-release'), conditions: t('prisoner-conditions'), notes: t('prisoner-notes'),
    lockup: b('lockup'), interrogate: b('interrogate'), releaseBtn: b('release-prisoner') };
}, i);
const popup = page => page.$('.tsi-modal:not(.tsi-bas-panel)');
/* Lock a prisoner up through the dialog. */
async function lockUp(ba, i, f) {
  await ba.waitForTimeout(420);
  await ba.click('[data-test=lockup-' + i + ']');
  await ba.waitForSelector('[data-test=lockup-dialog]');
  if (f.name !== undefined) await ba.fill('[data-test=lockup-name]', f.name);
  if (f.thread !== undefined) await ba.fill('[data-test=lockup-thread]', f.thread);
  if (f.days !== undefined) await ba.selectOption('[data-test=lockup-days]', String(f.days));
  if (f.conditions !== undefined) await ba.fill('[data-test=lockup-conditions]', f.conditions);
  const btn = await ba.$('[data-test=lockup-dialog] .tsi-modal__foot .tsi-btn--primary');
  const off = await btn.isDisabled();
  const problem = await ba.$eval('[data-test=lockup-problem]', n => n.hidden ? '' : n.textContent);
  if (!off) { await btn.click(); await ba.waitForTimeout(400); }
  return { off, problem };
}
const noticeLines = page => H.noticeTexts(page);

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  const ex = await openExplorer(ctx);
  const ba = await openBastion(ctx);

  section('Building the Prison Tower');

  await check('below party level 9 it is locked; at 9 it is chosen from a construction slot: "Prison Tower", 21 days, with its picture cut from the map', async () => {
    await ba.selectOption('[data-test=level]', '8');
    await ba.waitForTimeout(300);
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.builtExtras = []; s.treasuryGP = 500; }));
    await ba.click('button.tsi-bas-tile--slot');
    await ba.waitForSelector('[data-test=build-' + ID + ']');
    equal(await ba.getAttribute('[data-test=build-' + ID + ']', 'aria-disabled'), 'true', 'locked at level 8');
    assert(/Prison Tower/.test(await bare(ba, '[data-test=build-' + ID + ']')));
    await closeAll(ba);
    await ba.selectOption('[data-test=level]', '9');
    await ba.waitForTimeout(300);
    await ba.click('button.tsi-bas-tile--slot');
    await ba.waitForSelector('[data-test=build-' + ID + ']');
    equal(await ba.getAttribute('[data-test=build-' + ID + ']', 'aria-disabled'), null, 'open at level 9');
    await ba.click('[data-test=build-' + ID + ']');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Construct")');
    const q = await ba.$eval('.tsi-modal:not(.tsi-bas-panel)', m => m.textContent.replace(/\s+/g, ' ').trim());
    assert(/Prison Tower/.test(q) && /21 days/.test(q), q);
    await H.clickModal(ba, 'Construct');
    await ba.waitForTimeout(400);
    const s = await bas(ba);
    equal(s.builtExtras.filter(e => e && e.facId === ID).map(e => e.readyDay - e.startDay), [21]);
  });

  await check('once built: no Upgrade row, a picture from the map, no painting banner, and the map labels it', async () => {
    await setUp(ba);
    await openPrison(ba);
    equal(await ba.$('[data-test=upgrade-row-' + ID + ']'), null, 'one level only');
    equal(await ba.$('[data-test=fac-banner]'), null, 'no painting banner');
    equal(await bare(ba, '[data-test=fac-level]'), 'One level only');
    equal(await ba.$$('[data-test=prison-cell-0], [data-test=prison-cell-1], [data-test=prison-cell-2]').then(l => l.length), 3);
    assert(await ba.$('[data-test=panel-fac-' + ID + '] .tsi-bas-facpanel__img, [data-test=panel-fac-' + ID + '] canvas, [data-test=panel-fac-' + ID + '] img'), 'a picture of the tower');
    await closeAll(ba);
    assert(await ba.$('[data-test=tile-' + ID + '] img, [data-test=tile-' + ID + '] canvas, [data-test=tile-' + ID + ']'), 'a tile');
  });

  section('Locking up');

  await check('three empty cells, each with Lock up a prisoner…; no Interrogate or Release yet', async () => {
    await openPrison(ba);
    for (let i = 0; i < 3; i++) {
      const c = await cell(ba, i);
      equal([c.state, c.lockup, c.interrogate, c.releaseBtn], ['empty', true, null, null], 'cell ' + i);
    }
  });

  await check('name and thread are required, and so is a sentence; the dialog says what is missing and keeps its button off', async () => {
    await ba.click('[data-test=lockup-0]');
    await ba.waitForSelector('[data-test=lockup-dialog]');
    const btn = '[data-test=lockup-dialog] .tsi-modal__foot .tsi-btn--primary';
    equal(await ba.isDisabled(btn), true);
    equal(await bare(ba, '[data-test=lockup-problem]'), 'Type the prisoner\'s name.');
    await ba.fill('[data-test=lockup-name]', 'Garrick Vane');
    equal(await bare(ba, '[data-test=lockup-problem]'), 'Type the thread or quest the prisoner is tied to.');
    await ba.fill('[data-test=lockup-thread]', 'The Smugglers of Bolt Isle');
    assert(/Choose a sentence/.test(await bare(ba, '[data-test=lockup-problem]')));
    equal(await ba.$$eval('[data-test=lockup-days] option', os => os.map(o => o.textContent)), ['Choose…', '7 days', '14 days', '21 days', '28 days']);
    await ba.selectOption('[data-test=lockup-days]', '7');
    equal(await ba.isDisabled(btn), false);
    await ba.keyboard.press('Escape');
    await ba.waitForTimeout(300);
    equal((await cell(ba, 0)).state, 'empty', 'cancelled: nothing locked up');
  });

  await check('locking up on Day 1 for 7 days: the cell shows the prisoner, "Released Day 8", and Interrogate and Release appear', async () => {
    const day = await exDay(ex);
    const r = await lockUp(ba, 0, { name: 'Garrick Vane', thread: 'The Smugglers of Bolt Isle', days: 7, conditions: 'Bring the ledger' });
    equal(r.off, false);
    const c = await cell(ba, 0);
    equal([c.state, c.who, c.thread, c.interrogate, c.releaseBtn], ['held', 'Garrick Vane', 'The Smugglers of Bolt Isle', true, true]);
    equal(c.sentence, '7 days, from Day ' + day);
    assert(new RegExp('^Day ' + (day + 7) + ' \\(7 days left\\)').test(c.release), c.release);
    equal(c.conditions, 'Bring the ledger');
    equal((await cell(ba, 1)).state, 'empty');
    const s = await bas(ba);
    equal([s.prison.cells[0].lockedDay, s.prison.cells[0].endDay], [day, day + 7]);
  });

  await check('the other two cells take a 14-day and a 28-day prisoner; the conditions are optional', async () => {
    equal((await lockUp(ba, 1, { name: 'Sister Anwen', thread: 'The missing keystone', days: 14 })).off, false);
    equal((await lockUp(ba, 2, { name: 'Old Tam', thread: 'The Grey Tide', days: 28 })).off, false);
    const s = await bas(ba);
    const day = s.day;
    equal(s.prison.cells.map(c => c.endDay - c.lockedDay), [7, 14, 28]);
    equal((await cell(ba, 1)).conditions, null);
    equal(await ba.$$eval('[data-test^=lockup-]', n => n.length), 0, 'no free cell: no Lock up buttons');
    assert(day >= 1);
  });

  section('Interrogating and releasing');

  await check('Interrogate, check failed: the notice says "Garrick Vane holds their tongue." and the window closes; nothing is saved', async () => {
    await ba.click('[data-test=interrogate-0]');
    await ba.waitForSelector('[data-test=interrogate-dialog]');
    equal(await ba.$eval('[data-test=interrogate-dialog] .tsi-modal__foot .tsi-btn--primary', n => n.hidden), true, 'no save button before a pass');
    equal(await ba.$eval('[data-test=interrogate-dialog] [data-test=interrogate-text]', n => n.closest('label').hidden), true, 'no text box before a pass');
    await ba.click('[data-test=interrogate-fail]');
    await ba.waitForTimeout(500);
    equal(await ba.$('[data-test=interrogate-dialog]'), null, 'closed');
    assert((await noticeLines(ba)).some(t => /Garrick Vane holds their tongue\./.test(t)), JSON.stringify(await noticeLines(ba)));
    equal((await bas(ba)).prison.cells[0].notes, []);
  });

  await check('Interrogate, check passed: "Garrick Vane starts talking." and a box takes what was found, kept on the prisoner and shown in the cell', async () => {
    await H.dismissNotices(ba);
    await ba.click('[data-test=interrogate-0]');
    await ba.waitForSelector('[data-test=interrogate-dialog]');
    await ba.click('[data-test=interrogate-pass]');
    await ba.waitForSelector('[data-test=interrogate-text]');
    assert((await noticeLines(ba)).some(t => /Garrick Vane starts talking\./.test(t)), JSON.stringify(await noticeLines(ba)));
    const save = '[data-test=interrogate-dialog] .tsi-modal__foot .tsi-btn--primary';
    equal(await ba.isDisabled(save), true, 'nothing written yet');
    await ba.fill('[data-test=interrogate-text]', 'The ledger is hidden under the lighthouse.');
    equal(await ba.isDisabled(save), false);
    await ba.click(save);
    await ba.waitForTimeout(500);
    const c = await cell(ba, 0);
    assert(/The ledger is hidden under the lighthouse\./.test(c.notes), c.notes);
  });

  await check('interrogating again adds more; the notes stay in the order they were written', async () => {
    await ba.click('[data-test=interrogate-0]');
    await ba.waitForSelector('[data-test=interrogate-dialog]');
    await ba.click('[data-test=interrogate-pass]');
    await ba.fill('[data-test=interrogate-text]', 'He is afraid of the Harbourmaster.');
    await ba.click('[data-test=interrogate-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    equal(s.prison.cells[0].notes.map(n => n.text), ['The ledger is hidden under the lighthouse.', 'He is afraid of the Harbourmaster.']);
    assert(/lighthouse[\s\S]*Harbourmaster/.test((await cell(ba, 0)).notes));
  });

  await check('Release needs a reason: the button stays off until one is typed; then the cell is free and a notice says why', async () => {
    await H.dismissNotices(ba);
    await ba.click('[data-test=release-prisoner-1]');
    await ba.waitForSelector('[data-test=release-dialog]');
    const btn = '[data-test=release-dialog] .tsi-modal__foot .tsi-btn--primary';
    equal(await ba.isDisabled(btn), true);
    equal(await bare(ba, '[data-test=release-problem]'), 'Say why the party released them.');
    await ba.fill('[data-test=release-reason]', 'They gave us the name we needed.');
    equal(await ba.isDisabled(btn), false);
    await ba.click(btn);
    await ba.waitForTimeout(500);
    equal((await cell(ba, 1)).state, 'empty');
    assert((await noticeLines(ba)).some(t => /Sister Anwen is released early: They gave us the name we needed\./.test(t)), JSON.stringify(await noticeLines(ba)));
    const s = await bas(ba);
    equal([s.prison.freed.length, s.prison.freed[0].early, s.prison.freed[0].reason], [1, true, 'They gave us the name we needed.']);
  });

  section('A sentence ending, and the Explorer being told');

  await check('days pass in the Explorer: the day before, nothing; on the day, the Explorer says so and the Bastion frees the prisoner once', async () => {
    await closeAll(ba); await closeAll(ex);
    const start = await exDay(ex);
    const s0 = await bas(ba);
    const end = s0.prison.cells[0].endDay;
    let words = '';
    for (let d = start; d < end - 1; d++) words += await camp(ex);
    await bastionReaches(ba, await exDay(ex));
    assert(!/released from the Prison Tower/.test(words), 'not told early: ' + words);
    equal((await bas(ba)).prison.cells[0].name, 'Garrick Vane', 'still held the day before');
    const w = await camp(ex);
    equal(await exDay(ex), end);
    assert(/Garrick Vane is released from the Prison Tower/.test(w), 'the Explorer told the players: ' + w);
    const bw = await bastionReaches(ba, end);
    const s = await bas(ba);
    equal(s.prison.cells[0], null, 'freed');
    equal(s.prison.cells[2].name, 'Old Tam', 'the 28-day prisoner is still held');
    assert((bw.match(/Garrick Vane is released/g) || []).length <= 1, 'the Bastion says it once: ' + bw);
    equal(s.prison.freed.filter(f => f.name === 'Garrick Vane').length, 1);
  });

  await check('a reload, and a further camp, never release or tell again', async () => {
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    const day = await exDay(ex);
    await bastionReaches(ba, day);
    const w = await camp(ex);
    assert(!/Garrick Vane/.test(w), w);
    await bastionReaches(ba, await exDay(ex));
    const s = await bas(ba);
    equal(s.prison.freed.filter(f => f.name === 'Garrick Vane').length, 1);
  });

  await check('with the Bastion closed the Explorer makes camp for several days; opened again it catches up: the 28-day prisoner is freed once, on the right day', async () => {
    const target = (await bas(ba)).prison.cells[2].endDay;
    await closeAll(ba);
    await ba.evaluate(() => TSI.store.flush());
    await ba.close();
    let said = '';
    for (let d = await exDay(ex); d < target + 2; d++) said += await camp(ex);
    assert((said.match(/Old Tam is released/g) || []).length === 1, 'the Explorer told once: ' + said);
    const nb2 = await openBastion(ctx);
    await bastionReaches(nb2, await exDay(ex));
    const s = await bas(nb2);
    equal(s.prison.cells[2], null);
    equal(s.prison.freed.filter(f => f.name === 'Old Tam').length, 1);
    await nb2.close();
  });

  await check('Reset Travel moves a prisoner\'s days with the Bastion: nothing freed, nothing told, the same days left', async () => {
    const ba2 = await openBastion(ctx);
    await setUp(ba2);
    await ba2.evaluate(() => TSI.bastion.debug.change(s => {
      const d = s.day;
      s.prison.cells[0] = { name: 'Corin', thread: 'A thread', days: 14, conditions: '', lockedDay: d, endDay: d + 14, notes: [{ day: d, text: 'A note.' }] };
    }));
    await ba2.evaluate(() => TSI.store.flush());
    const before = await bas(ba2);
    const left = before.prison.cells[0].endDay - before.day;
    await closeAll(ex);
    await ex.waitForTimeout(400);
    await ex.click('[data-test=reset-travel]');
    await H.clickModal(ex, 'OK');
    await ex.waitForTimeout(300);
    equal(await exDay(ex), 1);
    await bastionReaches(ba2, 1);
    const s = await bas(ba2);
    equal([s.prison.cells[0].name, s.prison.cells[0].endDay - s.day, s.prison.cells[0].notes[0].day], ['Corin', left, 1]);
    equal(s.prison.freed.filter(f => f.name === 'Corin').length, 0);
    await ba2.close();
  });

  section('The two screens');

  async function fits(page, label) {
    await openPrison(page);
    const lay = await H.layoutCheck(page, ['[data-test=lockup-0]', '[data-test=interrogate-1]', '[data-test=release-prisoner-1]', '[data-test=panel-fac-' + ID + '] .tsi-modal__foot button']);
    assert(lay.scrollWidth <= lay.clientWidth, label + ': no sideways scroll');
    equal(lay.outOfView, [], label);
    const ys = await page.$$eval('[data-test^=prison-cell-][data-state]', ns => ns.map(n => Math.round(n.getBoundingClientRect().y)));
    assert(ys.length === 3 && ys[0] === ys[1] && ys[1] === ys[2], label + ': the three cells are side by side: ' + ys);
  }
  await check('laptop (1707 x 930, ratio 1.5): three cells side by side, every button in view, no sideways scroll, and the dialogs fit', async () => {
    const pg = await openBastion(ctx);
    await setUp(pg);
    await pg.evaluate(() => TSI.bastion.debug.change(s => {
      s.prison.cells[1] = { name: 'Sister Anwen the Long-Named of the Hollow Reaches', thread: 'The missing keystone of the old covenant at Middlemount', days: 14, conditions: 'Hands over the seal to the Harbourmaster in front of witnesses', lockedDay: s.day, endDay: s.day + 14, notes: [{ day: s.day, text: 'She said the keystone was taken by sea and the boat was seen off the Black Straits, flying no flag at all.' }] };
      s.prison.cells[2] = null;
    }));
    await fits(pg, 'laptop');
    await H.shot(pg, 'prison-laptop');
    await closeAll(pg);
    await openPrison(pg);
    await pg.click('[data-test=lockup-0]');
    await pg.waitForSelector('[data-test=lockup-dialog]');
    let l = await H.layoutCheck(pg, ['[data-test=lockup-dialog] .tsi-modal__foot button']);
    equal([l.scrollWidth > l.clientWidth, l.outOfView], [false, []], 'lock-up dialog');
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(300);
    await pg.click('[data-test=interrogate-1]');
    await pg.waitForSelector('[data-test=interrogate-dialog]');
    await pg.click('[data-test=interrogate-pass]');
    l = await H.layoutCheck(pg, ['[data-test=interrogate-dialog] .tsi-modal__foot button', '[data-test=interrogate-text]']);
    equal([l.scrollWidth > l.clientWidth, l.outOfView], [false, []], 'interrogate dialog');
    await pg.close();
  });

  const tv = await context(browser, 'tv');
  await check('TV (1920 x 1080, ratio 1): the same, and it still fits when the window is moved to the laptop size and back', async () => {
    const tex = await openExplorer(tv);
    const tba = await openBastion(tv);
    await setUp(tba);
    await tba.evaluate(() => TSI.bastion.debug.change(s => {
      s.prison.cells[0] = { name: 'Garrick Vane', thread: 'The Smugglers of Bolt Isle', days: 7, conditions: '', lockedDay: s.day, endDay: s.day + 7, notes: [] };
      s.prison.cells[1] = { name: 'Sister Anwen', thread: 'The missing keystone', days: 14, conditions: 'Hands over the seal', lockedDay: s.day, endDay: s.day + 14, notes: [] };
    }));
    await fits(tba, 'tv');
    await H.shot(tba, 'prison-tv');
    for (const size of ['laptop', 'smallWindow', 'tv']) {
      await tba.setViewportSize(H.SIZES[size].viewport);
      await tba.waitForTimeout(300);
      const l = await H.layoutCheck(tba, ['[data-test=lockup-2]', '[data-test=interrogate-0]']);
      assert(l.scrollWidth <= l.clientWidth, size + ': no sideways scroll');
      equal(l.outOfView, [], size);
    }
    await tex.close();
    equal(tv.log.errors, []);
    equal(tv.log.failed, []);
  });

  await check('nothing went wrong or reached for the internet, and no picture or file was missing', async () => {
    equal(ctx.log.errors, [], 'no page errors');
    equal(ctx.log.net, [], 'nothing online');
    equal(ctx.log.failed, [], 'nothing missing');
    equal(tv.log.net, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
