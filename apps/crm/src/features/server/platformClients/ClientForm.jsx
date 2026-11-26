import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { FormSliderHead } from '../../../components/ui/FormSliderHead.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { readClient } from './clientShapes.js';
import {
  blankClient,
  changedFields,
  clientBody,
  clientError,
  clientName,
  formFrom,
} from './clientsModel.js';
import { ClientFormFields } from './ClientFormFields.jsx';

/**
 * Add a Blaqks One client, or edit one (`client`), in the CRM's form slider from the right
 * edge. Adding posts the whole form; editing sends only the changed fields with the version
 * read (`update`), and a 409 offers Reload, which shows the latest in the slider. The draft
 * stays on every other failure.
 */
export function ClientForm({ client = null, owners, update, onReload, onClose, onSaved }) {
  const { api } = useSession();
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const titleId = useId();
  const [form, setForm] = useState(() => (client ? formFrom(client) : blankClient()));
  const [error, setError] = useState({ message: '', conflict: false });
  const [busy, setBusy] = useState(false);
  const onField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!client) return readClient((await api.createPlatformClient(clientBody(form))).client);
    const fields = changedFields(form, client);
    if (!Object.keys(fields).length) return client;
    const outcome = await update(fields);
    if (!outcome.ok) throw Object.assign(Error(outcome.message), { conflict: outcome.conflict });
    return outcome.result?.client ? readClient(outcome.result.client) : { ...client, ...fields };
  };
  const submit = async (event) => {
    event.preventDefault();
    const problem = clientError(form);
    if (problem) return setError({ message: k(problem), conflict: false });
    setBusy(true);
    setError({ message: '', conflict: false });
    try {
      onSaved(await save());
    } catch (failure) {
      setError({
        message: failure.conflict ? k('conflict') : failure.message,
        conflict: Boolean(failure.conflict),
      });
    } finally {
      setBusy(false);
    }
  };
  const title = client ? k('editTitle', { name: clientName(client) }) : k('addTitle');
  return (
    <Drawer
      placement="right"
      className="editor-drawer form-slider platform-client-form"
      titleId={titleId}
      onClose={() => !busy && onClose()}
    >
      <FormSliderHead
        titleId={titleId}
        title={title}
        closeLabel={k('cancel')}
        busy={busy}
        onClose={onClose}
      />
      <form noValidate className="drawer-form" onSubmit={submit}>
        <div className="drawer-body">
          {error.message && (
            <div className="platform-client-problem" role="alert">
              <p className="field-error">{error.message}</p>
              {error.conflict && (
                <Button
                  variant="light"
                  onClick={() => {
                    onReload();
                    onClose();
                  }}
                >
                  {k('reload')}
                </Button>
              )}
            </div>
          )}
          <ClientFormFields form={form} owners={owners} busy={busy} onField={onField} />
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={busy} onClick={onClose}>
            {k('cancel')}
          </Button>
          <Button type="submit" icon="check" disabled={busy}>
            {busy ? k('saving') : client ? k('saveClient') : k('create')}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
