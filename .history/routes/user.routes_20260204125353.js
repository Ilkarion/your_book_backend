import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getProfile } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/me", requireAuth, getProfile);

export default router;
