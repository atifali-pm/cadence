import {
  bigserial,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Local copy of CRM contacts. `id` is the CRM object id, not ours. */
export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyId: text("company_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  properties: jsonb("properties").notNull().default({}),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deals = pgTable("deals", {
  id: text("id").primaryKey(),
  name: text("name"),
  stage: text("stage"),
  amount: numeric("amount"),
  companyId: text("company_id"),
  contactIds: jsonb("contact_ids").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  properties: jsonb("properties").notNull().default({}),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

/** High-water marks per object type so sync pulls are incremental. */
export const syncCursors = pgTable("sync_cursors", {
  objectType: text("object_type").primaryKey(),
  lastModifiedAt: timestamp("last_modified_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventId: text("event_id").notNull(),
    subscriptionType: text("subscription_type").notNull(),
    objectId: text("object_id").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("received"),
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("webhook_events_event_id_idx").on(table.eventId)],
);

/**
 * Every agent write-back claims a row here first. The unique idempotency key
 * is what guarantees the same insight never lands in the CRM twice.
 */
export const writebacks = pgTable(
  "writebacks",
  {
    id: serial("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    kind: text("kind").notNull(),
    contactId: text("contact_id").notNull(),
    body: text("body").notNull(),
    crmObjectId: text("crm_object_id"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("writebacks_idempotency_key_idx").on(table.idempotencyKey)],
);
