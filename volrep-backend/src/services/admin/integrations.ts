import { env } from "../../config/env.js";
import { recordAudit } from "../../lib/audit.js";
import { db } from "../../db/client.js";
import { getLiryaClient, liryaConfigured, LiryaError } from "../../lib/lirya/index.js";
import { STORE_SETTINGS_ID } from "../../db/schema/index.js";
import type { AdminContext } from "./auth.js";

// Read-only view of the external systems Volrep talks to. Everything here
// is derived from server-side environment configuration — NO secret value
// is ever returned. The Lirya API key is reported only as "present / not
// present" plus a masked 4-character hint.

// "••••••1a2b" — never more than the last 4 characters, never for a key
// shorter than 8 (where 4 chars would leak half of it).
export function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  if (key.length < 8) return "••••••••";
  return `••••••${key.slice(-4)}`;
}

export type IntegrationsStatus = {
  lirya: {
    configured: boolean;
    apiBaseUrl: string | null;
    apiKeyPresent: boolean;
    apiKeyHint: string | null;
    adminBaseUrl: string | null;
    timeoutMs: number;
  };
  cod: {
    // COD operations live entirely in the separate COD system. Volrep
    // Admin never calls it; this is a placeholder for a future connection.
    status: "not_connected";
  };
};

export function getIntegrationsStatus(): IntegrationsStatus {
  return {
    lirya: {
      configured: liryaConfigured(),
      apiBaseUrl: env.LIRYA_API_BASE_URL ?? null,
      apiKeyPresent: Boolean(env.LIRYA_API_KEY),
      apiKeyHint: maskKey(env.LIRYA_API_KEY),
      adminBaseUrl: env.LIRYA_ADMIN_BASE_URL ?? null,
      timeoutMs: env.LIRYA_TIMEOUT_MS,
    },
    cod: { status: "not_connected" },
  };
}

export type LiryaTestResult =
  | { ok: true; pageCount: number; message: string }
  | { ok: false; code: string; message: string };

// Live connection check for Lirya. Uses the read-only `pages:read` scope
// (GET /api/v1/pages?limit=1) — no write, and the API key never leaves the
// server. Audited so a failing integration test is visible in the log.
export async function testLiryaConnection(admin: AdminContext): Promise<LiryaTestResult> {
  const client = getLiryaClient();

  let result: LiryaTestResult;
  if (!client) {
    result = {
      ok: false,
      code: "not_configured",
      message: "L'intégration Lirya n'est pas configurée sur le serveur.",
    };
  } else {
    try {
      const { pages } = await client.listPages({ limit: 1 });
      result = {
        ok: true,
        pageCount: pages.length,
        message: "Connexion à Lirya réussie.",
      };
    } catch (err) {
      const code = err instanceof LiryaError ? err.code : "unexpected";
      result = { ok: false, code, message: liryaErrorMessage(code) };
    }
  }

  await recordAudit(db, {
    adminUserId: admin.userId,
    action: "integration.lirya_test",
    entityType: "integration",
    entityId: STORE_SETTINGS_ID,
    metadata: { ok: result.ok, code: result.ok ? null : result.code },
  });

  return result;
}

function liryaErrorMessage(code: string): string {
  switch (code) {
    case "unauthorized":
      return "Clé API Lirya refusée (401). Vérifiez LIRYA_API_KEY.";
    case "forbidden":
      return "La clé API Lirya n'a pas la portée « pages:read » (403).";
    case "rate_limited":
      return "Lirya a limité les requêtes (429). Réessayez plus tard.";
    case "timeout":
      return "Délai dépassé en contactant Lirya.";
    case "network":
      return "Impossible de joindre Lirya (erreur réseau).";
    case "bad_gateway":
      return "Lirya a renvoyé une erreur serveur (5xx).";
    case "not_configured":
      return "L'intégration Lirya n'est pas configurée sur le serveur.";
    default:
      return "Échec inattendu de la connexion à Lirya.";
  }
}
