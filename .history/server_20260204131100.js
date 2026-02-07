import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// dotenv нужно вызвать первым
dotenv.config();

import { authRouter } from "./routes/auth.routes.js";
import { diaryRouter } from "./routes/diary.routes.js";

const app = express();

// ===== MIDDLEWARE =====
app.use(cors({
  origin: ["http://localhost:3000", "https://your-book-plen-7ykl6cdsp-ilkarions-projects.vercel.app"],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ===== ROUTES =====
app.use("/api", authRouter);
app.use("/api", diaryRouter);

// ===== KEEP SERVER ALIVE =====
app.get("/api/ping", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ===== START SERVER =====
app.listen(process.env.PORT, () =>
  console.log(`Server running on http://localhost:${process.env.PORT}`)
);
