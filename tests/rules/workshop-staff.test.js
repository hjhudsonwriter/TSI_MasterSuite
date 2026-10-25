/* The Workshop's staff (Strip Back Overhaul, step S12, 22 October 2026; Harry's decisions in docs/STRIP-BACK-PLAN.md, decision 10,
   the design in docs/strip-back/E-workshop-dev.md): five staff open one by one as the Workshop is upgraded (Handyman, Smith,
   Scholar, Alchemist, Artisan); each does ONE job at a time and the five work side by side; the Artisan Tools card is gone; the
   Library & Scriptorium and Arcane Laboratory are folded into the Scholar and Alchemist. The data is in
   tools/bastion/data/facilities-data.js, the rules in tools/bastion/rules.js, and the conversion of an old Bastion in
   tools/bastion/strip-back-rules.js (step workshopStaff). */
(function () {
  var R = TSI.bastion.rules;
  var C = TSI.campaign;
  var T = window.TSI_DATA;
  var FIX = window.TSI_FIXTURES || {};
  var canon = R.stripBackCanon;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var WS = R.facility(data, 'workshop');

  function dice(list) { var i = 0; return function () { var v = list[i % list.length]; i++; return v; }; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  /* A Bastion with the Workshop at a level. */
  function bastion(level) {
    var b = R.defaultState(data);
    b.day = 10;
    b.anchored = true;
    b.partyLevel = 1;
    b.treasuryGP = 0;
    b.facilityLevels.workshop = level || 1;
    return b;
  }
  function issue(b, fnId, idx) { return R.issueOrder(b, data, 'workshop', fnId, idx || 0, dice([0.3])); }
  function fnOf(id) { return R.fn(WS, id); }
  function unique(list) { return list.filter(function (x, i) { return list.indexOf(x) === i; }); }
  function itemsOf(fnId) {
    var fn = fnOf(fnId);
    return fn.craftTables ? R.craftItemsFor(data, fn, 1) : fn.options.map(function (o) { return o.label; });
  }
  function convert(raw) {
    var res = R.migrateToV4(raw, data);
    res.problems = R.stripBackAudit(res.before, res.save, res.report, data);
    return res;
  }
  /* A plain version 3 Bastion on Day 12. */
  function v3(fn) {
    var s = copy(R.toSave(R.defaultState(data)));
    s.v = 3;
    s.builtFacilities = ['barracks', 'armoury', 'watchtower', 'workshop', 'dock'];
    s.facilityLevels = Object.assign({ barracks: 1, armoury: 1, watchtower: 1 }, s.facilityLevels);
    s.day = 12;
    s.anchored = true;
    s.treasuryGP = 400;
    s.partyLevel = 13;
    delete s.partyName;
    if (fn) fn(s);
    return s;
  }
  function pending(id, facId, fnId, label, optionLabel, dueDay, extra) {
    return Object.assign({ id: id, facId: facId, fnId: fnId, chosen: optionLabel ? { label: optionLabel } : null, optionLabel: optionLabel || null, notes: '', label: label, costGP: 0, issuedDay: dueDay - 4, dueDay: dueDay }, extra || {});
  }
  function finish(s, o) {
    var lines = R.completeSimpleOrder(s, data, o, dice([0.3]));
    R.removeOrder(s, o.id);
    return lines;
  }

  /* ---------------------------------------------------------------- */
  group('Workshop staff: the five, and what each opens at');

  test('five staff open one by one: Handyman 1, Smith 2, Scholar 3, Alchemist 4, Artisan 5; the Workshop is not raised by the change', function (t) {
    t.same(R.workshopStaff(data).map(function (s) { return [s.id, s.name, s.level]; }),
      [['handyman', 'Handyman', 1], ['smith', 'Smith', 2], ['scholar', 'Scholar', 3], ['alchemist', 'Alchemist', 4], ['artisan', 'Artisan', 5]]);
    t.same(R.workshopStaff(data).filter(function (s) { return s.placeholder; }).map(function (s) { return s.id; }), ['handyman', 'artisan'], 'the Handyman and the Artisan are marked placeholders in the data');
    t.ok(/PLACEHOLDER/.test(R.workshopStaff(data)[0].note) && /to come/.test(R.workshopStaff(data)[4].note));
    t.equal(R.defaultState(data).facilityLevels.workshop === undefined || R.defaultState(data).facilityLevels.workshop === 1, true, 'a new Workshop starts at Level 1');
    R.workshopStaff(data).forEach(function (st) {
      R.staffOrders(WS, st.id).forEach(function (fn) {
        t.equal(fn.requiredFacilityLevel || 1, st.level, st.name + ': ' + fn.id + ' opens at the staff member\'s level');
      });
    });
    t.same(R.staffOrders(WS, 'artisan'), [], 'the Artisan has no orders of his own yet (Extra options: to come)');
    t.same(R.staffOrders(WS, 'smith').map(function (f) { return f.id; }), ['craft_smith'], 'the retired Smithing is not offered');
  });

  test('a locked staff member\'s orders say which level opens them, and open when the Workshop reaches it', function (t) {
    var b = bastion(1);
    t.ok(issue(b, 'craft').ok, 'the Handyman works from Level 1');
    [['craft_smith', 2], ['craft_scholar', 3], ['research', 3], ['prepare_overland_travel_charts', 3], ['craft_alchemist', 4], ['alchemy', 4], ['craft_common', 4], ['craft_uncommon', 4]].forEach(function (p) {
      t.equal(issue(b, p[0]).message, 'Needs Level ' + p[1] + '.', p[0]);
      var open = bastion(p[1]);
      t.ok(issue(open, p[0]).ok, p[0] + ' opens at Level ' + p[1]);
    });
    t.equal(R.upgradeCheck(bastion(1), data, 'workshop').ok, true, 'the Workshop upgrades as before');
    t.equal(R.levelUnlocks(data, 'workshop', 4)[0].indexOf('The Alchemist'), 0, 'the Upgrade row names who opens next');
  });

  /* ---------------------------------------------------------------- */
  group('Workshop staff: what each one makes');

  test('the Handyman (a placeholder) crafts from the six tool tables nobody else claims, 3 days each', function (t) {
    var fn = fnOf('craft');
    t.equal(fn.days, 3);
    t.same(fn.craftTables, ['Weaver’s Tools', 'Leatherworker’s Tools', 'Carpenter’s Tools', 'Mason’s Tools', 'Glassblower’s Tools', 'Brewer’s Supplies']);
    var items = itemsOf('craft');
    t.equal(items.length, unique(items).length, 'each item once ("Backpack" is in two tables)');
    var others = [].concat(data.tools['Smith’s Tools'], data.tools['Alchemist’s Supplies'], data.tools['Calligrapher’s Supplies']);
    t.same(items.filter(function (i) { return others.indexOf(i) !== -1; }), [], 'nothing another staff member claims');
    t.equal(items.length, unique([].concat.apply([], fn.craftTables.map(function (n) { return data.tools[n]; }))).length, 'every item of the six tables');
    t.ok(items.length > 90 && items.indexOf('Backpack') !== -1 && items.indexOf('Stained glass window') !== -1);
    t.ok(fn.placeholder === true && /PLACEHOLDER/.test(fn.notes), 'marked in the data');
    var b = bastion(1);
    var o = (issue(b, 'craft', items.indexOf('Backpack')), b.pendingOrders[0]);
    t.same([o.dueDay - o.issuedDay, o.optionLabel, o.label], [3, 'Backpack', 'Workshop: Handyman - Backpack']);
  });

  test('the Smith crafts Smith\'s Tools (30 items), the Scholar Calligrapher\'s Supplies (12), 3 days each; the old Smithing is retired but would still finish', function (t) {
    t.same(itemsOf('craft_smith'), data.tools['Smith’s Tools'].slice().sort(function (a, b) { return a.localeCompare(b); }));
    t.equal(itemsOf('craft_smith').length, 30);
    t.equal(itemsOf('craft_scholar').length, data.tools['Calligrapher’s Supplies'].length);
    t.same([fnOf('craft_smith').days, fnOf('craft_scholar').days], [3, 3]);
    var smithing = fnOf('smithing');
    t.ok(smithing.retired === true && /RETIRED/.test(smithing.notes), 'a hidden retired note');
    var b = bastion(5);
    t.equal(R.fnAvailable(b, WS, smithing).hidden, true, 'never offered');
    t.equal(issue(b, 'smithing').ok, false);
    var old = pending('sm', 'workshop', 'smithing', 'Workshop: Smithing (Dagger)', 'Dagger', 12);
    b.pendingOrders.push(old);
    t.equal(R.orderKind(data, old), 'simple');
    t.same(finish(b, old), [['Order Completed', 'Workshop: Smithing (Dagger) → Added to Warehouse.']]);
    t.equal(b.warehouse[0].item, 'Dagger');
    t.equal(R.staffBusy(bastion(5), data, WS, fnOf('craft_smith')), null, 'and a finished one blocks nothing');
    var smithBusy = bastion(5);
    smithBusy.pendingOrders.push(pending('sm2', 'workshop', 'smithing', 'Workshop: Smithing (Dagger)', 'Dagger', 12));
    t.ok(/^The Smith is busy/.test(R.staffBusy(smithBusy, data, WS, fnOf('craft_smith'))), 'a Smithing order already running keeps the Smith busy');
  });

  test('the Scholar: Research (4 scriptures, 5 days) and Prepare Overland Travel Charts (4 days, no gold, 1 Overland chart), as the Library gave them', function (t) {
    t.same([fnOf('research').days, fnOf('prepare_overland_travel_charts').days], [5, 4]);
    t.same(itemsOf('research'), ['Geographical Scriptures', 'Religious Scriptures', 'Combat Scriptures', 'Political scriptures']);
    var b = bastion(3);
    var o = (issue(b, 'prepare_overland_travel_charts'), b.pendingOrders[0]);
    t.same([o.costGP, o.label, o.dueDay], [0, 'Workshop: Scholar - Prepare Overland Travel Charts', 14]);
    t.same(finish(b, o), [['Order Completed', 'Workshop: Scholar - Prepare Overland Travel Charts → Added to Warehouse: 1 Overland chart.']]);
    t.equal(R.goodsQty(b, 'overland_chart'), 1, 'the chart source the Explorer and the Courier read');
  });

  test('the Alchemist: 33 items and no party level; the 17 Alchemist\'s Supplies at 3 days, the 3 extra poisons at 5, Craft Common (4) at 5 and Craft Uncommon (9) at 10; the three duplicate potions are left out', function (t) {
    var mine = R.staffOrders(WS, 'alchemist');
    t.same(mine.map(function (f) { return [f.id, f.days]; }), [['craft_alchemist', 3], ['alchemy', 5], ['craft_common', 5], ['craft_uncommon', 10]]);
    var all = [].concat.apply([], mine.map(itemsOf2));
    function itemsOf2(fn) { return itemsOf(fn.id); }
    t.equal(all.length, 33);
    t.equal(unique(all).length, 33, 'no item twice');
    t.equal(itemsOf('craft_alchemist').length, 17);
    t.same(itemsOf('alchemy'), ['Burnt Othur Fumes (Poison)', 'Essence of Ether (Poison)', 'Torpor (Poison)']);
    t.equal(itemsOf('craft_common').length, 4);
    t.equal(itemsOf('craft_uncommon').length, 9);
    var lower = all.map(function (x) { return x.toLowerCase(); });
    ['potion of climbing', 'potion of resistance', 'potion of water breathing'].forEach(function (p) {
      t.equal(lower.filter(function (x) { return x === p || x === p + ' (base item)'; }).length, 1, p + ' is offered once');
    });
    mine.forEach(function (fn) { t.equal(fn.requiredPartyLevel, undefined, fn.id + ' has no party-level gate'); });
    var b = bastion(4);
    b.partyLevel = 1;
    t.ok(issue(b, 'craft_alchemist').ok && issue(b, 'alchemy').ok === false, 'one job at a time, and no party level needed');
  });

  test('Craft Magic Item stays a separate order: 22 items, 10 days, no staff, no party-level gate, from Level 1', function (t) {
    var fn = fnOf('craft_magic_item');
    t.same([fn.options.length, fn.days, fn.staff, fn.requiredPartyLevel, fn.requiredFacilityLevel], [22, 10, undefined, undefined, undefined]);
    var b = bastion(1);
    b.partyLevel = 1;
    t.ok(issue(b, 'craft_magic_item').ok);
    t.equal(R.staffBusy(b, data, WS, fn), null, 'no staff member to be busy');
    t.ok(issue(b, 'craft').ok, 'and it runs beside the Handyman');
    ['Dread Helm', 'Moon-Touched Sword', 'Smoldering Armor'].forEach(function (name) {
      var made = R.workshopStaff(data).some(function (st) { return R.staffOrders(WS, st.id).some(function (f) { return itemsOf(f.id).indexOf(name) !== -1; }); }) || fn.options.some(function (o) { return o.label === name; });
      t.equal(made, false, name + ' is craftable by nobody');
    });
  });

  /* ---------------------------------------------------------------- */
  group('Workshop staff: one job at a time, five in parallel');

  test('each staff member does one job at a time and says who is busy; the others carry on', function (t) {
    var b = bastion(5);
    var first = issue(b, 'craft_alchemist');
    t.ok(first.ok);
    var alch = b.pendingOrders[0];
    ['craft_alchemist', 'alchemy', 'craft_common', 'craft_uncommon'].forEach(function (id) {
      var r = issue(b, id);
      t.same([r.ok, r.message], [false, 'The Alchemist is busy: ' + alch.label + ', due on Day ' + alch.dueDay + '.'], id);
    });
    ['craft', 'craft_smith', 'research'].forEach(function (id) { t.ok(issue(b, id).ok, id + ': another staff member is free'); });
    t.equal(issue(b, 'craft_scholar').ok, false, 'the Scholar is now busy with Research');
    t.equal(b.pendingOrders.length, 4, 'four at once');
    t.ok(issue(b, 'craft_magic_item').ok, 'and Craft Magic Item beside them');
    t.equal(b.pendingOrders.length, 5);
    b.day = alch.dueDay;
    finish(b, alch);
    t.ok(issue(b, 'alchemy').ok, 'the Alchemist is free again once the job is done');
    var up = bastion(1);
    t.ok(R.issueUpgrade(up, data, 'workshop', dice([0.3])).ok);
    t.ok(issue(up, 'craft').ok, 'an upgrade does not keep a staff member busy');
  });

  test('a cancelled job frees the staff member; the same order cannot be issued twice by one of them', function (t) {
    var b = bastion(2);
    t.ok(issue(b, 'craft_smith').ok);
    t.equal(issue(b, 'craft_smith').ok, false);
    R.cancelOrder(b, b.pendingOrders[0].id, data);
    t.ok(issue(b, 'craft_smith', 3).ok);
  });

  test('the Artisan hook: extra options join each craft list only at Level 5, once supplied; nothing is invented', function (t) {
    t.ok(WS.functions.filter(function (f) { return f.craftTables; }).every(function (f) { return Array.isArray(f.artisanExtras) && f.artisanExtras.length === 0; }), 'every list has an empty hook');
    var fn = copy(fnOf('craft_smith'));
    fn.artisanExtras = ['Zweihander'];
    t.equal(R.craftItemsFor(data, fn, 4).indexOf('Zweihander'), -1, 'not before Level 5');
    t.ok(R.craftItemsFor(data, fn, 5).indexOf('Zweihander') !== -1, 'at Level 5');
    t.equal(R.craftItemsFor(data, fnOf('craft_smith'), 5).length, 30, 'nothing added today');
  });

  test('a craft order made before the change finishes: a pending Craft with a chosen item completes, whichever list it came from', function (t) {
    var b = bastion(1);
    var old = { id: 'o1', facId: 'workshop', fnId: 'craft', chosen: { label: 'Longsword', craftItem: 'Longsword' }, optionLabel: 'Longsword', notes: '', label: 'Workshop: Craft (Longsword)', costGP: 0, issuedDay: 9, dueDay: 12 };
    b.pendingOrders.push(old);
    t.same(finish(b, old), [['Order Completed', 'Workshop: Craft (Longsword) → Crafted: Longsword.']]);
    t.equal(b.warehouse[0].item, 'Longsword');
  });

  test('the Compendium follows the staff: each list shows who crafts it, and the three Armaments items are Compendium only', function (t) {
    var idx = R.compendiumIndex(data.facilities, data.tools);
    function by(item) { return idx.links[item].map(function (l) { return l.fnLabel; }); }
    t.ok(by('Longsword').indexOf('Craft (Smith)') !== -1);
    t.ok(by('Backpack').indexOf('Craft (Handyman)') !== -1);
    t.ok(by('Chart of Southern Province').indexOf('Craft (Scholar)') !== -1);
    t.ok(by('Acid vial').indexOf('Craft (Alchemist)') !== -1);
    t.ok(by('Geographical Scriptures').indexOf('Research') !== -1);
    ['Dread Helm', 'Moon-Touched Sword', 'Smoldering Armor'].forEach(function (n) { t.same(by(n), ['Compendium only'], n); });
    t.equal(JSON.stringify(idx.links).indexOf('Artisan Tools'), -1, 'no word of the Artisan Tools');
    t.equal(idx.items.filter(function (k) { return !idx.links[k].length; }).length, 0);
  });

  /* ---------------------------------------------------------------- */
  group('Workshop staff: the conversion of an old Bastion (step workshopStaff)');

  /* A Bastion with a Library at Level 2 and a Laboratory, each with orders, six Artisan Tools picked and the Smithy. */
  function old() {
    return v3(function (s) {
      s.builtExtras = [{ facId: 'library_scriptorium', status: 'built' }, { facId: 'arcane_laboratory', status: 'built' }, { facId: 'hall_of_emissaries', status: 'built' }];
      s.facilityLevels = Object.assign(s.facilityLevels, { library_scriptorium: 2, arcane_laboratory: 3 });
      s.repairs = {};
      s.research = { herbal_gardens: { agricultural: ['fertile_soil'] } };
      s.artisanTools = ['Smith’s Tools', 'Alchemist’s Supplies', 'Weaver’s Tools', 'Calligrapher’s Supplies', '', ''];
      s.legacyFacilities = ['smithy'];
      s.pendingOrders = [
        pending('r', 'library_scriptorium', 'research', 'Library & Scriptorium: Research (Combat Scriptures)', 'Combat Scriptures', 17, { notes: 'x' }),
        pending('c', 'library_scriptorium', 'prepare_overland_travel_charts', 'Library & Scriptorium: Prepare Overland Travel Charts', '1 Overland chart', 16, { chosen: { label: '1 Overland chart', outputs: [{ good: 'overland_chart', qty: 1 }] } }),
        pending('a', 'arcane_laboratory', 'craft_common', 'Arcane Laboratory: Craft Common (Potion of Climbing)', 'Potion of Climbing', 15, { costGP: 25 }),
        pending('b', 'arcane_laboratory', 'craft_uncommon', 'Arcane Laboratory: Craft Uncommon (Potion of Resistance)', 'Potion of Resistance', 20),
        pending('d', 'arcane_laboratory', 'alchemy', 'Arcane Laboratory: Alchemy (Antitoxin)', 'Antitoxin', 16),
        pending('u', 'library_scriptorium', 'upgrade', 'Library & Scriptorium: Upgrade to Level 3', null, 26, { meta: { kind: 'upgrade', toLevel: 3 } }),
        pending('w', 'workshop', 'craft', 'Workshop: Craft (Dagger)', 'Dagger', 14, { chosen: { label: 'Dagger', craftItem: 'Dagger' } }),
        pending('m', 'workshop', 'smithing', 'Workshop: Smithing (Mace)', 'Mace', 13)
      ];
    });
  }

  test('the Library\'s and Laboratory\'s orders MOVE to the Workshop with their ids, days and choices; the Upgrade is cancelled; the slots and levels go; research and everything else stay', function (t) {
    var raw = old();
    var before = canon(raw);
    var res = convert(raw);
    t.equal(canon(raw), before, 'the save it was given is untouched');
    t.same(res.problems, [], 'the audit is clean');
    var s = res.save;
    t.same(s.pendingOrders.map(function (o) { return [o.id, o.facId, o.fnId, o.dueDay, o.label]; }), [
      ['r', 'workshop', 'research', 17, 'Workshop: Scholar - Research (Combat Scriptures)'],
      ['c', 'workshop', 'prepare_overland_travel_charts', 16, 'Workshop: Scholar - Prepare Overland Travel Charts'],
      ['a', 'workshop', 'craft_common', 15, 'Workshop: Alchemist - Craft Common (Potion of Climbing)'],
      ['b', 'workshop', 'craft_uncommon', 20, 'Workshop: Alchemist - Craft Uncommon (Potion of Resistance)'],
      ['d', 'workshop', 'alchemy', 16, 'Workshop: Alchemist - Alchemy (Antitoxin)'],
      ['w', 'workshop', 'craft', 14, 'Workshop: Craft (Dagger)'],
      ['m', 'workshop', 'smithing', 13, 'Workshop: Smithing (Mace)']
    ], 'moved orders keep id and due day; the Upgrade (free) is cancelled; the Handyman\'s and the Smith\'s old orders are kept as they were');
    t.equal(s.pendingOrders[2].costGP, 25, 'what it cost stays');
    t.same(s.pendingOrders[0].chosen, { label: 'Combat Scriptures' }, 'and the chosen item');
    t.same(res.report.cancelled.map(function (c) { return c.id; }), ['u']);
    t.same(res.report.moved.map(function (m) { return m.id; }), ['r', 'c', 'a', 'b', 'd']);
    t.same(s.builtExtras.filter(Boolean).map(function (e) { return e.facId; }), ['hall_of_emissaries'], 'both slots are free');
    t.same(['library_scriptorium', 'arcane_laboratory'].filter(function (id) { return id in s.facilityLevels; }), [], 'levels of the two places are gone');
    t.same(s.research, raw.research, 'research state is kept as it was');
    t.equal(s.facilityLevels.workshop, 1, 'the Workshop\'s own level is NOT raised');
    t.same(s.archivedFacilities.filter(function (a) { return /^(library|arcane)/.test(a.facId); }).map(function (a) { return [a.facId, a.name, a.status]; }), [['library_scriptorium', 'Library & Scriptorium', 'built'], ['arcane_laboratory', 'Arcane Laboratory', 'built']]);
    t.same(['artisanTools', 'legacyFacilities'].filter(function (k) { return k in s; }), [], 'the Artisan Tools and the retired-buildings list are dropped');
    t.equal(s.v, 4);
    var loaded = R.fromSave(copy(raw), data);
    t.same(['artisanTools', 'legacyFacilities'].filter(function (k) { return k in loaded; }), []);
  });

  test('the report says it in plain English: where the jobs went, which level opens them, which tables were chosen and where each went', function (t) {
    var res = convert(old());
    var text = res.report.lines.join('\n');
    t.ok(/Library & Scriptorium and the Arcane Laboratory have joined the Workshop/.test(text), text);
    t.ok(/the Scholar \(Research and Prepare Overland Travel Charts; opens at Workshop Level 3\)/.test(text));
    t.ok(/the Alchemist \(Craft Common, Craft Uncommon and Alchemy; opens at Workshop Level 4\)/.test(text));
    t.ok(/Workshop's own level has not been raised/.test(text) && /your Library & Scriptorium was at Level 2/.test(text), 'the Level 2 versus Level 3 change is said');
    t.ok(/The Artisan Tools card is gone\. You had chosen Smith’s Tools, Alchemist’s Supplies, Weaver’s Tools and Calligrapher’s Supplies/.test(text), text);
    t.ok(/Smith’s Tools now belongs to the Smith \(opens at Workshop Level 2\)/.test(text));
    t.ok(/Weaver’s Tools now belongs to the Handyman \(opens at Workshop Level 1; his list is a placeholder until you supply it\)/.test(text));
    t.ok(/Smithy's old Smithing order is replaced by the Smith's Craft/.test(text));
    t.ok(/Upgrade to Level 3/.test(text) && /nothing to upgrade/.test(text), 'the cancelled upgrade is listed with its reason');
    t.equal(res.report.gold.refunded, 0, 'free: nothing to give back');
  });

  test('every moved order still completes, once, with the same result as before: a chart into the Warehouse, a scripture, a potion', function (t) {
    var s = R.fromSave(copy(old()), data);
    t.same(s.pendingOrders.map(function (o) { return o.id; }), ['r', 'c', 'a', 'b', 'd', 'w', 'm']);
    s.day = 20;
    var lines = [];
    R.dueOrders(s).slice().forEach(function (o) { R.completeSimpleOrder(s, data, o, dice([0.3])).forEach(function (l) { lines.push(l[1]); }); R.removeOrder(s, o.id); });
    t.equal(s.pendingOrders.length, 0);
    t.equal(R.goodsQty(s, 'overland_chart'), 1, 'one chart');
    var items = s.warehouse.filter(function (w) { return !w.goodId; }).map(function (w) { return w.item; }).sort();
    t.same(items, ['Antitoxin', 'Combat Scriptures', 'Dagger', 'Mace', 'Potion of Climbing', 'Potion of Resistance']);
    t.equal(lines.length, 7);
    t.ok(lines.indexOf('Workshop: Alchemist - Craft Common (Potion of Climbing) → Added to Warehouse.') !== -1, lines.join(' | '));
  });

  test('a Library or Laboratory under construction just stops; a Library at Level 1 with no orders; the Workshop already at Level 3 needs no warning', function (t) {
    var res = convert(v3(function (s) {
      s.builtExtras = [{ facId: 'library_scriptorium', status: 'building', startDay: 5, readyDay: 26 }, ''];
      s.facilityLevels.workshop = 4;
    }));
    t.same(res.problems, []);
    t.same(res.save.builtExtras.filter(Boolean), []);
    var text = res.report.lines.join(' ');
    t.ok(/Building work on the Library & Scriptorium stopped/.test(text), text);
    t.equal(/has not been raised: /.test(text), false, 'no warning when the Workshop is already high enough');
    t.equal(res.save.facilityLevels.workshop, 4);
  });

  test('converting again changes nothing, and a save with nothing of the sort has no mention of the Workshop', function (t) {
    var res = convert(old());
    t.equal(R.needsStripBack(res.save, data), false);
    t.equal(canon(R.migrateToV4(res.save, data).save), canon(res.save));
    var plain = convert(v3());
    t.equal(/Workshop/.test(plain.report.lines.join(' ')), false, 'nothing said when there was nothing to say');
    t.equal(plain.save.artisanTools, undefined);
    /* An older copy of the suite saves Library orders back into a version 4 Bastion: converted again. */
    var again = copy(res.save);
    again.pendingOrders.push(pending('z', 'library_scriptorium', 'research', 'Library & Scriptorium: Research (Combat Scriptures)', 'Combat Scriptures', 30));
    again.facilityLevels.library_scriptorium = 1;
    t.ok(R.stripBackLeftovers(again, data).some(function (x) { return x.step === 'workshopStaff'; }));
    var fixed = convert(again);
    t.same(fixed.problems, []);
    t.equal(fixed.save.pendingOrders[fixed.save.pendingOrders.length - 1].facId, 'workshop');
    t.equal('library_scriptorium' in fixed.save.facilityLevels, false);
  });

  test('a v 2 save with a Library, Laboratory and Smithy goes through version 3 and then here, with the orders still due on their days', function (t) {
    var raw = copy(R.toSave(R.defaultState(data)));
    raw.v = 2; raw.day = 12; raw.anchored = true; raw.partyLevel = 13;
    delete raw.archivedFacilities; delete raw.migration; delete raw.partyName; delete raw.legacyFacilities;
    raw.builtExtras = [{ facId: 'library', status: 'built' }, { facId: 'laboratory', status: 'built' }, { facId: 'smithy', status: 'built' }];
    raw.pendingOrders = [
      pending('L', 'library', 'research', 'Library: Research (Combat Scriptures)', 'Combat Scriptures', 19),
      pending('B', 'laboratory', 'craft', 'Laboratory: Craft (Potion of Healing)', 'Potion of healing (common)', 16),
      pending('S', 'smithy', 'craft', 'Smithy: Craft (Dagger)', 'Dagger', 16)
    ];
    raw.artisanTools = ['Smith’s Tools', '', '', '', '', ''];
    var res = convert(raw);
    t.same(res.problems, []);
    t.same(res.save.pendingOrders.map(function (o) { return [o.id, o.facId, o.fnId, o.dueDay]; }), [['L', 'workshop', 'research', 19], ['B', 'workshop', 'alchemy', 16], ['S', 'workshop', 'smithing', 16]]);
    t.same(res.save.builtExtras.filter(Boolean), []);
    t.equal(res.save.legacyFacilities, undefined);
  });

  test('every fixture, including the heavy one with a Library at Level 2: the Workshop step leaves a clean, audited, repeatable result', function (t) {
    var checked = 0;
    Object.keys(FIX).forEach(function (name) {
      var res = convert(FIX[name]);
      t.same(res.problems, [], name + ': audit');
      var s = res.save;
      t.equal(R.stripBackLeftovers(s, data).filter(function (x) { return x.step === 'workshopStaff'; }).length, 0, name + ': nothing left');
      t.same(['library_scriptorium', 'arcane_laboratory'].filter(function (id) {
        return JSON.stringify(s.pendingOrders.map(function (o) { return o.facId; })).indexOf(id) !== -1 || s.builtExtras.concat(s.builtPlots || []).some(function (e) { return e && e.facId === id; }) || id in s.facilityLevels;
      }), [], name + ': no trace of the two places');
      t.equal('artisanTools' in s || 'legacyFacilities' in s, false, name);
      checked += 1;
    });
    t.ok(checked >= 8);
    var heavy = convert(FIX['bastion-v3-heavy']);
    t.same(heavy.save.pendingOrders.filter(function (o) { return ['hv-13', 'hv-14', 'hv-15', 'hv-16'].indexOf(o.id) !== -1; }).map(function (o) { return [o.id, o.facId, o.fnId]; }),
      [['hv-13', 'workshop', 'research'], ['hv-14', 'workshop', 'prepare_overland_travel_charts'], ['hv-15', 'workshop', 'craft_common'], ['hv-16', 'workshop', 'alchemy']]);
    var text = heavy.report.lines.join(' ');
    t.ok(/Herbalism Kit is no longer used/.test(text), 'a chosen table that never had a home is said: ' + text);
    var lib = FIX['bastion-pr3-sample'];
    t.ok(JSON.stringify(lib.builtExtras).indexOf('library_scriptorium') !== -1, 'the older sample really holds a Library');
  });

  test('the forecast for a version 3 save read before it is converted agrees: the five orders carry on, anything else at the two places ends, and a Library being built is not forecast', function (t) {
    ['research', 'prepare_overland_travel_charts'].forEach(function (fn) { t.equal(C.cancelledByConversion({ facId: 'library_scriptorium', fnId: fn }), false, fn); });
    ['craft_common', 'craft_uncommon', 'alchemy'].forEach(function (fn) { t.equal(C.cancelledByConversion({ facId: 'arcane_laboratory', fnId: fn }), false, fn); });
    t.equal(C.cancelledByConversion({ facId: 'library_scriptorium', fnId: 'upgrade', meta: { kind: 'upgrade' } }), true);
    t.equal(C.cancelledByConversion({ facId: 'arcane_laboratory', fnId: 'mystery' }), true, 'one the Workshop does not give');
    /* The table the Bastion converts by and the one the Explorer forecasts by name the same orders. */
    ['library_scriptorium', 'arcane_laboratory'].forEach(function (id) {
      t.equal(C.RETIRED_FACILITIES[id], 'move');
      Object.keys({ research: 1, prepare_overland_travel_charts: 1, craft_common: 1, craft_uncommon: 1, alchemy: 1 }).forEach(function (fnId) {
        var raw = v3(function (s) { s.builtExtras = [{ facId: id, status: 'built' }]; s.pendingOrders = [pending('p', id, fnId, 'x', null, 20)]; });
        var res = convert(raw);
        var will = res.save.pendingOrders.length === 1;
        var mine = ({ library_scriptorium: ['research', 'prepare_overland_travel_charts'], arcane_laboratory: ['craft_common', 'craft_uncommon', 'alchemy'] })[id].indexOf(fnId) !== -1;
        t.equal(will, mine, id + '/' + fnId + ': the conversion moves it only if the Workshop gives it');
        t.equal(C.cancelledByConversion(raw.pendingOrders[0]), !will, id + '/' + fnId + ': the forecast agrees');
      });
    });
    var b = copy(R.toSave(R.defaultState(data)));
    b.v = 3; b.anchored = true; b.day = 10;
    b.builtExtras = [{ facId: 'library_scriptorium', status: 'building', startDay: 1, readyDay: 22 }];
    t.equal(JSON.stringify(C.bastionComing(b)).indexOf('Library'), -1, 'work on it stops at conversion, so it is not forecast');
  });
})();
