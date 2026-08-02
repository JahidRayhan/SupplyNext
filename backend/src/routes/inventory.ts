import { Router } from "express";
import { getInventory, getTransferRecommendations, reconcileCount, getAuditTrail, recomputeReorderParams } from "../services/inventoryService";
import { getLocations } from "../services/productService";
import { requireRole } from "../middleware/auth";
import { validateBody, reconcileSchema } from "../middleware/validate";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const locationId = req.query.locationId as string | undefined;
    const sku = req.query.sku as string | undefined;
    res.json(await getInventory(locationId, sku));
  } catch (err) {
    next(err);
  }
});

router.get("/transfer-recommendations", async (_req, res, next) => {
  try {
    res.json(await getTransferRecommendations());
  } catch (err) {
    next(err);
  }
});

// not in the SRS spec but the UI needs it
router.get("/locations", async (_req, res, next) => {
  try {
    res.json(await getLocations());
  } catch (err) {
    next(err);
  }
});

// FR-IM-04
router.post("/reconcile", requireRole("warehouse_manager", "admin"), validateBody(reconcileSchema), async (req, res, next) => {
  const { sku, locationId, scannedQuantity, varianceThresholdPct } = req.body;
  const user = req.user!.sub;
  try {
    const result = await reconcileCount(sku, locationId, scannedQuantity, user, varianceThresholdPct);
    res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// FR-IM-05
router.get("/audit-trail", async (req, res, next) => {
  try {
    res.json(await getAuditTrail(req.query.sku as string | undefined));
  } catch (err) {
    next(err);
  }
});

// FR-IM-02, run after forecasts change
router.post("/recompute-reorder-params", requireRole("production_manager", "admin"), async (_req, res, next) => {
  try {
    await recomputeReorderParams();
    res.json({ recomputed: true });
  } catch (err) {
    next(err);
  }
});

export default router;
