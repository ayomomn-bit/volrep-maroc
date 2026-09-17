// Static marketing copy — no Shopify field backs a "benefits" list, same
// convention as TrustBadges/PaymentMethods (no data, no interactivity, so
// this stays a Server Component and is composed into ProductInfo).
const BENEFITS = [
  "Récupération musculaire profonde",
  "Améliore la circulation",
  "Massage complet du corps au quotidien",
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function BenefitsList() {
  return (
    <ul className="flex flex-col gap-4">
      {BENEFITS.map((benefit, index) => (
        <li
          key={benefit}
          style={{ animationDelay: `${index * 80}ms` }}
          className="benefit-fade-in flex items-center gap-3 text-[15px] font-medium text-ink"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
            <CheckIcon />
          </span>
          {benefit}
        </li>
      ))}
    </ul>
  );
}
