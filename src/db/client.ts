import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as schema from "./schema.js";

let instance: ReturnType<typeof create> | undefined;

function create() {
  const sql = postgres(config.databaseUrl(), { max: 10 });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

export function getDb() {
  instance ??= create();
  return instance.db;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.sql.end({ timeout: 5 });
    instance = undefined;
  }
}

export { schema };
