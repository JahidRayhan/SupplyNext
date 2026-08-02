export interface Product {
  sku: string;
  name: string;
  category: string;
  unitCost: number;
  leadTimeDays: number;
}

export interface ForecastResult {
  sku: string;
  horizon: "weekly" | "monthly";
  periodStart: string;
  predictedQuantity: number;
  confidenceLow: number;
  confidenceHigh: number;
  modelVersion: string;
  generatedAt: string;
  highUncertainty: boolean;
}

export interface ForecastOverride {
  sku: string;
  periodStart: string;
  overriddenQuantity: number;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
}

export type LocationType = "factory" | "warehouse" | "in_transit";

export interface InventoryRecord {
  sku: string;
  locationId: string;
  locationType: LocationType;
  quantityOnHand: number;
  reorderPoint: number;
  safetyStock: number;
  lastUpdated: string;
}

export interface TransferRecommendation {
  sku: string;
  fromLocationId: string;
  toLocationId: string;
  recommendedQuantity: number;
  reason: "overstock" | "understock_risk";
  createdAt: string;
}

export interface Location {
  id: string;
  type: LocationType;
  name: string;
}

export type UserRole =
  | "sales_planner"
  | "production_manager"
  | "warehouse_manager"
  | "logistics_coordinator"
  | "executive"
  | "admin";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface DashboardKPI {
  name: string;
  value: number;
  unit: string;
  target?: number;
  trend: "up" | "down" | "flat";
  asOf: string;
}

export interface AuditEntry {
  sku: string;
  locationId: string;
  delta: number;
  user: string;
  reason: string;
  timestamp: string;
}

export interface AuthUser {
  sub: string; // user id
  role: UserRole;
  name: string;
  email: string;
}

export type ShipmentStatus = "pending" | "in_transit" | "delivered" | "delayed";

export interface Shipment {
  id: string;
  sku: string;
  quantity: number;
  originLocationId: string;
  destinationRetailPartnerId: string;
  status: ShipmentStatus;
  expectedDelivery: string;
  actualDelivery?: string;
}

export type SensorEventType = "rfid_scan" | "gps_ping" | "temperature" | "humidity";

export interface IoTSensorEvent {
  deviceId: string;
  eventType: SensorEventType;
  sku?: string;
  shipmentId?: string;
  value?: number;
  latitude?: number;
  longitude?: number;
  timestamp: string;
  synced: boolean;
}

export interface RetailPartner {
  id: string;
  name: string;
}

export interface LogisticsKpis {
  trackedShipments: number;
  inTransit: number;
  delayed: number;
  onTimeDeliveryPct: number;
}
