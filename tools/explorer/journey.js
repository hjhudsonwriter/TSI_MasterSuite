/* Scarlett Isles Explorer — the travel and campfire events (Harry's new
   events, 6 October 2026). Plain functions, no screen code, so they can be
   tested on tests/rules.html. The events themselves are in
   data/journey-events.js, which says how one is written.

   What's kept with the journey (state.journey, saved with the Explorer):
   - gold: the party's event gold, a running total until the DM clears it;
   - effects: boons and banes on a hero or the party, each with when it ends;
   - threads: story hooks, some with a reward when the DM resolves them and
     some bringing a follow-up event back on later days;
   - used: the events already drawn, so nothing repeats until a pool is used up;
   - lastTravelDay, rolledDay: the day of the last travel event, and the day
     the daily travel roll was last made;
   - tonight: an event set up for tonight's camp (T17's guard);
   - current: the event in progress, step by step, so a reload, a tool switch
     or a closed window picks it up where it was, and nothing applies twice;
   - log: a short history of what events changed.

   How often (Harry's draft): once a day on the road, a 30% chance of a travel
   event, never two days running; at Make Camp, a 25% chance of a campfire
   event, skipped after a travel or weather event that day. A follow-up that's
   due takes the next travel event; on the last day of its window it happens
   whatever the roll (at that night's camp if the party didn't travel far
   enough). If the party is on the wrong map by then, it's dropped and its
   thread stays for the DM. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ns = TSI.explorer = TSI.explorer || {};
  var J = {};

  var LOG_MAX = 100;
  var DAY_MILES = 30;
  J.KINDS = ['travel', 'camp', 'follow', 'dm', 'night'];

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
  function str(v) { return typeof v === 'string' ? v : ''; }
  function int(v, fallback) { return isNum(v) ? Math.round(v) : fallback; }
  function strList(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : []; }

  /* ---------- The journey record ---------- */
  J.empty = function () {
    return { gold: 0, effects: [], threads: [], used: { travel: [], camp: [] }, lastTravelDay: 0, rolledDay: 0, tonight: null, current: null, log: [], seq: 0 };
  };

  J.def = function (defs, id) {
    var list = (defs && defs.events) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  /* A problem that stops a save's journey being used, or null. Anything
     smaller is tidied by J.clean instead. */
  J.problem = function (j) {
    if (j === undefined || j === null) return null;
    if (!isObj(j)) return 'Its events record is damaged.';
    /* A damaged list inside it is tidied by J.clean, not a reason to lose the whole journey. */
    return null;
  };

  function cleanUntilKind(k) { return ['days', 'camp', 'night', 'used', 'dm'].indexOf(k) !== -1 ? k : 'dm'; }

  function cleanEffect(e) {
    if (!isObj(e) || !str(e.name) || !str(e.id)) return null;
    return {
      id: e.id, name: e.name, text: str(e.text), who: str(e.who) || null, whoName: str(e.whoName) || 'The party',
      from: str(e.from), day: int(e.day, 1), until: cleanUntilKind(e.until), untilDay: isNum(e.untilDay) ? Math.round(e.untilDay) : null
    };
  }

  function cleanThread(t) {
    if (!isObj(t) || !str(t.name) || !str(t.id)) return null;
    var out = { id: t.id, name: t.name, note: str(t.note), from: str(t.from), day: int(t.day, 1), resolve: null, follow: null, data: {} };
    if (isObj(t.resolve)) out.resolve = { gold: int(t.resolve.gold, 0), dm: str(t.resolve.dm) };
    if (isObj(t.follow) && str(t.follow.event)) {
      out.follow = {
        event: t.follow.event,
        scope: ['same-map', 'isles', 'any'].indexOf(t.follow.scope) !== -1 ? t.follow.scope : 'any',
        mapKey: str(t.follow.mapKey),
        from: int(t.follow.from, 1),
        to: int(t.follow.to, int(t.follow.from, 1))
      };
    }
    if (isObj(t.data)) Object.keys(t.data).forEach(function (k) { if (typeof t.data[k] === 'string') out.data[k] = t.data[k]; });
    return out;
  }

  function cleanCurrent(c, defs) {
    if (!isObj(c)) return null;
    var ev = J.def(defs, c.id);
    if (!ev || !str(c.step) || !ev.steps[c.step]) return null;
    /* Each kind of value in its own form, so a damaged one can't crash the window. */
    var vars = {};
    if (isObj(c.vars)) {
      Object.keys(c.vars).forEach(function (k) {
        var v = c.vars[k];
        if (k === 'failed' || k === 'succeeded') vars[k] = strList(v);
        else if (k === 'stake') { if (isNum(v)) vars[k] = v; }
        else if (k === 'adv') vars[k] = v === true;
        else if (typeof v === 'string') vars[k] = v;
      });
    }
    var out = {
      id: ev.id, kind: J.KINDS.indexOf(c.kind) !== -1 ? c.kind : ev.kind, step: c.step, vars: vars,
      changes: strList(c.changes), day: int(c.day, 1), phase: c.phase === 'camp' ? 'camp' : 'travel',
      ctx: isObj(c.ctx) ? { region: str(c.ctx.region), mapId: str(c.ctx.mapId) || null, mapKey: str(c.ctx.mapKey) } : { region: '', mapId: null, mapKey: '' },
      thread: str(c.thread) || null, prevLastTravelDay: int(c.prevLastTravelDay, 0),
      opened: isObj(c.opened) ? c.opened : {}, round: null, puzzle: null
    };
    if (isObj(c.round)) {
      out.round = { n: int(c.round.n, 1), hero: int(c.round.hero, 0), opp: int(c.round.opp, 0), d20: int(c.round.d20, 10), history: strList(c.round.history) };
    }
    if (isObj(c.puzzle)) {
      out.puzzle = { wrong: int(c.puzzle.wrong, 0), hint: ['success', 'failure'].indexOf(c.puzzle.hint) !== -1 ? c.puzzle.hint : null, reveal: c.puzzle.reveal === true };
    }
    var step = ev.steps[c.step];
    if (step.contest && !out.round) out.round = { n: 1, hero: 0, opp: 0, d20: 10, history: [] };
    if (step.puzzle && !out.puzzle) out.puzzle = { wrong: 0, hint: null, reveal: false };
    return out;
  }

  /* Tidy a saved journey: anything damaged is left out, never crashes. */
  J.clean = function (saved, defs) {
    var j = J.empty();
    if (!isObj(saved)) return j;
    j.gold = int(saved.gold, 0);
    j.effects = (Array.isArray(saved.effects) ? saved.effects : []).map(cleanEffect).filter(Boolean);
    j.threads = (Array.isArray(saved.threads) ? saved.threads : []).map(cleanThread).filter(Boolean);
    if (isObj(saved.used)) {
      j.used.travel = strList(saved.used.travel);
      j.used.camp = strList(saved.used.camp);
    }
    j.lastTravelDay = int(saved.lastTravelDay, 0);
    j.rolledDay = int(saved.rolledDay, 0);
    if (isObj(saved.tonight) && J.def(defs, saved.tonight.event)) j.tonight = { event: saved.tonight.event };
    j.current = cleanCurrent(saved.current, defs);
    j.log = strList(saved.log).slice(0, LOG_MAX);
    /* New ids carry on above every id in use, even if seq was lost. */
    var top = 0;
    j.effects.concat(j.threads).forEach(function (x) {
      var n = parseInt(String(x.id).slice(1), 10);
      if (Number.isFinite(n)) top = Math.max(top, n);
    });
    j.seq = Math.max(0, int(saved.seq, 0), top);
    return j;
  };

  function journey(state) {
    if (!isObj(state.journey)) state.journey = J.empty();
    return state.journey;
  }
  function nextId(j, prefix) {
    j.seq = (int(j.seq, 0)) + 1;
    return prefix + j.seq;
  }
  function day(state) { return Number(state.travel && state.travel.day) || 1; }

  /* ---------- Where the party is ---------- */
  /* The Region picks the god's lands and the province; a map-only event needs that map loaded. */
  J.context = function (state, defs) {
    var region = (state.travel && state.travel.provinceId) || 'northern_province';
    var info = (defs.regions && defs.regions[region]) || {};
    var mapKey = state.mapPresetId ? 'preset:' + state.mapPresetId : state.mapUploadKey ? 'upload:' + state.mapUploadKey : 'none';
    return { region: region, mapId: state.mapPresetId || null, mapKey: mapKey, god: info.god || null, isle: !!info.isle };
  };

  J.eligible = function (ev, ctx) {
    if (!ev || ev.off) return false;
    var w = ev.where || { any: true };
    if (w.any) return true;
    if (Array.isArray(w.maps)) return !!ctx.mapId && w.maps.indexOf(ctx.mapId) !== -1;
    if (Array.isArray(w.provinces)) return w.provinces.indexOf(ctx.region) !== -1;
    if (Array.isArray(w.gods)) return w.gods.indexOf(ctx.god) !== -1;
    return false;
  };

  J.pool = function (defs, kind, ctx) {
    return ((defs && defs.events) || []).filter(function (ev) { return ev.kind === kind && J.eligible(ev, ctx); });
  };

  /* Draw like a card: nothing repeats until this pool has been used up. */
  J.draw = function (state, defs, kind, ctx, rand) {
    var j = journey(state);
    var pool = J.pool(defs, kind, ctx);
    if (!pool.length) return null;
    var used = j.used[kind] || [];
    var fresh = pool.filter(function (ev) { return used.indexOf(ev.id) === -1; });
    if (!fresh.length) {
      /* The pool is used up: shuffle it back in. */
      j.used[kind] = used.filter(function (id) { return !pool.some(function (ev) { return ev.id === id; }); });
      fresh = pool;
    }
    return fresh[Math.min(fresh.length - 1, Math.floor(rand() * fresh.length))];
  };

  /* ---------- Follow-ups ---------- */
  function followFits(f, ctx) {
    if (f.scope === 'same-map') return !!f.mapKey && f.mapKey === ctx.mapKey;
    if (f.scope === 'isles') return !!ctx.isle;
    return true;
  }
  /* The thread whose follow-up is due today here, soonest-ending first, or null. */
  J.dueFollow = function (state, defs, ctx, d) {
    var due = journey(state).threads.filter(function (t) {
      return t.follow && t.follow.from <= d && d <= t.follow.to && followFits(t.follow, ctx) && J.def(defs, t.follow.event);
    });
    due.sort(function (a, b) { return a.follow.to - b.follow.to; });
    return due[0] || null;
  };

  /* ---------- When events happen ---------- */
  function item(kind, ev, thread) { return ev ? { kind: kind, event: ev, thread: thread || null } : null; }
  function followItem(defs, t) { return item('follow', J.def(defs, t.follow.event), t.id); }

  /* The day's travel roll, made once a day when the party has gone far
     enough (see rules.js finishMove). Returns an event to start, or null. */
  J.travelRoll = function (state, defs, ctx, rand) {
    var j = journey(state);
    var d = day(state);
    if (j.rolledDay === d) return null;
    j.rolledDay = d;
    /* The DM already rolled one today (Roll an event now). */
    if (j.lastTravelDay === d) return null;
    var due = J.dueFollow(state, defs, ctx, d);
    if (due && due.follow.to === d) return followItem(defs, due);
    if (j.lastTravelDay === d - 1 && d > 1) return null;
    var chance = isNum(defs.settings && defs.settings.travelChance) ? defs.settings.travelChance : 0.3;
    if (!(rand() < chance)) return null;
    if (due) return followItem(defs, due);
    return item('travel', J.draw(state, defs, 'travel', ctx, rand));
  };

  /* Before the day moves on at Make Camp: tonight's set-up event, or a
     follow-up on the last day of its window that hasn't happened yet. */
  J.campOverride = function (state, defs, ctx) {
    var j = journey(state);
    if (j.tonight) {
      var ev = J.def(defs, j.tonight.event);
      j.tonight = null;
      if (ev) {
        J.postponeFollow(state, defs, ctx);
        return item(ev.kind === 'night' ? 'night' : 'camp', ev);
      }
    }
    var d = day(state);
    var due = J.dueFollow(state, defs, ctx, d);
    if (due && due.follow.to === d) {
      var it = followItem(defs, due);
      /* Taken now, so the new day doesn't count it as missed. */
      due.follow = null;
      if (it) it.atCamp = true;
      return it;
    }
    return null;
  };

  /* When something else takes tonight's camp (tonight's set-up event, or a
     main event), a follow-up on the last day of its window waits one more
     day rather than being dropped. */
  J.postponeFollow = function (state, defs, ctx) {
    var d = day(state);
    journey(state).threads.forEach(function (t) {
      if (t.follow && t.follow.to === d && t.follow.from <= d && followFits(t.follow, ctx)) t.follow.to = d + 1;
    });
  };

  /* A new day (after Make Camp has moved the day on): effects that have run
     out go, and follow-ups whose window has passed are dropped (their thread stays). */
  J.newDay = function (state) {
    var j = journey(state);
    var d = day(state);
    var gone = [];
    j.effects = j.effects.filter(function (e) {
      var keep = e.untilDay === null || e.untilDay > d;
      if (!keep) gone.push(e);
      return keep;
    });
    j.threads.forEach(function (t) {
      if (t.follow && t.follow.to < d) {
        t.follow = null;
        t.note = (t.note ? t.note + ' ' : '') + '(Its follow-up didn\'t come: you\'d moved on.)';
      }
    });
    return gone;
  };

  /* The campfire roll, after the weather: a 25% chance, skipped after a
     travel event that day (dayBefore) or a weather event tonight. */
  J.campRoll = function (state, defs, ctx, rand, dayBefore, weatherTonight) {
    var j = journey(state);
    if (weatherTonight) return null;
    if (j.lastTravelDay === dayBefore) return null;
    var chance = isNum(defs.settings && defs.settings.campChance) ? defs.settings.campChance : 0.25;
    if (!(rand() < chance)) return null;
    return item('camp', J.draw(state, defs, 'camp', ctx, rand));
  };

  /* The DM's Roll an event now: a travel event (a due follow-up first) or a campfire event. */
  J.rollNow = function (state, defs, ctx, kind, rand) {
    if (kind === 'camp') return item('camp', J.draw(state, defs, 'camp', ctx, rand));
    var due = J.dueFollow(state, defs, ctx, day(state));
    if (due) return followItem(defs, due);
    return item('travel', J.draw(state, defs, 'travel', ctx, rand));
  };

  /* ---------- Running an event ---------- */
  J.begin = function (state, defs, it, ctx, rand) {
    var j = journey(state);
    var ev = it.event;
    var atCamp = it.kind === 'camp' || it.kind === 'night' || !!it.atCamp;
    var cur = {
      id: ev.id, kind: it.kind, step: null, vars: {}, changes: [], day: day(state),
      phase: atCamp ? 'camp' : 'travel',
      ctx: { region: ctx.region, mapId: ctx.mapId, mapKey: ctx.mapKey },
      thread: it.thread || null, prevLastTravelDay: j.lastTravelDay, opened: {}, round: null, puzzle: null
    };
    if (ev.secret) cur.vars[ev.secret.key] = rand() < ev.secret.chance ? ev.secret.yes : ev.secret.no;
    if (it.thread) {
      var t = threadById(j, it.thread);
      if (t) {
        Object.keys(t.data || {}).forEach(function (k) { cur.vars[k] = t.data[k]; });
        cur.followBackup = t.follow;
        t.follow = null;
      }
    }
    if ((it.kind === 'travel' || it.kind === 'follow') && !atCamp) j.lastTravelDay = day(state);
    if (it.kind === 'travel' || it.kind === 'camp') {
      var list = j.used[it.kind] || (j.used[it.kind] = []);
      if (list.indexOf(ev.id) === -1) list.push(ev.id);
    }
    j.current = cur;
    enter(state, defs, ev.steps.start ? 'start' : Object.keys(ev.steps)[0], rand);
    return cur;
  };

  function threadById(j, id) {
    for (var i = 0; i < j.threads.length; i++) if (j.threads[i].id === id) return j.threads[i];
    return null;
  }
  function heroName(state, id) {
    var list = state.tokens || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return null;
  }
  function names(state, ids) {
    return (ids || []).map(function (id) { return heroName(state, id) || id; });
  }
  function listText(items) {
    if (!items.length) return 'nobody';
    if (items.length === 1) return items[0];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  /* {clan}, {chief}, {temple}, {hero}, {failed}, {succeeded}, {stake}. */
  J.fill = function (text, state, defs, cur) {
    var region = (cur && cur.ctx && cur.ctx.region) || (state.travel && state.travel.provinceId) || '';
    var info = (defs.regions && defs.regions[region]) || {};
    var vars = (cur && cur.vars) || {};
    return String(text || '')
      .replace(/\{clan\}/g, info.clan || 'the local')
      .replace(/\{chief\}/g, info.chief || 'the clan chief')
      .replace(/\{temple\}/g, info.temple || 'the temple')
      .replace(/\{hero\}/g, vars.heroName || 'the hero')
      .replace(/\{failed\}/g, listText(names(state, vars.failed)))
      .replace(/\{succeeded\}/g, listText(names(state, vars.succeeded)))
      .replace(/\{stake\}/g, String(vars.stake || 0));
  };

  function record(state, cur, line) {
    cur.changes.push(line);
  }

  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }

  /* How long an effect lasts. Make Camp is a long rest; a campfire event
     happens after Make Camp has moved the day on. */
  function untilFor(o, cur, d) {
    if (isNum(o.days)) return { until: 'days', untilDay: d + Math.round(o.days) };
    if (o.camp) return { until: 'camp', untilDay: d + 1 };
    if (o.night) return { until: 'night', untilDay: d + (cur.phase === 'camp' ? 1 : 2) };
    if (o.used) return { until: 'used', untilDay: null };
    return { until: 'dm', untilDay: null };
  }

  J.untilText = function (e, today) {
    if (e.until === 'used') return 'until used';
    if (e.until === 'dm' || e.untilDay === null) return 'until you remove it';
    if (e.until === 'camp' || e.until === 'night') {
      return e.untilDay - today <= 1 ? 'until Make Camp' : 'until Make Camp on Day ' + (e.untilDay - 1);
    }
    return 'ends Day ' + e.untilDay;
  };

  function targets(state, cur, who) {
    var vars = cur.vars;
    if (who === 'hero') return vars.hero ? [vars.hero] : [null];
    if (who === 'failed') return strList(vars.failed);
    if (who === 'succeeded') return strList(vars.succeeded);
    return [null];
  }

  /* The miles a hero may walk today: 30, plus or minus what events changed. */
  J.dayLimit = function (state) {
    var adj = Number(state.travel && state.travel.milesAdjust) || 0;
    return Math.max(0, DAY_MILES + adj);
  };

  /* Apply one outcome. Returns nothing; the lines go on the event's list. */
  J.applyOutcome = function (state, defs, o) {
    var j = journey(state);
    var cur = j.current;
    var ev = J.def(defs, cur.id);
    var d = day(state);
    var fill = function (t) { return J.fill(t, state, defs, cur); };
    var when = cur.phase === 'camp' ? 'tomorrow' : 'today';

    if ('gold' in o) {
      var amount = isObj(o.gold) ? Math.round((Number(cur.vars.stake) || 0) * (Number(o.gold.stake) || 0)) : Math.round(Number(o.gold) || 0);
      if (amount) {
        j.gold = int(j.gold, 0) + amount;
        record(state, cur, signed(amount) + ' gold' + (o.why ? ' (' + o.why + ')' : '') + '. Party gold: ' + j.gold + '.');
      }
    }
    if ('miles' in o) {
      var m = Math.round(Number(o.miles) || 0);
      state.travel.milesAdjust = (Number(state.travel.milesAdjust) || 0) + m;
      record(state, cur, signed(m) + ' miles ' + when + '.');
    }
    if (o.loseDay) {
      var most = 0;
      (state.tokens || []).forEach(function (t) { most = Math.max(most, Number(t.milesUsed) || 0); });
      state.travel.milesAdjust = most - DAY_MILES;
      record(state, cur, 'The rest of today\'s miles are lost.');
    }
    if (o.effect || o.inspiration) {
      var spec = o.effect || { name: 'Inspiration', text: 'to spend at the table', who: o.inspiration === 'party' ? 'party' : 'hero', used: true };
      var until = untilFor(spec, cur, d);
      targets(state, cur, spec.who).forEach(function (heroId) {
        var who = heroId ? heroName(state, heroId) || heroId : 'The party';
        var e = {
          id: nextId(j, 'e'), name: fill(spec.name), text: fill(spec.text || ''), who: heroId, whoName: who,
          from: ev.code, day: d, until: until.until, untilDay: until.untilDay
        };
        j.effects.push(e);
        record(state, cur, who + ' gains ' + e.name + (e.text ? ': ' + e.text : '') + ' (' + J.untilText(e, d) + ').');
      });
    }
    if (o.thread) {
      var spec2 = o.thread;
      var name = fill(spec2.name);
      var note = fill(spec2.note || '');
      var resolve = spec2.resolve ? { gold: int(spec2.resolve.gold, 0), dm: fill(spec2.resolve.dm || '') } : null;
      var existing = cur.opened[name] ? threadById(j, cur.opened[name]) : null;
      if (existing) {
        /* The same thread twice in one event (C9): it's updated, not doubled. */
        existing.note = note;
        if (resolve) existing.resolve = resolve;
      } else {
        var t = { id: nextId(j, 't'), name: name, note: note, from: ev.code, day: d, resolve: resolve, follow: null, data: {} };
        if (spec2.follow) {
          t.follow = { event: spec2.follow.event, scope: spec2.follow.scope || 'any', mapKey: cur.ctx.mapKey, from: d + (spec2.follow.from || 1), to: d + (spec2.follow.to || spec2.follow.from || 1) };
        }
        (spec2.keep || []).forEach(function (k) { if (typeof cur.vars[k] === 'string') t.data[k] = cur.vars[k]; });
        j.threads.push(t);
        cur.opened[name] = t.id;
        record(state, cur, 'New thread: ' + name + '.');
      }
    }
    if (o.threadRename && cur.thread) {
      var tr = threadById(j, cur.thread);
      if (tr) {
        var old = tr.name;
        tr.name = fill(o.threadRename.name);
        tr.note = fill(o.threadRename.note || tr.note);
        record(state, cur, 'Thread ' + old + ' becomes ' + tr.name + '.');
      }
    }
    if (o.threadClose && cur.thread) {
      var tc = threadById(j, cur.thread);
      if (tc) {
        j.threads = j.threads.filter(function (x) { return x !== tc; });
        record(state, cur, 'Thread closed: ' + tc.name + '.');
      }
    }
    if (o.dm) record(state, cur, 'DM note: ' + fill(o.dm));
    if (o.note) {
      var text = isObj(o.note) ? (strList(cur.vars.failed).length ? o.note.any : o.note.none) : o.note;
      if (text) record(state, cur, fill(text));
    }
    if (o.tonight && J.def(defs, o.tonight)) {
      j.tonight = { event: o.tonight };
      record(state, cur, 'Tonight\'s camp: ' + J.def(defs, o.tonight).title + ' (instead of a campfire event).');
    }
  };

  /* Go to a step: its outcomes apply once, here and only here. */
  function enter(state, defs, stepId, rand) {
    var j = journey(state);
    var cur = j.current;
    var ev = J.def(defs, cur.id);
    var step = ev.steps[stepId];
    if (!step) throw new Error('Event ' + ev.code + ' has no step "' + stepId + '".');
    if (step.branch) {
      var target = step.branch[cur.vars[step.branch.key]] || step.branch[Object.keys(step.branch).filter(function (k) { return k !== 'key'; })[0]];
      return enter(state, defs, target, rand);
    }
    cur.step = stepId;
    cur.round = null;
    cur.puzzle = null;
    if (step.set) Object.keys(step.set).forEach(function (k) { cur.vars[k] = step.set[k]; });
    (step.apply || []).forEach(function (o) { J.applyOutcome(state, defs, o); });
    if (step.contest) cur.round = { n: 1, hero: 0, opp: 0, d20: J.d20(rand), history: [] };
    if (step.puzzle) cur.puzzle = { wrong: 0, hint: null, reveal: false };
    return cur;
  }
  J.d20 = function (rand) { return 1 + Math.min(19, Math.floor(rand() * 20)); };

  function heroIds(state) { return (state.tokens || []).map(function (t) { return t.id; }); }

  /* The DM's answer to the step on screen. action.step must be the step
     shown, so a late or double click can't act on the next one. Returns
     true if something changed. */
  J.act = function (state, defs, action, rand) {
    var j = journey(state);
    var cur = j.current;
    if (!cur || !action || action.step !== cur.step) return false;
    var ev = J.def(defs, cur.id);
    var step = ev.steps[cur.step];
    var go = function (id) { enter(state, defs, id, rand); return true; };

    if (action.type === 'choose' && step.choices) {
      var ch = step.choices[action.index];
      if (!ch) return false;
      if (ch.set) Object.keys(ch.set).forEach(function (k) { cur.vars[k] = ch.set[k]; });
      return go(ch.go);
    }
    if (action.type === 'next' && step.next) return go(step.next);
    if (action.type === 'check' && step.check && step.check.who !== 'each') {
      var c = step.check;
      if (c.who === 'one') setHero(state, cur, action.hero);
      var res = action.result;
      if (res === 'success') return go(c.success);
      if (res === 'failure') return go(c.failure);
      if (res === 'failBy5' && c.failBy5) return go(c.failBy5);
      return false;
    }
    if (action.type === 'each' && step.check && step.check.who === 'each') {
      var c2 = step.check;
      var among = c2.among === 'failed' ? strList(cur.vars.failed) : heroIds(state);
      var failed = strList(action.failed).filter(function (id) { return among.indexOf(id) !== -1; });
      cur.vars.failed = failed;
      cur.vars.succeeded = among.filter(function (id) { return failed.indexOf(id) === -1; });
      if (c2.next) return go(c2.next);
      return go(failed.length ? c2.anyFail : c2.noneFail);
    }
    if (action.type === 'fight' && step.fight) return go(action.result === 'won' ? step.fight.won : step.fight.fled);
    if (action.type === 'pick' && step.pick) {
      if (!setHero(state, cur, action.hero)) return false;
      return go(step.pick.go);
    }
    if (action.type === 'round' && step.contest && cur.round) {
      var k = step.contest;
      if (action.hero) setHero(state, cur, action.hero);
      var r = cur.round;
      var oppTotal = r.d20 + (k.bonus || 0);
      if (action.winner === 'hero') r.hero += 1; else if (action.winner === 'opp') r.opp += 1; else return false;
      r.history.push('Round ' + r.n + ': ' + (action.winner === 'hero' ? (cur.vars.heroName || 'the hero') : k.opponent.toLowerCase()) + ' (' + k.opponent + ' rolled ' + oppTotal + ')');
      var need = k.need || 2;
      if (r.hero >= need) return go(k.win);
      if (r.opp >= need) return go(k.lose);
      r.n += 1;
      r.d20 = J.d20(rand);
      return true;
    }
    if (action.type === 'hint' && step.puzzle && step.puzzle.hint && cur.puzzle && !cur.puzzle.hint) {
      if (action.result !== 'success' && action.result !== 'failure') return false;
      cur.puzzle.hint = action.result;
      return true;
    }
    if (action.type === 'reveal' && step.puzzle && step.puzzle.kind === 'riddle' && cur.puzzle) {
      cur.puzzle.reveal = !cur.puzzle.reveal;
      return true;
    }
    if (action.type === 'puzzle' && step.puzzle && cur.puzzle) {
      var p = step.puzzle;
      cur.vars.answer = p.answer || '';
      if (action.result === 'solved') return go(p.solved);
      if (p.kind === 'puzzle' && action.result === 'giveUp') return go(p.giveUp);
      if (p.kind === 'riddle' && action.result === 'wrong') {
        cur.puzzle.wrong += 1;
        if (cur.puzzle.wrong < (p.tries || 1)) { delete cur.vars.answer; return true; }
        return go(p.wrong);
      }
      delete cur.vars.answer;
      return false;
    }
    return false;
  };

  function setHero(state, cur, id) {
    var name = heroName(state, id);
    if (!name) return false;
    cur.vars.hero = id;
    cur.vars.heroName = name;
    return true;
  }

  /* Skip this event (for pacing): only before anything has happened. The
     card goes back into the pool and the day doesn't count as having had one. */
  J.canSkip = function (state) {
    var cur = journey(state).current;
    return !!cur && !cur.changes.length && (cur.kind === 'travel' || cur.kind === 'camp');
  };
  J.skip = function (state) {
    var j = journey(state);
    var cur = j.current;
    if (!J.canSkip(state)) return false;
    var list = j.used[cur.kind] || [];
    j.used[cur.kind] = list.filter(function (id) { return id !== cur.id; });
    if (cur.kind === 'travel') j.lastTravelDay = cur.prevLastTravelDay;
    j.current = null;
    return true;
  };

  /* The event is over (its last step, or the DM ended it early): it goes in the log. */
  J.finish = function (state, defs) {
    var j = journey(state);
    var cur = j.current;
    if (!cur) return null;
    var ev = J.def(defs, cur.id);
    var lines = cur.changes.slice();
    var entry = 'Day ' + cur.day + ' · ' + (ev ? ev.code + ' ' + ev.title : cur.id) + (lines.length ? ': ' + lines.join(' ') : ': nothing changed.');
    j.log.unshift(entry);
    if (j.log.length > LOG_MAX) j.log.length = LOG_MAX;
    j.current = null;
    return { lines: lines, entry: entry };
  };

  /* ---------- What the screen shows ---------- */
  var KIND_LABEL = { travel: 'Travel event', camp: 'Campfire event', follow: 'Follow-up', dm: 'DM event', night: 'At camp' };

  J.paceNote = function (check, cur, paceKey) {
    if (!check || !check.pace || !cur || cur.phase !== 'travel') return null;
    if (check.pace === 'stealth' && paceKey === 'slow') return 'Slow pace: advantage on Stealth checks.';
    if (check.pace === 'perception' && paceKey === 'fast') return 'Fast pace: −5 to Perception checks to spot danger.';
    return null;
  };

  function whoText(c) {
    if (c.whoText) return c.whoText;
    if (c.who === 'group') return 'Every hero rolls. The party succeeds if half or more succeed.';
    if (c.who === 'each') return 'Every hero rolls. Tick who failed.';
    if (c.who === 'same') return null;
    return c.help === false ? 'One hero rolls. No Help.' : 'One hero rolls. Another hero can Help for advantage.';
  }

  /* Everything the event window needs for the current step. paceKey is the
     party's pace today ('slow', 'normal', 'fast' or null). */
  J.view = function (state, defs, paceKey) {
    var j = journey(state);
    var cur = j.current;
    if (!cur) return null;
    var ev = J.def(defs, cur.id);
    var step = ev.steps[cur.step];
    var fill = function (t) { return J.fill(t, state, defs, cur); };
    var text = step.textIf ? step.textIf[cur.vars[step.textIf.key]] || '' : step.text || '';
    var extra = step.extra && step.extra[cur.ctx.region] ? ' ' + step.extra[cur.ctx.region] : '';
    var v = {
      id: ev.id, code: ev.code, title: ev.title, kind: cur.kind, kindLabel: KIND_LABEL[cur.kind] || 'Event',
      line: ev.line || '', dmNote: ev.dmNote || '', step: cur.step,
      text: fill(text + extra), verse: step.verse || null,
      changes: cur.changes.slice(), canSkip: J.canSkip(state),
      hero: cur.vars.hero || null, heroName: cur.vars.heroName || null,
      answer: cur.vars.answer || null,
      type: 'end'
    };
    if (step.check) {
      var c = step.check;
      v.type = c.who === 'each' ? 'each' : 'check';
      v.check = {
        label: c.skill + ', DC ' + c.dc, who: c.who, whoText: fill(whoText(c) || ''),
        pace: J.paceNote(c, cur, paceKey),
        adv: c.advIf && cur.vars[c.advIf] ? (c.advText || 'With advantage.') : null,
        failBy5: !!c.failBy5,
        among: c.who === 'each' ? (c.among === 'failed' ? strList(cur.vars.failed) : heroIds(state)) : null
      };
    } else if (step.choices) {
      v.type = 'choices';
      v.choices = step.choices.map(function (ch, i) { return { index: i, label: fill(ch.label) }; });
    } else if (step.fight) {
      v.type = 'fight';
      v.fight = { suggest: step.fight.suggest || '' };
    } else if (step.contest) {
      var k = step.contest;
      var r = cur.round || { n: 1, hero: 0, opp: 0, d20: 10, history: [] };
      v.type = 'contest';
      v.contest = {
        opponent: k.opponent, bonus: k.bonus || 0, heroRoll: k.heroRoll, need: k.need || 2,
        round: r.n, heroWins: r.hero, oppWins: r.opp, d20: r.d20, total: r.d20 + (k.bonus || 0), history: r.history.slice(),
        adv: k.advIf && cur.vars[k.advIf] ? 'The hero rolls with advantage.' : null
      };
    } else if (step.puzzle) {
      var p = step.puzzle;
      var pz = cur.puzzle || { wrong: 0, hint: null, reveal: false };
      v.type = 'puzzle';
      v.puzzle = {
        kind: p.kind, prompt: p.prompt || (p.kind === 'riddle' ? 'The players answer aloud.' : 'The players solve it aloud.'),
        tries: p.tries || 1, wrong: pz.wrong, wrongText: pz.wrong > 0 ? (p.wrongText || '') : '',
        hint: p.hint ? { label: p.hint.skill + ', DC ' + p.hint.dc, state: pz.hint, text: pz.hint === 'success' ? p.hint.text : null } : null,
        reveal: p.kind === 'riddle' ? pz.reveal : false,
        answer: p.kind === 'riddle' && pz.reveal ? p.answer : null
      };
    } else if (step.pick) {
      v.type = 'pick';
      v.pick = { prompt: fill(step.pick.prompt) };
    } else if (step.next) {
      v.type = 'next';
    }
    return v;
  };

  /* ---------- The DM's lists ---------- */
  J.removeEffect = function (state, id) {
    var j = journey(state);
    var before = j.effects.length;
    j.effects = j.effects.filter(function (e) { return e.id !== id; });
    return j.effects.length !== before;
  };

  /* What resolving a thread gives, as lines for the "are you sure?". */
  J.resolveLines = function (t) {
    var lines = [];
    if (t && t.resolve) {
      if (t.resolve.gold) lines.push(signed(t.resolve.gold) + ' gold');
      if (t.resolve.dm) lines.push('DM note: ' + t.resolve.dm);
    }
    if (t && t.follow) lines.push('Its follow-up won\'t happen.');
    return lines;
  };
  J.resolveThread = function (state, id) {
    var j = journey(state);
    var t = threadById(j, id);
    if (!t) return null;
    var lines = [];
    if (t.resolve && t.resolve.gold) {
      j.gold = int(j.gold, 0) + t.resolve.gold;
      lines.push(signed(t.resolve.gold) + ' gold. Party gold: ' + j.gold + '.');
    }
    if (t.resolve && t.resolve.dm) lines.push('DM note: ' + t.resolve.dm);
    j.threads = j.threads.filter(function (x) { return x !== t; });
    j.log.unshift('Day ' + day(state) + ' · Resolved ' + t.name + (lines.length ? ': ' + lines.join(' ') : '.'));
    if (j.log.length > LOG_MAX) j.log.length = LOG_MAX;
    return { thread: t, lines: lines };
  };
  J.threadDueText = function (t) {
    if (!t || !t.follow) return '';
    return t.follow.from === t.follow.to ? 'Follow-up due Day ' + t.follow.from : 'Follow-up due Days ' + t.follow.from + '–' + t.follow.to;
  };

  J.clearGold = function (state) {
    var j = journey(state);
    var was = j.gold;
    j.gold = 0;
    if (was) {
      j.log.unshift('Day ' + day(state) + ' · Party gold cleared (was ' + was + ').');
      if (j.log.length > LOG_MAX) j.log.length = LOG_MAX;
    }
    return was;
  };

  /* Reset Travel puts the day back to 1: every day-based record moves with it. */
  J.shiftDays = function (state, delta) {
    var j = journey(state);
    if (!delta) return;
    j.effects.forEach(function (e) { e.day += delta; if (e.untilDay !== null) e.untilDay += delta; });
    j.threads.forEach(function (t) {
      t.day += delta;
      if (t.follow) { t.follow.from += delta; t.follow.to += delta; }
    });
    if (j.lastTravelDay) j.lastTravelDay += delta;
    if (j.rolledDay) j.rolledDay += delta;
    if (j.current) {
      j.current.day += delta;
      if (j.current.prevLastTravelDay) j.current.prevLastTravelDay += delta;
    }
  };

  /* The DM-only events for the Main Campaign list. */
  J.dmEvents = function (defs) {
    return ((defs && defs.events) || []).filter(function (ev) { return ev.kind === 'dm' && !ev.off; });
  };

  ns.journey = J;
}());
