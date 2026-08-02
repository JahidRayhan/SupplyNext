import { pool } from "../db/pool";
import { IoTSensorEvent } from "../types";
import { updateShipmentStatus, getShipment } from "./shipmentService";

function rowToEvent(row: any): IoTSensorEvent {
  return {
    deviceId: row.device_id,
    eventType: row.event_type,
    sku: row.sku ?? undefined,
    shipmentId: row.shipment_id ?? undefined,
    value: row.value != null ? Number(row.value) : undefined,
    latitude: row.latitude != null ? Number(row.latitude) : undefined,
    longitude: row.longitude != null ? Number(row.longitude) : undefined,
    timestamp: row.ts.toISOString(),
    synced: row.synced,
  };
}

// logs a sensor/manual event. if it's an rfid scan or gps ping on a pending
// shipment, that counts as proof it left, so we bump status to in_transit
export async function ingestEvent(input: {
  deviceId: string;
  eventType: IoTSensorEvent["eventType"];
  sku?: string;
  shipmentId?: string;
  value?: number;
  latitude?: number;
  longitude?: number;
  recordedBy: string;
  synced?: boolean;
}): Promise<IoTSensorEvent> {
  const { rows } = await pool.query(
    `INSERT INTO iot_sensor_events (device_id, event_type, sku, shipment_id, value, latitude, longitude, synced, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.deviceId,
      input.eventType,
      input.sku ?? null,
      input.shipmentId ?? null,
      input.value ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.synced ?? true,
      input.recordedBy,
    ]
  );

  if (input.shipmentId && (input.eventType === "rfid_scan" || input.eventType === "gps_ping")) {
    const shipment = await getShipment(input.shipmentId);
    if (shipment && shipment.status === "pending") {
      await updateShipmentStatus(input.shipmentId, "in_transit");
    }
  }

  return rowToEvent(rows[0]);
}

export async function listEvents(filter?: { shipmentId?: string; sku?: string }): Promise<IoTSensorEvent[]> {
  const conditions: string[] = [];
  const params: string[] = [];
  if (filter?.shipmentId) {
    params.push(filter.shipmentId);
    conditions.push(`shipment_id = $${params.length}`);
  }
  if (filter?.sku) {
    params.push(filter.sku);
    conditions.push(`sku = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT * FROM iot_sensor_events ${where} ORDER BY ts DESC LIMIT 200`,
    params
  );
  return rows.map(rowToEvent);
}
