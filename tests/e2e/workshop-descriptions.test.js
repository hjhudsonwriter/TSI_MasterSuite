/* The 11 new Workshop items' Compendium entries (Harry, 10 November 2026): each has its type label and description, no cost or weight and
   no Roll20 link, and still says where it is crafted. Laptop and TV. Run with:  node tests/e2e/workshop-descriptions.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const INDEX = H.fileUrl('index.html');
const NEW = {
  'Beast-Catcher’s Kit': ['Beast-Catcher’s gear (used up)', 'Workshop'],
  'Beast-Collar & Lead': ['Beast-Catcher’s gear (reusable)', 'Smith'],
  'Beast-Chain Rig': ['Beast-Catcher’s gear (reusable)', 'Smith'],
  'Stillroot Salve': ['Beast-Catcher’s salve (used up)', 'Alchemist'],
  'Dreamroot Salve': ['Beast-Catcher’s salve (used up)', 'Alchemist'],
  'Beast Salve': ['Beast-Catcher’s salve (used up)', 'Alchemist'],
  'Scent Lure': ['Beast-Catcher’s lure (used up)', 'Alchemist'],
  'Falconer’s Hood & Jesses': ['Beast-Catcher’s gear (reusable)', 'Artisan'],
  'Jaw-Strap & Tail Sheath': ['Beast-Catcher’s gear (reusable)', 'Artisan'],
  'Handler’s Gauntlets': ['Beast-Catcher’s gear (reusable)', 'Artisan'],
  'Beast Muzzle': ['Beast-Catcher’s gear (reusable)', 'Artisan']
};

async function run(browser, size) {
  const ctx = await H.newContext(browser, size);
  await ctx.setOffline(true);
  const page = await ctx.newPage();
  await page.goto(INDEX + '?tool=bastion');
  await page.waitForSelector('[data-test=compendium]');
  await page.waitForTimeout(500);
  await page.click('[data-test=compendium]');
  await page.waitForSelector('[data-test=comp-list]');
  for (const name of Object.keys(NEW)) {
    await page.fill('[data-test=comp-search]', name);
    await page.click('.tsi-bas-comp__item[data-item="' + name.replace(/"/g, '\\"') + '"]');
    const d = await page.$eval('[data-test=comp-detail]', n => n.textContent.replace(/\s+/g, ' ').trim());
    assert(d.includes(NEW[name][0]), name + ': the type label (' + d + ')');
    assert(d.includes('Craftable at:') && d.includes(NEW[name][1]), name + ': where it is crafted (' + d + ')');
    assert(!/\b(gp|lb)\b|Cost|Weight/.test(d), name + ': no cost or weight');
    equal(await page.$('[data-test=roll20]'), null, name + ': no Roll20 link');
    equal(await page.$eval('.tsi-bas-comp__summary', n => n.textContent.length > 20), true, name + ': a description');
  }
  const lay = await H.layoutCheck(page, ['[data-test=comp-detail]']);
  equal(lay.scrollWidth > lay.clientWidth, false, 'no sideways scroll');
  equal(ctx.log.errors, [], 'page errors');
  equal(ctx.log.net, [], 'internet');
  await ctx.close();
}

(async () => {
  const browser = await H.chromium.launch();
  section('Compendium entries for the new Workshop items');
  await check('laptop: all eleven have their type label and description, and nothing else', () => run(browser, 'laptop'));
  await check('TV: the same, with nothing cut off', () => run(browser, 'tv'));
  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
