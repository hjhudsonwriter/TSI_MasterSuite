/* Combat Tracker: reinforcements added to a fight in progress (Harry, 19
   October 2026). Run with:  node tests/e2e/reinforcements.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const TRACKER = H.fileUrl('index.html') + '?tool=encounter';

const st = page => page.evaluate(() => TSI.encounter.debug.state());
async function addLib(page, name, type, hp) {
  await page.fill('[data-test=new-name]', name);
  await page.selectOption('[data-test=new-type]', type);
  await page.fill('[data-test=new-max-hp]', String(hp));
  await page.click('[data-test=add-to-library]');
}
async function addSelected(page, names) {
  const s = await st(page);
  for (const item of s.library) {
    const want = names.includes(item.name);
    if (want !== s.selectedLibraryIds.includes(item.id)) await page.click(`[data-test=library-item][data-name="${item.name}"]`);
  }
  await page.waitForTimeout(300);
  await page.click('[data-test=add-selected]');
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await H.chromium.launch();
  const context = await H.newContext(browser, 'laptop');
  await context.setOffline(true);
  const page = await context.newPage();

  section('Reinforcements join a fight in progress');
  await page.goto(TRACKER);
  await page.waitForSelector('[data-test=complete-turn]');
  await addLib(page, 'Aria', 'pc', 20);
  await addLib(page, 'Borin', 'pc', 22);
  await addLib(page, 'Goblin', 'monster', 7);
  await addSelected(page, ['Aria', 'Borin', 'Goblin']);
  await page.click('[data-test=auto-init]');
  await page.click('[data-test=begin]');
  await page.fill('[data-test=damage]', '');
  await page.click('[data-test=complete-turn]');
  await page.waitForTimeout(300);
  let before;

  await check('Add Selected mid-fight keeps the round, the turn and the order; the arrival waits, skipped', async () => {
    before = await st(page);
    equal(before.encounter.status, 'running');
    await addSelected(page, ['Goblin']);
    const s = await st(page);
    equal([s.encounter.status, s.encounter.round, s.encounter.turnIndex], [before.encounter.status, before.encounter.round, before.encounter.turnIndex]);
    equal(s.encounter.roster.slice(0, 3).map(c => c.name), before.encounter.roster.map(c => c.name), 'the order is unchanged');
    const last = s.encounter.roster[3];
    equal([last.name, last.arrival], ['Goblin a', true]);
    equal(await page.$$eval('[data-test=row-init-input]', n => n.length), 1, 'a box to type its initiative');
    assert(!(await page.isDisabled('[data-test=roll-arrivals]')), 'Roll for new arrivals is on');
  });

  await check('typing an initiative places it; the turn marker stays on the same creature and the round does not change', async () => {
    const s0 = await st(page);
    const actor = s0.encounter.roster[s0.encounter.turnIndex].name;
    await page.fill('[data-test=row-init-input]', '40');
    await page.press('[data-test=row-init-input]', 'Enter');
    await page.waitForTimeout(300);
    const s = await st(page);
    equal(s.encounter.roster[0].name, 'Goblin a', 'the highest goes first: ' + JSON.stringify(s.encounter.roster.map(c => [c.name, c.init, !!c.arrival])));
    equal(s.encounter.roster[s.encounter.turnIndex].name, actor, 'still ' + actor + '\'s turn');
    equal(s.encounter.round, s0.encounter.round);
    equal(await page.$$eval('[data-test=row-init-input]', n => n.length), 0);
    assert(await page.isDisabled('[data-test=roll-arrivals]'), 'nothing left to roll');
  });

  await check('Roll for new arrivals rolls only the ones waiting', async () => {
    await addSelected(page, ['Goblin']);
    const s0 = await st(page);
    const others = s0.encounter.roster.filter(c => !c.arrival).map(c => [c.name, c.init]);
    await page.click('[data-test=roll-arrivals]');
    await page.waitForTimeout(300);
    const s = await st(page);
    equal(s.encounter.roster.filter(c => c.arrival).length, 0);
    equal(others.map(([n]) => [n, s.encounter.roster.find(c => c.name === n).init]), others, 'no one else was re-rolled');
    equal([s.encounter.status, s.encounter.round], [s0.encounter.status, s0.encounter.round]);
  });

  await check('a reload keeps all of it', async () => {
    await page.waitForFunction(() => !TSI.store.hasUnsaved() && TSI.store.status().state === 'saved');
    const s0 = await st(page);
    await page.reload();
    await page.waitForSelector('[data-test=complete-turn]');
    const s = await st(page);
    equal([s.encounter.status, s.encounter.round, s.encounter.turnIndex], [s0.encounter.status, s0.encounter.round, s0.encounter.turnIndex]);
    equal(s.encounter.roster.map(c => c.name), s0.encounter.roster.map(c => c.name));
  });

  await check('before a fight starts, Add Selected still goes back to Ready (the old behaviour)', async () => {
    await page.click('[data-test=end]');
    await page.waitForTimeout(200);
    await addSelected(page, ['Goblin']);
    const s = await st(page);
    equal([s.encounter.status, s.encounter.round, s.encounter.turnIndex], ['ready', 1, 0]);
  });

  await check('nothing reached for the internet, and nothing failed', async () => {
    equal(context.log.net, []);
    equal(context.log.failed, []);
    equal(context.log.errors, []);
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
