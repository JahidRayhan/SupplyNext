import { pool } from "../db/pool";
import { ForecastResult, ForecastOverride } from "../types";

const MODEL_VERSION = "sdcip-forecast-naive-seasonal-v1";

// hardcoded "today" so forecasts line up with the seeded sales data no matter when you run this
const PILOT_NOW = new Date("2026-07-27T00:00:00Z");

// FR-DF-02/03: weekly + monthly forecast per SKU using a trailing 28-day mean/stddev
async function computeForecastsForSku(sku: string): Promise<ForecastResult[]> {
  const windowStart = new Date(PILOT_NOW);
  windowStart.setUTCDate(windowStart.getUTCDate() - 28);

  const { rows } = await pool.query<{ sale_date: string; qty: string }>(
    `SELECT sale_date, SUM(quantity_sold)::int AS qty
     FROM sales_records
     WHERE sku = $1 AND sale_date > $2 AND sale_date <= $3
     GROUP BY sale_date`,
    [sku, windowStart.toISOString().slice(0, 10), PILOT_NOW.toISOString().slice(0, 10)]
  );

  const values = rows.map((r) => Number(r.qty));
  const n = Math.max(values.length, 1);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const generatedAt = new Date().toISOString();
  const periodStart = PILOT_NOW.toISOString().slice(0, 10);
  const results: ForecastResult[] = [];

  const weeklyPredicted = Math.round(mean * 7);
  const weeklyStdDev = stdDev * Math.sqrt(7);
  results.push({
    sku,
    horizon: "weekly",
    periodStart,
    predictedQuantity: weeklyPredicted,
    confidenceLow: Math.max(0, Math.round(weeklyPredicted - 1.28 * weeklyStdDev)),
    confidenceHigh: Math.round(weeklyPredicted + 1.28 * weeklyStdDev),
    modelVersion: MODEL_VERSION,
    generatedAt,
  });

  const monthlyPredicted = Math.round(mean * 30);
  const monthlyStdDev = stdDev * Math.sqrt(30);
  results.push({
    sku,
    horizon: "monthly",
    periodStart,
    predictedQuantity: monthlyPredicted,
    confidenceLow: Math.max(0, Math.round(monthlyPredicted - 1.28 * monthlyStdDev)),
    confidenceHigh: Math.round(monthlyPredicted + 1.28 * monthlyStdDev),
    modelVersion: MODEL_VERSION,
    generatedAt,
  });

  return results;
}

// flag as "high uncertainty" if the confidence band is more than 40% of the prediction
const HIGH_UNCERTAINTY_BAND_RATIO = 0.4;

export function isHighUncertainty(f: ForecastResult): boolean {
  if (f.predictedQuantity === 0) return false;
  const bandWidth = f.confidenceHigh - f.confidenceLow;
  return bandWidth / f.predictedQuantity > HIGH_UNCERTAINTY_BAND_RATIO;
}

export async function getForecasts(sku?: string, horizon?: "weekly" | "monthly"): Promise<ForecastResult[]> {
  let skus: string[];
  if (sku) {
    skus = [sku];
  } else {
    const { rows } = await pool.query<{ sku: string }>("SELECT sku FROM products ORDER BY sku");
    skus = rows.map((r) => r.sku);
  }
  const all = (await Promise.all(skus.map((s) => computeForecastsForSku(s)))).flat();
  return horizon ? all.filter((f) => f.horizon === horizon) : all;
}

// FR-DF-05: forecasts are always computed live anyway, so this just re-runs the model
export async function recomputeAllForecasts(): Promise<ForecastResult[]> {
  return getForecasts();
}

// FR-DF-04: planner override, reason is required so it can be looked at later
export async function addOverride(input: {
  sku: string;
  periodStart: string;
  overriddenQuantity: number;
  reason: string;
  overriddenBy: string;
}): Promise<ForecastOverride> {
  const { rows } = await pool.query(
    `INSERT INTO forecast_overrides (sku, period_start, overridden_quantity, reason, overridden_by)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING sku, period_start, overridden_quantity, reason, overridden_by, overridden_at`,
    [input.sku, input.periodStart, input.overriddenQuantity, input.reason, input.overriddenBy]
  );
  const row = rows[0];
  return {
    sku: row.sku,
    periodStart: row.period_start.toISOString().slice(0, 10),
    overriddenQuantity: row.overridden_quantity,
    reason: row.reason,
    overriddenBy: row.overridden_by,
    overriddenAt: row.overridden_at.toISOString(),
  };
}

export async function getOverrides(sku?: string): Promise<ForecastOverride[]> {
  const { rows } = await pool.query(
    sku
      ? `SELECT sku, period_start, overridden_quantity, reason, overridden_by, overridden_at
         FROM forecast_overrides WHERE sku = $1 ORDER BY overridden_at DESC`
      : `SELECT sku, period_start, overridden_quantity, reason, overridden_by, overridden_at
         FROM forecast_overrides ORDER BY overridden_at DESC`,
    sku ? [sku] : []
  );
  return rows.map((row) => ({
    sku: row.sku,
    periodStart: row.period_start.toISOString().slice(0, 10),
    overriddenQuantity: row.overridden_quantity,
    reason: row.reason,
    overriddenBy: row.overridden_by,
    overriddenAt: row.overridden_at.toISOString(),
  }));
}
