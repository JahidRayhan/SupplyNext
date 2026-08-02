import bcrypt from "bcryptjs";
import { Product, SalesRecord, InventoryRecord, User, Shipment, IoTSensorEvent } from "../types";

// Smart Fan product line only (Release 1 scope). Just data generators, no DB
// or side effects — db/seed.ts loads this into Postgres on first boot.

export const products: Product[] = [
  { sku: "SF-STD-16", name: 'Smart Fan Standard 16"', category: "SmartFan", unitCost: 1850, leadTimeDays: 12 },
  { sku: "SF-PRM-18", name: 'Smart Fan Premium 18" (App-enabled)', category: "SmartFan", unitCost: 3200, leadTimeDays: 18 },
  { sku: "SF-MINI-12", name: 'Smart Fan Mini 12" (USB)', category: "SmartFan", unitCost: 950, leadTimeDays: 9 },
  { sku: "SF-TWR-01", name: "Smart Tower Fan (Remote)", category: "SmartFan", unitCost: 2600, leadTimeDays: 15 },
];

export const locations = [
  { id: "FAC-DHK-01", type: "factory" as const, name: "Dhaka Factory" },
  { id: "WH-DHK-01", type: "warehouse" as const, name: "Dhaka Central Warehouse" },
  { id: "WH-CTG-01", type: "warehouse" as const, name: "Chattogram Regional Warehouse" },
  { id: "WH-SYL-01", type: "warehouse" as const, name: "Sylhet Regional Warehouse" },
];

export const retailPartners = [
  { id: "RP-STAR-TECH", name: "Star Tech Electronics" },
  { id: "RP-RANGS", name: "Rangs Electronics" },
  { id: "RP-BUTTERFLY", name: "Butterfly Home Appliances" },
  { id: "RP-ONLINE-EXPRESS", name: "Online Express (e-commerce)" },
];
const retailPartnerIds = retailPartners.map((r) => r.id);

// everyone shares this password so the demo is easy to try
export const DEMO_PASSWORD = "SDCIP-Pilot-2026";
const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 8);

export const users: (User & { passwordHash: string })[] = [
  { id: "u-planner-1", name: "Nusrat Jahan", role: "sales_planner", email: "nusrat.jahan@supplynext.com", passwordHash },
  { id: "u-prod-1", name: "Kamrul Hasan", role: "production_manager", email: "kamrul.hasan@supplynext.com", passwordHash },
  { id: "u-wh-1", name: "Farzana Akter", role: "warehouse_manager", email: "farzana.akter@supplynext.com", passwordHash },
  { id: "u-log-1", name: "Rafiqul Islam", role: "logistics_coordinator", email: "rafiqul.islam@supplynext.com", passwordHash },
  { id: "u-exec-1", name: "Tanvir Ahmed", role: "executive", email: "tanvir.ahmed@supplynext.com", passwordHash },
  { id: "u-admin-1", name: "System Admin", role: "admin", email: "admin@supplynext.com", passwordHash },
];

// seeded RNG so the "random" demo data is the same every time
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260727);

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const TODAY = new Date("2026-07-27T00:00:00Z");

// ~120 days of daily sales per SKU/partner, with weekend lift + a mild upward trend
function generateSalesHistory(days: number): SalesRecord[] {
  const records: SalesRecord[] = [];
  let idCounter = 1;

  for (const product of products) {
    const baseDemand = 8 + rand() * 12; // base units/day for this SKU
    for (let d = days; d >= 1; d--) {
      const date = new Date(TODAY);
      date.setUTCDate(date.getUTCDate() - d);
      const dayOfWeek = date.getUTCDay();
      const weekendLift = dayOfWeek === 5 || dayOfWeek === 6 ? 1.4 : 1.0;
      const trend = 1 + ((days - d) / days) * 0.25; // gentle 25% growth over window
      const noise = 0.75 + rand() * 0.5;
      const qty = Math.max(0, Math.round(baseDemand * weekendLift * trend * noise));
      if (qty === 0) continue;

      const partner = retailPartnerIds[Math.floor(rand() * retailPartnerIds.length)];
      records.push({
        id: `sr-${idCounter++}`,
        sku: product.sku,
        retailPartnerId: partner,
        quantitySold: qty,
        saleDate: isoDate(date),
        region: partner === "RP-ONLINE-EXPRESS" ? "National" : ["Dhaka", "Chattogram", "Sylhet"][Math.floor(rand() * 3)],
      });
    }
  }
  return records;
}

export const salesHistory: SalesRecord[] = generateSalesHistory(120);

// starting stock across the factory + 3 warehouses
export const inventoryRecords: InventoryRecord[] = [];
for (const product of products) {
  for (const loc of locations) {
    const isFactory = loc.type === "factory";
    const base = isFactory ? 300 + rand() * 200 : 60 + rand() * 220;
    inventoryRecords.push({
      sku: product.sku,
      locationId: loc.id,
      locationType: loc.type,
      quantityOnHand: Math.round(base),
      reorderPoint: 0, // computed by inventoryService after seeding
      safetyStock: 0,
      lastUpdated: new Date("2026-07-27T06:00:00Z").toISOString(),
    });
  }
}

// logistics + IoT seed data

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export const shipments: Shipment[] = [];
export const iotSensorEvents: IoTSensorEvent[] = [];

{
  let shipmentCounter = 1;
  let eventCounter = 1;

  // mix of delivered/late/in-transit/delayed/pending so the dashboard has something to show
  const plan: { offsetDays: number; status: Shipment["status"] }[] = [
    { offsetDays: -9, status: "delivered" },
    { offsetDays: -8, status: "delivered" },
    { offsetDays: -7, status: "delivered" },
    { offsetDays: -6, status: "delivered" },
    { offsetDays: -5, status: "delivered" },
    { offsetDays: -5, status: "delayed" },
    { offsetDays: -4, status: "delivered" },
    { offsetDays: -3, status: "delivered" },
    { offsetDays: -2, status: "delayed" },
    { offsetDays: -1, status: "in_transit" },
    { offsetDays: 0, status: "in_transit" },
    { offsetDays: 1, status: "pending" },
    { offsetDays: 2, status: "pending" },
    { offsetDays: 3, status: "pending" },
  ];

  for (const p of plan) {
    const product = products[Math.floor(rand() * products.length)];
    const destination = retailPartnerIds[Math.floor(rand() * retailPartnerIds.length)];
    const quantity = 20 + Math.floor(rand() * 80);
    const expected = addDays(TODAY, p.offsetDays);
    const id = `SHP-${String(shipmentCounter).padStart(4, "0")}`;
    shipmentCounter++;

    let actualDelivery: string | undefined;
    if (p.status === "delivered") {
      // ~80% on-time, ~20% a day or two late
      const lateBy = rand() < 0.2 ? 1 + Math.floor(rand() * 2) : 0;
      actualDelivery = isoDate(addDays(expected, lateBy));
    } else if (p.status === "delayed") {
      actualDelivery = undefined; // still not delivered, past expected date
    }

    shipments.push({
      id,
      sku: product.sku,
      quantity,
      originLocationId: "FAC-DHK-01",
      destinationRetailPartnerId: destination,
      status: p.status,
      expectedDelivery: isoDate(expected),
      actualDelivery,
    });

    // fake IoT trail per shipment: dispatch scan + gps pings while moving
    const dispatchDate = addDays(expected, -2);
    iotSensorEvents.push({
      deviceId: `RFID-GATE-${p.status === "pending" ? "PENDING" : "01"}`,
      eventType: "rfid_scan",
      sku: product.sku,
      shipmentId: id,
      timestamp: dispatchDate.toISOString(),
      synced: true,
    });
    eventCounter++;

    if (p.status === "in_transit" || p.status === "delivered" || p.status === "delayed") {
      rand(); // unused warehouse pick, kept so the rng sequence for later shipments doesn't shift
      const baseLat = 23.81 + rand() * 1.5; // rough Bangladesh bounding box
      const baseLng = 90.41 + rand() * 1.0;
      iotSensorEvents.push({
        deviceId: `GPS-TRK-${String(eventCounter).padStart(3, "0")}`,
        eventType: "gps_ping",
        shipmentId: id,
        latitude: Math.round(baseLat * 10000) / 10000,
        longitude: Math.round(baseLng * 10000) / 10000,
        timestamp: addDays(dispatchDate, 1).toISOString(),
        synced: true,
      });
      eventCounter++;
    }
  }
}
