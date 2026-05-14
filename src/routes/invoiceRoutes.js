const express = require('express');
const router = express.Router();

const { createInvoice, getMyInvoices, getAllInvoices, getInvoiceById, updateInvoiceStatus, getInvoiceItems } = require('../controllers/invoiceController');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// User: Lihat invoice sendiri
router.get('/my', verifyToken, authorize('user', 'admin', 'finance'), getMyInvoices);

// Admin/Finance: CRUD invoice
router.post('/', verifyToken, authorize('admin', 'finance'), createInvoice);
router.get('/', verifyToken, authorize('admin', 'finance'), getAllInvoices);
router.put('/:id/status', verifyToken, authorize('admin', 'finance'), updateInvoiceStatus);

// All: Detail invoice + items
router.get('/:id', verifyToken, authorize('user', 'admin', 'finance'), getInvoiceById);
router.get('/:id/items', verifyToken, authorize('user', 'admin', 'finance'), getInvoiceItems);

module.exports = router;