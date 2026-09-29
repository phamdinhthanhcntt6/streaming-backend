import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cloudinary } from "../../core/cloudinary.js";
import { prisma } from "../../core/db.js";
import { env } from "../../core/env.js";
import { AppError } from "../../core/errors.js";
import { googleAuthenticationOptions, passport } from "../../core/passport.js";
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  LoginInput,
  RegisterInput,
} from "./auth.schema.js";

const ACCESS_TOKEN_COOKIE = "access_token";
const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
const ACCESS_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

const authCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

const getClientRedirectUrl = (error?: string) => {
  const url = new URL(error ? "/login" : "/", env.CLIENT_URL);

  if (error) url.searchParams.set("error", error);

  return url.toString();
};

const setAccessTokenCookie = (
  res: Response,
  user: { id: string; email: string },
) => {
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...authCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
};

const isAuthenticatedUser = (
  user: unknown,
): user is { id: string; email: string } =>
  typeof user === "object" &&
  user !== null &&
  "id" in user &&
  typeof user.id === "string" &&
  "email" in user &&
  typeof user.email === "string";

// [POST] ĐĂNG KÝ
export const register = async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body as RegisterInput;

  // 1. Kiểm tra xem email đã tồn tại trong DB chưa
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError(409, "This email is already in use");
  }

  // 2. Mã hóa mật khẩu (Băm 10 vòng)
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 3. Lưu User mới vào Database
  const newUser = await prisma.user.create({
    data: {
      email,
      displayName,
      password: hashedPassword,
    },
  });

  res.status(201).json({
    message: "Registration successful!",
    user: {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
    },
  });
};

// [POST] ĐĂNG NHẬP
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;

  // 1. Tìm User trong Database
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) {
    throw new AppError(401, "Incorrect email or password");
  }

  // 2. So sánh mật khẩu người dùng nhập với mật khẩu đã băm trong DB
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError(401, "Incorrect email or password");
  }

  // 3. Tạo JWT và cài vào HttpOnly cookie
  setAccessTokenCookie(res, user);

  res.status(200).json({
    message: "Login successful",
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      hasPassword: Boolean(user.password),
    },
  });
};

// [POST] ĐĂNG XUẤT
export const logout = (req: Request, res: Response) => {
  // Xóa cookie chứa token
  res.clearCookie(ACCESS_TOKEN_COOKIE, authCookieOptions);
  res.status(200).json({ message: "Logout successful" });
};

// [GET] START GOOGLE OAUTH
export const startGoogleLogin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const state = randomBytes(32).toString("hex");

  res.cookie(GOOGLE_OAUTH_STATE_COOKIE, state, {
    ...authCookieOptions,
    maxAge: OAUTH_STATE_MAX_AGE_MS,
  });

  return passport.authenticate("google", {
    ...googleAuthenticationOptions,
    state,
  })(req, res, next);
};

// [GET] VALIDATE GOOGLE OAUTH CALLBACK STATE
export const validateGoogleOAuthState = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const receivedState =
    typeof req.query.state === "string" ? req.query.state : "";
  const storedState =
    typeof req.cookies?.[GOOGLE_OAUTH_STATE_COOKIE] === "string"
      ? (req.cookies[GOOGLE_OAUTH_STATE_COOKIE] as string)
      : "";

  res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, authCookieOptions);

  const receivedBuffer = Buffer.from(receivedState);
  const storedBuffer = Buffer.from(storedState);
  const isValidState =
    receivedBuffer.length > 0 &&
    receivedBuffer.length === storedBuffer.length &&
    timingSafeEqual(receivedBuffer, storedBuffer);

  if (!isValidState) {
    return res.redirect(getClientRedirectUrl("invalid_oauth_state"));
  }

  return next();
};

// [GET] GOOGLE OAUTH SUCCESS CALLBACK
export const googleLoginCallback = (req: Request, res: Response) => {
  if (!isAuthenticatedUser(req.user)) {
    return res.redirect(getClientRedirectUrl("google_auth_failed"));
  }

  setAccessTokenCookie(res, req.user);

  return res.redirect(getClientRedirectUrl());
};

export const googleLoginFailure = (_req: Request, res: Response) =>
  res.redirect(getClientRedirectUrl("google_auth_failed"));

// Redirect browser-based OAuth errors instead of returning an API JSON error.
export const googleLoginError = (
  _error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => res.redirect(getClientRedirectUrl("google_auth_failed"));

// [GET] CURRENT USER
export const me = async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: res.locals.userId as string },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      provider: true,
      password: true,
      role: true,
      artist: {
        select: { id: true, slug: true, name: true, isVerified: true },
      },
    },
  });

  if (!user) {
    throw new AppError(401, "User no longer exists");
  }

  const { password, ...safeUser } = user;

  return res.status(200).json({
    user: {
      ...safeUser,
      hasPassword: Boolean(password),
    },
  });
};

// [POST] CHANGE PASSWORD
export const changePassword = async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const hadPassword = Boolean(user.password);

  if (user.password) {
    if (!currentPassword) {
      throw new AppError(400, "Current password is required");
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new AppError(400, "Current password is incorrect");
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      throw new AppError(
        400,
        "New password must be different from current password",
      );
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
    },
  });

  return res.status(200).json({
    message: hadPassword
      ? "Password changed successfully"
      : "Password set successfully",
    hasPassword: true,
  });
};

export const deleteAccount = async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const { password } = req.body as DeleteAccountInput;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
      avatarPublicId: true,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (user.password) {
    if (!password) {
      throw new AppError(400, "Current password is required");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new AppError(400, "Current password is incorrect");
    }
  }

  await prisma.user.delete({
    where: { id: user.id },
  });

  res.clearCookie(ACCESS_TOKEN_COOKIE, authCookieOptions);

  if (user.avatarPublicId) {
    void cloudinary.uploader.destroy(user.avatarPublicId).catch(() => {});
  }

  return res.status(200).json({
    message: "Account deleted successfully",
  });
};
