import { pool } from "../config/db";

/**
 * Ensures the password_reset_otps table exists.
 * Called once on server startup.
 */
export const ensurePasswordResetTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp_code VARCHAR(6) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      is_used BOOLEAN DEFAULT FALSE
    )
  `);
};

/** Invalidate any unused OTPs for this email before issuing a new one */
export const invalidateExistingOtps = async (email: string) => {
  await pool.query(
    `UPDATE password_reset_otps SET is_used = TRUE WHERE email = $1 AND is_used = FALSE`,
    [email]
  );
};

/** Insert a new OTP record (expires in 5 minutes) */
export const insertOtp = async (email: string, otpCode: string) => {
  await pool.query(
    `INSERT INTO password_reset_otps (email, otp_code, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
    [email, otpCode]
  );
};

/** Find a valid (unused, not expired) OTP for the given email */
export const findValidOtp = async (email: string, otpCode: string) => {
  const result = await pool.query(
    `SELECT id FROM password_reset_otps
     WHERE email = $1 AND otp_code = $2 AND is_used = FALSE AND expires_at > NOW()
     LIMIT 1`,
    [email, otpCode]
  );
  return result.rows[0] ?? null;
};

/** Mark an OTP as used */
export const markOtpUsed = async (id: number) => {
  await pool.query(
    `UPDATE password_reset_otps SET is_used = TRUE WHERE id = $1`,
    [id]
  );
};

/** Check if a user exists by email */
export const findUserByEmail = async (email: string) => {
  const result = await pool.query(
    `SELECT id, name, email FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  return result.rows[0] ?? null;
};

/** Update user password hash */
export const updatePasswordHash = async (email: string, passwordHash: string) => {
  await pool.query(
    `UPDATE users SET password_hash = $1 WHERE email = $2`,
    [passwordHash, email]
  );
};
