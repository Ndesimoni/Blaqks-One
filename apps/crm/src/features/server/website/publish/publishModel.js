/**
 * Selected property publication (docs/website-backend.md): readiness mirrors the server's
 * public projection so problems show before the last step, and the request body carries
 * only the publication choices. Private record fields never enter the body; the server
 * re-checks everything.
 */
export const MAX_PHOTOS = 20;
export const MAX_PLANS = 3;
export const MAX_PERMIT = 100;
export const EMIRATES = [
  'dubai',
  'abu-dhabi',
  'sharjah',
  'ajman',
  'umm-al-quwain',
  'ras-al-khaimah',
  'fujairah',
];
const LISTABLE = ['available', 'under offer'];
const BASIS = { buy: ['total price', ''], rent: ['annual', ''], holiday: ['nightly'] };

const text = (record, key) => String(record?.[key] ?? '').trim();
const lower = (record, key) => text(record, key).toLowerCase();
export function amount(record, key) {
  const value = record?.[key];
  const parsed = typeof value === 'number' ? value : Number(text(record, key).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
const whole = (record, key) => Number.isInteger(amount(record, key)) && amount(record, key) >= 1;

/** `buy`, `rent`, `holiday` or '' — the server's purpose names. */
export function purposeOf(record) {
  const value = lower(record, 'sale_rental');
  if (['sale', 'buy'].includes(value)) return 'buy';
  if (['rent', 'rental'].includes(value)) return 'rent';
  if (['holiday', 'holiday home', 'holiday homes'].includes(value)) return 'holiday';
  return '';
}
export const emirateSlug = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ /g, '-');
export const isListable = (record) => LISTABLE.includes(lower(record, 'listing_status'));

/** Every readiness rule with its result; `holiday` applies only to holiday homes. */
export function readiness(record) {
  const purpose = purposeOf(record);
  const rules = [
    ['status', isListable(record)],
    ['purpose', Boolean(purpose)],
    ['emirate', EMIRATES.includes(emirateSlug(record?.emirate))],
    ['price', amount(record, 'price_annual_rent_aed') > 0 && amount(record, 'area_sq_ft') > 0],
    ['basis', !purpose || BASIS[purpose].includes(lower(record, 'price_basis'))],
    ['ready', ['ready', 'off-plan'].includes(lower(record, 'ready_off_plan'))],
    [
      'location',
      ['emirate', 'community', 'building_project', 'unit_reference'].every((key) =>
        text(record, key),
      ),
    ],
    ['copy', Boolean(text(record, 'listing_title') && text(record, 'property_description'))],
  ];
  if (purpose === 'holiday')
    rules.push([
      'holiday',
      whole(record, 'maximum_guests') && whole(record, 'minimum_stay_nights'),
    ]);
  return rules.map(([id, ok]) => ({ id, ok }));
}
export const isReady = (record) => readiness(record).every((rule) => rule.ok);

const stored = (asset) => typeof asset?.file === 'string' && asset.file.length > 0;
export const isPdf = (asset) => /pdf/i.test(asset?.type || '') || /\.pdf$/i.test(asset?.name || '');
export const photoChoices = (record) => (record?.media_photos || []).filter(stored);
export const planChoices = (record) => (record?.media_floorplans || []).filter(stored);

/** Every stored photo up to 20 (gallery order, so the CRM cover stays first) and image plans. */
export function initialMedia(record) {
  return {
    photos: photoChoices(record)
      .slice(0, MAX_PHOTOS)
      .map((photo) => photo.file),
    floorPlans: planChoices(record)
      .filter((plan) => !isPdf(plan))
      .slice(0, MAX_PLANS)
      .map((plan) => plan.file),
  };
}
export function toggle(selected, file, limit) {
  if (selected.includes(file)) return selected.filter((item) => item !== file);
  return selected.length < limit ? [...selected, file] : selected;
}
export const makeCover = (selected, file) => [file, ...selected.filter((item) => item !== file)];

/** A profile can represent listings when consented, active and allowed (an Admin always is). */
export const eligibleProfiles = (profiles, adminId) =>
  (profiles || []).filter(
    (profile) =>
      profile?.consent && profile.active && (profile.canPublish || profile.member === adminId),
  );
export const profileName = (profile) => profile?.body?.name || '';
export function defaultAgent(eligible, assignee, userId) {
  const by = (member) => eligible.find((profile) => profile.member === member);
  return (by(assignee) || by(userId) || eligible[0])?.id || '';
}

/** The publication of this record by this representative (one per record and member). */
export const existingFor = (publications, recordId, profileId) =>
  (publications || []).find(
    (row) => row.recordId === recordId && row.agentProfileId === profileId,
  ) || null;

export function detailErrors(draft) {
  const permit = draft.permit.trim();
  if (!permit) return { permit: 'permitRequired' };
  if ([...permit].length > MAX_PERMIT) return { permit: 'permitLong' };
  return {};
}

/** The POST body: choices only. `version` is 0 first, else the existing row's version. */
export function publishBody({ entry, draft, existing }) {
  const sale = purposeOf(entry.record) === 'buy';
  return {
    recordId: entry.id,
    recordVersion: entry.version,
    agentProfileId: draft.agentProfileId,
    version: existing?.version ?? 0,
    destination: draft.destination,
    permitReference: draft.permit.trim(),
    ...(sale && ['primary', 'resale'].includes(draft.market) ? { market: draft.market } : {}),
    photos: draft.photos.slice(0, MAX_PHOTOS),
    floorPlans: draft.floorPlans.slice(0, MAX_PLANS),
  };
}

/** A plain-English refusal: `{ key, stale }` for known cases, else the server's message. */
export function publishError(error) {
  const status = error?.status;
  const code = error?.details?.code;
  const message = error?.message || '';
  if (status === 409 && code === 'version_conflict') return { key: 'errorStale', stale: true };
  if (status === 409 && /listing limit/i.test(message)) return { key: 'errorCapacity' };
  if (status === 404) return { key: 'errorHidden' };
  if (status === 403 && /eligibility|licen[cs]e/i.test(message)) return { key: 'errorLicence' };
  return message ? { message } : { key: 'errorGeneric' };
}
