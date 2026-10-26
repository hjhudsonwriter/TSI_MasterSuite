/* The Party Name, and no more founding a Clan (step S07 of the Strip Back
   Overhaul, Harry, 22 October 2026), clicked through from a double-clicked
   index.html with the internet off: the crest badge opens a small Party
   Identity panel (a Party Name box, Create in the Clan Crest Creator, Upload,
   Remove); the name saves, shows above the crest and nowhere else, is held to
   40 letters, and clears when emptied; there is no Form Clan anywhere; the
   crest can be made or uploaded from the very start; and a Bastion that had
   founded a Clan opens with that Clan's name as its Party Name.
   The rules are checked in tests/rules/party-name.test.js; the badge's room on
   the map at four sizes in tests/e2e/bastion-screen.test.js.
   Run with:  node tests/e2e/party-name.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const BASTION = INDEX + '?tool=bastion';
const FIXTURES = path.join(__dirname, '..', 'fixtures');
const HEAVY = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'bastion-v3-heavy.json'), 'utf8')).records.find(r => r.key === 'tsi.bastion.state').value;
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const NO_CLAN = /Form(ing)? (a )?Clan|Found(ing)? a Clan|Confirm Founding|Unsworn|Clan Honour|Clan requirements/;

const st = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));
const flush = page => page.evaluate(() => TSI.store.flush());
const stored = page => page.evaluate(() => TSI.store.get('tsi.bastion.state', null));
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const pause = page => page.waitForTimeout(400);
const setUp = (page, fn) => page.evaluate(src => TSI.bastion.debug.change(new Function('s', src)), '(' + fn.toString() + ')(s);');
async function setExplorerDay(page, day) {
  await page.evaluate(d => {
    const ex = TSI.store.get('tsi.explorer.save', null) || { tokens: [], travel: {}, grid: {} };
    ex.travel = Object.assign({}, ex.travel, { day: d });
    TSI.store.set('tsi.explorer.save', ex);
    TSI.bastion.debug.clock();
  }, day);
}
async function open(page) {
  await page.goto(BASTION);
  await page.waitForSelector('[data-test=day-status]');
  await setExplorerDay(page, 1);
  await page.waitForFunction(() => TSI.bastion.debug.state().anchored);
}
async function reopen(page) {
  await flush(page);
  await page.reload();
  await page.waitForSelector('[data-test=day-status]');
}
async function openPanel(page) {
  await pause(page);
  await page.click('[data-test=identity-badge]');
  await page.waitForSelector('[data-test=panel-identity] [data-test=party-name]');
}
async function closePanel(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-test=panel-identity]'));
}
/* What the badge shows: the name (or nothing), the words under the crest while there is none, and what it says aloud. */
const badge = page => page.evaluate(() => {
  const b = document.querySelector('[data-test=identity-badge]');
  const name = b.querySelector('.tsi-bas-badge__name');
  const label = b.querySelector('.tsi-bas-badge__label');
  const img = b.querySelector('img');
  return { name: name.hidden ? '' : name.textContent, label: label.hidden ? '' : label.textContent, aria: b.getAttribute('aria-label'), title: b.title, img: !img.hidden && !!img.naturalWidth };
});
async function typeName(page, text) {
  await page.fill('[data-test=party-name]', text);
  await page.press('[data-test=party-name]', 'Enter');
}
function writePng(name) {
  const p = path.join(require('os').tmpdir(), 'tsi-pn-' + name);
  fs.writeFileSync(p, Buffer.from(PNG, 'base64'));
  return p;
}
const jargon = text => /undefined|null|NaN|\[object|\b[a-z]+_[a-z_]+\b|partyName|organization|clanHonor|trustedClientsByClan|  /.test(text);

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('The crest badge opens a small Party Identity panel');
  {
    const context = await H.newContext(browser, 'laptop', { acceptDownloads: true, backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();
    await open(page);

    await check('the badge is a button, in the painting\'s top-right corner; clicking it opens a small panel; Escape closes it and the focus goes back to the badge', async () => {
      equal(await page.$eval('[data-test=identity-badge]', n => n.tagName), 'BUTTON');
      const r = await page.evaluate(() => { const b = document.querySelector('[data-test=identity-badge]').getBoundingClientRect(); const m = document.querySelector('.tsi-bas-map').getBoundingClientRect(); return { right: m.right - b.right, top: b.top - m.top }; });
      assert(r.right > 0 && r.right < 30 && r.top > 0 && r.top < 30, 'top right of the painting: ' + JSON.stringify(r));
      await openPanel(page);
      const w = await page.$eval('[data-test=panel-identity]', n => n.getBoundingClientRect().width);
      assert(w <= 541, 'a small panel: ' + w);
      await closePanel(page);
      equal(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-test')), 'identity-badge');
    });

    await check('the panel holds the Party Name box, "Create in the Clan Crest Creator", "Upload a picture…" and (once there is a crest) Remove: nothing else', async () => {
      await openPanel(page);
      equal(await page.textContent('[data-test=panel-identity] .tsi-modal__title'), 'Party Identity');
      equal(await page.$eval('[data-test=party-name]', n => [n.maxLength, n.type]), [40, 'text']);
      equal(await page.$eval('[data-test=party-name]', n => n.labels[0].textContent.trim()), 'Party Name (optional)');
      equal([await page.textContent('[data-test=crest-create]'), await page.textContent('[data-test=crest-add]'), await page.isVisible('[data-test=crest-delete]')], ['Create in the Clan Crest Creator ↗', 'Upload a picture…', false]);
      equal(await page.$$eval('[data-test=panel-identity] input, [data-test=panel-identity] select, [data-test=panel-identity] textarea', n => n.length), 1, 'one box');
      equal(await page.$$eval('[data-test=panel-identity] .tsi-modal__body button', n => n.filter(b => !b.hidden).map(b => b.textContent)), ['Create in the Clan Crest Creator ↗', 'Upload a picture…']);
      equal(await page.$eval('[data-test=crest-create]', n => n.classList.contains('tsi-btn--primary')), true, 'the one main action while there is no crest');
      await H.shot(page, 'pn-panel-empty');
      await closePanel(page);
    });

    await check('there is no Form Clan, Clan Honour, Unsworn or Found a Clan in any panel of the Bastion', async () => {
      for (const t of ['open-warehouse', 'open-management', 'identity-badge', 'tile-workshop', 'tile-dock']) {
        await pause(page);
        await page.click('[data-test=' + t + ']');
        await page.waitForSelector('.tsi-bas-panel');
        const text = await page.evaluate(() => document.body.textContent);
        assert(!NO_CLAN.test(text), t + ': ' + (NO_CLAN.exec(text) || [''])[0]);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.tsi-bas-panel'));
      }
      for (const t of ['form-clan', 'honour-box', 'org', 'org-meta', 'requirements', 'clan-honour', 'clan-name', 'crest-field']) equal(await page.$('[data-test=' + t + ']'), null, t);
    });

    await check('the crest is there from the very start: level 1 and no gold are no gate (the buttons are enabled)', async () => {
      await setUp(page, (s) => { s.partyLevel = 1; s.treasuryGP = 0; });
      await openPanel(page);
      equal([await page.isEnabled('[data-test=crest-create]'), await page.isEnabled('[data-test=crest-add]'), await page.isEnabled('[data-test=party-name]')], [true, true, true]);
      await closePanel(page);
      await setUp(page, (s) => { s.partyLevel = 7; });
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The Party Name');
  {
    const context = await H.newContext(browser, 'laptop', { acceptDownloads: true, backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();
    await open(page);

    await check('with no name the badge shows no name; typing one and pressing Enter saves it, and it shows above the crest (here the empty shield)', async () => {
      equal(await badge(page), { name: '', label: 'Add a crest', aria: 'Crest of the Ironbow: no crest yet. Open Party Identity.', title: 'Add a crest', img: false });
      await openPanel(page);
      equal(await page.isVisible('[data-test=party-name-shown]'), false, 'nothing above the large crest either');
      await typeName(page, 'The Ironbow Company');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === 'The Ironbow Company');
      equal(await bare(page, '[data-test=party-name-status]'), 'Saved. It shows above your crest.');
      equal(await bare(page, '[data-test=party-name-shown]'), 'The Ironbow Company');
      equal(await badge(page), { name: 'The Ironbow Company', label: 'Add a crest', aria: 'Crest of The Ironbow Company: no crest yet. Open Party Identity.', title: 'The Ironbow Company', img: false });
      const above = await page.evaluate(() => { const n = document.querySelector('[data-test=badge-name]').getBoundingClientRect(); const s = document.querySelector('.tsi-bas-badge__empty').getBoundingClientRect(); return n.bottom <= s.top + 1; });
      equal(above, true, 'the name is above the shield');
      await H.shot(page, 'pn-named-no-crest');
      await closePanel(page);
    });

    await check('it is saved in the Bastion\'s own save, and it survives a reload', async () => {
      await flush(page);
      equal((await stored(page)).partyName, 'The Ironbow Company');
      await reopen(page);
      equal((await st(page)).partyName, 'The Ironbow Company');
      equal((await badge(page)).name, 'The Ironbow Company');
      await openPanel(page);
      equal(await page.inputValue('[data-test=party-name]'), 'The Ironbow Company');
      await closePanel(page);
    });

    await check('leaving the box saves it too (Tab), and so does closing the panel with Escape', async () => {
      await openPanel(page);
      await page.fill('[data-test=party-name]', 'Second Name');
      await page.press('[data-test=party-name]', 'Tab');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === 'Second Name');
      await page.fill('[data-test=party-name]', 'Third Name');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[data-test=panel-identity]'));
      equal((await st(page)).partyName, 'Third Name', 'Escape closes and keeps what was typed');
      equal((await badge(page)).name, 'Third Name');
    });

    await check('a redraw while you type never wipes what you are typing', async () => {
      await openPanel(page);
      await page.click('[data-test=party-name]');
      await page.keyboard.type(' and more');
      await page.evaluate(() => TSI.bastion.debug.change(s => { s.treasuryGP += 1; }));
      await page.waitForTimeout(250);
      equal(await page.inputValue('[data-test=party-name]'), 'Third Name and more');
      equal((await st(page)).partyName, 'Third Name', 'and it is not saved until you finish');
      await page.press('[data-test=party-name]', 'Enter');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === 'Third Name and more');
      await closePanel(page);
    });

    await check('at most 40 letters: the box stops at 40, and a longer name that gets in some other way is cut at 40', async () => {
      await openPanel(page);
      const fifty = 'abcdefghij'.repeat(5);
      await page.fill('[data-test=party-name]', fifty);
      equal((await page.inputValue('[data-test=party-name]')).length, 40);
      await page.press('[data-test=party-name]', 'Enter');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName.length === 40);
      equal((await st(page)).partyName, fifty.slice(0, 40));
      await page.evaluate(() => { const n = document.querySelector('[data-test=party-name]'); n.removeAttribute('maxlength'); });
      await page.fill('[data-test=party-name]', 'x'.repeat(60));
      await page.press('[data-test=party-name]', 'Enter');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === 'x'.repeat(40));
      assert(/at most 40 letters/.test(await bare(page, '[data-test=party-name-status]')), await bare(page, '[data-test=party-name-status]'));
      equal((await page.inputValue('[data-test=party-name]')).length, 40, 'the box shows what was kept');
      await closePanel(page);
    });

    await check('extra spaces are tidied, angle brackets are taken out (and it says so), and nothing is ever drawn as markup', async () => {
      await openPanel(page);
      await typeName(page, '   Wardens    of   the Ironbow  ');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === 'Wardens of the Ironbow');
      equal(await page.inputValue('[data-test=party-name]'), 'Wardens of the Ironbow');
      await typeName(page, '<b>Bold</b><img src=x onerror=alert(1)>');
      await page.waitForFunction(() => /Bold/.test(TSI.bastion.debug.state().partyName));
      const name = (await st(page)).partyName;
      assert(!/[<>]/.test(name), name);
      equal(await bare(page, '[data-test=party-name-status]'), 'Angle brackets (< and >) can\'t be used in a name, so they were taken out.');
      equal(await page.$eval('[data-test=badge-name]', n => [n.children.length, n.textContent]), [0, name], 'plain text on the badge');
      equal(await page.$eval('[data-test=party-name-shown]', n => n.children.length), 0, 'and in the panel');
      await closePanel(page);
    });

    await check('emptying the box clears the name: nothing is drawn above the crest and the badge is "Crest of the Ironbow" again', async () => {
      await openPanel(page);
      await typeName(page, '');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === '');
      equal(await bare(page, '[data-test=party-name-status]'), 'Saved. No Party Name is shown.');
      equal(await page.isVisible('[data-test=party-name-shown]'), false);
      equal(await badge(page), { name: '', label: 'Add a crest', aria: 'Crest of the Ironbow: no crest yet. Open Party Identity.', title: 'Add a crest', img: false });
      await closePanel(page);
      await reopen(page);
      equal((await st(page)).partyName, '', 'and it stays cleared after a reload');
    });

    await check('the name is shown above the crest only: not in Management, the DM doc, the Warehouse or the tiles', async () => {
      await openPanel(page);
      await typeName(page, 'SECRET Wardens');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === 'SECRET Wardens');
      await closePanel(page);
      await pause(page);
      for (const t of ['open-warehouse', 'open-management', 'tile-workshop', 'tile-dock']) {
        await pause(page);
        await page.click('[data-test=' + t + ']');
        await page.waitForSelector('.tsi-bas-panel');
        assert(!(await page.$eval('.tsi-bas-panel', n => n.textContent)).includes('SECRET'), t + ' shows the name');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.tsi-bas-panel'));
      }
      equal(await page.$$eval('.tsi-bas-tile, .tsi-bas-maplabel, [data-test=day-status]', ns => ns.filter(n => n.textContent.includes('SECRET')).length), 0);
      await page.click('[data-test=dm-doc]');
      await page.waitForSelector('[data-test=dmdoc-panel]:not([hidden])');
      assert(!(await page.$eval('[data-test=dmdoc-panel]', n => n.textContent)).includes('SECRET'), 'the DM doc shows the name');
      await page.click('[data-test=dm-doc]');
      await page.waitForSelector('[data-test=dmdoc-panel]', { state: 'hidden' });
    });

    await check('Download Save carries the name, and Import (which asks first) puts it back', async () => {
      const d = await H.download(page, '[data-test=download-save]');
      const rec = JSON.parse(d.text).records.find(r => r.key === 'tsi.bastion.state');
      equal(rec.value.partyName, 'SECRET Wardens');
      const f = H.writeTemp('party-name-save.json', d.text);
      await openPanel(page);
      await typeName(page, 'Changed');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === 'Changed');
      await closePanel(page);
      await H.chooseFile(page, '[data-test=import-save]', f);
      await page.waitForSelector('.tsi-modal:not(.tsi-bas-panel)');
      await H.clickModal(page, 'Cancel');
      equal((await st(page)).partyName, 'Changed', 'Cancel changes nothing');
      await H.chooseFile(page, '[data-test=import-save]', f);
      await H.clickModal(page, 'Import');
      await page.waitForSelector('[data-test=day-status]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().partyName === 'SECRET Wardens');
    });

    await check('"Back up everything" on the home screen carries the name, and Reset clears it', async () => {
      await flush(page);
      await page.goto(INDEX);
      await page.waitForSelector('[data-test=backup-everything]');
      const d = await H.download(page, '[data-test=backup-everything]');
      equal(JSON.parse(d.text).records.find(r => r.key === 'tsi.bastion.state').value.partyName, 'SECRET Wardens');
      await page.goto(BASTION);
      await page.waitForSelector('[data-test=day-status]');
      await pause(page);
      await page.click('[data-test=reset]');
      await H.clickModal(page, 'Reset');
      await page.waitForSelector('[data-test=day-status]');
      await page.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().partyName === '');
      equal((await badge(page)).name, '');
    });

    await check('nothing reached for the internet, and nothing failed', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The crest, from the start: the Creator\'s window, an upload, and Remove');
  {
    const context = await H.newContext(browser, 'laptop', { acceptDownloads: true, backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();
    await open(page);
    await setUp(page, (s) => { s.partyLevel = 1; s.treasuryGP = 0; s.partyName = 'Wardens of the Ironbow'; });
    const crestKey = () => page.evaluate(() => { const c = TSI.store.get('tsi.bastion.crest', null); return c ? c.key : null; });

    let creator = null;
    await check('"Create in the Clan Crest Creator" opens the Creator in its own window; "Use for the Bastion" there asks here, and the crest shows under the name on the badge and in the panel', async () => {
      await openPanel(page);
      const [tab] = await Promise.all([context.waitForEvent('page'), page.click('[data-test=crest-create]')]);
      creator = tab;
      await creator.waitForSelector('[data-test=use-for-bastion]');
      assert(/index\.html\?tool=crest$/.test(creator.url()), creator.url());
      await creator.click('[data-test=use-for-bastion]');
      await page.waitForSelector('[data-test=crest-offer]', { timeout: 6000 });
      equal(await page.$eval('[data-test=crest-offer-img]', i => [i.naturalWidth, i.naturalHeight]), [512, 512]);
      await H.clickModal(page, 'Use this crest');
      await page.waitForFunction(() => { const i = document.querySelector('[data-test=identity-badge] img'); return i && !i.hidden && i.naturalWidth; });
      const c = await page.evaluate(() => TSI.store.get('tsi.bastion.crest'));
      equal([/^data:image\/png;base64,/.test(c.dataUrl), Object.keys(c.design).length > 20], [true, true]);
      equal(await badge(page), { name: 'Wardens of the Ironbow', label: '', aria: 'Crest of Wardens of the Ironbow. Open Party Identity.', title: 'Wardens of the Ironbow', img: true });
      equal((await st(page)).partyName, 'Wardens of the Ironbow', 'taking the crest leaves the name alone');
      await page.waitForFunction(() => document.querySelector('[data-test=panel-identity] [data-test=crest]') && document.querySelector('[data-test=crest]').naturalWidth);
      equal(await page.$eval('[data-test=crest]', i => i.alt), 'Crest of Wardens of the Ironbow');
      equal(await page.$eval('[data-test=crest-create]', n => n.classList.contains('tsi-btn--primary')), false, 'with a crest, making another is no longer the main action');
      await H.shot(page, 'pn-crest-from-creator');
      await closePanel(page);
      await creator.close();
    });

    await check('a picture can be uploaded; it replaces the Creator\'s, is shrunk to fit, and the name stays above it', async () => {
      const before = await crestKey();
      await openPanel(page);
      await H.chooseFile(page, '[data-test=crest-add]', writePng('upload.png'));
      await page.waitForFunction(k => { const c = TSI.store.get('tsi.bastion.crest', null); return c && c.key !== k && c.name === 'tsi-pn-upload.png'; }, before);
      equal(await page.textContent('[data-test=crest-add]'), 'Upload another…');
      equal((await badge(page)).name, 'Wardens of the Ironbow');
      equal(await page.isVisible('[data-test=crest-delete]'), true);
      await closePanel(page);
    });

    await check('a file that is not a picture is explained and changes nothing', async () => {
      const before = await crestKey();
      await openPanel(page);
      await H.chooseFile(page, '[data-test=crest-add]', H.writeTemp('not-a-crest.txt', 'hello'));
      await page.waitForFunction(() => /PNG, JPG, WebP or GIF/.test(document.body.textContent));
      await H.clickModal(page, 'OK');
      equal(await crestKey(), before);
      await closePanel(page);
    });

    await check('the crest and the name survive a reload; Remove asks first, then takes the crest away and keeps the name', async () => {
      await reopen(page);
      equal((await badge(page)).img, true);
      equal((await badge(page)).name, 'Wardens of the Ironbow');
      await openPanel(page);
      await page.click('[data-test=crest-delete]');
      await H.clickModal(page, 'Cancel');
      equal(await page.isVisible('[data-test=crest-delete]'), true, 'Cancel keeps it');
      await pause(page);
      await page.click('[data-test=crest-delete]');
      await H.clickModal(page, 'Remove');
      await page.waitForFunction(() => !TSI.store.has('tsi.bastion.crest'));
      equal(await page.evaluate(() => document.activeElement.dataset.test), 'crest-add', 'Remove has gone, so the focus stays on Upload');
      equal(await badge(page), { name: 'Wardens of the Ironbow', label: 'Add a crest', aria: 'Crest of Wardens of the Ironbow: no crest yet. Open Party Identity.', title: 'Wardens of the Ironbow', img: false });
      equal((await st(page)).partyName, 'Wardens of the Ironbow');
      await closePanel(page);
    });

    await check('nothing reached for the internet, and nothing failed', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A Bastion that had founded a Clan (the heavy fixture: Clan Ironbow, chief Harry, motto Root and Steel, Clan Honour 55)');
  {
    const context = await H.newContext(browser, 'laptop', { acceptDownloads: true, backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');
    const crest = { dataUrl: 'data:image/png;base64,' + PNG, key: 'old-crest', name: 'old.png' };
    await page.evaluate(([b, c]) => {
      TSI.store.set('tsi.bastion.state', b);
      TSI.store.set('tsi.bastion.crest', c);
      return TSI.store.flush();
    }, [HEAVY, crest]);
    assert(HEAVY.organization && HEAVY.organization.type === 'clan' && HEAVY.organization.chief === 'Harry', 'the fixture really had founded a Clan');
    await page.goto(BASTION);
    await page.waitForSelector('[data-test=changes-box]');

    await check('the box says it plainly, in its own "Your Party" paragraph, with no code words', async () => {
      const lines = await page.$$eval('[data-test=changes-line]', n => n.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
      const mine = lines.filter(l => /^Your Party\./.test(l));
      equal(mine.length, 1);
      equal(mine[0], 'Your Party. A party can no longer found a Clan, so yours, “Clan Ironbow”, is not one any more. Its name is now your Party Name, and shows above your crest. Its chief (Harry), its motto (“Root and Steel”) and its Clan Honour (55) are not kept in the Bastion, but the copy of your Bastion that was set aside has everything. Your crest stays as it is.');
      assert(!jargon(mine[0]), mine[0]);
      assert(!/organization|clanHonor|trustedClients/.test(await bare(page, '[data-test=changes-box]')), 'no field names in the box');
      await H.shot(page, 'pn-migration-box');
    });

    await check('the name has become the Party Name, the crest is the same, and the Clan, its Honour and the Trusted Clients are gone from the live save', async () => {
      const s = await st(page);
      equal(s.partyName, 'Clan Ironbow');
      for (const k of ['organization', 'clanHonor', 'trustedClientsByClan']) equal(k in s, false, k + ' is dropped');
      equal(await page.evaluate(() => TSI.store.get('tsi.bastion.crest').key), 'old-crest', 'the crest stays');
      equal(await page.$eval('.tsi-bas-badge__name', n => n.textContent), 'Clan Ironbow');
      equal(await page.getAttribute('[data-test=identity-badge]', 'aria-label'), 'Crest of Clan Ironbow. Open Party Identity.');
      for (const k of ['honourRespectByClan', 'politicalCapital']) equal(JSON.stringify(s[k]), JSON.stringify(HEAVY[k]), k + ' (the seven Clans) is untouched');
    });

    await check('the set-aside copy has everything: the Clan\'s chief, motto and Clan Honour', async () => {
      await page.waitForFunction(() => TSI.store.keys('quarantine').some(k => k.indexOf('tsi.quarantine.bastion.state') === 0));
      const copy = await page.evaluate(() => TSI.store.get(TSI.store.keys('quarantine').filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0)[0]));
      equal([copy.organization.type, copy.organization.chief, copy.organization.motto, copy.clanHonor], ['clan', 'Harry', 'Root and Steel', 55]);
    });

    await check('once only: after "I\'ve read this" and a reload there is no box, the name is still there, and the live save has no Clan', async () => {
      await H.ackChanges(page);
      await reopen(page);
      await page.waitForTimeout(700);
      equal(await page.$('[data-test=changes-box]'), null);
      const s = await st(page);
      equal(s.partyName, 'Clan Ironbow');
      equal(['organization', 'clanHonor', 'trustedClientsByClan'].filter(k => k in s), []);
      equal(await page.evaluate(() => TSI.store.keys('quarantine').filter(k => k.indexOf('tsi.quarantine.bastion.state') === 0).length), 1, 'no second copy');
    });

    await check('the panel shows the carried-over name in its box and above the crest, with no Clan in it; clearing the name is never undone', async () => {
      await openPanel(page);
      equal(await page.inputValue('[data-test=party-name]'), 'Clan Ironbow');
      equal(await bare(page, '[data-test=party-name-shown]'), 'Clan Ironbow');
      assert(!NO_CLAN.test(await bare(page, '[data-test=panel-identity]')), await bare(page, '[data-test=panel-identity]'));
      await typeName(page, '');
      await page.waitForFunction(() => TSI.bastion.debug.state().partyName === '');
      await closePanel(page);
      await reopen(page);
      equal((await st(page)).partyName, '');
      equal(await page.$('[data-test=changes-box]'), null);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('A version 3 Bastion that never founded a Clan says nothing about one');
  {
    const context = await H.newContext(browser, 'laptop', { acceptDownloads: true, backedUp: true });
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');
    const plain = { v: 3, day: 1, anchored: true, treasuryGP: 100, partyLevel: 7, builtExtras: [], pendingOrders: [], warehouse: [], log: [], organization: { type: 'unsworn', name: '', chief: '', motto: '', foundedAtDay: null }, clanHonor: 40, trustedClientsByClan: { blackstone: 50, bacca: 50, farmer: 50, slade: 50, molten: 50, rowthorn: 50, karr: 50 } };
    await page.evaluate(b => { TSI.store.set('tsi.bastion.state', b); return TSI.store.flush(); }, plain);
    await page.goto(BASTION);
    await page.waitForSelector('[data-test=changes-box]');
    await check('the box has no "Your Party" paragraph, there is no Party Name, and the three old fields are gone', async () => {
      const lines = await page.$$eval('[data-test=changes-line]', n => n.map(x => x.textContent));
      equal(lines.filter(l => /Your Party/.test(l)).length, 0);
      const s = await st(page);
      equal([s.partyName, ['organization', 'clanHonor', 'trustedClientsByClan'].filter(k => k in s)], ['', []]);
      equal((await badge(page)).name, '');
      await H.ackChanges(page);
    });
    await context.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
