import { boolean, integer, numeric, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

// One config row per shipping country — flat-rate only, no carrier
// rate-shopping (Architecture §10). Business rules default to what the
// user specified: 1-2 day handling, 7-12 day shipping, 7-day returns,
// free return shipping, 7-day refund processing. The exact "Big 4"
// country list is still open (Architecture §17) — no rows are seeded for
// specific countries until that's confirmed.
export const shippingSettings = pgTable(
  "shipping_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryCode: text("country_code").notNull(),
    handlingTimeMinDays: integer("handling_time_min_days").notNull().default(1),
    handlingTimeMaxDays: integer("handling_time_max_days").notNull().default(2),
    shippingTimeMinDays: integer("shipping_time_min_days").notNull().default(7),
    shippingTimeMaxDays: integer("shipping_time_max_days").notNull().default(12),
    flatRateAmount: numeric("flat_rate_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    currency: text("currency").notNull().default("MAD"),
    returnWindowDays: integer("return_window_days").notNull().default(7),
    returnShippingFree: boolean("return_shipping_free").notNull().default(true),
    refundProcessingDays: integer("refund_processing_days").notNull().default(7),
    active: boolean("active").notNull().default(true),
  },
  (table) => ({
    countryCodeUnique: unique("shipping_settings_country_code_unique").on(table.countryCode),
  }),
);
