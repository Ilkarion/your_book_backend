import express from "express";
import {
  register,
  login,
  confirm,
  refresh,
  logout,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.get("/confirm", confirm);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
