/* Scarlett Isles: Beast Handler — the words and shapes the screens draw (BH-1b,
   tools/beasthandler/model.js). */
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
    t.same(Object.keys(T.beastArt.species), ['wyvern', 'griffin', 'dire_wolf']);
  });

  test('the Home screen says the right friendly thing when there is nothing to list', function (t) {
    t.ok(/hasn't been saved yet/.test(M.homeMessage(null)));
    t.ok(/No beast buildings stand/.test(M.homeMessage({ facilities: [], handler: null })));
    t.ok(/no beasts yet.*DM has to house a beast first and then make you its handler/.test(M.homeMessage({ facilities: [{}], handler: { hasCreatures: false } })));
    t.ok(/Choose a handler/.test(M.homeMessage({ facilities: [{}], handler: null })));
    t.equal(M.homeMessage({ facilities: [{}], handler: { hasCreatures: true } }), '');
    t.equal(M.emptyBuilding({ species: { name: 'Dire Wolf' } }), 'No dire wolf is housed here yet.');
  });

  test('Chronicle categories have plain names, and an unknown one is capitalised, never dropped', function (t) {
    t.same(['training', 'bond', 'handler', 'flight', 'note'].map(M.catLabel), ['Training', 'Bond', 'Handler', 'Flight', 'Note']);
    t.equal(M.catLabel('memory'), 'Memory');
    t.equal(M.catLabel(''), 'Note');
  });

  test('the check-before-you-send screen lists creature, building, order, days, ready day, cost and what happens', function (t) {
    var d = { name: 'Stormwing', facility: { name: 'Wyvern Roost', level: 3 } };
    var o = { label: 'Safe Acclimatisation', daysText: '5 days', readyLabel: 'Day 15', costText: 'Free', consequence: 'When it finishes, Bond 1 is ready.' };
    t.same(M.confirmLines(d, o), [['Creature', 'Stormwing'], ['Building', 'Wyvern Roost, Level 3'], ['Order', 'Safe Acclimatisation'], ['Takes', '5 days'], ['Ready on', 'Day 15'], ['Cost', 'Free'], ['What happens', 'When it finishes, Bond 1 is ready.']]);
    o.consequence = '';
    t.equal(M.confirmLines(d, o).length, 6, 'no empty last line');
  });

  test('the connection line and the handler choices', function (t) {
    t.equal(M.syncLine({ ok: true, asOfLabel: 'Day 12' }), 'Read from the Bastion saved on this device · Day 12');
    t.equal(M.syncLine({ ok: false }), 'Not connected to a Bastion save.');
    t.same(M.handlerChoices([{ id: 'Mira', name: 'Mira', count: 2 }, { id: 'elara', name: 'Elara', count: 1 }]), [
      { value: '', label: 'No handler (see the directory only)' }, { value: 'Mira', label: 'Mira (2 beasts)' }, { value: 'elara', label: 'Elara (1 beast)' }]);
    t.equal(M.handlerChoices().length, 1);
  });

  test('a beast\'s requests: those sent and not yet answered come first, then the Bastion\'s answers; nobody else\'s beast shows', function (t) {
    var snap = { receipts: [
      { id: 'r3', type: 'order.request', state: 'scheduled', label: 'Stormwing: Safe Acclimatisation', why: '', creature: 'c1', dueDay: 15 },
      { id: 'r2', type: 'profile.set', state: 'saved', label: 'Stormwing (profile)', why: 'Saved.', creature: 'c1', dueDay: null },
      { id: 'r1', type: 'order.request', state: 'refused', label: 'Ashwing: X', why: 'The Roost is busy.', creature: 'c2', dueDay: null }] };
    var outbox = [{ id: 'w1', type: 'profile.set', creature: 'c1', fac: 'wyvern_roost', label: 'Stormwing (profile)', at: 5 }, { id: 'r3', type: 'order.request', creature: 'c1', fac: 'wyvern_roost', label: 'x', at: 4 }, { id: 'w2', type: 'profile.set', creature: 'c2', label: 'other', at: 9 }];
    var rows = M.requestRows(snap, outbox, 'c1');
    t.same(rows.map(function (r) { return r.id + ':' + r.state; }), ['w1:waiting', 'r3:scheduled', 'r2:saved']);
    t.equal(M.requestLine(rows[0]), 'Submitted, waiting for the Bastion to confirm. Nothing has started.');
    t.equal(M.requestLine(rows[1]), 'Accepted and scheduled in the Bastion: ready on Day 15.');
    t.equal(M.requestLine({ state: 'completed' }), 'Completed.');
    t.equal(M.requestLine({ state: 'saved' }), 'Saved in the Bastion.');
    t.equal(M.requestLine({ state: 'refused', why: 'The Roost is busy.' }), 'Refused: The Roost is busy.');
    t.same(M.requestRows(snap, outbox, 'c2').map(function (r) { return r.id; }), ['w2', 'r1']);
    t.equal(M.requestRows(null, [], 'c1').length, 0);
  });

  test('an order already sent for a building and not yet answered stops a second one being offered there', function (t) {
    var outbox = [{ id: 'a1', type: 'order.request', creature: 'c1', fac: 'wyvern_roost' }, { id: 'a2', type: 'profile.set', creature: 'c1', fac: 'wyvern_roost' }];
    t.equal(M.waitingOrderAt({ receipts: [] }, outbox, 'wyvern_roost').id, 'a1');
    t.equal(M.waitingOrderAt({ receipts: [] }, outbox, 'griffin_tower'), null, 'another building is not affected');
    t.equal(M.waitingOrderAt({ receipts: [{ id: 'a1' }] }, outbox, 'wyvern_roost'), null, 'answered');
  });

  test('the queue on this laptop keeps only well-formed requests, once each, and no more than 100', function (t) {
    var good = { v: 1, id: 'c-abcdefgh1', campaign: 'CAMPAIGN12345678', handler: 'mira', creature: 'c1', fac: 'wyvern_roost', type: 'order.request', view: 'abc', label: 'x', payload: { fnId: 'f' }, at: 1 };
    var q = M.cleanQueue({ commands: [good, good, { id: 'short' }, Object.assign({}, good, { id: 'c-abcdefgh2', type: 'bond.confirm' }), Object.assign({}, good, { id: 'c-abcdefgh3', payload: null }), null, 'x', Object.assign({}, good, { id: 'c-abcdefgh4', at: 'now' })] });
    t.same(q.commands.map(function (c) { return c.id; }), ['c-abcdefgh1']);
    t.same(M.cleanQueue(null), { commands: [] });
    var many = [];
    for (var i = 0; i < 130; i++) many.push(Object.assign({}, good, { id: 'c-many' + (1000 + i) }));
    var out = M.cleanQueue({ commands: many }).commands;
    t.equal(out.length, 100);
    t.equal(out[99].id, 'c-many1129', 'the newest are kept');
  });

  test('every Regional Variety in Harry\'s tables has its own picture, and no picture belongs to an unknown variety', function (t) {
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

  test('lines asked for and still waiting are laid over the Bastion\'s; the newest request wins; an answered one no longer counts', function (t) {
    var d = { id: 'c1', species: { id: 'wyvern', name: 'Wyvern' }, profile: { dominant: 'Proud', attachment: '', trigger: '', regional: '' } };
    var snap = { receipts: [] };
    var box = [
      { id: 'a', type: 'profile.set', creature: 'c1', label: 'x', at: 1, payload: { regional: 'Bleakhook', trigger: 'Storms' } },
      { id: 'b', type: 'profile.set', creature: 'c1', label: 'x', at: 2, payload: { regional: 'Widowspine' } },
      { id: 'o', type: 'order.request', creature: 'c1', label: 'x', at: 3, payload: { fnId: 'f' } },
      { id: 'z', type: 'profile.set', creature: 'other', label: 'x', at: 4, payload: { regional: 'Ironcrown' } }
    ];
    var pend = M.pendingProfile(snap, box, 'c1');
    t.same(pend, { trigger: 'Storms', regional: 'Widowspine' });
    t.same(M.effectiveProfile(d, pend), { dominant: 'Proud', attachment: '', trigger: 'Storms', regional: 'Widowspine' });
    t.same(M.effectiveProfile(d, null), { dominant: 'Proud', attachment: '', trigger: '', regional: '' });
    t.equal(M.pendingProfile({ receipts: [{ id: 'a', creature: 'c1', type: 'profile.set', state: 'saved' }, { id: 'b', creature: 'c1', type: 'profile.set', state: 'saved' }] }, box, 'c1'), null, 'answered');
    t.equal(M.pendingProfile(snap, [], 'c1'), null);
  });

  test('a beast is met once its subspecies is chosen (saved, or asked for and waiting), not before', function (t) {
    var d = { id: 'c1', name: 'Stormwing', species: { id: 'wyvern', name: 'Wyvern' }, profile: { dominant: 'Proud', attachment: 'x', trigger: 'y', regional: '' } };
    t.equal(M.needsMeeting(d, null), true, 'no subspecies yet');
    t.equal(M.needsMeeting(d, { regional: '  ' }), true, 'a blank one is not a choice');
    t.equal(M.needsMeeting(d, { regional: 'Widowspine' }), false, 'asked for and waiting');
    d.profile.regional = 'Bleakhook';
    t.equal(M.needsMeeting(d, null), false, 'saved');
  });

  test('a subspecies is waiting when the one shown differs from the Bastion\'s, clearing it included', function (t) {
    var d = { profile: { regional: 'Bleakhook' } };
    t.equal(M.regionalWaiting(d, null), false);
    t.equal(M.regionalWaiting(d, { regional: 'Bleakhook' }), false, 'the same thing again');
    t.equal(M.regionalWaiting(d, { regional: 'Widowspine' }), true);
    t.equal(M.regionalWaiting(d, { regional: '' }), true, 'emptying it is a change waiting too');
    t.equal(M.regionalWaiting(d, { trigger: 'Storms' }), false, 'another line is not the subspecies');
    t.equal(M.regionalWaiting({ profile: { regional: '' } }, { regional: ' ' }), false, 'a blank for a blank');
  });

  test('a refused profile request is found so the player can be told why; waiting or answered ones are not', function (t) {
    var refused = { receipts: [{ id: 'r1', creature: 'c1', type: 'profile.set', state: 'refused', why: 'That creature isn\u2019t yours any more.', label: 'x' }] };
    t.equal(M.refusedProfile(refused, [], 'c1').why, 'That creature isn\u2019t yours any more.');
    t.equal(M.refusedProfile(refused, [], 'other'), null, 'another beast');
    t.equal(M.refusedProfile(refused, [{ id: 'w', type: 'profile.set', creature: 'c1', label: 'x', at: 5, payload: { regional: 'Bleakhook' } }], 'c1'), null, 'a newer request is waiting: that is the one that counts');
    t.equal(M.refusedProfile({ receipts: [{ id: 'r2', creature: 'c1', type: 'profile.set', state: 'saved' }] }, [], 'c1'), null);
    t.equal(M.refusedProfile({ receipts: [{ id: 'r3', creature: 'c1', type: 'order.request', state: 'refused', why: 'busy' }] }, [], 'c1'), null, 'an order is not a profile request');
    t.equal(M.refusedProfile(null, [], 'c1'), null);
  });

  test('the meeting\'s words use the beast\'s name and kind', function (t) {
    var x = M.meetingText({ name: 'Stormwing', species: { name: 'Wyvern' } });
    t.equal(x.meet, 'It\u2019s time to meet Stormwing\u2026');
    t.equal(x.subspecies, 'There are many subspecies of wyvern in The Scarlett Isles, but which one is Stormwing?');
    t.equal(x.personality, 'Every wyvern has its own unique personality. What is Stormwing\u2019s like?');
    t.equal(x.welcome, 'Welcome to the Ironbow, Stormwing!');
    t.equal(M.meetingText({ name: 'Aurelius', species: { name: 'Dire Wolf' } }).personality, 'Every dire wolf has its own unique personality. What is Aurelius\u2019 like?');
  });
}());
