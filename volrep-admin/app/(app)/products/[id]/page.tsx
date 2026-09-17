"use client";

import { use, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/hooks";
import type { ProductStudio as ProductStudioData } from "@/lib/types";
import { formatDate, productStatusTone } from "@/lib/format";
import { t, productStatusLabel } from "@/lib/i18n";
import { Badge, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui";
import { ProductStudio } from "@/components/products/editor/ProductStudio";

export default function ProductStudioPage({ params }: PageProps<"/products/[id]">) {
  const { id } = use(params);
  const fetcher = useCallback(() => api.get<ProductStudioData>(`/api/admin/products/${id}/studio`), [id]);
  const { data: studio, error, loading, reload } = useResource(fetcher);
  const { state } = useAuth();
  const role = state.status === "authenticated" ? state.admin.role : undefined;

  if (loading && !studio) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!studio) return null;

  const { product } = studio;

  return (
    <div>
      <PageHeader
        title={product.title}
        description={t.products.detail.meta(product.handle, formatDate(product.updatedAt))}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={productStatusTone(product.status)}>{productStatusLabel(product.status)}</Badge>
            <Link href="/products" className="text-sm text-slate-500 hover:underline">
              {t.products.detail.backToList}
            </Link>
          </div>
        }
      />

      <ProductStudio studio={studio} role={role} onSaved={reload} />
    </div>
  );
}
