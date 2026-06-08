const mysql = require("mysql2/promise");
require("dotenv").config();

// =============================================================
// STRATEGI: Single Connection per Request (Serverless-Optimized)
// =============================================================
//
// MASALAH dengan Pool di Serverless:
//   - Vercel membuat banyak instance (cold start) secara paralel
//   - Setiap instance membuat pool sendiri dengan N koneksi
//   - Jika 3 instance × 2 koneksi = 6 > batas 5 → ERROR
//
// SOLUSI: Buat 1 koneksi saat dibutuhkan, tutup setelah selesai
//   - Setiap request hanya pakai 1 koneksi
//   - Koneksi ditutup (end) setelah query selesai
//   - Tidak ada koneksi idle yang menggantung
//   - Meski ada 5 instance, hanya yang sedang aktif yang pakai koneksi
//
// CATATAN: `pool` tetap di-export untuk backward compatibility,
//   tapi pool dibuat dengan connectionLimit: 1 dan idleTimeout
//   sangat rendah agar koneksi cepat dilepas.
// =============================================================

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 3306,
  // -- Serverless-optimized pool settings --
  waitForConnections: true,
  connectionLimit: 1,        // Hanya 1 koneksi per instance
  maxIdle: 0,                // Jangan simpan koneksi idle
  idleTimeout: 5000,         // Tutup koneksi idle setelah 5 detik
  queueLimit: 0,
  enableKeepAlive: false,    // Tidak perlu keep-alive di serverless
  connectTimeout: 10000,     // Timeout koneksi 10 detik
};

// Pool untuk backward compatibility (pool.query masih bisa dipakai)
let pool;

/**
 * Mendapatkan pool instance (lazy initialization).
 * Di serverless, pool bisa mati antar invokasi, jadi kita
 * periksa dan buat ulang jika perlu.
 */
const getPool = () => {
  if (!pool) {
    pool = mysql.createPool(dbConfig);

    // Event listener untuk monitoring (opsional, bisa dihapus di production)
    pool.on('connection', () => {
      console.log('🔌 Pool: koneksi baru dibuat');
    });

    pool.on('release', () => {
      console.log('♻️  Pool: koneksi dilepas');
    });
  }
  return pool;
};

/**
 * Membuat koneksi tunggal langsung (tanpa pool).
 * Digunakan untuk operasi yang butuh kontrol penuh,
 * seperti transaksi atau initDatabase.
 *
 * ⚠️ WAJIB panggil connection.end() setelah selesai!
 */
const createConnection = async () => {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    connectTimeout: 10000,
  });
};

/**
 * Helper untuk menjalankan query dengan auto-release.
 * Menggunakan pool.query yang otomatis ambil & lepas koneksi.
 *
 * Contoh:
 *   const [rows] = await query('SELECT * FROM users WHERE id = ?', [userId]);
 */
const query = async (sql, params) => {
  const p = getPool();
  try {
    return await p.query(sql, params);
  } catch (error) {
    // Jika koneksi pool rusak, destroy & buat ulang
    if (error.code === 'PROTOCOL_CONNECTION_LOST' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED') {
      console.warn('⚠️ Koneksi pool rusak, membuat ulang...');
      try { await pool.end(); } catch (e) { /* ignore */ }
      pool = null;
      const newPool = getPool();
      return await newPool.query(sql, params);
    }
    throw error;
  }
};

/**
 * Helper untuk menjalankan transaksi dengan auto-cleanup.
 * Koneksi PASTI ditutup setelah callback selesai (sukses/gagal).
 *
 * Contoh:
 *   const result = await withTransaction(async (conn) => {
 *     await conn.query('UPDATE payments SET status = ? WHERE id = ?', ['completed', id]);
 *     await conn.query('UPDATE invoices SET status = ? WHERE id = ?', ['paid', invoiceId]);
 *     return { success: true };
 *   });
 */
const withTransaction = async (callback) => {
  const connection = await createConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end(); // SELALU tutup koneksi
  }
};

// =========================================================
// Inisialisasi Database (Create Tables)
// Menggunakan koneksi tunggal yang ditutup setelah selesai
// =========================================================
const initDatabase = async () => {
  let connection;
  try {
    connection = await createConnection();
    console.log("✅ Koneksi Db");

    // Buat tabel users
    await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100),
                role ENUM('user', 'admin', 'finance') DEFAULT 'user',
                status ENUM('active', 'suspended') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email)
            ) ENGINE=InnoDB
        `);

    // Buat tabel refresh_tokens
    await connection.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                user_id VARCHAR(36) NOT NULL,
                token VARCHAR(500) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                revoked_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB
        `);

    // Buat tabel plan
    await connection.query(`
            CREATE TABLE IF NOT EXISTS plans (
                id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                name VARCHAR(50) NOT NULL,
                slug VARCHAR(50) UNIQUE NOT NULL,
                price DECIMAL(10,2) NOT NULL DEFAULT 0,
                billing_cycle ENUM('monthly', 'yearly', 'forever') DEFAULT 'monthly',
                description TEXT,
                features JSON,
                is_active BOOLEAN DEFAULT TRUE,
                trial_days INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_slug (slug),
                INDEX idx_active (is_active)
            ) ENGINE=InnoDB
        `);

    // Buat tabel subscriptions
    await connection.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                user_id VARCHAR(36) NOT NULL,
                plan_id VARCHAR(36) NOT NULL,
                status ENUM('trial', 'active', 'past_due', 'cancelled', 'expired', 'suspended') DEFAULT 'trial',
                current_period_start DATE NOT NULL,
                current_period_end DATE NOT NULL,
                trial_end DATE,
                cancel_at_period_end BOOLEAN DEFAULT FALSE,
                auto_renew BOOLEAN DEFAULT TRUE,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cancelled_at TIMESTAMP NULL,
                expired_at TIMESTAMP NULL,
                suspended_at TIMESTAMP NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (plan_id) REFERENCES plans(id),
                INDEX idx_user_status (user_id, status),
                INDEX idx_period_end (current_period_end)
            ) ENGINE=InnoDB
        `);

    // Buat tabel invoices
    await connection.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                user_id VARCHAR(36) NOT NULL,
                subscription_id VARCHAR(36),
                invoice_number VARCHAR(50) UNIQUE NOT NULL,
                subtotal DECIMAL(10,2) NOT NULL,
                tax DECIMAL(10,2) DEFAULT 0,
                discount DECIMAL(10,2) DEFAULT 0,
                total DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'IDR',
                period_start DATE,
                period_end DATE,
                status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded') DEFAULT 'draft',
                due_date DATE NOT NULL,
                paid_at TIMESTAMP NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
                INDEX idx_user (user_id),
                INDEX idx_status (status),
                INDEX idx_due_date (due_date)
            ) ENGINE=InnoDB
        `);

    // Tabel payments (simulasi pembayaran)
    await connection.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                invoice_id VARCHAR(36) NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_method ENUM('bank_transfer', 'credit_card', 'e_wallet', 'qris') NOT NULL,
                payment_status ENUM('pending', 'processing', 'completed', 'failed', 'refunded') DEFAULT 'pending',
                transaction_id VARCHAR(100),
                payment_details JSON,
                paid_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_invoice (invoice_id),
                INDEX idx_user (user_id),
                INDEX idx_status (payment_status)
            ) ENGINE=InnoDB
        `);

    // Tabel subscription_history (tracking perubahan)
    await connection.query(`
            CREATE TABLE IF NOT EXISTS subscription_history (
                id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                subscription_id VARCHAR(36) NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                action ENUM('created', 'activated', 'upgraded', 'downgraded', 'renewed', 'cancelled', 'expired', 'suspended', 'reactivated') NOT NULL,
                old_plan_id VARCHAR(36),
                new_plan_id VARCHAR(36),
                old_status VARCHAR(20),
                new_status VARCHAR(20),
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_subscription (subscription_id),
                INDEX idx_user (user_id),
                INDEX idx_action (action)
            ) ENGINE=InnoDB
        `);

    // Tabel invoice_items (detail tagihan)
    await connection.query(`
            CREATE TABLE IF NOT EXISTS invoice_items (
                id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                invoice_id VARCHAR(36) NOT NULL,
                description VARCHAR(255) NOT NULL,
                quantity INT DEFAULT 1,
                unit_price DECIMAL(10,2) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                item_type ENUM('subscription', 'proration_credit', 'proration_charge', 'tax', 'discount', 'addon') DEFAULT 'subscription',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                INDEX idx_invoice (invoice_id)
            ) ENGINE=InnoDB
        `);

    // Tabel notifications
    await connection.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                user_id VARCHAR(36) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type ENUM('info', 'warning', 'success', 'danger') DEFAULT 'info',
                category ENUM('subscription', 'payment', 'invoice', 'system') DEFAULT 'system',
                is_read BOOLEAN DEFAULT FALSE,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_read (user_id, is_read),
                INDEX idx_category (category)
            ) ENGINE=InnoDB
        `);

    console.log("✅ Tabel siap");
  } catch (error) {
    console.error("❌ Koneksi database:", error.message);
    process.exit(1);
  } finally {
    // PENTING: Tutup koneksi setelah init selesai!
    if (connection) await connection.end();
  }
};

/**
 * Graceful shutdown - tutup pool saat process mau mati.
 * Penting untuk mencegah koneksi zombie di serverless.
 */
const closePool = async () => {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('🔌 Pool ditutup');
    } catch (e) {
      console.error('⚠️ Error menutup pool:', e.message);
    }
  }
};

// Tutup pool saat process exit (untuk serverless cleanup)
process.on('SIGTERM', closePool);
process.on('SIGINT', closePool);

// Proxy object agar `pool.query(...)` dan `pool.getConnection()`
// tetap berfungsi di semua file yang sudah import { pool }.
// Ini membuat migrasi zero-effort — tidak perlu ubah controller.
const poolProxy = new Proxy({}, {
  get(target, prop) {
    const p = getPool();
    if (typeof p[prop] === 'function') {
      return p[prop].bind(p);
    }
    return p[prop];
  }
});

module.exports = {
  pool: poolProxy,         // Backward compatible - bisa dipakai pool.query()
  query,                   // Helper baru - auto reconnect
  withTransaction,         // Helper baru - auto commit/rollback/close
  createConnection,        // Untuk kasus yang butuh koneksi manual
  initDatabase,
  closePool,
};
