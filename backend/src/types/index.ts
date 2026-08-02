// Domain types, roughly grouped to match SRS Section 5 (Data Model).

// 5.1 Product & Sales
export interface Product {
  sku: string;
  name: string;
  category: "SmartFan" | "LEDLight" | "MiniAppliance";
  unitCost: number; // BDT
  leadTimeDays: number; // production lead time
}

export interface SalesRecord {
  id: string;
  sku: string;
  retailPartnerId: string;
  quantitySold: number;
  saleDate: string; // ISO date
  region: string;
}

// 5.2 Forecasting
export interface ForecastResult {
  sku: string;
  horizon: "weekly" | "monthly";
  periodStart: string; // ISO date
  predictedQuantity: number;
  confidenceLow: number;
  confidenceHigh: number;
  modelVersion: string;
  generatedAt: string; // ISO datetime
}

export interface ForecastOverride {
  sku: string;
  periodStart: string;
  overriddenQuantity: number;
  reason: string;
  overriddenBy: string; // user id
  overriddenAt: string;
}

// 5.3 Inventory
export type LocationType = "factory" | "warehouse" | "in_transit";

export interface Location {
  id: string;
  type: LocationType;
  name: string;
}

export interface InventoryRecord {
  sku: string;
  locationId: string;
  locationType: LocationType;
  quantityOnHand: number;
  reorderPoint: number;
  safetyStock: number;
  lastUpdated: string; // ISO datetime
}

export interface TransferRecommendation {
  sku: string;
  fromLocationId: string;
  toLocationId: string;
  recommendedQuantity: number;
  reason: "overstock" | "understock_risk";
  createdAt: string;
}

// 5.4 IoT & Logistics (Release 2)
export type SensorEventType = "rfid_scan" | "gps_ping" | "temperature" | "humidity";

export interface IoTSensorEvent {
  deviceId: string;
  eventType: SensorEventType;
  sku?: string;
  shipmentId?: string;
  value?: number;
  latitude?: number;
  longitude?: number;
  timestamp: string; // ISO datetime
  synced: boolean;
}

export interface Shipment {
  id: string;
  sku: string;
  quantity: number;
  originLocationId: string;
  destinationRetailPartnerId: string;
  status: "pending" | "in_transit" | "delivered" | "delayed";
  expectedDelivery: string; // ISO date
  actualDelivery?: string;
}

// 5.5 Dashboard & Users
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
  unit: string; // e.g. "%", "units", "days"
  target?: number;
  trend: "up" | "down" | "flat";
  asOf: string; // ISO datetime
}
