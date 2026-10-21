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

  /* The Regional Variety table entry whose name matches (any capitals), or null. */
  M.regionalInfo = function (tables, speciesId, name) {
    var sp = tables && isObj(tables.species) ? tables.species[speciesId] : null;
    var key = String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!sp || !key) return null;
    return (sp.regional || []).filter(function (r) { return r.name.toLowerCase() === key; })[0] || null;
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

  /* A handler picker's choices: [{ value, label }] with "no handler" first. */
  M.handlerChoices = function (handlers) {
    var out = [{ value: '', label: 'No handler (see the directory only)' }];
    (handlers || []).forEach(function (h) { out.push({ value: h.id, label: h.name + ' (' + h.count + (h.count === 1 ? ' beast)' : ' beasts)') }); });
    return out;
  };

  /* ---------- Requests (what has been asked, and how the Bastion answered) ---------- */
  /* One beast's requests, newest first: those sent that the Bastion hasn't answered yet ('waiting'),
     then its answers, each { id, type, state, label, why, dueLabel }. state is 'waiting', 'scheduled',
     'completed', 'saved' or 'refused'. outbox: [{ id, type, creature, fac, label, at }]. */
  M.requestRows = function (snap, outbox, creatureId, limit) {
    var receipts = snap && Array.isArray(snap.receipts) ? snap.receipts : [];
    var answered = {};
    receipts.forEach(function (r) { answered[r.id] = true; });
    var rows = (outbox || []).filter(function (o) { return o.creature === creatureId && !answered[o.id]; })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); })
      .map(function (o) { return { id: o.id, type: o.type, state: 'waiting', label: o.label, why: '', dueLabel: '' }; });
    receipts.filter(function (r) { return r.creature === creatureId; }).forEach(function (r) {
      rows.push({ id: r.id, type: r.type, state: r.state, label: r.label, why: r.why, dueLabel: r.dueDay ? 'Day ' + r.dueDay : '' });
    });
    return rows.slice(0, limit || 6);
  };
  M.requestLine = function (row) {
    if (row.state === 'waiting') return 'Submitted, waiting for the Bastion to confirm. Nothing has started.';
    if (row.state === 'scheduled') return 'Accepted and scheduled in the Bastion' + (row.dueLabel ? ': ready on ' + row.dueLabel + '.' : '.');
    if (row.state === 'completed') return 'Completed.';
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
