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
import { HubSpotHttp } from "./http.js";

const CONTACT_PROPERTIES = ["email", "firstname", "lastname", "lastmodifieddate"];
const DEAL_PROPERTIES = ["dealname", "dealstage", "amount", "hs_lastmodifieddate"];
const COMPANY_PROPERTIES = ["name", "domain", "hs_lastmodifieddate"];

// HubSpot-defined association type ids: engagement object to contact.
const NOTE_TO_CONTACT = 202;
const TASK_TO_CONTACT = 204;

interface HubSpotObject {
  id: string;
  properties: Record<string, string | null>;
  updatedAt: string;
  associations?: {
    [key: string]: { results: Array<{ id: string; type: string }> };
  };
}

interface HubSpotListResponse {
  results: HubSpotObject[];
  paging?: { next?: { after: string } };
}

export class HubSpotProvider implements CrmProvider {
  readonly name = "hubspot";

  constructor(private readonly http: HubSpotHttp) {}

  async listContacts(options?: CrmListOptions): Promise<CrmPage<CrmContact>> {
    const page = await this.list("contacts", CONTACT_PROPERTIES, "lastmodifieddate", options);
    return {
      items: page.results.map((raw) => this.toContact(raw)),
      nextCursor: page.paging?.next?.after,
    };
  }

  async listCompanies(options?: CrmListOptions): Promise<CrmPage<CrmCompany>> {
    const page = await this.list("companies", COMPANY_PROPERTIES, "hs_lastmodifieddate", options);
    return {
      items: page.results.map((raw) => ({
        id: raw.id,
        name: raw.properties.name ?? undefined,
        domain: raw.properties.domain ?? undefined,
        updatedAt: raw.updatedAt,
        properties: raw.properties,
      })),
      nextCursor: page.paging?.next?.after,
    };
  }

  async listDeals(options?: CrmListOptions): Promise<CrmPage<CrmDeal>> {
    const page = await this.list("deals", DEAL_PROPERTIES, "hs_lastmodifieddate", options, "contacts");
    return {
      items: page.results.map((raw) => this.toDeal(raw)),
      nextCursor: page.paging?.next?.after,
    };
  }

  async getContact(id: string): Promise<CrmContact> {
    const raw = await this.http.get<HubSpotObject>(`/crm/v3/objects/contacts/${id}`, {
      properties: CONTACT_PROPERTIES.join(","),
    });
    return this.toContact(raw);
  }

  async getDeal(id: string): Promise<CrmDeal> {
    const raw = await this.http.get<HubSpotObject>(`/crm/v3/objects/deals/${id}`, {
      properties: DEAL_PROPERTIES.join(","),
      associations: "contacts",
    });
    return this.toDeal(raw);
  }

  async createNote(input: CrmNoteInput): Promise<CrmWriteResult> {
    const created = await this.http.post<HubSpotObject>("/crm/v3/objects/notes", {
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: input.body,
      },
      associations: [association(input.contactId, NOTE_TO_CONTACT)],
    });
    return { id: created.id, created: true };
  }

  async createTask(input: CrmTaskInput): Promise<CrmWriteResult> {
    const created = await this.http.post<HubSpotObject>("/crm/v3/objects/tasks", {
      properties: {
        hs_timestamp: input.dueAt ?? new Date().toISOString(),
        hs_task_subject: input.title,
        hs_task_body: input.body ?? "",
        hs_task_status: "NOT_STARTED",
      },
      associations: [association(input.contactId, TASK_TO_CONTACT)],
    });
    return { id: created.id, created: true };
  }

  /**
   * Plain paged list when no watermark is given; the search endpoint with a
   * lastmodified filter when one is. Search is capped at 10k results per
   * query, which is fine for incremental pulls.
   */
  private async list(
    objectType: "contacts" | "companies" | "deals",
    properties: string[],
    modifiedProperty: string,
    options?: CrmListOptions,
    associations?: string,
  ): Promise<HubSpotListResponse> {
    if (options?.since) {
      return this.http.post<HubSpotListResponse>(`/crm/v3/objects/${objectType}/search`, {
        filterGroups: [
          {
            filters: [
              {
                propertyName: modifiedProperty,
                operator: "GTE",
                value: String(new Date(options.since).getTime()),
              },
            ],
          },
        ],
        sorts: [{ propertyName: modifiedProperty, direction: "ASCENDING" }],
        properties,
        limit: options.limit ?? 100,
        after: options.cursor,
      });
    }
    return this.http.get<HubSpotListResponse>(`/crm/v3/objects/${objectType}`, {
      limit: options?.limit ?? 100,
      after: options?.cursor,
      properties: properties.join(","),
      associations,
    });
  }

  private toContact(raw: HubSpotObject): CrmContact {
    return {
      id: raw.id,
      email: raw.properties.email ?? undefined,
      firstName: raw.properties.firstname ?? undefined,
      lastName: raw.properties.lastname ?? undefined,
      updatedAt: raw.updatedAt,
      properties: raw.properties,
    };
  }

  private toDeal(raw: HubSpotObject): CrmDeal {
    const contactIds =
      raw.associations?.contacts?.results.map((result) => result.id) ?? [];
    return {
      id: raw.id,
      name: raw.properties.dealname ?? undefined,
      stage: raw.properties.dealstage ?? undefined,
      amount: raw.properties.amount ? Number(raw.properties.amount) : undefined,
      contactIds,
      updatedAt: raw.updatedAt,
      properties: raw.properties,
    };
  }
}

function association(contactId: string, typeId: number) {
  return {
    to: { id: contactId },
    types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: typeId }],
  };
}
