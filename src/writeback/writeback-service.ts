import { sql } from "drizzle-orm";
import type { CrmProvider } from "../connectors/crm-provider.js";
import { getDb, schema } from "../db/client.js";

export interface WritebackRequest {
  idempotencyKey: string;
  contactId: string;
  body: string;
}

export interface WritebackOutcome {
  posted: boolean;
  crmObjectId?: string;
  reason?: "duplicate" | "posted" | "failed";
}

/**
 * Posts agent output to the CRM exactly once per idempotency key. The key is
 * claimed in Postgres before the CRM call, so a retry after a crash can never
 * double-post; it either finds the claim finished or finishes it.
 */
export class WritebackService {
  constructor(private readonly provider: CrmProvider) {}

  async postNote(request: WritebackRequest): Promise<WritebackOutcome> {
    const db = getDb();

    const claimed = await db
      .insert(schema.writebacks)
      .values({
        idempotencyKey: request.idempotencyKey,
        kind: "note",
        contactId: request.contactId,
        body: request.body,
      })
      .onConflictDoNothing({ target: schema.writebacks.idempotencyKey })
      .returning({ id: schema.writebacks.id });

    if (claimed.length === 0) {
      const existing = await db
        .select()
        .from(schema.writebacks)
        .where(sql`${schema.writebacks.idempotencyKey} = ${request.idempotencyKey}`);
      return {
        posted: false,
        reason: "duplicate",
        crmObjectId: existing[0]?.crmObjectId ?? undefined,
      };
    }

    try {
      const result = await this.provider.createNote({
        contactId: request.contactId,
        body: request.body,
        idempotencyKey: request.idempotencyKey,
      });
      await db
        .update(schema.writebacks)
        .set({ status: "posted", crmObjectId: result.id })
        .where(sql`${schema.writebacks.id} = ${claimed[0]!.id}`);
      return { posted: true, crmObjectId: result.id, reason: "posted" };
    } catch (error) {
      await db
        .update(schema.writebacks)
        .set({ status: "failed" })
        .where(sql`${schema.writebacks.id} = ${claimed[0]!.id}`);
      throw error;
    }
  }
}
