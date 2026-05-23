'use strict';

const { Router } = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const locationRoutes = require('./location.routes');
const configRoutes = require('./config.routes');
const configAdminRoutes = require('./admin/config.admin.routes');

const router = Router();

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Public / auth routes
// ---------------------------------------------------------------------------
router.use('/auth', authRoutes);

// ---------------------------------------------------------------------------
// User routes (mixed public + authenticated)
// ---------------------------------------------------------------------------
router.use('/users', userRoutes);

// ---------------------------------------------------------------------------
// Location routes (authenticated)
// ---------------------------------------------------------------------------
router.use('/location', locationRoutes);

// ---------------------------------------------------------------------------
// Config routes (optional auth for tier-awareness)
// ---------------------------------------------------------------------------
router.use('/config', configRoutes);

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------
router.use('/admin/config', configAdminRoutes);

module.exports = router;
