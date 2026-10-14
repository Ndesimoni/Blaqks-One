import { useCallback, useMemo, useRef, useState } from 'react';
import { readFinanceAccess } from './financeAccess.js';
import { financeRefusal, runFinanceAction } from './financeRules.js';

const busyResult = { ok: false, message: '', errors: {}, conflict: false, gone: false, status: 0 };

/**
 * Gated finance mutations (finance-design §4, §6, §7). Each action refuses locally with the
 * server's message when `financeAccess` or the row's `allowed` denies it, sends integer fils
 * and basis points only, refreshes the overview on success and resolves to `{ ok, ... }` so
 * editors and dialogs keep their draft on any refusal, 403, 404 or 409. `finance` is the
 * `useFinance` result; deal and entry arguments are parsed views (`{ id, version, allowed }`).
 */
export function useFinanceActions({ api, workspaceId, user, finance, readOnly = false }) {
  const access = useMemo(() => readFinanceAccess(user), [user]);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const refresh = finance?.refresh;
  const run = useCallback(
    async (operation, row, call, options) => {
      if (running.current) return busyResult;
      running.current = true;
      setBusy(true);
      try {
        return await runFinanceAction({ access, readOnly, refresh }, operation, row, call, options);
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [access, readOnly, refresh],
  );
  return useMemo(() => {
    const ws = workspaceId;
    const can = (operation, row = null) => !financeRefusal(access, operation, row, readOnly);
    const entryOperation = { approve: 'approveEntry', reject: 'rejectEntry', void: 'voidEntry' };
    return {
      access,
      busy,
      can,
      refusal: (operation, row = null) => financeRefusal(access, operation, row, readOnly),
      saveSettings: (settings) =>
        run('saveSettings', null, () => api.saveFinanceSettings(ws, settings)),
      createAgreement: (agreement) =>
        run('createAgreement', null, () => api.createAgreement(ws, agreement)),
      deleteAgreement: (id) => run('deleteAgreement', null, () => api.deleteAgreement(ws, id)),
      saveDeal: (draft, original = null) =>
        original
          ? run('editDeal', original, () => api.updateDeal(ws, original, draft))
          : run('createDeal', null, () => api.createDeal(ws, draft)),
      // The server decides whether the split changed and so needs a reason.
      splitDeal: (deal, split) => run('splitDeal', deal, () => api.splitDeal(ws, deal, split)),
      earnDeal: (deal, earnedOn) => run('earnDeal', deal, () => api.earnDeal(ws, deal, earnedOn)),
      reviseDeal: (deal, reason) =>
        run('reviseDeal', deal, () => api.reviseDeal(ws, deal, reason), { reason }),
      unearnDeal: (deal, reason) =>
        run('unearnDeal', deal, () => api.unearnDeal(ws, deal, reason), { reason }),
      deleteDeal: (deal) => run('deleteDeal', deal, () => api.deleteDeal(ws, deal)),
      assignDeal: (deal, assigneeId, reason) =>
        run('assignDeal', deal, () => api.assignDeal(ws, deal, assigneeId, reason)),
      /** `kind` is "payments" or "expenses"; editing an approved row (Admin) needs a reason. */
      saveEntry: (kind, draft, original = null, reason) =>
        original
          ? run(
              'editEntry',
              original,
              () => api.updateEntry(ws, kind, original, draft, reason),
              original.status === 'approved' ? { reason: reason ?? '' } : {},
            )
          : run('createEntry', null, () => api.createEntry(ws, kind, draft)),
      /** `decision` is approve, reject or void; reject and void require a reason. */
      decideEntry: (kind, entry, decision, reason) =>
        run(
          entryOperation[decision] ?? 'unknown',
          entry,
          () => api.decideEntry(ws, kind, entry, decision, reason),
          decision === 'approve' ? {} : { reason: reason ?? '' },
        ),
    };
  }, [access, api, busy, readOnly, run, workspaceId]);
}
