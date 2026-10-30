/* Explorer: the ten new terrain events (T19 to T24, C13 to C16; 30 October 2026), played through on the real screen.
   Run:  node tests/e2e/explorer-terrain-events.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const MODAL = '.tsi-modal.tsi-exp-journey';
async function jClick(page, test) { await page.waitForTimeout(380); await page.click(MODAL + ' [data-test="' + test + '"]'); await page.waitForTimeout(80); }
const view = page => page.evaluate(() => { const m = document.querySelector('.tsi-modal.tsi-exp-journey'); return m ? { text: m.innerText, changes: (m.querySelector('[data-test=journey-changes]') || {}).textContent || '' } : null; });
async function start(page, id) {
  const ok = await page.evaluate(id => TSI.explorer.debug.startEvent(id), id);
  assert(ok, 'started ' + id);
  await page.waitForSelector(MODAL);
}
async function done(page) { await jClick(page, 'event-done'); await page.waitForSelector(MODAL, { state: 'detached', timeout: 4000 }).catch(() => {}); }

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('The terrain events at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name);
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(EXPLORER);
    await page.waitForSelector('[data-test=camp]');
    await page.selectOption('[data-test=map-select]', 'the_east_isle');
    await page.click('[data-test=load]');
    await page.waitForTimeout(300);

    await check('every new event opens with its code and title, some text, and a way forward', async () => {
      const list = [['t19', 'The Sunken Causeway'], ['t20', 'The Marsh Lights'], ['t21', 'The Cut Rope'], ['t22', 'Rockfall on the Face'], ['t23', 'Shepherd'], ['t24', 'The Lost Pilgrim'], ['c13', 'Fever in the Reeds'], ['c14', 'The Cairn of Names'], ['c15', 'Smoke on the Ridge'], ['c16', 'Hermit']];
      for (const [id, title] of list) {
        await start(page, id);
        const v = await view(page);
        assert(v.text.includes(title), id + ': ' + v.text.slice(0, 80));
        assert(v.text.length > 120, id + ' has text');
        await page.evaluate(() => TSI.explorer.debug.change(s => { s.journey.current = null; }));
        await page.keyboard.press('Escape');
        await page.waitForSelector(MODAL, { state: 'detached', timeout: 4000 }).catch(() => {});
        await page.evaluate(() => TSI.explorer.debug.change(s => { s.journey.current = null; }));
      }
    });

    await check('T19: reading the planks right finds the cache (+50 gold)', async () => {
      await start(page, 't19');
      await jClick(page, 'check-success');
      assert(/\+50 gold/.test((await view(page)).changes), (await view(page)).changes);
      await done(page);
    });

    await check('T19: a plank gives way, a hero sinks, nobody can haul them out: −12 miles and Mire-Caked', async () => {
      const before = await page.evaluate(() => TSI.explorer.debug.state().travel.milesAdjust || 0);
      await start(page, 't19');
      await jClick(page, 'check-failure');
      await page.check(MODAL + ' [data-test=failed-kaelen]');
      await jClick(page, 'each-continue');
      await jClick(page, 'check-failure');
      const v = await view(page);
      assert(/Mire-Caked/.test(v.changes), v.changes);
      equal((await page.evaluate(() => TSI.explorer.debug.state().travel.milesAdjust || 0)) - before, -12);
      await done(page);
    });

    await check('T20: following the lights goes to the fight, which names the crocodiles and opens the Combat Tracker', async () => {
      await start(page, 't20');
      await jClick(page, 'check-failure');
      await jClick(page, 'choice-0');
      const act = await page.textContent(MODAL + ' [data-test=journey-act]');
      assert(/Levels 7–10: 4 crocodiles/.test(act), act);
      await page.waitForTimeout(380);
      const [win] = await Promise.all([context.waitForEvent('page'), page.click(MODAL + ' [data-test=fight-send]')]);
      await win.waitForLoadState();
      assert(/\?tool=encounter$/.test(win.url()), win.url());
      await win.waitForSelector('.tsi-modal__title:text-is("A fight from the Explorer")');
      await win.close();
      await jClick(page, 'fight-won');
      assert(/\+100 gold/.test((await view(page)).changes));
      await done(page);
    });

    await check('C13: buying the remedy costs 50 gold and leaves no fever', async () => {
      await start(page, 'c13');
      await page.waitForTimeout(380);
      await page.check(MODAL + ' [data-test=failed-kaelen]');
      await jClick(page, 'each-continue');
      await jClick(page, 'choice-0');
      const v = await view(page);
      assert(/−50 gold|-50 gold/.test(v.changes), v.changes);
      assert(!/Marsh-Fever/.test(v.changes));
      await done(page);
    });

    await check('T23: pushing on through the weather with a failed save chills the hero (an effect until the next camp)', async () => {
      await start(page, 't23');
      await jClick(page, 'check-failure');
      await jClick(page, 'choice-0');
      await page.check(MODAL + ' [data-test=failed-kaelen]');
      await jClick(page, 'each-continue');
      assert(/Wind-Chilled/.test((await view(page)).changes), (await view(page)).changes);
      await done(page);
    });

    await check('nothing failed and nothing sideways', async () => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sideways scroll');
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }
  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
