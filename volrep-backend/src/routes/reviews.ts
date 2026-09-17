import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalApiKey } from "../lib/internal-auth.js";
import { getApprovedReviews } from "../services/reviews.js";

const handleParamsSchema = z.object({ handle: z.string().min(1).max(200) });

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/reviews/:handle", { preHandler: requireInternalApiKey }, async (request) => {
    const { handle } = handleParamsSchema.parse(request.params);
    return getApprovedReviews(handle);
  });
}
