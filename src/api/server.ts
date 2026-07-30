import Fastify, { type FastifyInstance } from "fastify";

/**
 * Builds the Fastify instance. The REST surface (read-only pipeline views,
 * webhook receiver) mounts here.
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.get("/healthz", async () => {
    return { status: "ok", service: "cadence" };
  });

  return app;
}
