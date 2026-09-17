"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import type { AdminReview, DashboardSummary, OrderSummary, Paginated } from "@/lib/types";
import {
  formatDateShort,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatRelative,
  orderStatusTone,
  paymentStatusTone,
} from "@/lib/format";
import { t, orderStatusLabel, paymentStatusLabel } from "@/lib/i18n";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorBlock,
  Icon,
  StatCard,
  StatCardSkeleton,
  StatusPill,
  TableSkeleton,
  PageHeader,
  type Column,
} from "@/components/ui";

const ATTENTION_STATUSES = new Set(["pending_payment", "paid", "partially_fulfilled"]);

export default function DashboardPage() {
  const router = useRouter();
  const summaryFetcher = useCallback(() => api.get<DashboardSummary>("/api/admin/dashboard"), []);
  const { data, error, loading, reload } = useResource(summaryFetcher);

  const reviewsFetcher = useCallback(
    () => api.get<Paginated<"reviews", AdminReview>>("/api/admin/reviews", { status: "pending", limit: 4 }),
    [],
  );
  const reviews = useResource(reviewsFetcher);

  const orderColumns: Column<OrderSummary>[] = [
    {
      key: "order",
      header: t.orders.columns.order,
      cell: (o) => (
        <span className="font-medium text-slate-900">
          {o.orderNumber}
          <span className="ml-2 text-xs font-normal text-slate-400">{t.orders.itemCount(o.itemCount)}</span>
        </span>
      ),
    },
    {
      key: "customer",
      header: t.orders.columns.customer,
      cell: (o) => (
        <div className="min-w-0">
          <div className="truncate text-slate-700">{o.email}</div>
          <div className="text-xs text-slate-400">{o.phone}</div>
        </div>
      ),
    },
    { key: "total", header: t.orders.columns.total, align: "right", cell: (o) => <span className="tnum">{formatMoney(o.total)}</span> },
    {
      key: "payment",
      header: t.orders.columns.payment,
      cell: (o) => <Badge tone={paymentStatusTone(o.paymentStatus)}>{paymentStatusLabel(o.paymentStatus)}</Badge>,
    },
    {
      key: "status",
      header: t.orders.columns.status,
      cell: (o) => <StatusPill tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</StatusPill>,
    },
    {
      key: "date",
      header: t.orders.columns.date,
      align: "right",
      cell: (o) => <span className="whitespace-nowrap text-slate-400">{formatDateShort(o.createdAt)}</span>,
    },
  ];

  const attention = (data?.recentOrders ?? []).filter((o) => ATTENTION_STATUSES.has(o.status));

  return (
    <div>
      <PageHeader
        title={t.dashboard.title}
        description={t.dashboard.subtitle}
        action={
          <Button size="sm" variant="secondary" onClick={reload} loading={loading && !!data}>
            <Icon.refresh className="h-3.5 w-3.5" /> {t.dashboard.refresh}
          </Button>
        }
      />

      {error && !data && <ErrorBlock message={error} onRetry={reload} />}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {!data
          ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
          : (
            <>
              <StatCard label={t.dashboard.stat.ordersToday} value={formatNumber(data.orders.today)} href="/orders" icon={<Icon.orders className="h-4 w-4" />} />
              <StatCard
                label={t.dashboard.stat.pendingPayment}
                value={formatNumber(data.orders.pendingPayment)}
                sub={t.dashboard.stat.cashOnDelivery}
                tone={data.orders.pendingPayment > 0 ? "warning" : undefined}
                href="/orders?status=pending_payment"
              />
              <StatCard
                label={t.dashboard.stat.processing}
                value={formatNumber(data.orders.processing)}
                sub={t.dashboard.stat.paidNotShipped}
                href="/orders?status=paid"
              />
              <StatCard label={t.dashboard.stat.fulfilled} value={formatNumber(data.orders.fulfilled)} href="/orders?status=fulfilled" />
              <StatCard
                label={t.dashboard.stat.revenue30d}
                value={formatMoneyCompact({ amount: data.revenue.last30Days, currencyCode: data.revenue.currencyCode })}
                sub={t.dashboard.stat.todaySuffix(
                  formatMoneyCompact({ amount: data.revenue.today, currencyCode: data.revenue.currencyCode }),
                )}
              />
              <StatCard
                label={t.dashboard.stat.pendingReviews}
                value={formatNumber(data.reviews.pending)}
                tone={data.reviews.pending > 0 ? "warning" : undefined}
                href="/reviews?status=pending"
                icon={<Icon.reviews className="h-4 w-4" />}
              />
            </>
          )}
      </div>

      {/* Needs attention */}
      <div className="mt-6">
        <Card>
          <CardHeader
            title={t.dashboard.attention.title}
            description={
              data
                ? t.dashboard.attention.summary(
                    formatNumber(data.orders.pendingPayment),
                    formatNumber(data.orders.processing),
                  )
                : undefined
            }
            action={
              <Link href="/orders?status=pending_payment" className="text-xs font-semibold text-volt hover:underline">
                {t.dashboard.attention.viewAll}
              </Link>
            }
          />
          {!data ? (
            <div className="p-4">
              <TableSkeleton rows={3} cols={4} />
            </div>
          ) : attention.length === 0 ? (
            <div className="p-2">
              <EmptyState title={t.dashboard.attention.emptyTitle} hint={t.dashboard.attention.emptyHint} />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.slice(0, 6).map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="flex items-center gap-4 px-4 py-2.5 hover:bg-slate-50">
                    <span className="w-14 shrink-0 font-medium text-slate-900">{o.orderNumber}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600">{o.email}</span>
                    <span className="tnum w-28 shrink-0 text-right text-[13px] text-slate-700">{formatMoney(o.total)}</span>
                    <span className="hidden w-44 shrink-0 sm:block">
                      <Badge tone={o.status === "pending_payment" ? "warning" : "info"}>
                        {o.status === "pending_payment"
                          ? t.dashboard.attention.awaitingCod
                          : t.dashboard.attention.needsFulfilment}
                      </Badge>
                    </span>
                    <span className="hidden w-16 shrink-0 text-right text-xs text-slate-400 md:block">
                      {formatRelative(o.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent orders */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-slate-800">{t.dashboard.recentOrders.title}</h2>
          <Link href="/orders" className="text-xs font-semibold text-volt hover:underline">
            {t.dashboard.recentOrders.viewAll}
          </Link>
        </div>
        <DataTable
          columns={orderColumns}
          rows={data?.recentOrders}
          getRowKey={(o) => o.id}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(o) => router.push(`/orders/${o.id}`)}
          empty={{ title: t.dashboard.recentOrders.empty }}
          skeletonRows={6}
          minWidth="min-w-[640px]"
        />
      </div>

      {/* Pending reviews */}
      <div className="mt-6">
        <Card>
          <CardHeader
            title={t.dashboard.pendingReviews.title}
            action={
              <Link href="/reviews?status=pending" className="text-xs font-semibold text-volt hover:underline">
                {t.dashboard.pendingReviews.moderate}
              </Link>
            }
          />
          {reviews.loading && !reviews.data ? (
            <div className="p-4">
              <TableSkeleton rows={3} cols={2} />
            </div>
          ) : !reviews.data || reviews.data.reviews.length === 0 ? (
            <div className="p-2">
              <EmptyState title={t.dashboard.pendingReviews.empty} />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {reviews.data.reviews.map((r) => (
                <li key={r.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-slate-800">{r.author}</span>
                    <span className="text-amber-500">
                      {"★".repeat(r.rating)}
                      <span className="text-slate-200">{"★".repeat(5 - r.rating)}</span>
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
