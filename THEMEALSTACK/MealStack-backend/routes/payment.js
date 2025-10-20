// routes/payment.js - COMPLETE FILE
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  createRazorpayOrderForCart,
  verifyPaymentAndCreateOrders,
  createRazorpayOrder,
  handlePaymentFailure,
  getPaymentDetails,
  getPaymentHistory
} = require('../controllers/paymentController');

// All payment routes require authentication
router.use(authenticateToken);

// NEW: Create Razorpay order for cart (without creating orders)
router.post('/create-order-for-cart', createRazorpayOrderForCart);

// NEW: Verify payment and create orders
router.post('/verify-and-create-orders', verifyPaymentAndCreateOrders);

// OLD: Keep for backward compatibility
router.post('/create-order', createRazorpayOrder);

// Handle payment failure
router.post('/failure', handlePaymentFailure);

// Get payment details
router.get('/:id', getPaymentDetails);

// Get payment history
router.get('/history', getPaymentHistory);

module.exports = router;