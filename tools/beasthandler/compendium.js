/* The Scarlett Isles: D&D Tool Suite — the Compendium of Beasts (5 November 2026, Harry).
   A parchment book with one tab for each kind of beast the Beast Pen keeps: the engraving, the kind's name, its Regional Varieties
   (read from data/profile-tables.js) and a general description (data/beast-compendium-data.js). It only reads and shows; it saves
   nothing and changes nothing. Used in the DM's Beast Pen panel (in a pop-up) and in the Bastion's Player View.
   TSI.beastCompendium.create({ start: '<kind id>' }) → { node, select(id), current() } */
(function () {
  'use strict';

  var TSI = window.TSI;

  function el(tag, attrs, kids) { return TSI.el(tag, attrs, kids); }

  /* The six kinds, then the Beast-Catcher's Guide as a seventh tab (6 November 2026, Harry). */
  function catcher() { return window.TSI_DATA.beastCatcher || null; }
  var GUIDE_ID = 'catchers_guide';
  function kinds() {
    var six = (window.TSI_DATA.beastCompendium || { kinds: [] }).kinds;
    var g = catcher();
    return g ? six.concat([{ id: GUIDE_ID, name: g.title, guide: true }]) : six;
  }
  function itemById(g, id) { return (g.items || []).filter(function (i) { return i.id === id; })[0] || null; }
  function kindName(id) { var k = ((window.TSI_DATA.beastCompendium || {}).kinds || []).filter(function (x) { return x.id === id; })[0]; return k ? k.name : id; }

  /* The Guide's page: the Kit, the ten tools, the best-fit loadouts and how a capture plays, laid out as cards on parchment. */
  function guidePage() {
    var g = catcher();
    function pills(ids, all) {
      if (all) return el('div', { class: 'tsi-bc__pills' }, [el('span', { class: 'tsi-bc__pill tsi-bc__pill--all', text: 'All six' })]);
      return el('div', { class: 'tsi-bc__pills' }, ids.map(function (id) { return el('span', { class: 'tsi-bc__pill', text: kindName(id) }); }));
    }
    function card(item, kit) {
      var every = item.kinds.length === 6;
      return el('article', { class: 'tsi-bc__card' + (kit ? ' tsi-bc__card--kit' : ''), 'data-test': kit ? 'bc-kit' : 'bc-item', 'data-id': item.id || 'kit' }, [
        el('header', { class: 'tsi-bc__card-head' }, [el('h4', { class: 'tsi-bc__card-name', text: item.name }), el('span', { class: 'tsi-bc__crafted', text: item.crafted })]),
        el('p', { class: 'tsi-bc__card-what', text: item.what }),
        el('div', { class: 'tsi-bc__compat' }, [
          el('span', { class: 'tsi-bc__compat-label', text: 'Suits' }),
          pills(item.kinds, every),
          item.note ? el('span', { class: 'tsi-bc__note', text: '(' + item.note + ')' }) : null
        ])
      ]);
    }
    var rows = Object.keys(g.loadouts).map(function (k) {
      return el('tr', { 'data-test': 'bc-loadout', 'data-kind': k }, [el('th', { scope: 'row', text: kindName(k) })].concat(g.loadouts[k].map(function (id) { var it = itemById(g, id); return el('td', { text: it ? it.name : id }); })));
    });
    return el('div', { class: 'tsi-bc__guide', 'data-test': 'bc-guide' }, [
      el('header', { class: 'tsi-bc__guide-head' }, [
        el('h2', { class: 'tsi-bc__title', 'data-test': 'bc-title', text: g.title }),
        el('p', { class: 'tsi-bc__date', text: g.date })
      ]),
      el('p', { class: 'tsi-bc__lead', text: g.intro }),
      el('h3', { class: 'tsi-bc__sub tsi-bc__sub--guide', text: g.kitHeading }),
      card(g.kit, true),
      el('h3', { class: 'tsi-bc__sub tsi-bc__sub--guide', text: g.oddsHeading }),
      el('p', { class: 'tsi-bc__lead', text: g.oddsIntro }),
      el('div', { class: 'tsi-bc__cards', 'data-test': 'bc-items' }, g.items.map(function (i) { return card(i, false); })),
      el('h3', { class: 'tsi-bc__sub tsi-bc__sub--guide', text: g.loadoutsHeading }),
      el('p', { class: 'tsi-bc__lead', text: g.loadoutsIntro }),
      el('table', { class: 'tsi-bc__table', 'data-test': 'bc-loadouts' }, [
        el('thead', null, el('tr', null, [el('th', { scope: 'col', text: 'Beast' }), el('th', { scope: 'col', text: 'Best-fit item 1' }), el('th', { scope: 'col', text: 'Best-fit item 2' }), el('th', { scope: 'col', text: 'Best-fit item 3' })])),
        el('tbody', null, rows)
      ]),
      el('h3', { class: 'tsi-bc__sub tsi-bc__sub--guide', text: g.howHeading }),
      el('p', { class: 'tsi-bc__lead tsi-bc__lead--note', text: g.howIntro }),
      el('dl', { class: 'tsi-bc__how', 'data-test': 'bc-how' }, [].concat.apply([], g.how.map(function (h) { return [el('dt', { text: h.label }), el('dd', { text: h.text })]; })))
    ]);
  }
  /* The foot of a beast's own page: the three tools its best-fit loadout names. */
  function toolsFor(kindId) {
    var g = catcher();
    var ids = g && g.loadouts && g.loadouts[kindId];
    if (!ids || !ids.length) return null;
    var plural = (g.plural && g.plural[kindId]) || kindName(kindId);
    return el('div', { class: 'tsi-bc__tools', 'data-test': 'bc-tools' }, [
      el('p', { class: 'tsi-bc__tools-lead', text: 'Beast-Catchers have been known to use the following tools to capture and subdue ' + plural + ':' }),
      el('ul', { class: 'tsi-bc__tools-list' }, ids.map(function (id) { var it = itemById(g, id); return el('li', { 'data-test': 'bc-tool', text: it ? it.name : id }); }))
    ]);
  }
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
        page.classList.toggle('is-guide', !!k.guide);
        if (k.guide) {
          /* The Guide is a long page that scrolls inside the same parchment page. */
          page.removeAttribute('data-side');
          page.setAttribute('tabindex', '0');
          page.scrollTop = 0;
          page.appendChild(guidePage());
          return;
        }
        page.removeAttribute('tabindex');
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
          el('div', { class: 'tsi-bc__desc', 'data-test': 'bc-desc' }, k.lines.map(function (p) { return el('p', { text: p }); })),
          toolsFor(k.id)
        ]);
        page.appendChild(text);
      }

      select(opts.start || (list[0] && list[0].id));
      return { node: node, select: select, current: function () { return current; } };
    }
  };
}());
