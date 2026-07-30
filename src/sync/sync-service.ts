import { sql } from "drizzle-orm";
import type { CrmContact, CrmDeal, CrmProvider } from "../connectors/crm-provider.js";
import { getDb, schema } from "../db/client.js";

export interface SyncResult {
  objectType: "contacts" | "deals";
  pulled: number;
  watermark: string | undefined;
}

/**
 * Pulls contacts and deals from the CRM into Postgres. The first run walks
 * the full object list; later runs only ask for records modified since the
 * stored high-water mark.
 */
export class SyncService {
  constructor(private readonly provider: CrmProvider) {}

  async syncContacts(): Promise<SyncResult> {
    const since = await this.watermark("contacts");
    let cursor: string | undefined;
    let pulled = 0;
    let newest = since;

    do {
      const page = await this.provider.listContacts({ since, cursor, limit: 100 });
      for (const contact of page.items) {
        await this.upsertContact(contact);
        pulled += 1;
        if (!newest || contact.updatedAt > newest) newest = contact.updatedAt;
      }
      cursor = page.nextCursor;
    } while (cursor);

    await this.saveWatermark("contacts", newest);
    return { objectType: "contacts", pulled, watermark: newest };
  }

  async syncDeals(): Promise<SyncResult> {
    const since = await this.watermark("deals");
    let cursor: string | undefined;
    let pulled = 0;
    let newest = since;

    do {
      const page = await this.provider.listDeals({ since, cursor, limit: 100 });
      for (const deal of page.items) {
        await this.upsertDeal(deal);
        pulled += 1;
        if (!newest || deal.updatedAt > newest) newest = deal.updatedAt;
      }
      cursor = page.nextCursor;
    } while (cursor);

    await this.saveWatermark("deals", newest);
    return { objectType: "deals", pulled, watermark: newest };
  }

  async upsertContact(contact: CrmContact): Promise<void> {
    const db = getDb();
    await db
      .insert(schema.contacts)
      .values({
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        companyId: contact.companyId,
        updatedAt: new Date(contact.updatedAt),
        properties: contact.properties,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.contacts.id,
        set: {
          email: sql`excluded.email`,
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          companyId: sql`excluded.company_id`,
          updatedAt: sql`excluded.updated_at`,
          properties: sql`excluded.properties`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }

  async upsertDeal(deal: CrmDeal): Promise<void> {
    const db = getDb();
    await db
      .insert(schema.deals)
      .values({
        id: deal.id,
        name: deal.name,
        stage: deal.stage,
        amount: deal.amount !== undefined ? String(deal.amount) : undefined,
        companyId: deal.companyId,
        contactIds: deal.contactIds,
        updatedAt: new Date(deal.updatedAt),
        properties: deal.properties,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.deals.id,
        set: {
          name: sql`excluded.name`,
          stage: sql`excluded.stage`,
          amount: sql`excluded.amount`,
          companyId: sql`excluded.company_id`,
          contactIds: sql`excluded.contact_ids`,
          updatedAt: sql`excluded.updated_at`,
          properties: sql`excluded.properties`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }

  private async watermark(objectType: string): Promise<string | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.syncCursors)
      .where(sql`${schema.syncCursors.objectType} = ${objectType}`);
    return rows[0]?.lastModifiedAt?.toISOString();
  }

  private async saveWatermark(objectType: string, value: string | undefined): Promise<void> {
    if (!value) return;
    const db = getDb();
    await db
      .insert(schema.syncCursors)
      .values({ objectType, lastModifiedAt: new Date(value), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.syncCursors.objectType,
        set: {
          lastModifiedAt: sql`excluded.last_modified_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}
