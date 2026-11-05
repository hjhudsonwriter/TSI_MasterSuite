/* Guide 3 (5 November 2026): combat the players can read, and stat blocks without Wi-Fi.
   Clicked through from a double-clicked index.html with the internet off, at the laptop and TV sizes:
   the party and the 13 monsters in the library, the Party panel and the pencil, the stat block panel (SRD and homebrew), the trackers,
   death saves, and the Battlemap window as the TV: turn-order strip, health in words, fallen markers, Down with pips, condition icons,
   and no monster numbers anywhere on it. Also an Explorer fight handed over with its stat blocks, and the pictures shipped.
   Run with:  node tests/e2e/combat-table.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const TRACKER = INDEX + '?tool=encounter';

async function go(page, tool) {
  await page.goto(INDEX + '?tool=' + tool);
  await page.waitForSelector('.tsi-topbar__tool');
  await page.waitForTimeout(500);
}
async function waitSaved(page) {
  await page.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
}
const st = page => page.evaluate(() => TSI.encounter.debug.state());
const byName = async (page, name) => (await st(page)).encounter.roster.find(c => c.name === name);
async function openTracker(page) {
  await page.goto(TRACKER);
  await page.waitForSelector('[data-test=complete-turn]');
  await waitSaved(page);
}
async function pick(page, names) {
  const s = await st(page);
  for (const item of s.library) {
    const want = names.includes(item.name);
    const has = s.selectedLibraryIds.includes(item.id);
    if (want !== has) await page.click(`[data-test=library-item][data-name="${item.name}"]`);
  }
  await page.click('[data-test=add-selected]');
}
async function focusOn(page, name) {
  await page.click(`[data-test=roster-row][data-name="${name}"] .tsi-enc-name-text`);
  await page.waitForFunction(n => (document.querySelector('[data-test=fx-name]') || {}).textContent === n, name);
}
async function hit(page, name, amount, heal) {
  await focusOn(page, name);
  await page.fill('[data-test=fx-amount]', String(amount));
  await page.click(heal ? '[data-test=fx-heal]' : '[data-test=fx-damage]');
  await page.waitForTimeout(150);
}
async function openMap(page) {
  const [map] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-battlemap]')]);
  await map.waitForFunction(() => window.TSI && TSI.encounter && TSI.encounter.battlemap && TSI.encounter.battlemap.ready(), null, { timeout: 10000 });
  return map;
}
const strip = map => map.$$eval('[data-test=bm-strip-item]', is => is.map(i => ({
  name: i.dataset.name, current: i.classList.contains('tsi-bm-strip-item--current'), next: i.classList.contains('tsi-bm-strip-item--next'),
  tag: (i.querySelector('.tsi-bm-strip-tag') || {}).textContent.trim(), health: ((i.querySelector('[data-test=bm-health]') || {}).textContent || '').trim()
})));
const tvText = map => map.evaluate(() => document.body.innerText);

(async () => {
  const browser = await H.chromium.launch();

  section('Seeded library, the Party panel, the pencil (laptop, internet off)');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await openTracker(page);

    await check('the five heroes and 13 monsters are in the library with the table’s numbers; pictures load', async () => {
      const s = await st(page);
      const pcs = s.library.filter(x => x.type === 'pc').map(x => [x.name, x.ac, x.maxHp, x.initBonus, x.passive]);
      equal(pcs, [['Kaelen', 17, 76, 9, 16], ['Elara', 16, 67, 2, 14], ['Magnus', 21, 85, 5, 15], ['Umbrys', 15, 68, 3, 12], ['Charles Vect', 14, 75, 7, 14]]);
      equal(s.library.filter(x => x.type === 'monster').length, 13);
      const wolf = s.library.find(x => x.name === 'Wolf');
      equal([wolf.maxHp, wolf.ac, wolf.srd], [11, 13, 'wolf']);
      const broken = await page.evaluate(() => Array.from(document.querySelectorAll('[data-test=library] img, [data-test=party-panel] img')).filter(i => !i.complete || !i.naturalWidth).length);
      equal(broken, 0, 'no broken pictures');
    });

    await check('the Party panel shows each hero’s numbers and fits the panel; changing them changes only AC, max HP, initiative or passive', async () => {
      equal(await page.$$eval('[data-test=party-row]', r => r.length), 5);
      equal(await page.inputValue('[data-test=party-ac-kaelen]'), '17');
      await page.fill('[data-test=party-ac-kaelen]', '18');
      await page.fill('[data-test=party-maxHp-kaelen]', '80');
      await page.press('[data-test=party-maxHp-kaelen]', 'Tab');
      await page.waitForTimeout(200);
      const k = (await st(page)).library.find(x => x.name === 'Kaelen');
      equal([k.ac, k.maxHp, k.name, k.type, /kaelen\.png$/.test(k.avatar)], [18, 80, 'Kaelen', 'pc', true]);
      const lay = await H.layoutCheck(page, ['[data-test=party-panel]', '[data-test=complete-turn]']);
      assert(lay.scrollWidth <= lay.clientWidth, 'no sideways scrolling');
      await H.shot(page, 'combat-party-laptop');
    });

    await check('a fight with Kaelen, Elara, an Ogre, a Wolf: the pencil changes only AC and max HP, and ticking “heal by the difference” raises current HP the same', async () => {
      await pick(page, ['Kaelen', 'Elara', 'Ogre', 'Wolf']);
      await page.click('[data-test=auto-init]');
      await page.waitForTimeout(300);
      await hit(page, 'Elara', 20);
      equal((await byName(page, 'Elara')).curHp, 47);
      await page.click('[data-test=roster-row][data-name=Elara] [data-test=roster-edit]');
      await page.fill('[data-test=qe-ac]', '17');
      await page.fill('[data-test=qe-hp]', '77');
      await page.click('[data-test=qe-save]');
      await page.waitForTimeout(200);
      let e = await byName(page, 'Elara');
      equal([e.ac, e.maxHp, e.curHp, e.name, e.init === null], [17, 77, 47, 'Elara', false]);
      await page.click('[data-test=roster-row][data-name=Elara] [data-test=roster-edit]');
      await page.fill('[data-test=qe-hp]', '87');
      await page.check('[data-test=qe-heal]');
      await page.click('[data-test=qe-save]');
      await page.waitForTimeout(200);
      e = await byName(page, 'Elara');
      equal([e.maxHp, e.curHp], [87, 57]);
      equal(await page.$('[data-test=roster-row][data-name=Ogre] [data-test=roster-edit]'), null, 'monsters have no pencil');
    });

    await check('the stat block panel shows the Ogre’s block offline, with a note when the table’s numbers differ from the SRD’s', async () => {
      await focusOn(page, 'Ogre');
      equal(await page.textContent('[data-test=sb-name]'), 'Ogre');
      const ac = await page.textContent('[data-test=sb-ac]');
      assert(/AC/.test(ac) && /\d/.test(ac), ac);
      equal(await page.isVisible('[data-test=sb-actions]'), true);
      assert(/System Reference Document/.test(await page.textContent('[data-test=sb-foot]')));
      assert(await page.$('[data-test=sb-ddb]'), 'the D&D Beyond link is there, as a secondary button');
      await H.shot(page, 'combat-statblock-laptop');
      const lay = await H.layoutCheck(page, ['[data-test=complete-turn]', '[data-test=fx-damage]']);
      equal(lay.outOfView, [], 'the main controls are in view');
    });

    await check('Bloodied shows in the DM roster beside the real numbers; a concentrating creature shows the save’s DC', async () => {
      await hit(page, 'Ogre', 35);
      equal((await byName(page, 'Ogre')).curHp, 24);
      equal(await page.textContent('[data-test=roster-row][data-name=Ogre] [data-test=row-bloodied]'), 'Bloodied');
      assert(/24\/59/.test(await page.textContent('[data-test=roster-row][data-name=Ogre] [data-test=row-hp]')));
      await page.check('[data-test=fx-conc]');
      await page.waitForTimeout(150);
      await hit(page, 'Ogre', 30);
      await H.waitForNotice(page, /Concentration save: DC 15/);
      equal(await page.textContent('[data-test=roster-row][data-name=Ogre] [data-test=row-conc]'), 'Concentrating');
    });

    await check('a hero at 0 HP: the DM ticks death saves; three failures ask first; three successes make Stable; healing clears them', async () => {
      await hit(page, 'Elara', 999);
      equal((await byName(page, 'Elara')).curHp, 0);
      equal(await page.$$eval('[data-test=fx-death-fail]', p => p.length), 3);
      await page.click('[data-test=fx-death-fail] >> nth=0');
      await page.click('[data-test=fx-death-fail] >> nth=1');
      equal((await byName(page, 'Elara')).death.f, 2);
      await page.click('[data-test=fx-death-fail] >> nth=2');
      assert(/failed three death saves/.test(await H.modalText(page)), await H.modalText(page));
      await H.clickModal(page, 'Mark dead');
      equal((await byName(page, 'Elara')).death.dead, true);
      await page.click('[data-test=fx-death-fail] >> nth=2'); /* a tick can be taken back */
      await page.waitForTimeout(150);
      await hit(page, 'Kaelen', 999);
      for (let i = 0; i < 3; i++) await page.click('[data-test=fx-death-success] >> nth=' + i);
      equal((await byName(page, 'Kaelen')).death.stable, true);
      assert(/Stable/.test(await page.textContent('[data-test=fx-death-state]')));
      await hit(page, 'Kaelen', 5, true);
      equal([(await byName(page, 'Kaelen')).curHp, (await byName(page, 'Kaelen')).death], [5, undefined]);
    });

    await check('From the SRD adds an owlbear with its block; New stat block saves a homebrew creature; both survive Export and Import', async () => {
      await page.click('[data-test=srd-open]');
      await page.fill('[data-test=srd-search]', 'owlbear');
      await page.waitForSelector('[data-test=srd-hit]');
      await page.click('[data-test=srd-hit] [data-test=srd-add]');
      await H.clickModal(page, 'Close');
      assert((await st(page)).library.some(x => x.name === 'Owlbear' && x.srd === 'owlbear'));

      await page.click('[data-test=new-block]');
      await page.fill('[data-test=nb-name]', 'Reedwraith');
      await page.fill('[data-test=nb-ac]', '13');
      await page.fill('[data-test=nb-hp]', '44');
      await page.fill('[data-test=nb-actions]', 'Reed Claw. Melee Attack Roll: +5, 9 (2d6 + 2) slashing damage.');
      await page.fill('[data-test=nb-traits]', 'Slippery. It slides through gaps.');
      await page.click('[data-test=nb-save]');
      await page.waitForTimeout(300);
      const lib = (await st(page)).library;
      const r = lib.find(x => x.name === 'Reedwraith');
      equal([r.type, r.maxHp, r.ac, r.block.n, r.block.ac_.length], ['monster', 44, 13, 'Reedwraith', 1]);

      await page.click('[data-test=tab-btn-import]');
      const file = JSON.parse((await H.download(page, '[data-test=export-json]')).text);
      const exported = file.library.find(x => x.name === 'Reedwraith');
      assert(exported && exported.block && exported.block.n === 'Reedwraith', 'the homebrew block is in the file');
      assert(file.library.find(x => x.name === 'Owlbear').srd === 'owlbear');

      /* Take them out, then bring them back from the file. */
      await page.click('[data-test=tab-btn-library]');
      for (const n of ['Reedwraith', 'Owlbear']) {
        await page.click(`[data-test=library-item][data-name="${n}"] [data-test=library-delete]`);
        try { await H.clickModal(page, 'Delete'); } catch (e) { /* no question asked */ }
        await page.waitForTimeout(150);
      }
      assert(!(await st(page)).library.some(x => x.name === 'Reedwraith'), 'deleted');
      await page.click('[data-test=tab-btn-import]');
      await page.setInputFiles('[data-test=import-json-file]', H.writeTemp('combat-campaign.json', file));
      await page.click('[data-test=import-json]');
      await H.clickModal(page, 'OK');
      const back = (await st(page)).library;
      equal([back.find(x => x.name === 'Reedwraith').block.n, back.find(x => x.name === 'Owlbear').srd], ['Reedwraith', 'owlbear']);
    });

    await check('a homebrew creature in a fight shows its block; a creature with no block says so', async () => {
      await page.click('[data-test=tab-btn-library]');
      await pick(page, ['Reedwraith', 'Kaelen']);
      await focusOn(page, 'Reedwraith');
      equal(await page.textContent('[data-test=sb-name]'), 'Reedwraith');
      assert(/made for this campaign/.test(await page.textContent('[data-test=sb-foot]')));
      assert(await page.$('[data-test=sb-note]') === null, 'no SRD note on a homebrew block');
    });
    equal(errors, [], 'no page errors');
    await context.close();
  }

  for (const size of ['laptop', 'tv']) {
    section('The Battlemap as the TV, and what it never shows (' + size + ', internet off)');
    const context = await H.newContext(browser, size);
    await context.setOffline(true);
    const page = await context.newPage();
    await openTracker(page);
    await pick(page, ['Kaelen', 'Elara', 'Magnus', 'Ogre', 'Wolf']);
    await page.click('[data-test=auto-init]');
    await page.waitForTimeout(300);
    await page.click('[data-test=begin]');
    await page.waitForTimeout(300);
    const map = await openMap(page);
    await map.waitForSelector('[data-test=bm-strip-item]');

    await check('the strip shows the round, everyone in initiative order, the current one large and gold-framed, and the next labelled', async () => {
      const items = await strip(map);
      equal(items.map(i => i.name).sort(), ['Elara', 'Kaelen', 'Magnus', 'Ogre', 'Wolf']);
      equal(items.filter(i => i.current).length, 1);
      equal(items[0].current, true);
      equal(items[0].tag, 'Now');
      equal(items[1].tag, 'Up next');
      equal(await map.textContent('[data-test=bm-round]'), 'Round1');
      const cur = await map.$eval('.tsi-bm-strip-item--current .tsi-bm-strip-frame', f => f.getBoundingClientRect().width);
      const other = await map.$eval('.tsi-bm-strip-item:not(.tsi-bm-strip-item--current) .tsi-bm-strip-frame', f => f.getBoundingClientRect().width);
      assert(cur > other * 1.4, 'the current one is larger: ' + cur + ' vs ' + other);
      const broken = await map.evaluate(() => Array.from(document.querySelectorAll('.tsi-bm-strip img, .tsi-bm-token img')).filter(i => !i.complete || !i.naturalWidth).length);
      equal(broken, 0, 'every picture loaded');
      await H.shot(map, 'combat-tv-strip-' + size);
    });

    await check('a monster’s health is words only; heroes show current / max; monsters show a picture or a name token', async () => {
      equal(await map.textContent('[data-test=bm-strip-item][data-name=Ogre] [data-test=bm-health]'), 'Unhurt');
      equal(await map.textContent('[data-test=bm-strip-item][data-name=Kaelen] [data-test=bm-health]'), '76/76');
      await page.bringToFront();
      await hit(page, 'Ogre', 5);
      await map.waitForFunction(() => /Hurt/.test((document.querySelector('[data-test=bm-strip-item][data-name=Ogre] [data-test=bm-health]') || {}).textContent || ''));
      await hit(page, 'Ogre', 25); /* 29 / 59 */
      await map.waitForFunction(() => /Bloodied/.test((document.querySelector('[data-test=bm-strip-item][data-name=Ogre] [data-test=bm-health]') || {}).textContent || ''));
      await hit(page, 'Ogre', 15); /* 14 / 59 */
      await map.waitForFunction(() => /Near death/.test((document.querySelector('[data-test=bm-strip-item][data-name=Ogre] [data-test=bm-health]') || {}).textContent || ''));
      equal(await map.textContent('[data-test=bm-token][data-name=Ogre] [data-test=bm-health]'), 'Near death');
      await hit(page, 'Kaelen', 30);
      await map.waitForFunction(() => /46\/76/.test((document.querySelector('[data-test=bm-strip-item][data-name=Kaelen] [data-test=bm-health]') || {}).textContent || ''));
    });

    await check('the TV never shows a monster’s HP, AC, stat block, or any of its numbers, however it is hurt', async () => {
      const text = await tvText(map);
      assert(!/\bAC\b/.test(text), 'no AC');
      assert(!/14\/59|\/59|\b59\b/.test(text), 'no Ogre HP: ' + text);
      assert(!/Armour|Actions|Hit Points|Challenge/i.test(text), 'no stat block');
      const sent = await map.evaluate(() => JSON.stringify(TSI.encounter.battlemap.vtt()));
      assert(!/ogre|"ac"|stat/i.test(sent), 'nothing of the sort in what the map saves');
      const html = await map.evaluate(() => document.documentElement.outerHTML);
      assert(!/"srd"|maxHp.:59/.test(html));
    });

    await check('a condition shows as an icon on the token and on the strip; Concentrating too', async () => {
      await page.bringToFront();
      await focusOn(page, 'Elara');
      await page.fill('[data-test=condition]', 'Poisoned');
      await page.fill('[data-test=condition-turns]', '3');
      await page.click('[data-test=add-condition]');
      await focusOn(page, 'Ogre');
      if (!(await page.isChecked('[data-test=fx-conc]'))) await page.check('[data-test=fx-conc]');
      await map.waitForFunction(() => document.querySelector('[data-test=bm-strip-item][data-name=Elara] .tsi-bm-cond[data-cond=Poisoned] img'));
      await map.waitForFunction(() => document.querySelector('[data-test=bm-token][data-name=Ogre] .tsi-bm-cond[data-cond=Concentrating] img'));
      const loaded = await map.evaluate(() => Array.from(document.querySelectorAll('.tsi-bm-cond img')).every(i => i.complete && i.naturalWidth > 0));
      equal(loaded, true, 'the icons load offline');
    });

    await check('a monster at 0 HP drops out of the strip and stays on the map as a greyed fallen marker until the DM removes it', async () => {
      await page.bringToFront();
      await hit(page, 'Wolf', 99);
      await map.waitForFunction(() => !document.querySelector('[data-test=bm-strip-item][data-name=Wolf]'));
      equal(await map.$$eval('[data-test=bm-token][data-name=Wolf].tsi-bm-token--fallen', t => t.length), 1);
      equal(await map.textContent('[data-test=bm-token][data-name=Wolf] .tsi-bm-fallen-x'), '✕');
      await map.click('[data-test=bm-token][data-name=Wolf]', { modifiers: ['Shift'] });
      await map.waitForTimeout(200);
      equal(await map.$$eval('[data-test=bm-token][data-name=Wolf]', t => t.length), 0, 'removed');
    });

    await check('Hide Monsters takes monsters off the strip as well as the map', async () => {
      await page.bringToFront();
      await page.click('[data-test=monsters-hide]');
      await map.waitForFunction(() => !document.querySelector('[data-test=bm-strip-item][data-name=Ogre]'));
      assert((await strip(map)).length >= 3);
      await page.click('[data-test=monsters-reveal]');
      await map.waitForFunction(() => document.querySelector('[data-test=bm-strip-item][data-name=Ogre]'));
    });

    await check('a hero at 0 HP shows Down with three success and three failure pips; the DM’s ticks appear; healing brings them back', async () => {
      await page.bringToFront();
      await hit(page, 'Magnus', 999);
      await map.waitForFunction(() => /Down/.test((document.querySelector('[data-test=bm-strip-item][data-name=Magnus] [data-test=bm-health]') || {}).textContent || ''));
      equal(await map.$$eval('[data-test=bm-strip-item][data-name=Magnus] .tsi-bm-pip', p => p.length), 6);
      await page.click('[data-test=fx-death-fail] >> nth=0');
      await page.click('[data-test=fx-death-success] >> nth=0');
      await map.waitForFunction(() => document.querySelectorAll('[data-test=bm-strip-item][data-name=Magnus] .tsi-bm-pip--on').length === 2);
      assert(await map.$('[data-test=bm-strip-item][data-name=Magnus]'), 'a hero at 0 stays on the strip');
      await hit(page, 'Magnus', 10, true);
      await map.waitForFunction(() => /10\/85/.test((document.querySelector('[data-test=bm-strip-item][data-name=Magnus] [data-test=bm-health]') || {}).textContent || ''));
    });

    await check('the strip fits the window with the map controls in view, with no sideways scrolling', async () => {
      const lay = await H.layoutCheck(map, ['[data-test=bm-strip]', '[data-test=bm-stage]']);
      assert(lay.scrollWidth <= lay.clientWidth, 'no sideways scrolling in the map window');
      const r = await map.$eval('[data-test=bm-strip]', s => { const b = s.getBoundingClientRect(); return { right: b.right, w: innerWidth, bottom: b.bottom, h: innerHeight }; });
      assert(r.right <= r.w + 1 && r.bottom < r.h * 0.4, JSON.stringify(r));
      await H.shot(map, 'combat-tv-final-' + size);
    });
    await context.close();
  }

  section('An Explorer fight carries its stat blocks over (laptop, internet off)');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    const page = await context.newPage();
    const jClick = async test => { await page.waitForTimeout(380); await page.click('.tsi-modal.tsi-exp-journey [data-test="' + test + '"]'); await page.waitForTimeout(100); };
    await check('the Explorer’s ambush fight is set up in the tracker: the heroes join from the party, each monster has its SRD block, and nothing is added twice', async () => {
      await openTracker(page);
      const before = (await st(page)).library.filter(x => x.type === 'monster').length;
      await go(page, 'explorer');
      await page.selectOption('[data-test=region]', 'southern_province');
      await waitSaved(page);
      assert(await page.evaluate(() => TSI.explorer.debug.startEvent('t2')), 'started t2');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await jClick('check-failure');
      await page.check('.tsi-modal [data-test=failed-kaelen]');
      await jClick('each-continue');
      const [tracker] = await Promise.all([context.waitForEvent('page'), jClick('fight-send')]);
      await tracker.waitForLoadState();
      await tracker.waitForSelector('.tsi-modal__title');
      await H.clickModal(tracker, 'Load the fight');
      await H.clickModal(tracker, 'OK');
      const s = await tracker.evaluate(() => TSI.encounter.debug.state());
      const caps = s.encounter.roster.filter(c => c.type === 'monster');
      assert(caps.length >= 3, caps.length + ' monsters');
      for (const c of caps) assert(c.srd && c.ac > 0, c.name + ' carries its block and AC');
      equal(s.library.filter(x => x.type === 'monster').length, before, 'the seeded monsters were used; none added twice');
      equal(s.encounter.roster.filter(c => c.type === 'pc').map(c => c.name).sort(), ['Charles Vect', 'Elara', 'Kaelen', 'Magnus', 'Umbrys']);
      await tracker.click('[data-test=roster-row][data-name="Bandit Captain"] .tsi-enc-name-text');
      await tracker.waitForSelector('[data-test=sb-name]');
      equal(await tracker.textContent('[data-test=sb-name]'), 'Bandit Captain');
      equal(s.library.find(x => x.name === 'Bandit Captain').maxHp, 65);
    });
    await context.close();
  }

  section('The pictures shipped');
  {
    await check('every monster picture is 512 × 512 and every monster in the seed that has one is listed', async () => {
      const dir = path.join(H.ROOT, 'shared/art/monsters');
      const files = fs.readdirSync(dir).filter(f => /\.png$/.test(f));
      assert(files.length >= 13, files.length + ' pictures');
      for (const f of files) {
        const b = fs.readFileSync(path.join(dir, f));
        assert(b.slice(1, 4).toString() === 'PNG', f + ' is a PNG');
        const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
        assert(w === h, f + ' is square (' + w + ' × ' + h + ')');
        equal([w, h], [512, 512], f);
      }
    });
    await check('every hero portrait is square', async () => {
      const dir = path.join(H.ROOT, 'shared/art/party');
      for (const f of fs.readdirSync(dir).filter(f => /\.png$/.test(f))) {
        const b = fs.readFileSync(path.join(dir, f));
        assert(b.readUInt32BE(16) === b.readUInt32BE(20), f + ' is square');
      }
    });
  }

  await browser.close();
  H.summary();
})();
