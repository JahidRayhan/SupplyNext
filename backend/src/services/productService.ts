import { pool } from "../db/pool";
import { Product, Location, LocationType } from "../types";

export async function getProducts(): Promise<Product[]> {
  const { rows } = await pool.query(
    `SELECT sku, name, category, unit_cost::float AS "unitCost", lead_time_days AS "leadTimeDays" FROM products ORDER BY sku`
  );
  return rows;
}

export async function getProductBySku(sku: string): Promise<Product | null> {
  const { rows } = await pool.query(
    `SELECT sku, name, category, unit_cost::float AS "unitCost", lead_time_days AS "leadTimeDays" FROM products WHERE sku = $1`,
    [sku]
  );
  return rows[0] ?? null;
}

export async function getLocations(): Promise<Location[]> {
  const { rows } = await pool.query(`SELECT id, type, name FROM locations ORDER BY id`);
  return rows;
}

export async function getWarehouseLocationIds(): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM locations WHERE type = 'warehouse' ORDER BY id`);
  return rows.map((r) => r.id);
}

export async function getRetailPartners(): Promise<{ id: string; name: string }[]> {
  const { rows } = await pool.query(`SELECT id, name FROM retail_partners ORDER BY id`);
  return rows;
}

export type { LocationType };
