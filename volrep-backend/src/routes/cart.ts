import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireInternalApiKey } from "../lib/internal-auth.js";
import { addCartLine, getCart, removeCartLine, updateCartLine } from "../services/cart.js";

const getCartQuerySchema = z.object({
  cartId: z.string().uuid().optional(),
});

// .strict(): an unrecognized field (e.g. a client-submitted `price` or
// `subtotal`) is a validation error, not a value that's silently
// accepted and ignored. This is the concrete enforcement of "never trust
// client-submitted totals" (Architecture §04/§06).
const addLineBodySchema = z
  .object({
    cartId: z.string().uuid().optional(),
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
  })
  .strict();

const updateLineParamsSchema = z.object({ id: z.string().uuid() });
const updateLineBodySchema = z
  .object({
    cartId: z.string().uuid(),
    quantity: z.number().int().min(0).max(50),
  })
  .strict();

const deleteLineQuerySchema = z.object({ cartId: z.string().uuid() });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rate-limit key for the cart MUTATION routes (security hardening — Step 4
// L3). Cart state is anonymous and DB-backed, identified by a
// server-minted `cartId` (uuid) the storefront keeps in an httpOnly
// cookie — there is no user/session. So the limiter keys on that cart id
// when the request carries a well-formed one (isolates every shopper's
// cart, and stays correct even when many shoppers share one carrier-grade
// NAT address), and falls back to the trusted client IP otherwise — the
// first "add to cart" of a session, before a cart id exists. `request.ip`
// is spoof-safe (trustProxy = loopback, Step 1A). The plugin's LocalStore
// is a bounded LRU (default 5000 keys), so a caller cycling cart-id values
// cannot grow it without limit.
//
// Runs at the `preHandler` hook (not the default `onRequest`) so the parsed
// body is available — POST/PATCH carry `cartId` in the body, DELETE in the
// query string.
function cartMutationRateKey(request: FastifyRequest): string {
  const body = request.body as { cartId?: unknown } | undefined;
  const query = request.query as { cartId?: unknown } | undefined;
  const candidate =
    typeof body?.cartId === "string" ? body.cartId : typeof query?.cartId === "string" ? query.cartId : null;
  if (candidate && UUID_RE.test(candidate)) return `cart:${candidate}`;
  return `ip:${request.ip}`;
}

// Shared per-route rate-limit config for the three cart mutation routes.
// `allowList: []` overrides the GLOBAL limiter's internal-key allow-list
// (src/app.ts, Step 4 H1): every storefront cart call carries the internal
// API key and would otherwise be exempt from this guard too. Identical
// override to the COD (src/routes/checkout.ts) and order-tracking
// (src/routes/orders.ts) per-route limiters.
const cartMutationRateLimit = {
  config: {
    rateLimit: {
      max: env.CART_MUTATION_RATE_MAX,
      timeWindow: env.CART_MUTATION_RATE_TIME_WINDOW,
      allowList: [] as string[],
      hook: "preHandler" as const,
      keyGenerator: cartMutationRateKey,
    },
  },
};

export async function cartRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/cart", { preHandler: requireInternalApiKey }, async (request) => {
    const { cartId } = getCartQuerySchema.parse(request.query);
    if (!cartId) return { cart: null };
    const cart = await getCart(cartId);
    return { cart };
  });

  app.post(
    "/api/cart/lines",
    { preHandler: requireInternalApiKey, ...cartMutationRateLimit },
    async (request, reply) => {
      const { cartId, variantId, quantity } = addLineBodySchema.parse(request.body);
      const cart = await addCartLine(cartId ?? null, variantId, quantity);
      reply.status(200);
      return { cart };
    },
  );

  app.patch(
    "/api/cart/lines/:id",
    { preHandler: requireInternalApiKey, ...cartMutationRateLimit },
    async (request) => {
      const { id } = updateLineParamsSchema.parse(request.params);
      const { cartId, quantity } = updateLineBodySchema.parse(request.body);
      const cart = await updateCartLine(cartId, id, quantity);
      return { cart };
    },
  );

  app.delete(
    "/api/cart/lines/:id",
    { preHandler: requireInternalApiKey, ...cartMutationRateLimit },
    async (request) => {
      const { id } = updateLineParamsSchema.parse(request.params);
      const { cartId } = deleteLineQuerySchema.parse(request.query);
      const cart = await removeCartLine(cartId, id);
      return { cart };
    },
  );
}
