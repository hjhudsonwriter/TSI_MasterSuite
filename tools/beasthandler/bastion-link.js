/* Scarlett Isles: Beast Handler — the Bastion's side of the link (BH-2b, BH-3a; read-only since 22 October 2026).

   Plain functions (no screen code), tested on tests/rules.html. They add to the
   Bastion's rules (tools/bastion/rules.js), as courier-rules.js does, and are
   loaded in the Bastion and in the companion's laptop copy.

   The Beast Handler app can only LOOK. A player's phone (or the companion on
   this laptop) shows a snapshot the Bastion makes (projection.js) and sends
   nothing back: there are no requests, receipts or orders any more. The
   Bastion is the only place anything is decided, and what it keeps here is:
   - the handler registry and pairing: s.beast = { campaignId, handlers: [{ id,
     name, secret, since }] }, added the first time it is needed (the secret for
     each handler stays here, never in a snapshot);
   - the DM's own profile edits (R.setProfile, used by the Temperament dialog
     and by the first meeting);
   - the first meeting: R.rollInitiation / R.sweepInitiation roll a beast's
     Regional Variety and personality ONCE, at Bond 1, and the phone plays a
     reveal of the stored result;
   - the snapshot code a handler pastes into their phone (R.beastSnapshotCode);
   - the QR link (S17): R.beastLink builds the address a handler's phone is linked
     with (the phone page's address, then # and the pairing), s.beast.phoneUrl is the
     one setting for that address, and s.beast.onlineLink is the OFF-by-default
     switch for the optional online link (relay.js, docs/ONLINE-LINK-SETUP.md).
   A Bastion saved before 22 October 2026 may still hold the old request record
   (s.beast.accept, .done and .floor): R.cleanBeast loads it and quietly drops
   those three, and the version 4 conversion removes them (step dropBeastRequests
   in strip-back-rules.js). */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.bastion = TSI.bastion || {};
  var R = ns.rules;
  if (!R) return;
  var BH = TSI.beasthandler;
  if (!BH || !BH.projection || !BH.profile || !TSI.hmac) return;
  var P = BH.projection;
  var Pf = BH.profile;
  var H = TSI.hmac;
  var clampInt = R.clampInt;
  var dayNum = R.dayNum;

  var PROFILE_LOG_MAX = 40;
  var HANDLERS_MAX = 40;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function plain(text, max) { return Pf.clean(text, max); }

  /* ---------- The saved record ---------- */
  /* Only the campaign id and the handlers are kept. An old save's accept, done and floor (the request record) are
     loaded without complaint and dropped. */
  R.cleanBeast = function (raw) {
    var src = isObj(raw) ? raw : {};
    /* A Set, not a plain object: a handler may be named anything ("Constructor", "__proto__"), and a plain object's own
       built-in names would make such a handler look like a duplicate and be dropped, losing its pairing secret. */
    var seen = new Set();
    var handlers = [];
    arr(src.handlers).forEach(function (h) {
      if (!isObj(h) || handlers.length >= HANDLERS_MAX) return;
      var name = plain(h.name, 40);
      var id = P.handlerKey(h.id !== undefined && h.id !== '' ? h.id : name);
      if (!id || seen.has(id)) return;
      seen.add(id);
      handlers.push({ id: id.slice(0, 40), name: name || id, secret: typeof h.secret === 'string' && /^[A-Za-z0-9]{16,64}$/.test(h.secret) ? h.secret : '', since: dayNum(h.since, 1) });
    });
    var out = {
      campaignId: typeof src.campaignId === 'string' && /^[A-Za-z0-9]{8,40}$/.test(src.campaignId) ? src.campaignId : '',
      handlers: handlers
    };
    /* Kept only when set, so a Bastion that never used them saves exactly what it did before: the phone page's address
       (an https address, nothing after the page name) and the online link's switch (only ever true if the DM pressed it). */
    if (typeof src.phoneUrl === 'string' && /^https:\/\/[^\s#?]{4,190}$/.test(src.phoneUrl)) out.phoneUrl = src.phoneUrl;
    if (src.onlineLink === true) out.onlineLink = true;
    return out;
  };

  /* The record, made (with this Bastion's own campaign id) if there isn't one yet. */
  R.beastState = function (s) {
    if (!isObj(s.beast)) s.beast = R.cleanBeast(null);
    if (!s.beast.campaignId) s.beast.campaignId = H.randomId(16);
    return s.beast;
  };
  /* The campaign id as saved, '' if the Bastion hasn't made one yet (reading never changes the save). */
  R.beastCampaignId = function (s) { return isObj(s.beast) && typeof s.beast.campaignId === 'string' ? s.beast.campaignId : ''; };

  /* ---------- The handlers the DM has paired, and those the creatures name ---------- */
  /* [{ id, name, count, paired }]: every handler a standing creature names, plus any already paired. */
  R.beastRegistry = function (s, data) {
    var out = [];
    var byId = new Map();
    arr(isObj(s.beast) ? s.beast.handlers : []).forEach(function (h) {
      var e = { id: h.id, name: h.name, count: 0, paired: !!h.secret };
      byId.set(h.id, e);
      out.push(e);
    });
    P.handlers(s, data).forEach(function (h) {
      var k = P.handlerKey(h.id);
      if (!byId.has(k)) { var e = { id: k, name: h.name, count: 0, paired: false }; byId.set(k, e); out.push(e); }
      byId.get(k).count = h.count;
    });
    return out.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  };
  function entryFor(s, id, create, name) {
    var B = create ? R.beastState(s) : (isObj(s.beast) ? s.beast : null);
    if (!B) return null;
    var key = P.handlerKey(id);
    var e = B.handlers.filter(function (h) { return h.id === key; })[0] || null;
    if (!e && create && key && B.handlers.length < HANDLERS_MAX) {
      e = { id: key, name: plain(name || id, 40) || key, secret: '', since: dayNum(s.day, 1) };
      B.handlers.push(e);
    }
    return e;
  }
  R.beastSecret = function (s, id) { var e = entryFor(s, id, false); return e && e.secret ? e.secret : ''; };

  /* A new pairing code for a handler (a new secret each time: the old code stops working). */
  R.beastPair = function (s, data, name) {
    var nm = plain(name, 40);
    if (!nm) return { ok: false, message: 'Choose which handler the code is for.' };
    var known = R.beastRegistry(s, data).filter(function (h) { return h.id === P.handlerKey(nm); })[0];
    var e = entryFor(s, nm, true, known ? known.name : nm);
    if (!e) return { ok: false, message: 'There are too many handlers already.' };
    e.secret = H.randomId(24);
    R.log(s, 'Beast Handler', 'A pairing code was made for ' + e.name + '. Any older code for them no longer works.');
    return { ok: true, handler: e.id, name: e.name, pairing: { campaign: R.beastState(s).campaignId, handler: e.id, name: e.name, secret: e.secret } };
  };
  R.beastRevoke = function (s, id) {
    var e = entryFor(s, id, false);
    if (!e || !e.secret) return { ok: false, message: 'That handler has no code to take back.' };
    e.secret = '';
    R.log(s, 'Beast Handler', 'The code for ' + e.name + ' was taken back. Snapshots made with it no longer open on their phone.');
    return { ok: true, name: e.name };
  };

  /* ---------- The QR link and the online link's switch ---------- */
  /* The phone page's address in use: the DM's setting if there is a good one, else the default. */
  R.beastPhoneUrl = function (s) { return BH.link.phoneUrl(isObj(s.beast) ? s.beast.phoneUrl : ''); };
  /* Save the phone page's address ('' goes back to the default). { ok, url } or { ok: false, message }. */
  R.setBeastPhoneUrl = function (s, text) {
    if (!String(text || '').trim()) {
      if (isObj(s.beast)) delete s.beast.phoneUrl;
      return { ok: true, url: BH.link.DEFAULT_PHONE_URL };
    }
    var r = BH.link.cleanPhoneUrl(text);
    if (!r.ok) return { ok: false, message: r.why };
    /* The standard address is not saved: nothing is kept that would stop it following the standard if that ever changes. */
    if (r.url === BH.link.DEFAULT_PHONE_URL) { if (isObj(s.beast)) delete s.beast.phoneUrl; return { ok: true, url: r.url }; }
    R.beastState(s).phoneUrl = r.url;
    return { ok: true, url: r.url };
  };
  /* The link a handler's phone is linked with, from the pairing they already have (it never makes a new secret, so showing
     the QR again changes nothing). { ok, link, name, handler } or { ok: false, message }. The link holds the secret: it
     is for that handler's eyes only, so it is never written to the Day Log or a snapshot. */
  R.beastLink = function (s, data, handlerId) {
    var e = entryFor(s, handlerId, false);
    if (!e || !e.secret) return { ok: false, message: 'Make a pairing for this handler first.' };
    var pairing = { campaign: R.beastState(s).campaignId, handler: e.id, name: e.name, secret: e.secret };
    return { ok: true, link: BH.link.buildLink(R.beastPhoneUrl(s), pairing), name: e.name, handler: e.id, pairing: pairing };
  };
  /* Make a pairing for a handler if they have none yet (nothing changes if they already have one). */
  R.beastEnsurePaired = function (s, data, name) {
    var nm = plain(name, 40);
    if (!nm) return { ok: false, message: 'Choose which handler the code is for.' };
    var e = entryFor(s, nm, false);
    if (e && e.secret) return { ok: true, handler: e.id, name: e.name, made: false };
    var res = R.beastPair(s, data, nm);
    return res.ok ? { ok: true, handler: res.handler, name: res.name, made: true } : res;
  };
  /* Is the online link switched on? Off unless the DM pressed Switch on. */
  R.beastOnlineLink = function (s) { return isObj(s.beast) && s.beast.onlineLink === true; };
  R.setBeastOnlineLink = function (s, on) {
    if (on) R.beastState(s).onlineLink = true;
    else if (isObj(s.beast)) delete s.beast.onlineLink;
    return R.beastOnlineLink(s);
  };

  /* ---------- Applying a profile ---------- */
  /* Set a beast's profile lines (the player's or the DM's words). Keeps a note of what changed in
     development.profileLog (and says so in the Day Log); the Chronicle is not touched, and nothing
     about bond, stats, training or abilities moves. fields are already cleaned (Pf.check). */
  R.setProfile = function (s, data, id, clean, by) {
    var c = R.creatureById(s, id);
    if (!c) return { ok: false, message: 'That creature isn\'t at the Ironbow any more.' };
    var d = R.ensureDev(s, c);
    var before = { dominant: d.temperament.dominant, attachment: d.temperament.attachment, trigger: d.temperament.trigger, regional: d.regional || '' };
    var changed = Pf.changed(before, clean);
    if (!changed.length) return { ok: true, changed: [], name: R.creatureName(data, c) };
    var change = {};
    changed.forEach(function (f) {
      var v = clean[f];
      change[f] = { from: before[f], to: v };
      if (f === 'regional') { if (v) d.regional = v; else delete d.regional; } else d.temperament[f] = v;
    });
    if (!Array.isArray(d.profileLog)) d.profileLog = [];
    d.profileLog.push({ day: dayNum(s.day, 1), by: plain(by || 'DM', 40), change: change });
    if (d.profileLog.length > PROFILE_LOG_MAX) d.profileLog = d.profileLog.slice(d.profileLog.length - PROFILE_LOG_MAX);
    var name = R.creatureName(data, c);
    var parts = changed.map(function (f) { return Pf.LABELS[f] + ' ' + (before[f] ? '"' + before[f] + '"' : '(blank)') + ' → ' + (clean[f] ? '"' + clean[f] + '"' : '(blank)'); });
    R.log(s, 'Beast Handler', name + '\'s profile was changed by ' + plain(by || 'the DM', 40) + ': ' + parts.join('; ') + '.');
    return { ok: true, changed: changed, name: name };
  };

  /* ---------- The first meeting: what the Bastion decides (Harry, 22 October 2026) ----------
     The phone app is read-only. When a beast passes acclimatisation (Bond 1) the BASTION rolls its first meeting
     once and keeps the result in development.initiation; the phone only plays the reveal of what is stored.
     - The Regional Variety comes from data/initiation-data.js: mode 'fixed' names one for each kind (until Harry
       says otherwise), mode 'random' is an even pick among the kind's own varieties.
     - The three personality lines are genuinely random: Dominant Temperament (d12, the same for every kind),
       Attachment Cue (d8) and Instinctive Trigger (d8), from Harry's tables (data/profile-tables.js). The order of
       the dice is: the variety (random mode only), then dominant, attachment, trigger.
     - It happens ONCE: a beast that already has an initiation, or already has a Regional Variety (the DM typed one,
       or it was written before this existed), is treated as introduced and is never rolled for, so nothing can be
       rolled twice or overwritten.
     - Lines the DM has already written are kept; the roll fills blanks only. Its die number is the matching table
       row's roll, or 0 when the line matches none (then there is nothing to roll for on the phone).
     - It never touches a bond, a stat, an ability or the Chronicle: it writes the profile through R.setProfile
       (which keeps the change note and the Day Log line) and says in the Day Log when the variety was staged. */
  function initiationData() { return window.TSI_DATA && isObj(window.TSI_DATA.beastInitiation) ? window.TSI_DATA.beastInitiation : {}; }
  function profileTables() { return window.TSI_DATA && isObj(window.TSI_DATA.beastProfile) ? window.TSI_DATA.beastProfile : null; }
  /* The kind's variety table entry for an id or a name, or null. */
  function varietyOf(sp, key) {
    var k = String(key || '').toLowerCase();
    return arr(sp && sp.regional).filter(function (v) { return v.id === k || String(v.name).toLowerCase() === k; })[0] || null;
  }
  /* Which variety this kind meets as: { variety, mode } ('fixed' unless the data says 'random' or names nothing real). */
  R.initiationVariety = function (speciesId, rand) {
    var t = profileTables();
    var sp = t && isObj(t.species) ? t.species[speciesId] : null;
    var list = arr(sp && sp.regional);
    if (!list.length) return null;
    var rule = isObj(initiationData().regional) ? initiationData().regional : {};
    if (rule.mode === 'fixed' && isObj(rule.fixed)) {
      var fixed = varietyOf(sp, rule.fixed[speciesId]);
      if (fixed) return { variety: fixed, mode: 'fixed' };
    }
    var r = typeof rand === 'function' ? rand() : Math.random();
    var n = Math.min(list.length, Math.max(1, Math.floor((isFinite(r) ? r : 0) * list.length) + 1));
    return { variety: list[n - 1], mode: 'random', roll: n, of: list.length };
  };

  /* Roll the first meeting for one beast, once. rand: 0 up to (not including) 1.
     Returns { ok, initiated?, introduced?, already?, message?, regional?, rolls?, lines? }: initiated is true only when
     this call did it. Nothing changes for a beast that is already introduced (initiated is then not set). */
  R.rollInitiation = function (s, data, creatureId, rand) {
    var c = R.creatureById(s, creatureId);
    if (!c) return { ok: false, message: 'That creature isn\'t at the Ironbow any more.' };
    var existing = R.creatureDev(c);
    if (existing && isObj(existing.initiation)) return { ok: true, already: true };
    if (existing && String(existing.regional || '').trim()) return { ok: true, introduced: true };
    var t = profileTables();
    var sp = t && isObj(t.species) ? t.species[c.species] : null;
    if (!sp || !arr(sp.regional).length) return { ok: false, message: 'There are no varieties written for this kind of beast, so it cannot be introduced.' };
    var rnd = typeof rand === 'function' ? rand : Math.random;
    var d = R.ensureDev(s, c);
    var picked = R.initiationVariety(c.species, rnd);
    if (!picked) return { ok: false, message: 'There are no varieties written for this kind of beast, so it cannot be introduced.' };
    var tables = { dominant: t.dominant, attachment: sp.attachment, trigger: sp.trigger };
    var clean = { regional: picked.variety.name };
    var rolls = {};
    var made = {};
    ['dominant', 'attachment', 'trigger'].forEach(function (k) {
      var table = tables[k];
      var written = plain(d.temperament[k], 120);
      if (written) {
        /* The DM's own line stays. Its number is the row it matches, or 0. */
        var row = isObj(table) ? arr(table.entries).filter(function (e) { return String(e.label).toLowerCase() === written.toLowerCase(); })[0] : null;
        rolls[k] = row ? clampInt(row.roll, 0, 100) : 0;
        return;
      }
      var e = Pf.rollTable(table, rnd);
      if (!e) { rolls[k] = 0; return; }
      rolls[k] = clampInt(e.roll, 0, 100);
      clean[k] = e.label;
      made[k] = { roll: e.roll, dice: table.dice > 0 ? table.dice : arr(table.entries).length };
    });
    d.initiation = { regional: picked.variety.id, rolls: rolls, day: dayNum(s.day, 1) };
    var res = R.setProfile(s, data, c.id, clean, 'the first meeting');
    var name = R.creatureName(data, c);
    var parts = [];
    Object.keys(made).forEach(function (k) { parts.push(Pf.LABELS[k] + ' d' + made[k].dice + ' ' + made[k].roll); });
    var line = name + ': first meeting prepared. Regional Variety ' + picked.variety.name +
      (picked.mode === 'fixed' ? ' (staged: fixed until further notice)' : ' (rolled d' + picked.of + ' ' + picked.roll + ')') +
      (parts.length ? '; ' + parts.join('; ') : '') + '. The player\'s Beast Handler plays it as a reveal.';
    R.log(s, 'Beast Handler', line);
    return { ok: true, initiated: true, regional: picked.variety.name, regionalId: picked.variety.id, rolls: rolls, changed: res.changed || [], lines: [line] };
  };

  /* The one-off sweep: every beast at Bond 1 or more with no initiation and no Regional Variety is rolled for, once
     (the Bastion runs it when it opens and at each day, never the snapshot builder). { changed, count, lines }. */
  R.sweepInitiation = function (s, data, rand) {
    var out = { changed: false, count: 0, lines: [] };
    if (!isObj(s) || !Array.isArray(s.creatures)) return out;
    s.creatures.forEach(function (c) {
      var d = R.creatureDev(c);
      if (!d || !d.bond || d.bond.level < 1 || isObj(d.initiation) || String(d.regional || '').trim()) return;
      var res = R.rollInitiation(s, data, c.id, rand);
      if (res.ok && res.initiated) { out.changed = true; out.count += 1; out.lines = out.lines.concat(res.lines); }
    });
    return out;
  };

  /* The snapshot code for a handler (what their phone shows), signed with their secret.
     The Chronicle is cut to its latest 40 entries to keep the code short. */
  R.beastSnapshotCode = function (s, data, handlerId) {
    var body = R.beastSnapshotBody(s, data, handlerId);
    if (!body.ok) return body;
    var snap = body.snapshot;
    /* When this code was made, so a phone can tell if a snapshot pasted later is older than the one it holds. */
    snap.madeAt = Date.now();
    return { ok: true, snapshot: snap, code: BH.codes.encodeSnapshot(snap, body.secret) };
  };
  /* The snapshot as it stands, without the time it was made (R.beastSnapshotCode and the online link's sender add that), so
     two of them can be compared to see whether anything changed. Never changes the save. */
  R.beastSnapshotBody = function (s, data, handlerId) {
    var secret = R.beastSecret(s, handlerId);
    if (!secret) return { ok: false, message: 'Make a pairing code for this handler first.' };
    var snap = P.build(s, data, handlerId);
    Object.keys(snap.creatures).forEach(function (id) {
      var d = snap.creatures[id];
      if (Array.isArray(d.chronicle) && d.chronicle.length > 40) { d.chroniclePartial = d.chronicle.length - 40; d.chronicle = d.chronicle.slice(-40); }
    });
    return { ok: true, snapshot: snap, secret: secret };
  };
}());
