import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./core/env.js";
import authRoutes from "./modules/auth/auth.routes.js";
import musicRoutes from "./modules/music/music.routes.js";
import imageRoutes from "./modules/image/image.routes.js";

const app = express();

app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/images", imageRoutes);

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
