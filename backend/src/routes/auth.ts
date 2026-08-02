import { Router } from "express";
import { login, InvalidCredentialsError } from "../services/authService";
import { requireAuth } from "../middleware/auth";
import { validateBody, loginSchema } from "../middleware/validate";
import { loginRateLimiter } from "../middleware/rateLimit";

const router = Router();

router.post("/login", loginRateLimiter, validateBody(loginSchema), async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const { token, user } = await login(email, password);
    res.json({ token, user });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;
