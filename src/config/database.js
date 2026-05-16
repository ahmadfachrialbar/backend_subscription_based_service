const mysql = require("mysql2/promise");
require("dotenv").config();

// Konfigurasi koneksi database
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
};

// Buat connection pool
const pool = mysql.createPool(dbConfig);

// Fungsi untuk inisialisasi database (create tabel)
const initDatabase = async () => {
    try {
        const connection = await pool.getConnection();
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

        // ====================================
        // TABEL BARU - Phase 3, 4, 5
        // ====================================

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

        connection.release();
        console.log("✅ Tabel siap");
    } catch (error) {
        console.error("❌ Koneksi database:", error.message);
        process.exit(1);
    }
};

module.exports = { pool, initDatabase };
