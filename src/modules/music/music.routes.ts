import { Router } from "express";
import { optionalAuth, requireAuth } from "../auth/auth.middleware.js";
import {
  addFavoriteTrack,
  getMusicDashboard,
  removeFavoriteTrack,
} from "./music.controller.js";

const router = Router();

router.get("/dashboard", optionalAuth, getMusicDashboard);
router.post("/tracks/:trackId/favorite", requireAuth, addFavoriteTrack);
router.delete("/tracks/:trackId/favorite", requireAuth, removeFavoriteTrack);

export default router;
