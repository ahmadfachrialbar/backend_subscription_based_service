const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { initDatabase, closePool } = require('./src/config/database');
const { seedUsers, seedPlans } = require('./src/config/seeder');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const subscriptionRoutes = require('./src/routes/subscriptionRoutes');
const invoiceRoutes = require('./src/routes/invoiceRoutes');
const planRoutes = require('./src/routes/planRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

// Middleware
const { errorHandler } = require('./src/middleware/errorHandler');

// Cron - Hanya jalankan di non-serverless environment
const { startCronJobs } = require('./src/cron/subscriptionCron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================
// Serverless-safe init: jalankan initDatabase SEKALI saja.
// Di Vercel, module di-cache antar invokasi pada instance yang sama,
// jadi init hanya berjalan 1x per cold start.
// =============================================================
let dbInitialized = false;
const ensureDbInit = async () => {
    if (dbInitialized) return;
    try {
        await initDatabase();
        await seedUsers();
        await seedPlans();
        dbInitialized = true;
    } catch (error) {
        console.error('❌ Gagal inisialisasi DB:', error.message);
        // Jangan set dbInitialized = true, biar retry di request berikutnya
    }
};

// Middleware: pastikan DB sudah init sebelum handle request
app.use(async (req, res, next) => {
    try {
        await ensureDbInit();
        next();
    } catch (error) {
        res.status(503).json({
            success: false,
            message: 'Database belum siap. Silakan coba lagi.',
            error: error.message,
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'API berjalan!',
        version: '2.0.0',
        status: 'active',
        endpoints: {
            auth: '/api/auth',
            plans: '/api/plans',
            subscriptions: '/api/subscriptions',
            invoices: '/api/invoices',
            payments: '/api/payments',
            dashboard: '/api/dashboard',
            notifications: '/api/notifications'
        }
    });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handler (harus paling akhir)
app.use(errorHandler);

// =============================================================
// Startup: Bedakan antara local dev vs Vercel serverless
// =============================================================
const IS_VERCEL = process.env.VERCEL || process.env.VERCEL_ENV;

if (!IS_VERCEL) {
    // Local development - jalankan seperti biasa
    initDatabase().then(() => {
        seedUsers().then(() => {
            seedPlans().then(() => {
                // Start cron jobs (hanya di local, TIDAK di Vercel)
                startCronJobs();

                app.listen(PORT, () => {
                    console.log(`🚀 Server berjalan http://localhost:${PORT}`);
                });
            });
        });
    });
}

// Export untuk Vercel serverless
module.exports = app;
