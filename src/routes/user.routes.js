'use strict';

const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();

// ---------------------------------------------------------------------------
// GET /users/search  --  public (search is available to all, but results
// are scoped when authenticated)
// ---------------------------------------------------------------------------
router.get('/search', userController.searchUsers);

// ---------------------------------------------------------------------------
// GET /users/:id  --  public profile (no auth required)
// ---------------------------------------------------------------------------
router.get('/:id', userController.getPublicProfile);

// ---------------------------------------------------------------------------
// All routes below require authentication
// ---------------------------------------------------------------------------
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /users/profile
// ---------------------------------------------------------------------------
router.get('/profile', userController.getProfile);

// ---------------------------------------------------------------------------
// PUT /users/profile
// ---------------------------------------------------------------------------
router.put('/profile', userController.updateProfile);

// ---------------------------------------------------------------------------
// POST /users/avatar
// ---------------------------------------------------------------------------
router.post('/avatar', userController.updateAvatar);

// ---------------------------------------------------------------------------
// PUT /users/fcm-token
// ---------------------------------------------------------------------------
router.put('/fcm-token', userController.updateFCMToken);

// ---------------------------------------------------------------------------
// DELETE /users/account
// ---------------------------------------------------------------------------
router.delete('/account', userController.deleteAccount);

module.exports = router;
