const { pool } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { generateTransactionId } = require('../utils/invoiceGenerator');

// ============================================
// SIMULASI PEMBAYARAN
// ============================================

/**
 * POST /api/payments/simulate
 * Simulasi pembayaran untuk invoice
 * Body: { invoice_id, payment_method }
 * payment_method: 'bank_transfer', 'credit_card', 'e_wallet', 'qris'
 */
const simulatePayment = async (req, res, next) => {
    try {
        const { invoice_id, payment_method } = req.body;
        const user_id = req.user.id;

        // Validasi input
        if (!invoice_id || !payment_method) {
            return errorResponse(res, 'Invoice ID dan metode pembayaran wajib diisi!', 400);
        }

        const allowedMethods = ['bank_transfer', 'credit_card', 'e_wallet', 'qris'];
        if (!allowedMethods.includes(payment_method)) {
            return errorResponse(res, `Metode pembayaran tidak valid. Pilih: ${allowedMethods.join(', ')}`, 400);
        }

        // Cek invoice ada dan milik user
        const [invoices] = await pool.query(
            'SELECT * FROM invoices WHERE id = ? AND user_id = ?',
            [invoice_id, user_id]
        );

        if (invoices.length === 0) {
            return errorResponse(res, 'Invoice tidak ditemukan.', 404);
        }

        const invoice = invoices[0];

        // Cek invoice belum dibayar
        if (invoice.status === 'paid') {
            return errorResponse(res, 'Invoice sudah dibayar.', 400);
        }

        if (invoice.status === 'cancelled') {
            return errorResponse(res, 'Invoice sudah dibatalkan.', 400);
        }

        // Cek tidak ada payment pending untuk invoice ini
        const [existingPayment] = await pool.query(
            'SELECT id FROM payments WHERE invoice_id = ? AND payment_status IN ("pending", "processing")',
            [invoice_id]
        );

        if (existingPayment.length > 0) {
            return errorResponse(res, 'Sudah ada pembayaran yang sedang diproses untuk invoice ini.', 409);
        }

        // Generate transaction ID
        const transactionId = generateTransactionId();

        // Simulasi: tentukan detail pembayaran berdasarkan metode
        let paymentDetails = {};
        switch (payment_method) {
            case 'bank_transfer':
                paymentDetails = {
                    bank: 'BCA',
                    va_number: `8800${Date.now().toString().slice(-10)}`,
                    expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                };
                break;
            case 'credit_card':
                paymentDetails = {
                    card_type: 'VISA',
                    masked_card: '****-****-****-4242',
                    authorization_id: `AUTH-${Date.now()}`
                };
                break;
            case 'e_wallet':
                paymentDetails = {
                    wallet_type: 'GoPay',
                    deeplink_url: `https://simulator.gopay.co.id/pay/${transactionId}`,
                    qr_url: `https://simulator.gopay.co.id/qr/${transactionId}`
                };
                break;
            case 'qris':
                paymentDetails = {
                    qr_string: `00020101021226660014ID.CO.SIMULATOR.WWW0215${transactionId}`,
                    expired_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
                };
                break;
        }

        // Buat record payment
        await pool.query(`
            INSERT INTO payments 
            (invoice_id, user_id, amount, payment_method, payment_status, transaction_id, payment_details)
            VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
            [invoice_id, user_id, invoice.total, payment_method, transactionId, JSON.stringify(paymentDetails)]
        );

        // Ambil payment yang baru dibuat
        const [payments] = await pool.query(
            'SELECT * FROM payments WHERE transaction_id = ?',
            [transactionId]
        );

        return successResponse(res, {
            payment: payments[0],
            payment_details: paymentDetails,
            instructions: getPaymentInstructions(payment_method, paymentDetails)
        }, 'Pembayaran berhasil dibuat. Silakan selesaikan pembayaran.', 201);

    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/payments/:id/process
 * Proses/konfirmasi pembayaran (simulasi: langsung sukses)
 * Ini simulasi callback dari payment gateway
 */
const processPayment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'approve' atau 'reject'

        // Cek payment ada
        const [payments] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
        if (payments.length === 0) {
            return errorResponse(res, 'Payment tidak ditemukan.', 404);
        }

        const payment = payments[0];

        if (payment.payment_status !== 'pending' && payment.payment_status !== 'processing') {
            return errorResponse(res, `Payment sudah diproses (status: ${payment.payment_status}).`, 400);
        }

        // Mulai transaksi database
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            if (action === 'approve' || action === undefined) {
                // ============================
                // APPROVE PAYMENT
                // ============================

                // 1. Update payment status
                await connection.query(
                    'UPDATE payments SET payment_status = "completed", paid_at = NOW(), updated_at = NOW() WHERE id = ?',
                    [id]
                );

                // 2. Update invoice status ke 'paid'
                await connection.query(
                    'UPDATE invoices SET status = "paid", paid_at = NOW() WHERE id = ?',
                    [payment.invoice_id]
                );

                // 3. Update subscription status ke 'active'
                const [invoices] = await connection.query(
                    'SELECT subscription_id FROM invoices WHERE id = ?',
                    [payment.invoice_id]
                );

                if (invoices.length > 0 && invoices[0].subscription_id) {
                    const subId = invoices[0].subscription_id;

                    // Ambil status subscription saat ini
                    const [subs] = await connection.query(
                        'SELECT * FROM subscriptions WHERE id = ?',
                        [subId]
                    );

                    if (subs.length > 0) {
                        const oldStatus = subs[0].status;

                        await connection.query(
                            'UPDATE subscriptions SET status = "active" WHERE id = ?',
                            [subId]
                        );

                        // 4. Catat di subscription history
                        await connection.query(`
                            INSERT INTO subscription_history 
                            (subscription_id, user_id, action, old_status, new_status, metadata)
                            VALUES (?, ?, 'activated', ?, 'active', ?)`,
                            [subId, payment.user_id, oldStatus, JSON.stringify({
                                payment_id: payment.id,
                                invoice_id: payment.invoice_id,
                                amount: payment.amount
                            })]
                        );
                    }
                }

                // 5. Buat notifikasi sukses
                await connection.query(`
                    INSERT INTO notifications (user_id, title, message, type, category, metadata)
                    VALUES (?, ?, ?, 'success', 'payment', ?)`,
                    [payment.user_id, 'Pembayaran Berhasil! ✅',
                     `Pembayaran sebesar Rp ${parseFloat(payment.amount).toLocaleString('id-ID')} berhasil diproses.`,
                     JSON.stringify({ payment_id: payment.id, invoice_id: payment.invoice_id })]
                );

                await connection.commit();

                const [updatedPayment] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
                return successResponse(res, updatedPayment[0], 'Pembayaran berhasil diproses! Subscription aktif.');

            } else if (action === 'reject') {
                // ============================
                // REJECT PAYMENT
                // ============================

                await connection.query(
                    'UPDATE payments SET payment_status = "failed", updated_at = NOW() WHERE id = ?',
                    [id]
                );

                // Buat notifikasi gagal
                await connection.query(`
                    INSERT INTO notifications (user_id, title, message, type, category, metadata)
                    VALUES (?, ?, ?, 'danger', 'payment', ?)`,
                    [payment.user_id, 'Pembayaran Gagal ❌',
                     `Pembayaran sebesar Rp ${parseFloat(payment.amount).toLocaleString('id-ID')} gagal diproses.`,
                     JSON.stringify({ payment_id: payment.id, invoice_id: payment.invoice_id })]
                );

                await connection.commit();

                const [updatedPayment] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
                return successResponse(res, updatedPayment[0], 'Pembayaran ditolak.');

            } else {
                await connection.rollback();
                return errorResponse(res, 'Action tidak valid. Gunakan "approve" atau "reject".', 400);
            }

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/payments/my
 * Lihat riwayat pembayaran user
 */
const getMyPayments = async (req, res, next) => {
    try {
        const user_id = req.user.id;

        const [payments] = await pool.query(`
            SELECT p.*, i.invoice_number, i.total as invoice_total
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC`,
            [user_id]
        );

        return successResponse(res, payments, 'Riwayat pembayaran berhasil diambil.');
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/payments
 * Lihat semua pembayaran (admin/finance)
 */
const getAllPayments = async (req, res, next) => {
    try {
        const { status, method, start_date, end_date } = req.query;

        let query = `
            SELECT p.*, i.invoice_number, u.email as user_email, u.full_name
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            JOIN users u ON p.user_id = u.id
            WHERE 1=1`;
        const params = [];

        if (status) {
            query += ' AND p.payment_status = ?';
            params.push(status);
        }
        if (method) {
            query += ' AND p.payment_method = ?';
            params.push(method);
        }
        if (start_date) {
            query += ' AND p.created_at >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND p.created_at <= ?';
            params.push(end_date + ' 23:59:59');
        }

        query += ' ORDER BY p.created_at DESC';

        const [payments] = await pool.query(query, params);

        return successResponse(res, payments, 'Semua pembayaran berhasil diambil.');
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/payments/:id
 * Detail pembayaran
 */
const getPaymentById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const user_role = req.user.role;

        const [payments] = await pool.query(`
            SELECT p.*, i.invoice_number, i.total as invoice_total, 
                   u.email as user_email, u.full_name
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ?`,
            [id]
        );

        if (payments.length === 0) {
            return errorResponse(res, 'Payment tidak ditemukan.', 404);
        }

        // User hanya bisa lihat milik sendiri
        if (user_role === 'user' && payments[0].user_id !== user_id) {
            return errorResponse(res, 'Akses ditolak.', 403);
        }

        return successResponse(res, payments[0], 'Detail pembayaran berhasil diambil.');
    } catch (error) {
        next(error);
    }
};

// ============================================
// HELPER
// ============================================

function getPaymentInstructions(method, details) {
    switch (method) {
        case 'bank_transfer':
            return {
                steps: [
                    `Transfer ke rekening Virtual Account: ${details.va_number}`,
                    'Bank: BCA',
                    'Pembayaran akan dikonfirmasi otomatis setelah transfer.',
                    `Batas waktu pembayaran: ${details.expired_at}`
                ]
            };
        case 'credit_card':
            return {
                steps: [
                    'Pembayaran sedang diproses dengan kartu kredit Anda.',
                    `Kartu: ${details.masked_card}`,
                    'Anda akan menerima konfirmasi dalam beberapa saat.'
                ]
            };
        case 'e_wallet':
            return {
                steps: [
                    `Buka aplikasi ${details.wallet_type}`,
                    'Scan QR code atau klik link pembayaran',
                    'Konfirmasi pembayaran di aplikasi'
                ]
            };
        case 'qris':
            return {
                steps: [
                    'Buka aplikasi e-wallet atau mobile banking',
                    'Pilih menu Scan QR/QRIS',
                    'Scan QR code yang tersedia',
                    `Batas waktu pembayaran: ${details.expired_at}`
                ]
            };
        default:
            return { steps: ['Ikuti instruksi pembayaran.'] };
    }
}

module.exports = {
    simulatePayment,
    processPayment,
    getMyPayments,
    getAllPayments,
    getPaymentById
};
