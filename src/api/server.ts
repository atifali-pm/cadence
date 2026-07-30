import Fastify, { type FastifyInstance } from "fastify";

/**
 * Builds the Fastify instance. Phase 0 hello-world: a single health route.
 * The real REST surface (read-only pipeline views, webhook receiver) arrives
 * in later phases and mounts here.
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
