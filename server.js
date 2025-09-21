import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const REFRESH_EXPIRE = process.env.REFRESH_EXPIRE;

// ===== REGISTER =====
app.post("/api/register", async (req, res) => {
    const { email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const confirmToken = crypto.randomBytes(32).toString("hex");
    const { data, error } = await supabase
    .from("users")
    .insert([{ 
        email: email, 
        password: hashed, 
        confirm_token: confirmToken,
    }]);
    if (error) return res.status(400).json({ message: error.message });

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // TLS через STARTTLS
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    await transporter.sendMail({
    from: '"MyApp" <noreply@myapp.com>',
    to: email,
    subject: "Confirm email",
    html: `<a href="http://localhost:3000/api/confirm?token=${confirmToken}">Подтвердить email</a>`
    });
    
    res.json({ message: "Registered!" });
});


// ==== CONFIRM =====
app.get("/api/confirm", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send("The token is missing");

  try {
    await supabase.rpc('set_token', { token_value: token });
    const { data, error } = await supabase.rpc('confirm_email', { token });
    if (error) {
        return res.status(400).send("Confirmation error");
    }
    if (!data?.[0]?.success) return res.status(400).send("Invalid token");

    res.send("Email confirmed! You can now login to the site.");
  } catch (err) {
    res.status(500).send("Server error");
  }
});





// ===== LOGIN =====
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  // Устанавливаем email для RLS
  await supabase.rpc('set_current_user_email', { email });

  // Запрашиваем пользователя
  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, password, is_confirmed")
    .single();

  console.log("Email:", email);
  console.log("User from DB:", user);

  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: "Invalid credentials" });

  const accessToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
  const refreshToken = jwt.sign({ email }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRE });

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 15 * 60 * 1000
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({ message: "Logged in!" });
});


// ===== REFRESH TOKEN =====
app.post("/api/refresh", (req, res) => {
  const { refresh_token } = req.cookies;
  if (!refresh_token) return res.status(401).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(refresh_token, REFRESH_SECRET);
    const accessToken = jwt.sign({ email: payload.email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000
    });
    res.json({ message: "Token refreshed" });
  } catch (err) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// ===== LOGOUT =====
app.post("/api/logout", (req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.json({ message: "Logged out" });
});

// ===== PROTECTED =====
app.get("/api/me", async (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const { data: user, error } = await supabase
      .from("users")
      .select("email, created_at")
      .eq("email", payload.email)
      .single();

    res.json({ user });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

app.listen(process.env.PORT, () => console.log(`Server running on http://localhost:${process.env.PORT}`));
