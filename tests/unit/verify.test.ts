import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyHubSpotSignature } from "../../src/webhooks/verify.js";

const SECRET = "test-secret";
const URL = "http://localhost:8040/webhooks/hubspot";

function sign(method: string, url: string, body: string, timestamp: string): string {
  return createHmac("sha256", SECRET)
    .update(`${method}${url}${body}${timestamp}`)
    .digest("base64");
}

describe("verifyHubSpotSignature", () => {
  const body = JSON.stringify([{ eventId: 1, subscriptionType: "contact.propertyChange" }]);

  it("accepts a valid signature", () => {
    const timestamp = String(Date.now());
    expect(
      verifyHubSpotSignature({
        method: "POST",
        url: URL,
        body,
        signature: sign("POST", URL, body, timestamp),
        timestamp,
        clientSecret: SECRET,
      }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const timestamp = String(Date.now());
    expect(
      verifyHubSpotSignature({
        method: "POST",
        url: URL,
        body: body.replace("contact", "deal"),
        signature: sign("POST", URL, body, timestamp),
        timestamp,
        clientSecret: SECRET,
      }),
    ).toBe(false);
  });

  it("rejects a stale timestamp", () => {
    const timestamp = String(Date.now() - 6 * 60 * 1000);
    expect(
      verifyHubSpotSignature({
        method: "POST",
        url: URL,
        body,
        signature: sign("POST", URL, body, timestamp),
        timestamp,
        clientSecret: SECRET,
      }),
    ).toBe(false);
  });

  it("rejects missing headers", () => {
    expect(
      verifyHubSpotSignature({
        method: "POST",
        url: URL,
        body,
        signature: undefined,
        timestamp: undefined,
        clientSecret: SECRET,
      }),
    ).toBe(false);
  });
});
