import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { runMigrations, seedIfEmpty } from "../../src/db/seed";
import { pool } from "../../src/db/pool";
import { DEMO_PASSWORD } from "../../src/data/mockData";

const PLANNER_EMAIL = "nusrat.jahan@supplynext.com";
const WAREHOUSE_EMAIL = "farzana.akter@supplynext.com";

async function loginAs(email: string): Promise<string> {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: DEMO_PASSWORD });
  return res.body.token;
}

let plannerToken: string;
let warehouseToken: string;

beforeAll(async () => {
  await runMigrations();
  await seedIfEmpty();
  plannerToken = await loginAs(PLANNER_EMAIL);
  warehouseToken = await loginAs(WAREHOUSE_EMAIL);
}, 30000);

afterAll(async () => {
  await pool.end();
});

describe("authentication", () => {
  it("rejects login with a wrong password", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: PLANNER_EMAIL, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("issues a JWT for correct credentials", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: PLANNER_EMAIL, password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user.role).toBe("sales_planner");
  });

  it("rejects a malformed login body (zod validation)", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it("blocks unauthenticated access to protected routes", async () => {
    const res = await request(app).get("/api/v1/products");
    expect(res.status).toBe(401);
  });

  it("allows authenticated access to protected routes", async () => {
    const res = await request(app).get("/api/v1/products").set("Authorization", `Bearer ${plannerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("role-based authorization", () => {
  it("lets a sales planner submit a forecast override", async () => {
    const res = await request(app)
      .post("/api/v1/forecast/SF-STD-16/override")
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ periodStart: "2026-07-27", overriddenQuantity: 400, reason: "Eid promotion expected" });
    expect(res.status).toBe(201);
    expect(res.body.overriddenBy).toBeDefined();
  });

  it("blocks a warehouse manager from submitting a forecast override", async () => {
    const res = await request(app)
      .post("/api/v1/forecast/SF-STD-16/override")
      .set("Authorization", `Bearer ${warehouseToken}`)
      .send({ periodStart: "2026-07-27", overriddenQuantity: 400, reason: "Eid promotion expected" });
    expect(res.status).toBe(403);
  });

  it("rejects an override missing a reason (zod validation)", async () => {
    const res = await request(app)
      .post("/api/v1/forecast/SF-STD-16/override")
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ periodStart: "2026-07-27", overriddenQuantity: 400 });
    expect(res.status).toBe(400);
  });

  it("lets a warehouse manager reconcile a cycle count", async () => {
    const res = await request(app)
      .post("/api/v1/inventory/reconcile")
      .set("Authorization", `Bearer ${warehouseToken}`)
      .send({ sku: "SF-STD-16", locationId: "WH-DHK-01", scannedQuantity: 42 });
    expect(res.status).toBe(200);
    expect(res.body.scannedQuantity).toBe(42);
  });

  it("blocks a sales planner from reconciling a cycle count", async () => {
    const res = await request(app)
      .post("/api/v1/inventory/reconcile")
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ sku: "SF-STD-16", locationId: "WH-DHK-01", scannedQuantity: 42 });
    expect(res.status).toBe(403);
  });

  it("lets a user view their own role's dashboard", async () => {
    const res = await request(app).get("/api/v1/dashboard/sales_planner").set("Authorization", `Bearer ${plannerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("blocks a non-executive from viewing another role's dashboard", async () => {
    const res = await request(app).get("/api/v1/dashboard/executive").set("Authorization", `Bearer ${plannerToken}`);
    expect(res.status).toBe(403);
  });
});
