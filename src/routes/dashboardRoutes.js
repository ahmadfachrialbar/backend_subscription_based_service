const express = require('express');
const router = express.Router();

const { getAdminDashboard, getFinanceDashboard } = require('../controllers/dashboardController');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// Dashboard Admin
router.get('/admin', verifyToken, authorize('admin'), getAdminDashboard);

// Dashboard Finance
router.get('/finance', verifyToken, authorize('admin', 'finance'), getFinanceDashboard);


module.exports = router;
