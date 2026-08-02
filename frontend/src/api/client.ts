import type {
  Product,
  ForecastResult,
  ForecastOverride,
  InventoryRecord,
  TransferRecommendation,
  Location,
  User,
  DashboardKPI,
  AuditEntry,
  UserRole,
  AuthUser,
  Shipment,
  ShipmentStatus,
  IoTSensorEvent,
  SensorEventType,
  RetailPartner,
  LogisticsKpis,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const TOKEN_STORAGE_KEY = "sdcip_token";

let currentToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);

export function setToken(token: string | null) {
  currentToken = token;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getToken() {
  return currentToken;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (currentToken) headers.Authorization = `Bearer ${currentToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { headers, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) setToken(null);
    throw new Error(body.error ?? `Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<AuthUser>("/api/v1/auth/me"),

  products: () => request<Product[]>("/api/v1/products"),
  locations: () => request<Location[]>("/api/v1/locations"),
  users: () => request<User[]>("/api/v1/users"),

  forecasts: (sku: string, horizon?: "weekly" | "monthly") =>
    request<ForecastResult[]>(`/api/v1/forecast/${sku}${horizon ? `?horizon=${horizon}` : ""}`),
  overrideForecast: (sku: string, body: { periodStart: string; overriddenQuantity: number; reason: string }) =>
    request<ForecastOverride>(`/api/v1/forecast/${sku}/override`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  overrideHistory: (sku: string) => request<ForecastOverride[]>(`/api/v1/forecast/${sku}/overrides`),
  recomputeForecasts: () => request<{ recomputed: number; generatedAt: string | null }>("/api/v1/forecast/recompute", { method: "POST" }),

  inventory: (params?: { locationId?: string; sku?: string }) => {
    const qs = new URLSearchParams();
    if (params?.locationId) qs.set("locationId", params.locationId);
    if (params?.sku) qs.set("sku", params.sku);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<InventoryRecord[]>(`/api/v1/inventory${suffix}`);
  },
  transferRecommendations: () => request<TransferRecommendation[]>("/api/v1/inventory/transfer-recommendations"),
  reconcile: (body: { sku: string; locationId: string; scannedQuantity: number; varianceThresholdPct?: number }) =>
    request<{ sku: string; locationId: string; systemQuantity: number; scannedQuantity: number; variancePct: number; flagged: boolean }>(
      "/api/v1/inventory/reconcile",
      { method: "POST", body: JSON.stringify(body) }
    ),
  auditTrail: (sku?: string) => request<AuditEntry[]>(`/api/v1/inventory/audit-trail${sku ? `?sku=${sku}` : ""}`),

  dashboard: (role: UserRole) => request<DashboardKPI[]>(`/api/v1/dashboard/${role}`),

  salesDaily: (sku: string) => request<{ date: string; quantity: number }[]>(`/api/v1/sales/${sku}/daily`),

  retailPartners: () => request<RetailPartner[]>("/api/v1/retail-partners"),

  shipments: (params?: { status?: ShipmentStatus; sku?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.sku) qs.set("sku", params.sku);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Shipment[]>(`/api/v1/shipments${suffix}`);
  },
  shipmentKpis: () => request<LogisticsKpis>("/api/v1/shipments/kpis"),
  createShipment: (body: {
    sku: string;
    quantity: number;
    originLocationId: string;
    destinationRetailPartnerId: string;
    expectedDelivery: string;
  }) => request<Shipment>("/api/v1/shipments", { method: "POST", body: JSON.stringify(body) }),
  updateShipmentStatus: (id: string, status: ShipmentStatus, actualDelivery?: string) =>
    request<Shipment>(`/api/v1/shipments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, actualDelivery }),
    }),

  iotEvents: (params?: { shipmentId?: string; sku?: string }) => {
    const qs = new URLSearchParams();
    if (params?.shipmentId) qs.set("shipmentId", params.shipmentId);
    if (params?.sku) qs.set("sku", params.sku);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<IoTSensorEvent[]>(`/api/v1/iot/events${suffix}`);
  },
  ingestIotEvent: (body: {
    deviceId: string;
    eventType: SensorEventType;
    sku?: string;
    shipmentId?: string;
    value?: number;
    latitude?: number;
    longitude?: number;
  }) => request<IoTSensorEvent>("/api/v1/iot/events", { method: "POST", body: JSON.stringify(body) }),
};
