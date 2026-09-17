import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalApiKey } from "../lib/internal-auth.js";
import { AppError } from "../lib/errors.js";
import { getProductByHandle, listProducts } from "../services/products.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

const handleParamsSchema = z.object({
  handle: z.string().min(1).max(200),
});

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/products", { preHandler: requireInternalApiKey }, async (request) => {
    const { limit } = listQuerySchema.parse(request.query);
    const products = await listProducts(limit);
    return { products };
  });

  app.get("/api/products/:handle", { preHandler: requireInternalApiKey }, async (request) => {
    const { handle } = handleParamsSchema.parse(request.params);
    const product = await getProductByHandle(handle);

    if (!product) {
      throw AppError.notFound("Product not found");
    }

    return { product };
  });
}
