import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalApiKey } from "../lib/internal-auth.js";
import { trackOrder } from "../services/orders.js";

// Our own order numbers are a plain integer sequence (Architecture §03),
// so this is tighter than the original Shopify-era pattern that allowed
// arbitrary alphanumeric "names" — digits only, optional leading "#".
const trackQuerySchema = z
  .object({
    orderNumber: z.string().regex(/^#?[0-9]{1,10}$/),
    email: z.string().email(),
  })
  .strict();

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/orders/track",
    {
      preHandler: requireInternalApiKey,
      // Stricter than the global baseline — matches the original
      // frontend's brute-force guard (8 attempts / 10 minutes per IP),
      // now enforced by the framework instead of an in-memory Map. Keyed
      // by request.ip, which — for storefront traffic — carries the real
      // customer IP the Next.js server now forwards on tracking calls
      // (security hardening — Step 4 H2), exactly like the COD path.
      //
      // `allowList: []` overrides the GLOBAL limiter's internal-key
      // allow-list (src/app.ts, Step 4 H1): this route carries the internal
      // API key and would otherwise be exempted from its own guard too.
      config: { rateLimit: { max: 8, timeWindow: "10 minutes", allowList: [] } },
    },
    async (request) => {
      const { orderNumber, email } = trackQuerySchema.parse(request.query);
      return trackOrder(orderNumber, email);
    },
  );
}
