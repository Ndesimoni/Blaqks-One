import type { Choice } from '../lib/types';

export function LiveSelect({
  label,
  name,
  value,
  choices,
  empty,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  choices: readonly Choice[];
  empty: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select
        name={name}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{empty}</option>
        {choices.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
