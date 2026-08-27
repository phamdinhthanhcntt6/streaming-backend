import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../core/db.js";
import { env } from "../../core/env.js";
import { AppError } from "../../core/errors.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

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

  // 3. Tạo JWT Token
  const token = jwt.sign(
    { userId: user.id, email: user.email }, // Dữ liệu mã hóa bên trong token
    env.JWT_SECRET,
    { expiresIn: "7d" }, // Token sống trong 7 ngày
  );

  // 4. Cài đặt Token vào HttpOnly Cookie để bảo vệ khỏi tấn công XSS
  res.cookie("access_token", token, {
    httpOnly: true, // Frontend (JavaScript) không thể đọc được cookie này
    secure: env.NODE_ENV === "production", // Chỉ gửi qua HTTPS khi trên server thật
    sameSite: "lax", // Bảo vệ khỏi tấn công CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày tính bằng mili-giây
  });

  res.status(200).json({
    message: "Login successful",
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
};

// [POST] ĐĂNG XUẤT
export const logout = (req: Request, res: Response) => {
  // Xóa cookie chứa token
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.status(200).json({ message: "Logout successful" });
};

// [GET] CURRENT USER
export const me = async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: res.locals.userId as string },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    throw new AppError(401, "User no longer exists");
  }

  return res.status(200).json({ user });
};
