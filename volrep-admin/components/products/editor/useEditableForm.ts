"use client";

import { useState } from "react";

// Form-state helper for the product editor sections.
//
//  - `value` / `setValue` hold the working copy
//  - `dirty` is true when `value` differs from the last saved baseline
//  - the baseline resets when `resetKey` changes (the product was reloaded
//    after a save) or when `commit()` is called after a successful save
//
// The reset-on-key uses React's supported "adjust state during render"
// pattern rather than an effect.
export function useEditableForm<T>(initial: T, resetKey: string) {
  const [value, setValue] = useState<T>(initial);
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(initial));
  const [seenKey, setSeenKey] = useState<string>(resetKey);

  if (resetKey !== seenKey) {
    setSeenKey(resetKey);
    setValue(initial);
    setBaseline(JSON.stringify(initial));
  }

  const dirty = JSON.stringify(value) !== baseline;

  const commit = (next?: T) => {
    const committed = next ?? value;
    setBaseline(JSON.stringify(committed));
    if (next !== undefined) setValue(next);
  };

  return { value, setValue, dirty, commit };
}
