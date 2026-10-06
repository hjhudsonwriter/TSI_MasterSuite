/* Scarlett Isles Explorer — setting up a fight for the Combat Tracker.
   Plain functions with no screen code. The fights, monsters and battle maps
   are in data/fights-data.js.

   F.build turns an event's fight into a "hand-off": everything the Combat
   Tracker needs to load it (the monsters with their stat-block numbers, the
   battle map and where the tokens start, and who is surprised). The
   Explorer passes it on through TSI.handoff, and the Combat Tracker loads it
   (encounter/rules.js, R.loadHandoff). */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ns = TSI.explorer = TSI.explorer || {};

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  var F = ns.fights = {};

  /* The party's level: the Bastion's saved level if there is one, otherwise data.defaultLevel. */
  F.partyLevel = function (bastionSave, data) {
    var n = isObj(bastionSave) ? Number(bastionSave.partyLevel) : NaN;
    if (Number.isFinite(n)) return { level: Math.max(1, Math.min(20, Math.floor(n))), fromBastion: true };
    return { level: data.defaultLevel || 7, fromBastion: false };
  };

  /* Which group of enemies a party of this level meets. */
  F.band = function (data, level) {
    var bands = data.bands || [];
    for (var i = 0; i < bands.length; i++) if (level <= bands[i].upTo) return bands[i];
    return bands[bands.length - 1] || null;
  };

  /* A setting's battle map for a region: its picture and its grid and start places. */
  F.mapFor = function (data, settingId, region) {
    var maps = data.maps || {};
    var s = maps.settings && maps.settings[settingId];
    if (!s) return null;
    var file = s.file;
    if (s.regional) {
      var part = (maps.regions || {})[region];
      if (!part) part = maps.regions[Object.keys(maps.regions)[0]];
      file = settingId + '-' + part + '.jpg';
    }
    return {
      setting: settingId, title: s.title, src: (maps.folder || '') + file,
      cols: s.cols, rows: s.rows,
      party: (s.party || []).slice(), foes: (s.foes || []).slice(), avoid: (s.avoid || []).slice()
    };
  };

  /* A fight's enemies for one band: [{ name, stat, count, ac, hp, init, link }], leaders first. */
  F.groups = function (data, enc, bandId) {
    var list = (enc && enc[bandId]) || [];
    return list.map(function (g) {
      var m = data.monsters[g[0]];
      if (!m) return null;
      return { name: g[2] || m.name, stat: m.name, count: g[1], ac: m.ac, hp: m.hp, init: m.init, link: m.link || '' };
    }).filter(Boolean);
  };

  /* One line per group, for the event window: "2 × Veteran (AC 17, 58 HP)". */
  F.lines = function (groups) {
    return groups.map(function (g) {
      var stats = [];
      if (g.ac !== null && g.ac !== undefined) stats.push('AC ' + g.ac);
      stats.push(g.hp + ' HP');
      var name = g.name === g.stat ? g.name : g.name + ', a ' + g.stat;
      return g.count + ' × ' + name + ' (' + stats.join(', ') + ')';
    });
  };

  /* Which map setting a fight uses: its own, or (near the sea) its coast setting. */
  F.settingFor = function (enc, near) {
    return enc.coast && near && near.coast ? enc.coast : enc.map;
  };

  /* Everything the event window shows before the fight is set up. null if
     this fight has no encounter. near: what was near the party when the
     event began ({ river, coast }, from journey.js). */
  F.preview = function (data, encounterId, region, levelInfo, near) {
    var enc = data.encounters && data.encounters[encounterId];
    if (!enc) return null;
    var band = F.band(data, levelInfo.level);
    var setting = F.settingFor(enc, near);
    var map = F.mapFor(data, setting, region);
    if (!band || !map) return null;
    var groups = F.groups(data, enc, band.id);
    var total = groups.reduce(function (n, g) { return n + g.count; }, 0);
    return {
      band: band, map: map, groups: groups, total: total, lines: F.lines(groups), level: levelInfo.level, fromBastion: levelInfo.fromBastion,
      bySea: setting !== enc.map
    };
  };

  /* The hand-off for the Combat Tracker.
     opts: { encounter, region, regionName, levelInfo, near, event: { id, code, title, step, day }, surprised: [hero names], id, at } */
  F.build = function (data, opts) {
    var p = F.preview(data, opts.encounter, opts.region, opts.levelInfo, opts.near);
    if (!p) return null;
    var enc = data.encounters[opts.encounter];
    var ev = opts.event || {};
    return {
      v: 1,
      id: opts.id,
      at: opts.at,
      from: 'explorer',
      event: { id: ev.id || '', code: ev.code || '', title: ev.title || '', step: ev.step || '', day: ev.day || 0 },
      name: ((ev.code ? ev.code + ' ' : '') + (ev.title || 'Explorer fight')).trim(),
      region: opts.region || '',
      regionName: opts.regionName || '',
      level: p.level,
      fromBastion: p.fromBastion,
      band: { id: p.band.id, label: p.band.label },
      monsters: p.groups,
      map: {
        src: p.map.src, title: p.map.title, cols: p.map.cols, rows: p.map.rows,
        party: p.map.party, foes: enc.foes && !p.bySea ? enc.foes.slice() : p.map.foes, avoid: p.map.avoid
      },
      surprised: (opts.surprised || []).slice()
    };
  };
}());
