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

// ===== CORS =====
const allowedOrigins = [
  "http://localhost:3000",
  "https://your-book-plen.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// ===== Supabase =====
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

// ===== BREVO =====
const client = new SibApiV3Sdk.TransactionalEmailsApi();
client.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

async function sendVerification(email, token) {
  await client.sendTransacEmail({
    sender: { email: "myfirststepsprogramming@gmail.com", name: "Light" },
    to: [{ email }],
    subject: "Confirm your email",
    htmlContent: `<a href="${process.env.SERVER_URL}/api/confirm?token=${token}">Verify email</a>`,
  });
}

// ===== JWT =====
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const REFRESH_EXPIRE = process.env.REFRESH_EXPIRE;

// ===== Helpers =====
function setCookie(res, name, value, maxAge) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(name, value, {
    httpOnly: true,
    secure: isProd,
    sameSite: "None",
    maxAge,
    path: "/",
  });
}

// ===== REGISTER =====
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const confirmToken = crypto.randomBytes(32).toString("hex");

  const { data, error } = await supabase.from("users").insert([
    { email, password: hashed, confirm_token: confirmToken },
  ]);

  if (error) return res.status(400).json({ message: error.message });

  try {
    await sendVerification(email, confirmToken);
    return res.status(200).json({ message: "Registered!" });
  } catch (e) {
    console.error("Email send failed", e);
    return res.status(500).json({ message: "Email send failed" });
  }
});

// ===== CONFIRM =====
app.get("/api/confirm", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send("The token is missing");

  try {
    await supabase.rpc("set_token", { token_value: token });
    const { data, error } = await supabase.rpc("confirm_email", { token });
    if (error) return res.status(400).send("Confirmation error");
    if (!data?.[0]?.success) return res.status(400).send("Invalid token");

    res.send("Email confirmed! You can now login.");
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// ===== LOGIN =====
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, password, is_confirmed")
      .eq("email", email)
      .single();

    if (error || !user) return res.status(400).json({ message: "Invalid email or password" });
    if (!user.is_confirmed) return res.status(403).json({ message: "Email not confirmed" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid email or password" });

    const accessToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    const refreshToken = jwt.sign({ email }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRE });

    setCookie(res, "access_token", accessToken, 15 * 60 * 1000);
    setCookie(res, "refresh_token", refreshToken, 7 * 24 * 60 * 60 * 1000);

    res.json({ message: "Logged in!" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ===== REFRESH TOKEN =====
app.post("/api/refresh", (req, res) => {
  const { refresh_token } = req.cookies;
  if (!refresh_token) return res.status(401).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(refresh_token, REFRESH_SECRET);
    const accessToken = jwt.sign({ email: payload.email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    setCookie(res, "access_token", accessToken, 15 * 60 * 1000);
    res.json({ message: "Token refreshed" });
  } catch (err) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// ===== LOGOUT =====
app.post("/api/logout", (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("access_token", { httpOnly: true, secure: isProd, sameSite: "None", path: "/" });
  res.clearCookie("refresh_token", { httpOnly: true, secure: isProd, sameSite: "None", path: "/" });
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

    if (error || !user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// ===== PING =====
app.get("/api/ping", (req, res) => res.json({ status: "ok" }));

// ===== START SERVER =====
app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
