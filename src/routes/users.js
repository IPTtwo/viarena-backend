import { Router } from "express";
import { updateMe } from "../controllers/users.js";

const router = Router();
router.patch("/me", updateMe);
export default router;
