import express from "express";
import { getDiary, sendDiary } from "../controllers/diary.controller.js";

export const diaryRouter = express.Router();

diaryRouter.post("/diary", getDiary);
diaryRouter.post("/diary-send", sendDiary);
