const express = require('express');
const router = express.Router();

const { getMyNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/authMiddleware');

// Semua user yang login bisa akses notifikasi
router.get('/', verifyToken, getMyNotifications);
router.put('/read-all', verifyToken, markAllAsRead);
router.put('/:id/read', verifyToken, markAsRead);

module.exports = router;
