/* The Player View's Trade Routes (27 October 2026): when the DM has the Dock's panel open on its Routes tab, the players'
   window shows the trade routes map (scrolling up and down, the routes of the registered Port Charters, the moving ship
   badges) with a text strip beneath (Active Port Charters, Journeys); any other tab, or closing the panel, goes back.
   From a double-clicked index.html with the internet off, at 1707 x 930 and 1920 x 1080.
   Run with:  node tests/e2e/player-view-routes.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const BASTION = H.fileUrl('index.html') + '?tool=bastion';
const change = (page, fn) => page.evaluate(src => TSI.bastion.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const CH = (id, port, clan, status) => ({ id, port, clan, mode: 'commodity_backed', status, earnedDay: 1, registeredDay: status === 'registered' ? 1 : null, terms: { priceMult: 1.37 }, from: { code: 'DM', title: 'DM award' }, text: '' });

async function setExplorerDay(page, day) {
  await page.evaluate(d => {
    const ex = TSI.store.get('tsi.explorer.save', null) || { tokens: [], travel: {}, grid: {} };
    ex.travel = Object.assign({}, ex.travel, { day: d });
    TSI.store.set('tsi.explorer.save', ex);
    TSI.bastion.debug.clock();
  }, day);
}
async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  return pv;
}
const shape = pv => pv.$eval('[data-test=pv-panel]', n => n.getAttribute('data-view') || 'dock-picture').catch(() => 'none');
const routes = pv => pv.$$eval('[data-test=pv-routes-map] img.tsi-bpv-routes__route', l => l.map(x => [x.getAttribute('data-port'), x.classList.contains('is-sea')]));
const ships = pv => pv.$$eval('[data-test=pv-ship]', l => l.map(x => ({ port: x.getAttribute('data-port'), phase: x.getAttribute('data-phase'), f: +x.getAttribute('data-fraction'), label: x.getAttribute('aria-label'), left: x.style.left, top: x.style.top })));

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The Player View\'s Trade Routes at ' + size.width + ' x ' + size.height);
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(BASTION);
    await page.waitForSelector('[data-test=day-status]');
    await setExplorerDay(page, 1);
    await page.waitForFunction(() => TSI.bastion.debug.state().anchored);
    await change(page, s => {
      s.facilityLevels.dock = 3; s.treasuryGP = 31337;
      s.warehouse = [{ id: 'w1', goodId: 'sawn_lumber', item: 'ZZSawnLumber', qty: 3, gp: '', notes: '' }];
      s.tradeNetwork.portCharters = [{ id: 'c1', port: 'goldport', clan: 'molten', mode: 'commodity_backed', status: 'registered', earnedDay: 1, registeredDay: 1, terms: { priceMult: 1.37 }, from: { code: 'DM', title: 'DM award' }, text: '' }, { id: 'c2', port: 'timberport', clan: 'blackstone', mode: 'commodity_backed', status: 'earned', earnedDay: 1, registeredDay: null, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' }];
      s.tradeNetwork.voyages = [];
    });
    const pv = await openPlayer(page, size);

    await check('the Dock\'s Cargo tab shows the Dock\'s own picture, not the map', async () => {
      await page.click('[data-test=tile-dock]');
      await page.waitForSelector('[data-test=dock-tabs]');
      await pv.waitForSelector('[data-test=pv-panel][data-fac=dock]');
      equal(await shape(pv), 'dock-picture');
    });

    await check('the Routes tab shows the Trade Routes view: Dock on the left, Trade routes on the right, the map and the strip', async () => {
      await page.click('[data-test=dock-tab-routes]');
      await pv.waitForSelector('[data-test=pv-panel][data-view=routes]');
      equal([await bare(pv, '[data-test=pv-panel-title]'), await bare(pv, '[data-test=pv-panel-tagline]')], ['Dock', 'Trade routes']);
      assert(await pv.$('[data-test=pv-routes-map] img.tsi-bpv-routes__img'), 'the map');
      equal(await routes(pv), [['goldport', false]], 'only the registered Charter\'s route');
      equal(await bare(pv, '[data-test=pv-routes-charters]'), 'Active Port Charters: Goldport (Clan Molten)');
      equal(await bare(pv, '[data-test=pv-routes-journeys]'), 'Journeys: No ships at sea.');
      equal(await pv.evaluate(() => [...document.querySelectorAll('[data-test=pv-routes-map] img')].every(i => i.complete && i.naturalWidth > 0)), true, 'pictures loaded');
    });

    await check('the map fills the width of the picture area, is taller than the screen and the page does not scroll sideways', async () => {
      const m = await pv.evaluate(() => {
        const sc = document.querySelector('[data-test=pv-routes-scroll]'), map = document.querySelector('[data-test=pv-routes-map]');
        const a = sc.getBoundingClientRect(), b = map.getBoundingClientRect();
        return { fill: Math.abs(a.width - b.width) < 20, tall: sc.scrollHeight > sc.clientHeight * 1.5, ratio: b.height / b.width, page: document.documentElement.scrollWidth <= document.documentElement.clientWidth, inside: a.bottom <= innerHeight && a.right <= innerWidth };
      });
      equal([m.fill, m.tall, Math.abs(m.ratio - 1996 / 1494) < 0.01, m.page, m.inside], [true, true, true, true, true]);
    });

    await check('a registered Charter lights its route; one only earned does not; un-registering hides it', async () => {
      await change(page, s => { s.tradeNetwork.portCharters.push({ id: 'c3', port: 'steelport', clan: 'slade', mode: 'commodity_backed', status: 'registered', earnedDay: 1, registeredDay: 1, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' }); });
      await pv.waitForFunction(() => document.querySelectorAll('img.tsi-bpv-routes__route').length === 2);
      equal((await routes(pv)).map(r => r[0]).sort(), ['goldport', 'steelport']);
      equal(await bare(pv, '[data-test=pv-routes-charters]'), 'Active Port Charters: Goldport (Clan Molten) · Steelport (Clan Slade)');
      await change(page, s => { s.tradeNetwork.portCharters.find(c => c.id === 'c3').status = 'earned'; });
      await pv.waitForFunction(() => document.querySelectorAll('img.tsi-bpv-routes__route').length === 1);
      equal(await routes(pv), [['goldport', false]]);
    });

    await check('scrolling: wheel, arrow keys, Page Down and click-drag all move the map, and the place is kept while the DM changes things', async () => {
      const top = () => pv.$eval('[data-test=pv-routes-scroll]', n => Math.round(n.scrollTop));
      equal(await top(), 0);
      const box = await pv.$eval('[data-test=pv-routes-scroll]', n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await pv.mouse.move(box.x, box.y);
      await pv.mouse.wheel(0, 400);
      await pv.waitForTimeout(300);
      const a = await top();
      assert(a > 100, 'the wheel scrolled: ' + a);
      await pv.keyboard.press('ArrowDown'); await pv.waitForTimeout(100);
      const b = await top();
      assert(b > a, 'ArrowDown: ' + b);
      await pv.keyboard.press('PageDown'); await pv.waitForTimeout(100);
      const c = await top();
      assert(c > b + 200, 'PageDown: ' + c);
      await pv.mouse.move(box.x, box.y); await pv.mouse.down(); await pv.mouse.move(box.x, box.y + 200, { steps: 5 }); await pv.mouse.up();
      const d = await top();
      assert(d < c - 100, 'dragging down scrolls up: ' + d);
      await pv.keyboard.press('PageUp'); await pv.keyboard.press('End'); await pv.waitForTimeout(100);
      assert(await top() > d, 'End');
      await pv.keyboard.press('Home'); await pv.waitForTimeout(100);
      await pv.mouse.wheel(0, 500); await pv.waitForTimeout(300);
      const keep = await top();
      await change(page, s => { s.treasuryGP += 1; });
      await page.waitForTimeout(500);
      equal(await top(), keep, 'the scroll place is kept');
    });

    await check('a ship sent to Goldport appears at the Ironbow end, moves along the route as days pass, rests at the port, returns and is gone when home; its route glows brighter meanwhile; the strip says where it is', async () => {
      await change(page, s => { s.tradeNetwork.voyages = [{ id: 'v1', port: 'goldport', clan: 'molten', charterId: 'c1', mode: 'commodity_backed', cargo: [{ goodId: 'sawn_lumber', name: 'ZZCargoName', qty: 2 }], departDay: s.day, arriveDay: s.day + 4, returnDay: s.day + 10, stage: 'outbound', risk: 'high', basePct: 20, protections: [], chance: 20, scheduleId: null, outcome: null, recalledDay: null, roll: null, terms: null }]; });
      await pv.waitForSelector('[data-test=pv-ship]');
      let s1 = (await ships(pv))[0];
      equal([s1.port, s1.phase, s1.f, s1.label], ['goldport', 'outbound', 0, 'Ship to Goldport: day 0 of 10']);
      equal(await routes(pv), [['goldport', true]]);
      assert(/^Sailing to Goldport: arrives Day \d+, home Day \d+\.$/.test(await bare(pv, '[data-test=pv-journey-0]')), await bare(pv, '[data-test=pv-journey-0]'));
      /* The Ironbow end: the badge's left/top in percent of the map. */
      const pct = s => [parseFloat(s.left) / 100 * 1494, parseFloat(s.top) / 100 * 1996];
      assert(Math.hypot(pct(s1)[0] - 1056, pct(s1)[1] - 1272) < 60, 'at the Ironbow: ' + pct(s1));
      await change(page, s => { const v = s.tradeNetwork.voyages[0]; v.departDay -= 2; v.arriveDay -= 2; v.returnDay -= 2; });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-ship]').getAttribute('data-fraction') === '0.500');
      const s2 = (await ships(pv))[0];
      assert(Math.hypot(pct(s2)[0] - pct(s1)[0], pct(s2)[1] - pct(s1)[1]) > 100, 'it moved');
      equal(s2.label, 'Ship to Goldport: day 2 of 10');
      await pv.waitForTimeout(1000);
      await change(page, s => { const v = s.tradeNetwork.voyages[0]; v.departDay -= 2; v.arriveDay -= 2; v.returnDay -= 2; v.stage = 'returning'; v.outcome = 'sold'; });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-ship]').getAttribute('data-phase') === 'at-port');
      assert(/^Sold at Goldport, sailing home: back Day \d+\.$/.test(await bare(pv, '[data-test=pv-journey-0]')), await bare(pv, '[data-test=pv-journey-0]'));
      await change(page, s => { const v = s.tradeNetwork.voyages[0]; v.departDay -= 3; v.arriveDay -= 3; v.returnDay -= 3; });
      await pv.waitForFunction(() => document.querySelector('[data-test=pv-ship]').getAttribute('data-phase') === 'returning');
      await change(page, s => { s.tradeNetwork.voyages = []; });
      await pv.waitForFunction(() => !document.querySelector('[data-test=pv-ship]'));
      equal(await bare(pv, '[data-test=pv-routes-journeys]'), 'Journeys: No ships at sea.');
      equal(await routes(pv), [['goldport', false]]);
    });

    await check('many ships: the first four journeys, then "and N more"', async () => {
      await change(page, s => {
        s.tradeNetwork.voyages = [1, 2, 3, 4, 5, 6].map(i => ({ id: 'm' + i, port: 'goldport', clan: 'molten', charterId: 'c1', mode: 'commodity_backed', cargo: [], departDay: s.day, arriveDay: s.day + 4, returnDay: s.day + 10, stage: 'outbound', risk: 'low', basePct: 5, protections: [], chance: 5, scheduleId: null, outcome: null, recalledDay: null, roll: null, terms: null }));
      });
      await pv.waitForSelector('[data-test=pv-journeys-more]');
      equal([await pv.$$eval('[data-test^=pv-journey-]', l => l.length), await bare(pv, '[data-test=pv-journeys-more]')], [4, 'and 2 more']);
      equal((await ships(pv)).length, 6);
    });

    await check('the players see nothing else: no gold, cargo, prices or ship records on the screen or in the page', async () => {
      await H.shot(pv, 'player-routes-' + size.width);
      const txt = await pv.evaluate(() => document.body.innerText + document.documentElement.innerHTML);
      ['ZZSawnLumber', 'ZZCargoName', '31337', '1.37', 'priceMult', 'protection', 'ZZ'].forEach(w => assert(txt.indexOf(w) === -1, w + ' is on the players\' screen'));
      equal(await pv.evaluate(() => document.querySelector('[data-test=pv-routes-strip]').innerText.replace(/\s+/g, ' ').indexOf(' gp')), -1);
      await change(page, s => { s.tradeNetwork.voyages = []; });
    });

    await check('another Dock tab goes back to the Dock\'s picture; Routes again shows the map; closing the panel goes back to the map', async () => {
      await page.click('[data-test=dock-tab-orders]');
      await pv.waitForFunction(() => { const p = document.querySelector('[data-test=pv-panel]'); return p && !p.getAttribute('data-view'); });
      equal(await shape(pv), 'dock-picture');
      await page.click('[data-test=dock-tab-routes]');
      await pv.waitForSelector('[data-test=pv-panel][data-view=routes]');
      await page.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-panel-host]', { state: 'hidden' });
      assert(await pv.$('[data-test=pv-map]'), 'the Bastion map is back');
      equal(await pv.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    });

    await check('nothing went wrong', async () => {
      equal(context.log.errors, [], 'page errors');
      equal(context.log.net, [], 'internet');
      equal(context.log.failed, [], 'missing files');
    });
    await context.close();
  }
  await browser.close();
  H.summary();
})();
