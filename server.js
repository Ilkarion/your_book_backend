import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import cors from "cors";
import SibApiV3Sdk from "@sendinblue/client";

dotenv.config();

const app = express();

// ===== MIDDLEWARE =====
app.use(cors({
  origin: ["http://localhost:3000", "https://your-book-plen.vercel.app"],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ===== SUPABASE =====
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

// ===== BREVO =====
const client = new SibApiV3Sdk.TransactionalEmailsApi();
client.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

async function sendVerification(email, token) {
  await client.sendTransacEmail({
    sender: { email: "myfirststepsprogramming@gmail.com", name: "Light" },
    to: [{ email }],
    subject: "Confirm your email",
    htmlContent: `<a href="${process.env.SERVER_URL}/api/confirm?token=${token}">Verify email</a>`,
  });
}

// ===== CONFIG =====
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE; // e.g. "15m"
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const REFRESH_EXPIRE = process.env.REFRESH_EXPIRE; // e.g. "7d"

// ===== REGISTER =====
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const confirmToken = crypto.randomBytes(32).toString("hex");

    const { error } = await supabase
      .from("users")
      .insert([{ email, password: hashed, confirm_token: confirmToken }]);

    if (error) return res.status(400).json({ message: error.message });

    await sendVerification(email, confirmToken);
    res.status(200).json({ message: "Registered! Check your email to confirm." });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== CONFIRM =====
app.get("/api/confirm", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send("The token is missing");

  try {
    const { data, error } = await supabase.rpc("confirm_email", { token });
    if (error || !data?.[0]?.success) {
      return res.status(400).send("Invalid or expired token");
    }

    res.send("Email confirmed! You can now login.");
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// ===== LOGIN =====
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, password, is_confirmed")
      .eq("email", email)
      .single();

    if (error || !user)
      return res.status(400).json({ message: "Invalid email or password" });

    if (!user.is_confirmed)
      return res.status(403).json({ message: "Email not confirmed" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ message: "Invalid email or password" });

    // Генерим токены
    const accessToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    const refreshToken = jwt.sign({ email }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRE });

    // Кладём Оба токена в HttpOnly cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000 // 15 минут (или как в JWT_EXPIRE)
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
    });

    // Теперь JSON не нужен — браузер сам будет отправлять куки
    res.status(200).json({ message: "Logged in" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// ===== REFRESH =====
app.post("/api/refresh", (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const newAccess = jwt.sign({ email: payload.email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

    res.cookie("access_token", newAccess, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000
    });

    res.status(200).json({ message: "Token refreshed" });
  } catch (err) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});


// ===== PROTECTED =====
app.get("/api/me", async (req, res) => {
  const token = req.cookies.access_token; // достаём из cookie
  if (!token) return res.status(403).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const { data: user } = await supabase
      .from("users")
      .select("email, created_at")
      .eq("email", payload.email)
      .single();

    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});


// ===== LOGOUT =====
app.post("/api/logout", (req, res) => {
  res.clearCookie("access_token", { httpOnly: true, path: "/" });
  res.clearCookie("refresh_token", { httpOnly: true, path: "/" });
  res.status(200).json({ message: "Logged out" });
});

// ===== KEEP SERVER ALIVE =====
app.get("/api/ping", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ===== START SERVER =====
app.listen(process.env.PORT, () =>
  console.log(`Server running on http://localhost:${process.env.PORT}`)
);
