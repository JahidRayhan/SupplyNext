import { describe, it, expect } from "vitest";
import { isHighUncertainty } from "../../src/services/forecastService";
import type { ForecastResult } from "../../src/types";

function fixture(overrides: Partial<ForecastResult>): ForecastResult {
  return {
    sku: "SF-STD-16",
    horizon: "weekly",
    periodStart: "2026-07-27",
    predictedQuantity: 50,
    confidenceLow: 45,
    confidenceHigh: 55,
    modelVersion: "test",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("isHighUncertainty", () => {
  it("flags a forecast whose confidence band is wide relative to the prediction", () => {
    const wide = fixture({ predictedQuantity: 50, confidenceLow: 10, confidenceHigh: 90 }); // band = 80, ratio 1.6
    expect(isHighUncertainty(wide)).toBe(true);
  });

  it("does not flag a forecast with a tight confidence band", () => {
    const tight = fixture({ predictedQuantity: 50, confidenceLow: 45, confidenceHigh: 55 }); // band = 10, ratio 0.2
    expect(isHighUncertainty(tight)).toBe(false);
  });

  it("does not flag when predicted quantity is zero (avoids a divide-by-zero false positive)", () => {
    const zero = fixture({ predictedQuantity: 0, confidenceLow: 0, confidenceHigh: 0 });
    expect(isHighUncertainty(zero)).toBe(false);
  });

  it("sits right at the 40% threshold boundary as 'not flagged'", () => {
    // band width / predicted = exactly 0.4 should NOT be flagged (strictly greater-than triggers it)
    const boundary = fixture({ predictedQuantity: 100, confidenceLow: 80, confidenceHigh: 120 });
    expect(isHighUncertainty(boundary)).toBe(false);
  });
});
