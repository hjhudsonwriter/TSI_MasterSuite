/* Phase 3 click-through: the Pelagosi Puzzle Trials.
   Opens index.html?tool=pelagosi from its files with the internet off, plays
   both puzzles through, times the Memory flashes, re-creates every "leftover
   timer" bug from KNOWN_ISSUES (PEL-01 to PEL-11) to show it's gone, checks the
   layout on the laptop, and, when the old tool is in _legacy/, compares the
   rules and the texts shown step by step with the old tool.
   Run:  node tests/e2e/phase3.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const PEL = INDEX + '?tool=pelagosi';
const LEGACY = H.fileUrl('_legacy/pelagosi_marker_rune_puzzle/index.html');
const HAS_LEGACY = fs.existsSync(path.join(H.ROOT, '_legacy/pelagosi_marker_rune_puzzle/app.js'));
const MISSING_SOUNDS = ['water-stir.wav', 'pressure-rise.wav', 'current-reverse.wav', 'tidal-surge.wav', 'basin-wake.wav'];

/* Record every sound the page starts, with the time. Works for the old tool too. */
function recordSounds() {
  window.__plays = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__plays.push({ file: String(this.currentSrc || this.src).split('/').pop(), t: performance.now() });
    return play.apply(this, arguments);
  };
}

async function newPage(browser, size, extra) {
  const context = await H.newContext(browser, size || 'laptop', extra);
  await context.setOffline(true);
  await context.addInitScript(recordSounds);
  const page = await context.newPage();
  return { context, page };
}

async function openPel(page) {
  await page.goto(PEL);
  await page.waitForSelector('[data-test=rune-anchor]');
}

const mem = page => page.evaluate(() => TSI.pelagosi.debug.memory());
const tid = page => page.evaluate(() => TSI.pelagosi.debug.tidal());
const text = (page, test) => page.textContent('[data-test=' + test + ']');
const plays = page => page.evaluate(() => window.__plays.map(p => p.file));
const modalOpen = page => page.evaluate(() => !!document.querySelector('.tsi-modal'));
const modalTitle = page => page.evaluate(() => { const t = document.querySelector('.tsi-modal__title'); return t ? t.textContent : null; });

async function waitMem(page, phase, timeout) {
  await page.waitForFunction(p => TSI.pelagosi.debug.memory().phase === p, phase, { timeout: timeout || 12000 });
}

async function startMemory(page) {
  await page.click('[data-test=begin]');
  await page.waitForSelector('.tsi-modal');
  await H.clickModal(page, 'START TRIAL');
  await page.waitForSelector('.tsi-modal', { state: 'detached' });
}

/* Click the right runes for the current round. */
async function answerRound(page) {
  const seq = await page.evaluate(() => { const m = TSI.pelagosi.debug.memory(); return TSI.pelagosi.rules.roundSequence(m.masterSequence, m.roundIndex); });
  for (const r of seq) {
    await page.click('[data-test=rune-' + r + ']');
    await page.waitForTimeout(40);
  }
  return seq;
}

/* A wrong first rune for the current round. */
async function answerWrong(page) {
  const wrong = await page.evaluate(() => { const m = TSI.pelagosi.debug.memory(); const first = m.masterSequence[0]; return ['anchor', 'tide', 'depth', 'life', 'remains'].find(r => r !== first); });
  await page.click('[data-test=rune-' + wrong + ']');
}

async function startTidal(page) {
  await page.selectOption('[data-test=puzzle]', 'tidal');
  await page.click('[data-test=begin]');
  await page.waitForSelector('.tsi-modal');
  await H.clickModal(page, 'START SEQUENCE');
  await page.waitForSelector('.tsi-modal', { state: 'detached' });
}

/* Checks are ignored within 0.6 s of each other (double-click protection), so pause first. */
async function check_(page) {
  await page.waitForTimeout(650);
  await page.click('[data-test=check]');
}

/* Turn every pillar to the solution by clicking its rune and arrow. */
async function solveOuter(page) {
  const clicks = await page.evaluate(() => {
    const D = window.TSI_DATA.pelagosi.tidal;
    const s = TSI.pelagosi.debug.tidal();
    return D.pillarOrder.map(id => {
      const want = D.solution[id];
      const r = (D.runes.indexOf(want.rune) - s.pillars[id].runeIndex + D.runes.length) % D.runes.length;
      const d = (D.directions.indexOf(want.direction) - s.pillars[id].directionIndex + D.directions.length) % D.directions.length;
      return [id, r, d];
    });
  });
  for (const [id, r, d] of clicks) {
    for (let i = 0; i < r; i++) await page.click('[data-test=pillar-rune-' + id + ']');
    for (let i = 0; i < d; i++) await page.click('[data-test=pillar-arrow-' + id + ']');
  }
}

async function setBasin(page, rune) {
  for (let i = 0; i < 6; i++) {
    if ((await page.getAttribute('[data-test=basin]', 'data-rune')) === rune) return;
    await page.click('[data-test=basin]');
  }
  throw new Error('basin never showed ' + rune);
}

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('Opening it, and fitting the laptop (internet off)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');

    await check('its card says Open and opens it; it saves nothing', async () => {
      equal(await page.textContent('.tsi-card[data-tool=pelagosi] .tsi-card__cta'), 'Open');
      await Promise.all([page.waitForURL(/\?tool=pelagosi$/), page.click('.tsi-card[data-tool=pelagosi]')]);
      await page.waitForSelector('[data-test=rune-anchor]');
      equal(await page.textContent('.tsi-topbar__tool'), 'Pelagosi Puzzle Trials');
      equal(await page.$$eval('[data-test=export], [data-test=import]', x => x.length), 0);
    });

    await check('it starts on The Marker Remembers, waiting for BEGIN, with the runes locked', async () => {
      equal(await text(page, 'title'), 'The Marker Remembers');
      equal(await text(page, 'stage'), 'Awaiting the trial');
      equal(await text(page, 'round-label'), 'Round 0 of 3');
      equal(await page.$$eval('.tsi-pel-rune-btn', bs => bs.every(b => b.disabled)), true);
    });

    await check('headings use the Uncial Antiqua font, loaded from the suite folder', async () => {
      await page.evaluate(() => document.fonts.ready);
      const f = await page.evaluate(() => ({
        loaded: Array.from(document.fonts).filter(x => x.status === 'loaded').map(x => x.family.replace(/"/g, '')),
        title: getComputedStyle(document.querySelector('[data-test=title]')).fontFamily
      }));
      assert(f.loaded.includes('Uncial Antiqua'), f.loaded.join());
      assert(/^"?Uncial Antiqua/.test(f.title), f.title);
    });

    await check('no two things on the page share an id; its styles only touch Pelagosi', async () => {
      const dupes = await page.evaluate(() => {
        const seen = {};
        document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
        return Object.keys(seen).filter(k => seen[k] > 1);
      });
      equal(dupes, []);
      const css = fs.readFileSync(path.join(H.ROOT, 'tools/pelagosi/pelagosi.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{([^{}]*\{[^}]*\})*[^}]*\}/g, '');
      const selectors = [];
      css.replace(/([^{}]+)\{[^{}]*\}/g, (m, sel) => { selectors.push(sel.trim()); return m; });
      selectors.filter(s => s && !s.startsWith('@')).forEach(s => s.split(',').forEach(one => {
        one = one.trim();
        assert(one.startsWith('.tsi-tool--pelagosi') || one.startsWith('.tsi-page--pelagosi'), 'unscoped rule: ' + one);
        (one.match(/\.[\w-]+/g) || []).forEach(cls => assert(/^\.tsi-(pel|tool--pelagosi|page--pelagosi|panel|btn|input)/.test(cls), 'unprefixed class: ' + cls));
      }));
    });
    await context.close();
  }

  for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
    const { context, page } = await newPage(browser, size);
    await openPel(page);
    await page.evaluate(() => document.fonts.ready);
    const inView = size === 'smallWindow' ? [] : ['[data-test=begin]', '[data-test=reset]', '.tsi-pel-rune-btn', '[data-test=round-label]', '[data-test=tracker]', '[data-test=stage]'];
    await check(size + ': The Marker Remembers fits' + (size === 'smallWindow' ? ' with no sideways scroll' : ', runes, BEGIN and Reset in view'), async () => {
      const l = await H.layoutCheck(page, inView);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll: ' + l.scrollWidth);
      equal(l.outOfView, []);
    });
    await H.shot(page, 'pelagosi-memory-' + size);
    await startTidal(page);
    const tidalInView = size === 'smallWindow' ? [] : ['[data-test=check]', '[data-test=shuffle]', '.tsi-pel-pillar-rune', '.tsi-pel-pillar-arrow', '[data-test=pressure]', '[data-test=reset]'];
    await check(size + ': The Tidal Sequence fits' + (size === 'smallWindow' ? ' with no sideways scroll' : ', pillars, Check and Shuffle in view'), async () => {
      const l = await H.layoutCheck(page, tidalInView);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll: ' + l.scrollWidth);
      equal(l.outOfView, []);
    });
    await check(size + ': the chamber keeps its 3:2 shape, so the pillars sit on their plinths', async () => {
      const r = await page.$eval('[data-test=tidal-frame]', e => { const b = e.getBoundingClientRect(); return b.width / b.height; });
      assert(Math.abs(r - 1.5) < 0.01, 'ratio ' + r);
      const p = await page.$eval('[data-pillar=topLeft].tsi-pel-pillar', e => { const f = e.parentElement.getBoundingClientRect(); const b = e.getBoundingClientRect(); return [(b.left + b.width / 2 - f.left) / f.width, (b.top + b.height / 2 - f.top) / f.height]; });
      assert(Math.abs(p[0] - 0.40) < 0.01 && Math.abs(p[1] - 0.52) < 0.01, 'top-left pillar at ' + p);
    });
    await H.shot(page, 'pelagosi-tidal-' + size);
    await check(size + ': nothing from the internet, no missing files, no errors', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The Marker Remembers: playing it through');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openPel(page);

    await check('BEGIN shows the four rules; Not Yet changes nothing', async () => {
      await page.click('[data-test=begin]');
      await page.waitForSelector('.tsi-modal');
      equal(await modalTitle(page), 'How the trial works');
      equal(await page.$$eval('.tsi-modal ol li', li => li.length), 4);
      await H.clickModal(page, 'Not Yet');
      equal((await mem(page)).started, false);
    });

    await check('three rounds of 3, 4 and 5 runes at the old speeds, the runes locked while the Marker flashes', async () => {
      await page.evaluate(() => {
        window.__flashes = [];
        const d = document.querySelector('.tsi-pel-display');
        new MutationObserver(() => window.__flashes.push([d.classList.contains('tsi-pel-showing'), performance.now()])).observe(d, { attributes: true, attributeFilter: ['class'] });
      });
      await startMemory(page);
      const want = [[3, 950, 260], [4, 700, 220], [5, 520, 180]];
      for (let round = 0; round < 3; round++) {
        await page.waitForFunction(r => TSI.pelagosi.debug.memory().roundIndex === r && TSI.pelagosi.debug.memory().phase === 'showing', round);
        equal(await text(page, 'round-label'), 'Round ' + (round + 1) + ' of 3');
        await page.waitForTimeout(700);
        assert(await page.$$eval('.tsi-pel-rune-btn', bs => bs.every(b => b.disabled)), 'runes should be locked while flashing');
        await page.evaluate(() => { window.__flashes = []; });
        await waitMem(page, 'input');
        const f = await page.evaluate(() => window.__flashes);
        const on = [];
        const off = [];
        let last = null;
        f.forEach(([showing, t]) => {
          if (last && last[0] && !showing) on.push(t - last[1]);
          if (last && !last[0] && showing) off.push(t - last[1]);
          if (!last || last[0] !== showing) last = [showing, t];
        });
        equal(on.length >= want[round][0] - 1, true, 'flashes seen in round ' + (round + 1) + ': ' + on.length);
        on.forEach(ms => assert(Math.abs(ms - want[round][1]) < 90, 'round ' + (round + 1) + ' flash ' + Math.round(ms) + ' ms, want ' + want[round][1]));
        off.forEach(ms => assert(Math.abs(ms - want[round][2]) < 90, 'round ' + (round + 1) + ' gap ' + Math.round(ms) + ' ms, want ' + want[round][2]));
        equal((await mem(page)).masterSequence.length, 5);
        const seq = await answerRound(page);
        equal(seq.length, want[round][0]);
        if (round < 2) {
          await page.waitForFunction(() => TSI.pelagosi.debug.memory().phase === 'success');
          const overlay = await page.textContent('.tsi-pel-round-title');
          equal(overlay, ['ROUND I COMPLETE', 'ROUND II COMPLETE'][round]);
        }
      }
    });

    await check('winning makes the Marker sink, plays the cavern sound and tremor, then opens "The Marker Sinks"', async () => {
      await page.waitForFunction(() => TSI.pelagosi.debug.memory().phase === 'solved');
      equal(await text(page, 'stage'), 'The keystone returns');
      await page.waitForFunction(() => document.querySelector('[data-test=stage]').textContent === 'Something shifts below', null, { timeout: 5000 });
      assert((await plays(page)).includes('cavern-open.wav'), 'no cavern sound');
      assert(await page.$eval('[data-test=marker-frame]', e => e.classList.contains('tsi-pel-tremor')), 'no tremor');
      await page.waitForSelector('.tsi-modal', { timeout: 3000 });
      equal(await modalTitle(page), 'The Marker Sinks');
      await H.shot(page, 'pelagosi-marker-sinks');
    });

    await check('RUN THE TRIAL AGAIN starts a new trial at round I', async () => {
      await H.clickModal(page, 'RUN THE TRIAL AGAIN');
      await page.waitForFunction(() => TSI.pelagosi.debug.memory().roundIndex === 0 && TSI.pelagosi.debug.memory().phase === 'showing');
    });

    await check('a wrong rune causes the surge, shows the DC 12 Dexterity text, and restarts at round I', async () => {
      await waitMem(page, 'input');
      await answerWrong(page);
      equal(await text(page, 'stage'), 'The sea rejects the order');
      assert(/DC 12 Dexterity save/.test(await text(page, 'status')));
      assert(await page.$eval('[data-test=surge]', e => e.classList.contains('tsi-pel-active')), 'surge overlay');
      const before = await mem(page);
      await page.waitForFunction(() => TSI.pelagosi.debug.memory().phase === 'showing', null, { timeout: 3000 });
      const after = await mem(page);
      equal(after.roundIndex, 0);
      equal(after.runToken - before.runToken, 2, 'one restart (reset + new round)');
    });

    await check('a double-clicked rune still counts twice, as before (Harry\'s answer P3)', async () => {
      await waitMem(page, 'input');
      const first = (await mem(page)).masterSequence[0];
      await page.dblclick('[data-test=rune-' + first + ']');
      equal((await mem(page)).phase, 'failed');
    });

    await check('BEGIN during the sequence opens the rules while the sequence carries on, as before (PEL-16, kept)', async () => {
      await page.waitForFunction(() => TSI.pelagosi.debug.memory().phase === 'showing', null, { timeout: 4000 });
      await page.click('[data-test=begin]');
      await page.waitForSelector('.tsi-modal');
      await waitMem(page, 'input');
      await H.clickModal(page, 'Not Yet');
    });

    await check('leaving mid-trial asks first; Stay keeps you there', async () => {
      await page.click('[data-test=home]');
      await page.waitForSelector('.tsi-modal');
      equal(await modalTitle(page), 'Leave the Pelagosi Puzzle Trials?');
      assert(/This will end the memory trial in progress/.test(await page.textContent('.tsi-modal')));
      await H.clickModal(page, 'Stay');
      assert(/\?tool=pelagosi$/.test(page.url()));
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
      equal(context.log.failed, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The Marker Remembers: nothing left over (KNOWN_ISSUES PEL-02, 03, 04, 09, 10, 11)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openPel(page);

    async function winToEnding() {
      await startMemory(page);
      for (let round = 0; round < 3; round++) {
        await page.waitForFunction(r => TSI.pelagosi.debug.memory().roundIndex === r && TSI.pelagosi.debug.memory().phase === 'input', round, { timeout: 15000 });
        await answerRound(page);
      }
      await page.waitForFunction(() => TSI.pelagosi.debug.memory().phase === 'solved');
    }

    await check('PEL-02: Reset during the ending: no success window or cavern sound afterwards', async () => {
      await winToEnding();
      await page.waitForTimeout(600);
      await page.click('[data-test=reset]');
      const t0 = await page.evaluate(() => performance.now());
      await page.waitForTimeout(5500);
      equal(await modalOpen(page), false, 'a success window appeared');
      const late = await page.evaluate(t => window.__plays.filter(p => p.t > t && p.file === 'cavern-open.wav').length, t0);
      equal(late, 0, 'the cavern sound played after Reset');
      equal(await text(page, 'round-label'), 'Round 1 of 3');
    });

    await check('PEL-11: BEGIN then START during the ending: no success window over the new trial', async () => {
      await page.click('[data-test=reset]'); /* start clean */
      await winToEnding();
      await page.waitForTimeout(500);
      await startMemory(page);
      await page.waitForTimeout(5000);
      equal(await modalOpen(page), false);
    });

    await check('PEL-03: Reset in the pause between rounds doesn\'t skip to round II', async () => {
      await page.click('[data-test=reset]');
      await waitMem(page, 'input');
      await answerRound(page);
      await page.waitForFunction(() => TSI.pelagosi.debug.memory().phase === 'success');
      await page.click('[data-test=reset]');
      await page.waitForTimeout(2600);
      equal((await mem(page)).roundIndex, 0);
      equal(await text(page, 'round-label'), 'Round 1 of 3');
    });

    await check('PEL-04: Reset during the failure surge restarts once, not twice', async () => {
      await waitMem(page, 'input');
      await answerWrong(page);
      await page.waitForTimeout(300);
      await page.click('[data-test=reset]');
      const seq = (await mem(page)).masterSequence.join();
      await page.waitForTimeout(2200);
      equal((await mem(page)).masterSequence.join(), seq, 'the sequence was replaced a second time');
    });

    await check('PEL-09: switching away and back in the pause between rounds leaves it waiting for BEGIN', async () => {
      await waitMem(page, 'input');
      await answerRound(page);
      await page.waitForFunction(() => TSI.pelagosi.debug.memory().phase === 'success');
      await page.selectOption('[data-test=puzzle]', 'tidal');
      await page.selectOption('[data-test=puzzle]', 'memory');
      await page.waitForTimeout(3000);
      const m = await mem(page);
      equal([m.phase, m.started], ['idle', false]);
      equal(await page.$$eval('.tsi-pel-rune-btn', bs => bs.every(b => b.disabled)), true);
    });

    await check('PEL-10: switching away and back during the surge leaves it waiting for BEGIN', async () => {
      await startMemory(page);
      await waitMem(page, 'input');
      await answerWrong(page);
      await page.selectOption('[data-test=puzzle]', 'tidal');
      await page.selectOption('[data-test=puzzle]', 'memory');
      await page.waitForTimeout(2600);
      equal((await mem(page)).phase, 'idle');
    });

    await check('PEL-01: switching puzzle mid-sequence stops it: no more sounds, and the status isn\'t overwritten', async () => {
      await startMemory(page);
      await page.waitForTimeout(900);
      await page.selectOption('[data-test=puzzle]', 'tidal');
      const t0 = await page.evaluate(() => performance.now());
      await page.waitForTimeout(3000);
      equal(await page.evaluate(t => window.__plays.filter(p => p.t > t).length, t0), 0, 'sounds after switching');
      equal(await text(page, 'stage'), 'Awaiting the sequence');
      equal(await page.evaluate(() => TSI.pelagosi.debug.timers().memory), { timeouts: 0, frames: 0 });
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The Tidal Sequence: playing it through');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openPel(page);

    await check('BEGIN shows the six rules; START SEQUENCE wakes the chamber', async () => {
      await page.selectOption('[data-test=puzzle]', 'tidal');
      equal(await text(page, 'title'), 'The Tidal Sequence');
      await page.click('[data-test=begin]');
      await page.waitForSelector('.tsi-modal');
      equal(await modalTitle(page), 'How the Tidal Sequence works');
      equal(await page.$$eval('.tsi-modal ol li', li => li.length), 6);
      await H.clickModal(page, 'START SEQUENCE');
      equal(await text(page, 'stage'), 'The chamber wakes');
      equal(await page.$$eval('.tsi-pel-pillar-rune', bs => bs.some(b => b.disabled)), false);
    });

    /* Whether the pillars locked the moment the Surge hit. Read before the
       screenshot, which can take longer than the lock's 1.9 seconds. */
    let surgeLocked = null;
    await check('wrong checks raise the pressure Calm → Stirring → Rising → Reversing (DC 13 STR) → Surge (DC 14 DEX or 2d6)', async () => {
      equal(await text(page, 'pressure'), 'Calm');
      const steps = [
        ['Stirring', 'THE BASIN RIPPLES', 'The current fails to close.', /No damage yet/],
        ['Rising', 'THE WATER RISES', '0 of 4 pillars are fully aligned.', /ankle-deep/],
        ['Reversing', 'THE CURRENT REVERSES', '1 of 8 rune-or-direction alignments are correct.', /DC 13 STR save/],
        ['Surge', 'THE CHAMBER SURGES', '1 of 8 rune-or-direction alignments are correct.', /DC 14 DEX save or take 2d6 bludgeoning/]
      ];
      for (const [label, title, hint, effect] of steps) {
        await check_(page);
        equal(await text(page, 'pressure'), label);
        equal(await page.textContent('[data-test=event] p'), title);
        assert((await page.textContent('[data-test=event] span')).startsWith(hint), 'hint: ' + await page.textContent('[data-test=event] span'));
        assert(effect.test(await text(page, 'pressure-effect')), label + ' effect');
      }
      surgeLocked = (await tid(page)).locked;
      await H.shot(page, 'pelagosi-tidal-surge');
    });

    await check('the Surge locks the pillars, then resets them after about 2 seconds (attempts kept)', async () => {
      equal(surgeLocked, true, 'locked as the Surge hit');
      await page.waitForFunction(() => document.querySelector('[data-test=stage]').textContent === 'The chamber resets', null, { timeout: 3000 });
      const t = await tid(page);
      equal([t.pressure, t.attempts, t.locked, t.phase], [0, 4, false, 'outer']);
      equal(t.pillars, { topLeft: { runeIndex: 4, directionIndex: 0 }, topRight: { runeIndex: 5, directionIndex: 3 }, bottomRight: { runeIndex: 2, directionIndex: 2 }, bottomLeft: { runeIndex: 1, directionIndex: 1 } });
      equal(await text(page, 'pressure'), 'Calm');
    });

    await check('Shuffle Pillars moves them, but never to the answer', async () => {
      for (let i = 0; i < 5; i++) {
        await page.click('[data-test=shuffle]');
        equal(await page.evaluate(() => TSI.pelagosi.rules.isOuterSolved(TSI.pelagosi.debug.tidal().pillars)), false);
      }
      equal(await text(page, 'stage'), 'The pillars shuffle');
    });

    await check('a wrong check\'s pressure carries into the basin step, as before (Harry\'s answer P4)', async () => {
      await check_(page);
      equal((await tid(page)).pressure, 1);
      await solveOuter(page);
      await check_(page);
      const t = await tid(page);
      equal([t.phase, t.pressure], ['basin', 1]);
      equal(await page.textContent('[data-test=event] p'), 'THE OUTER CURRENT CLOSES');
      equal(await text(page, 'check'), 'ATTUNE BASIN');
      assert(await page.isVisible('[data-test=basin]'), 'basin should show');
      await check_(page); /* Anchor: wrong */
      equal((await tid(page)).pressure, 2);
      assert(/The basin rejects the chosen name/.test(await page.textContent('[data-test=event] span')));
    });

    await check('Current attunes the basin and "The Chamber Opens"', async () => {
      await setBasin(page, 'current');
      await check_(page);
      equal(await page.textContent('[data-test=event] p'), 'THE CURRENT COMPLETES');
      equal((await tid(page)).solved, true);
      await page.waitForFunction(() => document.querySelector('[data-test=stage]').textContent === 'Stone unlocks', null, { timeout: 4000 });
      assert((await plays(page)).includes('cavern-open.wav'), 'no cavern sound');
      await page.waitForSelector('.tsi-modal', { timeout: 3000 });
      equal(await modalTitle(page), 'The Chamber Opens');
      await H.shot(page, 'pelagosi-chamber-opens');
    });

    await check('RESET SEQUENCE puts it back to the start and shows the rules again', async () => {
      await H.clickModal(page, 'RESET SEQUENCE');
      await page.waitForSelector('.tsi-modal');
      equal(await modalTitle(page), 'How the Tidal Sequence works');
      equal((await tid(page)).phase, 'idle');
      await H.clickModal(page, 'Not Yet');
    });

    await check('the five sounds still to come are never asked for (P2)', async () => {
      const asked = context.log.failed.concat(context.log.aborted, await plays(page)).filter(u => MISSING_SOUNDS.some(m => u.includes(m)));
      equal(asked, []);
    });

    await check('no errors on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
      equal(context.log.failed, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The Tidal Sequence: double clicks and leftovers (KNOWN_ISSUES PEL-05, 06, 07, 10, 11)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openPel(page);
    await startTidal(page);

    await check('PEL-07: a double click on Check on a wrong layout counts once', async () => {
      await page.waitForTimeout(650);
      await page.dblclick('[data-test=check]');
      const t = await tid(page);
      equal([t.pressure, t.attempts], [1, 1]);
    });

    await check('PEL-07: a double click on Check on the right layout opens the basin, and nothing more', async () => {
      await page.waitForTimeout(2000);
      await solveOuter(page);
      await page.waitForTimeout(650);
      await page.dblclick('[data-test=check]');
      const t = await tid(page);
      equal([t.phase, t.pressure, t.attempts], ['basin', 1, 2]);
    });

    async function toSurge() {
      await page.click('[data-test=reset]');
      await page.click('[data-test=begin]');
      await H.clickModal(page, 'START SEQUENCE');
      for (let i = 0; i < 4; i++) await check_(page);
      equal((await tid(page)).pressure, 4);
    }

    await check('PEL-05: Reset during the surge stays reset (the pillars don\'t unlock by themselves)', async () => {
      await toSurge();
      await page.click('[data-test=reset]');
      await page.waitForTimeout(2600);
      const t = await tid(page);
      equal([t.phase, t.locked, t.started], ['idle', true, false]);
      equal(await page.$$eval('.tsi-pel-pillar-rune', bs => bs.every(b => b.disabled)), true);
    });

    await check('PEL-10: switching away and back during the surge stays waiting for BEGIN', async () => {
      await toSurge();
      await page.selectOption('[data-test=puzzle]', 'memory');
      await page.selectOption('[data-test=puzzle]', 'tidal');
      await page.waitForTimeout(2600);
      equal((await tid(page)).phase, 'idle');
    });

    async function toEnding() {
      await page.click('[data-test=reset]');
      await page.click('[data-test=begin]');
      await H.clickModal(page, 'START SEQUENCE');
      await solveOuter(page);
      await check_(page);
      await setBasin(page, 'current');
      await check_(page);
      equal((await tid(page)).solved, true);
    }

    await check('PEL-06: Reset during the ending: no "Chamber Opens" window or cavern sound afterwards', async () => {
      await toEnding();
      await page.waitForTimeout(500);
      await page.click('[data-test=reset]');
      const t0 = await page.evaluate(() => performance.now());
      await page.waitForTimeout(4200);
      equal(await modalOpen(page), false);
      equal(await page.evaluate(t => window.__plays.filter(p => p.t > t).length, t0), 0, 'sounds after Reset');
      equal(await text(page, 'stage'), 'Awaiting the sequence');
    });

    await check('PEL-11: BEGIN then START during the ending: no window pops up over the restarted puzzle', async () => {
      await toEnding();
      await page.waitForTimeout(500);
      await page.click('[data-test=begin]');
      await H.clickModal(page, 'START SEQUENCE');
      await page.waitForTimeout(4000);
      equal(await modalOpen(page), false);
      equal((await tid(page)).phase, 'outer');
    });

    await check('leaving mid-sequence asks first', async () => {
      await page.click('[data-test=home]');
      await page.waitForSelector('.tsi-modal');
      assert(/This will end the Tidal Sequence in progress/.test(await page.textContent('.tsi-modal')));
      await Promise.all([page.waitForURL(/index\.html$/), H.clickModal(page, 'Leave')]);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Shutting down cleanly');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openPel(page);
    await check('closing the tool mid-sequence stops every timer, sound and listener', async () => {
      await startMemory(page);
      await page.waitForTimeout(900);
      await page.evaluate(() => TSI.shell.stopTool());
      const t0 = await page.evaluate(() => performance.now());
      equal(await page.evaluate(() => TSI.shell.current().life.counts()), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
      await page.waitForTimeout(2500);
      equal(await page.evaluate(t => window.__plays.filter(p => p.t > t).length, t0), 0);
      const shown = await page.$eval('.tsi-pel-display', e => e.className);
      await page.waitForTimeout(1000);
      equal(await page.$eval('.tsi-pel-display', e => e.className), shown, 'the display kept changing');
    });
    await context.close();
  }

  {
    const { context, page } = await newPage(browser, 'laptop', { reducedMotion: 'reduce' });
    await openPel(page);
    await check('with "reduce motion" on, the shakes and flashes are gentler and the drifting light slower', async () => {
      const r = await page.evaluate(() => {
        const f = document.querySelector('[data-test=marker-frame]');
        f.classList.add('tsi-pel-shake');
        const shake = getComputedStyle(f).animationName;
        f.classList.remove('tsi-pel-shake');
        const drift = getComputedStyle(document.querySelector('.tsi-pel-ambient')).animationDuration;
        return { shake, drift };
      });
      equal(r.shake, 'tsi-pel-shake-soft');
      equal(r.drift, '45s');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Faithful to the old tool' + (HAS_LEGACY ? '' : ' (skipped: _legacy/pelagosi_marker_rune_puzzle is missing)'));
  if (HAS_LEGACY) {
    const { context, page } = await newPage(browser, 'laptop');
    await context.setOffline(false);
    const old = await context.newPage();
    await old.goto(LEGACY);
    await old.waitForSelector('#beginButton');
    await openPel(page);

    const seeded = `(seed => { let s = seed >>> 0; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })`;

    await check('the Memory sequence is built exactly as the old tool built it, given the same dice', async () => {
      for (let seed = 1; seed <= 300; seed++) {
        const a = await old.evaluate(`${seeded}(${seed}); buildMasterSequence(5).join()`);
        const b = await page.evaluate(`${seeded}(${seed}); TSI.pelagosi.rules.buildMasterSequence().join()`);
        if (a !== b) throw new Error('seed ' + seed + ': ' + a + ' vs ' + b);
      }
    });

    await check('the Tidal counts and checks agree with the old tool on 500 random layouts', async () => {
      for (let seed = 1; seed <= 500; seed++) {
        const layout = await page.evaluate(`${seeded}(${seed}); (() => { const T = window.TSI_DATA.pelagosi.tidal; const o = {}; T.pillarOrder.forEach(id => { o[id] = { runeIndex: Math.floor(Math.random() * 6), directionIndex: Math.floor(Math.random() * 4) }; }); return o; })()`);
        const a = await old.evaluate(l => { tidalState.pillars = l; return [getTidalCorrectCount(), getTidalCompletePillarCount(), isTidalOuterSolved()]; }, layout);
        const b = await page.evaluate(l => { const R = TSI.pelagosi.rules; return [R.correctCount(l), R.completePillarCount(l), R.isOuterSolved(l)]; }, layout);
        equal(b, a, 'seed ' + seed);
      }
    });

    /* Read what each tool is showing. */
    const oldView = () => old.evaluate(() => ({
      stage: stageLabel.textContent, status: statusText.textContent, clue: clueText.textContent,
      desc: document.getElementById('tidalDescription').textContent, attempts: document.getElementById('tidalAttemptLabel').textContent,
      pressure: document.getElementById('pressureLabel').textContent, effect: document.getElementById('pressureEffect').textContent,
      event: document.getElementById('tidalEventTitle').textContent + ' | ' + document.getElementById('tidalEventText').textContent,
      check: document.getElementById('checkTidalButton').textContent,
      pillars: JSON.stringify(tidalState.pillars), basin: tidalState.basinRuneIndex
    }));
    const newView = () => page.evaluate(() => {
      const q = s => document.querySelector('[data-test=' + s + ']').textContent;
      const t = TSI.pelagosi.debug.tidal();
      return {
        stage: q('stage'), status: q('status'), clue: q('clue'), desc: q('tidal-description'), attempts: q('attempts'),
        pressure: q('pressure'), effect: q('pressure-effect'),
        event: document.querySelector('[data-test=event] p').textContent + ' | ' + document.querySelector('[data-test=event] span').textContent,
        check: q('check'), pillars: JSON.stringify(t.pillars), basin: t.basinRuneIndex
      };
    });
    /* Some globals in the old page have other names; give them short handles. */
    await old.evaluate(() => { window.stageLabel = document.getElementById('stageLabel'); window.statusText = document.getElementById('statusText'); window.clueText = document.getElementById('clueText'); });

    await check('a whole Tidal session shows the same texts, step by step, as the old tool', async () => {
      const steps = [
        ['start', async p => { await p.click(p === old ? '#beginButton' : '[data-test=begin]'); if (p === old) await old.click('#startTidalButton'); else await H.clickModal(page, 'START SEQUENCE'); }],
        ['wrong check 1', async p => { await p.waitForTimeout(650); await p.click(p === old ? '#checkTidalButton' : '[data-test=check]'); }],
        ['turn a rune', async p => { await p.click(p === old ? '.tidal-rune-button[data-pillar=topLeft]' : '[data-test=pillar-rune-topLeft]'); }],
        ['turn an arrow', async p => { await p.click(p === old ? '.tidal-arrow-button[data-pillar=topRight]' : '[data-test=pillar-arrow-topRight]'); }],
        ['wrong check 2', async p => { await p.waitForTimeout(650); await p.click(p === old ? '#checkTidalButton' : '[data-test=check]'); }],
        ['wrong check 3', async p => { await p.waitForTimeout(650); await p.click(p === old ? '#checkTidalButton' : '[data-test=check]'); }],
        ['wrong check 4 (surge)', async p => { await p.waitForTimeout(650); await p.click(p === old ? '#checkTidalButton' : '[data-test=check]'); }],
        ['after the surge', async p => { await p.waitForTimeout(2200); }]
      ];
      /* Switch the old tool to the Tidal puzzle first. */
      await old.selectOption('#puzzleSelect', 'tidal');
      await page.selectOption('[data-test=puzzle]', 'tidal');
      for (const [name, act] of steps) {
        await act(old);
        await act(page);
        const a = await oldView();
        const b = await newView();
        Object.keys(a).forEach(k => {
          if (k === 'event' && name === 'after the surge') return; /* the banner text stays behind hidden in both */
          equal(b[k], a[k], name + ' → ' + k);
        });
      }
    });

    await check('the Memory trial shows the same texts as the old tool at each step, given the same dice', async () => {
      const view = (p, isOld) => p.evaluate(isOld => {
        const g = id => document.getElementById(id).textContent;
        if (isOld) return { stage: g('stageLabel'), status: g('statusText'), caption: g('memoryCaption'), round: g('roundLabel'), desc: g('roundDescription'), clue: g('clueText'), seq: memoryState.masterSequence.join() };
        const q = s => document.querySelector('[data-test=' + s + ']').textContent;
        return { stage: q('stage'), status: q('status'), caption: q('caption'), round: q('round-label'), desc: document.querySelector('.tsi-pel-stage--memory .tsi-pel-console-main .tsi-pel-copy').textContent, clue: q('clue'), seq: TSI.pelagosi.debug.memory().masterSequence.join() };
      }, isOld);
      await old.selectOption('#puzzleSelect', 'memory');
      await page.selectOption('[data-test=puzzle]', 'memory');
      equal(await view(page, false), await view(old, true), 'idle');
      await old.click('#beginButton');
      await page.click('[data-test=begin]');
      await old.evaluate(`${seeded}(42)`);
      await page.evaluate(`${seeded}(42)`);
      await old.click('#startTrialButton');
      await H.clickModal(page, 'START TRIAL');
      await old.waitForFunction(() => memoryState.phase === 'input');
      await waitMem(page, 'input');
      equal(await view(page, false), await view(old, true), 'reply');
      const seq = (await mem(page)).masterSequence.slice(0, 3);
      for (const r of seq) {
        await old.click('.memory-rune-button[data-rune=' + r + ']');
        await page.click('[data-test=rune-' + r + ']');
      }
      equal(await view(page, false), await view(old, true), 'round I won');
      await old.waitForFunction(() => memoryState.phase === 'input');
      await waitMem(page, 'input');
      const wrong = ['anchor', 'tide', 'depth', 'life', 'remains'].find(r => r !== seq[0]);
      await old.click('.memory-rune-button[data-rune=' + wrong + ']');
      await page.click('[data-test=rune-' + wrong + ']');
      const a = await view(old, true);
      const b = await view(page, false);
      delete a.seq; delete b.seq;
      equal(b, a, 'wrong reply');
    });
    await context.close();
  }

  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(2);
});
