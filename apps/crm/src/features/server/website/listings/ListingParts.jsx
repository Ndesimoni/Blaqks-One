import React from 'react';
import { Badge } from '../../../../components/ui/Badge.jsx';
import { Button } from '../../../../components/ui/Button.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { isLive, priceKey } from './listingsModel.js';

/** Live (green) or Withdrawn (slate), plus "Changes not public" (amber) — always in words. */
export function ListingStatus({ status }) {
  const { t } = useI18n();
  const k = (key) => t(`websiteListings.${key}`);
  return (
    <span className="website-listing-status">
      {status === 'withdrawn' ? (
        <Badge tone="slate">{k('statusWithdrawn')}</Badge>
      ) : (
        <Badge tone="green">{k('statusLive')}</Badge>
      )}
      {status === 'changed' && <Badge tone="amber">{k('statusChanged')}</Badge>}
    </span>
  );
}

/** The public price as published: AED total, per year or per night. */
export function ListingPrice({ purpose, price }) {
  const { t, format } = useI18n();
  if (!price) return '—';
  return t(`websiteListings.${priceKey(purpose)}`, {
    amount: format.number(price, { maximumFractionDigits: 0 }),
  });
}

/** A Dubai date for the publication time, or a dash. */
export function ListingDate({ value }) {
  const { format } = useI18n();
  if (!value) return '—';
  return <time dateTime={value}>{format.date(value)}</time>;
}

/** The table's listing title: opens the CRM property while that record is still visible. */
export function ListingTitle({ row, busy, onOpen }) {
  const { t } = useI18n();
  if (!row.entry) return <strong>{row.title}</strong>;
  return (
    <button
      type="button"
      className="website-listing-open"
      disabled={busy}
      aria-label={t('websiteListings.openNamed', { title: row.title })}
      onClick={() => onOpen(row)}
    >
      {row.title}
    </button>
  );
}

/**
 * Open property and Republish need the CRM record (still visible to the caller); Withdraw
 * appears only for live rows. Names include the title so each row's buttons are distinct.
 * The table opens the property from its title instead (`withOpen={false}`).
 */
export function ListingActions({ row, busy, onOpen, onRepublish, onWithdraw, withOpen = true }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteListings.${key}`, vars);
  const title = row.title;
  return (
    <div className="website-listing-actions">
      {withOpen && (
        <Button
          variant="light"
          disabled={busy || !row.entry}
          aria-label={k('openNamed', { title })}
          onClick={() => onOpen(row)}
        >
          {k('open')}
        </Button>
      )}
      <Button
        variant="light"
        disabled={busy || !row.entry}
        aria-label={k('republishNamed', { title })}
        onClick={() => onRepublish(row)}
      >
        {k('republish')}
      </Button>
      {isLive(row.status) && (
        <Button
          variant="danger-light"
          disabled={busy}
          aria-label={k('withdrawNamed', { title })}
          onClick={() => onWithdraw(row)}
        >
          {k('withdraw')}
        </Button>
      )}
    </div>
  );
}
