import { axisFloor, axisLabel, barHeight, niceMax } from '../performance/chartModel.js';

/**
 * The twelve-month trend panels (BO1d). Each panel plots one or two series as columns on their
 * own axis (two series of different scale are small multiples, never a second axis). Money
 * series are whole fils; `count` names the series a money tooltip also quotes.
 */
export const TREND_PANELS = [
  { key: 'growth', series: [{ key: 'companiesNew' }, { key: 'usersNew' }] },
  { key: 'activeUsers', series: [{ key: 'monthlyActiveUsers' }], latest: true },
  {
    key: 'dealsValue',
    series: [{ key: 'dealsEarnedValueFils', money: true, count: 'dealsEarned' }],
  },
  { key: 'enquiries', series: [{ key: 'enquiries' }] },
  { key: 'interBroker', series: [{ key: 'interBrokerAgreements' }] },
  { key: 'records', series: [{ key: 'recordsAdded' }] },
];

const metric = (money) => (money ? 'fees' : 'count');

/** The axis for a series: a rounded maximum and its three labelled ticks (top, middle, zero). */
export function trendScale(values, money = false) {
  const max = niceMax(Math.max(0, ...values.map((value) => value ?? 0)), axisFloor(metric(money)));
  return { max, ticks: [max, max / 2, 0].map((tick) => axisLabel(metric(money), tick)) };
}

/** A column's height as a share of the axis; untracked months draw nothing. */
export const columnHeight = (value, max) => (value === null ? 0 : barHeight(value, max));

/** Short text for a value on the chart (the cap label, tooltips): compact counts or AED. */
export const shortValue = (value, money = false) => axisLabel(metric(money), value);
