const express = require('express');
const router = express.Router();

// Import controller
const { createPlan, getAllPlans, getPlanById, updatePlan, deletePlan  } = require('../controllers/planController');
// Import middleware
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// Public: Semua role bisa akses
router.get('/', getAllPlans);
router.get('/:id', getPlanById);

// Protected: Hanya admin 
router.post('/', verifyToken, authorize('admin'), createPlan);
router.put('/:id', verifyToken, authorize('admin'), updatePlan);
router.delete('/:id', verifyToken, authorize('admin'), deletePlan);

module.exports = router;