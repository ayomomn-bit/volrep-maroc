import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { requireInternalApiKey } from "../lib/internal-auth.js";
import { SlidingWindowCounter } from "../lib/abuse-guard.js";
import { normalizePhone } from "../lib/phone.js";
import { createCodOrder } from "../services/checkout.js";

const shippingAddressSchema = z
  .object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(120),
    // ISO 3166-1 alpha-2 — e.g. "MA". Validated as a plain 2-letter code
    // here; whether it's an actually-supported destination is a business
    // question answered by shipping_settings, not this schema.
    country: z.string().length(2),
    postalCode: z.string().max(20).optional(),
  })
  .strict();

// .strict(): no totalAmount, subtotal, or shippingAmount field exists
// here at all — the backend computes every figure server-side (§checkout.ts).
const checkoutBodySchema = z
  .object({
    cartId: z.string().uuid(),
    email: z.string().email(),
    phone: z.string().min(6).max(30),
    shippingAddress: shippingAddressSchema,
  })
  .strict();

export async function checkoutRoutes(app: FastifyInstance): Promise<void> {
  // Per-phone abuse guard — one instance per app (so it is fresh in every
  // test). Keyed by the canonical phone form, so "0612…", "+212612…" and
  // "00212612…" all count against the same customer. Short window: this
  // throttles order-spam, it does NOT permanently block a repeat buyer
  // (src/lib/abuse-guard.ts).
  const phoneGuard = new SlidingWindowCounter(
    env.COD_ORDER_PHONE_MAX,
    env.COD_ORDER_PHONE_WINDOW_MINUTES * 60_000,
  );

  app.post(
    "/api/checkout/session",
    {
      preHandler: requireInternalApiKey,
      // IP flood guard on top of the global 100/min baseline. Keyed by
      // request.ip, which is now spoof-safe (see trustProxy in src/app.ts)
      // and — for storefront traffic — carries the real shopper IP the
      // Next.js server forwards on COD calls. Generous by design: a real
      // Moroccan COD shopper places one or two orders; 20 order attempts
      // from one IP in 10 minutes is already clearly automated.
      //
      // `allowList: []` overrides the GLOBAL limiter's internal-key
      // allow-list (src/app.ts, Step 4 H1) so this per-route guard stays
      // effective for the internal caller — every COD request carries the
      // internal API key and would otherwise be exempted here too.
      config: {
        rateLimit: {
          max: env.COD_ORDER_IP_MAX,
          timeWindow: env.COD_ORDER_IP_TIME_WINDOW,
          allowList: [],
        },
      },
    },
    async (request, reply) => {
      const input = checkoutBodySchema.parse(request.body);

      // Abuse guard runs BEFORE createCodOrder so a flood never reaches the
      // transaction. It is not DB state, so it stays outside the tx — the
      // real duplicate-order / stock races are still handled by the
      // SELECT … FOR UPDATE inside createCodOrder (unchanged). No existing
      // price / subtotal / total / stock / availability validation is
      // touched: every figure is still computed server-side there.
      const verdict = phoneGuard.hit(normalizePhone(input.phone));
      if (verdict.limited) {
        reply.header("retry-after", String(verdict.retryAfterSeconds));
        throw new AppError(
          429,
          "TOO_MANY_ORDERS",
          "Trop de commandes ont été passées avec ce numéro récemment. Merci de réessayer plus tard.",
        );
      }

      const order = await createCodOrder(input);
      reply.status(201);
      // No `redirectUrl` — COD completes synchronously, there's nowhere to
      // redirect to. See the frontend migration mapping (§ Phase 4 report)
      // for how this differs from a future card-provider response.
      return { order };
    },
  );
}
