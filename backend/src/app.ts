import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import forecastRoutes from "./routes/forecast";
import inventoryRoutes from "./routes/inventory";
import dashboardRoutes from "./routes/dashboard";
import usersRoutes from "./routes/users";
import salesRoutes from "./routes/sales";
import shipmentRoutes from "./routes/shipments";
import iotRoutes from "./routes/iot";
import { requireAuth } from "./middleware/auth";
import { getProducts, getLocations, getRetailPartners } from "./services/productService";

export const app = express();

app.use(
  cors({
    // no CORS_ORIGIN set -> allow all, mainly so local dev doesn't break
    origin: process.env.CORS_ORIGIN ?? true,
  })
);
app.use(express.json());

// quick request logger, just prints method + url
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  }
  next();
});

app.get("/health", async (_req, res) => {
  try {
    const products = await getProducts();
    res.json({ status: "ok", release: "Release 2 (Auth + Postgres + Logistics/IoT)", productLine: "Smart Fan", skuCount: products.length });
  } catch (err: any) {
    res.status(503).json({ status: "db_unavailable", error: err.message });
  }
});

// login route is public, everything else below needs a token
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", requireAuth);

app.get("/api/v1/products", async (_req, res, next) => {
  try {
    res.json(await getProducts());
  } catch (err) {
    next(err);
  }
});
app.get("/api/v1/locations", async (_req, res, next) => {
  try {
    res.json(await getLocations());
  } catch (err) {
    next(err);
  }
});
app.get("/api/v1/retail-partners", async (_req, res, next) => {
  try {
    res.json(await getRetailPartners());
  } catch (err) {
    next(err);
  }
});

app.use("/api/v1/forecast", forecastRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/sales", salesRoutes);
app.use("/api/v1/shipments", shipmentRoutes);
app.use("/api/v1/iot", iotRoutes);

// catches anything passed to next(err)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (process.env.NODE_ENV !== "test") console.error(err);
  res.status(500).json({ error: "Internal server error.", detail: process.env.NODE_ENV === "production" ? undefined : err.message });
});
