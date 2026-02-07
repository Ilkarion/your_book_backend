import express from "express";
import { getDiary, sendDiary } from "../controllers/diary.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

export default diaryRouter = express.Router();

diaryRouter.post("/diary", requireAuth, getDiary);
diaryRouter.post("/diary-send", requireAuth, sendDiary);
