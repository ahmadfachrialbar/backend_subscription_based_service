const { pool } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/responseHelper");

// create | admin/finance only
const createInvoice = async (req, res, next) => {
  try {
    const { user_id, subscription_id, subtotal, tax, discount, due_days } = req.body;

    if (!user_id || !subscription_id || subtotal === undefined) {
      return errorResponse(res, "User ID, Subscription ID, dan subtotal wajib diisi!", 400);
    }

    // Generate nomor invoice: INV-YYYYMM-NNNN
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [lastInv] = await pool.query(
      "SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY created_at DESC LIMIT 1",
      [`INV-${yearMonth}-%`]
    );

    let sequence = "0001";
    if (lastInv.length > 0) {
      const lastSeq = parseInt(lastInv[0].invoice_number.split("-")[2]);
      sequence = String(lastSeq + 1).padStart(4, "0");
    }
    const invoiceNumber = `INV-${yearMonth}-${sequence}`;

    const taxAmount = tax || 0;
    const discountAmount = discount || 0;
    const total = parseFloat(subtotal) + parseFloat(taxAmount) - parseFloat(discountAmount);

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + (due_days || 7));

    await pool.query(`
      INSERT INTO invoices (user_id, subscription_id, invoice_number, subtotal, tax, discount, total, due_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, subscription_id, invoiceNumber, subtotal, taxAmount, discountAmount, total, dueDate]
    );

    const [invoices] = await pool.query("SELECT * FROM invoices WHERE invoice_number = ?", [invoiceNumber]);
    return successResponse(res, invoices[0], "Invoice berhasil dibuat!", 201);
  } catch (error) { next(error); }
};

// read | user only (lihat invoice sendiri)
const getMyInvoices = async (req, res, next) => {
  try {
    const [invoices] = await pool.query(`
      SELECT i.*, p.name as plan_name FROM invoices i
      LEFT JOIN subscriptions s ON i.subscription_id = s.id
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE i.user_id = ? ORDER BY i.created_at DESC`, [req.user.id]
    );
    return successResponse(res, invoices, "Invoice berhasil diambil.");
  } catch (error) { next(error); }
};

// read all | admin/finance only
const getAllInvoices = async (req, res, next) => {
  try {
    const [invoices] = await pool.query(`
      SELECT i.*, u.email as user_email, u.full_name, p.name as plan_name FROM invoices i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN subscriptions s ON i.subscription_id = s.id
      LEFT JOIN plans p ON s.plan_id = p.id
      ORDER BY i.created_at DESC`
    );
    return successResponse(res, invoices, "Semua invoice berhasil diambil.");
  } catch (error) { next(error); }
};

// read detail by id | all role
const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    const [invoices] = await pool.query(`
      SELECT i.*, u.email as user_email, u.full_name, p.name as plan_name FROM invoices i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN subscriptions s ON i.subscription_id = s.id
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE i.id = ?`, [id]
    );

    if (invoices.length === 0) return errorResponse(res, "Invoice tidak ditemukan.", 404);
    if (user_role === "user" && invoices[0].user_id !== user_id) return errorResponse(res, "Akses ditolak.", 403);

    // Ambil invoice items
    const [items] = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY created_at ASC', [id]);

    return successResponse(res, { ...invoices[0], items }, "Detail invoice berhasil diambil.");
  } catch (error) { next(error); }
};

// update status invoice | admin/finance only
const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatus = ["draft", "sent", "paid", "overdue", "cancelled", "refunded"];
    if (!allowedStatus.includes(status)) return errorResponse(res, "Status tidak valid.", 400);

    const [existing] = await pool.query("SELECT * FROM invoices WHERE id = ?", [id]);
    if (existing.length === 0) return errorResponse(res, "Invoice tidak ditemukan.", 404);

    const updates = ["status = ?"];
    const values = [status];
    if (status === "paid") updates.push("paid_at = NOW()");

    values.push(id);
    await pool.query(`UPDATE invoices SET ${updates.join(", ")} WHERE id = ?`, values);

    const [updated] = await pool.query("SELECT * FROM invoices WHERE id = ?", [id]);
    return successResponse(res, updated[0], "Status invoice berhasil diupdate.");
  } catch (error) { next(error); }
};

// GET /api/invoices/:id/items - Lihat detail items invoice
const getInvoiceItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    // Cek invoice ada
    const [invoices] = await pool.query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (invoices.length === 0) return errorResponse(res, 'Invoice tidak ditemukan.', 404);
    if (user_role === 'user' && invoices[0].user_id !== user_id) return errorResponse(res, 'Akses ditolak.', 403);

    const [items] = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY created_at ASC', [id]);
    return successResponse(res, items, 'Invoice items berhasil diambil.');
  } catch (error) { next(error); }
};

module.exports = { createInvoice, getMyInvoices, getAllInvoices, getInvoiceById, updateInvoiceStatus, getInvoiceItems };
