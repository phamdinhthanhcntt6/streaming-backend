import { Router } from "express";
import { validateBody } from "../../core/middlewares/validate.js";
import { Role } from "../../generated/prisma/client.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  cancelMyVerificationRequest,
  createVerificationRequest,
  getMyVerificationRequest,
  listVerificationRequests,
  reviewVerificationRequest,
} from "./verification.controller.js";
import {
  createVerificationRequestSchema,
  reviewVerificationRequestSchema,
} from "./verification.schema.js";

const router = Router();

router.post(
  "/requests",
  requireAuth,
  validateBody(createVerificationRequestSchema),
  createVerificationRequest,
);
router.get("/requests/me", requireAuth, getMyVerificationRequest);
router.delete("/requests/me", requireAuth, cancelMyVerificationRequest);

router.get(
  "/admin/requests",
  requireAuth,
  requireRole(Role.ADMIN),
  listVerificationRequests,
);
router.patch(
  "/admin/requests/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(reviewVerificationRequestSchema),
  reviewVerificationRequest,
);

export default router;
