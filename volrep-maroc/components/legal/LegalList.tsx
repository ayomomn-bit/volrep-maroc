type LegalListProps = {
  items: string[];
};

// Bullet list using the same small volt dot the site's section eyebrows
// use elsewhere (Hero, FAQ, BestSellers, …) — keeps the accent consistent
// rather than introducing a new marker style just for legal content.
export function LegalList({ items }: LegalListProps) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2.5">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-volt" />
          {item}
        </li>
      ))}
    </ul>
  );
}
