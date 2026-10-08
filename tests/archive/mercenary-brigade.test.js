/* ARCHIVED with tools/bastion/archive/mercenary-brigade.js (the Bastion
   overhaul, Build 3, Harry, 8 October 2026): the Mercenary Brigade's tests
   and the old single-roll war's, as they were in tests/rules/bastion.test.js
   and bastion-campaign.test.js. Loaded by nothing. To run them, add the
   archive and this file to tests/rules.html after the Bastion's own files
   and tests:
     <script src="../tools/bastion/archive/mercenary-brigade.js"></script>
     <script src="archive/mercenary-brigade.test.js"></script>
   All ten pass (checked when archived, 8 October 2026). Six live tests
   check that the Brigade is gone, so they fail while the archive is loaded,
   and come out when it's put back: in bastion.test.js, "the requirements
   line is the Clan's alone", "a Brigade in a save from Builds 1 and 2 loads
   as Unsworn", "what can be committed; the unsworn only send defenders and
   beasts" and "the old single-roll war is archived"; in
   bastion-campaign.test.js, "a former Brigade's waiting War Action" and "no
   Trusted Clients after a battle".
   The Trusted Clients after a battle are checked here directly, as
   war-campaign-rules.js needs its three put-back lines to use them. */
(function () {
  var R = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents };

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function fresh() { return R.defaultState(data); }
  function roll(d20, total) { return { d20: d20, total: total }; }

  group('Archive: the Mercenary Brigade');

  test('forming a Mercenary Brigade: level 7 and 3 defenders', function (t) {
    var s = fresh();
    s.defenders.count = 3;
    t.ok(R.canFormMerc(s, data).ok);
    s.partyLevel = 6;
    t.equal(R.canFormMerc(s, data).lvlOk, false);
    s.partyLevel = 7;
    s.defenders.count = 2;
    t.equal(R.canFormMerc(s, data).defOk, false);
    t.equal(R.requirementsHint(s, data), 'Clan requirements: Level 9+ (NO), Total Support 360+ (NO), 3 clans at 55+ (NO).  Merc requirements: Level 7+ (OK), 3+ defenders (NO).');
  });

  test('a Brigade: its label, a save that keeps it, and Lieutenants and regiments in its wars', function (t) {
    var s = fresh();
    s.organization = { type: 'merc', name: 'The Ironbow Freeblades', chief: '', motto: '', foundedAtDay: 4 };
    t.equal(R.orgLabel(s), 'Brigade: The Ironbow Freeblades');
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
    t.same(back.organization, s.organization);
    t.equal(R.formerBrigade(R.toSave(s)), null);
    s.military = [{ name: 'Lieutenant (1)', qty: 2 }];
    t.equal(R.warAvailable(s).fullWar, true);
  });

  test('a Brigade\'s Trusted Clients after a battle: the target down, everyone else up after a win', function (t) {
    var s = fresh();
    s.organization.type = 'merc';
    var ma = { objective: 'skirmish', targetKey: 'bacca', targetName: 'Bacca' };
    var rw = R.warRewards(s, data, ma, {}, 'victory');
    t.same(rw.trusted, { target: -8, others: 1 });
    var got = { trusted: R.brigadeApplyTrusted(s, data, ma, rw) };
    t.same([s.trustedClientsByClan.bacca, s.trustedClientsByClan.karr], [42, 51]);
    t.equal(R.brigadeTrustedLine(data, ma, rw, got), 'Trusted Clients: Bacca −8, every other clan +1.');
    var c = fresh();
    c.organization.type = 'merc';
    var rw2 = R.warRewards(c, data, ma, {}, 'withdrawal');
    var got2 = { trusted: R.brigadeApplyTrusted(c, data, ma, rw2) };
    t.same([c.trustedClientsByClan.bacca, c.trustedClientsByClan.slade], [46, 49]);
    t.equal(R.brigadeTrustedLine(data, ma, rw2, got2), 'Trusted Clients: Bacca −4, every other clan −1.');
    t.equal(R.warRewards(c, data, ma, {}, 'draw').trusted, null, 'a draw changes nothing');
    var clan = fresh();
    clan.organization.type = 'clan';
    t.equal(R.warRewards(clan, data, ma, {}, 'victory').trusted, null, 'only a Brigade');
  });

  test('Trusted Clients at their limits: the line gives what actually changed', function (t) {
    var m = fresh();
    m.organization.type = 'merc';
    m.trustedClientsByClan.bacca = 3;
    m.trustedClientsByClan.karr = 100;
    var ma = { objective: 'skirmish', targetKey: 'bacca', targetName: 'Bacca' };
    var rw = R.warRewards(m, data, ma, {}, 'victory');
    var got = { trusted: R.brigadeApplyTrusted(m, data, ma, rw) };
    t.equal(R.brigadeTrustedLine(data, ma, rw, got), 'Trusted Clients: Bacca −3 (−8, but it can\'t go below 0), every other clan +1 except Karr (already at 100).');
    t.same([m.trustedClientsByClan.bacca, m.trustedClientsByClan.karr, m.trustedClientsByClan.slade], [0, 100, 51]);
  });

  group('Archive: the old single-roll war');

  test('what can be committed; the unsworn only send defenders and beasts', function (t) {
    var s = fresh();
    s.defenders.count = 5;
    s.defenderBeasts = [{ name: 'Ape', qty: 2 }];
    s.military = [{ name: 'Lieutenant (1)', qty: 2 }, { name: 'Regiment (100)', qty: 1 }];
    t.same(R.warCommit(s, { defenders: '9', beasts: '3', lieutenants: '2', regiments: '1' }), { commitDefenders: 5, commitBeasts: 2, commitLieutenants: 0, commitRegiments: 0 });
    s.organization.type = 'clan';
    t.same(R.warCommit(s, { defenders: '', beasts: '0', lieutenants: '2', regiments: '5' }), { commitDefenders: 0, commitBeasts: 0, commitLieutenants: 2, commitRegiments: 1 });
  });

  test('a raid: DC 14, the modifier from what\'s committed, and the results', function (t) {
    var s = fresh();
    s.organization.type = 'clan';
    s.treasuryGP = 20;
    s.defenders.count = 4;
    s.defenderBeasts = [{ name: 'Ape', qty: 1 }];
    R.queueWarAction(s, { objective: 'raid', targetKey: 'bacca', targetName: 'Bacca', commitDefenders: 4, commitBeasts: 1, commitLieutenants: 2, commitRegiments: 1 }, dice([0.3]));
    var o = s.pendingOrders[0];
    t.equal(o.dueDay, 4, 'musters 3 days later');
    var plan = R.warPlan(s, data, o);
    t.same([plan.dc, plan.mod, plan.title], [14, 4, 'War Action: RAID vs Bacca']);
    R.resolveWar(s, data, plan, roll(5, 9), dice([0.3]), 0);
    t.same([s.treasuryGP, s.politicalCapital.bacca, s.defenders.count, s.defenderBeasts.length, s.clanHonor], [0, 8, 3, 0, 32]);
    t.equal(s.warLog[0].title, 'Failure: RAID vs Bacca');
    t.ok(/Casualties: defenders 1; beasts 1/.test(s.warLog[0].details));
  });

  test('a Brigade\'s war changes its clients\' trust', function (t) {
    var s = fresh();
    s.organization.type = 'merc';
    var plan = R.warPlan(s, data, { meta: { objective: 'defend', targetKey: 'karr', commitDefenders: 2 } });
    t.equal(plan.dc, 12);
    R.resolveWar(s, data, plan, roll(15, 16), dice([0.3]), 0);
    t.same([s.trustedClientsByClan.karr, s.trustedClientsByClan.bacca, s.politicalCapital.karr], [42, 51, 6]);
  });

  test('five Giant Vultures are five beasts, and a lost battle costs one of them, not all five (BAS-25)', function (t) {
    var s = fresh();
    s.defenders.count = 3;
    s.defenderBeasts = [{ name: 'Ape', qty: 1 }, { name: 'Giant Vulture', qty: 5 }];
    t.equal(R.warCommit(s, { defenders: '0', beasts: '5' }).commitBeasts, 5);
    var plan = R.warPlan(s, data, { meta: { objective: 'raid', targetKey: 'bacca', commitDefenders: 3, commitBeasts: 5 } });
    t.equal(plan.mod, 1 + 2, 'the modifier still counts at most 2 beasts');
    R.resolveWar(s, data, plan, roll(2, 5), dice([0.3]), 0);
    t.same(s.defenderBeasts, [{ name: 'Ape', qty: 1 }, { name: 'Giant Vulture', qty: 4 }]);
    t.ok(/Casualties: defenders 1; beasts 1/.test(s.warLog[0].details));
  });

  test('losing beasts takes them one at a time from the end of the list', function (t) {
    var s = fresh();
    s.defenderBeasts = [{ name: 'Ape', qty: 2 }, { name: 'Giant Vulture', qty: 1 }, { name: 'Wolf' }];
    R.removeBeasts(s, 3);
    t.same(s.defenderBeasts, [{ name: 'Ape', qty: 1 }]);
    R.removeBeasts(s, 5);
    t.same(s.defenderBeasts, []);
  });

  test('the beast lost in a war roll is one that marched (the first in the list), never one left at home', function (t) {
    var s = fresh();
    s.defenders.count = 3;
    s.defenderBeasts = [{ name: 'Giant Vulture', qty: 5 }, { name: 'Ape', qty: 2 }];
    var plan = R.warPlan(s, data, { meta: { objective: 'raid', targetKey: 'bacca', commitDefenders: 3, commitBeasts: 5 } });
    R.resolveWar(s, data, plan, roll(1, 4), dice([0.3]), 0);
    t.same(s.defenderBeasts, [{ name: 'Giant Vulture', qty: 4 }, { name: 'Ape', qty: 2 }], 'the Apes stayed at home');
    s.defenderBeasts = [{ name: 'Giant Vulture', qty: 1 }, { name: 'Ape', qty: 2 }];
    R.removeBeasts(s, 1, 2);
    t.same(s.defenderBeasts, [{ name: 'Giant Vulture', qty: 1 }, { name: 'Ape', qty: 1 }]);
    R.removeBeasts(s, 1, 9);
    t.same(s.defenderBeasts, [{ name: 'Giant Vulture', qty: 1 }], 'more committed than are left: the last one goes');
  });
}());
