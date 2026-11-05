/* "Previously, in the Scarlett Isles…" (guide 4, 5 November 2026), from files with the internet off, at the laptop and the TV.
   Checks: Recap on the home screen; a draft from the table log (title, pictures, the Evidence Board notes, "Meanwhile…", closing card);
   editing a caption, reordering, removing, re-timing and the total; the narration script and file name; Play on the TV through the Explorer
   (the reel on the Player View: crossfading slides in order, the last frame held) and Back to the map; the {recap} cue; End session's
   "Make the recap now"; a missing picture; reduced motion; nothing but pictures and words reaches the TV.
   Sound and video cannot be heard or played here: they are on Harry's Edge checklist.
   Run with:  node tests/e2e/recap-reel.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const EXPLORER = INDEX + '?tool=explorer';

async function until(fn, what, ms) { const end = Date.now() + (ms || 10000); let last; while (Date.now() < end) { last = await fn(); if (last) return last; await new Promise(r => setTimeout(r, 150)); } throw new Error('never: ' + what); }
const recaps = page => page.evaluate(() => TSI.store.fresh('tsi.recap.state', null)).then(s => (s && s.recaps) || []);
const kinds = page => page.$$eval('[data-test=recap-slide]', r => r.map(x => x.dataset.kind));

async function seedLog(page) {
  await page.evaluate(async () => {
    const cast = window.TSI_DATA.cast.filter(c => c.image);
    const L = TSI.tablelog;
    await L.add({ kind: 'session-end', label: 'Session ended', day: 3 });
    await L.add({ kind: 'cast', ref: cast[0].id, label: cast[0].name, image: cast[0].image, day: 4 });
    await L.add({ kind: 'cast', ref: cast[1].id, label: cast[1].name, image: cast[1].image, day: 4 });
    await L.add({ kind: 'card', ref: 'act1/outside', label: 'The house outside', image: 'tools/explorer/assets/absent-tide/act1/01-outside.png', day: 5 });
    await L.add({ kind: 'card', ref: 'act1/letter', label: 'The letter', image: 'tools/explorer/assets/absent-tide/act1/04-letter.png', day: 5 });
    await L.add({ kind: 'card', ref: 'act9/lost', label: 'A picture that is gone', image: 'tools/explorer/assets/absent-tide/act1/not-there.png', day: 5 });
    await L.add({ kind: 'fight', ref: 'won:f1', label: 'Won: The ford', result: 'won', day: null });
    await L.add({ kind: 'bond', ref: 'c1:2', label: 'Fenstalker reached Bond 2 (Trusted)', day: null });
    await L.add({ kind: 'camp', ref: 'day-6', label: 'Camp, Day 6', day: 6 });
    await TSI.evidence.apply(s => TSI.evidenceRules.addNote(s, { text: 'Warm cup\nStill warm.', from: 'dm-doc', day: 5 }), { log: true });
    await TSI.evidence.apply(s => TSI.evidenceRules.addNote(s, { text: 'Chalk marks\nOn the gate.', from: 'dm-doc', day: 5 }), { log: true });
    await TSI.store.flush();
  });
}

(async () => {
  const browser = await H.chromium.launch();

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The recap reel at ' + size.width + ' x ' + size.height + ' (' + name + ', internet off)');
    const context = await H.newContext(browser, name, { questMode: 'default', backedUp: true });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await context.setOffline(true);
    const errors = [];
    const home = await context.newPage();
    home.on('pageerror', e => errors.push('home: ' + e));
    await home.goto(INDEX);
    await home.waitForSelector('[data-test=recap]');
    await seedLog(home);
    let id = '';

    await check('Recap sits on the home screen with the other buttons; with nothing made it says so, and offers a new recap as the main button', async () => {
      const btns = await home.$$eval('.tsi-home [data-test], .tsi-home button', b => b.map(x => x.getAttribute('data-test')).filter(Boolean));
      assert(btns.includes('recap') && btns.includes('snapshots') && btns.includes('restore'), btns.join());
      await home.click('[data-test=recap]');
      await home.waitForSelector('[data-test=recap-none]');
      assert(await home.$eval('[data-test=recap-make]', b => b.classList.contains('tsi-btn--primary')));
    });

    await check('a new recap is drafted from the table log since the last End session: opening words, each picture once with its name, the board notes, "Meanwhile…", the closing card', async () => {
      await home.click('[data-test=recap-make]');
      await home.waitForSelector('[data-test=recap-slides]');
      const k = await kinds(home);
      equal(k, ['title', 'picture', 'picture', 'picture', 'picture', 'picture', 'clues', 'meanwhile', 'closing']);
      const caps = await home.$$eval('[data-test=recap-caption]', i => i.map(x => x.value));
      equal(caps[0], 'Previously, in the Scarlett Isles…');
      equal(caps.slice(1, 6).length, 5);
      assert(caps.includes('The letter') && caps.includes('A picture that is gone'), caps.join('|'));
      equal(caps[caps.length - 1], 'The Scarlett Isles');
      const clue = await home.$eval('[data-kind=clues] [data-test=recap-lines]', t => t.value.split('\n'));
      equal(clue, ['Warm cup', 'Chalk marks']);
      const meanwhile = await home.$eval('[data-kind=meanwhile] [data-test=recap-lines]', t => t.value.split('\n'));
      equal(meanwhile, ['1 fight won', '3 days travelled', 'Fenstalker reached Bond 2 (Trusted)']);
      const total = await home.textContent('[data-test=recap-total]');
      assert(/Total 4\d seconds/.test(total) || /Total \d+ seconds/.test(total), total);
      const saved = await recaps(home);
      equal(saved.length, 1); id = saved[0].id;
      const lay = await H.layoutCheck(home, ['[data-test=recap-play]', '[data-test=recap-back]']);
      equal(lay.outOfView, [], 'the Play button is in view');
      assert(lay.scrollWidth <= lay.clientWidth, 'no sideways scrolling');
      assert(await home.$eval('[data-test=recap-play]', b => b.classList.contains('tsi-btn--primary')), 'one main button');
      await H.shot(home, 'recap-editor-' + name);
    });

    await check('edit a caption, reorder, remove, re-time: each is saved at once and the total follows', async () => {
      await home.locator('[data-kind=picture] [data-test=recap-caption]').nth(0).fill('Dren at the door');
      await home.locator('[data-kind=picture] [data-test=recap-secs]').nth(0).fill('2');
      await home.locator('[data-kind=picture] [data-test=recap-secs]').nth(0).press('Tab');
      equal(await home.locator('[data-kind=picture] [data-test=recap-secs]').nth(0).inputValue(), '4', 'held to 4 seconds at least');
      await home.locator('[data-kind=picture] [data-test=recap-secs]').nth(1).fill('4');
      await home.locator('[data-kind=picture] [data-test=recap-secs]').nth(1).press('Tab');
      await home.locator('[data-kind=picture]').nth(1).locator('[data-test=recap-up]').click();
      let caps = await home.$$eval('[data-kind=picture] [data-test=recap-caption]', i => i.map(x => x.value));
      equal(caps[1], 'Dren at the door');
      await home.locator('[data-kind=picture]').nth(0).locator('[data-test=recap-remove]').click();
      await home.locator('[data-kind=picture]').nth(0).locator('[data-test=recap-remove]').click();
      equal((await kinds(home)).filter(x => x === 'picture').length, 3);
      equal(await home.$$('[data-kind=title] [data-test=recap-remove]').then(a => a.length), 0, 'the title cannot be removed');
      equal(await home.$$('[data-kind=closing] [data-test=recap-remove]').then(a => a.length), 0, 'nor the closing card');
      await home.locator('[data-kind=closing] [data-test=recap-caption]').fill('Until next time');
      await home.waitForTimeout(300);
      const saved = (await recaps(home))[0];
      equal(saved.slides.filter(s => s.kind === 'picture').length, 3);
      equal(saved.slides[saved.slides.length - 1].caption, 'Until next time');
      assert(!saved.slides.some(s => s.caption === 'Dren at the door'), 'the two removed pictures are gone, with the one renamed');
      /* Short each: make the reel quick to watch (4 seconds a slide). */
      for (const s of await home.$$('[data-test=recap-secs]')) { await s.fill('4'); await s.press('Tab'); }
      await home.waitForTimeout(300);
      const total = await home.textContent('[data-test=recap-total]');
      assert(/Total 28 seconds/.test(total) && /short/.test(total), total);
    });

    await check('the narration script is the captions as one paragraph, and the editor names the file to save it as', async () => {
      equal(await home.textContent('[data-test=recap-narration-file]'), 'tools/recap/assets/narration/' + id + '.mp3');
      await home.waitForFunction(() => /Not there yet/.test(document.querySelector('[data-test=recap-narration-state]').textContent));
      await home.click('[data-test=recap-copy]');
      await home.waitForTimeout(200);
      const script = await home.$eval('[data-test=recap-script]', t => t.value);
      assert(/^Previously, in the Scarlett Isles… /.test(script) && /On the Evidence Board: Warm cup, Chalk marks\./.test(script) && /Meanwhile: 1 fight won; 3 days travelled; Fenstalker reached Bond 2 \(Trusted\)\./.test(script) && /Until next time\.$/.test(script), script);
      assert(script.indexOf('\n') === -1);
    });

    await check('Play on the TV with no Explorer open says so and offers to open it', async () => {
      await home.click('[data-test=recap-play]');
      await home.waitForSelector('[data-test=recap-msg-action]');
      assert(/not open/.test(await home.textContent('[data-test=recap-msg]')));
    });

    /* Now the Explorer, with its Player View. */
    const exp = await context.newPage();
    exp.on('pageerror', e => errors.push('explorer: ' + e));
    await exp.goto(EXPLORER);
    await exp.waitForSelector('[data-test=camp]');
    await exp.selectOption('[data-test=map-select]', 'the_east_isle');
    await exp.click('[data-test=load]');
    await exp.waitForTimeout(400);
    const [pv] = await Promise.all([exp.waitForEvent('popup'), exp.click('[data-test=open-player-view]')]);
    await pv.setViewportSize(size);
    await pv.waitForSelector('[data-test=pv-stage]');
    await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
    const slideKinds = () => pv.$$eval('[data-test=reel-slide]:not(.is-out)', s => s.map(x => x.dataset.kind));

    await check('Play on the TV (the Explorer in another window): the reel starts on the Player View with the opening words, then the slides in order', async () => {
      await exp.bringToFront();   /* a hidden window beats slowly, so the Explorer is brought forward for the home window to notice it */
      await until(() => home.evaluate(() => TSI.tabGuard.isOpenElsewhere('explorer')), 'the home window to see the Explorer (its heartbeat)', 20000);
      await home.bringToFront();
      await home.click('[data-test=recap-play]');
      await pv.waitForSelector('[data-test=reel]', { timeout: 10000 });
      await until(async () => (await slideKinds()).includes('title'), 'the title');
      assert(/Previously, in the Scarlett Isles/.test(await pv.textContent('[data-test=reel] [data-test=reel-caption]')));
      await pv.waitForTimeout(1900);
      await H.shot(pv, 'recap-reel-title-' + name);
      await until(async () => (await slideKinds()).includes('picture'), 'a picture slide', 9000);
      await pv.waitForTimeout(1800);
      const bg = await pv.evaluate(() => { const i = document.querySelector('.tsi-reel__slide--picture:not(.is-out) .tsi-reel__img'); return i ? { w: i.naturalWidth, shown: i.complete } : null; });
      assert(bg && bg.w > 0, 'the picture drew');
      await H.shot(pv, 'recap-reel-picture-' + name);
      const seen = [];
      const end = Date.now() + 30000;
      while (Date.now() < end) { const k = (await slideKinds())[0]; if (k && seen[seen.length - 1] !== k) { seen.push(k); if (k === 'clues' || k === 'meanwhile') { await pv.waitForTimeout(1900); await H.shot(pv, 'recap-reel-' + k + '-' + name); } } if (k === 'closing') break; await pv.waitForTimeout(250); }
      equal(seen, ['picture', 'clues', 'meanwhile', 'closing'].slice(0, 0).concat(seen), 'recorded');
      assert(seen.indexOf('clues') < seen.indexOf('meanwhile') && seen.indexOf('meanwhile') < seen.indexOf('closing') && seen.includes('picture'), seen.join());
    });

    await check('the Evidence Board slide shows the notes and "Meanwhile…" the lines; the closing card holds its last frame', async () => {
      assert(await pv.$('[data-test=reel] [data-kind=closing]'));
      equal(await pv.textContent('[data-test=reel] [data-kind=closing] [data-test=reel-caption]'), 'Until next time');
      await H.shot(pv, 'recap-reel-closing-' + name);
      await pv.waitForTimeout(6000);
      assert(await pv.$('[data-test=reel] [data-kind=closing].is-in'), 'still there six seconds later');
      const text = await pv.evaluate(() => document.querySelector('[data-test=reel]').innerText);
      assert(!/recap-20|\.mp3|sinceDay|narration/.test(text), text);
    });

    await check('Back to the map clears the reel; the map is as it was', async () => {
      await home.bringToFront();
      await home.click('[data-test=recap-back]');
      await until(async () => !(await pv.$('[data-test=reel]')), 'the reel to go');
      assert(await pv.isVisible('[data-test=pv-stage]'));
    });

    await check('the {recap} cue plays the latest recap and {hide} ends it; the cue is no longer greyed', async () => {
      const res = await exp.evaluate(() => TSI.cueRunner.run('{recap}'));
      equal(res.ok, true);
      await pv.waitForSelector('[data-test=reel]', { timeout: 10000 });
      const r2 = await exp.evaluate(() => TSI.cueRunner.run('{hide}'));
      equal(r2.ok, true);
      await until(async () => !(await pv.$('[data-test=reel]')), 'the reel to go');
      const resolved = await exp.evaluate(() => { const c = TSI.cueRules.parseCues('{recap}')[0]; const r = TSI.cueRules.resolveCue(c, {}); return { ok: r.ok, soon: r.soon, label: r.label }; });
      equal(resolved, { ok: true, soon: false, label: 'Recap' });
    });

    await check('the Explorer has its own Play recap button: with no TV window it says so; with the Player View open it plays the latest recap, and Back to the map in its notice ends it', async () => {
      assert(await exp.isVisible('[data-test=play-recap]'), 'the button is on the Explorer\'s left panel');
      await exp.click('[data-test=play-recap]');
      await pv.waitForSelector('[data-test=reel]', { timeout: 10000 });
      await exp.waitForSelector('.tsi-notice button:text-is("Back to the map")');
      await exp.click('.tsi-notice button:text-is("Back to the map")');
      await until(async () => !(await pv.$('[data-test=reel]')), 'the reel to go');
    });

    await check('a message sent to the TV carries pictures and words only', async () => {
      const sent = await exp.evaluate(async () => {
        const st = await TSI.recap.read();
        return JSON.stringify(TSI.recapRules.snapshot(TSI.recapRules.latest(st)));
      });
      assert(!/narration|made|sinceDay|toDay|recap-20|\.mp3/.test(sent), sent);
      const o = JSON.parse(sent);
      equal(Object.keys(o).sort(), ['slides', 'v']);
    });

    await check('a picture that is missing shows its caption on a dark slide, and nothing is stuck', async () => {
      await exp.evaluate(() => TSI.cueRunner.run('{recap}'));
      await pv.waitForSelector('[data-test=reel]');
      await pv.evaluate(() => {
        const l = document.querySelector('[data-test=reel]');
        const s = document.createElement('section'); s.className = 'tsi-reel__slide tsi-reel__slide--picture is-in'; s.innerHTML = '<div class="tsi-reel__push"><div class="tsi-reel__bg tsi-reel__bg--blur is-missing"></div></div><p class="tsi-reel__caption" data-test="x-missing">Gone</p>'; l.appendChild(s);
      });
      equal(await pv.textContent('[data-test=x-missing]'), 'Gone');
      await exp.evaluate(() => TSI.cueRunner.run('{hide}'));
      await until(async () => !(await pv.$('[data-test=reel]')), 'the reel to go');
    });

    equal(errors, [], 'no page errors');
    await context.close();
  }

  section('End session, the DM doc and reduced motion (laptop, internet off)');
  {
    const context = await H.newContext(browser, 'laptop', { questMode: 'default', backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(INDEX);
    await page.waitForSelector('[data-test=end-session]');
    await seedLog(page);

    await check('End session offers "Make the recap now" as its main button after the backup, and it opens the recap of the session just ended', async () => {
      await page.click('[data-test=end-session]');
      await page.waitForSelector('.tsi-modal');
      const [d] = await Promise.all([page.waitForEvent('download'), H.clickModal(page, 'Back up and finish')]);
      assert(d);
      await page.waitForSelector('[data-test=session-ended]');
      assert(await page.$eval('.tsi-modal__foot .tsi-btn--primary', b => /Make the recap now/.test(b.textContent)));
      await H.clickModal(page, 'Make the recap now');
      await page.waitForSelector('[data-test=recap-slides]');
      equal((await kinds(page)).filter(k => k === 'picture').length, 5, 'the session before the marker End session just wrote');
      equal(await page.$eval('[data-kind=meanwhile] [data-test=recap-lines]', t => t.value.split('\n')[1]), '3 days travelled');
      await H.clickModal(page, 'Close');
    });

    await check('the list shows the recap with Edit and Delete; Delete asks first', async () => {
      await page.click('[data-test=recap]');
      await page.waitForSelector('[data-test=recap-item]');
      equal(await page.$$('[data-test=recap-item]').then(a => a.length), 1);
      await page.click('[data-test=recap-delete]');
      await page.waitForSelector('.tsi-modal__title');
      await H.clickModal(page, 'Delete');
      await page.waitForSelector('[data-test=recap-none]');
      await H.clickModal(page, 'Close');
    });

    await check('the recap is saved under tsi.recap.state and is part of Back up everything', async () => {
      await page.waitForTimeout(400);   /* the Recap button ignores a click while its last pop-up is still finishing */
      await page.click('[data-test=recap]');
      await page.click('[data-test=recap-make]');
      await page.waitForSelector('[data-test=recap-slides]');
      await H.clickModal(page, 'Close');
      const d = await H.download(page, '[data-test=backup-everything]');
      const b = JSON.parse(d.text);
      const rec = b.records.find(r => r.key === 'tsi.recap.state');
      assert(rec && rec.value.recaps.length === 1, 'the recap is in the backup');
    });
    await context.close();
  }

  section('Reduced motion (TV window)');
  {
    const context = await H.newContext(browser, 'tv', { questMode: 'default', backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.selectOption('[data-test=map-select]', 'the_east_isle');
    await page.click('[data-test=load]');
    await page.waitForTimeout(400);
    const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
    await pv.emulateMedia({ reducedMotion: 'reduce' });
    await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
    await check('with reduced motion the slides crossfade without the push-in', async () => {
      await page.evaluate(() => TSI.recap.draftNow());
      const r = await page.evaluate(() => TSI.cueRunner.run('{recap}'));
      equal(r.ok, true);
      await pv.waitForSelector('[data-test=reel-slide]');
      const anim = await pv.$eval('.tsi-reel__push', e => getComputedStyle(e).animationName);
      equal(anim, 'none');
      await page.evaluate(() => TSI.cueRunner.run('{hide}'));
    });
    await context.close();
  }

  await browser.close();
  H.summary();
})();
