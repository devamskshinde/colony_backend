'use strict';

const { Router } = require('express');
const configController = require('../controllers/config.controller');
const optionalAuthenticate = require('../middleware/auth.middleware').optionalAuthenticate;

const router = Router();

// ---------------------------------------------------------------------------
// All config routes use optional authentication so that the tier can be
// resolved for authenticated users while anonymous users still get defaults.
// ---------------------------------------------------------------------------
router.use(optionalAuthenticate);

// ---------------------------------------------------------------------------
// GET /config
// ---------------------------------------------------------------------------
router.get('/', configController.getConfig);

// ---------------------------------------------------------------------------
// GET /config/version
// ---------------------------------------------------------------------------
router.get('/version', configController.getConfigVersion);

// ---------------------------------------------------------------------------
// GET /config/features
// ---------------------------------------------------------------------------
router.get('/features', configController.getFeatureFlags);

module.exports = router;
