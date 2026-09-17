"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, setUnauthenticatedHandler } from "@/lib/api";
import type { AdminMe } from "@/lib/types";

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; admin: AdminMe }
  | { status: "unauthenticated" };

type AuthContextValue = {
  state: AuthState;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Wraps the whole app. On mount it asks the backend "who am I?" via
// GET /api/admin/auth/me (the httpOnly session cookie is the only
// credential). It also registers the global 401 handler so that any
// expired-session response, from any screen, redirects to /login.
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const redirecting = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const { admin } = await api.get<{ admin: AdminMe }>("/api/admin/auth/me", undefined, {
        suppressAuthRedirect: true,
      });
      setState({ status: "authenticated", admin });
    } catch {
      setState({ status: "unauthenticated" });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/admin/auth/logout");
    } catch {
      // Even if the call fails (already expired), drop to the login screen.
    }
    setState({ status: "unauthenticated" });
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      if (redirecting.current) return;
      redirecting.current = true;
      setState({ status: "unauthenticated" });
      router.replace("/login?expired=1");
    });
    return () => setUnauthenticatedHandler(null);
  }, [router]);

  useEffect(() => {
    // On mount, ask the backend who we are. This is a fetch from an
    // external system (the session), not derived render state — the
    // setState calls happen inside refresh()'s own then/catch callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return <AuthContext.Provider value={{ state, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Convenience for screens that are always rendered behind the protected
// layout — the admin is guaranteed present there.
export function useAdmin(): AdminMe {
  const { state } = useAuth();
  if (state.status !== "authenticated") {
    throw new Error("useAdmin used outside an authenticated screen");
  }
  return state.admin;
}
