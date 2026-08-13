import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../../../generated/prisma/client.js";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

// [POST] ĐĂNG KÝ
export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password, displayName } = req.body;

    // 1. Kiểm tra xem người dùng đã điền đủ thông tin chưa
    if (!email || !password || !displayName) {
      return res
        .status(400)
        .json({ message: "Vui lòng điền đầy đủ thông tin" });
    }

    // 2. Kiểm tra xem email đã tồn tại trong DB chưa
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "Email này đã được sử dụng" });
    }

    // 3. Mã hóa mật khẩu (Băm 10 vòng)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Lưu User mới vào Database
    const newUser = await prisma.user.create({
      data: {
        email,
        displayName,
        password: hashedPassword,
      },
    });

    res.status(201).json({
      message: "Đăng ký thành công!",
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
      },
    });
  } catch (error: any) {
    console.error(error);
    res
      .status(500)
      .json({
        message: "Lỗi server khi đăng ký",
        error: error?.message || String(error),
      });
  }
};

// [POST] ĐĂNG NHẬP
export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    // 1. Kiểm tra thông tin đầu vào
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập email và mật khẩu" });
    }

    // 2. Tìm User trong Database
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không chính xác" });
    }

    // 3. So sánh mật khẩu người dùng nhập với mật khẩu đã băm trong DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không chính xác" });
    }

    // 4. Tạo JWT Token
    const token = jwt.sign(
      { userId: user.id, email: user.email }, // Dữ liệu mã hóa bên trong token
      JWT_SECRET,
      { expiresIn: "7d" }, // Token sống trong 7 ngày
    );

    // 5. Cài đặt Token vào HttpOnly Cookie để bảo vệ khỏi tấn công XSS
    res.cookie("access_token", token, {
      httpOnly: true, // Frontend (JavaScript) không thể đọc được cookie này
      secure: process.env.NODE_ENV === "production", // Chỉ gửi qua HTTPS khi trên server thật
      sameSite: "lax", // Bảo vệ khỏi tấn công CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày tính bằng mili-giây
    });

    res.status(200).json({
      message: "Đăng nhập thành công",
      user: { id: user.id, email: user.email, displayName: user.displayName },
      accessToken: token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi đăng nhập" });
  }
};

// [POST] ĐĂNG XUẤT
export const logout = (req: Request, res: Response) => {
  // Xóa cookie chứa token
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.status(200).json({ message: "Đăng xuất thành công" });
};
