import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../core/env.js";
import { prisma } from "../../core/db.js";
import { Role } from "../../generated/prisma/client.js";

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

/// Reads the role from the database instead of the JWT so that revoking an
/// admin takes effect immediately, rather than when the cookie expires.
/// Must run after requireAuth.
export const requireRole =
  (...roles: Role[]) =>
  async (_req: Request, res: Response, next: NextFunction) => {
    const userId = res.locals.userId as string | undefined;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.locals.role = user.role;
    return next();
  };
