/* The Beast Pen after the independent review (Harry, 22 October 2026), clicked through from a double-clicked index.html with
   the internet off:
   - every press in the Pen's panel (Take out, Return, Rename, Assign handler, Confirm bond, Add a note…) keeps the panel
     where it was scrolled, keeps the keyboard focus on the same button (or the one that takes its place), and keeps an open
     Chronicle open;
   - Take out, Return and Acclimatise read the Explorer's day fresh: a click a moment after Make Camp is refused, not counted;
   - Clear extra builds will not take the Pen away while beasts live in it;
   - a beast of a kind this copy does not know has a stall of its own ("Other beasts");
   - the Acclimatise row shows the DC of the kind selected, and its note is made from the data;
   - the bond bars do not look like buttons, and a long unbroken word or link cannot push the panel sideways
     (1707 x 930, pixel ratio 1.5).
   Run with:  node tests/e2e/beast-pen-review.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const ACC = 'beast_pen__acclimatise';
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exDay = page => page.evaluate(() => TSI.explorer.debug.state().travel.day);
const beast = (s, id) => s.creatures.filter(c => c.id === id)[0];
const LONG_WORD = 'Supercalifragilisticexpialidocious';
const LINK = 'https://www.example.com/the-scarlett-isles/a-very-long-address-with-no-spaces-in-it-at-all/' + 'x'.repeat(30) + '.html';
const FORTY = 'Abcdefghijklmnopqrstuvwxyzabcdefghijklmn';

async function openExplorer(ctx) {
  const p = await ctx.newPage();
  await p.goto(INDEX + '?tool=explorer');
  await p.waitForSelector('[data-test=camp]');
  return p;
}
async function openBastion(ctx) {
  const p = await ctx.newPage();
  await p.goto(INDEX + '?tool=bastion');
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
async function openPen(ba) {
  await closeAll(ba);
  await ba.waitForTimeout(300);
  await ba.click('[data-test=tile-beast_pen]');
  await ba.waitForSelector('[data-test=panel-fac-beast_pen]');
  await ba.waitForTimeout(300);
}
/* Five kinds housed (Swiftwing the griffin is the one the tests work on: Bond 1, handler Mira), a handler for each. */
const SETUP = () => TSI.bastion.debug.change(s => {
  const R = TSI.bastion.rules;
  s.partyLevel = 9;
  s.treasuryGP = 100;
  s.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
  s.facilityLevels.beast_pen = 1;
  const kinds = ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat'];
  const names = ['Stormwing', 'Swiftwing', 'Greyfang', 'Bramble', 'Lichen'];
  s.creatures = kinds.map((k, i) => {
    const c = { id: 'cr-' + i, species: k, owner: '', name: names[i], status: 'housed', home: 'beast_pen', grantedDay: 1, housedDay: 1, msgId: '' };
    c.development = R.newDevelopment(c, s.day);
    c.development.handlerId = 'Mira';
    c.development.bond.level = i === 4 ? 0 : 1;
    return c;
  });
});
/* The element that scrolls the panel, and how far it is scrolled. */
const panelScroll = page => page.evaluate(() => {
  let n = document.querySelector('[data-test=creatures-beast_pen]');
  while (n && !(n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))) n = n.parentElement;
  return n ? { top: Math.round(n.scrollTop), max: n.scrollHeight - n.clientHeight } : null;
});
const setPanelScroll = (page, top) => page.evaluate(t => {
  let n = document.querySelector('[data-test=creatures-beast_pen]');
  while (n && !(n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))) n = n.parentElement;
  n.scrollTop = t;
  return Math.round(n.scrollTop);
}, top);
const focused = page => page.evaluate(() => { const a = document.activeElement; return a && a.getAttribute ? a.getAttribute('data-test') : null; });
const SWIFT = 'cr-1';
/* The notice a refusal opens (an alert dialog, not the panel under it): its words. */
async function notice(page) {
  await page.waitForSelector('[role=alertdialog]', { timeout: 5000 });
  return page.$eval('[role=alertdialog]', n => n.textContent.replace(/\s+/g, ' ').trim());
}

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await H.newContext(browser, 'laptop', { acceptDownloads: true, backedUp: true });
  await ctx.setOffline(true);
  await ctx.addInitScript(() => { Math.random = () => 0.99; });
  const ex = await openExplorer(ctx);
  await ex.waitForTimeout(500);
  let ba = await openBastion(ctx);
  await ba.evaluate(SETUP);
  await ba.evaluate(() => TSI.store.flush());

  /* ------------------------------------------------------------------ */
  section('The panel keeps its place, its focus and its open Chronicle');

  await check('Take Swiftwing on the road: the panel stays scrolled where it was, the focus moves to the button that replaces it ("Return Swiftwing…"), and Return puts it back on "Take…"', async () => {
    await openPen(ba);
    const sc0 = await panelScroll(ba);
    assert(sc0 && sc0.max > 300, 'the panel is long enough to scroll at 1707 x 930: ' + JSON.stringify(sc0));
    await ba.evaluate(id => document.querySelector('[data-test="creature-takeout-' + id + '"]').scrollIntoView({ block: 'center' }), SWIFT);
    const before = await panelScroll(ba);
    assert(before.top > 200, 'scrolled well down: ' + before.top);
    await ba.focus('[data-test="creature-takeout-' + SWIFT + '"]');
    await ba.click('[data-test="creature-takeout-' + SWIFT + '"]');
    await ba.waitForSelector('[data-test="creature-return-' + SWIFT + '"]');
    const after = await panelScroll(ba);
    assert(Math.abs(after.top - before.top) <= 2, 'not thrown back to the top: ' + before.top + ' -> ' + after.top);
    equal(await focused(ba), 'creature-return-' + SWIFT, 'the focus is on the button that replaces the one pressed');
    await ba.waitForTimeout(450);
    await ba.click('[data-test="creature-return-' + SWIFT + '"]');
    await ba.waitForSelector('[data-test="creature-takeout-' + SWIFT + '"]');
    const again = await panelScroll(ba);
    assert(Math.abs(again.top - before.top) <= 2, 'and after Return: ' + again.top);
    equal(await focused(ba), 'creature-takeout-' + SWIFT);
  });

  await check('Rename…, Assign handler… and Add a note… (each opens a pop-up) leave the panel where it was and the focus on the same button; an open Chronicle stays open', async () => {
    await openPen(ba);
    await ba.evaluate(id => {
      document.querySelector('[data-test="creature-chronicle-' + id + '"]').open = true;
      document.querySelector('[data-test="creature-rename-' + id + '"]').scrollIntoView({ block: 'center' });
    }, SWIFT);
    const same = (a, b, what) => assert(Math.abs(a.top - b.top) <= 2, what + ': ' + a.top + ' -> ' + b.top);
    /* Rename */
    await ba.click('[data-test="creature-rename-' + SWIFT + '"]');
    await ba.waitForSelector('[data-test=creature-rename-dialog]');
    let pre = await panelScroll(ba);
    assert(pre.top > 100, 'scrolled: ' + pre.top);
    await ba.fill('[data-test=creature-name]', 'Stormcrest');
    await H.clickModal(ba, 'Rename');
    await ba.waitForSelector('[data-test="creature-' + SWIFT + '"] .tsi-bas-creature__name:has-text("Stormcrest")');
    same(pre, await panelScroll(ba), 'after Rename');
    equal(await focused(ba), 'creature-rename-' + SWIFT);
    equal(await ba.$eval('[data-test="creature-chronicle-' + SWIFT + '"]', n => n.open), true, 'the Chronicle is still open');
    /* Add a note (the button is inside the Chronicle) */
    await ba.waitForTimeout(450);
    await ba.click('[data-test="creature-note-' + SWIFT + '"]');
    await ba.waitForSelector('[data-test=note-dialog]');
    pre = await panelScroll(ba);
    await ba.fill('[data-test=note-text]', 'A quiet evening on the Marrowmere.');
    await H.clickModal(ba, 'Add to the Chronicle');
    await ba.waitForSelector('[data-test="creature-chronicle-' + SWIFT + '"] li:has-text("A quiet evening")');
    same(pre, await panelScroll(ba), 'after the note');
    equal(await focused(ba), 'creature-note-' + SWIFT);
    equal(await ba.$eval('[data-test="creature-chronicle-' + SWIFT + '"]', n => n.open), true, 'still open after the note');
    /* Change the handler */
    await ba.waitForTimeout(450);
    await ba.click('[data-test="creature-assign-' + SWIFT + '"]');
    await ba.waitForSelector('[data-test=handler-dialog]');
    pre = await panelScroll(ba);
    await ba.fill('[data-test=handler-name]', 'Kaelen');
    await ba.fill('[data-test=handler-why]', 'Mira is away for the winter');
    await H.clickModal(ba, 'Change handler');
    await ba.waitForFunction(id => document.querySelector('[data-test="creature-handler-' + id + '"]').textContent === 'Kaelen', SWIFT);
    same(pre, await panelScroll(ba), 'after the handler');
    equal(await focused(ba), 'creature-assign-' + SWIFT);
    equal(await ba.$eval('[data-test="creature-chronicle-' + SWIFT + '"]', n => n.open), true);
  });

  await check('Confirm bond: the panel stays where it was and the focus goes to the beast\'s next button, because the Confirm button is gone', async () => {
    await ba.evaluate(id => TSI.bastion.debug.change(s => {
      const c = s.creatures.filter(x => x.id === id)[0];
      c.development.handlerId = 'Mira';
      c.development.bond.level = 1; c.development.bond.ready = 2;
      c.development.bonding = { away: true, awaySince: s.day, lastTick: s.day, days: 10 };
    }), SWIFT);
    await openPen(ba);
    await ba.evaluate(id => document.querySelector('[data-test="creature-confirm-' + id + '"]').scrollIntoView({ block: 'center' }), SWIFT);
    const before = await panelScroll(ba);
    await ba.focus('[data-test="creature-confirm-' + SWIFT + '"]');
    await ba.click('[data-test="creature-confirm-' + SWIFT + '"]');
    await ba.waitForSelector('[data-test=bond-dialog]');
    await ba.fill('[data-test=bond-why]', 'They flew the Marrowmere together at dawn.');
    await ba.click('[data-test=bond-dialog] .tsi-modal__foot .tsi-btn--primary');
    await ba.waitForFunction(id => !document.querySelector('[data-test="creature-confirm-' + id + '"]'), SWIFT);
    const after = await panelScroll(ba);
    assert(Math.abs(after.top - before.top) <= 2, before.top + ' -> ' + after.top);
    equal(await focused(ba), 'creature-return-' + SWIFT, 'on the beast\'s own Return button, not lost to the page');
    equal((await bas(ba)).creatures.filter(c => c.id === SWIFT)[0].development.bond.level, 2);
  });

  await check('a Release (a waiting beast) and a Cancel leave the panel in place too', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      s.creatures.push({ id: 'cr-w', species: 'wyvern', owner: '', name: 'Waiting Ash', status: 'waiting', home: '', grantedDay: s.day, housedDay: null, msgId: '' });
    }));
    await openPen(ba);
    await ba.evaluate(() => document.querySelector('[data-test="creature-release-cr-w"]').scrollIntoView({ block: 'center' }));
    const before = await panelScroll(ba);
    await ba.focus('[data-test="creature-release-cr-w"]');
    await ba.click('[data-test="creature-release-cr-w"]');
    await H.clickModal(ba, 'Release');
    await ba.waitForFunction(() => !document.querySelector('[data-test="creature-cr-w"]'));
    const after = await panelScroll(ba);
    assert(Math.abs(after.top - before.top) <= 2, before.top + ' -> ' + after.top);
    await closeAll(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Taking out, returning and acclimatising read the Explorer\'s day fresh');

  /* The Bastion's own look at the Explorer (every 2 seconds) is stopped: its first read never comes back, so what it knows
     of the Explorer's day stays old. A click a moment after Make Camp must still see the new day. */
  async function freezeClock(page) {
    await page.evaluate(() => {
      const real = TSI.store.fresh;
      window.__hung = 0;
      TSI.store.fresh = function (k) {
        if (k === 'tsi.explorer.save' && window.__hung === 0) { window.__hung = 1; return new Promise(function () {}); }
        return real.apply(TSI.store, arguments);
      };
    });
    await page.waitForFunction(() => window.__hung === 1, null, { timeout: 6000 });
  }

  await check('Take out a moment after Make Camp is refused ("catching up with the Explorer\'s day"), nothing is counted, and once the Bastion has caught up it works', async () => {
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    await ba.evaluate(() => TSI.bastion.debug.change(s => { const c = s.creatures.filter(x => x.id === 'cr-1')[0]; c.development.bonding = { away: false, awaySince: null, lastTick: null, days: 10 }; c.development.bond.level = 2; c.development.bond.ready = null; }));
    await ba.evaluate(() => TSI.store.flush());
    await openPen(ba);
    await freezeClock(ba);
    const day = await exDay(ex);
    assert((await bas(ba)).day === day, 'both on the same day to start with');
    await closeAll(ex);
    await camp(ex);
    equal(await exDay(ex), day + 1);
    await ba.click('[data-test="creature-takeout-cr-1"]');
    const said = await notice(ba);
    assert(/catching up with the Explorer's day/.test(said), said);
    await H.clickModal(ba, 'OK');
    const d = beast(await bas(ba), 'cr-1').development;
    equal([d.bonding.away, d.bonding.days], [false, 10], 'it did not go out, and no Bonding Day was counted');
    /* Reopened, the Bastion passes the day by itself; now it works. */
    await ba.reload();
    await ba.waitForFunction(day2 => { const s = TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state(); return s && s.day === day2 && !s.dayInProgress && !TSI.bastion.debug.busy(); }, day + 1, { timeout: 15000 });
    for (let n = 0; n < 20 && (await ba.$('[data-test=ironbow-word]')); n++) { await ba.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary'); await ba.waitForTimeout(300); }
    await openPen(ba);
    await ba.click('[data-test="creature-takeout-cr-1"]');
    await ba.waitForSelector('[data-test="creature-return-cr-1"]');
    const d2 = beast(await bas(ba), 'cr-1').development;
    equal([d2.bonding.away, d2.bonding.awaySince, d2.bonding.days], [true, day + 1, 10]);
  });

  await check('Return a moment after Make Camp is refused too, and loses nothing: the day is credited when the Bastion has caught up', async () => {
    await freezeClock(ba);
    const day = await exDay(ex);
    await closeAll(ex);
    await camp(ex);
    equal(await exDay(ex), day + 1);
    await ba.waitForTimeout(450);
    await ba.click('[data-test="creature-return-cr-1"]');
    const said = await notice(ba);
    assert(/catching up with the Explorer's day/.test(said), said);
    await H.clickModal(ba, 'OK');
    let d = beast(await bas(ba), 'cr-1').development;
    equal([d.bonding.away, d.bonding.days], [true, 10], 'still out, nothing lost');
    await ba.reload();
    await ba.waitForFunction(day2 => { const s = TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state(); return s && s.day === day2 && !s.dayInProgress && !TSI.bastion.debug.busy(); }, day + 1, { timeout: 15000 });
    for (let n = 0; n < 20 && (await ba.$('[data-test=ironbow-word]')); n++) { await ba.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary'); await ba.waitForTimeout(300); }
    d = beast(await bas(ba), 'cr-1').development;
    equal([d.bonding.away, d.bonding.days], [true, 11], 'the day just passed is counted once');
  });

  await check('Acclimatise With Beast a moment after Make Camp is refused too, and nothing is recorded', async () => {
    await openPen(ba);
    await freezeClock(ba);
    const day = await exDay(ex);
    await closeAll(ex);
    await camp(ex);
    equal(await exDay(ex), day + 1);
    await ba.waitForTimeout(450);
    await ba.click('[data-test=issue-' + ACC + ']');
    const said = await notice(ba);
    assert(/catching up with the Explorer's day/.test(said), said);
    assert(!(await ba.$('[data-test=acclimatise-dialog]')), 'the roll\'s box did not even open');
    await H.clickModal(ba, 'OK');
    const lichen = beast(await bas(ba), 'cr-4').development;
    equal([lichen.bond.level, lichen.acclimatise], [0, undefined]);
    await ba.reload();
    await ba.waitForFunction(day2 => { const s = TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state(); return s && s.day === day2 && !s.dayInProgress && !TSI.bastion.debug.busy(); }, day + 1, { timeout: 15000 });
    for (let n = 0; n < 20 && (await ba.$('[data-test=ironbow-word]')); n++) { await ba.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary'); await ba.waitForTimeout(300); }
  });

  /* ------------------------------------------------------------------ */
  section('Clear extra builds, a kind this copy does not know, and the Acclimatise row');

  await check('Clear extra builds will not take the Beast Pen away while beasts live in it: it says why, plainly, and clears nothing; with no beast in it, it asks and clears', async () => {
    await closeAll(ba);
    await ba.click('[data-test=facilities-count]');
    await ba.waitForSelector('[data-test=clear-builds]');
    await ba.click('[data-test=clear-builds]');
    const text = await notice(ba);
    assert(/Clear extra builds would also demolish the Beast Pen, and 5 beasts live in it: there is nowhere else for them to go\. Nothing was cleared\./.test(text), text);
    await H.clickModal(ba, 'OK');
    await ba.waitForTimeout(400);
    equal((await bas(ba)).builtExtras.map(e => e && e.facId || e).filter(Boolean), ['beast_pen'], 'the Pen is still there');
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.creatures = []; }));
    await ba.click('[data-test=clear-builds]');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Clear")');
    await H.clickModal(ba, 'Clear');
    await ba.waitForTimeout(400);
    equal((await bas(ba)).builtExtras.filter(Boolean), [], 'empty of beasts, it clears as before');
    await ba.evaluate(SETUP);
  });

  await check('a beast of a kind this copy does not know has an "Other beasts" stall: named, with its handler, a Release for one that waits, nothing says "its home"; it survives a reload', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      const R = TSI.bastion.rules;
      const c = { id: 'cr-x', species: 'phoenix', owner: '', name: 'Emberwing', status: 'housed', home: 'beast_pen', grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day);
      c.development.handlerId = 'Mira';
      s.creatures.push(c);
      s.creatures.push({ id: 'cr-y', species: 'phoenix', owner: '', name: '', status: 'waiting', home: '', grantedDay: 3, housedDay: null, msgId: '' });
    }));
    await ba.evaluate(() => TSI.store.flush());
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    for (let n = 0; n < 20 && (await ba.$('[data-test=ironbow-word]')); n++) { await ba.click('[data-test=ironbow-word] .tsi-modal__foot button.tsi-btn--primary'); await ba.waitForTimeout(300); }
    await openPen(ba);
    equal(await ba.$$eval('[data-test="stall-other"] .tsi-bas-stall__head b', n => n.map(x => x.textContent)), ['Other beasts']);
    equal(await ba.$eval('[data-test="stall-other"]', n => n.getAttribute('data-count')), '2');
    const text = await bare(ba, '[data-test="stall-other"]');
    assert(/Emberwing/.test(text) && /Unknown creature/.test(text), text);
    assert(!/its home|undefined|NaN/.test(text), text);
    assert(await ba.$('[data-test="creature-rename-cr-x"]') && await ba.$('[data-test="creature-assign-cr-x"]'), 'it can be renamed and given a handler');
    equal(await bare(ba, '[data-test="creature-handler-cr-x"]'), 'Mira');
    assert(await ba.$('[data-test="creature-release-cr-y"]'), 'the waiting one can be released');
    equal(await bare(ba, '[data-test="creature-status-cr-y"]'), 'Waiting for a home at the Beast Pen.');
    assert(await ba.$('[data-test="creature-chronicle-cr-x"]'), 'and its Chronicle is there to read');
    /* Release the waiting one. */
    await ba.click('[data-test="creature-release-cr-y"]');
    await H.clickModal(ba, 'Release');
    await ba.waitForFunction(() => !document.querySelector('[data-test="creature-cr-y"]'));
    equal(await ba.$eval('[data-test="stall-other"]', n => n.getAttribute('data-count')), '1');
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.creatures = s.creatures.filter(c => c.species !== 'phoenix'); }));
    await ba.waitForFunction(() => !document.querySelector('[data-test="stall-other"]'));
  });

  await check('the Acclimatise row shows the DC of the kind selected (a kind with its own DC shows it), and its note is made from the data, with no mention of a file', async () => {
    await closeAll(ba);
    await ba.evaluate(() => { TSI_DATA.bastionCreatures.species.fellcat.acclimatiseDC = 23; });
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.creatures.forEach(c => { if (c.id === 'cr-1') c.development.bond.level = 0; }); }));
    await openPen(ba);
    const opts = await ba.$$eval('[data-test=sel-' + ACC + '] option', n => n.map(o => o.textContent));
    assert(opts.length === 2 && /Swiftwing/.test(opts[0]) && /Lichen/.test(opts[1]), JSON.stringify(opts));
    equal(await bare(ba, '[data-test=acclimatise-row] .tsi-bas-fn__cost'), 'Animal Handling · DC 20');
    await ba.selectOption('[data-test=sel-' + ACC + ']', '1');
    await ba.waitForTimeout(200);
    equal(await bare(ba, '[data-test=acclimatise-row] .tsi-bas-fn__cost'), 'Animal Handling · DC 23', 'the fellcat\'s own');
    const note = await bare(ba, '[data-test=acclimatise-note]');
    assert(/Animal Handling at the table/.test(note) && /DC 20 to 23, each kind has its own/.test(note) && /locks that beast for 3 days/.test(note), note);
    assert(!/creatures-data|\.js|in the data/.test(note), note);
    await ba.click('[data-test=issue-' + ACC + ']');
    await ba.waitForSelector('[data-test=acclimatise-dialog]');
    assert(/DC 23/.test(await bare(ba, '[data-test=acclimatise-dialog]')), 'the dialog agrees with the row');
    await H.clickModal(ba, 'Cancel');
    await ba.evaluate(() => { delete TSI_DATA.bastionCreatures.species.fellcat.acclimatiseDC; });
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.creatures.forEach(c => { if (c.id === 'cr-1') c.development.bond.level = 1; }); }));
  });

  /* ------------------------------------------------------------------ */
  section('Bond bars are not buttons, and long words stay inside their stall');

  await check('the five bond bars show a plain pointer, do not brighten when hovered, and are not the gold pill-button class', async () => {
    await openPen(ba);
    const info = await ba.evaluate(() => {
      const bar = document.querySelector('[data-test^="creature-pill-cr-1-"]');
      const cs = getComputedStyle(bar);
      return { cls: bar.className, cursor: cs.cursor, padding: cs.paddingTop + '/' + cs.paddingLeft, tag: bar.tagName, gold: bar.classList.contains('tsi-bas-pill') };
    });
    equal(info.gold, false);
    assert(info.cursor !== 'pointer', 'cursor: ' + info.cursor);
    await ba.hover('[data-test^="creature-pill-cr-1-"]');
    equal(await ba.$eval('[data-test^="creature-pill-cr-1-"]', n => getComputedStyle(n).filter), 'none', 'no hover glow');
  });

  await check('a 40-letter name, a 34-letter word and a 118-character link in a beast\'s text do not make the panel scroll sideways (1707 x 930)', async () => {
    assert(LINK.length >= 118, 'the link is long enough: ' + LINK.length);
    await ba.evaluate(([name, word, link]) => TSI.bastion.debug.change(s => {
      const c = s.creatures.filter(x => x.id === 'cr-1')[0];
      c.name = name;
      c.development.temperament = { dominant: word, attachment: link, trigger: 'ordinary words' };
      c.development.chronicle.push({ id: 'ch-long', day: s.day, cat: 'note', text: 'See ' + link, by: 'DM', link: '' });
      const d = s.creatures.filter(x => x.id === 'cr-0')[0];
      d.name = name.split('').reverse().join('');
    }), [FORTY, LONG_WORD, LINK]);
    await openPen(ba);
    await ba.evaluate(() => { document.querySelector('[data-test="creature-chronicle-cr-1"]').open = true; });
    await ba.waitForTimeout(200);
    const g = await ba.evaluate(() => {
      const root = document.querySelector('[data-test=creatures-beast_pen]');
      const stalls = Array.from(root.querySelectorAll('.tsi-bas-stall')).map(s => ({ test: s.getAttribute('data-test'), over: s.scrollWidth - s.clientWidth }));
      let box = root;
      while (box && !(box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      const modal = document.querySelector('[data-test=panel-fac-beast_pen]');
      const wide = Array.from(root.querySelectorAll('*')).filter(n => n.getBoundingClientRect().right > modal.getBoundingClientRect().right + 1).map(n => n.className || n.tagName).slice(0, 5);
      return {
        stalls, wide,
        sideways: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, box ? box.scrollWidth - box.clientWidth : 0, modal.scrollWidth - modal.clientWidth)
      };
    });
    assert(g.sideways <= 0, 'the panel scrolls sideways by ' + g.sideways + 'px: ' + JSON.stringify(g));
    assert(g.stalls.every(s => s.over <= 0), 'a stall overflows: ' + JSON.stringify(g.stalls));
    equal(g.wide, [], 'nothing sticks out of the panel');
    await H.shot(ba, 'beast-pen-long-words');
  });

  await check('nothing went wrong and nothing reached for the internet', async () => {
    equal(ctx.log.net, []);
    equal(ctx.log.failed, []);
    equal(ctx.log.errors, []);
  });

  await ctx.close();
  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
