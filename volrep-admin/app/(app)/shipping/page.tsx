"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMutation, useResource } from "@/lib/hooks";
import { can } from "@/lib/rbac";
import type { ShippingCountry } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBlock, Field, InlineError, LoadingBlock, PageHeader, Table, Td, TextInput, Th, Toggle } from "@/components/ui";

export default function ShippingPage() {
  const { state } = useAuth();
  const role = state.status === "authenticated" ? state.admin.role : undefined;
  const canWrite = can(role, "shipping.write");

  const fetcher = useCallback(() => api.get<{ countries: ShippingCountry[] }>("/api/admin/shipping-settings").then((r) => r.countries), []);
  const { data, error, loading, reload } = useResource(fetcher);
  const [editing, setEditing] = useState<ShippingCountry | "new" | null>(null);

  return (
    <div>
      <PageHeader
        title={t.shipping.title}
        description={t.shipping.subtitle}
        action={
          canWrite ? (
            <Button variant="primary" onClick={() => setEditing("new")}>
              {t.shipping.addCountry}
            </Button>
          ) : null
        }
      />

      {!canWrite && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-inset ring-amber-200">
          {t.shipping.readOnlyNotice}
        </p>
      )}

      {loading && !data && <LoadingBlock />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && (data.length === 0 ? (
        <EmptyState title={t.shipping.emptyTitle} hint={canWrite ? t.shipping.emptyHintCanWrite : undefined} />
      ) : (
        <Table
          head={
            <tr>
              <Th>{t.shipping.columns.country}</Th>
              <Th>{t.shipping.columns.enabled}</Th>
              <Th className="text-right">{t.shipping.columns.flatRate}</Th>
              <Th>{t.shipping.columns.handling}</Th>
              <Th>{t.shipping.columns.shipping}</Th>
              <Th>{t.shipping.columns.returns}</Th>
              <Th />
            </tr>
          }
        >
          {data.map((c) => (
            <tr key={c.id}>
              <Td className="font-medium text-slate-800">{c.countryCode}</Td>
              <Td>
                <Badge tone={c.active ? "success" : "neutral"}>{c.active ? t.shipping.enabled : t.shipping.disabled}</Badge>
              </Td>
              <Td className="text-right">{formatMoney(c.flatRate)}</Td>
              <Td className="text-slate-500">{t.shipping.daysRange(c.handlingTimeDays.min, c.handlingTimeDays.max)}</Td>
              <Td className="text-slate-500">{t.shipping.daysRange(c.shippingTimeDays.min, c.shippingTimeDays.max)}</Td>
              <Td className="text-slate-500">{t.shipping.returnWindow(c.returnWindowDays)}</Td>
              <Td className="text-right">
                {canWrite && (
                  <Button variant="ghost" onClick={() => setEditing(c)}>
                    {t.common.edit}
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      ))}

      {editing && (
        <CountryDialog
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function CountryDialog({ existing, onClose, onSaved }: { existing: ShippingCountry | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    countryCode: existing?.countryCode ?? "",
    active: existing?.active ?? true,
    flatRateAmount: existing?.flatRate.amount ?? "0",
    currency: existing?.currency ?? "MAD",
    handlingMin: existing?.handlingTimeDays.min ?? 1,
    handlingMax: existing?.handlingTimeDays.max ?? 2,
    shippingMin: existing?.shippingTimeDays.min ?? 7,
    shippingMax: existing?.shippingTimeDays.max ?? 12,
    returnWindowDays: existing?.returnWindowDays ?? 7,
    refundProcessingDays: existing?.refundProcessingDays ?? 7,
  });

  const save = useMutation(() => {
    const code = form.countryCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) throw new Error(t.shipping.dialog.codeInvalid);
    return api.put(`/api/admin/shipping-settings/${code}`, {
      active: form.active,
      flatRateAmount: form.flatRateAmount,
      currency: form.currency.toUpperCase(),
      handlingTimeMinDays: Number(form.handlingMin),
      handlingTimeMaxDays: Number(form.handlingMax),
      shippingTimeMinDays: Number(form.shippingMin),
      shippingTimeMaxDays: Number(form.shippingMax),
      returnWindowDays: Number(form.returnWindowDays),
      refundProcessingDays: Number(form.refundProcessingDays),
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg">
        <div role="dialog" aria-modal="true" aria-label={t.shipping.dialog.addTitle} onClick={(e) => e.stopPropagation()}>
          <CardHeader title={existing ? t.shipping.dialog.editTitle(existing.countryCode) : t.shipping.dialog.addTitle} />
          <div className="space-y-3 px-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.shipping.dialog.countryCode} hint={t.shipping.dialog.countryCodeHint}>
                <TextInput
                  value={form.countryCode}
                  disabled={!!existing}
                  maxLength={2}
                  onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))}
                  placeholder="MA"
                />
              </Field>
              <Field label={t.shipping.dialog.currency}>
                <TextInput value={form.currency} maxLength={3} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <Toggle checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label={t.shipping.dialog.shippingEnabled} />
              <span className="text-sm text-slate-700">{t.shipping.dialog.shippingEnabled}</span>
            </div>
            <Field label={t.shipping.dialog.flatRate}>
              <TextInput value={form.flatRateAmount} onChange={(e) => setForm((f) => ({ ...f, flatRateAmount: e.target.value }))} placeholder="0.00" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <NumField label={t.shipping.dialog.handlingMin} value={form.handlingMin} onChange={(v) => setForm((f) => ({ ...f, handlingMin: v }))} />
              <NumField label={t.shipping.dialog.handlingMax} value={form.handlingMax} onChange={(v) => setForm((f) => ({ ...f, handlingMax: v }))} />
              <NumField label={t.shipping.dialog.shippingMin} value={form.shippingMin} onChange={(v) => setForm((f) => ({ ...f, shippingMin: v }))} />
              <NumField label={t.shipping.dialog.shippingMax} value={form.shippingMax} onChange={(v) => setForm((f) => ({ ...f, shippingMax: v }))} />
              <NumField label={t.shipping.dialog.returnWindow} value={form.returnWindowDays} onChange={(v) => setForm((f) => ({ ...f, returnWindowDays: v }))} />
              <NumField label={t.shipping.dialog.refundProcessing} value={form.refundProcessingDays} onChange={(v) => setForm((f) => ({ ...f, refundProcessingDays: v }))} />
            </div>
            <InlineError message={save.error} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                {t.common.cancel}
              </Button>
              <Button
                variant="primary"
                loading={save.pending}
                onClick={async () => {
                  const ok = await save.run();
                  if (ok !== undefined) onSaved();
                }}
              >
                {t.common.save}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <TextInput type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}
