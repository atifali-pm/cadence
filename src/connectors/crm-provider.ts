/**
 * CrmProvider is the abstraction that keeps Cadence CRM-agnostic.
 *
 * HubSpot is the first implementation (src/connectors/hubspot). Salesforce lands
 * later as a stub (src/connectors/salesforce) to prove the interface holds.
 *
 * Nothing CRM-specific should leak past this boundary. The sync, agent, and API
 * layers depend on these shapes, never on a vendor SDK directly.
 *
 * Phase 0: interface skeleton only. No implementation, no API calls. The method
 * set below is a starting contract and will be refined when the HubSpot provider
 * is built in Phase 1.
 */

export type CrmObjectId = string;

export interface CrmContact {
  id: CrmObjectId;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyId?: CrmObjectId;
  updatedAt: string;
  properties: Record<string, unknown>;
}

export interface CrmCompany {
  id: CrmObjectId;
  name?: string;
  domain?: string;
  updatedAt: string;
  properties: Record<string, unknown>;
}

export interface CrmDeal {
  id: CrmObjectId;
  name?: string;
  stage?: string;
  amount?: number;
  contactIds: CrmObjectId[];
  companyId?: CrmObjectId;
  updatedAt: string;
  properties: Record<string, unknown>;
}

/** A single page of results plus the cursor to fetch the next page, if any. */
export interface CrmPage<T> {
  items: T[];
  nextCursor?: string;
}

/** Options for an incremental pull. `since` and `cursor` drive watermarking. */
export interface CrmListOptions {
  since?: string;
  cursor?: string;
  limit?: number;
}

/** A note to attach to a CRM record. Idempotency key guards against double writes. */
export interface CrmNoteInput {
  contactId: CrmObjectId;
  body: string;
  idempotencyKey: string;
}

/** A task to create against a CRM record. */
export interface CrmTaskInput {
  contactId: CrmObjectId;
  title: string;
  body?: string;
  dueAt?: string;
  idempotencyKey: string;
}

export interface CrmWriteResult {
  id: CrmObjectId;
  created: boolean;
}

/**
 * The provider contract. Read methods feed the sync layer; write methods let the
 * agent layer post its output back to the CRM.
 */
export interface CrmProvider {
  readonly name: string;

  listContacts(options?: CrmListOptions): Promise<CrmPage<CrmContact>>;
  listCompanies(options?: CrmListOptions): Promise<CrmPage<CrmCompany>>;
  listDeals(options?: CrmListOptions): Promise<CrmPage<CrmDeal>>;

  createNote(input: CrmNoteInput): Promise<CrmWriteResult>;
  createTask(input: CrmTaskInput): Promise<CrmWriteResult>;
}
