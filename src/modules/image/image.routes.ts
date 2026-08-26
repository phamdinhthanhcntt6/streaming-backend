import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getImages, syncImages } from "./image.controller.js";

const router = Router();

router.get("/", getImages);
router.post("/sync", requireAuth, syncImages);

export default router;
