import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type {
  CrmNoteInput,
  CrmProvider,
  CrmWriteResult,
} from "../../src/connectors/crm-provider.js";
import { closeDb } from "../../src/db/client.js";
import { WritebackService } from "../../src/writeback/writeback-service.js";

/** Counts CRM calls so the tests can prove exactly-once behavior. */
class FakeProvider implements Partial<CrmProvider> {
  readonly name = "fake";
  noteCalls: CrmNoteInput[] = [];
  failNext = false;

  async createNote(input: CrmNoteInput): Promise<CrmWriteResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("simulated CRM outage");
    }
    this.noteCalls.push(input);
    return { id: `note-${this.noteCalls.length}`, created: true };
  }
}

// Runs against the local dev Postgres from docker/docker-compose.yml.
describe("WritebackService", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("posts once and treats the second attempt as a duplicate", async () => {
    const provider = new FakeProvider();
    const service = new WritebackService(provider as unknown as CrmProvider);
    const request = {
      idempotencyKey: `test-${randomUUID()}`,
      contactId: "42",
      body: "follow up on the open deal",
    };

    const first = await service.postNote(request);
    expect(first.posted).toBe(true);
    expect(first.crmObjectId).toBe("note-1");

    const second = await service.postNote(request);
    expect(second.posted).toBe(false);
    expect(second.reason).toBe("duplicate");
    expect(second.crmObjectId).toBe("note-1");

    expect(provider.noteCalls).toHaveLength(1);
  });

  it("marks the claim failed when the CRM call throws", async () => {
    const provider = new FakeProvider();
    provider.failNext = true;
    const service = new WritebackService(provider as unknown as CrmProvider);
    const request = {
      idempotencyKey: `test-${randomUUID()}`,
      contactId: "42",
      body: "note that will fail",
    };

    await expect(service.postNote(request)).rejects.toThrow("simulated CRM outage");
    expect(provider.noteCalls).toHaveLength(0);
  });
});
