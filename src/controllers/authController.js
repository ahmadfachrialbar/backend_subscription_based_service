const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/responseHelper");

// Register
const register = async (req, res, next) => {
  try {
    // Ambil data dari body request
    const { email, password, full_name } = req.body;

    // 1. VALIDASI INPUT
    if (!email || !password) {
      return errorResponse(res, "Email dan password wajib diisi!", 400);
    }

    // Cek format email sederhana
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, "Format email tidak valid.", 400);
    }

    // Cek panjang password
    if (password.length < 6) {
      return errorResponse(res, "Password minimal 6 karakter.", 400);
    }

    // 2. CEK EMAIL SUDAH TERDAFTAR
    const [existingUsers] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );

    if (existingUsers.length > 0) {
      return errorResponse(res, "Email sudah terdaftar. Silakan login.", 409);
    }

    // 3. HASH PASSWORD
    const salt = await bcrypt.genSalt(10); // buat "garam" (salt)
    const password_hash = await bcrypt.hash(password, salt); // hash password

    // 4. SIMPAN USER KE DATABASE
    // Role default: 'user'
    const [result] = await pool.query(
      "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
      [email, password_hash, full_name || null, "user"],
    );

    // 5. Ambil data user
    const [users] = await pool.query(
      "SELECT id, email, full_name, role, status, created_at FROM users WHERE email = ?",
      [email],
    );

    // 6. KIRIM RESPONSE SUKSES
    return successResponse(res, users[0], "Registrasi berhasil!", 201);
  } catch (error) {
    // Kalau ada error, lempar ke error handler
    next(error);
  }
};

// Login
const login = async (req, res, next) => {
  try {
    // Ambil data dari body request
    const { email, password } = req.body;

    // 1. VALIDASI INPUT
    if (!email || !password) {
      return errorResponse(res, "Email dan password wajib diisi!", 400);
    }

    // 2. CARI USER BERDASARKAN EMAIL
    const [users] = await pool.query(
      "SELECT id, email, password_hash, full_name, role, status FROM users WHERE email = ?",
      [email],
    );

    // Cek apakah user ditemukan
    if (users.length === 0) {
      return errorResponse(res, "Email atau password salah.", 401);
    }

    const user = users[0];

    // 3. CEK STATUS USER AKTIF
    if (user.status !== "active") {
      return errorResponse(res, "Akun tidak aktif. Hubungi admin.", 403);
    }

    // 4. VERIFIKASI PASSWORD
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return errorResponse(res, "Email atau password salah.", 401);
    }

    // 5. BUAT JWT ACCESS TOKEN
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    // 6. BUAT JWT REFRESH TOKEN
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        type: "refresh",
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN },
    );

    // 7. SIMPAN REFRESH TOKEN KE DATABASE
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // expired 7 hari

    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, refreshToken, expiresAt],
    );

    // 8. HAPUS PASSWORD DARI RESPONSE (jangan dikirim ke client!)
    const userData = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      status: user.status,
    };

    // 9. KIRIM RESPONSE SUKSES
    return successResponse(
      res,
      {
        user: userData,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenType: "Bearer",
        expiresIn: "15m",
      },
      "Login berhasil!",
    );
  } catch (error) {
    next(error);
  }
};

// GET PROFILE (Protected)
const getProfile = async (req, res, next) => {
  try {
    const user = req.user;

    return successResponse(res, user, "Profil berhasil diambil.");
  } catch (error) {
    next(error);
  }
};

// Get all user (Admin Only)
const getAllUsers = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      "SELECT id, email, full_name, role, status, created_at FROM users",
    );

    return successResponse(res, users, "Daftar user berhasil diambil.");
  } catch (error) {
    next(error);
  }
};

// logout
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return errorResponse(res, "Refresh token wajib disertakan.", 400);
    }

    // Hapus refresh token dari database
    await pool.query("DELETE FROM refresh_tokens WHERE token = ?", [
      refreshToken,
    ]);

    return successResponse(res, null, "Logout berhasil.");
  } catch (error) {
    next(error);
  }
}
module.exports = { register, login, getProfile, getAllUsers, logout };
