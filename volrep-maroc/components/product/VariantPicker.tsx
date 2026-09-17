"use client";

import type { ShopifyProductOption } from "@/lib/backend/products";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Options with a single value (Shopify's "Title"/"Default Title" convention
// for single-variant products, e.g. today's only real product) render
// nothing — a picker with one, unchangeable choice reads as broken on a
// premium product page rather than useful.
export function VariantPicker({
  options,
  selectedOptions,
  onChange,
}: {
  options: ShopifyProductOption[];
  selectedOptions: Record<string, string>;
  onChange: (optionName: string, value: string) => void;
}) {
  const pickableOptions = options.filter((option) => option.values.length > 1);
  if (pickableOptions.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {pickableOptions.map((option) => (
        <div key={option.id}>
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate">{option.name}</span>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {option.values.map((value) => {
              const isSelected = selectedOptions[option.name] === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onChange(option.name, value)}
                  className={`rounded-sm border px-4 py-2 text-sm font-medium transition-colors duration-200 ease-out ${FOCUS_RING} ${
                    isSelected ? "border-ink bg-ink text-paper" : "border-ink/15 text-ink hover:border-ink/40"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
