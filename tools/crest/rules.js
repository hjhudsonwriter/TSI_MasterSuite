/* Clan Crest Creator — rules (plain functions, tested in tests/rules.html).
   Random names, Random Crest, Reset and the download's file name, exactly as
   the old tool did them (clan-crest-creator/app.js). Random choices take an
   optional random-number function, so tests can give them fixed "dice". The
   draws happen in the same order as the old tool's. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var crest = TSI.crest = TSI.crest || {};

  function data() { return window.TSI_DATA.crest; }

  var rules = {
    pick: function (list, rng) {
      return list[Math.floor((rng || Math.random)() * list.length)];
    },

    randInt: function (a, b, rng) {
      return Math.floor((rng || Math.random)() * (b - a + 1)) + a;
    },

    /* A slider's value as a whole number within its range. */
    clampInt: function (v, a, b) {
      var n = Math.round(Number(v) || 0);
      return Math.max(a, Math.min(b, n));
    },

    defaults: function () {
      return Object.assign({}, data().defaults);
    },

    /* e.g. "StormOath" or "EmberCircle of the Salt Coast" (no space between the
       first two words: Harry's answer K2, keep as the old tool). */
    randomName: function (rng) {
      var n = data().names;
      var a = rules.pick(n.first, rng);
      var b = rules.pick(n.second, rng);
      var c = (rng || Math.random)() < n.placeChance ? ' ' + rules.pick(n.places, rng) : '';
      return a + b + c;
    },

    /* A whole random crest, name included. */
    randomCrest: function (rng) {
      var d = data();
      var lim = d.limits;
      var s = {};
      s.clanName = rules.randomName(rng);
      s.shieldShape = rules.pick(d.shields, rng).id;
      s.borderStyle = rules.pick(d.borders, rng).id;
      s.borderWidth = rules.randInt(lim.borderWidth.randomMin, lim.borderWidth.randomMax, rng);
      s.patternType = rules.pick(d.patterns, rng).id;
      s.palette = rules.pick(d.palettes, rng).id;
      s.texture = rules.pick(d.textures, rng).id;
      s.sigilType = rules.pick(d.sigils, rng).id;
      s.sigilScale = rules.randInt(lim.sigilScale.randomMin, lim.sigilScale.randomMax, rng);
      s.sigilFillMode = rules.pick(d.iconStyles, rng).id;
      s.bannerStyle = rules.pick(d.banners, rng).id;
      s.bannerText = (rng || Math.random)() < d.mottoChance ? rules.pick(d.mottos, rng) : '';
      return s;
    },

    /* The old tool's file-name clean-up: removes / \ : * ? " < > |, turns
       spaces into underscores, keeps 40 characters. */
    safeFileName: function (name) {
      var cleaned = String(name || 'Clan_Crest')
        .trim()
        .replace(/[\/\\:*?"<>|]+/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 40);
      return cleaned || 'Clan_Crest';
    },

    /* The downloaded picture's name, e.g. "Blackstone_Wardens.png". */
    fileName: function (clanName) {
      return rules.safeFileName(clanName || 'Clan_Crest') + '.png';
    }
  };

  crest.rules = rules;
}());
