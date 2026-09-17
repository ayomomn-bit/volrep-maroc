"use client";

import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { submitCheckoutAction, type PlacedOrder } from "@/lib/backend/checkout-actions";
import { submitDirectCheckoutAction } from "@/lib/backend/direct-checkout-actions";
import { validateCodCustomerFields, type CodCustomerErrors } from "@/lib/backend/cod-customer";
import { t } from "@/lib/i18n";

const GENERIC_ERROR_MESSAGE = t.checkout.form.errors.generic;

// Same input recipe as track-order/TrackOrderForm.tsx — this form should
// read as the same system, not a new one.
const INPUT_CLASSNAME =
  "h-12 w-full rounded-lg border bg-background px-4 text-[15px] text-foreground transition-colors duration-200 ease-out placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60";
const LABEL_CLASSNAME = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground";

type CheckoutFormProps = {
  onSuccess: (order: PlacedOrder) => void;
  // "cart"   → submits the persistent (cookie) cart via submitCheckoutAction.
  // "direct" → "Commander maintenant": a standalone product+quantity order via
  //            submitDirectCheckoutAction. Same five fields either way.
  mode?: "cart" | "direct";
  directHandle?: string;
  directQuantity?: number;
};

function phoneErrorText(issue: CodCustomerErrors["phone"]): string {
  return issue === "invalid"
    ? t.checkout.form.errors.phoneInvalid
    : t.checkout.form.errors.phoneRequired;
}

export function CheckoutForm({ onSuccess, mode = "cart", directHandle, directQuantity }: CheckoutFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CodCustomerErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const firstNameId = useId();
  const lastNameId = useId();
  const phoneId = useId();
  const cityId = useId();
  const addressId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const fields = { firstName, lastName, phone, city, address };
    const errors = validateCodCustomerFields(fields);
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    startTransition(async () => {
      try {
        const result =
          mode === "direct"
            ? await submitDirectCheckoutAction({
                handle: directHandle ?? "",
                quantity: directQuantity ?? 1,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                city: city.trim(),
                address: address.trim(),
              })
            : await submitCheckoutAction({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                city: city.trim(),
                address: address.trim(),
              });

        if (!result.success) {
          setFormError(result.error);
          return;
        }

        onSuccess(result.order);
      } catch {
        setFormError(GENERIC_ERROR_MESSAGE);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={isPending}>
      <div className="rounded-[18px] border border-black/[0.06] bg-white px-6 py-8 shadow-[0_1px_2px_rgba(11,11,11,0.04)] sm:px-8 sm:py-10">
        <h2 className="text-lg font-bold tracking-tight text-ink">{t.checkout.form.heading}</h2>

        <div className="mt-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
            <div>
              <label htmlFor={firstNameId} className={LABEL_CLASSNAME}>
                {t.checkout.form.firstName}
              </label>
              <input
                id={firstNameId}
                name="firstName"
                type="text"
                autoComplete="given-name"
                placeholder={t.checkout.form.firstNamePlaceholder}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                disabled={isPending}
                aria-invalid={Boolean(fieldErrors.firstName)}
                className={`${INPUT_CLASSNAME} ${fieldErrors.firstName ? "border-red-400" : "border-black/[0.12]"}`}
              />
              {fieldErrors.firstName && (
                <p role="alert" className="mt-1.5 text-sm font-medium text-red-600">
                  {t.checkout.form.errors.firstNameRequired}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={lastNameId} className={LABEL_CLASSNAME}>
                {t.checkout.form.lastName}
              </label>
              <input
                id={lastNameId}
                name="lastName"
                type="text"
                autoComplete="family-name"
                placeholder={t.checkout.form.lastNamePlaceholder}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                disabled={isPending}
                aria-invalid={Boolean(fieldErrors.lastName)}
                className={`${INPUT_CLASSNAME} ${fieldErrors.lastName ? "border-red-400" : "border-black/[0.12]"}`}
              />
              {fieldErrors.lastName && (
                <p role="alert" className="mt-1.5 text-sm font-medium text-red-600">
                  {t.checkout.form.errors.lastNameRequired}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor={phoneId} className={LABEL_CLASSNAME}>
              {t.checkout.form.phone}
            </label>
            <input
              id={phoneId}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t.checkout.form.phonePlaceholder}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.phone)}
              className={`${INPUT_CLASSNAME} ${fieldErrors.phone ? "border-red-400" : "border-black/[0.12]"}`}
            />
            {fieldErrors.phone ? (
              <p role="alert" className="mt-1.5 text-sm font-medium text-red-600">
                {phoneErrorText(fieldErrors.phone)}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">{t.checkout.form.phoneHint}</p>
            )}
          </div>

          <div>
            <label htmlFor={cityId} className={LABEL_CLASSNAME}>
              {t.checkout.form.city}
            </label>
            <input
              id={cityId}
              name="city"
              type="text"
              autoComplete="address-level2"
              placeholder={t.checkout.form.cityPlaceholder}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.city)}
              className={`${INPUT_CLASSNAME} ${fieldErrors.city ? "border-red-400" : "border-black/[0.12]"}`}
            />
            {fieldErrors.city && (
              <p role="alert" className="mt-1.5 text-sm font-medium text-red-600">
                {t.checkout.form.errors.cityRequired}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={addressId} className={LABEL_CLASSNAME}>
              {t.checkout.form.address}
            </label>
            <textarea
              id={addressId}
              name="address"
              rows={3}
              autoComplete="street-address"
              placeholder={t.checkout.form.addressPlaceholder}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.address)}
              className={`${INPUT_CLASSNAME.replace("h-12", "min-h-[92px]")} resize-y py-3 ${
                fieldErrors.address ? "border-red-400" : "border-black/[0.12]"
              }`}
            />
            {fieldErrors.address && (
              <p role="alert" className="mt-1.5 text-sm font-medium text-red-600">
                {t.checkout.form.errors.addressRequired}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-muted px-4 py-3.5 text-sm text-muted-foreground">
          {t.checkout.form.codNote}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isPending}
          className="mt-6 h-14 w-full rounded-2xl !bg-volt text-base tracking-wide !text-white hover:!bg-volt-deep"
        >
          {isPending ? t.checkout.form.submitPending : t.checkout.form.submitIdle}
        </Button>

        {formError && (
          <p role="alert" className="mt-4 text-center text-sm font-medium text-red-600">
            {formError}
          </p>
        )}
      </div>
    </form>
  );
}
