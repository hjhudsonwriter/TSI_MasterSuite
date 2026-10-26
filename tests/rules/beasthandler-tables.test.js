/* Scarlett Isles: Beast Handler — Harry's profile tables (tools/beasthandler/data/profile-tables.js,
   21 October 2026). The words are Harry's, so these tests pin the shape and a spread of
   exact spellings; they are not a second copy of the tables. */
(function () {
  var T = window.TSI_DATA;
  var B = T.beastProfile;
  var KINDS = ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat'];
  var VARIETIES = { wyvern: 8, griffin: 8, dire_wolf: 7, buckbear: 5, fellcat: 5 };

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

  test('every kind has a d8 Attachment Cue table, a d8 Instinctive Trigger table and its Regional Varieties (8 Wyvern, 8 Griffin, 7 Dire Wolf, 5 Buckbear, 5 Fellcat; Harry\'s PDF of 26 October 2026)', function (t) {
    t.same(Object.keys(B.species), KINDS);
    KINDS.forEach(function (k) {
      ['attachment', 'trigger'].forEach(function (which) {
        var tab = B.species[k][which];
        t.equal(tab.dice, 8, k + ' ' + which);
        t.same(tab.entries.map(function (e) { return e.roll; }), [1, 2, 3, 4, 5, 6, 7, 8], k + ' ' + which + ' rolls');
        t.ok(tab.entries.every(function (e) { return typeof e.label === 'string' && e.label.length > 2; }), k + ' ' + which + ' labels');
      });
      t.equal(B.species[k].regional.length, VARIETIES[k], k + ' varieties');
    });
  });

  test('the Buckbear and Fellcat d8 tables are a DRAFT, marked so, until Harry approves or replaces them', function (t) {
    ['buckbear', 'fellcat'].forEach(function (k) {
      t.equal(B.species[k].draft, true, k + ' kind is marked draft');
      t.equal(B.species[k].attachment.draft, true, k + ' attachment');
      t.equal(B.species[k].trigger.draft, true, k + ' trigger');
    });
    ['wyvern', 'griffin', 'dire_wolf'].forEach(function (k) { t.ok(!B.species[k].draft && !B.species[k].attachment.draft && !B.species[k].trigger.draft, k + ' is Harry\'s own and not draft'); });
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

  test('the thirty-three Regional Varieties, by kind, with their areas', function (t) {
    function names(k) { return B.species[k].regional.map(function (r) { return r.name; }); }
    t.same(names('wyvern'), ['Widowspine', 'Bleakhook', 'Ironcrown', 'Bloodcrest', 'Shadowmount', 'Flamescale', 'Leafwing', 'Razortail']);
    t.same(names('griffin'), ['Dawnmantle', 'Thunderwing', 'Silvershroud', 'Galeclaw', 'Embermantle', 'Gloamquill', 'Wrecktalon', 'Frostcrown']);
    t.same(names('dire_wolf'), ['Nightfang', 'Icepelt', 'Slatejaw', 'Reedshadow', 'Hollowhowl', 'Sunmane', 'Blacktide']);
    t.same(names('buckbear'), ['Broadcrown', 'Shovelhorn', 'Cragbuck', 'Fenwallow', 'Saltcoat']);
    t.same(names('fellcat'), ['Mistveil', 'Whiteout', 'Lichenback', 'Tawnyfell', 'Smokecoat']);
    function area(k, n) { return B.species[k].regional.filter(function (r) { return r.name === n; })[0]; }
    t.same([area('wyvern', 'Widowspine').area, area('wyvern', 'Widowspine').where], ['The Black Straits', 'Storm-lashed sea stacks, coastal cliffs and narrow sea passages']);
    t.equal(area('wyvern', 'Bleakhook').area, 'North Isle');
    t.equal(area('wyvern', 'Bleakhook').where, 'Bleakharbour and the exposed northern coastline of Clan Karr');
    t.equal(area('dire_wolf', 'Icepelt').where, 'Bleaker\'s Bay, Bleakharbour and northern coastal uplands');
    t.equal(area('griffin', 'Silvershroud').where, 'Mist-covered shores and approaches of Eastlake near Swyth');
    t.equal(area('griffin', 'Galeclaw').area, 'Northern Province');
    /* 22 October 2026: Harry's own words for the sixth wolf and the new kinds. */
    t.same([area('dire_wolf', 'Blacktide').area, area('dire_wolf', 'Blacktide').where], ['The Black Straits (South) and Bolt Isle', 'Surf-cut rocks, wreck beaches, smugglers\' coves and pirate havens']);
    t.equal(area('dire_wolf', 'Blacktide').appearance, 'Powerful wolf with tangled wet charcoal-black upper fur, pale grey-cream face, chest and legs, broad coastal paws, vivid sea-green eyes and a heavy dark tail.');
    t.equal(area('buckbear', 'Broadcrown').where, 'The old-growth forests around Nightwood');
    t.equal(area('buckbear', 'Shovelhorn').area, 'North Isle (Clan Karr)');
    t.equal(area('buckbear', 'Fenwallow').area, 'Eastern Province (Clan Slade)');
    t.equal(area('buckbear', 'Saltcoat').area, 'East Isle (Clan Rowthorn)');
    t.equal(area('fellcat', 'Whiteout').area, 'Icepoint');
    t.equal(area('fellcat', 'Tawnyfell').where, 'The scree and lower slopes of The Fangs');
    t.equal(area('fellcat', 'Smokecoat').area, 'Western Province (Clan Farmer)');
    t.equal(area('griffin', 'Embermantle').where, 'Redport and the western coastal cliffs');
    t.ok(/^Dark slate-to-blue-black scales, pale stone-grey breast/.test(area('wyvern', 'Widowspine').appearance));
    t.ok(/pale amber to moss-green eyes\.$/.test(area('dire_wolf', 'Nightfang').appearance));
    t.ok(KINDS.reduce(function (all, k) { return all.concat(B.species[k].regional); }, []).every(function (r) {
      return r.id && r.name && r.area && r.appearance && /^[a-z]+$/.test(r.id) && r.id === r.name.toLowerCase();
    }), 'every variety is complete, with a plain id');
  });

  test('"Tidecliff Wyvern" was only Harry\'s worked example: it is not one of the varieties', function (t) {
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

  test('every kind the Bastion houses has its tables (the Buckbear and Fellcat join the Bastion with the Beast Pen)', function (t) {
    var sp = T.bastionCreatures.species;
    Object.keys(sp).forEach(function (k) { t.ok(KINDS.indexOf(k) !== -1, k + ' has profile tables'); });
  });

  test('the first meeting rolls among the rollable varieties only (Harry, 26 October 2026)', function (t) {
    var I = T.beastInitiation;
    t.equal(I.regional.mode, 'random');
    var ROLLABLE = { wyvern: ['leafwing', 'ironcrown', 'bloodcrest'], griffin: ['dawnmantle', 'silvershroud'], dire_wolf: ['slatejaw', 'blacktide'], buckbear: ['broadcrown', 'shovelhorn'], fellcat: ['lichenback', 'smokecoat'] };
    KINDS.forEach(function (k) {
      var got = B.species[k].regional.filter(function (r) { return r.rollable === true; }).map(function (r) { return r.id; });
      t.same(got.slice().sort(), ROLLABLE[k].slice().sort(), k + ' rollable set');
    });
    t.equal(I.personality.mode, 'random');
  });

  test('the data that said which orders a player may ask for is gone: the app has no orders (22 October 2026)', function (t) {
    t.equal(T.beastPlayerOrders, undefined);
  });
}());
