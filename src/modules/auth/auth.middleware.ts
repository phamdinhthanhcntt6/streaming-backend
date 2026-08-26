import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../core/env.js";

interface AccessTokenPayload {
  userId: string;
  email: string;
}

const getAccessTokenPayload = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;

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
    const payload = getAccessTokenPayload(token);
    res.locals.userId = payload.userId;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
};

export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies?.access_token as string | undefined;

  if (token) {
    try {
      res.locals.userId = getAccessTokenPayload(token).userId;
    } catch {
      // Public music data remains available when a stale cookie is present.
    }
  }

  return next();
};
