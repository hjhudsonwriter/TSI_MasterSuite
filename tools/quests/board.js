/* Notice Board Quest Generator — the wooden board and its pinned notices.
   Drawn the same way on the DM's screen and in the players' window, from the
   plain notice data made by TSI.quests.rules.notice(). The players' window
   gets no Accept or Decline buttons (Harry's answer N4; KNOWN_ISSUES QST-14). */
(function () {
  'use strict';

  var TSI = window.TSI;
  var quests = TSI.quests = TSI.quests || {};
  var el = TSI.el;

  function notice(n, rot, actions) {
    var head = n.bounty
      ? [
        el('div', { class: 'tsi-quests-bounty-head', text: n.title }),
        el('div', { class: 'tsi-quests-bounty-target', text: n.text }),
        el('div', { class: 'tsi-quests-bounty-reward', text: n.reward })
      ]
      : [
        el('div', { class: 'tsi-quests-title', text: n.title }),
        el('p', { class: 'tsi-quests-notice-text', text: n.text })
      ];
    var card = el('article', {
      class: 'tsi-quests-parchment' + (n.bounty ? ' tsi-quests-parchment--bounty' : ''),
      'data-test': 'notice',
      'data-id': String(n.id),
      'data-rot': rot
    }, [
      el('div', { class: 'tsi-quests-nail', 'aria-hidden': 'true' }),
      el('div', { class: 'tsi-quests-nail tsi-quests-nail--r', 'aria-hidden': 'true' })
    ].concat(head, [
      el('div', { class: 'tsi-quests-meta' }, n.tags.map(function (t) {
        return el('span', { class: 'tsi-quests-tag', text: t });
      })),
      actions ? el('div', { class: 'tsi-quests-actions' }, [
        el('button', { type: 'button', class: 'tsi-quests-paper-btn tsi-quests-paper-btn--accept', 'data-test': 'accept', onclick: function () { actions.accept(n.id); } }, 'Accept'),
        el('button', { type: 'button', class: 'tsi-quests-paper-btn', 'data-test': 'decline', onclick: function () { actions.decline(n.id); } }, 'Decline')
      ]) : null,
      el('div', { class: 'tsi-quests-sig', text: n.sig })
    ]));
    card.style.setProperty('--tsi-quests-rot', rot + 'deg');
    return card;
  }

  /* A board. options.empty: show the "No notices yet" card (the DM's board only). */
  quests.createBoard = function (options) {
    options = options || {};
    var B = window.TSI_DATA.questBoard || {};
    var parchments = el('div', { class: 'tsi-quests-parchments', 'data-test': 'parchments' });
    /* As in the old tool, this card sits underneath the board art, so it can't
       actually be seen (KNOWN_ISSUES QST-15, kept). */
    var empty = options.empty ? el('div', { class: 'tsi-quests-empty', 'data-test': 'empty' }, el('div', { class: 'tsi-quests-empty-card' }, [
      el('div', { class: 'tsi-quests-empty-title', text: B.emptyTitle }),
      el('div', { class: 'tsi-quests-empty-text' }, [B.emptyText[0], el('strong', { text: B.emptyText[1] }), B.emptyText[2]])
    ])) : null;
    /* The art stays still while the notices scroll over it if there are many. */
    var root = el('div', { class: 'tsi-quests-board', 'data-test': 'board' }, [empty, el('div', { class: 'tsi-quests-scroll' }, parchments)]);

    return {
      el: root,
      /* list: [{ notice, rot }]; actions: { accept(id), decline(id) } or null */
      draw: function (list, actions) {
        parchments.textContent = '';
        if (empty) empty.style.display = list.length ? 'none' : 'block';
        list.forEach(function (item) { parchments.appendChild(notice(item.notice, item.rot, actions)); });
      }
    };
  };
}());
