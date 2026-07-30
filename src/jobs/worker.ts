import { Worker } from "bullmq";
import { sql } from "drizzle-orm";
import type { CrmProvider } from "../connectors/crm-provider.js";
import { getDb, schema } from "../db/client.js";
import { SyncService } from "../sync/sync-service.js";
import { redisConnection, WEBHOOK_QUEUE, type WebhookJobData } from "./queues.js";

/**
 * Consumes webhook events and refreshes the local copy of whichever object
 * changed. Runs as its own process (npm run worker) so the web tier never
 * blocks on CRM round-trips.
 */
export function startWebhookWorker(provider: CrmProvider | undefined): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>(
    WEBHOOK_QUEUE,
    async (job) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.webhookEvents)
        .where(sql`${schema.webhookEvents.eventId} = ${job.data.eventId}`);
      const event = rows[0];
      if (!event) return;
      if (event.status === "processed") return;

      // Without CRM credentials the event stays recorded but untouched, so a
      // later run with credentials can still replay it.
      if (!provider) {
        await db
          .update(schema.webhookEvents)
          .set({ status: "skipped", error: "no CRM credentials configured" })
          .where(sql`${schema.webhookEvents.id} = ${event.id}`);
        return;
      }

      const syncService = new SyncService(provider);
      try {
        if (event.subscriptionType.startsWith("contact.")) {
          const contact = await provider.getContact(event.objectId);
          await syncService.upsertContact(contact);
        } else if (event.subscriptionType.startsWith("deal.")) {
          const deal = await provider.getDeal(event.objectId);
          await syncService.upsertDeal(deal);
        }
        await db
          .update(schema.webhookEvents)
          .set({ status: "processed", processedAt: new Date(), error: null })
          .where(sql`${schema.webhookEvents.id} = ${event.id}`);
      } catch (error) {
        await db
          .update(schema.webhookEvents)
          .set({ status: "failed", error: String(error) })
          .where(sql`${schema.webhookEvents.id} = ${event.id}`);
        throw error;
      }
    },
    { connection: redisConnection(), concurrency: 5 },
  );

  return worker;
}
