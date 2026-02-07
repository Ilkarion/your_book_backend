import express from "express";
import { register, login, confirm, refresh, logout, getProfile } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.get("/confirm", confirm);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);

// Пример защищённого роута
authRouter.get("/me", requireAuth, getProfile);
