import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

// A modest pool — this is a single small VPS-hosted service (Architecture
// §13), not a fleet of instances competing for connections.
const queryClient = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(queryClient, { schema });

export async function closeDb(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}
