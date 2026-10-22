/* Scarlett Isles: Beast Handler — what the screens say (BH-1b).

   Plain functions (no screen code), tested on tests/rules.html. They turn a
   snapshot (projection.js) into the words and shapes the screens draw, so
   the screens only have to draw. Nothing here reads or changes the
   Bastion. */
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

  /* Bond 1 to 5 as five pills for a beast's main page: { n, label, state: 'done' | 'current' | 'todo' }, and the stage line. */
  M.BOND_SHORT = ['Acclimatised', 'Trusting', 'Bonded', 'Devoted', 'Legendary'];
  M.bondPills = function (level) {
    var lv = typeof level === 'number' && isFinite(level) ? Math.max(0, Math.min(5, Math.floor(level))) : 0;
    var pills = [];
    for (var n = 1; n <= 5; n++) pills.push({ n: n, label: M.BOND_SHORT[n - 1], state: n < lv ? 'done' : (n === lv ? 'current' : 'todo') });
    return { level: lv, pills: pills, stageText: 'Stage ' + lv + ' of 5' };
  };
  /* "Bond 3 · Bonded" for the rapport line. */
  M.rapportLine = function (bond) { return 'Bond ' + bond.level + ' · ' + bond.name; };

  /* The Regional Variety table entry a typed name means, or null. Capitals, spaces, hyphens and apostrophes do not matter
     ("Bleak hook" is Bleakhook); words in brackets are ignored; a leading "the" and a leading or trailing species word are
     allowed ("The Widowspine Wyvern", "Dire Wolf Nightfang"); and a name that mentions exactly one of the species' varieties
     means that one ("Slatejaw of the northern hills"). Anything else has no picture. */
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
    if (!snap.facilities.length) return 'No beast buildings stand at the Ironbow yet. The Wyvern Roost, the Griffin Tower and the Dire Wolf Den appear here once they are built.';
    if (snap.handler && !snap.handler.hasCreatures) return 'You have no beasts yet. The DM has to house a beast first and then make you its handler.';
    if (!snap.handler) return 'Choose a handler to see their beasts. Until then, you can see who lives where.';
    return '';
  };
  M.emptyBuilding = function (f) { return 'No ' + f.species.name.toLowerCase() + ' is housed here yet.'; };

  /* The Chronicle's category names. */
  var CATS = { training: 'Training', bond: 'Bond', handler: 'Handler', flight: 'Flight', note: 'Note' };
  M.catLabel = function (cat) {
    if (typeof cat === 'string' && Object.prototype.hasOwnProperty.call(CATS, cat)) return CATS[cat];
    var s = String(cat || '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Note';
  };

  /* The lines on the "check before you send" screen: [[label, text], …]. */
  M.confirmLines = function (detail, order) {
    var lines = [
      ['Creature', detail.name],
      ['Building', detail.facility.name + ', Level ' + detail.facility.level],
      ['Order', order.label],
      ['Takes', order.daysText],
      ['Ready on', order.readyLabel],
      ['Cost', order.costText]
    ];
    if (order.consequence) lines.push(['What happens', order.consequence]);
    return lines;
  };

  /* The line under the heading: where the picture came from and how fresh it is. */
  M.syncLine = function (info) {
    if (!info || !info.ok) return 'Not connected to a Bastion save.';
    return 'Read from the Bastion saved on this device · ' + info.asOfLabel;
  };

  /* ---------- The first meeting (Harry, 21 October 2026) ---------- */
  M.possessive = function (name) { var n = String(name || '').trim(); return n + (/s$/i.test(n) ? '\u2019' : '\u2019s'); };
  M.speciesNoun = function (detail) { return String(detail && detail.species && detail.species.name || 'beast').toLowerCase(); };
  /* The profile lines still waiting to be answered for a beast, newest request last winning: { regional?, dominant?, ... } or null. */
  M.pendingProfile = function (snap, outbox, creatureId) {
    var rows = M.requestRows(snap, outbox, creatureId, 50).filter(function (r) { return r.state === 'waiting' && r.type === 'profile.set' && isObj(r.payload); });
    if (!rows.length) return null;
    var out = {};
    rows.slice().reverse().forEach(function (r) {   /* requestRows is newest first; apply oldest first */
      ['dominant', 'attachment', 'trigger', 'regional'].forEach(function (k) { if (typeof r.payload[k] === 'string') out[k] = r.payload[k]; });
    });
    return Object.keys(out).length ? out : null;
  };
  /* The profile as the player should see it: the Bastion's lines with the ones asked for and not yet answered laid over. */
  M.effectiveProfile = function (detail, pending) {
    var p = detail && isObj(detail.profile) ? detail.profile : {};
    var out = { dominant: p.dominant || '', attachment: p.attachment || '', trigger: p.trigger || '', regional: p.regional || '' };
    if (pending) Object.keys(pending).forEach(function (k) { if (typeof pending[k] === 'string') out[k] = pending[k]; });
    return out;
  };
  /* Has this beast been introduced? Not until a subspecies has been chosen (saved, or asked for and waiting). */
  M.needsMeeting = function (detail, pending) {
    return !M.effectiveProfile(detail, pending).regional.trim();
  };
  /* Is the subspecies shown different from the Bastion's own (asked for, not yet answered)? Clearing it counts. */
  M.regionalWaiting = function (detail, pending) {
    var p = detail && isObj(detail.profile) ? detail.profile : {};
    return !!(pending && typeof pending.regional === 'string' && pending.regional.trim() !== String(p.regional || '').trim());
  };
  /* The newest profile request for a beast, if the Bastion refused it (so the player is told why); otherwise null. */
  M.refusedProfile = function (snap, outbox, creatureId) {
    var row = M.requestRows(snap, outbox, creatureId, 50).filter(function (r) { return r.type === 'profile.set'; })[0];
    return row && row.state === 'refused' ? row : null;
  };
  /* The words of the sequence. */
  M.meetingText = function (detail) {
    var n = detail.name, noun = M.speciesNoun(detail);
    return {
      meet: 'It\u2019s time to meet ' + n + '\u2026',
      subspecies: 'There are many subspecies of ' + noun + ' in The Scarlett Isles, but which one is ' + n + '?',
      personality: 'Every ' + noun + ' has its own unique personality. What is ' + M.possessive(n) + ' like?',
      welcome: 'Welcome to the Ironbow, ' + n + '!'
    };
  };

  /* A handler picker's choices: [{ value, label }] with "no handler" first. */
  M.handlerChoices = function (handlers) {
    var out = [{ value: '', label: 'No handler (see the directory only)' }];
    (handlers || []).forEach(function (h) { out.push({ value: h.id, label: h.name + ' (' + h.count + (h.count === 1 ? ' beast)' : ' beasts)') }); });
    return out;
  };

  /* ---------- Requests (what has been asked, and how the Bastion answered) ---------- */
  /* One beast's requests, newest first: those sent that the Bastion hasn't answered yet ('waiting'),
     then its answers, each { id, type, state, label, why, dueLabel }. state is 'waiting', 'scheduled',
     'completed', 'cancelled', 'ended', 'saved' or 'refused'. outbox: [{ id, type, creature, fac, label, at }]. */
  M.requestRows = function (snap, outbox, creatureId, limit) {
    var receipts = snap && Array.isArray(snap.receipts) ? snap.receipts : [];
    var answered = {};
    receipts.forEach(function (r) { answered[r.id] = true; });
    var rows = (outbox || []).filter(function (o) { return o.creature === creatureId && !answered[o.id]; })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); })
      .map(function (o) { return { id: o.id, type: o.type, state: 'waiting', label: o.label, why: '', dueLabel: '', payload: isObj(o.payload) ? o.payload : null }; });
    receipts.filter(function (r) { return r.creature === creatureId; }).forEach(function (r) {
      rows.push({ id: r.id, type: r.type, state: r.state, label: r.label, why: r.why, dueLabel: r.dueDay ? 'Day ' + r.dueDay : '' });
    });
    return rows.slice(0, limit || 6);
  };
  /* mode 'phone': a waiting request has only been made on this phone, so it says to send the code. */
  M.requestLine = function (row, mode) {
    if (row.state === 'waiting' && mode === 'phone') return 'Made on this phone. Send the code to the DM: nothing has started until the Bastion answers.';
    if (row.state === 'waiting') return 'Submitted, waiting for the Bastion to confirm. Nothing has started.';
    if (row.state === 'scheduled') return 'Accepted and scheduled in the Bastion' + (row.dueLabel ? ': ready on ' + row.dueLabel + '.' : '.');
    if (row.state === 'completed') return 'Completed.';
    if (row.state === 'cancelled') return 'No longer scheduled: it was cancelled in the Bastion before it finished.';
    if (row.state === 'ended') return 'No longer scheduled in the Bastion.';
    if (row.state === 'saved') return 'Saved in the Bastion.';
    return 'Refused: ' + (row.why || 'the Bastion couldn\'t do it.');
  };
  /* Has an order already been sent for this building and not yet answered? Then no second one is offered. */
  M.waitingOrderAt = function (snap, outbox, facId) {
    var answered = {};
    ((snap && snap.receipts) || []).forEach(function (r) { answered[r.id] = true; });
    return (outbox || []).filter(function (o) { return o.type === 'order.request' && o.fac === facId && !answered[o.id]; })[0] || null;
  };

  /* ---------- The companion's queue of requests on this laptop (tsi.beasthandler.queue) ---------- */
  var ID_OK = /^[A-Za-z0-9._:-]{8,80}$/;
  M.QUEUE_MAX = 100;
  /* A queue as saved, with anything that isn't a well-formed request dropped. { commands: [...] } */
  M.cleanQueue = function (raw) {
    var list = isObj(raw) && Array.isArray(raw.commands) ? raw.commands : [];
    var seen = {};
    var out = [];
    list.forEach(function (c) {
      if (!isObj(c) || typeof c.id !== 'string' || !ID_OK.test(c.id) || seen[c.id] || c.v !== 1) return;
      if (['profile.set', 'order.request'].indexOf(c.type) === -1 || !isObj(c.payload)) return;
      if (typeof c.handler !== 'string' || !c.handler || typeof c.creature !== 'string' || typeof c.at !== 'number' || !isFinite(c.at)) return;
      seen[c.id] = true;
      out.push({
        v: 1, id: c.id, campaign: typeof c.campaign === 'string' ? c.campaign.slice(0, 40) : '', handler: c.handler.slice(0, 40), creature: c.creature.slice(0, 80),
        fac: typeof c.fac === 'string' ? c.fac.slice(0, 40) : '', type: c.type, view: typeof c.view === 'string' ? c.view.slice(0, 20) : '',
        label: typeof c.label === 'string' ? c.label.slice(0, 160) : '', payload: JSON.parse(JSON.stringify(c.payload)), at: c.at
      });
    });
    return { commands: out.slice(-M.QUEUE_MAX) };
  };

  /* The title for a player to see: "Wyvern · Stormwing". */
  M.title = function (detail) { return detail.species.name + ' · ' + detail.name; };
}());
