const cron = require('node-cron');
const { pool } = require('../config/database');
const { createNotification } = require('../controllers/notificationController');
const { createAutoInvoice } = require('../utils/invoiceGenerator');

/**
 * Cron Job Harian - Berjalan setiap hari jam 00:05
 * 1. Cek subscription expired
 * 2. Auto-renew subscription
 * 3. Notifikasi masa aktif akan habis
 * 4. Update invoice overdue
 */
const startCronJobs = () => {
    // Jalankan setiap hari jam 00:05
    cron.schedule('5 0 * * *', async () => {
        console.log('⏰ [CRON] Menjalankan cron job harian...');
        const now = new Date();

        try {
            // 1. CEK EXPIRED SUBSCRIPTIONS
            const [expiredSubs] = await pool.query(`
                SELECT s.*, p.name as plan_name, u.email
                FROM subscriptions s
                JOIN plans p ON s.plan_id = p.id
                JOIN users u ON s.user_id = u.id
                WHERE s.status IN ('active', 'trial')
                AND s.current_period_end < CURRENT_DATE()
                AND s.auto_renew = FALSE`
            );

            for (const sub of expiredSubs) {
                await pool.query(
                    'UPDATE subscriptions SET status = "expired", expired_at = NOW() WHERE id = ?',
                    [sub.id]
                );
                await pool.query(`
                    INSERT INTO subscription_history (subscription_id, user_id, action, old_status, new_status)
                    VALUES (?, ?, 'expired', ?, 'expired')`,
                    [sub.id, sub.user_id, sub.status]
                );
                await createNotification(
                    sub.user_id,
                    'Subscription Expired ⏰',
                    `Langganan ${sub.plan_name} Anda telah berakhir. Silakan perpanjang untuk terus menggunakan layanan.`,
                    'warning', 'subscription', { subscription_id: sub.id }
                );
                console.log(`  ❌ Expired: ${sub.email} - ${sub.plan_name}`);
            }

            // 2. AUTO-RENEW SUBSCRIPTIONS
            const [renewSubs] = await pool.query(`
                SELECT s.*, p.name as plan_name, p.price, p.billing_cycle, u.email
                FROM subscriptions s
                JOIN plans p ON s.plan_id = p.id
                JOIN users u ON s.user_id = u.id
                WHERE s.status IN ('active')
                AND s.current_period_end <= CURRENT_DATE()
                AND s.auto_renew = TRUE`
            );

            for (const sub of renewSubs) {
                // Hitung periode baru
                const newStart = new Date(sub.current_period_end);
                let newEnd = new Date(newStart);
                if (sub.billing_cycle === 'monthly') {
                    newEnd.setMonth(newEnd.getMonth() + 1);
                } else if (sub.billing_cycle === 'yearly') {
                    newEnd.setFullYear(newEnd.getFullYear() + 1);
                }

                // Update subscription periode
                await pool.query(`
                    UPDATE subscriptions 
                    SET current_period_start = ?, current_period_end = ?, status = 'active'
                    WHERE id = ?`,
                    [newStart, newEnd, sub.id]
                );

                // Generate invoice baru
                const plan = { name: sub.plan_name, price: sub.price, billing_cycle: sub.billing_cycle };
                await createAutoInvoice({
                    user_id: sub.user_id,
                    subscription_id: sub.id,
                    plan: plan,
                    periodStart: newStart,
                    periodEnd: newEnd,
                    description: `Auto-renewal ${sub.plan_name}`
                });

                // Catat history
                await pool.query(`
                    INSERT INTO subscription_history (subscription_id, user_id, action, old_status, new_status, metadata)
                    VALUES (?, ?, 'renewed', 'active', 'active', ?)`,
                    [sub.id, sub.user_id, JSON.stringify({ new_period_start: newStart, new_period_end: newEnd })]
                );

                await createNotification(
                    sub.user_id,
                    'Subscription Diperpanjang 🔄',
                    `Langganan ${sub.plan_name} berhasil diperpanjang otomatis hingga ${newEnd.toISOString().split('T')[0]}.`,
                    'success', 'subscription', { subscription_id: sub.id }
                );
                console.log(`  🔄 Renewed: ${sub.email} - ${sub.plan_name}`);
            }

            // 3. NOTIFIKASI MASA AKTIF AKAN HABIS (3 hari & 1 hari sebelum)
            for (const daysBefore of [3, 1]) {
                const [expiringSubs] = await pool.query(`
                    SELECT s.*, p.name as plan_name, u.email
                    FROM subscriptions s
                    JOIN plans p ON s.plan_id = p.id
                    JOIN users u ON s.user_id = u.id
                    WHERE s.status IN ('active', 'trial')
                    AND DATEDIFF(s.current_period_end, CURRENT_DATE()) = ?`,
                    [daysBefore]
                );

                for (const sub of expiringSubs) {
                    await createNotification(
                        sub.user_id,
                        `Langganan Akan Berakhir ⚠️`,
                        `Langganan ${sub.plan_name} Anda akan berakhir dalam ${daysBefore} hari (${new Date(sub.current_period_end).toISOString().split('T')[0]}). ${sub.auto_renew ? 'Auto-renew aktif.' : 'Silakan perpanjang segera.'}`,
                        'warning', 'subscription', { subscription_id: sub.id, days_remaining: daysBefore }
                    );
                    console.log(`  ⚠️ Expiring in ${daysBefore}d: ${sub.email} - ${sub.plan_name}`);
                }
            }

            // 4. UPDATE INVOICE OVERDUE
            const [overdueInvoices] = await pool.query(`
                UPDATE invoices SET status = 'overdue'
                WHERE status = 'sent' AND due_date < CURRENT_DATE()`
            );
            if (overdueInvoices.affectedRows > 0) {
                console.log(`  📋 ${overdueInvoices.affectedRows} invoice(s) marked as overdue`);
            }

            console.log('✅ [CRON] Cron job harian selesai.');
        } catch (error) {
            console.error('❌ [CRON] Error:', error.message);
        }
    });

    console.log('⏰ Cron job berjalan sesuai jadwal');
};

module.exports = { startCronJobs };
