const { pool } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/responseHelper");

// create | admin only
const createPlan = async (req, res, next) => {
  try {
    const {
      name,
      slug,
      price,
      billing_cycle,
      description,
      features,
      trial_days,
    } = req.body;

    // Validasi required
    if (!name || !slug || price === undefined) {
      return errorResponse(res, "Name, slug, dan price wajib diisi!", 400);
    }

    // Validasi tipe data
    if (typeof price !== "number" || price < 0) {
      return errorResponse(res, "Price harus angka positif!", 400);
    }

    const [result] = await pool.query(
      `
            INSERT INTO plans (name, slug, price, billing_cycle, description, features, trial_days) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        slug,
        price,
        billing_cycle || "monthly",
        description || null,
        features ? JSON.stringify(features) : null,
        trial_days || 0,
      ],
    );

    const [plans] = await pool.query("SELECT * FROM plans WHERE id = ?", [
      result.insertId,
    ]);

    return successResponse(res, plans[0], "Plan berhasil dibuat!", 201);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return errorResponse(res, "Slug sudah digunakan.", 409);
    }
    next(error);
  }
};

// read | all
const getAllPlans = async (req, res, next) => {
  try {
    const [plans] = await pool.query(
      "SELECT id, name, slug, price, billing_cycle FROM plans WHERE is_active = TRUE ORDER BY price ASC",
    );
    return successResponse(res, plans, "Daftar plan berhasil diambil.");
  } catch (error) {
    next(error);
  }
};

// read detail by id | all
const getPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [plans] = await pool.query("SELECT * FROM plans WHERE id = ?", [id]);

    if (plans.length === 0) {
      return errorResponse(res, "Plan tidak ditemukan.", 404);
    }

    return successResponse(res, plans[0], "Detail plan berhasil diambil.");
  } catch (error) {
    next(error);
  }
};

// update | admin only
const updatePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, price, description, features, is_active, trial_days } =
      req.body;

    // Cek plan ada
    const [existing] = await pool.query("SELECT id FROM plans WHERE id = ?", [
      id,
    ]);
    if (existing.length === 0) {
      return errorResponse(res, "Plan tidak ditemukan.", 404);
    }

    // Build query dinamis
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    if (price !== undefined) {
      updates.push("price = ?");
      values.push(price);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description);
    }
    if (features !== undefined) {
      updates.push("features = ?");
      values.push(JSON.stringify(features));
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(is_active);
    }
    if (trial_days !== undefined) {
      updates.push("trial_days = ?");
      values.push(trial_days);
    }

    if (updates.length === 0) {
      return errorResponse(res, "Tidak ada data yang diupdate.", 400);
    }

    values.push(id);
    await pool.query(
      `UPDATE plans SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    const [plans] = await pool.query(
      "SELECT id, name, slug, price, billing_cycle FROM plans WHERE id = ?",
      [id],
    );
    return successResponse(res, plans[0], "Plan berhasil diupdate.");
  } catch (error) {
    next(error);
  }
};

// delete | admin only
const deletePlan = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Cek apakah plan sedang digunakan
    const [subs] = await pool.query(
      "SELECT id FROM subscriptions WHERE plan_id = ?",
      [id],
    );
    if (subs.length > 0) {
      return errorResponse(
        res,
        "Plan sedang digunakan, tidak bisa dihapus.",
        409,
      );
    }

    const [result] = await pool.query("DELETE FROM plans WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return errorResponse(res, "Plan tidak ditemukan.", 404);
    }

    return successResponse(res, null, "Plan berhasil dihapus.");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
};
