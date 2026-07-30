import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

export interface FollowupContext {
  contact: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  deals: Array<{
    name?: string | null;
    stage?: string | null;
    amount?: string | null;
    updatedAt: Date;
  }>;
}

export interface FollowupDraft {
  note: string;
  model: string;
}

/**
 * Drafts a follow-up note for one contact from local pipeline state. The
 * output is advisory: it lands in the CRM as a note for a human to act on,
 * never as an outbound message.
 */
export class FollowupDrafter {
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic(apiKey ? { apiKey } : undefined);
  }

  async draft(context: FollowupContext): Promise<FollowupDraft> {
    const model = config.anthropicModel();
    const name =
      [context.contact.firstName, context.contact.lastName].filter(Boolean).join(" ") ||
      context.contact.email ||
      `contact ${context.contact.id}`;

    const dealLines = context.deals.length
      ? context.deals
          .map(
            (deal) =>
              `- ${deal.name ?? "unnamed deal"} | stage: ${deal.stage ?? "unknown"} | amount: ${
                deal.amount ?? "unknown"
              } | last activity: ${deal.updatedAt.toISOString().slice(0, 10)}`,
          )
          .join("\n")
      : "- no open deals on record";

    const response = await this.client.messages.create({
      model,
      max_tokens: 600,
      system:
        "You draft internal CRM follow-up notes for a sales rep. Be specific and grounded in the pipeline data you are given. Never invent facts, prices, or commitments. Output only the note text: a short assessment of where this relationship stands, then a concrete suggested next step the rep could take this week. Plain text, no markdown, under 150 words.",
      messages: [
        {
          role: "user",
          content: `Contact: ${name}\nDeals:\n${dealLines}\n\nDraft the follow-up note.`,
        },
      ],
    });

    const note = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return { note, model };
  }
}
