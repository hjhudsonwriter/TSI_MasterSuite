/* Scarlett Isles: Beast Handler — the first meeting is decided by the Bastion, once (Harry, 22 October 2026;
   tools/beasthandler/bastion-link.js R.rollInitiation and R.sweepInitiation, data/initiation-data.js,
   development.initiation kept by R.cleanDevelopment in tools/bastion/rules.js). The phone only plays a reveal of
   what is stored here, so the rules below are what make "you get what you are given" true. */
(function () {
  var BR = TSI.bastion.rules;
  var P = TSI.beasthandler.projection;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var KINDS = ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat'];
  var FIXED = { wyvern: 'bloodcrest', griffin: 'dawnmantle', dire_wolf: 'blacktide', buckbear: 'broadcrown', fellcat: 'lichenback' };
  var NAMES = { bloodcrest: 'Bloodcrest', dawnmantle: 'Dawnmantle', blacktide: 'Blacktide', broadcrown: 'Broadcrown', lichenback: 'Lichenback' };

  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function world() { var b = BR.defaultState(bdata); b.day = 10; b.anchored = true; return b; }
  var n = 0;
  /* A beast with a development at the given bond (it need not stand in a building: the Bastion rolls the meeting whatever its home). */
  function beast(b, species, name, bond, dev) {
    n++;
    var c = { id: 'cr-ini-' + n, species: species, owner: '', name: name, status: 'housed', home: '', grantedDay: 1, housedDay: 1, msgId: '' };
    c.development = BR.newDevelopment(c, b.day);
    c.development.handlerId = 'mira';
    c.development.bond.level = bond;
    Object.keys(dev || {}).forEach(function (k) { c.development[k] = dev[k]; });
    b.creatures.push(c);
    return c;
  }
  /* A dice source that gives the listed numbers in turn (each 0 up to, not including, 1). */
  function seq(list) { var i = 0; return function () { var v = list[i % list.length]; i++; return v; }; }
  /* The number between 0 and 1 that lands on face k of a die with `sides` faces. */
  function face(k, sides) { return (k - 0.5) / sides; }
  function withMode(mode, fn) {
    var rule = T.beastInitiation.regional;
    var was = rule.mode;
    rule.mode = mode;
    try { return fn(); } finally { rule.mode = was; }
  }
  function lines(c) { var t = c.development.temperament; return [t.dominant, t.attachment, t.trigger]; }

  group('Beast Handler: the Bastion rolls the first meeting once (22 October 2026)');

  test('the data names one real variety for each of the five kinds, and the personality is genuinely random', function (t) {
    var D = T.beastInitiation;
    t.equal(D.regional.mode, 'fixed');
    t.same(D.regional.fixed, FIXED);
    KINDS.forEach(function (k) {
      t.ok(T.beastProfile.species[k].regional.some(function (v) { return v.id === FIXED[k]; }), k + ' has a variety called ' + FIXED[k]);
    });
    t.equal(D.personality.mode, 'random');
  });

  test('each kind meets as the variety fixed for it, and the Bastion keeps its id, three die numbers and the day', function (t) {
    KINDS.forEach(function (kind) {
      var b = world();
      var c = beast(b, kind, 'Test ' + kind, 1);
      var res = BR.rollInitiation(b, bdata, c.id, seq([0.31, 0.62, 0.93]));
      t.equal(res.ok && res.initiated, true, kind);
      var d = BR.creatureById(b, c.id).development;
      t.equal(d.initiation.regional, FIXED[kind], kind + ' meets as ' + FIXED[kind]);
      t.equal(d.regional, NAMES[FIXED[kind]], 'and its profile says so');
      t.equal(d.initiation.day, 10);
      t.ok(d.initiation.rolls.dominant >= 1 && d.initiation.rolls.dominant <= 12, 'a d12');
      t.ok(d.initiation.rolls.attachment >= 1 && d.initiation.rolls.attachment <= 8, 'a d8');
      t.ok(d.initiation.rolls.trigger >= 1 && d.initiation.rolls.trigger <= 8, 'a d8');
      /* The profile lines are the table rows those numbers name. */
      var sp = T.beastProfile.species[kind];
      var row = function (tab, r) { return tab.entries.filter(function (e) { return e.roll === r; })[0].label; };
      t.same(lines(c), [row(T.beastProfile.dominant, d.initiation.rolls.dominant), row(sp.attachment, d.initiation.rolls.attachment), row(sp.trigger, d.initiation.rolls.trigger)], kind + ' lines match their rolls');
    });
  });

  test('the fixed variety ignores the dice: any seed gives the same variety, though the personality follows the dice', function (t) {
    var seen = {};
    [0, 0.2, 0.5, 0.99].forEach(function (r) {
      var b = world();
      var c = beast(b, 'wyvern', 'Dice', 1);
      BR.rollInitiation(b, bdata, c.id, function () { return r; });
      seen[c.development.initiation.regional] = true;
    });
    t.same(Object.keys(seen), ['bloodcrest']);
  });

  test('mode random gives an even pick over every variety of the kind (the six Dire Wolf varieties each come up once in six faces)', function (t) {
    withMode('random', function () {
      KINDS.forEach(function (kind) {
        var list = T.beastProfile.species[kind].regional;
        var counts = {};
        for (var i = 0; i < list.length * 100; i++) {
          var b = world();
          var c = beast(b, kind, 'Even', 1);
          BR.rollInitiation(b, bdata, c.id, seq([(i + 0.5) / (list.length * 100), 0.5, 0.5, 0.5]));
          counts[c.development.initiation.regional] = (counts[c.development.initiation.regional] || 0) + 1;
        }
        t.same(Object.keys(counts).sort(), list.map(function (v) { return v.id; }).sort(), kind + ': every face is reachable');
        Object.keys(counts).forEach(function (id) { t.equal(counts[id], 100, kind + ' ' + id + ' comes up evenly'); });
      });
    });
  });

  test('every face of the d12 Dominant Temperament and of both d8s can come up, and each lands on its own table row', function (t) {
    var sp = T.beastProfile.species.griffin;
    for (var r = 1; r <= 12; r++) {
      var b = world();
      var c = beast(b, 'griffin', 'Faces', 1);
      BR.rollInitiation(b, bdata, c.id, seq([face(r, 12), 0.5, 0.5]));
      t.equal(c.development.initiation.rolls.dominant, r);
      t.equal(c.development.temperament.dominant, T.beastProfile.dominant.entries[r - 1].label);
    }
    for (var a = 1; a <= 8; a++) {
      var b2 = world();
      var c2 = beast(b2, 'griffin', 'Faces', 1);
      BR.rollInitiation(b2, bdata, c2.id, seq([0.5, face(a, 8), face(9 - a, 8)]));
      t.equal(c2.development.initiation.rolls.attachment, a);
      t.equal(c2.development.initiation.rolls.trigger, 9 - a);
      t.equal(c2.development.temperament.attachment, sp.attachment.entries[a - 1].label);
      t.equal(c2.development.temperament.trigger, sp.trigger.entries[8 - a].label);
    }
  });

  test('the two draft d8 tables (Buckbear, Fellcat) roll like the others', function (t) {
    ['buckbear', 'fellcat'].forEach(function (kind) {
      var b = world();
      var c = beast(b, kind, 'Draft', 1);
      BR.rollInitiation(b, bdata, c.id, seq([0.5, face(1, 8), face(8, 8)]));
      var sp = T.beastProfile.species[kind];
      t.equal(c.development.temperament.attachment, sp.attachment.entries[0].label);
      t.equal(c.development.temperament.trigger, sp.trigger.entries[7].label);
    });
  });

  test('it happens once: a second call, a sweep, or a save and load changes nothing at all', function (t) {
    var b = world();
    var c = beast(b, 'wyvern', 'Once', 1);
    var first = BR.rollInitiation(b, bdata, c.id, seq([0.1, 0.2, 0.3]));
    t.equal(first.initiated, true);
    var snapshot = JSON.stringify(b);
    var second = BR.rollInitiation(b, bdata, c.id, seq([0.9, 0.9, 0.9]));
    t.same([second.ok, second.already, second.initiated], [true, true, undefined]);
    t.equal(JSON.stringify(b), snapshot, 'nothing changed, not even the Day Log');
    t.equal(BR.sweepInitiation(b, bdata, seq([0.9])).count, 0);
    t.equal(JSON.stringify(b), snapshot);
    var loaded = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.same(loaded.creatures[0].development.initiation, c.development.initiation, 'it survives saving and loading');
    t.equal(BR.rollInitiation(loaded, bdata, c.id, seq([0.9])).already, true, 'and is not rolled again after a reload');
    t.equal(BR.sweepInitiation(loaded, bdata, seq([0.9])).changed, false);
  });

  test('lines the DM has already written are kept, and only the blanks are filled; their die number is the row they match, or 0', function (t) {
    var b = world();
    var c = beast(b, 'wyvern', 'Kept', 1, { temperament: { dominant: 'Proud', attachment: 'A line of the DM\'s own', trigger: '' } });
    BR.rollInitiation(b, bdata, c.id, seq([face(5, 8)]));
    var d = c.development;
    t.equal(d.temperament.dominant, 'Proud', 'a table line the DM wrote stays');
    t.equal(d.temperament.attachment, 'A line of the DM\'s own', 'and so does a line of their own');
    t.equal(d.temperament.trigger, T.beastProfile.species.wyvern.trigger.entries[4].label, 'the blank was rolled');
    t.same(d.initiation.rolls, { dominant: 1, attachment: 0, trigger: 5 }, 'Proud is row 1 of the d12; the DM\'s own line has no number');
    t.ok(JSON.stringify(d.profileLog).indexOf('Proud') === -1 && JSON.stringify(d.profileLog).indexOf('own line') === -1, 'the change note names only what was filled');
  });

  test('a beast that already has a Regional Variety is treated as introduced: nothing is rolled, nothing is written, the meeting never plays', function (t) {
    var b = world();
    var c = beast(b, 'wyvern', 'Known', 1, { regional: 'Widowspine' });
    var before = JSON.stringify(b);
    var res = BR.rollInitiation(b, bdata, c.id, seq([0.5]));
    t.same([res.ok, res.introduced, res.initiated], [true, true, undefined]);
    t.equal(JSON.stringify(b), before);
    t.equal(c.development.initiation, undefined);
    t.equal(BR.sweepInitiation(b, bdata, seq([0.5])).count, 0);
    t.equal(JSON.stringify(b), before, 'the sweep leaves it alone too');
  });

  test('it never touches a bond, a stat, training, the riding harness, the Chronicle or a milestone: it only writes the profile', function (t) {
    var b = world();
    var c = beast(b, 'dire_wolf', 'Careful', 2);
    BR.addChronicleNote(b, bdata, c.id, 'A note the DM wrote.');
    var d = c.development;
    d.bond.ready = 3;
    var keep = copy({ bond: d.bond, chronicle: d.chronicle, training: d.training, harness: d.harness, firstFlight: d.firstFlight, handlerHistory: d.handlerHistory, seq: d.seq, handlerId: d.handlerId });
    var others = copy({ treasury: b.treasuryGP, word: b.word, orders: b.pendingOrders, defenders: b.defenders, creatureFields: { id: c.id, species: c.species, name: c.name, status: c.status, home: c.home } });
    BR.rollInitiation(b, bdata, c.id, seq([0.3, 0.4, 0.5, 0.6]));
    var after = copy({ bond: d.bond, chronicle: d.chronicle, training: d.training, harness: d.harness, firstFlight: d.firstFlight, handlerHistory: d.handlerHistory, seq: d.seq, handlerId: d.handlerId });
    t.same(after, keep);
    t.same(copy({ treasury: b.treasuryGP, word: b.word, orders: b.pendingOrders, defenders: b.defenders, creatureFields: { id: c.id, species: c.species, name: c.name, status: c.status, home: c.home } }), others);
    t.equal(d.profileLog.length, 1, 'one change note');
    t.equal(d.profileLog[0].by, 'the first meeting');
  });

  test('the Day Log says the variety was staged; in random mode it says it was rolled', function (t) {
    var b = world();
    var c = beast(b, 'wyvern', 'Logged', 1);
    BR.rollInitiation(b, bdata, c.id, seq([0.4, 0.4, 0.4]));
    var staged = b.log.filter(function (l) { return /staged: fixed until further notice/.test(l.body); });
    t.equal(staged.length, 1);
    t.ok(/Logged: first meeting prepared\. Regional Variety Bloodcrest \(staged: fixed until further notice\); Dominant Temperament d12 5; Attachment Cue d8 4; Instinctive Trigger d8 4\./.test(staged[0].body), staged[0].body);
    withMode('random', function () {
      var b2 = world();
      var c2 = beast(b2, 'griffin', 'Rolled', 1);
      BR.rollInitiation(b2, bdata, c2.id, seq([face(3, 5), 0.4, 0.4, 0.4]));
      t.ok(b2.log.some(function (l) { return /Regional Variety Silvershroud \(rolled d5 3\)/.test(l.body); }), b2.log[0].body);
      t.ok(!b2.log.some(function (l) { return /staged/.test(l.body); }));
    });
  });

  test('a fixed variety that is not one of the kind\'s own falls back to an even pick, and a kind with no varieties is left alone', function (t) {
    var rule = T.beastInitiation.regional;
    var was = rule.fixed.wyvern;
    rule.fixed.wyvern = 'nosuchvariety';
    try {
      var b = world();
      var c = beast(b, 'wyvern', 'Fallback', 1);
      BR.rollInitiation(b, bdata, c.id, seq([face(2, 5), 0.5, 0.5, 0.5]));
      t.equal(c.development.initiation.regional, 'bleakhook');
    } finally { rule.fixed.wyvern = was; }
    var b2 = world();
    var odd = beast(b2, 'cockatrice', 'Odd', 1);
    var before = JSON.stringify(b2);
    var res = BR.rollInitiation(b2, bdata, odd.id, seq([0.5]));
    t.equal(res.ok, false);
    t.ok(/no varieties written/.test(res.message), res.message);
    t.equal(JSON.stringify(b2), before);
    t.equal(BR.sweepInitiation(b2, bdata, seq([0.5])).count, 0, 'and the sweep skips it without trouble');
    t.equal(BR.rollInitiation(b2, bdata, 'nobody', seq([0.5])).ok, false);
  });

  test('a missing d8 table is skipped cleanly: its line stays blank, its number is 0, and the rest is still done', function (t) {
    var sp = T.beastProfile.species.fellcat;
    var saved = sp.trigger;
    delete sp.trigger;
    try {
      var b = world();
      var c = beast(b, 'fellcat', 'Gap', 1);
      var res = BR.rollInitiation(b, bdata, c.id, seq([0.5, 0.5, 0.5]));
      t.equal(res.initiated, true);
      t.equal(c.development.temperament.trigger, '');
      t.equal(c.development.initiation.rolls.trigger, 0);
      t.ok(c.development.temperament.dominant && c.development.temperament.attachment, 'the other two were rolled');
      t.equal(c.development.initiation.regional, 'lichenback');
    } finally { sp.trigger = saved; }
  });

  group('Beast Handler: the one-off sweep, and the snapshot never rolls (22 October 2026)');

  test('the sweep rolls every beast at Bond 1 or more that has no initiation and no variety, and nobody else', function (t) {
    var b = world();
    var elara = beast(b, 'wyvern', 'Elara\'s', 1);
    var devoted = beast(b, 'griffin', 'Devoted', 4);
    var fresh = beast(b, 'dire_wolf', 'Fresh', 0);
    var known = beast(b, 'wyvern', 'Known', 3, { regional: 'Ironcrown' });
    var res = BR.sweepInitiation(b, bdata, seq([0.45, 0.55, 0.65]));
    t.same([res.changed, res.count], [true, 2]);
    t.equal(elara.development.initiation.regional, 'bloodcrest');
    t.equal(devoted.development.initiation.regional, 'dawnmantle');
    t.equal(fresh.development.initiation, undefined, 'a Bond 0 beast is not introduced yet');
    t.equal(fresh.development.regional, undefined);
    t.equal(known.development.regional, 'Ironcrown');
    t.equal(known.development.initiation, undefined);
    t.equal(res.lines.length, 2);
    var again = BR.sweepInitiation(b, bdata, seq([0.9]));
    t.same([again.changed, again.count, again.lines], [false, 0, []], 'a second sweep finds nothing');
  });

  test('a sweep with nothing to do, or a damaged save, does nothing and throws nothing', function (t) {
    t.same(BR.sweepInitiation(world(), bdata, seq([0.5])), { changed: false, count: 0, lines: [] });
    t.same(BR.sweepInitiation(null, bdata, seq([0.5])), { changed: false, count: 0, lines: [] });
    var b = world();
    b.creatures = [null, 'x', { id: 'q' }, { id: 'r', development: 5 }];
    t.equal(BR.sweepInitiation(b, bdata, seq([0.5])).count, 0);
  });

  test('building the snapshot never rolls and never changes the save, whoever is asked about', function (t) {
    var b = world();
    var c = beast(b, 'wyvern', 'Quiet', 1);
    /* The snapshot lists the beasts housed in a standing Beast Pen: house it there. */
    b.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
    BR.ensureLevels(b, bdata);
    c.home = 'beast_pen';
    var before = JSON.stringify(b);
    P.build(b, bdata, 'mira');
    P.build(b, bdata, 'joss');
    P.build(b, bdata, '');
    t.equal(JSON.stringify(b), before, 'nothing changed');
    t.equal(c.development.initiation, undefined, 'and no meeting was rolled');
  });

  group('Beast Handler: development.initiation survives saving (22 October 2026)');

  test('R.cleanDevelopment keeps a good initiation and drops a damaged one, and an old development has none', function (t) {
    var d = BR.newDevelopment({ id: 'x' }, 3);
    t.equal(BR.cleanDevelopment(d).initiation, undefined, 'a beast that has not been introduced has none');
    d.initiation = { regional: 'bloodcrest', rolls: { dominant: 12, attachment: 3, trigger: 8 }, day: 9 };
    t.same(BR.cleanDevelopment(copy(d)).initiation, { regional: 'bloodcrest', rolls: { dominant: 12, attachment: 3, trigger: 8 }, day: 9 });
    d.initiation = { regional: 'Blood Crest!', rolls: { dominant: 1 }, day: 9 };
    t.equal(BR.cleanDevelopment(copy(d)).initiation, undefined, 'an id that is not a plain id is dropped');
    d.initiation = 'bloodcrest';
    t.equal(BR.cleanDevelopment(copy(d)).initiation, undefined);
    d.initiation = { regional: 'bloodcrest', rolls: { dominant: -4, attachment: 'x', trigger: 9999 }, day: 'soon' };
    t.same(BR.cleanDevelopment(copy(d)).initiation, { regional: 'bloodcrest', rolls: { dominant: 0, attachment: 0, trigger: 100 }, day: 1 }, 'numbers are kept within bounds');
  });

  test('the whole Bastion keeps it through save and load, export and import, and the heavy fixture\'s beasts gain nothing by being loaded', function (t) {
    var b = world();
    var c = beast(b, 'griffin', 'Round', 1);
    BR.rollInitiation(b, bdata, c.id, seq([0.5, 0.5, 0.5]));
    var back = BR.fromSave(JSON.parse(JSON.stringify(BR.toSave(b))), bdata);
    t.same(back.creatures[0].development.initiation, c.development.initiation);
    t.same(back.creatures[0].development.temperament, c.development.temperament);
    var heavy = window.TSI_FIXTURES && window.TSI_FIXTURES['bastion-v3-heavy'];
    if (heavy) {
      var loaded = BR.fromSave(copy(heavy), bdata);
      t.ok(loaded.creatures.every(function (cr) { return !cr.development || cr.development.initiation === undefined; }), 'loading rolls nothing');
    }
  });
}());
