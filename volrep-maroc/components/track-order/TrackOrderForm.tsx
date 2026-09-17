"use client";

import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { OrderResultCard } from "@/components/track-order/OrderResultCard";
import { trackOrderAction } from "@/lib/backend/track-order-actions";
import type { TrackOrderResult } from "@/lib/backend/orders";
import { t } from "@/lib/i18n";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER_NUMBER_PATTERN = /^#?[A-Za-z0-9-]{1,20}$/;

const NOT_FOUND_MESSAGE = t.trackOrder.errors.notFound;
const GENERIC_ERROR_MESSAGE = t.trackOrder.errors.generic;

type FieldErrors = { orderNumber?: string; email?: string };

function validate(orderNumber: string, email: string): FieldErrors {
  const errors: FieldErrors = {};

  if (!orderNumber.trim()) {
    errors.orderNumber = t.trackOrder.errors.orderNumberRequired;
  } else if (!ORDER_NUMBER_PATTERN.test(orderNumber.trim())) {
    errors.orderNumber = t.trackOrder.errors.orderNumberInvalid;
  }

  if (!email.trim()) {
    errors.email = t.trackOrder.errors.emailRequired;
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = t.trackOrder.errors.emailInvalid;
  }

  return errors;
}

const INPUT_CLASSNAME =
  "h-12 w-full rounded-lg border bg-background px-4 text-[15px] text-foreground transition-colors duration-200 ease-out placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60";

export function TrackOrderForm() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<TrackOrderResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const orderNumberId = useId();
  const emailId = useId();
  const orderNumberErrorId = useId();
  const emailErrorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const errors = validate(orderNumber, email);
    setFieldErrors(errors);
    setResult(null);

    if (errors.orderNumber || errors.email) return;

    startTransition(async () => {
      try {
        const trackResult = await trackOrderAction({ orderNumber, email });
        setResult(trackResult);
      } catch {
        setResult({ status: "error" });
      }
    });
  }

  function handleReset() {
    setResult(null);
    setFieldErrors({});
  }

  if (result?.status === "found") {
    return (
      <div className="mx-auto max-w-[480px]">
        <OrderResultCard order={result.order} />
        <button
          type="button"
          onClick={handleReset}
          className="mt-6 block w-full rounded-sm text-center text-sm font-medium text-muted-foreground underline-offset-4 transition-colors duration-200 ease-out hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t.trackOrder.trackAnother}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[480px]">
      <form onSubmit={handleSubmit} noValidate aria-busy={isPending}>
        <div className="rounded-[18px] border border-black/[0.06] bg-white px-6 py-8 shadow-[0_1px_2px_rgba(11,11,11,0.04)] sm:px-8 sm:py-10">
          <div className="flex flex-col gap-5">
            <div>
              <label
                htmlFor={orderNumberId}
                className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                {t.trackOrder.orderNumber}
              </label>
              <input
                id={orderNumberId}
                name="orderNumber"
                type="text"
                autoComplete="off"
                placeholder={t.trackOrder.orderNumberPlaceholder}
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                disabled={isPending}
                aria-invalid={Boolean(fieldErrors.orderNumber)}
                aria-describedby={fieldErrors.orderNumber ? orderNumberErrorId : undefined}
                className={`${INPUT_CLASSNAME} ${fieldErrors.orderNumber ? "border-red-400" : "border-black/[0.12]"}`}
              />
              {fieldErrors.orderNumber && (
                <p id={orderNumberErrorId} role="alert" className="mt-1.5 text-sm font-medium text-red-600">
                  {fieldErrors.orderNumber}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={emailId}
                className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                {t.trackOrder.email}
              </label>
              <input
                id={emailId}
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t.trackOrder.emailPlaceholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isPending}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                className={`${INPUT_CLASSNAME} ${fieldErrors.email ? "border-red-400" : "border-black/[0.12]"}`}
              />
              {fieldErrors.email && (
                <p id={emailErrorId} role="alert" className="mt-1.5 text-sm font-medium text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <Button type="submit" variant="primary" size="lg" disabled={isPending} className="mt-2 w-full">
              {isPending ? t.trackOrder.submitPending : t.trackOrder.submitIdle}
            </Button>
          </div>
        </div>
      </form>

      {(result?.status === "not_found" || result?.status === "error") && (
        <p role="alert" className="mt-5 text-center text-sm font-medium text-red-600">
          {result.status === "not_found" ? NOT_FOUND_MESSAGE : GENERIC_ERROR_MESSAGE}
        </p>
      )}
    </div>
  );
}
