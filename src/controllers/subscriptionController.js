const { pool, withTransaction } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/responseHelper");
const { createAutoInvoice } = require("../utils/invoiceGenerator");
const { calculateProration } = require("../utils/prorationCalculator");
const { createNotification } = require("../controllers/notificationController");

// POST /api/subscriptions - Buat subscription baru + auto generate invoice
const createSubscription = async (req, res, next) => {
  try {
    const { plan_id } = req.body;
    const user_id = req.user.id;

    if (!plan_id) return errorResponse(res, "Plan ID wajib diisi!", 400);

    // Cek plan ada dan aktif
    const [plans] = await pool.query(
      "SELECT * FROM plans WHERE id = ? AND is_active = TRUE",
      [plan_id],
    );
    if (plans.length === 0)
      return errorResponse(res, "Plan tidak ditemukan atau tidak aktif.", 404);
    const plan = plans[0];

    // Cek user sudah punya subscription aktif
    const [existingSubs] = await pool.query(
      'SELECT id FROM subscriptions WHERE user_id = ? AND status IN ("trial", "active")',
      [user_id],
    );
    if (existingSubs.length > 0) {
      return errorResponse(
        res,
        "Anda sudah memiliki subscription aktif. Silakan upgrade atau cancel dulu.",
        409,
      );
    }

    // Hitung periode
    const now = new Date();
    const periodStart = now;
    let periodEnd = new Date(now);
    let trialEnd = null;

    if (plan.billing_cycle === "monthly")
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    else if (plan.billing_cycle === "yearly")
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 100);

    if (plan.trial_days > 0) {
      trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + plan.trial_days);
    }

    const status =
      plan.trial_days > 0
        ? "trial"
        : parseFloat(plan.price) === 0
          ? "active"
          : "active";

    // Insert subscription
    await pool.query(
      `
            INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end, trial_end)
            VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, plan_id, status, periodStart, periodEnd, trialEnd],
    );

    // Ambil subscription yang baru dibuat
    const [newSubs] = await pool.query(
      "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY started_at DESC LIMIT 1",
      [user_id],
    );
    const subscription = newSubs[0];

    // Auto generate invoice
    const invoice = await createAutoInvoice({
      user_id,
      subscription_id: subscription.id,
      plan,
      periodStart,
      periodEnd,
    });

    // Catat history
    await pool.query(
      `
            INSERT INTO subscription_history (subscription_id, user_id, action, new_plan_id, old_status, new_status)
            VALUES (?, ?, 'created', ?, NULL, ?)`,
      [subscription.id, user_id, plan_id, status],
    );

    // Notifikasi
    await createNotification(
      user_id,
      "Subscription Dibuat! 🎉",
      `Anda berhasil subscribe paket ${plan.name}. ${parseFloat(plan.price) > 0 ? "Silakan selesaikan pembayaran." : "Selamat menggunakan!"}`,
      "success",
      "subscription",
      { subscription_id: subscription.id },
    );

    return successResponse(
      res,
      { subscription, invoice },
      "Subscription berhasil dibuat!",
      201,
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/subscriptions/my - Lihat subscription user
const getMySubscription = async (req, res, next) => {
  try {
    const [subs] = await pool.query(
      `
            SELECT s.*, p.name as plan_name, p.price, p.billing_cycle, p.features
            FROM subscriptions s JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = ? AND s.status IN (?, ?) ORDER BY s.started_at DESC`,
      [req.user.id, "active", "trial"],
    );
    return successResponse(res, subs, "Subscription berhasil diambil.");
  } catch (error) {
    next(error);
  }
};

// GET /api/subscriptions - Semua subscription (admin)
const getAllSubscriptions = async (req, res, next) => {
  try {
    const [subs] = await pool.query(`
            SELECT s.id, s.user_id, s.plan_id, s.status, s.current_period_start, s.current_period_end, s.auto_renew,
                   u.email as user_email, u.full_name, p.name as plan_name
            FROM subscriptions s JOIN users u ON s.user_id = u.id JOIN plans p ON s.plan_id = p.id
            ORDER BY s.started_at DESC`);
    return successResponse(res, subs, "Semua subscription berhasil diambil.");
  } catch (error) {
    next(error);
  }
};

// PUT /api/subscriptions/:id/cancel - Cancel subscription
const cancelSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    const [subs] = await pool.query(
      "SELECT * FROM subscriptions WHERE id = ?",
      [id],
    );
    if (subs.length === 0)
      return errorResponse(res, "Subscription tidak ditemukan.", 404);

    const sub = subs[0];
    if (user_role !== "admin" && sub.user_id !== user_id)
      return errorResponse(res, "Akses ditolak.", 403);

    const oldStatus = sub.status;
    await pool.query(
      'UPDATE subscriptions SET status = "cancelled", cancel_at_period_end = TRUE, cancelled_at = NOW() WHERE id = ?',
      [id],
    );

    await pool.query(
      `
            INSERT INTO subscription_history (subscription_id, user_id, action, old_status, new_status)
            VALUES (?, ?, 'cancelled', ?, 'cancelled')`,
      [id, sub.user_id, oldStatus],
    );

    await createNotification(
      sub.user_id,
      "Subscription Dibatalkan",
      "Langganan Anda telah dibatalkan.",
      "warning",
      "subscription",
      { subscription_id: id },
    );

    const [updated] = await pool.query(
      "SELECT * FROM subscriptions WHERE id = ?",
      [id],
    );
    return successResponse(res, updated[0], "Subscription berhasil dicancel.");
  } catch (error) {
    next(error);
  }
};

// ============================================
// UPGRADE & DOWNGRADE
// ============================================

// POST /api/subscriptions/preview-change - Preview proration sebelum change plan
const previewChangePlan = async (req, res, next) => {
  try {
    const { new_plan_id } = req.body;
    const user_id = req.user.id;

    if (!new_plan_id)
      return errorResponse(res, "New plan ID wajib diisi!", 400);

    // Ambil subscription aktif
    const [currentSubs] = await pool.query(
      `
            SELECT s.*, p.name as plan_name, p.price, p.billing_cycle
            FROM subscriptions s JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = ? AND s.status IN ('active', 'trial') LIMIT 1`,
      [user_id],
    );
    if (currentSubs.length === 0)
      return errorResponse(res, "Anda tidak memiliki subscription aktif.", 404);

    const currentSub = currentSubs[0];
    if (currentSub.plan_id === new_plan_id)
      return errorResponse(res, "Anda sudah menggunakan paket ini.", 400);

    // Ambil plan baru
    const [newPlans] = await pool.query(
      "SELECT * FROM plans WHERE id = ? AND is_active = TRUE",
      [new_plan_id],
    );
    if (newPlans.length === 0)
      return errorResponse(res, "Plan baru tidak ditemukan.", 404);

    const currentPlan = {
      name: currentSub.plan_name,
      price: currentSub.price,
      billing_cycle: currentSub.billing_cycle,
    };
    const newPlan = newPlans[0];
    const proration = calculateProration(
      currentPlan,
      newPlan,
      currentSub.current_period_end,
    );

    return successResponse(res, proration, "Preview perubahan paket.");
  } catch (error) {
    next(error);
  }
};

// POST /api/subscriptions/change-plan - Eksekusi upgrade/downgrade
const changePlan = async (req, res, next) => {
  try {
    const { new_plan_id } = req.body;
    const user_id = req.user.id;

    if (!new_plan_id)
      return errorResponse(res, "New plan ID wajib diisi!", 400);

    const [currentSubs] = await pool.query(
      `
            SELECT s.*, p.name as plan_name, p.price, p.billing_cycle
            FROM subscriptions s JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = ? AND s.status IN ('active', 'trial') LIMIT 1`,
      [user_id],
    );
    if (currentSubs.length === 0)
      return errorResponse(res, "Anda tidak memiliki subscription aktif.", 404);

    const currentSub = currentSubs[0];
    if (currentSub.plan_id === new_plan_id)
      return errorResponse(res, "Anda sudah menggunakan paket ini.", 400);

    const [newPlans] = await pool.query(
      "SELECT * FROM plans WHERE id = ? AND is_active = TRUE",
      [new_plan_id],
    );
    if (newPlans.length === 0)
      return errorResponse(res, "Plan baru tidak ditemukan.", 404);

    const newPlan = newPlans[0];
    const currentPlan = {
      name: currentSub.plan_name,
      price: currentSub.price,
      billing_cycle: currentSub.billing_cycle,
    };
    const proration = calculateProration(
      currentPlan,
      newPlan,
      currentSub.current_period_end,
    );

    const oldPlanId = currentSub.plan_id;
    const oldStatus = currentSub.status;
    const actionType = proration.is_upgrade ? "upgraded" : "downgraded";

    // Hitung periode baru (mulai dari sekarang)
    const now = new Date();
    let newPeriodEnd = new Date(now);
    if (newPlan.billing_cycle === "monthly")
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    else if (newPlan.billing_cycle === "yearly")
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    else newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 100);

    // Gunakan withTransaction untuk auto commit/rollback/close
    await withTransaction(async (connection) => {
      // Update subscription ke plan baru
      await connection.query(
        `
                UPDATE subscriptions SET plan_id = ?, current_period_start = ?, current_period_end = ?, status = 'active'
                WHERE id = ?`,
        [new_plan_id, now, newPeriodEnd, currentSub.id],
      );

      // Catat history
      await connection.query(
        `
                INSERT INTO subscription_history (subscription_id, user_id, action, old_plan_id, new_plan_id, old_status, new_status, metadata)
                VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
        [
          currentSub.id,
          user_id,
          actionType,
          oldPlanId,
          new_plan_id,
          oldStatus,
          JSON.stringify(proration),
        ],
      );
    });

    // Setelah transaksi selesai & koneksi ditutup, lanjutkan operasi non-transaksional
    const invoice = await createAutoInvoice({
      user_id,
      subscription_id: currentSub.id,
      plan: newPlan,
      periodStart: now,
      periodEnd: newPeriodEnd,
      prorationCredit: proration.credit,
      description: `${proration.type === "upgrade" ? "Upgrade" : "Downgrade"} ke ${newPlan.name}`,
    });

    await createNotification(
      user_id,
      proration.is_upgrade
        ? "Paket Berhasil Di-upgrade! 🚀"
        : "Paket Berhasil Di-downgrade",
      proration.summary,
      proration.is_upgrade ? "success" : "info",
      "subscription",
      { subscription_id: currentSub.id, proration },
    );

    const [updatedSub] = await pool.query(
      `
                SELECT s.*, p.name as plan_name, p.price, p.billing_cycle
                FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.id = ?`,
      [currentSub.id],
    );

    return successResponse(
      res,
      { subscription: updatedSub[0], invoice, proration },
      `Paket berhasil di-${actionType}!`,
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/subscriptions/history - Riwayat perubahan subscription
const getSubscriptionHistory = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const user_role = req.user.role;

    let query = `
            SELECT sh.*, 
                   op.name as old_plan_name, np.name as new_plan_name
            FROM subscription_history sh
            LEFT JOIN plans op ON sh.old_plan_id = op.id
            LEFT JOIN plans np ON sh.new_plan_id = np.id`;
    const params = [];

    if (user_role === "user") {
      query += " WHERE sh.user_id = ?";
      params.push(user_id);
    }

    query += " ORDER BY sh.created_at DESC";
    const [history] = await pool.query(query, params);

    return successResponse(
      res,
      history,
      "Riwayat subscription berhasil diambil.",
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSubscription,
  getMySubscription,
  getAllSubscriptions,
  cancelSubscription,
  previewChangePlan,
  changePlan,
  getSubscriptionHistory,
};
