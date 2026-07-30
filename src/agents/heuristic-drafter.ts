import type { FollowupContext, FollowupDraft } from "./followup-drafter.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALLED_AFTER_DAYS = 14;

/**
 * Deterministic drafter used when no model key is configured (demo mode and
 * offline runs). Applies plain pipeline rules: how much is open, what has
 * gone quiet, and what to do about the oldest quiet deal first.
 */
export class HeuristicDrafter {
  async draft(context: FollowupContext): Promise<FollowupDraft> {
    const name =
      [context.contact.firstName, context.contact.lastName].filter(Boolean).join(" ") ||
      context.contact.email ||
      `contact ${context.contact.id}`;

    if (context.deals.length === 0) {
      return {
        note: `${name} has no open deals on record. Suggested next step: a light check-in to confirm whether there is an active buying conversation worth tracking here.`,
        model: "heuristic",
      };
    }

    const now = Date.now();
    const enriched = context.deals.map((deal) => {
      const idleDays = Math.floor((now - deal.updatedAt.getTime()) / DAY_MS);
      return { ...deal, idleDays };
    });
    const stalled = enriched
      .filter((deal) => deal.idleDays >= STALLED_AFTER_DAYS)
      .sort((a, b) => b.idleDays - a.idleDays);
    const totalOpen = enriched.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0);

    const summary = `${name} has ${enriched.length} open deal${
      enriched.length === 1 ? "" : "s"
    } worth about ${totalOpen.toLocaleString("en-US")} in total.`;

    if (stalled.length === 0) {
      const freshest = enriched.sort((a, b) => a.idleDays - b.idleDays)[0]!;
      return {
        note: `${summary} Activity is current; the most recent movement was on ${
          freshest.name ?? "the newest deal"
        } (${freshest.idleDays} day${freshest.idleDays === 1 ? "" : "s"} ago, stage ${
          freshest.stage ?? "unknown"
        }). Suggested next step: keep the agreed cadence and confirm the next milestone date on that deal this week.`,
        model: "heuristic",
      };
    }

    const worst = stalled[0]!;
    return {
      note: `${summary} ${worst.name ?? "One deal"} has had no activity for ${
        worst.idleDays
      } days at stage ${worst.stage ?? "unknown"}${
        stalled.length > 1 ? `, and ${stalled.length - 1} more deal(s) are also quiet` : ""
      }. Suggested next step: reopen the thread on that deal this week with a specific ask tied to its stage, and set a task with a due date so it cannot go quiet again.`,
      model: "heuristic",
    };
  }
}
