/**
 * Thin HTTP layer for the HubSpot v3 API. Owns auth, rate-limit handling, and
 * retries so the provider can stay declarative about endpoints.
 */

export interface HubSpotHttpOptions {
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  /** Base backoff in ms; grows exponentially per attempt. Overridable in tests. */
  backoffMs?: number;
}

export class HubSpotApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string,
  ) {
    super(message ?? `HubSpot API responded ${status}`);
    this.name = "HubSpotApiError";
  }
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export class HubSpotHttp {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly backoffMs: number;

  constructor(options: HubSpotHttpOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl ?? "https://api.hubapi.com";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? 4;
    this.backoffMs = options.backoffMs ?? 500;
  }

  async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let attempt = 0;
    for (;;) {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      }

      const bodyText = await response.text();
      if (!RETRYABLE.has(response.status) || attempt >= this.maxRetries) {
        throw new HubSpotApiError(response.status, bodyText);
      }

      // 429 responses carry Retry-After in seconds; honor it when present.
      const retryAfter = response.headers.get("retry-after");
      const waitMs = retryAfter
        ? Number(retryAfter) * 1000
        : this.backoffMs * 2 ** attempt;
      await sleep(waitMs);
      attempt += 1;
    }
  }

  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
