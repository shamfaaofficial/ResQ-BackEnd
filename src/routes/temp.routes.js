const express = require('express');
const router = express.Router();
const tempAdminController = require('../controllers/temp.admin.controller');

/**
 * TEMPORARY ROUTES - DELETE AFTER USE
 * These routes are for one-time admin creation
 */

// Create admin user (TEMPORARY - DELETE AFTER USE)
router.post('/create-admin', tempAdminController.createAdmin);

module.exports = router;
