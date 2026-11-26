export function SearchBudget({
  purpose,
  min,
  max,
  setMin,
  setMax,
}: {
  purpose: string;
  min: string;
  max: string;
  setMin: (value: string) => void;
  setMax: (value: string) => void;
}) {
  const basis =
    purpose === 'buy'
      ? 'Sale price'
      : purpose === 'rent'
        ? 'Annual rent'
        : purpose === 'holiday'
          ? 'Nightly rate'
          : 'Choose a purpose to set a budget';
  return (
    <div className="budget-fields">
      <label>
        Min budget (AED)
        <input
          type="number"
          name="minPrice"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={min}
          onChange={(event) => setMin(event.target.value)}
          disabled={!purpose}
        />
      </label>
      <label>
        Max budget (AED)
        <input
          type="number"
          name="maxPrice"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={max}
          onChange={(event) => setMax(event.target.value)}
          disabled={!purpose}
        />
      </label>
      <small>{basis}</small>
    </div>
  );
}
