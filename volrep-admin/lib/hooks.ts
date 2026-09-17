"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/i18n";

type FetchState<T> = { data: T | undefined; error: string | null; loading: boolean };

type FetchAction<T> =
  | { type: "start" }
  | { type: "success"; data: T }
  | { type: "error"; message: string };

function fetchReducer<T>(state: FetchState<T>, action: FetchAction<T>): FetchState<T> {
  switch (action.type) {
    case "start":
      return { ...state, loading: true, error: null };
    case "success":
      return { data: action.data, loading: false, error: null };
    case "error":
      return { ...state, loading: false, error: action.message };
  }
}

// Minimal data-fetching hook — no external query library. `fetcher` must be
// stable (wrap it in useCallback at the call site, keyed on its inputs).
export function useResource<T>(fetcher: () => Promise<T>): FetchState<T> & { reload: () => void } {
  const [state, dispatch] = useReducer(fetchReducer<T>, { data: undefined, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "start" });
    fetcher()
      .then((result) => {
        if (!cancelled) dispatch({ type: "success", data: result });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A 401 is handled globally (redirect to /login) — don't also show
        // it as an inline error.
        if (err instanceof ApiError && err.status === 401) return;
        dispatch({ type: "error", message: err instanceof Error ? err.message : t.common.genericError });
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, nonce]);

  return { ...state, reload };
}

// Wraps a mutation (approve, transition, save...) with pending + error
// state and a friendly message on failure.
export function useMutation<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
): {
  run: (...args: Args) => Promise<Result | undefined>;
  pending: boolean;
  error: string | null;
  clearError: () => void;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args) => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) return undefined;
        setError(err instanceof Error ? err.message : t.common.actionFailed);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );

  return { run, pending, error, clearError: useCallback(() => setError(null), []) };
}
