import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./core/env.js";
import { errorHandler } from "./core/middlewares/errorHandler.js";
import { passport } from "./core/passport.js";
import authRoutes from "./modules/auth/auth.routes.js";
import musicRoutes from "./modules/music/music.routes.js";
import imageRoutes from "./modules/image/image.routes.js";
import verificationRoutes from "./modules/verification/verification.routes.js";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api/auth", authRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/verification", verificationRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
