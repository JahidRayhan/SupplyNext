import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { DashboardKPI, UserRole } from "../types";
import { KpiCard } from "../components/KpiCard";

const ROLE_LABELS: Record<UserRole, string> = {
  sales_planner: "Sales & Demand Planner",
  production_manager: "Production Manager",
  warehouse_manager: "Warehouse Manager",
  logistics_coordinator: "Logistics Coordinator",
  executive: "Executive",
  admin: "System Admin",
};

export function DashboardPage({ role }: { role: UserRole }) {
  const [kpis, setKpis] = useState<DashboardKPI[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setKpis(null);
    setError(null);
    api
      .dashboard(role)
      .then((data) => !cancelled && setKpis(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [role]);

  return (
    <div>
      <div className="section-heading">
        <span className="bracket">[01]</span>
        <h2>{ROLE_LABELS[role]} &middot; Live KPIs</h2>
      </div>
      <p className="section-sub">
        Recomputed on every load from current forecast and inventory state. Release 1 covers the Smart Fan pilot line only.
      </p>

      {error && <div className="error-banner">{error}</div>}
      {!kpis && !error && <div className="loading-line">Loading KPIs&hellip;</div>}
      {kpis && (
        <div className="kpi-grid">
          {kpis.map((k) => (
            <KpiCard key={k.name} kpi={k} />
          ))}
        </div>
      )}
    </div>
  );
}
