"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import type { AuditEntry } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { t, auditEntityLabel } from "@/lib/i18n";
import { EmptyState, ErrorBlock, Field, LoadingBlock, PageHeader, Pagination, Select, Table, Td, Th } from "@/components/ui";

const ENTITY_TYPES = ["admin_user", "product", "product_variant", "order", "fulfillment", "review", "shipping_settings"];
const LIMIT = 50;

function AuditView() {
  const router = useRouter();
  const params = useSearchParams();
  const entityType = params.get("entityType") ?? "";
  const offset = Number(params.get("offset") ?? 0) || 0;

  const fetcher = useCallback(
    () =>
      api.get<{ entries: AuditEntry[]; total: number; limit: number; offset: number }>("/api/admin/audit-log", {
        entityType: entityType || undefined,
        limit: LIMIT,
        offset,
      }),
    [entityType, offset],
  );
  const { data, error, loading, reload } = useResource(fetcher);

  function setParam(key: string, value: string | number | undefined) {
    const sp = new URLSearchParams(params.toString());
    if (value === undefined || value === "") sp.delete(key);
    else sp.set(key, String(value));
    if (key !== "offset") sp.delete("offset");
    router.push(`/audit-log?${sp.toString()}`);
  }

  return (
    <div>
      <PageHeader title={t.auditLog.title} description={t.auditLog.subtitle} />

      <div className="mb-4 w-56">
        <Field label={t.auditLog.entityType}>
          <Select value={entityType} onChange={(e) => setParam("entityType", e.target.value || undefined)}>
            <option value="">{t.common.all}</option>
            {ENTITY_TYPES.map((et) => (
              <option key={et} value={et}>
                {auditEntityLabel(et)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {loading && !data && <LoadingBlock />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && (data.entries.length === 0 ? (
        <EmptyState title={t.auditLog.empty} />
      ) : (
        <>
          <Table
            head={
              <tr>
                <Th>{t.auditLog.columns.when}</Th>
                <Th>{t.auditLog.columns.admin}</Th>
                <Th>{t.auditLog.columns.action}</Th>
                <Th>{t.auditLog.columns.entity}</Th>
                <Th>{t.auditLog.columns.details}</Th>
              </tr>
            }
          >
            {data.entries.map((e) => (
              <tr key={e.id} className="align-top">
                <Td className="whitespace-nowrap text-slate-500">{formatDate(e.createdAt)}</Td>
                <Td className="whitespace-nowrap text-slate-500">{e.adminUserId ? `${e.adminUserId.slice(0, 8)}…` : "—"}</Td>
                <Td className="whitespace-nowrap font-medium text-slate-800">{e.action}</Td>
                <Td className="whitespace-nowrap text-slate-600">
                  {auditEntityLabel(e.entityType)}
                  <div className="text-xs text-slate-400">{e.entityId.slice(0, 8)}…</div>
                </Td>
                <Td>
                  <pre className="max-w-md overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-xs text-slate-600">
                    {e.metadata ? JSON.stringify(e.metadata, null, 1) : "—"}
                  </pre>
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={(o) => setParam("offset", o)} />
        </>
      ))}
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <AuditView />
    </Suspense>
  );
}
