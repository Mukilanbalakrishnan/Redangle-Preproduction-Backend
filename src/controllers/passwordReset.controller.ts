import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import {
  findUserByEmail,
  invalidateExistingOtps,
  insertOtp,
  findValidOtp,
  markOtpUsed,
  updatePasswordHash,
} from "../queries/passwordReset.query";

/** Generate a 6-digit numeric OTP */
const generateOtp = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/** Build a nodemailer transporter from env vars */
const getTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    },
  });

// ─── 1. Forgot Password — send OTP ──────────────────────────
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check user exists
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address",
      });
    }

    // Invalidate any previous unused OTPs for this email
    await invalidateExistingOtps(normalizedEmail);

    // Generate & store new OTP
    const otp = generateOtp();
    await insertOtp(normalizedEmail, otp);

    // Send OTP email
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Red Angle" <${process.env.SMTP_EMAIL || process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Password Reset OTP — Red Angle",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #faf5ff; border-radius: 16px;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">Password Reset</h2>
          <p style="color: #475569; font-size: 14px;">Hi <strong>${user.name}</strong>,</p>
          <p style="color: #475569; font-size: 14px;">Use the OTP below to reset your password. This code is valid for <strong>5 minutes</strong>.</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #7c3aed; background: #ede9fe; padding: 16px 32px; border-radius: 12px;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center;">Red Angle Studio</p>
        </div>
      `,
    });

    return res.json({
      success: true,
      message: "OTP sent to your email address",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again.",
    });
  }
};

// ─── 2. Verify OTP ──────────────────────────────────────────
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const validOtp = await findValidOtp(normalizedEmail, otp);
    if (!validOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP. Please request a new one.",
      });
    }

    // Mark OTP as used
    await markOtpUsed(validOtp.id);

    return res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }
};

// ─── 3. Reset Password ─────────────────────────────────────
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify user exists
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Hash and update
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await updatePasswordHash(normalizedEmail, passwordHash);

    return res.json({
      success: true,
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Password reset failed. Please try again.",
    });
  }
};
