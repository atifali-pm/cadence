import Fastify, { type FastifyInstance } from "fastify";
import { config } from "../config.js";
import { getDb, schema } from "../db/client.js";
import { getWebhookQueue } from "../jobs/queues.js";
import { verifyHubSpotSignature } from "../webhooks/verify.js";

interface HubSpotWebhookEvent {
  eventId: number | string;
  subscriptionType: string;
  objectId: number | string;
  [key: string]: unknown;
}

/**
 * Builds the Fastify instance. The webhook receiver validates the request
 * signature against the raw body before anything is parsed or persisted.
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  // The signature covers the exact bytes HubSpot sent, so the raw string is
  // kept alongside the parsed payload.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      try {
        const raw = body as string;
        done(null, { raw, parsed: raw.length > 0 ? JSON.parse(raw) : null });
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  app.get("/healthz", async () => {
    return { status: "ok", service: "cadence" };
  });

  app.post("/webhooks/hubspot", async (request, reply) => {
    const { raw, parsed } = request.body as { raw: string; parsed: unknown };

    const clientSecret = config.hubspotClientSecret();
    if (!clientSecret) {
      request.log.error("HUBSPOT_CLIENT_SECRET is not configured");
      return reply.status(503).send({ error: "webhook verification unavailable" });
    }

    const valid = verifyHubSpotSignature({
      method: "POST",
      url: config.webhookPublicUrl(),
      body: raw,
      signature: request.headers["x-hubspot-signature-v3"] as string | undefined,
      timestamp: request.headers["x-hubspot-request-timestamp"] as string | undefined,
      clientSecret,
    });
    if (!valid) {
      return reply.status(401).send({ error: "invalid signature" });
    }

    const events = Array.isArray(parsed) ? (parsed as HubSpotWebhookEvent[]) : [];
    const db = getDb();
    const queue = getWebhookQueue();
    let accepted = 0;

    for (const event of events) {
      if (event.eventId === undefined || !event.subscriptionType) continue;
      const eventId = String(event.eventId);
      const inserted = await db
        .insert(schema.webhookEvents)
        .values({
          eventId,
          subscriptionType: event.subscriptionType,
          objectId: String(event.objectId ?? ""),
          payload: event,
        })
        .onConflictDoNothing({ target: schema.webhookEvents.eventId })
        .returning({ id: schema.webhookEvents.id });

      // Duplicate deliveries are acknowledged but not re-queued.
      if (inserted.length > 0) {
        await queue.add("webhook-event", { eventId });
        accepted += 1;
      }
    }

    return reply.status(200).send({ received: events.length, accepted });
  });

  return app;
}
