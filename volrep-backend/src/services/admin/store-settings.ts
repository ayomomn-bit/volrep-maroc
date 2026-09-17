import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { storeSettings, STORE_SETTINGS_ID } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapStoreSettings } from "../../mappers/admin.js";
import type { AdminContext } from "./auth.js";

type Row = typeof storeSettings.$inferSelect;

// Very small, forgiving URL check for the social links: allow empty, or an
// http(s) URL. The storefront renders these as anchor hrefs, so anything
// that is not empty must be a real absolute URL.
const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadOrCreateRow(): Promise<Row> {
  const [existing] = await db.select().from(storeSettings).where(eq(storeSettings.id, STORE_SETTINGS_ID)).limit(1);
  if (existing) return existing;

  // First read ever — materialise the single row from column defaults.
  // ON CONFLICT DO NOTHING guards the (unlikely) concurrent create.
  await db.insert(storeSettings).values({ id: STORE_SETTINGS_ID }).onConflictDoNothing();
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, STORE_SETTINGS_ID)).limit(1);
  if (!row) throw new Error("store_settings singleton row missing after create");
  return row;
}

export async function getStoreSettings() {
  return mapStoreSettings(await loadOrCreateRow());
}

export type StoreSettingsInput = {
  storeName?: string | undefined;
  tagline?: string | undefined;
  supportEmail?: string | undefined;
  socialInstagram?: string | undefined;
  socialTiktok?: string | undefined;
  socialYoutube?: string | undefined;
};

const SOCIAL_KEYS = ["socialInstagram", "socialTiktok", "socialYoutube"] as const;

export async function updateStoreSettings(admin: AdminContext, input: StoreSettingsInput) {
  const patch: Partial<Row> = {};

  if (input.storeName !== undefined) {
    const name = input.storeName.trim();
    if (name.length === 0 || name.length > 120) {
      throw AppError.badRequest("Le nom de la boutique doit contenir entre 1 et 120 caractères.");
    }
    patch.storeName = name;
  }

  if (input.tagline !== undefined) {
    const tagline = input.tagline.trim();
    if (tagline.length > 200) throw AppError.badRequest("La tagline ne peut pas dépasser 200 caractères.");
    patch.tagline = tagline;
  }

  if (input.supportEmail !== undefined) {
    const email = input.supportEmail.trim();
    if (email.length > 0 && !EMAIL_RE.test(email)) {
      throw AppError.badRequest("L'adresse e-mail de support n'est pas valide.");
    }
    patch.supportEmail = email;
  }

  for (const key of SOCIAL_KEYS) {
    const value = input[key];
    if (value === undefined) continue;
    const url = value.trim();
    if (url.length > 0 && !HTTP_URL_RE.test(url)) {
      throw AppError.badRequest("Les liens des réseaux sociaux doivent être des URL http(s) complètes.");
    }
    patch[key] = url;
  }

  if (Object.keys(patch).length === 0) {
    throw AppError.badRequest("Aucune modification fournie.");
  }

  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(storeSettings).where(eq(storeSettings.id, STORE_SETTINGS_ID)).limit(1);
    if (!before) {
      await tx.insert(storeSettings).values({ id: STORE_SETTINGS_ID }).onConflictDoNothing();
    }

    const [row] = await tx
      .update(storeSettings)
      .set({ ...patch, updatedAt: new Date(), updatedBy: admin.userId })
      .where(eq(storeSettings.id, STORE_SETTINGS_ID))
      .returning();
    if (!row) throw new Error("store_settings update returned no row");

    const changedKeys = Object.keys(patch);
    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "store_settings.update",
      entityType: "store_settings",
      entityId: STORE_SETTINGS_ID,
      metadata: {
        fields: changedKeys,
        before: before ? mapStoreSettings(before) : null,
        after: mapStoreSettings(row),
      },
    });

    return mapStoreSettings(row);
  });
}
