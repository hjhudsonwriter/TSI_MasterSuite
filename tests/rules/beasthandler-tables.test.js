/* Scarlett Isles: Beast Handler — Harry's profile tables (tools/beasthandler/data/profile-tables.js,
   21 October 2026). The words are Harry's, so these tests pin the shape and a spread of
   exact spellings; they are not a second copy of the tables. */
(function () {
  var T = window.TSI_DATA;
  var B = T.beastProfile;
  var KINDS = ['wyvern', 'griffin', 'dire_wolf'];

  group('Beast Handler: Harry\'s profile tables (21 October 2026)');

  test('one d12 Dominant Temperament table for every kind: 12 rows, rolls 1 to 12 in order, each with a note', function (t) {
    t.equal(B.dominant.dice, 12);
    t.same(B.dominant.entries.map(function (e) { return e.roll; }), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    t.same(B.dominant.entries.map(function (e) { return e.label; }),
      ['Proud', 'Territorial', 'Watchful', 'Curious', 'Independent', 'Protective', 'Stubborn', 'Patient', 'Excitable', 'Wary', 'Playful', 'Fiercely Loyal']);
    t.ok(B.dominant.entries.every(function (e) { return typeof e.note === 'string' && e.note.length > 5; }), 'every row has its interpretation');
    t.equal(B.dominant.entries[0].note, 'Expects respect and dislikes being hurried');
    t.equal(B.dominant.entries[11].note, 'Shows strong attachment to familiar individuals');
  });

  test('the Wyvern, Griffin and Dire Wolf each have a d8 Attachment Cue table, a d8 Instinctive Trigger table and five Regional Varieties', function (t) {
    t.same(Object.keys(B.species), KINDS);
    KINDS.forEach(function (k) {
      ['attachment', 'trigger'].forEach(function (which) {
        var tab = B.species[k][which];
        t.equal(tab.dice, 8, k + ' ' + which);
        t.same(tab.entries.map(function (e) { return e.roll; }), [1, 2, 3, 4, 5, 6, 7, 8], k + ' ' + which + ' rolls');
        t.ok(tab.entries.every(function (e) { return typeof e.label === 'string' && e.label.length > 2; }), k + ' ' + which + ' labels');
      });
      t.equal(B.species[k].regional.length, 5, k + ' varieties');
    });
  });

  test('Harry\'s exact words, a spread of them, spelt as he wrote them', function (t) {
    var S = B.species;
    t.equal(S.wyvern.attachment.entries[0].label, 'Low, contented rumble');
    t.equal(S.wyvern.attachment.entries[6].label, 'Recognises handler\'s footsteps');
    t.equal(S.wyvern.trigger.entries[2].label, 'Loud metallic ringing');
    t.equal(S.wyvern.trigger.entries[7].label, 'Rival wyvern nearby');
    t.equal(S.griffin.attachment.entries[3].label, 'Presents a loose feather');
    t.equal(S.griffin.attachment.entries[7].label, 'Answers handler\'s voice');
    t.equal(S.griffin.trigger.entries[1].label, 'Unfamiliar horses');
    t.equal(S.griffin.trigger.entries[7].label, 'Crowded nesting places');
    t.equal(S.dire_wolf.attachment.entries[7].label, 'Keeps watch while handler sleeps');
    t.equal(S.dire_wolf.trigger.entries[0].label, 'Restrictive chains');
    t.equal(S.dire_wolf.trigger.entries[6].label, 'Thunderstorms');
  });

  test('the fifteen Regional Varieties, by kind, with their areas', function (t) {
    function names(k) { return B.species[k].regional.map(function (r) { return r.name; }); }
    t.same(names('wyvern'), ['Widowspine', 'Bleakhook', 'Ironcrown', 'Bloodcrest', 'Shadowmount']);
    t.same(names('griffin'), ['Dawnmantle', 'Thunderwing', 'Silvershroud', 'Galeclaw', 'Embermantle']);
    t.same(names('dire_wolf'), ['Nightfang', 'Icepelt', 'Slatejaw', 'Reedshadow', 'Hollowhowl']);
    function area(k, n) { return B.species[k].regional.filter(function (r) { return r.name === n; })[0]; }
    t.same([area('wyvern', 'Widowspine').area, area('wyvern', 'Widowspine').where], ['The Black Straits', 'Sea stacks, storm-lashed cliffs and narrow coastal passages']);
    t.equal(area('wyvern', 'Bleakhook').area, 'North Isle');
    t.equal(area('wyvern', 'Bleakhook').where, 'Bleakharbour and the exposed northern coastline of Clan Karr');
    t.equal(area('dire_wolf', 'Icepelt').where, 'Bleaker\'s Bay, Bleakharbour and the northern coastal uplands');
    t.equal(area('griffin', 'Silvershroud').where, 'The shores and mist-covered approaches of Eastlake, near Swyth');
    t.equal(area('griffin', 'Galeclaw').area, 'Northern Province');
    t.equal(area('griffin', 'Embermantle').where, 'Redport and the western coastal cliffs');
    t.ok(/^Near-black, wet-slate scales; long ivory-white spines;/.test(area('wyvern', 'Widowspine').appearance));
    t.ok(/Older animals develop a distinctive grey mantle\.$/.test(area('dire_wolf', 'Nightfang').appearance));
    t.ok(B.species.wyvern.regional.concat(B.species.griffin.regional, B.species.dire_wolf.regional).every(function (r) {
      return r.id && r.name && r.area && r.where && r.appearance && /^[a-z]+$/.test(r.id) && r.id === r.name.toLowerCase();
    }), 'every variety is complete, with a plain id');
  });

  test('"Tidecliff Wyvern" was only Harry\'s worked example: it is not one of the fifteen varieties', function (t) {
    var all = [];
    KINDS.forEach(function (k) { B.species[k].regional.forEach(function (r) { all.push(r.name.toLowerCase()); }); });
    t.equal(all.indexOf('tidecliff'), -1);
  });

  test('nothing in a table is markup, and every value fits the Bastion\'s own limits', function (t) {
    var vals = [];
    B.dominant.entries.forEach(function (e) { vals.push(e.label, e.note); });
    KINDS.forEach(function (k) {
      ['attachment', 'trigger'].forEach(function (w) { B.species[k][w].entries.forEach(function (e) { vals.push(e.label); }); });
      B.species[k].regional.forEach(function (r) { vals.push(r.name, r.area, r.where, r.appearance); });
    });
    t.ok(vals.every(function (v) { return typeof v === 'string' && !/[<>]/.test(v); }), 'no angle brackets');
    t.ok(B.dominant.entries.every(function (e) { return e.label.length <= B.textMax; }) &&
      KINDS.every(function (k) { return ['attachment', 'trigger'].every(function (w) { return B.species[k][w].entries.every(function (e) { return e.label.length <= B.textMax; }); }); }), 'each fits a temperament line (120)');
    t.ok(KINDS.every(function (k) { return B.species[k].regional.every(function (r) { return r.name.length <= B.regionalMax; }); }), 'each variety name fits');
    t.equal(B.textMax, 120);
  });

  test('the kinds in the tables are the Bastion\'s own kinds', function (t) {
    var sp = T.bastionCreatures.species;
    t.same(Object.keys(sp), KINDS);
  });

  test('players may ask only for free training; the harness (150 gp), housing and milestones stay with the DM', function (t) {
    var rule = T.beastPlayerOrders;
    t.same([rule.rule, rule.denyIds], ['free_training', []]);
    var P = TSI.beasthandler.projection;
    var fns = [];
    T.bastionFacilities.forEach(function (f) { if (/^(wyvern_roost|griffin_tower|dire_wolf_den)$/.test(f.id)) fns = fns.concat(f.functions.map(function (x) { return { fac: f.id, fn: x }; })); });
    var allowed = fns.filter(function (x) { return P.isPlayerOrder(x.fn); });
    t.equal(allowed.length, 33, 'eleven free programmes in each of the three buildings');
    t.ok(allowed.every(function (x) { return x.fn.trains === true && Number(x.fn.costGP || 0) === 0; }));
    t.ok(fns.filter(function (x) { return /riding_harness$/.test(x.fn.id); }).length === 3 && fns.filter(function (x) { return /riding_harness$/.test(x.fn.id); }).every(function (x) { return !P.isPlayerOrder(x.fn); }), 'no harness');
    t.ok(fns.filter(function (x) { return /^house_/.test(x.fn.id); }).every(function (x) { return !P.isPlayerOrder(x.fn); }), 'no House orders');
  });
}());
