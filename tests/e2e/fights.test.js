/* Explorer fights set up in the Combat Tracker (7 October 2026), clicked
   through from a double-clicked index.html with the internet off: the
   Explorer sends a fight, the Combat Tracker opens in a new window and loads
   it, the Battlemap shows its map, and when every enemy is down the Explorer
   hears about it. Also: the party level read again from the Bastion, a
   tracker already open in another window, Not now, and a reload part-way.
   Run with:  node tests/e2e/fights.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const FORD = 'tools/encounter/assets/battlemaps/ford-warm.png';
const CAMP = 'tools/encounter/assets/battlemaps/camp-warm.png';

async function go(page, tool) {
  await page.goto(INDEX + '?tool=' + tool);
  await page.waitForSelector('.tsi-topbar__tool');
  await page.waitForTimeout(500);
}
async function waitSaved(page) {
  await page.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
}
async function addLib(page, name, type, hp, init) {
  await page.fill('[data-test=new-name]', name);
  await page.selectOption('[data-test=new-type]', type);
  await page.fill('[data-test=new-max-hp]', String(hp));
  await page.fill('[data-test=new-init]', String(init));
  await page.click('[data-test=add-to-library]');
  await page.waitForTimeout(100);
}
async function setLevel(page, level) {
  await page.evaluate(n => TSI.bastion.debug.change(s => { s.partyLevel = n; }), level);
  await waitSaved(page);
}
async function startEvent(page, id) {
  assert(await page.evaluate(id => TSI.explorer.debug.startEvent(id), id), 'started ' + id);
  await page.waitForSelector('.tsi-modal.tsi-exp-journey');
}
async function jClick(page, test) {
  await page.waitForTimeout(380);
  await page.click('.tsi-modal.tsi-exp-journey [data-test="' + test + '"]');
  await page.waitForTimeout(100);
}
/* Done, then wait for the event window to close (a click inside the double-click guard is ignored, so try again)
   and for the Explorer to save it, so the next check's reload doesn't bring the event back. */
async function done(page) {
  for (let i = 0; i < 3; i++) {
    await jClick(page, 'event-done');
    try { await page.waitForSelector('.tsi-modal.tsi-exp-journey', { state: 'detached', timeout: 1500 }); } catch (e) { continue; }
    await waitSaved(page);
    return;
  }
  throw new Error('the event window didn\'t close');
}
const jText = (page, test) => page.$eval('.tsi-modal.tsi-exp-journey [data-test="' + test + '"]', e => e.textContent);
const jHas = (page, test) => page.$('.tsi-modal.tsi-exp-journey [data-test="' + test + '"]').then(Boolean);
const lines = (page, test) => page.$$eval('.tsi-modal [data-test="' + test + '"] li', ls => ls.map(l => l.textContent));
const enc = page => page.evaluate(() => TSI.encounter.debug.state());
const handoffs = page => page.evaluate(() => ({ fight: localStorage.getItem('tsi.suite.handoff'), result: localStorage.getItem('tsi.suite.handback') }));
async function modalTitle(page) {
  await page.waitForSelector('.tsi-modal__title', { timeout: 6000 });
  return page.textContent('.tsi-modal__title');
}
async function clickModal(page, label) {
  await page.waitForTimeout(400);
  await page.click('.tsi-modal__foot button:text-is("' + label + '")');
  await page.waitForTimeout(150);
}
async function openMap(page) {
  const [map] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-battlemap]')]);
  await map.waitForFunction(() => window.TSI && TSI.encounter && TSI.encounter.battlemap && TSI.encounter.battlemap.ready(), null, { timeout: 10000 });
  return map;
}
async function mapShown(map) {
  await map.waitForFunction(() => { const i = document.querySelector('[data-test=bm-map]'); return i && !i.hidden && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
  return map.$eval('[data-test=bm-map]', i => ({ src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight }));
}

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('A fight from the Explorer, set up in the Combat Tracker (laptop, internet off)');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    const page = await context.newPage();
    let tracker = null;
    let map = null;

    await check('getting ready: two PCs in the tracker\'s library, the Bastion at level 12', async () => {
      await go(page, 'encounter');
      await addLib(page, 'Kaelen', 'pc', 52, 3);
      await addLib(page, 'Elara', 'pc', 40, 2);
      await waitSaved(page);
      await go(page, 'bastion');
      await setLevel(page, 12);
      await go(page, 'explorer');
      await page.selectOption('[data-test=region]', 'southern_province');
      await waitSaved(page);
    });

    await check('the party level is read again from the Bastion, changed in another window after the Explorer opened', async () => {
      const other = await context.newPage();
      await go(other, 'bastion');
      await setLevel(other, 9);
      await other.close();
      await startEvent(page, 't2');
      await jClick(page, 'check-failure');
      await page.check('.tsi-modal [data-test=failed-kaelen]');
      await jClick(page, 'each-continue');
      await page.waitForFunction(() => /Party level 9/.test((document.querySelector('[data-test=fight-level]') || {}).textContent || ''), null, { timeout: 5000 });
      equal(await jText(page, 'fight-level'), 'Party level 9 (from the Bastion): the Levels 7–10 group.');
    });

    await check('the fight step shows the enemies, the battle map and who is surprised, with Set up as the main button', async () => {
      equal(await lines(page, 'fight-monsters'), ['1 × Bandit Captain (AC 15, 65 HP)', '2 × Veteran (AC 17, 58 HP)', '8 × Bandit (AC 12, 11 HP)']);
      equal(await jText(page, 'fight-map'), 'Battle map: The ford, Southern Province.');
      equal(await jText(page, 'fight-surprised'), 'Surprised in the first round: Kaelen.');
      const send = await page.$eval('.tsi-modal [data-test=fight-send]', b => ({ text: b.textContent, primary: b.classList.contains('tsi-btn--primary') }));
      equal(send, { text: 'Set up this fight in the Combat Tracker ↗', primary: true });
      equal(await page.$('.tsi-modal [data-test=open-tracker]'), null, 'the plain "open" button is only for fights with no set-up');
      const lay = await H.layoutCheck(page, ['.tsi-modal.tsi-exp-journey [data-test=fight-send]', '.tsi-modal.tsi-exp-journey [data-test=fight-won]', '.tsi-modal.tsi-exp-journey [data-test=fight-fled]']);
      equal(lay.outOfView, [], 'the buttons are in view');
      assert(lay.scrollWidth <= lay.clientWidth, 'no sideways scrolling');
      await H.shot(page, 'fights-explorer-laptop');
    });

    await check('Set up opens the Combat Tracker in a new window, which offers the fight', async () => {
      const [win] = await Promise.all([context.waitForEvent('page'), jClick(page, 'fight-send')]);
      tracker = win;
      await tracker.waitForLoadState();
      assert(/\?tool=encounter$/.test(tracker.url()), tracker.url());
      equal(await modalTitle(tracker), 'A fight from the Explorer');
      const body = await tracker.textContent('.tsi-modal');
      assert(/T2 The Ambush Sign · Southern Province/.test(body), body);
      assert(/Party level 9 \(from the Bastion\): the Levels 7–10 group\./.test(body), body);
      equal(await lines(tracker, 'handoff-monsters'), ['1 × Bandit Captain, 65 HP', '2 × Veteran, 58 HP', '8 × Bandit, 11 HP']);
      assert(/Battle map: The ford\./.test(body) && /Surprised in the first round: Kaelen\./.test(body), body);
      await H.shot(tracker, 'fights-tracker-offer');
      equal(await jHas(page, 'fight-sent'), true, 'the Explorer says it was sent');
      equal(await page.textContent('.tsi-modal [data-test=fight-send]'), 'Send it again ↗');
    });

    await check('Load the fight: the monsters join the encounter and the library, Kaelen is surprised, the map and grid are set', async () => {
      await clickModal(tracker, 'Load the fight');
      equal(await modalTitle(tracker), 'Fight loaded');
      const note = await tracker.textContent('.tsi-modal');
      assert(/Loaded 11 monsters and the battle map \(The ford\)\./.test(note) && /Marked Surprised for their first turn: Kaelen\./.test(note), note);
      assert(/Open the Battlemap to show the map/.test(note), note);
      await clickModal(tracker, 'OK');
      const s = await enc(tracker);
      equal(s.encounter.roster.map(c => c.name), ['Elara', 'Kaelen', 'Bandit Captain', 'Veteran', 'Veteran a', 'Bandit', 'Bandit a', 'Bandit b', 'Bandit c', 'Bandit d', 'Bandit e', 'Bandit f', 'Bandit g']);
      equal([s.encounter.name, s.encounter.status], ['T2 The Ambush Sign', 'ready']);
      equal(s.encounter.roster.find(c => c.name === 'Kaelen').conditions, [{ name: 'Surprised', remaining: 1 }]);
      equal(s.encounter.roster.find(c => c.name === 'Elara').conditions, []);
      const captain = s.library.find(x => x.name === 'Bandit Captain');
      equal([captain.type, captain.maxHp, captain.initBonus, captain.refLink], ['monster', 65, 3, 'https://www.dndbeyond.com/monsters?filter-search=Bandit%20Captain']);
      equal(await tracker.evaluate(() => TSI.store.get('tsi.encounter.mapImage')), FORD);
      const vtt = await tracker.evaluate(() => TSI.encounter.debug.vtt());
      equal([vtt.grid.show, vtt.grid.snap, Math.round(vtt.grid.size * 100) / 100, vtt.tokenSize], [true, true, 66.67, 67]);
      equal(Object.keys(vtt.tokenPos).length, 13);
      equal(await tracker.isHidden('[data-test=load-handoff]'), true);
      await waitSaved(tracker);
    });

    await check('the Battlemap shows the ford, with every token on a grid corner', async () => {
      map = await openMap(tracker);
      const shown = await mapShown(map);
      equal([shown.src, shown.w, shown.h], [FORD, 1448, 1086]);
      equal((await map.$$('[data-test=bm-token]')).length, 13);
      const v = await map.evaluate(() => TSI.encounter.battlemap.vtt());
      const size = v.grid.size;
      Object.values(v.tokenPos).forEach(p => {
        assert(Math.abs(p.x / size - Math.round(p.x / size)) < 1e-6 && Math.abs(p.y / size - Math.round(p.y / size)) < 1e-6, 'on a corner: ' + JSON.stringify(p));
      });
      await H.shot(map, 'fights-battlemap');
    });

    await check('every enemy down: the tracker says so, and the Explorer points at Won', async () => {
      await tracker.bringToFront();
      await tracker.click('[data-test=auto-init]');
      await tracker.waitForTimeout(400);
      await tracker.click('[data-test=begin]');
      const monsters = (await enc(tracker)).encounter.roster.filter(c => c.type === 'monster').map(c => c.encId);
      for (const id of monsters) {
        await tracker.waitForTimeout(400);
        await tracker.selectOption('[data-test=target]', id);
        await tracker.fill('[data-test=damage]', '999');
        await tracker.click('[data-test=complete-turn]');
      }
      await tracker.waitForTimeout(200);
      equal((await enc(tracker)).encounter.status, 'ended');
      await H.waitForNotice(tracker, /Every enemy is down\. The Explorer has been told/);
      const back = JSON.parse((await handoffs(tracker)).result);
      equal([back.result, back.id === (await enc(tracker)).encounter.handoff], ['won', true]);
      await page.waitForSelector('.tsi-modal [data-test=fight-report]', { timeout: 5000 });
      equal(await jText(page, 'fight-report'), 'The Combat Tracker reports: every enemy is down. Click Won to carry on.');
      equal(await page.$eval('.tsi-modal [data-test=fight-won]', b => b.classList.contains('tsi-btn--primary')), true);
      await H.shot(page, 'fights-explorer-reported');
    });

    await check('Won carries the event on, and the hand-off is cleared', async () => {
      await jClick(page, 'fight-won');
      assert(/\+150 gold/.test(await jText(page, 'journey-changes')));
      equal(await handoffs(page), { fight: null, result: null });
      await done(page);
    });

    await check('the tracker already open: the fight goes to it, Not now, then Load the Explorer\'s fight', async () => {
      await startEvent(page, 'c9');
      await jClick(page, 'check-failure');
      await jClick(page, 'choice-2');
      await jClick(page, 'check-failure');
      const before = context.pages().length;
      await jClick(page, 'fight-send');
      await H.waitForNotice(page, /already open in another window/);
      equal(context.pages().length, before, 'no second tracker');
      equal(await modalTitle(tracker), 'A fight from the Explorer');
      await clickModal(tracker, 'Not now');
      equal(await tracker.isVisible('[data-test=load-handoff]'), true);
      await tracker.click('[data-test=load-handoff]');
      equal(await modalTitle(tracker), 'A fight from the Explorer');
      await clickModal(tracker, 'Load the fight');
      await clickModal(tracker, 'OK');
      const s = await enc(tracker);
      /* The PCs stay where the last fight's initiative put them. */
      equal(s.encounter.roster.slice(0, 2).map(c => c.name).sort(), ['Elara', 'Kaelen']);
      equal(s.encounter.roster.slice(2).map(c => c.name), ['Debt Collector', 'Ogre', 'Ogre a']);
      equal(s.encounter.roster.find(c => c.name === 'Kaelen').conditions, [], 'nobody is surprised this time');
      await map.waitForFunction(src => document.querySelector('[data-test=bm-map]').getAttribute('src') === src, CAMP, { timeout: 5000 });
      equal((await mapShown(map)).src, CAMP, 'the open Battlemap switched to the camp');
      equal((await map.$$('[data-test=bm-token]')).length, 5);
    });

    await check('a reload part-way: the event comes back still sent; Fled clears it, and the tracker\'s button goes', async () => {
      await page.reload();
      await page.waitForSelector('.tsi-modal.tsi-exp-journey', { timeout: 8000 });
      equal(await jHas(page, 'fight-sent'), true);
      equal(await page.textContent('.tsi-modal [data-test=fight-send]'), 'Send it again ↗');
      await jClick(page, 'fight-send');
      await H.waitForNotice(page, /already open/);
      equal(await modalTitle(tracker), 'A fight from the Explorer');
      await clickModal(tracker, 'Not now');
      equal(await tracker.isVisible('[data-test=load-handoff]'), true);
      await jClick(page, 'fight-fled');
      equal(await handoffs(page), { fight: null, result: null });
      await tracker.waitForSelector('[data-test=load-handoff]', { state: 'hidden', timeout: 5000 });
      await done(page);
    });

    await check('a fight left waiting by an event that\'s no longer on is cleared when the Explorer opens', async () => {
      await page.evaluate(() => localStorage.setItem('tsi.suite.handoff', JSON.stringify({ v: 1, id: 'fight-old', from: 'explorer' })));
      await go(page, 'explorer');
      equal(await handoffs(page), { fight: null, result: null });
      await tracker.waitForSelector('[data-test=load-handoff]', { state: 'hidden', timeout: 5000 });
    });

    await check('near the sea a road fight is fought in the cove, and T2 only comes up near a river', async () => {
      await go(page, 'explorer');
      await page.selectOption('[data-test=region]', 'western_province');
      await page.selectOption('[data-test=map-select]', 'western_province_south');
      await page.click('[data-test=load]');
      await page.waitForTimeout(300);
      const atPin = (mapId, pinId) => page.evaluate(([mapId, pinId]) => {
        const p = TSI_DATA.explorer.markersByMapId[mapId].find(m => m.id === pinId);
        TSI.explorer.debug.state().tokens.forEach(t => { t.x = p.x; t.y = p.y; });
        const J = TSI.explorer.journey;
        return J.pool(TSI_DATA.journeyEvents, 'travel', J.context(TSI.explorer.debug.state(), TSI_DATA.journeyEvents)).map(ev => ev.id);
      }, [mapId, pinId]);
      const pool = await atPin('western_province_south', 'redport');
      assert(pool.indexOf('t2') === -1, 'no T2 at Redport: ' + pool);
      await startEvent(page, 'f1');
      await jClick(page, 'each-continue');
      await jClick(page, 'choice-0');
      equal(await jText(page, 'fight-map'), 'Battle map: The cove, Western Province (the party is near the sea).');
      await jClick(page, 'fight-fled');
      await done(page);
      await atPin('western_province_south', 'shadowhall');
      await startEvent(page, 'f1');
      await jClick(page, 'each-continue');
      await jClick(page, 'choice-0');
      equal(await jText(page, 'fight-map'), 'Battle map: The road, Western Province.', 'inland, the road');
      await jClick(page, 'fight-fled');
      await done(page);
    });

    await check('nothing failed, and nothing reached for the internet', async () => {
      equal(context.log.errors, []);
      equal(context.log.failed, []);
      equal(context.log.net, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The fight step on the TV and in full screen');
  for (const size of ['tv', 'laptopFull']) {
    if (!H.SIZES[size]) continue;
    await check(size + ': the set-up box and its buttons fit', async () => {
      const context = await H.newContext(browser, size);
      await context.setOffline(true);
      const page = await context.newPage();
      await go(page, 'explorer');
      await page.selectOption('[data-test=region]', 'the_north_isle');
      await startEvent(page, 'c12');
      await jClick(page, 'check-success');
      await jClick(page, 'choice-1');
      await jClick(page, 'check-failure');
      equal(await jText(page, 'fight-map'), 'Battle map: The cove, The North Isle.');
      equal(await jText(page, 'fight-level'), 'Party level 7 (the Bastion hasn\'t saved a level yet): the Levels 7–10 group.');
      const lay = await H.layoutCheck(page, ['.tsi-modal.tsi-exp-journey [data-test=fight-send]', '.tsi-modal.tsi-exp-journey [data-test=fight-fled]']);
      equal(lay.outOfView, []);
      assert(lay.scrollWidth <= lay.clientWidth, 'no sideways scrolling');
      await H.shot(page, 'fights-explorer-' + size);
      equal(context.log.errors, []);
      await context.close();
    });
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
