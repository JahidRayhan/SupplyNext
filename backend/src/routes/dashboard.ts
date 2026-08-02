import { Router } from "express";
import { getKpisForRole } from "../services/dashboardService";
import { UserRole } from "../types";

const router = Router();

const VALID_ROLES: UserRole[] = [
  "sales_planner",
  "production_manager",
  "warehouse_manager",
  "logistics_coordinator",
  "executive",
  "admin",
];

// anyone can view their own role's dashboard, only exec/admin can view others
router.get("/:role", async (req, res, next) => {
  try {
    const role = req.params.role as UserRole;
    if (!VALID_ROLES.includes(role)) {
      return res.status(404).json({ error: `Unknown role: ${role}`, validRoles: VALID_ROLES });
    }
    const requester = req.user!;
    const canViewOtherRoles = requester.role === "executive" || requester.role === "admin";
    if (role !== requester.role && !canViewOtherRoles) {
      return res.status(403).json({ error: "You can only view your own role's dashboard." });
    }
    res.json(await getKpisForRole(role));
  } catch (err) {
    next(err);
  }
});

export default router;
