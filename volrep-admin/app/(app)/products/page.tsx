"use client";

import { Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/hooks";
import { can } from "@/lib/rbac";
import type { Paginated, ProductStatus, ProductSummary } from "@/lib/types";
import { formatDateShort, productStatusTone } from "@/lib/format";
import { t, productStatusLabel } from "@/lib/i18n";
import { Badge, Button, EmptyState, ErrorBlock, Field, LoadingBlock, PageHeader, Pagination, Select, Table, Td, Th } from "@/components/ui";

const STATUSES: ProductStatus[] = ["draft", "active", "archived"];
const LIMIT = 25;

function ProductsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useAuth();
  const role = state.status === "authenticated" ? state.admin.role : undefined;

  const status = params.get("status") ?? "";
  const offset = Number(params.get("offset") ?? 0) || 0;

  const fetcher = useCallback(
    () =>
      api.get<Paginated<"products", ProductSummary>>("/api/admin/products", {
        status: status || undefined,
        limit: LIMIT,
        offset,
      }),
    [status, offset],
  );
  const { data, error, loading, reload } = useResource(fetcher);

  function setParam(key: string, value: string | number | undefined) {
    const sp = new URLSearchParams(params.toString());
    if (value === undefined || value === "") sp.delete(key);
    else sp.set(key, String(value));
    if (key !== "offset") sp.delete("offset");
    router.push(`/products?${sp.toString()}`);
  }

  return (
    <div>
      <PageHeader
        title={t.products.title}
        description={t.products.subtitle}
        action={
          can(role, "product.create") ? (
            <Link href="/products/new">
              <Button variant="primary">{t.products.newProduct}</Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-4 w-full max-w-xs">
        <Field label={t.products.filterStatus}>
          <Select value={status} onChange={(e) => setParam("status", e.target.value || undefined)}>
            <option value="">{t.common.any}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {productStatusLabel(s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {loading && !data && <LoadingBlock />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && (data.products.length === 0 ? (
        <EmptyState title={t.products.emptyTitle} hint={can(role, "product.create") ? t.products.emptyHintCanCreate : undefined} />
      ) : (
        <>
          <Table
            head={
              <tr>
                <Th>{t.products.columns.product}</Th>
                <Th>{t.products.columns.status}</Th>
                <Th className="text-right">{t.products.columns.variants}</Th>
                <Th>{t.products.columns.type}</Th>
                <Th>{t.products.columns.updated}</Th>
              </tr>
            }
          >
            {data.products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/products/${p.id}`} className="font-medium text-volt hover:underline">
                    {p.title}
                  </Link>
                  <div className="text-xs text-slate-400">/{p.handle}</div>
                </Td>
                <Td>
                  <Badge tone={productStatusTone(p.status)}>{productStatusLabel(p.status)}</Badge>
                </Td>
                <Td className="text-right">{p.variantCount}</Td>
                <Td className="text-slate-500">{p.productType || "—"}</Td>
                <Td className="text-slate-500">{formatDateShort(p.updatedAt)}</Td>
              </tr>
            ))}
          </Table>
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={(o) => setParam("offset", o)} />
        </>
      ))}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ProductsView />
    </Suspense>
  );
}
