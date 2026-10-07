/* The DM doc's contents (7 October 2026), clicked through from a
   double-clicked index.html with the internet off: the party's level and
   heroes, the day, the Bastion turns and the next one, the Clan's and the
   god's standing for the Region, and the Explorer's Active Effects, read
   from the real Explorer and Bastion. An effect appears when an event gives
   it and goes on the day it ends; the party's gold and the Threads (added
   the same day) follow the Explorer's as events add them and the DM resolves
   or clears them; a change made in another window shows up by itself. It
   fits Harry's laptop and the TV.
   Run with:  node tests/e2e/dmdoc.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');

async function go(page, tool) {
  await page.goto(INDEX + (tool ? '?tool=' + tool : ''));
  await page.waitForSelector('.tsi-topbar');
  await page.waitForTimeout(500);
}
async function waitSaved(page) {
  await page.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
}
async function openDoc(page) {
  if (!(await page.$('[data-test=dmdoc-panel]:not([hidden])'))) await page.click('[data-test=dm-doc]');
  await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden]) [data-test=dmdoc-level]');
}
/* What the DM doc shows, as plain text per part. */
function doc(page) {
  return page.evaluate(() => {
    const t = e => {
      const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      const parts = [];
      while (w.nextNode()) parts.push(w.currentNode.nodeValue);
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    };
    const q = s => { const e = document.querySelector('[data-test=dmdoc-panel] [data-test="' + s + '"]'); return e ? t(e) : null; };
    return {
      level: q('dmdoc-level'), day: q('dmdoc-day'), turns: q('dmdoc-turns'), next: q('dmdoc-next-bastion'),
      heroes: Array.from(document.querySelectorAll('[data-test=dmdoc-panel] .tsi-dmdoc__hero')).map(e => e.textContent),
      region: q('dmdoc-region'), clan: q('dmdoc-clan'), god: q('dmdoc-god'), where: q('dmdoc-where'),
      effects: Array.from(document.querySelectorAll('[data-test=dmdoc-panel] [data-test=dmdoc-effect]')).map(t),
      effectsText: q('dmdoc-effects'),
      gold: q('dmdoc-gold'), threadsCount: q('dmdoc-threads-count'),
      threads: Array.from(document.querySelectorAll('[data-test=dmdoc-panel] [data-test=dmdoc-thread]')).map(t),
      threadsText: q('dmdoc-threads')
    };
  });
}
/* Wait until the DM doc's text passes the test (it re-reads the saves every two seconds). */
async function until(page, test, what) {
  const end = Date.now() + 8000;
  let last = null;
  while (Date.now() < end) {
    last = await doc(page);
    if (test(last)) return last;
    await page.waitForTimeout(250);
  }
  throw new Error('the DM doc never showed ' + what + ': ' + JSON.stringify(last));
}
/* Drag the DM doc by its title bar over the map, clear of the tool's buttons (as the DM would). */
async function moveDoc(page, x, y) {
  const b = await page.$eval('[data-test=dmdoc-bar]', e => { const r = e.getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2 }; });
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + (x - b.x) * i / 10, b.y + (y - b.y) * i / 10);
  await page.mouse.up();
  await page.waitForTimeout(150);
}
async function setBastion(page, fn) {
  await page.evaluate(src => TSI.bastion.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
  await waitSaved(page);
}
async function closePopups(page) {
  for (let n = 0; n < 8 && await page.$('.tsi-modal'); n++) {
    await page.waitForTimeout(400);
    if (await page.$('.tsi-modal [data-test=skip-event]:not([hidden])')) await page.click('.tsi-modal [data-test=skip-event]');
    else await page.click('.tsi-modal__foot button');
    await page.waitForTimeout(200);
  }
}
async function makeCamp(page) {
  await page.waitForTimeout(400);
  await page.click('[data-test=camp]');
  await page.waitForTimeout(300);
  await closePopups(page);
}
/* Done, then wait for the event window to close and the Explorer to save. */
async function done(page) {
  for (let i = 0; i < 3; i++) {
    await jClick(page, 'event-done');
    try { await page.waitForSelector('.tsi-modal.tsi-exp-journey', { state: 'detached', timeout: 1500 }); } catch (e) { continue; }
    await waitSaved(page);
    return;
  }
  throw new Error('the event window didn\'t close');
}
/* Click a button in the suite's "are you sure?" pop-up by its label. */
async function clickModal(page, label) {
  await page.waitForTimeout(400);
  await page.click('.tsi-modal .tsi-modal__foot button:text-is("' + label + '")');
  await page.waitForSelector('.tsi-modal', { state: 'detached', timeout: 3000 });
  await waitSaved(page);
}
async function jClick(page, test) {
  await page.waitForTimeout(400);
  await page.click('.tsi-modal.tsi-exp-journey [data-test="' + test + '"]');
  await page.waitForTimeout(100);
}

(async () => {
  const browser = await H.chromium.launch();

  section('The DM doc shows where the campaign stands (laptop, internet off)');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    const page = await context.newPage();

    await check('before the Explorer or the Bastion has saved anything, it says so', async () => {
      await go(page, '');
      await openDoc(page);
      const d = await doc(page);
      equal(d.level, 'Party level 7 Bastion not saved yet');
      equal(d.day, 'Day — Explorer not started');
      equal(d.turns, 'Bastion turns — Bastion not saved yet');
      equal(d.next, 'Next Bastion turn —');
      equal(d.where, 'Where the party is Open the Explorer to see where the party is.');
      equal(d.effectsText, 'Active effects None.');
      equal(d.gold, 'Party gold — Explorer not started');
      equal(d.threadsCount, 'Threads — Explorer not started');
      equal(d.threadsText, 'Threads None.');
      await H.shot(page, 'dmdoc-contents-empty');
    });

    await check('the Bastion: the party level and the turns completed', async () => {
      await go(page, 'bastion');
      await setBastion(page, s => {
        s.partyLevel = 9; s.turn = 4;
        s.politicalCapital.farmer = 12; s.honourRespectByClan.farmer = 2; s.favour.aurush = 35;
        s.politicalCapital.blackstone = -20; s.honourRespectByClan.blackstone = -1; s.favour.telluria = 60;
      });
      const d = await until(page, x => x.level === 'Party level 9 from the Bastion', 'level 9');
      equal(d.turns, 'Bastion turns 3 completed');
    });

    await check('the Explorer: the heroes, the day, the next Bastion turn, and the Region\'s Clan and god', async () => {
      await go(page, 'explorer');
      await page.evaluate(() => { TSI_DATA.journeyEvents.settings.travelChance = 0; TSI_DATA.journeyEvents.settings.campChance = 0; TSI_DATA.explorer.weatherRules.chance = 0; });
      await page.selectOption('[data-test=region]', 'western_province');
      await waitSaved(page);
      const d = await until(page, x => x.region === 'Western Province', 'the Western Province');
      equal(d.heroes, ['Kaelen', 'Umbrys', 'Magnus', 'Elara', 'Charles']);
      equal(d.day, 'Day 1 0 days passed');
      equal(d.next, 'Next Bastion turn in 7 days Day 8, at Make Camp');
      equal(d.clan, 'Clan Farmer\'s territory · Logan Farmer Political Capital +12 Honour/Respect +2');
      equal(d.god, 'Aurush\'s lands Favour 35%');
      equal([d.gold, d.threadsCount, d.threadsText], ['Party gold 0 from events, until cleared', 'Threads 0 none open', 'Threads None.']);
      await H.shot(page, 'dmdoc-contents-explorer');
    });

    await check('changing the Region changes the Clan and the god', async () => {
      await page.selectOption('[data-test=region]', 'northern_province');
      const d = await until(page, x => x.region === 'Northern Province', 'the Northern Province');
      equal(d.clan, 'Clan Blackstone\'s territory · Boris Blackstone Political Capital -20 Honour/Respect -1');
      equal(d.god, 'Telluria\'s lands Favour 60%');
      const fill = await page.$eval('[data-test=dmdoc-pc] .tsi-dmdoc__fill', f => ({ left: f.style.left, width: f.style.width, low: f.classList.contains('tsi-dmdoc__fill--low') }));
      equal(fill, { left: '40%', width: '10%', low: true }, 'a negative Political Capital fills left of the centre, in crimson');
    });

    await check('an effect from an event appears, and goes on the day it ends', async () => {
      await moveDoc(page, 520, 150);
      assert(await page.evaluate(() => TSI.explorer.debug.startEvent('c6', 'camp')), 'started C6');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await jClick(page, 'check-success');
      await jClick(page, 'choice-0');
      await jClick(page, 'check-success');
      await jClick(page, 'event-done');
      let d = await until(page, x => x.effects.length === 1, 'the effect');
      equal(d.effects, ['Wolf-Friend · The party advantage on Perception checks to spot danger on this map ends Day 8 · from C6']);
      const panel = await page.$eval('[data-test=effects-list]', e => e.textContent);
      assert(/Wolf-Friend/.test(panel) && /ends Day 8/.test(panel), 'the Explorer\'s own list says the same: ' + panel);
      for (let day = 2; day <= 7; day++) {
        await makeCamp(page);
        d = await until(page, x => x.day === 'Day ' + day + ' ' + (day - 1) + (day === 2 ? ' day passed' : ' days passed'), 'Day ' + day);
        equal(d.effects.length, 1, 'still there on Day ' + day);
      }
      equal(d.next, 'Next Bastion turn in 1 day Day 8, at Make Camp');
      await makeCamp(page);
      d = await until(page, x => x.day === 'Day 8 7 days passed', 'Day 8');
      equal(d.effectsText, 'Active effects None.', 'gone on Day 8, as the Explorer removes it');
      equal(d.next, 'Next Bastion turn in 7 days Day 15, at Make Camp');
      equal(await page.$eval('[data-test=effects-list]', e => e.textContent), 'None.');
    });

    await check('the party\'s gold and the Threads: they appear, change and go with the Explorer\'s', async () => {
      const panelThreads = () => page.$$eval('[data-test=threads-list] [data-test=thread]', ls => ls.map(l => l.querySelector('strong').textContent));
      let d = await until(page, x => x.threads.length === 1, 'C6\'s thread');
      equal(d.threads, ['What Drove the Wolves Out Something bigger drove the wolves from their hunting grounds near Wolfhaven. Day 1 · from C6']);
      equal([d.gold, d.threadsCount], ['Party gold 0 from events, until cleared', 'Threads 1 open']);

      /* T6: deliver the letter sealed, a thread that pays when resolved. */
      assert(await page.evaluate(() => TSI.explorer.debug.startEvent('t6', 'travel')), 'started T6');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await jClick(page, 'check-success');
      await jClick(page, 'next');
      await jClick(page, 'choice-0');
      await done(page);
      d = await until(page, x => x.threads.length === 2, 'T6\'s thread');
      equal(d.threads[1], 'The Sealed Dispatch Deliver the sealed letter to Chief Boris Blackstone of Clan Blackstone. Day 8 · from T6 When resolved: +250 gold · DM note: Notice Board: consider +1 clan honour with Clan Blackstone.');

      /* T14 in the Southern Province: buy the share, −100 gold and a follow-up in 7 days. */
      await page.selectOption('[data-test=region]', 'southern_province');
      await waitSaved(page);
      assert(await page.evaluate(() => TSI.explorer.debug.startEvent('t14', 'travel')), 'started T14');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await jClick(page, 'check-failure');
      await jClick(page, 'choice-0');
      await done(page);
      d = await until(page, x => x.threads.length === 3, 'T14\'s thread');
      equal(d.threads[2], 'The Prospector\'s Claim A quarter-share in a gold vein. Word should come in 7 days. Day 8 · from T14 · Follow-up due Day 15');
      equal(d.gold, 'Party gold -100 from events, until cleared', 'the same as the Explorer\'s Gold: ' + await page.textContent('[data-test=gold]'));
      equal(d.threadsCount, 'Threads 3 open · next follow-up due Day 15');
      equal(await panelThreads(), ['What Drove the Wolves Out', 'The Sealed Dispatch', 'The Prospector\'s Claim'], 'the Explorer\'s own list, in the same order');
      await H.shot(page, 'dmdoc-contents-threads');

      /* Resolve the Sealed Dispatch in the Explorer: +250 gold, and it goes from both lists. */
      const rows = await page.$$('[data-test=threads-list] [data-test=thread]');
      await (await rows[1].$('[data-test=thread-resolve]')).click();
      await clickModal(page, 'Resolve');
      d = await until(page, x => x.threads.length === 2, 'the resolved thread gone');
      equal(d.threads.map(x => x.split(' Day ')[0].split(' ').slice(0, 3).join(' ')), ['What Drove the', 'The Prospector\'s Claim']);
      equal(d.gold, 'Party gold 150 from events, until cleared');
      equal(await page.textContent('[data-test=gold]'), '150');

      /* Clear the gold in the Explorer, as the DM does once it's on the players' sheets. */
      await page.click('[data-test=gold-clear]');
      await clickModal(page, 'Clear');
      d = await until(page, x => /^Party gold 0 /.test(x.gold || ''), 'the gold cleared');
      equal(d.threadsCount, 'Threads 2 open · next follow-up due Day 15');

      await page.selectOption('[data-test=region]', 'northern_province');
      await waitSaved(page);
    });

    await check('a change made in another window shows up by itself', async () => {
      const other = await context.newPage();
      await go(other, 'bastion');
      await setBastion(other, s => { s.politicalCapital.blackstone = 45; s.honourRespectByClan.blackstone = 3; s.turn = 5; s.partyLevel = 10; });
      await other.close();
      const d = await until(page, x => /Political Capital \+45 Honour\/Respect \+3/.test(x.clan || ''), 'the new standing');
      equal([d.level, d.turns], ['Party level 10 from the Bastion', 'Bastion turns 4 completed']);
    });

    await check('it fits the laptop: nothing runs off sideways', async () => {
      const r = await page.$eval('[data-test=dmdoc-body]', b => ({ sw: b.scrollWidth, cw: b.clientWidth }));
      assert(r.sw <= r.cw, 'no sideways scrolling inside: ' + JSON.stringify(r));
      await H.shot(page, 'dmdoc-contents-laptop');
    });

    await check('closed, it stops reading; opened again, it\'s up to date', async () => {
      await page.click('[data-test=dmdoc-close]');
      const reads = await page.evaluate(async () => {
        let n = 0;
        const real = TSI.store.fresh;
        TSI.store.fresh = function () { n++; return real.apply(this, arguments); };
        await new Promise(r => setTimeout(r, 4500));
        TSI.store.fresh = real;
        return n;
      });
      equal(reads, 0, 'no reading while it\'s closed');
      await openDoc(page);
      await until(page, x => x.level === 'Party level 10 from the Bastion', 'level 10');
    });

    await check('nothing failed, and nothing reached for the internet', async () => {
      equal(context.log.errors, []);
      equal(context.log.net, []);
    });
    await context.close();
  }

  section('On the TV');
  await check('tv: the DM doc fits and reads clearly', async () => {
    const context = await H.newContext(browser, 'tv');
    await context.setOffline(true);
    const page = await context.newPage();
    await go(page, 'explorer');
    await page.selectOption('[data-test=region]', 'the_east_isle');
    await waitSaved(page);
    await openDoc(page);
    const d = await until(page, x => x.region === 'The East Isle', 'the East Isle');
    equal(d.clan, 'Clan Rowthorn\'s territory · Doran Rowthorn Political Capital — Honour/Respect —');
    assert(/Open the Bastion to see the Clan's and the god's standing\./.test(d.where), d.where);
    const r = await page.$eval('[data-test=dmdoc-body]', b => ({ sw: b.scrollWidth, cw: b.clientWidth }));
    assert(r.sw <= r.cw, JSON.stringify(r));
    await page.waitForTimeout(600);
    await H.shot(page, 'dmdoc-contents-tv');
    equal(context.log.errors, []);
    await context.close();
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
