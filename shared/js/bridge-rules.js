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
   same id and two different moments never share one. */
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

  /* A change from one moment is at most 1 either way. */
  B.STANDING_CAP = 1;
  B.FIELDS = ['id', 'type', 'day', 'at', 'from', 'clan', 'hr', 'text'];
  B.ID_PATTERN = /^[a-z0-9-]{6,40}:[A-Za-z0-9_]{1,40}:\d{1,2}$/;
  B.UID_PATTERN = /^[a-z0-9-]{6,40}$/;
  B.TEXT_MAX = 200;

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

  /* Tidy a saved message: keeps what can be kept, never refuses (the
     Bastion's check decides whether it applies). null if it isn't one. */
  B.clean = function (m) {
    if (!isObj(m) || typeof m.id !== 'string' || !m.id) return null;
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
    if (m.type !== 'standing') return 'It isn\'t a kind of change the Bastion knows.';
    var extra = Object.keys(m).filter(function (k) { return B.FIELDS.indexOf(k) === -1; });
    if (extra.length) return 'It has something the Bastion doesn\'t know (' + extra.join(', ') + ').';
    if (typeof m.id !== 'string' || !B.ID_PATTERN.test(m.id)) return 'Its id is damaged.';
    if (B.CLANS.indexOf(m.clan) === -1) return 'It names a Clan the Bastion doesn\'t know.';
    if (m.hr !== 1 && m.hr !== -1) return 'Its change isn\'t +1 or −1.';
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

  TSI.bridge = B;
}());
