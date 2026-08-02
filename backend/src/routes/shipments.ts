import { Router } from "express";
import { listShipments, createShipment, updateShipmentStatus, getLogisticsKpis } from "../services/shipmentService";
import { getProductBySku } from "../services/productService";
import { requireRole } from "../middleware/auth";
import { validateBody, createShipmentSchema, shipmentStatusSchema } from "../middleware/validate";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const sku = req.query.sku as string | undefined;
    res.json(await listShipments({ status, sku }));
  } catch (err) {
    next(err);
  }
});

router.get("/kpis", async (_req, res, next) => {
  try {
    res.json(await getLogisticsKpis());
  } catch (err) {
    next(err);
  }
});

// FR-LG-01
router.post("/", requireRole("logistics_coordinator", "admin"), validateBody(createShipmentSchema), async (req, res, next) => {
  try {
    const { sku, quantity, originLocationId, destinationRetailPartnerId, expectedDelivery } = req.body;
    if (!(await getProductBySku(sku))) {
      return res.status(404).json({ error: `Unknown SKU: ${sku}` });
    }
    const shipment = await createShipment({
      sku,
      quantity,
      originLocationId,
      destinationRetailPartnerId,
      expectedDelivery,
      createdBy: req.user!.sub,
    });
    res.status(201).json(shipment);
  } catch (err) {
    next(err);
  }
});

// FR-LG-02
router.patch("/:id/status", requireRole("logistics_coordinator", "admin"), validateBody(shipmentStatusSchema), async (req, res, next) => {
  try {
    const { status, actualDelivery } = req.body;
    const updated = await updateShipmentStatus(req.params.id, status, actualDelivery);
    if (!updated) return res.status(404).json({ error: `Unknown shipment: ${req.params.id}` });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
