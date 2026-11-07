import { useState } from 'react';

/**
 * The Admin's number actions (W1a): give a member a number and disconnect one. Each resolves
 * to '' on success or the server's reason; the section notice says what changed. The list
 * reloads after every attempt, so a stale version is replaced by the current one.
 */
export function useNumberActions({ api, workspaceId, nameOf, reload, t }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const failed = (failure) => failure.message || t('whatsappNumbers.failed');
  const give = async (memberId, phone) => {
    setNotice(null);
    try {
      const result = await api.giveWhatsappNumber(workspaceId, memberId, phone);
      const given = result?.number?.phone ?? phone;
      setNotice({ text: t('whatsappNumbers.given', { phone: given, member: nameOf(memberId) }) });
      reload();
      return '';
    } catch (failure) {
      return failed(failure);
    }
  };
  const disconnect = async (number) => {
    setBusy(true);
    setNotice(null);
    try {
      await api.disconnectWhatsappNumber(workspaceId, number);
      setNotice({ text: t('whatsappNumbers.disconnected', { phone: number.phone }), done: true });
      return '';
    } catch (failure) {
      setNotice({ text: failed(failure), error: true });
      return failed(failure);
    } finally {
      setBusy(false);
      reload();
    }
  };
  return { busy, notice, give, disconnect };
}
