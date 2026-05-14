const { pool } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// GET /api/notifications - Lihat notifikasi user
const getMyNotifications = async (req, res, next) => {
    try {
        const user_id = req.user.id;
        const { unread_only } = req.query;

        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        const params = [user_id];

        if (unread_only === 'true') {
            query += ' AND is_read = FALSE';
        }

        query += ' ORDER BY created_at DESC LIMIT 50';
        const [notifications] = await pool.query(query, params);

        // Hitung unread
        const [unreadCount] = await pool.query(
            'SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [user_id]
        );

        return successResponse(res, {
            unread_count: unreadCount[0].total,
            notifications: notifications
        }, 'Notifikasi berhasil diambil.');
    } catch (error) { next(error); }
};

// PUT /api/notifications/:id/read - Tandai notifikasi sudah dibaca
const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        const [result] = await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [id, user_id]
        );

        if (result.affectedRows === 0) {
            return errorResponse(res, 'Notifikasi tidak ditemukan.', 404);
        }

        return successResponse(res, null, 'Notifikasi ditandai sudah dibaca.');
    } catch (error) { next(error); }
};

// PUT /api/notifications/read-all - Tandai semua sebagai dibaca
const markAllAsRead = async (req, res, next) => {
    try {
        const user_id = req.user.id;
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [user_id]
        );
        return successResponse(res, null, 'Semua notifikasi ditandai sudah dibaca.');
    } catch (error) { next(error); }
};

// Helper: Buat notifikasi (dipanggil dari controller lain / cron)
const createNotification = async (user_id, title, message, type = 'info', category = 'system', metadata = null) => {
    try {
        await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, category, metadata) VALUES (?, ?, ?, ?, ?, ?)`,
            [user_id, title, message, type, category, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (error) {
        console.error('Error creating notification:', error.message);
    }
};

module.exports = { getMyNotifications, markAsRead, markAllAsRead, createNotification };
