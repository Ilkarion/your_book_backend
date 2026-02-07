import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { sendVerification } from "../utils/sendVerification.js";

export const register = async (req, res) => {
  // вынеси логику регистрации сюда (почти как у тебя)
};

export const login = async (req, res) => {
  // логика логина
};

export const confirm = async (req, res) => {
  // подтверждение email
};

export const refresh = async (req, res) => {
  // refresh token
};

export const logout = (req, res) => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
  res.status(200).json({ message: "Logged out" });
};
