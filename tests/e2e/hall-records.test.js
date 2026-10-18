/* The Hall's Clan Relations and Diplomatic Records (pull request 9; Harry,
   18 October 2026), from a double-clicked file:
   - the seven Clans' scores and what is running;
   - a record written as a draft, checked, edited, then confirmed:
     the scores change once, the restriction is DM-tracked and counts days;
   - End early, a note, a dismissed draft, the old Clear Diplomacy Records
     leaves the ledger alone, and a reload changes nothing.
   Run with:  node tests/e2e/hall-records.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const text = (page, test) => page.$eval('[data-test=' + test + ']', n => n.textContent.replace(/\s+/g, ' ').trim());
const lastModal = page => page.$$eval('.tsi-modal', ms => ms[ms.length - 1].textContent.replace(/\s+/g, ' ').trim());

async function closeAll(page) {
  for (let n = 0; n < 6 && (await page.$('.tsi-modal')); n++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}
async function openHall(page) {
  await closeAll(page);
  await page.waitForTimeout(300);
  await page.click('[data-test=tile-hall_of_emissaries]');
  await page.waitForSelector('[data-test=panel-diplomacy] [data-test=hall]');
  await page.waitForTimeout(300);
}
async function fillRecord(page, f) {
  await page.fill('[data-test=rec-title]', f.title);
  for (const k of f.clans || []) await page.check('[data-test=rec-clan-' + k + ']');
  await page.fill('[data-test=rec-day]', String(f.day));
  await page.fill('[data-test=rec-situation]', f.situation || '');
  await page.fill('[data-test=rec-decision]', f.decision || '');
  await page.fill('[data-test=rec-outcome]', f.outcome || '');
  let i = 0;
  for (const c of f.consequences || []) {
    await page.click('[data-test=rec-add-consequence]');
    await page.selectOption('[data-test=rec-c-kind-' + i + ']', c.kind);
    if (c.clan) await page.selectOption('[data-test=rec-c-clan-' + i + ']', c.clan);
    if (c.amount !== undefined) await page.fill('[data-test=rec-c-amount-' + i + ']', String(c.amount));
    if (c.days !== undefined) await page.fill('[data-test=rec-c-days-' + i + ']', String(c.days));
    if (c.text) await page.fill('[data-test=rec-c-text-' + i + ']', c.text);
    i++;
  }
}

(async () => {
  const browser = await H.chromium.launch();
  const ctx = await H.newContext(browser, 'laptop', { acceptDownloads: true });
  await ctx.setOffline(true);
  const page = await ctx.newPage();
  await page.goto(INDEX + '?tool=bastion');
  await page.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state(), null, { timeout: 8000 });
  await page.evaluate(() => TSI.bastion.debug.change(s => {
    s.treasuryGP = 5000; s.partyLevel = 9;
    s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }, '', '', ''];
    s.honourRespectByClan.karr = 0; s.politicalCapital.slade = -15;
  }));

  section('The Hall');

  await check('Clan Relations lists the seven Clans with their own scores; Diplomatic Records starts empty; the Hall\'s own orders are still there', async () => {
    await openHall(page);
    equal(await page.$$eval('[data-test=clan-relations] .tsi-bas-rel__row', r => r.length), 7);
    equal(await text(page, 'relations-pc-slade'), 'PC −15');
    equal(await text(page, 'relations-hr-karr'), 'H&R 0');
    assert(/No records yet/.test(await text(page, 'dip-records-ledger')));
    equal(await page.$$eval('.tsi-bas-hall__fns .tsi-bas-fn', f => f.length), 6, 'the six orders are unchanged');
  });

  await check('a record needs a title and valid consequences; the box stays as typed', async () => {
    await page.click('[data-test=record-new]');
    await page.waitForSelector('[data-test=record-dialog]');
    await H.shot(page, 'hall-record-dialog-laptop');
    await H.clickModal(page, 'Save draft');
    await page.waitForTimeout(300);
    assert(/Give the event a title/.test(await lastModal(page)));
    await H.clickModal(page, 'OK');
    await page.waitForSelector('[data-test=record-dialog]');
    await fillRecord(page, { title: 'The Karr envoy storms out', clans: ['karr'], day: 9, situation: 'He walked out of the summit.', decision: 'The party let him go.', consequences: [{ kind: 'restriction', clan: 'karr', text: 'No NEW diplomatic or trade action' }] });
    await H.clickModal(page, 'Save draft');
    await page.waitForTimeout(300);
    assert(/how many days/.test(await lastModal(page)), await lastModal(page));
    await H.clickModal(page, 'OK');
    await page.waitForSelector('[data-test=record-dialog]');
    equal(await page.inputValue('[data-test=rec-title]'), 'The Karr envoy storms out', 'what was typed is still there');
  });

  await check('Save draft keeps it as a draft: no score changes, nothing running', async () => {
    await page.fill('[data-test=rec-c-days-0]', '28');
    await page.click('[data-test=rec-add-consequence]');
    await page.selectOption('[data-test=rec-c-kind-1]', 'hr');
    await page.selectOption('[data-test=rec-c-clan-1]', 'karr');
    await page.fill('[data-test=rec-c-amount-1]', '-1');
    await H.clickModal(page, 'Save draft');
    await page.waitForTimeout(400);
    const s = await bas(page);
    equal([s.diplomaticRecords.list.length, s.diplomaticRecords.list[0].id, s.diplomaticRecords.list[0].status, s.honourRespectByClan.karr], [1, 'dr-0001', 'draft', 0]);
    await openHall(page);
    equal(await page.getAttribute('[data-test=record-dr-0001]', 'data-status'), 'draft');
    assert(/Nothing running/.test(await text(page, 'relations-row-karr')));
  });

  await check('Edit a draft, then Confirm outcome: it says what it will do, and the score changes once', async () => {
    await page.click('[data-test=record-open-dr-0001]');
    await page.waitForSelector('[data-test=record-dialog]');
    await page.fill('[data-test=rec-outcome]', 'Karr is offended and will not deal with us for a month.');
    await H.clickModal(page, 'Confirm outcome');
    await page.waitForTimeout(400);
    const q = await lastModal(page);
    assert(/Honour & Respect −1/.test(q) && /Restriction or embargo/.test(q) && /does not enforce it/.test(q), q);
    await H.clickModal(page, 'Cancel');
    await page.waitForSelector('[data-test=record-dialog]');
    equal((await bas(page)).honourRespectByClan.karr, 0, 'cancelling the question applied nothing');
    await H.clickModal(page, 'Confirm outcome');
    await page.waitForTimeout(300);
    await H.clickModal(page, 'Confirm');
    await page.waitForTimeout(500);
    const s = await bas(page);
    equal([s.honourRespectByClan.karr, s.diplomaticRecords.list[0].status, s.diplomaticRecords.list[0].consequences.map(c => c.status)], [-1, 'confirmed', ['active', 'applied']]);
    equal(s.log.filter(l => l.title === 'Diplomatic Records').length, 1);
  });

  await check('Clan Relations now shows Karr at −1 with the restriction running to its last day', async () => {
    await openHall(page);
    equal(await text(page, 'relations-hr-karr'), 'H&R −1');
    const s = await bas(page);
    const until = s.diplomaticRecords.list[0].consequences[0].until;
    assert(until === s.day + 28, 'until ' + until);
    assert(new RegExp('Restriction: No NEW diplomatic or trade action until Day ' + until).test(await text(page, 'relations-row-karr')), await text(page, 'relations-row-karr'));
  });

  await check('a confirmed record opens read-only; a note is added to its history; End early asks first', async () => {
    await page.click('[data-test=record-open-dr-0001]');
    await page.waitForSelector('[data-test=record-view]');
    assert(/Confirmed on Day/.test(await text(page, 'record-view')));
    await page.fill('[data-test=rec-note-input]', 'The players want to send an apology.');
    await H.clickModal(page, 'Add note');
    await page.waitForTimeout(400);
    await page.click('[data-test=record-open-dr-0001]');
    await page.waitForSelector('[data-test=record-view]');
    assert(/Note: The players want to send an apology/.test(await text(page, 'rec-history')));
    await page.click('[data-test=rec-end-dr-0001\\:c1]');
    await page.waitForTimeout(400);
    await H.clickModal(page, 'End early');
    await page.waitForTimeout(500);
    const s = await bas(page);
    equal([s.diplomaticRecords.list[0].consequences[0].status, s.honourRespectByClan.karr], ['ended', -1]);
    await closeAll(page);
    await openHall(page);
    assert(/Nothing running/.test(await text(page, 'relations-row-karr')));
  });

  await check('a draft can be dismissed from the editor\'s record list; nothing is applied; the old Clear Diplomacy Records leaves the ledger alone', async () => {
    await page.click('[data-test=record-new]');
    await page.waitForSelector('[data-test=record-dialog]');
    await fillRecord(page, { title: 'A rumour', clans: ['slade'], day: 10, consequences: [{ kind: 'pc', clan: 'slade', amount: 5 }] });
    await H.clickModal(page, 'Save draft');
    await page.waitForTimeout(400);
    await page.evaluate(() => TSI.bastion.debug.change(s => { TSI.bastion.rules.dismissDipRecord(s, 'dr-0002'); }));
    await openHall(page);
    equal(await page.getAttribute('[data-test=record-dr-0002]', 'data-status'), 'dismissed');
    equal((await bas(page)).politicalCapital.slade, -15);
    await page.click('[data-test=clear-diplomacy]');
    await H.clickModal(page, 'Clear');
    await page.waitForTimeout(400);
    equal((await bas(page)).diplomaticRecords.list.length, 2);
  });

  await check('a reload changes nothing: the same ledger, the same scores', async () => {
    const before = await bas(page);
    await page.reload();
    await page.waitForFunction(() => window.TSI && TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state(), null, { timeout: 8000 });
    const after = await bas(page);
    equal([after.diplomaticRecords, after.honourRespectByClan, after.politicalCapital], [before.diplomaticRecords, before.honourRespectByClan, before.politicalCapital]);
  });

  await check('the Hall and the record box fit the laptop with nothing scrolling sideways', async () => {
    await openHall(page);
    const lay = await H.layoutCheck(page, ['[data-test=record-new]']);
    assert(lay.scrollWidth <= lay.clientWidth, 'no sideways scroll');
    await page.click('[data-test=record-new]');
    await page.waitForSelector('[data-test=record-dialog]');
    await page.click('[data-test=rec-add-consequence]');
    const box = await page.$eval('[data-test=record-dialog]', n => { const r = n.getBoundingClientRect(); return { right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight }; });
    assert(box.right <= box.w && box.bottom <= box.h + 1, JSON.stringify(box));
    await H.shot(page, 'hall-record-dialog-consequence-laptop');
    await H.clickModal(page, 'Cancel');
  });

  await check('nothing went wrong or reached for the internet', async () => {
    equal(ctx.log.errors, [], 'no page errors');
    equal(ctx.log.net, [], 'nothing online');
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
