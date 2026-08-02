import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { InventoryRecord, TransferRecommendation, Location, Product, AuditEntry } from "../types";
import "./forecast-inventory.css";

function stockStatus(rec: InventoryRecord): "risk" | "warn" | "ok" {
  if (rec.quantityOnHand < rec.reorderPoint) return "risk";
  if (rec.quantityOnHand > rec.reorderPoint + rec.safetyStock * 2) return "warn";
  return "ok";
}

export function InventoryPage({
  products,
  locations,
  canReconcile,
}: {
  products: Product[];
  locations: Location[];
  canReconcile: boolean;
}) {
  const [inventory, setInventory] = useState<InventoryRecord[] | null>(null);
  const [transfers, setTransfers] = useState<TransferRecommendation[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [reconcileSku, setReconcileSku] = useState(products[0]?.sku ?? "");
  const [reconcileLoc, setReconcileLoc] = useState(locations[0]?.id ?? "");
  const [scannedQty, setScannedQty] = useState("");
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    setError(null);
    Promise.all([api.inventory(), api.transferRecommendations(), api.auditTrail()])
      .then(([inv, tr, at]) => {
        setInventory(inv);
        setTransfers(tr);
        setAudit(at);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
  const productName = (sku: string) => products.find((p) => p.sku === sku)?.name ?? sku;

  async function submitReconcile(e: React.FormEvent) {
    e.preventDefault();
    if (!reconcileSku || !reconcileLoc || scannedQty === "") return;
    setSubmitting(true);
    setReconcileMsg(null);
    setError(null);
    try {
      const result = await api.reconcile({
        sku: reconcileSku,
        locationId: reconcileLoc,
        scannedQuantity: Number(scannedQty),
      });
      setReconcileMsg(
        result.flagged
          ? `Variance ${result.variancePct.toFixed(1)}% flagged for review.`
          : `Reconciled — variance ${result.variancePct.toFixed(1)}%, within threshold.`
      );
      setScannedQty("");
      refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="section-heading">
        <span className="bracket">[03]</span>
        <h2>Inventory Analytics &middot; Factory &amp; Warehouse Stock</h2>
      </div>
      <p className="section-sub">
        Reorder points and safety stock (FR-IM-02) are derived from the current weekly forecast and each SKU's
        production lead time, split across warehouse sites.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel" style={{ marginBottom: 20 }}>
        <h3>Stock Positions</h3>
        <p className="panel-sub">FR-IM-01 &mdash; live stock ledger across factory and warehouse locations.</p>
        {!inventory && <div className="loading-line">Loading inventory&hellip;</div>}
        {inventory && (
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Location</th>
                <th>On Hand</th>
                <th>Reorder Pt.</th>
                <th>Safety Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((r, i) => {
                const status = stockStatus(r);
                return (
                  <tr key={i}>
                    <td className="mono">{r.sku}</td>
                    <td>
                      {locName(r.locationId)}{" "}
                      <span style={{ color: "var(--ink-muted)", fontSize: 11 }}>({r.locationType})</span>
                    </td>
                    <td className="mono">{r.quantityOnHand}</td>
                    <td className="mono">{r.reorderPoint}</td>
                    <td className="mono">{r.safetyStock}</td>
                    <td>
                      <span className={`tag tag-${status}`}>
                        {status === "risk" ? "understocked" : status === "warn" ? "overstocked" : "healthy"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="forecast-layout">
        <div className="panel">
          <h3>Transfer Recommendations</h3>
          <p className="panel-sub">FR-IM-03 &mdash; suggested inter-warehouse transfers to resolve stock imbalances.</p>
          {transfers.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>No transfers recommended right now.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr key={i}>
                    <td className="mono">{t.sku}</td>
                    <td>{locName(t.fromLocationId)}</td>
                    <td>{locName(t.toLocationId)}</td>
                    <td className="mono">{t.recommendedQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={{ marginTop: 22 }}>Audit Trail</h3>
          <p className="panel-sub">FR-IM-05 &mdash; every stock adjustment, logged with user and reason.</p>
          {audit.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>No adjustments logged yet this session.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Location</th>
                  <th>Δ</th>
                  <th>User</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {audit
                  .slice()
                  .reverse()
                  .map((a, i) => (
                    <tr key={i}>
                      <td className="mono">{a.sku}</td>
                      <td>{locName(a.locationId)}</td>
                      <td className="mono">{a.delta > 0 ? `+${a.delta}` : a.delta}</td>
                      <td className="mono">{a.user}</td>
                      <td>{a.reason.replace(/_/g, " ")}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3>Cycle Count Reconciliation</h3>
          <p className="panel-sub">
            FR-IM-04 &mdash; enter a physical scan count; variances over 5% are flagged automatically.
          </p>
          {!canReconcile ? (
            <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              Only Warehouse Managers (or Admin) can submit cycle counts.
            </p>
          ) : (
            <form className="override-form" onSubmit={submitReconcile}>
            <div className="field">
              <label>SKU</label>
              <select value={reconcileSku} onChange={(e) => setReconcileSku(e.target.value)}>
                {products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} &mdash; {productName(p.sku)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Location</label>
              <select value={reconcileLoc} onChange={(e) => setReconcileLoc(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Scanned quantity</label>
              <input type="number" min={0} value={scannedQty} onChange={(e) => setScannedQty(e.target.value)} required />
            </div>
            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Reconciling\u2026" : "Submit count"}
            </button>
            {reconcileMsg && <span className="confirm-line">{reconcileMsg}</span>}
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
