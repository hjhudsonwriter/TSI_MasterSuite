/* Cue buttons in the DM doc's Quest box, the Cast list and the table log (guide 1, 4 November 2026), from files with the internet off,
   at the laptop and the TV. The test text is tests/fixtures/absent-tide-flow.txt (Harry's Session 4 Flow with tags added).
   Checks: tags become buttons in Read and the text is untouched in Edit; a card, a cast tag and {hide} act on the players' window;
   a misspelt tag shows what is wrong and does nothing; the card on the TV is lit; the Cast list shows a name card and nothing of the
   voice line's words or the note reaches the TV; the find box; a click in the pop-out DM doc makes the Explorer act once (and a
   quick double click once); with no Explorer open the DM doc says so; Make camp asks first; the table log.
   Run with:  node tests/e2e/cue-buttons.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const FIXTURE = fs.readFileSync(path.join(H.ROOT, 'tests/fixtures/absent-tide-flow.txt'), 'utf8');
const tv = page => page.evaluate(() => TSI.explorer.debug.scene());
const read = page => page.$$eval('[data-test=dmdoc-quest-read] [data-test^=cue-]', n => n.length);

async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  return pv;
}
async function setText(page, text) {
  await page.click('[data-test=dmdoc-quest-mode-edit]');
  await page.fill('[data-test=dmdoc-quest-text]', text);
  await page.click('[data-test=dmdoc-quest-mode-read]');
}
async function boot(browser, name, size) {
  const context = await H.newContext(browser, name, { questMode: 'default' });
  await context.setOffline(true);
  await context.addInitScript(() => { window.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.tsi-notice{display:none!important}'; document.head.appendChild(s); }); });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(EXPLORER);
  await page.waitForSelector('[data-test=camp]');
  await page.selectOption('[data-test=map-select]', 'the_east_isle');
  await page.click('[data-test=load]');
  await page.waitForTimeout(400);
  await page.evaluate(() => { TSI.explorer.debug.state().travel.nextTravelEventAtMiles = 999; });
  const pv = await openPlayer(page, size);
  await page.click('[data-test=dm-doc]');
  await page.waitForSelector('[data-test=dmdoc-quest-text]', { state: 'attached' });
  return { context, page, pv, errors };
}

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Cue buttons at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const { context, page, pv, errors } = await boot(browser, name, size);

    await check('Edit shows the raw text; Read shows each tag as a button, and the stored text never changes', async () => {
      await page.click('[data-test=dmdoc-quest-mode-edit]');
      await page.fill('[data-test=dmdoc-quest-text]', FIXTURE);
      await page.click('[data-test=dmdoc-quest-mode-read]');
      equal(await page.isVisible('[data-test=dmdoc-quest-text]'), false);
      equal(await page.isVisible('[data-test=dmdoc-quest-read]'), true);
      equal(await page.$$eval('[data-test=dmdoc-quest-read] [data-test=cue-card]', n => n.length), 8, '8 card buttons');
      equal(await page.$$eval('[data-test=dmdoc-quest-read] [data-test=cue-cast]', n => n.length), 6, '6 cast buttons');
      equal(await page.$$eval('[data-test=dmdoc-quest-read] [data-test=cue-hide]', n => n.length), 1);
      equal(await page.$$eval('[data-test=dmdoc-quest-read] [data-test=cue-puzzle]', n => n.length), 1);
      equal(await page.$$eval('[data-test=dmdoc-quest-read] [data-test=cue-bad]', n => n.length), 0, 'no broken tags in Harry\'s text');
      assert((await page.textContent('[data-test=dmdoc-quest-read]')).includes('Where we left off'), 'the text is there between the buttons');
      await page.click('[data-test=dmdoc-quest-mode-edit]');
      equal(await page.inputValue('[data-test=dmdoc-quest-text]'), FIXTURE, 'the raw text is exactly what was put in');
      await page.waitForTimeout(700);
      await page.click('[data-test=dmdoc-quest-mode-read]');
    });

    await check('a card button puts that card on the players\' window, and it is lit for the DM', async () => {
      await page.click('[data-test=dmdoc-quest-read] button[data-tag="{card: act1/letter}"]');
      await page.waitForFunction(() => { const s = TSI.explorer.debug.scene(); return s && /04-letter/.test(s.src); });
      await pv.waitForSelector('[data-test=pv-scene-image]', { timeout: 8000 });
      assert((await pv.$eval('[data-test=pv-scene-image]', i => i.getAttribute('src'))).includes('04-letter'));
      assert(await page.$eval('button[data-tag="{card: act1/letter}"]', b => b.classList.contains('is-live')), 'lit');
      equal(await page.$$eval('[data-test=dmdoc-quest-read] .is-live', n => n.length), 1, 'only that one');
    });

    await check('a cast button shows the portrait with the name only; the voice line\'s words and the note never reach the players\' window', async () => {
      await page.click('button[data-tag="{cast: dren-marr}"]');
      await page.waitForFunction(() => { const s = TSI.explorer.debug.scene(); return s && s.kind === 'portrait' && s.name === 'Dren Marr'; });
      const sc = await tv(page);
      equal(Object.keys(sc).sort(), ['caption', 'kind', 'loop', 'name', 'overlays', 'poster', 'src', 'subtitle']);
      equal(sc.subtitle, '');
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-scene-name]') && /Dren Marr/.test(document.body.innerText));
      const html = await pv.evaluate(() => document.documentElement.outerHTML);
      assert(!/mind the sand/.test(html) && !/wyvern people/.test(html), 'no voice line words on the TV');
      assert(await page.$eval('button[data-tag="{cast: dren-marr}"]', b => b.classList.contains('is-live')));
    });

    await check('{hide} clears the TV back to the map', async () => {
      await page.click('[data-test=dmdoc-quest-read] button[data-tag="{hide}"]');
      await page.waitForFunction(() => TSI.explorer.debug.scene() === null);
      equal(await page.$$eval('[data-test=dmdoc-quest-read] .is-live', n => n.length), 0);
    });

    await check('the Cast list shows a name card for someone with no picture (Maerys Vell), with no secrets', async () => {
      await page.evaluate(() => TSI.dmDoc.close());
      await page.click('[data-test=cast-open]');
      await page.fill('[data-test=cast-search]', 'maerys');
      equal(await page.$$eval('[data-test=cast-list] li.tsi-exp-cast-item', n => n.length), 1);
      assert((await page.textContent('[data-test=cast-item-maerys-vell]')).includes('{cast: maerys-vell}'), 'the tag to copy');
      await page.click('[data-test=cast-show-maerys-vell]');
      await page.waitForFunction(() => { const s = TSI.explorer.debug.scene(); return s && s.kind === 'namecard' && s.name === 'Maerys Vell'; });
      await pv.waitForSelector('[data-test=pv-scene-namecard]', { timeout: 8000 });
      equal((await pv.textContent('[data-test=pv-scene-namecard]')).trim(), 'Maerys Vell');
      const font = await pv.$eval('.tsi-xpv-sc__namecard-text', e => getComputedStyle(e).fontFamily);
      assert(/cinzel/i.test(font), 'Cinzel: ' + font);
      await H.shot(pv, 'cue-namecard-' + name);
      await page.fill('[data-test=cast-search]', '');
      equal(await page.$$eval('[data-test=cast-list] li.tsi-exp-cast-item', n => n.length), 13);
      await page.click('[data-test=cast-hide]');
      await page.waitForFunction(() => TSI.explorer.debug.scene() === null);
      await page.keyboard.press('Escape');
      await page.evaluate(() => TSI.dmDoc.open());
    });

    await check('a misspelt or unknown tag shows what is wrong, says what it meant, and does nothing when clicked', async () => {
      await setText(page, 'Oops {card: act1/leter} and {cast: nobody} and {wibble}');
      equal(await page.$$eval('[data-test=cue-bad]', n => n.length), 3);
      const texts = await page.$$eval('[data-test=cue-bad]', n => n.map(x => x.textContent));
      assert(/no card act1\/leter: did you mean act1\/letter\?/.test(texts[0]), texts[0]);
      assert(/no cast member nobody/.test(texts[1]), texts[1]);
      assert(/unknown tag/.test(texts[2]), texts[2]);
      for (const n of await page.$$('[data-test=cue-bad]')) await n.click();
      await page.waitForTimeout(400);
      equal(await tv(page), null, 'nothing went on the TV');
      equal(errors, [], 'no page errors');
      equal((await page.evaluate(() => TSI.explorer.debug.cues())).length > 0, true);
    });

    await check('{clue} and {recap} show greyed ("coming") and do nothing', async () => {
      await setText(page, 'x {clue: a wet letter} y {recap}');
      equal(await page.$$eval('[data-test=cue-soon]', n => n.map(x => x.textContent)), ['clue (coming)', 'recap (coming)']);
    });

    await check('the find box: 4.4 jumps to the scene heading first, and the next match follows', async () => {
      await setText(page, FIXTURE);
      await page.fill('[data-test=dmdoc-quest-find]', '4.4');
      const c = await page.textContent('[data-test=dmdoc-quest-findcount]');
      assert(/^1 of \d+$/.test(c), c);
      const ctx = await page.$eval('[data-test=dmdoc-quest-mark]', m => ({ before: m.previousSibling ? m.previousSibling.textContent.slice(-1) : '\n', after: m.nextSibling ? m.nextSibling.textContent.slice(0, 20) : '' }));
      equal(ctx.before, '\n', 'at the start of a line');
      assert(ctx.after.startsWith(' The liaison'), ctx.after);
      const inView = await page.$eval('[data-test=dmdoc-quest-mark]', m => { const r = m.getBoundingClientRect(), h = document.querySelector('[data-test=dmdoc-quest-read]').getBoundingClientRect(); return r.top >= h.top - 1 && r.bottom <= h.bottom + 1; });
      assert(inView, 'scrolled into view');
      await page.fill('[data-test=dmdoc-quest-find]', 'zzzzz');
      equal(await page.textContent('[data-test=dmdoc-quest-findcount]'), 'No match');
      await page.fill('[data-test=dmdoc-quest-find]', '');
    });

    await check('{camp} asks first: Cancel passes no day; Make camp passes one and the table log notes it', async () => {
      await setText(page, 'Night falls {camp}');
      const day = () => page.evaluate(() => TSI.explorer.debug.state().travel.day);
      const d0 = await day();
      await page.click('button[data-tag="{camp}"]');
      await page.waitForSelector('.tsi-modal');
      assert((await page.textContent('.tsi-modal')).includes('Make camp now?'));
      await H.clickModal(page, 'Cancel');
      await page.waitForTimeout(500);
      equal(await day(), d0, 'no day passed');
      await page.waitForTimeout(800);
      await page.click('button[data-tag="{camp}"]');
      await page.waitForSelector('.tsi-modal');
      await H.clickModal(page, 'Make camp');
      await page.waitForFunction(d => TSI.explorer.debug.state().travel.day === d + 1, d0, { timeout: 15000 });
      for (let k = 0; k < 8 && await page.$('.tsi-modal'); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
      const log = await page.evaluate(() => TSI.tablelog.all());
      assert(log.some(e => e.kind === 'camp'), JSON.stringify(log));
    });

    await check('the table log holds what the players were shown (card, cast, camp), with no DM notes, and End session leaves a marker', async () => {
      const log = await page.evaluate(() => TSI.tablelog.all());
      assert(log.some(e => e.kind === 'card' && e.ref === 'act1/letter' && /04-letter/.test(e.image)), 'the letter');
      assert(log.some(e => e.kind === 'cast' && e.ref === 'dren-marr' && e.label === 'Dren Marr'), 'Dren');
      assert(log.some(e => e.kind === 'cast' && e.ref === 'maerys-vell'), 'Maerys');
      log.forEach(e => equal(Object.keys(e).sort(), ['at', 'day', 'image', 'kind', 'label', 'ref']));
      await page.evaluate(() => TSI.tablelog.endSession());
      equal((await page.evaluate(() => TSI.tablelog.sinceLastSession())).length, 0);
    });

    await check('the Quest box fits the window (no sideways scroll) with the new controls', async () => {
      const lay = await H.layoutCheck(page, ['[data-test=dmdoc-quest-find]', '[data-test=dmdoc-quest-mode-read]']);
      equal(lay.scrollWidth <= lay.clientWidth, true);
      equal(lay.outOfView, []);
      await H.shot(page, 'cue-quest-' + name);
    });

    await context.close();
  }

  section('The pop-out DM doc, with the Explorer in another window');
  {
    const { context, page, pv, errors } = await boot(browser, 'popout', { width: 1707, height: 930 });
    await page.evaluate(() => TSI.dmDoc.close());
    await page.click('[data-test=dm-doc]');
    await page.click('[data-test=dmdoc-quest-mode-edit]');
    await page.fill('[data-test=dmdoc-quest-text]', FIXTURE);
    await page.waitForTimeout(900);
    await page.evaluate(() => TSI.store.flush());
    const [pop] = await Promise.all([context.waitForEvent('page'), page.click('[data-test=dmdoc-popout]')]);
    await pop.setViewportSize({ width: 1100, height: 760 });
    await pop.waitForSelector('[data-test=dmdoc-quest-read]:not([hidden])', { timeout: 10000 });   // Read is the first view once there is text

    await check('a card clicked in the pop-out makes the Explorer window show it, once; a quick second click is the same cue', async () => {
      const before = (await page.evaluate(() => TSI.explorer.debug.cues())).length;
      await pop.click('button[data-tag="{card: act1/inside}"]');
      await pop.click('button[data-tag="{card: act1/inside}"]');
      await page.waitForFunction(() => { const s = TSI.explorer.debug.scene(); return s && /02-inside/.test(s.src); }, null, { timeout: 8000 });
      await pv.waitForSelector('[data-test=pv-scene-image]', { timeout: 8000 });
      await page.waitForTimeout(600);
      equal((await page.evaluate(() => TSI.explorer.debug.cues())).length - before, 1, 'carried out exactly once');
      const log = await page.evaluate(() => TSI.tablelog.all());
      equal(log.filter(e => e.ref === 'act1/inside').length, 1, 'one log entry');
      await page.waitForFunction(() => document.querySelector('[data-test=dmdoc-quest-read]') === null || true);
      // the pop-out lights the live card too
      await pop.waitForFunction(() => document.querySelector('button[data-tag="{card: act1/inside}"].is-live'), null, { timeout: 5000 });
      equal(errors, []);
    });

    await check('{hide} from the pop-out clears the TV; a cast tag from the pop-out shows the portrait', async () => {
      await pop.click('button[data-tag="{cast: linnet}"]');
      await page.waitForFunction(() => { const s = TSI.explorer.debug.scene(); return s && s.name === 'Linnet'; }, null, { timeout: 8000 });
      await pop.waitForTimeout(800);
      await pop.click('button[data-tag="{hide}"]');
      await page.waitForFunction(() => TSI.explorer.debug.scene() === null, null, { timeout: 8000 });
    });

    await check('{puzzle: tidal} in the pop-out asks, then opens the Puzzle Trials in a new window on the tidal puzzle', async () => {
      await pop.click('button[data-tag="{puzzle: tidal}"]');
      await pop.waitForSelector('.tsi-modal');
      assert((await pop.textContent('.tsi-modal')).includes('Puzzle Trials'));
      const [win] = await Promise.all([context.waitForEvent('page'), H.clickModal(pop, 'Open')]);
      await win.waitForSelector('[data-test=puzzle]', { timeout: 15000 });
      equal(await win.inputValue('[data-test=puzzle]'), 'tidal');
      await win.close();
    });

    await context.close();
  }

  section('Pop-out DM doc with no Explorer open anywhere');
  {
    const context = await H.newContext(browser, 'laptop', { questMode: 'default' });
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(H.fileUrl('index.html') + '?dmdoc=1');
    await page.waitForSelector('[data-test=dmdoc-quest-text]', { state: 'attached', timeout: 10000 });
    await check('it says there is nowhere to show the cue, and offers to open the Explorer', async () => {
      await setText(page, 'Hush {hide}');
      await page.click('button[data-tag="{hide}"]');
      await page.waitForSelector('[data-test=dmdoc-cue-action]');
      assert((await page.textContent('[data-test=dmdoc-cue-msg]')).includes('Explorer is not open'));
      equal((await page.textContent('[data-test=dmdoc-cue-action]')).trim(), 'Open the Explorer');
    });
    await context.close();
  }

  await browser.close();
  H.summary();
})().catch(e => { console.error(e); process.exit(1); });
