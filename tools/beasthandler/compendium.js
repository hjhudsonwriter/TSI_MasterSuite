/* The Scarlett Isles: D&D Tool Suite — the Compendium of Beasts (5 November 2026, Harry).
   A parchment book with one tab for each kind of beast the Beast Pen keeps: the engraving, the kind's name, its Regional Varieties
   (read from data/profile-tables.js) and a general description (data/beast-compendium-data.js). It only reads and shows; it saves
   nothing and changes nothing. Used in the DM's Beast Pen panel (in a pop-up) and in the Bastion's Player View.
   TSI.beastCompendium.create({ start: '<kind id>' }) → { node, select(id), current() } */
(function () {
  'use strict';

  var TSI = window.TSI;

  function el(tag, attrs, kids) { return TSI.el(tag, attrs, kids); }

  function kinds() { return (window.TSI_DATA.beastCompendium || { kinds: [] }).kinds; }
  function varietiesOf(id) {
    var p = window.TSI_DATA.beastProfile;
    var sp = p && p.species && p.species[id];
    return sp && Array.isArray(sp.regional) ? sp.regional : [];
  }
  /* "Northern Province (Clan Blackstone)" is kept as the data has it. */
  function areaOf(v) { return v && v.area ? String(v.area) : ''; }

  /* The small book icon for the button that opens it (the DM's panel and the players' panel). */
  function icon() {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'tsi-bc-icon');
    svg.setAttribute('aria-hidden', 'true');
    [['M4 5.5c2.6-1 5.4-1 8 .7v12.6c-2.6-1.7-5.4-1.7-8-.7z', 'tsi-bc-icon__page'], ['M20 5.5c-2.6-1-5.4-1-8 .7v12.6c2.6-1.7 5.4-1.7 8-.7z', 'tsi-bc-icon__page'], ['M12 6.2v12.6', 'tsi-bc-icon__spine']].forEach(function (d) {
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d[0]);
      path.setAttribute('class', d[1]);
      svg.appendChild(path);
    });
    return svg;
  }

  TSI.beastCompendium = {
    icon: icon,
    create: function (opts) {
      opts = opts || {};
      var list = kinds();
      var folder = (window.TSI_DATA.beastCompendium || {}).folder || '';
      var current = '';
      var tabs = {};
      var tabRow = el('div', { class: 'tsi-bc__tabs', role: 'tablist', 'aria-label': 'Kinds of beast', 'data-test': 'bc-tabs' });
      var page = el('div', { class: 'tsi-bc__page', role: 'tabpanel', 'data-test': 'bc-page' });
      var node = el('div', { class: 'tsi-bc', 'data-test': 'bc' }, [tabRow, page]);

      list.forEach(function (k) {
        var b = el('button', { type: 'button', class: 'tsi-bc__tab', role: 'tab', id: 'tsi-bc-tab-' + k.id, 'aria-selected': 'false', tabindex: '-1', 'data-test': 'bc-tab-' + k.id, text: k.name });
        b.addEventListener('click', function () { select(k.id); b.focus(); });
        b.addEventListener('keydown', function (e) {
          var i = list.findIndex(function (x) { return x.id === k.id; });
          var to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : -1;
          if (to < 0) return;
          e.preventDefault();
          var next = list[(to + list.length) % list.length];
          select(next.id);
          tabs[next.id].focus();
        });
        tabs[k.id] = b;
        tabRow.appendChild(b);
      });

      function missing() { return el('p', { class: 'tsi-bc__missing', 'data-test': 'bc-missing', text: 'The picture is still to come.' }); }

      function select(id) {
        var k = list.filter(function (x) { return x.id === id; })[0] || list[0];
        if (!k) return;
        current = k.id;
        list.forEach(function (x) {
          var on = x.id === k.id;
          tabs[x.id].setAttribute('aria-selected', on ? 'true' : 'false');
          tabs[x.id].setAttribute('tabindex', on ? '0' : '-1');
          tabs[x.id].classList.toggle('is-on', on);
        });
        page.setAttribute('aria-labelledby', 'tsi-bc-tab-' + k.id);
        TSI.clear(page);
        /* The page is the same shape as the engravings (4:3). The picture fills it; the writing sits in the empty side of the
           picture (k.side: 'left' or 'right', opposite the beast). */
        page.setAttribute('data-side', k.side === 'right' ? 'right' : 'left');
        if (k.image) {
          var im = el('img', { class: 'tsi-bc__img', alt: 'An engraving of a ' + k.name.toLowerCase(), draggable: 'false', src: TSI.path(folder + k.image), 'data-test': 'bc-img' });
          im.addEventListener('error', function () { im.remove(); page.appendChild(missing()); });
          page.appendChild(im);
        } else {
          page.appendChild(missing());
        }
        var vs = varietiesOf(k.id);
        var text = el('div', { class: 'tsi-bc__text', 'data-test': 'bc-text' }, [
          el('h2', { class: 'tsi-bc__title', 'data-test': 'bc-title', text: k.name }),
          el('h3', { class: 'tsi-bc__sub', text: 'Regional varieties' }),
          el('ul', { class: 'tsi-bc__vars', 'data-test': 'bc-varieties' }, vs.map(function (v) {
            return el('li', { class: 'tsi-bc__var', 'data-test': 'bc-variety' }, [el('b', { text: v.name }), areaOf(v) ? el('span', { class: 'tsi-bc__area', text: ' \u00b7 ' + areaOf(v) }) : null]);
          })),
          el('div', { class: 'tsi-bc__desc', 'data-test': 'bc-desc' }, k.lines.map(function (p) { return el('p', { text: p }); }))
        ]);
        page.appendChild(text);
      }

      select(opts.start || (list[0] && list[0].id));
      return { node: node, select: select, current: function () { return current; } };
    }
  };
}());
