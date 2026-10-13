/* The Explorer link (pull request 4 of the facilities overhaul, Harry's
   answers of 13 October 2026), clicked through from a double-clicked
   index.html with the internet off:
   - one window per campaign tool: a second Explorer or Bastion window
     waits, warns nobody, and opens by itself when the first closes; a
     campaign Import and Restore are refused while the other tool is open;
   - an Explorer event changes a Clan's Honour/Respect in the Bastion once,
     with both open, with the Bastion shut for days, after Reset Travel, and
     never after a Bastion Reset (skipped and listed instead);
   - the Party bags: charts (one more hex a day, 3 days of use each) and
     packs (advantage at C8's vigil, once, kept after a reload);
   - typing in an Honour/Respect box while a change lands keeps both.
   Run with:  node tests/e2e/bridge.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const pause = page => page.waitForTimeout(400);
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const exs = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.explorer.debug.state())));

async function context(browser, size) {
  const ctx = await H.newContext(browser, size || 'laptop', { acceptDownloads: true });
  await ctx.setOffline(true);
  /* No travel or campfire events and no weather by chance: the checks start the events they need. */
  await ctx.addInitScript(() => { Math.random = () => 0.99; });
  return ctx;
}
async function open(ctx, tool) {
  const p = await ctx.newPage();
  await p.goto(INDEX + (tool ? '?tool=' + tool : ''));
  await p.waitForTimeout(300);
  return p;
}
async function openExplorer(ctx) {
  const p = await open(ctx, 'explorer');
  await p.waitForSelector('[data-test=camp]');
  return p;
}
async function openBastion(ctx) {
  const p = await open(ctx, 'bastion');
  await p.waitForFunction(() => TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  return p;
}
async function setRegion(ex, region) {
  await ex.selectOption('[data-test=region]', region);
  await ex.waitForTimeout(100);
}
/* Start a chosen event, as if it had come up. */
async function start(ex, id, kind) {
  const ok = await ex.evaluate(([id, kind]) => TSI.explorer.debug.startEvent(id, kind), [id, kind]);
  assert(ok, 'couldn\'t start ' + id);
  await ex.waitForSelector('.tsi-modal.tsi-exp-journey');
}
async function jClick(ex, test) {
  await ex.waitForTimeout(380);
  await ex.click('.tsi-modal.tsi-exp-journey [data-test="' + test + '"]');
  await ex.waitForTimeout(80);
}
async function playC10Won(ex) {
  await setRegion(ex, 'western_province');
  await start(ex, 'c10', 'camp');
  await jClick(ex, 'check-success');
  await jClick(ex, 'choice-0');
  await jClick(ex, 'fight-won');
  const changes = await ex.textContent('[data-test=journey-changes]');
  await jClick(ex, 'event-done');
  return changes;
}
async function playT4Won(ex) {
  await setRegion(ex, 'eastern_province');
  await start(ex, 't4', 'travel');
  await jClick(ex, 'choice-0');
  await jClick(ex, 'round-hero');
  await jClick(ex, 'round-hero');
  await jClick(ex, 'event-done');
}
/* Make Camp, closing whatever the night brings. */
async function camp(ex) {
  await pause(ex);
  await ex.click('[data-test=camp]');
  for (let n = 0; n < 12; n++) {
    await ex.waitForTimeout(250);
    if (!(await ex.$('.tsi-modal'))) { if (n > 2) break; continue; }
    await ex.click('.tsi-modal__foot button:last-child');
  }
}
async function sentStatuses(ex) {
  return ex.$$eval('[data-test=sent]', ns => ns.map(n => n.getAttribute('data-status')));
}
async function waitStatus(ex, statuses, timeout) {
  await ex.waitForFunction(want => {
    const got = Array.from(document.querySelectorAll('[data-test=sent]')).map(n => n.getAttribute('data-status'));
    return JSON.stringify(got) === JSON.stringify(want);
  }, statuses, { timeout: timeout || 8000 });
}
async function alreadyOpenShown(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.tsi-notice')).some(n => /Already open/.test(n.textContent)));
}
async function influenceRows(ba) {
  await ba.evaluate(() => TSI.bastion.debug.reveal('bridge-log'));
  await ba.waitForSelector('[data-test=bridge-log]');
  const rows = await ba.$$eval('[data-test=bridge-row]', ns => ns.map(n => ({ r: n.getAttribute('data-result'), text: n.textContent.replace(/\s+/g, ' ').trim() })));
  await ba.keyboard.press('Escape');
  await ba.waitForTimeout(150);
  return rows;
}

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('One window per campaign tool');
  const A = await context(browser, 'laptop');
  const ex = await openExplorer(A);
  let ba = await openBastion(A);
  let ba2 = null;
  let ex2 = null;

  await check('a second Bastion window waits: it says the Bastion is open in another window and runs none of it', async () => {
    ba2 = await open(A, 'bastion');
    await ba2.waitForSelector('[data-test=tool-waiting]');
    const t = await ba2.textContent('[data-test=tool-waiting]');
    assert(/The Ironbow Bastion Manager is open in another window/.test(t), t);
    assert(/opens here by itself/.test(t), t);
    equal(await ba2.evaluate(() => !!(TSI.bastion && TSI.bastion.debug)), false, 'the Bastion never started here');
    assert(/^Waiting · /.test(await ba2.title()), await ba2.title());
  });

  await check('a second Explorer window waits too', async () => {
    ex2 = await open(A, 'explorer');
    await ex2.waitForSelector('[data-test=tool-waiting]');
    assert(/Scarlett Isles Explorer is open in another window/.test(await ex2.textContent('[data-test=tool-waiting]')));
    equal(await ex2.evaluate(() => !!(TSI.explorer && TSI.explorer.debug)), false);
  });

  await check('nobody shows the "Already open" warning: a waiting window can\'t save', async () => {
    await ex.waitForTimeout(4500);
    for (const p of [ex, ba, ba2, ex2]) equal(await alreadyOpenShown(p), false, p.url());
  });

  await check('a campaign Import in the Explorer is refused while the Bastion is open in another window', async () => {
    const file = await H.download(ex, '[data-test=export]');
    await H.chooseFile(ex, '[data-test=import]', H.writeTemp('campaign.json', file.text));
    const t = await H.modalText(ex);
    assert(/The Ironbow Bastion Manager is open in another window\. Close it first/.test(t), t);
    await H.clickModal(ex, 'OK');
  });

  await check('Restore on the home screen is refused while either tool is open', async () => {
    const home = await open(A, null);
    await home.waitForSelector('[data-test=restore]');
    const b = await H.download(home, '[data-test=backup-everything]');
    await H.chooseFile(home, '[data-test=restore]', H.writeTemp('suite.json', b.text));
    const t = await H.modalText(home);
    assert(/is open in another window\. Close it first: restoring replaces everything/.test(t), t);
    await H.clickModal(home, 'OK');
    await home.close();
  });

  await check('closing the first Bastion window opens the waiting one by itself', async () => {
    await ba.close();
    await ba2.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 10000 });
    equal(await ba2.$('[data-test=tool-waiting]'), null);
    ba = ba2;
    await ex2.close();
  });

  /* ------------------------------------------------------------------ */
  section('Both tools open: an Explorer event changes Honour/Respect once');

  await check('C10, the raiders beaten: the event says it sent +1 with Clan Farmer, and makes no Notice Board note', async () => {
    const changes = await playC10Won(ex);
    assert(/Sent to the Bastion: Honour\/Respect \+1 with Clan Farmer\./.test(changes), changes);
    assert(!/Notice Board/.test(changes), changes);
    const out = (await exs(ex)).journey.outbox;
    equal(out.map(m => [m.clan, m.hr]), [['farmer', 1]]);
  });

  await check('within a few seconds the Bastion has it: Honour/Respect +1, a Day Log line and a notice', async () => {
    await ba.waitForFunction(() => TSI.bastion.debug.state().honourRespectByClan.farmer === 1, null, { timeout: 6000 });
    const s = await bas(ba);
    assert(s.log.some(l => l.title === 'From the Explorer' && /Clan Farmer/.test(l.body)), 'the Day Log');
    await H.waitForNotice(ba, /From the Explorer: Honour\/Respect \+1 with Clan Farmer/);
    const rows = await influenceRows(ba);
    equal(rows.length, 1);
    assert(rows[0].r === 'applied' && /Clan Farmer \+1 \(0 → \+1\)/.test(rows[0].text), rows[0].text);
  });

  await check('the Explorer\'s "Sent to the Bastion" says Applied', async () => {
    await waitStatus(ex, ['applied']);
    const line = await ex.textContent('[data-test=sent-line]');
    assert(/^Applied on Day 1: 0 → \+1\.$/.test(line), line);
  });

  await check('reloading both changes nothing: still +1, once', async () => {
    await ba.reload();
    await ba.waitForFunction(() => TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
    await ex.reload();
    await ex.waitForSelector('[data-test=camp]');
    await ba.waitForTimeout(4500);
    const s = await bas(ba);
    equal(s.honourRespectByClan.farmer, 1);
    equal(Object.keys(s.bridge.done).length, 1);
    await waitStatus(ex, ['applied']);
  });

  await check('typing in an Honour/Respect box while a change from the Explorer lands keeps both', async () => {
    await ba.evaluate(() => TSI.bastion.debug.reveal('hr-slade'));
    await ba.waitForSelector('[data-test=hr-slade]');
    await ba.click('[data-test=hr-slade]');
    await ba.fill('[data-test=hr-slade]', '2');
    await playT4Won(ex);
    await ba.waitForFunction(() => TSI.bastion.debug.state().honourRespectByClan.slade === 1, null, { timeout: 6000 });
    equal(await ba.inputValue('[data-test=hr-slade]'), '2', 'what the DM typed stays in the box');
    await ba.press('[data-test=hr-slade]', 'Tab');
    await ba.waitForTimeout(200);
    equal((await bas(ba)).honourRespectByClan.slade, 3, 'the Explorer\'s +1 and the DM\'s +2');
    equal(await ba.inputValue('[data-test=hr-slade]'), '3');
    await ba.keyboard.press('Escape');
    await waitStatus(ex, ['applied', 'applied']);
  });

  await A.close();

  /* ------------------------------------------------------------------ */
  section('The Bastion shut for a few days, Reset Travel and a Bastion Reset');
  const B = await context(browser, 'laptop');
  const ex3 = await openExplorer(B);
  let ba3 = await openBastion(B);

  await check('a change made while the Bastion is shut waits, then is applied once when it opens', async () => {
    await ba3.close();
    await playT4Won(ex3);
    await waitStatus(ex3, ['waiting']);
    await camp(ex3);
    await camp(ex3);
    equal((await exs(ex3)).travel.day, 3);
    ba3 = await openBastion(B);
    await ba3.waitForFunction(() => TSI.bastion.debug.state().day === 3 && !TSI.bastion.debug.busy(), null, { timeout: 10000 });
    const s = await bas(ba3);
    equal(s.honourRespectByClan.slade, 1);
    const line = s.log.filter(l => l.title === 'From the Explorer');
    equal(line.length, 1);
    equal(line[0].day, 1, 'applied on the day it happened, before Days 2 and 3 passed');
    await waitStatus(ex3, ['applied']);
  });

  await check('Reset Travel with a change waiting: the Bastion moves back with it and applies the change once', async () => {
    await ba3.close();
    await playT4Won(ex3);
    await camp(ex3);
    await pause(ex3);
    await ex3.click('[data-test=reset-travel]');
    await H.clickModal(ex3, 'OK');
    await ex3.waitForTimeout(200);
    const out = (await exs(ex3)).journey.outbox;
    equal(out.map(m => m.day), [-2, 0], 'both messages move back with the day');
    ba3 = await openBastion(B);
    await ba3.waitForFunction(() => TSI.bastion.debug.state().day === 1 && TSI.bastion.debug.state().honourRespectByClan.slade === 2, null, { timeout: 10000 });
    await ba3.waitForTimeout(4500);
    equal((await bas(ba3)).honourRespectByClan.slade, 2, 'each change once');
    await waitStatus(ex3, ['applied', 'applied']);
  });

  await check('a Bastion Reset skips the changes sent before it, lists them, and the Explorer says Skipped', async () => {
    await pause(ba3);
    await ba3.click('[data-test=reset]');
    await H.modalText(ba3);
    await Promise.all([ba3.waitForNavigation(), H.clickModal(ba3, 'Reset')]);
    await ba3.waitForFunction(() => TSI.bastion.debug && TSI.bastion.debug.state().anchored && !TSI.bastion.debug.state().bridge.fresh, null, { timeout: 10000 });
    const s = await bas(ba3);
    equal(s.honourRespectByClan.slade, 0);
    equal(Object.values(s.bridge.done).map(r => r.r), ['skipped', 'skipped']);
    const rows = await influenceRows(ba3);
    equal(rows.map(r => r.r), ['skipped', 'skipped']);
    assert(/Type it in above if it should count/.test(rows[0].text), rows[0].text);
    await waitStatus(ex3, ['skipped', 'skipped']);
  });

  await B.close();

  /* ------------------------------------------------------------------ */
  for (const size of ['laptop', 'tv']) {
    section('Party bags, charts and packs (' + size + ')');
    const C = await context(browser, size);
    const ex4 = await openExplorer(C);

    await check('+ Add puts an Overland chart in the bags: 3 days of use', async () => {
      await pause(ex4);
      await ex4.click('[data-test=bags-add]');
      await ex4.waitForSelector('[data-test=bags-add-dialog]');
      await ex4.selectOption('[data-test=bags-kind]', 'overland_chart');
      await ex4.fill('[data-test=bags-count]', '1');
      await H.clickModal(ex4, 'Add');
      await ex4.waitForTimeout(150);
      equal(await ex4.textContent('[data-kind=overland_chart] [data-test=bag-qty]'), '3 days of use left');
      equal(await ex4.isVisible('[data-test=use-chart]'), true);
    });

    await check('Use a chart today: the limit is 36, with the chart line; a second one is refused today', async () => {
      await pause(ex4);
      await ex4.click('[data-test=use-chart]');
      const t = await H.modalText(ex4);
      assert(/one more 6-mile hex \(36 miles\)/.test(t), t);
      await H.clickModal(ex4, 'Use a chart');
      await ex4.waitForTimeout(150);
      equal(await ex4.textContent('[data-test=miles-limit]'), '36');
      assert(/Overland chart in use: \+6 miles today/.test(await ex4.textContent('[data-test=chart-line]')));
      equal(await ex4.textContent('[data-kind=overland_chart] [data-test=bag-qty]'), '2 days of use left');
      equal(await ex4.isDisabled('[data-test=use-chart]'), true);
      assert(/already in use today/.test(await ex4.textContent('[data-test=chart-why]')));
    });

    await check('a hero can walk six hexes (36 miles) today; a seventh is too far', async () => {
      await ex4.selectOption('[data-test=map-select]', 'northern_province_west');
      await ex4.click('[data-test=load]');
      await ex4.waitForTimeout(300);
      const vec = await ex4.evaluate(() => {
        const s = TSI.explorer.debug.state(), v = TSI.explorer.debug.view();
        const r = TSI.explorer.rules.hexSize(s.grid) * v.fit;
        return { x: r * Math.sqrt(3), y: 0 };
      });
      async function dragHexes(n) {
        const at = await ex4.evaluate(() => TSI.explorer.debug.tokenScreen('kaelen'));
        await ex4.mouse.move(at.x, at.y);
        await ex4.mouse.down();
        for (let i = 1; i <= 20; i++) await ex4.mouse.move(at.x + vec.x * n * i / 20, at.y);
        await ex4.mouse.up();
        await ex4.waitForTimeout(150);
      }
      await dragHexes(6);
      equal((await exs(ex4)).tokens.find(t => t.id === 'kaelen').milesUsed, 36);
      assert(/has reached 36 miles/.test(await ex4.textContent('[data-test=notice]')), await ex4.textContent('[data-test=notice]'));
      /* A tired hero can't be picked up; a group move that would take
         someone past 36 is Too far. */
      await dragHexes(1);
      equal((await exs(ex4)).tokens.find(t => t.id === 'kaelen').milesUsed, 36);
      equal(await ex4.evaluate(() => TSI.explorer.rules.canDrag(TSI.explorer.debug.state(), 'kaelen')), false);
    });

    await check('Make Camp: back to 30, and the bags keep their charts', async () => {
      await camp(ex4);
      equal(await ex4.textContent('[data-test=miles-limit]'), '30');
      equal(await ex4.isVisible('[data-test=chart-line]'), false);
      equal(await ex4.isDisabled('[data-test=use-chart]'), false);
      equal(await ex4.textContent('[data-kind=overland_chart] [data-test=bag-qty]'), '2 days of use left');
    });

    await check('C8\'s vigil: Use a pack gives advantage once, and a reload keeps it used', async () => {
      await pause(ex4);
      await ex4.click('[data-test=bags-add]');
      await ex4.waitForSelector('[data-test=bags-add-dialog]');
      await ex4.selectOption('[data-test=bags-kind]', 'expedition_provision_pack');
      await ex4.fill('[data-test=bags-count]', '2');
      await H.clickModal(ex4, 'Add');
      await ex4.waitForTimeout(150);
      await setRegion(ex4, 'southern_province');
      await start(ex4, 'c8', 'camp');
      await jClick(ex4, 'check-success');
      await jClick(ex4, 'choice-0');
      await jClick(ex4, 'pick-continue');
      const offer = await ex4.textContent('[data-test=pack-offer]');
      assert(/Expedition Provision Pack \(2 left\): advantage on this save\./.test(offer), offer);
      await jClick(ex4, 'use-pack');
      equal(await ex4.$('[data-test=use-pack]'), null, 'no second use');
      assert(/A pack was used: roll this save with advantage/.test(await ex4.textContent('[data-test=journey-act]')));
      assert(/Used 1 Expedition Provision Pack: advantage on this save \(1 pack left\)/.test(await ex4.textContent('[data-test=journey-changes]')));
      /* As a person would: the save lands a moment after the click. */
      await ex4.waitForTimeout(800);
      await ex4.reload();
      await ex4.waitForSelector('.tsi-modal.tsi-exp-journey [data-test=check-success]');
      equal(await ex4.$('[data-test=use-pack]'), null, 'still used after a reload');
      assert(/A pack was used/.test(await ex4.textContent('[data-test=journey-act]')));
      equal(await ex4.textContent('[data-kind=expedition_provision_pack] [data-test=bag-qty]'), '1 pack');
      await jClick(ex4, 'check-success');
      await jClick(ex4, 'event-done');
    });

    await check('the travel panel fits: no sideways scrolling, Make Camp in view', async () => {
      const l = await H.layoutCheck(ex4, ['[data-test=camp]']);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll ' + l.scrollWidth + ' > ' + l.clientWidth);
      equal(l.outOfView, []);
      await H.shot(ex4, 'bridge-bags-' + size);
    });

    await check('nothing reached for the internet, and no page errors', async () => {
      equal(C.log.net, []);
      equal(C.log.errors, []);
      equal(C.log.failed, []);
    });
    await C.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
