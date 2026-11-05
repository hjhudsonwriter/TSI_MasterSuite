/* Explorer: town banners and quest markers (guide 6A, 4 November 2026), from files with the internet off, at the laptop and the TV.
   Checks: every pin that shows on each of the 10 province maps has a banner with the right shield and name; clicking a banner opens
   the town map as the pin does; the DM changes a town's clan (and the Player View follows at once); quest markers are placed,
   edited, dragged and finished, and the Player View shows only the "!"; everything survives a reload; and the campaign backups hold
   both saved items.
   Run with:  node tests/e2e/explorer-banners.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const PLAYER = H.fileUrl('player.html') + '?view=explorer';
const pins = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.pins())));
const loadMap = async (page, id) => { await page.selectOption('[data-test=map-select]', id); await page.click('[data-test=load]'); await page.waitForTimeout(350); };
const dismiss = async page => { for (let k = 0; k < 6 && await page.$('.tsi-modal'); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };
const stageBox = page => page.$eval('.tsi-exp-stage', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  return pv;
}
/* Wait for the players' window to show something (the DM's window sends it after a short moment). */
const pvWait = (pv, fn, arg) => pv.waitForFunction(fn, arg, { timeout: 6000 });

(async () => {
  const browser = await H.chromium.launch();
  const MAPS = ['the_east_isle', 'the_north_isle', 'midland_province', 'eastern_province_north', 'eastern_province_south', 'southern_province_east', 'northern_province_east', 'northern_province_west', 'southern_province_west', 'western_province_south'];

  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Town banners and quest markers at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name, { acceptDownloads: true });
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    /* Colour reveal (guide 6B) hides unexplored towns from the players, so these checks run with the fog off; the fog's own test is explorer-fog.test.js. */
    await page.evaluate(() => TSI.explorer.debug.setFogMode('off'));

    await check('all 10 province maps: every pin that shows has a banner with its town\'s name and its province\'s clan shield (a plain nameplate where Harry\'s table has no clan)', async () => {
      const want = await page.evaluate(() => TSI_DATA.townClans);
      let seen = 0;
      for (const id of MAPS) {
        await loadMap(page, id);
        const banners = await page.$$eval('.tsi-exp-banner', n => n.map(b => ({ id: b.dataset.test.replace('banner-', ''), clan: b.dataset.clan, name: b.querySelector('.tsi-exp-banner__name').textContent, shield: !!b.querySelector('img') && b.querySelector('img').complete && b.querySelector('img').naturalWidth > 0 })));
        const shown = await page.$$eval('.tsi-exp-pin', n => n.map(p => p.dataset.id));
        equal(banners.map(b => b.id), shown, id + ': one banner for each pin');
        banners.forEach(b => {
          equal(b.clan, want[b.id] || '', id + ' / ' + b.id);
          equal(b.shield, !!want[b.id], id + ' / ' + b.id + ' shield picture');
          assert(b.name.length > 1, 'a name');
        });
        seen += banners.length;
      }
      equal(seen, 24, 'the 24 pins that show today (those with a town or temple picture, and the ports waiting for theirs)');
    });

    await check('no banner covers its pin, another banner, or a pin\'s click target', async () => {
      await loadMap(page, 'midland_province');
      const boxes = await page.$$eval('.tsi-exp-banner, .tsi-exp-pin', n => n.map(e => { const r = e.getBoundingClientRect(); return { k: e.className, id: e.dataset.id || e.dataset.test, l: r.left, t: r.top, r: r.right, b: r.bottom }; }));
      const banners = boxes.filter(b => /banner/.test(b.k)), pinBoxes = boxes.filter(b => /exp-pin/.test(b.k));
      banners.forEach((a, i) => {
        banners.slice(i + 1).forEach(b => assert(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t, 'two banners overlap: ' + a.id + ' ' + b.id));
        pinBoxes.forEach(p => assert(a.r <= p.l || p.r <= a.l || a.b <= p.t || p.b <= a.t, 'a banner covers a pin: ' + a.id + ' ' + p.id));
      });
    });

    await check('clicking a banner opens the town map, as clicking the pin does', async () => {
      await loadMap(page, 'midland_province');
      await page.click('[data-test=banner-open-middlemount]');
      await page.waitForSelector('.tsi-modal img');
      assert((await page.textContent('.tsi-modal')).includes('Middlemount'), 'the town picture');
      await dismiss(page);
    });

    const pv = await openPlayer(page, size);
    await check('the Player View shows the same banners: name, shield, plain where there is no clan; no cog or controls', async () => {
      await pvWait(pv, () => document.querySelectorAll('.tsi-xpv-banner').length > 0);
      const b = await pv.$$eval('.tsi-xpv-banner', n => n.map(x => ({ id: x.dataset.id, clan: x.dataset.clan, name: x.textContent.trim(), img: !!x.querySelector('img') })));
      equal(b.map(x => [x.id, x.clan, x.img]), [['temple_telluria', '', false], ['river_rook', '', false], ['middlemount', 'Clan Bacca', true]]);
      equal(await pv.$$('.tsi-xpv-banner button'), [], 'nothing to press');
    });

    await check('Ruled by: the DM changes a town\'s clan (and back to None, and to the file\'s own clan); the Player View follows; it is saved', async () => {
      await page.hover('[data-test=banner-middlemount]');
      await page.click('[data-test=banner-ruled-middlemount]');
      await page.waitForSelector('[data-test=ruled-dialog]');
      equal(await page.$eval('[data-test=ruled-by]', s => s.value), 'bacca');
      await page.selectOption('[data-test=ruled-by]', 'karr');
      await H.clickModal(page, 'Save');
      await page.waitForTimeout(300);
      equal((await pins(page)).townClans, { version: 1, overrides: { middlemount: 'karr' } });
      equal(await page.getAttribute('[data-test=banner-middlemount]', 'data-clan'), 'karr');
      await pvWait(pv, () => document.querySelector('.tsi-xpv-banner[data-id=middlemount]').dataset.clan === 'Clan Karr');
      /* None: a plain nameplate. */
      await page.click('[data-test=banner-ruled-middlemount]', { force: true });
      await page.waitForSelector('[data-test=ruled-dialog]');
      await page.selectOption('[data-test=ruled-by]', '');
      await H.clickModal(page, 'Save');
      await page.waitForTimeout(300);
      equal(await page.$$('[data-test=banner-middlemount] img'), [], 'no shield');
      await pvWait(pv, () => !document.querySelector('.tsi-xpv-banner[data-id=middlemount] img'));
      /* Back to the file's own clan: nothing kept. */
      await page.click('[data-test=banner-ruled-middlemount]', { force: true });
      await page.waitForSelector('[data-test=ruled-dialog]');
      await page.selectOption('[data-test=ruled-by]', 'bacca');
      await H.clickModal(page, 'Save');
      await page.waitForTimeout(300);
      equal((await pins(page)).townClans, { version: 1, overrides: {} });
      /* Right-click is the same control. */
      await page.click('[data-test=banner-middlemount]', { button: 'right' });
      await page.waitForSelector('[data-test=ruled-dialog]');
      await page.selectOption('[data-test=ruled-by]', 'molten');
      await H.clickModal(page, 'Save');
      await page.waitForTimeout(300);
      equal((await pins(page)).townClans.overrides, { middlemount: 'molten' });
    });

    await check('quest markers: Quest markers turns placing on; a click drops a gold !; Esc or the button leaves placing; each marker is saved on its map', async () => {
      equal(await page.textContent('[data-test=quest-place]'), 'Quest markers: Off');
      await page.click('[data-test=quest-place]');
      equal(await page.textContent('[data-test=quest-place]'), 'Quest markers: On');
      const b = await stageBox(page);
      await page.mouse.click(b.x + b.w * 0.30, b.y + b.h * 0.55);
      await page.mouse.click(b.x + b.w * 0.60, b.y + b.h * 0.60);
      await page.mouse.click(b.x + b.w * 0.45, b.y + b.h * 0.30);
      let p = await pins(page);
      equal(p.quests.markers.length, 3);
      equal(p.quests.markers.map(m => m.mapId), ['preset:midland_province', 'preset:midland_province', 'preset:midland_province']);
      assert(p.quests.markers.every(m => m.x > 0 && m.x < 1 && m.y > 0 && m.y < 1), 'positions are fractions of the map');
      await page.keyboard.press('Escape');
      equal(await page.textContent('[data-test=quest-place]'), 'Quest markers: Off');
      equal(await page.$$eval('.tsi-exp-qmark', n => n.length), 3);
      /* Not placing: a click on the empty map does nothing. */
      await page.mouse.click(b.x + b.w * 0.8, b.y + b.h * 0.2);
      equal((await pins(page)).quests.markers.length, 3);
    });

    await check('a marker belongs to one map: another map shows none, and coming back shows them again', async () => {
      await loadMap(page, 'the_east_isle');
      equal(await page.$$eval('.tsi-exp-qmark', n => n.length), 0);
      await loadMap(page, 'midland_province');
      equal(await page.$$eval('.tsi-exp-qmark', n => n.length), 3);
    });

    await check('the Player View shows only the "!" at the same place; the label and note never reach it', async () => {
      await pvWait(pv, () => document.querySelectorAll('.tsi-xpv-quest').length === 3);
      equal(await pv.$$eval('.tsi-xpv-quest', n => n.map(q => q.textContent)), ['!', '!', '!']);
      const dm = await page.$$eval('.tsi-exp-qmark', n => n.map(q => { const m = document.querySelector('.tsi-exp-map').getBoundingClientRect(), r = q.getBoundingClientRect(); return [(r.x + r.width / 2 - m.x) / m.width, (r.y + r.height / 2 - m.y) / m.height]; }));
      const tv = await pv.$$eval('.tsi-xpv-quest', n => n.map(q => { const m = document.querySelector('.tsi-xpv-map').getBoundingClientRect(), r = q.getBoundingClientRect(); return [(r.x + r.width / 2 - m.x) / m.width, (r.y + r.height / 2 - m.y) / m.height]; }));
      dm.forEach((d, i) => assert(Math.abs(d[0] - tv[i][0]) < 0.006 && Math.abs(d[1] - tv[i][1]) < 0.006, 'same place ' + i + ': ' + d + ' vs ' + tv[i]));
    });

    await check('click a marker: edit its label and note and Save; the Player View still shows only the "!" (no text anywhere in its page)', async () => {
      await page.click('[data-test=quest-qm-1]');
      await page.waitForSelector('[data-test=quest-dialog]');
      await page.fill('[data-test=quest-label]', 'The old mill');
      await page.fill('[data-test=quest-note]', 'Ask for Branwen: SECRET-NOTE');
      await H.clickModal(page, 'Save');
      await page.waitForTimeout(400);
      const m = (await pins(page)).quests.markers.find(x => x.id === 'qm-1');
      equal([m.label, m.note], ['The old mill', 'Ask for Branwen: SECRET-NOTE']);
      equal(await page.getAttribute('[data-test=quest-qm-1]', 'title'), 'The old mill');
      await pv.waitForTimeout(500);
      const html = await pv.evaluate(() => document.documentElement.outerHTML);
      assert(!html.includes('SECRET-NOTE') && !html.includes('The old mill'), 'no label or note in the players\' page');
      equal(await pv.$$eval('.tsi-xpv-quest', n => n.map(q => q.getAttribute('title')).filter(Boolean)), [], 'not even a tooltip');
      const snap = (await pins(page)).snapshot.quests;
      equal(Object.keys(snap[0]).sort(), ['id', 'mapId', 'x', 'y']);
    });

    await check('the note stops at 300 letters and says how many are left', async () => {
      await page.click('[data-test=quest-qm-1]');
      await page.waitForSelector('[data-test=quest-dialog]');
      await page.fill('[data-test=quest-note]', 'x'.repeat(400));
      equal((await page.$eval('[data-test=quest-note]', n => n.value.length)), 300);
      assert((await page.textContent('[data-test=quest-dialog]')).includes('300 / 300'));
      await H.clickModal(page, 'Cancel');
      equal((await pins(page)).quests.markers.find(x => x.id === 'qm-1').note, 'Ask for Branwen: SECRET-NOTE', 'Cancel changes nothing');
    });

    await check('drag a marker to move it (a click does not); it moves in both windows and keeps its place after a reload', async () => {
      const before = (await pins(page)).quests.markers.find(x => x.id === 'qm-2');
      const c = await page.$eval('[data-test=quest-qm-2]', n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(c.x - 12 * i, c.y - 9 * i);
      await page.mouse.up();
      await page.waitForTimeout(300);
      assert(!(await page.$('.tsi-modal')), 'a drag does not open the panel');
      const after = (await pins(page)).quests.markers.find(x => x.id === 'qm-2');
      assert(after.x < before.x && after.y < before.y, 'moved: ' + JSON.stringify([before.x, before.y, after.x, after.y]));
      await pvWait(pv, () => document.querySelectorAll('.tsi-xpv-quest').length === 3);
      await page.evaluate(() => TSI.store.flush());
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      await loadMap(page, 'midland_province');
      const again = (await pins(page)).quests.markers.find(x => x.id === 'qm-2');
      equal([again.x, again.y], [after.x, after.y]);
      equal((await pins(page)).quests.markers.length, 3);
    });

    await check('Done asks "Take this marker down?" (No keeps it, Yes removes it); Delete asks too', async () => {
      await page.click('[data-test=quest-qm-3]');
      await page.waitForSelector('[data-test=quest-dialog]');
      await H.clickModal(page, 'Done');
      await page.waitForTimeout(300);
      assert((await page.textContent('.tsi-modal:last-of-type')).includes('Take this marker down?'), 'asks first');
      await H.clickModal(page, 'Cancel');
      await page.waitForTimeout(300);
      equal((await pins(page)).quests.markers.length, 3, 'still there');
      await dismiss(page);
      await page.click('[data-test=quest-qm-3]');
      await page.waitForSelector('[data-test=quest-dialog]');
      await H.clickModal(page, 'Done');
      await page.waitForTimeout(300);
      await H.clickModal(page, 'Take it down');
      await page.waitForTimeout(300);
      equal((await pins(page)).quests.markers.map(m => m.id), ['qm-1', 'qm-2']);
      await page.click('[data-test=quest-qm-2]');
      await page.waitForSelector('[data-test=quest-dialog]');
      await H.clickModal(page, 'Delete');
      await page.waitForTimeout(300);
      assert((await page.textContent('.tsi-modal:last-of-type')).includes('Delete this marker?'));
      await H.clickModal(page, 'Delete');
      await page.waitForTimeout(300);
      equal((await pins(page)).quests.markers.map(m => m.id), ['qm-1']);
    });

    await check('the banners and the marker survive a reload; both items are in a campaign file and in Back up everything', async () => {
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      await loadMap(page, 'midland_province');
      equal((await pins(page)).townClans.overrides, { middlemount: 'molten' });
      equal((await pins(page)).quests.markers.map(m => m.id), ['qm-1']);
      equal(await page.getAttribute('[data-test=banner-middlemount]', 'data-clan'), 'molten');
      const keys = await page.evaluate(async () => {
        await TSI.store.flush();
        const rules = TSI.backupRules;
        const campaign = rules.makeCampaignBackup(TSI.store.records('explorer'), new Date(), TSI.space);
        const suite = rules.makeSuiteBackup(await TSI.store.freshAll(), new Date(), TSI.space);
        return { campaign: campaign.records.map(r => r.key), suite: suite.records.map(r => r.key) };
      });
      ['tsi.explorer.townclans', 'tsi.explorer.markers'].forEach(k => { assert(keys.campaign.includes(k), 'campaign: ' + keys.campaign.join()); assert(keys.suite.includes(k), 'suite'); });
    });

    await check('an old save with neither item loads fine (stock banners, no markers); a damaged item is ignored, never a crash', async () => {
      await page.evaluate(async () => { TSI.store.remove('tsi.explorer.townclans'); TSI.store.remove('tsi.explorer.markers'); await TSI.store.flush(); });
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      await loadMap(page, 'midland_province');
      equal(await page.getAttribute('[data-test=banner-middlemount]', 'data-clan'), 'bacca');
      equal((await pins(page)).quests.markers, []);
      await page.evaluate(async () => { TSI.store.set('tsi.explorer.townclans', { version: 9, junk: true }); TSI.store.set('tsi.explorer.markers', 'garbage'); await TSI.store.flush(); });
      await page.reload();
      await page.waitForSelector('[data-test=camp]');
      await loadMap(page, 'midland_province');
      equal(await page.getAttribute('[data-test=banner-middlemount]', 'data-clan'), 'bacca');
    });

    await check('the controls still fit: the Explorer has no sideways scroll and Quest markers is in view', async () => {
      const lay = await H.layoutCheck(page, ['[data-test=quest-place]', '[data-test=terrain-edit]']);
      equal(lay.outOfView, []);
      equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    });

    await check('nothing went wrong or reached for the internet', async () => {
      equal(context.log.errors, []);
      equal(context.log.net, []);
      equal(context.log.failed, []);
    });
    await context.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
