import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getDiary, saveDiary } from "../controllers/diary.controller.js";

const router = express.Router();

router.post("/diary", requireAuth, getDiary);
router.post("/diary-send", requireAuth, saveDiary);

export default router;
