/* The Absent Tide scene decks (28 October 2026; docs/ABSENT-TIDE-SCENE-DECKS.md, parts B and C): from a double-clicked
   index.html with the internet off, the DM queues a deck from the Force Main Campaign Event list, sees every card as a
   thumbnail, and shows any card on the TV in any order. A portrait's voice line plays from the DM's window only.
   Files that are not there yet are warnings, never failures.
   Run:  node tests/e2e/absent-tide-decks.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const sceneText = pv => pv.evaluate(() => document.querySelector('[data-test=pv-scene]').innerText.replace(/\s+/g, ' ').trim());
const deck = page => page.evaluate(() => { const d = TSI.explorer.debug.deck(); return d && { cur: d.cur(), status: d.status(), voice: d.voice() }; });
const tvScene = page => page.evaluate(() => TSI.explorer.debug.scene());

/* The files the decks name that are not in the repo yet: a warning, since uploads may still be arriving. */
function missingFiles() {
  const code = fs.readFileSync(path.join(H.ROOT, 'tools/explorer/data/absent-tide-scenes.js'), 'utf8');
  const A = 'tools/explorer/assets/absent-tide/';
  const found = new Set((code.match(/(?:A \+ )?'((?:act\d|portraits|voice)\/[^']+)'/g) || []).map(m => A + m.replace(/^A \+ /, '').replace(/'/g, '')));
  (code.match(/(?:portrait)\('([a-z-]+)'/g) || []).forEach(m => { const f = m.match(/'([a-z-]+)'/)[1]; found.add(A + 'portraits/' + f + '.png'); found.add(A + 'voice/' + f + '.mp3'); });
  return [...found].filter(f => /\.(png|mp4|mp3)$/.test(f)).filter(f => !fs.existsSync(path.join(H.ROOT, f)));
}

async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected');
  return pv;
}
async function setup(browser, name, extra, routes) {
  const context = await H.newContext(browser, name, extra);
  await context.setOffline(true);
  (routes || []).forEach(r => context.route(r, route => route.abort()));
  const page = await context.newPage();
  await page.goto(EXPLORER);
  await page.waitForSelector('[data-test=camp]');
  await page.selectOption('[data-test=map-select]', 'the_east_isle');
  await page.click('[data-test=load]');
  await page.waitForTimeout(300);
  return { context, page };
}
async function queue(page, id) {
  await page.selectOption('[data-test=main-select]', id);
  await page.click('[data-test=queue]');
}
async function closeDeck(page) {
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-test=deck-list]', { state: 'detached', timeout: 4000 });
}

(async () => {
  const missing = missingFiles();
  if (missing.length) console.log('  WARNING: ' + missing.length + ' file(s) named in the decks are not in the repo yet (shown as "file missing"): ' + missing.join(', '));
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Scene decks at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const { context, page } = await setup(browser, name);
    const pv = await openPlayer(page, size);

    await check('the decks are in the Force Main Campaign Event list under "The Absent Tide"; the two older events are still listed first', async () => {
      const groups = await page.$$eval('[data-test=main-select] optgroup', g => g.map(x => [x.label, [...x.querySelectorAll('option')].map(o => o.textContent)]));
      equal(groups, [['The Absent Tide', ['Act 1: Tidepool House', 'Act 2: Swyth after the silence', 'Act 4: Middlemount', 'Act 5: The Archive door']]]);
      equal(await page.$$eval('[data-test=main-select] > option', o => o.map(x => x.textContent)), ['Force Main Campaign Event…', 'The Tide Remembers - Prologue', 'The Turning Tide']);
    });

    await check('Act 2 opens with a numbered list of three cards and nothing on the TV (the party chooses its stops)', async () => {
      await queue(page, 'absent_tide_act2');
      await page.waitForSelector('[data-test=deck-list]');
      equal(await page.$$eval('[data-test=deck-list] li', l => l.length), 3);
      equal(await page.$$eval('.tsi-exp-deck-name', n => n.map(x => x.textContent)), ['Dren Marr', 'Captain Seris Thane', 'Linnet']);
      equal(await tvScene(page), null);
      equal(await pv.isHidden('[data-test=pv-scene]'), true);
      await H.shot(page, 'deck-popup-' + name);
    });

    await check('clicking the Seris card shows it on the TV with its name and nothing else, and plays her voice line from this window', async () => {
      await page.click('[data-test=deck-card-1]');
      await pv.waitForSelector('[data-test=pv-scene].is-up', { timeout: 4000 });
      await pv.waitForFunction(() => { const i = document.querySelector('.tsi-xpv-sc__card.is-front [data-test=pv-scene-image]'); return i && i.complete && i.naturalWidth > 0; });
      equal(await sceneText(pv), 'Captain Seris Thane');
      await page.waitForFunction(() => { const d = TSI.explorer.debug.deck(); return d && d.voice() && /voice\/seris-thane\.mp3$/.test(d.voice().src) && !d.voice().paused; }, null, { timeout: 5000 });
      equal(await pv.$$eval('audio, video', n => n.filter(x => x.closest('.tsi-xpv-sc') && !x.paused).length), 0, 'no sound or film in the TV window');
      equal(await pv.$$eval('audio', n => n.length), 0);
      await H.shot(pv, 'deck-tv-seris-' + name);
    });

    await check('choosing another card stops the first voice line and plays only the new one', async () => {
      await page.click('[data-test=deck-card-0]');
      await page.waitForFunction(() => { const d = TSI.explorer.debug.deck(); return d.voice() && /dren-marr/.test(d.voice().src) && !d.voice().paused; }, null, { timeout: 5000 });
      await pv.waitForFunction(() => document.querySelector('.tsi-xpv-sc__card.is-front [data-test=pv-scene-name]').textContent === 'Dren Marr');
    });

    await check('Hide (back to the map) clears the TV, stops the voice and leaves the deck open', async () => {
      await page.click('[data-test=deck-hide]');
      await pv.waitForSelector('[data-test=pv-scene]', { state: 'hidden', timeout: 4000 });
      equal((await deck(page)).voice.paused, true);
      equal(await page.isVisible('[data-test=deck-list]'), true);
      equal(await tvScene(page), null);
    });

    await check('after Hide, Next carries on from the card the DM was at; Previous steps back; the current card is highlighted', async () => {
      equal((await deck(page)).cur, 0);
      await page.click('[data-test=deck-next]');
      equal((await deck(page)).cur, 1);
      await page.click('[data-test=deck-next]');
      equal((await deck(page)).cur, 2);
      await page.click('[data-test=deck-prev]');
      equal((await deck(page)).cur, 1);
      equal(await page.$eval('[data-test=deck-card-1]', b => b.classList.contains('is-current') && b.getAttribute('aria-current')), 'true');
    });

    await check('"Auto-play voice lines" is remembered, and with it off a card shows without sound; Play voice line plays it', async () => {
      await page.uncheck('[data-test=deck-autoplay]');
      await page.click('[data-test=deck-card-2]');
      await page.waitForTimeout(500);
      equal((await deck(page)).voice.paused, true);
      await page.click('[data-test=deck-voice]');
      await page.waitForFunction(() => !TSI.explorer.debug.deck().voice().paused, null, { timeout: 5000 });
      equal(await page.evaluate(() => window.localStorage.getItem('tsi.explorer.autoplayVoice')), '0');
      await page.check('[data-test=deck-autoplay]');
      equal(await page.evaluate(() => window.localStorage.getItem('tsi.explorer.autoplayVoice')), '1');
    });

    await check('Esc closes the deck: the TV returns to the map and the voice is stopped and let go', async () => {
      await closeDeck(page);
      await pv.waitForSelector('[data-test=pv-scene]', { state: 'hidden', timeout: 4000 });
      equal(await page.evaluate(() => TSI.explorer.debug.deck()), null);
      equal(await tvScene(page), null);
    });

    await check('Act 1 puts its first card up when it opens, and Next walks the first three stills in order', async () => {
      await queue(page, 'absent_tide_act1');
      await pv.waitForSelector('[data-test=pv-scene].is-up', { timeout: 6000 });
      await pv.waitForFunction(() => document.querySelector('.tsi-xpv-sc__card.is-front [data-test=pv-scene-image][src*="01-outside"]'));
      await page.click('[data-test=deck-next]');
      await pv.waitForFunction(() => document.querySelector('.tsi-xpv-sc__card.is-front [data-test=pv-scene-image][src*="02-inside"]'));
      await page.click('[data-test=deck-next]');
      await pv.waitForFunction(() => document.querySelector('.tsi-xpv-sc__card.is-front [data-test=pv-scene-image][src*="03-chambers"]'));
      await page.click('[data-test=deck-close]').catch(() => {});
      await closeDeck(page).catch(() => {});
    });

    await check('Act 1\'s fourth card is Maerys\'s letter: no name on the TV, and her voice plays by itself from the DM window', async () => {
      await page.check('[data-test=deck-autoplay]').catch(() => {});
      await queue(page, 'absent_tide_act1');
      await pv.waitForSelector('[data-test=pv-scene].is-up', { timeout: 6000 });
      await page.click('[data-test=deck-card-3]');
      await pv.waitForFunction(() => { const i = document.querySelector('.tsi-xpv-sc__card.is-front [data-test=pv-scene-image][src*="04-letter"]'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 6000 });
      equal(await sceneText(pv), '', 'no name band, no writing');
      await page.waitForFunction(() => { const d = TSI.explorer.debug.deck(); return d && d.voice() && /voice\/maerys-letter\.mp3$/.test(d.voice().src) && !d.voice().paused; }, null, { timeout: 5000 });
      equal(await pv.$$eval('audio', n => n.length), 0, 'no sound in the TV window');
      equal((await page.$$eval('[data-test^=deck-card-]', n => n.length)), 4);
      await closeDeck(page).catch(() => {});
    });

    await check('Act 4: a card whose picture file is missing says so and leaves the TV as it was', async () => {
      /* The market card was removed (Harry, 30 October 2026), so no card is missing any more: point one at a file that is not there. */
      await page.evaluate(() => { const d = TSI_DATA.explorer.mainEvents.filter(e => e.id === 'absent_tide_act4')[0]; d.steps[3].image = 'tools/explorer/assets/absent-tide/act4/not-there.png'; });
      await queue(page, 'absent_tide_act4');
      await page.waitForSelector('[data-test=deck-list]');
      await page.waitForFunction(() => TSI.explorer.debug.deck().status().every(s => s.media !== 'checking'), null, { timeout: 8000 });
      const st = await deck(page);
      const missingIdx = st.status.map((s, i) => s.media === 'missing' ? i : -1).filter(i => i >= 0);
      assert(missingIdx.length >= 1, 'expected the card pointed at a missing file to be flagged');
      await page.click('[data-test=deck-card-' + missingIdx[0] + ']');
      assert(/file is missing/.test(await page.textContent('[data-test=deck-msg]')), 'the DM is told');
      equal(await page.isVisible('[data-test=deck-flag-' + missingIdx[0] + ']'), true);
    });

    await check('Act 4: the wall of notes carries its writing on the TV, over the picture', async () => {
      await closeDeck(page);
      await page.evaluate(() => { const d = TSI_DATA.explorer.mainEvents.filter(e => e.id === 'absent_tide_act4')[0]; d.steps[3].image = 'tools/explorer/assets/absent-tide/act4/liaison-wall-notes.png'; });
      await queue(page, 'absent_tide_act4');
      await page.waitForSelector('[data-test=deck-list]');
      await page.waitForFunction(() => TSI.explorer.debug.deck().status().every(s => s.media !== 'checking'), null, { timeout: 8000 });
      await page.click('[data-test=deck-card-3]');
      await pv.waitForSelector('.tsi-xpv-sc__card.is-front.is-ready [data-test=pv-scene-note]', { timeout: 5000 });
      equal(await sceneText(pv), 'Do not trust yesterday.');
    });

    await check('Act 4: the arrival clip card plays the clip muted on the TV; the still is the poster', async () => {
      await page.click('[data-test=deck-card-1]');
      await pv.waitForSelector('video[data-test=pv-scene-video]', { timeout: 4000 });
      equal(await pv.$eval('video[data-test=pv-scene-video]', v => [v.muted, v.loop]), [true, false]);
      await closeDeck(page);
    });

    await check('a missing voice file turns the button off ("no voice file") and the card still shows', async () => {
      await pv.waitForSelector('[data-test=pv-scene]', { state: 'hidden', timeout: 4000 });
      await page.evaluate(() => { const d = TSI_DATA.explorer.mainEvents.filter(e => e.id === 'absent_tide_act2')[0]; d.steps[2].voice = 'tools/explorer/assets/absent-tide/voice/not-there.mp3'; });
      await queue(page, 'absent_tide_act2');
      await page.waitForSelector('[data-test=deck-list]');
      await page.waitForFunction(() => TSI.explorer.debug.deck().status()[2].voice !== 'checking', null, { timeout: 8000 });
      await page.click('[data-test=deck-card-2]');
      equal(await page.textContent('[data-test=deck-voice]'), 'no voice file');
      equal(await page.isDisabled('[data-test=deck-voice]'), true);
      await pv.waitForFunction(() => document.querySelector('.tsi-xpv-sc__card.is-front [data-test=pv-scene-name]') && document.querySelector('.tsi-xpv-sc__card.is-front [data-test=pv-scene-name]').textContent === 'Linnet');
      await closeDeck(page);
    });

    await check('the two older main events still open as before and show nothing on the TV', async () => {
      await queue(page, 'tide_remembers_prologue');
      await page.waitForSelector('.tsi-exp-event-title');
      equal(await page.textContent('.tsi-exp-event-title'), 'The Tide Remembers - Prologue');
      equal(await page.$('[data-test=deck-list]'), null);
      equal(await tvScene(page), null);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.tsi-modal', { state: 'detached' });
    });

    await check('a queued deck that falls due replaces the night\'s camp event (the old route still works)', async () => {
      await page.evaluate(() => { const s = TSI.explorer.debug.state(); s.travel.forcedMainEvent = { id: 'absent_tide_act5', dueDay: s.travel.day }; s.travel.forcedMainEventFired = false; });
      await page.click('[data-test=camp]');
      await page.waitForSelector('[data-test=deck-list]', { timeout: 6000 });
      equal(await page.$$eval('[data-test=deck-list] li', l => l.length), 1);
      equal(await page.$$eval('.tsi-exp-deck-name', n => n.map(x => x.textContent)), ['Ilsa Tarrow']);
      equal(await page.evaluate(() => TSI.explorer.debug.state().travel.forcedMainEvent), null);
      await closeDeck(page);
    });

    await check('no errors on the way, and nothing left running after the deck closes', async () => {
      equal(context.log.errors, []);
      equal(context.log.consoleErrors.filter(e => !/Failed to load resource|ERR_/.test(e)), []);
      equal(await page.evaluate(() => TSI.explorer.debug.deck()), null);
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
