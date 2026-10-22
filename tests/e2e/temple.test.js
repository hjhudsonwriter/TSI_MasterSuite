/* The Temple (the Strip Back Overhaul, step S11, Harry, 22 October 2026), clicked through from a double-clicked
   index.html with the internet off, with the Explorer and the Bastion open side by side:
   - it is built from a construction slot at party level 8 (21 days), one level only; its tile and the map show the
     three Shrine paintings together, labelled at each of the three buildings;
   - the Favour of the Gods panel and its button are gone;
   - the panel is split into thirds, one for each god, side by side: Telluria, Aurush, Pelagos, each with its name, its
     Favour bar, Pray to (god) and Receive Blessing (a dropdown of exactly three blessings);
   - Pray is instant and adds a d50 (1 to 50) to the bar; the bar stops at 100; the result line shows the roll;
   - the dropdown and its button are greyed out and cannot be chosen until that god's bar is full;
   - receiving a blessing asks first (it spends the whole bar), then happens at once: the bar goes back to 0, goods reach
     the Warehouse, a Blessing of Pelagos is held for the Dock, a Great Rite waits at the Ironbow; no order is made;
   - a double click prays once and receives once (TSI.oneAtATime);
   - a reload changes nothing;
   - the panel fits the laptop (1707 x 930, pixel ratio 1.5) and the TV (1920 x 1080, pixel ratio 1) with no sideways scroll.
   Run with:  node tests/e2e/temple.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const GODS = ['telluria', 'aurush', 'pelagos'];
const BLESSINGS = {
  telluria: ['Earthward Talisman', 'Rootguard Salve', 'Great Rite of Telluria'],
  aurush: ['Blessed Lantern', 'Consecrate Expedition Supplies', 'Great Rite of Aurush'],
  pelagos: ['Voyage Blessing', 'Bless Commercial Shipment', 'Great Rite of Pelagos']
};

const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const logText = s => s.log.map(l => l.body).join(' | ');
const popUp = page => page.$('.tsi-modal:not(.tsi-bas-panel)');

async function context(browser, size) {
  const ctx = await H.newContext(browser, size, { acceptDownloads: true, backedUp: true });
  await ctx.setOffline(true);
  /* window.__dice: the next values Math.random gives, before its usual 0.99 (a roll of 50). Set on the Bastion's page, just before a click. */
  await ctx.addInitScript(() => {
    window.__dice = [];
    Math.random = function () { return window.__dice && window.__dice.length ? window.__dice.shift() : 0.99; };
  });
  return ctx;
}
async function openExplorer(ctx) {
  const p = await ctx.newPage();
  await p.goto(INDEX + '?tool=explorer');
  await p.waitForSelector('[data-test=camp]');
  return p;
}
async function openBastion(ctx) {
  const p = await ctx.newPage();
  await p.goto(INDEX + '?tool=bastion');
  await p.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  return p;
}
async function closeAll(page) {
  for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}
async function openTemple(ba) {
  await closeAll(ba);
  await ba.waitForTimeout(300);
  await ba.click('[data-test=tile-temple]');
  await ba.waitForSelector('[data-test=panel-fac-temple] [data-test=temple]');
  await ba.waitForTimeout(300);
}
/* The Temple built, at party level 9 (as the Beast Pen's test sets up), with the given bars. */
async function setUp(ba, bars) {
  await ba.selectOption('[data-test=level]', '9');
  await ba.waitForTimeout(300);
  await ba.evaluate(b => TSI.bastion.debug.change(s => {
    s.builtExtras = [{ facId: 'temple', status: 'built' }];
    s.facilityLevels.temple = 1;
    s.favour = b;
  }), bars);
  await ba.evaluate(() => TSI.store.flush());
}
const setBars = (ba, bars) => ba.evaluate(b => TSI.bastion.debug.change(s => { s.favour = b; }), bars);
/* One god's third: what shows and what can be pressed. */
async function third(ba, god) {
  return ba.evaluate(g => {
    const q = t => document.querySelector('[data-test="' + t + '-' + g + '"]');
    const txt = n => n ? n.textContent.replace(/\s+/g, ' ').trim() : null;
    const sel = q('blessing-select');
    return {
      name: txt(q('temple-name')), pct: txt(q('temple-favour')), bar: q('temple-bar').getAttribute('aria-valuenow'),
      width: q('temple-bar').firstChild.style.width,
      pray: txt(q('pray')), said: txt(q('pray-result')),
      options: Array.from(sel.options).map(o => o.textContent), picked: sel.options[sel.selectedIndex].textContent, selectOff: sel.disabled,
      goOff: q('blessing-go').disabled, goText: txt(q('blessing-go')), why: q('blessing-why').hidden ? '' : txt(q('blessing-why'))
    };
  }, god);
}
/* Pray with the next roll chosen (the Bastion's own Math.random, which the test sets). */
async function pray(ba, god, die) {
  await ba.waitForTimeout(420);
  await ba.evaluate(d => { window.__dice = [d]; }, die);
  await ba.click('[data-test=pray-' + god + ']');
  await ba.waitForTimeout(250);
  await ba.evaluate(() => { window.__dice = []; });
}
/* Receive Blessing: choose it in the dropdown, press the button, and answer the question. Resolves with the question's text. */
async function receive(ba, god, label, answer) {
  await ba.waitForTimeout(420);
  const val = await ba.$eval('[data-test=blessing-select-' + god + ']', (s, l) => Array.from(s.options).filter(o => o.textContent === l)[0].value, label);
  await ba.selectOption('[data-test=blessing-select-' + god + ']', val);
  await ba.click('[data-test=blessing-go-' + god + ']');
  await ba.waitForSelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot');
  const q = await ba.$eval('.tsi-modal:not(.tsi-bas-panel)', m => m.textContent.replace(/\s+/g, ' ').trim());
  await H.clickModal(ba, answer || 'Receive Blessing');
  await ba.waitForTimeout(400);
  return q;
}

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  const ex = await openExplorer(ctx);
  const ba = await openBastion(ctx);

  section('Building the Temple');

  await check('the Favour of the Gods panel and its button are gone: the right of the bottom bar is Clan Influence and War Council', async () => {
    equal(await ba.$$eval('.tsi-bas-pbtns--right [data-test^=open-]', bs => bs.map(b => b.getAttribute('data-test'))), ['open-influence', 'open-war']);
    equal(await ba.$('[data-test=open-favour]'), null);
    equal(await ba.$('[data-test=panel-favour]'), null);
    equal(await ba.$('[data-test^=claim-]'), null, 'no Claim button anywhere');
  });

  await check('below party level 8 the Temple can\'t be chosen; at 8 it can: "Temple", 21 days, with the three Shrine paintings side by side', async () => {
    await ba.selectOption('[data-test=level]', '7');
    await ba.waitForTimeout(300);
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.builtExtras = []; s.treasuryGP = 500; }));
    await ba.click('button.tsi-bas-tile--slot');
    await ba.waitForSelector('[data-test=build-temple]');
    equal(await ba.getAttribute('[data-test=build-temple]', 'aria-disabled'), 'true', 'locked at level 7');
    assert(/Temple/.test(await bare(ba, '[data-test=build-temple]')) && !/Shrine/.test(await bare(ba, '[data-test=build-panel]')), await bare(ba, '[data-test=build-temple]'));
    equal(await ba.$$eval('[data-test=build-temple] img', is => is.map(i => i.getAttribute('src').split('/').pop())), ['shrine_of_telluria.png', 'shrine_of_aurush.png', 'shrine_of_pelagos.png'], 'its picture is the three Shrines together');
    await closeAll(ba);
    await ba.selectOption('[data-test=level]', '8');
    await ba.waitForTimeout(300);
    await ba.click('button.tsi-bas-tile--slot');
    await ba.waitForSelector('[data-test=build-temple]');
    equal(await ba.getAttribute('[data-test=build-temple]', 'aria-disabled'), null, 'open at level 8');
    await ba.click('[data-test=build-temple]');
    await ba.waitForSelector('.tsi-modal__foot button:text-is("Construct")');
    const q = await ba.$eval('.tsi-modal:not(.tsi-bas-panel)', m => m.textContent.replace(/\s+/g, ' ').trim());
    assert(/Temple/.test(q) && /21 days/.test(q), q);
    await H.clickModal(ba, 'Construct');
    await ba.waitForTimeout(400);
    const s = await bas(ba);
    equal(s.builtExtras.filter(Boolean).map(e => [e.facId, e.status, e.readyDay - e.startDay]), [['temple', 'building', 21]]);
    await closeAll(ba);
  });

  await setUp(ba, { telluria: 0, aurush: 0, pelagos: 0 });

  section('The panel in thirds');

  await check('its tile shows the three Shrine paintings; the map draws the three buildings and labels each', async () => {
    await closeAll(ba);
    await ba.waitForFunction(() => Array.from(document.images).every(i => i.complete));
    equal(await ba.$$eval('[data-test=tile-temple] img', is => is.map(i => i.getAttribute('src').split('/').pop() + ':' + (i.naturalWidth > 0))), ['shrine_of_telluria.png:true', 'shrine_of_aurush.png:true', 'shrine_of_pelagos.png:true']);
    equal(await ba.$$eval('.tsi-bas-map__overlay[data-fac=temple]', os => os.map(o => o.getAttribute('src').split('/').pop() + ':' + (o.naturalWidth > 0))), ['shrine_of_aurush.png:true', 'shrine_of_telluria.png:true', 'shrine_of_pelagos.png:true']);
    equal(await ba.$$eval('[data-test^=map-label-temple]', ls => ls.map(l => l.dataset.test + ':' + l.textContent.replace(/\s+/g, ' '))), ['map-label-temple:TempleOne level', 'map-label-temple-2:TempleOne level', 'map-label-temple-3:TempleOne level']);
    await H.shot(ba, 'temple-map');
  });

  await check('one level only (no Upgrade row, no orders listed); the panel is the three gods, side by side, left to right Telluria, Aurush, Pelagos, each a third of the width', async () => {
    await openTemple(ba);
    equal(await bare(ba, '[data-test=fac-level]'), 'One level only');
    equal(await ba.$('[data-test=upgrade-temple]'), null);
    equal(await ba.$('[data-test^=issue-temple__]'), null, 'no blessing is an order');
    equal(await ba.$$eval('[data-test^=temple-god-]', ns => ns.map(n => n.dataset.god)), GODS);
    const boxes = await ba.$$eval('[data-test^=temple-god-]', ns => ns.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    assert(boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x, 'left to right: ' + JSON.stringify(boxes));
    assert(Math.abs(boxes[0].y - boxes[1].y) < 2 && Math.abs(boxes[1].y - boxes[2].y) < 2, 'side by side: ' + JSON.stringify(boxes));
    assert(Math.abs(boxes[0].w - boxes[1].w) < 2 && Math.abs(boxes[1].w - boxes[2].w) < 2, 'equal thirds: ' + JSON.stringify(boxes));
    const panel = await ba.$eval('[data-test=temple]', n => n.getBoundingClientRect().width);
    assert(Math.abs(boxes[0].w * 3 - panel) < panel * 0.08, 'together they fill the panel: ' + JSON.stringify([boxes[0].w, panel]));
    for (const g of GODS) {
      const t = await third(ba, g);
      equal([t.name, t.pct, t.bar, t.pray, t.options], [g.charAt(0).toUpperCase() + g.slice(1), '0%', '0', 'Pray to ' + g.charAt(0).toUpperCase() + g.slice(1), BLESSINGS[g]], g);
    }
    await H.shot(ba, 'temple-panel-empty');
  });

  section('Pray to (god): instant, a d50, the bar stops at 100');

  await check('a roll of 1, 26 and 50 add exactly that to the bar; the result line says the roll; no order is made; the Day Log has it', async () => {
    await pray(ba, 'aurush', 0);
    let t = await third(ba, 'aurush');
    equal([t.pct, t.bar, t.width], ['1%', '1', '1%']);
    equal(t.said, 'Rolled a d50: 1. Aurush\'s bar goes from 0% to 1% (+1%).');
    await pray(ba, 'aurush', 0.5);
    t = await third(ba, 'aurush');
    equal([t.pct, t.said], ['27%', 'Rolled a d50: 26. Aurush\'s bar goes from 1% to 27% (+26%).']);
    await pray(ba, 'telluria', 0.99);
    t = await third(ba, 'telluria');
    equal([t.pct, t.said], ['50%', 'Rolled a d50: 50. Telluria\'s bar goes from 0% to 50% (+50%).']);
    const s = await bas(ba);
    equal(s.favour, { telluria: 50, aurush: 27, pelagos: 0 }, 'each god\'s own bar');
    equal(s.pendingOrders, [], 'instant: no order');
    assert(/Prayed to Aurush\. Rolled a d50: 26\./.test(logText(s)), 'the Day Log says so');
    equal(await bare(ba, '[data-test=pray-result-pelagos]'), '', 'a god not prayed to says nothing');
  });

  await check('the bar stops at 100: the last of a roll that does not fit is said, and the dropdown opens', async () => {
    let t = await third(ba, 'telluria');
    equal([t.selectOff, t.goOff, t.why], [true, true, 'Telluria\'s bar fills at 100%. It is at 50% now.'], 'greyed out below 100');
    await pray(ba, 'telluria', 0.5);                     /* 50 + 26 = 76 */
    t = await third(ba, 'telluria');
    equal([t.pct, t.selectOff, t.goOff], ['76%', true, true], 'still greyed out at 76%');
    await pray(ba, 'telluria', 0.99);                    /* 76 + 50 = 126: stops at 100 */
    t = await third(ba, 'telluria');
    equal([t.pct, t.bar, t.width], ['100%', '100', '100%']);
    equal(t.said, 'Rolled a d50: 50. Telluria\'s bar goes from 76% to 100% (it stops at 100%, so 26% of the roll did not fit).');
    equal([t.selectOff, t.goOff, t.why], [false, false, ''], 'now it can be chosen');
    equal((await bas(ba)).favour.telluria, 100);
  });

  section('Receive Blessing: greyed out until full, then instant, and the whole bar is spent');

  await check('below 100 the dropdown and the button are greyed out and cannot be used, even by force; they say how full the bar is', async () => {
    const t = await third(ba, 'aurush');
    equal([t.pct, t.selectOff, t.goOff, t.why], ['27%', true, true, 'Aurush\'s bar fills at 100%. It is at 27% now.']);
    await ba.click('[data-test=blessing-go-aurush]', { force: true, timeout: 1500 }).catch(() => {});
    await ba.waitForTimeout(250);
    equal(await popUp(ba), null, 'no question: it did nothing');
    equal((await bas(ba)).favour.aurush, 27);
  });

  await check('Telluria\'s dropdown lists exactly three blessings; Cancel on the question changes nothing', async () => {
    const t = await third(ba, 'telluria');
    equal(t.options, BLESSINGS.telluria);
    equal(await bare(ba, '[data-test=blessing-note-telluria]').then(x => /Earthward|talisman/i.test(x)), true, 'it describes the one chosen');
    const q = await receive(ba, 'telluria', 'Great Rite of Telluria', 'Cancel');
    assert(/Receive Great Rite of Telluria from Telluria\?/.test(q) && /whole bar \(100%\) is spent and goes back to 0%/.test(q) && /at once/.test(q), q);
    const s = await bas(ba);
    equal([s.favour.telluria, s.greatRites, s.pendingOrders], [100, [], []]);
  });

  await check('Receive a Great Rite: the whole bar goes back to 0 at once, the rite waits at the Ironbow (listed in its god\'s third), no order is made', async () => {
    await receive(ba, 'telluria', 'Great Rite of Telluria');
    const s = await bas(ba);
    equal([s.favour.telluria, s.pendingOrders, s.greatRites.map(g => [g.rite, g.god, g.status])], [0, [], [['earths_endurance', 'telluria', 'waiting']]]);
    assert(/Received Great Rite of Telluria from Telluria\./.test(logText(s)), logText(s));
    const t = await third(ba, 'telluria');
    equal([t.pct, t.selectOff, t.goOff], ['0%', true, true], 'greyed out again');
    assert(/Great Rite of Telluria: Earth's Endurance waits at the Ironbow until the DM gives it to the party on an expedition, in the Explorer\./.test(t.said), t.said);
    equal(await bare(ba, '[data-test=great-rites-telluria] [data-test=great-rite-waiting]'), 'Earth\'s Endurance: waiting at the Ironbow since Day 1. The DM gives it to the party on an expedition, in the Explorer.');
  });

  await check('Pelagos: Bless Commercial Shipment keeps a Blessing of Pelagos for the Dock; Voyage Blessing goes into the Warehouse; each spends its own whole bar', async () => {
    await setBars(ba, { telluria: 0, aurush: 27, pelagos: 100 });
    await ba.waitForTimeout(300);
    equal((await third(ba, 'pelagos')).options, BLESSINGS.pelagos);
    await receive(ba, 'pelagos', 'Bless Commercial Shipment');
    let s = await bas(ba);
    equal([s.favour, s.tradeNetwork.protections, s.pendingOrders], [{ telluria: 0, aurush: 27, pelagos: 0 }, { pelagos_blessing: { charges: 1 } }, []]);
    assert(/Blessings of Pelagos held for the Dock: 1\. The next ship sent with cargo takes one/.test(await bare(ba, '[data-test=temple-god-pelagos]')));
    await setBars(ba, { telluria: 0, aurush: 27, pelagos: 100 });
    await ba.waitForTimeout(300);
    await receive(ba, 'pelagos', 'Voyage Blessing');
    s = await bas(ba);
    equal([s.favour.pelagos, s.warehouse.filter(w => w.goodId).map(w => [w.goodId, w.qty])], [0, [['voyage_blessing', 1]]], 'at once, in the Warehouse');
    equal(s.pendingOrders, []);
  });

  await check('Aurush: Consecrate Expedition Supplies makes three Cleansing Portions at once', async () => {
    await setBars(ba, { telluria: 0, aurush: 100, pelagos: 0 });
    await ba.waitForTimeout(300);
    await receive(ba, 'aurush', 'Consecrate Expedition Supplies');
    const s = await bas(ba);
    equal([s.favour.aurush, s.warehouse.filter(w => w.goodId === 'cleansing_portion').map(w => w.qty)], [0, [3]]);
  });

  section('A double click does it once');

  await check('a double click on Pray to Pelagos prays once: one roll in the Day Log, the bar moves once', async () => {
    await setBars(ba, { telluria: 0, aurush: 0, pelagos: 0 });
    await ba.waitForTimeout(500);
    const before = (await bas(ba)).log.filter(l => l.title === 'Prayer').length;
    await ba.evaluate(() => { window.__dice = [0.19, 0.19, 0.19]; });     /* 10 each: a second roll would show as 20 */
    await ba.dblclick('[data-test=pray-pelagos]');
    await ba.waitForTimeout(400);
    await ba.evaluate(() => { window.__dice = []; });
    const s = await bas(ba);
    equal([s.favour.pelagos, s.log.filter(l => l.title === 'Prayer').length - before], [10, 1]);
  });

  await check('a double click on Receive Blessing asks once and gives one blessing: the Warehouse gains one, not two', async () => {
    await setBars(ba, { telluria: 0, aurush: 0, pelagos: 100 });
    await ba.waitForTimeout(500);
    const had = (await bas(ba)).warehouse.filter(w => w.goodId === 'voyage_blessing').reduce((n, w) => n + w.qty, 0);
    const val = await ba.$eval('[data-test=blessing-select-pelagos]', s => Array.from(s.options).filter(o => o.textContent === 'Voyage Blessing')[0].value);
    await ba.selectOption('[data-test=blessing-select-pelagos]', val);
    await ba.dblclick('[data-test=blessing-go-pelagos]');
    await ba.waitForSelector('.tsi-modal:not(.tsi-bas-panel) .tsi-modal__foot');
    equal(await ba.$$eval('.tsi-modal:not(.tsi-bas-panel)', ms => ms.length), 1, 'one question');
    await H.clickModal(ba, 'Receive Blessing');
    await ba.waitForTimeout(500);
    const s = await bas(ba);
    equal([s.favour.pelagos, s.warehouse.filter(w => w.goodId === 'voyage_blessing').reduce((n, w) => n + w.qty, 0) - had], [0, 1]);
    equal(await popUp(ba), null);
  });

  section('A reload changes nothing');

  await check('the bars, the held Blessing, the Great Rite and the Warehouse come back exactly; the panel shows them', async () => {
    await setBars(ba, { telluria: 44, aurush: 100, pelagos: 3 });
    await ba.evaluate(() => TSI.store.flush());
    const before = await bas(ba);
    await ba.reload();
    await ba.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    const after = await bas(ba);
    equal([after.favour, after.greatRites, after.tradeNetwork.protections, after.warehouse, after.builtExtras], [before.favour, before.greatRites, before.tradeNetwork.protections, before.warehouse, before.builtExtras]);
    await openTemple(ba);
    equal([(await third(ba, 'telluria')).pct, (await third(ba, 'aurush')).pct, (await third(ba, 'pelagos')).pct], ['44%', '100%', '3%']);
    equal((await third(ba, 'aurush')).goOff, false, 'Aurush\'s blessing is ready');
    equal((await third(ba, 'telluria')).goOff, true);
    assert(/Blessings of Pelagos held for the Dock: 1\./.test(await bare(ba, '[data-test=temple-god-pelagos]')));
    equal(await bare(ba, '[data-test=great-rites-telluria] li').then(x => /Earth's Endurance/.test(x)), true);
  });

  section('The laptop');

  await check('laptop (1707 x 930, pixel ratio 1.5): the Temple\'s panel with a full bar has no sideways scroll; every god\'s name, bar, Pray and Receive Blessing are in view', async () => {
    await openTemple(ba);
    const lay = await H.layoutCheck(ba, GODS.flatMap(g => ['[data-test=temple-name-' + g + ']', '[data-test=temple-bar-' + g + ']', '[data-test=pray-' + g + ']', '[data-test=blessing-select-' + g + ']', '[data-test=blessing-go-' + g + ']']).concat(['[data-test=panel-fac-temple] .tsi-modal__foot button']));
    assert(lay.scrollWidth <= lay.clientWidth, 'no sideways scroll');
    equal(lay.outOfView, []);
    equal(await ba.evaluate(() => { const p = document.querySelector('[data-test=panel-fac-temple] .tsi-modal__body, [data-test=panel-fac-temple] .tsi-modal__content'); return p ? p.scrollWidth <= p.clientWidth + 1 : true; }), true, 'nor inside the panel');
    await H.shot(ba, 'temple-laptop');
  });

  await check('the panel is the same width at the next moves: the long blessing name fits its third', async () => {
    const r = await ba.evaluate(() => {
      const s = document.querySelector('[data-test=blessing-select-aurush]');
      const g = document.querySelector('[data-test=temple-god-aurush]').getBoundingClientRect();
      const b = s.getBoundingClientRect();
      return { selectRight: b.right, godRight: g.right };
    });
    assert(r.selectRight <= r.godRight + 0.5, JSON.stringify(r));
  });

  section('The TV, and moving between the screens');

  const tv = await context(browser, 'tv');
  await check('TV (1920 x 1080, pixel ratio 1): the Temple fits with no sideways scroll, every control in view', async () => {
    const tex = await openExplorer(tv);
    const tba = await openBastion(tv);
    await setUp(tba, { telluria: 100, aurush: 35, pelagos: 82 });
    await openTemple(tba);
    const lay = await H.layoutCheck(tba, GODS.flatMap(g => ['[data-test=pray-' + g + ']', '[data-test=blessing-go-' + g + ']']).concat(['[data-test=panel-fac-temple] .tsi-modal__foot button']));
    assert(lay.scrollWidth <= lay.clientWidth, 'no sideways scroll');
    equal(lay.outOfView, []);
    const boxes = await tba.$$eval('[data-test^=temple-god-]', ns => ns.map(n => Math.round(n.getBoundingClientRect().y)));
    assert(boxes[0] === boxes[1] && boxes[1] === boxes[2], 'still side by side: ' + boxes);
    await H.shot(tba, 'temple-tv');
    /* The window moved from the TV to the laptop and back: the panel redraws at each size. */
    for (const size of ['laptop', 'smallWindow', 'tv']) {
      await tba.setViewportSize(H.SIZES[size].viewport);
      await tba.waitForTimeout(300);
      const l = await H.layoutCheck(tba, ['[data-test=pray-telluria]', '[data-test=blessing-go-pelagos]']);
      assert(l.scrollWidth <= l.clientWidth, size + ': no sideways scroll');
      equal(l.outOfView, [], size);
    }
    await tex.close();
    equal(tv.log.errors, []);
    equal(tv.log.failed, []);
  });

  await check('nothing went wrong or reached for the internet, and no picture or file was missing', async () => {
    equal(ctx.log.errors, [], 'no page errors');
    equal(ctx.log.net, [], 'nothing online');
    equal(ctx.log.failed, [], 'nothing missing');
    equal(tv.log.net, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
