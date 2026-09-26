/* The Heartwood Ritual: tools/ritual/data/ritual-data.js and rules.js */
(function () {
  var D = window.TSI_DATA.ritual;
  var R = TSI.ritual.rules;

  /* Fixed dice, and a count of how many times they were rolled. */
  function dice(list) {
    var i = 0;
    var fn = function () { var v = list[i % list.length]; i++; fn.rolls = i; return v; };
    fn.rolls = 0;
    return fn;
  }
  function game(rng) { return R.create(D, rng || dice([0.99])); }
  function types(fx) { return fx.map(function (f) { return f.type; }); }
  function banners(fx) { return fx.filter(function (f) { return f.type === 'banner'; }).map(function (f) { return f.kicker + ' / ' + f.title; }); }
  function films(fx) { return fx.filter(function (f) { return f.type === 'film'; }).map(function (f) { return f.key; }); }
  function stress(g, id, n) { for (var i = 0; i < n; i++) g.addStress(id); }
  function progress(g, id, n) { for (var i = 0; i < n; i++) g.addProgress(id); }
  function roll(g, stone, value, extra) { return g.applyRoll(stone, 'attempt', Object.assign({ roll: String(value), slot: '0', adjust: '0' }, extra || {})); }
  function toRound(g, r) { while (g.state.round < r) g.nextRound(); }

  group('Heartwood Ritual: content');

  test('eight rounds, three stones, six events and three threats, as before', function (t) {
    t.equal(D.roundMax, 8);
    t.same(D.stones.map(function (s) { return s.name; }), ['Weight', 'Memory', 'Silence']);
    t.same(D.events.map(function (e) { return e.title; }), ['Root Surge', 'Echo of What Was', 'Arcane Backwash', 'False Calm', 'Veinwood Thrum', 'Moment of Reprieve']);
    t.same(['husk', 'buckbear', 'wyvern'].map(function (k) { return [D.threats[k].name, D.threats[k].maxHP, D.threats[k].tier]; }),
      [['Rootbound Husk', 35, 1], ['Rootbound Buckbear', 55, 2], ['Rootbound Wyvern', 120, 3]]);
    t.same(D.films, { WYVERN: 'wyvern_emergency.mp4', TRUE_SEAL: 'true_seal.mp4', STRAINED: 'strained_binding.mp4', FRACTURED: 'fractured_containment.mp4' });
  });

  test('the Memory target is 6 in rounds 1–2, 7 in 3–5 and 8 in 6–8', function (t) {
    t.same([1, 2, 3, 4, 5, 6, 7, 8].map(R.memoryTarget), [6, 6, 7, 7, 7, 8, 8, 8]);
  });

  test('Weight is DC 12 + Stress; Silence is DC 10 + Stress − Slot, never below 8', function (t) {
    t.equal(R.weightDC(0), 12);
    t.equal(R.weightDC(3), 15);
    t.equal(R.silenceDC(2, 0), 12);
    t.equal(R.silenceDC(0, 9), 8);
  });

  group('Heartwood Ritual: the stones');

  test('Weight: meeting the DC adds Progress; missing it adds Stress', function (t) {
    var g = game();
    roll(g, 'weight', 12);
    t.equal(g.state.stones.weight.progress, 1);
    var fx = g.takeEffects();
    t.same(banners(fx), ['BINDING HOLDS / Weight']);
    t.equal(fx[fx.length - 1].text, 'Weight: Success (+Progress)');
    roll(g, 'weight', 11);
    t.equal(g.state.stones.weight.stress, 1);
  });

  test('Weight Assist: if the advantaged attempt still fails, +1 extra Stress, then the Assist is used up', function (t) {
    var g = game();
    g.applyRoll('weight', 'assist', {});
    t.ok(g.state.assistPending.weight);
    roll(g, 'weight', 3);
    t.equal(g.state.stones.weight.stress, 2);
    t.ok(!g.state.assistPending.weight);
    roll(g, 'weight', 3);
    t.equal(g.state.stones.weight.stress, 3);
  });

  test('Memory: exact = +Progress and −Stress; ±1 = +Progress; 2 or more off = +Stress', function (t) {
    var g = game();
    stress(g, 'memory', 1);
    roll(g, 'memory', 6);
    t.same([g.state.stones.memory.progress, g.state.stones.memory.stress], [1, 0]);
    roll(g, 'memory', 7);
    t.equal(g.state.stones.memory.progress, 2);
    roll(g, 'memory', 9);
    t.equal(g.state.stones.memory.stress, 1);
  });

  test('Memory Assist moves the next target, and only the next', function (t) {
    var g = game();
    g.applyRoll('memory', 'assist', { adjust: '-1' });
    t.equal(g.takeEffects()[0].text, 'The rhythm is steadied. Next Memory Attempt target is adjusted by -1.');
    roll(g, 'memory', 5);
    t.same([g.state.stones.memory.progress, g.state.stones.memory.stress], [1, 0], 'target 5: exact');
    roll(g, 'memory', 4);
    t.equal(g.state.stones.memory.stress, 1, 'back to target 6');
  });

  test('Silence: the slot lowers the DC; an armed Assist\'s slot beats the one typed (R6: kept)', function (t) {
    var g = game();
    roll(g, 'silence', 8, { slot: '2' });
    t.equal(g.state.stones.silence.progress, 1, 'DC 8 met');
    g.applyRoll('silence', 'assist', { slot: '0' });
    roll(g, 'silence', 9, { slot: '9' });
    t.equal(g.state.stones.silence.stress, 1, 'DC 10 (the Assist\'s slot 0), not 8');
    var fx = g.takeEffects();
    t.same(banners(fx).slice(-1), ['BACKWASH / Silence Frays']);
  });

  test('an empty roll counts as 0, as before (RIT-12: kept)', function (t) {
    var g = game();
    t.equal(g.applyRoll('weight', 'attempt', { roll: '' }), 'closed');
    t.equal(g.state.stones.weight.stress, 1);
  });

  test('three Progress locks a stone; events no longer stress it, but failed attempts do (R4: kept)', function (t) {
    var g = game();
    progress(g, 'weight', 3);
    t.ok(g.state.stones.weight.locked);
    t.ok(banners(g.takeEffects()).indexOf('STONE LOCKED / Weight') !== -1);
    g.cycleEvent(0); /* Root Surge */
    g.applyEvent();
    t.equal(g.state.stones.weight.stress, 0);
    roll(g, 'weight', 1);
    t.equal(g.state.stones.weight.stress, 1);
    t.ok(g.state.stones.weight.locked, 'still locked');
  });

  test('Stress 4 cracks a stone: it unlocks, takes no more stress, and can\'t be worked', function (t) {
    var g = game();
    progress(g, 'memory', 3);
    stress(g, 'memory', 4);
    var st = g.state.stones.memory;
    t.same([st.cracked, st.locked, st.stress], [true, false, 4]);
    var fx = g.takeEffects();
    t.ok(banners(fx).indexOf('GLYPH FRACTURE / Memory') !== -1);
    t.equal(fx.filter(function (f) { return f.type === 'toast'; }).pop().text, 'Memory CRACKED (Stress 4). Ritual continues.');
    g.addStress('memory');
    t.equal(st.stress, 4);
    roll(g, 'memory', 6);
    t.same(banners(g.takeEffects()), ['STONE CRACKED / Memory']);
    t.equal(st.progress, 3);
  });

  test('the crack picture follows the stress, and a locked stone shows none', function (t) {
    t.same(R.cracks({ stress: 0, locked: false }), { image: null, opacity: 0 });
    t.same(R.cracks({ stress: 1, locked: false }), { image: 1, opacity: 0.55 });
    t.same(R.cracks({ stress: 2, locked: false }), { image: 2, opacity: 0.70 });
    t.same(R.cracks({ stress: 4, locked: false }), { image: 3, opacity: 0.85 });
    t.same(R.cracks({ stress: 3, locked: true }), { image: null, opacity: 0 });
  });

  group('Heartwood Ritual: events');

  test('each event does what it says', function (t) {
    var g = game();
    g.cycleEvent(4); /* Veinwood Thrum */
    g.applyEvent();
    t.same(R.ids.map(function (id) { return g.state.stones[id].stress; }), [1, 1, 1]);
    g.cycleEvent(1); /* Moment of Reprieve: the most stressed stone, Weight on a tie */
    g.applyEvent();
    t.same(R.ids.map(function (id) { return g.state.stones[id].stress; }), [0, 1, 1]);
    g.cycleEvent(-2); /* False Calm */
    t.equal(g.event().title, 'False Calm');
    g.applyEvent();
    t.same(R.ids.map(function (id) { return g.state.stones[id].stress; }), [0, 1, 1]);
  });

  test('Roll Event picks one of the six and says it\'s ready', function (t) {
    var g = game(dice([0.7]));
    g.rollEvent();
    t.equal(g.event().title, 'Veinwood Thrum');
    var fx = g.takeEffects();
    t.equal(fx[0].text, 'Ready to apply.');
    t.equal(fx[1].text, 'Event rolled.');
  });

  test('an event can be applied again later in the round (R3: allowed)', function (t) {
    var g = game();
    g.applyEvent();
    g.applyEvent();
    t.equal(g.state.stones.weight.stress, 2);
  });

  test('when one event does several things, the event\'s own banner comes last (RIT-21: kept)', function (t) {
    var g = game();
    stress(g, 'memory', 3);
    g.takeEffects();
    g.cycleEvent(1); /* Echo of What Was */
    g.applyEvent();
    t.same(banners(g.takeEffects()), ['STONE STRAIN / Memory', 'GLYPH FRACTURE / Memory', 'HEARTWOOD EVENT / Echo of What Was']);
  });

  group('Heartwood Ritual: endings');

  test('all three stones locked seals the ritual; the Final Seal waits for the film to end', function (t) {
    var g = game();
    R.ids.forEach(function (id) { progress(g, id, 3); });
    t.equal(g.state.phase, 'sealed');
    var fx = g.takeEffects();
    t.same(films(fx), ['TRUE_SEAL']);
    t.ok(banners(fx).indexOf('FINAL SEAL / The Heartwood Sleeps') !== -1);
    t.ok(g.state.flags.pendingFinalSeal);
    g.filmEnded();
    t.same(types(g.takeEffects()), ['finalSeal']);
    g.filmEnded();
    t.same(g.takeEffects(), [], 'only once');
  });

  test('the Pulse box can lag one step behind the ending (RIT-13: kept)', function (t) {
    var g = game();
    R.ids.forEach(function (id) { progress(g, id, 3); });
    t.same([g.shown.pulse, g.shown.state], ['Steady', 'Binding in progress']);
    g.prevRound();
    t.same([g.shown.pulse, g.shown.state], ['Dormant', 'Seal set. Heartwood sleeping.']);
  });

  test('all three stones cracked collapses the ritual', function (t) {
    var g = game();
    R.ids.forEach(function (id) { stress(g, id, 4); });
    t.equal(g.state.phase, 'failed');
    var fx = g.takeEffects();
    t.same(films(fx), ['FRACTURED']);
    t.ok(banners(fx).indexOf('RITUAL COLLAPSE / All Glyphs Have Fractured') !== -1);
  });

  test('round 8: all locked → True Seal; 2+ cracked → Fractured; otherwise Strained', function (t) {
    var a = game();
    toRound(a, 8);
    R.ids.forEach(function (id) { a.state.stones[id].locked = true; a.state.stones[id].progress = 3; });
    a.takeEffects();
    a.nextRound();
    t.same([a.state.phase, films(a.takeEffects())], ['sealed', ['TRUE_SEAL']]);

    var b = game();
    toRound(b, 8);
    b.state.stones.weight.cracked = true;
    b.state.stones.memory.cracked = true;
    b.takeEffects();
    b.nextRound();
    var fb = b.takeEffects();
    t.same([b.state.phase, films(fb)], ['failed', ['FRACTURED']]);
    t.equal(fb.filter(function (f) { return f.type === 'toast'; })[0].text, 'FRACTURED CONTAINMENT: Time ran out (2+ stones cracked).');

    var c = game();
    toRound(c, 8);
    c.takeEffects();
    c.nextRound();
    var fc = c.takeEffects();
    t.same([c.state.phase, films(fc)], ['failed', ['STRAINED']]);
    t.equal(fc.filter(function (f) { return f.type === 'toast'; })[0].text, 'STRAINED BINDING: The Heartwood is contained, but restless.');
    t.same([c.shown.pulse, c.shown.state], ['Racing', 'Ritual collapse.'], 'R9: kept');
  });

  test('nothing more happens once the ritual has ended', function (t) {
    var g = game();
    R.ids.forEach(function (id) { stress(g, id, 4); });
    var round = g.state.round;
    g.nextRound();
    g.applyEvent();
    t.equal(g.state.round, round);
    t.ok(!g.canOpen());
  });

  group('Heartwood Ritual: threats (Harry\'s answer R2: once per round)');

  test('stress piling up mid-round never summons anything', function (t) {
    var rng = dice([0]);
    var g = game(rng);
    stress(g, 'weight', 3);
    stress(g, 'memory', 3);
    stress(g, 'silence', 3);
    g.addProgress('weight');
    g.removeProgress('weight');
    g.prevRound();
    t.equal(g.state.threat, null);
    t.equal(rng.rolls, 0, 'the Husk\'s 50% was never rolled');
  });

  test('Next Round rolls the Husk\'s 50% once, when Stress totals 6 or more', function (t) {
    var rng = dice([0.4]);
    var g = game(rng);
    stress(g, 'weight', 3);
    stress(g, 'memory', 3);
    g.nextRound();
    t.equal(rng.rolls, 1);
    t.equal(g.state.threat.id, 'husk');
    var fx = g.takeEffects();
    t.ok(banners(fx).indexOf('COMBAT INTRUSION / Rootbound Husk') !== -1);
  });

  test('a roll of 50% or more means no Husk', function (t) {
    var g = game(dice([0.5]));
    stress(g, 'weight', 3);
    stress(g, 'memory', 3);
    g.nextRound();
    t.equal(g.state.threat, null);
  });

  test('a Husk left standing adds 1 Stress to a random stone; a Buckbear to every stone', function (t) {
    var g = game(dice([0.99]));
    g.spawnThreat('husk');
    g.nextRound();
    t.equal(g.state.stones.silence.stress, 1);
    var b = game();
    b.spawnThreat('buckbear');
    b.nextRound();
    t.same(R.ids.map(function (id) { return b.state.stones[id].stress; }), [1, 1, 1]);
  });

  test('from round 6 with no stone locked, a Buckbear comes on Next Round', function (t) {
    var g = game();
    toRound(g, 5);
    t.equal(g.state.threat, null);
    g.nextRound();
    t.equal(g.state.threat.id, 'buckbear');
    g.damageThreat(30);
    g.damageThreat(30);
    t.equal(g.state.threat, null, 'beaten');
    g.addProgress('weight');
    g.removeProgress('weight');
    t.equal(g.state.threat, null, 'and it doesn\'t come straight back on the next click');
    var h = game();
    progress(h, 'weight', 3);
    toRound(h, 6);
    t.equal(h.state.threat, null, 'not with a stone locked');
  });

  test('from round 7 the Wyvern comes, with its film; it replaces a Husk but not a Buckbear', function (t) {
    var g = game();
    progress(g, 'weight', 3);
    toRound(g, 6);
    g.spawnThreat('husk');
    g.takeEffects();
    g.nextRound();
    t.equal(g.state.threat.id, 'wyvern');
    t.same(films(g.takeEffects()), ['WYVERN']);
    var b = game();
    toRound(b, 6);
    t.equal(b.state.threat.id, 'buckbear');
    b.nextRound();
    t.equal(b.state.threat.id, 'buckbear');
  });

  test('before round 7, two of the three warning signs bring the Wyvern', function (t) {
    var g = game();
    stress(g, 'weight', 4); /* cracked */
    stress(g, 'memory', 3);
    stress(g, 'silence', 2); /* total 9 */
    g.nextRound();
    t.equal(g.state.threat.id, 'wyvern');
  });

  test('a Wyvern still standing at Next Round shatters the ritual', function (t) {
    var g = game();
    g.spawnThreat('wyvern');
    g.takeEffects();
    g.nextRound();
    var fx = g.takeEffects();
    t.equal(g.state.phase, 'failed');
    t.same(banners(fx), ['RITUAL SHATTERS / The Wyvern Breaks the Binding']);
    t.same(films(fx), ['FRACTURED']);
  });

  test('a live Wyvern is ignored at round 8 (R5: kept)', function (t) {
    var g = game();
    toRound(g, 7);
    g.state.threat = null;
    toRound(g, 8);
    g.spawnThreat('wyvern');
    g.takeEffects();
    g.nextRound();
    t.same(films(g.takeEffects()), ['STRAINED']);
  });

  test('beating the Wyvern: every stone −1 Stress and +2 Progress, and no more intrusions', function (t) {
    var g = game();
    stress(g, 'weight', 1);
    g.spawnThreat('wyvern');
    for (var i = 0; i < 4; i++) g.damageThreat(30);
    t.equal(g.state.threat, null);
    t.same(R.ids.map(function (id) { return [g.state.stones[id].stress, g.state.stones[id].progress]; }), [[0, 2], [0, 2], [0, 2]]);
    t.ok(g.state.flags.noMoreIntrusions);
    toRound(g, 7);
    t.equal(g.state.threat, null);
  });

  group('Heartwood Ritual: Reset');

  test('Reset starts a completely fresh ritual, armed Assists included (RIT-10)', function (t) {
    var g = game();
    g.applyRoll('weight', 'assist', {});
    toRound(g, 3);
    stress(g, 'memory', 2);
    g.spawnThreat('husk');
    g.reset();
    t.same(g.state, R.newState(D));
    t.equal(g.takeEffects().pop().text, 'Ritual reset.');
    roll(g, 'weight', 1);
    t.equal(g.state.stones.weight.stress, 1, 'the old Assist is gone');
  });

  test('"in progress" is false on a fresh or finished ritual', function (t) {
    var g = game();
    t.ok(!R.inProgress(g.state));
    g.applyRoll('memory', 'assist', { adjust: '1' });
    t.ok(R.inProgress(g.state));
    R.ids.forEach(function (id) { stress(g, id, 4); });
    t.ok(!R.inProgress(g.state));
  });
}());
