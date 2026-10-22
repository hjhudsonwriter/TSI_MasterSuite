/* Scarlett Isles: Beast Handler — the Bastion's side of the link (tools/beasthandler/bastion-link.js): the campaign
   id, the DM's profile edits, pairing and snapshot codes. Read-only since 22 October 2026: the request half
   (applying requests, receipts, the building lock, the queue) was removed with the Orders tab, so its tests went
   with it; what stays is what the Bastion still does. */
(function () {
  var BR = TSI.bastion.rules;
  var P = TSI.beasthandler.projection;
  var C = TSI.beasthandler.codes;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };

  var seed = 0;
  function rnd() { seed += 0.0137; return seed % 1 || 0.5; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function last(b) { return b.pendingOrders[b.pendingOrders.length - 1]; }
  function complete(b, o) { var l = BR.completeSimpleOrder(b, bdata, o, rnd); BR.removeOrder(b, o.id); return l; }
  var grantN = 100;

  function world(levels) {
    var lv = levels || {};
    var b = BR.defaultState(bdata);
    b.day = 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 400;
    b.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }, { facId: 'griffin_tower', status: 'built' }, { facId: 'dire_wolf_den', status: 'built' }];
    BR.ensureLevels(b, bdata);
    b.facilityLevels.wyvern_roost = lv.roost || 3;
    b.facilityLevels.griffin_tower = lv.tower || 2;
    b.facilityLevels.dire_wolf_den = lv.den || 2;
    BR.beastState(b);
    return b;
  }
  function grant(b, species, name) {
    grantN++;
    var gid = 'lk' + grantN + '-0a0b0c0d:dm:0';
    BR.applyInbox(b, bdata, { travel: { day: b.day }, journey: { outbox: [{ id: gid, type: 'creature', day: b.day, at: '2026-10-21T10:00:00.000Z', from: { code: 'DM', title: 'DM', step: 'dm' }, species: species, name: name, text: 'Granted' }] } }, 1000);
    return BR.creatureById(b, BR.creatureIdFor(gid));
  }
  var HOUSE = { wyvern: ['wyvern_roost', 'house_wyvern'], griffin: ['griffin_tower', 'house_griffin'], dire_wolf: ['dire_wolf_den', 'house_dire_wolf'] };
  function housed(b, species, name, handler) {
    var c = grant(b, species, name);
    var h = HOUSE[species];
    var idx = 0;
    BR.housingOptions(b, bdata, species).forEach(function (o, i) { if (o.creatureId === c.id) idx = i; });
    var r = BR.issueOrder(b, bdata, h[0], h[1], idx, rnd);
    if (!r.ok) throw new Error(r.message);
    complete(b, last(b));
    if (handler) BR.assignHandler(b, bdata, c.id, handler, '');
    return c;
  }
  function snapOf(b, who) { return P.build(b, bdata, who); }

  group('Beast Handler: the Bastion\'s side of the link (BH-2b, BH-3a; read-only from 22 October 2026)');

  test('the Bastion makes its own campaign id once, keeps it through saving, and reading never makes one', function (t) {
    var b = BR.defaultState(bdata);
    t.equal(BR.beastCampaignId(b), '');
    t.equal(snapOf(b, '').campaign, '');
    var id = BR.beastState(b).campaignId;
    t.ok(/^[A-Za-z2-9]{16}$/.test(id));
    t.equal(BR.beastState(b).campaignId, id);
    var again = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.equal(again.beast.campaignId, id);
    t.equal(snapOf(again, '').campaign, id);
    t.equal(BR.fromSave(copy(BR.toSave(BR.defaultState(bdata))), bdata).beast, undefined, 'a Bastion that never used it gains nothing');
  });

  test('the DM\'s profile change is applied once: the lines change, the Day Log and a change note say so, the Chronicle, bond and stats do not move', function (t) {
    var b = world();
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var chronBefore = JSON.stringify(c.development.chronicle);
    var bondBefore = JSON.stringify(c.development.bond);
    var warBefore = JSON.stringify(BR.creatureWar(bdata, c));
    var logBefore = b.log.length;
    var clean = TSI.beasthandler.profile.check({ dominant: 'Watchful', attachment: 'Lowers its head', trigger: 'Loud metallic ringing', regional: 'Widowspine' }).clean;
    var r = BR.setProfile(b, bdata, c.id, clean, 'Mira');
    t.equal(r.ok, true, JSON.stringify(r));
    t.same([c.development.temperament.dominant, c.development.temperament.attachment, c.development.temperament.trigger, c.development.regional], ['Watchful', 'Lowers its head', 'Loud metallic ringing', 'Widowspine']);
    t.equal(JSON.stringify(c.development.chronicle), chronBefore, 'the Chronicle is untouched');
    t.equal(JSON.stringify(c.development.bond), bondBefore, 'the bond is untouched');
    t.equal(JSON.stringify(BR.creatureWar(bdata, c)), warBefore, 'the stats are untouched');
    t.equal(b.log.length, logBefore + 1);
    t.ok(/Stormwing's profile was changed by Mira: Dominant Temperament \(blank\) → "Watchful"/.test(b.log[0].body), JSON.stringify(b.log[0]));
    t.equal(c.development.profileLog.length, 1);
    t.same(c.development.profileLog[0].change.dominant, { from: '', to: 'Watchful' });
    var logNow = b.log.length;
    t.same(BR.setProfile(b, bdata, c.id, clean, 'Mira').changed, [], 'the same lines again change nothing');
    t.equal(b.log.length, logNow, 'and say nothing');
    t.equal(BR.setProfile(b, bdata, 'nobody', clean, 'Mira').ok, false);
  });

  test('the DM can edit the Regional Variety too, and it survives a save; an empty one is cleared', function (t) {
    var b = world();
    var c = housed(b, 'dire_wolf', 'Ashfang', 'Joss');
    c.development.bond.level = 1;
    BR.setTemperament(b, bdata, c.id, { regional: '  Icepelt ' });
    t.equal(c.development.regional, 'Icepelt');
    var again = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.equal(BR.creatureById(again, c.id).development.regional, 'Icepelt');
    t.equal(snapOf(again, 'Joss').creatures[c.id].profile.regional, 'Icepelt');
    BR.setTemperament(b, bdata, c.id, { regional: '' });
    t.equal(c.development.regional, undefined);
    t.equal(BR.cleanDevelopment({ regional: '<b>x</b>' }).regional, 'b x /b', 'markup brackets are never kept');
    t.equal(BR.cleanDevelopment({ regional: '' }).regional, undefined, 'older saves are unchanged');
  });

  test('profile change notes survive saving and are capped; the campaign id and the handlers survive too', function (t) {
    var b = world();
    var c = housed(b, 'griffin', 'Swiftwing', 'Mira');
    for (var i = 0; i < 45; i++) BR.setProfile(b, bdata, c.id, { dominant: i % 2 ? 'Proud' : 'Wary' }, 'Mira');
    t.equal(c.development.profileLog.length, 40);
    var pair = BR.beastPair(b, bdata, 'Mira');
    t.equal(pair.ok, true);
    var again = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.equal(BR.creatureById(again, c.id).development.profileLog.length, 40);
    t.equal(again.beast.handlers[0].secret, pair.pairing.secret);
    t.equal(again.beast.campaignId, b.beast.campaignId);
    t.equal(BR.cleanBeast({ campaignId: 'short', handlers: [{ id: 'a', secret: 'tooshort' }] }).campaignId, '');
  });

  group('Beast Handler: a save from before the app became read-only (22 October 2026)');

  test('an old Beast Handler record (accept, done, floor) is loaded without a word and quietly dropped; the campaign id and the handlers stay', function (t) {
    var old = {
      campaignId: 'AbCdEfGh12345678', accept: false, floor: 1760000000000,
      handlers: [{ id: 'mira', name: 'Mira', secret: 'abcdefghijkmnpqrstuvwxyz', since: 4 }],
      done: { 'cmd-1-abcdef12': { r: 'applied', why: '', day: 4, at: 1760000000001, type: 'profile.set', handler: 'mira', who: 'Mira', creature: 'x', label: 'x (profile)', orderId: '', dueDay: null } }
    };
    var kept = BR.cleanBeast(copy(old));
    t.same(Object.keys(kept).sort(), ['campaignId', 'handlers']);
    t.equal(kept.campaignId, 'AbCdEfGh12345678');
    t.same(kept.handlers, [{ id: 'mira', name: 'Mira', secret: 'abcdefghijkmnpqrstuvwxyz', since: 4 }]);
    t.equal(JSON.stringify(BR.cleanBeast(copy(kept))), JSON.stringify(kept), 'cleaning again changes nothing');
    var b = BR.defaultState(bdata);
    b.beast = copy(old);
    var loaded = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.same(Object.keys(BR.toSave(loaded).beast).sort(), ['campaignId', 'handlers'], 'it is not written back');
    t.equal(loaded.beast.done, undefined);
    t.equal(loaded.beast.accept, undefined);
    t.equal(loaded.beast.floor, undefined);
    t.equal(BR.beastSecret(loaded, 'mira'), 'abcdefghijkmnpqrstuvwxyz', 'the handler\'s code still works');
  });

  test('every function of the request protocol is gone from the Bastion', function (t) {
    ['beastProcess', 'beastProcessQueue', 'beastProcessCode', 'beastReceiptsFor', 'beastRecent', 'BEAST_TYPES'].forEach(function (name) {
      t.equal(BR[name], undefined, name + ' is gone');
    });
    t.ok(typeof BR.beastPair === 'function' && typeof BR.beastRevoke === 'function' && typeof BR.beastSnapshotCode === 'function' && typeof BR.setProfile === 'function' && typeof BR.rollInitiation === 'function');
  });

  group('Beast Handler: the code swap, from the DM to a phone (BH-3a, 21 October 2026)');

  test('pairing makes a secret for a handler; a new code replaces the old; taking it back stops it; the secret is never in a snapshot', function (t) {
    var b = world();
    var c = housed(b, 'griffin', 'Swiftwing', 'Mira');
    t.equal(BR.beastSecret(b, 'Mira'), '');
    var p1 = BR.beastPair(b, bdata, 'Mira');
    t.same([p1.ok, p1.handler, p1.name], [true, 'mira', 'Mira']);
    t.equal(p1.pairing.campaign, b.beast.campaignId);
    t.equal(BR.beastSecret(b, 'MIRA'), p1.pairing.secret);
    var p2 = BR.beastPair(b, bdata, 'mira');
    t.ok(p2.pairing.secret !== p1.pairing.secret);
    t.equal(b.beast.handlers.length, 1);
    t.equal(BR.beastRegistry(b, bdata)[0].paired, true);
    c.development.bond.level = 1;
    var raw = JSON.stringify(snapOf(b, 'Mira')) + BR.beastSnapshotCode(b, bdata, 'mira').code;
    t.equal(raw.indexOf(p2.pairing.secret), -1);
    t.ok(JSON.stringify(b.log).indexOf(p2.pairing.secret) === -1, 'nor in the Day Log');
    t.equal(BR.beastRevoke(b, 'Mira').ok, true);
    t.equal(BR.beastSecret(b, 'Mira'), '');
    t.equal(BR.beastRevoke(b, 'Mira').ok, false);
    t.equal(BR.beastPair(b, bdata, '   ').ok, false);
    t.ok(/no longer open on their phone/.test(b.log[0].body), b.log[0].body);
  });

  test('a snapshot code opens with the pairing secret and holds the handler\'s own beasts, the campaign id, and a short Chronicle', function (t) {
    var b = world();
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var other = housed(b, 'wyvern', 'Ashwing', 'Joss');
    c.development.bond.level = 1;
    other.development.bond.level = 1;
    for (var i = 0; i < 60; i++) BR.addChronicleNote(b, bdata, c.id, 'A note number ' + i);
    var p = BR.beastPair(b, bdata, 'Mira');
    var res = BR.beastSnapshotCode(b, bdata, 'Mira');
    t.equal(res.ok, true);
    var d = C.decodeSnapshot(res.code, p.pairing.secret);
    t.equal(d.ok, true);
    t.equal(d.snapshot.campaign, b.beast.campaignId);
    t.same(Object.keys(d.snapshot.creatures), [c.id]);
    t.equal(d.snapshot.creatures[c.id].chronicle.length, 40);
    t.equal(d.snapshot.creatures[c.id].chroniclePartial, 21, '61 entries (60 notes and the handler line), 40 kept');
    t.equal(d.snapshot.creatures[c.id].chronicle[39].text, 'A note number 59', 'the latest are kept');
    t.equal(P.check(d.snapshot), '');
    t.equal(d.snapshot.version, 2);
    t.equal(BR.beastSnapshotCode(b, bdata, 'Joss').ok, false, 'no code for an unpaired handler');
    t.equal(C.decodeSnapshot(res.code, 'someone-elses-secret-abcd').ok, false);
  });

  group('Beast Handler: names that are also built-in words (the privacy review, 21 October 2026)');

  test('handlers, ids and categories named like built-in words (constructor, __proto__, toString) are harmless', function (t) {
    var b = world();
    var c = housed(b, 'griffin', 'Swiftwing', 'Constructor');
    var d = housed(b, 'griffin', 'Second', '__proto__');
    var before = Object.prototype.count;
    var hs = P.handlers(b, bdata);
    t.ok(hs.some(function (h) { return h.name === 'Constructor'; }), 'the DM can still pick it in Viewing as');
    t.equal(Object.prototype.count, before, 'nothing was added to every object on the page');
    t.equal(Object.keys(snapOf(b, 'constructor').creatures).length, 1);
    d.id = '__proto__';
    var s = snapOf(b, '__proto__');
    t.same(Object.keys(s.creatures), [], 'a creature id that is a built-in word is left out rather than breaking the map');
    t.equal(Object.getPrototypeOf(s.creatures), Object.prototype);
    BR.ensureDev(b, c).chronicle.push({ id: 'ch-x', day: 3, cat: 'constructor', text: 'odd category', by: 'DM', link: '' });
    t.equal(TSI.beasthandler.model.catLabel('constructor'), 'Constructor');
    t.equal(TSI.beasthandler.model.catLabel('toString'), 'ToString');
    t.same(BR.cleanBeast({ handlers: [{ id: '__proto__', name: 'x' }, { id: 'constructor', name: 'y' }, { id: 'mira', name: 'Mira' }] }).handlers.map(function (h) { return h.id; }), ['mira'], 'a handler named like a built-in word is left out rather than breaking anything');
    t.equal(Object.getPrototypeOf(BR.cleanBeast({ done: { '__proto__': { r: 'applied' } } })), Object.prototype);
  });

  group('Beast Handler: what the independent review found (21 October 2026)');

  test('a pasted code survives the extra invisible characters a chat app adds, and hostile text never throws', function (t) {
    var secret = 'abcdefghijklmnopqrstuvwx';
    var code = C.encodeSnapshot({ kind: 'x', hello: 'wyvern' }, secret);
    var messy = '​' + code.slice(0, 20) + '‍⁠' + code.slice(20) + '﻿‮';
    t.equal(C.tidy(messy), code);
    t.ok(C.decodeSnapshot(messy, secret).ok, 'zero-width characters are ignored');
    var lone = 'BHS1.' + code.split('.')[1] + '\ud800.' + code.split('.')[2];
    var r = C.decodeSnapshot(lone, secret);
    t.equal(r.ok, false);
    t.ok(/isn't a snapshot code/.test(r.why));
    t.equal(C.decodePairing('BHP1.\udfff').ok, false);
    t.equal(C.decodeSnapshot('BHS1.ab cd.zz', secret).ok, false);
  });

  test('a note\'s hidden direction marks are cleaned, the Arabic letter mark included', function (t) {
    t.equal(TSI.beasthandler.profile.clean('Proud؜⁠ and calm‮', 40), 'Proud and calm');
  });

  test('a snapshot code says when it was made, so a phone can tell a later paste is older', function (t) {
    var b = world();
    housed(b, 'wyvern', 'Stormwing', 'Mira');
    var pr = BR.beastPair(b, bdata, 'Mira');
    t.ok(pr.ok);
    var first = BR.beastSnapshotCode(b, bdata, 'mira');
    t.ok(first.ok && typeof first.snapshot.madeAt === 'number' && first.snapshot.madeAt > 1700000000000);
    var back = C.decodeSnapshot(first.code, BR.beastSecret(b, 'mira'));
    t.ok(back.ok && back.snapshot.madeAt === first.snapshot.madeAt, 'it travels in the signed code');
    t.equal(P.build(b, bdata, 'mira').madeAt, undefined, 'the player\'s view itself has no such field; only the code carries it');
  });
}());
