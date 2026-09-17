import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, closeDb } from "./client.js";
import { adminUsers } from "./schema/index.js";
import { hashPassword } from "../lib/admin-auth.js";

// Bootstrap / manage admin users from the CLI. There is deliberately NO
// API route that creates the first admin (chicken-and-egg), so this is the
// only way an owner account comes into existence.
//
//   npm run admin:create -- --email you@volrep.com --role owner
//   npm run admin:create -- --email staff@volrep.com --role staff --password 's3cret...'
//
// With no --password, a strong random one is generated and printed once.
// Re-running for an existing email resets that user's password/role.

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const email = arg("email")?.trim().toLowerCase();
  const role = (arg("role") ?? "owner").trim();
  let password = arg("password");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Usage: npm run admin:create -- --email <addr> [--role owner|staff] [--password <pw>]");
  }
  if (role !== "owner" && role !== "staff") {
    throw new Error(`--role must be "owner" or "staff" (got "${role}")`);
  }
  if (password && password.length < 12) {
    throw new Error("--password must be at least 12 characters");
  }

  let generated = false;
  if (!password) {
    password = randomBytes(18).toString("base64url");
    generated = true;
  }

  const passwordHash = await hashPassword(password);
  const [existing] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email)).limit(1);

  if (existing) {
    await db.update(adminUsers).set({ passwordHash, role }).where(eq(adminUsers.id, existing.id));
    console.log(`Updated admin ${email} (role: ${role}).`);
  } else {
    await db.insert(adminUsers).values({ email, role, passwordHash });
    console.log(`Created admin ${email} (role: ${role}).`);
  }

  if (generated) {
    console.log(`\n  Generated password (shown once): ${password}\n`);
  }

  await closeDb();
}

main().catch((error) => {
  console.error("admin:create failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
