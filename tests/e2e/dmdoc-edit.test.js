/* The DM doc: changing a score by hand (applied once by the Bastion) and the
   Pop out window (Harry, 19 October 2026). Run with:
   node tests/e2e/dmdoc-edit.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const INDEX = H.fileUrl('index.html');
const bastionState = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const items = page => page.$$eval('[data-test=dmdoc-edit-item]', ns => ns.map(n => [n.getAttribute('data-state'), n.textContent]));

(async () => {
  const browser = await H.chromium.launch();
  const context = await H.newContext(browser, 'laptop');
  await context.setOffline(true);
  const home = await context.newPage();

  section('Changing a score from the DM doc');
  await home.goto(INDEX);
  await home.waitForSelector('[data-test=dm-doc]');
  await home.click('[data-test=dm-doc]');
  await home.waitForSelector('[data-test=dmdoc-edit]');

  await check('a wrong value is refused with the reason, and the dialog comes back', async () => {
    await home.click('[data-test=dmdoc-edit]');
    await home.selectOption('[data-test=dmdoc-edit-kind]', 'pc');
    await home.selectOption('[data-test=dmdoc-edit-who]', 'blackstone');
    await home.fill('[data-test=dmdoc-edit-value]', '999');
    await H.clickModal(home, 'Set it');
    await home.waitForFunction(() => /goes from -100 to 100/.test(document.body.textContent));
    await H.clickModal(home, 'OK');
    await home.waitForSelector('[data-test=dmdoc-edit-value]');
    equal(await home.inputValue('[data-test=dmdoc-edit-value]'), '999', 'what was typed is still there');
    await H.clickModal(home, 'Cancel');
    equal(await home.evaluate(() => TSI.store.get('tsi.dmdoc.edits', null)), null, 'nothing was saved');
    await home.waitForTimeout(500);
  });

  await check('setting Political Capital for Blackstone to 15 waits for the Bastion', async () => {
    await home.click('[data-test=dmdoc-edit]');
    await home.selectOption('[data-test=dmdoc-edit-kind]', 'pc');
    await home.selectOption('[data-test=dmdoc-edit-who]', 'blackstone');
    await home.fill('[data-test=dmdoc-edit-value]', '15');
    await H.clickModal(home, 'Set it');
    await home.waitForFunction(() => document.querySelectorAll('[data-test=dmdoc-edit-item]').length === 1);
    const list = await items(home);
    equal(list[0][0], 'waiting');
    assert(/Political Capital, Clan Blackstone: set to \+15/.test(list[0][1]) && /open it to apply/.test(list[0][1]), list[0][1]);
  });

  await check('opening the Bastion applies it once: the score, the Day Log, a notice', async () => {
    const ba = await context.newPage();
    await ba.goto(INDEX + '?tool=bastion');
    await ba.waitForSelector('[data-test=day-status]');
    await ba.waitForFunction(() => TSI.bastion.debug.state().politicalCapital.blackstone === 15, null, { timeout: 8000 });
    const s = await bastionState(ba);
    equal(s.log.filter(l => /set by the DM/.test(l.body)).length, 1);
    assert(/Political Capital for Clan Blackstone set by the DM: 0 to 15\./.test(s.log[0].body), s.log[0].body);
    await ba.waitForFunction(() => /Scores changed by the DM/.test(document.body.textContent));
    await ba.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
    await ba.reload();
    await ba.waitForSelector('[data-test=day-status]');
    await ba.waitForTimeout(2500);
    const again = await bastionState(ba);
    equal([again.politicalCapital.blackstone, again.log.filter(l => /set by the DM/.test(l.body)).length], [15, 1], 'a reload applies nothing twice');
    await ba.close();
  });

  await check('the DM doc then says Applied, and shows the value from the Bastion', async () => {
    await home.waitForFunction(() => /Applied/.test((document.querySelector('[data-test=dmdoc-edit-item]') || {}).textContent || ''), null, { timeout: 8000 });
    const list = await items(home);
    equal(list[0][0], 'applied');
  });

  section('Pop out');
  await check('Pop out opens the DM doc in its own window, fills it, and closes the floating one', async () => {
    const [pop] = await Promise.all([context.waitForEvent('page'), home.click('[data-test=dmdoc-popout]')]);
    await pop.waitForSelector('.tsi-dmdoc--docked');
    assert(/dmdoc=1/.test(pop.url()), pop.url());
    equal(await home.isVisible('[data-test=dmdoc-panel]'), false, 'the floating one is closed');
    const box = await pop.$eval('.tsi-dmdoc--docked', n => { const r = n.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), innerWidth, innerHeight]; });
    equal([box[0], box[1]], [box[2], box[3]], 'it fills the window');
    equal(await pop.$$eval('[data-test=dmdoc-popout], [data-test=dmdoc-grip]:not([hidden])', n => n.length), 0, 'no pop out or resize grip in it');
    await pop.waitForFunction(() => document.querySelectorAll('[data-test=dmdoc-edit-item]').length === 1);
    equal(await pop.evaluate(() => /Already open/i.test(document.body.textContent)), false, 'no Already open warning');
    await H.shot(pop, 'dmdoc-popout');
    await pop.click('[data-test=dmdoc-edit]');
    await pop.selectOption('[data-test=dmdoc-edit-kind]', 'favour');
    await pop.selectOption('[data-test=dmdoc-edit-who]', 'pelagos');
    await pop.fill('[data-test=dmdoc-edit-value]', '40');
    await H.clickModal(pop, 'Set it');
    await pop.waitForFunction(() => document.querySelectorAll('[data-test=dmdoc-edit-item]').length === 2);
    const edits = await pop.evaluate(() => TSI.store.get('tsi.dmdoc.edits', null));
    equal(edits.map(e => [e.kind, e.key, e.value]), [['pc', 'blackstone', 15], ['favour', 'pelagos', 40]]);
    await pop.close();
  });

  await check('nothing reached for the internet, and nothing failed', async () => {
    equal(context.log.net, []);
    equal(context.log.failed, []);
    equal(context.log.errors, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
