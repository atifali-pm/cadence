import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_MS = 5 * 60 * 1000;

export interface WebhookVerifyInput {
  method: string;
  url: string;
  body: string;
  signature: string | undefined;
  timestamp: string | undefined;
  clientSecret: string;
  nowMs?: number;
}

/**
 * HubSpot v3 request signatures: base64 HMAC-SHA256 over
 * method + url + body + timestamp, keyed with the app client secret.
 * Requests older than five minutes are rejected outright.
 */
export function verifyHubSpotSignature(input: WebhookVerifyInput): boolean {
  if (!input.signature || !input.timestamp) return false;

  const timestampMs = Number(input.timestamp);
  if (!Number.isFinite(timestampMs)) return false;
  const now = input.nowMs ?? Date.now();
  if (Math.abs(now - timestampMs) > MAX_SKEW_MS) return false;

  const base = `${input.method}${input.url}${input.body}${input.timestamp}`;
  const expected = createHmac("sha256", input.clientSecret).update(base).digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(input.signature, "base64");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
