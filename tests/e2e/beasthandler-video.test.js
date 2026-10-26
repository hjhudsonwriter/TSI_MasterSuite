/* Scarlett Isles: Beast Handler — the picture's loop (Harry, 26 October 2026). Hold a beast's picture and, if its variety has
   a short video, it plays over the picture and loops; let go and it stops. A variety with no video has no clip at all.
   Run with:  node tests/e2e/beasthandler-video.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');

(async () => {
  const browser = await H.chromium.launch();
  section('Beast Handler: the picture loop');
  const ctx = await H.newContext(browser, 'laptop', { backedUp: true });
  await ctx.setOffline(true);
  const ex = await ctx.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await ctx.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    s.partyLevel = 9; s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
    s.facilityLevels.beast_pen = 1;
    const mk = (id, species, name, regional) => {
      const c = { id, species, owner: '', name, status: 'housed', home: 'beast_pen', grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira'; c.development.bond.level = 2;
      c.development.regional = regional;
      return c;
    };
    s.creatures = [mk('cr-iron', 'wyvern', 'Ironwing', 'Ironcrown'), mk('cr-widow', 'wyvern', 'Widowwing', 'Widowspine')];
  }));
  await ba.evaluate(() => TSI.store.flush());
  await ba.waitForTimeout(500);
  const bh = await ctx.newPage();
  await bh.goto(HARNESS + '?tool=beasthandler');
  await bh.waitForSelector('[data-test=bh-viewas]');
  await bh.selectOption('[data-test=bh-viewas]', 'Mira');
  await bh.waitForSelector('[data-test=bh-beast-cr-iron][data-mine=yes]');

  await check('tapping the picture of a variety with a video plays it once, then the still returns', async () => {
    await bh.click('[data-test=bh-beast-cr-iron]');
    await bh.waitForSelector('[data-test=bh-clip]', { state: 'attached' });
    const before = await bh.$eval('[data-test=bh-clip]', v => ({ paused: v.paused, loop: v.loop, muted: v.muted, shown: getComputedStyle(v).opacity }));
    equal(before.paused, true, 'not playing before it is held');
    equal(before.loop, false, 'it plays once, not on a loop');
    equal(before.muted, true);
    equal(before.shown, '0', 'invisible before it is held');
    await bh.waitForFunction(() => document.querySelector('[data-test=bh-clip]').readyState >= 3, null, { timeout: 15000 });
    await bh.click('[data-test=bh-greet-large]');
    await bh.waitForFunction(() => { const v = document.querySelector('[data-test=bh-clip]'); return !v.paused && v.currentTime > 0.3; }, null, { timeout: 8000 });
    equal(await bh.$eval('.tsi-bh-hero2', f => f.classList.contains('tsi-bh-hero2--clip')), true, 'the clip shows while it plays');
    await bh.waitForFunction(() => !document.querySelector('.tsi-bh-hero2').classList.contains('tsi-bh-hero2--clip'), null, { timeout: 20000 });
    equal(await bh.$eval('[data-test=bh-clip]', v => v.paused), true, 'and it stops by itself at the end, the still returning');
  });

  await check('a variety with no video has no clip, and its tap still gives the greeting glow', async () => {
    await bh.click('[data-test=bh-back]');
    await bh.waitForSelector('[data-test=bh-beast-cr-widow]');
    await bh.evaluate(() => { const b = document.querySelector('[data-test=bh-beast-cr-widow]'); if (b) b.click(); });
    await bh.waitForSelector('[data-test=bh-bond]');
    equal(await bh.$('[data-test=bh-clip]'), null);
    await bh.click('[data-test=bh-greet-large]');
    assert(await bh.$eval('.tsi-bh-hero2', f => f.classList.contains('tsi-bh-hero2--greet')), 'the glow still plays');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
