import "./KpiCard.css";
import type { DashboardKPI } from "../types";

function statusFor(kpi: DashboardKPI): "ok" | "warn" | "risk" {
  if (kpi.target === undefined) return "ok";
  if (kpi.target === 0) return kpi.value === 0 ? "ok" : "risk";
  if (kpi.value >= kpi.target) return "ok";
  if (kpi.value >= kpi.target * 0.85) return "warn";
  return "risk";
}

export function KpiCard({ kpi }: { kpi: DashboardKPI }) {
  const status = statusFor(kpi);
  const asOfTime = new Date(kpi.asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`kpi-card status-${status}`}>
      <div className="kpi-name">{kpi.name}</div>
      <div className="kpi-value-row">
        <span className="kpi-value">{kpi.value.toLocaleString()}</span>
        <span className="kpi-unit">{kpi.unit}</span>
      </div>
      <div className="kpi-foot">
        <span className={`trend-${kpi.trend}`}>{kpi.trend}</span>
        <span>{kpi.target !== undefined ? `target ${kpi.target}${kpi.unit === "%" ? "%" : ""}` : `as of ${asOfTime}`}</span>
      </div>
    </div>
  );
}
