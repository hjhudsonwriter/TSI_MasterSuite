/* Notice Board Quest Generator: tools/quests/data/*.js and rules.js */
(function () {
  var D = window.TSI_DATA.quests;
  var R = TSI.quests.rules;
  var QS = D.quests;

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function quest(id) { return QS.filter(function (q) { return q.id === id; })[0]; }
  var ALL_FILTERS = { province: 'ALL', faction: 'ALL', qtype: 'ALL', level: 7, clanHonour: 0, templeHonour: 0 };
  function f(changes) { return Object.assign({}, ALL_FILTERS, changes || {}); }

  group('Notice Board: the quests');

  test('all 180 quests are there, numbered 1 to 180', function (t) {
    t.equal(QS.length, 180);
    t.same(QS.map(function (q) { return q.id; }), QS.map(function (q, i) { return i + 1; }));
  });

  test('85 bounties, 8 provinces, 10 quest types and 12 factions, as the old data had', function (t) {
    t.equal(QS.filter(function (q) { return q.quest_type === 'Bounty'; }).length, 85);
    t.equal(R.options(QS, 'province').length, 8);
    t.equal(R.options(QS, 'quest_type').length, 10);
    t.equal(R.options(QS, 'faction').length, 12);
  });

  test('the filter lists are in the old tool\'s order', function (t) {
    t.same(R.options(QS, 'province'), ['Eastern Province', 'Midland Province', 'Northern Province', 'Southern Province', 'The Bolt Isle', 'The East Isle', 'The North Isle', 'Western Province']);
    t.equal(R.options(QS, 'faction')[0], 'Civilian');
  });

  test('names keep their Scarlett Isles spelling', function (t) {
    t.equal(quest(1).settlement, 'Bray’s Beacon');
    t.equal(quest(77).title, 'Goldport’s Firebrand Smugglers');
  });

  group('Notice Board: which quests can appear');

  test('at party level 7 with honour 0 there are 97 eligible quests', function (t) {
    t.equal(R.eligible(QS, f()).length, 97);
  });

  test('bounties show for levels 7 to 10 only, whatever their own level (N1, N2: kept)', function (t) {
    /* Quest 77 also needs Temple Honour 2. */
    var ids = function (level) { return R.eligible(QS, f({ level: level, templeHonour: 2 })).map(function (q) { return q.id; }); };
    t.ok(ids(7).indexOf(77) !== -1, 'quest 77 (a level 11-13 bounty) shows at level 7');
    t.ok(ids(10).indexOf(77) !== -1, 'and at level 10');
    t.ok(ids(11).indexOf(77) === -1, 'but not at level 11');
    t.equal(R.eligible(QS, f({ level: 11 })).filter(function (q) { return q.quest_type === 'Bounty'; }).length, 0);
  });

  test('honour gates quests in both of the old formats', function (t) {
    t.ok(R.honourPass({ honour_required: null }, -3, -3));
    t.ok(!R.honourPass({ honour_required: { clan: 2 } }, 1, 3));
    t.ok(R.honourPass({ honour_required: { clan: 2 } }, 2, -3));
    t.ok(R.honourPass({ honour_required: { temple: 1 } }, -3, 1));
    t.ok(!R.honourPass({ honour_required: 2, honour_type: 'temple' }, 3, 1));
    t.ok(R.honourPass({ honour_required: 2, honour_type: 'clan' }, 2, 0));
    t.ok(R.honourPass({ honour_required: 2 }, -3, -3), 'no type: no gate');
    t.equal(R.eligible(QS, f({ level: 11 })).length, 4);
    t.equal(R.eligible(QS, f({ level: 11, clanHonour: 3, templeHonour: 3 })).length, 28);
  });

  test('province, faction and type filters narrow the pool', function (t) {
    R.eligible(QS, f({ province: 'The Bolt Isle' })).forEach(function (q) { t.equal(q.province, 'The Bolt Isle'); });
    R.eligible(QS, f({ qtype: 'Intrigue' })).forEach(function (q) { t.equal(q.quest_type, 'Intrigue'); });
    R.eligible(QS, f({ faction: 'Wardens' })).forEach(function (q) { t.equal(q.faction, 'Wardens'); });
  });

  test('party level and count are kept in range, as before', function (t) {
    t.equal(R.clampInt('20', 7, 16), 16);
    t.equal(R.clampInt('3', 7, 16), 7);
    t.equal(R.clampInt('', 1, 6), 1);
    t.equal(R.clampInt('4.7', 1, 6), 4);
  });

  group('Notice Board: Generate');

  test('a board has exactly one bounty when any is eligible (N1: kept)', function (t) {
    for (var i = 0; i < 200; i++) {
      var picked = R.generate(R.eligible(QS, f()), 6);
      t.equal(picked.filter(function (q) { return q.quest_type === 'Bounty'; }).length, 1);
      t.equal(picked.length, 6);
    }
  });

  test('Count 1 shows only the bounty, and Quest Type Bounty shows one notice (kept)', function (t) {
    t.equal(R.generate(R.eligible(QS, f()), 1)[0].quest_type, 'Bounty');
    t.equal(R.generate(R.eligible(QS, f({ qtype: 'Bounty' })), 6).length, 1);
  });

  test('with no bounty eligible, the board is all ordinary quests', function (t) {
    var picked = R.generate(R.eligible(QS, f({ level: 11, clanHonour: 3, templeHonour: 3 })), 6);
    t.equal(picked.length, 6);
    picked.forEach(function (q) { t.ok(q.quest_type !== 'Bounty'); });
  });

  test('no two notices on a board are the same quest', function (t) {
    for (var i = 0; i < 100; i++) {
      var ids = R.generate(R.eligible(QS, f()), 6).map(function (q) { return q.id; });
      t.equal(new Set(ids).size, ids.length);
    }
  });

  test('the dice are used in the old tool\'s order', function (t) {
    var pool = [{ id: 1, quest_type: 'Bounty' }, { id: 2, quest_type: 'Bounty' }, { id: 3 }, { id: 4 }, { id: 5 }];
    /* bounty: floor(0.6 * 2) = 1 → id 2; shuffle [3,4,5]: i=2 j=floor(0*3)=0 → [5,4,3]; i=1 j=floor(0.9*2)=1 → [5,4,3] */
    t.same(R.generate(pool, 3, dice([0.6, 0, 0.9])).map(function (q) { return q.id; }), [2, 5, 4]);
  });

  test('each notice is tilted by up to 1.2 degrees either way', function (t) {
    t.equal(R.tilt(dice([0])), '-1.20');
    t.equal(R.tilt(dice([0.5])), '0.00');
    t.equal(R.tilt(dice([0.999])), '1.20');
  });

  test('a notice shows what the old tool showed', function (t) {
    var n = R.notice(quest(1));
    t.same(n, {
      id: 1, bounty: false, title: 'The Broken Beacon',
      text: 'A beacon failed without storm. Find cause before ships abandon the coast.',
      reward: null,
      tags: ['Western Province', 'Bray’s Beacon', 'Investigation', 'Wardens', 'Lv 7-8', '320 gp', 'Warden token: safe passage'],
      sig: '— Warden-Captain Isembard'
    });
    var b = R.notice(quest(5));
    t.equal(b.title, 'BOUNTY');
    t.equal(b.text, 'Dockside Thieves');
    t.equal(b.reward, '280 gp');
    t.equal(R.notice({ id: 9, title: 'T', quest_type: 'Escort' }).sig, '— Unsigned');
  });

  group('Notice Board: quest outlines');

  test('The Broken Beacon\'s outline is word for word the old tool\'s', function (t) {
    var o = R.buildOutline(quest(1));
    t.equal(o.metaLine, 'Bray’s Beacon • Western Province • Wardens • Lv 7-8 • 320 gp');
    t.equal(o.beats[0], 'Briefing: Meet Warden-Captain Isembard in Bray’s Beacon. Get the real constraint (time, secrecy, or politics).');
    t.same(o.encounter, { type: 'Combat', setup: 'Combat featuring: Smuggler Cutthroats.', twist: 'A faction witness arrives mid-scene and complicates everything.' });
    t.equal(o.checks[2].win, 'Clock who\'s lying or withholding.');
    t.equal(o.complication, 'The environment turns hostile (fog, roots, tide, tremor).');
    t.equal(o.resolution, 'Return proof to the poster and claim the reward cleanly. Reward: 320 gp + Warden token: safe passage.');
    t.same(o.pills, ['Investigation', 'Moderate', 'Coast', 'Urgent', 'Mystery']);
  });

  test('the same quest always gets the same outline', function (t) {
    t.same(R.buildOutline(quest(42)), R.buildOutline(quest(42)));
  });

  test('the Rescue quest still gets "Unknown Threat" and one check (QST-18: kept)', function (t) {
    var o = R.buildOutline(quest(60));
    t.equal(o.encounter.setup, 'Chase featuring: Unknown Threat.');
    t.same(o.checks, [{ skill: 'Investigation', dc: 13, win: 'Find the thread that ties it together.' }]);
  });

  group('Notice Board: accepted quests and the shop');

  var A = [quest(12), quest(3), quest(40)];

  test('accepted quests are grouped by province, in alphabetical order', function (t) {
    var groups = R.groupAccepted([quest(5), quest(20), quest(1), quest(2), quest(10)]);
    var provs = groups.map(function (g) { return g.province; });
    t.same(provs, provs.slice().sort(function (a, b) { return a.localeCompare(b, 'en-GB'); }));
    t.same(provs, ['Midland Province', 'Southern Province', 'Western Province']);
    t.same(groups[2].quests.map(function (q) { return q.id; }), [5, 1], 'Dockside Thieves before The Broken Beacon');
    groups.forEach(function (g) {
      var titles = g.quests.map(function (q) { return q.title; });
      t.same(titles, titles.slice().sort(function (a, b) { return a.localeCompare(b, 'en-GB'); }));
    });
  });

  test('the shop is told the ★ quest', function (t) {
    var m = R.shopMessage(A, 3, 1234);
    t.same(m, {
      primaryQuest: {
        id: 3, title: quest(3).title, quest_type: quest(3).quest_type, tags: quest(3).tags,
        province: quest(3).province, settlement: quest(3).settlement, difficulty: quest(3).difficulty
      },
      updatedAt: 1234
    });
  });

  test('with no ★ (or a ★ quest no longer accepted), the shop is told the first accepted quest', function (t) {
    t.equal(R.shopMessage(A, null, 1).primaryQuest.id, 12);
    t.equal(R.shopMessage(A, 99, 1).primaryQuest.id, 12);
  });

  test('with nothing accepted, the shop is told there\'s no quest', function (t) {
    t.same(R.shopMessage([], 3, 5), { primaryQuest: null, updatedAt: 5 });
  });

  test('a quest with no tags sends an empty list, as before', function (t) {
    t.same(R.shopMessage([{ id: 7, title: 'X' }], null, 1).primaryQuest.tags, []);
  });

  group('Notice Board: checking saved data');

  test('good saves are accepted', function (t) {
    t.ok(R.isAcceptedList([]));
    t.ok(R.isAcceptedList([quest(1)]));
    t.ok(R.isOutlineMap({}));
    t.ok(R.isOutlineMap({ 1: R.buildOutline(quest(1)) }));
    t.ok(R.isPrimaryId(4));
  });

  test('damaged saves are spotted (QST-12)', function (t) {
    t.ok(!R.isAcceptedList(null));
    t.ok(!R.isAcceptedList({}));
    t.ok(!R.isAcceptedList([{ id: '4' }]));
    t.ok(!R.isOutlineMap(null));
    t.ok(!R.isOutlineMap([]));
    t.ok(!R.isOutlineMap({ 1: 'text' }));
    t.ok(!R.isPrimaryId('4'));
    t.ok(!R.isPrimaryId(0));
  });

  test('an import file with damaged quests is refused', function (t) {
    t.equal(R.importProblem([{ key: 'tsi.quests.accepted', value: [quest(1)] }]), null);
    t.ok(/accepted quests/.test(R.importProblem([{ key: 'tsi.quests.accepted', value: 'x' }])));
    t.ok(/outlines/.test(R.importProblem([{ key: 'tsi.quests.outlines', value: [] }])));
    t.ok(/starred/.test(R.importProblem([{ key: 'tsi.quests.primaryId', value: 'x' }])));
  });
}());
