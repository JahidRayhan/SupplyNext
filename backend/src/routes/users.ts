import { Router } from "express";
import { pool } from "../db/pool";
import { requireRole } from "../middleware/auth";

const router = Router();

// admin only, and we never select password_hash here
router.get("/", requireRole("admin"), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT id, name, role, email FROM users ORDER BY name`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
