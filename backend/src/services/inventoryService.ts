import { pool } from "../db/pool";
import { InventoryRecord, TransferRecommendation } from "../types";
import { getForecasts } from "./forecastService";
import { getProducts, getWarehouseLocationIds } from "./productService";

interface AuditEntry {
  sku: string;
  locationId: string;
  delta: number;
  user: string;
  reason: string;
  timestamp: string;
}

const Z_SAFETY_FACTOR = 1.28; // ~90% service level, matches the forecast confidence bands

// FR-IM-02: reorder point + safety stock from forecasted demand and lead time.
// Demand gets split evenly across warehouses since the factory doesn't sell direct to retail.
async function computeReorderParams(sku: string, leadTimeDays: number): Promise<{ reorderPoint: number; safetyStock: number }> {
  const [weekly] = await getForecasts(sku, "weekly");
  const warehouseCount = Math.max((await getWarehouseLocationIds()).length, 1);

  const avgDailyDemand = weekly ? weekly.predictedQuantity / 7 / warehouseCount : 5;
  const bandHalfWidth = weekly ? (weekly.confidenceHigh - weekly.confidenceLow) / 2 / 7 / warehouseCount : 1;

  const safetyStock = Math.round(Z_SAFETY_FACTOR * bandHalfWidth * Math.sqrt(leadTimeDays));
  const reorderPoint = Math.round(avgDailyDemand * leadTimeDays + safetyStock);

  return { reorderPoint, safetyStock };
}

export async function recomputeReorderParams(): Promise<void> {
  const products = await getProducts();
  for (const product of products) {
    const { reorderPoint, safetyStock } = await computeReorderParams(product.sku, product.leadTimeDays);
    await pool.query(
      `UPDATE inventory_records SET reorder_point = $1, safety_stock = $2 WHERE sku = $3`,
      [reorderPoint, safetyStock, product.sku]
    );
  }
}

export async function getInventory(locationId?: string, sku?: string): Promise<InventoryRecord[]> {
  const conditions: string[] = [];
  const params: string[] = [];
  if (locationId) {
    params.push(locationId);
    conditions.push(`ir.location_id = $${params.length}`);
  }
  if (sku) {
    params.push(sku);
    conditions.push(`ir.sku = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT ir.sku, ir.location_id AS "locationId", l.type AS "locationType",
            ir.quantity_on_hand AS "quantityOnHand", ir.reorder_point AS "reorderPoint",
            ir.safety_stock AS "safetyStock", ir.last_updated AS "lastUpdated"
     FROM inventory_records ir
     JOIN locations l ON l.id = ir.location_id
     ${where}
     ORDER BY ir.sku, ir.location_id`,
    params
  );
  return rows.map((r) => ({ ...r, lastUpdated: r.lastUpdated.toISOString() }));
}

// FR-IM-03: find over/understocked SKUs and suggest warehouse-to-warehouse transfers
// (factory stock isn't included, transfers here are warehouse only)
export async function getTransferRecommendations(): Promise<TransferRecommendation[]> {
  const products = await getProducts();
  const recs: TransferRecommendation[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const rows = await getInventory(undefined, product.sku);
    const warehouseRows = rows.filter((r) => r.locationType === "warehouse");
    if (warehouseRows.length < 2) continue;

    const overstocked = warehouseRows
      .filter((r) => r.quantityOnHand > r.reorderPoint + r.safetyStock * 2)
      .sort((a, b) => b.quantityOnHand - a.quantityOnHand);
    const understocked = warehouseRows
      .filter((r) => r.quantityOnHand < r.reorderPoint)
      .sort((a, b) => a.quantityOnHand - b.quantityOnHand);

    for (const short of understocked) {
      const source = overstocked.find((o) => o.locationId !== short.locationId);
      if (!source) continue;
      const surplus = source.quantityOnHand - (source.reorderPoint + source.safetyStock);
      const deficit = short.reorderPoint - short.quantityOnHand;
      const qty = Math.max(1, Math.min(surplus, deficit));
      if (qty <= 0) continue;

      recs.push({
        sku: product.sku,
        fromLocationId: source.locationId,
        toLocationId: short.locationId,
        recommendedQuantity: qty,
        reason: "understock_risk",
        createdAt: now,
      });
    }
  }
  return recs;
}

// FR-IM-04: compare a physical count to the system record, flag if variance is too high
export async function reconcileCount(
  sku: string,
  locationId: string,
  scannedQuantity: number,
  user: string,
  varianceThresholdPct = 5
): Promise<{ sku: string; locationId: string; systemQuantity: number; scannedQuantity: number; variancePct: number; flagged: boolean }> {
  const { rows } = await pool.query(
    `SELECT quantity_on_hand AS qty FROM inventory_records WHERE sku = $1 AND location_id = $2`,
    [sku, locationId]
  );
  if (rows.length === 0) throw new Error(`No inventory record for ${sku} at ${locationId}`);
  const currentQty: number = rows[0].qty;

  const delta = scannedQuantity - currentQty;
  const variancePct = currentQty === 0 ? 100 : Math.abs(delta / currentQty) * 100;
  const flagged = variancePct > varianceThresholdPct;

  await pool.query(
    `UPDATE inventory_records SET quantity_on_hand = $1, last_updated = now() WHERE sku = $2 AND location_id = $3`,
    [scannedQuantity, sku, locationId]
  );

  // FR-IM-05: audit trail of every inventory adjustment (user, timestamp, reason).
  await pool.query(
    `INSERT INTO inventory_audit_trail (sku, location_id, delta, user_id, reason)
     VALUES ($1,$2,$3,$4,$5)`,
    [sku, locationId, delta, user, flagged ? "cycle_count_variance_flagged" : "cycle_count_reconciled"]
  );

  return { sku, locationId, systemQuantity: scannedQuantity, scannedQuantity, variancePct, flagged };
}

export async function getAuditTrail(sku?: string): Promise<AuditEntry[]> {
  const { rows } = await pool.query(
    sku
      ? `SELECT sku, location_id AS "locationId", delta, user_id AS "user", reason, ts AS "timestamp"
         FROM inventory_audit_trail WHERE sku = $1 ORDER BY ts DESC`
      : `SELECT sku, location_id AS "locationId", delta, user_id AS "user", reason, ts AS "timestamp"
         FROM inventory_audit_trail ORDER BY ts DESC`,
    sku ? [sku] : []
  );
  return rows.map((r) => ({ ...r, timestamp: r.timestamp.toISOString() }));
}
