'use strict';

const { Router } = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const locationRoutes = require('./location.routes');
const configRoutes = require('./config.routes');
const configAdminRoutes = require('./admin/config.admin.routes');
const adminAuthRoutes = require('./admin/auth.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/location', locationRoutes);
router.use('/config', configRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/config', configAdminRoutes);

module.exports = router;
