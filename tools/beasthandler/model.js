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
    if (CATS[cat]) return CATS[cat];
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

  /* The title for a player to see: "Wyvern · Stormwing". */
  M.title = function (detail) { return detail.species.name + ' · ' + detail.name; };
}());
