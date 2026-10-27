/* The Beast Pen at work (the Beast Pen and day-by-day bonding, Harry, 22 October 2026), clicked through from a
   double-clicked index.html with the internet off, with the Explorer and the Bastion open side by side:
   - the Pen's panel: Harry's picture across the full width at the very top, with the level, the orders and the beasts
     beneath it; only House Beast Here and Acclimatise With Beast as orders; no Upgrade row;
   - Acclimatise With Beast: the DM types the handler's Animal Handling total, DC 20 for every kind; 19 fails and locks that
     beast for 3 in-game days (a fail on Day 1 blocks Days 2 and 3, Day 4 is allowed); 20 passes: Bond 1, the beast leaves
     the dropdown, and its first meeting is rolled for the Beast Handler;
   - Take <name> on the road / Return <name> to the Beast Pen; "Away from the Ironbow" and "At the Beast Pen"; days only
     count while it is away; the pills fill as days pass; at 10 days Bond 2 is ready and waits for the DM, with the days
     still counting, until the DM confirms it (one level at a time);
   - the days are credited once however they arrive: the Explorer making camp with the Bastion closed (the Bastion passes
     them when it opens), a reload part-way through catching up, and Reset Travel (the days move back with the Explorer, so
     the next camp still counts);
   - the panel fits the laptop (1707 x 930, pixel ratio 1.5) and the TV (1920 x 1080, pixel ratio 1).
   Run with:  node tests/e2e/beast-pen.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const ACC = 'beast_pen__acclimatise';
const HOUSE = 'beast_pen__house_beast';

const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exDay = page => page.evaluate(() => TSI.explorer.debug.state().travel.day);
const lastModal = page => page.$$eval('.tsi-modal', ms => ms[ms.length - 1].textContent.replace(/\s+/g, ' ').trim());
const beast = (s, id) => s.creatures.filter(c => c.id === id)[0];

async function context(browser, size) {
  const ctx = await H.newContext(browser, size, { acceptDownloads: true, backedUp: true });
  await ctx.setOffline(true);
  /* No travel or campfire events and no weather; every die the Bastion rolls comes up the same. */
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
  await p.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  return p;
}
async function closeAll(page) {
  for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}
/* Make Camp in the Explorer, closing whatever the night brings. */
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
async function passDays(ex, ba, n) {
  await closeAll(ex);
  await closeAll(ba);
  for (let i = 0; i < n; i++) await camp(ex);
  const day = await exDay(ex);
  const word = await bastionReaches(ba, day);
  return { day, word };
}
/* The Beast Pen's panel, opened from its tile. */
async function openPen(ba) {
  await closeAll(ba);
  await ba.waitForTimeout(300);
  await ba.click('[data-test=tile-beast_pen]');
  await ba.waitForSelector('[data-test=panel-fac-beast_pen]');
  await ba.waitForTimeout(300);
}
/* A Pen with a griffin (Swiftwing, handler Mira) and a wyvern (Stormwing, no handler) housed, both at Bond 0. */
async function setUpPen(ba) {
  await ba.selectOption('[data-test=level]', '9');
  await ba.waitForTimeout(300);
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    s.treasuryGP = 100;
    s.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
    s.facilityLevels.beast_pen = 1;
    const mk = (id, species, name, handler) => {
      const c = { id, species, owner: '', name, status: 'housed', home: 'beast_pen', grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day);
      if (handler) c.development.handlerId = handler;
      return c;
    };
    s.creatures = [mk('cr-swift', 'griffin', 'Swiftwing', 'Mira'), mk('cr-storm', 'wyvern', 'Stormwing', '')];
  }));
  await ba.evaluate(() => TSI.store.flush());
}
/* What the order's button says and whether it is pressed, with the sentence under it. */
async function orderState(ba, key) {
  return ba.evaluate(k => {
    const b = document.querySelector('[data-test="issue-' + k + '"]');
    const w = document.querySelector('[data-test="why-' + k + '"]');
    return { button: b.textContent, off: b.disabled, why: w && !w.hidden ? w.textContent : '' };
  }, key);
}
/* The Acclimatise With Beast roll: opens the dialog for the beast chosen in the dropdown, types the total, records it.
   Resolves with the pop-up that follows (and closes it). */
async function rollAcclimatise(ba, total) {
  await openPen(ba);
  await ba.click('[data-test=issue-' + ACC + ']');
  await ba.waitForSelector('[data-test=acclimatise-dialog]');
  await ba.fill('[data-test=acclimatise-total]', String(total));
  await ba.click('[data-test=acclimatise-dialog] .tsi-modal__foot .tsi-btn--primary');
  await ba.waitForTimeout(500);
  const said = await lastModal(ba);
  await H.clickModal(ba, 'OK');
  await ba.waitForTimeout(300);
  return said;
}
/* A beast's block in the Pen's panel, as the DM reads it. */
async function beastBlock(ba, id) {
  return ba.evaluate(i => {
    const q = sel => { const n = document.querySelector('[data-test="' + sel + '"]'); return n ? n.textContent.replace(/\s+/g, ' ').trim() : null; };
    const pills = Array.from(document.querySelectorAll('[data-test^="creature-pill-' + i + '-"]')).map(p => ({
      fill: Number(p.getAttribute('data-fill')), now: p.getAttribute('aria-valuenow'), label: p.getAttribute('aria-label'),
      ready: p.classList.contains('tsi-bas-bond--ready')
    }));
    const go = document.querySelector('[data-test="creature-takeout-' + i + '"]') || document.querySelector('[data-test="creature-return-' + i + '"]');
    return {
      status: q('creature-status-' + i), days: q('creature-days-' + i), bond: q('creature-bond-' + i), pills,
      go: go ? { text: go.textContent, off: go.disabled, test: go.getAttribute('data-test').replace(/-.*/, '') + '-' + go.getAttribute('data-test').split('-')[1] } : null,
      confirm: !!document.querySelector('[data-test="creature-confirm-' + i + '"]'),
      assignOff: (document.querySelector('[data-test="creature-assign-' + i + '"]') || {}).disabled
    };
  }, id);
}
const SWIFT = 'cr-swift';
const STORM = 'cr-storm';

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  let ex = null;
  let ba = null;

  /* ------------------------------------------------------------------ */
  section('The Beast Pen\'s panel');

  await check('Harry\'s picture runs the full width of the panel at the very top, with the level, the orders and the beasts beneath it', async () => {
    ex = await openExplorer(ctx);
    await ex.waitForTimeout(500);
    ba = await openBastion(ctx);
    await setUpPen(ba);
    await openPen(ba);
    const g = await ba.evaluate(() => {
      const img = document.querySelector('[data-test=fac-banner]');
      const body = img.parentElement;
      const cs = getComputedStyle(body);
      const inner = body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const r = img.getBoundingClientRect();
      const below = sel => { const n = document.querySelector(sel); return n ? n.getBoundingClientRect().top >= r.bottom - 1 : null; };
      return {
        src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0, first: body.firstElementChild === img,
        widthGap: Math.abs(r.width - inner), height: Math.round(r.height),
        level: below('[data-test=fac-level]'), house: below('[data-test="issue-beast_pen__house_beast"]'), acc: below('[data-test="issue-beast_pen__acclimatise"]'),
        beasts: below('[data-test=creatures-beast_pen]'), stall: below('[data-test=stall-griffin]'),
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        top: Math.round(r.top), vh: innerHeight
      };
    });
    assert(/facilities\/beast_pen\.jpg$/.test(g.src), g.src);
    equal([g.loaded, g.first], [true, true], 'the picture is there, first in the panel');
    assert(g.widthGap <= 2, 'full width: ' + g.widthGap + 'px short');
    assert(g.height >= 150 && g.height <= 280, 'a banner, not a thumbnail: ' + g.height + 'px tall');
    equal([g.level, g.house, g.acc, g.beasts, g.stall], [true, true, true, true, true], 'everything else sits beneath it');
    assert(g.top >= 0 && g.top + g.height < g.vh, 'in view');
    equal(g.sideways, false);
    await H.shot(ba, 'beast-pen-panel-laptop');
  });

  await check('one level only, no Upgrade row, and only two orders: House Beast Here and Acclimatise With Beast', async () => {
    equal(await bare(ba, '[data-test=fac-level]'), 'One level only');
    equal(await ba.$('[data-test=upgrade-row-beast_pen]'), null);
    const ids = await ba.$$eval('[data-test^="issue-beast_pen__"]', n => n.map(b => b.getAttribute('data-test')).sort());
    equal(ids, ['issue-beast_pen__acclimatise', 'issue-beast_pen__house_beast']);
    const names = await ba.$$eval('.tsi-bas-facpanel__fns .tsi-bas-fn__name', n => n.map(x => x.textContent).sort());
    equal(names, ['Acclimatise With Beast', 'House Beast Here']);
    assert(!/train|harness|first flight|rider|ascent/i.test(await bare(ba, '[data-test=panel-fac-beast_pen]')), 'none of the old training');
  });

  await check('the Acclimatise With Beast row: Animal Handling, DC 20, At once; the dropdown lists the housed beasts at Bond 0, and one with no handler says so', async () => {
    equal(await bare(ba, '[data-test=acclimatise-row] .tsi-bas-fn__cost'), 'Animal Handling · DC 20');
    equal(await bare(ba, '[data-test=days-' + ACC + ']'), 'At once: the handler rolls at the table');
    const opts = await ba.$$eval('[data-test=sel-' + ACC + '] option', n => n.map(o => o.textContent));
    equal(opts, ['Swiftwing (Griffin), handler Mira', 'Stormwing (Wyvern): needs a handler']);
    equal((await orderState(ba, ACC)).off, false, 'Swiftwing can be rolled for');
    await ba.selectOption('[data-test=sel-' + ACC + ']', '1');
    await ba.waitForTimeout(200);
    const st = await orderState(ba, ACC);
    equal([st.off, st.why], [true, 'Stormwing has no handler yet. Assign one first.']);
    await ba.selectOption('[data-test=sel-' + ACC + ']', '0');
  });

  await check('each housed beast says where it is: "At the Beast Pen. Not acclimatised yet"; no Take out button, no pills, no Bonding Days before the roll is passed', async () => {
    for (const id of [SWIFT, STORM]) {
      const b = await beastBlock(ba, id);
      equal(b.status, 'At the Beast Pen. Not acclimatised yet');
      equal([b.go, b.pills.length, b.days, b.confirm], [null, 0, null, false]);
    }
  });

  /* ------------------------------------------------------------------ */
  section('Acclimatise With Beast');

  await check('Roll to acclimatise… asks for the total; nothing is recorded until a number from 1 to 60 is typed, and Cancel changes nothing', async () => {
    const before = await bas(ba);
    await ba.click('[data-test=issue-' + ACC + ']');
    await ba.waitForSelector('[data-test=acclimatise-dialog]');
    const d = await bare(ba, '[data-test=acclimatise-dialog]');
    assert(/Acclimatise With Beast: Swiftwing/.test(d), d);
    assert(/Mira rolls Animal Handling at the table\. A total of 20 or more passes/.test(d), d);
    assert(/locks Swiftwing for 3 days/.test(d), d);
    const main = '[data-test=acclimatise-dialog] .tsi-modal__foot .tsi-btn--primary';
    equal(await ba.isDisabled(main), true, 'nothing typed yet');
    await ba.fill('[data-test=acclimatise-total]', '0');
    equal([await ba.isDisabled(main), await bare(ba, '[data-test=acclimatise-problem]')], [true, 'Type a whole number from 1 to 60.']);
    await ba.fill('[data-test=acclimatise-total]', '19');
    equal(await ba.isDisabled(main), false);
    await H.clickModal(ba, 'Cancel');
    await ba.waitForTimeout(300);
    const after = await bas(ba);
    equal(beast(after, SWIFT).development, beast(before, SWIFT).development, 'Cancel changes nothing');
  });

  await check('a total of 19 fails: Swiftwing stays at Bond 0 and can\'t try again until Day 4 (the roll was on Day 1); the DM-only Chronicle has the failure', async () => {
    const said = await rollAcclimatise(ba, 19);
    assert(/^Failed\./.test(said) || /Failed/.test(said), said);
    const s = await bas(ba);
    const c = beast(s, SWIFT);
    equal([c.development.bond.level, c.development.acclimatise.retryDay, c.development.acclimatise.last.pass, c.development.acclimatise.last.total], [0, 4, false, 19]);
    assert(c.development.chronicle.some(e => e.private === true && /Acclimatisation failed on Day 1: rolled 19 against DC 20/.test(e.text)), 'a DM-only line');
    await openPen(ba);
    const st = await orderState(ba, ACC);
    equal([st.off, st.why], [true, 'Swiftwing can try again on Day 4.']);
  });

  await check('2 camps later (Day 3) it is still locked; on Day 4 it can be rolled for again', async () => {
    await passDays(ex, ba, 2);
    await openPen(ba);
    equal((await orderState(ba, ACC)).why, 'Swiftwing can try again on Day 4.');
    await passDays(ex, ba, 1);
    await openPen(ba);
    const st = await orderState(ba, ACC);
    equal([st.off, st.why], [false, '']);
    equal((await bas(ba)).day, 4);
  });

  await check('a total of 20 passes: Bond 1, Swiftwing leaves the dropdown, and its first meeting is rolled for the Beast Handler', async () => {
    const said = await rollAcclimatise(ba, 20);
    assert(/Passed/.test(said), said);
    const s = await bas(ba);
    const c = beast(s, SWIFT);
    equal([c.development.bond.level, c.development.bond.ready, c.development.acclimatise.tries, c.development.acclimatise.retryDay], [1, null, 2, null]);
    assert(c.development.initiation && c.development.initiation.rolls, 'the first meeting is rolled');
    await openPen(ba);
    const opts = await ba.$$eval('[data-test=sel-' + ACC + '] option', n => n.map(o => o.textContent));
    equal(opts, ['Stormwing (Wyvern): needs a handler'], 'Swiftwing is gone from the list');
    const b = await beastBlock(ba, SWIFT);
    equal(b.status, 'At the Beast Pen');
    equal(b.go.text, 'Take Swiftwing on the road');
    equal(b.days, '0');
    equal(b.pills.map(p => p.fill), [100, 0, 0, 0, 0], 'pill 1 is full the moment the roll passes');
    equal(b.pills[0].label, 'Bond 1, Acclimatised: reached');
    equal(b.pills[1].label, 'Bond 2, Trusting: 0 of 10 days');
    equal(b.bond, '1: Acclimatised');
    await H.shot(ba, 'beast-pen-acclimatised');
  });

  /* ------------------------------------------------------------------ */
  section('On the road and back');

  await check('Take Swiftwing on the road: "Away from the Ironbow", and the button becomes "Return Swiftwing to the Beast Pen"; the handler can\'t be changed meanwhile', async () => {
    await ba.click('[data-test=creature-takeout-' + SWIFT + ']');
    await ba.waitForTimeout(400);
    const b = await beastBlock(ba, SWIFT);
    equal(b.status, 'Away from the Ironbow since Day 4');
    equal(b.go.text, 'Return Swiftwing to the Beast Pen');
    equal(b.days, '0 (out on the road since Day 4)');
    equal(b.assignOff, true);
    const s = await bas(ba);
    equal([beast(s, SWIFT).development.bonding.away, beast(s, SWIFT).development.bonding.awaySince, beast(s, SWIFT).development.bonding.lastTick], [true, 4, 4]);
  });

  await check('3 camps later (Day 7): 3 Bonding Days, the second pill is three tenths full, and the first stays full', async () => {
    await passDays(ex, ba, 3);
    await openPen(ba);
    const b = await beastBlock(ba, SWIFT);
    equal(b.days, '3 (out on the road since Day 4)');
    equal(b.pills.map(p => p.fill), [100, 30, 0, 0, 0]);
    equal(b.pills[1].label, 'Bond 2, Trusting: 3 of 10 days');
    equal(b.pills[1].now, '30');
    equal(b.pills.map(p => p.ready), [false, false, false, false, false]);
  });

  await check('Return Swiftwing to the Beast Pen: back "At the Beast Pen", the 3 days kept; 2 camps later nothing has counted (bonding is paused)', async () => {
    await ba.click('[data-test=creature-return-' + SWIFT + ']');
    await ba.waitForTimeout(400);
    let b = await beastBlock(ba, SWIFT);
    equal([b.status, b.days, b.go.text], ['At the Beast Pen', '3', 'Take Swiftwing on the road']);
    await passDays(ex, ba, 2);
    await openPen(ba);
    b = await beastBlock(ba, SWIFT);
    equal([b.status, b.days, b.pills.map(p => p.fill)], ['At the Beast Pen', '3', [100, 30, 0, 0, 0]]);
    equal((await bas(ba)).day, 9);
  });

  await check('out again on Day 9 and 2 camps later (Day 11): 5 Bonding Days, half of the second pill; the days away and the days at the Pen add up, never overlap', async () => {
    await ba.click('[data-test=creature-takeout-' + SWIFT + ']');
    await ba.waitForTimeout(400);
    await passDays(ex, ba, 2);
    await openPen(ba);
    const b = await beastBlock(ba, SWIFT);
    equal(b.days, '5 (out on the road since Day 9)');
    equal(b.pills.map(p => p.fill), [100, 50, 0, 0, 0]);
  });

  /* ------------------------------------------------------------------ */
  section('Days that pass with the Bastion closed');

  await check('the Bastion is closed and the Explorer makes camp 4 times (Day 15); opened again, it passes the 4 days and credits each once: 9 Bonding Days', async () => {
    await ba.close();
    for (let i = 0; i < 4; i++) await camp(ex);
    equal(await exDay(ex), 15);
    ba = await openBastion(ctx);
    await bastionReaches(ba, 15);
    const s = await bas(ba);
    const d = beast(s, SWIFT).development;
    equal([s.day, d.bonding.days, d.bonding.lastTick, d.bonding.awaySince, d.bond.ready], [15, 9, 15, 9, null]);
    await openPen(ba);
    equal((await beastBlock(ba, SWIFT)).days, '9 (out on the road since Day 9)');
  });

  await check('one more camp (Day 16): 10 Bonding Days, Bond 2 is ready: the Bastion says so, the pill is full and glows, and a Confirm button and a marker on the Beast Pen\'s tile wait for the DM', async () => {
    const r = await passDays(ex, ba, 1);
    assert(/Swiftwing and Mira have spent 10 days together: Bond 2 \(Trusting\) is ready\. Run a scene at the table, then confirm it in the Beast Pen\./.test(r.word), r.word);
    const s = await bas(ba);
    equal([beast(s, SWIFT).development.bond.level, beast(s, SWIFT).development.bond.ready], [1, 2], 'the level only moves when the DM confirms it');
    equal(await ba.isVisible('[data-test=tile-bond-ready]'), true, 'a marker on the tile');
    await openPen(ba);
    const b = await beastBlock(ba, SWIFT);
    equal(b.pills.map(p => p.fill), [100, 100, 0, 0, 0]);
    equal(b.pills.map(p => p.ready), [false, true, false, false, false]);
    equal(b.confirm, true);
    equal(b.pills[1].label, 'Bond 2, Trusting: 10 of 10 days, ready for your scene');
    await H.shot(ba, 'beast-pen-bond-ready');
  });

  await check('another camp (Day 17) while the milestone waits: the day still counts (11), nothing is lost, and the level has not moved on by itself', async () => {
    await passDays(ex, ba, 1);
    const s = await bas(ba);
    const d = beast(s, SWIFT).development;
    equal([d.bond.level, d.bond.ready, d.bonding.days], [1, 2, 11]);
    equal(await ba.$$eval('[data-test=tile-bond-ready]', n => n.length), 1, 'still one marker');
  });

  await check('Confirm bond milestone… asks what happened at the table (3 letters at least); Bond 2 is made, one level only, and the third pill starts with the day already counted', async () => {
    await openPen(ba);
    await ba.click('[data-test=creature-confirm-' + SWIFT + ']');
    await ba.waitForSelector('[data-test=bond-dialog]');
    const main = '[data-test=bond-dialog] .tsi-modal__foot .tsi-btn--primary';
    equal(await ba.isDisabled(main), true);
    await ba.fill('[data-test=bond-why]', 'They flew the Marrowmere together at dawn.');
    equal(await ba.isDisabled(main), false);
    await ba.click(main);
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    const d = beast(s, SWIFT).development;
    equal([d.bond.level, d.bond.ready, d.bonding.days], [2, null, 11]);
    assert(d.chronicle.some(e => /Marrowmere/.test(e.text)), 'the scene is in the Chronicle');
    await openPen(ba);
    const b = await beastBlock(ba, SWIFT);
    equal(b.pills.map(p => p.fill), [100, 100, 10, 0, 0], 'Bond 3 starts at 1 day of 10');
    equal(b.pills.map(p => p.ready), [false, false, false, false, false]);
    equal([b.confirm, await ba.$('[data-test=tile-bond-ready]')], [false, null]);
  });

  /* ------------------------------------------------------------------ */
  section('A reload part-way through catching up');

  await check('the Bastion\'s save is from Day 19 (it closed part-way) while the Explorer is on Day 25: reopened, it passes Days 20 to 25 and credits each once (13 Bonding Days on Day 19, then 19)', async () => {
    await passDays(ex, ba, 2);
    await ba.evaluate(() => TSI.store.flush());
    const snap = await ex.evaluate(() => TSI.store.fresh('tsi.bastion.state', null));
    equal([snap.day, snap.creatures.filter(c => c.id === 'cr-swift')[0].development.bonding.days], [19, 13]);
    await ba.close();
    for (let i = 0; i < 6; i++) await camp(ex);
    equal(await exDay(ex), 25);
    /* The save the Bastion left on Day 19 is put back, as it would be had the window been closed (or the laptop shut) right then. */
    await ex.evaluate(s => { TSI.store.set('tsi.bastion.state', s); TSI.store.flush(); }, snap);
    ba = await openBastion(ctx);
    await bastionReaches(ba, 25);
    const s = await bas(ba);
    const d = beast(s, SWIFT).development;
    equal([s.day, d.bonding.days, d.bonding.lastTick, d.bond.level, d.bond.ready], [25, 19, 25, 2, null]);
  });

  await check('it carries on from there: one more camp makes 20 days, and Bond 3 is ready', async () => {
    const r = await passDays(ex, ba, 1);
    assert(/Swiftwing and Mira have spent 20 days together: Bond 3 \(Bonded\) is ready/.test(r.word), r.word);
    const s = await bas(ba);
    equal([beast(s, SWIFT).development.bonding.days, beast(s, SWIFT).development.bond.ready], [20, 3]);
  });

  await check('the Bastion window is reloaded (F5) at six different moments around a day passing: each day is still credited once, never twice and never missed (26 Bonding Days on Day 32)', async () => {
    let days = 20;
    let day = 26;
    for (const wait of [0, 400, 900, 1400, 1900, 2300]) {
      await closeAll(ex);
      await camp(ex);
      day++;
      days++;
      await ba.waitForTimeout(wait);
      await ba.reload();
      for (let n = 0; n < 60; n++) {
        try { await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 2000 }); break; } catch (e) { await ba.waitForTimeout(200); }
      }
      await bastionReaches(ba, day);
      const d = beast(await bas(ba), SWIFT).development;
      equal([d.bonding.days, d.bonding.lastTick], [days, day], 'after a reload ' + wait + ' ms after camp, on Day ' + day);
    }
    const s = await bas(ba);
  });

  /* ------------------------------------------------------------------ */
  section('Reset Travel');

  await check('Reset Travel puts the Explorer on Day 1; the Bastion moves back with it, the Bonding Days stay (26), and the trip\'s days move too', async () => {
    await closeAll(ex);
    await closeAll(ba);
    const before = beast(await bas(ba), SWIFT).development;
    equal([before.bonding.awaySince, before.bonding.lastTick, before.bonding.days], [9, 32, 26]);
    await ex.waitForTimeout(400);
    await ex.click('[data-test=reset-travel]');
    assert(/Start again from Day 1/.test(await H.modalText(ex)));
    await H.clickModal(ex, 'OK');
    await ex.waitForTimeout(300);
    equal(await exDay(ex), 1);
    await bastionReaches(ba, 1);
    const s = await bas(ba);
    const d = beast(s, SWIFT).development;
    equal([d.bonding.days, d.bonding.awaySince, d.bonding.lastTick, d.bond.ready], [26, 9 - 31, 1, 3], 'every day moved back by 31');
    await openPen(ba);
    equal((await beastBlock(ba, SWIFT)).status, 'Away from the Ironbow since before Day 1');
  });

  await check('camping on from Day 1 counts a Bonding Day for each new day, once: the day is not held back by the old trip\'s day numbers', async () => {
    await passDays(ex, ba, 1);
    let d = beast(await bas(ba), SWIFT).development;
    equal([d.bonding.days, d.bonding.lastTick], [27, 2]);
    await passDays(ex, ba, 1);
    d = beast(await bas(ba), SWIFT).development;
    equal([d.bonding.days, d.bonding.lastTick], [28, 3]);
  });

  /* ------------------------------------------------------------------ */
  section('Fitting the laptop and the TV');

  await check('laptop (1707 x 930, pixel ratio 1.5): the Pen\'s panel, with a beast away and a milestone waiting, has no sideways scroll; the picture, the orders and the first beast\'s buttons are in view', async () => {
    await openPen(ba);
    const lay = await H.layoutCheck(ba, ['[data-test=fac-banner]', '[data-test=issue-' + ACC + ']']);
    equal([lay.scrollWidth > lay.clientWidth, lay.outOfView], [false, []]);
    const where = await ba.evaluate(id => {
      const b = document.querySelector('[data-test="creature-return-' + id + '"]');
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      const f = b.closest('.tsi-modal').querySelector('.tsi-modal__foot');
      return { inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, underFooter: !!f && r.bottom > f.getBoundingClientRect().top };
    }, SWIFT);
    equal(where, { inView: true, underFooter: false });
    await H.shot(ba, 'beast-pen-laptop-bottom');
    await ba.evaluate(() => document.querySelector('[data-test=fac-banner]').scrollIntoView({ block: 'start' }));
  });

  await check('nothing went wrong and nothing reached for the internet (laptop)', async () => {
    equal(ctx.log.net, []);
    equal(ctx.log.failed, []);
    equal(ctx.log.errors, []);
  });
  await ctx.close();

  const tv = await context(browser, 'tv');
  await check('TV (1920 x 1080, pixel ratio 1): the Pen with all five kinds housed, one away and one ready, fits with no sideways scroll; the picture runs the full width, and the Acclimatise dialog fits', async () => {
    const tex = await openExplorer(tv);
    await tex.waitForTimeout(500);
    const tba = await openBastion(tv);
    await tba.selectOption('[data-test=level]', '9');
    await tba.waitForTimeout(300);
    await tba.evaluate(() => TSI.bastion.debug.change(s => {
      const R = TSI.bastion.rules;
      s.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
      s.facilityLevels.beast_pen = 1;
      const kinds = ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat'];
      const names = ['Stormwing with a long, long name', 'Swiftwing', 'Greyfang', 'Bramble', 'Lichen'];
      s.creatures = kinds.map((k, i) => {
        const c = { id: 'cr-' + i, species: k, owner: '', name: names[i], status: 'housed', home: 'beast_pen', grantedDay: 1, housedDay: 1, msgId: '' };
        c.development = R.newDevelopment(c, s.day);
        c.development.handlerId = 'Mira';
        c.development.bond.level = i === 4 ? 0 : 1 + (i % 3);
        if (i === 0) c.development.bonding = { away: true, awaySince: 1, lastTick: 1, days: 14 };
        if (i === 1) { c.development.bonding = { away: false, awaySince: null, lastTick: null, days: 10 }; c.development.bond.ready = 2; }
        return c;
      });
    }));
    await tba.evaluate(() => TSI.store.flush());
    await openPen(tba);
    const g = await tba.evaluate(() => {
      const img = document.querySelector('[data-test=fac-banner]');
      const body = img.parentElement;
      const cs = getComputedStyle(body);
      const r = img.getBoundingClientRect();
      return {
        gap: Math.abs(r.width - (body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))), first: body.firstElementChild === img,
        stalls: document.querySelectorAll('[data-test^="stall-"][data-count]').length,
        pills: document.querySelectorAll('[data-test^="creature-pills-"]').length,
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        inView: r.top >= 0 && r.bottom <= innerHeight
      };
    });
    assert(g.gap <= 2 && g.first, 'the picture runs the full width at the top: ' + JSON.stringify(g));
    equal([g.stalls, g.pills, g.sideways, g.inView], [5, 4, false, true]);
    await H.shot(tba, 'beast-pen-tv');
    /* The one beast still to acclimatise (Lichen) has its dialog open and fitting. */
    await tba.click('[data-test=issue-' + ACC + ']');
    await tba.waitForSelector('[data-test=acclimatise-dialog]');
    const lay = await H.layoutCheck(tba, ['[data-test=acclimatise-dialog]']);
    equal([lay.scrollWidth > lay.clientWidth, lay.outOfView], [false, []]);
    await H.clickModal(tba, 'Cancel');
    equal(tv.log.net, []);
    equal(tv.log.failed, []);
    equal(tv.log.errors, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
