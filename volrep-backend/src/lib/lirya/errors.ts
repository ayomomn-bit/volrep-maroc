// Every failure mode of the Lirya client is one typed error. The admin
// service catches these and maps them to a `sync_error` code / operational
// warning — it never lets a raw Lirya error or stack trace surface.
export type LiryaErrorCode =
  | "not_configured"
  | "timeout"
  | "network"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "page_not_found"
  | "bad_gateway"
  | "unexpected";

// The parsed body of an application/problem+json response (RFC 7807).
export type LiryaProblem = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  [key: string]: unknown;
};

export class LiryaError extends Error {
  readonly code: LiryaErrorCode;
  readonly status: number;
  readonly requestId: string | null;
  readonly retryAfterMs: number | null;
  readonly problem: LiryaProblem | null;

  constructor(
    code: LiryaErrorCode,
    message: string,
    opts: {
      status?: number;
      requestId?: string | null;
      retryAfterMs?: number | null;
      problem?: LiryaProblem | null;
    } = {},
  ) {
    super(message);
    this.name = "LiryaError";
    this.code = code;
    this.status = opts.status ?? 0;
    this.requestId = opts.requestId ?? null;
    this.retryAfterMs = opts.retryAfterMs ?? null;
    this.problem = opts.problem ?? null;
  }
}

// Map an HTTP status to an error code for a non-2xx (non-304) response.
export function codeForStatus(status: number): LiryaErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "page_not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "bad_gateway";
  return "unexpected";
}
