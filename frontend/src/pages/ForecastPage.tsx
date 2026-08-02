import { useEffect, useState } from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { api } from "../api/client";
import type { ForecastResult, ForecastOverride, Product } from "../types";
import "./forecast-inventory.css";

export function ForecastPage({ products, canOverride }: { products: Product[]; canOverride: boolean }) {
  const [selectedSku, setSelectedSku] = useState<string>(products[0]?.sku ?? "");
  const [forecasts, setForecasts] = useState<ForecastResult[] | null>(null);
  const [history, setHistory] = useState<{ date: string; quantity: number }[] | null>(null);
  const [overrides, setOverrides] = useState<ForecastOverride[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [overrideQty, setOverrideQty] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSku) return;
    setForecasts(null);
    setError(null);
    setConfirmMsg(null);
    Promise.all([api.forecasts(selectedSku), api.salesDaily(selectedSku), api.overrideHistory(selectedSku)])
      .then(([f, h, o]) => {
        setForecasts(f);
        setHistory(h);
        setOverrides(o);
      })
      .catch((err) => setError(err.message));
  }, [selectedSku]);

  const weekly = forecasts?.find((f) => f.horizon === "weekly");
  const monthly = forecasts?.find((f) => f.horizon === "monthly");

  const chartData = (history ?? []).map((h) => ({ date: h.date.slice(5), actual: h.quantity }));
  if (weekly && chartData.length > 0) {
    const avgDaily = weekly.predictedQuantity / 7;
    chartData.push({ date: "next 7d avg", actual: undefined as unknown as number, forecast: Math.round(avgDaily) } as any);
  }

  async function submitOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!weekly || !overrideQty || !overrideReason) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.overrideForecast(selectedSku, {
        periodStart: weekly.periodStart,
        overriddenQuantity: Number(overrideQty),
        reason: overrideReason,
      });
      const [o] = await Promise.all([api.overrideHistory(selectedSku)]);
      setOverrides(o);
      setConfirmMsg("Override recorded and logged for model retraining.");
      setOverrideQty("");
      setOverrideReason("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="section-heading">
        <span className="bracket">[02]</span>
        <h2>Demand Forecasting &middot; Smart Fan Line</h2>
      </div>
      <p className="section-sub">Trailing-28-day model, recomputed per SKU. Weekly and monthly horizons with confidence bands (FR-DF-02/03).</p>

      <div className="sku-select-row">
        {products.map((p) => (
          <button
            key={p.sku}
            className={`sku-chip ${p.sku === selectedSku ? "active" : ""}`}
            onClick={() => setSelectedSku(p.sku)}
          >
            {p.sku}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!forecasts && !error && <div className="loading-line">Loading forecast&hellip;</div>}

      {forecasts && weekly && monthly && (
        <div className="forecast-layout">
          <div className="panel">
            <h3>{products.find((p) => p.sku === selectedSku)?.name}</h3>
            <p className="panel-sub">Trailing daily demand (units) &middot; model {weekly.modelVersion}</p>

            <div className="forecast-readout-row">
              <div className="readout">
                <span className="readout-label">Next 7 Days</span>
                <span className="readout-value">
                  {weekly.predictedQuantity} <span className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>units</span>
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-muted)" }} className="mono">
                  range {weekly.confidenceLow}&ndash;{weekly.confidenceHigh}
                </span>
              </div>
              <div className="readout">
                <span className="readout-label">Next 30 Days</span>
                <span className="readout-value">
                  {monthly.predictedQuantity} <span className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>units</span>
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-muted)" }} className="mono">
                  range {monthly.confidenceLow}&ndash;{monthly.confidenceHigh}
                </span>
              </div>
            </div>
            {weekly.highUncertainty && <span className="uncertainty-flag">⚠ high forecast uncertainty this period</span>}

            <div style={{ height: 220, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} interval={4} />
                  <YAxis tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} width={34} />
                  <Tooltip contentStyle={{ fontSize: 12, fontFamily: "IBM Plex Sans" }} />
                  <Area type="monotone" dataKey="actual" stroke="#1f7a68" fill="#e2f2ee" strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="forecast" stroke="#e08a2b" strokeWidth={0} dot={{ r: 4, fill: "#e08a2b" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <h3>Planner Override</h3>
            <p className="panel-sub">
              FR-DF-04 &mdash; overriding the weekly figure requires a documented reason; overrides are logged for model
              retraining.
            </p>
            {!canOverride ? (
              <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                Only Sales &amp; Demand Planners (or Admin) can submit overrides. You can still view forecast history
                below.
              </p>
            ) : (
              <form className="override-form" onSubmit={submitOverride}>
              <div className="field-row">
                <div className="field">
                  <label>Period start</label>
                  <input value={weekly.periodStart} disabled className="mono" />
                </div>
                <div className="field">
                  <label>Overridden quantity (units)</label>
                  <input
                    type="number"
                    min={0}
                    value={overrideQty}
                    onChange={(e) => setOverrideQty(e.target.value)}
                    placeholder={String(weekly.predictedQuantity)}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label>Reason</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Eid promotion expected to lift demand ~35%"
                  required
                />
              </div>
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Saving\u2026" : "Save override"}
              </button>
              {confirmMsg && <span className="confirm-line">{confirmMsg}</span>}
            </form>
            )}
            {overrides.length > 0 && (
              <>
                <h3 style={{ marginTop: 22 }}>Override History</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Qty</th>
                      <th>By</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overrides.map((o, i) => (
                      <tr key={i}>
                        <td className="mono">{o.periodStart}</td>
                        <td className="mono">{o.overriddenQuantity}</td>
                        <td className="mono">{o.overriddenBy}</td>
                        <td>{o.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
