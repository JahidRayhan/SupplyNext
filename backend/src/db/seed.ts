import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./pool";
import {
  products,
  locations,
  retailPartners,
  users,
  salesHistory,
  inventoryRecords,
  shipments,
  iotSensorEvents,
} from "../data/mockData";

export async function runMigrations(): Promise<void> {
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  await pool.query(schema);
}
// only seeds if products table is empty, so restarts don't wipe real data
export async function seedIfEmpty(): Promise<void> {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM products");
  if (rows[0].n > 0) {
    console.log("Database already seeded, skipping mock data load.");
    return;
  }

  console.log("Seeding pilot mock data into Postgres...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, name, role, email, password_hash) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.role, u.email, u.passwordHash]
      );
    }

    for (const p of products) {
      await client.query(
        `INSERT INTO products (sku, name, category, unit_cost, lead_time_days) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (sku) DO NOTHING`,
        [p.sku, p.name, p.category, p.unitCost, p.leadTimeDays]
      );
    }

    for (const l of locations) {
      await client.query(
        `INSERT INTO locations (id, type, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
        [l.id, l.type, l.name]
      );
    }

    for (const rp of retailPartners) {
      await client.query(
        `INSERT INTO retail_partners (id, name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
        [rp.id, rp.name]
      );
    }

    for (const s of salesHistory) {
      await client.query(
        `INSERT INTO sales_records (id, sku, retail_partner_id, quantity_sold, sale_date, region)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.sku, s.retailPartnerId, s.quantitySold, s.saleDate, s.region]
      );
    }

    for (const inv of inventoryRecords) {
      await client.query(
        `INSERT INTO inventory_records (sku, location_id, quantity_on_hand, reorder_point, safety_stock, last_updated)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (sku, location_id) DO NOTHING`,
        [inv.sku, inv.locationId, inv.quantityOnHand, inv.reorderPoint, inv.safetyStock, inv.lastUpdated]
      );
    }

    for (const sh of shipments) {
      await client.query(
        `INSERT INTO shipments (id, sku, quantity, origin_location_id, destination_retail_partner_id, status, expected_delivery, actual_delivery)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [sh.id, sh.sku, sh.quantity, sh.originLocationId, sh.destinationRetailPartnerId, sh.status, sh.expectedDelivery, sh.actualDelivery ?? null]
      );
    }

    for (const ev of iotSensorEvents) {
      await client.query(
        `INSERT INTO iot_sensor_events (device_id, event_type, sku, shipment_id, value, latitude, longitude, ts, synced)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [ev.deviceId, ev.eventType, ev.sku ?? null, ev.shipmentId ?? null, ev.value ?? null, ev.latitude ?? null, ev.longitude ?? null, ev.timestamp, ev.synced]
      );
    }

    await client.query("COMMIT");
    console.log("Seed complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
