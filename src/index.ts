import { buildServer } from "./api/server.js";

const PORT = Number(process.env.PORT ?? 8040);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main(): Promise<void> {
  const app = buildServer();
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
