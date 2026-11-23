import { Router } from "express";
import {
  signup,
  login,
  logout,
  me,
  forgotPassword,
  reset,
} from "../controllers/auth.js";

const router = Router();
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", me);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", reset);

export default router;
