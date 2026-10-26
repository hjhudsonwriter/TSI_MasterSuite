/* The DM doc: changing a score by hand (applied once by the Bastion), and the
   Pop out window (Harry, 19 October 2026): it opens wide (landscape) with the
   four panels in a grid, only one can be open at a time (a second click says
   so instead of opening a copy), and the Quest text typed in either window is
   seen in the other and lost by neither. Run with:
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

  await check('opening the Bastion applies it once: the score and a notice', async () => {
    const ba = await context.newPage();
    await ba.goto(INDEX + '?tool=bastion');
    await ba.waitForSelector('[data-test=day-status]');
    await ba.waitForFunction(() => TSI.bastion.debug.state().politicalCapital.blackstone === 15, null, { timeout: 8000 });
    const s = await bastionState(ba);
    await ba.waitForFunction(() => /Scores changed by the DM/.test(document.body.textContent));
    await ba.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
    await ba.reload();
    await ba.waitForSelector('[data-test=day-status]');
    await ba.waitForTimeout(2500);
    const again = await bastionState(ba);
    equal(again.politicalCapital.blackstone, 15, 'a reload applies nothing twice');
    await ba.close();
  });

  await check('the DM doc then says Applied, and shows the value from the Bastion', async () => {
    await home.waitForFunction(() => /Applied/.test((document.querySelector('[data-test=dmdoc-edit-item]') || {}).textContent || ''), null, { timeout: 8000 });
    const list = await items(home);
    equal(list[0][0], 'applied');
  });

  section('Pop out');
  let popOut = null;
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
    await home.waitForTimeout(500);
  });

  await check('the pop-out opens wide (landscape), with the four panels in a grid and the Quest box in it', async () => {
    await home.click('[data-test=dm-doc]');
    await home.waitForSelector('[data-test=dmdoc-popout]');
    const [pop] = await Promise.all([context.waitForEvent('page'), home.click('[data-test=dmdoc-popout]')]);
    await pop.waitForSelector('.tsi-dmdoc--docked [data-test=dmdoc-quest-text]');
    const g = await pop.evaluate(() => {
      const r = s => { const b = document.querySelector('[data-test=' + s + ']').getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
      return { win: [innerWidth, innerHeight], party: r('dmdoc-party'), bastion: r('dmdoc-bastion'), explorer: r('dmdoc-explorer'), quest: r('dmdoc-quest') };
    });
    assert(g.win[0] > g.win[1], 'landscape: ' + JSON.stringify(g.win));
    assert(g.win[0] >= 1000 && g.win[1] >= 650, 'about 1100 × 760: ' + JSON.stringify(g.win));
    assert(g.party.x < g.bastion.x && g.party.y === g.bastion.y && g.explorer.y > g.party.y && g.quest.x === g.bastion.x, '2 × 2, not stacked: ' + JSON.stringify(g));
    await H.shot(pop, 'dmdoc-popout-wide');
    popOut = pop;
  });

  await check('a second Pop out does not open a second window: a small message instead, and the floating DM doc stays', async () => {
    const before = context.pages().length;
    await home.click('[data-test=dm-doc]');                        /* the floating one is closed by Pop out: open it again */
    await home.waitForSelector('[data-test=dmdoc-popout]');
    await home.waitForTimeout(450);
    await home.click('[data-test=dmdoc-popout]');
    await H.waitForNotice(home, /already open in its own window/, 4000);
    await home.waitForTimeout(1200);
    equal(context.pages().length, before, 'no new window');
    equal(await home.isVisible('[data-test=dmdoc-panel]'), true, 'the floating one stays where it was');
  });

  await check('closing the pop-out lets one be opened again, and a double click still opens only one', async () => {
    await popOut.close();
    await home.waitForTimeout(800);
    const before = context.pages().length;
    const opened = context.waitForEvent('page');
    await home.dblclick('[data-test=dmdoc-popout]');
    popOut = await opened;
    await popOut.waitForSelector('.tsi-dmdoc--docked [data-test=dmdoc-quest-text]');
    await home.waitForTimeout(1200);
    equal(context.pages().length, before + 1, 'exactly one new window');
    equal(await popOut.$('[data-test=dmdoc-busy]'), null, 'and it is not the "already open" one');
  });

  await check('the Quest text typed in the pop-out shows in the floating DM doc, and the other way round; neither loses any', async () => {
    await home.click('[data-test=dm-doc]');                        /* floating, open again */
    await home.waitForSelector('[data-test=dmdoc-quest-text]');
    await popOut.click('[data-test=dmdoc-quest-text]');
    await popOut.keyboard.type('Typed in the pop-out.');
    await popOut.waitForFunction(() => document.querySelector('[data-test=dmdoc-quest-status]').textContent === 'Saved');
    await popOut.click('[data-test=dmdoc-bar]');                   /* done typing there: out of the box */
    /* The floating one looks again when its window is focused (it never reads it on the timer). */
    await home.evaluate(() => window.dispatchEvent(new Event('focus')));
    await home.waitForFunction(() => document.querySelector('[data-test=dmdoc-quest-text]').value === 'Typed in the pop-out.', null, { timeout: 4000 });
    await home.click('[data-test=dmdoc-quest-text]');
    await home.keyboard.press('Control+End');
    await home.keyboard.type(' And in the floating one.');
    await home.click('[data-test=dmdoc-bar]');                     /* clicking out saves at once */
    await popOut.evaluate(() => window.dispatchEvent(new Event('focus')));
    await popOut.waitForFunction(() => document.querySelector('[data-test=dmdoc-quest-text]').value === 'Typed in the pop-out. And in the floating one.', null, { timeout: 4000 });
  });

  await check('closing the pop-out straight after typing loses nothing, and a Pop out opened later has it', async () => {
    await popOut.click('[data-test=dmdoc-quest-text]');
    await popOut.keyboard.press('Control+End');
    await popOut.keyboard.type(' Last words.');
    await popOut.close();                                          /* before the short pause is over */
    await home.waitForTimeout(500);
    const text = await home.evaluate(() => TSI.store.fresh('tsi.dmdoc.quest', null).then(q => q && q.text));
    equal(text, 'Typed in the pop-out. And in the floating one. Last words.');
    const [again] = await Promise.all([context.waitForEvent('page'), home.click('[data-test=dmdoc-popout]')]);
    await again.waitForSelector('.tsi-dmdoc--docked [data-test=dmdoc-quest-text]');
    equal(await again.inputValue('[data-test=dmdoc-quest-text]'), 'Typed in the pop-out. And in the floating one. Last words.');
    await again.close();
  });

  await check('nothing reached for the internet, and nothing failed', async () => {
    equal(context.log.net, []);
    equal(context.log.failed, []);
    equal(context.log.errors, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
