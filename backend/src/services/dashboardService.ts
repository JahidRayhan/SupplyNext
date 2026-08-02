import { DashboardKPI, UserRole } from "../types";
import { getForecasts, isHighUncertainty } from "./forecastService";
import { getInventory, getTransferRecommendations } from "./inventoryService";
import { getProducts } from "./productService";
import { getLogisticsKpis } from "./shipmentService";

function kpi(name: string, value: number, unit: string, trend: DashboardKPI["trend"], target?: number): DashboardKPI {
  return { name, value, unit, target, trend, asOf: new Date().toISOString() };
}

// fake "accuracy" score: tighter confidence bands = more trustworthy forecast
async function forecastAccuracyProxy(): Promise<number> {
  const weekly = await getForecasts(undefined, "weekly");
  if (weekly.length === 0) return 0;
  const avgRelBand =
    weekly.reduce((sum, f) => {
      if (f.predictedQuantity === 0) return sum;
      return sum + (f.confidenceHigh - f.confidenceLow) / f.predictedQuantity;
    }, 0) / weekly.length;
  return Math.max(0, Math.round((1 - avgRelBand / 2) * 100));
}

async function stockHealth() {
  const all = await getInventory();
  const totalUnits = all.reduce((s, r) => s + r.quantityOnHand, 0);
  const understocked = all.filter((r) => r.quantityOnHand < r.reorderPoint).length;
  const overstocked = all.filter((r) => r.quantityOnHand > r.reorderPoint + r.safetyStock * 2).length;
  return { totalUnits, understocked, overstocked };
}

// FR-DB-01/02: builds the KPI list per role, recomputed fresh every call
export async function getKpisForRole(role: UserRole): Promise<DashboardKPI[]> {
  const [accuracy, { totalUnits, understocked, overstocked }, transfers, weeklyForecasts, monthlyForecasts, products] =
    await Promise.all([
      forecastAccuracyProxy(),
      stockHealth(),
      getTransferRecommendations(),
      getForecasts(undefined, "weekly"),
      getForecasts(undefined, "monthly"),
      getProducts(),
    ]);
  const highUncertaintySkus = weeklyForecasts.filter(isHighUncertainty).length;

  switch (role) {
    case "sales_planner":
      return [
        kpi("Forecast Confidence", accuracy, "%", "up", 85),
        kpi("SKUs Flagged High Uncertainty", highUncertaintySkus, "units", highUncertaintySkus > 0 ? "up" : "flat", 0),
        kpi("Weekly Demand (all Smart Fan SKUs)", weeklyForecasts.reduce((s, f) => s + f.predictedQuantity, 0), "units", "flat"),
        kpi("Monitored SKUs", products.length, "units", "flat"),
      ];

    case "production_manager":
      return [
        kpi("Monthly Demand Forecast", monthlyForecasts.reduce((s, f) => s + f.predictedQuantity, 0), "units", "up"),
        kpi("SKUs Below Reorder Point", understocked, "units", understocked > 0 ? "up" : "flat", 0),
        kpi("Total On-Hand Stock", totalUnits, "units", "flat"),
        kpi("Avg. Production Lead Time", Math.round(products.reduce((s, p) => s + p.leadTimeDays, 0) / products.length), "days", "flat"),
      ];

    case "warehouse_manager":
      return [
        kpi("Total Stock On Hand", totalUnits, "units", "flat"),
        kpi("Locations Understocked", understocked, "units", understocked > 0 ? "up" : "flat", 0),
        kpi("Locations Overstocked", overstocked, "units", overstocked > 0 ? "up" : "flat", 0),
        kpi("Open Transfer Recommendations", transfers.length, "units", transfers.length > 0 ? "up" : "flat", 0),
      ];

    case "logistics_coordinator": {
      const logistics = await getLogisticsKpis();
      return [
        kpi("Tracked Shipments", logistics.trackedShipments, "units", "flat"),
        kpi("In Transit", logistics.inTransit, "units", "flat"),
        kpi("Delayed Shipments", logistics.delayed, "units", logistics.delayed > 0 ? "up" : "flat", 0),
        kpi("On-Time Delivery %", logistics.onTimeDeliveryPct, "%", logistics.onTimeDeliveryPct >= 90 ? "up" : "down", 90),
      ];
    }

    case "executive":
    case "admin": {
      const logistics = await getLogisticsKpis();
      return [
        kpi("Forecast Confidence", accuracy, "%", "up", 85),
        kpi("Total Inventory Units (Smart Fan pilot)", totalUnits, "units", "flat"),
        kpi("SKUs Below Reorder Point", understocked, "units", understocked > 0 ? "up" : "flat", 0),
        kpi("Open Transfer Recommendations", transfers.length, "units", transfers.length > 0 ? "up" : "flat", 0),
        kpi("On-Time Delivery %", logistics.onTimeDeliveryPct, "%", logistics.onTimeDeliveryPct >= 90 ? "up" : "down", 90),
        kpi("Pilot Product Lines Live", 1, "units", "flat", 1),
      ];
    }

    default:
      return [];
  }
}
