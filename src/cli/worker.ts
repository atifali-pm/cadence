import { loadEnv } from "../config.js";
import { createHubSpotProvider } from "../connectors/hubspot/index.js";
import { startWebhookWorker } from "../jobs/worker.js";

loadEnv();

const worker = startWebhookWorker(createHubSpotProvider());

worker.on("completed", (job) => {
  console.log(`processed webhook event ${job.data.eventId}`);
});
worker.on("failed", (job, error) => {
  console.error(`webhook event ${job?.data.eventId ?? "unknown"} failed: ${error.message}`);
});

console.log("webhook worker started");

async function shutdown(): Promise<void> {
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
