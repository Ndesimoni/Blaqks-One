import React, { useId } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation, useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { today } from '../../../lib/dates.js';
import { propertyPrice } from '../../../lib/properties.js';
import { get } from '../../../lib/records.js';
import { useRecordAccess } from '../../records/useRecordAccess.js';
import { canOpenSection } from '../access.js';
import { contactOptions } from '../inbox/contactModel.js';
import { matchReasons } from './clientDeskModel.js';

/**
 * The client's property matches (approved mockup): the rule they follow, then each listing with
 * its price and why it matches. Add to shortlist needs Shortlist create access; Send on WhatsApp
 * the WhatsApp grant and the client's number. Without matches, the marketplace prompt.
 */
export function DeskMatches({ client, matches }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { entries, keptFor } = useRecords();
  const { add, dispatchRow, readOnly = false } = useWorkspaceActions();
  const { navigate } = useNavigation();
  const canShortlist = useRecordAccess()('Shortlist', 'create');
  const listId = useId();
  const whatsapp = readOnly
    ? ''
    : contactOptions({ module: 'Clients', record: client, entries, keptFor, user }).whatsapp;
  if (!matches.length) {
    const first = String(get(client, 'Full name') || '').split(' ')[0] || t('clientDesk.client');
    return (
      <Empty
        icon="search"
        title={t('clientDesk.noMatchTitle')}
        detail={t('clientDesk.noMatchDetail', { name: first })}
        action={
          canOpenSection(user, 'Marketplace') && (
            <Button onClick={() => navigate('Marketplace')}>{t('clientDesk.postRequest')}</Button>
          )
        }
      />
    );
  }
  const send = (property) =>
    `https://wa.me/${whatsapp}?text=${encodeURIComponent(
      t('clientDesk.whatsappText', {
        title: get(property, 'Listing title'),
        price: propertyPrice(property),
      }),
    )}`;
  return (
    <section className="client-desk-matches" aria-labelledby={listId}>
      <p id={listId} className="client-desk-rule">
        {t('clientDesk.matches', { count: matches.length })}
      </p>
      <OverflowList
        mode="scroll"
        className="client-desk-match-scroll"
        key={get(client, 'Client ID')}
        items={matches}
        getKey={(property) => get(property, 'Property ID')}
        label={t('clientDesk.matchList')}
        listClassName="client-desk-match-list"
        renderItem={(property, _index, { close }) => (
          <article className="client-desk-match">
            <button
              type="button"
              className="client-desk-match-title"
              onClick={() => dispatchRow('Properties', property)}
            >
              {get(property, 'Listing title') || get(property, 'Property ID')}
            </button>
            <strong className="client-desk-match-price">{propertyPrice(property)}</strong>
            <span className="client-desk-reasons">
              {matchReasons(client, property).map((reason) => (
                <Badge key={reason.text} tone={reason.tone}>
                  {reason.text}
                </Badge>
              ))}
            </span>
            {(canShortlist || whatsapp) && (
              <span className="client-desk-match-actions">
                {canShortlist && (
                  <Button
                    variant="light"
                    icon="plus"
                    onClick={() => {
                      close();
                      add('Shortlist', {
                        client_id: get(client, 'Client ID'),
                        property_id: get(property, 'Property ID'),
                        date_sent: today(),
                        client_response: 'Pending',
                      });
                    }}
                  >
                    {t('clientDesk.addShortlist')}
                  </Button>
                )}
                {whatsapp && (
                  <a
                    className="btn btn-light"
                    href={send(property)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="chat" size={16} aria-hidden="true" />
                    <span>{t('clientDesk.sendWhatsapp')}</span>
                  </a>
                )}
              </span>
            )}
          </article>
        )}
      />
    </section>
  );
}
