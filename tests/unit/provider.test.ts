import { describe, expect, it } from "vitest";
import { HubSpotHttp } from "../../src/connectors/hubspot/http.js";
import { HubSpotProvider } from "../../src/connectors/hubspot/hubspot-provider.js";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("HubSpotProvider", () => {
  it("walks contact pages via the cursor", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (!url.includes("after=")) {
        return jsonResponse(200, {
          results: [
            { id: "1", updatedAt: "2026-07-30T10:00:00Z", properties: { email: "a@x.com" } },
          ],
          paging: { next: { after: "cursor-2" } },
        });
      }
      return jsonResponse(200, {
        results: [
          { id: "2", updatedAt: "2026-07-30T11:00:00Z", properties: { email: "b@x.com" } },
        ],
      });
    };

    const provider = new HubSpotProvider(
      new HubSpotHttp({ token: "t", fetchImpl, backoffMs: 1 }),
    );

    const first = await provider.listContacts({ limit: 1 });
    expect(first.items.map((contact) => contact.id)).toEqual(["1"]);
    expect(first.nextCursor).toBe("cursor-2");

    const second = await provider.listContacts({ limit: 1, cursor: first.nextCursor });
    expect(second.items.map((contact) => contact.id)).toEqual(["2"]);
    expect(second.nextCursor).toBeUndefined();
    expect(calls).toHaveLength(2);
  });

  it("uses the search endpoint when a watermark is given", async () => {
    let capturedUrl = "";
    let capturedBody: any;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body));
      return jsonResponse(200, { results: [] });
    };

    const provider = new HubSpotProvider(
      new HubSpotHttp({ token: "t", fetchImpl, backoffMs: 1 }),
    );
    await provider.listDeals({ since: "2026-07-01T00:00:00Z" });

    expect(capturedUrl).toContain("/crm/v3/objects/deals/search");
    expect(capturedBody.filterGroups[0].filters[0]).toMatchObject({
      propertyName: "hs_lastmodifieddate",
      operator: "GTE",
    });
  });

  it("retries a 429 and honors Retry-After", async () => {
    let attempts = 0;
    const fetchImpl: typeof fetch = async () => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse(429, { message: "rate limited" }, { "retry-after": "0" });
      }
      return jsonResponse(200, { results: [] });
    };

    const provider = new HubSpotProvider(
      new HubSpotHttp({ token: "t", fetchImpl, backoffMs: 1 }),
    );
    const page = await provider.listContacts();
    expect(page.items).toEqual([]);
    expect(attempts).toBe(2);
  });

  it("throws on a non-retryable status", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(403, { message: "missing scope" });
    const provider = new HubSpotProvider(
      new HubSpotHttp({ token: "t", fetchImpl, backoffMs: 1 }),
    );
    await expect(provider.listContacts()).rejects.toMatchObject({ status: 403 });
  });
});
