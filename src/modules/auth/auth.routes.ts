import { Router } from "express";
import { validateBody } from "../../core/middlewares/validate.js";
import { register, login, logout, me } from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";
import { loginSchema, registerSchema } from "./auth.schema.js";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
