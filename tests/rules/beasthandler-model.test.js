/* Scarlett Isles: Beast Handler — the words and shapes the screens draw (BH-1b,
   tools/beasthandler/model.js). */
(function () {
  var M = TSI.beasthandler.model;
  var T = window.TSI_DATA;

  group('Beast Handler: what the screens say (BH-1b, 21 October 2026)');

  test('Bond 0 to 5 is six steps, with what is done, where it is now and what is left', function (t) {
    t.same(M.bondSteps(0).map(function (s) { return s.state; }), ['current', 'todo', 'todo', 'todo', 'todo', 'todo']);
    t.same(M.bondSteps(3).map(function (s) { return s.state; }), ['done', 'done', 'done', 'current', 'todo', 'todo']);
    t.same(M.bondSteps(5).map(function (s) { return s.state; }), ['done', 'done', 'done', 'done', 'done', 'current']);
    t.same(M.bondSteps(9).map(function (s) { return s.n + s.state; }).slice(-1), ['5current'], 'never past 5');
    t.same(M.bondSteps(-2)[0].state, 'current');
    t.equal(M.bondLine({ level: 3, name: 'Bonded' }), 'Bond 3: Bonded');
  });

  test('a Regional Variety is found by its name in any capitals, within its own kind only', function (t) {
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'widowspine').name, 'Widowspine');
    t.equal(M.regionalInfo(T.beastProfile, 'dire_wolf', ' Icepelt ').area, 'North Isle');
    t.equal(M.regionalInfo(T.beastProfile, 'griffin', 'Widowspine'), null, 'a wyvern variety is not a griffin\'s');
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', ''), null);
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'Tidecliff'), null, 'a typed variety simply has no extra text');
    t.equal(M.regionalInfo(T.beastProfile, 'unicorn', 'Widowspine'), null);
    t.equal(M.regionalInfo(null, 'wyvern', 'Widowspine'), null);
  });

  test('a picture falls back to the medallion until one is added, and a variety\'s own picture wins when it has one', function (t) {
    t.same(M.artFor(T.beastArt, 'wyvern', ''), { src: '', label: 'Wyvern', alt: 'A wyvern' });
    t.same(M.artFor(T.beastArt, 'wyvern', 'widowspine'), { src: '', label: 'Wyvern', alt: 'A wyvern' }, 'not matched yet');
    t.same(M.artFor(T.beastArt, 'dire_wolf', 'icepelt'), { src: 'dire-wolf/icepelt.webp', label: 'Dire Wolf', alt: 'A dire wolf' }, 'Harry\'s Icepelt picture');
    t.same(M.artFor(T.beastArt, 'dire_wolf', ''), { src: '', label: 'Dire Wolf', alt: 'A dire wolf' }, 'no variety: the medallion');
    t.same(M.artFor(T.beastArt, 'dire_wolf', 'unknownvariety'), { src: '', label: 'Dire Wolf', alt: 'A dire wolf' });
    ['nightfang', 'icepelt', 'slatejaw', 'reedshadow', 'hollowhowl'].forEach(function (v) { t.equal(M.artFor(T.beastArt, 'dire_wolf', v).src, 'dire-wolf/' + v + '.webp'); });
    t.same(M.artFor(T.beastArt, 'unicorn', ''), { src: '', label: 'Beast', alt: 'A beast' });
    var art = { species: { wyvern: { label: 'Wyvern', alt: 'A wyvern', default: { src: 'w.png' }, variants: { widowspine: { src: 'ws.png' } } } } };
    t.equal(M.artFor(art, 'wyvern', 'widowspine').src, 'ws.png');
    t.equal(M.artFor(art, 'wyvern', 'bleakhook').src, 'w.png');
    t.equal(M.artFor(art, 'wyvern', '').src, 'w.png');
    t.same(Object.keys(T.beastArt.species), ['wyvern', 'griffin', 'dire_wolf']);
  });

  test('the Home screen says the right friendly thing when there is nothing to list', function (t) {
    t.ok(/hasn't been saved yet/.test(M.homeMessage(null)));
    t.ok(/No beast buildings stand/.test(M.homeMessage({ facilities: [], handler: null })));
    t.ok(/no beasts yet.*DM has to house a beast first and then make you its handler/.test(M.homeMessage({ facilities: [{}], handler: { hasCreatures: false } })));
    t.ok(/Choose a handler/.test(M.homeMessage({ facilities: [{}], handler: null })));
    t.equal(M.homeMessage({ facilities: [{}], handler: { hasCreatures: true } }), '');
    t.equal(M.emptyBuilding({ species: { name: 'Dire Wolf' } }), 'No dire wolf is housed here yet.');
  });

  test('Chronicle categories have plain names, and an unknown one is capitalised, never dropped', function (t) {
    t.same(['training', 'bond', 'handler', 'flight', 'note'].map(M.catLabel), ['Training', 'Bond', 'Handler', 'Flight', 'Note']);
    t.equal(M.catLabel('memory'), 'Memory');
    t.equal(M.catLabel(''), 'Note');
  });

  test('the check-before-you-send screen lists creature, building, order, days, ready day, cost and what happens', function (t) {
    var d = { name: 'Stormwing', facility: { name: 'Wyvern Roost', level: 3 } };
    var o = { label: 'Safe Acclimatisation', daysText: '5 days', readyLabel: 'Day 15', costText: 'Free', consequence: 'When it finishes, Bond 1 is ready.' };
    t.same(M.confirmLines(d, o), [['Creature', 'Stormwing'], ['Building', 'Wyvern Roost, Level 3'], ['Order', 'Safe Acclimatisation'], ['Takes', '5 days'], ['Ready on', 'Day 15'], ['Cost', 'Free'], ['What happens', 'When it finishes, Bond 1 is ready.']]);
    o.consequence = '';
    t.equal(M.confirmLines(d, o).length, 6, 'no empty last line');
  });

  test('the connection line and the handler choices', function (t) {
    t.equal(M.syncLine({ ok: true, asOfLabel: 'Day 12' }), 'Read from the Bastion saved on this device · Day 12');
    t.equal(M.syncLine({ ok: false }), 'Not connected to a Bastion save.');
    t.same(M.handlerChoices([{ id: 'Mira', name: 'Mira', count: 2 }, { id: 'elara', name: 'Elara', count: 1 }]), [
      { value: '', label: 'No handler (see the directory only)' }, { value: 'Mira', label: 'Mira (2 beasts)' }, { value: 'elara', label: 'Elara (1 beast)' }]);
    t.equal(M.handlerChoices().length, 1);
  });

  test('a beast\'s requests: those sent and not yet answered come first, then the Bastion\'s answers; nobody else\'s beast shows', function (t) {
    var snap = { receipts: [
      { id: 'r3', type: 'order.request', state: 'scheduled', label: 'Stormwing: Safe Acclimatisation', why: '', creature: 'c1', dueDay: 15 },
      { id: 'r2', type: 'profile.set', state: 'saved', label: 'Stormwing (profile)', why: 'Saved.', creature: 'c1', dueDay: null },
      { id: 'r1', type: 'order.request', state: 'refused', label: 'Ashwing: X', why: 'The Roost is busy.', creature: 'c2', dueDay: null }] };
    var outbox = [{ id: 'w1', type: 'profile.set', creature: 'c1', fac: 'wyvern_roost', label: 'Stormwing (profile)', at: 5 }, { id: 'r3', type: 'order.request', creature: 'c1', fac: 'wyvern_roost', label: 'x', at: 4 }, { id: 'w2', type: 'profile.set', creature: 'c2', label: 'other', at: 9 }];
    var rows = M.requestRows(snap, outbox, 'c1');
    t.same(rows.map(function (r) { return r.id + ':' + r.state; }), ['w1:waiting', 'r3:scheduled', 'r2:saved']);
    t.equal(M.requestLine(rows[0]), 'Submitted, waiting for the Bastion to confirm. Nothing has started.');
    t.equal(M.requestLine(rows[1]), 'Accepted and scheduled in the Bastion: ready on Day 15.');
    t.equal(M.requestLine({ state: 'completed' }), 'Completed.');
    t.equal(M.requestLine({ state: 'saved' }), 'Saved in the Bastion.');
    t.equal(M.requestLine({ state: 'refused', why: 'The Roost is busy.' }), 'Refused: The Roost is busy.');
    t.same(M.requestRows(snap, outbox, 'c2').map(function (r) { return r.id; }), ['w2', 'r1']);
    t.equal(M.requestRows(null, [], 'c1').length, 0);
  });

  test('an order already sent for a building and not yet answered stops a second one being offered there', function (t) {
    var outbox = [{ id: 'a1', type: 'order.request', creature: 'c1', fac: 'wyvern_roost' }, { id: 'a2', type: 'profile.set', creature: 'c1', fac: 'wyvern_roost' }];
    t.equal(M.waitingOrderAt({ receipts: [] }, outbox, 'wyvern_roost').id, 'a1');
    t.equal(M.waitingOrderAt({ receipts: [] }, outbox, 'griffin_tower'), null, 'another building is not affected');
    t.equal(M.waitingOrderAt({ receipts: [{ id: 'a1' }] }, outbox, 'wyvern_roost'), null, 'answered');
  });

  test('the queue on this laptop keeps only well-formed requests, once each, and no more than 100', function (t) {
    var good = { v: 1, id: 'c-abcdefgh1', campaign: 'CAMPAIGN12345678', handler: 'mira', creature: 'c1', fac: 'wyvern_roost', type: 'order.request', view: 'abc', label: 'x', payload: { fnId: 'f' }, at: 1 };
    var q = M.cleanQueue({ commands: [good, good, { id: 'short' }, Object.assign({}, good, { id: 'c-abcdefgh2', type: 'bond.confirm' }), Object.assign({}, good, { id: 'c-abcdefgh3', payload: null }), null, 'x', Object.assign({}, good, { id: 'c-abcdefgh4', at: 'now' })] });
    t.same(q.commands.map(function (c) { return c.id; }), ['c-abcdefgh1']);
    t.same(M.cleanQueue(null), { commands: [] });
    var many = [];
    for (var i = 0; i < 130; i++) many.push(Object.assign({}, good, { id: 'c-many' + (1000 + i) }));
    var out = M.cleanQueue({ commands: many }).commands;
    t.equal(out.length, 100);
    t.equal(out[99].id, 'c-many1129', 'the newest are kept');
  });
}());
