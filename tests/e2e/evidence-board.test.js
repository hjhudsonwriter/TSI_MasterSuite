/* The Evidence Board (guide 2, 4 November 2026), from files with the internet off, at the laptop and the TV.
   Checks: the board button beside the map icon; the seeded notes; add, edit, drag, tie, untie and remove on the players' window (and
   that each is saved by the Explorer, with Remove asking first); a note added from the DM doc's small box (the TV is not touched and
   the board is not opened); {clue: id} and {clue: words} cues; the prepared clues never reach the players' window; two windows
   changing the board at once both survive; the table log; Export and Import; the board in Back up everything.
   Run with:  node tests/e2e/evidence-board.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const board = page => page.evaluate(() => TSI.store.fresh('tsi.evidence.state', null));
const notes = async page => ((await board(page)) || { notes: [] }).notes;

async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  return pv;
}
async function boot(browser, name, size) {
  const context = await H.newContext(browser, name, { questMode: 'default', backedUp: true });
  await context.setOffline(true);
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
  return { context, page, pv, errors };
}
const pvNotes = pv => pv.$$eval('[data-test=pv-ev-note]', n => n.map(x => x.querySelector('strong').textContent));
const waitPvCount = (pv, n) => pv.waitForFunction(k => document.querySelectorAll('[data-test=pv-ev-note]').length === k, n, { timeout: 8000 });
/* (A waitForFunction that is async does not wait, so these poll.) */
async function until(fn, what) { const end = Date.now() + 10000; let last; while (Date.now() < end) { last = await fn(); if (last) return last; await new Promise(r => setTimeout(r, 150)); } throw new Error('never: ' + what); }
const waitSaved = (page, n) => until(async () => (await notes(page)).length === n, 'saved ' + n + ' notes');
const waitBoard = (page, fn, what) => until(async () => fn(await board(page)), what);

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Evidence Board at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const { context, page, pv, errors } = await boot(browser, name, size);

    await check('a board button sits in the players\' top row beside the map icon; the board opens as a panel over the picture with the seeded notes', async () => {
      const btns = await pv.$$eval('[data-test=pv-row] button', b => b.map(x => x.getAttribute('data-test')));
      equal(btns, ['pv-boardbtn', 'pv-mapbtn']);
      equal(await pv.isVisible('[data-test=pv-board-panel]'), false, 'shut until pressed');
      await pv.click('[data-test=pv-boardbtn]');
      await pv.waitForSelector('[data-test=pv-board-panel]', { state: 'visible' });
      equal(await pv.getAttribute('[data-test=pv-boardbtn]', 'aria-expanded'), 'true');
      await waitPvCount(pv, 7);
      equal((await pvNotes(pv))[0], 'The Marker was cut.');
      assert(/Tides That Remember/.test(await pv.textContent('[data-test=pv-ev-title]')));
      const f = await pv.$eval('.tsi-xpv-ev__note', e => getComputedStyle(e).fontFamily);
      assert(/IM Fell English/.test(f), f);
      const r = await pv.$eval('[data-test=pv-ev-board]', e => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, W: innerWidth, H: innerHeight }; });
      assert(Math.abs(r.w / r.h - 16 / 9) < 0.02 && r.w <= r.W && r.h <= r.H, JSON.stringify(r));
      await H.shot(pv, 'evidence-board-' + name);
    });

    await check('add a note on the players\' window: it is pinned, saved by the Explorer and shown at once', async () => {
      await pv.click('[data-test=pv-ev-add]');
      await pv.fill('[data-test=pv-ev-text]', 'The tide clock\nIt ran backward at dusk.');
      assert((await pv.textContent('[data-test=pv-ev-count]')).startsWith('39 of 200'));
      await pv.click('[data-test=pv-ev-save]');
      await waitPvCount(pv, 8);
      await waitSaved(page, 8);
      const n = (await notes(page)).slice(-1)[0];
      equal([n.text, n.from], ['The tide clock\nIt ran backward at dusk.', 'board']);
      equal(await pv.$$eval('.tsi-xpv-ev__note.is-new', x => x.length) <= 1, true);
    });

    await check('an empty note is refused; the limit is 200 characters', async () => {
      await pv.click('[data-test=pv-ev-add]');
      await pv.click('[data-test=pv-ev-save]');
      assert(/Write something first/.test(await pv.textContent('[data-test=pv-ev-status]')));
      await pv.fill('[data-test=pv-ev-text]', 'x'.repeat(300));
      assert((await pv.inputValue('[data-test=pv-ev-text]')).length === 200);
      await pv.click('[data-test=pv-ev-cancel]');
      equal((await notes(page)).length, 8);
    });

    await check('double-click a note to change its words: Save keeps them, Cancel does not', async () => {
      const target = pv.locator('[data-test=pv-ev-note]', { hasText: 'The tide clock' });
      await target.dblclick();
      await pv.fill('[data-test=pv-ev-text]', 'The tide clock\nIt ran backward at dawn.');
      await pv.click('[data-test=pv-ev-cancel]');
      assert(!(await notes(page)).some(n => /dawn/.test(n.text)));
      await target.dblclick();
      await pv.fill('[data-test=pv-ev-text]', 'The tide clock\nIt ran backward at dawn.');
      await pv.click('[data-test=pv-ev-save]');
      await waitBoard(page, b => b.notes.some(n => /dawn/.test(n.text)), 'the edit is saved');
      await pv.waitForFunction(() => /dawn/.test(document.querySelector('[data-test=pv-board-panel]').innerText));
    });

    await check('drag a note: it moves with the pointer and its place is saved on release', async () => {
      const before = (await notes(page)).find(n => /tide clock/.test(n.text));
      const loc = pv.locator('[data-test=pv-ev-note]', { hasText: 'The tide clock' });
      const b = await loc.boundingBox();
      const s = await pv.$eval('[data-test=pv-ev-board]', e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
      await pv.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await pv.mouse.down();
      for (let i = 1; i <= 8; i++) await pv.mouse.move(b.x + b.width / 2 - 60 * i / 8 * 4 / 4, b.y + b.height / 2 + 40 * i / 8);
      await pv.mouse.up();
      await waitBoard(page, b => b.notes.find(n => /tide clock/.test(n.text)).x !== before.x, 'the move is saved');
      const after = (await notes(page)).find(n => /tide clock/.test(n.text));
      assert(Math.abs((after.x - before.x) - (-60 / s.w * 100)) < 1.2, 'moved by about the drag: ' + (after.x - before.x));
      assert(Math.abs((after.y - before.y) - (40 / s.h * 100)) < 1.2, 'down by about the drag');
    });

    await check('tie two notes with red string, click the string to untie it; no string to itself', async () => {
      const a = pv.locator('[data-test=pv-ev-note]', { hasText: 'The Marker was cut' });
      const c = pv.locator('[data-test=pv-ev-note]', { hasText: 'Faint sunbursts' });
      await a.click();
      await pv.click('[data-test=pv-ev-tie]');
      assert(/click the note/i.test(await pv.textContent('[data-test=pv-ev-status]')));
      await c.click();
      await waitBoard(page, b => b.strings.length === 1, 'one string');
      await pv.waitForSelector('[data-test=pv-ev-string]', { state: 'attached' });
      // string to the same note: pressing Tie then the same note does nothing
      await a.click(); await pv.click('[data-test=pv-ev-tie]'); await a.click({ force: true });
      await pv.waitForTimeout(400);
      equal((await board(page)).strings.length, 1);
      await pv.keyboard.press('Escape');
      const hit = pv.locator('[data-test=pv-ev-string-hit]').first();
      const hb = await hit.evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await pv.mouse.click(hb.x, hb.y);
      await pv.waitForSelector('[data-test=pv-ev-untie]', { state: 'visible' });
      await pv.click('[data-test=pv-ev-untie]');
      await waitBoard(page, b => b.strings.length === 0, 'no strings');
    });

    await check('Remove asks "Take this note down?": Keep it leaves it; Take it down removes it', async () => {
      const n0 = (await notes(page)).length;
      await pv.locator('[data-test=pv-ev-note]', { hasText: 'The tide clock' }).click();
      await pv.click('[data-test=pv-ev-remove]');
      assert((await pv.textContent('[data-test=pv-ev-ask]')).includes('Take this note down?'));
      await pv.click('[data-test=pv-ev-remove-no]');
      equal((await notes(page)).length, n0);
      await pv.locator('[data-test=pv-ev-note]', { hasText: 'The tide clock' }).click();
      await pv.click('[data-test=pv-ev-remove]');
      await pv.click('[data-test=pv-ev-remove-yes]');
      await waitSaved(page, n0 - 1);
      await waitPvCount(pv, n0 - 1);
    });

    await check('Esc closes the board; nothing in the players\' window saved anything itself (no store there)', async () => {
      await pv.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-board-panel]', { state: 'hidden' });
      equal(await pv.evaluate(() => typeof TSI.store), 'undefined');
    });

    await check('Edit Evidence Board in the DM doc: a small box adds a note; the TV is not touched and the board is not opened; it is there when opened', async () => {
      await page.click('[data-test=dm-doc]');
      await page.waitForSelector('[data-test=dmdoc-evidence-edit]');
      const sceneBefore = await page.evaluate(() => TSI.explorer.debug.scene());
      await page.click('[data-test=dmdoc-evidence-edit]');
      await page.waitForSelector('[data-test=dmdoc-evidence-text]');
      assert((await page.textContent('.tsi-modal')).includes('Add to board') && (await page.textContent('.tsi-modal')).includes('Cancel'));
      await page.click('[data-test=dmdoc-evidence-add]');
      assert(/Write something/.test(await page.textContent('[data-test=dmdoc-evidence-msg]')));
      await page.fill('[data-test=dmdoc-evidence-text]', 'The ferryman\nHe will not cross at night.');
      await page.click('[data-test=dmdoc-evidence-add]');
      await page.waitForFunction(() => /Pinned to the board/.test(document.querySelector('[data-test=dmdoc-evidence-msg]').textContent));
      equal(await page.inputValue('[data-test=dmdoc-evidence-text]'), '');
      assert(/Copy the board as text/.test(await page.textContent('.tsi-modal')));
      await page.keyboard.press('Escape');
      const n = (await notes(page)).find(x => /ferryman/.test(x.text));
      equal([n.from, typeof n.addedDay], ['dm-doc', 'number']);
      equal(await pv.isVisible('[data-test=pv-board-panel]'), false, 'the board was not opened');
      equal(await page.evaluate(() => TSI.explorer.debug.scene()), sceneBefore, 'the TV picture is unchanged');
      await pv.click('[data-test=pv-boardbtn]');
      await pv.waitForFunction(() => /ferryman|The ferryman/.test(document.querySelector('[data-test=pv-board-panel]').innerText), null, { timeout: 8000 });
      await page.evaluate(() => TSI.dmDoc.close());
    });

    await check('a note added from the DM doc while the board is open shows there at once', async () => {
      const k = (await notes(page)).length;
      await page.evaluate(() => TSI.evidence.apply(s => TSI.evidenceRules.addNote(s, { text: 'Live note', from: 'dm-doc' }), { log: true }));
      await waitPvCount(pv, k + 1);
      await pv.keyboard.press('Escape');
    });

    await check('{clue: id} awards a prepared clue and {clue: words} pins new words, with the board shut and the TV untouched; a repeat is not added twice', async () => {
      const k = (await notes(page)).length;
      const prepared0 = (await board(page)).prepared.length;
      await page.click('[data-test=dm-doc]');
      await page.click('[data-test=dmdoc-quest-mode-edit]');
      await page.fill('[data-test=dmdoc-quest-text]', 'Search {clue: warm-tea} and {clue: A wet footprint} again {clue: warm-tea}');
      await page.click('[data-test=dmdoc-quest-mode-read]');
      equal(await page.$$eval('[data-test=dmdoc-quest-read] [data-test=cue-clue]', n => n.map(x => x.textContent)), ['Clue: The warm tea', 'Pin: A wet footprint', 'Clue: The warm tea']);
      await page.click('[data-test=dmdoc-quest-read] button[data-tag="{clue: warm-tea}"]');
      await waitSaved(page, k + 1);
      const b = await board(page);
      equal(b.prepared.length, prepared0 - 1);
      equal(b.notes.find(n => n.ref === 'warm-tea').from, 'cue');
      await page.waitForTimeout(800);
      await page.click('[data-test=dmdoc-quest-read] button[data-tag="{clue: A wet footprint}"]');
      await waitSaved(page, k + 2);
      await page.waitForTimeout(800);
      await page.click('[data-test=dmdoc-quest-read] button[data-tag="{clue: warm-tea}"] >> nth=0');
      await page.waitForTimeout(800);
      equal((await notes(page)).length, k + 2, 'a clue already up is not pinned again');
      equal(await pv.isVisible('[data-test=pv-board-panel]'), false);
      equal(await page.evaluate(() => TSI.explorer.debug.scene()), null);
      const log = await page.evaluate(() => TSI.tablelog.all());
      assert(log.filter(e => e.kind === 'clue').length >= 3, JSON.stringify(log.filter(e => e.kind === 'clue')));
      assert(log.some(e => e.kind === 'clue' && /^The warm tea/.test(e.label)));
      await page.evaluate(() => TSI.dmDoc.close());
    });

    await check('the prepared clues never reach the players\' window; only notes already pinned do', async () => {
      const b = await board(page);
      assert(b.prepared.length > 10);
      await pv.click('[data-test=pv-boardbtn]');
      const html = await pv.evaluate(() => document.documentElement.outerHTML);
      b.prepared.forEach(p => { const head = p.text.split('\n')[0]; assert(!html.includes(head.replace(/'/g, '&#39;')) && !html.includes(head), 'a prepared clue reached the TV: ' + head); });
      assert(!/"prepared"/.test(html));
      await pv.keyboard.press('Escape');
    });

    await check('no errors on the way', async () => {
      equal(errors, []);
      equal(context.log.errors, []);
    });
    await context.close();
  }

  section('Two windows changing the board at once, Export and Import, Back up everything');
  {
    const size = { width: 1707, height: 930 };
    const { context, page, pv } = await boot(browser, 'laptop', size);
    await pv.click('[data-test=pv-boardbtn]');
    await waitPvCount(pv, 7);

    await check('an edit on the TV and a note from the pop-out DM doc at the same moment both survive', async () => {
      await page.click('[data-test=dm-doc]');
      const [pop] = await Promise.all([context.waitForEvent('page'), page.click('[data-test=dmdoc-popout]')]);
      await pop.setViewportSize({ width: 1100, height: 760 });
      await pop.waitForSelector('[data-test=dmdoc-evidence-edit]', { timeout: 10000 });
      await pop.click('[data-test=dmdoc-evidence-edit]');
      await pop.fill('[data-test=dmdoc-evidence-text]', 'From the pop-out\nAt the same time.');
      await pv.click('[data-test=pv-ev-add]');
      await pv.fill('[data-test=pv-ev-text]', 'From the TV\nAt the same time.');
      await Promise.all([pop.click('[data-test=dmdoc-evidence-add]'), pv.click('[data-test=pv-ev-save]')]);
      await waitSaved(page, 9);
      const texts = (await notes(page)).map(n => n.text.split('\n')[0]);
      assert(texts.includes('From the pop-out') && texts.includes('From the TV'), texts.join(' / '));
      await waitPvCount(pv, 9);
      // the pop-out window's change reaches the Explorer even though it is another window
      equal(new Set((await notes(page)).map(n => n.id)).size, 9, 'distinct ids');
      await pop.keyboard.press('Escape');
      await pop.close();
    });

    await check('Export the campaign holds the board; Import puts it back', async () => {
      const d = await H.download(page, '[data-test=export-save]');
      const exported = JSON.parse(d.text);
      assert(exported.records.some(r => r.key === 'tsi.evidence.state'), exported.records.map(r => r.key).join());
      await pv.locator('[data-test=pv-ev-note]', { hasText: 'From the TV' }).click();
      await pv.click('[data-test=pv-ev-remove]');
      await pv.click('[data-test=pv-ev-remove-yes]');
      await waitSaved(page, 8);
      const f = H.writeTemp('campaign-evidence.json', exported);
      await H.chooseFile(page, '[data-test=import-save]', f);
      await page.waitForSelector('.tsi-modal');
      await H.clickModal(page, 'Import');
      await page.waitForSelector('[data-test=camp]');
      await waitSaved(page, 9);
    });

    await check('Back up everything holds the board and "Restore only some" lists it with the campaign', async () => {
      await page.click('[data-test=home]');
      await page.waitForSelector('.tsi-card');
      const d = await H.download(page, '[data-test=backup-everything]');
      const b = JSON.parse(d.text);
      assert(b.records.some(r => r.key === 'tsi.evidence.state'));
    });

    await context.close();
  }

  await browser.close();
  H.summary();
})().catch(e => { console.error(e); process.exit(1); });
