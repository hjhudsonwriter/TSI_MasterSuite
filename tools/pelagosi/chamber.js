/* Pelagosi Puzzle Trials: the Tidal chamber, drawn once.
   The DM's board and the players' window both build the chamber's picture with build() and update it with paint(),
   so the two cannot drift apart. The DM's copy is made with interactive: true (buttons the DM clicks); the players'
   copy is read-only (plain boxes, no names under the runes, nothing focusable).
   Nothing here knows the answer: paint() is given only what is on the board (see rules.js, chamberView). */
(function () {
  'use strict';

  var TSI = window.TSI;
  var pel = TSI.pelagosi = TSI.pelagosi || {};

  /* o: { el, imageSrc, imageAlt, runeSrc(rune), layout: { order, pillars: {id:{x,y,label?}}, chalk: [{id,style,x,y}] },
          interactive, testPrefix, extras: [nodes put just before the event banner], eventText: true to add the sentence } */
  function build(o) {
    var el = o.el || TSI.el;
    var live = !!o.interactive;
    var pre = o.testPrefix || '';
    var tag = live ? 'button' : 'div';
    function attrs(a) { if (live) a.type = 'button'; return a; }

    var image = el('img', { class: 'tsi-pel-tidal-image', src: o.imageSrc, alt: live ? (o.imageAlt || '') : '' });

    var basinBtn = el(tag, attrs(live
      ? { class: 'tsi-pel-basin-btn', 'aria-label': 'Change central basin rune', 'data-test': pre + 'basin', disabled: true }
      : { class: 'tsi-pel-basin-btn', 'aria-hidden': 'true', 'data-test': pre + 'basin' }), [
      el('img', { src: o.runeSrc('anchor'), alt: '' }),
      live ? el('span', { text: 'Anchor' }) : null
    ].filter(Boolean));
    var basinSelector = el('div', live
      ? { class: 'tsi-pel-basin tsi-pel-hidden', 'aria-label': 'Central basin rune selector' }
      : { class: 'tsi-pel-basin tsi-pel-hidden', 'aria-hidden': 'true' },
    [live ? el('p', { text: 'Central Basin' }) : null, basinBtn].filter(Boolean));

    var pillars = {};
    o.layout.order.forEach(function (id) {
      var at = o.layout.pillars[id];
      var rune = el(tag, attrs(live
        ? { class: 'tsi-pel-pillar-rune', 'data-pillar': id, 'data-test': pre + 'pillar-rune-' + id, 'aria-label': 'Change ' + (at.label || id) + ' pillar rune' }
        : { class: 'tsi-pel-pillar-rune', 'data-pillar': id, 'aria-hidden': 'true' }), [
        el('img', { alt: '' }),
        live ? el('span') : null
      ].filter(Boolean));
      var arrow = el(tag, attrs(live
        ? { class: 'tsi-pel-pillar-arrow', 'data-pillar': id, 'data-test': pre + 'pillar-arrow-' + id, 'aria-label': 'Rotate ' + (at.label || id) + ' pillar direction' }
        : { class: 'tsi-pel-pillar-arrow', 'data-pillar': id, 'aria-hidden': 'true' }));
      var box = el('div', { class: 'tsi-pel-pillar', 'data-pillar': id, style: '--tsi-pel-x: ' + at.x + '%; --tsi-pel-y: ' + at.y + '%;' }, [rune, arrow]);
      pillars[id] = { box: box, rune: rune, arrow: arrow };
    });

    var chalkMarks = (o.layout.chalk || []).map(function (m) {
      return el('span', { class: 'tsi-pel-chalk tsi-pel-chalk--' + m.style, 'aria-hidden': 'true', 'data-test': pre + 'chalk-' + m.id, style: 'left:' + m.x + '%;top:' + m.y + '%' });
    });
    var chalkLayer = el('div', { class: 'tsi-pel-chalk-layer', 'aria-hidden': 'true' }, chalkMarks);

    var eventTitle = el('p', { text: 'THE WATER ANSWERS' });
    var eventText = o.eventText ? el('span', { text: 'The basin listens.' }) : null;
    var eventOverlay = el('div', live
      ? { class: 'tsi-pel-event tsi-pel-hidden', 'aria-live': 'polite', 'data-test': pre + 'event' }
      : { class: 'tsi-pel-event tsi-pel-hidden', 'aria-hidden': 'true', 'data-test': pre + 'event' },
    [el('div', { class: 'tsi-pel-wave' }), eventTitle, eventText].filter(Boolean));

    var children = [
      image,
      el('div', { class: 'tsi-pel-caustics', 'aria-hidden': 'true' }),
      el('div', { class: 'tsi-pel-basin-aura', 'aria-hidden': 'true' }),
      el('div', { class: 'tsi-pel-water-pressure', 'aria-hidden': 'true' }),
      el('div', { class: 'tsi-pel-flow tsi-pel-flow--top', 'aria-hidden': 'true' }),
      el('div', { class: 'tsi-pel-flow tsi-pel-flow--right', 'aria-hidden': 'true' }),
      el('div', { class: 'tsi-pel-flow tsi-pel-flow--bottom', 'aria-hidden': 'true' }),
      el('div', { class: 'tsi-pel-flow tsi-pel-flow--left', 'aria-hidden': 'true' }),
      basinSelector
    ];
    o.layout.order.forEach(function (id) { children.push(pillars[id].box); });
    children.push(chalkLayer);
    (o.extras || []).forEach(function (n) { children.push(n); });
    children.push(eventOverlay);

    var frame = el('div', live
      ? { class: 'tsi-pel-frame tsi-pel-tidal-frame', 'aria-label': 'Tidal Sequence puzzle board', 'data-test': pre + 'tidal-frame' }
      : { class: 'tsi-pel-frame tsi-pel-tidal-frame', 'aria-hidden': 'true', 'data-test': pre + 'tidal-frame' },
    children);

    return {
      frame: frame, live: live, runeSrc: o.runeSrc,
      pillars: pillars,
      basin: { selector: basinSelector, btn: basinBtn },
      chalk: { layer: chalkLayer, marks: chalkMarks },
      event: { overlay: eventOverlay, title: eventTitle, text: eventText }
    };
  }

  /* Show the chamber as `view` (rules.js, chamberView) says. */
  function paint(ch, view) {
    Object.keys(ch.pillars).forEach(function (id) {
      var p = view.pillars[id];
      var part = ch.pillars[id];
      var img = part.rune.querySelector('img');
      var src = ch.runeSrc(p.rune);
      if (img.getAttribute('src') !== src) img.src = src;
      img.alt = ch.live ? p.rune + ' rune' : '';
      var label = part.rune.querySelector('span');
      if (label) label.textContent = p.label;
      part.rune.dataset.rune = p.rune;
      part.arrow.textContent = p.symbol;
      part.arrow.dataset.direction = p.direction;
      part.box.classList.toggle('tsi-pel-rune-ok', p.runeOk);
      part.box.classList.toggle('tsi-pel-dir-ok', p.dirOk);
      part.box.classList.toggle('tsi-pel-complete', p.complete);
    });
    var b = view.basin;
    var bimg = ch.basin.btn.querySelector('img');
    var bsrc = ch.runeSrc(b.rune);
    if (bimg.getAttribute('src') !== bsrc) bimg.src = bsrc;
    bimg.alt = ch.live ? b.rune + ' rune' : '';
    var blabel = ch.basin.btn.querySelector('span');
    if (blabel) blabel.textContent = b.label;
    ch.basin.btn.dataset.rune = b.rune;
    ch.basin.btn.classList.toggle('tsi-pel-basin-ok', b.ok);
    ch.basin.btn.classList.toggle('tsi-pel-basin-wrong', b.wrong);
    ch.basin.selector.classList.toggle('tsi-pel-hidden', !b.visible);
    ch.basin.selector.classList.toggle('tsi-pel-basin-solved', b.solved);
  }

  pel.chamber = { build: build, paint: paint };
}());
