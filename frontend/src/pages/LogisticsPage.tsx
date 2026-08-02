import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Shipment, ShipmentStatus, IoTSensorEvent, SensorEventType, Product, Location, RetailPartner, LogisticsKpis } from "../types";
import "./forecast-inventory.css";
import "./logistics.css";

const STATUS_OPTIONS: ShipmentStatus[] = ["pending", "in_transit", "delivered", "delayed"];
const EVENT_TYPES: SensorEventType[] = ["rfid_scan", "gps_ping", "temperature", "humidity"];

export function LogisticsPage({
  products,
  locations,
  canManage,
}: {
  products: Product[];
  locations: Location[];
  canManage: boolean;
}) {
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [kpis, setKpis] = useState<LogisticsKpis | null>(null);
  const [events, setEvents] = useState<IoTSensorEvent[]>([]);
  const [retailPartners, setRetailPartners] = useState<RetailPartner[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create-shipment form
  const [newSku, setNewSku] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newDest, setNewDest] = useState("");
  const [newExpected, setNewExpected] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  // Manual IoT event form
  const [eventDeviceId, setEventDeviceId] = useState("");
  const [eventType, setEventType] = useState<SensorEventType>("rfid_scan");
  const [eventShipmentId, setEventShipmentId] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  function refresh() {
    setError(null);
    Promise.all([api.shipments(), api.shipmentKpis(), api.iotEvents(), api.retailPartners()])
      .then(([s, k, e, rp]) => {
        setShipments(s);
        setKpis(k);
        setEvents(e);
        setRetailPartners(rp);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh();
    // poll every 4s so shipment/simulator activity shows up without a manual refresh
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!newSku && products.length > 0) setNewSku(products[0].sku);
    if (!newDest && retailPartners.length > 0) setNewDest(retailPartners[0].id);
  }, [products, retailPartners]);

  const partnerName = (id: string) => retailPartners.find((p) => p.id === id)?.name ?? id;
  const productLabel = (sku: string) => products.find((p) => p.sku === sku)?.name ?? sku;

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newSku || !newQty || !newDest || !newExpected) return;
    setCreating(true);
    setCreateMsg(null);
    setError(null);
    try {
      const shipment = await api.createShipment({
        sku: newSku,
        quantity: Number(newQty),
        originLocationId: locations.find((l) => l.type === "factory")?.id ?? locations[0].id,
        destinationRetailPartnerId: newDest,
        expectedDelivery: newExpected,
      });
      setCreateMsg(`Created ${shipment.id}.`);
      setNewQty("");
      setNewExpected("");
      refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(id: string, status: ShipmentStatus) {
    setError(null);
    try {
      const actualDelivery = status === "delivered" ? new Date().toISOString().slice(0, 10) : undefined;
      await api.updateShipmentStatus(id, status, actualDelivery);
      refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventDeviceId || !eventShipmentId) return;
    setIngesting(true);
    setIngestMsg(null);
    setError(null);
    try {
      await api.ingestIotEvent({ deviceId: eventDeviceId, eventType, shipmentId: eventShipmentId });
      setIngestMsg("Event recorded. A dispatch scan or GPS ping auto-advances a pending shipment to in-transit.");
      setEventDeviceId("");
      refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div>
      <div className="section-heading">
        <span className="bracket">[04]</span>
        <h2>Logistics &amp; IoT Tracking</h2>
      </div>
      <p className="section-sub">
        Release 2 &mdash; shipment tracking backed by Postgres, plus manual-entry IoT ingestion (RFID/GPS/condition
        readings). A dispatch scan or GPS ping on a pending shipment auto-advances it to in-transit.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {kpis && (
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          <div className="kpi-card status-ok">
            <div className="kpi-name">Tracked Shipments</div>
            <div className="kpi-value-row"><span className="kpi-value">{kpis.trackedShipments}</span></div>
          </div>
          <div className="kpi-card status-warn">
            <div className="kpi-name">In Transit</div>
            <div className="kpi-value-row"><span className="kpi-value">{kpis.inTransit}</span></div>
          </div>
          <div className={`kpi-card ${kpis.delayed > 0 ? "status-risk" : "status-ok"}`}>
            <div className="kpi-name">Delayed</div>
            <div className="kpi-value-row"><span className="kpi-value">{kpis.delayed}</span></div>
          </div>
          <div className={`kpi-card ${kpis.onTimeDeliveryPct >= 90 ? "status-ok" : "status-warn"}`}>
            <div className="kpi-name">On-Time Delivery</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{kpis.onTimeDeliveryPct}</span>
              <span className="kpi-unit">%</span>
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 20 }}>
        <h3>Shipments</h3>
        <p className="panel-sub">Pending &rarr; In Transit &rarr; Delivered/Delayed. Status can also be advanced automatically by an IoT event.</p>
        {!shipments && <div className="loading-line">Loading shipments&hellip;</div>}
        {shipments && (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Destination</th>
                <th>Expected</th>
                <th>Actual</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.id}</td>
                  <td className="mono">{s.sku}</td>
                  <td className="mono">{s.quantity}</td>
                  <td>{partnerName(s.destinationRetailPartnerId)}</td>
                  <td className="mono">{s.expectedDelivery}</td>
                  <td className="mono">{s.actualDelivery ?? "\u2014"}</td>
                  <td>
                    {canManage ? (
                      <div className="status-select-row">
                        <span className={`status-badge status-${s.status}`}>{s.status.replace("_", " ")}</span>
                        <select value={s.status} onChange={(e) => changeStatus(s.id, e.target.value as ShipmentStatus)}>
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>
                              {st.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className={`status-badge status-${s.status}`}>{s.status.replace("_", " ")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="forecast-layout">
        <div className="panel">
          <h3>{canManage ? "Create Shipment" : "Create Shipment (restricted)"}</h3>
          <p className="panel-sub">Manual dispatch entry (FR-LG-01). Origin defaults to the Dhaka Factory.</p>
          {!canManage ? (
            <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              Only Logistics Coordinators (or Admin) can create shipments.
            </p>
          ) : (
            <form className="override-form" onSubmit={submitCreate}>
              <div className="field-row">
                <div className="field">
                  <label>SKU</label>
                  <select value={newSku} onChange={(e) => setNewSku(e.target.value)}>
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.sku}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Quantity</label>
                  <input type="number" min={1} value={newQty} onChange={(e) => setNewQty(e.target.value)} required />
                </div>
              </div>
              <div className="field">
                <label>Destination retail partner</label>
                <select value={newDest} onChange={(e) => setNewDest(e.target.value)}>
                  {retailPartners.map((rp) => (
                    <option key={rp.id} value={rp.id}>
                      {rp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Expected delivery date</label>
                <input type="date" value={newExpected} onChange={(e) => setNewExpected(e.target.value)} required />
              </div>
              <button className="btn-primary" type="submit" disabled={creating}>
                {creating ? "Creating\u2026" : "Create shipment"}
              </button>
              {createMsg && <span className="confirm-line">{createMsg}</span>}
            </form>
          )}
        </div>

        <div className="panel">
          <h3>IoT / Manual Sensor Entry</h3>
          <p className="panel-sub">
            Manual fallback for RFID/GPS/condition data until full device rollout. Same endpoint doubles as the future
            device webhook target.
          </p>
          {canManage && (
            <form className="override-form" onSubmit={submitEvent} style={{ marginBottom: 18 }}>
              <div className="field-row">
                <div className="field">
                  <label>Device ID</label>
                  <input value={eventDeviceId} onChange={(e) => setEventDeviceId(e.target.value)} placeholder="RFID-GATE-01" required />
                </div>
                <div className="field">
                  <label>Event type</label>
                  <select value={eventType} onChange={(e) => setEventType(e.target.value as SensorEventType)}>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Shipment</label>
                <select value={eventShipmentId} onChange={(e) => setEventShipmentId(e.target.value)} required>
                  <option value="">Select a shipment&hellip;</option>
                  {(shipments ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} &middot; {s.sku} &middot; {s.status}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" type="submit" disabled={ingesting}>
                {ingesting ? "Recording\u2026" : "Record event"}
              </button>
              {ingestMsg && <span className="confirm-line">{ingestMsg}</span>}
            </form>
          )}

          <h3>Recent Events</h3>
          <div className="event-feed">
            {events.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>No events recorded yet.</p>}
            {events.map((ev, i) => (
              <div className="event-row" key={i}>
                <span className="event-type-tag">{ev.eventType.replace("_", " ")}</span>
                <span className="mono" style={{ color: "var(--ink-muted)" }}>
                  {new Date(ev.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span>{ev.shipmentId ?? productLabel(ev.sku ?? "")}</span>
                <span style={{ color: "var(--ink-muted)" }}>{ev.deviceId}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
