/* Scarlett Isles: Beast Handler — what the screens say (BH-1b; read-only since 22 October 2026).

   Plain functions (no screen code), tested on tests/rules.html. They turn a
   snapshot (projection.js) into the words and shapes the screens draw, so
   the screens only have to draw. Nothing here reads or changes the
   Bastion. The app only looks, so there is nothing about requests, orders or
   drafts in here any more. The first meeting's staged roll (the shuffled
   medallions, the hopping marker's path and the personality cards) is worked
   out here as well, so it can be tested without a screen: the Bastion has
   already decided the answer, and these functions only decide how it is
   played. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};
  var M = ns.model = {};

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* Bond 0 to 5 as six steps: { n, name, state: 'done' | 'current' | 'todo' }. */
  M.bondSteps = function (level, names) {
    var lv = typeof level === 'number' ? Math.max(0, Math.min(5, Math.floor(level))) : 0;
    var out = [];
    for (var n = 0; n <= 5; n++) out.push({ n: n, name: (names && names[n]) || '', state: n < lv ? 'done' : (n === lv ? 'current' : 'todo') });
    return out;
  };
  M.bondLine = function (bond) { return 'Bond ' + bond.level + ': ' + bond.name; };

  /* Bond 1 to 5 as five pills for a beast's Bond page, and the stage line. Each pill: { n, label, state, fill, text }.
     state: 'done' (reached), 'current' (the level it is at now: also reached), 'filling' (the next one, with some Bonding Days),
     'ready' (full, waiting for a moment with the DM) or 'todo'. fill: 0 to 100, how full the pill is; text: what a screen reader
     says ("Bond 3, Bonded: 7 of 10 days"). bonding: the snapshot's block (days, pill { n, days, need, fraction, full }, ready), or
     nothing (then the pills are only reached or not, as before the Beast Pen). */
  M.BOND_SHORT = ['Acclimatised', 'Trusting', 'Bonded', 'Devoted', 'Legendary'];
  M.BOND_NAMES = ['Acclimatised', 'Trusting', 'Bonded', 'Devoted', 'Legendary Partnership'];
  M.READY_TEXT = 'Ready: waiting for a moment with your DM';
  M.bondPills = function (level, bonding) {
    var lv = typeof level === 'number' && isFinite(level) ? Math.max(0, Math.min(5, Math.floor(level))) : 0;
    var b = isObj(bonding) ? bonding : null;
    var fp = b && isObj(b.pill) ? b.pill : null;
    var ready = b && typeof b.ready === 'number' ? b.ready : null;
    var pills = [];
    for (var n = 1; n <= 5; n++) {
      var p = { n: n, label: M.BOND_SHORT[n - 1], state: n < lv ? 'done' : (n === lv ? 'current' : 'todo'), fill: n <= lv ? 100 : 0, text: '' };
      if (n <= lv) p.text = 'Bond ' + n + ', ' + M.BOND_NAMES[n - 1] + ': reached';
      else if (fp && fp.n === n) {
        var frac = typeof fp.fraction === 'number' && isFinite(fp.fraction) ? Math.max(0, Math.min(1, fp.fraction)) : 0;
        p.fill = Math.round(frac * 100);
        if (ready === n || fp.full === true) { p.state = 'ready'; p.fill = 100; p.text = 'Bond ' + n + ', ' + M.BOND_NAMES[n - 1] + ': ready, waiting for a moment with your DM'; }
        else { p.state = p.fill > 0 ? 'filling' : 'todo'; p.text = 'Bond ' + n + ', ' + M.BOND_NAMES[n - 1] + ': ' + fp.days + ' of ' + fp.need + ' days'; }
      } else p.text = 'Bond ' + n + ', ' + M.BOND_NAMES[n - 1] + ': not yet';
      pills.push(p);
    }
    return { level: lv, pills: pills, stageText: 'Stage ' + lv + ' of 5', ready: ready, readyText: ready ? M.READY_TEXT : '' };
  };
  /* The Bonding Days tile and its one line: { days, line }. A beast out on the road: "On the road with Mira since Day 31";
     at the Pen: "Resting at the Beast Pen: bonding is paused" (the counter keeps showing the total). */
  M.bondingTile = function (detail) {
    var b = detail && isObj(detail.bonding) ? detail.bonding : null;
    if (!b) return null;
    var who = detail.handler && detail.handler.name ? detail.handler.name : 'its handler';
    return {
      days: typeof b.days === 'number' && isFinite(b.days) ? Math.max(0, Math.floor(b.days)) : 0,
      line: b.away ? 'On the road with ' + who + (b.awaySinceLabel ? ' since ' + b.awaySinceLabel : '') : 'Resting at the Beast Pen: bonding is paused'
    };
  };
  /* Where it is, in words (the kind line under the pills and the chip on a directory line). */
  M.placeText = function (place) { return place === 'away' ? 'Away from the Ironbow' : 'At the Beast Pen'; };
  /* "Bond 3 · Bonded" for the rapport line. */
  M.rapportLine = function (bond) { return 'Bond ' + bond.level + ' · ' + bond.name; };

  /* The Regional Variety table entry a typed name means, or null. Capitals, spaces, hyphens and apostrophes do not matter
     ("Bleak hook" is Bleakhook); words in brackets are ignored; a leading "the" and a leading or trailing species word are
     allowed ("The Widowspine Wyvern", "Dire Wolf Nightfang"); and a name that mentions exactly one of the species' varieties
     means that one ("Slatejaw of the northern hills"). Anything else has no picture. (The DM can still type any variety in
     the Bastion; this is how the app finds its picture.) */
  function looseKey(text) { return String(text || '').toLowerCase().replace(/[^a-z]/g, ''); }
  var SPECIES_WORDS = ['direwolf', 'wolf', 'wyvern', 'griffin', 'buckbear', 'fellcat'];
  M.regionalInfo = function (tables, speciesId, name) {
    var sp = tables && isObj(tables.species) ? tables.species[speciesId] : null;
    var list = sp && Array.isArray(sp.regional) ? sp.regional : [];
    var key = looseKey(String(name || '').replace(/[(\[{][^)\]}]*[)\]}]/g, ' ').replace(/^\s*the\s+/i, ''));
    if (!list.length || !key) return null;
    function find(k) { return list.filter(function (r) { return looseKey(r.name) === k; })[0] || null; }
    var hit = find(key);
    if (hit) return hit;
    SPECIES_WORDS.some(function (w) {
      if (key.length > w.length && key.slice(-w.length) === w) hit = find(key.slice(0, -w.length));
      if (!hit && key.length > w.length && key.slice(0, w.length) === w) hit = find(key.slice(w.length));
      return !!hit;
    });
    if (hit) return hit;
    var inside = list.filter(function (r) { return key.indexOf(looseKey(r.name)) !== -1; });
    return inside.length === 1 ? inside[0] : null;
  };

  /* Which picture to draw: { src, label, alt }; src is '' until a picture is added. */
  M.artFor = function (art, speciesId, regionalId) {
    var sp = art && isObj(art.species) ? art.species[speciesId] : null;
    if (!sp) return { src: '', label: 'Beast', alt: 'A beast' };
    var pick = regionalId && isObj(sp.variants) && sp.variants[regionalId] ? sp.variants[regionalId] : sp.default;
    return { src: pick && typeof pick.src === 'string' ? pick.src : '', label: sp.label, alt: sp.alt };
  };

  /* What the Home screen says when there is nothing to list, or ''. */
  M.homeMessage = function (snap) {
    if (!snap) return 'The Bastion hasn\'t been saved yet on this device, so there is nothing to show. Open the Ironbow Bastion Manager first.';
    if (!snap.facilities.length) return 'The Beast Pen isn\'t built at the Ironbow yet. It appears here once it is built.';
    if (snap.handler && !snap.handler.hasCreatures) return 'You have no beasts yet. The DM has to house a beast first and then make you its handler.';
    if (!snap.handler) return 'Choose a handler to see their beasts. Until then, you can see who lives where.';
    return '';
  };
  M.emptyBuilding = function (f) { return 'No beast is housed in the ' + f.name + ' yet.'; };
  /* The words on a directory line for a beast that has not passed acclimatisation (Bond 1) yet: no detail, nothing else. */
  M.NOT_YET = 'Not acclimatised yet';

  /* The Chronicle's category names. */
  var CATS = { training: 'Training', bond: 'Bond', handler: 'Handler', flight: 'Flight', travel: 'Travel', note: 'Note' };
  M.catLabel = function (cat) {
    if (typeof cat === 'string' && Object.prototype.hasOwnProperty.call(CATS, cat)) return CATS[cat];
    var s = String(cat || '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Note';
  };

  /* The line under the heading: where the picture came from and how fresh it is. */
  M.syncLine = function (info) {
    if (!info || !info.ok) return 'Not connected to a Bastion save.';
    return 'Read from the Bastion saved on this device · ' + info.asOfLabel;
  };

  /* ---------- The first meeting (Harry, 21 and 22 October 2026) ---------- */
  M.possessive = function (name) { var n = String(name || '').trim(); return n + (/s$/i.test(n) ? '’' : '’s'); };
  M.speciesNoun = function (detail) { return String(detail && detail.species && detail.species.name || 'beast').toLowerCase(); };
  /* Does this beast's first meeting play now? Only for a beast that has passed acclimatisation and has a first meeting the
     Bastion rolled (a beast that already had a Regional Variety never gets one), and only until it has been seen on this
     device. seen: { <creature id>: true }. */
  M.needsMeeting = function (detail, seen) {
    if (!detail || detail.available !== true || !isObj(detail.initiation)) return false;
    return !(isObj(seen) && seen[detail.id] === true);
  };
  /* Which subspecies the staged roll lands on: the one the Bastion holds for the beast NOW (its profile's Regional Variety),
     because that is the one the beast's page will show a moment later (the chip and the picture). The Bastion rolled a variety
     at acclimatisation, but the DM can change it afterwards (the Temperament dialog), and the reveal must agree with the page,
     not with an old roll. Returns { id, name, kind }:
       'now'    the Bastion's current variety is one of the kind's own varieties: land on it;
       'rolled' the snapshot says nothing about the profile at all (not something this suite sends): the roll the Bastion made;
       'none'   the Bastion holds no variety (the DM cleared it) or one of its own that is not in the kind's table: there is
                nothing true to land a marker on, so the staged subspecies roll is left out. */
  M.revealTarget = function (detail, tables) {
    var none = { id: '', name: '', kind: 'none' };
    if (!isObj(detail) || !isObj(detail.species)) return none;
    var profile = isObj(detail.profile) ? detail.profile : null;
    if (profile && typeof profile.regional === 'string') {
      var info = profile.regional.trim() ? M.regionalInfo(tables, detail.species.id, profile.regional) : null;
      return info ? { id: info.id, name: info.name, kind: 'now' } : none;
    }
    var rolled = isObj(detail.initiation) && typeof detail.initiation.regional === 'string' ? detail.initiation.regional : '';
    var found = rolled ? M.revealVarieties(tables, detail.species.id).filter(function (v) { return v.id === rolled; })[0] : null;
    return found ? { id: found.id, name: found.name, kind: 'rolled' } : none;
  };

  /* The words of the sequence. staged: false when the subspecies roll is left out (the Bastion holds no variety to show), which
     makes it one quick roll, not two. */
  M.meetingText = function (detail, staged) {
    var n = detail.name, noun = M.speciesNoun(detail);
    return {
      meet: 'It’s time to meet ' + n + '…',
      lead: (staged === false ? 'One quick roll, then you will see ' : 'Two quick rolls, then you will see ') + n + ' for the first time.',
      subspecies: 'There are many subspecies of ' + noun + ' in The Scarlett Isles, but which one is ' + n + '?',
      personality: 'Every ' + noun + ' has its own unique personality. What is ' + M.possessive(n) + ' like?',
      welcome: 'Welcome to the Ironbow, ' + n + '!'
    };
  };

  /* The kind's varieties as the reveal shows them: [{ id, name }] in the table's own order. */
  M.revealVarieties = function (tables, speciesId) {
    var sp = tables && isObj(tables.species) ? tables.species[speciesId] : null;
    var all = sp && Array.isArray(sp.regional) ? sp.regional : [];
    var pool = all.filter(function (r) { return r.rollable === true; });
    return (pool.length ? pool : all).map(function (r) { return { id: r.id, name: r.name }; });
  };
  /* A fresh order for a list (Fisher-Yates). rand: 0 up to (not including) 1. The list given is not changed. */
  M.shuffle = function (list, rand) {
    var r = typeof rand === 'function' ? rand : Math.random;
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  };

  /* How the marker hops across the medallions (Harry, 22 October 2026: "present the illusion of chance"). The answer is
     already decided (dest, the landing medallion's position in this run's shuffled order, counted from 0); this only works
     out a path that always ends on it and never looks the same twice. Returns
       { stops: [index…], delays: [ms…], total, hops, laps, near, hold }
     stops is every medallion the marker lights, in order; the marker waits delays[i] before moving from stops[i] to
     stops[i + 1]. The gaps start at about 90 ms and grow to about 420 ms (it slows down); then it rests on a medallion
     one beside the answer (the near miss, for `hold` ms) and steps onto the answer. The start is random, it goes round
     about two laps, and the whole thing takes 3.5 to 4.5 seconds. */
  M.revealPlan = function (n, dest, rand) {
    var r = typeof rand === 'function' ? rand : Math.random;
    function between(a, b) { return a + r() * (b - a); }
    n = Math.max(1, Math.floor(n) || 1);
    dest = Math.max(0, Math.min(n - 1, Math.floor(dest) || 0));
    if (n < 2) return { stops: [dest], delays: [], total: 0, hops: 0, laps: 0, near: 'none', hold: 0 };
    var total = Math.round(between(3500, 4500));
    var g0 = between(80, 105);
    var g1 = between(380, 440);
    var hold = Math.round(between(480, 760));
    var budget = total - hold;
    var start = Math.floor(r() * n);
    var near = r() < 0.5 ? 'before' : 'after';
    var beside = near === 'before' ? (dest - 1 + n) % n : (dest + 1) % n;
    /* The hops that carry it from the start to the near miss, going round the same way: at least one full lap. */
    var offset = (((beside - start) % n) + n) % n;
    function geometric(hops) {
      var out = [];
      var ratio = Math.pow(g1 / g0, 1 / Math.max(1, hops - 1));
      for (var i = 0; i < hops; i++) out.push(g0 * Math.pow(ratio, i));
      return out;
    }
    function sum(list) { return list.reduce(function (a, b) { return a + b; }, 0); }
    var best = null;
    for (var hops = n; hops <= 5 * n; hops++) {
      if ((hops % n) !== offset) continue;
      var diff = Math.abs(sum(geometric(hops)) - budget);
      if (!best || diff < best.diff) best = { hops: hops, diff: diff };
    }
    var gaps = geometric(best.hops);
    var scale = budget / sum(gaps);
    var delays = gaps.map(function (g) { return Math.round(g * scale); });
    var used = sum(delays);
    delays.push(total - used);   /* the rest on the near miss: the total is exact */
    var stops = [];
    for (var i = 0; i <= best.hops; i++) stops.push((((beside - (best.hops - i)) % n) + n) % n);
    stops.push(dest);
    return { stops: stops, delays: delays, total: total, hops: best.hops + 1, laps: Math.round(best.hops / n * 10) / 10, near: near, hold: delays[delays.length - 1] };
  };

  /* The three personality cards of the first meeting: [{ key, label, dice, roll, rolled, line, note }]. line is the Bastion's own
     line now (what the page will show). rolled is the number the Bastion stored (0 when the DM had already written that line and
     it matched no table row). roll is the number the card's die may SHOW: the stored number only while the line is still the one
     that number gave (the table row it names has the same words); once the DM has changed or cleared the line, or if the line was
     the DM's own words, the die has no honest number to show and roll is 0 (the screen shows a star). note is the table's own
     note for that row (only the d12 has them), shown on the same condition. */
  M.PERSONALITY = [
    { key: 'dominant', label: 'Dominant Temperament' },
    { key: 'attachment', label: 'Attachment Cue' },
    { key: 'trigger', label: 'Instinctive Trigger' }
  ];
  function sameWords(a, b) { return String(a || '').replace(/\s+/g, ' ').trim().toLowerCase() === String(b || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  M.personalityCards = function (detail, tables) {
    var sp = tables && isObj(tables.species) ? tables.species[detail.species.id] : null;
    var rolls = detail.initiation && isObj(detail.initiation.rolls) ? detail.initiation.rolls : {};
    var profile = isObj(detail.profile) ? detail.profile : {};
    return M.PERSONALITY.map(function (c) {
      var table = c.key === 'dominant' ? (tables && tables.dominant) : (sp && sp[c.key]);
      var entries = table && Array.isArray(table.entries) ? table.entries : [];
      var dice = table && table.dice > 0 ? table.dice : entries.length;
      var rolled = typeof rolls[c.key] === 'number' && rolls[c.key] > 0 ? Math.floor(rolls[c.key]) : 0;
      var line = String(profile[c.key] || '');
      var row = rolled ? entries.filter(function (e) { return e.roll === rolled; })[0] || null : null;
      var still = !!row && !!line && sameWords(row.label, line);
      return { key: c.key, label: c.label, dice: dice, roll: still ? rolled : 0, rolled: rolled, line: line, note: still && row.note ? String(row.note) : '' };
    });
  };

  /* A handler picker's choices: [{ value, label }] with "no handler" first. */
  M.handlerChoices = function (handlers) {
    var out = [{ value: '', label: 'No handler (see the directory only)' }];
    (handlers || []).forEach(function (h) { out.push({ value: h.id, label: h.name + ' (' + h.count + (h.count === 1 ? ' beast)' : ' beasts)') }); });
    return out;
  };

  /* The title for a player to see: "Wyvern · Stormwing". */
  M.title = function (detail) { return detail.species.name + ' · ' + detail.name; };
}());
