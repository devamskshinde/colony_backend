'use strict';

const { Router } = require('express');
const locationController = require('../controllers/location.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { locationLimiter } = require('../middleware/rateLimit.middleware');

const router = Router();

// ---------------------------------------------------------------------------
// All location routes require authentication + location-specific rate limiting
// ---------------------------------------------------------------------------
router.use(authenticate);
router.use(locationLimiter);

// ---------------------------------------------------------------------------
// POST /location/update
// ---------------------------------------------------------------------------
router.post('/update', locationController.updateLocation);

// ---------------------------------------------------------------------------
// GET /location/nearby
// ---------------------------------------------------------------------------
router.get('/nearby', locationController.getNearby);

// ---------------------------------------------------------------------------
// GET /location
// ---------------------------------------------------------------------------
router.get('/', locationController.getLocation);

// ---------------------------------------------------------------------------
// DELETE /location
// ---------------------------------------------------------------------------
router.delete('/', locationController.removeLocation);

module.exports = router;
