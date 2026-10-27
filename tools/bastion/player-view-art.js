/* The Ironbow Bastion Manager: which Prison Tower picture the Player View shows, as plain functions (no screen code).
   It needs nothing else, so the DM's page (for the tests) and the Player View's page both load it.
   The picture follows which of the three cells (left, middle, right) hold someone: the key is 'cells-' and then one
   digit a cell, 1 when it is in use ('cells-101'). Not every picture exists yet (see KNOWN_ISSUES BAS-SB-109). */
(function () {
  'use strict';
  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.bastion = TSI.bastion || {};

  function bits(cells) {
    var c = Array.isArray(cells) ? cells : [];
    return [0, 1, 2].map(function (i) { return c[i] ? 1 : 0; });
  }
  /* The key for a state of the cells: [true, false, true] gives 'cells-101'. */
  ns.cellsKey = function (cells) { return 'cells-' + bits(cells).join(''); };
  /* The picture key to show, from the pictures that exist (a { key: file } map): the exact one if it exists; else the
     best SUBSET picture (every cell it shows is really in use; the most cells wins, ties go to the leftmost); else the
     empty cells'. So a missing picture never shows a prisoner who is not there. '' when nothing fits. */
  ns.cellsPictureKey = function (states, cells) {
    states = states || {};
    var want = bits(cells);
    var exact = ns.cellsKey(want);
    if (states[exact]) return exact;
    var best = '', bestCount = -1, bestRank = -1;
    for (var n = 0; n < 8; n++) {
      var b = [(n >> 2) & 1, (n >> 1) & 1, n & 1];
      var key = ns.cellsKey(b);
      if (!states[key]) continue;
      if (b.some(function (x, i) { return x && !want[i]; })) continue;
      var count = b[0] + b[1] + b[2];
      var rank = b[0] * 4 + b[1] * 2 + b[2];   /* leftmost cells weigh most */
      if (count > bestCount || (count === bestCount && rank > bestRank)) { best = key; bestCount = count; bestRank = rank; }
    }
    return best;
  };
})();
