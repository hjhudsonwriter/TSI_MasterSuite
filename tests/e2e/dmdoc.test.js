/* The DM doc's contents, clicked through from a double-clicked index.html
   with the internet off. Four panels in a 2 × 2 grid (the DM doc overhaul):

   - Party: the level, the event gold, the effects that touch the whole
     party (and a Great Rite it holds), and each hero with that hero's own
     effects beside their name;
   - Bastion: the orders pending (a list, the next first) and the next word
     from the Ironbow;
   - Explorer: the day, the expedition line, where the party is (the
     Clan's and the god's standing, the Hall's agreements) and the Threads;
   - Quest: a box for the DM's own text, saved as it is typed, with Import
     (PDF, Word, text), Save as text file and Clear.

   Everything is read from the real Explorer and Bastion; an effect appears
   when an event gives it and goes on the day it ends; a change made in
   another window shows up by itself; it fits Harry's laptop and the TV.
   Run with:  node tests/e2e/dmdoc.test.js */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('./helpers');
const F = require('./dmdoc-fixtures');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-dmdoc-'));
const QUEST = 'tsi.dmdoc.quest';

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
    const root = document.querySelector('[data-test=dmdoc-panel]');
    const q = s => { const e = root.querySelector('[data-test="' + s + '"]'); return e ? t(e) : null; };
    const all = s => Array.from(root.querySelectorAll('[data-test="' + s + '"]'));
    return {
      level: q('dmdoc-level'), gold: q('dmdoc-gold'),
      partyText: q('dmdoc-party-effects'), partyEffects: all('dmdoc-party-effect').map(t), rite: q('dmdoc-rite'),
      heroesText: q('dmdoc-heroes'),
      heroes: all('dmdoc-hero').map(h => ({ name: h.querySelector('.tsi-dmdoc__hero-name').textContent, effects: Array.from(h.querySelectorAll('[data-test=dmdoc-hero-effect]')).map(t) })),
      ordersCount: q('dmdoc-orders-count'), orders: all('dmdoc-order').map(t), next: q('dmdoc-next-word'),
      day: q('dmdoc-day'), expedition: q('dmdoc-expedition'),
      region: q('dmdoc-region'), clan: q('dmdoc-clan'), god: q('dmdoc-god'), where: q('dmdoc-where'),
      threadsCount: q('dmdoc-threads-count'), threads: all('dmdoc-thread').map(t), threadsText: q('dmdoc-threads')
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
/* Drag the DM doc by its title bar so its top-left corner is at (x, y), clear of the tool's buttons (as the DM would). */
async function moveDoc(page, x, y) {
  await page.waitForTimeout(300);
  const b = await page.$eval('[data-test=dmdoc-bar]', e => { const r = e.getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2, left: r.left, top: r.top }; });
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + (x - b.left) * i / 10, b.y + (y - b.top) * i / 10);
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
    else if (await page.$('.tsi-modal__foot button:text-is("Close")')) await page.click('.tsi-modal__foot button:text-is("Close")');
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

/* ---------- The Quest box ---------- */
const boxText = page => page.inputValue('[data-test=dmdoc-quest-text]');
const stored = page => page.evaluate(k => TSI.store.fresh(k, null), QUEST);
const status = page => page.textContent('[data-test=dmdoc-quest-status]');
const note = page => page.textContent('[data-test=dmdoc-quest-msg]');
/* Wait for the status to say Saved, and what is saved to be the text. */
async function savedAs(page, text) {
  await page.waitForFunction(t => {
    const s = document.querySelector('[data-test=dmdoc-quest-status]');
    return s && s.textContent === 'Saved' && TSI.store.get('tsi.dmdoc.quest', null) && TSI.store.get('tsi.dmdoc.quest', null).text === t && !TSI.store.hasUnsaved();
  }, text, { timeout: 5000 });
}
async function typeInBox(page, text) {
  await page.click('[data-test=dmdoc-quest-text]');
  await page.keyboard.type(text);
}
/* Import a file through the real file chooser. */
async function importFile(page, file) {
  await page.waitForTimeout(450);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-test=dmdoc-quest-import]')]);
  await chooser.setFiles(file);
}
async function waitNote(page, pattern) {
  await page.waitForFunction(src => new RegExp(src).test((document.querySelector('[data-test=dmdoc-quest-msg]') || {}).textContent || ''), pattern.source, { timeout: 8000 });
}
const SESSION_LINES = ['Session 12: The Ironbow gates', 'The party reaches the gates at dusk. Kaelen’s plan needs a distraction.', 'Clan\tChief', 'Blackstone\tBoris Blackstone'];
const sessionDocx = () => F.write(TMP, 'Session 12.docx', F.docx([{ heading: SESSION_LINES[0] }, SESSION_LINES[1], { bullet: 'First bullet' }, { table: [['Clan', 'Chief'], ['Blackstone', 'Boris Blackstone']] }, 'After the table.']));
const DOCX_TEXT = 'Session 12: The Ironbow gates\nThe party reaches the gates at dusk. Kaelen’s plan needs a distraction.\n• First bullet\nClan\tChief\nBlackstone\tBoris Blackstone\n\nAfter the table.';
const PDF_TEXT = 'Chapter One\nThe harbour is quiet.\nA bell rings twice.\n\nChapter Two\nThe road north (to Wolfhaven) is open.';
const sessionPdf = () => F.write(TMP, 'Session 13.pdf', F.pdf([['Chapter One', 'The harbour is quiet.', 'A bell rings twice.'], ['Chapter Two', 'The road north (to Wolfhaven) is open.']]));

(async () => {
  const browser = await H.chromium.launch();

  section('The DM doc shows where the campaign stands (laptop, internet off)');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    const page = await context.newPage();

    await check('four panels in a 2 × 2 grid: Party and Bastion above, Explorer and Quest below, all inside the DM doc', async () => {
      await go(page, '');
      await openDoc(page);
      const g = await page.evaluate(() => {
        const r = s => { const b = document.querySelector('[data-test=' + s + ']').getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
        return { doc: r('dmdoc-panel'), party: r('dmdoc-party'), bastion: r('dmdoc-bastion'), explorer: r('dmdoc-explorer'), quest: r('dmdoc-quest'), titles: Array.from(document.querySelectorAll('.tsi-dmdoc__panel-h')).map(h => h.textContent) };
      });
      equal(g.titles, ['Party', 'Bastion', 'Explorer', 'Quest']);
      equal([g.party.y === g.bastion.y, g.explorer.y === g.quest.y, g.party.x === g.explorer.x, g.bastion.x === g.quest.x], [true, true, true, true], 'rows and columns line up');
      assert(g.party.x < g.bastion.x && g.party.y < g.explorer.y, 'Party is top left');
      assert(Math.abs(g.party.w - g.bastion.w) <= 1 && Math.abs(g.explorer.w - g.quest.w) <= 1, 'two equal columns');
      ['party', 'bastion', 'explorer', 'quest'].forEach(p => {
        const b = g[p];
        assert(b.x >= g.doc.x && b.y >= g.doc.y && b.x + b.w <= g.doc.x + g.doc.w && b.y + b.h <= g.doc.y + g.doc.h, p + ' is inside the DM doc: ' + JSON.stringify([b, g.doc]));
      });
    });

    await check('before the Explorer or the Bastion has saved anything, each panel says so', async () => {
      const d = await doc(page);
      equal(d.level, 'Party level 7 Bastion not saved yet');
      equal(d.gold, 'Party gold — Explorer not started');
      equal(d.partyText, 'Party effects Open the Explorer to see the effects.');
      equal(d.heroesText, 'Heroes Open the Explorer to see the heroes.');
      equal(d.ordersCount, 'Orders pending — Bastion not saved yet');
      equal(d.next, 'Next word from the Ironbow — Bastion not saved yet');
      equal(d.day, 'Day — Explorer not started');
      equal(d.expedition, 'Expedition Explorer not started');
      equal(d.where, 'Where the party is Open the Explorer to see where the party is.');
      equal(d.threadsText, 'Threads Explorer not started');
      equal(await status(page), 'Saved');
      equal(await page.textContent('[data-test=dmdoc-quest-count]'), '0 of 200,000 characters');
      await H.shot(page, 'dmdoc-contents-empty');
    });

    await check('the Bastion: the party level, the orders pending (a list) and the next word from the Ironbow', async () => {
      await go(page, 'bastion');
      await setBastion(page, s => {
        s.partyLevel = 9; s.anchored = true; s.day = 1;
        s.pendingOrders = [{ id: 'o1', facId: 'dock', fnId: 'charter_berth', label: 'Dock: Charter Berth (Longship)', costGP: 200, issuedDay: 1, dueDay: 8 }];
        s.politicalCapital.farmer = 12; s.honourRespectByClan.farmer = 2; s.favour.aurush = 35;
        s.politicalCapital.blackstone = -20; s.honourRespectByClan.blackstone = -1; s.favour.telluria = 60;
      });
      const d = await until(page, x => x.level === 'Party level 9 from the Bastion', 'level 9');
      equal(d.ordersCount, 'Orders pending 1 next completes Day 8');
      equal(d.orders, ['Dock: Charter Berth (Longship) Completes Day 8 · in 7 days']);
      equal(d.next, 'Next word from the Ironbow Day 8 in 7 days Dock: Charter Berth (Longship) is complete.');
    });

    await check('more than five orders: the five that complete first are listed, next first, and the rest are counted', async () => {
      await setBastion(page, s => {
        s.pendingOrders = [30, 12, 9, 21, 15, 18, 8].map((d, i) => ({ id: 'q' + i, facId: 'dock', fnId: 'charter_berth', label: 'Order due ' + d, costGP: 0, issuedDay: 1, dueDay: d }));
      });
      const d = await until(page, x => x.orders.length === 5, 'five orders');
      equal(d.ordersCount, 'Orders pending 7 next completes Day 8');
      equal(d.orders.map(o => o.split(' Completes')[0]), ['Order due 8', 'Order due 9', 'Order due 12', 'Order due 15', 'Order due 18']);
      assert(/and 2 more/.test(await page.textContent('[data-test=dmdoc-bastion]')), 'and 2 more');
      await setBastion(page, s => {
        s.pendingOrders = [{ id: 'o1', facId: 'dock', fnId: 'charter_berth', label: 'Dock: Charter Berth (Longship)', costGP: 200, issuedDay: 1, dueDay: 8 }];
      });
      await until(page, x => x.orders.length === 1, 'one order again');
    });

    await check('the Explorer: the heroes (no effects yet), the day, no expedition, the Region\'s Clan and god', async () => {
      await go(page, 'explorer');
      await page.evaluate(() => { TSI_DATA.journeyEvents.settings.travelChance = 0; TSI_DATA.journeyEvents.settings.campChance = 0; TSI_DATA.explorer.weatherRules.chance = 0; });
      await page.selectOption('[data-test=region]', 'western_province');
      await waitSaved(page);
      const d = await until(page, x => x.region === 'Western Province', 'the Western Province');
      equal(d.heroes, [{ name: 'Kaelen', effects: [] }, { name: 'Umbrys', effects: [] }, { name: 'Magnus', effects: [] }, { name: 'Elara', effects: [] }, { name: 'Charles', effects: [] }]);
      equal(d.partyText, 'Party effects None.');
      equal(d.day, 'Day 1 0 days passed');
      equal(d.expedition, 'Expedition No expedition yet');
      equal(d.next, 'Next word from the Ironbow Day 8 in 7 days Dock: Charter Berth (Longship) is complete.');
      equal(d.clan, 'Clan Farmer\'s territory · Logan Farmer Political Capital +12 Honour/Respect +2');
      equal(d.god, 'Aurush\'s lands Favour 35%');
      equal([d.gold, d.threadsCount, d.threadsText], ['Party gold 0 from events, until cleared', 'none open', 'Threads none open']);
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

    await check('the Hall\'s DM-tracked agreements for the Region\'s Clan are listed with their end day; scores are not', async () => {
      await go(page, 'bastion');
      await setBastion(page, s => {
        s.diplomaticRecords = { next: 2, list: [{ id: 'd1', title: 'Pact of the Pass', status: 'confirmed', consequences: [
          { id: 'c1', kind: 'restriction', clan: 'blackstone', text: 'No Blackstone iron to the Ironbow', until: 9 },
          { id: 'c2', kind: 'hr', clan: 'blackstone', amount: 1, status: 'applied' },
          { id: 'c3', kind: 'privilege', clan: 'farmer', text: 'Free passage' }
        ] }] };
      });
      await go(page, 'explorer');
      await page.selectOption('[data-test=region]', 'northern_province');
      await waitSaved(page);
      const items = await until(page, () => true, 'x').then(() => page.evaluate(() => [...document.querySelectorAll('[data-test=dmdoc-tracked-item]')].map(n => n.textContent)));
      equal(items.length, 1, items.join('|'));
      assert(/Restriction or embargo/.test(items[0]) && /No Blackstone iron/.test(items[0]) && /until Day 9 \(8 days left\)/.test(items[0]), items[0]);
      assert(/you run these at the table/.test(await page.textContent('[data-test=dmdoc-tracked]')));
      await page.selectOption('[data-test=region]', 'western_province');
      await waitSaved(page);
      await page.waitForFunction(() => /Free passage/.test((document.querySelector('[data-test=dmdoc-tracked]') || {}).textContent || ''));
      await H.shot(page, 'dmdoc-tracked');
      /* Put things back for the checks after this one. */
      await go(page, 'bastion');
      await setBastion(page, s => { s.diplomaticRecords = { next: 1, list: [] }; });
      await go(page, 'explorer');
      await page.selectOption('[data-test=region]', 'northern_province');
      await waitSaved(page);
    });

    await check('an expedition: it began today, then how many days it has been running', async () => {
      await moveDoc(page, 275, 70);
      await page.click('[data-test=expedition-start]');
      await waitSaved(page);
      const d = await until(page, x => /Expedition:/.test(x.expedition || ''), 'the expedition');
      equal(d.expedition, 'Expedition Expedition: began today (Day 1)');
    });

    await check('an effect for the whole party appears under Party effects; a hero\'s own effect appears beside that hero', async () => {
      assert(await page.evaluate(() => TSI.explorer.debug.startEvent('c6', 'camp')), 'started C6');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await jClick(page, 'check-success');
      await jClick(page, 'choice-0');
      await jClick(page, 'check-success');
      await done(page);
      /* T1, The Wardens' Toll: the hero chosen on the check (Elara) gets Toll-Wise. */
      assert(await page.evaluate(() => TSI.explorer.debug.startEvent('t1', 'travel')), 'started T1');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await page.selectOption('.tsi-modal.tsi-exp-journey [data-test=hero-select]', 'elara');
      await jClick(page, 'check-success');
      await jClick(page, 'choice-0');
      await jClick(page, 'check-success');
      await done(page);
      const d = await until(page, x => x.partyEffects.length === 1 && x.heroes[3].effects.length === 1, 'both effects');
      equal(d.partyEffects, ['Wolf-Friend · The party advantage on Perception checks to spot danger on this map ends Day 8 · from C6']);
      equal(d.heroes.map(h => [h.name, h.effects]), [
        ['Kaelen', []], ['Umbrys', []], ['Magnus', []],
        ['Elara', ['Toll-Wise · ends Day 8 advantage on Insight against road-thieves']],
        ['Charles', []]
      ]);
      const panel = await page.$eval('[data-test=effects-list]', e => e.textContent);
      assert(/Wolf-Friend/.test(panel) && /Toll-Wise/.test(panel) && /ends Day 8/.test(panel), 'the Explorer\'s own list says the same: ' + panel);
      await H.shot(page, 'dmdoc-contents-effects');
    });

    await check('a Great Rite the party holds is one line under Party effects, and goes when the expedition ends', async () => {
      await page.evaluate(() => { TSI.explorer.debug.state().journey.blessing = { id: 'rite-ab12cd34', rite: 'earths_endurance', expedition: 1, used: false }; });
      await makeCamp(page);                                   /* Day 2: the Explorer saves */
      const d = await until(page, x => x.rite !== null, 'the Great Rite');
      equal(d.rite, 'Great Rite: Earth\'s Endurance , ready', 'one line: the rite, and ready (the comma is its own piece of text)');
      equal(d.partyEffects.length, 1, 'it is not one of the effects');
      equal(d.expedition, 'Expedition Expedition: began Day 1 · running 1 day');
    });

    await check('the days run: the effects stay until Day 8, the expedition counts its days, then everything ends as the Explorer ends it', async () => {
      for (let day = 3; day <= 7; day++) {
        await makeCamp(page);
        const d = await until(page, x => x.day === 'Day ' + day + ' ' + (day - 1) + ' days passed', 'Day ' + day);
        equal([d.partyEffects.length, d.heroes[3].effects.length], [1, 1], 'still there on Day ' + day);
        equal(d.expedition, 'Expedition Expedition: began Day 1 · running ' + (day - 1) + ' days');
      }
      let d = await doc(page);
      equal(d.next, 'Next word from the Ironbow Day 8 tomorrow Dock: Charter Berth (Longship) is complete.');
      await makeCamp(page);
      d = await until(page, x => x.day === 'Day 8 7 days passed', 'Day 8');
      equal(d.partyText, 'Party effects Great Rite: Earth\'s Endurance , ready', 'the effects are gone on Day 8, as the Explorer removes them; the Great Rite is not one of them');
      equal(d.heroes.map(h => h.effects.length), [0, 0, 0, 0, 0], 'and the hero\'s too');
      equal(d.next, 'Next word from the Ironbow Day 29 in 21 days A Bastion event is due.', 'after today: the automatic event');
      equal(await page.$eval('[data-test=effects-list]', e => e.textContent), 'None.');
    });

    await check('ending the expedition: "Expedition ended - Day 1 to Day 8", the Great Rite goes, and the line stays', async () => {
      await page.click('[data-test=expedition-end]');
      await clickModal(page, 'End expedition');
      const d = await until(page, x => /ended/.test(x.expedition || ''), 'the ended line');
      equal(d.expedition, 'Expedition Expedition ended - Day 1 to Day 8');
      equal(d.partyText, 'Party effects None.', 'the Great Rite ended with it');
      await makeCamp(page);
      const later = await until(page, x => x.day === 'Day 9 8 days passed', 'Day 9');
      equal(later.expedition, 'Expedition Expedition ended - Day 1 to Day 8', 'it stays until the next one starts');
      await page.click('[data-test=expedition-start]');
      await waitSaved(page);
      const next = await until(page, x => /Expedition:/.test(x.expedition || ''), 'the next expedition');
      equal(next.expedition, 'Expedition Expedition: began today (Day 9)', 'the next one replaces the ended line');
      await H.shot(page, 'dmdoc-contents-expedition');
    });

    await check('the party\'s gold and the Threads: they appear, change and go with the Explorer\'s', async () => {
      const panelThreads = () => page.$$eval('[data-test=threads-list] [data-test=thread]', ls => ls.map(l => l.querySelector('strong').textContent));
      let d = await until(page, x => x.threads.length === 1, 'C6\'s thread');
      equal(d.threads, ['What Drove the Wolves Out Something bigger drove the wolves from their hunting grounds near Wolfhaven. Day 1 · from C6']);
      /* Wherever the events have left the gold (T1's toll came to something), the DM doc says what the Explorer says. */
      const base = Number(await page.textContent('[data-test=gold]'));
      equal([d.gold, d.threadsCount], ['Party gold ' + base + ' from events, until cleared', '1 open']);

      /* T6: deliver the letter sealed, a thread that pays when resolved. */
      assert(await page.evaluate(() => TSI.explorer.debug.startEvent('t6', 'travel')), 'started T6');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await jClick(page, 'check-success');
      await jClick(page, 'next');
      await jClick(page, 'choice-0');
      await done(page);
      d = await until(page, x => x.threads.length === 2, 'T6\'s thread');
      equal(d.threads[1], 'The Sealed Dispatch Deliver the sealed letter to Chief Boris Blackstone of Clan Blackstone. Day 9 · from T6 When resolved: +250 gold · DM note: Notice Board: consider +1 clan honour with Clan Blackstone.');

      /* T14 in the Southern Province: buy the share, −100 gold and a follow-up in 7 days. */
      await page.selectOption('[data-test=region]', 'southern_province');
      await waitSaved(page);
      assert(await page.evaluate(() => TSI.explorer.debug.startEvent('t14', 'travel')), 'started T14');
      await page.waitForSelector('.tsi-modal.tsi-exp-journey');
      await jClick(page, 'check-failure');
      await jClick(page, 'choice-0');
      await done(page);
      d = await until(page, x => x.threads.length === 3, 'T14\'s thread');
      equal(d.threads[2], 'The Prospector\'s Claim A quarter-share in a gold vein. Word should come in 7 days. Day 9 · from T14 · Follow-up due Day 16');
      equal(d.gold, 'Party gold ' + (base - 100) + ' from events, until cleared', 'the same as the Explorer\'s Gold: ' + await page.textContent('[data-test=gold]'));
      equal(d.threadsCount, '3 open · next follow-up due Day 16');
      equal(await panelThreads(), ['What Drove the Wolves Out', 'The Sealed Dispatch', 'The Prospector\'s Claim'], 'the Explorer\'s own list, in the same order');
      await H.shot(page, 'dmdoc-contents-threads');

      /* Resolve the Sealed Dispatch in the Explorer: +250 gold, and it goes from both lists. */
      const rows = await page.$$('[data-test=threads-list] [data-test=thread]');
      await (await rows[1].$('[data-test=thread-resolve]')).click();
      await clickModal(page, 'Resolve');
      d = await until(page, x => x.threads.length === 2, 'the resolved thread gone');
      equal(d.threads.map(x => x.split(' Day ')[0].split(' ').slice(0, 3).join(' ')), ['What Drove the', 'The Prospector\'s Claim']);
      equal(d.gold, 'Party gold ' + (base + 150) + ' from events, until cleared');
      equal(await page.textContent('[data-test=gold]'), String(base + 150));

      /* Clear the gold in the Explorer, as the DM does once it's on the players' sheets. */
      await page.click('[data-test=gold-clear]');
      await clickModal(page, 'Clear');
      d = await until(page, x => /^Party gold 0 /.test(x.gold || ''), 'the gold cleared');
      equal(d.threadsCount, '2 open · next follow-up due Day 16');

      await page.selectOption('[data-test=region]', 'northern_province');
      await waitSaved(page);
    });

    await check('a change made in another window shows up by itself', async () => {
      const other = await context.newPage();
      await go(other, 'bastion');
      await setBastion(other, s => { s.politicalCapital.blackstone = 45; s.honourRespectByClan.blackstone = 3; s.partyLevel = 10; });
      await other.close();
      const d = await until(page, x => /Political Capital \+45 Honour\/Respect \+3/.test(x.clan || ''), 'the new standing');
      equal(d.level, 'Party level 10 from the Bastion');
    });

    await check('only the panel that changed is redrawn: the others keep what they show and where they are scrolled', async () => {
      await page.evaluate(() => {
        window.__same = { party: document.querySelector('[data-test=dmdoc-party] .tsi-dmdoc__panel-body').firstChild, bastion: document.querySelector('[data-test=dmdoc-bastion] .tsi-dmdoc__panel-body').firstChild };
      });
      const other = await context.newPage();
      await go(other, 'bastion');
      await setBastion(other, s => { s.politicalCapital.blackstone = 46; });
      await other.close();
      await until(page, x => /Political Capital \+46/.test(x.clan || ''), 'the Explorer panel redrawn');
      const kept = await page.evaluate(() => ({
        party: window.__same.party === document.querySelector('[data-test=dmdoc-party] .tsi-dmdoc__panel-body').firstChild && window.__same.party.isConnected,
        bastion: window.__same.bastion === document.querySelector('[data-test=dmdoc-bastion] .tsi-dmdoc__panel-body').firstChild && window.__same.bastion.isConnected
      }));
      equal(kept, { party: true, bastion: true }, 'Party and Bastion were not redrawn');
    });

    await check('it fits the laptop: nothing runs off sideways, in the DM doc or in any panel', async () => {
      const r = await page.evaluate(() => {
        const s = n => { const e = document.querySelector(n); return { sw: e.scrollWidth, cw: e.clientWidth }; };
        return { body: s('[data-test=dmdoc-body]'), panels: ['party', 'bastion', 'explorer', 'quest'].map(p => s('[data-test=dmdoc-' + p + '] .tsi-dmdoc__panel-body')), page: [document.documentElement.scrollWidth, document.documentElement.clientWidth] };
      });
      assert(r.body.sw <= r.body.cw, 'no sideways scrolling inside: ' + JSON.stringify(r));
      r.panels.forEach(p => assert(p.sw <= p.cw, 'a panel scrolls sideways: ' + JSON.stringify(r)));
      assert(r.page[0] <= r.page[1], 'the page scrolls sideways');
      await H.shot(page, 'dmdoc-contents-laptop');
    });

    await check('closed, it stops reading; opened again, it\'s up to date; the Quest box is never read on the two-second timer', async () => {
      /* Only the DM doc's own reads count: the Explorer under it reads the
         Bastion's save every 2 seconds for its From the Ironbow list and
         Sent to the Bastion (pull request 6). */
      const docReads = ms => page.evaluate(async wait => {
        const n = { all: 0, quest: 0 };
        const real = TSI.store.fresh;
        TSI.store.fresh = function (key) { if (/dmdoc\.js/.test(new Error().stack || '')) { n.all++; if (key === 'tsi.dmdoc.quest') n.quest++; } return real.apply(this, arguments); };
        await new Promise(r => setTimeout(r, wait));
        TSI.store.fresh = real;
        return n;
      }, ms);
      const open = await docReads(4500);
      assert(open.all > 0, 'open, it reads (so the count below means something)');
      equal(open.quest, 0, 'but never the Quest text, on the timer');
      await page.click('[data-test=dmdoc-close]');
      const reads = await docReads(4500);
      equal(reads, { all: 0, quest: 0 }, 'no reading while it\'s closed');
      await openDoc(page);
      await until(page, x => x.level === 'Party level 10 from the Bastion', 'level 10');
    });

    await check('nothing failed, and nothing reached for the internet', async () => {
      equal(context.log.errors, []);
      equal(context.log.net, []);
    });
    await context.close();
  }

  section('The Quest box (laptop, internet off)');
  {
    const context = await H.newContext(browser, 'laptop', { backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();
    await go(page, '');
    await openDoc(page);

    await check('the box is a plain text box with spell checking, and it fills its panel', async () => {
      const a = await page.$eval('[data-test=dmdoc-quest-text]', t => ({ tag: t.tagName, spell: t.spellcheck, max: t.maxLength, label: t.getAttribute('aria-label') }));
      equal(a, { tag: 'TEXTAREA', spell: true, max: 200000, label: 'Quest notes' });
      const sizes = await page.evaluate(() => {
        const p = document.querySelector('[data-test=dmdoc-quest] .tsi-dmdoc__panel-body').getBoundingClientRect();
        const t = document.querySelector('[data-test=dmdoc-quest-text]').getBoundingClientRect();
        return { panelW: p.width, boxW: t.width, boxH: t.height, panelH: p.height };
      });
      assert(sizes.boxW >= sizes.panelW - 30, 'as wide as its panel: ' + JSON.stringify(sizes));
      assert(sizes.boxH >= 100 && sizes.boxH >= sizes.panelH * 0.5, 'it takes most of the panel\'s height: ' + JSON.stringify(sizes));
    });

    await check('typing is saved after a short pause (and says so); a reload brings it back', async () => {
      await typeInBox(page, 'Session 12\n\nThe party reaches the Ironbow gates.');
      equal(await status(page), 'Saving…', 'while the save is waiting');
      equal(await stored(page), null, 'nothing is written on every key press');
      await savedAs(page, 'Session 12\n\nThe party reaches the Ironbow gates.');
      const q = await stored(page);
      assert(q.at > 1e12, 'it carries the time of the last edit: ' + q.at);
      equal(await page.textContent('[data-test=dmdoc-quest-count]'), '48 of 200,000 characters');
      await page.reload();
      await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden]) [data-test=dmdoc-quest-text]');
      equal(await boxText(page), 'Session 12\n\nThe party reaches the Ironbow gates.');
    });

    await check('clicking out of the box, or the page being hidden or closed, saves at once', async () => {
      await page.click('[data-test=dmdoc-quest-text]');
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' One.');
      await page.click('[data-test=dmdoc-bar]');                       /* blur */
      await page.waitForFunction(() => TSI.store.get('tsi.dmdoc.quest', null).text.endsWith('gates. One.'), null, { timeout: 1500 });
      await page.click('[data-test=dmdoc-quest-text]');
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' Two.');
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      equal((await page.evaluate(() => TSI.store.get('tsi.dmdoc.quest', null).text)).endsWith('One. Two.'), true, 'pagehide');
      await page.keyboard.type(' Three.');
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      equal((await page.evaluate(() => TSI.store.get('tsi.dmdoc.quest', null).text)).endsWith('Two. Three.'), true, 'the page hidden');
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await savedAs(page, await boxText(page));
    });

    await check('the two-second refresh never touches the box: same box, same focus, same caret, same selection', async () => {
      await page.evaluate(() => { document.querySelector('[data-test=dmdoc-quest-text]').__same = true; });
      await page.click('[data-test=dmdoc-quest-text]');
      await page.keyboard.press('Control+Home');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('Shift+ArrowRight');
      const before = await page.evaluate(() => { const t = document.querySelector('[data-test=dmdoc-quest-text]'); return [t.selectionStart, t.selectionEnd]; });
      equal(before, [2, 4]);
      /* The Party panel is redrawn when the Bastion's level changes in another window. */
      const other = await context.newPage();
      await go(other, 'bastion');
      await setBastion(other, s => { s.partyLevel = 12; });
      await other.close();
      await until(page, x => x.level === 'Party level 12 from the Bastion', 'the Party panel redrawn');
      await page.waitForTimeout(2300);                       /* and a couple more refreshes */
      const after = await page.evaluate(() => {
        const t = document.querySelector('[data-test=dmdoc-quest-text]');
        return { same: t.__same === true, focused: document.activeElement === t, sel: [t.selectionStart, t.selectionEnd] };
      });
      equal(after, { same: true, focused: true, sel: [2, 4] });
      await page.keyboard.press('ArrowRight');
      await page.keyboard.type('!');                         /* and typing carries on where the caret was */
      equal((await boxText(page)).slice(0, 8), 'Sess!ion', 'typing went where the caret was (after the selection)');
      await page.keyboard.press('Backspace');
      await savedAs(page, await boxText(page));
    });

    await check('another window\'s newer text shows when the box is not in use, and never replaces what is typed or focused', async () => {
      const other = await context.newPage();
      await go(other, '');
      await other.evaluate(() => TSI.store.ready.then(() => { TSI.store.set('tsi.dmdoc.quest', { text: 'From another window', at: Date.now() + 5000 }); return TSI.store.flush(); }));
      await other.close();
      /* The box is focused: it is left alone, and the DM doc says so. */
      await page.click('[data-test=dmdoc-quest-text]');
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(() => /also changed in another window/.test(document.querySelector('[data-test=dmdoc-quest-msg]').textContent));
      equal((await boxText(page)).startsWith('Session 12'), true, 'the focused box was not overwritten');
      /* Clicked out of, with nothing unsaved, it takes the newer copy. */
      await page.click('[data-test=dmdoc-bar]');
      await page.waitForFunction(() => document.querySelector('[data-test=dmdoc-quest-text]').value === 'From another window', null, { timeout: 4000 });
      equal(await note(page), '', 'the message clears');
      equal(await status(page), 'Saved');
    });

    await check('Save as text file downloads exactly what is in the box', async () => {
      await page.fill('[data-test=dmdoc-quest-text]', 'Notes for the table\n\n— Kaelen’s plan');
      await savedAs(page, 'Notes for the table\n\n— Kaelen’s plan');
      const d = await H.download(page, '[data-test=dmdoc-quest-export]');
      assert(/^dm-doc-quest-\d{4}-\d{2}-\d{2}\.txt$/.test(d.name), d.name);
      equal(d.text, 'Notes for the table\n\n— Kaelen’s plan');
      assert(/downloaded as dm-doc-quest/.test(await note(page)), await note(page));
    });

    await check('Clear asks first: Cancel keeps the text, Clear empties the box and the saved copy', async () => {
      await page.waitForTimeout(450);
      await page.click('[data-test=dmdoc-quest-clear]');
      assert(/cannot be undone/.test(await H.modalText(page)), 'it says what it will do');
      await H.clickModal(page, 'Cancel');
      await page.waitForSelector('.tsi-modal', { state: 'detached' });
      equal(await boxText(page), 'Notes for the table\n\n— Kaelen’s plan');
      await page.waitForTimeout(450);
      await page.click('[data-test=dmdoc-quest-clear]');
      await H.modalText(page);
      await H.clickModal(page, 'Clear');
      await page.waitForSelector('.tsi-modal', { state: 'detached' });
      equal(await boxText(page), '');
      await savedAs(page, '');
      equal(await page.$eval('[data-test=dmdoc-quest-clear]', b => b.disabled), true, 'nothing left to clear');
      equal(await page.$eval('[data-test=dmdoc-quest-export]', b => b.disabled), true, 'or to save');
    });

    await check('the PDF reader is not on the page until a PDF is chosen', async () => {
      equal(await page.evaluate(() => typeof window.pdfjsLib), 'undefined');
    });

    await check('Import a Word (.docx) file into the empty box: no question, its text with the lines kept', async () => {
      await importFile(page, sessionDocx());
      await waitNote(page, /Imported \d+ characters from Session 12\.docx/);
      equal(await boxText(page), DOCX_TEXT);
      await savedAs(page, DOCX_TEXT);
      equal(await page.$('.tsi-modal'), null, 'it did not ask: nothing was there');
      equal(await page.evaluate(() => typeof window.pdfjsLib), 'undefined', 'and a Word file does not load the PDF reader');
      equal(await page.$eval('[data-test=dmdoc-quest-import]', b => [b.disabled, b.textContent]), [false, 'Import…'], 'the button is back');
    });

    await check('Import a PDF into a box that has text: it asks Replace, Add to the end or Cancel; each does what it says', async () => {
      await importFile(page, sessionPdf());
      const q = await H.modalText(page);
      assert(/already has text/.test(q) && /Session 13\.pdf/.test(q), q);
      assert(await page.$('.tsi-modal__foot button:text-is("Replace")') && await page.$('.tsi-modal__foot button:text-is("Add to the end")') && await page.$('.tsi-modal__foot button:text-is("Cancel")'), 'three choices');
      await H.clickModal(page, 'Cancel');
      await page.waitForSelector('.tsi-modal', { state: 'detached' });
      equal(await boxText(page), DOCX_TEXT, 'Cancel changes nothing');
      equal(await page.evaluate(() => typeof window.pdfjsLib), 'object', 'the PDF reader loaded when a PDF was chosen');

      await importFile(page, sessionPdf());
      await H.modalText(page);
      await H.clickModal(page, 'Add to the end');
      await page.waitForSelector('.tsi-modal', { state: 'detached' });
      await waitNote(page, /added to the end/);
      equal(await boxText(page), DOCX_TEXT + '\n\n' + PDF_TEXT, 'the PDF\'s lines and pages, after the Word text and a blank line');

      await importFile(page, sessionPdf());
      await H.modalText(page);
      await H.clickModal(page, 'Replace');
      await page.waitForSelector('.tsi-modal', { state: 'detached' });
      await waitNote(page, /Imported \d+ characters from Session 13\.pdf\./);
      equal(await boxText(page), PDF_TEXT, 'Replace puts the PDF in place of what was there');
      await savedAs(page, PDF_TEXT);
    });

    await check('a text file (.txt, with a byte-order mark and Windows line endings) is tidied on the way in', async () => {
      await page.fill('[data-test=dmdoc-quest-text]', '');
      await importFile(page, F.write(TMP, 'notes.txt', '﻿First line  \r\nSecond line\r\n\r\n\r\n\r\n\r\n\r\nThird after a gap\r\n'));
      await waitNote(page, /Imported \d+ characters from notes\.txt/);
      equal(await boxText(page), 'First line\nSecond line\n\n\nThird after a gap');
    });

    await check('what cannot be read says so in plain words, and changes nothing', async () => {
      const keep = await boxText(page);
      const tries = [
        [F.write(TMP, 'Scan.pdf', F.pdf([[]])), /no text in that PDF.*scan/],
        [F.write(TMP, 'Renamed.docx', 'this is only plain text'), /isn't a Word \.docx/],
        [F.write(TMP, 'Old.doc', 'x'), /old Word \.doc/],
        [F.write(TMP, 'Sheet.docx', F.zip([{ name: 'xl/workbook.xml', data: '<x/>' }])), /isn't a Word \.docx/],
        [F.write(TMP, 'Picture.png', 'x'), /PDF \(\.pdf\), Word \(\.docx\) and text/],
        [F.write(TMP, 'Empty.txt', ''), /file is empty/],
        [F.write(TMP, 'Big.txt', Buffer.alloc(21 * 1024 * 1024, 97)), /21\.0 MB.*20 MB/]
      ];
      for (const [file, pattern] of tries) {
        await importFile(page, file);
        await waitNote(page, pattern);
        equal(await page.$('.tsi-modal'), null, path.basename(file) + ': no question asked');
        equal(await boxText(page), keep, path.basename(file) + ': the box is unchanged');
      }
    });

    await check('text over the 200,000-character limit is refused whole, with the number; the box is not cut', async () => {
      const keep = await boxText(page);
      await importFile(page, F.write(TMP, 'Long.txt', 'x'.repeat(200001)));
      await H.modalText(page);
      await H.clickModal(page, 'Replace');
      await waitNote(page, /200,001 characters.*holds up to 200,000.*Nothing was imported/);
      equal(await boxText(page), keep);
      await page.evaluate(() => { const t = document.querySelector('[data-test=dmdoc-quest-text]'); t.value = 'y'.repeat(150000); t.dispatchEvent(new Event('input', { bubbles: true })); });
      await savedAs(page, 'y'.repeat(150000));
      await importFile(page, F.write(TMP, 'Half.txt', 'z'.repeat(60000)));
      await H.modalText(page);
      await H.clickModal(page, 'Add to the end');
      await waitNote(page, /210,002 characters.*Nothing was imported/);
      equal((await boxText(page)).length, 150000, 'still what it was');
      await importFile(page, F.write(TMP, 'Half.txt', 'z'.repeat(60000)));
      await H.modalText(page);
      await H.clickModal(page, 'Replace');
      await waitNote(page, /Imported 60,000 characters from Half\.txt/);
      equal((await boxText(page)).length, 60000, 'Replace fits');
      await page.fill('[data-test=dmdoc-quest-text]', '');
      await savedAs(page, '');
    });

    await check('the box holds at most 200,000 characters when pasted or typed, and says when it is full', async () => {
      await page.evaluate(() => {
        const t = document.querySelector('[data-test=dmdoc-quest-text]');
        t.value = 'a'.repeat(199999);
        t.focus();
        t.setSelectionRange(199999, 199999);
      });
      await page.keyboard.type('bcd');
      equal((await boxText(page)).length, 200000, 'the browser stops at the limit');
      assert(/box is full/.test(await note(page)), await note(page));
      await page.keyboard.press('Backspace');
      equal(await note(page), '', 'the message clears once there is room');
      await page.fill('[data-test=dmdoc-quest-text]', '');
      await savedAs(page, '');
    });

    await check('the text is in Back up everything, and Restore from a backup without it empties the box', async () => {
      await page.fill('[data-test=dmdoc-quest-text]', 'Secret session notes');
      await savedAs(page, 'Secret session notes');
      await page.click('[data-test=dm-doc]');                          /* close it, to reach the footer */
      await page.waitForSelector('[data-test=dmdoc-panel]', { state: 'hidden' });
      const d = await H.download(page, '[data-test=backup-everything]');
      const b = JSON.parse(d.text);
      const rec = b.records.find(r => r.key === QUEST);
      assert(rec, 'not in the backup: ' + b.records.map(r => r.key));
      equal(rec.value.text, 'Secret session notes');
      b.records = b.records.filter(r => r.key !== QUEST);
      await H.chooseFile(page, '[data-test=restore]', H.writeTemp('dmdoc-backup-old.json', b));
      await page.uncheck('.tsi-modal input[type=checkbox]').catch(() => {});
      await Promise.all([page.waitForEvent('load'), H.clickModal(page, 'Restore')]);
      await page.waitForSelector('.tsi-card');
      equal(await page.evaluate(() => TSI.store.ready.then(() => TSI.store.get('tsi.dmdoc.quest', null))), null, 'an old backup has no Quest text, so it is empty after Restore');
    });

    await check('nothing failed, and nothing reached for the internet (the PDF reader came from the suite folder)', async () => {
      equal(context.log.errors, []);
      equal(context.log.net, []);
      equal(context.log.failed, []);
    });
    await context.close();
  }

  section('The Quest box when the browser cannot save');
  await check('with no browser storage at all, the Quest panel says so plainly instead of saying Saved', async () => {
    const context = await H.newContext(browser, 'laptop', { backedUp: true });
    await context.setOffline(true);
    await context.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { get() { throw new Error('no indexedDB'); } });
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('no localStorage'); } });
    });
    const page = await context.newPage();
    await page.goto(INDEX);
    await page.waitForSelector('[data-test=dm-doc]');
    equal(await page.evaluate(() => TSI.store.ready.then(() => TSI.store.mode)), 'memory');
    await openDoc(page);
    equal(await status(page), 'Not saved: this browser is not saving');
    assert(/lost when this window closes/.test(await page.textContent('[data-test=dmdoc-quest-memory]')), 'a plain warning');
    await page.click('[data-test=dmdoc-quest-text]');
    await page.keyboard.type('hello');
    await page.waitForTimeout(1000);
    equal(await status(page), 'Not saved: this browser is not saving', 'still not claiming it saved');
    equal(await boxText(page), 'hello', 'what was typed is still there');
    const d = await H.download(page, '[data-test=dmdoc-quest-export]');
    equal(d.text, 'hello', 'Save as text file still works');
    await context.close();
  });

  section('Typing in the Quest box on top of a tool does not trigger the tool\'s shortcuts');
  {
    const context = await H.newContext(browser, 'laptop', { backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();

    await check('Combat Tracker: a space types a space (it does not start panning) and the arrow keys move the caret', async () => {
      await go(page, 'encounter');
      await page.waitForTimeout(800);
      await openDoc(page);
      await page.click('[data-test=dmdoc-quest-text]');
      await page.keyboard.type('one two');
      equal(await boxText(page), 'one two', 'the space was typed');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.type('X');
      equal(await boxText(page), 'one Xtwo', 'the arrow keys moved the caret in the box');
      const prevented = await page.evaluate(() => new Promise(resolve => {
        const t = document.querySelector('[data-test=dmdoc-quest-text]');
        const seen = [];
        const h = e => seen.push([e.code, e.defaultPrevented]);
        window.addEventListener('keydown', h);
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
        window.removeEventListener('keydown', h);
        resolve(seen);
      }));
      equal(prevented, [['Space', false]], 'the tracker did not swallow the Space key');
      await page.fill('[data-test=dmdoc-quest-text]', '');
      await savedAs(page, '');
    });

    await check('Explorer: a space and the arrow keys do nothing to the map or the heroes', async () => {
      await go(page, 'explorer');
      await page.waitForSelector('[data-test=region]');
      await openDoc(page);
      const heroes = () => page.evaluate(() => JSON.stringify(TSI.explorer.debug.state().tokens.map(t => [t.id, t.x, t.y])) + '|' + JSON.stringify(TSI.explorer.debug.view()));
      const before = await heroes();
      await page.click('[data-test=dmdoc-quest-text]');
      await page.keyboard.type('a b');
      for (const k of ['ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) await page.keyboard.press(k);
      await page.keyboard.type(' c');
      equal(await boxText(page), 'a b c');
      equal(await heroes(), before, 'the heroes and the map did not move');
      await page.fill('[data-test=dmdoc-quest-text]', '');
      await savedAs(page, '');
    });

    await check('nothing failed on the way', async () => {
      equal(context.log.errors, []);
      equal(context.log.net, []);
    });
    await context.close();
  }

  section('The Quest text stays private');
  await check('nothing but the DM doc reads or writes the Quest text: no tool, player window, link or message can send it', async () => {
    const hits = [];
    const allowed = ['shared/js/dmdoc-rules.js', 'shared/js/dmdoc.js'];
    (function walk(dir) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        const rel = path.relative(H.ROOT, p).split(path.sep).join('/');
        if (e.isDirectory()) { if (!['tests', 'docs', '_reference', '_legacy', 'node_modules', '.git', 'lib', 'assets', 'licences'].includes(e.name)) walk(p); return; }
        if (!/\.(js|html)$/.test(e.name) || allowed.includes(rel)) return;
        const text = fs.readFileSync(p, 'utf8');
        if (/dmdoc\.quest|QUEST_KEY/.test(text)) hits.push(rel);
      });
    }(H.ROOT));
    equal(hits.filter(h => !/^guide\.html$/.test(h)), [], 'files that mention the Quest key');
  });

  section('On the TV');
  await check('tv: all four panels fit, nothing runs off sideways, and the Quest box is usable', async () => {
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
    const r = await page.evaluate(() => {
      const s = n => { const e = document.querySelector(n); return { sw: e.scrollWidth, cw: e.clientWidth }; };
      const doc = document.querySelector('[data-test=dmdoc-panel]').getBoundingClientRect();
      const box = document.querySelector('[data-test=dmdoc-quest-text]').getBoundingClientRect();
      return { body: s('[data-test=dmdoc-body]'), doc: [Math.round(doc.right), Math.round(doc.bottom)], box: [Math.round(box.width), Math.round(box.height)], view: [innerWidth, innerHeight] };
    });
    assert(r.body.sw <= r.body.cw, JSON.stringify(r));
    assert(r.doc[0] <= r.view[0] && r.doc[1] <= r.view[1], 'inside the window: ' + JSON.stringify(r));
    assert(r.box[0] > 300 && r.box[1] > 100, 'a usable box: ' + JSON.stringify(r));
    await page.click('[data-test=dmdoc-quest-text]');
    await page.keyboard.type('TV test');
    await savedAs(page, 'TV test');
    await page.waitForTimeout(600);
    await H.shot(page, 'dmdoc-contents-tv');
    equal(context.log.errors, []);
    await context.close();
  });

  section('A narrow window: the four panels stack in one column');
  await check('squeezed under about 760 pixels, the panels stack and the whole body scrolls; the Quest box keeps a usable height', async () => {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    const page = await context.newPage();
    await go(page, '');
    await openDoc(page);
    await page.setViewportSize({ width: 700, height: 700 });
    await page.waitForTimeout(300);
    const g = await page.evaluate(() => {
      const r = s => { const b = document.querySelector('[data-test=' + s + ']').getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
      const body = document.querySelector('[data-test=dmdoc-body]');
      return { party: r('dmdoc-party'), bastion: r('dmdoc-bastion'), explorer: r('dmdoc-explorer'), quest: r('dmdoc-quest'), box: r('dmdoc-quest-text'), scrolls: body.scrollHeight > body.clientHeight, sideways: body.scrollWidth > body.clientWidth };
    });
    assert(g.party.x === g.bastion.x && g.bastion.x === g.explorer.x && g.explorer.x === g.quest.x, 'one column: ' + JSON.stringify(g));
    assert(g.party.y < g.bastion.y && g.bastion.y < g.explorer.y && g.explorer.y < g.quest.y, 'in order, one under another');
    assert(g.box.h >= 200, 'the Quest box keeps a usable height: ' + JSON.stringify(g.box));
    equal([g.scrolls, g.sideways], [true, false], 'it scrolls down, never sideways');
    await H.shot(page, 'dmdoc-narrow');
    await context.close();
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
