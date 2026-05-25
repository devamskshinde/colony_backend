'use strict';

const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rateLimit.middleware');

const router = Router();

// Rate limiting on all auth routes
router.use(authLimiter);

// OTP flow (works when Twilio is configured, OTP_MOCK=true for dev)
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/register', authController.register);

// Email/password flow (always works, no SMS provider needed)
router.post('/register-email', authController.registerEmail);
router.post('/login-email', authController.loginEmail);

// Token management
router.post('/refresh', authController.refreshToken);
router.post('/logout', require('../middleware/auth.middleware').authenticate, authController.logout);

module.exports = router;
