import React from 'react';
import './grid-pills.css';

/**
 * A filter a page keeps beside the mockup's presets, drawn as a pill select: its label, then
 * `anyLabel` (the empty choice) and the `[value, text]` options.
 */
export function GridPillSelect({ label, value, onChange, anyLabel, options }) {
  return (
    <label className="grid-pill-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{anyLabel}</option>
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
