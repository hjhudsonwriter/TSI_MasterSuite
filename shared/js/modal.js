/* The Scarlett Isles: D&D Tool Suite — pop-ups.
   One kind of pop-up for the whole suite. It takes keyboard focus, keeps Tab
   inside itself, and Esc chooses the safe answer. Clicking outside does
   nothing, so a stray click can't cancel or confirm anything.

   TSI.modal.open({ title, message | body, details, actions: [{ label, value, primary }], escValue })
     → Promise of the chosen action's value
   TSI.modal.confirm({ title, message, okLabel, cancelLabel, body }) → Promise<boolean>
   TSI.modal.alert({ title, message, details }) → Promise */
(function () {
  'use strict';

  var TSI = window.TSI;
  var stack = [];
  var titleCount = 0;

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (el) { return !el.disabled && !el.hidden && el.offsetParent !== null; }
    );
  }

  /* Plain text becomes paragraphs: a blank line starts a new one. */
  function paragraphs(text) {
    return String(text).split(/\n\s*\n/).map(function (p) { return TSI.el('p', { text: p }); });
  }

  function open(options) {
    options = options || {};
    var actions = options.actions && options.actions.length ? options.actions : [{ label: 'OK', value: true, primary: true }];
    var escValue = 'escValue' in options ? options.escValue : actions[0].value;
    var returnFocus = document.activeElement;
    var titleId = 'tsi-modal-title-' + (++titleCount);

    return new Promise(function (resolve) {
      var body = TSI.el('div', { class: 'tsi-modal__body' });
      if (options.message) TSI.append(body, paragraphs(options.message));
      if (options.body) TSI.append(body, options.body);
      if (options.details) body.appendChild(TSI.el('pre', { class: 'tsi-modal__details', text: options.details }));

      var foot = TSI.el('div', { class: 'tsi-modal__foot' });
      var dialog = TSI.el('div', {
        class: 'tsi-modal' + (options.wide ? ' tsi-modal--wide' : ''),
        role: options.role || 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId
      }, [
        TSI.el('div', { class: 'tsi-modal__head' }, TSI.el('h2', { class: 'tsi-modal__title', id: titleId, text: options.title || 'Please confirm' })),
        body,
        foot
      ]);
      var scrim = TSI.el('div', { class: 'tsi-modal-scrim' }, dialog);
      var entry = { scrim: scrim, close: close };
      var primaryButton = null;

      actions.forEach(function (action) {
        var button = TSI.el('button', {
          type: 'button',
          class: 'tsi-btn' + (action.primary ? ' tsi-btn--primary' : ''),
          'data-value': String(action.value),
          onclick: function () { close(action.value); }
        }, action.label);
        if (action.primary) primaryButton = button;
        foot.appendChild(button);
      });

      function onKey(event) {
        if (stack[stack.length - 1] !== entry) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close(escValue);
          return;
        }
        if (event.key === 'Tab') {
          var items = focusables(dialog);
          if (!items.length) { event.preventDefault(); return; }
          var first = items[0];
          var last = items[items.length - 1];
          if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
            event.preventDefault();
            first.focus();
          }
        }
      }

      var closed = false;
      function close(value) {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKey, true);
        scrim.remove();
        var i = stack.indexOf(entry);
        if (i !== -1) stack.splice(i, 1);
        if (!stack.length) document.body.classList.remove('tsi-modal-open');
        if (returnFocus && returnFocus.focus && returnFocus.isConnected) {
          try { returnFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        }
        resolve(value);
      }

      document.addEventListener('keydown', onKey, true);
      stack.push(entry);
      document.body.appendChild(scrim);
      document.body.classList.add('tsi-modal-open');

      /* Focus the first field if there is one, otherwise the safe (first) button. */
      var field = body.querySelector('input, select, textarea');
      var target = field || foot.querySelector('button') || primaryButton;
      if (target) target.focus();
    });
  }

  TSI.modal = {
    open: open,

    isOpen: function () { return stack.length > 0; },

    /* Close every open pop-up (used when a tool shuts down). */
    closeAll: function () {
      stack.slice().reverse().forEach(function (entry) { entry.close(undefined); });
    },

    confirm: function (options) {
      return open({
        title: options.title,
        message: options.message,
        body: options.body,
        details: options.details,
        escValue: false,
        actions: [
          { label: options.cancelLabel || 'Cancel', value: false },
          { label: options.okLabel || 'OK', value: true, primary: true }
        ]
      });
    },

    alert: function (options) {
      return open({
        title: options.title,
        message: options.message,
        body: options.body,
        details: options.details,
        role: 'alertdialog',
        actions: [{ label: options.okLabel || 'OK', value: true, primary: true }]
      });
    }
  };
}());
