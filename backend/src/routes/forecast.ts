import { Router } from "express";
import { getForecasts, addOverride, getOverrides, isHighUncertainty, recomputeAllForecasts } from "../services/forecastService";
import { getProductBySku } from "../services/productService";
import { requireRole } from "../middleware/auth";
import { validateBody, forecastOverrideSchema } from "../middleware/validate";

const router = Router();

router.get("/:sku", async (req, res, next) => {
  try {
    const { sku } = req.params;
    const horizon = req.query.horizon as "weekly" | "monthly" | undefined;

    if (!(await getProductBySku(sku))) {
      return res.status(404).json({ error: `Unknown SKU: ${sku}` });
    }

    const results = (await getForecasts(sku, horizon)).map((f) => ({ ...f, highUncertainty: isHighUncertainty(f) }));
    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.post("/:sku/override", requireRole("sales_planner", "admin"), validateBody(forecastOverrideSchema), async (req, res, next) => {
  try {
    const { sku } = req.params;
    const { periodStart, overriddenQuantity, reason } = req.body;
    const overriddenBy = req.user!.sub;

    if (!(await getProductBySku(sku))) {
      return res.status(404).json({ error: `Unknown SKU: ${sku}` });
    }

    const record = await addOverride({ sku, periodStart, overriddenQuantity, reason, overriddenBy });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

// override history, FR-DF-04
router.get("/:sku/overrides", async (req, res, next) => {
  try {
    res.json(await getOverrides(req.params.sku));
  } catch (err) {
    next(err);
  }
});

// FR-DF-05
router.post("/recompute", requireRole("production_manager", "admin"), async (_req, res, next) => {
  try {
    const results = await recomputeAllForecasts();
    res.json({ recomputed: results.length, generatedAt: results[0]?.generatedAt ?? null });
  } catch (err) {
    next(err);
  }
});

export default router;
