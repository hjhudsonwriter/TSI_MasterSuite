/* The Scarlett Isles: D&D Tool Suite — the Explorer link's rules (pull
   request 4 of the facilities overhaul, Harry's answers of 13 October
   2026). Plain functions, tested on tests/rules.html.

   How a change gets from the Explorer to the Bastion:
   - An Explorer event that changes a Clan's Honour/Respect adds a message
     to the Explorer's own save (journey.outbox). Messages are only ever
     added, never edited or taken away.
   - The Bastion reads the Explorer's save (as it already does for the day)
     and applies each message once, writing a receipt into its own save
     (bridge.done) in the same save as the change itself. So a saved
     Bastion has either both or neither, and nothing can count twice.
   - The Explorer reads the Bastion's save to show each message as Waiting,
     Applied, Refused or Skipped. Neither tool ever writes the other's save.

   A message: { id, type: 'standing', day, at, from: { code, title, step },
   clan, hr, text }. Its id is the event's own random id, the step and the
   outcome's place in it ('<uid>:won:2'), so the same moment always has the
   same id and two different moments never share one.

   Pull request 5 (Harry, 14 October 2026) adds a second kind: a Port
   Charter the DM grants in the Explorer, { id, type: 'charter', day, at,
   from, clan, port, text } (port: a key of shared/data/ports.js; clan: that
   port's Clan). Its id is a new random id with ':dm:0' (the Port Charter
   button) or ':pin:0' (a port's harbour box). The Bastion holds it once, and
   the Hall of Emissaries registers it.

   Pull request 6 (Harry, 14 October 2026) adds a third kind: a parcel from
   the Bastion's Courier Exchange collected in the Explorer, { id, type:
   'parcel_collected', day, at, from, clan, point, parcel, goods, text }
   (parcel: the Bastion's parcel id; point: a key of
   shared/data/courier-points.js; clan: that town's Clan; goods: what went
   into the Party bags, [{ goodId, qty }]). Point, Clan and goods are only
   for showing: the Bastion's own parcel record decides. Its id is always
   '<parcel id>:collect:0' (B.collectId), so the same parcel can never be
   collected twice. The goods go into the Party bags in the same Explorer
   save as the message; the Bastion then closes the parcel once, keeping a
   receipt. The Explorer reads the Bastion's parcels from its save (B.parcels,
   B.parcelView) but never changes them.

   Pull request 7 (Harry, 14 October 2026) adds a fourth kind: a griffin or
   a dire wolf the DM grants in the Explorer, { id, type: 'creature', day,
   at, from, species, name, text } (species: one the DM can grant, from
   tools/bastion/data/creatures-data.js grantable; name: as typed, at most
   40 letters, or ''). It has no Clan. Its id is a new random id with
   ':dm:0', as the Port Charter button's. The Bastion holds the creature
   once, waiting for a home, and the Griffin Tower's or Dire Wolf Den's
   House order houses it.

   A message of a kind this copy doesn't know yet (from a newer copy of the
   suite) waits, with no receipt, rather than being refused for good (only
   a Bastion starting from nothing skips it, as it skips everything sent
   before it started). The Explorer keeps its plain fields when it saves
   (text, numbers, true/false and who sent it), but not lists or records
   inside it. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var B = {};

  /* The seven Clans' keys, from the shared regions (shared/data/regions.js). */
  var FALLBACK_CLANS = ['blackstone', 'bacca', 'farmer', 'slade', 'molten', 'rowthorn', 'karr'];
  function regions() { return (window.TSI_DATA && window.TSI_DATA.regions) || {}; }
  B.CLANS = (function () {
    var out = [];
    var r = regions();
    Object.keys(r).forEach(function (k) {
      var key = r[k] && r[k].clanKey;
      if (typeof key === 'string' && out.indexOf(key) === -1) out.push(key);
    });
    return out.length ? out : FALLBACK_CLANS.slice();
  }());
  /* 'slade' → 'Slade'. */
  B.clanName = function (key) {
    var r = regions();
    var ids = Object.keys(r);
    for (var i = 0; i < ids.length; i++) if (r[ids[i]] && r[ids[i]].clanKey === key) return r[ids[i]].clan;
    return typeof key === 'string' && key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unknown';
  };

  /* The ports where the Ironbow can hold a Port Charter (shared/data/ports.js). */
  function ports() { return (window.TSI_DATA && window.TSI_DATA.ports) || {}; }
  B.ports = function () {
    var p = ports();
    return Object.keys(p).filter(function (k) { return p[k] && typeof p[k] === 'object'; });
  };
  B.isPort = function (id) { return typeof id === 'string' && B.ports().indexOf(id) !== -1; };
  /* 'goldport' → 'Goldport' (as the Explorer's pin spells it). */
  B.portLabel = function (id) {
    var p = ports()[id];
    if (p && typeof p.label === 'string' && p.label) return p.label;
    return typeof id === 'string' && id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Unknown port';
  };
  /* The Clan whose region the port is in: 'goldport' → 'molten', or ''. */
  B.portClan = function (id) {
    var p = ports()[id];
    var r = p && regions()[p.region];
    return r && typeof r.clanKey === 'string' ? r.clanKey : '';
  };

  /* The towns where the party can collect a parcel from the Courier
     Exchange (shared/data/courier-points.js, pull request 6). */
  function points() { return (window.TSI_DATA && window.TSI_DATA.courierPoints) || {}; }
  B.points = function () {
    var p = points();
    return Object.keys(p).filter(function (k) { return p[k] && typeof p[k] === 'object'; });
  };
  B.isPoint = function (id) { return typeof id === 'string' && B.points().indexOf(id) !== -1; };
  /* 'slades_muster' → 'Slade’s Muster' (as the Explorer's pin spells it). */
  B.pointLabel = function (id) {
    var p = points()[id];
    if (p && typeof p.label === 'string' && p.label) return p.label;
    return typeof id === 'string' && id ? id.split('_').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ') : 'Unknown town';
  };
  /* The Clan whose region the town is in: 'slades_muster' → 'slade', or ''. */
  B.pointClan = function (id) {
    var p = points()[id];
    var r = p && regions()[p.region];
    return r && typeof r.clanKey === 'string' ? r.clanKey : '';
  };
  /* The collection point at an Explorer pin, or '' (a town's id is its
     pin's, but the pin is checked, so the two can never disagree). */
  B.pointAtPin = function (pin) {
    var p = points();
    var ids = B.points();
    for (var i = 0; i < ids.length; i++) if (p[ids[i]].pin === pin) return ids[i];
    return '';
  };

  /* The creatures the DM can grant (pull request 7): from the Bastion's
     creatures-data.js when the page has it, otherwise these (keep them the
     same as that file). */
  var FALLBACK_CREATURES = { griffin: { name: 'Griffin', home: 'griffin_tower' }, dire_wolf: { name: 'Dire Wolf', home: 'dire_wolf_den' } };
  function creatures() { var c = window.TSI_DATA && window.TSI_DATA.bastionCreatures; return isObj(c) && isObj(c.species) ? c : null; }
  B.grantable = function () {
    var c = creatures();
    if (!c) return Object.keys(FALLBACK_CREATURES);
    return (Array.isArray(c.grantable) ? c.grantable : []).filter(function (k) { return typeof k === 'string' && isObj(c.species[k]); });
  };
  B.isGrantable = function (species) { return typeof species === 'string' && B.grantable().indexOf(species) !== -1; };
  function speciesInfo(species) {
    var c = creatures();
    var sp = c ? c.species[species] : FALLBACK_CREATURES[species];
    return typeof species === 'string' && isObj(sp) ? sp : null;
  }
  /* 'dire_wolf' → 'Dire Wolf'. */
  B.speciesName = function (species) {
    var sp = speciesInfo(species);
    return sp && typeof sp.name === 'string' && sp.name ? sp.name : 'Unknown creature';
  };
  /* The building that houses it: 'griffin' → 'Griffin Tower'. */
  B.speciesHomeName = function (species) {
    var sp = speciesInfo(species);
    var home = sp && typeof sp.home === 'string' ? sp.home : '';
    return home ? home.split('_').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ') : 'its home';
  };
  /* "Creature: Griffin (Swiftwing)", as the Explorer's Sent to the Bastion lists it. */
  B.creatureTitle = function (m) {
    var name = isObj(m) && typeof m.name === 'string' && m.name ? ' (' + m.name + ')' : '';
    return 'Creature: ' + B.speciesName(isObj(m) ? m.species : '') + name;
  };

  /* A change from one moment is at most 1 either way. */
  B.STANDING_CAP = 1;
  B.FIELDS = ['id', 'type', 'day', 'at', 'from', 'clan', 'hr', 'text'];
  /* A Port Charter's fields (pull request 5). */
  B.CHARTER_FIELDS = ['id', 'type', 'day', 'at', 'from', 'clan', 'port', 'text'];
  /* A parcel collected in the Explorer (pull request 6). */
  B.PARCEL_FIELDS = ['id', 'type', 'day', 'at', 'from', 'clan', 'point', 'parcel', 'goods', 'text'];
  /* A creature the DM granted (pull request 7): no Clan. */
  B.CREATURE_FIELDS = ['id', 'type', 'day', 'at', 'from', 'species', 'name', 'text'];
  /* The kinds of message this copy knows; a well-formed kind name not on the
     list is a newer copy's, and waits. */
  B.TYPES = ['standing', 'charter', 'parcel_collected', 'creature'];
  B.TYPE_PATTERN = /^[a-z][a-z_]{0,29}$/;
  B.ID_PATTERN = /^[a-z0-9-]{6,40}:[A-Za-z0-9_]{1,40}:\d{1,2}$/;
  B.UID_PATTERN = /^[a-z0-9-]{6,40}$/;
  B.TEXT_MAX = 200;
  /* A granted creature's name: at most this many letters (pull request 7). */
  B.NAME_MAX = 40;
  /* A parcel's pickup id is '<parcel id>' + this. */
  B.COLLECT_SUFFIX = ':collect:0';

  /* A new random id for an event: the time and 8 random hex digits from
     the browser's crypto, never Math.random, so it can't shift the
     Explorer's dice (the tests fix Math.random to replay their rolls). */
  var counter = 0;
  B.newId = function () {
    var hex = '';
    var c = window.crypto || window.msCrypto;
    if (c && typeof c.getRandomValues === 'function') {
      var bytes = new Uint8Array(4);
      c.getRandomValues(bytes);
      for (var i = 0; i < bytes.length; i++) hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    } else {
      /* No crypto (very old browsers only): a page counter, then Math.random. */
      counter += 1;
      hex = (counter.toString(16) + Math.floor(Math.random() * 0xffffffff).toString(16) + '00000000').slice(0, 8);
    }
    return Date.now().toString(36) + '-' + hex;
  };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isWhole(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function str(v, max) { return typeof v === 'string' ? (max ? v.slice(0, max) : v) : ''; }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }
  B.signed = signed;

  /* A new message (the Explorer makes these). */
  B.message = function (f) {
    return {
      id: str(f.id),
      type: 'standing',
      day: isWhole(f.day) ? f.day : 1,
      at: str(f.at) || new Date().toISOString(),
      from: { code: str(f.from && f.from.code, 20), title: str(f.from && f.from.title, 80), step: str(f.from && f.from.step, 40) },
      clan: str(f.clan),
      hr: f.hr > 0 ? 1 : -1,
      text: str(f.text, B.TEXT_MAX)
    };
  };

  /* A new Port Charter message (the Explorer makes these): its Clan is
     always the port's. */
  B.charterMessage = function (f) {
    return {
      id: str(f.id),
      type: 'charter',
      day: isWhole(f.day) ? f.day : 1,
      at: str(f.at) || new Date().toISOString(),
      from: { code: str(f.from && f.from.code, 20), title: str(f.from && f.from.title, 80), step: str(f.from && f.from.step, 40) },
      clan: B.portClan(f.port),
      port: str(f.port, 40),
      text: str(f.text, B.TEXT_MAX)
    };
  };

  /* A parcel's pickup message id: fixed for each parcel, so the Explorer can
     only ever collect it once. */
  B.collectId = function (parcelId) { return String(parcelId) + B.COLLECT_SUFFIX; };
  /* The parcel id in a pickup message's id, or '' if it isn't one. */
  B.parcelIdOf = function (id) {
    if (typeof id !== 'string' || id.length <= B.COLLECT_SUFFIX.length || id.slice(-B.COLLECT_SUFFIX.length) !== B.COLLECT_SUFFIX) return '';
    return id.slice(0, -B.COLLECT_SUFFIX.length);
  };
  /* Is this message a parcel pickup? Read from the message itself (its kind,
     or for anything but the two older kinds its id), never from a receipt. */
  B.isParcelMessage = function (m) {
    if (!isObj(m)) return false;
    if (m.type === 'parcel_collected') return true;
    return m.type !== 'standing' && m.type !== 'charter' && m.type !== 'creature' && B.parcelIdOf(m.id) !== '';
  };
  /* A parcel's goods as a message or the Explorer shows them: [{ goodId, qty }]. */
  function cleanGoods(list) {
    return (Array.isArray(list) ? list : []).filter(function (x) {
      return isObj(x) && typeof x.goodId === 'string' && x.goodId && isWhole(x.qty) && x.qty > 0;
    }).map(function (x) { return { goodId: x.goodId.slice(0, 60), qty: Math.min(x.qty, 9999) }; });
  }
  B.cleanGoods = cleanGoods;
  /* A new pickup message (the Explorer makes these, J.collectParcel): its
     id comes from the parcel, its Clan from the town. */
  B.parcelMessage = function (f) {
    return {
      id: B.collectId(str(f.parcel)),
      type: 'parcel_collected',
      day: isWhole(f.day) ? f.day : 1,
      at: str(f.at) || new Date().toISOString(),
      from: { code: str(f.from && f.from.code, 20), title: str(f.from && f.from.title, 80), step: str(f.from && f.from.step, 40) },
      clan: B.pointClan(f.point),
      point: str(f.point, 40),
      parcel: str(f.parcel, 40),
      goods: cleanGoods(f.goods),
      text: str(f.text, B.TEXT_MAX)
    };
  };

  /* A new creature message (the Explorer makes these, J.grantCreature): no
     Clan; the name as typed, cut to B.NAME_MAX. */
  B.creatureMessage = function (f) {
    return {
      id: str(f.id),
      type: 'creature',
      day: isWhole(f.day) ? f.day : 1,
      at: str(f.at) || new Date().toISOString(),
      from: { code: str(f.from && f.from.code, 20), title: str(f.from && f.from.title, 80), step: str(f.from && f.from.step, 40) },
      species: str(f.species, 40),
      name: str(f.name, B.NAME_MAX),
      text: str(f.text, B.TEXT_MAX)
    };
  };

  /* A kind of message from a newer copy of the suite: a well-formed kind
     this copy doesn't know, on a message with a good id. It waits (no
     receipt), so the newer copy can still apply it later. */
  B.waitsForNewer = function (m) {
    return isObj(m) && typeof m.type === 'string' && B.TYPE_PATTERN.test(m.type) && B.TYPES.indexOf(m.type) === -1 &&
      typeof m.id === 'string' && B.ID_PATTERN.test(m.id);
  };

  /* Tidy a saved message: keeps what can be kept, never refuses (the
     Bastion's check decides whether it applies). null if it isn't one. */
  B.clean = function (m) {
    if (!isObj(m) || typeof m.id !== 'string' || !m.id) return null;
    var from = { code: str(m.from && m.from.code, 20), title: str(m.from && m.from.title, 80), step: str(m.from && m.from.step, 40) };
    var day = typeof m.day === 'number' && isFinite(m.day) ? Math.round(m.day) : 1;
    if (m.type === 'charter') {
      return { id: m.id, type: 'charter', day: day, at: str(m.at), from: from, clan: str(m.clan), port: str(m.port, 40), text: str(m.text, B.TEXT_MAX) };
    }
    if (m.type === 'parcel_collected') {
      return { id: m.id, type: 'parcel_collected', day: day, at: str(m.at), from: from, clan: str(m.clan), point: str(m.point, 40), parcel: str(m.parcel, 40), goods: cleanGoods(m.goods), text: str(m.text, B.TEXT_MAX) };
    }
    if (m.type === 'creature') {
      return { id: m.id, type: 'creature', day: day, at: str(m.at), from: from, species: str(m.species, 40), name: str(m.name, B.NAME_MAX), text: str(m.text, B.TEXT_MAX) };
    }
    /* A newer copy's kind: every plain field kept as it is (text cut to
       length), so saving here doesn't strip it. */
    if (B.waitsForNewer(m)) {
      var keep = { id: m.id, type: m.type, day: day };
      Object.keys(m).forEach(function (k) {
        if (k in keep || !/^[A-Za-z][A-Za-z0-9_]{0,30}$/.test(k)) return;
        var v = m[k];
        if (k === 'from' && isObj(v)) keep.from = from;
        else if (typeof v === 'string') keep[k] = v.slice(0, B.TEXT_MAX);
        else if ((typeof v === 'number' && isFinite(v)) || typeof v === 'boolean') keep[k] = v;
      });
      return keep;
    }
    var out = {
      id: m.id,
      type: str(m.type),
      day: typeof m.day === 'number' && isFinite(m.day) ? Math.round(m.day) : 1,
      at: str(m.at),
      from: { code: str(m.from && m.from.code, 20), title: str(m.from && m.from.title, 80), step: str(m.from && m.from.step, 40) },
      clan: str(m.clan),
      hr: typeof m.hr === 'number' && isFinite(m.hr) ? m.hr : 0,
      text: str(m.text, B.TEXT_MAX)
    };
    return out;
  };

  /* '' if the Bastion may apply this message, otherwise a plain reason. Any
     whole day is fine: Reset Travel can move a waiting message to Day 0 or
     before. */
  B.check = function (m) {
    if (!isObj(m)) return 'It isn\'t a message.';
    if (B.TYPES.indexOf(m.type) === -1) return 'It isn\'t a kind of change the Bastion knows.';
    /* A parcel pickup: only its kind and its id are checked, and that the
       parcel it names is the one in its id. Its town, Clan, goods and any
       other fields are only for showing, never a reason to refuse it: the
       party already has the goods, so the Bastion must close its parcel
       (an older copy of the Explorer may have reshaped the message, adding
       hr and dropping the town and the parcel). */
    if (m.type === 'parcel_collected') {
      if (typeof m.id !== 'string' || !B.ID_PATTERN.test(m.id)) return 'Its id is damaged.';
      var pid = B.parcelIdOf(m.id);
      if (!pid || !B.UID_PATTERN.test(pid)) return 'Its id isn\'t a parcel pickup\'s.';
      if (typeof m.parcel === 'string' && m.parcel && m.parcel !== pid) return 'It names a different parcel from its id.';
      return '';
    }
    /* A creature the DM granted (pull request 7): its kind, its id, a kind
       of creature the DM can grant, and its name. It has no Clan, so none
       is asked for; its text and other fields are only for showing. */
    if (m.type === 'creature') {
      if (typeof m.id !== 'string' || !B.ID_PATTERN.test(m.id)) return 'Its id is damaged.';
      if (!B.isGrantable(m.species)) return 'It names a creature the DM can\'t grant (' + (typeof m.species === 'string' ? str(m.species, 40) : 'none') + ').';
      if (typeof m.name !== 'string' || m.name.length > B.NAME_MAX) return 'Its name is damaged.';
      return '';
    }
    var fields = m.type === 'charter' ? B.CHARTER_FIELDS : B.FIELDS;
    var extra = Object.keys(m).filter(function (k) { return fields.indexOf(k) === -1; });
    if (extra.length) return 'It has something the Bastion doesn\'t know (' + extra.join(', ') + ').';
    if (typeof m.id !== 'string' || !B.ID_PATTERN.test(m.id)) return 'Its id is damaged.';
    if (B.CLANS.indexOf(m.clan) === -1) return 'It names a Clan the Bastion doesn\'t know.';
    if (m.type === 'charter') {
      if (typeof m.port !== 'string' || !m.port) return 'It doesn\'t say which port.';
      if (!B.isPort(m.port)) return 'It names a port the Bastion doesn\'t know (' + str(m.port, 40) + ').';
      if (B.portClan(m.port) !== m.clan) return 'Its Clan isn\'t ' + B.portLabel(m.port) + '\'s.';
    } else if (m.hr !== 1 && m.hr !== -1) return 'Its change isn\'t +1 or −1.';
    if (!isWhole(m.day)) return 'Its day is damaged.';
    if (typeof m.text !== 'string' || m.text.length > B.TEXT_MAX) return 'Its text is damaged.';
    if ('at' in m && typeof m.at !== 'string') return 'Its time is damaged.';
    if ('from' in m && !isObj(m.from)) return 'It doesn\'t say which event it came from.';
    return '';
  };

  /* The Explorer save's messages, in the order they were sent. Anything
     without a usable id is left out (it can't be given a receipt). */
  B.outbox = function (explorerSave) {
    var j = isObj(explorerSave) && isObj(explorerSave.journey) ? explorerSave.journey : null;
    var list = j && Array.isArray(j.outbox) ? j.outbox : [];
    return list.filter(function (m) { return isObj(m) && typeof m.id === 'string' && m.id; });
  };

  /* The messages the Bastion should look at now: no receipt yet, and dated
     on or before the Bastion's day. In the order they were sent; a repeated
     id is only listed once. */
  B.pending = function (explorerSave, done, bastionDay) {
    var seen = {};
    var receipts = isObj(done) ? done : {};
    return B.outbox(explorerSave).filter(function (m) {
      if (seen[m.id] || Object.prototype.hasOwnProperty.call(receipts, m.id)) return false;
      seen[m.id] = true;
      var day = typeof m.day === 'number' && isFinite(m.day) ? m.day : -Infinity;
      return day <= bastionDay;
    });
  };

  /* The receipt for a message in a Bastion save, or null. */
  B.receipt = function (bastionSave, id) {
    var done = isObj(bastionSave) && isObj(bastionSave.bridge) && isObj(bastionSave.bridge.done) ? bastionSave.bridge.done : null;
    return done && Object.prototype.hasOwnProperty.call(done, id) && isObj(done[id]) ? done[id] : null;
  };

  /* What the Explorer shows for one of its messages, from the Bastion's
     save as last saved: { kind: 'waiting'|'applied'|'refused'|'skipped', line }. */
  B.statusOf = function (m, bastionSave) {
    if (!isObj(bastionSave)) return { kind: 'waiting', line: 'Waiting: the Bastion hasn\'t saved anything yet.' };
    var r = B.receipt(bastionSave, m && m.id);
    var charter = isObj(m) && m.type === 'charter';
    /* A parcel pickup (pull request 6): read from the message, never from
       the receipt's kind (an older Bastion's receipt has none). */
    if (B.isParcelMessage(m) && r) {
      var town = B.pointLabel(str(r.point) || str(m.point));
      var when = isWhole(r.day) ? ' on ' + (r.day >= 1 ? 'Day ' + r.day : 'a day before Day 1') : '';
      if (r.r === 'applied') return { kind: 'applied', line: r.held === true
        ? 'Applied' + when + ': the Bastion had already recorded the parcel at ' + town + ' as collected, so nothing changed.'
        : 'Applied' + when + ': the Bastion recorded the parcel at ' + town + ' as collected.' };
      if (r.r === 'skipped') return { kind: 'skipped', line: 'Skipped: collected before this Bastion started.' };
      var why = str(r.why) || 'the Bastion couldn\'t use it.';
      if (!/[.!?]$/.test(why)) why += '.';
      return { kind: 'refused', line: 'Refused: ' + why + ' The items stay in the Party bags; take them out with ✕ if they shouldn\'t be there.' };
    }
    /* A creature the DM granted (pull request 7): read from the message's
       kind, never the receipt's. */
    if (isObj(m) && m.type === 'creature' && r) {
      var what = 'the ' + B.speciesName(m.species).toLowerCase() + (typeof m.name === 'string' && m.name ? ' (' + m.name + ')' : '');
      var cday = isWhole(r.day) ? ' on ' + (r.day >= 1 ? 'Day ' + r.day : 'a day before Day 1') : '';
      /* Once the Bastion has housed it, say so rather than "house it". */
      var cid = typeof r.creatureId === 'string' ? r.creatureId : '';
      var housed = cid && isObj(bastionSave) && Array.isArray(bastionSave.creatures) && bastionSave.creatures.some(function (c) {
        return isObj(c) && c.id === cid && c.status === 'housed';
      });
      /* Released at the Bastion (pull request 8a): no longer in its register. */
      var released = cid && isObj(bastionSave) && Array.isArray(bastionSave.creatures) && !bastionSave.creatures.some(function (c) { return isObj(c) && c.id === cid; });
      if (r.r === 'applied' && released) return { kind: 'applied', line: 'Applied' + cday + ': the Bastion held ' + what + ', and has since released it.' };
      if (r.r === 'applied') return { kind: 'applied', line: r.held === true
        ? 'Applied' + cday + ': the Bastion already held ' + what + ', so nothing changed.'
        : 'Applied' + cday + ': the Bastion holds ' + what + (housed ? '; it lives at the Ironbow now.' : '; house it at the ' + B.speciesHomeName(m.species) + '.') };
      if (r.r === 'skipped') return { kind: 'skipped', line: 'Skipped: sent before this Bastion started. Grant it again if it should count.' };
      var cwhy = str(r.why) || 'the Bastion couldn\'t use it.';
      if (!/[.!?]$/.test(cwhy)) cwhy += '.';
      return { kind: 'refused', line: 'Refused: ' + cwhy + ' Nothing changed.' };
    }
    /* A newer copy's kind of message: plain words, whatever it does. */
    if (B.waitsForNewer(m)) {
      if (r && r.r === 'applied') return { kind: 'applied', line: 'Applied by a newer copy of the Bastion.' };
      if (!r) return { kind: 'waiting', line: 'Waiting for a newer copy of the Bastion (this copy doesn\'t know this kind of change).' };
    }
    if (charter && r && r.r === 'applied') {
      var name = B.portLabel(m.port);
      var on = isWhole(r.day) ? ' on ' + (r.day >= 1 ? 'Day ' + r.day : 'a day before Day 1') : '';
      return { kind: 'applied', line: r.held === true
        ? 'Applied' + on + ': the Bastion already held the Port Charter for ' + name + ', so nothing changed.'
        : 'Applied' + on + ': the Bastion holds the Port Charter for ' + name + '.' };
    }
    if (charter && r && r.r === 'skipped') return { kind: 'skipped', line: 'Skipped: sent before this Bastion started. Grant it again if it should count.' };
    if (r && r.r === 'applied') {
      var hr = typeof r.hr === 'number' ? r.hr : 0;
      if (!hr) return { kind: 'applied', line: 'Applied: Honour/Respect was already at ' + signed(typeof r.now === 'number' ? r.now : 0) + ', so nothing changed.' };
      return { kind: 'applied', line: 'Applied' + (isWhole(r.day) ? ' on ' + (r.day >= 1 ? 'Day ' + r.day : 'a day before Day 1') : '') + (typeof r.was === 'number' && typeof r.now === 'number' ? ': ' + signed(r.was) + ' → ' + signed(r.now) + '.' : '.') };
    }
    if (r && r.r === 'refused') return { kind: 'refused', line: 'Refused: ' + (str(r.why) || 'the Bastion couldn\'t use it.') + ' Nothing changed.' };
    if (r && r.r === 'skipped') return { kind: 'skipped', line: 'Skipped: sent before this Bastion started. Type it in by hand if it should count.' };
    if (r) return { kind: 'refused', line: 'Refused: the Bastion couldn\'t use it. Nothing changed.' };
    var day = typeof bastionSave.day === 'number' ? bastionSave.day : null;
    if (bastionSave.anchored !== true) return { kind: 'waiting', line: 'Waiting for the Bastion to open.' };
    if (day !== null && m && typeof m.day === 'number' && m.day > day) return { kind: 'waiting', line: 'Waiting for the Bastion to reach Day ' + m.day + '.' };
    return { kind: 'waiting', line: 'Waiting for the Bastion.' };
  };

  /* A port's Port Charter, for the Explorer's Grant (pull request 5):
     { kind, line, day } from the Explorer's messages and the Bastion's save,
     as last saved. kind:
     - 'none': not held and nothing waiting, so the DM may grant it (also
       after a refusal or a skip);
     - 'waiting': a Charter for this port is on its way to the Bastion;
     - 'held': the Bastion holds it (line says whether it's registered). */
  B.portStatus = function (port, explorerSave, bastionSave) {
    var tn = isObj(bastionSave) && isObj(bastionSave.tradeNetwork) ? bastionSave.tradeNetwork : {};
    var held = (Array.isArray(tn.portCharters) ? tn.portCharters : []).filter(function (c) { return isObj(c) && c.port === port; })[0];
    if (held) {
      if (held.status === 'registered') return { kind: 'held', line: 'Registered' + (isWhole(held.registeredDay) ? ' on ' + (held.registeredDay >= 1 ? 'Day ' + held.registeredDay : 'a day before Day 1') : '') + ': the Dock can ship cargo there.' };
      var registering = (Array.isArray(bastionSave.pendingOrders) ? bastionSave.pendingOrders : []).some(function (o) {
        return isObj(o) && o.fnId === 'register_port_charter' && isObj(o.chosen) && o.chosen.charterId === held.id;
      });
      return { kind: 'held', line: registering ? 'Held, and being registered at the Hall of Emissaries.' : 'Held: register it at the Hall of Emissaries.' };
    }
    var waiting = null;
    B.outbox(explorerSave).forEach(function (m) {
      if (m.type !== 'charter' || m.port !== port) return;
      var st = B.statusOf(m, bastionSave);
      /* Applied but not in the Bastion's list: a Bastion started again, or
         an older copy. It can be granted again. */
      if (st.kind === 'waiting' && !waiting) waiting = m;
    });
    if (waiting) return { kind: 'waiting', day: waiting.day, line: 'Sent on ' + (waiting.day >= 1 ? 'Day ' + waiting.day : 'a day before Day 1') + ': waiting for the Bastion.' };
    return { kind: 'none', line: 'Not held.' };
  };

  /* ---------- Parcels from the Courier Exchange (pull request 6) ----------
     The Explorer reads them from the Bastion's save, as last saved, and
     never changes them. */
  B.PARCEL_STATUSES = ['in_transit', 'ready', 'collected', 'returning', 'returned'];
  function dayOrNull(v) { return isWhole(v) ? v : null; }
  function dayText(d) { return d >= 1 ? 'Day ' + d : 'a day before Day 1'; }
  /* The Bastion's parcels, lightly tidied: [{ id, point, goods, status,
     departDay, readyDay, arrivedDay, collectedDay, recalledDay, returnDay }]. */
  B.parcels = function (bastionSave) {
    var tn = isObj(bastionSave) && isObj(bastionSave.tradeNetwork) ? bastionSave.tradeNetwork : {};
    return (Array.isArray(tn.parcels) ? tn.parcels : []).filter(function (p) {
      return isObj(p) && typeof p.id === 'string' && p.id && typeof p.point === 'string' && B.PARCEL_STATUSES.indexOf(p.status) !== -1;
    }).map(function (p) {
      return {
        id: p.id, point: p.point, goods: cleanGoods(p.goods), status: p.status,
        departDay: dayOrNull(p.departDay), readyDay: dayOrNull(p.readyDay), arrivedDay: dayOrNull(p.arrivedDay),
        collectedDay: dayOrNull(p.collectedDay), recalledDay: dayOrNull(p.recalledDay), returnDay: dayOrNull(p.returnDay)
      };
    });
  };
  /* A parcel's goods as the Party bags name them: "3 Expedition Provision
     Packs, 1 Overland chart (3 days of use)". */
  B.parcelGoodsText = function (goods) {
    var known = (window.TSI_DATA && window.TSI_DATA.partyItems) || {};
    return cleanGoods(goods).map(function (x) {
      var info = isObj(known[x.goodId]) ? known[x.goodId] : null;
      if (!info) return x.qty + ' × ' + x.goodId.replace(/_/g, ' ');
      var each = isWhole(info.usesEach) && info.usesEach > 1 ? info.usesEach : 1;
      var uses = each > 1 ? ' (' + x.qty * each + ' ' + (x.qty * each === 1 ? info.unit : info.units) + ')' : '';
      return x.qty + ' ' + (x.qty === 1 ? info.name : info.plural) + uses;
    }).join(', ');
  };
  /* What the Explorer shows for one parcel: { kind, line, goods }, kind
     'on_road' | 'due' | 'waiting' | 'returning' | 'collected' | 'returned'.
     Collected whenever the Explorer has already sent its pickup, whatever
     the Bastion has saved; due when the Explorer's day has reached its
     arrival day but the Bastion hasn't recorded the arrival yet (it's shut,
     or behind). */
  B.parcelView = function (p, explorerSave) {
    var town = B.pointLabel(p && p.point);
    var goods = B.parcelGoodsText(p && p.goods);
    function view(kind, line) { return { kind: kind, line: line, goods: goods }; }
    if (!isObj(p)) return view('on_road', 'On the road.');
    var cid = B.collectId(p.id);
    var sent = B.outbox(explorerSave).filter(function (m) { return m.id === cid; })[0];
    if (sent) return view('collected', 'Collected at ' + town + (isWhole(sent.day) ? ' on ' + dayText(sent.day) : '') + '.');
    if (p.status === 'collected') return view('collected', 'Collected at ' + town + (isWhole(p.collectedDay) ? ' on ' + dayText(p.collectedDay) : '') + '.');
    if (p.status === 'returned') return view('returned', 'Recalled: back at the Ironbow' + (isWhole(p.returnDay) ? ' on ' + dayText(p.returnDay) : '') + '.');
    if (p.status === 'returning') return view('returning', 'Recalled: on its way back to the Ironbow' + (isWhole(p.returnDay) ? ' (home on ' + dayText(p.returnDay) + ')' : '') + '. It can\'t be collected.');
    if (p.status === 'ready') return view('waiting', 'Waiting at ' + town + (isWhole(p.arrivedDay) ? ' since ' + dayText(p.arrivedDay) : '') + ': collect it from the town picture at ' + town + '.');
    var j = isObj(explorerSave) && isObj(explorerSave.travel) ? explorerSave.travel : {};
    var today = isWhole(j.day) ? j.day : null;
    if (isWhole(p.readyDay) && today !== null && p.readyDay <= today) return view('due', 'Due at ' + town + ': the Bastion records its arrival when it reaches ' + dayText(p.readyDay) + '.');
    return view('on_road', 'On the road: due at ' + town + (isWhole(p.readyDay) ? ' on ' + dayText(p.readyDay) : '') + '.');
  };
  /* The parcels the Explorer lists: its From the Ironbow list (every town),
     or a town's courier post (point given). [{ parcel, view }]: every
     parcel still open (on the road, due, waiting, or coming home), and one
     closed on the Explorer's day or the day before (collected, or back at
     the Ironbow), so the party sees what has just happened. Waiting ones
     first, then due, on the road, coming home and closed, each by its day. */
  B.SHOWN_ORDER = ['waiting', 'due', 'on_road', 'returning', 'collected', 'returned'];
  B.parcelsShown = function (bastionSave, explorerSave, point) {
    var tr = isObj(explorerSave) && isObj(explorerSave.travel) ? explorerSave.travel : {};
    var today = isWhole(tr.day) ? tr.day : 1;
    var sent = {};
    B.outbox(explorerSave).forEach(function (m) { sent[m.id] = m; });
    return B.parcels(bastionSave).filter(function (p) {
      return !point || p.point === point;
    }).map(function (p, i) {
      var view = B.parcelView(p, explorerSave);
      var m = sent[B.collectId(p.id)];
      var closed = view.kind === 'collected' ? (m && isWhole(m.day) ? m.day : p.collectedDay)
        : view.kind === 'returned' ? p.returnDay : null;
      var when = view.kind === 'returning' ? p.returnDay : closed !== null ? closed : p.readyDay;
      return { parcel: p, view: view, closed: closed, when: isWhole(when) ? when : 0, i: i };
    }).filter(function (x) {
      if (x.view.kind !== 'collected' && x.view.kind !== 'returned') return true;
      return isWhole(x.closed) && x.closed >= today - 1;
    }).sort(function (a, b) {
      return (B.SHOWN_ORDER.indexOf(a.view.kind) - B.SHOWN_ORDER.indexOf(b.view.kind)) || (a.when - b.when) || (a.i - b.i);
    }).map(function (x) { return { parcel: x.parcel, view: x.view }; });
  };

  TSI.bridge = B;
}());
