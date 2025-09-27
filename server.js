import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import cors from "cors";
import SibApiV3Sdk from '@sendinblue/client';
dotenv.config();


const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));


app.use(express.json());
app.use(cookieParser());

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

//send gamail BREVO
const client = new SibApiV3Sdk.TransactionalEmailsApi();
client.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

export async function sendVerification(email, token) {
  await client.sendTransacEmail({
    sender: { email: "myfirststepsprogramming@gmail.com", name: "Light" },
    to: [{ email }],
    subject: "Confirm your email",
    htmlContent: `<a href="${process.env.SERVER_URL}/api/confirm?token=${token}">Verify email</a>`
  });
}

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
    try {
      await sendVerification(email, confirmToken);
      return res.status(200).json({ message: "Registered!" });
    } catch (e) {
      console.error("Email send failed", e);
      return res.status(500).json({ message: "Email send failed" });
    }
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
  const isProduction = process.env.NODE_ENV === "production";

  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    // ищем только этого юзера
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, password, is_confirmed")
      .eq("email", email)
      .single();
    if (error || !user)
      return res.status(400).json({ message: "Invalid email or password" });

    // проверка подтверждения почты
    if (!user.is_confirmed)
      return res.status(403).json({ message: "Email not confirmed" });

    // сверяем хэш
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ message: "Invalid email or password" });

    // генерим токены
    const accessToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    //jwExpir = short life time
    const refreshToken = jwt.sign({ email }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRE });

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "Strict" : "Lax",
      maxAge: 15 * 60 * 1000
    });
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "Strict" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ message: "Logged in!" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// ===== REFRESH TOKEN =====
app.post("/api/refresh", (req, res) => {
  const { refresh_token } = req.cookies;
  if (!refresh_token) return res.status(401).json({ message: "No refresh token" });
const isProduction = process.env.NODE_ENV === "production";
  try {
    const payload = jwt.verify(refresh_token, REFRESH_SECRET);
    const accessToken = jwt.sign({ email: payload.email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "Strict" : "Lax",
      maxAge: 15 * 60 * 1000
    });
    res.status(200).json({ message: "Token refreshed" });
  } catch (err) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// ===== LOGOUT =====
app.post("/api/logout", (req, res) => {
  const accessToken = req.cookies["access_token"];
  const refreshToken = req.cookies["refresh_token"];
  const isProduction = process.env.NODE_ENV === "production";
  if (!accessToken && !refreshToken) {
    // Если куки уже нет — пользователь и так вылогинен
    return res.status(400).json({ message: "User already logged out" });
  }

  // Удаляем куки
res.clearCookie("access_token", { httpOnly: true, secure: isProduction, sameSite: isProduction ? "Strict" : "Lax", path: "/" });
res.clearCookie("refresh_token", { httpOnly: true, secure: isProduction, sameSite: isProduction ? "Strict" : "Lax", path: "/" });
  // Возвращаем успешный ответ
  res.status(200).json({ message: "Successfully logged out" });
});


// ===== PROTECTED =====
app.get("/api/me", async (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    //Проверяет токен, возвращает расшифрованные данные.
    const payload = jwt.verify(token, JWT_SECRET);

    const { data: user, error } = await supabase
      .from("users")
      .select("email, created_at")
      .eq("email", payload.email)
      .single();

    res.status(200).json({ user });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

//thin request to make this server always 'on' while user using frontend web site. 
//Bcs 'Render' service will sleep if user dont make request for 10min
app.get("/api/ping", (req, res) => {
  res.status(200).json({ status: "ok" });
});


app.listen(process.env.PORT, () => console.log(`Server running on http://localhost:${process.env.PORT}`));
