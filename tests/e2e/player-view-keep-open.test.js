/* The Explorer's and the Bastion's Player Views stay open (26 October 2026): switching tool in the DM window, going Home or
   reloading the DM page does not close them; each keeps its last picture, and each finds its tool again by itself when
   the tool is opened again (no click). Both can be open at once. The Battlemap's window still closes with its tool
   (tests/e2e/phase7.test.js). Run with:  node tests/e2e/player-view-keep-open.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const EXPLORER = H.fileUrl('index.html') + '?tool=explorer';
const bare = (page, sel) => page.$eval(sel, n => n.innerText.replace(/\s+/g, ' ').trim());
const status = page => page.textContent('[data-test=player-view-status]');
async function switchTo(page, tool) {
  await page.click('[data-test=switch-tool]');
  await page.click('.tsi-menu__item[data-tool=' + tool + ']');
  await page.waitForSelector(tool === 'bastion' ? '[data-test=day-status]' : '[data-test=open-player-view]');
  await page.waitForTimeout(300);
}
async function home(page) {
  await page.click('[data-test=home]');
  await page.waitForSelector('.tsi-card');
}
async function open(page) {
  const [pv] = await Promise.all([page.waitForEvent('popup'), page.click('[data-test=open-player-view]')]);
  await pv.setViewportSize({ width: 1707, height: 930 });
  await pv.waitForSelector('[data-test=pv-waiting]', { state: 'hidden', timeout: 10000 });
  return pv;
}
/* The explorer window's Day pill and the bastion window's, as the numbers they show. */
const xDay = pv => pv.$eval('[data-test=pv-day] .tsi-xpv-pill__n', n => n.textContent);
const bDay = pv => pv.$eval('[data-test=pv-day] .tsi-bpv-pill__n', n => n.textContent);

(async () => {
  const browser = await H.chromium.launch();
  const context = await H.newContext(browser, 'laptop', { backedUp: true });
  await context.setOffline(true);
  const page = await context.newPage();

  section('Both windows, through a tour of the DM window');
  await page.goto(EXPLORER);
  await page.waitForSelector('[data-test=open-player-view]');
  let ex, ba;

  await check('open the Explorer\'s Player View', async () => {
    ex = await open(page);
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected');
    equal(await xDay(ex), '1');
  });

  await check('switch to the Bastion: the Explorer\'s window stays open with its picture; the Bastion opens its own window too', async () => {
    await switchTo(page, 'bastion');
    await page.waitForTimeout(800);
    assert(!ex.isClosed(), 'the Explorer window stays');
    equal(await ex.isVisible('[data-test=pv-waiting]'), false, 'and still shows its map');
    equal(await status(page), 'Not open', 'the Bastion has no window of its own yet');
    ba = await open(page);
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected');
    equal(await bDay(ba), '1');
    assert(!ex.isClosed(), 'both are open');
  });

  await check('the Explorer\'s window tells the quiet DM link what happened: it keeps its picture and says so', async () => {
    await ex.waitForFunction(() => /last picture|switched tool/.test(document.getElementById('tsi-player-status').textContent), null, { timeout: 12000 });
    equal(await ex.isVisible('[data-test=pv-waiting]'), false);
  });

  await check('back to the Explorer: its window is found again by itself (no click) and follows the DM again', async () => {
    await switchTo(page, 'explorer');
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected', null, { timeout: 8000 });
    assert(!ba.isClosed(), 'the Bastion window stays');
    await page.evaluate(() => TSI.explorer.debug.change(function (s) { s.journey.gold = 77; }));
    await ex.waitForFunction(() => /77/.test(document.querySelector('[data-test=pv-gold]').textContent), null, { timeout: 5000 });
    await ex.waitForFunction(() => document.getElementById('tsi-player-status').hidden, null, { timeout: 5000 });
  });

  await check('Home: both windows stay with their last pictures', async () => {
    await home(page);
    await page.waitForTimeout(1500);
    assert(!ex.isClosed() && !ba.isClosed(), 'both stay open');
    equal(await ex.isVisible('[data-test=pv-waiting]'), false);
    equal(await ba.isVisible('[data-test=pv-waiting]'), false);
    equal(await bDay(ba), '1');
  });

  await check('the Bastion again from Home: its window is found by itself and follows a change', async () => {
    await page.click('.tsi-card[data-tool=bastion]');
    await page.waitForSelector('[data-test=day-status]');
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected', null, { timeout: 8000 });
    await page.evaluate(() => TSI.bastion.debug.change(function (s) { s.treasuryGP = 321; }));
    await ba.waitForFunction(() => document.querySelector('[data-test=pv-gp] .tsi-bpv-pill__n').textContent === '321', null, { timeout: 5000 });
  });

  await check('Open Player View with the window already open and linked brings it forward: no second window', async () => {
    let extra = 0;
    context.on('page', () => { extra++; });
    await page.click('[data-test=open-player-view]');
    await page.waitForTimeout(600);
    equal(extra, 0);
  });

  await check('reloading the DM page: the Bastion window stays, and reconnects by itself', async () => {
    await page.reload();
    await page.waitForSelector('[data-test=day-status]');
    assert(!ba.isClosed(), 'it stays');
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected', null, { timeout: 8000 });
    await page.evaluate(() => TSI.bastion.debug.change(function (s) { s.treasuryGP = 555; }));
    await ba.waitForFunction(() => document.querySelector('[data-test=pv-gp] .tsi-bpv-pill__n').textContent === '555', null, { timeout: 5000 });
  });

  await check('after a reload, Open Player View finds the existing window by its name instead of opening a second', async () => {
    await page.reload();
    await page.waitForSelector('[data-test=day-status]');
    let extra = 0;
    context.on('page', () => { extra++; });
    await page.click('[data-test=open-player-view]');
    await page.waitForTimeout(1200);
    equal(extra <= 1, true);
    assert(!ba.isClosed(), 'the window stays');
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Connected', null, { timeout: 8000 });
    equal(await context.pages().filter(p => /view=bastion/.test(p.url())).length, 1, 'one Bastion window');
  });

  await check('the player closing a window by hand just ends it; the DM says Not open', async () => {
    await ba.close();
    await page.waitForFunction(() => document.querySelector('[data-test=player-view-status]').textContent === 'Not open', null, { timeout: 5000 });
  });

  await check('nothing in the Explorer\'s window stays dark when the DM has gone (a held fade is released)', async () => {
    await home(page);
    await page.waitForTimeout(500);
    equal(await ex.$eval('[data-test=pv-dim]', n => Number(n.style.opacity || 0)), 0);
    equal(await ex.isVisible('[data-test=pv-pin]'), false);
  });

  await check('if the DM\'s browser window is closed for good, the player window closes itself after about 30 seconds', async () => {
    await page.close();
    await ex.waitForEvent('close', { timeout: 50000 }).catch(() => {});
    assert(ex.isClosed(), 'it closed');
  });

  const bad = context.log.net.concat(context.log.failed, context.log.errors);
  await check('nothing went online, no file was missing, no errors', async () => { equal(bad.filter(x => !/ERR_ABORTED/.test(x)), []); });
  await context.close();

  await browser.close();
  H.summary();
})();
