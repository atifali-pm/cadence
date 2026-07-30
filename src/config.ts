import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

/**
 * Loads KEY=VALUE pairs from .env into process.env without overriding values
 * that are already set. Kept dependency-free on purpose.
 */
export function loadEnv(path = ".env"): void {
  if (loaded) return;
  loaded = true;
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), path), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function env(key: string): string | undefined {
  return process.env[key] === "" ? undefined : process.env[key];
}

export function requireEnv(key: string): string {
  const value = env(key);
  if (value === undefined) {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value;
}

export const config = {
  databaseUrl: () =>
    env("DATABASE_URL") ?? "postgresql://cadence:cadence@localhost:5461/cadence",
  redisUrl: () => env("REDIS_URL") ?? "redis://localhost:6386",
  hubspotToken: () => env("HUBSPOT_PRIVATE_APP_TOKEN"),
  hubspotClientSecret: () => env("HUBSPOT_CLIENT_SECRET"),
  anthropicModel: () => env("ANTHROPIC_MODEL") ?? "claude-sonnet-5",
  webhookPublicUrl: () =>
    env("WEBHOOK_PUBLIC_URL") ?? "http://localhost:8040/webhooks/hubspot",
};
