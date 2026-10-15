/* The Explorer link (pull request 4 of the facilities overhaul, Harry's
   answers of 13 October 2026): shared/js/bridge-rules.js, the Explorer's
   messages, Travel bags, charts and packs (journey.js, rules.js), and the
   Bastion applying each change once (tools/bastion/rules.js). The parcel
   pickups of pull request 6 are tested in courier.test.js. */
(function () {
  var Bg = TSI.bridge;
  var ER = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var ED = window.TSI_DATA.explorer;
  var E = window.TSI_DATA.journeyEvents;
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce };

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  /* A rand that counts how often it's asked. */
  function counting(list) {
    var r = dice(list);
    var f = function () { f.calls++; return r(); };
    f.calls = 0;
    return f;
  }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function explorer(region, mapId) {
    var s = ER.defaultState(ED);
    if (region) s.travel.provinceId = region;
    if (mapId) s.mapPresetId = mapId;
    return s;
  }
  function begin(s, id, rand) {
    var ev = J.def(E, id);
    return J.begin(s, E, { kind: ev.kind, event: ev }, J.context(s, E), rand || dice([0.5]));
  }
  function act(s, action, rand) {
    return J.act(s, E, Object.assign({ step: s.journey.current.step }, action), rand || dice([0.5]));
  }
  /* T4 won: accept the bout and win it two rounds to nil. */
  function winT4(s, rand) {
    begin(s, 't4', rand);
    act(s, { type: 'choose', index: 0 }, rand);
    act(s, { type: 'round', winner: 'hero', hero: 'magnus' }, rand);
    act(s, { type: 'round', winner: 'hero', hero: 'magnus' }, rand);
  }
  /* The Explorer save as the Bastion reads it. */
  function saved(s) { return copy(ER.toSave(s)); }
  /* A Bastion that has read the Explorer's day (anchored) and isn't new. */
  function bastion(day) {
    var b = BR.defaultState(bdata);
    b.day = day || 1;
    b.anchored = true;
    b.bridge.fresh = false;
    return b;
  }
  function msg(over) {
    return Object.assign({ id: 'abc123-1a2b3c4d:won:2', type: 'standing', day: 3, at: '2026-10-13T10:00:00.000Z', from: { code: 'T4', title: 'The Knight-Errant\'s Challenge', step: 'won' }, clan: 'slade', hr: 1, text: 'Honour/Respect +1 with Clan Slade.' }, over || {});
  }
  function exWith(list) { return { travel: { day: 5 }, journey: { outbox: list } }; }
  function reload(b) { return BR.fromSave(copy(BR.toSave(b)), bdata); }

  /* ---------------------------------------------------------------- */
  group('Explorer link: messages (shared/js/bridge-rules.js)');

  test('a new id is the time and 8 random hex digits, from crypto, never Math.random', function (t) {
    var real = Math.random;
    var calls = 0;
    Math.random = function () { calls++; return real(); };
    var ids = {};
    var repeats = 0;
    try {
      for (var i = 0; i < 10000; i++) {
        var id = Bg.newId();
        if (ids[id]) repeats++;
        ids[id] = true;
        if (!Bg.UID_PATTERN.test(id)) throw new Error('badly formed: ' + id);
      }
    } finally { Math.random = real; }
    t.equal(repeats, 0, 'no repeats in 10,000');
    t.equal(calls, 0, 'Math.random was never asked');
    t.ok(/^[a-z0-9]+-[0-9a-f]{8}$/.test(Bg.newId()));
  });

  test('the seven Clans are the Bastion\'s seven', function (t) {
    t.same(Bg.CLANS.slice().sort(), T.bastion.clans.map(function (c) { return c.key; }).sort());
    t.equal(Bg.clanName('slade'), 'Slade');
    t.equal(Bg.clanName('karr'), 'Karr');
  });

  test('check() accepts a good message, on any whole day (Reset Travel can make it 0 or less)', function (t) {
    t.equal(Bg.check(msg()), '');
    t.equal(Bg.check(msg({ day: 0 })), '');
    t.equal(Bg.check(msg({ day: -5 })), '');
    t.equal(Bg.check(msg({ hr: -1 })), '');
  });

  test('check() refuses a damaged message, with a plain reason', function (t) {
    t.ok(/kind of change/.test(Bg.check(msg({ type: 'gold' }))), 'an unknown type');
    t.ok(/doesn't know \(extra\)/.test(Bg.check(msg({ extra: 1 }))), 'an extra field');
    t.ok(/id is damaged/.test(Bg.check(msg({ id: 'nope' }))), 'a bad id');
    t.ok(/Clan the Bastion doesn't know/.test(Bg.check(msg({ clan: 'ironbow' }))), 'an unknown Clan');
    t.ok(/\+1 or −1/.test(Bg.check(msg({ hr: 2 }))), 'hr 2');
    t.ok(/\+1 or −1/.test(Bg.check(msg({ hr: 0.5 }))), 'hr 0.5');
    t.ok(/\+1 or −1/.test(Bg.check(msg({ hr: 0 }))), 'hr 0');
    t.ok(/day is damaged/.test(Bg.check(msg({ day: 2.5 }))), 'a part day');
    t.ok(/text is damaged/.test(Bg.check(msg({ text: new Array(202).join('x') }))), 'over-long text');
    t.ok(Bg.check(null) !== '');
  });

  test('pull request 6: a parcel pickup is the third kind; its town and Clan are never checked, while the other two kinds\' Clans still are', function (t) {
    /* Pull request 7 added a fourth kind, 'creature' (creatures.test.js). */
    t.same(Bg.TYPES, ['standing', 'charter', 'parcel_collected', 'creature']);
    var pick = { id: 'abcdef123:collect:0', type: 'parcel_collected', day: 4, clan: 'nobody', point: 'nowhere', parcel: 'abcdef123', hr: 0, text: 'x' };
    t.equal(Bg.check(pick), '', 'only its kind and id');
    t.ok(/Clan the Bastion doesn't know/.test(Bg.check(msg({ clan: 'nobody' }))), 'Honour/Respect still names a known Clan');
    t.ok(/Clan the Bastion doesn't know/.test(Bg.check({ id: 'chartr-0a0b0c0d:dm:0', type: 'charter', day: 3, from: {}, clan: 'nobody', port: 'goldport', text: '' })), 'so does a Port Charter');
    t.equal(Bg.isParcelMessage(pick), true);
    t.equal(Bg.isParcelMessage(msg({ id: 'abcdef-12345678:collect:0' })), false, 'a standing message is never read as a pickup');
    var b = bastion(4);
    b.bridge.done[msg().id] = { r: 'applied', day: 3, hr: 1, was: 0, now: 1 };
    t.equal(Bg.statusOf(msg(), b).line, 'Applied on Day 3: 0 → +1.', 'Honour/Respect reads as before');
  });

  test('every id an event can make fits the pattern', function (t) {
    var uid = Bg.newId();
    E.events.forEach(function (ev) {
      Object.keys(ev.steps).forEach(function (stepId) {
        (ev.steps[stepId].apply || []).forEach(function (o, i) {
          if (!o.standing) return;
          t.ok(Bg.ID_PATTERN.test(uid + ':' + stepId + ':' + i), ev.code + ' ' + stepId);
        });
      });
    });
  });

  test('pending(): in order, on or before the Bastion\'s day, without a receipt, each id once', function (t) {
    var a = msg({ id: 'aaaaaa-00000001:won:2', day: 2 });
    var b = msg({ id: 'bbbbbb-00000002:won:2', day: 4 });
    var c = msg({ id: 'cccccc-00000003:won:2', day: 9 });
    var ex = exWith([a, b, c, copy(a), 'junk', { id: 7 }]);
    t.same(Bg.pending(ex, {}, 5).map(function (m) { return m.id; }), [a.id, b.id]);
    t.same(Bg.pending(ex, { 'aaaaaa-00000001:won:2': { r: 'applied' } }, 9).map(function (m) { return m.id; }), [b.id, c.id]);
    t.same(Bg.pending(null, {}, 9), [], 'no Explorer save');
    t.same(Bg.pending({ journey: {} }, {}, 9), [], 'an Explorer save from before the link');
  });

  test('statusOf(): waiting, applied, refused and skipped, in plain words', function (t) {
    var m = msg({ day: 6 });
    t.equal(Bg.statusOf(m, null).kind, 'waiting', 'no Bastion save yet');
    var b = bastion(4);
    t.ok(/reach Day 6/.test(Bg.statusOf(m, b).line));
    b.anchored = false;
    t.ok(/to open/.test(Bg.statusOf(m, b).line));
    b.anchored = true;
    b.bridge.done[m.id] = { r: 'applied', day: 6, hr: 1, was: 0, now: 1 };
    t.same([Bg.statusOf(m, b).kind, Bg.statusOf(m, b).line], ['applied', 'Applied on Day 6: 0 → +1.']);
    b.bridge.done[m.id] = { r: 'applied', day: 6, hr: 0, was: 5, now: 5 };
    t.ok(/already at \+5/.test(Bg.statusOf(m, b).line));
    b.bridge.done[m.id] = { r: 'refused', why: 'Its id is damaged.' };
    t.same([Bg.statusOf(m, b).kind, Bg.statusOf(m, b).line], ['refused', 'Refused: Its id is damaged. Nothing changed.']);
    b.bridge.done[m.id] = { r: 'skipped' };
    t.equal(Bg.statusOf(m, b).kind, 'skipped');
  });

  /* ---------------------------------------------------------------- */
  group('Explorer link: the 8 event moments send a change (Harry, 13 October 2026)');

  test('T4 won, in the Eastern Province: one message, +1 with Clan Slade, and no Notice Board note', function (t) {
    var s = explorer('eastern_province');
    winT4(s);
    var out = s.journey.outbox;
    t.equal(out.length, 1);
    t.same([out[0].type, out[0].clan, out[0].hr, out[0].day], ['standing', 'slade', 1, 1]);
    t.equal(out[0].id, s.journey.current.uid + ':won:2');
    t.same(out[0].from, { code: 'T4', title: 'The Knight-Errant\'s Challenge', step: 'won' });
    t.equal(Bg.check(out[0]), '', 'the Bastion would accept it');
    t.ok(s.journey.current.changes.indexOf('Sent to the Bastion: Honour/Respect +1 with Clan Slade.') !== -1);
    t.ok(!s.journey.current.changes.some(function (l) { return /Notice Board/.test(l); }));
    t.equal(J.canSkip(s), false, 'Skip is refused once something is sent');
  });

  test('T4 sneer: −1 with the Region\'s Clan', function (t) {
    var s = explorer('northern_province');
    begin(s, 't4');
    act(s, { type: 'choose', index: 1 });
    act(s, { type: 'check', result: 'failure', hero: 'kaelen' });
    t.same(s.journey.outbox.map(function (m) { return [m.clan, m.hr, m.id.split(':').slice(1).join(':')]; }), [['blackstone', -1, 'sneer:0']]);
  });

  test('T10 caught: −1 with Clan Slade, whatever the Region', function (t) {
    var s = explorer('the_north_isle', 'eastern_province_north');
    begin(s, 't10');
    /* Straight to the cover story's check. */
    s.journey.current.step = 'cover';
    act(s, { type: 'check', result: 'failBy5', hero: 'kaelen' });
    t.equal(s.journey.current.step, 'caught');
    t.same(s.journey.outbox.map(function (m) { return [m.clan, m.hr]; }), [['slade', -1]]);
  });

  test('C4: dragged out −1 and handed over +1, with the Region\'s Clan', function (t) {
    var s = explorer('midland_province');
    begin(s, 'c4');
    act(s, { type: 'check', result: 'success', hero: 'kaelen' });
    act(s, { type: 'choose', index: 0 });
    act(s, { type: 'check', result: 'failure', hero: 'kaelen' });
    t.same(s.journey.outbox.map(function (m) { return [m.clan, m.hr, m.id.split(':').slice(1).join(':')]; }), [['bacca', -1, 'dragged:0']]);
    var s2 = explorer('southern_province');
    begin(s2, 'c4');
    act(s2, { type: 'check', result: 'success', hero: 'kaelen' });
    act(s2, { type: 'choose', index: 1 });
    t.same(s2.journey.outbox.map(function (m) { return [m.clan, m.hr, m.id.split(':').slice(1).join(':')]; }), [['molten', 1, 'hand:1']]);
    t.equal(s2.journey.gold, 100, 'the bounty is still paid');
  });

  test('C10 rideWon: +1 with Clan Farmer; C12 surrender and saved: +1 with Clan Karr', function (t) {
    var s = explorer('western_province');
    begin(s, 'c10');
    var guard = 0;
    while (s.journey.current && s.journey.current.step !== 'ride' && guard++ < 6) {
      var v = J.view(s, E, null);
      if (v.type === 'check') act(s, { type: 'check', result: 'success', hero: 'kaelen' });
      else if (v.type === 'each') act(s, { type: 'each', failed: [] });
      else if (v.type === 'choices') act(s, { type: 'choose', index: 0 });
      else if (v.type === 'next') act(s, { type: 'next' });
      else break;
    }
    t.equal(s.journey.current.step, 'ride');
    act(s, { type: 'fight', result: 'won' });
    t.same(s.journey.outbox.map(function (m) { return [m.clan, m.hr, m.id.split(':').slice(1).join(':')]; }), [['farmer', 1, 'rideWon:1']]);

    ['surrender', 'saved'].forEach(function (end) {
      var s2 = explorer('the_north_isle', 'the_north_isle');
      begin(s2, 'c12');
      var cur = s2.journey.current;
      cur.step = end;
      cur.changes = [];
      /* Straight to the step, as the event reaches it. */
      J.applyOutcome(s2, E, J.def(E, 'c12').steps[end].apply[1], 1);
      t.same(s2.journey.outbox.map(function (m) { return [m.clan, m.hr, m.id.split(':').slice(1).join(':')]; }), [['karr', 1, end + ':1']], end);
    });
  });

  test('exactly the 8 Harry chose send a change; the Thread rewards stay reminders', function (t) {
    var found = [];
    E.events.forEach(function (ev) {
      Object.keys(ev.steps).forEach(function (id) {
        (ev.steps[id].apply || []).forEach(function (o, i) {
          if (o.standing) found.push(ev.code + ' ' + id + ' ' + (o.standing.clan) + ' ' + o.standing.hr + ' @' + i);
        });
      });
    });
    t.same(found.sort(), [
      'C10 rideWon farmer 1 @1', 'C12 saved karr 1 @1', 'C12 surrender karr 1 @1',
      'C4 dragged region -1 @0', 'C4 hand region 1 @1',
      'T10 caught slade -1 @2', 'T4 sneer region -1 @0', 'T4 won region 1 @2'
    ]);
    var reminders = JSON.stringify(E.events).match(/Notice Board: consider/g) || [];
    t.equal(reminders.length, 5, 'T6\'s three and T13\'s two Thread rewards');
  });

  test('a Region with no Clan sends nothing, and says so', function (t) {
    var s = explorer('eastern_province');
    begin(s, 't4');
    s.journey.current.ctx.region = 'nowhere';
    act(s, { type: 'choose', index: 0 });
    act(s, { type: 'round', winner: 'hero', hero: 'magnus' });
    act(s, { type: 'round', winner: 'hero', hero: 'magnus' });
    t.equal(s.journey.outbox.length, 0);
    t.ok(s.journey.current.changes.indexOf('No Clan for this Region: nothing sent to the Bastion.') !== -1);
  });

  test('no event ever goes back to a step it has been to, so a message id is never made twice', function (t) {
    function targets(st) {
      var out = [];
      var c = st.check;
      if (c) ['success', 'failure', 'failBy5', 'anyFail', 'noneFail', 'next'].forEach(function (k) { if (c[k]) out.push(c[k]); });
      (st.choices || []).forEach(function (ch) { if (ch.go) out.push(ch.go); });
      if (st.next) out.push(st.next);
      if (st.fight) ['won', 'fled'].forEach(function (k) { if (st.fight[k]) out.push(st.fight[k]); });
      if (st.pick && st.pick.go) out.push(st.pick.go);
      if (st.contest) ['win', 'lose'].forEach(function (k) { if (st.contest[k]) out.push(st.contest[k]); });
      if (st.puzzle) ['solved', 'giveUp', 'wrong'].forEach(function (k) { if (st.puzzle[k]) out.push(st.puzzle[k]); });
      if (st.branch) Object.keys(st.branch).forEach(function (k) { if (k !== 'key') out.push(st.branch[k]); });
      return out;
    }
    E.events.forEach(function (ev) {
      var state = {};
      function visit(id, path) {
        if (state[id] === 'open') throw new Error(ev.code + ' loops back to ' + id + ' (' + path.join(' → ') + ')');
        if (state[id] === 'done') return;
        state[id] = 'open';
        var st = ev.steps[id];
        if (!st) throw new Error(ev.code + ' has no step ' + id);
        targets(st).forEach(function (n) { visit(n, path.concat(n)); });
        state[id] = 'done';
      }
      visit(ev.steps.start ? 'start' : Object.keys(ev.steps)[0], ['start']);
    });
    t.ok(true);
  });

  /* ---------------------------------------------------------------- */
  group('Explorer link: saving and dice');

  test('the uid, outbox, bags and packs used survive save, load and save again', function (t) {
    var s = explorer('eastern_province');
    J.addItem(s, J.CHART, 2);
    J.addItem(s, J.PACK, 3);
    winT4(s);
    s.journey.current.packUsed = ['won'];
    var once = ER.toSave(ER.fromSave(saved(s), ED, E));
    var twice = ER.toSave(ER.fromSave(copy(once), ED, E));
    t.same(twice, once, 'identical after two reloads');
    t.equal(once.journey.current.uid, s.journey.current.uid);
    t.same(once.journey.outbox, copy(s.journey.outbox));
    t.same(once.journey.inventory.map(function (i) { return [i.kind, i.qty]; }), [['overland_chart', 6], ['expedition_provision_pack', 3]]);
    t.same(once.journey.current.packUsed, ['won']);
  });

  test('a save from before the link loads; an event left open gets a uid', function (t) {
    var s = explorer('eastern_province');
    begin(s, 't4');
    var old = saved(s);
    delete old.journey.outbox;
    delete old.journey.inventory;
    delete old.journey.current.uid;
    delete old.journey.current.packUsed;
    delete old.travel.extraMiles;
    delete old.travel.dayLost;
    var back = ER.fromSave(old, ED, E);
    t.same([back.journey.outbox, back.journey.inventory], [[], []]);
    t.ok(Bg.UID_PATTERN.test(back.journey.current.uid), 'a fresh uid');
    t.same([back.travel.extraMiles, back.travel.dayLost], [0, false]);
  });

  test('damaged bits are tidied, and a message with an id is never dropped', function (t) {
    var s = saved(explorer());
    s.journey.outbox = [msg({ hr: 7, extra: 'x' }), 'junk', { id: '' }, null];
    s.journey.inventory = [{ kind: 'overland_chart', qty: 4 }, { kind: 'overland_chart', qty: 2 }, { kind: 'sword', qty: 1 }, { kind: 'expedition_provision_pack', qty: 0 }, 'x'];
    var back = ER.fromSave(s, ED, E);
    t.equal(back.journey.outbox.length, 1);
    t.equal(back.journey.outbox[0].hr, 7, 'kept as saved: the Bastion refuses it');
    t.ok(!('extra' in back.journey.outbox[0]));
    t.same(back.journey.inventory.map(function (i) { return [i.kind, i.qty]; }), [['overland_chart', 6]]);
  });

  test('Reset Travel moves a waiting message\'s day, to 0 or before too', function (t) {
    var s = explorer('eastern_province');
    s.travel.day = 12;
    winT4(s);
    J.finish(s, E);
    s.travel.day = 14;
    ER.resetTravel(s);
    t.equal(s.journey.outbox[0].day, -1);
    t.equal(Bg.check(s.journey.outbox[0]), '', 'still accepted');
  });

  test('T4 makes exactly the dice rolls it always did; Math.random is never asked', function (t) {
    var real = Math.random;
    var mr = 0;
    Math.random = function () { mr++; return real(); };
    var rand = counting([0.5]);
    try {
      winT4(explorer('eastern_province'), rand);
    } finally { Math.random = real; }
    t.equal(rand.calls, 2, 'one d20 for each round of the bout, as before');
    t.equal(mr, 0);
  });

  /* ---------------------------------------------------------------- */
  group('Explorer link: Travel bags and Overland charts (3 days of use each)');

  function board43() { return ER.board(4 / 3); }
  function putOnHex(s, board, id, q, r) {
    var p = ER.axialToPixel(s.grid, q, r);
    ER.place(board, ER.token(s, id), p.x, p.y);
  }
  function move(s, board, ids, anchorId, dq, dr, rand) {
    var drag = ER.startDrag(s, board, ids, anchorId);
    ids.forEach(function (id) {
      var a = drag.startAxials[id];
      putOnHex(s, board, id, a.q + dq, a.r + dr);
    });
    return { drag: drag, res: ER.finishMove(s, ED, E, drag, board, rand || dice([0.99])) };
  }

  test('Add, Use and Remove', function (t) {
    var s = explorer();
    t.ok(/Added 2 Overland charts to the Travel bags \(6 days of use\)\. Now 6 days of use\./.test(J.addItem(s, J.CHART, 2)));
    t.equal(J.itemQty(s, J.CHART), 6);
    J.addItem(s, J.CHART, 1);
    t.equal(s.journey.inventory.length, 1, 'the same kind is one row');
    t.equal(J.itemQty(s, J.CHART), 9);
    t.equal(J.addItem(s, J.CHART, 0), null);
    t.equal(J.addItem(s, 'sword', 1), null);
    t.ok(/Used an Overland chart/.test(ER.useChart(s)));
    t.equal(J.itemQty(s, J.CHART), 8);
    J.addItem(s, J.PACK, 1);
    var row = s.journey.inventory.filter(function (i) { return i.kind === J.PACK; })[0];
    t.ok(/Removed Expedition Provision Packs \(1 pack\)/.test(J.removeItem(s, row.id)));
    t.equal(J.itemQty(s, J.PACK), 0);
    t.ok(J.takeItem(s, J.CHART, 8));
    t.same(s.journey.inventory, [], 'a row at 0 goes');
    t.equal(J.takeItem(s, J.CHART, 1), false);
  });

  test('a chart today: the limit is 36, a hero at 30 can move again, a 6th hex fits and a 7th doesn\'t', function (t) {
    var b = board43();
    var s = explorer();
    J.addItem(s, J.CHART, 1);
    var m = move(s, b, ['kaelen'], 'kaelen', 5, 0);
    t.equal(m.res.result, 'moved');
    t.equal(ER.canDrag(s, 'kaelen'), false, 'tired at 30');
    ER.useChart(s);
    t.equal(ER.dayLimit(s), 36);
    t.equal(ER.canDrag(s, 'kaelen'), true);
    t.equal(move(s, b, ['kaelen'], 'kaelen', 1, 0).res.result, 'moved');
    t.equal(ER.token(s, 'kaelen').milesUsed, 36);
    t.equal(move(s, b, ['kaelen'], 'kaelen', 1, 0).res.result, 'tooFar');
    t.equal(ER.travelMode(36).key, 'fast', 'the pace is still Fast');
  });

  test('a chart is refused: none in the bags, one already in use, a lost day, Free Move', function (t) {
    var s = explorer();
    t.ok(/no Overland chart/.test(ER.chartProblem(s)));
    J.addItem(s, J.CHART, 1);
    t.equal(ER.chartProblem(s), '');
    ER.useChart(s);
    t.ok(/already in use today/.test(ER.chartProblem(s)));
    t.equal(ER.useChart(s), null);
    t.equal(J.itemQty(s, J.CHART), 2, 'only one day used');
    var s2 = explorer();
    J.addItem(s2, J.CHART, 1);
    s2.travel.dayLost = true;
    t.ok(/miles are lost/.test(ER.chartProblem(s2)));
    s2.travel.dayLost = false;
    s2.freeMove = true;
    t.ok(/Free Move/.test(ER.chartProblem(s2)));
  });

  test('losing the day after a chart: the limit is the most miles walked', function (t) {
    var s = explorer('eastern_province', 'eastern_province_north');
    J.addItem(s, J.CHART, 1);
    ER.useChart(s);
    ER.token(s, 'kaelen').milesUsed = 36;
    ER.token(s, 'umbrys').milesUsed = 12;
    begin(s, 't10');
    J.applyOutcome(s, E, { loseDay: true }, 0);
    t.equal(s.travel.dayLost, true);
    t.equal(ER.dayLimit(s), 36);
    s.travel.milesAdjust = 12 - 30;
    t.equal(ER.dayLimit(s), 12, 'the chart is ignored on a lost day');
  });

  test('Make Camp: no chart in use and back to 30; the bags keep their charts. Reset Travel clears both too', function (t) {
    var s = explorer();
    J.addItem(s, J.CHART, 1);
    ER.useChart(s);
    s.travel.dayLost = true;
    ER.makeCamp(s, ED, E, dice([0.99]));
    t.same([s.travel.extraMiles, s.travel.dayLost, ER.dayLimit(s)], [0, false, 30]);
    t.equal(J.itemQty(s, J.CHART), 2);
    ER.useChart(s);
    s.travel.dayLost = true;
    ER.resetTravel(s);
    t.same([s.travel.extraMiles, s.travel.dayLost], [0, false]);
  });

  test('the chart and the lost day survive a reload; bad values are tidied', function (t) {
    var s = explorer();
    J.addItem(s, J.CHART, 1);
    ER.useChart(s);
    var back = ER.fromSave(saved(s), ED, E);
    t.same([back.travel.extraMiles, ER.dayLimit(back)], [6, 36]);
    var bad = saved(s);
    bad.travel.extraMiles = 99;
    bad.travel.dayLost = 'yes';
    var b2 = ER.fromSave(bad, ED, E);
    t.same([b2.travel.extraMiles, b2.travel.dayLost], [6, false]);
    bad.travel.extraMiles = -3;
    t.equal(ER.fromSave(bad, ED, E).travel.extraMiles, 0);
    /* A day an event cut short stays cut short after two reloads. */
    s.travel.dayLost = true;
    var twice = ER.fromSave(saved(ER.fromSave(saved(s), ED, E)), ED, E);
    t.equal(twice.travel.dayLost, true);
    t.ok(/miles are lost|already in use/.test(ER.chartProblem(twice)));
    t.equal(ER.dayLimit(twice), 30, 'the chart is ignored');
  });

  /* ---------------------------------------------------------------- */
  group('Explorer link: the day\'s road roll is unchanged by a chart');

  test('the same dice give the same roll with and without a chart', function (t) {
    [false, true].forEach(function (chart) {
      var b = board43();
      var s = explorer('midland_province');
      if (chart) { J.addItem(s, J.CHART, 1); ER.useChart(s); }
      move(s, b, ['kaelen'], 'kaelen', 2, 0, dice([0.5, 0]));
      var m2 = move(s, b, ['kaelen'], 'kaelen', 1, 0, dice([0]));
      t.equal(m2.res.open && m2.res.open.kind, 'journey', chart ? 'with a chart' : 'without');
    });
  });

  test('an event held the roll back until 30 miles: the chart\'s 30 → 36 hex never rolls', function (t) {
    var b = board43();
    var s = explorer('midland_province');
    J.addItem(s, J.CHART, 1);
    ER.useChart(s);
    s.travel.nextTravelEventAtMiles = 12;
    s.journey.current = { id: 'x' };
    move(s, b, ['kaelen'], 'kaelen', 5, 0);
    s.journey.current = null;
    var rand = counting([0]);
    var m = move(s, b, ['kaelen'], 'kaelen', 1, 0, rand);
    t.equal(m.res.result, 'moved');
    t.equal(m.res.open, null);
    t.equal(rand.calls, 0, 'no roll at all');
  });

  test('a −12 detour day with a chart: a mark at 20 miles is never reached', function (t) {
    var b = board43();
    var s = explorer('midland_province');
    J.addItem(s, J.CHART, 1);
    ER.useChart(s);
    s.travel.milesAdjust = -12;
    s.travel.nextTravelEventAtMiles = 20;
    t.equal(ER.dayLimit(s), 24);
    var rand = counting([0]);
    var m = move(s, b, ['kaelen'], 'kaelen', 4, 0, rand);
    t.equal(m.res.result, 'moved', '24 miles fits today\'s 18 + 6');
    t.equal(m.res.open, null);
    t.equal(rand.calls, 0);
  });

  /* ---------------------------------------------------------------- */
  group('Explorer link: Expedition Provision Packs at an exhaustion save');

  function c8awake(region) {
    var s = explorer(region || 'southern_province');
    begin(s, 'c8');
    s.journey.current.step = 'vigil';
    act(s, { type: 'pick', hero: 'kaelen' });
    return s;
  }

  test('C8\'s vigil save offers a pack only when one is in the bags', function (t) {
    var s = c8awake();
    t.equal(s.journey.current.step, 'awake');
    t.equal(J.view(s, E, null).check.pack, null, 'no pack, no offer');
    J.addItem(s, J.PACK, 4);
    t.same(J.view(s, E, null).check.pack, { have: 4, used: false });
  });

  test('Use a pack: one goes, once a save, and a reload keeps it used', function (t) {
    var s = c8awake();
    J.addItem(s, J.PACK, 4);
    t.ok(/Used 1 Expedition Provision Pack: advantage on this save \(3 packs left\)\./.test(J.usePack(s, E, 'awake')));
    t.equal(J.usePack(s, E, 'awake'), null, 'a second click does nothing');
    t.equal(J.itemQty(s, J.PACK), 3);
    t.same(J.view(s, E, null).check.pack, { have: 3, used: true });
    var back = ER.fromSave(saved(s), ED, E);
    t.equal(J.usePack(back, E, 'awake'), null, 'still used after a reload');
    t.equal(J.itemQty(back, J.PACK), 3);
    t.equal(J.usePack(s, E, 'vigil'), null, 'only for the step on screen');
  });

  test('no offer at a check that isn\'t an exhaustion save; the White Blizzard is one', function (t) {
    var s = explorer('eastern_province');
    J.addItem(s, J.PACK, 2);
    begin(s, 't1');
    t.equal(J.view(s, E, null).check.pack, null);
    t.equal(J.usePack(s, E, 't1'), null);
    var blizzard = ED.weather.filter(function (w) { return w.id === 'white_blizzard'; })[0];
    t.ok(J.isExhaustion(blizzard.mechanic));
    t.ok(/at the White Blizzard: advantage on the party's save \(1 pack left\)/.test(J.usePackAtWeather(s, 'White Blizzard')));
    J.usePackAtWeather(s, 'White Blizzard');
    t.equal(J.usePackAtWeather(s, 'White Blizzard'), null, 'none left');
  });

  /* ---------------------------------------------------------------- */
  group('Explorer link: the Bastion applies each change once');

  test('applied once; a second look changes nothing', function (t) {
    var b = bastion(3);
    var ex = exWith([msg()]);
    var r1 = BR.applyInbox(b, bdata, ex, 1000);
    t.equal(r1.applied.length, 1);
    t.equal(b.honourRespectByClan.slade, 1);
    t.same([b.bridge.done[msg().id].r, b.bridge.done[msg().id].was, b.bridge.done[msg().id].now], ['applied', 0, 1]);
    t.ok(/From the Explorer/.test(b.log[0].title) && /Clan Slade/.test(b.log[0].body));
    var r2 = BR.applyInbox(b, bdata, ex, 2000);
    t.equal(r2.changed, false);
    t.equal(b.honourRespectByClan.slade, 1);
  });

  test('a damaged message gets a receipt and changes nothing', function (t) {
    var b = bastion(3);
    var r = BR.applyInbox(b, bdata, exWith([msg({ hr: 3 })]), 1000);
    t.equal(r.refused, 1);
    t.equal(b.honourRespectByClan.slade, 0);
    t.equal(b.bridge.done[msg().id].r, 'refused');
    t.ok(/\+1 or −1/.test(b.bridge.done[msg().id].why));
  });

  test('at +5 it\'s applied, with no change', function (t) {
    var b = bastion(3);
    b.honourRespectByClan.slade = 5;
    BR.applyInbox(b, bdata, exWith([msg()]), 1000);
    t.same([b.bridge.done[msg().id].r, b.bridge.done[msg().id].hr, b.honourRespectByClan.slade], ['applied', 0, 5]);
  });

  test('a change dated later waits; a Bastion that hasn\'t read the Explorer\'s day does nothing', function (t) {
    var b = bastion(2);
    BR.applyInbox(b, bdata, exWith([msg({ day: 3 })]), 1000);
    t.equal(b.honourRespectByClan.slade, 0);
    t.same(b.bridge.done, {});
    b.day = 3;
    BR.applyInbox(b, bdata, exWith([msg({ day: 3 })]), 1000);
    t.equal(b.honourRespectByClan.slade, 1);
    var b2 = bastion(5);
    b2.anchored = false;
    t.equal(BR.applyInbox(b2, bdata, exWith([msg()]), 1000).changed, false);
  });

  test('a Bastion starting from nothing skips (and lists) what was sent before, once', function (t) {
    var b = BR.defaultState(bdata);
    t.equal(b.bridge.fresh, true);
    var kept = reload(b);
    t.equal(kept.bridge.fresh, true, 'kept through a reload before it reads the day');
    BR.anchor(kept, 4);
    var r = BR.applyInbox(kept, bdata, exWith([msg(), msg({ id: 'zzzzzz-00000009:hand:1', clan: 'bacca' })]), 1000);
    t.equal(r.skipped, 2);
    t.equal(kept.bridge.fresh, false);
    t.equal(kept.honourRespectByClan.slade, 0);
    t.equal(kept.bridge.done[msg().id].r, 'skipped');
    t.ok(/skipped/.test(kept.log[0].body));
    var later = msg({ id: 'yyyyyy-00000008:won:2' });
    BR.applyInbox(kept, bdata, exWith([msg(), later]), 2000);
    t.equal(kept.honourRespectByClan.slade, 1, 'later changes apply as normal');
    t.equal(BR.bridgeHistory(kept, 10)[0].id, later.id, 'newest first');
  });

  test('a new Bastion that finds no Explorer save yet stops being new, so later changes apply (review fix)', function (t) {
    var b = BR.defaultState(bdata);
    var r = BR.applyInbox(b, bdata, null, 1000);
    t.equal(r.changed, true, 'saved as no longer new');
    t.equal(b.bridge.fresh, false);
    b = reload(b);
    BR.anchor(b, 1);
    BR.applyInbox(b, bdata, exWith([msg({ day: 1 })]), 2000);
    t.equal(b.honourRespectByClan.slade, 1, 'sent after it started: applied');
    var b2 = BR.defaultState(bdata);
    BR.applyInbox(b2, bdata, { travel: { day: 1 }, journey: { outbox: [] } }, 1000);
    t.equal(b2.bridge.fresh, true, 'an Explorer save with nothing sent yet: still new until it reads the day');
  });

  test('a Bastion saved before the link applies the Explorer\'s new changes', function (t) {
    var s = copy(BR.toSave(bastion(3)));
    delete s.bridge;
    var b = BR.fromSave(s, bdata);
    t.same(b.bridge, { fresh: false, done: {} });
  });

  test('receipts survive two reloads; odd entries are tidied, never dropped', function (t) {
    var b = bastion(3);
    BR.applyInbox(b, bdata, exWith([msg()]), 1000);
    b.bridge.done.odd = 'junk';
    b.bridge.done.odd2 = { r: 'what', hr: 'x' };
    var once = reload(b);
    var twice = reload(once);
    t.same(BR.toSave(twice).bridge, BR.toSave(once).bridge);
    t.same(Object.keys(once.bridge.done).sort(), [msg().id, 'odd', 'odd2'].sort());
    t.equal(once.bridge.done.odd.r, 'refused');
    t.equal(once.bridge.done[msg().id].r, 'applied');
  });

  test('a save whose bridge isn\'t a record is refused', function (t) {
    var s = copy(BR.toSave(bastion(3)));
    s.bridge = [];
    t.ok(/bridge record is damaged/.test(BR.saveProblem(s)));
    s.bridge = 'x';
    t.ok(/bridge record is damaged/.test(BR.saveProblem(s)));
  });

  test('Reset Travel: receipts stay as they are, and a waiting change applies once after the shift', function (t) {
    var b = bastion(14);
    BR.applyInbox(b, bdata, exWith([msg({ day: 12 })]), 1000);
    var before = copy(b.bridge);
    BR.shiftDays(b, -13);
    t.same(b.bridge, before, 'receipts untouched');
    var waiting = msg({ id: 'qqqqqq-00000004:won:2', day: -1 });
    BR.applyInbox(b, bdata, exWith([msg({ day: -1 }), waiting]), 2000);
    t.equal(b.honourRespectByClan.slade, 2, 'each once');
  });

  test('two copies of one Bastion both applying the change: whichever is saved, it counts once', function (t) {
    var base = copy(BR.toSave(bastion(3)));
    var a = BR.fromSave(copy(base), bdata);
    var b = BR.fromSave(copy(base), bdata);
    BR.applyInbox(a, bdata, exWith([msg()]), 1000);
    BR.applyInbox(b, bdata, exWith([msg()]), 2000);
    [a, b].forEach(function (x) {
      var back = reload(x);
      t.equal(back.honourRespectByClan.slade, 1);
      t.equal(BR.applyInbox(back, bdata, exWith([msg()]), 3000).changed, false);
    });
  });

  test('a War Action cancelled the same day gives back its own cost and keeps the Explorer\'s change', function (t) {
    var b = bastion(3);
    b.organization = { type: 'clan', name: 'Clan Ironbow', chief: '', motto: '', foundedAtDay: 1 };
    b.honourRespectByClan.slade = -2;
    var order = { id: 'w1', facId: 'war_council', fnId: 'war_action', optionIdx: 0, label: 'War Action', issuedDay: 3, dueDay: 6, meta: { kind: 'war_action', objective: 'raid', targetKey: 'slade', targetName: 'Slade', declared: { day: 3, hr: -2, pc: 0, prev: null, quiet: false, rollDone: true } } };
    BR.applyInbox(b, bdata, exWith([msg()]), 1000);
    t.equal(b.honourRespectByClan.slade, -1);
    BR.undoWarDeclaration(b, bdata, order, 2000);
    t.equal(b.honourRespectByClan.slade, 1, '−1 + 2 given back: the Explorer\'s +1 stays');
  });

  test('a campaign file keeps the messages, receipts and bags, and applying again adds nothing', function (t) {
    var ex = explorer('eastern_province');
    J.addItem(ex, J.CHART, 1);
    winT4(ex);
    J.finish(ex, E);
    var b = bastion(1);
    BR.applyInbox(b, bdata, saved(ex), 1000);
    var BK = TSI.backupRules;
    var file = BK.makeCampaignBackup([
      TSI.storeRules.makeRecord('tsi.explorer.save', ER.toSave(ex), new Date()),
      TSI.storeRules.makeRecord('tsi.bastion.state', BR.toSave(b), new Date())
    ], new Date(), 'suite');
    var parsed = BK.parse(JSON.stringify(file));
    t.ok(parsed.ok);
    var exBack = ER.fromSave(parsed.backup.records.filter(function (r) { return r.key === 'tsi.explorer.save'; })[0].value, ED, E);
    var bBack = BR.fromSave(parsed.backup.records.filter(function (r) { return r.key === 'tsi.bastion.state'; })[0].value, bdata);
    t.same(exBack.journey.outbox, copy(ex.journey.outbox));
    t.equal(J.itemQty(exBack, J.CHART), 3);
    t.equal(bBack.honourRespectByClan.slade, 1);
    t.equal(BR.applyInbox(bBack, bdata, saved(exBack), 2000).changed, false, 'nothing twice');
  });
}());
