import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { FollowupDrafter } from "../agents/followup-drafter.js";
import { loadEnv } from "../config.js";
import { requireHubSpotProvider } from "../connectors/hubspot/index.js";
import { closeDb, getDb, schema } from "../db/client.js";
import { WritebackService } from "../writeback/writeback-service.js";

loadEnv();

/**
 * Drafts a follow-up note for one synced contact and posts it back to the
 * CRM. Usage: npm run followup -- <contactId>
 */
async function main(): Promise<void> {
  const contactId = process.argv[2];
  if (!contactId) {
    console.error("usage: npm run followup -- <contactId>");
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  const contactRows = await db
    .select()
    .from(schema.contacts)
    .where(sql`${schema.contacts.id} = ${contactId}`);
  const contact = contactRows[0];
  if (!contact) {
    console.error(`contact ${contactId} is not in the local store; run npm run sync first`);
    process.exitCode = 1;
    return;
  }

  const dealRows = await db
    .select()
    .from(schema.deals)
    .where(sql`${schema.deals.contactIds} @> ${JSON.stringify([contactId])}::jsonb`);

  const drafter = new FollowupDrafter();
  const draft = await drafter.draft({
    contact,
    deals: dealRows.map((deal) => ({
      name: deal.name,
      stage: deal.stage,
      amount: deal.amount,
      updatedAt: deal.updatedAt,
    })),
  });

  console.log("--- draft note ---");
  console.log(draft.note);
  console.log("------------------");

  // Key on contact + note content so re-running with an unchanged pipeline
  // never posts the same note twice.
  const idempotencyKey = createHash("sha256")
    .update(`note:${contactId}:${draft.note}`)
    .digest("hex");

  const provider = requireHubSpotProvider();
  const writeback = new WritebackService(provider);
  const outcome = await writeback.postNote({ idempotencyKey, contactId, body: draft.note });

  if (outcome.posted) {
    console.log(`posted to CRM as note ${outcome.crmObjectId}`);
  } else {
    console.log(`skipped: ${outcome.reason} (existing note ${outcome.crmObjectId ?? "n/a"})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
