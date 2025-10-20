// routes/subscription.js
const express = require('express');
const {
  createSubscription,
  initiatePayment,
  handlePaymentCallback,
  simulatePaymentSuccess,
  getUserSubscriptions,
  getSubscriptionById
} = require('../controllers/subscriptionController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Protected routes (require authentication)
router.post('/create', authenticateToken, createSubscription);
router.post('/:orderId/payment', authenticateToken, initiatePayment);
router.get('/my-subscriptions', authenticateToken, getUserSubscriptions);
router.post('/payment/simulate', authenticateToken, simulatePaymentSuccess);
router.get('/:id', authenticateToken, getSubscriptionById);


// Public webhook route (for PhonePe callbacks)
router.post('/payment/callback', handlePaymentCallback);

module.exports = router;