/* The Scarlett Isles: D&D Tool Suite — core helpers.
   Loaded first on every page. Everything the suite adds to the page lives
   under window.TSI, so no tool's names can clash with another's.
   Plain script (no modules), so it runs from a double-clicked file. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  window.TSI_DATA = window.TSI_DATA || {};

  TSI.SUITE_NAME = 'The Scarlett Isles: D&D Tool Suite';

  /* Where the suite's top folder is, relative to this page. index.html and
     player.html sit in the top folder; test pages in tests/ set
     <html data-tsi-root="../">. */
  TSI.root = document.documentElement.getAttribute('data-tsi-root') || '';
  TSI.path = function (p) { return TSI.root + p; };

  /* Which saved data this page uses. The real suite is "suite". The test page
     (tests/harness.html, <html data-tsi-space="test">) is "test": it has its own
     database, storage names and backups, so test data never mixes with real
     saves. See TSI.storeRules.spaceNames. */
  TSI.space = document.documentElement.getAttribute('data-tsi-space') === 'test' ? 'test' : 'suite';

  /* ---------- Tools register themselves here ---------- */
  TSI.tools = TSI.tools || {};
  TSI.registerTool = function (id, def) {
    if (!def || typeof def.start !== 'function') {
      throw new Error('Tool "' + id + '" must have a start() function.');
    }
    def.id = id;
    TSI.tools[id] = def;
    return def;
  };

  TSI.toolInfo = function (id) {
    var list = window.TSI_DATA.tools || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  /* ---------- Building page elements ----------
     TSI.el('button', { class: 'tsi-btn', type: 'button', onclick: fn }, 'Label')
     Text is always set as text, never as HTML, so content can't break the page. */
  TSI.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (name) {
        var value = attrs[name];
        if (value === null || value === undefined || value === false) return;
        if (name === 'class') node.className = value;
        else if (name === 'text') node.textContent = value;
        else if (name === 'dataset') Object.keys(value).forEach(function (k) { node.dataset[k] = value[k]; });
        else if (name.slice(0, 2) === 'on' && typeof value === 'function') node.addEventListener(name.slice(2), value);
        else if (value === true) node.setAttribute(name, '');
        else node.setAttribute(name, String(value));
      });
    }
    TSI.append(node, children);
    return node;
  };

  TSI.append = function (parent, children) {
    if (children === null || children === undefined || children === false) return parent;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      if (Array.isArray(child)) TSI.append(parent, child);
      else if (child instanceof Node) parent.appendChild(child);
      else parent.appendChild(document.createTextNode(String(child)));
    });
    return parent;
  };

  TSI.clear = function (node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  };

  /* ---------- Tool names in sentences ----------
     TSI.the('Notice Board Quest Generator') → 'the Notice Board Quest Generator'
     TSI.the('The Heartwood Ritual')         → 'The Heartwood Ritual'
     TSI.the(name, true) starts a sentence:   'The Notice Board Quest Generator' */
  TSI.the = function (name, startOfSentence) {
    name = String(name || '');
    if (/^the\s/i.test(name)) return name;
    return (startOfSentence ? 'The ' : 'the ') + name;
  };

  /* ---------- Loading a tool's files (plain script and style tags) ---------- */
  TSI.loadScript = function (src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(src); };
      s.onerror = function () { reject(new Error('The file ' + src + ' couldn\'t be loaded. Is it missing from the suite folder?')); };
      document.head.appendChild(s);
    });
  };

  TSI.loadStyle = function (href) {
    return new Promise(function (resolve, reject) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = function () { resolve(href); };
      l.onerror = function () { reject(new Error('The file ' + href + ' couldn\'t be loaded. Is it missing from the suite folder?')); };
      document.head.appendChild(l);
    });
  };

  /* Load styles (all at once) and scripts (one after another, in order). */
  TSI.loadFiles = function (files) {
    files = files || {};
    var styles = Promise.all((files.css || []).map(function (href) { return TSI.loadStyle(TSI.path(href)); }));
    return styles.then(function () {
      return (files.js || []).reduce(function (chain, src) {
        return chain.then(function () { return TSI.loadScript(TSI.path(src)); });
      }, Promise.resolve());
    });
  };

  /* ---------- Dates, in UK style ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  TSI.dates = {
    /* 2026-09-25-1403, for file names */
    stamp: function (d) {
      d = d || new Date();
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
    },
    /* Thursday 25 September 2026 at 14:03 */
    human: function (value) {
      var d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return 'an unknown date';
      var day = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return day + ' at ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
  };

  /* ---------- Files: downloads and uploads ---------- */
  TSI.download = function (filename, text, mime) {
    var blob = text instanceof Blob ? text : new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = TSI.el('a', { href: url, download: filename, hidden: true });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    return filename;
  };

  /* Ask for one file. Resolves with the File, or null if nothing was chosen. */
  TSI.pickFile = function (accept) {
    return new Promise(function (resolve) {
      var input = TSI.el('input', { type: 'file', accept: accept || '', hidden: true });
      var done = false;
      function finish(file) {
        if (done) return;
        done = true;
        input.remove();
        resolve(file || null);
      }
      input.addEventListener('change', function () { finish(input.files && input.files[0]); });
      input.addEventListener('cancel', function () { finish(null); });
      document.body.appendChild(input);
      input.click();
    });
  };

  TSI.readFileText = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(reader.error || new Error('The file could not be read.')); };
      reader.readAsText(file);
    });
  };

  /* A copy of saved data, so changing it can't change the saved version by accident. */
  TSI.clone = function (value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };

  /* ---------- Keyboard ---------- */
  TSI.keys = {
    /* True when the key press is going into a text box, so shortcuts should ignore it. */
    isTyping: function (event) {
      var t = event && event.target;
      if (!t || t.nodeType !== 1) return false;
      if (t.isContentEditable) return true;
      var tag = t.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (tag !== 'INPUT') return false;
      var type = (t.getAttribute('type') || 'text').toLowerCase();
      return ['button', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'reset', 'submit'].indexOf(type) === -1;
    }
  };

  /* ---------- Once at a time (double-click protection) ----------
     var roll = TSI.oneAtATime(async function () { ... });
     Calls made while the last one is still running (or within minMs of it
     starting) are ignored and return false. Stops a double click, or Enter
     held down, from doing something twice. */
  TSI.oneAtATime = function (fn, options) {
    var minMs = options && typeof options.minMs === 'number' ? options.minMs : 350;
    var busy = false;
    var startedAt = -Infinity;
    return function () {
      var now = Date.now();
      if (busy || now - startedAt < minMs) return false;
      busy = true;
      startedAt = now;
      var result;
      try {
        result = fn.apply(this, arguments);
      } catch (err) {
        busy = false;
        throw err;
      }
      if (result && typeof result.then === 'function') {
        return result.then(function (v) { busy = false; return v; }, function (e) { busy = false; throw e; });
      }
      busy = false;
      return result;
    };
  };

  /* ---------- Notices (plain-English bars under the top bar) ----------
     TSI.notify('Backup downloaded.', { type: 'ok', timeout: 5000 })
     type: 'info' | 'ok' | 'warn' | 'error'. A notice with the same id replaces the last one.
     actions: [{ label, onClick, primary }]. Returns { close }. */
  var noticeHost = null;
  var noticesById = {};
  function host() {
    if (noticeHost && noticeHost.isConnected) return noticeHost;
    noticeHost = TSI.el('div', { class: 'tsi-notices', role: 'region', 'aria-label': 'Notices' });
    document.body.appendChild(noticeHost);
    return noticeHost;
  }

  TSI.notify = function (message, options) {
    options = options || {};
    var type = options.type || 'info';
    if (options.id && noticesById[options.id]) noticesById[options.id].close();

    var text = TSI.el('div', { class: 'tsi-notice__text' });
    if (options.title) TSI.append(text, [TSI.el('strong', { text: options.title }), ' ']);
    TSI.append(text, message);

    var actions = TSI.el('div', { class: 'tsi-notice__actions' });
    var node = TSI.el('div', {
      class: 'tsi-notice tsi-notice--' + type,
      role: type === 'error' || type === 'warn' ? 'alert' : 'status'
    }, [text, actions]);

    var timer = null;
    var handle = {
      node: node,
      close: function () {
        if (timer) clearTimeout(timer);
        timer = null;
        node.remove();
        if (options.id && noticesById[options.id] === handle) delete noticesById[options.id];
      }
    };

    (options.actions || []).forEach(function (action) {
      actions.appendChild(TSI.el('button', {
        type: 'button',
        class: 'tsi-btn tsi-btn--small' + (action.primary ? ' tsi-btn--primary' : ''),
        onclick: function () {
          if (action.keepOpen !== true) handle.close();
          if (action.onClick) action.onClick();
        }
      }, action.label));
    });
    if (options.dismiss !== false) {
      actions.appendChild(TSI.el('button', {
        type: 'button',
        class: 'tsi-btn tsi-btn--small tsi-btn--ghost',
        'aria-label': 'Dismiss this notice',
        onclick: handle.close
      }, 'Dismiss'));
    }

    host().appendChild(node);
    if (options.timeout) timer = setTimeout(handle.close, options.timeout);
    if (options.id) noticesById[options.id] = handle;
    return handle;
  };

  /* ---------- Errors ----------
     Double-clicked pages hide the details of errors in script files
     ("Script error."), so the suite catches errors itself wherever it can
     (tool start and stop, and every timer and listener made through the
     lifecycle helper) and shows a plain-English bar. */
  var lastErrorText = '';
  var lastErrorAt = 0;

  TSI.errorText = function (err) {
    if (!err) return 'No details.';
    if (typeof err === 'string') return err;
    var text = (err.name ? err.name + ': ' : '') + (err.message || String(err));
    if (err.stack && err.stack.indexOf(err.message) !== -1) text = err.stack;
    else if (err.stack) text += '\n' + err.stack;
    return text;
  };

  TSI.reportError = function (err, where) {
    var details = TSI.errorText(err);
    if (window.console && console.error) console.error('[TSI]' + (where ? ' ' + where + ':' : ''), err);
    var now = Date.now();
    if (details === lastErrorText && now - lastErrorAt < 3000) return; /* the same error repeating */
    lastErrorText = details;
    lastErrorAt = now;
    var place = where ? ' (in ' + where + ')' : '';
    TSI.notify('Something went wrong' + place + '. Things may not work properly until you reload.', {
      type: 'error',
      id: 'tsi-error',
      title: 'Error.',
      actions: [
        {
          label: 'Details',
          keepOpen: true,
          onClick: function () {
            if (TSI.modal) TSI.modal.alert({ title: 'Error details', message: 'This is the technical message, in case it helps with a bug report.', details: details });
            else window.alert(details);
          }
        },
        { label: 'Reload', onClick: function () { location.reload(); } }
      ]
    });
  };

  /* Wrap a function so any error it throws is shown in the error bar. */
  TSI.guard = function (fn, where) {
    return function () {
      try {
        var result = fn.apply(this, arguments);
        if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
          result.catch(function (err) { TSI.reportError(err, where); });
        }
        return result;
      } catch (err) {
        TSI.reportError(err, where);
      }
    };
  };

  window.addEventListener('error', function (event) {
    /* A missing picture or sound fires 'error' on its own element; only page errors are reported here. */
    if (event.target && event.target !== window) return;
    var msg = event.message || '';
    if (/ResizeObserver loop/.test(msg)) return; /* harmless browser warning */
    TSI.reportError(event.error || msg || 'Unknown error', null);
  });

  window.addEventListener('unhandledrejection', function (event) {
    TSI.reportError(event.reason || 'A task failed without a message.', null);
  });
}());
