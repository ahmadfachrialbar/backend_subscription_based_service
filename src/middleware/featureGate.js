const { pool } = require('../config/database');
const { errorResponse } = require('../utils/responseHelper');

/**
 * Feature Gating Middleware
 * Membatasi akses fitur berdasarkan paket langganan user
 * 
 * Contoh penggunaan di route:
 *   router.get('/api-endpoint', verifyToken, checkFeature('api_access'), handler);
 *   router.get('/plugins', verifyToken, checkFeature('plugins'), handler);
 */
const checkFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            const user_id = req.user.id;
            const user_role = req.user.role;

            // Admin dan finance bypass feature gating
            if (user_role === 'admin' || user_role === 'finance') {
                return next();
            }

            // Ambil subscription aktif user beserta features dari plan
            const [subs] = await pool.query(`
                SELECT s.*, p.features, p.name as plan_name, p.slug as plan_slug
                FROM subscriptions s
                JOIN plans p ON s.plan_id = p.id
                WHERE s.user_id = ? AND s.status IN ('active', 'trial')
                ORDER BY s.started_at DESC
                LIMIT 1`,
                [user_id]
            );

            if (subs.length === 0) {
                return errorResponse(res, 'Anda belum memiliki subscription aktif. Silakan berlangganan terlebih dahulu.', 403);
            }

            const subscription = subs[0];
            let features = {};

            // Parse features JSON
            try {
                features = typeof subscription.features === 'string'
                    ? JSON.parse(subscription.features)
                    : subscription.features || {};
            } catch (e) {
                features = {};
            }

            // Cek apakah fitur tersedia di paket user
            if (features[featureName] === undefined) {
                return errorResponse(res, `Fitur "${featureName}" tidak tersedia di paket ${subscription.plan_name}. Silakan upgrade paket Anda.`, 403);
            }

            if (features[featureName] === false) {
                return errorResponse(res, `Fitur "${featureName}" tidak tersedia di paket ${subscription.plan_name}. Silakan upgrade paket Anda.`, 403);
            }

            // Simpan info subscription di request
            req.subscription = subscription;
            req.plan_features = features;

            next();
        } catch (error) {
            return errorResponse(res, 'Gagal memverifikasi fitur.', 500);
        }
    };
};

/**
 * Middleware untuk cek message cap (batasan jumlah pesan)
 */
const checkMessageCap = async (req, res, next) => {
    try {
        const user_id = req.user.id;
        const user_role = req.user.role;

        if (user_role === 'admin' || user_role === 'finance') return next();

        const [subs] = await pool.query(`
            SELECT p.features, p.name as plan_name
            FROM subscriptions s
            JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = ? AND s.status IN ('active', 'trial')
            LIMIT 1`,
            [user_id]
        );

        if (subs.length === 0) {
            return errorResponse(res, 'Subscription aktif tidak ditemukan.', 403);
        }

        let features = {};
        try {
            features = typeof subs[0].features === 'string'
                ? JSON.parse(subs[0].features) : subs[0].features || {};
        } catch (e) { features = {}; }

        // null = unlimited
        if (features.message_cap !== null && features.message_cap !== undefined) {
            // Di implementasi nyata, hitung usage harian dari tabel usage/logs
            // Ini contoh struktur saja
            req.message_cap = features.message_cap;
        }

        next();
    } catch (error) {
        return errorResponse(res, 'Gagal memverifikasi batasan.', 500);
    }
};

module.exports = { checkFeature, checkMessageCap };
