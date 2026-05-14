const express = require('express');
const router = express.Router();

// Import controller
const { register, login, getProfile, getAllUsers } = require('../controllers/authController');

// Import middleware
const { verifyToken, authorize } = require('../middleware/authMiddleware');


// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);


// GET /api/auth/profile
// verifyToken = harus login dulu
router.get('/profile', verifyToken, getProfile);

// GET /api/auth/users
// verifyToken + authorize('admin') = hanya admin yang bisa akses
router.get('/users', verifyToken, authorize('admin'), getAllUsers);

module.exports = router;
