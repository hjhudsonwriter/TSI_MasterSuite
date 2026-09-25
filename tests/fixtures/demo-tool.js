/* Test only: a pretend tool for checking the shell in tests/harness.html.
   It saves a counter and a note, runs timers and a sound, has a keyboard
   shortcut (K), opens a player window, and can throw an error on purpose.
   window.TSI_DEMO gives the click-through tests a look inside. */
(function () {
  'use strict';

  var TSI = window.TSI;

  /* A tenth of a second of silence, made here rather than loaded from a file. */
  function silentWav() {
    var rate = 8000;
    var samples = 800;
    var bytes = new Uint8Array(44 + samples);
    var view = new DataView(bytes.buffer);
    function text(at, s) { for (var i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); }
    text(0, 'RIFF'); view.setUint32(4, 36 + samples, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
    text(36, 'data'); view.setUint32(40, samples, true);
    for (var j = 0; j < samples; j++) bytes[44 + j] = 128;
    var binary = '';
    for (var k = 0; k < bytes.length; k++) binary += String.fromCharCode(bytes[k]);
    return 'data:audio/wav;base64,' + btoa(binary);
  }

  function isValid(state) {
    return !!state && typeof state === 'object' && typeof state.count === 'number' && typeof state.note === 'string';
  }

  TSI.registerTool('demo', {
    start: function (ctx) {
      var life = ctx.life;
      var el = TSI.el;
      var state = ctx.store.get('state', null);
      if (state !== null && !isValid(state)) {
        ctx.store.quarantine('state', 'The count wasn\'t a number.');
        state = null;
      }
      if (!state) state = { count: 0, note: '' };

      var live = { keys: 0, ticks: 0, replies: 0, linkStatus: 'closed', sound: null };

      function save() { ctx.store.set('state', state); }

      var countEl = el('span', { class: 'tsi-demo__value', 'data-test': 'count', text: String(state.count) });
      var keysEl = el('span', { class: 'tsi-demo__value', 'data-test': 'keys', text: '0' });
      var ticksEl = el('span', { class: 'tsi-demo__value', 'data-test': 'ticks', text: '0' });
      var repliesEl = el('span', { class: 'tsi-demo__value', 'data-test': 'replies', text: '0' });
      var linkEl = el('span', { 'data-test': 'link-status', text: 'closed' });

      var link = ctx.playerLink({
        view: 'check',
        getState: function () { return { text: 'Count is ' + state.count }; },
        onMessage: function (type, payload) {
          if (type === 'reply') {
            live.replies++;
            repliesEl.textContent = String(live.replies);
          }
        },
        onStatus: function (s) {
          live.linkStatus = s;
          linkEl.textContent = s;
        }
      });

      var add = TSI.oneAtATime(function () {
        state.count++;
        countEl.textContent = String(state.count);
        save();
        link.sync();
      }, { minMs: 0 });

      var note = el('input', {
        class: 'tsi-input',
        'data-test': 'note',
        value: state.note,
        'aria-label': 'Note',
        placeholder: 'Type here (K shouldn\'t count)'
      });
      life.on(note, 'input', function () {
        state.note = note.value;
        save();
      });

      life.onKey(function (event) {
        if (event.key === 'k' || event.key === 'K') {
          live.keys++;
          keysEl.textContent = String(live.keys);
        }
      });

      var leave = el('input', { type: 'checkbox', 'data-test': 'leave-check' });
      life.on(leave, 'change', function () {
        ctx.setLeaveCheck(leave.checked ? function () { return 'This will end the demo in progress.'; } : null);
      });

      function startTimers() {
        life.setInterval(function () {
          live.ticks++;
          ticksEl.textContent = String(live.ticks);
        }, 50);
        live.sound = life.audio(silentWav(), { loop: true, volume: 0 });
        var p = live.sound.play();
        if (p && p.catch) p.catch(function () { /* autoplay refused in some test browsers */ });
      }

      function clearData() {
        return TSI.modal.confirm({
          title: 'Clear the demo tool\'s data?',
          message: 'This removes only the Demo tool\'s saved counter and note.',
          okLabel: 'Clear'
        }).then(function (ok) {
          if (!ok) return;
          ctx.store.names().forEach(function (n) { ctx.store.remove(n); });
          state = { count: 0, note: '' };
          countEl.textContent = '0';
          note.value = '';
        });
      }

      function panel(title, body) {
        return el('section', { class: 'tsi-panel' }, [
          el('div', { class: 'tsi-panel__head' }, el('h2', { class: 'tsi-panel__title', text: title })),
          el('div', { class: 'tsi-panel__body' }, body)
        ]);
      }

      function button(label, test, onClick, primary) {
        return el('button', { type: 'button', class: 'tsi-btn' + (primary ? ' tsi-btn--primary' : ''), 'data-test': test, onclick: onClick }, label);
      }

      TSI.append(ctx.root, el('div', { class: 'tsi-demo' }, [
        panel('Saving', [
          el('p', { class: 'tsi-demo__row' }, ['Count: ', countEl, button('Add one', 'add', add, true)]),
          el('p', { class: 'tsi-demo__row' }, [note]),
          el('p', { class: 'tsi-demo__row' }, [button('Clear the demo tool\'s data', 'clear', clearData)])
        ]),
        panel('Shutting down', [
          el('p', { class: 'tsi-demo__row' }, ['K pressed: ', keysEl, ' · Timer ticks: ', ticksEl, button('Start timer and sound', 'start-timers', startTimers)]),
          el('label', { class: 'tsi-check' }, [leave, el('span', { text: 'Ask before leaving' })]),
          el('p', { class: 'tsi-demo__row' }, [button('Cause an error', 'throw', function () {
            life.setTimeout(function () { throw new Error('Demo error, on purpose.'); }, 0);
          })])
        ]),
        panel('Player window', [
          el('p', { class: 'tsi-demo__row' }, [button('Open player window', 'open-player', function () { link.open(); }), ' Status: ', linkEl, ' · Replies: ', repliesEl])
        ])
      ]));

      window.TSI_DEMO = {
        ctx: ctx,
        live: live,
        state: function () { return state; },
        link: link
      };
    },

    stop: function (ctx) {
      window.TSI_DEMO_STOPPED = (window.TSI_DEMO_STOPPED || 0) + 1;
      return new Promise(function (resolve) { setTimeout(resolve, 50); });
    },

    validateImport: function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].key === 'tsi.demo.state' && !isValid(records[i].value)) return 'This file\'s demo count isn\'t a number, so it wasn\'t imported. Nothing was changed.';
      }
      return null;
    }
  });
}());
