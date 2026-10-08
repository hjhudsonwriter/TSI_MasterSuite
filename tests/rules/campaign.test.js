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
    t.same([s.heroes, s.day, s.daysPassed, s.orders, s.nextWord], [[], null, null, null, null]);
    t.same([s.region, s.clan, s.god, s.effects], [null, null, null, []]);
  });

  test('a fresh Explorer and Bastion: Day 1, five heroes, no orders yet, the Northern Province', function (t) {
    var s = sum(explorer(), bastion());
    t.same(s.heroes, ['Kaelen', 'Umbrys', 'Magnus', 'Elara', 'Charles']);
    t.same([s.day, s.daysPassed], [1, 0]);
    t.same([s.orders, s.nextWord], [{ count: 0, next: null }, null], 'a Bastion that hasn\'t read the Explorer\'s day yet has no word to send');
    t.same(s.level, { value: 7, fromBastion: true });
    t.same(s.region, { id: 'northern_province', label: 'Northern Province' });
    t.same(s.clan, { name: 'Blackstone', chief: 'Boris Blackstone', politicalCapital: 0, honourRespect: 0 });
    t.same(s.god, { key: 'telluria', name: 'Telluria', favour: 0 });
  });

  /* A Bastion on Day 10 (following the Explorer) with a little of everything coming. */
  function busy() {
    var b = bastion();
    b.day = 10;
    b.anchored = true;
    b.builtExtras = [{ facId: 'smithy', status: 'building', startDay: 1, readyDay: 22 }, { facId: 'shrine_aurush', status: 'built' }];
    b.pendingOrders = [
      { id: 'a', facId: 'barracks', fnId: 'recruit_defenders', label: 'Barracks: Recruit Defenders', issuedDay: 9, dueDay: 14 },
      { id: 'h', facId: 'hall_of_emissaries', fnId: 'secure_trade_agreement', label: 'Hall of Emissaries: Secure Trade Agreement (Clan Karr)', issuedDay: 10, dueDay: 17 },
      { id: 'w', facId: 'war_council', fnId: 'war_action', label: 'War Action', issuedDay: 10, dueDay: 13, meta: { kind: 'war_action', objective: 'raid', targetName: 'Bacca' } },
      { id: 'd', facId: 'dock', fnId: 'charter_berth', label: 'Dock: Charter Berth (Longship)', issuedDay: 8, dueDay: 15 }
    ];
    b.repairs = { dock: 16 };
    b.diplomacy.agreements = [{ title: 'Trade Agreement', clan: 'Clan Karr', startDay: 5, endDay: 26, income: 90, lastShipmentDay: 5 }];
    b.diplomacy.delegations = [{ title: 'Hosted Delegation (assertive)', clan: 'Clan Slade', startDay: 9, endDay: 23 }];
    b.tradeNetwork.active = true;
    b.tradeNetwork.routes = [{ id: 'r', clan: 'Karr', risk: 'high', status: 'active', nextDay: 12, expiresDay: 40 }, { id: 's', clan: 'Farmer', risk: 'low', status: 'active', nextDay: 12, expiresDay: 40 }];
    b.warRecovery = [{ id: 'x', kind: 'beast', name: 'Ape', status: 'wounded', untilDay: 11 }];
    b.wars = { bacca: { since: 6, last: 10, next: 13 } };
    return b;
  }

  test('orders pending and the next word from the Ironbow, after the Explorer\'s day', function (t) {
    var e = explorer();
    e.travel.day = 10;
    var s = sum(e, busy());
    t.same(s.orders, { count: 4, next: { day: 13, label: 'War Action', inDays: 3 } });
    t.same(s.nextWord, { day: 11, inDays: 1, lines: ['The Ape is fit to fight again.'] });
    e.travel.day = 11;
    t.same(sum(e, busy()).nextWord.day, 12, 'the Bastion\'s day 11 is still to come, but the DM doc looks after the Explorer\'s day');
    var old = { treasuryGP: 5, partyLevel: 9, turn: 4, builtExtras: [], pendingOrders: [{ completeTurn: 5 }], defenders: {}, warehouse: [] };
    s = sum(e, old);
    t.same([s.orders, s.nextWord, s.level.value], [null, null, 9], 'a Bastion saved in turns has neither (it\'s set aside when the Bastion opens)');
  });

  test('"The Ironbow sends word…": what the Bastion has coming, day by day, read from its save', function (t) {
    var b = busy();
    var before = JSON.stringify(b);
    t.same(C.ironbowNews(b, 10, 17), [
      { day: 11, lines: ['The Ape is fit to fight again.'] },
      { day: 12, lines: ['The sea route to Karr needs a roll.'] },
      { day: 13, lines: ['Your army is ready to march on Bacca (Raid).', 'Clan Bacca may attack: the Bastion rolls to see.'] },
      { day: 14, lines: ['Barracks: Recruit Defenders is complete.'] },
      { day: 17, lines: ['Hall of Emissaries: Secure Trade Agreement (Clan Karr) needs your roll.', 'Dock: Charter Berth (Longship) is complete.', 'Repairs: the Dock is working again.'] }
    ], 'the Dock\'s order waits for its repairs; the low-risk route pays without a roll');
    t.same(C.ironbowNews(b, 17, 29), [
      { day: 22, lines: ['The Smithy is built.'] },
      { day: 23, lines: ['Your delegation from Clan Slade has ended.'] },
      { day: 26, lines: ['Your Trade Agreement with Clan Karr has ended (its last shipment arrived).'] },
      { day: 29, lines: ['A Bastion event is due.'] }
    ]);
    t.same(C.ironbowNews(b, 13, 13), []);
    t.equal(JSON.stringify(b), before, 'the save isn\'t changed');
    var ahead = busy();
    ahead.day = 20;
    t.same(C.ironbowNews(ahead, 2, 3), [], 'Reset Travel: the Bastion is ahead, and will move its days rather than pass them');
    var loose = busy();
    loose.anchored = false;
    t.same(C.ironbowNews(loose, 10, 30), [], 'not following the Explorer yet');
    t.same(C.ironbowNews(null, 10, 11), []);
  });

  test('the word the Explorer sends at Make Camp comes on the days the Bastion itself has news', function (t) {
    var b = busy();
    b.wars = {};
    b.tradeNetwork.routes = [];
    b.pendingOrders = b.pendingOrders.filter(function (o) { return o.facId !== 'hall_of_emissaries' && o.facId !== 'war_council'; });
    var predicted = C.ironbowNews(b, 10, 30).map(function (w) { return w.day; });
    for (var d = 11; d <= 30; d++) {
      BR.startDay(b, bdata, 0);
      BR.finishRoutes(b);
      BR.dueOrders(b, b.dayInProgress.skipped).forEach(function (o) {
        BR.completeSimpleOrder(b, bdata, o, dice([0.5])).forEach(function (l) { BR.addWord(b, l[1]); });
        BR.removeOrder(b, o.id);
      });
      BR.finishDay(b, bdata, bdata.events, dice([0.5]), 0);
    }
    t.same(b.word.map(function (w) { return w.day; }), predicted);
    t.same(b.word.filter(function (w) { return w.day === 22; })[0].lines, ['The Smithy is built.']);
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
    b.partyLevel = 99;
    var s = sum(explorer(), b);
    t.same([s.clan.politicalCapital, s.clan.honourRespect, s.god.favour], [100, -5, 0]);
    t.equal(s.level.value, 20);
    var e = explorer();
    e.travel.provinceId = 'atlantis';
    t.same([sum(e, b).region, sum(e, b).clan], [null, null], 'an unknown region shows nothing rather than the wrong Clan');
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

  test('the party\'s gold: the Explorer\'s running total, 0 on a fresh journey, nothing before it has saved', function (t) {
    var s = explorer();
    t.equal(sum(s, null).gold, 0);
    s.journey.gold = -100;
    t.equal(sum(s, null).gold, -100, 'it can go below 0, as the Explorer\'s does');
    TSI.explorer.journey.clearGold(s);
    t.equal(sum(s, null).gold, 0, 'cleared in the Explorer');
    t.equal(sum(null, bastion()).gold, null);
  });

  test('Threads show as the Explorer\'s list shows them, with what resolving each gives', function (t) {
    var J = TSI.explorer.journey;
    var s = explorer();
    s.travel.day = 8;
    s.journey.threads.push({ id: 't1', name: 'What Drove the Wolves Out', note: 'Something bigger.', from: 'C6', day: 1, resolve: null, follow: null, data: {} });
    s.journey.threads.push({ id: 't2', name: 'The Sealed Dispatch', note: 'Deliver it.', from: 'T6', day: 8, resolve: { gold: 250, dm: 'Notice Board: consider +1 clan honour with Clan Blackstone.' }, follow: null, data: {} });
    s.journey.threads.push({ id: 't3', name: 'The Prospector\'s Claim', note: 'A quarter-share.', from: 'T14', day: 8, resolve: null, follow: { event: 'f2', scope: 'any', mapKey: '', from: 15, to: 15 }, data: {} });
    s.journey.threads.push({ id: 't4', name: 'The Captain\'s Thanks', note: 'She may come.', from: 'C12', day: 9, resolve: { gold: 0, dm: '' }, follow: { event: 'f3', scope: 'isles', mapKey: '', from: 11, to: 14 }, data: {} });
    var th = sum(s, null).threads;
    t.same(th.map(function (x) { return [x.name, x.day, x.from, x.due, x.reward]; }), [
      ['What Drove the Wolves Out', 1, 'C6', '', []],
      ['The Sealed Dispatch', 8, 'T6', '', ['+250 gold', 'DM note: Notice Board: consider +1 clan honour with Clan Blackstone.']],
      ['The Prospector\'s Claim', 8, 'T14', 'Follow-up due Day 15', []],
      ['The Captain\'s Thanks', 9, 'C12', 'Follow-up due Days 11–14', []]
    ]);
    s.journey.threads.forEach(function (x, i) {
      t.equal(th[i].due, J.threadDueText(x), 'the Explorer says the same for ' + x.name);
      t.same(th[i].reward, J.resolveLines(x).filter(function (l) { return !/follow-up/.test(l); }), 'what resolving gives, as the Explorer\'s "are you sure?" says');
    });
    t.same(sum(s, null).nextFollowUp, { name: 'The Captain\'s Thanks', from: 11, to: 14, text: 'Follow-up due Days 11–14' }, 'the soonest-ending follow-up comes first, as the Explorer brings them');
    J.resolveThread(s, 't2');
    t.same(sum(s, null).threads.map(function (x) { return x.name; }), ['What Drove the Wolves Out', 'The Prospector\'s Claim', 'The Captain\'s Thanks'], 'a resolved thread goes');
    t.equal(sum(s, null).gold, 250, 'and its gold is added');
    J.resolveThread(s, 't4');
    t.equal(sum(s, null).nextFollowUp.name, 'The Prospector\'s Claim', 'then the next one');
    s.journey.threads = [];
    t.same([sum(s, null).threads, sum(s, null).nextFollowUp], [[], null]);
  });

  test('a follow-up that didn\'t come is no longer counted as due', function (t) {
    var s = explorer();
    s.journey.threads.push({ id: 't3', name: 'The Prospector\'s Claim', note: 'A quarter-share.', from: 'T14', day: 1, resolve: null, follow: { event: 'f2', scope: 'any', mapKey: '', from: 2, to: 2 }, data: {} });
    t.equal(sum(s, null).nextFollowUp.text, 'Follow-up due Day 2');
    s.travel.day = 3;
    TSI.explorer.journey.newDay(s);
    var th = sum(s, null).threads;
    t.same([th.length, th[0].due, sum(s, null).nextFollowUp], [1, '', null], 'the thread stays, its follow-up gone, as in the Explorer');
    t.ok(/didn't come/.test(th[0].note), th[0].note);
  });

  test('a damaged Explorer save doesn\'t stop the summary', function (t) {
    var s = sum({ tokens: 'x', travel: null, journey: { gold: 'lots', effects: [null, { text: 'no name' }], threads: [7, { note: 'no name' }, { name: 'Odd', follow: { from: 'x' }, resolve: 'y' }] } }, 'junk');
    t.same([s.heroes, s.day, s.bastionSaved, s.effects, s.gold], [[], 1, false, [], 0]);
    t.same(s.threads.map(function (x) { return [x.name, x.due, x.reward]; }), [['Odd', '', []]]);
    t.equal(s.nextFollowUp, null);
    t.equal(s.region.id, 'northern_province', 'the Explorer\'s own first region');
  });
}());
