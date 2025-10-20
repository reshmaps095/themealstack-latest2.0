// controllers/subscriptionController.js

// Direct model imports
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const User = require('../models/User');
const crypto = require('crypto');

// @desc    Create subscription order
// @route   POST /api/subscriptions/create
// @access  Private
const createSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      packageType,
      packageTitle,
      priceAmount,
      startDate,
      endDate,
      deliveryAddress,
      specialInstructions,
      paymentMethod
    } = req.body;

    console.log('Creating subscription with data:', {
      userId,
      packageType,
      packageTitle,
      priceAmount,
      startDate,
      endDate,
      deliveryAddress,
      paymentMethod
    });

    // Validation
    if (!packageType || !packageTitle || !priceAmount || !startDate || !endDate || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate start date is in future
    const start = new Date(startDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (start < tomorrow) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be at least tomorrow'
      });
    }

    // Create ONLY subscription order (NO Payment record here!)
    const subscription = await Subscription.create({
      userId,
      packageType,
      packageTitle,
      priceAmount: parseFloat(priceAmount),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      deliveryAddress,
      specialInstructions: specialInstructions || null,
      paymentMethod,
      status: 'pending_payment',
      orderNumber: generateOrderNumber()
    });

    console.log('Subscription created successfully:', subscription.id);

    res.status(201).json({
      success: true,
      message: 'Subscription order created successfully',
      data: {
        orderId: subscription.id,
        orderNumber: subscription.orderNumber,
        subscription
      }
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription order',
      error: error.message
    });
  }
};

// @desc    Initiate PhonePe payment
// @route   POST /api/subscriptions/:orderId/payment
// @access  Private
const initiatePayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const subscription = await Subscription.findOne({
      where: { id: orderId, userId }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription order not found'
      });
    }

    if (subscription.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed for this order'
      });
    }

    // Generate payment transaction ID
    const transactionId = `MS_${subscription.orderNumber}_${Date.now()}`;
    
    // Create payment record HERE (with all required fields)
    const payment = await Payment.create({
      subscriptionId: subscription.id,
      userId,
      transactionId,
      amount: subscription.priceAmount,
      paymentMethod: subscription.paymentMethod || 'phonepay',
      status: 'initiated'
    });

    // Mock payment URL for demo
    const mockPaymentUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/payment/simulate?transactionId=${transactionId}&amount=${subscription.priceAmount}&orderId=${orderId}`;

    res.status(200).json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        paymentUrl: mockPaymentUrl,
        transactionId,
        orderId: subscription.id
      }
    });

  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment'
    });
  }
};

// @desc    Handle payment callback from PhonePe
// @route   POST /api/subscriptions/payment/callback
// @access  Public (PhonePe webhook)
const handlePaymentCallback = async (req, res) => {
  try {
    const { merchantTransactionId, code, message, data } = req.body;

    const payment = await Payment.findOne({
      where: { transactionId: merchantTransactionId }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    if (code === 'PAYMENT_SUCCESS') {
      // Update payment status
      await payment.update({
        status: 'completed',
        paymentResponse: JSON.stringify(req.body),
        completedAt: new Date()
      });

      // Update subscription status
      const subscription = await Subscription.findByPk(payment.subscriptionId);
      await subscription.update({
        status: 'active',
        activatedAt: new Date()
      });

      // Send confirmation email (optional)
      const user = await User.findByPk(payment.userId);
      console.log('Payment successful for user:', user.email);

    } else {
      // Payment failed
      await payment.update({
        status: 'failed',
        paymentResponse: JSON.stringify(req.body)
      });

      const subscription = await Subscription.findByPk(payment.subscriptionId);
      await subscription.update({
        status: 'payment_failed'
      });
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Payment callback error:', error);
    res.status(500).json({ success: false });
  }
};

// @desc    Simulate payment success (for demo)
// @route   POST /api/subscriptions/payment/simulate
// @access  Private
const simulatePaymentSuccess = async (req, res) => {
  try {
    const { transactionId, orderId } = req.body;

    const payment = await Payment.findOne({
      where: { transactionId }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Simulate successful payment
    await payment.update({
      status: 'completed',
      completedAt: new Date()
    });

    // Find and update subscription
    const subscription = await Subscription.findByPk(payment.subscriptionId);
    await subscription.update({
      status: 'active',
      activatedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Payment simulation successful',
      data: {
        subscription: subscription,
        payment
      }
    });

  } catch (error) {
    console.error('Payment simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment simulation failed'
    });
  }
};

// @desc    Get user subscriptions
// @route   GET /api/subscriptions/my-subscriptions
// @access  Private
const getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await Subscription.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: { subscriptions }
    });

  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions'
    });
  }
};

// @desc    Get subscription by ID
// @route   GET /api/subscriptions/:id
// @access  Private
const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const subscription = await Subscription.findOne({
      where: { id, userId }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { subscription }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription'
    });
  }
};

// Helper function
function generateOrderNumber() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `MS${timestamp.slice(-6)}${random}`;
}

module.exports = {
  createSubscription,
  initiatePayment,
  handlePaymentCallback,
  simulatePaymentSuccess,
  getUserSubscriptions,
  getSubscriptionById
};