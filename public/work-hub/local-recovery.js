(() => {
  'use strict';
  function boot() {
    if (typeof S === 'undefined' || typeof save !== 'function' || typeof render !== 'function' || typeof K === 'undefined') {
      window.setTimeout(boot, 100);
      return;
    }
    if (window.WorkHubLocalRecovery) return;
    const accountId = String(ACCOUNT_UID);
    const pinnedKey = 'workhub_offline_current_' + ACCOUNT_SUFFIX;
    const pinnedPartnerKey = 'workhub_offline_partner_' + ACCOUNT_SUFFIX;
    const store = window.localStorage;
    const copy = value => JSON.parse(JSON.stringify(value));
    const valid = value => value && typeof value === 'object' && Array.isArray(value.workItems) && value.workItems.every(item => item && typeof item.id === 'string' && typeof item.title === 'string');
    const safeRead = key => { try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; } };
    const backupCurrent = reason => {
      const entries = {};
      [K, PARTNER, UI, pinnedKey, pinnedPartnerKey].forEach(key => {
        const raw = store.getItem(key);
        if (raw !== null) entries[key] = raw;
      });
      const backupKey = 'workhub_preserved_' + ACCOUNT_SUFFIX + '_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const text = JSON.stringify({ reason, accountId, savedAt: new Date().toISOString(), entries });
      store.setItem(backupKey, text);
      if (store.getItem(backupKey) !== text) throw new Error('Backup could not be verified.');
      return backupKey;
    };

    // Explicitly imported or subsequently saved local state is authoritative.
    const pinned = safeRead(pinnedKey);
    if (valid(pinned)) {
      S = typeof normalizeState === 'function' ? normalizeState(copy(pinned)) : copy(pinned);
      store.setItem(K, JSON.stringify(S));
      const savedPartner = safeRead(pinnedPartnerKey);
      if (savedPartner && typeof savedPartner === 'object') {
        partner = copy(savedPartner);
        store.setItem(PARTNER, JSON.stringify(partner));
      }
      render();
    }

    const previousSave = save;
    save = function(message) {
      previousSave(message);
      store.setItem(pinnedKey, JSON.stringify(S));
    };
    if (typeof savePartner === 'function') {
      const previousSavePartner = savePartner;
      savePartner = function() {
        previousSavePartner();
        store.setItem(pinnedPartnerKey, JSON.stringify(partner));
      };
    }

    window.WorkHubLocalRecovery = {
      accountId,
      exportData() {
        return { format: 'workhub-local-backup-v2', ownerId: accountId, savedAt: new Date().toISOString(), state: { version: 1, work: copy(S), partner: typeof partner === 'undefined' ? {} : copy(partner) } };
      },
      importData(input) {
        const payload = input && (input.state || input);
        const work = payload && (payload.work || payload);
        const owner = input && input.ownerId;
        if (owner && owner !== accountId) throw new Error('Backup belongs to a different local workspace.');
        if (!valid(work)) throw new Error('Invalid Work Hub backup.');
        const recovered = typeof normalizeState === 'function' ? normalizeState(copy(work)) : copy(work);
        const backupKey = backupCurrent('before-explicit-import');
        const old = { work: copy(S), partner: typeof partner === 'undefined' ? {} : copy(partner) };
        try {
          store.setItem(pinnedKey, JSON.stringify(recovered));
          store.setItem(K, JSON.stringify(recovered));
          S = recovered;
          if (payload.partner && typeof payload.partner === 'object') {
            partner = copy(payload.partner);
            store.setItem(pinnedPartnerKey, JSON.stringify(partner));
            store.setItem(PARTNER, JSON.stringify(partner));
          }
          render();
          return { tasks: S.workItems.length, preservedCopy: backupKey };
        } catch (error) {
          S = old.work;
          partner = old.partner;
          try {
            store.setItem(pinnedKey, JSON.stringify(old.work));
            store.setItem(K, JSON.stringify(old.work));
            store.setItem(PARTNER, JSON.stringify(old.partner));
            store.setItem(pinnedPartnerKey, JSON.stringify(old.partner));
          } catch {}
          render();
          throw error;
        }
      },
      summary() { return { accountId, tasks: S.workItems.length, notes: Array.isArray(S.settings?.workNotes) ? S.settings.workNotes.length : 0 }; }
    };
  }
  boot();
})();
