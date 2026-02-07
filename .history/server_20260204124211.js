import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import diaryRoutes from "./routes/diary.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

app.use(cors({
  origin: ["http://localhost:3000", "https://your-book-plen-7ykl6cdsp-ilkarions-projects.vercel.app"],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use("/api", authRoutes);
app.use("/api", diaryRoutes);
app.use("/api", userRoutes);

export default app;
