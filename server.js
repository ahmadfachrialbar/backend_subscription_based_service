const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { initDatabase } = require('./src/config/database');
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

// Cron
const { startCronJobs } = require('./src/cron/subscriptionCron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Subscription Service API berjalan!',
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

// Startup
initDatabase().then(() => {
    seedUsers().then(() => {
        seedPlans().then(() => {
            // Start cron jobs
            startCronJobs();

            app.listen(PORT, () => {
                console.log(`🚀 Server berjalan http://localhost:${PORT}`);
                console.log('📋 Endpoints tersedia:');
                console.log('   POST   /api/auth/register');
                console.log('   POST   /api/auth/login');
                console.log('   GET    /api/plans');
                console.log('   POST   /api/subscriptions');
                console.log('   POST   /api/subscriptions/change-plan');
                console.log('   POST   /api/payments/simulate');
                console.log('   POST   /api/payments/:id/process');
                console.log('   GET    /api/dashboard/admin');
                console.log('   GET    /api/dashboard/finance');
                console.log('   GET    /api/notifications');
            });
        });
    });
});
