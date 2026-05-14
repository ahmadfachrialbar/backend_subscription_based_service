const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { errorResponse } = require('../utils/responseHelper');

// Middleware verifikasi JWT token
const verifyToken = async (req, res, next) => {
    try {
        // Ambil token dari header Authorization
        const authHeader = req.headers.authorization;

        // Cek apakah ada header Authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse(res, 'Token tidak ditemukan. Silakan login terlebih dahulu.', 401);
        }

        // Ambil tokennya (hilangkan kata "Bearer ")
        const token = authHeader.split(' ')[1];

        // Verifikasi token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Cek apakah user masih ada di database dan aktif
        const [users] = await pool.query(
            'SELECT id, email, full_name, role, status FROM users WHERE id = ? AND status = "active"',
            [decoded.userId]
        );

        if (users.length === 0) {
            return errorResponse(res, 'User tidak ditemukan atau akun tidak aktif.', 401);
        }

        // Simpan data user ke req, agar bisa diakses di controller
        req.user = users[0];

        // Lanjut ke controller berikutnya
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return errorResponse(res, 'Token sudah kadaluarsa. Silakan login kembali.', 401);
        }
        if (error.name === 'JsonWebTokenError') {
            return errorResponse(res, 'Token tidak valid.', 401);
        }
        return errorResponse(res, 'Terjadi kesalahan autentikasi.', 401);
    }
};

// Middleware cek role (untuk admin/finance only)
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return errorResponse(res, 'Akses ditolak. Anda tidak memiliki izin.', 403);
        }
        next();
    };
};

module.exports = { verifyToken, authorize };
