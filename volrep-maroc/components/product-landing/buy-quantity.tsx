"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

// The single source of truth for the product page's purchase quantity — the
// only purchase variable VOLREP has. Shared so the hero CTA (LpBuyBox) and
// the mobile sticky CTA (LpStickyCta) — which live in separate section
// subtrees under SectionRenderer — always agree, without either owning its
// own quantity state.
//
// Mounted once by ProductLanding around the whole section tree.

type BuyQuantityContextValue = {
  quantity: number;
  setQuantity: (next: number) => void;
};

const BuyQuantityContext = createContext<BuyQuantityContextValue | null>(null);

export function BuyQuantityProvider({ children, min = 1 }: { children: ReactNode; min?: number }) {
  const [quantity, setQuantityState] = useState(min);

  const value = useMemo<BuyQuantityContextValue>(
    () => ({
      quantity,
      setQuantity: (next: number) => setQuantityState(Math.max(min, Math.floor(next) || min)),
    }),
    [quantity, min],
  );

  return <BuyQuantityContext.Provider value={value}>{children}</BuyQuantityContext.Provider>;
}

export function useBuyQuantity(): BuyQuantityContextValue {
  const context = useContext(BuyQuantityContext);
  if (!context) {
    throw new Error("useBuyQuantity must be used within a BuyQuantityProvider");
  }
  return context;
}
