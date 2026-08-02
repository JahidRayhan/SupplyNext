import { useEffect, useState } from "react";
import "./shell.css";
import { api, getToken, setToken } from "./api/client";
import type { Product, Location, AuthUser, UserRole } from "./types";
import { DashboardPage } from "./pages/DashboardPage";
import { ForecastPage } from "./pages/ForecastPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LogisticsPage } from "./pages/LogisticsPage";
import { LoginPage } from "./pages/LoginPage";

type Tab = "dashboard" | "forecast" | "inventory" | "logistics";

const TABS: { id: Tab; label: string; idx: string }[] = [
  { id: "dashboard", label: "Dashboard", idx: "01" },
  { id: "forecast", label: "Forecasting", idx: "02" },
  { id: "inventory", label: "Inventory", idx: "03" },
  { id: "logistics", label: "Logistics", idx: "04" },
];

const ALL_ROLES: UserRole[] = [
  "sales_planner",
  "production_manager",
  "warehouse_manager",
  "logistics_coordinator",
  "executive",
  "admin",
];

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [tab, setTab] = useState<Tab>("dashboard");
  const [viewRole, setViewRole] = useState<UserRole | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);

  // check if the stored token is still valid on load
  useEffect(() => {
    if (!getToken()) {
      setCheckingSession(false);
      return;
    }
    api
      .me()
      .then((u) => {
        setUser(u);
        setViewRole(u.role);
      })
      .catch(() => setToken(null))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.products(), api.locations()])
      .then(([p, l]) => {
        setProducts(p);
        setLocations(l);
      })
      .catch((err) => setBootError(err.message));
  }, [user]);

  function handleLogout() {
    setToken(null);
    setUser(null);
    setViewRole(null);
    setProducts([]);
    setLocations([]);
    setTab("dashboard");
  }

  if (checkingSession) {
    return (
      <div className="login-screen">
        <span className="loading-line" style={{ color: "#fff" }}>
          Checking session&hellip;
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLoggedIn={(u) => {
          setUser(u);
          setViewRole(u.role);
        }}
      />
    );
  }

  const canSwitchViewedRole = user.role === "executive" || user.role === "admin";
  const canOverride = user.role === "sales_planner" || user.role === "admin";
  const canReconcile = user.role === "warehouse_manager" || user.role === "admin";
  const canManageLogistics = user.role === "logistics_coordinator" || user.role === "admin";

  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail-brand">
          <span className="rail-brand-mark">SDCIP &middot; Release 1</span>
          <span className="rail-brand-name">SupplyNext</span>
        </div>

        <nav className="rail-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`rail-nav-item ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="idx">{t.idx}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="rail-footer">
          {canSwitchViewedRole && tab === "dashboard" && (
            <>
              <span className="rail-role-label">View dashboard for</span>
              <select
                className="rail-role-select"
                value={viewRole ?? user.role}
                onChange={(e) => setViewRole(e.target.value as UserRole)}
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </>
          )}

          <span className="rail-role-label" style={{ marginTop: canSwitchViewedRole ? 6 : 0 }}>
            Signed in as
          </span>
          <div style={{ color: "#fff", fontSize: 13 }}>{user.name}</div>
          <div style={{ color: "var(--rail-ink-dim)", fontSize: 11.5 }}>{user.role.replace(/_/g, " ")}</div>
          <button
            className="rail-nav-item"
            style={{ marginTop: 4, color: "var(--rail-ink-dim)" }}
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <h1>Digital Supply Chain Intelligence Platform</h1>
          <div className="topbar-meta">
            <div className="pilot-tag">Smart Fan pilot &middot; live</div>
            <div style={{ marginTop: 4 }}>{user.email}</div>
          </div>
        </div>

        {bootError && <div className="error-banner">{bootError}</div>}

        {!bootError && products.length === 0 && <div className="loading-line">Loading pilot data&hellip;</div>}

        {!bootError && products.length > 0 && (
          <>
            {tab === "dashboard" && <DashboardPage role={viewRole ?? user.role} />}
            {tab === "forecast" && <ForecastPage products={products} canOverride={canOverride} />}
            {tab === "inventory" && (
              <InventoryPage products={products} locations={locations} canReconcile={canReconcile} />
            )}
            {tab === "logistics" && (
              <LogisticsPage products={products} locations={locations} canManage={canManageLogistics} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
