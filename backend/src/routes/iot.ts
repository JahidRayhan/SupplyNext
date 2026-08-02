import { Router } from "express";
import { ingestEvent, listEvents } from "../services/iotService";
import { requireRole } from "../middleware/auth";
import { validateBody, iotEventSchema } from "../middleware/validate";

const router = Router();

router.get("/events", async (req, res, next) => {
  try {
    const shipmentId = req.query.shipmentId as string | undefined;
    const sku = req.query.sku as string | undefined;
    res.json(await listEvents({ shipmentId, sku }));
  } catch (err) {
    next(err);
  }
});

// doubles as manual entry and the endpoint a real device would hit
router.post("/events", requireRole("logistics_coordinator", "admin"), validateBody(iotEventSchema), async (req, res, next) => {
  try {
    const { deviceId, eventType, sku, shipmentId, value, latitude, longitude } = req.body;
    const event = await ingestEvent({
      deviceId,
      eventType,
      sku,
      shipmentId,
      value,
      latitude,
      longitude,
      recordedBy: req.user!.sub,
      synced: true,
    });
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

export default router;
