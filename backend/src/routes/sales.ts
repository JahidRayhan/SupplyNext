import { Router } from "express";
import { pool } from "../db/pool";

const router = Router();

// last 28 days of sales, used for the demand chart next to the forecast
router.get("/:sku/daily", async (req, res, next) => {
  try {
    const { sku } = req.params;
    const { rows } = await pool.query(
      `SELECT sale_date, SUM(quantity_sold)::int AS quantity
       FROM sales_records
       WHERE sku = $1
       GROUP BY sale_date
       ORDER BY sale_date DESC
       LIMIT 28`,
      [sku]
    );
    const sorted = rows
      .map((r) => ({ date: r.sale_date.toISOString().slice(0, 10), quantity: r.quantity }))
      .sort((a, b) => a.date.localeCompare(b.date));
    res.json(sorted);
  } catch (err) {
    next(err);
  }
});

export default router;
