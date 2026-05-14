const express = require('express');
const router = express.Router();

const { createSubscription, getMySubscription, getAllSubscriptions, cancelSubscription, previewChangePlan, changePlan, getSubscriptionHistory } = require('../controllers/subscriptionController');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// User: CRUD subscription
router.post('/', verifyToken, authorize('user', 'admin', 'finance'), createSubscription);
router.get('/my', verifyToken, authorize('user', 'admin', 'finance'), getMySubscription);

// User: Upgrade/Downgrade paket
router.post('/preview-change', verifyToken, authorize('user', 'admin', 'finance'), previewChangePlan);
router.post('/change-plan', verifyToken, authorize('user', 'admin', 'finance'), changePlan);

// User/Admin: Riwayat subscription
router.get('/history', verifyToken, authorize('user', 'admin', 'finance'), getSubscriptionHistory);

// Admin: Lihat semua subscription
router.get('/', verifyToken, authorize('admin'), getAllSubscriptions);

// User/Admin: Cancel subscription
router.put('/:id/cancel', verifyToken, authorize('user', 'admin'), cancelSubscription);

module.exports = router;