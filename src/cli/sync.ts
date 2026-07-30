import { loadEnv } from "../config.js";
import { requireHubSpotProvider } from "../connectors/hubspot/index.js";
import { closeDb } from "../db/client.js";
import { SyncService } from "../sync/sync-service.js";

loadEnv();

async function main(): Promise<void> {
  const provider = requireHubSpotProvider();
  const syncService = new SyncService(provider);

  const contacts = await syncService.syncContacts();
  console.log(
    `contacts: pulled ${contacts.pulled}, watermark ${contacts.watermark ?? "none"}`,
  );

  const deals = await syncService.syncDeals();
  console.log(`deals: pulled ${deals.pulled}, watermark ${deals.watermark ?? "none"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
