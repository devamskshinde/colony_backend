'use strict';

const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const { verifyRequestSignature } = require('../middleware/requestSigning.middleware');

const router = Router();

// ---------------------------------------------------------------------------
// Rate limiting applied to ALL auth routes
// ---------------------------------------------------------------------------
router.use(authLimiter);

// ---------------------------------------------------------------------------
// POST /auth/send-otp
// ---------------------------------------------------------------------------
router.post('/send-otp', authController.sendOtp);

// ---------------------------------------------------------------------------
// POST /auth/verify-otp  (request signing required)
// ---------------------------------------------------------------------------
router.post('/verify-otp', verifyRequestSignature, authController.verifyOtp);

// ---------------------------------------------------------------------------
// POST /auth/register  (request signing required)
// ---------------------------------------------------------------------------
router.post('/register', verifyRequestSignature, authController.register);

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------
router.post('/refresh', authController.refreshToken);

// ---------------------------------------------------------------------------
// POST /auth/logout  (authenticated)
// ---------------------------------------------------------------------------
router.post('/logout', require('../middleware/auth.middleware').authenticate, authController.logout);

module.exports = router;
