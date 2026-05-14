const { pool } = require('../config/database');

/**
 * Generate nomor invoice otomatis: INV-YYYYMM-NNNN
 */
const generateInvoiceNumber = async () => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [lastInv] = await pool.query(
        'SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY created_at DESC LIMIT 1',
        [`INV-${yearMonth}-%`]
    );

    let sequence = '0001';
    if (lastInv.length > 0) {
        const lastSeq = parseInt(lastInv[0].invoice_number.split('-')[2]);
        sequence = String(lastSeq + 1).padStart(4, '0');
    }

    return `INV-${yearMonth}-${sequence}`;
};

/**
 * Generate invoice otomatis saat subscribe
 * @param {Object} params - { user_id, subscription_id, plan, periodStart, periodEnd }
 * @returns {Object} created invoice
 */
const createAutoInvoice = async ({ user_id, subscription_id, plan, periodStart, periodEnd, prorationCredit = 0, description = null }) => {
    const invoiceNumber = await generateInvoiceNumber();

    const subtotal = parseFloat(plan.price);
    const tax = Math.round(subtotal * 0.11 * 100) / 100; // PPN 11%
    const discount = parseFloat(prorationCredit) || 0;
    const total = Math.max(0, subtotal + tax - discount);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // due 7 hari

    // Status: kalau harga 0 (free plan), langsung 'paid'
    const invoiceStatus = total === 0 ? 'paid' : 'sent';
    const paidAt = total === 0 ? new Date() : null;

    const [result] = await pool.query(`
        INSERT INTO invoices 
        (user_id, subscription_id, invoice_number, subtotal, tax, discount, total, 
         period_start, period_end, status, due_date, paid_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user_id, subscription_id, invoiceNumber, subtotal, tax, discount, total,
         periodStart, periodEnd, invoiceStatus, dueDate, paidAt,
         description || `Langganan ${plan.name} - ${plan.billing_cycle}`]
    );

    // Ambil invoice yang baru dibuat
    const [invoices] = await pool.query(
        'SELECT * FROM invoices WHERE invoice_number = ?',
        [invoiceNumber]
    );
    const invoice = invoices[0];

    // Buat invoice items
    await pool.query(`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, item_type)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [invoice.id, `Langganan ${plan.name} (${plan.billing_cycle})`, 1, subtotal, subtotal, 'subscription']
    );

    if (tax > 0) {
        await pool.query(`
            INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, item_type)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [invoice.id, 'PPN 11%', 1, tax, tax, 'tax']
        );
    }

    if (discount > 0) {
        await pool.query(`
            INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, item_type)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [invoice.id, 'Proration Credit (sisa paket sebelumnya)', 1, -discount, -discount, 'proration_credit']
        );
    }

    return invoice;
};

/**
 * Generate transaction ID unik untuk payment
 */
const generateTransactionId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN-${timestamp}-${random}`;
};

module.exports = { generateInvoiceNumber, createAutoInvoice, generateTransactionId };
