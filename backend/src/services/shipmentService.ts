import { pool } from "../db/pool";
import { Shipment } from "../types";

function rowToShipment(row: any): Shipment {
  return {
    id: row.id,
    sku: row.sku,
    quantity: row.quantity,
    originLocationId: row.origin_location_id,
    destinationRetailPartnerId: row.destination_retail_partner_id,
    status: row.status,
    expectedDelivery: row.expected_delivery.toISOString().slice(0, 10),
    actualDelivery: row.actual_delivery ? row.actual_delivery.toISOString().slice(0, 10) : undefined,
  };
}

export async function listShipments(filter?: { status?: string; sku?: string }): Promise<Shipment[]> {
  const conditions: string[] = [];
  const params: string[] = [];
  if (filter?.status) {
    params.push(filter.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filter?.sku) {
    params.push(filter.sku);
    conditions.push(`sku = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT * FROM shipments ${where} ORDER BY expected_delivery DESC, id DESC`,
    params
  );
  return rows.map(rowToShipment);
}

export async function getShipment(id: string): Promise<Shipment | null> {
  const { rows } = await pool.query(`SELECT * FROM shipments WHERE id = $1`, [id]);
  return rows[0] ? rowToShipment(rows[0]) : null;
}

let shipmentCounter: number | null = null;
async function nextShipmentId(): Promise<string> {
  if (shipmentCounter === null) {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM shipments`);
    shipmentCounter = rows[0].n as number;
  }
  shipmentCounter = (shipmentCounter as number) + 1;
  return `SHP-${String(shipmentCounter).padStart(4, "0")}`;
}

export async function createShipment(input: {
  sku: string;
  quantity: number;
  originLocationId: string;
  destinationRetailPartnerId: string;
  expectedDelivery: string;
  createdBy: string;
}): Promise<Shipment> {
  const id = await nextShipmentId();
  const { rows } = await pool.query(
    `INSERT INTO shipments (id, sku, quantity, origin_location_id, destination_retail_partner_id, status, expected_delivery, created_by)
     VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
     RETURNING *`,
    [id, input.sku, input.quantity, input.originLocationId, input.destinationRetailPartnerId, input.expectedDelivery, input.createdBy]
  );
  return rowToShipment(rows[0]);
}

export async function updateShipmentStatus(
  id: string,
  status: Shipment["status"],
  actualDelivery?: string
): Promise<Shipment | null> {
  const { rows } = await pool.query(
    `UPDATE shipments
     SET status = $1, actual_delivery = COALESCE($2, actual_delivery), updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [status, actualDelivery ?? null, id]
  );
  return rows[0] ? rowToShipment(rows[0]) : null;
}

// on-time % only counts delivered shipments (actual_delivery <= expected_delivery)
export async function getLogisticsKpis(): Promise<{
  trackedShipments: number;
  inTransit: number;
  delayed: number;
  onTimeDeliveryPct: number;
}> {
  const { rows: statusCounts } = await pool.query(
    `SELECT status, count(*)::int AS n FROM shipments GROUP BY status`
  );
  const counts: Record<string, number> = {};
  for (const r of statusCounts) counts[r.status] = r.n;

  const { rows: deliveredRows } = await pool.query(
    `SELECT expected_delivery, actual_delivery FROM shipments WHERE status = 'delivered' AND actual_delivery IS NOT NULL`
  );
  const onTimeCount = deliveredRows.filter((r) => r.actual_delivery <= r.expected_delivery).length;
  const onTimeDeliveryPct = deliveredRows.length > 0 ? Math.round((onTimeCount / deliveredRows.length) * 100) : 100;

  const trackedShipments = (counts["pending"] ?? 0) + (counts["in_transit"] ?? 0) + (counts["delayed"] ?? 0);

  return {
    trackedShipments,
    inTransit: counts["in_transit"] ?? 0,
    delayed: counts["delayed"] ?? 0,
    onTimeDeliveryPct,
  };
}
