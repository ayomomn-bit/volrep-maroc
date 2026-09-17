"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Tracks unsaved changes across the product editor's tabs. Each section
// calls `useRegisterDirty(id, isDirty)`; the tab bar reads `anyDirty()`
// before switching tabs and the shell installs a beforeunload guard.
type DirtyApi = {
  setDirty: (id: string, dirty: boolean) => void;
  anyDirty: () => boolean;
};

const DirtyContext = createContext<DirtyApi | null>(null);

export function DirtyProvider({ children }: { children: ReactNode }) {
  const map = useRef(new Map<string, boolean>());
  const [, force] = useState(0);

  const setDirty = useCallback((id: string, dirty: boolean) => {
    const cur = map.current.get(id) ?? false;
    if (cur === dirty) return;
    map.current.set(id, dirty);
    force((n) => n + 1);
  }, []);

  const anyDirty = useCallback(() => [...map.current.values()].some(Boolean), []);

  // Browser-level guard: warn on tab close / reload while anything is dirty.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (anyDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);

  return <DirtyContext.Provider value={{ setDirty, anyDirty }}>{children}</DirtyContext.Provider>;
}

export function useDirtyApi(): DirtyApi {
  const ctx = useContext(DirtyContext);
  if (!ctx) throw new Error("useDirtyApi must be used inside <DirtyProvider>");
  return ctx;
}

// Section helper: report this section's dirty state, auto-cleared on unmount.
export function useRegisterDirty(id: string, dirty: boolean): void {
  const { setDirty } = useDirtyApi();
  useEffect(() => {
    setDirty(id, dirty);
  }, [id, dirty, setDirty]);
  useEffect(() => () => setDirty(id, false), [id, setDirty]);
}
