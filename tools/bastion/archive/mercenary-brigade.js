/* The Ironbow Bastion Manager — ARCHIVED: the Mercenary Brigade and the
   old single-roll war. Loaded by nothing.

   Archived in the Bastion overhaul, Build 3 (Harry, 8 October 2026; plan:
   docs/BASTION-OVERHAUL.md section 3; KNOWN_ISSUES BAS-66). The party is now
   Unsworn or a Clan, and only a Clan commits Lieutenants and regiments.
   Everything the Brigade was is kept here, as working code, so it can come
   back without being written again:

   1. The Brigade's rules: R.canFormMerc and its two numbers (party level 7,
      3 defenders), the "Brigade: name" label, the "Merc requirements" half
      of the requirements line, a Brigade committing Lieutenants and
      regiments (fullWar), and a saved Brigade loading as one.
   2. Trusted Clients after a battle (0 to 100 for each Clan): the target
      Clan −8 on a victory and −4 on a defeat or withdrawal, every other
      Clan +1 or −1; and the War Report's "Trusted Clients: …" line.
   3. The old single-roll war that the screen stopped using when the War
      Table came (war phase 2): R.warCommit, R.queueWarAction, R.warPlan
      and R.resolveWar (one d20 against the DC below), with R.removeBeasts,
      which only it used.
   4. The screen parts, as they were in tools/bastion/tool.js (a comment at
      the end of this file).

   The saves never lost the Brigade's numbers: every Bastion save still
   carries trustedClientsByClan (rules.js keeps it, unread). A Brigade in a
   save from Builds 1 and 2 loads as Unsworn, with a Day Log line naming it.

   HOW TO PUT IT BACK
   - Load this file after tools/bastion/war-campaign-rules.js: add
     'tools/bastion/archive/mercenary-brigade.js' after it in the Bastion's
     files in shared/data/tools.js (and in tests/rules.html to test it).
     That brings back everything in 1 and 3 on TSI.bastion.rules, the
     Trusted Clients amounts on R.warRewards, and stops a saved Brigade
     turning Unsworn.
   - For the Trusted Clients to change after a battle and show in the War
     Report (2), war-campaign-rules.js needs three lines again:
       applyRewards: out.trusted = R.brigadeApplyTrusted(s, data, ma, rw);
       previewRewards: copy trustedClientsByClan too
         (trustedClientsByClan: Object.assign({}, s.trustedClientsByClan));
       rewardLines: var tl = R.brigadeTrustedLine(data, ma, rw, got);
                    if (tl) lines.push(tl);
   - Put the screen parts (4) back into tool.js's Party Identity panel, and
     "Clan or Brigade only" / "Only a Clan or Mercenary Brigade can commit
     Lieutenants and Regiments." back into the War Council (showWar).
   - The tests are tests/archive/mercenary-brigade.test.js: add it to
     tests/rules.html after the Bastion's tests, with this file loaded.
     Take out the six live tests that check the Brigade is gone (its header
     names them).
   - In tools/bastion/tool.js, take out the start-up notice and Day Log line
     for a former Brigade (R.formerBrigade, which this file makes return
     null). R.clanOnlyCut in war-campaign-rules.js can stay: with a Brigade
     back, its fullWar is true, so it never applies to one. */
(function () {
  'use strict';

  var ns = window.TSI.bastion;
  var R = ns.rules;
  var clampInt = R.clampInt;
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v) { return typeof v === 'string' ? v : ''; }

  /* The numbers that were in bastion-data.js (identityRules.mercMinLevel,
     mercMinDefenders, and war.dc); the data file's own win if it has them
     again. */
  var MERC = { minLevel: 7, minDefenders: 3 };
  var DC = { raid: 14, skirmish: 13, defend: 12, seize_outpost: 15 };
  /* Trusted Clients after a war (target Clan, and every other Clan),
     unless the war data gains rewards.trusted in the same shape. */
  var TRUSTED = { success: { target: -8, others: 1 }, failure: { target: -4, others: -1 } };
  R.BRIGADE_TRUSTED = TRUSTED;

  /* ---------- 1. The Brigade ---------- */
  R.canFormMerc = function (s, data) {
    var rules = data.bastion.identityRules || {};
    var minLevel = typeof rules.mercMinLevel === 'number' ? rules.mercMinLevel : MERC.minLevel;
    var minDefenders = typeof rules.mercMinDefenders === 'number' ? rules.mercMinDefenders : MERC.minDefenders;
    var lvlOk = (s.partyLevel || 1) >= minLevel;
    var defOk = (s.defenders.count || 0) >= minDefenders;
    return { ok: lvlOk && defOk, lvlOk: lvlOk, defOk: defOk, minLevel: minLevel, minDefenders: minDefenders };
  };
  var orgLabel = R.orgLabel;
  R.orgLabel = function (s) {
    var o = s.organization;
    if (o.type === 'merc') return 'Brigade: ' + (o.name || 'Unnamed');
    return orgLabel(s);
  };
  var requirementsHint = R.requirementsHint;
  R.requirementsHint = function (s, data) {
    var m = R.canFormMerc(s, data);
    return requirementsHint(s, data) + '  ' +
      'Merc requirements: Level ' + m.minLevel + '+ (' + (m.lvlOk ? 'OK' : 'NO') + '), ' + m.minDefenders + '+ defenders (' + (m.defOk ? 'OK' : 'NO') + ').';
  };
  /* A saved Brigade loads as a Brigade (rules.js turns it Unsworn). */
  var fromSave = R.fromSave;
  R.fromSave = function (s, data) {
    var o = isObj(s) && isObj(s.organization) ? s.organization : null;
    var d = fromSave(s, data);
    if (o && o.type === 'merc') {
      d.organization = {
        type: 'merc', name: str(o.name), chief: str(o.chief), motto: str(o.motto),
        foundedAtDay: typeof o.foundedAtDay === 'number' && isFinite(o.foundedAtDay) ? Math.max(1, Math.floor(o.foundedAtDay)) : null
      };
    }
    return d;
  };
  R.formerBrigade = function () { return null; };
  /* A Brigade commits Lieutenants and regiments, as a Clan does. */
  var warForces = R.warForces;
  R.warForces = function (s) {
    var f = warForces.apply(this, arguments);
    if (isObj(s.organization) && s.organization.type === 'merc') f.fullWar = true;
    return f;
  };

  /* ---------- 2. Trusted Clients after a battle ---------- */
  var warRewards = R.warRewards;
  R.warRewards = function (s, data, ma, battle, outcome) {
    var rw = warRewards.apply(this, arguments);
    var w = (data && data.war) || (window.TSI_DATA && window.TSI_DATA.bastionWar) || {};
    var table = w.rewards && isObj(w.rewards.trusted) ? w.rewards.trusted : TRUSTED;
    var type = isObj(s.organization) ? s.organization.type : 'unsworn';
    rw.trusted = type === 'merc' && rw.result !== 'none' ? table[rw.result] : null;
    return rw;
  };
  /* Apply rw.trusted to s (each score 0 to 100). Returns what actually
     changed, { target, others: { clanKey: n } }, or null. */
  R.brigadeApplyTrusted = function (s, data, ma, rw) {
    if (!rw.trusted) return null;
    var out = { target: 0, others: {} };
    var shift = function (key, by) {
      var t0 = s.trustedClientsByClan[key] === undefined ? 50 : clampInt(s.trustedClientsByClan[key], 0, 100);
      s.trustedClientsByClan[key] = clampInt(t0 + by, 0, 100);
      return s.trustedClientsByClan[key] - t0;
    };
    out.target = shift(ma.targetKey, rw.trusted.target);
    data.bastion.clans.forEach(function (cl) { if (cl.key !== ma.targetKey) out.others[cl.key] = shift(cl.key, rw.trusted.others); });
    return out;
  };
  /* The War Report's line, or null: "Trusted Clients: Bacca −8, every
     other clan +1 except Karr (already at 100)." got.trusted: what
     R.brigadeApplyTrusted gave. */
  function signed(n) { return n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0'; }
  R.brigadeTrustedLine = function (data, ma, rw, got) {
    if (!rw.trusted || !got || !got.trusted) return null;
    var short = [];
    data.bastion.clans.forEach(function (cl) {
      var n = got.trusted.others[cl.key];
      if (n === undefined || n === rw.trusted.others) return;
      short.push(cl.name + (n === 0 ? ' (already at ' + (rw.trusted.others > 0 ? 100 : 0) + ')' : ' ' + signed(n) + ' (at the limit)'));
    });
    var target = signed(got.trusted.target) + (got.trusted.target !== rw.trusted.target ? ' (' + signed(rw.trusted.target) + ', but it can\'t go ' + (rw.trusted.target > 0 ? 'above 100' : 'below 0') + ')' : '');
    return 'Trusted Clients: ' + ma.targetName + ' ' + target + ', every other clan ' + signed(rw.trusted.others) +
      (short.length ? ' except ' + short.join(', ') : '') + '.';
  };

  /* ---------- 3. The old single-roll war ---------- */
  /* Lose n beasts one at a time, not whole rows. The beasts that march are
     the first `committed` in list order (as the War Table names them), so
     the losses come from those, the last-named first. With no `committed`,
     from the end of the list. */
  R.removeBeasts = function (s, n, committed) {
    var list = s.defenderBeasts;
    var total = R.beastQty(s);
    var upto = committed === undefined || committed === null ? total : Math.min(total, clampInt(committed, 0));
    var left = Math.min(clampInt(n, 0), upto);
    for (; left > 0; left--, upto--) {
      var idx = upto - 1, seen = 0;
      for (var i = 0; i < list.length; i++) {
        var row = list[i];
        var q = clampInt(row && row.qty !== undefined && row.qty !== null ? row.qty : 1, 0);
        if (idx < seen + q) {
          if (q - 1 <= 0) list.splice(i, 1);
          else row.qty = q - 1;
          break;
        }
        seen += q;
      }
    }
  };
  /* What can be committed (R.warAvailable is in war-campaign-rules.js). */
  R.warCommit = function (s, fields) {
    var a = R.warAvailable(s);
    return {
      commitDefenders: clampInt(fields.defenders === undefined ? 0 : fields.defenders, 0, a.defenders),
      commitBeasts: clampInt(fields.beasts === undefined ? 0 : fields.beasts, 0, a.beasts),
      commitLieutenants: a.fullWar ? clampInt(fields.lieutenants === undefined ? 0 : fields.lieutenants, 0, a.lieutenants) : 0,
      commitRegiments: a.fullWar ? clampInt(fields.regiments === undefined ? 0 : fields.regiments, 0, a.regiments) : 0
    };
  };
  /* Queue a war order that musters after the War Action's days (the screen
     uses R.queueWarAction2). */
  R.queueWarAction = function (s, meta, rand, data) {
    var days = R.time(data).musterDays;
    var order = { id: R.uid(rand), facId: 'war_council', fnId: 'war_action', optionIdx: 0, label: 'War Action', issuedDay: s.day, dueDay: s.day + days, meta: Object.assign({}, meta, { kind: 'war_action' }) };
    s.pendingOrders.push(order);
    return ['War Action Queued', meta.objective.toUpperCase() + ' vs ' + meta.targetName + ' (musters on Day ' + (s.day + days) + ').'];
  };
  R.warPlan = function (s, data, order) {
    var meta = order.meta || {};
    var objective = String(meta.objective || 'raid');
    var targetKey = String(meta.targetKey || 'blackstone');
    var target = null;
    data.bastion.clans.forEach(function (c) { if (c.key === targetKey) target = c; });
    var targetName = target ? target.name : 'Unknown';
    var dcs = data.bastion.war.dc || DC;
    var dc = dcs[objective] !== undefined ? dcs[objective] : 13;
    var defenders = clampInt(meta.commitDefenders || 0, 0);
    var beasts = clampInt(meta.commitBeasts || 0, 0);
    var lieutenants = clampInt(meta.commitLieutenants || 0, 0);
    var regiments = clampInt(meta.commitRegiments || 0, 0);
    var mod = Math.min(4, Math.floor(defenders / 2)) + Math.min(2, beasts) + Math.min(3, Math.floor((lieutenants + regiments) / 2));
    return {
      objective: objective, targetKey: targetKey, targetName: targetName, dc: dc, mod: mod,
      defenders: defenders, beasts: beasts, lieutenants: lieutenants, regiments: regiments,
      title: 'War Action: ' + objective.toUpperCase() + ' vs ' + targetName
    };
  };
  /* notes: extra lines for the war log (a Military Action's weather,
     morale and luck). */
  R.resolveWar = function (s, data, plan, roll, rand, now, notes) {
    var success = roll.total >= plan.dc;
    var o = data.bastion.war.outcomes[plan.objective] || { gp: [0, 0], pc: [0, 0] };
    var gpDelta = success ? o.gp[0] : o.gp[1];
    var pcDelta = success ? o.pc[0] : o.pc[1];
    var clanHonorDelta = 0;
    var isClan = s.organization.type === 'clan';
    var isMerc = s.organization.type === 'merc';
    s.treasuryGP = clampInt((s.treasuryGP || 0) + gpDelta, 0);
    R.addPoliticalCapital(s, plan.targetName, pcDelta);
    var defLoss = Math.min(plan.defenders, Math.max(1, Math.floor(plan.defenders / 3)));
    if (!success) {
      s.defenders.count = Math.max(0, (s.defenders.count || 0) - defLoss);
      /* One beast is lost, not a whole row of them (BAS-25). */
      var beastLoss = Math.min(plan.beasts, plan.beasts > 0 ? 1 : 0);
      if (beastLoss > 0) R.removeBeasts(s, beastLoss, plan.beasts);
    }
    if (isClan) {
      clanHonorDelta = success ? 6 : -8;
      s.clanHonor = clampInt((s.clanHonor === undefined || s.clanHonor === null ? 40 : s.clanHonor) + clanHonorDelta, 0, 100);
    }
    if (isMerc) {
      var tcDelta = success ? -8 : -4;
      s.trustedClientsByClan[plan.targetKey] = clampInt((s.trustedClientsByClan[plan.targetKey] === undefined ? 50 : s.trustedClientsByClan[plan.targetKey]) + tcDelta, 0, 100);
      data.bastion.clans.forEach(function (c) {
        if (c.key === plan.targetKey) return;
        s.trustedClientsByClan[c.key] = clampInt((s.trustedClientsByClan[c.key] === undefined ? 50 : s.trustedClientsByClan[c.key]) + (success ? 1 : -1), 0, 100);
      });
    }
    var title = (success ? 'Success' : 'Failure') + ': ' + plan.objective.toUpperCase() + ' vs ' + plan.targetName;
    var details = 'Roll: d20 ' + roll.d20 + ' + mod ' + plan.mod + ' = ' + roll.total + ' vs DC ' + plan.dc + '\n' +
      'Treasury: ' + (gpDelta >= 0 ? '+' : '') + gpDelta + ' gp\n' +
      'Political Capital (' + plan.targetName + '): ' + (pcDelta >= 0 ? '+' : '') + pcDelta + '\n' +
      (isClan ? 'Clan Honour: ' + (clanHonorDelta >= 0 ? '+' : '') + clanHonorDelta + '\n' : '') +
      (!success ? 'Casualties: defenders ' + defLoss + '; beasts ' + (plan.beasts > 0 ? 1 : 0) + '\n' : '') +
      (notes && notes.length ? notes.join('\n') + '\n' : '');
    s.warLog.unshift({
      id: R.uid(rand), at: now === undefined ? Date.now() : now, title: title,
      subtitle: 'Committed: ' + plan.defenders + ' defenders, ' + plan.beasts + ' beasts, ' + plan.lieutenants + ' lieutenants, ' + plan.regiments + ' regiments',
      details: details
    });
    return ['War Action Resolved', title];
  };
}());

/* ---------- 4. The screen parts, as they were in tools/bastion/tool.js ----------
   In the Party Identity panel (idCard), beside Form Clan:

      var formMercBtn = btn('Form Mercenary Brigade', function () { onFormMerc(); }, '', 'form-merc');
      ...
      el('div', { class: 'tsi-bas-actions' }, [formClanBtn, formMercBtn]),
      ...
      el('div', { class: 'tsi-bas-split' }, [honourBox, trustBox])

   The Trusted Clients box (bastion.css keeps .tsi-bas-clan-grid--trust):

      var trustRows = {};
      var trustGrid = el('div', { class: 'tsi-bas-clan-grid tsi-bas-clan-grid--trust' }, B.clans.map(function (c) {
        var input = numberInput('trust-' + c.key, { min: '0', max: '100', 'aria-label': c.name + ' Trusted (0 to 100)' });
        var shown = el('div', { class: 'tsi-bas-clan-row__support' });
        life.on(input, 'change', function () {
          state.trustedClientsByClan[c.key] = R.clampInt(input.value, 0, 100);
          input.value = String(state.trustedClientsByClan[c.key]);
          done();
        });
        trustRows[c.key] = { input: input, shown: shown };
        return el('div', { class: 'tsi-bas-clan-row' }, [
          el('div', { class: 'tsi-bas-clan-row__name', text: c.name }),
          muted('Client Trust', 'tsi-bas-clan-row__pc'),
          field('Trusted (0..100)', input, 'tsi-bas-clan-row__field'),
          shown
        ]);
      }));
      var trustBox = el('div', { class: 'tsi-bas-box', hidden: true, 'data-test': 'trust-box' }, [
        label('Trusted Clients (0–100)'),
        muted('Only applies if you’ve formed a Mercenary Brigade.'),
        trustGrid
      ]);

   In renderIdentity:

        orgDesc.textContent = o.type === 'clan' ? 'You are a political entity. Clan Honour unlocks future war and territory systems.'
          : o.type === 'merc' ? 'You are contract-driven. Trusted Clients affects future contract access and payment tiers.'
          : 'Unsworn. You may found a Clan (support-based) or form a Mercenary Brigade (defenders + level).';
        formMercBtn.disabled = !(o.type === 'unsworn' && R.canFormMerc(state, data).ok);
        trustBox.hidden = o.type !== 'merc';
        B.clans.forEach(function (c) {
          var tc = R.clampInt(state.trustedClientsByClan[c.key] === undefined ? 50 : state.trustedClientsByClan[c.key], 0, 100);
          setValue(trustRows[c.key].input, tc);
          TSI.clear(trustRows[c.key].shown);
          TSI.append(trustRows[c.key].shown, [el('b', { text: String(tc) }), '/100']);
        });

   Form Mercenary Brigade (its crest box is now Form Clan's crestField(),
   which keeps the Bastion's crest unless another is chosen):

      var onFormMerc = TSI.oneAtATime(async function () {
        if (state.organization.type !== 'unsworn') return;
        if (!R.canFormMerc(state, data).ok) { await say('Not eligible to form a Mercenary Brigade yet. See the requirements hint in the panel.'); return; }
        var name = el('input', { type: 'text', class: 'tsi-input', placeholder: 'e.g. The Ironbow Freeblades', 'data-test': 'merc-name' });
        var crestPick = crestField();
        var ok = await hallModal({
          title: 'Form Mercenary Brigade',
          className: 'tsi-bas-modal tsi-bas-modal--hall tsi-bas-modal--found',
          body: [field('Brigade Name', name), crestPick.node, muted('This is persistent.')],
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Confirm Formation', value: true, primary: true }]
        });
        if (!ok || !life.alive) return;
        var n = name.value.trim();
        if (!n) { await say('Brigade Name is required.'); return; }
        state.organization = { type: 'merc', name: n, chief: '', motto: '', foundedAtDay: state.day };
        log('Identity', 'Formed Mercenary Brigade: ' + n + '.');
        if (crestPick.chosen()) saveCrest(crestPick.chosen());
        done();
      });
*/
