// routes/admin.js
const express = require('express');
const router = express.Router(); // ADD THIS LINE - you're missing it!

const {
  getAllUsers,
  getUserById,
  updateVerificationStatus,
  updateUserStatus,
  getAllPayments,
  getPaymentById,
  getDashboardStats,
  refundPayment,
  exportUsers,
  exportPayments,
  getUserAddresses,
  getAllOrders,
  updateOrderStatus,
  exportOrders,
  exportOrdersExcel,
  updateAddressVerification
} = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const mealCapacityController = require('../controllers/mealCapacityController');

// Apply authentication and admin authorization to all routes
router.use(authenticateToken);
router.use(authorizeRoles('admin')); // Only admin role can access these routes

// Dashboard statistics
router.get('/stats', getDashboardStats);

// User management routes
router.get('/users', getAllUsers);
router.get('/users/export', exportOrdersExcel);
router.get('/users/:id', getUserById);
router.get('/users/:userId/addresses', getUserAddresses);
router.patch('/users/:id/verification', updateVerificationStatus);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/addresses/:id/verification', updateAddressVerification);
// Payment management routes
router.get('/payments', getAllPayments);
router.get('/payments/export', exportPayments);
router.get('/payments/:id', getPaymentById);
router.post('/payments/:id/refund', refundPayment);

router.get('/orders', getAllOrders);
router.get('/orders/export', exportOrders);
router.put('/orders/:id/status', updateOrderStatus);

// Dashboard stats
router.get('/stats', getDashboardStats);

// Meal Capacity Routes (already protected by router.use above)
router.get('/meal-capacity/next-7-days', mealCapacityController.getNext7DaysCapacity);
router.get('/meal-capacity/date/:date', mealCapacityController.getCapacityForDate);
router.post('/meal-capacity', mealCapacityController.createOrUpdateCapacity);
router.put('/meal-capacity/:id', mealCapacityController.updateCapacity);
router.post('/meal-capacity/bulk-set', mealCapacityController.bulkSetCapacity);

router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.get('/orders/export-excel', exportOrdersExcel);

module.exports = router;