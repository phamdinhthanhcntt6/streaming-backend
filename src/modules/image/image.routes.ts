import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { Role } from "../../generated/prisma/client.js";
import { getImages, syncImages } from "./image.controller.js";

const router = Router();

router.get("/", getImages);
router.post("/sync", requireAuth, requireRole(Role.ADMIN), syncImages);

export default router;
