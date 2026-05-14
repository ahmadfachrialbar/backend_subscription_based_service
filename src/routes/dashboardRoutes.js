const express = require('express');
const router = express.Router();

const { getAdminDashboard, getFinanceDashboard, exportSubscriptionsCSV, exportInvoicesCSV, exportPaymentsCSV, exportRevenueCSV } = require('../controllers/dashboardController');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// Dashboard Admin
router.get('/admin', verifyToken, authorize('admin'), getAdminDashboard);

// Dashboard Finance
router.get('/finance', verifyToken, authorize('admin', 'finance'), getFinanceDashboard);

// Export CSV (admin/finance)
router.get('/export/subscriptions', verifyToken, authorize('admin', 'finance'), exportSubscriptionsCSV);
router.get('/export/invoices', verifyToken, authorize('admin', 'finance'), exportInvoicesCSV);
router.get('/export/payments', verifyToken, authorize('admin', 'finance'), exportPaymentsCSV);
router.get('/export/revenue', verifyToken, authorize('admin', 'finance'), exportRevenueCSV);

module.exports = router;
