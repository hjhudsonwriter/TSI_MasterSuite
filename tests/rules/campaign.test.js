/* The campaign at a glance (shared/js/campaign-rules.js): what the DM doc
   shows from the Explorer's and the Bastion's saves (7 October 2026). */
(function () {
  var C = TSI.campaign;
  var REG = window.TSI_DATA.regions;
  var ER = TSI.explorer.rules;
  var ED = window.TSI_DATA.explorer;
  var EE = window.TSI_DATA.journeyEvents;
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents };

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function explorer(region) {
    var s = ER.defaultState(ED);
    if (region) s.travel.provinceId = region;
    return s;
  }
  function bastion() { return BR.defaultState(bdata); }
  function sum(ex, ba) { return C.summary(ex, ba, REG); }

  group('DM doc: the campaign at a glance');

  test('the seven regions are the Explorer\'s seven, with the Bastion\'s Clans and gods', function (t) {
    t.same(Object.keys(REG), ED.provinces.map(function (p) { return p.id; }), 'the same regions, in the same order');
    ED.provinces.forEach(function (p) { t.equal(REG[p.id].label, p.label, p.id); });
    var clans = T.bastion.clans.map(function (c) { return c.key; }).sort();
    t.same(Object.keys(REG).map(function (id) { return REG[id].clanKey; }).sort(), clans, 'one region for each of the Bastion\'s seven Clans');
    var gods = T.bastion.gods.map(function (g) { return g.key; });
    Object.keys(REG).forEach(function (id) {
      var r = REG[id];
      t.equal(T.bastion.clans.filter(function (c) { return c.key === r.clanKey; })[0].name, r.clan, id + ': the Clan\'s name as the Bastion spells it');
      t.ok(gods.indexOf(r.god) >= 0, id + ': a god the Bastion keeps Favour for');
      t.equal(T.bastion.gods.filter(function (g) { return g.key === r.god; })[0].name, r.godName, id + ': the god\'s name as the Bastion spells it');
    });
  });

  test('nothing saved yet: level 7 (the Bastion\'s starting level), no day, no region', function (t) {
    var s = sum(null, null);
    t.same([s.explorerSaved, s.bastionSaved], [false, false]);
    t.same(s.level, { value: 7, fromBastion: false });
    t.same([s.heroes, s.day, s.daysPassed, s.nextBastion, s.bastionTurns], [[], null, null, null, null]);
    t.same([s.region, s.clan, s.god, s.effects], [null, null, null, []]);
  });

  test('a fresh Explorer and Bastion: Day 1, five heroes, no turns yet, the Northern Province', function (t) {
    var s = sum(explorer(), bastion());
    t.same(s.heroes, ['Kaelen', 'Umbrys', 'Magnus', 'Elara', 'Charles']);
    t.same([s.day, s.daysPassed, s.bastionTurns], [1, 0, 0]);
    t.same(s.nextBastion, { day: 8, inDays: 7 });
    t.same(s.level, { value: 7, fromBastion: true });
    t.same(s.region, { id: 'northern_province', label: 'Northern Province' });
    t.same(s.clan, { name: 'Blackstone', chief: 'Boris Blackstone', politicalCapital: 0, honourRespect: 0 });
    t.same(s.god, { key: 'telluria', name: 'Telluria', favour: 0 });
  });

  test('the Bastion\'s turn counter starts at 1, so turns completed is one less', function (t) {
    var b = bastion();
    t.equal(b.turn, 1, 'a fresh Bastion is on turn 1');
    b.turn = 6;
    t.equal(sum(null, b).bastionTurns, 5);
  });

  test('the party level is the Bastion\'s', function (t) {
    var b = bastion();
    b.partyLevel = 12;
    t.same(sum(explorer(), b).level, { value: 12, fromBastion: true });
  });

  test('each region shows its own Clan, chief and god, with that Clan\'s and god\'s standing', function (t) {
    var b = bastion();
    b.politicalCapital.molten = -35; b.honourRespectByClan.molten = -2; b.favour.aurush = 80;
    b.politicalCapital.karr = 50; b.honourRespectByClan.karr = 4; b.favour.pelagos = 15;
    var south = sum(explorer('southern_province'), b);
    t.same(south.clan, { name: 'Molten', chief: 'Callum Molten', politicalCapital: -35, honourRespect: -2 });
    t.same(south.god, { key: 'aurush', name: 'Aurush', favour: 80 });
    var isle = sum(explorer('the_north_isle'), b);
    t.same(isle.clan, { name: 'Karr', chief: 'Helga Karr', politicalCapital: 50, honourRespect: 4 });
    t.same(isle.god, { key: 'pelagos', name: 'Pelagos', favour: 15 });
    t.same(sum(explorer('midland_province'), b).clan.politicalCapital, 0, 'another Clan\'s standing is its own');
  });

  test('the Explorer saved but not the Bastion: the Clan and god show, their standing doesn\'t', function (t) {
    var s = sum(explorer('the_east_isle'), null);
    t.same(s.clan, { name: 'Rowthorn', chief: 'Doran Rowthorn', politicalCapital: null, honourRespect: null });
    t.same(s.god, { key: 'pelagos', name: 'Pelagos', favour: null });
  });

  test('odd values are kept within the Bastion\'s own limits', function (t) {
    var b = bastion();
    b.politicalCapital.blackstone = 400; b.honourRespectByClan.blackstone = -9; b.favour.telluria = 'lots';
    b.partyLevel = 99; b.turn = 0;
    var s = sum(explorer(), b);
    t.same([s.clan.politicalCapital, s.clan.honourRespect, s.god.favour], [100, -5, 0]);
    t.same([s.level.value, s.bastionTurns], [20, 0]);
    var e = explorer();
    e.travel.provinceId = 'atlantis';
    t.same([sum(e, b).region, sum(e, b).clan], [null, null], 'an unknown region shows nothing rather than the wrong Clan');
  });

  test('the next Bastion turn is the one the Explorer actually prompts at Make Camp', function (t) {
    var s = explorer();
    var prompted = [];
    var predicted = [];
    for (var i = 0; i < 24; i++) {
      predicted.push(sum(s, null).nextBastion.day);
      var q = ER.makeCamp(s, ED, EE, dice([0.99]));
      if (q.some(function (x) { return x.event && x.event.title === 'Bastion Turn'; })) prompted.push(s.travel.day);
    }
    t.same(prompted, [8, 15, 22]);
    t.same(predicted.slice(0, 8), [8, 8, 8, 8, 8, 8, 8, 15], 'from Day 1 to Day 7 it says Day 8; on Day 8 it moves on to Day 15');
    t.same([C.isBastionDay(1), C.isBastionDay(7), C.isBastionDay(8), C.isBastionDay(15), C.isBastionDay(16)], [false, false, true, true, false]);
    t.same([C.nextBastionDay(7), C.nextBastionDay(8), C.nextBastionDay(14)], [8, 15, 15]);
  });

  test('Active Effects show exactly as the Explorer\'s list shows them, and go when the Explorer removes them', function (t) {
    var s = explorer();
    s.journey.effects.push({ id: 'a', name: 'Wolf-Friend', text: 'Advantage on Perception.', who: null, whoName: 'The party', from: 'C6', day: 1, until: 'days', untilDay: 8 });
    s.journey.effects.push({ id: 'b', name: 'Warm', text: '', who: 'elara', whoName: 'Elara', from: 'T12', day: 1, until: 'camp', untilDay: 2 });
    s.journey.effects.push({ id: 'c', name: 'Knot', text: 'Use it once.', who: null, whoName: '', from: 'C7', day: 1, until: 'used', untilDay: null });
    var e = sum(s, null).effects;
    t.same(e.map(function (x) { return [x.name, x.who, x.until, x.from]; }), [
      ['Wolf-Friend', 'The party', 'ends Day 8', 'C6'],
      ['Warm', 'Elara', 'until Make Camp', 'T12'],
      ['Knot', 'The party', 'until used', 'C7']
    ]);
    s.journey.effects.forEach(function (x) { t.equal(C.untilText(x, 1), TSI.explorer.journey.untilText(x, 1), 'the Explorer says the same for ' + x.name); });
    ER.makeCamp(s, ED, EE, dice([0.99]));
    t.same(sum(s, null).effects.map(function (x) { return x.name; }), ['Wolf-Friend', 'Knot'], 'Warm goes at Make Camp, with the Explorer');
    for (var d = 2; d < 8; d++) ER.makeCamp(s, ED, EE, dice([0.99]));
    t.equal(s.travel.day, 8);
    t.same(sum(s, null).effects.map(function (x) { return x.name; }), ['Knot'], 'Wolf-Friend goes on Day 8');
  });

  test('a damaged Explorer save doesn\'t stop the summary', function (t) {
    var s = sum({ tokens: 'x', travel: null, journey: { effects: [null, { text: 'no name' }] } }, 'junk');
    t.same([s.heroes, s.day, s.bastionSaved, s.effects], [[], 1, false, []]);
    t.equal(s.region.id, 'northern_province', 'the Explorer\'s own first region');
  });
}());
