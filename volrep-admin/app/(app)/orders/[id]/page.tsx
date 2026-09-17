"use client";

import { use, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import type { OrderDetail } from "@/lib/types";
import { formatDate, formatMoney, orderStatusTone, paymentStatusTone } from "@/lib/format";
import { t, orderStatusLabel, paymentStatusLabel, paymentProviderLabel } from "@/lib/i18n";
import { codOrderUrl } from "@/lib/config";
import {
  Badge,
  Card,
  CardHeader,
  ErrorBlock,
  Icon,
  LoadingBlock,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";

// Read-only store-context view. Volrep Admin does not run COD operations —
// order confirmation, fulfilment, delivery and customer follow-up live in
// the separate COD system, which this screen links out to. The backend
// order-mutation endpoints still exist but are not called from here.
export default function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = use(params);
  const fetcher = useCallback(() => api.get<{ order: OrderDetail }>(`/api/admin/orders/${id}`).then((r) => r.order), [id]);
  const { data: order, error, loading, reload } = useResource(fetcher);

  if (loading && !order) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!order) return null;

  const codUrl = codOrderUrl(order.orderNumber);

  return (
    <div>
      <PageHeader
        title={t.orders.detail.title(order.orderNumber)}
        description={t.orders.detail.placedOn(formatDate(order.createdAt))}
        action={
          <Link href="/orders" className="text-sm text-slate-500 hover:underline">
            {t.orders.detail.backToList}
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title={t.orders.detail.lineItems} />
            <Table
              head={
                <tr>
                  <Th>{t.orders.detail.colProduct}</Th>
                  <Th className="text-right">{t.orders.detail.colQty}</Th>
                  <Th className="text-right">{t.orders.detail.colUnit}</Th>
                  <Th className="text-right">{t.orders.detail.colTotal}</Th>
                </tr>
              }
            >
              {order.lineItems.map((li) => (
                <tr key={li.id}>
                  <Td>
                    <div className="font-medium text-slate-800">{li.productTitle}</div>
                    <div className="text-xs text-slate-400">
                      {li.variantTitle}
                      {li.sku ? ` · ${li.sku}` : ""}
                    </div>
                  </Td>
                  <Td className="text-right">{li.quantity}</Td>
                  <Td className="text-right">{formatMoney(li.unitPrice)}</Td>
                  <Td className="text-right font-medium">{formatMoney(li.lineTotal)}</Td>
                </tr>
              ))}
            </Table>
            <div className="space-y-1 px-4 py-3 text-sm">
              <Row label={t.orders.detail.subtotal} value={formatMoney(order.amounts.subtotal)} />
              <Row label={t.orders.detail.shipping} value={formatMoney(order.amounts.shipping)} />
              {Number(order.amounts.discount.amount) > 0 && <Row label={t.orders.detail.discount} value={`− ${formatMoney(order.amounts.discount)}`} />}
              <Row label={t.orders.detail.total} value={formatMoney(order.amounts.total)} strong />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title={t.orders.cod.title} />
            <div className="space-y-3 px-4 py-3 text-sm">
              <p className="text-slate-600">{t.orders.cod.body}</p>
              {codUrl ? (
                <a
                  href={codUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-volt px-3 text-[13px] font-medium text-white shadow-sm hover:bg-volt-deep"
                >
                  {t.orders.cod.cta}
                  <Icon.external className="h-3.5 w-3.5" />
                </a>
              ) : (
                <>
                  <span className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-1.5 rounded-md bg-slate-100 px-3 text-[13px] font-medium text-slate-400 ring-1 ring-inset ring-slate-200">
                    {t.orders.cod.cta}
                    <Icon.external className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs text-slate-400">{t.orders.cod.notConfigured}</p>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={t.orders.detail.currentStatus} />
            <dl className="space-y-2 px-4 py-3 text-sm">
              <Row
                label={t.orders.detail.status}
                value={<Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>}
              />
              <p className="text-xs text-slate-400">{t.orders.detail.statusReadOnly}</p>
            </dl>
          </Card>

          <Card>
            <CardHeader title={t.orders.detail.customer} />
            <dl className="space-y-2 px-4 py-3 text-sm">
              <Row label={t.orders.detail.email} value={order.customer.email} />
              <Row label={t.orders.detail.phone} value={order.customer.phone} />
            </dl>
          </Card>

          <Card>
            <CardHeader title={t.orders.detail.shippingAddress} />
            <pre className="whitespace-pre-wrap px-4 py-3 text-sm text-slate-700">{formatAddress(order.shippingAddress)}</pre>
          </Card>

          <Card>
            <CardHeader title={t.orders.detail.payment} />
            <dl className="space-y-2 px-4 py-3 text-sm">
              <Row label={t.orders.detail.method} value={paymentProviderLabel(order.payment.provider)} />
              <Row
                label={t.orders.detail.status}
                value={<Badge tone={paymentStatusTone(order.paymentStatus)}>{paymentStatusLabel(order.paymentStatus)}</Badge>}
              />
              <Row label={t.orders.detail.paidAt} value={order.payment.paidAt ? formatDate(order.payment.paidAt) : "—"} />
              <Row label={t.orders.detail.reference} value={order.payment.reference ?? "—"} />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? "font-semibold text-slate-900" : "text-slate-800"}>{value}</dd>
    </div>
  );
}

function formatAddress(addr: Record<string, unknown>): string {
  const parts = ["line1", "line2", "city", "postalCode", "country"]
    .map((k) => addr[k])
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  return parts.length ? parts.join("\n") : JSON.stringify(addr, null, 2);
}
