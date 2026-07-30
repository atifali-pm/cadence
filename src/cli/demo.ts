import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { HeuristicDrafter } from "../agents/heuristic-drafter.js";
import { loadEnv } from "../config.js";
import { DemoProvider } from "../connectors/demo/demo-provider.js";
import { closeDb, getDb, schema } from "../db/client.js";
import { SyncService } from "../sync/sync-service.js";
import { WritebackService } from "../writeback/writeback-service.js";

loadEnv();

/**
 * Runs the whole loop against the bundled demo CRM: sync into Postgres,
 * draft a follow-up for the quietest contact, write it back, then prove the
 * idempotency guard by trying to post the same note again. No external
 * account, no API key, no network.
 */
async function main(): Promise<void> {
  const provider = new DemoProvider();
  const syncService = new SyncService(provider);

  console.log("cadence demo: full pipeline against the bundled demo CRM\n");

  const contacts = await syncService.syncContacts();
  const deals = await syncService.syncDeals();
  console.log(`synced ${contacts.pulled} contacts and ${deals.pulled} deals into Postgres`);

  const db = getDb();
  const dealRows = await db.select().from(schema.deals);
  const idleByContact = new Map<string, number>();
  for (const deal of dealRows) {
    for (const contactId of deal.contactIds) {
      const idleMs = Date.now() - deal.updatedAt.getTime();
      idleByContact.set(contactId, Math.max(idleByContact.get(contactId) ?? 0, idleMs));
    }
  }
  const quietest = [...idleByContact.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!quietest) {
    console.log("no deals in the store; nothing to draft");
    return;
  }
  const contactId = quietest[0];

  const contactRows = await db
    .select()
    .from(schema.contacts)
    .where(sql`${schema.contacts.id} = ${contactId}`);
  const contact = contactRows[0]!;
  const contactDeals = dealRows.filter((deal) => deal.contactIds.includes(contactId));

  console.log(
    `\nquietest relationship: ${contact.firstName} ${contact.lastName} (${contact.email})`,
  );

  const drafter = new HeuristicDrafter();
  const draft = await drafter.draft({
    contact,
    deals: contactDeals.map((deal) => ({
      name: deal.name,
      stage: deal.stage,
      amount: deal.amount,
      updatedAt: deal.updatedAt,
    })),
  });

  console.log(`\n--- drafted follow-up note (${draft.model} drafter) ---`);
  console.log(draft.note);
  console.log("---------------------------------------------\n");

  const idempotencyKey = createHash("sha256")
    .update(`note:${contactId}:${draft.note}`)
    .digest("hex");
  const writeback = new WritebackService(provider);

  const first = await writeback.postNote({ idempotencyKey, contactId, body: draft.note });
  console.log(`write-back: posted note ${first.crmObjectId} to the demo CRM`);

  const second = await writeback.postNote({ idempotencyKey, contactId, body: draft.note });
  console.log(
    `write-back retry: ${second.reason} (note ${second.crmObjectId}), CRM calls made: ${provider.notes.length}`,
  );

  console.log("\ndone: sync, draft, write-back, and the exactly-once guard all ran locally");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
