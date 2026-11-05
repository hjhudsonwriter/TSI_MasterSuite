/* Combat Tracker — the stat block panel (guide 3). enc.statBlock.render(block, opts) draws one block (the SRD's, from data/srd-monsters.js, or a
   homebrew one made with New stat block…) as a card: AC, HP, speed, abilities, saves, skills, senses, traits, actions, reactions and legendary
   actions. It only draws; nothing here saves anything. opts: { note: 'SRD says AC 11, 59 HP' } */
(function () {
  'use strict';

  var TSI = window.TSI;
  var enc = TSI.encounter = TSI.encounter || {};
  var el = function (tag, attrs, kids) { return TSI.el(tag, attrs, kids); };
  var NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

  function cap(s) { return String(s || '').replace(/(^|[\s-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function cr(v) { return v === 0.125 ? '1/8' : v === 0.25 ? '1/4' : v === 0.5 ? '1/2' : String(v); }
  function signed(n) { return (n >= 0 ? '+' : '−') + Math.abs(n); }
  function line(label, text, test) {
    if (text === '' || text === null || text === undefined) return null;
    return el('p', { class: 'tsi-sb__line', 'data-test': test || null }, [el('b', { text: label + ' ' }), el('span', { text: String(text) })]);
  }
  function speedText(b) {
    if (b.speedText) return b.speedText;
    var sp = b.sp || {};
    return Object.keys(sp).map(function (k) { return (k === 'walk' ? '' : k + ' ') + sp[k]; }).join(', ');
  }
  function sensesText(b) {
    if (b.sensesText) return b.sensesText;
    var se = b.se || {};
    var out = [];
    Object.keys(se).forEach(function (k) { if (k !== 'passive_perception') out.push(cap(k.replace(/_/g, ' ')) + ' ' + se[k]); });
    if (Number.isFinite(se.passive_perception)) out.push('Passive Perception ' + se.passive_perception);
    return out.join(', ');
  }
  function savesText(b) {
    if (b.savesText) return b.savesText;
    var sv = b.sv || {};
    return NAMES.map(function (n) { var k = n.toLowerCase(); return Number.isFinite(sv[k]) ? n + ' ' + signed(sv[k]) : null; }).filter(Boolean).join(', ');
  }
  function skillsText(b) {
    if (b.skillsText) return b.skillsText;
    var sk = b.sk || {};
    return Object.keys(sk).map(function (k) { return cap(k.replace(/-/g, ' ')) + ' ' + signed(sk[k]); }).join(', ');
  }
  function listText(v) { return Array.isArray(v) ? v.join('; ') : String(v || ''); }
  function section(title, items, test, recharge) {
    if (!items || !items.length) return null;
    return el('div', { class: 'tsi-sb__section', 'data-test': test }, [
      el('h4', { class: 'tsi-sb__h', text: title }),
      items.map(function (a) {
        var rc = recharge && enc.combat ? enc.combat.rechargeMin(a) : null;
        var name = a.n + (rc && !/Recharge/i.test(a.n) ? ' (Recharge ' + rc + '–6)' : '') + (a.pd ? ' (' + a.pd + '/Day)' : '');
        return el('p', { class: 'tsi-sb__entry', 'data-test': 'sb-entry' }, [el('b', { class: 'tsi-sb__entry-name', text: name + '. ' }), el('span', { text: a.d || '' })]);
      })
    ]);
  }

  enc.statBlock = {
    render: function (b, opts) {
      opts = opts || {};
      if (!b) return el('p', { class: 'tsi-enc-muted', 'data-test': 'sb-none', text: 'No stat block for this creature. Use the Open Stat Block link, or attach one from the SRD or the New stat block form.' });
      var C = enc.combat;
      var type = [b.sz, b.t].filter(Boolean).map(function (x, i) { return i === 0 ? x : x; }).join(' ') + (b.al ? ', ' + b.al : '');
      var abil = el('div', { class: 'tsi-sb__abil', 'data-test': 'sb-abilities' }, NAMES.map(function (n, i) {
        var score = (b.ab || [])[i];
        return el('div', { class: 'tsi-sb__ab' }, [el('b', { text: n }), el('span', { text: Number.isFinite(score) ? score + ' (' + signed(C.modifier(score)) + ')' : '—' })]);
      }));
      var kids = [
        el('h3', { class: 'tsi-sb__name', 'data-test': 'sb-name', text: b.n }),
        el('p', { class: 'tsi-sb__type', text: type }),
        line('AC', b.ac + (b.at ? ' (' + b.at + ' armour)' : ''), 'sb-ac'),
        line('HP', b.hp + (b.hd ? ' (' + b.hd + ')' : ''), 'sb-hp'),
        line('Speed', speedText(b), 'sb-speed'),
        abil,
        line('Saves', savesText(b)),
        line('Skills', skillsText(b)),
        line('Vulnerabilities', listText(b.vu)),
        line('Resistances', b.resistText || listText(b.rs)),
        line('Immunities', listText(b.im)),
        line('Condition immunities', listText(b.ci)),
        line('Senses', sensesText(b)),
        line('Languages', b.lg),
        line('CR', b.cr !== '' && b.cr !== undefined ? cr(b.cr) + (b.xp ? ' (' + b.xp.toLocaleString('en-GB') + ' XP)' : '') + (b.pb ? ', PB ' + signed(b.pb) : '') : '', 'sb-cr'),
        section('Traits', b.tr, 'sb-traits'),
        section('Actions', b.ac_, 'sb-actions', true),
        section('Bonus actions', b.ba, 'sb-bonus'),
        section('Reactions', b.re, 'sb-reactions'),
        b.la && b.la.length ? el('div', { class: 'tsi-sb__section', 'data-test': 'sb-legendary' }, [
          el('h4', { class: 'tsi-sb__h', text: 'Legendary actions' }),
          el('p', { class: 'tsi-sb__entry', text: 'Legendary Action Uses: ' + (b.lan || 3) + '. Immediately after another creature’s turn, it can expend a use to take one of these.' }),
          b.la.map(function (a) { return el('p', { class: 'tsi-sb__entry', 'data-test': 'sb-entry' }, [el('b', { class: 'tsi-sb__entry-name', text: a.n + '. ' }), el('span', { text: a.d || '' })]); })
        ]) : null,
        opts.note ? el('p', { class: 'tsi-sb__note', 'data-test': 'sb-note', text: opts.note }) : null,
        el('p', { class: 'tsi-sb__foot', 'data-test': 'sb-foot', text: b.ed === 'homebrew' ? 'A stat block made for this campaign.' : 'From the System Reference Document ' + (b.ed === '2014' ? '5.1 (the 2014 rules; not in SRD 5.2)' : '5.2 (the 2024 rules)') + ', © Wizards of the Coast, CC BY 4.0.' })
      ];
      return el('div', { class: 'tsi-sb', 'data-test': 'stat-block-panel' }, kids);
    }
  };
}());
