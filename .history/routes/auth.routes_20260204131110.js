import express from "express";
import { register, login, confirm, refresh, logout, getProfile } from "../controllers/auth.controller.js";

export const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.get("/confirm", confirm);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.get("/me", getProfile);
