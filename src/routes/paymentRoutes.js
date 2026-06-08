const express = require('express');
const router = express.Router();

const { simulatePayment, processPayment, getMyPayments, getAllPayments, getPaymentById, midtransNotification } = require('../controllers/paymentController');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// Midtrans webhook (public notification endpoint)
router.post('/notification', midtransNotification);

// User: Simulasi pembayaran
router.post('/simulate', verifyToken, authorize('user', 'admin', 'finance'), simulatePayment);

// User: Lihat riwayat pembayaran sendiri
router.get('/my', verifyToken, authorize('user', 'admin', 'finance'), getMyPayments);

// Admin/Finance: Proses pembayaran (approve/reject)
router.post('/:id/process', verifyToken, authorize('admin', 'finance'), processPayment);

// Admin/Finance: Lihat semua pembayaran
router.get('/', verifyToken, authorize('admin', 'finance'), getAllPayments);

// All: Lihat detail pembayaran
router.get('/:id', verifyToken, authorize('user', 'admin', 'finance'), getPaymentById);

module.exports = router;
