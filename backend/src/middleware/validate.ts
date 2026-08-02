import { Request, Response, NextFunction } from "express";
import { z, ZodTypeAny } from "zod";

// checks req.body against a zod schema, 400s if it doesn't match
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

export const loginSchema = z.object({
  email: z.string().email("must be a valid email address"),
  password: z.string().min(1, "password is required"),
});

export const forecastOverrideSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)"),
  overriddenQuantity: z.number().int().min(0, "must be zero or greater"),
  reason: z.string().trim().min(5, "give a short reason (min 5 characters) — required for the retraining log"),
});

export const reconcileSchema = z.object({
  sku: z.string().min(1),
  locationId: z.string().min(1),
  scannedQuantity: z.number().int().min(0, "must be zero or greater"),
  varianceThresholdPct: z.number().min(0).max(100).optional(),
});

export const createShipmentSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive("must be greater than zero"),
  originLocationId: z.string().min(1),
  destinationRetailPartnerId: z.string().min(1),
  expectedDelivery: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)"),
});

export const shipmentStatusSchema = z.object({
  status: z.enum(["pending", "in_transit", "delivered", "delayed"]),
  actualDelivery: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)")
    .optional(),
});

export const iotEventSchema = z.object({
  deviceId: z.string().min(1),
  eventType: z.enum(["rfid_scan", "gps_ping", "temperature", "humidity"]),
  sku: z.string().optional(),
  shipmentId: z.string().optional(),
  value: z.number().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
