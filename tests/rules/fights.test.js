/* Setting up an Explorer fight in the Combat Tracker (7 October 2026):
   tools/explorer/fights.js and data/fights-data.js, the fight steps in
   data/journey-events.js, and the Combat Tracker's side in
   tools/encounter/rules.js (R.loadHandoff and friends). */
(function () {
  var F = TSI.explorer.fights;
  var J = TSI.explorer.journey;
  var R = TSI.explorer.rules;
  var ER = TSI.encounter.rules;
  var D = window.TSI_DATA.explorer;
  var E = window.TSI_DATA.journeyEvents;
  var FD = window.TSI_DATA.fights;

  var REGIONS = Object.keys(E.regions);
  var low = { level: 8, fromBastion: true };
  var high = { level: 12, fromBastion: true };

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function fightSteps() {
    var out = [];
    E.events.forEach(function (ev) {
      Object.keys(ev.steps).forEach(function (k) { if (ev.steps[k].fight) out.push({ ev: ev, step: k, fight: ev.steps[k].fight }); });
    });
    return out;
  }
  function build(enc, region, level, extra) {
    return F.build(FD, Object.assign({
      encounter: enc, region: region || 'northern_province', regionName: 'Somewhere', levelInfo: level || low,
      event: { id: 'x', code: 'X1', title: 'A Test', step: 'fight', day: 3 }, surprised: [], id: 'fight-1', at: '2026-10-07T10:00:00.000Z'
    }, extra || {}));
  }
  function count(groups) { return groups.reduce(function (n, g) { return n + g.count; }, 0); }
  function tracker(roster, library) {
    var s = ER.defaultState();
    s.library = library || [];
    s.encounter.roster = roster || [];
    return s;
  }
  function pc(name, extra) {
    return Object.assign({ encId: 'e-' + name, baseId: 'b-' + name, name: name, type: 'pc', maxHp: 40, curHp: 40, init: 15, avatar: '', refLink: '', conditions: [], defeated: false }, extra || {});
  }

  group('Explorer fights: the data');

  test('every fight in the events names an encounter, and every encounter is used', function (t) {
    var used = {};
    fightSteps().forEach(function (f) {
      t.ok(f.fight.encounter && FD.encounters[f.fight.encounter], f.ev.code + ' ' + f.step + ' names an encounter');
      used[f.fight.encounter] = true;
    });
    Object.keys(FD.encounters).forEach(function (id) { t.ok(used[id], id + ' is used by a fight'); });
  });

  test('every encounter\'s monsters and map exist, for both groups', function (t) {
    Object.keys(FD.encounters).forEach(function (id) {
      var enc = FD.encounters[id];
      t.ok(FD.maps.settings[enc.map], id + ': its map setting exists');
      ['low', 'high'].forEach(function (band) {
        t.ok(enc[band].length > 0, id + ' has a ' + band + ' group');
        enc[band].forEach(function (g) {
          t.ok(FD.monsters[g[0]], id + ': ' + g[0] + ' exists');
          t.ok(Number.isInteger(g[1]) && g[1] >= 1 && g[1] <= 26, id + ': a sensible count of ' + g[0]);
        });
      });
    });
  });

  test('the groups match the events\' suggested enemies', function (t) {
    /* From each fight's suggest line in journey-events.js. */
    var expected = { t2: [11, 14], t13: [11, 13], c6: [13, 15], c9: [3, 3], c10ride: [13, 15], c10camp: [13, 15], c12: [9, 13], f1: [8, 10], t9: [1, 1] };
    Object.keys(expected).forEach(function (id) {
      var enc = FD.encounters[id];
      t.equal(count(F.groups(FD, enc, 'low')), expected[id][0], id + ' levels 7–10');
      t.equal(count(F.groups(FD, enc, 'high')), expected[id][1], id + ' levels 11–16');
    });
    t.same(F.lines(F.groups(FD, FD.encounters.c9, 'high')), ['1 × Debt Collector, a Spy (AC 12, 27 HP)', '2 × Hill Giant (AC 13, 105 HP)'], 'C9: the friends become hill giants');
    t.same(F.lines(F.groups(FD, FD.encounters.t2, 'low')), ['1 × Bandit Captain (AC 15, 65 HP)', '2 × Veteran (AC 17, 58 HP)', '8 × Bandit (AC 12, 11 HP)']);
  });

  test('the SRD numbers', function (t) {
    var M = FD.monsters;
    t.same([M.bandit.ac, M.bandit.hp, M.bandit.init], [12, 11, 1]);
    t.same([M.bandit_captain.ac, M.bandit_captain.hp, M.bandit_captain.init], [15, 65, 3]);
    t.same([M.thug.ac, M.thug.hp, M.thug.init], [11, 32, 0]);
    t.same([M.veteran.ac, M.veteran.hp, M.veteran.init], [17, 58, 1]);
    t.same([M.gladiator.ac, M.gladiator.hp, M.gladiator.init], [16, 112, 2]);
    t.same([M.berserker.ac, M.berserker.hp, M.berserker.init], [13, 67, 1]);
    t.same([M.wolf.ac, M.wolf.hp, M.wolf.init], [13, 11, 2]);
    t.same([M.dire_wolf.ac, M.dire_wolf.hp, M.dire_wolf.init], [14, 37, 2]);
    t.same([M.winter_wolf.ac, M.winter_wolf.hp, M.winter_wolf.init], [13, 75, 1]);
    t.same([M.spy.ac, M.spy.hp, M.spy.init], [12, 27, 2]);
    t.same([M.ogre.ac, M.ogre.hp, M.ogre.init], [11, 59, -1]);
    t.same([M.hill_giant.ac, M.hill_giant.hp, M.hill_giant.init], [13, 105, -1]);
    t.same([M.rootbound_husk.hp, M.rootbound_husk.ac], [35, null], 'the Husk: 35 HP, as in the Heartwood Ritual');
  });

  test('every map\'s start corners are on its grid, and the regional maps cover every region', function (t) {
    Object.keys(FD.maps.settings).forEach(function (id) {
      var s = FD.maps.settings[id];
      var corners = s.party.concat(s.foes, s.avoid || []);
      Object.keys(FD.encounters).forEach(function (eid) { if (FD.encounters[eid].map === id && FD.encounters[eid].foes) corners = corners.concat(FD.encounters[eid].foes); });
      corners.forEach(function (p) { t.ok(p[0] >= 1 && p[0] < s.cols && p[1] >= 1 && p[1] < s.rows, id + ': ' + p + ' is inside the grid'); });
    });
    t.same(Object.keys(FD.maps.regions).sort(), REGIONS.slice().sort(), 'a picture name for every region');
  });

  test('every battle map picture is there, 1800 × 1200 (30 × 20 squares of 60 pixels)', function (t) {
    var files = {};
    Object.keys(FD.maps.settings).forEach(function (id) {
      REGIONS.forEach(function (region) { files[F.mapFor(FD, id, region).src] = FD.maps.settings[id]; });
    });
    var list = Object.keys(files);
    t.equal(list.length, 3 * 7 + 2, 'ford, road and camp for each of 7 regions, plus the cove and the rocks');
    return Promise.all(list.map(function (src) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve({ src: src, w: img.naturalWidth, h: img.naturalHeight }); };
        img.onerror = function () { resolve({ src: src, w: 0, h: 0 }); };
        img.src = '../' + src;
      });
    })).then(function (sizes) {
      sizes.forEach(function (sz) {
        var s = files[sz.src];
        t.same([sz.w, sz.h], [1800, 1200], sz.src);
        t.equal(sz.w / s.cols, sz.h / s.rows, sz.src + ': square grid squares');
      });
    });
  });

  group('Explorer fights: building the hand-off');

  test('the party level: the Bastion\'s, else 7; the group: 7–10 or 11–16', function (t) {
    t.same(F.partyLevel({ partyLevel: 12 }, FD), { level: 12, fromBastion: true });
    t.same(F.partyLevel(null, FD), { level: 7, fromBastion: false });
    t.same(F.partyLevel({}, FD), { level: 7, fromBastion: false });
    t.same(F.partyLevel({ partyLevel: 25 }, FD), { level: 20, fromBastion: true });
    t.same([3, 7, 10, 11, 16, 20].map(function (n) { return F.band(FD, n).id; }), ['low', 'low', 'low', 'high', 'high', 'high']);
  });

  test('a regional map has a picture per region; the cove and the rocks have one', function (t) {
    t.equal(F.mapFor(FD, 'ford', 'southern_province').src, 'tools/encounter/assets/battlemaps/ford-southern.jpg');
    t.equal(F.mapFor(FD, 'camp', 'the_north_isle').src, 'tools/encounter/assets/battlemaps/camp-north-isle.jpg');
    t.equal(F.mapFor(FD, 'road', 'the_east_isle').src, 'tools/encounter/assets/battlemaps/road-east-isle.jpg');
    t.equal(F.mapFor(FD, 'cove', 'northern_province').src, 'tools/encounter/assets/battlemaps/cove-western.jpg');
    t.equal(F.mapFor(FD, 'ford', 'nowhere').src, 'tools/encounter/assets/battlemaps/ford-northern.jpg', 'an unknown region gets the first');
    t.equal(F.mapFor(FD, 'nothing', 'northern_province'), null);
  });

  test('the hand-off: the event, the level and group, the monsters, the map and its start places', function (t) {
    var h = build('c6', 'northern_province', high, { surprised: ['Kaelen'] });
    t.equal(h.v, 1);
    t.equal(h.id, 'fight-1');
    t.equal(h.name, 'X1 A Test');
    t.same([h.level, h.fromBastion, h.band.id], [12, true, 'high']);
    t.same(h.monsters.map(function (m) { return [m.name, m.count]; }), [['Old Wolf', 1], ['Winter Wolf', 2], ['Wolf', 12]]);
    t.equal(h.monsters[0].stat, 'Dire Wolf');
    t.equal(h.map.src, 'tools/encounter/assets/battlemaps/camp-northern.jpg');
    t.same(h.map.foes, FD.encounters.c6.foes, 'C6: the pack circles the camp');
    t.same(h.map.avoid, FD.maps.settings.camp.avoid, 'no one starts in the fire');
    t.same(h.surprised, ['Kaelen']);
    t.equal(build('nothing'), null);
  });

  test('every fight, in every region and both groups, is one the Combat Tracker accepts', function (t) {
    Object.keys(FD.encounters).forEach(function (id) {
      REGIONS.forEach(function (region) {
        [low, high].forEach(function (lv) {
          t.equal(ER.handoffProblem(build(id, region, lv, { surprised: ['Elara'] })), null, id + ' in ' + region + ' at level ' + lv.level);
        });
      });
    });
  });

  group('Explorer fights: the event window');

  function atFight(id, path) {
    var s = R.defaultState(D);
    var ev = J.def(E, id);
    J.begin(s, E, { kind: ev.kind, event: ev }, J.context(s, E), dice([0.5]));
    path.forEach(function (a) { J.act(s, E, Object.assign({ step: s.journey.current.step }, a), dice([0.5])); });
    return s;
  }

  test('T2 sprung: the heroes who failed Perception are surprised; turned round, nobody is', function (t) {
    var s = atFight('t2', [{ type: 'check', result: 'failure' }, { type: 'each', failed: ['kaelen', 'elara'] }]);
    var v = J.view(s, E, null);
    t.equal(v.type, 'fight');
    t.equal(v.fight.encounter, 't2');
    t.same(v.fight.surprised, ['Kaelen', 'Elara']);
    var s2 = atFight('t2', [{ type: 'check', result: 'success', hero: 'kaelen' }, { type: 'choose', index: 0 }, { type: 'check', result: 'failure' }]);
    var v2 = J.view(s2, E, null);
    t.equal(v2.step, 'heard');
    t.same(v2.fight.surprised, [], '"nobody is surprised"');
  });

  test('the hand-off\'s id is kept with the event (and saved), and dropped when Won or Fled is clicked', function (t) {
    var s = atFight('c9', [{ type: 'check', result: 'failure' }, { type: 'choose', index: 2 }, { type: 'check', result: 'failure', hero: 'magnus' }]);
    t.equal(s.journey.current.step, 'brawl');
    t.equal(J.view(s, E, null).fight.sentId, null);
    t.ok(J.markFight(s, E, 'fight-abc'));
    t.equal(J.view(s, E, null).fight.sentId, 'fight-abc');
    var again = J.clean(JSON.parse(JSON.stringify(s.journey)), E);
    t.equal(again.current.vars.fightId, 'fight-abc', 'kept through saving');
    t.ok(J.act(s, E, { type: 'fight', step: 'brawl', result: 'won' }, dice([0.5])));
    t.equal(s.journey.current.step, 'beaten');
    t.equal(s.journey.current.vars.fightId, undefined, 'gone once the fight is answered');
  });

  test('only a fight step can be sent', function (t) {
    var s = atFight('c9', []);
    t.equal(J.markFight(s, E, 'fight-x'), false, 'the first step is a check');
    t.equal(s.journey.current.vars.fightId, undefined);
    t.equal(J.markFight(R.defaultState(D), E, 'fight-x'), false, 'no event');
  });

  group('Combat Tracker: a fight from the Explorer');

  test('a broken or strange hand-off is refused', function (t) {
    var good = build('t2');
    t.equal(ER.handoffProblem(good), null);
    function bad(change) { var h = JSON.parse(JSON.stringify(good)); change(h); return ER.handoffProblem(h); }
    t.ok(ER.handoffProblem(null));
    t.ok(ER.handoffProblem({}));
    t.ok(bad(function (h) { h.v = 2; }));
    t.ok(bad(function (h) { h.monsters = []; }));
    t.ok(bad(function (h) { h.monsters[0].count = 0; }));
    t.ok(bad(function (h) { h.monsters[0].count = 27; }));
    t.ok(bad(function (h) { h.monsters[0].hp = 'lots'; }));
    t.ok(bad(function (h) { h.monsters[0].name = ' '; }));
    t.ok(bad(function (h) { h.map.src = 'https://example.com/map.jpg'; }), 'never a web address');
    t.ok(bad(function (h) { h.map.src = 'tools/encounter/assets/battlemaps/../../../secret.jpg'; }));
    t.ok(bad(function (h) { h.map.cols = 0; }));
    t.ok(bad(function (h) { h.map.foes = []; }));
    t.ok(bad(function (h) { h.map.party = [[1.5, 2]]; }));
    t.ok(bad(function (h) { h.surprised = 'Kaelen'; }));
  });

  test('loading: the monsters replace the old ones, the PCs and NPCs stay, initiative is cleared', function (t) {
    var s = tracker([pc('Kaelen'), pc('Elara'), { encId: 'n', baseId: 'bn', name: 'Old Hask', type: 'npc', maxHp: 10, curHp: 10, init: 4, conditions: [], defeated: false }, { encId: 'g', baseId: 'bg', name: 'Goblin', type: 'monster', maxHp: 7, curHp: 7, init: 9, conditions: [], defeated: false }]);
    s.encounter.status = 'running';
    s.encounter.round = 4;
    var res = ER.loadHandoff(s, build('t2'));
    var e = s.encounter;
    t.same([res.monsters, res.pcsAdded], [11, 0]);
    t.equal(e.roster.filter(function (c) { return c.name === 'Goblin'; }).length, 0, 'the goblin has gone');
    t.same(e.roster.slice(0, 3).map(function (c) { return c.name; }), ['Kaelen', 'Elara', 'Old Hask']);
    t.ok(e.roster.every(function (c) { return c.init === null; }), 'initiative cleared');
    t.same([e.status, e.round, e.turnIndex, e.name, e.handoff, e.reported], ['ready', 1, 0, 'X1 A Test', 'fight-1', false]);
    t.same(e.roster.filter(function (c) { return c.type === 'monster'; }).map(function (c) { return c.name; }),
      ['Bandit Captain', 'Veteran', 'Veteran a', 'Bandit', 'Bandit a', 'Bandit b', 'Bandit c', 'Bandit d', 'Bandit e', 'Bandit f', 'Bandit g']);
    t.ok(e.roster.filter(function (c) { return c.type === 'monster'; }).every(function (c) { return c.handoff === 'fight-1' && c.curHp === c.maxHp; }));
  });

  test('the monsters join the library once, with their initiative bonus and stat-block link', function (t) {
    var s = tracker([pc('Kaelen')]);
    ER.loadHandoff(s, build('t2'));
    ER.loadHandoff(s, build('t2', null, low, { id: 'fight-2' }));
    var bandits = s.library.filter(function (x) { return x.name === 'Bandit'; });
    t.equal(bandits.length, 1, 'not added twice');
    t.same([bandits[0].type, bandits[0].maxHp, bandits[0].initBonus], ['monster', 11, 1]);
    t.equal(bandits[0].refLink, FD.monsters.bandit.link);
    t.equal(s.encounter.roster.filter(function (c) { return c.type === 'monster'; }).length, 11, 'the second load replaced the first');
    s.library.push({ id: 'mine', name: 'Veteran', type: 'monster', maxHp: 58, curHp: 58, initBonus: 5, avatar: 'my.png', refLink: 'mine' });
    var s2 = tracker([pc('Kaelen')], [s.library[s.library.length - 1]]);
    ER.loadHandoff(s2, build('t2'));
    t.same([s2.library[0].initBonus, s2.library[0].refLink], [5, 'mine'], 'your own Veteran keeps your changes');
  });

  test('Auto-roll Initiative uses the stat block\'s bonus', function (t) {
    var s = tracker([pc('Kaelen')]);
    ER.loadHandoff(s, build('c9', null, high));
    var real = Math.random;
    Math.random = function () { return 0.5; };   /* every d20 is an 11 */
    try { ER.autoInit(s); } finally { Math.random = real; }
    var init = {};
    s.encounter.roster.forEach(function (c) { init[c.name] = c.init; });
    t.same([init['Debt Collector'], init['Hill Giant'], init['Hill Giant a']], [13, 10, 10]);
  });

  test('with no PCs in the encounter, the library\'s PCs join', function (t) {
    var lib = [{ id: 'k', name: 'Kaelen', type: 'pc', maxHp: 50, curHp: 50, initBonus: 3 }, { id: 'u', name: 'Umbrys', type: 'pc', maxHp: 44, curHp: 44, initBonus: 1 }, { id: 'o', name: 'Orc', type: 'monster', maxHp: 15, curHp: 15 }];
    var s = tracker([], lib);
    var res = ER.loadHandoff(s, build('f1'));
    t.equal(res.pcsAdded, 2);
    t.same(s.encounter.roster.filter(function (c) { return c.type === 'pc'; }).map(function (c) { return c.name; }), ['Kaelen', 'Umbrys']);
    t.same(s.encounter.roster.filter(function (c) { return c.type === 'monster'; }).map(function (c) { return c.name; }).slice(0, 3), ['Toll-man', 'Toll-man a', 'Bandit']);
  });

  test('the surprised heroes are marked Surprised for their first turn', function (t) {
    var s = tracker([pc('Kaelen Ashford'), pc('Elara', { conditions: [{ name: 'Surprised', remaining: 3 }, { name: 'Blessed', remaining: 2 }] }), pc('Magnus')]);
    var res = ER.loadHandoff(s, build('t2', null, low, { surprised: ['Kaelen', 'elara', 'Charles'] }));
    t.same(res.surprised, ['Kaelen Ashford', 'Elara']);
    t.same(res.notFound, ['Charles'], 'no PC called Charles');
    var byName = {};
    s.encounter.roster.forEach(function (c) { byName[c.name] = c; });
    t.same(byName['Kaelen Ashford'].conditions, [{ name: 'Surprised', remaining: 1 }]);
    t.same(byName.Elara.conditions, [{ name: 'Blessed', remaining: 2 }, { name: 'Surprised', remaining: 1 }], 'not twice');
    t.same(byName.Magnus.conditions, []);
    var again = tracker([pc('Magnus', { conditions: [{ name: 'Surprised', remaining: 1 }, 'Prone'] })]);
    ER.loadHandoff(again, build('f1'));
    t.same(again.encounter.roster[0].conditions, ['Prone'], 'a Surprised left from the last fight goes');
    ER.tickDown(byName.Elara);
    t.same(byName.Elara.conditions, [{ name: 'Blessed', remaining: 1 }], 'gone after their first turn');
    t.ok(ER.nameMatches('KAELEN', 'kaelen') && !ER.nameMatches('Kaelenna', 'Kaelen') && !ER.nameMatches('', 'Kaelen'));
  });

  test('the report: when every monster is down, once', function (t) {
    var s = tracker([pc('Kaelen')]);
    ER.loadHandoff(s, build('c9'));
    var e = s.encounter;
    var monsters = e.roster.filter(function (c) { return c.type === 'monster'; });
    t.equal(ER.handoffWon(e), false);
    monsters[0].curHp = 0;
    monsters[1].defeated = true;
    t.equal(ER.handoffWon(e), false, 'one still standing');
    monsters[2].curHp = 0;
    t.equal(ER.handoffWon(e), true);
    var extra = { encId: 'x', baseId: 'bx', name: 'Wolf', type: 'monster', maxHp: 11, curHp: 11, conditions: [], defeated: false };
    e.roster.push(extra);
    t.equal(ER.handoffWon(e), false, 'a monster you added yourself counts too');
    extra.curHp = 0;
    e.reported = true;
    t.equal(ER.handoffWon(e), false, 'reported once');
    e.reported = false;
    e.handoff = null;
    t.equal(ER.handoffWon(e), false, 'not an Explorer fight');
  });

  test('a completed turn that drops the last monster: the fight ends and is won', function (t) {
    var s = tracker([pc('Kaelen')]);
    ER.loadHandoff(s, build('t9'));
    ER.begin(s);
    var husk = s.encounter.roster.filter(function (c) { return c.type === 'monster'; })[0];
    var res = ER.completeTurn(s, { targetId: husk.encId, damage: '35', condition: '', turns: '' });
    t.ok(res.ok && res.ended);
    t.equal(ER.handoffWon(s.encounter), true);
  });

  test('the Explorer fight is kept through saving, and forgotten when a saved encounter is loaded', function (t) {
    var s = tracker([pc('Kaelen')]);
    ER.loadHandoff(s, build('t2'));
    var back = ER.fromSave(JSON.parse(JSON.stringify(ER.toSave(s))));
    t.same([back.encounter.handoff, back.encounter.reported], ['fight-1', false]);
    t.equal(back.encounter.roster[1].handoff, 'fight-1');
    t.ok(ER.isTrackerSave(ER.toSave(s)));
    ER.loadSaved(back, { name: 'Old fight', roster: [{ name: 'Orc', type: 'monster', maxHp: 15 }] });
    t.same([back.encounter.handoff, back.encounter.reported], [null, false]);
    t.same([ER.fromSave({}).encounter.handoff, ER.fromSave({ encounter: { handoff: 5 } }).encounter.handoff], [null, null]);
  });

  test('start places: one token per grid corner, two squares apart, round the right corners, never in the fire', function (t) {
    var s = tracker([pc('Kaelen'), pc('Elara'), pc('Magnus')]);
    var h = build('c10camp', 'western_province', high);
    ER.loadHandoff(s, h);
    var pos = ER.startPositions(s.encounter.roster, h.map);
    var size = 1600 / 30;
    var seen = {};
    s.encounter.roster.forEach(function (c) {
      var p = pos[c.encId];
      t.ok(p, c.name + ' has a place');
      var col = p.x / size;
      var row = p.y / size;
      t.ok(Math.abs(col - Math.round(col)) < 1e-9 && Math.abs(row - Math.round(row)) < 1e-9, c.name + ' is on a grid corner');
      t.ok(col >= 1 && col <= 29 && row >= 1 && row <= 19, c.name + ' is on the map');
      var key = Math.round(col) + ',' + Math.round(row);
      t.ok(!seen[key], c.name + ' has a corner of its own');
      Object.keys(seen).forEach(function (k) {
        var q = k.split(',').map(Number);
        t.ok(Math.max(Math.abs(q[0] - Math.round(col)), Math.abs(q[1] - Math.round(row))) >= 2, c.name + ' starts two squares from everyone else');
      });
      seen[key] = true;
      t.ok(['15,10', '16,10', '15,11', '16,11'].indexOf(key) === -1, c.name + ' isn\'t in the fire');
      if (c.type === 'pc') t.ok(Math.hypot(col - 15, row - 13) <= 2, c.name + ' starts by the party corner');
    });
    var chief = s.encounter.roster.filter(function (c) { return c.name === 'Raider Chief'; })[0];
    t.same([pos[chief.encId].x / size, pos[chief.encId].y / size], [4, 8], 'the leader takes the first foes corner');
  });

  test('the Battlemap: the grid matched to the map, Snap on, tokens a square wide, the fog\'s explored squares cleared', function (t) {
    var s = tracker([pc('Kaelen')]);
    var h = build('t13', 'western_province');
    ER.loadHandoff(s, h);
    var vtt = ER.normalizeVtt({ grid: { show: false, snap: false, size: 70, offX: 12, offY: 4, opacity: 0.5 }, fog: { enabled: true, revealAll: false, exploredCells: ['1,1'] }, removed: { old: true }, camera: { x: 40, y: 10, zoom: 2 } });
    var patch = ER.handoffVtt(vtt, s.encounter.roster, h.map);
    t.same([patch.grid.show, patch.grid.snap, patch.grid.size, patch.grid.offX, patch.grid.offY, patch.grid.opacity], [true, true, 1600 / 30, 0, 0, 0.5]);
    t.equal(patch.tokenSize, 53);
    t.same(patch.camera, { x: 0, y: 0, zoom: 1 });
    t.same([patch.fog.enabled, patch.fog.revealAll, patch.fog.exploredCells], [true, false, []], 'fog stays as you set it');
    t.same([patch.removed, patch.hidden], [{}, {}]);
    t.equal(Object.keys(patch.tokenPos).length, s.encounter.roster.length);
    t.ok(ER.isVttSave(Object.assign({}, vtt, patch)), 'a Battlemap save the tracker accepts');
  });

  test('the saved map can be one of the suite\'s battle maps, never anything else by path', function (t) {
    t.ok(ER.isMapSave('tools/encounter/assets/battlemaps/ford-northern.jpg'));
    t.ok(ER.isMapSave(''));
    t.ok(ER.isMapSave('data:image/png;base64,AAAA'));
    t.ok(!ER.isMapSave('tools/encounter/assets/battlemaps/../x.jpg'));
    t.ok(!ER.isMapSave('https://example.com/a.jpg'));
    t.ok(!ER.isMapSave('tools/explorer/assets/maps/midland_province.jpg'));
    t.equal(ER.importProblem([{ key: 'tsi.encounter.mapImage', value: 'tools/encounter/assets/battlemaps/camp-midland.jpg' }]), null, 'an export with a suite map imports');
  });
}());
