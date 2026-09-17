"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Field, InlineError, TextInput } from "@/components/ui";
import { t } from "@/lib/i18n";

// Deliberately generic. The backend already returns an identical error for
// "unknown email" and "wrong password"; the UI never says which.
const GENERIC_ERROR = t.login.invalidCredentials;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("expired") ? t.common.sessionExpired : null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (state.status === "authenticated") router.replace("/");
  }, [state.status, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/admin/auth/login", { email: email.trim(), password });
      await refresh();
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t.login.tooManyAttempts);
      } else {
        setError(GENERIC_ERROR);
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-volt">{t.common.brand}</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">{t.login.heading}</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={t.login.email}>
            <TextInput
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label={t.login.password}>
            <TextInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <InlineError message={error} />
          <Button type="submit" variant="primary" className="w-full" loading={submitting}>
            {t.login.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
