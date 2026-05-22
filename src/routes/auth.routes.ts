import { Router } from "express";
import { loginUser, registerUser, verifyToken } from "../controllers/auth.controller";
import { forgotPassword, verifyOtp, resetPassword } from "../controllers/passwordReset.controller";

const router = Router();

// POST /api/auth/login
router.post("/login", loginUser);

// POST /api/auth/register
router.post("/register", registerUser);

// GET /api/auth/verify
router.get("/verify", verifyToken);

// Password Reset Flow
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

export default router;
