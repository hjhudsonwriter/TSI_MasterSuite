/* Scarlett Isles Explorer: Harry's new travel and campfire events
   (tools/explorer/journey.js and data/journey-events.js, 6 October 2026). */
(function () {
  var R = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var D = window.TSI_DATA.explorer;
  var E = window.TSI_DATA.journeyEvents;

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function fresh(region, mapId) {
    var s = R.defaultState(D);
    if (region) s.travel.provinceId = region;
    if (mapId) s.mapPresetId = mapId;
    return s;
  }
  function ctx(s) { return J.context(s, E); }
  function begin(s, id, kind, rand) {
    var ev = J.def(E, id);
    return J.begin(s, E, { kind: kind || ev.kind, event: ev }, ctx(s), rand || dice([0.5]));
  }
  function act(s, action, rand) {
    return J.act(s, E, Object.assign({ step: s.journey.current.step }, action), rand || dice([0.5]));
  }
  function step(s) { return s.journey.current ? s.journey.current.step : null; }
  function poolIds(s, kind) { return J.pool(E, kind || 'travel', ctx(s)).map(function (ev) { return ev.id; }); }
  function effect(s, name) { return s.journey.effects.filter(function (e) { return e.name === name; }); }
  function thread(s, name) { return s.journey.threads.filter(function (t) { return t.name === name; })[0] || null; }

  group('Explorer events: content');

  test('every event\'s steps link up, and every step has one thing to do', function (t) {
    var ACTIONS = ['check', 'choices', 'next', 'fight', 'contest', 'puzzle', 'pick', 'branch', 'end'];
    E.events.forEach(function (ev) {
      t.ok(ev.steps.start, ev.code + ' has a start');
      var seen = {};
      var todo = ['start'];
      while (todo.length) {
        var id = todo.pop();
        if (seen[id]) continue;
        seen[id] = true;
        var st = ev.steps[id];
        t.ok(st, ev.code + ': step ' + id + ' exists');
        if (!st) continue;
        var acts = ACTIONS.filter(function (a) { return a in st; });
        t.equal(acts.length, 1, ev.code + ': step ' + id + ' has one action');
        var next = [];
        if (st.check) ['success', 'failure', 'failBy5', 'next', 'anyFail', 'noneFail'].forEach(function (k) { if (st.check[k]) next.push(st.check[k]); });
        if (st.choices) st.choices.forEach(function (c) { next.push(c.go); });
        if (st.next) next.push(st.next);
        if (st.fight) next.push(st.fight.won, st.fight.fled);
        if (st.contest) next.push(st.contest.win, st.contest.lose);
        if (st.puzzle) next.push(st.puzzle.solved, st.puzzle.kind === 'riddle' ? st.puzzle.wrong : st.puzzle.giveUp);
        if (st.pick) next.push(st.pick.go);
        if (st.branch) Object.keys(st.branch).forEach(function (k) { if (k !== 'key') next.push(st.branch[k]); });
        next.forEach(function (n) { todo.push(n); });
      }
      Object.keys(ev.steps).forEach(function (k) { t.ok(seen[k], ev.code + ': step ' + k + ' can be reached'); });
    });
  });

  test('Harry\'s choices: T9 is switched off; T17 The Second Marker is gone', function (t) {
    t.ok(J.def(E, 't9').off);
    ['northern_province', 'midland_province', 'eastern_province'].forEach(function (region) {
      t.ok(poolIds(fresh(region)).indexOf('t9') === -1, 'no T9 in ' + region);
    });
    t.same([J.def(E, 't17'), J.def(E, 'n17')], [null, null], 'removed (Harry, 7 October 2026)');
    t.same(J.dmEvents(E), [], 'no DM-only events');
  });

  test('each province\'s clan, chief and temple match the Notice Board\'s', function (t) {
    var regions = window.TSI_DATA.quests.meta.regions;
    var label = { northern_province: 'Northern Province', midland_province: 'Midland Province', eastern_province: 'Eastern Province', southern_province: 'Southern Province', western_province: 'Western Province', the_north_isle: 'The North Isle', the_east_isle: 'The East Isle' };
    Object.keys(label).forEach(function (id) {
      var q = regions[label[id]];
      var mine = E.regions[id];
      t.equal('Clan ' + mine.clan, q.ruling_clan, id);
      t.equal('Chief ' + mine.chief, q.clan_leader, id);
      t.equal(mine.temple, q.active_temple, id);
    });
    t.same(['northern_province', 'midland_province', 'eastern_province'].map(function (r) { return E.regions[r].god; }), ['telluria', 'telluria', 'telluria']);
    t.same(['southern_province', 'western_province'].map(function (r) { return E.regions[r].god; }), ['aurush', 'aurush']);
    t.same(['the_north_isle', 'the_east_isle'].map(function (r) { return E.regions[r].god; }), ['pelagos', 'pelagos']);
  });

  test('every map an event names is one of the Explorer\'s maps', function (t) {
    var ids = D.maps.map(function (m) { return m.id; });
    E.events.forEach(function (ev) {
      (ev.where.maps || []).forEach(function (m) { t.ok(ids.indexOf(m) !== -1, ev.code + ': ' + m); });
    });
  });

  group('Explorer events: when they happen');

  test('pools follow the Region, and map-only events need their map', function (t) {
    t.same(poolIds(fresh('midland_province')), ['t1', 't2', 't3', 't4', 't6', 't7', 't8']);
    t.ok(poolIds(fresh('midland_province', 'midland_province')).indexOf('t5') !== -1, 'the Ferry Puzzle where there\'s a river');
    t.ok(poolIds(fresh('eastern_province', 'eastern_province_north')).indexOf('t10') !== -1);
    t.ok(poolIds(fresh('eastern_province', 'eastern_province_south')).indexOf('t10') === -1, 'only on the Muster\'s map');
    t.same(poolIds(fresh('southern_province', 'southern_province_west')), ['t1', 't2', 't3', 't4', 't5', 't6', 't11', 't12', 't14']);
    var up = fresh('western_province');
    up.mapUploadKey = 'abc';
    t.same(poolIds(up), ['t1', 't2', 't3', 't4', 't6', 't12'], 'an uploaded map gets the Region\'s events, not map-only ones');
    t.same(poolIds(fresh('the_north_isle', 'the_north_isle'), 'camp'), ['c1', 'c2', 'c3', 'c4', 'c11', 'c12']);
  });

  test('drawn like cards: nothing repeats until the pool is used up', function (t) {
    var s = fresh('midland_province');
    var seen = [];
    for (var i = 0; i < 7; i++) {
      var ev = J.draw(s, E, 'travel', ctx(s), dice([0.37]));
      begin(s, ev.id);
      J.finish(s, E);
      seen.push(ev.id);
    }
    t.equal(seen.slice().sort().join(), ['t1', 't2', 't3', 't4', 't6', 't7', 't8'].join(), 'all seven, once each');
    var again = J.draw(s, E, 'travel', ctx(s), dice([0]));
    t.equal(again.id, 't1', 'then the pool is shuffled back in');
    t.equal(s.journey.used.travel.length, 0);
  });

  test('travel: 30% once a day, and never two days running', function (t) {
    var s = fresh('midland_province');
    t.equal(J.travelRoll(s, E, ctx(s), dice([0.3])), null, '0.30 misses');
    t.equal(J.travelRoll(s, E, ctx(s), dice([0])), null, 'one roll a day');
    s.travel.day = 2;
    var it = J.travelRoll(s, E, ctx(s), dice([0.29, 0]));
    t.equal(it.kind, 'travel');
    J.begin(s, E, it, ctx(s), dice([0.5]));
    J.finish(s, E);
    t.equal(s.journey.lastTravelDay, 2);
    s.travel.day = 3;
    t.equal(J.travelRoll(s, E, ctx(s), dice([0])), null, 'not the day after one');
    s.travel.day = 4;
    t.ok(J.travelRoll(s, E, ctx(s), dice([0])), 'the day after that, yes');
  });

  test('Roll an event now counts as that day\'s travel event', function (t) {
    var s = fresh('midland_province');
    var it = J.rollNow(s, E, ctx(s), 'travel', dice([0]));
    J.begin(s, E, it, ctx(s), dice([0.5]));
    J.finish(s, E);
    t.equal(J.travelRoll(s, E, ctx(s), dice([0])), null);
    t.equal(J.rollNow(s, E, ctx(s), 'camp', dice([0])).kind, 'camp');
  });

  test('a due follow-up takes the next travel event; on its last day it comes whatever the roll', function (t) {
    var s = fresh('midland_province', 'midland_province');
    s.travel.day = 4;
    begin(s, 't1');
    act(s, { type: 'check', result: 'failure', hero: 'kaelen' });
    act(s, { type: 'choose', index: 1 });
    act(s, { type: 'check', result: 'failure', hero: 'kaelen' });
    var grudge = thread(s, 'The Toll-Men\'s Grudge');
    t.same([grudge.follow.from, grudge.follow.to, grudge.follow.mapKey], [5, 7, 'preset:midland_province']);
    J.finish(s, E);
    s.travel.day = 6;
    var it = J.travelRoll(s, E, ctx(s), dice([0]));
    t.equal(it.event.id, 'f1', 'the follow-up goes first');
    var s2 = TSI.clone(s);
    s2.travel.day = 7;
    s2.journey.lastTravelDay = 6;
    var forced = J.travelRoll(s2, E, ctx(s2), dice([0.99]));
    t.equal(forced.event.id, 'f1', 'last day: whatever the roll, even the day after an event');
  });

  test('a follow-up on the wrong map is dropped, and its thread stays', function (t) {
    var s = fresh('midland_province', 'midland_province');
    s.journey.threads.push({ id: 't9', name: 'The Toll-Men\'s Grudge', note: 'x', from: 'T1', day: 1, resolve: null, follow: { event: 'f1', scope: 'same-map', mapKey: 'preset:northern_province_east', from: 2, to: 4 }, data: {} });
    s.travel.day = 4;
    t.equal(J.dueFollow(s, E, ctx(s), 4), null);
    s.travel.day = 5;
    J.newDay(s);
    t.equal(s.journey.threads[0].follow, null);
    t.ok(/didn't come/.test(s.journey.threads[0].note));
  });

  test('a follow-up on its last day comes at camp if the road didn\'t bring it', function (t) {
    var s = fresh('the_east_isle', 'the_east_isle');
    s.travel.day = 6;
    s.journey.lastTravelDay = 3;
    s.journey.threads.push({ id: 't1', name: 'The Captain\'s Thanks', note: 'x', from: 'C12', day: 1, resolve: null, follow: { event: 'f3', scope: 'isles', mapKey: '', from: 3, to: 6 }, data: {} });
    var q = R.makeCamp(s, D, E, dice([0.99]));
    t.equal(q[0].kind, 'journey');
    t.same([s.journey.current.id, s.journey.current.phase, s.journey.lastTravelDay], ['f3', 'camp', 3]);
    t.ok(/\+250 gold/.test(s.journey.current.changes[0]), 'the captain\'s reward');
    t.equal(s.journey.threads[0].note, 'x', 'not counted as missed');
  });

  test('no campfire event after a travel event that day, or with weather tonight', function (t) {
    var s = fresh('midland_province');
    s.travel.day = 5;
    s.journey.lastTravelDay = 5;
    t.equal(J.campRoll(s, E, ctx(s), dice([0]), 5, false), null);
    s.journey.lastTravelDay = 4;
    t.equal(J.campRoll(s, E, ctx(s), dice([0]), 5, true), null);
    t.equal(J.campRoll(s, E, ctx(s), dice([0, 0]), 5, false).kind, 'camp');
  });

  test('an event set for tonight (a campfire event rolled on the road) takes the night\'s camp', function (t) {
    var s = fresh('the_north_isle', 'the_north_isle');
    s.journey.tonight = { event: 'c3' };
    var q = R.makeCamp(s, D, E, dice([0.99]));
    t.equal(q[0].kind, 'journey');
    t.same([s.journey.current.id, s.journey.current.kind, s.journey.current.phase], ['c3', 'camp', 'camp']);
    t.equal(s.journey.tonight, null);
    t.ok(s.journey.used.camp.indexOf('c3') !== -1, 'and it counts as drawn');
  });

  group('Explorer events: running one');

  test('T1: Insight, then the bluff; effects land on the hero who rolled', function (t) {
    var s = fresh('midland_province');
    s.travel.day = 5;
    begin(s, 't1');
    var v = J.view(s, E, null);
    t.equal(v.check.label, 'Wisdom (Insight), DC 14', 'the check and its DC');
    t.equal(v.type, 'check');
    act(s, { type: 'check', result: 'success', hero: 'elara' });
    var e = effect(s, 'Toll-Wise')[0];
    t.same([e.who, e.whoName, e.untilDay, J.untilText(e, 5)], ['elara', 'Elara', 12, 'ends Day 12']);
    act(s, { type: 'choose', index: 0 });
    act(s, { type: 'check', result: 'success', hero: 'elara' });
    t.equal(s.journey.gold, 120);
    t.equal(J.view(s, E, null).type, 'end');
    var done = J.finish(s, E);
    t.equal(done.lines.length, 2);
    t.ok(/^Day 5 · T1 The Wardens' Toll: /.test(s.journey.log[0]));
    t.equal(s.journey.current, null);
  });

  test('a late or double click can\'t act on the next step', function (t) {
    var s = fresh('midland_province');
    begin(s, 't1');
    t.ok(act(s, { type: 'check', result: 'failure', hero: 'kaelen' }));
    t.ok(!J.act(s, E, { step: 'start', type: 'check', result: 'failure', hero: 'kaelen' }, dice([0.5])), 'the old step');
    t.equal(step(s), 'genuine');
    t.ok(!act(s, { type: 'check', result: 'success' }), 'not a check here');
    t.ok(!act(s, { type: 'choose', index: 9 }), 'no such choice');
  });

  test('T7: each hero saves; only those who fell climb; a failed climb costs 6 miles', function (t) {
    var s = fresh('northern_province');
    begin(s, 't7');
    t.equal(J.view(s, E, null).type, 'each');
    act(s, { type: 'each', failed: ['kaelen', 'magnus'] });
    var v = J.view(s, E, null);
    t.same(v.check.among, ['kaelen', 'magnus']);
    t.ok(/Kaelen and Magnus fell/.test(v.text));
    act(s, { type: 'each', failed: ['magnus', 'elara'] });
    t.same(s.journey.current.vars.failed, ['magnus'], 'only those who fell can fail the climb');
    t.equal(R.dayLimit(s), 24);
    act(s, { type: 'next' });
    act(s, { type: 'check', result: 'success', hero: 'umbrys' });
    act(s, { type: 'choose', index: 1 });
    t.equal(s.journey.gold, 150);
    var curse = effect(s, 'Root-Cursed')[0];
    t.same([curse.who, curse.whoName], [null, 'The party']);
  });

  test('T4: a best-of-three bout against the knight\'s d20 + 7, in her clan\'s colours', function (t) {
    var s = fresh('eastern_province');
    begin(s, 't4');
    t.ok(/A knight in Slade colours/.test(J.view(s, E, null).text));
    act(s, { type: 'choose', index: 0 });
    var v = J.view(s, E, null);
    t.equal(v.contest.total, v.contest.d20 + 7);
    act(s, { type: 'round', winner: 'hero', hero: 'magnus' }, dice([0.5]));
    act(s, { type: 'round', winner: 'opp', hero: 'magnus' }, dice([0.5]));
    t.same([J.view(s, E, null).contest.round, J.view(s, E, null).contest.heroWins], [3, 1]);
    act(s, { type: 'round', winner: 'hero', hero: 'magnus' }, dice([0.5]));
    t.equal(s.journey.gold, 200);
    t.equal(effect(s, 'Inspiration')[0].whoName, 'Magnus');
    t.ok(s.journey.current.changes.some(function (l) { return l === 'DM note: Notice Board: consider +1 clan honour with Clan Slade.'; }));
    var s2 = fresh('eastern_province');
    begin(s2, 't4');
    act(s2, { type: 'choose', index: 0 });
    act(s2, { type: 'round', winner: 'opp', hero: 'kaelen' });
    act(s2, { type: 'round', winner: 'opp', hero: 'kaelen' });
    t.equal(s2.journey.gold, -100);
    t.equal(effect(s2, 'Humbled')[0].text, 'disadvantage on Charisma checks with Clan Slade');
  });

  test('C2: the stake; double it for calling out the cheat; fail by 5 and lose it at once', function (t) {
    var s = fresh('midland_province');
    begin(s, 'c2');
    act(s, { type: 'choose', index: 1 });
    t.ok(/play for 100 gold/.test(J.view(s, E, null).text));
    act(s, { type: 'choose', index: 0 });
    act(s, { type: 'check', result: 'success', hero: 'charles' });
    act(s, { type: 'choose', index: 0 });
    act(s, { type: 'check', result: 'success', hero: 'charles' });
    t.equal(s.journey.gold, 200);
    var s2 = fresh('midland_province');
    begin(s2, 'c2');
    act(s2, { type: 'choose', index: 2 });
    act(s2, { type: 'choose', index: 0 });
    act(s2, { type: 'check', result: 'success', hero: 'charles' });
    act(s2, { type: 'choose', index: 1 });
    t.ok(J.view(s2, E, null).check.failBy5);
    act(s2, { type: 'check', result: 'failBy5', hero: 'charles' });
    t.equal(s2.journey.gold, -200);
    var s3 = fresh('midland_province');
    begin(s3, 'c2');
    act(s3, { type: 'choose', index: 0 });
    act(s3, { type: 'choose', index: 0 });
    act(s3, { type: 'check', result: 'success', hero: 'charles' });
    act(s3, { type: 'choose', index: 1 });
    act(s3, { type: 'check', result: 'success', hero: 'charles' });
    t.equal(J.view(s3, E, null).type, 'next');
    act(s3, { type: 'next' });
    t.ok(J.view(s3, E, null).contest.adv, 'cheating well gives advantage');
    act(s3, { type: 'round', winner: 'hero', hero: 'charles' });
    act(s3, { type: 'round', winner: 'hero', hero: 'charles' });
    t.equal(s3.journey.gold, 50);
  });

  test('T8: a hint once; two tries; the answer shows afterwards', function (t) {
    var s = fresh('northern_province');
    begin(s, 't8');
    var v = J.view(s, E, null);
    t.same([v.type, v.puzzle.kind, v.puzzle.answer, v.verse.length], ['puzzle', 'riddle', null, 4]);
    act(s, { type: 'hint', result: 'success' });
    t.equal(J.view(s, E, null).puzzle.hint.text, 'Look down, not up.');
    t.ok(!act(s, { type: 'hint', result: 'failure' }), 'one hint only');
    act(s, { type: 'reveal' });
    t.equal(J.view(s, E, null).puzzle.answer, 'Roots (or a root).', 'the DM can peek');
    act(s, { type: 'puzzle', result: 'wrong' });
    v = J.view(s, E, null);
    t.same([v.step, v.puzzle.wrong, v.puzzle.wrongText], ['start', 1, 'The stone hums. One more try.']);
    act(s, { type: 'puzzle', result: 'wrong' });
    t.equal(J.view(s, E, null).type, 'each');
    t.equal(J.view(s, E, null).answer, 'Roots (or a root).');
    act(s, { type: 'each', failed: [] });
    t.equal(step(s), 'shut');
    t.equal(R.dayLimit(s), 30);
  });

  test('T5: solved gives 6 miles and Inspiration to the solver; puzzles have no peek', function (t) {
    var s = fresh('midland_province', 'midland_province');
    begin(s, 't5');
    t.ok(!act(s, { type: 'reveal' }), 'the answer only shows at the end');
    act(s, { type: 'puzzle', result: 'solved' });
    t.equal(R.dayLimit(s), 36);
    t.equal(J.view(s, E, null).type, 'pick');
    act(s, { type: 'pick', hero: 'umbrys' });
    t.equal(effect(s, 'Inspiration')[0].whoName, 'Umbrys');
    t.ok(/Goat over/.test(J.view(s, E, null).answer));
  });

  test('T14 and F2: the vein is decided when the event fires, and pays (or not) 7 days on', function (t) {
    var s = fresh('southern_province');
    s.travel.day = 3;
    begin(s, 't14', null, dice([0.2]));
    t.equal(s.journey.current.vars.vein, 'genuine');
    act(s, { type: 'check', result: 'success', hero: 'elara' });
    t.ok(/genuine/.test(J.view(s, E, null).text));
    act(s, { type: 'choose', index: 0 });
    var claim = thread(s, 'The Prospector\'s Claim');
    t.same([claim.data.vein, claim.follow.from, claim.follow.to], ['genuine', 10, 10]);
    J.finish(s, E);
    s.travel.day = 10;
    var it = J.travelRoll(s, E, ctx(s), dice([0.99]));
    t.equal(it.event.id, 'f2');
    J.begin(s, E, it, ctx(s), dice([0.5]));
    t.equal(step(s), 'rider');
    t.equal(s.journey.gold, -100 + 400);
    t.equal(thread(s, 'The Prospector\'s Claim'), null, 'the thread closes');

    var s2 = fresh('southern_province');
    begin(s2, 't14', null, dice([0.7]));
    t.equal(s2.journey.current.vars.vein, 'salted');
    act(s2, { type: 'check', result: 'failure', hero: 'elara' });
    act(s2, { type: 'choose', index: 0 });
    J.finish(s2, E);
    s2.travel.day = 8;
    var it2 = J.travelRoll(s2, E, ctx(s2), dice([0.99]));
    J.begin(s2, E, it2, ctx(s2), dice([0.5]));
    t.equal(step(s2), 'vanished');
    act(s2, { type: 'check', result: 'success', hero: 'kaelen' });
    t.ok(thread(s2, 'The Prospector\'s Trail'), 'the thread becomes The Prospector\'s Trail');
  });

  test('C9: the same thread twice in one event is updated, not doubled', function (t) {
    var s = fresh('southern_province', 'southern_province_west');
    begin(s, 'c9');
    act(s, { type: 'check', result: 'success', hero: 'kaelen' });
    act(s, { type: 'choose', index: 1 });
    t.equal(J.view(s, E, null).check.label, 'Charisma (Persuasion), DC 12');
    act(s, { type: 'check', result: 'failure', hero: 'kaelen' });
    t.equal(s.journey.threads.length, 1);
    t.ok(/hear from him/.test(s.journey.threads[0].note));
  });

  test('T10: caught in a lie: no long rest, and the rest of today\'s miles are lost', function (t) {
    var s = fresh('eastern_province', 'eastern_province_north');
    s.travel.day = 4;
    s.tokens[0].milesUsed = 18;
    s.tokens[1].milesUsed = 12;
    begin(s, 't10');
    act(s, { type: 'choose', index: 2 });
    act(s, { type: 'check', result: 'failBy5', hero: 'kaelen' });
    var nr = effect(s, 'No long rest')[0];
    t.same([nr.whoName, nr.untilDay, J.untilText(nr, 4)], ['The party', 6, 'until Make Camp on Day 5']);
    t.equal(R.dayLimit(s), 18, 'nobody walks further today');
    t.ok(s.journey.current.changes.some(function (l) { return /Clan Slade/.test(l); }));
  });

  test('C8: the vigil keeper gets no long rest, and maybe Exhaustion; the party gets Aurush\'s Dawn', function (t) {
    var s = fresh('western_province');
    s.travel.day = 6;
    begin(s, 'c8');
    act(s, { type: 'check', result: 'failure', hero: 'kaelen' });
    act(s, { type: 'choose', index: 0 });
    act(s, { type: 'pick', hero: 'elara' });
    t.equal(effect(s, 'No long rest')[0].untilDay, 7, 'at camp: until the next Make Camp');
    t.equal(J.view(s, E, null).check.who, 'same');
    act(s, { type: 'check', result: 'failure' });
    t.same([effect(s, 'Exhaustion')[0].whoName, effect(s, 'Aurush\'s Dawn')[0].untilDay], ['Elara', 9]);
  });

  test('a campfire event\'s miles are tomorrow\'s', function (t) {
    var s = fresh('northern_province');
    s.travel.day = 3;
    begin(s, 'c5');
    act(s, { type: 'choose', index: 1 });
    act(s, { type: 'check', result: 'failure' });
    t.equal(R.dayLimit(s), 24);
    t.ok(/−6 miles tomorrow/.test(s.journey.current.changes[0]));
  });

  test('effects run out with the day counter', function (t) {
    var s = fresh('midland_province');
    s.travel.day = 2;
    begin(s, 't1');
    act(s, { type: 'check', result: 'success', hero: 'kaelen' });
    J.finish(s, E);
    s.journey.effects.push({ id: 'x', name: 'Warm', text: '', who: null, whoName: 'The party', from: 'T12', day: 2, until: 'camp', untilDay: 3 });
    s.journey.effects.push({ id: 'y', name: 'Knot', text: '', who: null, whoName: 'The party', from: 'C7', day: 2, until: 'used', untilDay: null });
    t.equal(J.untilText(s.journey.effects[1], 2), 'until Make Camp');
    t.equal(J.untilText(s.journey.effects[2], 2), 'until used');
    s.travel.day = 3;
    J.newDay(s);
    t.same(s.journey.effects.map(function (e) { return e.name; }), ['Toll-Wise', 'Knot']);
    s.travel.day = 9;
    J.newDay(s);
    t.same(s.journey.effects.map(function (e) { return e.name; }), ['Knot'], 'Toll-Wise ends on Day 9');
    t.ok(J.removeEffect(s, 'y'));
    t.equal(s.journey.effects.length, 0);
  });

  test('Skip this event: only before anything happens; the card goes back', function (t) {
    var s = fresh('midland_province');
    s.travel.day = 4;
    s.journey.lastTravelDay = 2;
    begin(s, 't2');
    t.equal(s.journey.lastTravelDay, 4);
    t.ok(J.canSkip(s));
    t.ok(J.skip(s));
    t.same([s.journey.current, s.journey.used.travel, s.journey.lastTravelDay], [null, [], 2]);
    begin(s, 't1');
    act(s, { type: 'check', result: 'success', hero: 'kaelen' });
    t.ok(!J.canSkip(s), 'not once something has happened');
    t.ok(!J.skip(s));
    begin(s, 'f1', 'follow');
    t.ok(!J.canSkip(s), 'a follow-up is never skipped');
  });

  test('pace reminders show on the checks they apply to, on the road only', function (t) {
    var s = fresh('midland_province');
    begin(s, 't2');
    act(s, { type: 'check', result: 'success', hero: 'kaelen' });
    act(s, { type: 'choose', index: 0 });
    t.equal(J.view(s, E, 'slow').check.pace, 'Slow pace: advantage on Stealth checks.');
    t.equal(J.view(s, E, 'fast').check.pace, null);
    var s2 = fresh('midland_province');
    begin(s2, 't2');
    act(s2, { type: 'check', result: 'failure', hero: 'kaelen' });
    t.equal(J.view(s2, E, 'fast').check.pace, 'Fast pace: −5 to Perception checks to spot danger.');
    var s3 = fresh('the_north_isle', 'the_north_isle');
    begin(s3, 'c12');
    act(s3, { type: 'check', result: 'success', hero: 'kaelen' });
    act(s3, { type: 'choose', index: 1 });
    t.equal(J.view(s3, E, 'slow').check.pace, null, 'not at camp');
  });

  test('T6 in the Eastern Province: Clan Slade\'s white stallion on teal', function (t) {
    var s = fresh('eastern_province');
    begin(s, 't6');
    t.ok(/He wears Clan Slade's white stallion on teal\./.test(J.view(s, E, null).text));
    var s2 = fresh('southern_province');
    begin(s2, 't6');
    t.ok(!/stallion/.test(J.view(s2, E, null).text));
    t.ok(/in Molten colours/.test(J.view(s2, E, null).text));
  });

  group('Explorer events: threads, gold and saving');

  test('resolving a thread applies its reward once', function (t) {
    var s = fresh('eastern_province');
    begin(s, 't6');
    act(s, { type: 'check', result: 'success', hero: 'kaelen' });
    act(s, { type: 'next' });
    act(s, { type: 'choose', index: 0 });
    J.finish(s, E);
    var th = thread(s, 'The Sealed Dispatch');
    t.ok(/Chief Harlan Slade of Clan Slade/.test(th.note));
    t.same(J.resolveLines(th), ['+250 gold', 'DM note: Notice Board: consider +1 clan honour with Clan Slade.']);
    var res = J.resolveThread(s, th.id);
    t.equal(res.lines.length, 2);
    t.equal(s.journey.gold, 250);
    t.equal(J.resolveThread(s, th.id), null, 'once only');
    t.equal(s.journey.gold, 250);
  });

  test('clearing the party gold', function (t) {
    var s = fresh();
    s.journey.gold = 340;
    t.equal(J.clearGold(s), 340);
    t.equal(s.journey.gold, 0);
    t.ok(/cleared \(was 340\)/.test(s.journey.log[0]));
  });

  test('an event part-way through is saved and comes back at the same step', function (t) {
    var s = fresh('northern_province');
    s.travel.day = 3;
    begin(s, 't7');
    act(s, { type: 'each', failed: ['elara'] });
    var saved = JSON.parse(JSON.stringify(R.toSave(s)));
    t.ok(R.isSave(saved));
    var back = R.fromSave(saved, D, E);
    t.same([back.journey.current.id, back.journey.current.step, back.journey.current.vars.failed], ['t7', 'climb', ['elara']]);
    t.same(R.toSave(back), R.toSave(s));
  });

  test('a damaged events record is tidied or refused, never a crash', function (t) {
    var good = R.toSave(fresh());
    var bad = JSON.parse(JSON.stringify(good));
    bad.journey = 5;
    t.ok(!R.isSave(bad));
    var listy = JSON.parse(JSON.stringify(good));
    listy.journey = { effects: {}, threads: 'x', gold: 40 };
    t.ok(R.isSave(listy), 'a damaged list is tidied, not a reason to lose the whole journey');
    t.same([R.fromSave(listy, D, E).journey.effects, R.fromSave(listy, D, E).journey.gold], [[], 40]);
    var messy = JSON.parse(JSON.stringify(good));
    messy.journey = { gold: 'lots', effects: [null, { id: 'e1', name: 'Rooted', untilDay: 'x' }], threads: [{ name: 'no id' }], current: { id: 'nope', step: 'start' }, tonight: { event: 'zz' } };
    t.ok(R.isSave(messy));
    var j = R.fromSave(messy, D, E).journey;
    t.same([j.gold, j.effects.length, j.effects[0].untilDay, j.threads.length, j.current, j.tonight], [0, 1, null, 0, null, null]);
  });

  test('a damaged event in progress can\'t crash the window: its values are cleaned', function (t) {
    var saved = R.toSave(fresh('northern_province'));
    saved.journey.current = { id: 't7', step: 'climb', vars: { failed: 'kaelen', succeeded: 7, hero: 5, stake: 'lots', adv: 'yes', heroName: 'Kaelen' }, changes: ['x', 3], ctx: { region: 'northern_province' } };
    var s = R.fromSave(saved, D, E);
    var c = s.journey.current;
    t.same([c.vars.failed, c.vars.succeeded, c.vars.hero, c.vars.stake, c.vars.adv, c.changes], [[], [], undefined, undefined, false, ['x']]);
    var v = J.view(s, E, null);
    t.equal(v.type, 'each');
    t.same(v.check.among, []);
    saved.journey.current = { id: 't4', step: 'bout', round: null };
    var s2 = R.fromSave(saved, D, E);
    t.equal(s2.journey.current.round.n, 1, 'a contest step gets its round back');
    t.ok(act(s2, { type: 'round', winner: 'hero', hero: 'kaelen' }), 'and the bout can go on');
  });

  test('new ids carry on above the ones in use, even if the count was lost', function (t) {
    var saved = R.toSave(fresh());
    saved.journey = { effects: [{ id: 'e7', name: 'Rooted', until: 'days', untilDay: 9 }], threads: [{ id: 't12', name: 'X' }] };
    var s = R.fromSave(saved, D, E);
    begin(s, 't1');
    act(s, { type: 'check', result: 'success', hero: 'kaelen' });
    t.equal(s.journey.effects[1].id, 'e13');
  });

  test('when tonight\'s camp is taken, a follow-up on its last day waits a day', function (t) {
    var s = fresh('the_north_isle', 'the_north_isle');
    s.travel.day = 6;
    s.journey.tonight = { event: 'c11' };
    s.journey.threads.push({ id: 't1', name: 'The Captain\'s Thanks', note: 'x', from: 'C12', day: 1, resolve: null, follow: { event: 'f3', scope: 'isles', mapKey: '', from: 3, to: 6 }, data: {} });
    R.makeCamp(s, D, E, dice([0.99]));
    t.equal(s.journey.current.id, 'c11');
    t.same([s.journey.threads[0].follow.to, s.journey.threads[0].note], [7, 'x'], 'not dropped');
    J.finish(s, E);
    t.equal(J.travelRoll(s, E, ctx(s), dice([0.99])).event.id, 'f3', 'it comes the next day');
  });

  test('an event kept for later doesn\'t use up the day\'s travel roll', function (t) {
    var s = fresh('midland_province');
    var b = R.board(4 / 3);
    begin(s, 't3');
    s.journey.lastTravelDay = 0;
    s.travel.nextTravelEventAtMiles = 6;
    var drag = R.startDrag(s, b, ['kaelen'], 'kaelen');
    var a = drag.startAxials.kaelen;
    var p = R.axialToPixel(s.grid, a.q + 1, a.r);
    R.place(b, R.token(s, 'kaelen'), p.x, p.y);
    var res = R.finishMove(s, D, E, drag, b, dice([0]));
    t.same([res.open, s.travel.travelEventDay, s.journey.rolledDay], [null, 0, 0]);
  });

  test('Reset Travel, then Skip: the day before the event moves too', function (t) {
    var s = fresh('midland_province');
    s.travel.day = 5;
    s.journey.lastTravelDay = 3;
    begin(s, 't2');
    R.resetTravel(s);
    J.skip(s);
    t.equal(s.journey.lastTravelDay, -1, 'not a day in the future');
    t.ok(J.travelRoll(s, E, ctx(s), dice([0, 0])), 'so today can still have an event');
  });

  test('Reset Travel moves effects, threads and follow-ups with the day', function (t) {
    var s = fresh('midland_province', 'midland_province');
    s.travel.day = 10;
    begin(s, 't1');
    act(s, { type: 'check', result: 'success', hero: 'kaelen' });
    J.finish(s, E);
    s.journey.threads.push({ id: 'tt', name: 'Grudge', note: '', from: 'T1', day: 10, resolve: null, follow: { event: 'f1', scope: 'any', mapKey: '', from: 11, to: 13 }, data: {} });
    R.resetTravel(s);
    t.same([s.journey.effects[0].day, s.journey.effects[0].untilDay], [1, 8]);
    t.same([s.journey.threads[0].day, s.journey.threads[0].follow.from, s.journey.threads[0].follow.to], [1, 2, 4]);
    t.equal(s.journey.lastTravelDay, 1);
  });
}());
