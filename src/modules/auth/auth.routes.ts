import { Router } from "express";
import { validateBody } from "../../core/middlewares/validate.js";
import { passport } from "../../core/passport.js";
import {
  changePassword,
  deleteAccount,
  googleLoginCallback,
  googleLoginError,
  googleLoginFailure,
  login,
  logout,
  me,
  register,
  startGoogleLogin,
  validateGoogleOAuthState,
} from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";
import {
  changePasswordSchema,
  deleteAccountSchema,
  loginSchema,
  registerSchema,
} from "./auth.schema.js";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.get("/google", startGoogleLogin);
router.get(
  "/google/callback",
  validateGoogleOAuthState,
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/api/auth/google/failure",
  }),
  googleLoginCallback,
  googleLoginError,
);
router.get("/google/failure", googleLoginFailure);
router.post(
  "/change-password",
  requireAuth,
  validateBody(changePasswordSchema),
  changePassword,
);
router.delete(
  "/delete-account",
  requireAuth,
  validateBody(deleteAccountSchema),
  deleteAccount,
);

export default router;
