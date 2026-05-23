'use strict';

const crypto = require('crypto');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const DEVICE_TRUST_PREFIX = 'device:trust:';
const DEVICE_TRUST_TTL = 90 * 24 * 60 * 60; // 90 days

/**
 * Verify an Android device attestation token.
 *
 * Stub implementation -- replace with actual Google Play Integrity API
 * or SafetyNet verification in production.
 *
 * @param {string} token - The attestation token from the Android client.
 * @returns {Promise<Object>} Attestation result with { valid, deviceId, integrityVerdict }.
 */
async function verifyAndroidAttestation(token) {
  if (!token) {
    return { valid: false, reason: 'No attestation token provided' };
  }

  // TODO: Replace with actual Play Integrity API verification.
  // The real implementation should:
  // 1. Decode the JWT token
  // 2. Verify the signature against Google's public keys
  // 3. Validate the device integrity verdict (MEETS_DEVICE_INTEGRITY, etc.)
  // 4. Check that the nonce matches what was sent to the client
  // 5. Verify the package name matches the app
  logger.warn('Android attestation verification is using stub implementation');

  return {
    valid: true,
    deviceId: null,    // Extract from token in real implementation
    verdict: 'STUB_PASSED',
    packageName: null, // Verify against expected package
  };
}

/**
 * Verify an iOS device attestation token (App Attest).
 *
 * Stub implementation -- replace with actual Apple App Attest
 * verification in production.
 *
 * @param {string} token - The attestation object from the iOS client.
 * @returns {Promise<Object>} Attestation result with { valid, deviceId }.
 */
async function verifyIOSAttestation(token) {
  if (!token) {
    return { valid: false, reason: 'No attestation token provided' };
  }

  // TODO: Replace with actual App Attest verification.
  // The real implementation should:
  // 1. Decode the CBOR attestation object
  // 2. Verify the x5c certificate chain against Apple's root
  // 3. Validate the nonce matches what was sent
  // 4. Check the bundle ID matches the app
  // 5. Verify the counter is as expected
  logger.warn('iOS attestation verification is using stub implementation');

  return {
    valid: true,
    deviceId: null, // Extract from attestation in real implementation
    bundleId: null, // Verify against expected bundle ID
  };
}

/**
 * Generate a consistent device fingerprint from device information.
 * Uses SHA-256 to create a deterministic hash from device properties.
 *
 * @param {Object} deviceData - Device information object.
 * @param {string} deviceData.platform - 'android' or 'ios'.
 * @param {string} deviceData.model - Device model name.
 * @param {string} deviceData.manufacturer - Device manufacturer.
 * @param {string} deviceData.osVersion - OS version string.
 * @param {string} [deviceData.screenResolution] - Screen resolution.
 * @param {string} [deviceData.hardwareId] - Hardware identifier.
 * @returns {string} Hex-encoded SHA-256 fingerprint (64 chars).
 */
function generateDeviceFingerprint(deviceData) {
  if (!deviceData || typeof deviceData !== 'object') {
    throw new Error('deviceData must be a non-null object');
  }

  const requiredFields = ['platform', 'model', 'manufacturer', 'osVersion'];
  for (const field of requiredFields) {
    if (!deviceData[field]) {
      throw new Error(`Missing required device field: ${field}`);
    }
  }

  // Build a canonical string from stable device properties
  const parts = [
    deviceData.platform.toLowerCase(),
    deviceData.model.toLowerCase().trim(),
    deviceData.manufacturer.toLowerCase().trim(),
    deviceData.osVersion.trim(),
    (deviceData.screenResolution || '').trim(),
    (deviceData.hardwareId || '').trim(),
  ];

  const canonical = parts.join('::');

  return crypto
    .createHash('sha256')
    .update(canonical)
    .digest('hex');
}

/**
 * Check whether a device is trusted for a given user.
 * A device is considered trusted if it has been previously verified and
 * stored in Redis.
 *
 * @param {string} userId - The user's id.
 * @param {string} deviceId - The device identifier.
 * @returns {Promise<boolean>} True if the device is trusted.
 */
async function isDeviceTrusted(userId, deviceId) {
  if (!userId || !deviceId) return false;

  try {
    const client = redis.getClient();
    const key = `${DEVICE_TRUST_PREFIX}${userId}:${deviceId}`;
    const result = await client.get(key);
    return result === 'trusted';
  } catch (err) {
    logger.error('Failed to check device trust status', {
      userId,
      deviceId,
      error: err.message,
    });
    // Fail open -- do not lock out users if Redis is down
    return false;
  }
}

/**
 * Mark a device as trusted for a given user.
 * Called after successful device attestation or multi-factor verification.
 *
 * @param {string} userId - The user's id.
 * @param {string} deviceId - The device identifier.
 * @returns {Promise<void>}
 */
async function markDeviceTrusted(userId, deviceId) {
  try {
    const client = redis.getClient();
    const key = `${DEVICE_TRUST_PREFIX}${userId}:${deviceId}`;
    await client.set(key, 'trusted', 'EX', DEVICE_TRUST_TTL);
    logger.info('Device marked as trusted', { userId, deviceId });
  } catch (err) {
    logger.error('Failed to mark device as trusted', {
      userId,
      deviceId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Revoke trust for a specific device.
 *
 * @param {string} userId - The user's id.
 * @param {string} deviceId - The device identifier.
 * @returns {Promise<void>}
 */
async function revokeDeviceTrust(userId, deviceId) {
  try {
    const client = redis.getClient();
    const key = `${DEVICE_TRUST_PREFIX}${userId}:${deviceId}`;
    await client.del(key);
    logger.info('Device trust revoked', { userId, deviceId });
  } catch (err) {
    logger.error('Failed to revoke device trust', {
      userId,
      deviceId,
      error: err.message,
    });
    throw err;
  }
}

module.exports = {
  verifyAndroidAttestation,
  verifyIOSAttestation,
  generateDeviceFingerprint,
  isDeviceTrusted,
  markDeviceTrusted,
  revokeDeviceTrust,
};
