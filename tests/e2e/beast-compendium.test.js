/* The Compendium of Beasts (5 November 2026, Harry): a small book in the Beast Pen's panel, in the DM's view (a pop-up) and in the
   Bastion's Player View (a book over the panel). Six tabs, one for each kind; each page is Harry's engraving on parchment, the kind's
   name, its Regional Varieties (the Beast Handler's own list) and a general description. A kind with no picture file yet says so.
   Run with:  node tests/e2e/beast-compendium.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const KINDS = ['buckbear', 'dire_wolf', 'fellcat', 'griffin', 'sabrecat', 'wyvern'];
const NAMES = ['Buckbear', 'Dire Wolf', 'Fellcat', 'Griffin', 'Sabrecat', 'Wyvern'];

async function openPlayer(page, size) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize(size);
  await pv.waitForSelector('[data-test=pv-stage]');
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  return pv;
}
const imgLoaded = (page, scope) => page.$eval(scope + ' [data-test=bc-img]', i => ({ ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight })).catch(() => null);

async function checkBook(page, scope, size, shot) {
  equal(await page.$$eval(scope + ' [data-test^=bc-tab-]', n => n.map(x => x.textContent)), NAMES.concat(['Beast-Catcher’s Guide']), 'six tabs, one of each kind, and the Beast-Catcher\'s Guide');
  const guideData = await page.evaluate(() => JSON.parse(JSON.stringify(TSI_DATA.beastCatcher)));
  for (const [i, k] of KINDS.entries()) {
    await page.click(scope + ' [data-test=bc-tab-' + k + ']');
    equal((await page.textContent(scope + ' [data-test=bc-title]')).trim(), NAMES[i]);
    equal(await page.getAttribute(scope + ' [data-test=bc-tab-' + k + ']', 'aria-selected'), 'true');
    const want = await page.evaluate(id => TSI_DATA.beastProfile.species[id].regional.map(v => v.name), k);
    equal(await page.$$eval(scope + ' [data-test=bc-variety] b', n => n.map(x => x.textContent)), want, NAMES[i] + ' varieties');
    assert((await page.textContent(scope + ' [data-test=bc-desc]')).length > 200, 'a description');
    /* The foot of the page: the three tools of the beast's best-fit loadout, under the guide's sentence (6 November 2026). */
    {
      const want = guideData.loadouts[k].map(id => guideData.items.find(i => i.id === id).name);
      equal(await page.$$eval(scope + ' [data-test=bc-tool]', n => n.map(x => x.textContent)), want, NAMES[i] + ' tools');
      equal((await page.textContent(scope + ' .tsi-bc__tools-lead')).trim(), 'Beast-Catchers have been known to use the following tools to capture and subdue ' + guideData.plural[k] + ':');
    }
    {
      await page.waitForFunction(s => { const i = document.querySelector(s + ' [data-test=bc-img]'); return i && i.complete; }, scope, { timeout: 8000 });
      const im = await imgLoaded(page, scope);
      assert(im && im.ok && im.w === 2000 && im.h === 1500, k + ' picture loads, 2000 x 1500: ' + JSON.stringify(im));
      const box = await page.$eval(scope + ' [data-test=bc-page]', e => { const r = e.getBoundingClientRect(); return r.width / r.height; });
      assert(Math.abs(box - 4 / 3) < 0.03, 'the page is 4:3, the shape of the engraving');
    }
  }
  /* The writing sits cleanly in the empty side of each picture: inside the page, nothing cut off, clear of the beast. */
  const SIDE = { buckbear: 'left', dire_wolf: 'left', fellcat: 'right', griffin: 'left', sabrecat: 'left', wyvern: 'right' };
  for (const k of KINDS) {
    await page.click(scope + ' [data-test=bc-tab-' + k + ']');
    const g = await page.evaluate(s => {
      const pg = document.querySelector(s + ' [data-test=bc-page]'), tx = document.querySelector(s + ' [data-test=bc-text]');
      const p = pg.getBoundingClientRect(), t = tx.getBoundingClientRect();
      const kids = Array.from(tx.children).map(c => c.getBoundingClientRect());
      return { side: pg.getAttribute('data-side'), l: (t.left - p.left) / p.width, r: (p.right - t.right) / p.width, fits: tx.scrollHeight <= tx.clientHeight + 1, lastBottom: Math.max.apply(null, kids.map(c => c.bottom)) <= t.bottom + 1, inside: t.left >= p.left && t.right <= p.right && t.top >= p.top && t.bottom <= p.bottom, ph: p.height, pw: p.width };
    }, scope);
    equal(g.side, SIDE[k], k + ' text side');
    assert(g.fits && g.lastBottom && g.inside, k + ' text fits its space: ' + JSON.stringify(g));
    assert((SIDE[k] === 'left' ? g.r : g.l) >= 0.5, k + ' text stays on its half');
  }
  /* The Beast-Catcher's Guide: everything in the document, laid out as cards, a table and a list; it scrolls inside the same page. */
  await page.click(scope + ' [data-test=bc-tab-catchers_guide]');
  equal((await page.textContent(scope + ' [data-test=bc-title]')).trim(), 'Beast-Catcher’s Guide');
  equal(await page.$$eval(scope + ' [data-test=bc-kit]', n => n.length), 1, 'the Kit');
  equal(await page.$$eval(scope + ' [data-test=bc-item] .tsi-bc__card-name', n => n.map(x => x.textContent)), guideData.items.map(i => i.name), 'the ten tools, in the guide\'s order');
  assert(guideData.items.length === 10, 'ten tools');
  equal(await page.$$eval(scope + ' [data-test=bc-loadout]', n => n.map(r => [r.dataset.kind].concat(Array.from(r.querySelectorAll('td')).map(c => c.textContent)))),
    Object.keys(guideData.loadouts).map(k => [k].concat(guideData.loadouts[k].map(id => guideData.items.find(i => i.id === id).name))), 'the best-fit table, six beasts of three tools');
  equal(await page.$$eval(scope + ' [data-test=bc-how] dt', n => n.map(x => x.textContent)), ['Subdue', 'Settle', 'Failure', 'Reuse', 'The carry home']);
  const gtext = await page.textContent(scope + ' [data-test=bc-guide]');
  ['A party cannot attempt to subdue and capture a beast without the Beast-Catcher’s Kit', 'DC 10 Strength to escape', 'DC 20 Strength to break free', 'does not lower the DC', 'Beast-Catcher’s Kit from the Travel bags (no kit, no grant)', 'DC 9 or 11', 'it needs DC 20 to acclimatise'].forEach(x => assert(gtext.indexOf(x) !== -1, 'the guide says: ' + x));
  {
    const sc = await page.$eval(scope + ' [data-test=bc-page]', e => { e.scrollTop = e.scrollHeight; return { top: e.scrollTop, max: e.scrollHeight - e.clientHeight, w: e.scrollWidth <= e.clientWidth }; });
    assert(sc.max > 0 && sc.top >= sc.max - 2 && sc.w, 'the page scrolls to its end, with no sideways scroll: ' + JSON.stringify(sc));
    const last = await page.$eval(scope + ' [data-test=bc-how] dd:last-of-type', e => { const r = e.getBoundingClientRect(), p = e.closest('[data-test=bc-page]').getBoundingClientRect(); return r.bottom <= p.bottom + 1 && r.top >= p.top; });
    assert(last, 'the last line is in view at the end');
    await page.$eval(scope + ' [data-test=bc-page]', e => { e.scrollTop = 0; });
  }
  await page.click(scope + ' [data-test=bc-tab-sabrecat]');
  const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const pb = await page.$eval(scope + ' [data-test=bc-page]', e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
  assert(pb.top >= 0 && pb.bottom <= vp.h && pb.left >= 0 && pb.right <= vp.w, 'the whole page is in view: ' + JSON.stringify([pb, vp]));
  await page.click(scope + ' [data-test=bc-tab-sabrecat]');
  await page.focus(scope + ' [data-test=bc-tab-sabrecat]');
  await page.keyboard.press('ArrowRight');
  equal((await page.textContent(scope + ' [data-test=bc-title]')).trim(), 'Wyvern', 'arrow keys move between the tabs');
  await page.keyboard.press('End');
  equal((await page.textContent(scope + ' [data-test=bc-title]')).trim(), 'Beast-Catcher’s Guide', 'End goes to the guide');
  await page.keyboard.press('Home');
  equal((await page.textContent(scope + ' [data-test=bc-title]')).trim(), 'Buckbear');
  const lay = await H.layoutCheck(page, [scope + ' [data-test=bc-page]', scope + ' [data-test=bc-tabs]']);
  equal(lay.scrollWidth <= lay.clientWidth, true, 'no sideways scroll');
  equal(lay.outOfView, [], 'in view');
  await H.shot(page, shot);
}

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Compendium of Beasts at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name, { backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(INDEX + '?tool=bastion');
    await page.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug, null, { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => TSI.bastion.debug.change(s => { s.builtExtras[0] = { facId: 'beast_pen', status: 'built' }; }));
    const pv = await openPlayer(page, size);
    await page.click('[data-test=tile-beast_pen]');
    await page.waitForSelector('[data-test=beast-compendium-open]');

    await check('the DM\'s Beast Pen panel has a Compendium of Beasts button; it opens a pop-up book with a tab for each beast (the engraving, varieties, a description and its tools) and the Beast-Catcher\'s Guide', async () => {
      await page.click('[data-test=beast-compendium-open]');
      await page.waitForSelector('.tsi-bc-modal [data-test=bc]');
      assert((await page.textContent('.tsi-bc-modal')).includes('Compendium of Beasts'), 'titled');
      await checkBook(page, '.tsi-bc-modal', size, 'compendium-dm-' + name);
    });

    await check('Esc closes the pop-up and nothing was changed in the save', async () => {
      const before = await page.evaluate(() => JSON.stringify(TSI.bastion.rules.toSave(TSI.bastion.debug.state())));
      await page.keyboard.press('Escape');
      await page.waitForSelector('.tsi-bc-modal', { state: 'detached' });
      equal(await page.evaluate(() => JSON.stringify(TSI.bastion.rules.toSave(TSI.bastion.debug.state()))), before);
    });

    await check('the players\' Beast Pen panel has a small book button; the book opens over the panel with the same six pages, and closes with its × or Esc', async () => {
      await pv.waitForSelector('[data-test=pv-panel][data-fac=beast_pen]');
      equal(await pv.isVisible('[data-test=pv-compendium]'), false, 'shut until pressed');
      await pv.click('[data-test=pv-compendium-open]');
      await pv.waitForSelector('[data-test=pv-compendium]', { state: 'visible' });
      equal(await pv.getAttribute('[data-test=pv-compendium-open]', 'aria-expanded'), 'true');
      await checkBook(pv, '[data-test=pv-compendium]', size, 'compendium-pv-' + name);
      await pv.click('[data-test=pv-compendium-close]');
      await pv.waitForSelector('[data-test=pv-compendium]', { state: 'hidden' });
      await pv.click('[data-test=pv-compendium-open]');
      await pv.waitForSelector('[data-test=pv-compendium]', { state: 'visible' });
      await pv.keyboard.press('Escape');
      await pv.waitForSelector('[data-test=pv-compendium]', { state: 'hidden' });
      equal(await pv.isVisible('[data-test=pv-panel][data-fac=beast_pen]'), true, 'the panel is still there');
    });

    await check('the book stays open while the DM changes things, and closes when the panel goes', async () => {
      await pv.click('[data-test=pv-compendium-open]');
      await page.evaluate(() => TSI.bastion.debug.change(s => { s.treasuryGP = (s.treasuryGP || 0) + 1; }));
      await page.waitForTimeout(600);
      equal(await pv.isVisible('[data-test=pv-compendium]'), true, 'a change in the DM view does not shut it');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await pv.waitForSelector('[data-test=pv-panel]', { state: 'detached', timeout: 8000 }).catch(() => {});
      equal(await pv.isVisible('[data-test=pv-compendium]'), false, 'it goes with the panel');
    });

    await check('no errors on the way', async () => { equal(errors, []); equal(context.log.errors, []); });
    await context.close();
  }
  await browser.close();
  H.summary();
})().catch(e => { console.error(e); process.exit(1); });
