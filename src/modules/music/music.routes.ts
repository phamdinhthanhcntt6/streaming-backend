import { Router } from "express";
import { optionalAuth, requireAuth } from "../auth/auth.middleware.js";
import {
  addFavoriteTrack,
  getMusicDashboard,
  recordTrackPlay,
  removeFavoriteTrack,
} from "./music.controller.js";
import { validateBody } from "../../core/middlewares/validate.js";
import { recordPlaySchema } from "./music.schema.js";

const router = Router();

router.get("/dashboard", optionalAuth, getMusicDashboard);
router.post("/tracks/:trackId/favorite", requireAuth, addFavoriteTrack);
router.delete("/tracks/:trackId/favorite", requireAuth, removeFavoriteTrack);
router.post(
  "/tracks/:trackId/plays",
  optionalAuth,
  validateBody(recordPlaySchema),
  recordTrackPlay,
);

export default router;
