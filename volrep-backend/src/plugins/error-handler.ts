import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

function hasStatusCode(error: unknown): error is { statusCode: number; message?: string } {
  return typeof error === "object" && error !== null && "statusCode" in error && typeof (error as { statusCode: unknown }).statusCode === "number";
}

// A single place every thrown error passes through — never a raw stack
// trace or DB error to the client (Architecture §00/§14). Fastify types
// the handler's error param as `unknown` by default, so every branch below
// narrows explicitly rather than assuming a shape.
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error }, error.message);
      }
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request failed validation",
          details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      });
      return;
    }

    // @fastify/rate-limit throws a 429 from its onRequest hook when a client
    // exceeds a limit. Normalize it to the standard envelope with a stable
    // code and a generic message — never echo the limit or the window back
    // (that's abuse-guard internal state). The plugin has already set the
    // Retry-After header on the reply.
    if (hasStatusCode(error) && error.statusCode === 429) {
      reply.status(429).send({
        error: {
          code: "RATE_LIMITED",
          message: "Trop de requêtes. Merci de patienter un instant avant de réessayer.",
        },
      });
      return;
    }

    // Fastify's own schema-validation errors (route-level JSON schema) —
    // any other error object that happens to carry a numeric statusCode.
    if (hasStatusCode(error) && error.statusCode < 500) {
      reply.status(error.statusCode).send({
        error: { code: "BAD_REQUEST", message: error.message ?? "Bad request" },
      });
      return;
    }

    request.log.error({ err: error }, "Unhandled error");
    reply.status(500).send({
      error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
}
