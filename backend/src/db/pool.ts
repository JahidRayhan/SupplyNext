import { Pool } from "pg";

// hosted postgres (Neon etc) needs SSL but their certs aren't in Node's CA
// store, so rejectUnauthorized: false. set PGSSL=false to turn it off for local pg
const useSsl = process.env.PGSSL === "false" ? false : Boolean(process.env.DATABASE_URL) || process.env.PGSSL === "true";

// falls back to local dev defaults if there's no DATABASE_URL
export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    })
  : new Pool({
      host: process.env.PGHOST ?? "localhost",
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      database: process.env.PGDATABASE ?? "sdcip",
      user: process.env.PGUSER ?? "sdcip",
      password: process.env.PGPASSWORD ?? "sdcip_dev_pw",
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});
