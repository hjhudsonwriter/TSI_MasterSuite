/* Clan Crest Creator — rules (plain functions, tested in tests/rules.html).
   Random names, Random Crest, Reset, the download's file name, and the colour
   sums the drawing uses. Random choices take an optional random-number
   function, so tests can give them fixed "dice". */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var crest = TSI.crest = TSI.crest || {};

  function data() { return window.TSI_DATA.crest; }

  /* ---------- colours ---------- */
  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map(function (v) {
      var n = Math.max(0, Math.min(255, Math.round(v)));
      return (n < 16 ? '0' : '') + n.toString(16);
    }).join('');
  }

  var rules = {
    pick: function (list, rng) {
      return list[Math.floor((rng || Math.random)() * list.length)];
    },

    chance: function (p, rng) {
      return (rng || Math.random)() < p;
    },

    randInt: function (a, b, rng) {
      return Math.floor((rng || Math.random)() * (b - a + 1)) + a;
    },

    /* A slider's value as a whole number within its range. */
    clampInt: function (v, a, b) {
      var n = Math.round(Number(v) || 0);
      return Math.max(a, Math.min(b, n));
    },

    /* A colour as #rrggbb, or null if it isn't one. */
    cleanHex: function (hex) {
      var rgb = hexToRgb(hex);
      return rgb ? rgbToHex(rgb) : null;
    },

    /* Blend two colours: t = 0 gives a, t = 1 gives b. */
    mix: function (a, b, t) {
      var x = hexToRgb(a) || [0, 0, 0], y = hexToRgb(b) || [0, 0, 0];
      return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
    },
    lighten: function (hex, t) { return rules.mix(hex, '#ffffff', t); },
    darken: function (hex, t) { return rules.mix(hex, '#000000', t); },

    /* How bright a colour looks, from 0 (black) to 1 (white). */
    luminance: function (hex) {
      var rgb = hexToRgb(hex) || [0, 0, 0];
      var c = rgb.map(function (v) {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    },

    /* The contrast between two colours, from 1 (none) to 21 (black on white). */
    contrast: function (a, b) {
      var x = rules.luminance(a), y = rules.luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    },

    /* Every named colour, in the order the colour picker shows them. */
    colours: function () {
      var out = [];
      data().colourGroups.forEach(function (g) { g.colours.forEach(function (c) { out.push(c); }); });
      return out;
    },

    /* A colour's name, or "Custom colour" for one picked by hand. */
    colourName: function (hex) {
      var h = rules.cleanHex(hex), hit = null;
      rules.colours().forEach(function (c) { if (!hit && c.hex === h) hit = c; });
      return hit ? hit.name : 'Custom colour';
    },

    /* The crest's colours from a scheme, laid over the other choices. */
    applyScheme: function (state, schemeId) {
      var sc = null;
      data().schemes.forEach(function (x) { if (x.id === schemeId) sc = x; });
      if (!sc) return state;
      var out = Object.assign({}, state, { scheme: sc.id });
      data().colourSlots.forEach(function (slot) { out[slot.key] = sc[slot.key]; });
      return out;
    },

    defaults: function () {
      return Object.assign({}, data().defaults);
    },

    /* e.g. "StormOath" or "EmberCircle of the Salt Coast" (no space between the
       first two words: Harry's answer K2). */
    randomName: function (rng) {
      var n = data().names;
      var a = rules.pick(n.first, rng);
      var b = rules.pick(n.second, rng);
      var c = (rng || Math.random)() < n.placeChance ? ' ' + rules.pick(n.places, rng) : '';
      return a + b + c;
    },

    /* A whole random crest, name included. Simple fields are likelier than
       busy ones, and a band is added only now and then, so most crests look
       like real arms. The colours come from a scheme, so they always suit. */
    randomCrest: function (rng, shields, sigils) {
      var d = data(), lim = d.limits;
      shields = shields || window.TSI_DATA.crestShields;
      sigils = sigils || window.TSI_DATA.crestSigils;
      var s = rules.defaults();
      s.clanName = rules.randomName(rng);
      s.shield = rules.pick(shields, rng).id;
      s.division = rules.chance(0.4, rng) ? 'plain' : rules.pick(d.divisions.slice(1), rng).id;
      var bandChance = s.division === 'plain' ? 0.45 : 0.15;
      s.ordinary = rules.chance(bandChance, rng) ? rules.pick(d.ordinaries.slice(1), rng).id : 'none';
      s.sigil = rules.pick(sigils, rng).id;
      s.sigilSize = rules.randInt(lim.sigilSize.randomMin, lim.sigilSize.randomMax, rng);
      if (s.ordinary !== 'none') s.sigilSize = Math.round(s.sigilSize * 0.8);
      s.sigilShift = 0;
      s.sigilFace = rules.chance(0.8, rng) ? 'left' : 'right';
      s.relief = rules.chance(0.75, rng) ? 'raised' : 'flat';
      s.rim = rules.pick(d.rims.slice(1), rng).id;
      s.rimWidth = rules.randInt(lim.rimWidth.randomMin, lim.rimWidth.randomMax, rng);
      var light = (rng || Math.random)();
      s.lighting = light < 0.6 ? 'soft' : light < 0.85 ? 'gloss' : 'flat';
      s.texture = rules.pick(d.textures, rng).id;
      s = rules.applyScheme(s, rules.pick(d.schemes, rng).id);
      s.banner = rules.pick(d.banners.slice(1), rng).id;
      s.motto = rules.chance(d.mottoChance, rng) ? rules.pick(d.mottos, rng) : '';
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
