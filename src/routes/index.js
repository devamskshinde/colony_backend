'use strict';

const { Router } = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const locationRoutes = require('./location.routes');
const configRoutes = require('./config.routes');
const configAdminRoutes = require('./admin/config.admin.routes');
const adminAuthRoutes = require('./admin/auth.routes');
const adminDashboardRoutes = require('./admin/dashboard.routes');
const adminUsersRoutes = require('./admin/users.routes');
const adminAnalyticsRoutes = require('./admin/analytics.routes');
const adminLogsRoutes = require('./admin/logs.routes');
const adminInfraRoutes = require('./admin/infrastructure.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/location', locationRoutes);
router.use('/config', configRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/config', configAdminRoutes);
router.use('/admin/dashboard', adminDashboardRoutes);
router.use('/admin/users', adminUsersRoutes);
router.use('/admin/analytics', adminAnalyticsRoutes);
router.use('/admin/logs', adminLogsRoutes);
router.use('/admin/infrastructure', adminInfraRoutes);

module.exports = router;