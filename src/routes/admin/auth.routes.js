'use strict';

const { Router } = require('express');
const { login, me } = require('../../controllers/adminAuth.controller');
const { adminAuthenticate } = require('../../middleware/adminAuth.middleware');

const router = Router();

// POST /api/v1/admin/auth/login — public (no auth required)
router.post('/login', login);

// GET /api/v1/admin/auth/me — requires admin JWT
router.get('/me', adminAuthenticate, me);

module.exports = router;
