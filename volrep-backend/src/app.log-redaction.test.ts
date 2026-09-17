import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildLoggerOptions } from "./app.js";

// Step 4 L2 — centralized Pino log redaction.
//
// These drive the EXACT `redact` config from buildLoggerOptions() through a
// real Fastify/pino instance and assert on the bytes actually written to
// the log stream. Fake, obviously-non-production secret values are used and
// every test proves they are absent from the output.

const INTERNAL = "test-internal-secret";
const SESSION = "test-session-token";
const PREVIEW = "test-preview-token";
const PASSWORD = "test-password";

let lines: string[];
let app: FastifyInstance;

function makeApp(): FastifyInstance {
  lines = [];
  // Same options the app ships (redact paths, no transport in test env);
  // level forced to "info" because .env.test sets LOG_LEVEL=silent, and a
  // capture stream in place of stdout.
  return Fastify({
    logger: {
      ...buildLoggerOptions(),
      level: "info",
      stream: { write: (s: string) => void lines.push(s) },
    },
  });
}

beforeEach(() => {
  app = makeApp();
});
afterEach(async () => {
  await app.close();
});

describe("application log redaction (L2)", () => {
  it("redacts sensitive request headers under every logged shape", async () => {
    app.log.info(
      {
        req: {
          headers: {
            authorization: `Bearer ${PREVIEW}`,
            cookie: `volrep_admin_session=${SESSION}`,
            "x-internal-api-key": INTERNAL,
            "set-cookie": `volrep_admin_session=${SESSION}`,
          },
        },
      },
      "incoming request",
    );
    app.log.info({ headers: { authorization: `Bearer ${PREVIEW}`, cookie: `k=${SESSION}` } }, "headers shape");
    app.log.info({ anything: { "x-internal-api-key": INTERNAL, "set-cookie": SESSION } }, "wildcard shape");

    const out = lines.join("");
    expect(out).not.toContain(INTERNAL);
    expect(out).not.toContain(SESSION);
    expect(out).not.toContain(PREVIEW);
    expect(out).toContain("[Redacted]");
    // The log message itself is untouched.
    expect(out).toContain("incoming request");
  });

  it("redacts a Set-Cookie wherever it is logged (raw M1 session token)", async () => {
    app.log.info(
      { response: { headers: { "set-cookie": `volrep_admin_session=${SESSION}; HttpOnly; SameSite=Strict` } } },
      "request completed",
    );
    app.log.info({ "set-cookie": `volrep_admin_session=${SESSION}` }, "bare set-cookie");
    app.log.info({ headers: { "set-cookie": `volrep_admin_session=${SESSION}` } }, "headers set-cookie");
    const out = lines.join("");
    expect(out).not.toContain(SESSION);
    expect(out).toMatch(/"set-cookie":"\[Redacted\]"/);
  });

  it("redacts a password field if a request body is ever logged", async () => {
    app.log.info({ request: { body: { email: "a@b.test", password: PASSWORD } } }, "body");
    app.log.info({ body: { password: PASSWORD } }, "body2");
    app.log.info({ credentials: { password: PASSWORD } }, "body3");
    const out = lines.join("");
    expect(out).not.toContain(PASSWORD);
    // A non-sensitive sibling field is kept.
    expect(out).toContain("a@b.test");
  });

  it("Fastify's own req/res serializers strip headers before they can be logged", async () => {
    // Documents the primary defense: anything at key `req` / `res` is
    // reduced by Fastify to method/url/statusCode/remoteAddress — headers,
    // cookies and bodies never reach the log line at all.
    app.log.info(
      { req: { headers: { "x-internal-api-key": INTERNAL, cookie: `s=${SESSION}` }, method: "GET", url: "/x" } },
      "serialized",
    );
    const out = lines.join("");
    expect(out).not.toContain(INTERNAL);
    expect(out).not.toContain(SESSION);
    expect(out).not.toContain('"headers"');
    expect(out).toContain('"url":"/x"');
  });

  it("leaves non-sensitive operational fields intact", async () => {
    app.log.info(
      { req: { method: "GET", url: "/api/products", remoteAddress: "127.0.0.1" }, res: { statusCode: 200 }, responseTime: 4 },
      "request completed",
    );
    const out = lines.join("");
    expect(out).toContain("/api/products");
    expect(out).toContain('"statusCode":200');
    expect(out).toContain('"method":"GET"');
    expect(out).toContain("request completed");
  });

  it("does not emit request headers/cookies through the real request-logging path", async () => {
    app.get("/ping", async () => ({ ok: true }));
    const res = await app.inject({
      method: "GET",
      url: "/ping",
      headers: {
        "x-internal-api-key": INTERNAL,
        authorization: `Bearer ${PREVIEW}`,
        cookie: `volrep_admin_session=${SESSION}`,
      },
    });
    expect(res.statusCode).toBe(200);

    const out = lines.join("");
    // Fastify's default serializer never serializes headers; even if it
    // did, the redact config would catch them.
    expect(out).not.toContain(INTERNAL);
    expect(out).not.toContain(SESSION);
    expect(out).not.toContain(PREVIEW);
    // Operational request logging still happened.
    expect(out).toContain("/ping");
    expect(out).toContain("request completed");
  });

  it("still redacts when an error is logged during a request with sensitive headers", async () => {
    app.get("/boom", async () => {
      throw new Error("kaboom");
    });
    await app.inject({
      method: "GET",
      url: "/boom",
      headers: { "x-internal-api-key": INTERNAL, cookie: `volrep_admin_session=${SESSION}` },
    });
    const out = lines.join("");
    expect(out).not.toContain(INTERNAL);
    expect(out).not.toContain(SESSION);
    // The error was still logged.
    expect(out.toLowerCase()).toContain("kaboom");
  });
});
