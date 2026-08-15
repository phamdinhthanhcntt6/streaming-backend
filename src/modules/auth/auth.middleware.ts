import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

interface AccessTokenPayload {
  userId: string;
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies?.access_token as string | undefined;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
    res.locals.userId = payload.userId;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
};
