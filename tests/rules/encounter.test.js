/* Combat Tracker & VTT Battlemap: tools/encounter/rules.js */
(function () {
  var R = TSI.encounter.rules;

  function withDice(list, fn) {
    var real = Math.random;
    var i = 0;
    Math.random = function () { var v = list[i % list.length]; i++; return v; };
    try { return fn(); } finally { Math.random = real; }
  }
  function face(n) { return (n - 1 + 0.5) / 20; }
  function c(name, type, hp, extra) {
    return Object.assign({ encId: name, baseId: null, name: name, type: type, maxHp: hp, curHp: hp, init: null, avatar: '', refLink: '', conditions: [], defeated: false }, extra || {});
  }
  function fight(roster, extra) {
    var s = R.defaultState();
    s.encounter.roster = roster;
    Object.assign(s.encounter, { status: 'running', turnIndex: 0, round: 1 }, extra || {});
    return s;
  }
  function names(roster) { return roster.map(function (x) { return x.name; }); }
  var ok = { damage: '', condition: '', turns: '' };

  group('Combat Tracker: initiative and turns');

  test('initiative order: highest first, ties by name, NPCs always at the bottom', function (t) {
    var roster = [c('Borin', 'pc', 10, { init: 12 }), c('Old Hask', 'npc', 10, { init: 25 }), c('Aria', 'pc', 10, { init: 12 }), c('Goblin', 'monster', 7, { init: 18 })];
    t.same(names(R.sortRoster(roster)), ['Goblin', 'Aria', 'Borin', 'Old Hask']);
  });

  test('turns skip NPCs, the defeated and anyone at 0 HP (C1: kept)', function (t) {
    var e = fight([c('Aria', 'pc', 10), c('Hask', 'npc', 10), c('Goblin', 'monster', 7, { curHp: 0 }), c('Borin', 'pc', 10, { defeated: true }), c('Orc', 'monster', 15)]).encounter;
    t.equal(R.findNextLivingIndex(e, 1), 4);
    t.equal(R.findNextLivingIndex(e, 5), 0, 'wraps round');
  });

  test('Auto-roll is d20 plus the library bonus, then sorted', function (t) {
    var s = R.defaultState();
    s.library = [{ id: 'g', name: 'Goblin', type: 'monster', maxHp: 7, initBonus: 2 }, { id: 'a', name: 'Aria', type: 'pc', maxHp: 30, initBonus: null }];
    s.encounter.roster = [c('Aria', 'pc', 30, { baseId: 'a' }), c('Goblin', 'monster', 7, { baseId: 'g' })];
    withDice([face(10), face(15)], function () { R.autoInit(s); });
    t.same(s.encounter.roster.map(function (x) { return x.name + ' ' + x.init; }), ['Goblin 17', 'Aria 10']);
    t.same([s.encounter.status, s.encounter.round, s.encounter.turnIndex], ['ready', 1, 0]);
  });

  test('Begin: missing initiative becomes 0, and the first living combatant acts', function (t) {
    var s = R.defaultState();
    s.encounter.roster = [c('Aria', 'pc', 30, { init: 5 }), c('Goblin', 'monster', 7), c('Hask', 'npc', 9, { init: 30 })];
    R.begin(s);
    t.same(names(s.encounter.roster), ['Aria', 'Goblin', 'Hask']);
    t.equal(s.encounter.roster[1].init, 0);
    t.same([s.encounter.status, s.encounter.turnIndex, s.encounter.round], ['running', 0, 1]);
  });

  test('the Paused line says what Begin does (C3: the wording is fixed; Begin still restarts at round 1)', function (t) {
    t.equal(R.statusText('paused'), 'Paused. Pressing Begin starts again from round 1, in initiative order.');
    var s = fight([c('Aria', 'pc', 30, { init: 5 }), c('Goblin', 'monster', 7, { init: 9 })], { status: 'paused', round: 4, turnIndex: 1 });
    R.begin(s);
    t.same([s.encounter.round, s.encounter.turnIndex], [1, 0]);
  });

  group('Combat Tracker: Complete Turn');

  test('it damages the chosen target, counts down only the ending actor\'s conditions, then moves on once', function (t) {
    var s = fight([c('Aria', 'pc', 30, { conditions: [{ name: 'Blessed', remaining: 2 }] }), c('Goblin', 'monster', 7, { conditions: [{ name: 'Prone', remaining: 1 }] })]);
    var res = R.completeTurn(s, { targetId: 'Goblin', damage: '5', condition: '', turns: '' });
    t.ok(res.ok);
    t.equal(s.encounter.roster[1].curHp, 2);
    t.same(s.encounter.roster[0].conditions, [{ name: 'Blessed', remaining: 1 }]);
    t.same(s.encounter.roster[1].conditions, [{ name: 'Prone', remaining: 1 }], 'the target\'s conditions wait for its own turn');
    t.equal(s.encounter.turnIndex, 1);
  });

  test('the round goes up when the order wraps round', function (t) {
    var s = fight([c('Aria', 'pc', 30), c('Goblin', 'monster', 7)], { turnIndex: 1 });
    R.completeTurn(s, Object.assign({ targetId: 'Aria' }, ok));
    t.same([s.encounter.turnIndex, s.encounter.round], [0, 2]);
  });

  test('a wrong Turns number changes nothing: no damage, no condition, no turn (ENC-01)', function (t) {
    var s = fight([c('Aria', 'pc', 30), c('Goblin', 'monster', 7)]);
    var res = R.completeTurn(s, { targetId: 'Goblin', damage: '5', condition: 'Poisoned', turns: '0' });
    t.same([res.ok, res.message], [false, 'Turns must be 1 or more.']);
    t.same([s.encounter.roster[1].curHp, s.encounter.roster[1].conditions.length, s.encounter.turnIndex], [7, 0, 0]);
  });

  test('damage the browser couldn\'t read (e.g. "5-") changes nothing either (ENC-28)', function (t) {
    var s = fight([c('Aria', 'pc', 30), c('Goblin', 'monster', 7)]);
    var res = R.completeTurn(s, { targetId: 'Goblin', damage: '', damageBad: true, condition: '', turns: '' });
    t.same([res.ok, res.message, s.encounter.turnIndex], [false, 'Damage must be a number.', 0]);
  });

  test('a condition with no Turns lasts 1; decimals round down; the same condition refreshes its count', function (t) {
    var s = fight([c('Aria', 'pc', 30), c('Goblin', 'monster', 7)]);
    R.addCondition(s, { targetId: 'Goblin', condition: 'Blinded', turns: '' });
    t.same(s.encounter.roster[1].conditions, [{ name: 'Blinded', remaining: 1 }]);
    R.addCondition(s, { targetId: 'Goblin', condition: 'Blinded', turns: '3.7' });
    t.same(s.encounter.roster[1].conditions, [{ name: 'Blinded', remaining: 3 }]);
    t.equal(s.encounter.turnIndex, 0, 'Add Condition doesn\'t move the turn on');
  });

  test('0 HP means DEFEATED and skipped; healing above 0 clears it (C2, ENC-02)', function (t) {
    var s = fight([c('Aria', 'pc', 30), c('Borin', 'pc', 20), c('Goblin', 'monster', 7)]);
    R.completeTurn(s, { targetId: 'Borin', damage: '25', condition: '', turns: '' });
    t.same([s.encounter.roster[1].curHp, s.encounter.roster[1].defeated, s.encounter.turnIndex], [0, true, 2], 'Borin is skipped');
    R.completeTurn(s, { targetId: 'Borin', damage: '-8', condition: '', turns: '' });
    t.same([s.encounter.roster[1].curHp, s.encounter.roster[1].defeated], [8, false]);
    R.completeTurn(s, Object.assign({ targetId: 'Aria' }, ok));
    t.equal(s.encounter.roster[s.encounter.turnIndex].name, 'Borin', 'Borin gets his turn back');
  });

  test('HP never goes above the maximum', function (t) {
    var s = fight([c('Aria', 'pc', 30, { curHp: 25 }), c('Goblin', 'monster', 7)]);
    R.completeTurn(s, { targetId: 'Aria', damage: '-50', condition: '', turns: '' });
    t.equal(s.encounter.roster[0].curHp, 30);
  });

  test('the fight ends when every monster is down, but never if it has no monsters', function (t) {
    var s = fight([c('Aria', 'pc', 30), c('Goblin', 'monster', 7)]);
    var res = R.completeTurn(s, { targetId: 'Goblin', damage: '9', condition: '', turns: '' });
    t.ok(res.ended);
    t.equal(s.encounter.status, 'ended');
    var s2 = fight([c('Aria', 'pc', 30), c('Borin', 'pc', 7)]);
    R.completeTurn(s2, { targetId: 'Borin', damage: '9', condition: '', turns: '' });
    t.equal(s2.encounter.status, 'running');
  });

  test('old plain-text conditions stay without counting down', function (t) {
    var x = c('Aria', 'pc', 30, { conditions: ['Cursed', { name: 'Prone', remaining: 1 }] });
    R.tickDown(x);
    t.same(x.conditions, ['Cursed']);
  });

  group('Combat Tracker: the library and saved encounters');

  test('Add to Library needs a name and a Max HP above 0', function (t) {
    var s = R.defaultState();
    t.equal(R.saveLibraryEntry(s, { name: 'Goblin', type: 'monster', maxHp: '' }).message, 'Please enter a Name and a valid Max HP.');
    t.ok(R.saveLibraryEntry(s, { name: ' Goblin ', type: 'monster', maxHp: '7.9', initBonus: '2' }).ok);
    t.same([s.library[0].name, s.library[0].maxHp, s.library[0].initBonus], ['Goblin', 7, 2]);
  });

  test('Add Selected makes separate copies: Goblin, Goblin a, Goblin b, and starts again at Ready', function (t) {
    var s = R.defaultState();
    s.library = [{ id: 'g', name: 'Goblin', type: 'monster', maxHp: 7 }];
    s.selectedLibraryIds.add('g');
    R.addSelected(s); R.addSelected(s); R.addSelected(s);
    t.same(names(s.encounter.roster), ['Goblin', 'Goblin a', 'Goblin b']);
    t.ok(s.encounter.roster[0].encId !== s.encounter.roster[1].encId, 'different ids');
    t.same([s.encounter.status, s.encounter.round], ['ready', 1]);
    s.selectedLibraryIds.clear();
    t.equal(R.addSelected(s).message, 'Select one or more combatants from Storage first.');
  });

  test('editing a library entry updates its copies, keeping each copy\'s letter and clamping HP', function (t) {
    var s = R.defaultState();
    s.library = [{ id: 'g', name: 'Goblin', type: 'monster', maxHp: 7 }];
    s.encounter.roster = [c('Goblin', 'monster', 7, { baseId: 'g', curHp: 6 }), c('Goblin a', 'monster', 7, { baseId: 'g', encId: 'x' })];
    R.saveLibraryEntry(s, { name: 'Goblin Boss', type: 'monster', maxHp: '5' }, 'g');
    t.same(s.encounter.roster.map(function (x) { return x.name + ' ' + x.curHp + '/' + x.maxHp; }), ['Goblin Boss 5/5', 'Goblin Boss a 5/5']);
  });

  test('a name ending in a single letter is taken for a copy letter, as before (ENC-23: kept)', function (t) {
    var s = R.defaultState();
    s.library = [{ id: 'k', name: 'Captain K', type: 'npc', maxHp: 10 }];
    s.encounter.roster = [c('Captain K', 'npc', 10, { baseId: 'k' })];
    R.saveLibraryEntry(s, { name: 'Captain J', type: 'npc', maxHp: '10' }, 'k');
    t.equal(s.encounter.roster[0].name, 'Captain J K');
  });

  test('a saved encounter loads with fresh ids, full HP and no conditions', function (t) {
    var s = fight([c('Aria', 'pc', 30, { curHp: 4, init: 12, conditions: [{ name: 'Prone', remaining: 1 }] })]);
    s.encounter.name = 'Ambush';
    t.equal(R.snapshot(s).name, 'Ambush');
    R.loadSaved(s, s.savedEncounters[0]);
    var a = s.encounter.roster[0];
    t.same([a.curHp, a.init, a.conditions, s.encounter.status], [30, 12, [], 'ready']);
    t.ok(a.encId !== 'Aria');
    R.duplicateSaved(s, s.savedEncounters[0]);
    t.equal(s.savedEncounters[1].name, 'Ambush (copy)');
  });

  group('Combat Tracker: campaign files and PDFs');

  test('the campaign file holds the library only, as before', function (t) {
    var s = R.defaultState();
    s.library = [{ id: 'g', name: 'Goblin', type: 'monster', maxHp: 7 }];
    var out = R.campaignExport(s, new Date('2026-09-28T10:00:00Z'));
    t.same(Object.keys(out), ['schema', 'exportedAt', 'library']);
    t.equal(out.schema, 'encounter-tracker-campaign@1');
  });

  test('importing merges by name, type and HP, with new ids; nameless entries are skipped (ENC-07)', function (t) {
    var s = R.defaultState();
    s.library = [{ id: 'g', name: 'Goblin', type: 'monster', maxHp: 7 }];
    var res = R.campaignImport(s, { library: [{ id: 'z', name: 'Goblin', type: 'monster', maxHp: 7 }, { id: 'y', name: 'Orc', type: 'monster', maxHp: '15' }, { type: 'monster', maxHp: 3 }] });
    t.same([res.added, res.skipped], [1, 1]);
    t.same(names(s.library), ['Goblin', 'Orc']);
    t.ok(s.library[1].id !== 'y');
    t.equal(s.library[1].maxHp, 15);
    t.equal(R.campaignImport(s, { nope: 1 }).message, 'This does not look like a valid campaign export for this app.');
  });

  test('PDF import guesses the name and HP as before (HP 10 if none is found)', function (t) {
    var g = R.pdfGuess('Goblin Boss Small humanoid (goblinoid), neutral evil Armor Class 17 Hit Points 21 (6d6)');
    t.same(g, { name: 'Goblin Boss Small', hp: 21 });
    t.same(R.pdfGuess('no capitals here'), { name: 'Imported Creature', hp: null });
    t.equal(R.pdfEntry(R.pdfGuess('nothing')).maxHp, 10);
  });

  group('Combat Tracker: saved data');

  test('a save with a nameless combatant is refused (it broke the old tool: ENC-07)', function (t) {
    t.ok(R.isTrackerSave({ library: [{ name: 'Aria', type: 'pc' }], encounter: { roster: [] } }));
    t.ok(R.isTrackerSave({}));
    t.ok(!R.isTrackerSave({ library: [{ type: 'pc' }] }));
    t.ok(!R.isTrackerSave({ encounter: { roster: [{ name: 5, type: 'pc' }] } }));
    t.ok(!R.isTrackerSave([]));
  });

  test('a saved tracker reads back as it was, selection included', function (t) {
    var s = fight([c('Aria', 'pc', 30)]);
    s.selectedLibraryIds.add('a');
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))));
    t.ok(back.selectedLibraryIds.has('a'));
    t.equal(back.encounter.roster[0].name, 'Aria');
  });

  test('importing refuses damaged tracker, Battlemap or map data', function (t) {
    t.equal(R.importProblem([{ key: 'tsi.encounter.tracker', value: {} }, { key: 'tsi.encounter.mapImage', value: 'data:image/png;base64,AAAA' }]), null);
    t.ok(/combatants/.test(R.importProblem([{ key: 'tsi.encounter.tracker', value: { library: 'x' } }])));
    t.ok(/Battlemap/.test(R.importProblem([{ key: 'tsi.encounter.battlemap', value: { tokenPos: { a: { x: 'left' } } } }])));
    t.ok(/map picture/.test(R.importProblem([{ key: 'tsi.encounter.mapImage', value: 'https://example.com/map.png' }])));
  });

  group('Battlemap: positions tied to the map picture (ENC-03)');

  test('the board is 1600 units wide and shaped like the map (900 tall with none)', function (t) {
    t.same(R.board(3000, 2000), { w: 1600, h: 1600 * 2000 / 3000 });
    t.same(R.board(0, 0), { w: 1600, h: 900 });
  });

  test('a token lands on the same spot of the map on the laptop, the TV, zoomed and panned', function (t) {
    var board = R.board(1600, 900);
    var pos = { x: 1234, y: 567 };
    [[1370, 650, { x: 0, y: 0, zoom: 1 }], [1890, 950, { x: 0, y: 0, zoom: 1 }], [1890, 1060, { x: 40, y: -25, zoom: 1.6 }]].forEach(function (s) {
      var v = R.view(s[0], s[1], board, s[2]);
      var p = R.toScreen(v, pos.x, pos.y);
      var corner = R.toScreen(v, 0, 0);
      var far = R.toScreen(v, board.w, board.h);
      t.equal(((p.x - corner.x) / (far.x - corner.x)).toFixed(6), (1234 / 1600).toFixed(6));
      t.equal(((p.y - corner.y) / (far.y - corner.y)).toFixed(6), (567 / 900).toFixed(6));
      var back = R.toWorld(v, p.x, p.y);
      t.same([back.x.toFixed(6), back.y.toFixed(6)], ['1234.000000', '567.000000']);
    });
  });

  test('at zoom 1 the whole map fits the window, centred', function (t) {
    var v = R.view(1900, 950, R.board(1600, 900), { x: 0, y: 0, zoom: 1 });
    t.equal(v.scale.toFixed(4), (950 / 900).toFixed(4));
    t.equal(Math.round(v.ox), Math.round((1900 - 1600 * 950 / 900) / 2));
  });

  test('snap puts a token\'s centre on the nearest grid corner, nudge included', function (t) {
    t.same(R.snapCentre(100, 36, { size: 70, offX: 0, offY: 0 }), { x: 70, y: 70 });
    t.same(R.snapCentre(100, 36, { size: 70, offX: 4, offY: -2 }), { x: 74, y: 68 });
  });

  test('tokens stay on the board', function (t) {
    t.same(R.clampCentre(-50, 2000, 56, { w: 1600, h: 900 }), { x: 28, y: 872 });
  });

  test('new tokens start in a row along the top', function (t) {
    var pos = R.defaultPositions([{ encId: 'a' }, { encId: 'b' }], {}, { w: 1600, h: 900 }, 56);
    t.same([Math.round(pos.a.x), Math.round(pos.a.y), Math.round(pos.b.x)], [124, 100, 252]);
  });

  test('the fog remembers the squares around living players\' tokens (radius 6 by default)', function (t) {
    var vtt = R.normalizeVtt({ fog: { enabled: true, revealAll: false }, tokenPos: { a: { x: 35, y: 35 }, g: { x: 800, y: 400 } } });
    R.stampExplored(vtt, [{ encId: 'a', type: 'pc', curHp: 5 }, { encId: 'g', type: 'monster', curHp: 5 }]);
    t.equal(vtt.fog.exploredCells.length, 113, 'a circle of radius 6 squares around (0,0)');
    t.ok(vtt.fog.exploredCells.indexOf('0,0') >= 0 && vtt.fog.exploredCells.indexOf('6,0') >= 0 && vtt.fog.exploredCells.indexOf('5,5') < 0);
    var off = R.normalizeVtt({ fog: { enabled: false } });
    t.equal(R.stampExplored(off, []), false, 'nothing is stamped with the fog off');
  });

  test('the ruler: 3 × 4 squares reads 25 ft (5.0 sq), rounded to 5 ft steps', function (t) {
    t.equal(R.measureText({ x: 0, y: 0 }, { x: 210, y: 280 }, 70), '25 ft (5.0 sq)');
    t.equal(R.measureText({ x: 0, y: 0 }, { x: 100, y: 0 }, 70), '5 ft (1.4 sq)');
  });

  test('the Battlemap\'s defaults are the old ones', function (t) {
    var d = R.normalizeVtt({});
    t.same([d.tokenSize, d.grid.size, d.grid.opacity, d.fog.radiusSquares, d.fog.opacity, d.fog.monstersUnderFog], [56, 70, 0.35, 6, 0.9, true]);
    t.same(d.camera, { x: 0, y: 0, zoom: 1 });
  });
}());
