const bcrypt = require("bcryptjs");
const { pool } = require("./database");

const seedUsers = async () => {
  try {
    // Cek apakah sudah ada admin
    const [admins] = await pool.query("SELECT id FROM users WHERE role = ?", [
      "admin",
    ]);

    if (admins.length > 0) {
    } else {
      const salt = await bcrypt.genSalt(10);
      const adminPassword = await bcrypt.hash("admin123", salt);
      const financePassword = await bcrypt.hash("finance123", salt);

      await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?)`,
        ["admin@gmail.com", adminPassword, "Administrator", "admin", "active"],
      );

      await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?)`,
        [
          "finance@gmail.com",
          financePassword,
          "Finance Staff",
          "finance",
          "active",
        ],
      );
    }
    console.log("✅ Admin dan Finance dibuat");
  } catch (error) {
    console.error("❌ Seeder users:", error.message);
  }
};

// Seeder untuk data plans (paket langganan)
const seedPlans = async () => {
  try {
    const [existingPlans] = await pool.query(
      "SELECT id FROM plans WHERE slug = ?",
      ["free"],
    );

    // cek data plans sudah ada apa belum
    if (existingPlans.length > 0) {
      return;
    }

    // Plan 1: Free
    await pool.query(
      `
      INSERT INTO plans (name, slug, price, billing_cycle, description, features, trial_days)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "Free",
        "free",
        0,
        "forever",
        "Paket gratis dengan fitur dasar",
        JSON.stringify({
          model_access: ["gpt-3.5-turbo"],
          message_cap: 40,
          response_speed: "standard",
          plugins: false,
          custom_gpts: false,
          api_access: false,
        }),
        0,
      ],
    );

    // Plan 2: Plus
    await pool.query(
      `
      INSERT INTO plans (name, slug, price, billing_cycle, description, features, trial_days)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "Plus",
        "plus",
        299000,
        "monthly",
        "Akses prioritas ke GPT-4 dan fitur premium",
        JSON.stringify({
          model_access: ["gpt-4", "gpt-4o", "gpt-3.5-turbo"],
          message_cap: null,
          response_speed: "priority",
          plugins: true,
          custom_gpts: true,
          api_access: false,
        }),
        7,
      ],
    );

    // Plan 3: Team
    await pool.query(
      `
      INSERT INTO plans (name, slug, price, billing_cycle, description, features, trial_days)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "Team",
        "team",
        399000,
        "monthly",
        "Paket untuk tim dengan admin console",
        JSON.stringify({
          model_access: ["gpt-4", "gpt-4o", "gpt-3.5-turbo"],
          message_cap: null,
          response_speed: "priority",
          plugins: true,
          custom_gpts: true,
          api_access: false,
          team_features: {
            workspace: true,
            admin_console: true,
            user_management: true,
          },
        }),
        7,
      ],
    );

    // Plan 4: Enterprise
    await pool.query(
      `
      INSERT INTO plans (name, slug, price, billing_cycle, description, features, trial_days)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "Enterprise",
        "enterprise",
        899000,
        "yearly",
        "Paket enterprise dengan SLA dan custom model",
        JSON.stringify({
          model_access: ["gpt-4", "gpt-4o", "gpt-3.5-turbo", "custom"],
          message_cap: null,
          response_speed: "fastest",
          plugins: true,
          custom_gpts: true,
          api_access: true,
          sso: true,
          audit_logs: true,
          dedicated_support: true,
        }),
        14,
      ],
    );

    console.log("✅ Plans seeded");
  } catch (error) {
    console.error("❌ Seeder plans:", error.message);
  }
};

module.exports = { seedUsers, seedPlans };
