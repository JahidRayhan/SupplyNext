import "dotenv/config";
import { app } from "./app";
import { runMigrations, seedIfEmpty } from "./db/seed";
import { recomputeReorderParams } from "./services/inventoryService";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

async function start() {
  console.log("Running database migrations...");
  await runMigrations();
  await seedIfEmpty();
  await recomputeReorderParams();

  app.listen(PORT, () => {
    console.log(`SDCIP backend listening on http://localhost:${PORT}`);
    console.log(`Login first: POST http://localhost:${PORT}/api/v1/auth/login`);
  });
}

start().catch((err) => {
  console.error("Failed to start SDCIP backend:", err);
  process.exit(1);
});
