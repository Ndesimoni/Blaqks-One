export function EnquiryIdentity({ compact = false }: { compact?: boolean }) {
  const name = (
    <label>
      Your name
      <input name="name" autoComplete="name" maxLength={100} required />
    </label>
  );
  const email = (
    <label>
      Email
      <input name="email" type="email" autoComplete="email" maxLength={254} />
    </label>
  );
  const phone = (
    <label>
      Phone {compact && <span className="v-optional">(optional if email supplied)</span>}
      <input name="phone" type="tel" autoComplete="tel" placeholder="+971…" maxLength={16} />
    </label>
  );
  return compact ? (
    <>
      <div className="v-form-pair">
        {name}
        {email}
      </div>
      {phone}
    </>
  ) : (
    <>
      {name}
      <div className="field-pair">
        {email}
        {phone}
      </div>
    </>
  );
}
