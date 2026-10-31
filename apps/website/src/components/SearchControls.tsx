import type { Choice, Query } from '../lib/types';
import { first } from './ui';

export function SelectField({
  label,
  name,
  choices,
  query,
  disabled = false,
}: {
  label: string;
  name: string;
  choices: readonly Choice[];
  query: Query;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select name={name} aria-label={label} defaultValue={first(query[name])} disabled={disabled}>
        <option value="">Any</option>
        {choices.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
export function NumberField({
  label,
  name,
  query,
  disabled = false,
  step = '1',
}: {
  label: string;
  name: string;
  query: Query;
  disabled?: boolean;
  step?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type="number"
        min="0"
        step={step}
        defaultValue={first(query[name])}
        disabled={disabled}
        inputMode="decimal"
      />
    </label>
  );
}
