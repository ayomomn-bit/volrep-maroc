"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import type { OrderStatus, OrderSummary, Paginated } from "@/lib/types";
import { formatDateShort, formatMoney, orderStatusTone, paymentStatusTone } from "@/lib/format";
import { t, orderStatusLabel, paymentStatusLabel } from "@/lib/i18n";
import { Badge, Button, EmptyState, ErrorBlock, Field, LoadingBlock, PageHeader, Pagination, Select, Table, Td, TextInput, Th } from "@/components/ui";

const STATUSES: OrderStatus[] = [
  "pending_payment",
  "paid",
  "fulfilled",
  "partially_fulfilled",
  "canceled",
  "refunded",
  "partially_refunded",
];
const LIMIT = 25;

function OrdersView() {
  const router = useRouter();
  const params = useSearchParams();

  const status = params.get("status") ?? "";
  const orderNumber = params.get("orderNumber") ?? "";
  const email = params.get("email") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const offset = Number(params.get("offset") ?? 0) || 0;

  // Local form state so typing doesn't fire a request per keystroke.
  const [form, setForm] = useState({ orderNumber, email, from, to });

  const setParams = useCallback(
    (next: Record<string, string | number | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined || v === "") sp.delete(k);
        else sp.set(k, String(v));
      }
      router.push(`/orders?${sp.toString()}`);
    },
    [params, router],
  );

  const fetcher = useCallback(
    () =>
      api.get<Paginated<"orders", OrderSummary>>("/api/admin/orders", {
        status: status || undefined,
        orderNumber: orderNumber || undefined,
        email: email || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        limit: LIMIT,
        offset,
      }),
    [status, orderNumber, email, from, to, offset],
  );
  const { data, error, loading, reload } = useResource(fetcher);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setParams({ ...form, offset: 0 });
  }
  function clearFilters() {
    setForm({ orderNumber: "", email: "", from: "", to: "" });
    router.push("/orders");
  }

  return (
    <div>
      <PageHeader title={t.orders.title} description={t.orders.subtitle} />

      <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
        {t.orders.readOnlyNotice}
      </p>

      <form onSubmit={applyFilters} className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label={t.orders.filters.status}>
          <Select value={status} onChange={(e) => setParams({ status: e.target.value || undefined, offset: 0 })}>
            <option value="">{t.common.any}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.orders.filters.orderNumber}>
          <TextInput
            placeholder={t.orders.filters.orderNumberPlaceholder}
            value={form.orderNumber}
            onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
          />
        </Field>
        <Field label={t.orders.filters.email}>
          <TextInput
            type="email"
            placeholder={t.orders.filters.emailPlaceholder}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </Field>
        <Field label={t.orders.filters.from}>
          <TextInput type="date" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} />
        </Field>
        <Field label={t.orders.filters.to}>
          <TextInput type="date" value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} />
        </Field>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" variant="primary">
            {t.orders.filters.apply}
          </Button>
          <Button type="button" variant="ghost" onClick={clearFilters}>
            {t.orders.filters.clear}
          </Button>
        </div>
      </form>

      {loading && !data && <LoadingBlock />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && (data.orders.length === 0 ? (
        <EmptyState title={t.orders.emptyFiltered} />
      ) : (
        <>
          <Table
            head={
              <tr>
                <Th>{t.orders.columns.order}</Th>
                <Th>{t.orders.columns.customer}</Th>
                <Th>{t.orders.columns.status}</Th>
                <Th>{t.orders.columns.payment}</Th>
                <Th className="text-right">{t.orders.columns.total}</Th>
                <Th>{t.orders.columns.date}</Th>
              </tr>
            }
          >
            {data.orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/orders/${o.id}`} className="font-medium text-volt hover:underline">
                    {o.orderNumber}
                  </Link>
                  <span className="ml-2 text-xs text-slate-400">{t.orders.itemCount(o.itemCount)}</span>
                </Td>
                <Td>
                  <div className="text-slate-800">{o.email}</div>
                  <div className="text-xs text-slate-400">{o.phone}</div>
                </Td>
                <Td>
                  <Badge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Badge>
                </Td>
                <Td>
                  <Badge tone={paymentStatusTone(o.paymentStatus)}>{paymentStatusLabel(o.paymentStatus)}</Badge>
                </Td>
                <Td className="text-right font-medium">{formatMoney(o.total)}</Td>
                <Td className="text-slate-500">{formatDateShort(o.createdAt)}</Td>
              </tr>
            ))}
          </Table>
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={(o) => setParams({ offset: o })} />
        </>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <OrdersView />
    </Suspense>
  );
}
