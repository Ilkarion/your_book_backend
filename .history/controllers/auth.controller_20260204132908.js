// controllers/auth.controller.js
import { supabase } from "../config/supabase.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerification } from "../utils/sendVerification.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const REFRESH_EXPIRE = process.env.REFRESH_EXPIRE;

// ===== REGISTER =====
export const register = async (req, res) => {
  const { username, email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const confirmToken = crypto.randomBytes(32).toString("hex");

    // 1. Insert user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert([{ username, email, password: hashed, confirm_token: confirmToken }])
      .select("id")
      .single();

    if (userError) return res.status(400).json({ message: userError.message });

    // 2. Insert into usersRecords
    const { error: recordsError } = await supabase
      .from("usersRecords")
      .insert([{ id_user: userData.id, records: [], all_Tags: [], all_Color_Tags: [] }]);

    if (recordsError) return res.status(400).json({ message: recordsError.message });

    // 3. Send email
    try {
      await sendVerification(email, confirmToken);
    } catch (err) {
      console.error("Email send error:", err);
      return res.status(500).json({ message: "Email send failed" });
    }

    res.status(200).json({ message: "Registered! Check your email to confirm." });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== CONFIRM EMAIL =====
export const confirm = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send("The token is missing");

  try {
    const { data, error } = await supabase.rpc("confirm_email", { token });
    if (error || !data?.[0]?.success) {
      return res.status(400).send("Invalid or expired token. Or just try login ;)");
    }

    res.send("Email confirmed! You can now login.");
  } catch (err) {
    res.status(500).send("Server error");
  }
};

// ===== LOGIN =====
export const login = async (req, res) => {
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

    const accessToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    const refreshToken = jwt.sign({ email }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRE });

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.PROD,
      sameSite: process.env.PROD ? "none" : "lax",
      maxAge: 15 * 60 * 1000
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.PROD,
      sameSite: process.env.PROD ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ message: "Logged in!" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ===== REFRESH TOKEN =====
export const refresh = (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const newAccess = jwt.sign({ email: payload.email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

    res.cookie("access_token", newAccess, {
      httpOnly: true,
      secure: process.env.PROD,
      sameSite: process.env.PROD ? "none" : "lax",
      maxAge: 10 * 60 * 1000
    });

    res.status(200).json({ message: "Token refreshed" });
  } catch (err) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
};

// ===== LOGOUT =====
export const logout = (req, res) => {
  res.clearCookie("access_token", { httpOnly: true, path: "/" });
  res.clearCookie("refresh_token", { httpOnly: true, path: "/" });
  res.status(200).json({ message: "Logged out" });
};

// ===== GET PROFILE =====
export const getProfile = async (req, res) => {
  try {
    const { email } = req.user;
    const { data: user } = await supabase
      .from("users")
      .select("username, email, created_at")
      .eq("email", email)
      .single();

    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
