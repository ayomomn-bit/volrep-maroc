// One typed error class every service throws; one Fastify error handler
// (src/plugins/error-handler.ts) catches it and serializes to
// `{ error: { code, message } }`. Mirrors the frontend's existing
// discipline of never letting raw provider/DB error text reach a client
// (see lib/shopify/cart.ts's resolveMutation in the Phase 1 audit).
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "Not allowed"): AppError {
    return new AppError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Not found"): AppError {
    return new AppError(404, "NOT_FOUND", message);
  }

  static conflict(code: string, message: string, details?: unknown): AppError {
    return new AppError(409, code, message, details);
  }
}
