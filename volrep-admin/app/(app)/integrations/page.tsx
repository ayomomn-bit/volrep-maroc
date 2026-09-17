"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/hooks";
import { can } from "@/lib/rbac";
import { COD_SYSTEM_URL } from "@/lib/config";
import type { IntegrationsStatus, LiryaTestResult } from "@/lib/types";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/Icons";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorBlock,
  InlineError,
  LoadingBlock,
  PageHeader,
  StatusPill,
} from "@/components/ui";

export default function IntegrationsPage() {
  const { state } = useAuth();
  const role = state.status === "authenticated" ? state.admin.role : undefined;
  const canTest = can(role, "integrations.test");

  const fetcher = useCallback(() => api.get<IntegrationsStatus>("/api/admin/integrations"), []);
  const { data, error, loading, reload } = useResource(fetcher);

  return (
    <div>
      <PageHeader title={t.integrations.title} description={t.integrations.subtitle} />

      <p className="mb-4 text-xs text-slate-400">{t.integrations.serverConfigNote}</p>

      {loading && !data && <LoadingBlock />}
      {error && <ErrorBlock message={t.integrations.loadError} onRetry={reload} />}

      {data && (
        <div className="max-w-2xl space-y-5">
          <LiryaCard status={data.lirya} canTest={canTest} />
          <CodCard status={data.cod} />
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-[13px] last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{children}</span>
    </div>
  );
}

function LiryaCard({ status, canTest }: { status: IntegrationsStatus["lirya"]; canTest: boolean }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<LiryaTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function runTest() {
    setTesting(true);
    setResult(null);
    setTestError(null);
    try {
      const res = await api.post<LiryaTestResult>("/api/admin/integrations/lirya/test");
      setResult(res);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : t.common.actionFailed);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={t.integrations.lirya.title}
        action={
          status.configured ? (
            <StatusPill tone="success">{t.integrations.statusConfigured}</StatusPill>
          ) : (
            <StatusPill tone="neutral">{t.integrations.statusNotConfigured}</StatusPill>
          )
        }
      />
      <CardBody className="space-y-3">
        <p className="text-xs text-slate-500">{t.integrations.lirya.description}</p>

        <div>
          <Row label={t.integrations.lirya.apiUrl}>{status.apiBaseUrl ?? t.integrations.lirya.notSet}</Row>
          <Row label={t.integrations.lirya.apiKey}>
            {status.apiKeyPresent ? (
              <span className="inline-flex items-center gap-2">
                <StatusPill tone="success">{t.integrations.lirya.apiKeyPresent}</StatusPill>
                {status.apiKeyHint && <code className="text-xs text-slate-400">{status.apiKeyHint}</code>}
              </span>
            ) : (
              <StatusPill tone="warning">{t.integrations.lirya.apiKeyMissing}</StatusPill>
            )}
          </Row>
          <Row label={t.integrations.lirya.adminUrl}>{status.adminBaseUrl ?? t.integrations.lirya.notSet}</Row>
        </div>

        <p className="text-xs text-slate-400">{t.integrations.lirya.keyNeverShown}</p>

        {!status.configured && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-inset ring-amber-200">
            {t.integrations.lirya.notConfiguredHint}
          </p>
        )}

        {canTest && status.configured && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <Button variant="secondary" loading={testing} onClick={runTest}>
              {testing ? t.integrations.lirya.testing : t.integrations.lirya.testButton}
            </Button>
            <InlineError message={testError} />
            {result?.ok && (
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
                <Icon.check className="h-4 w-4" />
                {t.integrations.lirya.testOk(result.pageCount)}
              </p>
            )}
            {result && !result.ok && (
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                <Icon.alert className="h-4 w-4" />
                {t.integrations.lirya.testFailed} — {result.message}
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

const COD_STATUS_LABEL: Record<IntegrationsStatus["cod"]["status"], string> = {
  not_connected: t.integrations.statusNotConnected,
};

function CodCard({ status }: { status: IntegrationsStatus["cod"] }) {
  const url = COD_SYSTEM_URL || null;
  return (
    <Card>
      <CardHeader
        title={t.integrations.cod.title}
        action={<StatusPill tone="neutral">{COD_STATUS_LABEL[status.status]}</StatusPill>}
      />
      <CardBody className="space-y-3">
        <p className="text-xs text-slate-500">{t.integrations.cod.description}</p>
        <div>
          <Row label={t.integrations.cod.systemUrl}>{url ?? t.integrations.lirya.notSet}</Row>
        </div>
        {!url && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
            {t.integrations.cod.notConfiguredHint}
          </p>
        )}
        <p className="text-xs text-slate-400">{t.integrations.cod.futureNote}</p>
      </CardBody>
    </Card>
  );
}
