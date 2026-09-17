"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import type { AnalyticsPeriod, StoreAnalytics } from "@/lib/types";
import { formatMoney, formatMoneyCompact, formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBlock,
  Icon,
  PageHeader,
  StatCard,
  StatCardSkeleton,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Th,
} from "@/components/ui";

const PERIOD_TABS: { key: AnalyticsPeriod; label: string }[] = [
  { key: "7d", label: t.analytics.period.d7 },
  { key: "30d", label: t.analytics.period.d30 },
  { key: "all", label: t.analytics.period.all },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");

  const fetcher = useCallback(
    () => api.get<StoreAnalytics>("/api/admin/analytics", { period }),
    [period],
  );
  const { data, error, loading, reload } = useResource(fetcher);

  return (
    <div>
      <PageHeader
        title={t.analytics.title}
        description={t.analytics.subtitle}
        action={
          <Button size="sm" variant="secondary" onClick={reload} loading={loading && !!data}>
            <Icon.refresh className="h-3.5 w-3.5" /> {t.analytics.refresh}
          </Button>
        }
      />

      <div className="mb-3">
        <Tabs tabs={PERIOD_TABS} active={period} onChange={setPeriod} />
      </div>
      <p className="mb-4 text-xs text-slate-400">{t.analytics.periodNote}</p>

      {error && !data && <ErrorBlock message={t.analytics.loadError} onRetry={reload} />}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!data ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label={t.analytics.kpi.revenue}
              value={formatMoneyCompact(data.revenue)}
              sub={t.analytics.kpi.revenueHint}
            />
            <StatCard
              label={t.analytics.kpi.orders}
              value={formatNumber(data.orders.count)}
              sub={t.analytics.kpi.ordersHint}
              icon={<Icon.orders className="h-4 w-4" />}
            />
            <StatCard
              label={t.analytics.kpi.lowStock}
              value={formatNumber(data.lowStock.count)}
              sub={t.analytics.kpi.lowStockHint(data.lowStock.threshold)}
              tone={data.lowStock.count > 0 ? "warning" : undefined}
            />
            <StatCard
              label={t.analytics.kpi.pendingReviews}
              value={formatNumber(data.pendingReviews.count)}
              tone={data.pendingReviews.count > 0 ? "warning" : undefined}
              href="/reviews?status=pending"
              icon={<Icon.reviews className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Top products */}
      <div className="mt-6">
        <Card>
          <CardHeader title={t.analytics.topProducts.title} description={t.analytics.topProducts.subtitle} />
          {!data ? (
            <div className="p-4">
              <TableSkeleton rows={3} cols={3} />
            </div>
          ) : data.topProducts.length === 0 ? (
            <div className="p-2">
              <EmptyState title={t.analytics.topProducts.empty} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <Th>{t.analytics.topProducts.columns.product}</Th>
                  <Th className="text-right">{t.analytics.topProducts.columns.units}</Th>
                  <Th className="text-right">{t.analytics.topProducts.columns.revenue}</Th>
                </tr>
              }
            >
              {data.topProducts.map((p) => (
                <tr key={p.productId}>
                  <Td className="font-medium text-slate-800">
                    <Link href={`/products/${p.productId}`} className="hover:text-volt hover:underline">
                      {p.title}
                    </Link>
                  </Td>
                  <Td className="text-right tnum text-slate-600">{formatNumber(p.unitsSold)}</Td>
                  <Td className="text-right tnum text-slate-800">{formatMoney(p.revenue)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {/* Low stock — read-only */}
      <div className="mt-6">
        <Card>
          <CardHeader title={t.analytics.lowStock.title} description={t.analytics.lowStock.subtitle} />
          {!data ? (
            <div className="p-4">
              <TableSkeleton rows={3} cols={4} />
            </div>
          ) : data.lowStock.items.length === 0 ? (
            <div className="p-2">
              <EmptyState title={t.analytics.lowStock.empty} />
            </div>
          ) : (
            <>
              <Table
                head={
                  <tr>
                    <Th>{t.analytics.lowStock.columns.product}</Th>
                    <Th>{t.analytics.lowStock.columns.variant}</Th>
                    <Th>{t.analytics.lowStock.columns.sku}</Th>
                    <Th className="text-right">{t.analytics.lowStock.columns.stock}</Th>
                  </tr>
                }
              >
                {data.lowStock.items.map((v) => (
                  <tr key={v.variantId}>
                    <Td className="font-medium text-slate-800">
                      <Link href={`/products/${v.productId}`} className="hover:text-volt hover:underline">
                        {v.productTitle}
                      </Link>
                    </Td>
                    <Td className="text-slate-600">{v.variantTitle}</Td>
                    <Td className="text-slate-400">{v.sku ?? t.common.dash}</Td>
                    <Td className="text-right tnum font-medium text-amber-600">{formatNumber(v.stock)}</Td>
                  </tr>
                ))}
              </Table>
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                {t.analytics.lowStock.managedElsewhere}
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Pending reviews */}
      <div className="mt-6">
        <Card>
          <CardHeader
            title={t.analytics.pendingReviews.title}
            action={
              <Link href="/reviews?status=pending" className="text-xs font-semibold text-volt hover:underline">
                {t.analytics.pendingReviews.moderate}
              </Link>
            }
          />
          <div className="px-4 py-4 text-[13px] text-slate-600">
            {!data ? (
              <TableSkeleton rows={1} cols={1} />
            ) : data.pendingReviews.count === 0 ? (
              <EmptyState title={t.analytics.pendingReviews.empty} />
            ) : (
              t.analytics.pendingReviews.count(data.pendingReviews.count)
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
