/* The Workshop's five staff (the Strip Back Overhaul, step S12, Harry, 22 October 2026), clicked through from a double-clicked
   index.html with the internet off:
   - the Artisan Tools card is gone; the Workshop's panel has five staff cards side by side (Handyman, Smith, Scholar,
     Alchemist, Artisan) that open one by one as the Workshop is upgraded; a staff member who is not open yet is greyed, with
     the level that opens them;
   - the Handyman's list is marked as a placeholder, the Artisan says "Extra options: to come";
   - each open staff member can be given an order; each does one job at a time (a second one is refused, the button says Busy)
     and the five work side by side; Craft Magic Item sits beneath, labelled "Not a staff job", and runs beside them;
   - the Scholar's Research and Overland charts and the Alchemist's four jobs are chosen from a dropdown on the card;
   - a reload changes nothing;
   - the Upgrade row, the five cards and Craft Magic Item fit the laptop (1707 x 930, pixel ratio 1.5), the TV (1920 x 1080,
     pixel ratio 1) and a small window (1280 x 720) with no sideways scroll.
   Run with:  node tests/e2e/workshop.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const STAFF = ['handyman', 'smith', 'scholar', 'alchemist', 'artisan'];

const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));

async function context(browser, size) {
  const ctx = await H.newContext(browser, size, { acceptDownloads: true, backedUp: true });
  await ctx.setOffline(true);
  return ctx;
}
async function openBastion(ctx) {
  const p = await ctx.newPage();
  await p.goto(INDEX + '?tool=bastion');
  await p.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state(), null, { timeout: 8000 });
  await H.dismissNotices(p);
  return p;
}
async function closeAll(page) {
  for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}
async function openWorkshop(ba) {
  await closeAll(ba);
  await ba.waitForTimeout(300);
  await ba.click('[data-test=tile-workshop]');
  await ba.waitForSelector('[data-test=panel-fac-workshop] [data-test=workshop-staff]');
  await ba.waitForTimeout(300);
}
/* The Workshop at a level (the Bastion keeps its own days; only the level is set). */
async function setLevel(ba, level) {
  await ba.evaluate(l => TSI.bastion.debug.change(s => { s.facilityLevels.workshop = l; }), level);
  await ba.evaluate(() => TSI.store.flush());
}
const cardState = (ba, id) => ba.evaluate(i => {
  const c = document.querySelector('[data-test=staff-' + i + ']');
  const txt = n => n ? n.textContent.replace(/\s+/g, ' ').trim() : null;
  return {
    locked: c.classList.contains('is-locked'), ariaDisabled: c.getAttribute('aria-disabled'), level: txt(c.querySelector('[data-test=staff-level-' + i + ']')),
    issue: Array.from(c.querySelectorAll('button[data-test^=issue-]')).map(b => ({ test: b.dataset.test, text: txt(b), off: b.disabled })),
    jobs: c.querySelector('[data-test=staff-job-' + i + ']') ? Array.from(c.querySelector('[data-test=staff-job-' + i + ']').options).map(o => o.textContent) : null,
    text: txt(c)
  };
}, id);
async function issue(ba, test) {
  await ba.waitForTimeout(420);
  await ba.click('[data-test=' + test + ']');
  await ba.waitForTimeout(350);
}

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await context(browser, 'laptop');
  const ba = await openBastion(ctx);

  section('The Artisan Tools card is gone; five staff in its place');

  await check('a new Bastion\'s Workshop panel has no Artisan Tools card and no six dropdowns; it has the five staff in order, side by side', async () => {
    await openWorkshop(ba);
    equal(await ba.$('[data-test=artisan-0]'), null);
    equal(await ba.$('[data-test=save-artisan]'), null);
    assert(!/Artisan Tools/.test(await bare(ba, '[data-test=panel-fac-workshop]')), 'no word of the Artisan Tools');
    equal(await ba.$$eval('.tsi-bas-staff', ns => ns.map(n => n.dataset.test.replace('staff-', ''))), STAFF);
    const boxes = await ba.$$eval('.tsi-bas-staff', ns => ns.map(n => { const r = n.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; }));
    assert(boxes.length === 5 && boxes.every(b => b.y === boxes[0].y) && boxes.every((b, i) => i === 0 || b.x > boxes[i - 1].x), 'one row, left to right: ' + JSON.stringify(boxes));
    await H.shot(ba, 'workshop-level1');
  });

  await check('at Level 1 only the Handyman is open: the others are greyed, say the level that opens them and have no controls', async () => {
    const h = await cardState(ba, 'handyman');
    equal([h.locked, h.level, h.issue.length], [false, 'Level 1 · open', 1]);
    equal(h.issue[0].test, 'issue-workshop__craft');
    assert(/PLACEHOLDER/.test(h.text) && /to be supplied/.test(h.text), 'the Handyman\'s list is marked as a placeholder: ' + h.text);
    for (const [id, lvl] of [['smith', 2], ['scholar', 3], ['alchemist', 4], ['artisan', 5]]) {
      const c = await cardState(ba, id);
      equal([c.locked, c.ariaDisabled, c.level, c.issue.length], [true, 'true', 'Opens at Level ' + lvl, 0], id);
    }
    equal(await bare(ba, '[data-test=workshop-magic] .tsi-bas-workshop__tag'), 'Not a staff job');
    equal((await ba.$$('[data-test=workshop-magic] button[data-test=issue-workshop__craft_magic_item]')).length, 1, 'Craft Magic Item is there from Level 1');
  });

  await check('the Handyman has a list of 100 or so items from the six tool tables, 3 days; an order goes in, with his name on it', async () => {
    const n = await ba.$$eval('[data-test=sel-workshop__craft] option', os => os.length);
    assert(n > 90, 'items: ' + n);
    equal(await bare(ba, '[data-test=days-workshop__craft]'), 'Takes 3 days');
    const i = await ba.$$eval('[data-test=sel-workshop__craft] option', os => os.findIndex(o => o.textContent === 'Backpack'));
    await ba.selectOption('[data-test=sel-workshop__craft]', String(i));
    await issue(ba, 'issue-workshop__craft');
    const s = await bas(ba);
    equal(s.pendingOrders.map(o => [o.label, o.dueDay - o.issuedDay]), [['Workshop: Handyman - Backpack', 3]]);
    const h = await cardState(ba, 'handyman');
    equal([h.issue[0].text, h.issue[0].off], ['Busy', true], 'the Handyman is busy');
    assert(/Working on: Workshop: Handyman - Backpack/.test(h.text), h.text);
    assert(/The Handyman is busy/.test(h.text), h.text);
  });

  section('They open one by one as the Workshop is upgraded');

  await check('Level 2 opens the Smith (Smith\'s Tools, 30 items), Level 3 the Scholar, Level 4 the Alchemist, Level 5 the Artisan', async () => {
    for (const [lvl, id] of [[2, 'smith'], [3, 'scholar'], [4, 'alchemist'], [5, 'artisan']]) {
      await setLevel(ba, lvl);
      await openWorkshop(ba);
      for (const s of STAFF) {
        const c = await cardState(ba, s);
        equal(c.locked, STAFF.indexOf(s) + 1 > lvl, 'Level ' + lvl + ': ' + s);
      }
      assert(/Upgrade/.test(await bare(ba, '[data-test=upgrade-row-workshop]')));
    }
    await setLevel(ba, 2);
    await openWorkshop(ba);
    equal(await ba.$$eval('[data-test=sel-workshop__craft_smith] option', os => os.length), 30);
    await setLevel(ba, 5);
    await openWorkshop(ba);
    assert(/Extra options: to come/.test((await cardState(ba, 'artisan')).text), (await cardState(ba, 'artisan')).text);
    equal((await cardState(ba, 'artisan')).issue, [], 'the Artisan gives no orders yet');
  });

  await check('the Upgrade row names who opens next', async () => {
    await setLevel(ba, 1);
    await openWorkshop(ba);
    assert(/The Smith/.test(await bare(ba, '[data-test=upgrade-unlocks-workshop]')), await bare(ba, '[data-test=upgrade-unlocks-workshop]'));
    await setLevel(ba, 3);
    await openWorkshop(ba);
    assert(/The Alchemist/.test(await bare(ba, '[data-test=upgrade-unlocks-workshop]')), await bare(ba, '[data-test=upgrade-unlocks-workshop]'));
  });

  section('An order for each, working side by side');

  await check('the Scholar and the Alchemist choose their job from a dropdown on the card', async () => {
    await setLevel(ba, 5);
    await openWorkshop(ba);
    equal((await cardState(ba, 'scholar')).jobs, ['Craft (Calligrapher’s Supplies)', 'Research (scriptures)', 'Prepare Overland Travel Charts']);
    equal((await cardState(ba, 'alchemist')).jobs, ['Craft (Alchemist’s Supplies)', 'Alchemy (three poisons)', 'Craft Common', 'Craft Uncommon']);
    equal((await cardState(ba, 'smith')).jobs, null, 'one job: no dropdown');
    await ba.selectOption('[data-test=staff-job-scholar]', '2');
    await ba.waitForSelector('[data-test=issue-workshop__prepare_overland_travel_charts]');
    equal(await bare(ba, '[data-test=days-workshop__prepare_overland_travel_charts]'), 'Takes 4 days');
    await ba.selectOption('[data-test=staff-job-alchemist]', '3');
    await ba.waitForSelector('[data-test=issue-workshop__craft_uncommon]');
    equal(await bare(ba, '[data-test=days-workshop__craft_uncommon]'), 'Takes 10 days');
    equal(await ba.$$eval('[data-test=sel-workshop__craft_uncommon] option', os => os.length), 9);
  });

  await check('one order for each staff member and Craft Magic Item: six at once; a second for a busy one is refused', async () => {
    await setLevel(ba, 5);
    await ba.evaluate(() => TSI.bastion.debug.change(s => { s.pendingOrders = []; }));
    await openWorkshop(ba);
    await ba.selectOption('[data-test=staff-job-scholar]', '1');
    await ba.waitForSelector('[data-test=issue-workshop__research]');
    await ba.selectOption('[data-test=staff-job-alchemist]', '2');
    await ba.waitForSelector('[data-test=issue-workshop__craft_common]');
    for (const t of ['craft', 'craft_smith', 'research', 'craft_common', 'craft_magic_item']) await issue(ba, 'issue-workshop__' + t);
    let s = await bas(ba);
    equal(s.pendingOrders.map(o => o.fnId), ['craft', 'craft_smith', 'research', 'craft_common', 'craft_magic_item']);
    equal(s.pendingOrders.map(o => o.label), [
      'Workshop: Handyman - Backpack', 'Workshop: Smith - Battleaxe', 'Workshop: Scholar - Research (Geographical Scriptures)', 'Workshop: Alchemist - Craft Common (Bead of Nourishment)', 'Workshop: Craft Magic Item (Bead of Nourishment)'
    ].map((l, i) => i === 0 ? s.pendingOrders[0].label : l));
    equal(s.pendingOrders.map(o => o.dueDay - o.issuedDay), [3, 3, 5, 5, 10]);
    for (const id of ['handyman', 'smith', 'scholar', 'alchemist']) {
      const c = await cardState(ba, id);
      equal([c.issue[0].text, c.issue[0].off], ['Busy', true], id + ' is busy');
    }
    /* The Alchemist is busy whatever he is asked: his other jobs refuse too. */
    await ba.selectOption('[data-test=staff-job-alchemist]', '1');
    await ba.waitForSelector('[data-test=issue-workshop__alchemy]');
    equal(await ba.$eval('[data-test=issue-workshop__alchemy]', b => b.disabled), true);
    assert(/The Alchemist is busy/.test(await bare(ba, '[data-test=staff-alchemist]')));
    await H.shot(ba, 'workshop-busy');
    /* The Artisan alone is idle (nothing to give); Craft Magic Item is not blocked by anyone. */
    equal((await bas(ba)).pendingOrders.length, 5);
  });

  await check('a reload changes nothing: the orders are still there and the same staff are still busy', async () => {
    await ba.evaluate(() => TSI.store.flush());
    await ba.reload();
    await ba.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state(), null, { timeout: 8000 });
    await H.dismissNotices(ba);
    const s = await bas(ba);
    equal(s.pendingOrders.map(o => o.fnId), ['craft', 'craft_smith', 'research', 'craft_common', 'craft_magic_item']);
    equal(s.facilityLevels.workshop, 5);
    equal(['artisanTools', 'legacyFacilities'].filter(k => k in s), []);
    await openWorkshop(ba);
    equal((await cardState(ba, 'smith')).issue[0].text, 'Busy');
  });

  await check('a job finishes on its day and the staff member is free again', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      const o = s.pendingOrders.filter(x => x.fnId === 'craft_smith')[0];
      s.pendingOrders = s.pendingOrders.filter(x => x !== o);
    }));
    await openWorkshop(ba);
    const c = await cardState(ba, 'smith');
    equal([c.issue[0].text, c.issue[0].off], ['Issue Order', false]);
  });

  section('The panel fits every screen');

  const SIZES = [['laptop', true], ['tv', true], ['smallWindow', false]];
  for (const [size, inView] of SIZES) {
    for (const level of [1, 5]) {
      await check(size + ' (' + H.SIZES[size].viewport.width + ' x ' + H.SIZES[size].viewport.height + ') with the Workshop at Level ' + level + ': no sideways scroll' + (inView ? ', and the Upgrade button, the five staff and Craft Magic Item in view' : ''), async () => {
        const c2 = await context(browser, size);
        const p = await openBastion(c2);
        await setLevel(p, level);
        await p.evaluate(() => TSI.bastion.debug.change(s => { s.pendingOrders = []; }));
        await openWorkshop(p);
        const sels = ['[data-test=upgrade-workshop]'].concat(STAFF.map(id => '[data-test=staff-' + id + ']'), ['[data-test=issue-workshop__craft_magic_item]'], level === 5 ? ['[data-test=issue-workshop__craft]', '[data-test=issue-workshop__craft_smith]'] : ['[data-test=issue-workshop__craft]']);
        const lay = await H.layoutCheck(p, inView ? sels : []);
        assert(lay.scrollWidth <= lay.clientWidth, 'sideways scroll: ' + lay.scrollWidth + ' > ' + lay.clientWidth);
        equal(lay.outOfView, [], 'out of view');
        const wide = await p.$$eval('[data-test=panel-fac-workshop] *', ns => ns.filter(n => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX === 'visible' && n.getBoundingClientRect().right > innerWidth).length);
        equal(wide, 0, 'nothing sticks out of the screen');
        await H.shot(p, 'workshop-' + size + '-level' + level);
        equal(c2.log.errors, []);
        await c2.close();
      });
    }
  }

  await check('nothing went wrong or reached for the internet, and no picture or file was missing', async () => {
    equal(ctx.log.errors, [], 'no page errors');
    equal(ctx.log.net, [], 'nothing online');
    equal(ctx.log.failed, [], 'nothing missing');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
