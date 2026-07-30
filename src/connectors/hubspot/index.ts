import { config } from "../../config.js";
import { HubSpotHttp } from "./http.js";
import { HubSpotProvider } from "./hubspot-provider.js";

/** Returns a configured provider, or undefined when no token is present. */
export function createHubSpotProvider(): HubSpotProvider | undefined {
  const token = config.hubspotToken();
  if (!token) return undefined;
  return new HubSpotProvider(new HubSpotHttp({ token }));
}

export function requireHubSpotProvider(): HubSpotProvider {
  const provider = createHubSpotProvider();
  if (!provider) {
    throw new Error(
      "HUBSPOT_PRIVATE_APP_TOKEN is not set. Copy .env.example to .env and fill it in.",
    );
  }
  return provider;
}
