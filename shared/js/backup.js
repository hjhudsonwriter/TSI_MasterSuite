/* The Scarlett Isles: D&D Tool Suite — backups.
   "Back up everything" and "Restore" on the home screen, and each saving
   tool's Export and Import. Restoring or importing always shows what's in the
   file and asks first, and offers to download a copy of the current data
   before anything is replaced.
   The Explorer and the Bastion save as one campaign (Harry, 8 October
   2026): Export in either downloads one campaign file holding both, and
   Import in either replaces both from it, after checking both halves. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var rules = TSI.backupRules;

  function nameOf(toolId) {
    var info = TSI.toolInfo(toolId);
    return info ? info.name : null;
  }

  /* A tool's own check of an imported file's records (its rules'
     importProblem), for the campaign, whose other tool isn't open here:
     each campaign tool's rules register theirs in TSI.importChecks. */
  function importCheck(toolId) {
    var own = TSI.importChecks && TSI.importChecks[toolId];
    if (typeof own === 'function') return own;
    var def = TSI.tools[toolId];
    return def && typeof def.validateImport === 'function' ? def.validateImport : null;
  }
  function checkRecords(toolId, records) {
    var check = importCheck(toolId);
    if (!check) return null;
    try { return check(TSI.clone(records)); } catch (e) { return 'This file couldn\'t be checked: ' + e.message; }
  }

  function downloadBackup(backup, kind, toolId) {
    var name = rules.fileName(kind, toolId, new Date(backup.savedAt), TSI.space);
    TSI.download(name, JSON.stringify(backup, null, 2), 'application/json');
    return name;
  }

  function summaryBody(backup, intro, warning, checkboxLabel) {
    var summary = rules.summarise(backup, nameOf);
    var parts = [TSI.el('p', { text: intro })];
    if (summary.total) {
      parts.push(TSI.el('ul', null, summary.lines.map(function (line) { return TSI.el('li', { text: line }); })));
    } else {
      parts.push(TSI.el('p', null, TSI.el('em', { text: 'Nothing saved: the file is empty.' })));
    }
    if (backup.skippedTest) {
      parts.push(TSI.el('p', { text: 'It also holds ' + backup.skippedTest + ' item' + (backup.skippedTest === 1 ? '' : 's') + ' of test data from the test page, which will be left out.' }));
    }
    parts.push(TSI.el('p', { text: warning }));
    var box = null;
    if (checkboxLabel) {
      box = TSI.el('input', { type: 'checkbox', checked: true, name: 'tsi-backup-first' });
      parts.push(TSI.el('label', { class: 'tsi-check' }, [box, TSI.el('span', { text: checkboxLabel })]));
    }
    return { nodes: TSI.el('div', null, parts), box: box };
  }

  /* Read a chosen file and check it's a backup. Resolves with the backup, or null
     (after telling the user why) if nothing usable was chosen. */
  function chooseBackup(title) {
    return TSI.pickFile('.json,application/json').then(function (file) {
      if (!file) return null;
      return TSI.readFileText(file).then(function (text) {
        var result = rules.parse(text);
        if (!result.ok) {
          return TSI.modal.alert({ title: title, message: result.reason + '\n\nNothing was changed.' }).then(function () { return null; });
        }
        /* The real suite and the test page never load each other's backups. */
        var wrongPlace = rules.checkSpace(result.backup, TSI.space);
        if (wrongPlace) {
          return TSI.modal.alert({ title: title, message: wrongPlace }).then(function () { return null; });
        }
        var cleaned = rules.withoutTestData(result.backup, TSI.space);
        var backup = cleaned.backup;
        backup.skippedTest = cleaned.skipped;
        backup.fileName = file.name;
        return backup;
      }, function () {
        return TSI.modal.alert({ title: title, message: 'That file couldn\'t be read. Nothing was changed.' }).then(function () { return null; });
      });
    });
  }

  function flash(text, type) {
    try { sessionStorage.setItem(TSI.storeRules.spaceNames(TSI.space).flash, JSON.stringify({ text: text, type: type || 'ok' })); } catch (e) { /* no flash message */ }
  }

  function reload() {
    if (TSI.shell && TSI.shell.reload) TSI.shell.reload();
    else location.reload();
  }

  TSI.backup = {
    /* Download every saved item in the suite as one dated file. */
    backupEverything: function (options) {
      return TSI.store.flush().then(function () {
        var backup = rules.makeSuiteBackup(TSI.store.records(), new Date(), TSI.space);
        var name = downloadBackup(backup, 'suite');
        if (!options || !options.quiet) {
          TSI.notify('Saved to your Downloads folder as ' + name + '.', { type: 'ok', title: 'Backup downloaded.', timeout: 8000, id: 'tsi-backup' });
        }
        return name;
      });
    },

    restore: function () {
      var title = 'Restore from a backup';
      return chooseBackup(title).then(function (backup) {
        if (!backup) return false;
        var refusal = rules.checkForSuite(backup, nameOf);
        if (refusal) return TSI.modal.alert({ title: title, message: refusal + '\n\nNothing was changed.' }).then(function () { return false; });

        var hasCurrent = TSI.store.keys().length > 0;
        var body = summaryBody(
          backup,
          'This backup (' + backup.fileName + ') was saved on ' + TSI.dates.human(backup.savedAt) + '. It holds:',
          hasCurrent
            ? 'Restoring replaces everything the suite has saved in this browser with what\'s in the backup.'
            : 'Nothing is saved in the suite yet, so nothing will be lost.',
          hasCurrent ? 'First, download a backup of what\'s saved now' : null
        );
        return TSI.modal.open({
          title: title,
          body: body.nodes,
          escValue: false,
          actions: [
            { label: 'Cancel', value: false },
            { label: 'Restore', value: true, primary: true }
          ]
        }).then(function (go) {
          if (!go) return false;
          var first = body.box && body.box.checked ? TSI.backup.backupEverything({ quiet: true }) : Promise.resolve();
          return first.then(function () {
            return TSI.store.replace(backup.records, { all: true });
          }).then(function (ok) {
            if (!ok) {
              return TSI.modal.alert({ title: title, message: 'The browser refused to save the restored data. ' + TSI.store.status().reason + '\n\nWhat you had before may be partly replaced. If you downloaded a backup first, you can restore that.' }).then(function () { return false; });
            }
            flash('Restored the backup saved on ' + TSI.dates.human(backup.savedAt) + '.');
            reload();
            return true;
          });
        });
      });
    },

    /* Download one tool's saved data. For the Explorer or the Bastion, the
       campaign file: both, each as last saved (the other may be open in
       another window). */
    exportTool: function (toolId, options) {
      return TSI.store.flush().then(function () {
        if (!rules.inCampaign(toolId)) return rules.makeToolBackup(toolId, nameOf(toolId), TSI.store.records(toolId), new Date(), TSI.space);
        return Promise.all(rules.CAMPAIGN.map(function (t) {
          return t === toolId ? TSI.store.records(t) : TSI.store.freshRecords(t);
        })).then(function (lists) {
          return rules.makeCampaignBackup([].concat.apply([], lists), new Date(), TSI.space);
        });
      }).then(function (backup) {
        var name = downloadBackup(backup, backup.kind, toolId);
        if (!options || !options.quiet) {
          TSI.notify('Saved to your Downloads folder as ' + name + '.', { type: 'ok', title: 'Exported.', timeout: 8000, id: 'tsi-backup' });
        }
        return name;
      });
    },

    importTool: function (toolId) {
      var toolName = nameOf(toolId) || toolId;
      var title = 'Import into ' + TSI.the(toolName);
      return chooseBackup(title).then(function (backup) {
        if (!backup) return false;
        var refusal = rules.checkForTool(backup, toolId, nameOf);
        var campaign = !refusal && backup.kind === 'campaign';
        /* The tools this file replaces: both campaign tools for a campaign
           file, otherwise just this one (an Explorer file from before the
           campaign save leaves the Bastion as it is). */
        var scopeTools = campaign ? rules.CAMPAIGN.slice() : [toolId];
        if (campaign) {
          /* The other tool open in another window would save over what's imported. */
          var open = rules.CAMPAIGN.filter(function (t) { return t !== toolId && TSI.tabGuard && TSI.tabGuard.isOpenElsewhere(t); })[0];
          if (open) refusal = TSI.the(nameOf(open) || open, true) + ' is open in another window. Close it first: a campaign file replaces the Explorer and the Bastion together. Nothing was changed.';
        }
        for (var i = 0; !refusal && i < scopeTools.length; i++) {
          var t = scopeTools[i];
          refusal = checkRecords(t, backup.records.filter(function (r) { return TSI.storeRules.toolOf(r.key) === t; }));
        }
        if (refusal) return TSI.modal.alert({ title: title, message: refusal }).then(function () { return false; });

        var hasCurrent = scopeTools.some(function (t) { return TSI.store.keys(t).length > 0; });
        var others = rules.inCampaign(toolId) && !campaign ? rules.CAMPAIGN.filter(function (t) { return t !== toolId; }).map(function (t) { return TSI.the(nameOf(t) || t); }).join(' and ') : '';
        var body = summaryBody(
          backup,
          'This file (' + backup.fileName + ') was exported on ' + TSI.dates.human(backup.savedAt) + '. It holds:',
          campaign
            ? (hasCurrent ? 'Importing replaces what the Explorer and the Bastion have saved now, together (anything the file doesn\'t hold is cleared). The rest of the suite isn\'t touched.' : 'Neither the Explorer nor the Bastion has anything saved yet, so nothing will be lost.')
            : hasCurrent
              ? 'Importing replaces what ' + TSI.the(toolName) + ' has saved now. ' + (others ? others.charAt(0).toUpperCase() + others.slice(1) + ' is left as it is.' : 'The rest of the suite isn\'t touched.')
              : TSI.the(toolName, true) + ' has nothing saved yet, so nothing will be lost.',
          hasCurrent ? (campaign || others ? 'First, download a copy of the campaign as it is now' : 'First, download a copy of ' + TSI.the(toolName) + '\'s current data') : null
        );
        return TSI.modal.open({
          title: title,
          body: body.nodes,
          escValue: false,
          actions: [
            { label: 'Cancel', value: false },
            { label: 'Import', value: true, primary: true }
          ]
        }).then(function (go) {
          if (!go) return false;
          var stop = TSI.shell && TSI.shell.stopTool ? TSI.shell.stopTool() : Promise.resolve();
          /* Stop the tool first (it saves as it closes), then take the copy, then replace. */
          return stop.then(function () {
            return body.box && body.box.checked ? TSI.backup.exportTool(toolId, { quiet: true }) : null;
          }).then(function () {
            return TSI.store.replace(backup.records, campaign ? { tools: scopeTools } : { tool: toolId });
          }).then(function (ok) {
            if (!ok) {
              flash('The import couldn\'t be saved. ' + TSI.store.status().reason, 'error');
            } else {
              flash('Imported the file exported on ' + TSI.dates.human(backup.savedAt) + '.');
            }
            reload();
            return ok;
          });
        });
      });
    },

    /* For tests and the shell: turn a suite or tool backup into its summary. */
    describe: function (backup) { return rules.summarise(backup, nameOf); }
  };
}());
