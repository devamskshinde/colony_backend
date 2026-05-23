'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

const log = logger.child({ service: 'otp' });

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const BCRYPT_ROUNDS = 10;

/**
 * OTP service - handles OTP generation, verification, and resend cooldowns.
 *
 * Expects a database pool (pg.Pool) to be injected via init(dbPool).
 * Table expected: otps
 *   columns: id, phone, code_hash, purpose, attempts, used, created_at, expires_at
 */

let db = null;

/**
 * Initialize the OTP service.
 * @param {import('pg').Pool} dbPool
 */
function init(dbPool) {
  db = dbPool;
  log.info('OTP service initialized');
}

function assertDb() {
  if (!db) throw new Error('OTP service not initialized: no database pool');
}

/**
 * Generate a cryptographically secure random 6-digit OTP code.
 * @returns {string} - 6-digit string (zero-padded)
 */
function generateCode() {
  // crypto.randomInt returns a value in [0, max)
  const num = crypto.randomInt(0, 1_000_000);
  return String(num).padStart(OTP_LENGTH, '0');
}

/**
 * Generate a new OTP for a given phone and purpose.
 *
 * Rate limit: max 3 OTPs per phone per hour (per purpose).
 * Stores bcrypt hash of the code in the database.
 * In dev mode, logs the plaintext OTP.
 * In prod mode, sends via SMS (stub Twilio for now).
 *
 * @param {string} phone
 * @param {string} purpose - e.g. 'registration', 'login', 'password_reset'
 * @returns {Promise<{success: boolean, cooldownSeconds?: number, error?: string}>}
 */
async function generateOtp(phone, purpose) {
  assertDb();

  const now = new Date();

  try {
    // Rate limit check: 3 per hour per phone
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const rateResult = await db.query(
      `SELECT COUNT(*)::int AS cnt
       FROM otps
       WHERE phone = $1 AND purpose = $2 AND created_at > $3`,
      [phone, purpose, oneHourAgo]
    );

    if (rateResult.rows[0].cnt >= 3) {
      log.warn('OTP rate limit exceeded', { phone, purpose });
      return { success: false, error: 'Rate limit exceeded. Try again later.' };
    }

    // Resend cooldown check (60 seconds)
    const lastOtp = await db.query(
      `SELECT created_at FROM otps
       WHERE phone = $1 AND purpose = $2
       ORDER BY created_at DESC LIMIT 1`,
      [phone, purpose]
    );

    if (lastOtp.rows.length > 0) {
      const elapsed = (now.getTime() - new Date(lastOtp.rows[0].created_at).getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
        log.debug('OTP resend cooldown active', { phone, purpose, remainingSeconds: remaining });
        return { success: false, cooldownSeconds: remaining, error: `Please wait ${remaining} seconds before requesting a new OTP.` };
      }
    }

    // Generate and hash
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000);

    // Store in DB
    await db.query(
      `INSERT INTO otps (phone, code_hash, purpose, attempts, used, created_at, expires_at)
       VALUES ($1, $2, $3, 0, false, $4, $5)`,
      [phone, codeHash, purpose, now, expiresAt]
    );

    // Send OTP
    if (process.env.NODE_ENV === 'production') {
      // Production: send via Twilio SMS (stub)
      log.info('OTP generated (production SMS stub)', { phone, purpose });
      await sendSms(phone, code);
    } else {
      // Dev: log the OTP
      log.info('OTP generated (dev mode - logged)', { phone, purpose, otp: code });
    }

    return { success: true };
  } catch (err) {
    log.error('Failed to generate OTP', { phone, purpose, error: err.message });
    throw err;
  }
}

/**
 * Verify an OTP code against the stored hash.
 *
 * Checks: not expired, not already used, attempts <= 5, hash matches.
 * On success: marks OTP as used.
 *
 * @param {string} phone
 * @param {string} code - plaintext OTP from user
 * @param {string} purpose
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function verifyOtp(phone, code, purpose) {
  assertDb();

  try {
    // Find latest unused OTP for this phone+purpose
    const result = await db.query(
      `SELECT id, code_hash, attempts, expires_at, used
       FROM otps
       WHERE phone = $1 AND purpose = $2 AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone, purpose]
    );

    if (result.rows.length === 0) {
      log.warn('No OTP found for verification', { phone, purpose });
      return { success: false, error: 'No OTP found. Please request a new one.' };
    }

    const otpRow = result.rows[0];

    // Check expiry
    if (new Date() > new Date(otpRow.expires_at)) {
      log.warn('OTP expired', { phone, purpose });
      return { success: false, error: 'OTP has expired. Please request a new one.' };
    }

    // Check attempts
    if (otpRow.attempts >= MAX_ATTEMPTS) {
      log.warn('OTP max attempts exceeded', { phone, purpose, attempts: otpRow.attempts });
      return { success: false, error: 'Maximum verification attempts exceeded. Please request a new OTP.' };
    }

    // Increment attempts
    await db.query(
      'UPDATE otps SET attempts = attempts + 1 WHERE id = $1',
      [otpRow.id]
    );

    // Compare hash
    const matches = await bcrypt.compare(code, otpRow.code_hash);
    if (!matches) {
      log.warn('OTP verification failed: code mismatch', { phone, purpose });
      return { success: false, error: 'Invalid OTP code.' };
    }

    // Mark as used
    await db.query(
      'UPDATE otps SET used = true WHERE id = $1',
      [otpRow.id]
    );

    log.info('OTP verified successfully', { phone, purpose });
    return { success: true };
  } catch (err) {
    log.error('Failed to verify OTP', { phone, purpose, error: err.message });
    throw err;
  }
}

/**
 * Check if a resend is allowed (60-second cooldown).
 * @param {string} phone
 * @param {string} purpose
 * @returns {Promise<{canResend: boolean, waitSeconds?: number}>}
 */
async function canResend(phone, purpose) {
  assertDb();

  try {
    const result = await db.query(
      `SELECT created_at FROM otps
       WHERE phone = $1 AND purpose = $2
       ORDER BY created_at DESC LIMIT 1`,
      [phone, purpose]
    );

    if (result.rows.length === 0) {
      return { canResend: true };
    }

    const elapsed = (Date.now() - new Date(result.rows[0].created_at).getTime()) / 1000;
    if (elapsed >= RESEND_COOLDOWN_SECONDS) {
      return { canResend: true };
    }

    const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
    return { canResend: false, waitSeconds };
  } catch (err) {
    log.error('Failed to check resend cooldown', { phone, purpose, error: err.message });
    throw err;
  }
}

/**
 * Send SMS via Twilio (stub).
 * In production, integrate with Twilio SDK.
 * @param {string} phone
 * @param {string} code
 */
async function sendSms(phone, code) {
  // TODO: Integrate Twilio SDK
  // const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({
  //   body: `Your Colony verification code is: ${code}`,
  //   from: process.env.TWILIO_PHONE,
  //   to: phone,
  // });
  log.info('SMS stub: would send OTP', { phone });
}

module.exports = {
  init,
  generateOtp,
  verifyOtp,
  canResend,
};
