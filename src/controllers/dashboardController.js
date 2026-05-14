const { pool } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { arrayToCSV, columnDefinitions } = require('../utils/csvExporter');

// GET /api/dashboard/admin
const getAdminDashboard = async (req, res, next) => {
    try {
        const [activeUsers] = await pool.query('SELECT COUNT(*) as total FROM users WHERE role = "user" AND status = "active"');
        const [activeSubs] = await pool.query('SELECT COUNT(*) as total FROM subscriptions WHERE status IN ("active", "trial")');
        const [totalRevenue] = await pool.query('SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = "paid"');
        const [monthlyRevenue] = await pool.query(`SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'paid' AND MONTH(paid_at) = MONTH(CURRENT_DATE()) AND YEAR(paid_at) = YEAR(CURRENT_DATE())`);
        const [planDistribution] = await pool.query(`SELECT p.name as plan_name, p.price, COUNT(s.id) as subscriber_count FROM plans p LEFT JOIN subscriptions s ON p.id = s.plan_id AND s.status IN ('active', 'trial') WHERE p.is_active = TRUE GROUP BY p.id, p.name, p.price ORDER BY subscriber_count DESC`);
        const [recentSubs] = await pool.query(`SELECT s.id, s.status, s.started_at, s.current_period_end, u.email as user_email, u.full_name, p.name as plan_name, p.price FROM subscriptions s JOIN users u ON s.user_id = u.id JOIN plans p ON s.plan_id = p.id ORDER BY s.started_at DESC LIMIT 10`);
        const [statusStats] = await pool.query('SELECT status, COUNT(*) as count FROM subscriptions GROUP BY status');
        const [newUsersThisMonth] = await pool.query(`SELECT COUNT(*) as total FROM users WHERE role = 'user' AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`);

        return successResponse(res, {
            summary: { total_active_users: activeUsers[0].total, total_active_subscriptions: activeSubs[0].total, total_revenue: parseFloat(totalRevenue[0].total), monthly_revenue: parseFloat(monthlyRevenue[0].total), new_users_this_month: newUsersThisMonth[0].total },
            plan_distribution: planDistribution,
            subscription_status: statusStats,
            recent_subscriptions: recentSubs
        }, 'Dashboard admin berhasil diambil.');
    } catch (error) { next(error); }
};

// GET /api/dashboard/finance
const getFinanceDashboard = async (req, res, next) => {
    try {
        const [monthlyRevenue] = await pool.query(`SELECT DATE_FORMAT(paid_at, '%Y-%m') as month, COUNT(*) as total_transactions, SUM(total) as total_revenue, AVG(total) as avg_transaction FROM invoices WHERE status = 'paid' AND paid_at IS NOT NULL AND paid_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH) GROUP BY DATE_FORMAT(paid_at, '%Y-%m') ORDER BY month DESC`);
        const [paymentMethodStats] = await pool.query(`SELECT payment_method, COUNT(*) as count, SUM(amount) as total_amount FROM payments WHERE payment_status = 'completed' GROUP BY payment_method ORDER BY total_amount DESC`);
        const [outstandingInvoices] = await pool.query(`SELECT i.*, u.email as user_email, u.full_name, p.name as plan_name FROM invoices i JOIN users u ON i.user_id = u.id LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN plans p ON s.plan_id = p.id WHERE i.status IN ('sent', 'overdue') ORDER BY i.due_date ASC`);
        const [totalOutstanding] = await pool.query('SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status IN ("sent", "overdue")');
        const [recentPayments] = await pool.query(`SELECT p.*, i.invoice_number, u.email as user_email, u.full_name FROM payments p JOIN invoices i ON p.invoice_id = i.id JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 10`);
        const [todayRevenue] = await pool.query(`SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM invoices WHERE status = 'paid' AND DATE(paid_at) = CURRENT_DATE()`);
        const [overdueCount] = await pool.query(`SELECT COUNT(*) as total FROM invoices WHERE status = 'sent' AND due_date < CURRENT_DATE()`);

        return successResponse(res, {
            summary: { today_revenue: parseFloat(todayRevenue[0].total), today_transactions: todayRevenue[0].count, total_outstanding: parseFloat(totalOutstanding[0].total), overdue_invoices: overdueCount[0].total },
            monthly_revenue: monthlyRevenue.map(r => ({ ...r, total_revenue: parseFloat(r.total_revenue), avg_transaction: parseFloat(r.avg_transaction) })),
            payment_methods: paymentMethodStats.map(p => ({ ...p, total_amount: parseFloat(p.total_amount) })),
            outstanding_invoices: outstandingInvoices,
            recent_payments: recentPayments
        }, 'Dashboard finance berhasil diambil.');
    } catch (error) { next(error); }
};

// CSV Exports
const exportSubscriptionsCSV = async (req, res, next) => {
    try {
        const [data] = await pool.query(`SELECT s.*, u.email as user_email, u.full_name, p.name as plan_name FROM subscriptions s JOIN users u ON s.user_id = u.id JOIN plans p ON s.plan_id = p.id ORDER BY s.started_at DESC`);
        const csv = arrayToCSV(data, columnDefinitions.subscriptions);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=subscriptions_${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(csv);
    } catch (error) { next(error); }
};

const exportInvoicesCSV = async (req, res, next) => {
    try {
        const [data] = await pool.query(`SELECT i.*, u.email as user_email, u.full_name, p.name as plan_name FROM invoices i JOIN users u ON i.user_id = u.id LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN plans p ON s.plan_id = p.id ORDER BY i.created_at DESC`);
        const csv = arrayToCSV(data, columnDefinitions.invoices);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=invoices_${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(csv);
    } catch (error) { next(error); }
};

const exportPaymentsCSV = async (req, res, next) => {
    try {
        const [data] = await pool.query(`SELECT p.*, i.invoice_number, u.email as user_email, u.full_name FROM payments p JOIN invoices i ON p.invoice_id = i.id JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`);
        const csv = arrayToCSV(data, columnDefinitions.payments);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=payments_${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(csv);
    } catch (error) { next(error); }
};

const exportRevenueCSV = async (req, res, next) => {
    try {
        const [data] = await pool.query(`SELECT DATE_FORMAT(paid_at, '%Y-%m') as month, SUM(total) as total_revenue, COUNT(*) as total_transactions, AVG(total) as avg_transaction FROM invoices WHERE status = 'paid' AND paid_at IS NOT NULL GROUP BY DATE_FORMAT(paid_at, '%Y-%m') ORDER BY month DESC`);
        const csv = arrayToCSV(data, columnDefinitions.revenue);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=revenue_${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(csv);
    } catch (error) { next(error); }
};

module.exports = { getAdminDashboard, getFinanceDashboard, exportSubscriptionsCSV, exportInvoicesCSV, exportPaymentsCSV, exportRevenueCSV };
