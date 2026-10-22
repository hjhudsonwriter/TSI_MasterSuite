/* Scarlett Isles: Beast Handler — the words and shapes the screens draw (BH-1b,
   tools/beasthandler/model.js). Read-only since 22 October 2026: the request, queue and draft helpers are gone, and the
   staged first meeting (the shuffle, the marker's path, the personality cards) is worked out here and tested here. */
(function () {
  var M = TSI.beasthandler.model;
  var T = window.TSI_DATA;

  group('Beast Handler: what the screens say (BH-1b, 21 October 2026)');

  test('Bond 0 to 5 is six steps, with what is done, where it is now and what is left', function (t) {
    t.same(M.bondSteps(0).map(function (s) { return s.state; }), ['current', 'todo', 'todo', 'todo', 'todo', 'todo']);
    t.same(M.bondSteps(3).map(function (s) { return s.state; }), ['done', 'done', 'done', 'current', 'todo', 'todo']);
    t.same(M.bondSteps(5).map(function (s) { return s.state; }), ['done', 'done', 'done', 'done', 'done', 'current']);
    t.same(M.bondSteps(9).map(function (s) { return s.n + s.state; }).slice(-1), ['5current'], 'never past 5');
    t.same(M.bondSteps(-2)[0].state, 'current');
    t.equal(M.bondLine({ level: 3, name: 'Bonded' }), 'Bond 3: Bonded');
  });

  test('a Regional Variety is found by its name in any capitals, within its own kind only', function (t) {
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'widowspine').name, 'Widowspine');
    t.equal(M.regionalInfo(T.beastProfile, 'dire_wolf', ' Icepelt ').area, 'North Isle');
    t.equal(M.regionalInfo(T.beastProfile, 'griffin', 'Widowspine'), null, 'a wyvern variety is not a griffin\'s');
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', ''), null);
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'Bleak hook').name, 'Bleakhook', 'spaces do not matter');
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'Widowspine Wyvern').name, 'Widowspine', 'a trailing species word is allowed');
    t.equal(M.regionalInfo(T.beastProfile, 'dire_wolf', 'Ice-pelt wolf').name, 'Icepelt');
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'Wyvern'), null, 'the species word alone is not a variety');
    t.equal(M.regionalInfo(T.beastProfile, 'dire_wolf', 'Dire Wolf Nightfang').name, 'Nightfang', 'a leading species word is allowed');
    t.equal(M.regionalInfo(T.beastProfile, 'dire_wolf', 'Nightfang (Northern Province)').name, 'Nightfang', 'words in brackets are ignored');
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'The Widowspine').name, 'Widowspine', 'a leading "the" is allowed');
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'Bleakhook of the north').name, 'Bleakhook', 'a name that mentions exactly one variety means it');
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'Widowspine and Bleakhook'), null, 'two varieties is no variety');
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'Moonlit Rift'), null, 'a name of its own has no picture');
    t.equal(M.regionalInfo(T.beastProfile, 'wyvern', 'Tidecliff'), null, 'a typed variety simply has no extra text');
    t.equal(M.regionalInfo(T.beastProfile, 'unicorn', 'Widowspine'), null);
    t.equal(M.regionalInfo(null, 'wyvern', 'Widowspine'), null);
  });

  test('a picture is empty until one is added, and a variety\'s own picture wins when it has one', function (t) {
    t.same(M.artFor(T.beastArt, 'wyvern', ''), { src: '', label: 'Wyvern', alt: 'A wyvern' });
    t.same(M.artFor(T.beastArt, 'wyvern', 'widowspine'), { src: 'wyvern/widowspine.webp', label: 'Wyvern', alt: 'A wyvern' }, 'its own picture');
    t.same(M.artFor(T.beastArt, 'dire_wolf', 'icepelt'), { src: 'dire-wolf/icepelt.webp', label: 'Dire Wolf', alt: 'A dire wolf' }, 'Harry\'s Icepelt picture');
    t.same(M.artFor(T.beastArt, 'dire_wolf', ''), { src: '', label: 'Dire Wolf', alt: 'A dire wolf' }, 'no variety: no picture');
    t.same(M.artFor(T.beastArt, 'dire_wolf', 'unknownvariety'), { src: '', label: 'Dire Wolf', alt: 'A dire wolf' });
    ['nightfang', 'icepelt', 'slatejaw', 'reedshadow', 'hollowhowl'].forEach(function (v) { t.equal(M.artFor(T.beastArt, 'dire_wolf', v).src, 'dire-wolf/' + v + '.webp'); });
    t.same(M.artFor(T.beastArt, 'unicorn', ''), { src: '', label: 'Beast', alt: 'A beast' });
    var art = { species: { wyvern: { label: 'Wyvern', alt: 'A wyvern', default: { src: 'w.png' }, variants: { widowspine: { src: 'ws.png' } } } } };
    t.equal(M.artFor(art, 'wyvern', 'widowspine').src, 'ws.png');
    t.equal(M.artFor(art, 'wyvern', 'bleakhook').src, 'w.png');
    t.equal(M.artFor(art, 'wyvern', '').src, 'w.png');
    t.same(Object.keys(T.beastArt.species), ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat']);
    /* 22 October 2026: Blacktide and the first Buckbear and Fellcat pictures; the rest of the two new kinds have none yet. */
    t.equal(M.artFor(T.beastArt, 'dire_wolf', 'blacktide').src, 'dire-wolf/blacktide.webp');
    t.equal(M.artFor(T.beastArt, 'buckbear', 'broadcrown').src, 'buckbear/broadcrown.webp');
    t.equal(M.artFor(T.beastArt, 'fellcat', 'lichenback').src, 'fellcat/lichenback.webp');
    t.same(M.artFor(T.beastArt, 'buckbear', 'shovelhorn'), { src: '', label: 'Buckbear', alt: 'A buckbear' }, 'a variety with no picture shows the empty frame');
    t.same(M.artFor(T.beastArt, 'fellcat', 'mistveil'), { src: '', label: 'Fellcat', alt: 'A fellcat' });
  });

  test('the Home screen says the right friendly thing when there is nothing to list', function (t) {
    t.ok(/hasn't been saved yet/.test(M.homeMessage(null)));
    t.ok(/No beast buildings stand/.test(M.homeMessage({ facilities: [], handler: null })));
    t.ok(/no beasts yet.*DM has to house a beast first and then make you its handler/.test(M.homeMessage({ facilities: [{}], handler: { hasCreatures: false } })));
    t.ok(/Choose a handler/.test(M.homeMessage({ facilities: [{}], handler: null })));
    t.equal(M.homeMessage({ facilities: [{}], handler: { hasCreatures: true } }), '');
    t.equal(M.emptyBuilding({ species: { name: 'Dire Wolf' } }), 'No dire wolf is housed here yet.');
    t.equal(M.NOT_YET, 'Not acclimatised yet', 'a beast that has not passed acclimatisation is a line that says so');
  });

  test('Chronicle categories have plain names, and an unknown one is capitalised, never dropped', function (t) {
    t.same(['training', 'bond', 'handler', 'flight', 'note'].map(M.catLabel), ['Training', 'Bond', 'Handler', 'Flight', 'Note']);
    t.equal(M.catLabel('memory'), 'Memory');
    t.equal(M.catLabel(''), 'Note');
  });

  test('the connection line and the handler choices', function (t) {
    t.equal(M.syncLine({ ok: true, asOfLabel: 'Day 12' }), 'Read from the Bastion saved on this device · Day 12');
    t.equal(M.syncLine({ ok: false }), 'Not connected to a Bastion save.');
    t.same(M.handlerChoices([{ id: 'Mira', name: 'Mira', count: 2 }, { id: 'elara', name: 'Elara', count: 1 }]), [
      { value: '', label: 'No handler (see the directory only)' }, { value: 'Mira', label: 'Mira (2 beasts)' }, { value: 'elara', label: 'Elara (1 beast)' }]);
    t.equal(M.handlerChoices().length, 1);
  });

  test('every Regional Variety of the first three kinds has its own picture, and no picture belongs to an unknown variety; the new kinds\' pictures belong to real varieties', function (t) {
    ['buckbear', 'fellcat'].forEach(function (sp) {
      var ids = T.beastProfile.species[sp].regional.map(function (r) { return r.id; });
      Object.keys(T.beastArt.species[sp].variants).forEach(function (id) {
        t.ok(ids.indexOf(id) !== -1, sp + '/' + id + ' is a real variety');
        t.ok(new RegExp('^' + sp + '/' + id + '\\.webp$').test(T.beastArt.species[sp].variants[id].src), sp + '/' + id + ' points at its own file');
      });
    });
    ['wyvern', 'griffin', 'dire_wolf'].forEach(function (sp) {
      var ids = T.beastProfile.species[sp].regional.map(function (r) { return r.id; }).sort();
      var pics = Object.keys(T.beastArt.species[sp].variants).sort();
      t.same(pics, ids, sp + ': one picture for each of its five varieties');
      pics.forEach(function (id) { t.ok(new RegExp('^' + sp.replace('_', '-') + '/' + id + '\\.webp$').test(T.beastArt.species[sp].variants[id].src), sp + '/' + id + ' points at its own file'); });
    });
    t.equal(M.artFor(T.beastArt, 'griffin', 'embermantle').src, 'griffin/embermantle.webp');
    t.equal(M.artFor(T.beastArt, 'wyvern', 'shadowmount').src, 'wyvern/shadowmount.webp');
    t.equal(M.artFor(T.beastArt, 'griffin', '').src, '', 'no variety: no picture');
  });

  group('Beast Handler: the beast\'s page and the first meeting (21 October 2026)');

  test('Bond 1 to 5 are five pills; Bond 0 fills none; the stage line says where it is', function (t) {
    t.same(M.bondPills(3).pills.map(function (p) { return p.state; }), ['done', 'done', 'current', 'todo', 'todo']);
    t.equal(M.bondPills(3).stageText, 'Stage 3 of 5');
    t.same(M.bondPills(0).pills.map(function (p) { return p.state; }), ['todo', 'todo', 'todo', 'todo', 'todo']);
    t.equal(M.bondPills(0).stageText, 'Stage 0 of 5');
    t.same(M.bondPills(5).pills.map(function (p) { return p.state; }), ['done', 'done', 'done', 'done', 'current']);
    t.equal(M.bondPills(9).level, 5, 'never past 5');
    t.equal(M.bondPills(-2).level, 0);
    t.same(M.bondPills(1).pills.map(function (p) { return p.label; }), ['Acclimatised', 'Trusting', 'Bonded', 'Devoted', 'Legendary']);
    t.equal(M.rapportLine({ level: 3, name: 'Bonded' }), 'Bond 3 \u00b7 Bonded');
  });

  test('a name takes its apostrophe the usual way, and the kind of beast is lower case', function (t) {
    t.equal(M.possessive('Elara'), 'Elara\u2019s');
    t.equal(M.possessive('Aurelius'), 'Aurelius\u2019');
    t.equal(M.speciesNoun({ species: { name: 'Dire Wolf' } }), 'dire wolf');
    t.equal(M.speciesNoun(null), 'beast');
  });

  test('the meeting\'s words use the beast\'s name and kind', function (t) {
    var x = M.meetingText({ name: 'Stormwing', species: { name: 'Wyvern' } });
    t.equal(x.meet, 'It\u2019s time to meet Stormwing\u2026');
    t.equal(x.lead, 'Two quick rolls, then you will see Stormwing for the first time.');
    t.equal(x.subspecies, 'There are many subspecies of wyvern in The Scarlett Isles, but which one is Stormwing?');
    t.equal(x.personality, 'Every wyvern has its own unique personality. What is Stormwing\u2019s like?');
    t.equal(x.welcome, 'Welcome to the Ironbow, Stormwing!');
    t.equal(M.meetingText({ name: 'Aurelius', species: { name: 'Dire Wolf' } }).personality, 'Every dire wolf has its own unique personality. What is Aurelius\u2019 like?');
  });

  test('the request and queue helpers are gone from the model: the app sends nothing', function (t) {
    ['confirmLines', 'requestRows', 'requestLine', 'waitingOrderAt', 'cleanQueue', 'QUEUE_MAX', 'pendingProfile', 'effectiveProfile', 'regionalWaiting', 'refusedProfile'].forEach(function (name) {
      t.equal(M[name], undefined, name + ' is gone');
    });
  });

  group('Beast Handler: the staged first meeting (22 October 2026)');

  /* A beast of Mira's that has passed acclimatisation and been met by the Bastion. */
  function detail(over) {
    return Object.assign({ id: 'c1', name: 'Stormwing', available: true, species: { id: 'wyvern', name: 'Wyvern' }, initiation: { regional: 'bloodcrest', rolls: { dominant: 1, attachment: 3, trigger: 8 } },
      profile: { regional: 'Bloodcrest', dominant: 'Proud', attachment: 'Relaxes its tail', trigger: 'Rival wyvern nearby' } }, over || {});
  }

  test('the meeting plays only for a beast that has passed acclimatisation, has a first meeting the Bastion rolled, and has not been seen on this device', function (t) {
    t.equal(M.needsMeeting(detail(), {}), true);
    t.equal(M.needsMeeting(detail(), null), true);
    t.equal(M.needsMeeting(detail(), { c2: true }), true, 'another beast having been seen does not matter');
    t.equal(M.needsMeeting(detail(), { c1: true }), false, 'seen once, never again');
    t.equal(M.needsMeeting(detail({ available: false }), {}), false, 'not acclimatised');
    t.equal(M.needsMeeting(detail({ initiation: null }), {}), false, 'a beast that was already introduced (or not yet rolled for) has no meeting');
    t.equal(M.needsMeeting(detail({ initiation: undefined }), {}), false);
    t.equal(M.needsMeeting(null, {}), false);
    t.equal(M.needsMeeting(detail(), { c1: 'yes' }), true, 'only a real "true" counts as seen... ');
  });

  test('the kind\'s varieties come in the table\'s order, and a shuffle is a fresh order of the same ones that never changes the original', function (t) {
    var v = M.revealVarieties(T.beastProfile, 'dire_wolf');
    t.same(v.map(function (x) { return x.name; }), ['Nightfang', 'Icepelt', 'Slatejaw', 'Reedshadow', 'Hollowhowl', 'Blacktide']);
    t.same(Object.keys(v[0]).sort(), ['id', 'name'], 'only the name and id: where it lives and how it looks stay hidden until the roll lands');
    t.same(M.revealVarieties(T.beastProfile, 'unicorn'), []);
    var before = JSON.stringify(v);
    var orders = {};
    for (var i = 0; i < 60; i++) {
      var o = M.shuffle(v);
      t.same(o.map(function (x) { return x.id; }).sort(), v.map(function (x) { return x.id; }).sort());
      orders[o.map(function (x) { return x.id; }).join(',')] = true;
    }
    t.equal(JSON.stringify(v), before);
    t.ok(Object.keys(orders).length > 20, 'different orders come up: ' + Object.keys(orders).length);
    var seq = [0.99, 0.0, 0.5, 0.2, 0.7];
    var k = 0;
    t.same(M.shuffle([1, 2, 3, 4, 5, 6], function () { return seq[k++ % seq.length]; }), M.shuffle([1, 2, 3, 4, 5, 6], (function () { var j = 0; return function () { return seq[j++ % seq.length]; }; }())), 'the same dice give the same order');
  });

  test('the marker always ends on the answer, however the dice fall, for five and for six medallions', function (t) {
    [5, 6].forEach(function (n) {
      for (var dest = 0; dest < n; dest++) {
        for (var run = 0; run < 60; run++) {
          var p = M.revealPlan(n, dest, Math.random);
          t.equal(p.stops[p.stops.length - 1], dest, n + ' medallions, answer ' + dest);
          t.equal(p.stops.length, p.delays.length + 1);
          t.ok(p.stops.every(function (i) { return i >= 0 && i < n; }), 'every stop is a real medallion');
        }
      }
    });
  });

  test('it takes 3.5 to 4.5 seconds, and slows down: gaps start at about 90 ms and grow to about 420 ms', function (t) {
    var firsts = [], lasts = [], totals = [];
    for (var run = 0; run < 400; run++) {
      var n = 5 + (run % 2);
      var p = M.revealPlan(n, run % n, Math.random);
      var gaps = p.delays.slice(0, -1);
      t.equal(p.delays.reduce(function (a, b) { return a + b; }, 0), p.total, 'the waits add up to the total exactly');
      t.ok(p.total >= 3500 && p.total <= 4500, 'total ' + p.total);
      for (var i = 1; i < gaps.length; i++) if (gaps[i] < gaps[i - 1]) t.ok(false, 'a gap shrank: ' + gaps.join(','));
      firsts.push(gaps[0]); lasts.push(gaps[gaps.length - 1]); totals.push(p.total);
    }
    t.ok(Math.min.apply(null, firsts) >= 60 && Math.max.apply(null, firsts) <= 150, 'the first gap is about 90 ms: ' + Math.min.apply(null, firsts) + ' to ' + Math.max.apply(null, firsts));
    t.ok(Math.min.apply(null, lasts) >= 280 && Math.max.apply(null, lasts) <= 600, 'the last gap is about 420 ms: ' + Math.min.apply(null, lasts) + ' to ' + Math.max.apply(null, lasts));
    t.ok(Math.min.apply(null, totals) < 3700 && Math.max.apply(null, totals) > 4300, 'the whole range is used');
  });

  test('every run has a near miss: it rests one beside the answer, then steps onto it; and it goes round at least once', function (t) {
    var kinds = {};
    for (var run = 0; run < 300; run++) {
      var n = 5 + (run % 2);
      var dest = (run * 7) % n;
      var p = M.revealPlan(n, dest, Math.random);
      var rest = p.stops[p.stops.length - 2];
      var d = (rest - dest + n) % n;
      t.ok(d === 1 || d === n - 1, 'the rest is beside the answer');
      t.ok(rest !== dest);
      t.ok(p.hold >= 450 && p.hold <= 800, 'it rests a moment: ' + p.hold);
      t.equal(p.hold, p.delays[p.delays.length - 1]);
      t.ok(p.hops >= n, 'at least one lap');
      kinds[p.near] = true;
    }
    t.same(Object.keys(kinds).sort(), ['after', 'before'], 'sometimes it runs past and steps back, sometimes it stops short and steps on');
  });

  test('the start is random and no two runs look the same: path and timing differ', function (t) {
    var starts = {}, paths = {}, timings = {};
    for (var run = 0; run < 200; run++) {
      var p = M.revealPlan(5, 2, Math.random);
      starts[p.stops[0]] = true;
      paths[p.stops.join('')] = true;
      timings[p.delays.join(',')] = true;
    }
    t.equal(Object.keys(starts).length, 5, 'every medallion is a possible start');
    t.ok(Object.keys(paths).length >= 8, 'paths: ' + Object.keys(paths).length);
    t.ok(Object.keys(timings).length > 150, 'timings: ' + Object.keys(timings).length);
    t.same(M.revealPlan(1, 0).stops, [0], 'one medallion has nothing to hop across');
    t.same(M.revealPlan(5, 9, function () { return 0.5; }).stops.slice(-1), [4], 'an answer off the end is held to the last medallion');
  });

  test('the personality cards carry the Bastion\'s real numbers and lines, with the d12\'s note only while the line is still the one the roll gave', function (t) {
    var cards = M.personalityCards(detail(), T.beastProfile);
    t.same(cards.map(function (c) { return [c.key, c.label, c.dice, c.roll, c.line]; }), [
      ['dominant', 'Dominant Temperament', 12, 1, 'Proud'],
      ['attachment', 'Attachment Cue', 8, 3, 'Relaxes its tail'],
      ['trigger', 'Instinctive Trigger', 8, 8, 'Rival wyvern nearby']
    ]);
    t.equal(cards[0].note, 'Expects respect and dislikes being hurried');
    t.equal(cards[1].note, '', 'the d8 tables have no notes');
    var edited = M.personalityCards(detail({ profile: { regional: 'Bloodcrest', dominant: 'Fierce', attachment: '', trigger: '' } }), T.beastProfile);
    t.equal(edited[0].note, '', 'the DM changed the line, so the old note is not shown over it');
    t.equal(edited[1].line, '');
    var written = M.personalityCards(detail({ initiation: { regional: 'bloodcrest', rolls: { dominant: 0, attachment: 0, trigger: 0 } } }), T.beastProfile);
    t.same(written.map(function (c) { return c.roll; }), [0, 0, 0], 'a line the DM wrote has no roll');
    ['buckbear', 'fellcat'].forEach(function (k) {
      var c = M.personalityCards(detail({ species: { id: k, name: k } }), T.beastProfile);
      t.equal(c[1].dice, 8);
      t.equal(c[2].dice, 8);
    });
    t.equal(M.personalityCards(detail({ species: { id: 'unicorn', name: 'Unicorn' } }), T.beastProfile)[1].dice, 0, 'a kind with no tables has no die, and does not throw');
  });
}());
