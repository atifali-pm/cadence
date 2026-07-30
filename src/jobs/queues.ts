import { Queue } from "bullmq";
import { config } from "../config.js";

export const WEBHOOK_QUEUE = "webhook-events";

export interface WebhookJobData {
  eventId: string;
}

export function redisConnection() {
  const url = new URL(config.redisUrl());
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
  };
}

let webhookQueue: Queue<WebhookJobData> | undefined;

export function getWebhookQueue(): Queue<WebhookJobData> {
  webhookQueue ??= new Queue<WebhookJobData>(WEBHOOK_QUEUE, {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
  return webhookQueue;
}

export async function closeQueues(): Promise<void> {
  if (webhookQueue) {
    await webhookQueue.close();
    webhookQueue = undefined;
  }
}
