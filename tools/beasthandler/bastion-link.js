/* Scarlett Isles: Beast Handler — the Bastion's side of the link (BH-2b and BH-3a).

   Plain functions (no screen code), tested on tests/rules.html. They add to the
   Bastion's rules (tools/bastion/rules.js), as courier-rules.js does, and are
   loaded in the Bastion and in the companion's laptop copy.

   The Bastion stays the only authority. A handler's phone (or the companion
   on this laptop) can only ASK; here the Bastion checks every request against
   its live save, once, and records a receipt in the same save, so a retry, a
   refresh, a reconnect or a second delivery can never do anything twice (the
   same promise as the Explorer's link, shared/js/bridge-rules.js, and the DM
   doc's score edits, R.applyDmEdits).

   A request ("command"): { v: 1, id, campaign, handler, creature, fac?, type,
   view, payload, at }, where type is
   - 'profile.set'    payload { dominant?, attachment?, trigger?, regional? }
   - 'order.request'  payload { fnId }, fac the building
   Nothing else can be asked: not a bond, a name, a handler, a milestone, a
   Chronicle line, a build, a purchase, or anything that costs gold.

   A request is refused, with a plain reason, when: it isn't understood; it
   was made for a different Bastion save; it is more than 30 days old; the
   creature isn't housed in a standing building; the handler is no longer its
   handler (the DM changed it); the order isn't free training; a training
   programme is pending at that building (the building lock, Harry's D3, narrowed
   to training only on 21 October 2026); the
   building is Under Repair; or the Bastion's own rules (R.trainingBlocker)
   say the creature can't take it now (level, bond, handler, a place free).
   The DM's own training places and orders are untouched.

   How it arrives: from the companion on this laptop through the queue it keeps
   (tsi.beasthandler.queue, read here by the Bastion's window), or as a signed
   request code from a phone (the secret for each handler is kept here,
   in s.beast, never in a snapshot). The saved record:
   s.beast = { campaignId, accept, handlers: [{ id, name, secret, since }],
   done: { <command id>: receipt } }, added the first time it is needed. */
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

  var RECEIPTS_MAX = 1000;
  /* A phone's clock may be a little fast; more than this and the request is refused (it would never expire). */
  var FUTURE_MS = 2 * 24 * 3600 * 1000;
  var PROFILE_LOG_MAX = 40;
  var HANDLERS_MAX = 40;
  var TYPES = ['profile.set', 'order.request'];
  R.BEAST_TYPES = TYPES;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function txt(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function plain(text, max) { return Pf.clean(text, max); }

  /* ---------- The saved record ---------- */
  R.cleanBeast = function (raw) {
    var src = isObj(raw) ? raw : {};
    var seen = {};
    var handlers = [];
    arr(src.handlers).forEach(function (h) {
      if (!isObj(h) || handlers.length >= HANDLERS_MAX) return;
      var name = plain(h.name, 40);
      var id = P.handlerKey(h.id !== undefined && h.id !== '' ? h.id : name);
      if (!id || seen[id]) return;
      seen[id] = true;
      handlers.push({ id: id.slice(0, 40), name: name || id, secret: typeof h.secret === 'string' && /^[A-Za-z0-9]{16,64}$/.test(h.secret) ? h.secret : '', since: dayNum(h.since, 1) });
    });
    var done = {};
    var d = isObj(src.done) ? src.done : {};
    Object.keys(d).forEach(function (id) {
      var r = d[id];
      if (!isObj(r) || !/^(?!(?:__proto__|constructor|prototype|toString|valueOf|hasOwnProperty)$)[A-Za-z0-9._:-]{6,80}$/.test(id)) return;
      done[id] = {
        r: r.r === 'applied' ? 'applied' : 'refused',
        why: plain(r.why, 240),
        day: dayNum(r.day, 1),
        at: typeof r.at === 'number' && isFinite(r.at) ? r.at : 0,
        type: TYPES.indexOf(r.type) !== -1 ? r.type : '',
        handler: P.handlerKey(r.handler).slice(0, 40),
        who: plain(r.who, 40),
        creature: txt(r.creature, 80),
        label: plain(r.label, 160),
        orderId: txt(r.orderId, 60),
        dueDay: typeof r.dueDay === 'number' && isFinite(r.dueDay) ? Math.floor(r.dueDay) : null
      };
    });
    /* floor: the time of the newest receipt ever forgotten. A request made at or before it is refused as too
       old, so forgetting a receipt can never let its request be done a second time. */
    var floor = typeof src.floor === 'number' && isFinite(src.floor) && src.floor > 0 ? src.floor : 0;
    var ids = Object.keys(done);
    if (ids.length > RECEIPTS_MAX) {
      ids.sort(function (a, b) { return done[a].at - done[b].at; }).slice(0, ids.length - RECEIPTS_MAX).forEach(function (id) { floor = Math.max(floor, done[id].at); delete done[id]; });
    }
    return {
      campaignId: typeof src.campaignId === 'string' && /^[A-Za-z0-9]{8,40}$/.test(src.campaignId) ? src.campaignId : '',
      accept: src.accept !== false,
      handlers: handlers,
      done: done,
      floor: floor
    };
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
    R.log(s, 'Beast Handler', 'The code for ' + e.name + ' was taken back. Requests signed with it are now refused.');
    return { ok: true, name: e.name };
  };

  /* ---------- Receipts ---------- */
  /* A handler's own recent receipts, newest first, each with where its order has got to:
     'scheduled' (still pending at the building), 'cancelled' (gone without finishing), 'ended' (gone, and the creature too) or 'completed'. */
  R.beastReceiptsFor = function (s, handlerId, limit) {
    var B = isObj(s.beast) ? s.beast : null;
    var key = P.handlerKey(handlerId);
    if (!B || !key) return [];
    var pending = new Map();
    arr(s.pendingOrders).forEach(function (o) { if (isObj(o) && o.id) pending.set(o.id, o); });
    return Object.keys(B.done).map(function (id) { return Object.assign({ id: id }, B.done[id]); })
      .filter(function (r) { return r.handler === key; })
      .sort(function (a, b) { return b.at - a.at; })
      .slice(0, limit || 20)
      .map(function (r) {
        /* No longer pending and no Chronicle line from finishing it: it was cancelled (or its building came
           down), not done, whatever day it is now (a paused or repaired order's ready day moves later, so the
           day it first promised proves nothing). A finished programme leaves a Chronicle line linked to the
           order. If the creature has gone, all that is known is that it is no longer scheduled ('ended'). */
        var cr = r.orderId && !pending.has(r.orderId) ? R.creatureById(s, r.creature) : null;
        var finished = !!(cr && isObj(cr.development) && arr(cr.development.chronicle).some(function (e) { return isObj(e) && e.link === r.orderId; }));
        var gone = r.orderId && !pending.has(r.orderId) && !finished;
        var state = r.r === 'refused' ? 'refused' : (r.type === 'order.request' ? (r.orderId && pending.has(r.orderId) ? 'scheduled' : gone ? (cr ? 'cancelled' : 'ended') : 'completed') : 'saved');
        return { id: r.id, type: r.type, state: state, why: r.why, day: r.day, label: r.label, creature: r.creature, dueDay: state === 'scheduled' ? pending.get(r.orderId).dueDay : r.dueDay };
      });
  };

  /* The latest receipts of every handler, newest first, for the DM's own panel:
     [{ id, handler (name), r, why, day, label, type }]. */
  R.beastRecent = function (s, limit) {
    var B = isObj(s.beast) ? s.beast : null;
    if (!B) return [];
    var names = new Map();
    B.handlers.forEach(function (h) { names.set(h.id, h.name); });
    return Object.keys(B.done).map(function (id) { return Object.assign({ id: id }, B.done[id]); })
      .sort(function (a, b) { return b.at - a.at; })
      .slice(0, limit || 10)
      .map(function (r) { return { id: r.id, handler: names.get(r.handler) || r.who || r.handler, r: r.r, why: r.why, day: r.day, label: r.label, type: r.type }; });
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

  /* ---------- Applying a request ---------- */
  var HANDLE_ID = /^(?!(?:__proto__|constructor|prototype|toString|valueOf|hasOwnProperty)$)[A-Za-z0-9._:-]{8,80}$/;
  /* The refusal's words for a player: the Bastion's own reason, minus anything that is the DM's business. */
  function forPlayer(reason) {
    var t = String(reason || '');
    if (/confirm it first|waiting for you to confirm/i.test(t)) return 'A bond milestone is waiting for the DM to confirm it first.';
    if (/treasury|\bgp\b/i.test(t)) return 'That order isn\'t one a handler can ask for.';
    return t.replace(/\byou\b/gi, 'the DM').replace(/\byour\b/gi, 'the DM\'s');
  }

  /* Check and apply one request. auth: { via: 'local' } (the companion on this laptop) or
     { via: 'code', handler } (a signed code, the signature already checked).
     Returns { ok, receipt?, duplicate?, held?, ignored?, lines: [DM lines] }. Never throws on bad input. */
  R.beastProcess = function (s, data, cmd, auth, now, rand) {
    var out = { ok: false, lines: [] };
    if (!isObj(cmd) || typeof cmd.id !== 'string' || !HANDLE_ID.test(cmd.id)) { out.ignored = true; return out; }
    var B = R.beastState(s);
    if (Object.prototype.hasOwnProperty.call(B.done, cmd.id)) { out.duplicate = true; out.receipt = B.done[cmd.id]; return out; }
    if (B.accept === false) { out.held = true; return out; }
    var at = typeof now === 'number' ? now : Date.now();
    var rec = { r: 'refused', why: '', day: dayNum(s.day, 1), at: at, type: TYPES.indexOf(cmd.type) !== -1 ? cmd.type : '', handler: P.handlerKey(cmd.handler).slice(0, 40), who: '', creature: txt(cmd.creature, 80), label: '', orderId: '', dueDay: null };
    function finish(r, why) {
      rec.r = r; rec.why = plain(why, 240);
      B.done[cmd.id] = rec;
      var ids = Object.keys(B.done);
      if (ids.length > RECEIPTS_MAX) ids.sort(function (a, b) { return B.done[a].at - B.done[b].at; }).slice(0, ids.length - RECEIPTS_MAX).forEach(function (k) { B.floor = Math.max(B.floor || 0, B.done[k].at); delete B.done[k]; });
      out.ok = r === 'applied'; out.receipt = rec;
      return out;
    }
    function refuse(why) { return finish('refused', why); }

    if (cmd.v !== 1 || TYPES.indexOf(cmd.type) === -1 || !isObj(cmd.payload) || typeof cmd.creature !== 'string' || !rec.handler) return refuse('That request isn\'t one this Bastion understands.');
    if (typeof cmd.campaign !== 'string' || cmd.campaign !== B.campaignId) return refuse('That request was made for a different Bastion save. Refresh your view and try again.');
    if (typeof cmd.at !== 'number' || !isFinite(cmd.at) || at - cmd.at > BH.codes.MAX_AGE_MS || cmd.at <= (B.floor || 0)) return refuse('That request is too old. Make it again.');
    if (cmd.at - at > FUTURE_MS) return refuse('That request is dated in the future. Check the date and time on the phone, then make it again.');
    if (auth && auth.via === 'code' && !P.sameHandler(auth.handler, cmd.handler)) return refuse('That request wasn\'t signed by the handler it names.');

    var c = R.creatureById(s, cmd.creature);
    if (!c) return refuse('That creature isn\'t at the Ironbow any more.');
    /* Whose is it, before anything is said about it: another handler's beast is never named. */
    var d = R.creatureDev(c);
    if (!d || !d.handlerId || !P.sameHandler(d.handlerId, cmd.handler)) return refuse('That creature isn\'t yours any more: the DM has given it another handler, or none.');
    var home = P.homes(data).filter(function (h) { return h.speciesId === c.species; })[0];
    var name = R.creatureName(data, c);
    rec.label = name;
    if (!home || c.status !== 'housed' || c.home !== home.facId || R.builtFacilityIds(s, data).indexOf(home.facId) === -1) return refuse(name + ' isn\'t housed in a standing building right now.');
    var who = R.handlerName(d.handlerId);
    rec.who = plain(who, 40);

    if (cmd.type === 'profile.set') {
      var chk = Pf.check(cmd.payload);
      if (!chk.ok) return refuse(chk.problems[0]);
      var res = R.setProfile(s, data, c.id, chk.clean, who);
      if (!res.ok) return refuse(res.message);
      rec.label = name + ' (profile)';
      out.lines.push(res.changed.length ? name + '\'s profile was updated by ' + who + '.' : 'No change to ' + name + '\'s profile.');
      return finish('applied', res.changed.length ? 'Saved.' : 'Nothing was different, so nothing changed.');
    }

    /* order.request */
    var fac = R.facility(data, home.facId);
    var fn = isObj(cmd.payload) && typeof cmd.payload.fnId === 'string' ? R.fn(fac, cmd.payload.fnId) : null;
    if (!fn || !P.isPlayerOrder(fn)) return refuse('That isn\'t an order a handler can ask for.');
    rec.label = name + ': ' + fn.label;
    var busy = P.pendingAt(s, fac.id);
    if (busy) {
      var mineHere = R.trainingOrderFor(s, c.id);
      return refuse('The ' + fac.name + ' is busy (' + P.busyLabel(s, data, busy, mineHere && mineHere.id === busy.id ? c : null).replace(/^A training programme/, 'a training programme') + '), ready on ' + R.dayLabel(busy.dueDay) + '. Nothing new can be asked until it is done.');
    }
    var why = R.trainingBlocker(s, data, fac, fn, c);
    if (why) return refuse(forPlayer(why));
    var idx = R.trainingOptions(s, data, fac, fn).map(function (o) { return o.trainCreatureId; }).indexOf(c.id);
    if (idx < 0) return refuse(name + ' can\'t take that order now.');
    var before = s.pendingOrders.length;
    var made = R.issueOrder(s, data, fac.id, fn.id, idx, rand || Math.random);
    if (!made.ok || s.pendingOrders.length !== before + 1) return refuse(forPlayer(made.message || 'The Bastion couldn\'t start that order.'));
    var order = s.pendingOrders[s.pendingOrders.length - 1];
    rec.orderId = txt(order.id, 60);
    rec.dueDay = order.dueDay;
    if (made.log) R.log(s, made.log[0], made.log[1] + ' Asked for by ' + who + ' (Beast Handler).');
    out.lines.push(who + ' asked for ' + fn.label + ' for ' + name + ': accepted, ready on ' + R.dayLabel(order.dueDay) + '.');
    return finish('applied', 'Accepted: ready on ' + R.dayLabel(order.dueDay) + '.');
  };

  /* A list of requests from the companion's queue on this laptop: each once, oldest first.
     Returns { changed, lines, applied, refused }. */
  R.beastProcessQueue = function (s, data, list, now, rand) {
    var out = { changed: false, lines: [], applied: 0, refused: 0 };
    if (!Array.isArray(list)) return out;
    list.filter(isObj).slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); }).slice(0, 200).forEach(function (cmd) {
      var res = R.beastProcess(s, data, cmd, { via: 'local' }, now, rand);
      if (res.duplicate || res.ignored || res.held) return;
      out.changed = true;
      if (res.ok) out.applied += 1; else out.refused += 1;
      out.lines = out.lines.concat(res.ok ? res.lines : [(res.receipt && res.receipt.label ? res.receipt.label + ': ' : '') + 'refused. ' + (res.receipt ? res.receipt.why : '')]);
    });
    return out;
  };

  /* A request code pasted in by the DM: find the handler's secret, check the signature, then
     process it. { ok, why?, receipt?, duplicate?, lines } (no receipt when the code itself is bad). */
  R.beastProcessCode = function (s, data, text, now, rand) {
    var peek = BH.codes.peekCommand(text);
    if (!peek.ok) return { ok: false, bad: true, why: peek.why, lines: [] };
    var secret = R.beastSecret(s, peek.command.handler);
    if (!secret) return { ok: false, bad: true, why: 'There is no active pairing code for that handler. Make one in the Beast Handler panel first.', lines: [] };
    if (!BH.codes.verifyCommand(peek, secret)) return { ok: false, bad: true, why: 'That request wasn\'t signed with this handler\'s code (or was changed on the way), so it was ignored.', lines: [] };
    var res = R.beastProcess(s, data, peek.command, { via: 'code', handler: peek.command.handler }, now, rand);
    if (res.ignored) return { ok: false, bad: true, why: 'That request is damaged.', lines: [] };
    if (res.held) return { ok: false, held: true, why: 'Requests are switched off in the Beast Handler panel.', lines: [] };
    return res;
  };

  /* The snapshot code for a handler (what their phone shows), signed with their secret.
     The Chronicle is cut to its latest 40 entries to keep the code short. */
  R.beastSnapshotCode = function (s, data, handlerId) {
    var secret = R.beastSecret(s, handlerId);
    if (!secret) return { ok: false, message: 'Make a pairing code for this handler first.' };
    var snap = P.build(s, data, handlerId);
    /* When this code was made, so a phone can tell if a snapshot pasted later is older than the one it holds. */
    snap.madeAt = Date.now();
    Object.keys(snap.creatures).forEach(function (id) {
      var d = snap.creatures[id];
      if (d.chronicle.length > 40) { d.chroniclePartial = d.chronicle.length - 40; d.chronicle = d.chronicle.slice(-40); }
    });
    return { ok: true, snapshot: snap, code: BH.codes.encodeSnapshot(snap, secret) };
  };
}());
