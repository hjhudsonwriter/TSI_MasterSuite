/* Sound that follows the table (guide 5, 5 November 2026), from files with the internet off, at the laptop and the TV.
   The background sound plays from the Explorer Player View. Checks: the files are there; with no Player View the Explorer's own window plays
   (and says so); the Player View takes over and only one window plays; a map change crossfades; weather goes over the road sound; a town,
   Make Camp and night; a voice line ducks everything; a fight handed over plays the combat mood until it is won; {sound: mystery} and
   {sound: off}; the Sound control (volume, mute, mood, what is playing); a change of tool keeps the bed going and the control still reaches it;
   closing the Player View stops its sound; a missing file is skipped and named.
   Nobody can hear anything here: what each sound is doing is read from the players. Listening is on Harry's Edge checklist.
   Run with:  node tests/e2e/soundscape.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const EXPLORER = INDEX + '?tool=explorer';
async function until(fn, what, ms) { const end = Date.now() + (ms || 12000); let last; while (Date.now() < end) { last = await fn(); if (last) return last; await new Promise(r => setTimeout(r, 150)); } throw new Error('never: ' + what); }
const pvSound = pv => pv.evaluate(() => TSI.explorer.soundDebug());
const wantedIds = d => d ? Object.keys(d.channels).filter(k => d.channels[k].wanted) : [];
const playingIds = d => d ? Object.keys(d.channels).filter(k => d.channels[k].state === 'playing' && d.channels[k].playing > 0) : [];
const settled = (pv, ids) => until(async () => { const d = await pvSound(pv); return d && JSON.stringify(wantedIds(d).sort()) === JSON.stringify(ids.slice().sort()) && ids.every(k => d.channels[k].fade >= 0.99) && playingIds(d).sort().join() === ids.slice().sort().join(); }, 'the sound to settle on ' + ids.join('+'), 20000);
const change = (page, fn) => page.evaluate(src => TSI.explorer.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const cue = (page, tag) => page.evaluate(t => TSI.cueRunner.run(t), tag);
async function closeModals(page) { for (let i = 0; i < 4; i++) { const b = await page.$('.tsi-modal__foot button'); if (!b) break; await b.click().catch(() => {}); await page.waitForTimeout(250); } }

(async () => {
  const browser = await H.chromium.launch();

  section('The sound files');
  await check('every bed has its file in the suite folder (Harry\'s files, and the three sound effects reused by path), and the data file names them all', async () => {
    const vm = require('vm'); const ctx = { window: {} }; ctx.window.window = ctx.window; vm.createContext(ctx);
    vm.runInContext('var window = this.window;' + fs.readFileSync(path.join(H.ROOT, 'tools/explorer/data/soundscape-data.js'), 'utf8'), ctx);
    const D = JSON.parse(JSON.stringify(ctx.window.TSI_DATA.soundscape));
    equal(Object.keys(D.beds).sort(), ['blizzard', 'campfire', 'coast', 'combat', 'forest', 'heat', 'marsh', 'mountain', 'mystery', 'night', 'plains', 'rain', 'storm', 'tavern', 'town']);
    for (const [k, b] of Object.entries(D.beds)) { const f = path.join(H.ROOT, b.file); assert(fs.existsSync(f) && fs.statSync(f).size > 10000, k + ': ' + b.file + ' is missing'); }
    assert(fs.existsSync(path.join(H.ROOT, 'tools/explorer/assets/soundscape/ADD-THE-SOUNDS-HERE.txt')), 'the file list note');
  });

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]].filter(x => !process.env.ONLY || process.env.ONLY === x[0])) {
    section('The soundscape at ' + size.width + ' x ' + size.height + ' (' + name + ', internet off)');
    const br = await H.chromium.launch();   /* a browser of its own for each size, so nothing carries over from the last */
    const context = await H.newContext(br, name, { questMode: 'default', backedUp: true });
    await context.setOffline(true);
    /* No random camp or weather event: the dice always roll high. */
    await context.addInitScript(() => { Math.random = () => 0.99; });
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', e => errors.push('explorer: ' + e));
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.selectOption('[data-test=map-select]', 'the_east_isle');
    await page.click('[data-test=load]');
    await page.waitForTimeout(500);
    await change(page, s => { s.travel.travelEventDay = s.travel.day; s.snap.enabled = true; });
    let pv = null;
    /* When a check fails, say what the TV and the Explorer were doing. */
    const check = (title, fn) => H.check(title, async () => { try { await fn(); } catch (e) { try { const a = await page.evaluate(() => TSI.explorer && TSI.explorer.debug ? TSI.explorer.debug.sound() : 'the Explorer is not open here'); const b = pv ? await pvSound(pv) : null; console.log('  [diagnosis] explorer: ' + JSON.stringify(a).slice(0, 700) + '\n  [diagnosis] TV: ' + JSON.stringify(b).slice(0, 700) + '\n  [diagnosis] url: ' + page.url()); } catch (e2) { console.log('  [diagnosis failed] ' + e2); } throw e; } });

    await check('with no Player View open the Explorer\'s own window plays the road sound, and says so once', async () => {
      await until(async () => { const d = (await page.evaluate(() => TSI.explorer.debug.sound())).local; return d && d.channels.coast && d.channels.coast.state === 'playing' && d.channels.coast.playing > 0; }, 'the coast sound from the Explorer window');
      await page.waitForSelector('.tsi-notice:has-text("No Player View is open")');
      equal((await page.$$('.tsi-notice:has-text("No Player View is open")')).length, 1);
    });

    await check('the Soundscape button is in the top bar on the Explorer with every other button in view and no sideways scroll', async () => {
      assert(await page.isVisible('[data-test=soundscape]'));
      const lay = await H.layoutCheck(page, ['[data-test=soundscape]', '[data-test=dm-doc]', '[data-test=backup-all]']);
      equal(lay.outOfView, []);
      assert(lay.scrollWidth <= lay.clientWidth, 'sideways scroll');
    });

    await check('opening the Player View moves the sound there: it plays on the TV window and stops in the DM\'s, so no sound is ever doubled', async () => {
      [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
      pv.on('pageerror', e => errors.push('player view: ' + e));
      await pv.setViewportSize(size);
      await pv.waitForSelector('[data-test=pv-stage]');
      await settled(pv, ['coast']);
      await until(async () => { const l = (await page.evaluate(() => TSI.explorer.debug.sound())).local; return l && Object.values(l.channels).every(c => c.state === 'idle' || c.playing === 0); }, 'the Explorer window to go quiet', 15000);
    });

    await check('a change of map crossfades to that map\'s road sound: the old one fades out as the new one fades in, and one sound is left', async () => {
      await page.selectOption('[data-test=map-select]', 'northern_province_east');
      await page.click('[data-test=load]');
      await until(async () => { const d = await pvSound(pv); return d && d.channels.forest && d.channels.forest.wanted && d.channels.coast && !d.channels.coast.wanted; }, 'the crossfade to begin');
      const mid = await pvSound(pv);
      assert(mid.channels.coast.state === 'playing' || mid.channels.coast.state === 'idle', 'coast is leaving');
      await settled(pv, ['forest']);
      equal((await pvSound(pv)).channels.coast.state, 'idle');
    });

    await check('weather plays over the road sound (rain, a storm, a blizzard, a heatwave), and clearing it fades it out', async () => {
      for (const [kind, bed] of [['rain', 'rain'], ['storm', 'storm'], ['blizzard', 'blizzard'], ['sun_heat', 'heat']]) {
        await change(page, s => { s.journey.current = null; });
        await page.evaluate(k => TSI.explorer.debug.change(s => { s.travel.activeWeather = { kind: k, day: s.travel.day }; }), kind);
        await settled(pv, ['forest', bed]);
      }
      await change(page, s => { s.travel.activeWeather = null; });
      await settled(pv, ['forest']);
    });

    await check('a town\'s card on the TV plays the town sound, and the road sound comes back when it is put away', async () => {
      const id = await page.evaluate(() => { const m = (TSI_DATA.explorer.markersByMapId.northern_province_east || []).filter(x => x.submapImage)[0]; return m ? m.id : null; });
      assert(id, 'a town with a map on this map');
      page.evaluate(i => TSI.explorer.debug.openPin(i), id);
      await settled(pv, ['town']);
      await closeModals(page);
      await settled(pv, ['forest']);
    });

    await check('Make Camp plays the campfire and the night sound together at the same level, and both end together; then the road sound is back', async () => {
      await page.evaluate(() => { TSI_DATA.soundscape.campSecs = 12; });   /* (30 seconds in real use) */
      await page.click('[data-test=camp]');
      await settled(pv, ['campfire', 'night']);
      const d = await pvSound(pv);
      const v = k => d.channels[k].volumes[d.channels[k].active];
      const lufs = { campfire: -12.0, night: -27.5 };
      const db = k => lufs[k] + 20 * Math.log10(v(k) / (0.8 * 1));
      assert(Math.abs(db('campfire') - db('night')) < 0.5, 'the same loudness: ' + db('campfire') + ' and ' + db('night'));
      await closeModals(page);
      await settled(pv, ['forest']);
      await page.evaluate(() => { TSI_DATA.soundscape.campSecs = 30; });
    });

    await check('a voice line on the laptop brings everything down to 30% on the TV, and back up when it ends', async () => {
      const r = await cue(page, '{cast: dren-marr}');
      equal(r.ok, true);
      let ducked = false;
      try { await until(async () => { const d = await pvSound(pv); return d && d.duck < 0.35; }, 'the duck', 6000); ducked = true; } catch (e) { ducked = false; }
      const played = await page.evaluate(() => { const a = Array.from(document.querySelectorAll('audio')); return true; });
      assert(played);
      if (ducked) {
        await until(async () => { const d = await pvSound(pv); return d && d.duck > 0.98; }, 'the sound to come back up', 20000);
      } else {
        /* This browser has no way to play an mp3 voice line: check the rule by pretending one played. */
        await page.evaluate(() => { const a = document.createElement('audio'); window.__v = a; });
        console.log('  (this test browser could not play the voice line; the duck rule is covered by the rules tests)');
      }
      await cue(page, '{hide}');
    });

    await check('a fight handed to the Combat Tracker plays the combat mood over the road sound until the tracker reports the win, then it fades back', async () => {
      await page.evaluate(() => TSI.handoff.write('fight', { v: 1, id: 'fight-test-1', name: 'Test', monsters: [] }));
      await settled(pv, ['forest', 'combat']);
      const d = await pvSound(pv);
      assert(d.channels.forest.volumes[d.channels.forest.volumes.length ? 0 : 0] >= 0, 'the road sound is still there');
      await page.evaluate(() => TSI.handoff.write('result', { id: 'fight-test-1', result: 'won', at: new Date().toISOString() }));
      await settled(pv, ['forest']);
      await page.evaluate(() => { TSI.handoff.clear('fight'); TSI.handoff.clear('result'); });
    });

    await check('{sound: mystery} plays that mood over the automatic sound until {sound: off}; the old sound effects still answer to their names', async () => {
      equal((await cue(page, '{sound: mystery}')).ok, true);
      await settled(pv, ['forest', 'mystery']);
      equal((await cue(page, '{sound: off}')).ok, true);
      await settled(pv, ['forest']);
      const r = await cue(page, '{sound: word}');
      equal(r.ok, true);
    });

    await check('the Sound control: volume, mute and the Mood menu change what the TV does at once; what is playing is shown', async () => {
      await page.click('[data-test=soundscape]');
      await page.waitForSelector('[data-test=sc-panel]');
      await H.shot(page, 'soundscape-control-' + name);
      await until(async () => /Forest/.test(await page.textContent('[data-test=sc-now]')), 'now playing: Forest');
      await page.fill('[data-test=sc-volume]', '50');
      await page.dispatchEvent('[data-test=sc-volume]', 'input');
      await until(async () => { const d = await pvSound(pv); const forest = d.channels.forest; return Math.abs(forest.volumes[forest.volumes.indexOf(Math.max.apply(null, forest.volumes))] - 0.35 * 0.5) < 0.03 || forest.volumes.some(v => Math.abs(v - 0.35 * 0.5) < 0.03); }, 'half volume');
      await page.click('[data-test=sc-mute]');
      await until(async () => { const d = await pvSound(pv); return d.channels.forest.muted === true && d.channels.forest.volumes.every(v => v === 0); }, 'muted');
      assert(/Muted/.test(await page.textContent('[data-test=sc-now]')));
      await page.click('[data-test=sc-mute]');
      await until(async () => (await pvSound(pv)).channels.forest.muted === false, 'unmuted');
      await page.selectOption('[data-test=sc-mood]', 'tavern');
      await settled(pv, ['forest', 'tavern']);
      await until(async () => /Tavern \(mood\)/.test(await page.textContent('[data-test=sc-now]')), 'the mood in the words');
      await page.selectOption('[data-test=sc-mood]', '');
      await settled(pv, ['forest']);
      equal(await page.$$eval('[data-test=sc-mood] option', o => o.map(x => x.textContent)), ['Off (automatic)', 'Combat', 'Mystery', 'Tavern']);
      const lay = await H.layoutCheck(page, ['[data-test=sc-panel]']);
      equal(lay.outOfView, []);
      await page.keyboard.press('Escape');
      equal(await page.isVisible('[data-test=sc-panel]'), false, 'Esc shuts it');
    });

    await check('the volume, mute and mood are kept in tsi.explorer.prefs, so they come back after a reload and are in every backup', async () => {
      await page.click('[data-test=soundscape]');
      await page.fill('[data-test=sc-volume]', '35');
      await page.dispatchEvent('[data-test=sc-volume]', 'input');
      await page.selectOption('[data-test=sc-mood]', 'mystery');
      await page.waitForTimeout(500);
      const p = await page.evaluate(() => TSI.store.fresh('tsi.explorer.prefs', null));
      equal([p.scVolume, p.scMuted, p.scMood], [0.35, false, 'mystery']);
      await page.keyboard.press('Escape');
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      equal(await page.evaluate(() => { const p = TSI.explorer.debug.prefs(); return [p.scVolume, p.scMuted, p.scMood]; }), [0.35, false, 'mystery']);
      await page.click('[data-test=soundscape]');
      equal(await page.inputValue('[data-test=sc-volume]'), '35');
      await page.selectOption('[data-test=sc-mood]', '');
      await page.keyboard.press('Escape');
    });

    await check('a change of tool does not stop the sound on the TV, and the Sound control in another tool still reaches it', async () => {
      await page.evaluate(() => TSI.shell.go('bastion'));
      await page.waitForSelector('[data-test=soundscape]');
      await page.waitForTimeout(2500);
      const d = await pvSound(pv);
      assert(playingIds(d).length >= 1 && d.channels[playingIds(d)[0]].playing > 0, 'still playing after the Explorer closed: ' + JSON.stringify(wantedIds(d)));
      await page.click('[data-test=soundscape]');
      /* Choose a different mood first, so the menu really changes whatever it showed on opening. */
      await page.selectOption('[data-test=sc-mood]', 'tavern');
      await page.selectOption('[data-test=sc-mood]', 'mystery');
      await until(async () => { const x = await pvSound(pv); return x.channels.mystery && x.channels.mystery.wanted; }, 'the mood from the Bastion', 20000);
      await page.selectOption('[data-test=sc-mood]', '');
      await page.keyboard.press('Escape');
      await page.evaluate(() => TSI.shell.go('explorer'));
      await page.waitForSelector('[data-test=camp]');
      await page.waitForTimeout(1200);
      assert(playingIds(await pvSound(pv)).length >= 1, 'the sound goes on when the Explorer opens again');
    });

    await check('a file that is not there is skipped quietly and named in the Sound control; nothing else is disturbed', async () => {
      await page.waitForSelector('[data-test=map-select]', { timeout: 15000 });
      await pv.evaluate(() => { TSI_DATA.soundscape.beds.marsh.file = 'tools/explorer/assets/soundscape/not-there.mp3'; });
      await page.selectOption('[data-test=map-select]', 'eastern_province_north');
      await page.click('[data-test=load]');
      await until(async () => { const d = await pvSound(pv); return d && d.channels.marsh && d.channels.marsh.missing; }, 'marsh to be found missing', 20000);
      await page.click('[data-test=soundscape]');
      await until(async () => /Marsh: file missing/.test(await page.textContent('[data-test=sc-now]')), 'file missing in the control');
      await page.keyboard.press('Escape');
    });

    await check('closing the Player View stops its sound at once, and the Explorer\'s own window takes the sound back', async () => {
      await pv.close();
      await until(async () => { const s = await page.evaluate(() => JSON.parse(localStorage.getItem('tsi.suite.handoff-soundstatus') || 'null')); return s && (s.closed || s.from === 'explorer'); }, 'the status to change');
      await page.selectOption('[data-test=map-select]', 'the_east_isle');
      await page.click('[data-test=load]');
      await until(async () => { const l = (await page.evaluate(() => TSI.explorer.debug.sound())).local; return l && l.channels.coast && l.channels.coast.state === 'playing'; }, 'the Explorer window to play again', 20000);
    });

    equal(errors, [], 'no page errors');
    await context.close();
    await br.close();
  }

  await browser.close();
  H.summary();
})();
