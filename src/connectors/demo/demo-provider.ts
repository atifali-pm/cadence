import type {
  CrmCompany,
  CrmContact,
  CrmDeal,
  CrmListOptions,
  CrmNoteInput,
  CrmPage,
  CrmProvider,
  CrmTaskInput,
  CrmWriteResult,
} from "../crm-provider.js";
import { demoContacts, demoDeals } from "./fixtures.js";

/**
 * In-memory CRM used by demo mode. Serves the bundled fixture pipeline and
 * accepts note/task write-backs without any network or account. Everything
 * else in the system (sync, storage, drafting, idempotency) runs exactly as
 * it does against a real provider.
 */
export class DemoProvider implements CrmProvider {
  readonly name = "demo";

  private readonly contacts = demoContacts();
  private readonly deals = demoDeals();
  readonly notes: Array<CrmNoteInput & { id: string }> = [];
  readonly tasks: Array<CrmTaskInput & { id: string }> = [];

  async listContacts(options?: CrmListOptions): Promise<CrmPage<CrmContact>> {
    return paginate(this.contacts, options);
  }

  async listCompanies(options?: CrmListOptions): Promise<CrmPage<CrmCompany>> {
    return paginate([], options);
  }

  async listDeals(options?: CrmListOptions): Promise<CrmPage<CrmDeal>> {
    return paginate(this.deals, options);
  }

  async getContact(id: string): Promise<CrmContact> {
    const found = this.contacts.find((item) => item.id === id);
    if (!found) throw new Error(`demo contact ${id} not found`);
    return found;
  }

  async getDeal(id: string): Promise<CrmDeal> {
    const found = this.deals.find((item) => item.id === id);
    if (!found) throw new Error(`demo deal ${id} not found`);
    return found;
  }

  async createNote(input: CrmNoteInput): Promise<CrmWriteResult> {
    const id = `demo-note-${this.notes.length + 1}`;
    this.notes.push({ ...input, id });
    return { id, created: true };
  }

  async createTask(input: CrmTaskInput): Promise<CrmWriteResult> {
    const id = `demo-task-${this.tasks.length + 1}`;
    this.tasks.push({ ...input, id });
    return { id, created: true };
  }
}

function paginate<T extends { updatedAt: string }>(
  items: T[],
  options?: CrmListOptions,
): CrmPage<T> {
  const since = options?.since;
  const filtered = since ? items.filter((item) => item.updatedAt >= since) : items;
  const start = options?.cursor ? Number(options.cursor) : 0;
  const limit = options?.limit ?? 100;
  const slice = filtered.slice(start, start + limit);
  const nextStart = start + slice.length;
  return {
    items: slice,
    nextCursor: nextStart < filtered.length ? String(nextStart) : undefined,
  };
}
