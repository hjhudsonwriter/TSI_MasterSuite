/* Arenas of The Scarlett Isles: tools/arenas/data/arenas-data.js and rules.js */
(function () {
  var LIST = window.TSI_DATA.arenas.arenas;
  var M = window.TSI_DATA.arenaMedia;
  var R = TSI.arenas.rules;

  /* Run fn with Math.random giving these values in turn, then put it back. */
  function withDice(list, fn) {
    var real = Math.random;
    var i = 0;
    Math.random = function () { var v = list[i % list.length]; i++; return v; };
    try { return fn(); } finally { Math.random = real; }
  }
  /* A d-n face as a Math.random value (face 1..n). */
  function face(n, sides) { return (n - 1 + 0.5) / sides; }

  function state(arenaId, roundId) {
    return {
      arenaId: arenaId, roundId: roundId, players: [], totalGold: 0,
      runActive: true, roundOver: false, turn: 0, turnIndex: 0, successes: 0, failures: 0, enemies: [],
      r1FirstDefeated: null,
      r4Dead: { boar: false, hyena1: false, hyena2: false },
      mmR2Dead: { swordsman1: false, swordsman2: false },
      mmR2TotemsDown: 0, mmR3MarkPlayerId: null, mmR3LastMarkedId: null
    };
  }
  function start(arenaId, roundId, players) {
    var S = state(arenaId, roundId);
    S.players = (players || []).map(function (p, i) { return { id: 'p' + i, name: p[0], tag: '', maxHp: p[1], hp: p[2] != null ? p[2] : p[1], image: '' }; });
    S.enemies = R.spawnEnemies(R.round(S, LIST));
    return S;
  }
  var SWYTH = 'swyth_salt_ring_trials';
  var MM = 'middlemount_lions_crown';
  function name(src) { return src ? String(src).split('/').pop() : ''; }

  group('Arenas: content');

  test('two arenas and six rounds, with their prizes, as before', function (t) {
    t.same(LIST.map(function (a) { return a.name; }), ['Swyth: The Salt-Ring Trials', 'Middlemount: The Lion’s Crown']);
    t.same(LIST.map(function (a) { return a.rounds.map(function (r) { return r.id + ' ' + r.reward_gp; }); }),
      [['r1 500', 'r4 5000', 'r5 50000'], ['mm_r1 1000', 'mm_r2 8000', 'mm_r3 25000']]);
    t.same(LIST[0].rounds[1].skill_challenge.dcs, { easy: 16, standard: 17, hard: 19 });
    t.same(LIST[1].rounds[2].attack, { hit_dc: 16, default_damage: '3d10' });
  });

  test('every picture and sound the rounds use is listed in the media file', function (t) {
    var paths = [];
    LIST.forEach(function (a) {
      a.rounds.forEach(function (r) {
        var s = r.scene || {};
        paths.push(s.base, s.overlay_boss);
        if (s.secondary_overlay_boss) paths.push(s.secondary_overlay_boss);
      });
    });
    t.ok(paths.every(function (p) { return /^assets\/.+\.png$/.test(p); }), 'every scene picture is under assets/');
    t.equal(M.lionsMarkIcon, 'assets/overlays/lions_mark_icon.png');
    t.same([M.volumes.crowd_loop, M.volumes.round, M.volumes.crowd, M.volumes.horn], [0.35, 0.9, 0.75, 0.95]);
    t.same([M.overlayMs, M.announceMs, M.pulseMs], [5200, 5000, 5000]);
  });

  test('the opponents for each round, numbered where there are several', function (t) {
    t.same(start(SWYTH, 'r1').enemies.map(function (e) { return e.name + ' ' + e.hp + ' ' + e._slot; }), ['Arena Duelist 1 45 1', 'Arena Duelist 2 45 2']);
    t.same(start(SWYTH, 'r4').enemies.map(function (e) { return e.name + ' ' + e.hp; }), ['Razor-Boar 95', 'Hooked Hyena 1 55', 'Hooked Hyena 2 55']);
    t.same(start(MM, 'mm_r2').enemies.map(function (e) { return e.defId; }), ['lion_totem', 'lion_totem', 'lion_totem', 'lion_swordsman', 'lion_swordsman']);
  });

  test('Next round follows the list, and the last round has none', function (t) {
    var S = state(SWYTH, 'r1');
    t.equal(R.nextRoundId(S, LIST), 'r4');
    S.roundId = 'r5';
    t.equal(R.nextRoundId(S, LIST), null);
  });

  group('Arenas: dice and damage');

  test('dice roll each die in turn; 2d8 with faces 3 and 7 is 10', function (t) {
    var r = withDice([face(3, 8), face(7, 8)], function () { return R.rollDice('2d8'); });
    t.same([r.total, r.rolls, r.expr], [10, [3, 7], '2d8']);
    t.equal(withDice([face(20, 20)], R.d20), 20);
    t.equal(withDice([face(1, 20)], R.d20), 1);
  });

  test('the Damage box: dice are rolled, "12" is 12, and "2d8+3" reads as 2, as before (A7)', function (t) {
    t.equal(withDice([face(4, 8)], function () { return R.parseDamage('2d8'); }), 8);
    t.equal(R.parseDamage('12'), 12);
    t.equal(R.parseDamage('2d8+3'), 2);
    t.equal(R.parseDamage('lots'), 0);
  });

  group('Arenas: pictures over the arena');

  test('Arena Duelists: the fallen duelist is shown, and hits and failures show the one left', function (t) {
    var S = start(SWYTH, 'r1', [['Runa', 60]]);
    var r = R.round(S, LIST);
    t.equal(name(R.persistentBoss(S, r)), 'arena_duelists_standard.png');
    t.equal(name(R.hitOverlay(S, r)), 'arena_duelists_hit.png');
    t.equal(R.failOverlay(S, r), undefined, 'no failure picture before a duelist falls (ARN-16: kept)');
    S.enemies[1].hp = 0;
    t.equal(name(R.persistentBoss(S, r)), 'arena_duelists_defeated_2.png');
    t.equal(S.r1FirstDefeated, 2);
    t.equal(name(R.hitOverlay(S, r)), 'arena_duelists_hit_1.png');
    t.equal(name(R.failOverlay(S, r)), 'arena_duelists_fail_1.png');
  });

  test('the Beast-Pen picture follows which beasts are down', function (t) {
    var S = start(SWYTH, 'r4', [['Runa', 60]]);
    var r = R.round(S, LIST);
    t.equal(name(R.persistentBoss(S, r)), 'beast_pen_standard.png');
    S.enemies[2].hp = 0; /* Hyena 2 */
    t.equal(name(R.persistentBoss(S, r)), 'beast_pen_standard_hyena_2_dead.png');
    t.equal(name(R.hitOverlay(S, r)), 'beast_pen_hit_hyena_dead.png');
    S.enemies[0].hp = 0; /* the boar */
    t.equal(name(R.persistentBoss(S, r)), 'beast_pen_standard_boar_hyena_dead.png');
    t.equal(name(R.hitOverlay(S, r)), 'beast_pen_hit_boar_hyena_dead.png');
  });

  test('a Beast-Pen failure picks a living beast at random to attack', function (t) {
    var S = start(SWYTH, 'r4', [['Runa', 60]]);
    var r = R.round(S, LIST);
    t.equal(name(withDice([0.1], function () { return R.failOverlay(S, r); })), 'beast_pen_boar_fail_standard.png');
    t.equal(name(withDice([0.9], function () { return R.failOverlay(S, r); })), 'beast_pen_hyena_fail_standard.png');
    S.enemies[1].hp = 0;
    t.equal(name(withDice([0.1], function () { return R.failOverlay(S, r); })), 'beast_pen_boar_fail_hyena_1_dead.png');
    t.equal(name(withDice([0.9], function () { return R.failOverlay(S, r); })), 'beast_pen_hyena_fail_hyena_dead.png');
  });

  test('Lion Totems: swordsmen on top, totems behind, each counting their fallen', function (t) {
    var S = start(MM, 'mm_r2', [['Runa', 60]]);
    var r = R.round(S, LIST);
    t.equal(name(R.persistentBoss(S, r)), 'lion_swordsman_standard.png');
    t.equal(name(R.persistentSecondary(S, r)), 'lions_totems_standard.png');
    S.enemies[0].hp = 0;
    S.enemies[1].hp = 0;
    t.equal(name(R.persistentSecondary(S, r)), 'lions_totems_standard_2_dead.png');
    S.enemies[4].hp = 0; /* Swordsman 2 */
    t.equal(name(R.persistentBoss(S, r)), 'lion_swordsman_2_dead.png');
    t.equal(name(R.mmR2Temp('hit', S.enemies[0])), 'lions_totems_hit.png');
    t.equal(name(R.mmR2Temp('fail', S.enemies[3])), 'lion_swordsman_fail.png');
  });

  test('nothing stands over the arena when no round is running', function (t) {
    var S = start(SWYTH, 'r5', [['Runa', 60]]);
    S.runActive = false;
    t.equal(R.persistentBoss(S, R.round(S, LIST)), '');
  });

  group('Arenas: sounds');

  test('a hit or failure plays the round\'s sound and the crowd, at the old volumes', function (t) {
    t.same(R.sounds('hit', 'r1').map(function (s) { return name(s[0]) + ' ' + s[1]; }), ['arena_duelist_hit.mp3 0.9', 'crowd_hit.mp3 0.75']);
    t.same(R.sounds('fail', 'r5').map(function (s) { return name(s[0]); }), ['wyvern_fail.mp3', 'crowd_fail.mp3']);
    t.same(R.sounds('hit', 'mm_r2', { defId: 'lion_totem' }).map(function (s) { return name(s[0]); })[0], name(M.sfx.mm_r2_hit));
    t.same(R.sounds('hit', 'mm_r2', { defId: 'lion_swordsman' }).map(function (s) { return name(s[0]); })[0], 'arena_duelist_hit.mp3');
    t.equal(R.sounds('fail', 'mm_r1').length, 1, 'Middlemount\'s Opening Bout has only the crowd, as before');
    t.ok(R.sounds('hit', 'mm_r3').length >= 2, 'the Lion\'s Mark round plays its stack of sounds and the crowd');
  });

  group('Arenas: a turn');

  test('a Hard Animal Handling success in the Beast-Pen counts double, once per player', function (t) {
    var r = R.round(state(SWYTH, 'r4'), LIST);
    var p = { id: 'p0' };
    t.equal(R.successesFor(r, p, 'animal_handling', 'hard'), 2);
    t.equal(R.successesFor(r, p, 'animal_handling', 'standard'), 1);
    p._beastBonusUsed = true;
    t.equal(R.successesFor(r, p, 'animal_handling', 'hard'), 1);
    t.equal(R.successesFor(R.round(state(SWYTH, 'r1'), LIST), { id: 'x' }, 'animal_handling', 'hard'), 1);
  });

  test('a failed check counts a failure and deals the round\'s failure damage', function (t) {
    var S = start(SWYTH, 'r1', [['Runa', 60]]);
    var r = R.round(S, LIST);
    var f = withDice([face(2, 6), face(5, 6), 0.1], function () { return R.applyFailure(S, r, S.players[0]); });
    t.equal(S.failures, 1);
    t.equal(S.players[0].hp, 53);
    t.equal(f.log, 'Runa failed: -7 HP (2d6: 2, 5).');
    t.same([name(f.overlay.src), f.overlay.layer], ['arena_duelists_fail.png', 'primary']);
  });

  test('HP never drops below 0', function (t) {
    var S = start(SWYTH, 'r5', [['Runa', 60, 5]]);
    withDice([0.99], function () { R.applyFailure(S, R.round(S, LIST), S.players[0]); });
    t.equal(S.players[0].hp, 0);
  });

  test('the Lion\'s Mark: a different player each time if possible, and failures strike the marked one', function (t) {
    var S = start(MM, 'mm_r3', [['Runa', 60], ['Borin', 60]]);
    var r = R.round(S, LIST);
    var first = withDice([0.1], function () { return R.pickMark(S); });
    t.equal(first.name, 'Runa');
    var second = withDice([0.1], function () { return R.pickMark(S); });
    t.equal(second.name, 'Borin', 'not the same player twice running');
    var f = withDice([face(1, 6)], function () { return R.applyFailure(S, r, S.players[0]); });
    t.equal(f.victim.name, 'Borin');
    t.equal(S.players[1].hp, 54);
    t.ok(f.pulse, 'the Mark pulses when the marked player is hurt');
    t.equal(f.log, 'Runa failed: the Lion Knight strikes Borin for -6 HP (6d6: 1, 1, 1, 1, 1, 1).');
  });

  test('overtime: after the tempo limit, the round\'s extra failures and damage to a random player (A9: kept)', function (t) {
    var S = start(SWYTH, 'r5', [['Runa', 60], ['Borin', 60]]);
    var r = R.round(S, LIST);
    S.turn = 8;
    t.same(R.overtime(S, r), [], 'nothing at the limit itself');
    S.turn = 9;
    var logs = withDice([0.9, face(4, 8), face(4, 8)], function () { return R.overtime(S, r); });
    t.equal(S.failures, 1);
    t.equal(S.players[1].hp, 52);
    t.same(logs, ['OVERTIME: crowd turns. +1 failure(s).', 'OVERTIME: Borin is battered by the tempo: -8 HP (2d8).']);
  });

  test('after a turn: all opponents down comes first, then the win, then the ways to lose (A2: kept)', function (t) {
    var S = start(SWYTH, 'r1', [['Runa', 60]]);
    var r = R.round(S, LIST);
    t.equal(R.outcome(S, r), 'continue');
    S.successes = 6;
    t.equal(R.outcome(S, r), 'win');
    S.successes = 0;
    S.failures = 3;
    t.equal(R.outcome(S, r), 'loss');
    S.enemies.forEach(function (e) { e.hp = 0; });
    t.equal(R.outcome(S, r), 'allDown', 'the last opponent falling beats a loss on the same turn');
  });

  test('the Lion\'s Mark round is lost when two players are down (A3: kept)', function (t) {
    var S = start(MM, 'mm_r3', [['Runa', 60], ['Borin', 60, 0], ['Cael', 60, 0]]);
    t.equal(R.outcome(S, R.round(S, LIST)), 'loss');
    var S2 = start(MM, 'mm_r2', [['Runa', 60], ['Borin', 60, 0], ['Cael', 60, 0]]);
    t.equal(R.outcome(S2, R.round(S2, LIST)), 'continue');
  });

  group('Arenas: saved data');

  test('a save needs a party list and a gold total', function (t) {
    t.ok(R.isSave({ players: [{ id: 'p_1', name: 'Runa', tag: '', maxHp: 60, hp: 42, image: 'data:image/webp;base64,AAAA' }], totalGold: 500, arenaId: SWYTH, roundId: 'r1' }));
    t.ok(R.isSave({ players: [], totalGold: 0 }));
    t.ok(!R.isSave({ players: 'Runa', totalGold: 0 }));
    t.ok(!R.isSave({ players: [], totalGold: 'lots' }));
    t.ok(!R.isSave({ players: [{ name: 'Runa' }], totalGold: 0 }));
    t.ok(!R.isSave([]));
  });

  test('importing refuses a file whose party isn\'t in the right form', function (t) {
    t.equal(R.importProblem([{ key: 'tsi.arenas.state', value: { players: [], totalGold: 0 } }]), null);
    t.ok(/wasn't imported/.test(R.importProblem([{ key: 'tsi.arenas.state', value: { players: {}, totalGold: 0 } }])));
  });
}());
