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
    t.same(M.artFor(T.beastArt, 'dire_wolf', 'icepelt'), { src: '', label: 'Dire Wolf', alt: 'A dire wolf' });
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
}());
