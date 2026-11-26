import { useState } from 'react';

/**
 * The Admin's address actions (E3d): add, rename, keep for a former member, and remove an
 * address that was never used (owner decision 2026-10-21). Each returns '' on success or
 * the reason it failed; a notice tells everyone what changed.
 */
export function useAddressActions({ api, workspaceId, domain, reload, t }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const run = async (action, key, values) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
      setNotice(t(key, values));
      reload();
      return '';
    } catch (failure) {
      return failure.message || t('emailAddresses.failed');
    } finally {
      setBusy(false);
    }
  };
  const add = (body) =>
    run(() => api.addEmailAddress(workspaceId, body), 'emailAddresses.addedNotice', {
      address: `${body.localPart}@${domain}`,
    });
  const rename = (address, displayName) =>
    run(
      () =>
        api.renameEmailAddress(workspaceId, address.id, {
          expectedVersion: address.version,
          displayName,
        }),
      'emailAddresses.renamedNotice',
      { address: address.address },
    );
  const versioned = (call, key) => async (address) => {
    const failure = await run(
      () => call(workspaceId, address.id, { expectedVersion: address.version }),
      key,
      { address: address.address },
    );
    if (failure) setNotice(failure);
    return failure;
  };
  return {
    busy,
    notice,
    add,
    rename,
    reserve: versioned(api.reserveEmailAddress, 'emailAddresses.reservedNotice'),
    remove: versioned(api.removeEmailAddress, 'emailAddresses.removedNotice'),
  };
}
