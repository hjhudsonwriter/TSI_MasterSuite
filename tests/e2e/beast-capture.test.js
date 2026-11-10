/* The beast capture rules (Harry, 10 November 2026), from files with the internet off, at the laptop and the TV.
   Explorer: Grant a creature has a Settle check: no Beast-Catcher's Kit in the Travel bags means no grant; the tools that suit the chosen
   beast are offered (only the three best-fit ones), each one carried and ticked lowers the DC by 2; the typed total decides whether the beast
   comes Wary; a grant uses up the Kit and the single-use tools. The Kit and tools can be added to the bags. Bastion: a Wary beast is
   marked, and the Beast Pen asks DC 20 for it (a settled one asks its own 15 or 17).
   Run with:  node tests/e2e/beast-capture.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const exs = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const closeAll = async page => { for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };
const qty = (s, kind) => (s.journey.inventory || []).filter(i => i.kind === kind).reduce((n, i) => n + i.qty, 0);
const addBags = (page, list) => page.evaluate(l => TSI.explorer.debug.change(s => { Object.keys(l).forEach(k => TSI.explorer.journey.addItem(s, k, l[k])); }), list);

async function openDialog(ex) {
  await closeAll(ex);
  await ex.waitForTimeout(300);
  await ex.click('[data-test=creature-open]');
  await ex.waitForSelector('[data-test=creature-dialog]');
}
const grantButton = ex => ex.$('[data-test=creature-dialog] .tsi-modal__foot .tsi-btn--primary');

(async () => {
  const browser = await H.chromium.launch();
  for (const [name, size] of [['laptop', { width: 1707, height: 930 }], ['tv', { width: 1920, height: 1080 }]]) {
    section('Beast capture rules at ' + size.width + ' x ' + size.height + ' (' + name + ')');
    const context = await H.newContext(browser, name, { backedUp: true, acceptDownloads: true });
    await context.setOffline(true);
    await context.addInitScript(() => { Math.random = () => 0.99; });
    const errors = [];
    const ex = await context.newPage();
    ex.on('pageerror', e => errors.push('explorer: ' + e));
    await ex.goto(INDEX + '?tool=explorer');
    await ex.waitForSelector('[data-test=camp]');
    /* The Bastion is open beside it from the start: a Bastion that opens after a grant treats it as already sent. */
    const ba = await context.newPage();
    ba.on('pageerror', e => errors.push('bastion: ' + e));
    await ba.goto(INDEX + '?tool=bastion');
    await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 10000 });
    await ex.bringToFront();

    await check('with no Beast-Catcher\'s Kit in the Travel bags the Settle check says so, the tools are greyed, and Grant is off; the DC follows the beast chosen', async () => {
      await openDialog(ex);
      assert(await ex.$('[data-test=creature-settle]'), 'a Settle check section');
      assert(/none in the Travel bags/.test(await bare(ex, '[data-test=settle-kit]')), await bare(ex, '[data-test=settle-kit]'));
      equal(await (await grantButton(ex)).isDisabled(), true, 'Grant is off with no kit');
      equal(await ex.$eval('[data-test=creature-species]', s => s.value), 'wyvern');
      equal(await bare(ex, '[data-test=settle-dc]'), 'Settle DC 17 (no tools counted).', 'a wyvern: 17');
      await ex.selectOption('[data-test=creature-species]', 'fellcat');
      equal(await bare(ex, '[data-test=settle-dc]'), 'Settle DC 15 (no tools counted).', 'a fellcat: 15');
      equal(await ex.$$eval('[data-test=settle-tools] label', l => l.map(x => x.querySelector('span').textContent)), ['Stillroot Salve', 'Scent Lure', 'Beast Muzzle'], 'its three best-fit tools');
      equal(await ex.$$eval('[data-test=settle-tools] input', l => l.map(x => x.disabled)), [true, true, true], 'none in the bags, so none can be ticked');
      assert(/Tools carried that suit the fellcat \(each one lowers the Settle DC by 2\)/.test(await bare(ex, '[data-test=settle-tools-head]')));
      await ex.selectOption('[data-test=creature-species]', 'griffin');
      equal(await ex.$$eval('[data-test=settle-tools] label', l => l.map(x => x.querySelector('span').textContent)), ['Falconer’s Hood & Jesses', 'Scent Lure', 'Beast-Collar & Lead']);
      equal(await bare(ex, '[data-test=settle-dc]'), 'Settle DC 17 (no tools counted).');
      await ex.fill('[data-test=settle-total]', '30');
      equal(await (await grantButton(ex)).isDisabled(), true, 'a total does not help without a kit');
      equal((await H.layoutCheck(ex, ['[data-test=creature-dialog]'])).outOfView, [], 'the dialog fits the screen');
      await H.shot(ex, 'beast-capture-nokit-' + name);
      await ex.click('[data-test=creature-dialog] .tsi-modal__foot button:text-is("Cancel")');
      equal((await exs(ex)).journey.outbox.length, 0, 'nothing sent');
    });

    await check('the Kit and the tools can be added to the Travel bags by hand and are listed there with their words', async () => {
      await closeAll(ex);
      await ex.click('[data-test=bags-add]');
      await ex.waitForSelector('[data-test=bags-add-dialog]');
      const opts = await ex.$$eval('[data-test=bags-kind] option', o => o.map(x => x.value));
      ['beast_catchers_kit', 'beast_collar_lead', 'beast_chain_rig', 'stillroot_salve', 'dreamroot_salve', 'beast_salve', 'scent_lure', 'falconers_hood_jesses', 'jaw_strap_tail_sheath', 'handlers_gauntlets', 'beast_muzzle'].forEach(id => assert(opts.indexOf(id) !== -1, id + ' can be added'));
      await ex.selectOption('[data-test=bags-kind]', 'beast_catchers_kit');
      assert(/net, ropes and a whip/.test(await bare(ex, '[data-test=bags-help]')), await bare(ex, '[data-test=bags-help]'));
      await ex.fill('[data-test=bags-count]', '3');
      await ex.click('[data-test=bags-add-dialog] .tsi-modal__foot .tsi-btn--primary');
      await ex.waitForTimeout(400);
      equal(qty(await exs(ex), 'beast_catchers_kit'), 3);
      assert(/Beast-Catcher’s Kits/.test(await bare(ex, '[data-test=bags-list]')), 'listed in the bags');
      await addBags(ex, { stillroot_salve: 2, scent_lure: 1, beast_muzzle: 1, beast_chain_rig: 1 });
      equal(qty(await exs(ex), 'stillroot_salve'), 2);
    });

    await check('with a kit: the tools in the bags can be ticked, each lowers the DC by 2, only the beast\'s three count; the total says whether it comes Wary', async () => {
      await openDialog(ex);
      await ex.selectOption('[data-test=creature-species]', 'fellcat');
      assert(/3 in the Travel bags/.test(await bare(ex, '[data-test=settle-kit]')), await bare(ex, '[data-test=settle-kit]'));
      equal(await ex.$$eval('[data-test=settle-tools] input', l => l.map(x => x.disabled)), [false, false, false], 'Stillroot Salve, Scent Lure and Beast Muzzle are all in the bags');
      equal(await ex.$('[data-test=settle-tool-beast_chain_rig]'), null, 'the Chain Rig (not a fellcat tool) is not offered');
      equal(await (await grantButton(ex)).isDisabled(), true, 'Grant waits for the total');
      equal(await bare(ex, '[data-test=settle-result]'), 'Type the Animal Handling total to see the result.');
      await ex.check('[data-test=settle-tool-stillroot_salve]');
      equal(await bare(ex, '[data-test=settle-dc]'), 'Settle DC 13 (15, less 2 for 1 tool).');
      await ex.check('[data-test=settle-tool-scent_lure]');
      await ex.check('[data-test=settle-tool-beast_muzzle]');
      equal(await bare(ex, '[data-test=settle-dc]'), 'Settle DC 9 (15, less 6 for 3 tools).', 'a fully kitted party: 9');
      await ex.fill('[data-test=settle-total]', '8');
      assert(/under the DC: the beast comes Wary, and needs DC 20 to acclimatise at the Beast Pen/.test(await bare(ex, '[data-test=settle-result]')), await bare(ex, '[data-test=settle-result]'));
      equal(await (await grantButton(ex)).isDisabled(), false);
      await ex.fill('[data-test=settle-total]', '9');
      assert(/meets the DC: the beast is settled, and acclimatises at its own DC \(15\)/.test(await bare(ex, '[data-test=settle-result]')), await bare(ex, '[data-test=settle-result]'));
      await ex.fill('[data-test=settle-total]', '99');
      assert(/whole number from 1 to 60/.test(await bare(ex, '[data-test=settle-result]')));
      equal(await (await grantButton(ex)).isDisabled(), true, 'a total out of range keeps Grant off');
      await ex.uncheck('[data-test=settle-tool-beast_muzzle]');
      equal(await bare(ex, '[data-test=settle-dc]'), 'Settle DC 11 (15, less 4 for 2 tools).');
      await ex.selectOption('[data-test=creature-species]', 'sabrecat');
      equal(await ex.$$eval('[data-test=settle-tools] input', l => l.filter(x => x.checked).length), 0, 'changing the beast clears the ticks');
      equal(await bare(ex, '[data-test=settle-dc]'), 'Settle DC 15 (no tools counted).');
      await H.shot(ex, 'beast-capture-kit-' + name);
      await ex.click('[data-test=creature-dialog] .tsi-modal__foot button:text-is("Cancel")');
    });

    await check('a failed Settle: the grant goes out Wary, the Kit and the single-use tools are used up, the reusable tool stays, and the Day Log says so', async () => {
      await openDialog(ex);
      await ex.selectOption('[data-test=creature-species]', 'fellcat');
      await ex.check('[data-test=settle-tool-stillroot_salve]');
      await ex.check('[data-test=settle-tool-beast_muzzle]');
      await ex.fill('[data-test=settle-total]', '10');   /* DC 11, so 10 is under it */
      await ex.fill('[data-test=creature-name]', 'Ashfang');
      await ex.click('[data-test=creature-dialog] .tsi-modal__foot .tsi-btn--primary');
      await ex.waitForTimeout(300);
      const ask = await ex.$$eval('.tsi-modal', ms => ms[ms.length - 1].textContent.replace(/\s+/g, ' ').trim());
      assert(/Settle check: 10 against DC 11, so it comes Wary \(DC 20 to acclimatise\)\. Used up: Beast-Catcher’s Kit, Stillroot Salve\./.test(ask), ask);
      await ex.locator('.tsi-modal').last().locator('.tsi-modal__foot .tsi-btn--primary').click();
      await ex.waitForTimeout(500);
      const s = await exs(ex);
      equal(s.journey.outbox.length, 1);
      equal([s.journey.outbox[0].species, s.journey.outbox[0].name, s.journey.outbox[0].wary], ['fellcat', 'Ashfang', true]);
      equal([qty(s, 'beast_catchers_kit'), qty(s, 'stillroot_salve'), qty(s, 'scent_lure'), qty(s, 'beast_muzzle')], [2, 1, 1, 1], 'the Kit and one salve used up; the Lure was not ticked; the Muzzle stays');
      assert(/Settle check: 10 against DC 11/.test(await bare(ex, '[data-test=notice]')), await bare(ex, '[data-test=notice]'));
    });

    await check('a passed Settle: the grant goes out with no Wary mark, and the Kit is used up', async () => {
      await openDialog(ex);
      await ex.selectOption('[data-test=creature-species]', 'sabrecat');
      await ex.fill('[data-test=settle-total]', '15');
      await ex.click('[data-test=creature-dialog] .tsi-modal__foot .tsi-btn--primary');
      await ex.waitForTimeout(300);
      await ex.locator('.tsi-modal').last().locator('.tsi-modal__foot .tsi-btn--primary').click();
      await ex.waitForTimeout(500);
      const s = await exs(ex);
      equal(s.journey.outbox.length, 2);
      equal(['wary' in s.journey.outbox[1], s.journey.outbox[1].species], [false, 'sabrecat']);
      equal(qty(s, 'beast_catchers_kit'), 1);
    });

    await check('the Bastion holds the Wary beast marked, and the Beast Pen asks DC 20 for it (a settled beast asks its own DC)', async () => {
      await ba.bringToFront();
      await ba.waitForFunction(() => TSI.bastion.debug.state().creatures.length === 2, null, { timeout: 20000 });
      let b = await bas(ba);
      const ash = b.creatures.find(c => c.name === 'Ashfang');
      const sab = b.creatures.find(c => c.species === 'sabrecat');
      equal([ash.wary, 'wary' in sab], [true, false]);
      /* House both, give them a handler, and open the Pen. */
      await ba.evaluate(() => TSI.bastion.debug.change(s => {
        const R = TSI.bastion.rules;
        s.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
        s.facilityLevels.beast_pen = 1;
        s.creatures.forEach(c => { c.status = 'housed'; c.home = 'beast_pen'; c.housedDay = s.day; c.development = R.newDevelopment(c, s.day); c.development.handlerId = 'Mira'; });
      }));
      await ba.evaluate(() => TSI.store.flush());
      await closeAll(ba);
      await ba.click('[data-test=tile-beast_pen]');
      await ba.waitForSelector('[data-test=panel-fac-beast_pen]');
      const wary = await ba.$$eval('[data-test^=creature-wary-]', l => l.map(x => x.textContent));
      equal(wary.length, 1, 'only the Wary beast has the line');
      assert(/Wary: it failed its Settle check when it was captured, so it needs DC 20 to acclimatise\./.test(wary[0]), wary[0]);
      assert(/Ready to acclimatise: Mira rolls Animal Handling against DC 20 \(it is Wary\)\./.test(await bare(ba, '[data-test=creature-next-' + ash.id + ']')));
      assert(/Ready to acclimatise: Mira rolls Animal Handling against DC 15\./.test(await bare(ba, '[data-test=creature-next-' + sab.id + ']')), await bare(ba, '[data-test=creature-next-' + sab.id + ']'));
      /* The roll: the Wary beast first in the list. */
      const labels = await ba.$$eval('[data-test=sel-beast_pen__acclimatise] option', o => o.map(x => x.textContent));
      assert(/Ashfang \(Fellcat\) · Wary/.test(labels.join(' | ')), labels.join(' | '));
      await ba.selectOption('[data-test=sel-beast_pen__acclimatise]', { label: labels.find(l => /Wary/.test(l)) });
      assert(/DC 20 \(Wary\)/.test(await bare(ba, '[data-test=acclimatise-row] .tsi-bas-fn__cost')), await bare(ba, '[data-test=acclimatise-row] .tsi-bas-fn__cost'));
      await ba.click('[data-test=issue-beast_pen__acclimatise]');
      await ba.waitForSelector('[data-test=acclimatise-dialog]');
      const dlg = await bare(ba, '[data-test=acclimatise-dialog]');
      assert(/Ashfang is Wary \(it failed its Settle check\)\./.test(dlg) && /A total of 20 or more passes/.test(dlg) && /\(DC 20\)/.test(dlg), dlg);
      await ba.fill('[data-test=acclimatise-total]', '19');
      await ba.click('[data-test=acclimatise-dialog] .tsi-modal__foot .tsi-btn--primary');
      await ba.waitForTimeout(500);
      assert(/Failed\./.test(await ba.$$eval('.tsi-modal', ms => ms[ms.length - 1].textContent)), 'a 19 fails against DC 20');
      await H.clickModal(ba, 'OK');
      await H.shot(ba, 'beast-capture-pen-' + name);
      equal((await bas(ba)).creatures.find(c => c.name === 'Ashfang').development.bond.level, 0);
    });

    equal(errors, [], 'no page errors');
    await context.close();
  }
  await browser.close();
  H.summary();
})();
