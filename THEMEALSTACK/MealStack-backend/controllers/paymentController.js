// controllers/paymentController.js - ENSURE ALL EXPORTS
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const DailyOrder = require('../models/DailyOrder');
const Cart = require('../models/cart');
const { sequelize } = require('../config/database');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @desc    Create Razorpay order for cart (WITHOUT creating orders first)
// @route   POST /api/payments/create-order-for-cart
// @access  Private
const createRazorpayOrderForCart = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { cartData, currency = 'INR' } = req.body;

    console.log('🔍 Create Razorpay Order for Cart:', {
      userId,
      totalAmount: cartData?.totalAmount,
      groupsCount: cartData?.deliveryGroups?.length
    });

    // Validation
    if (!cartData || !cartData.deliveryGroups || cartData.deliveryGroups.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cart data is required'
      });
    }

    if (!cartData.totalAmount || cartData.totalAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Valid total amount is required'
      });
    }

    // Verify cart items still exist and belong to user
    const cartItems = await Cart.findAll({
      where: { userId },
      transaction
    });

    if (cartItems.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    console.log('✅ Cart validation passed:', cartItems.length, 'items');

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(cartData.totalAmount * 100), // Convert to paise
      currency,
      receipt: `cart_${Date.now()}`,
      notes: {
        userId,
        orderCount: cartData.deliveryGroups.length,
        type: 'cart_checkout'
      }
    });

    console.log('✅ Razorpay order created:', razorpayOrder.id);

    // Create payment record with cart data (NO orders created yet!)
    const payment = await Payment.create({
      userId,
      razorpayOrderId: razorpayOrder.id,
      amount: cartData.totalAmount,
      currency,
      paymentMethod: 'razorpay',
      status: 'created',
      paymentData: JSON.stringify({
        razorpayOrder,
        cartData, // Store cart data for later order creation
        createdAt: new Date().toISOString()
      })
    }, { transaction });

    console.log('✅ Payment record created:', payment.id);

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Razorpay order created',
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        paymentId: payment.id,
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Create Razorpay order for cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Verify payment and CREATE orders
// @route   POST /api/payments/verify-and-create-orders
// @access  Private
const verifyPaymentAndCreateOrders = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      cartData
    } = req.body;

    console.log('🔍 Verify payment and create orders:', {
      userId,
      razorpay_order_id,
      razorpay_payment_id
    });

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Missing payment details'
      });
    }

    // Find payment record
    const payment = await Payment.findOne({
      where: {
        razorpayOrderId: razorpay_order_id,
        userId
      },
      transaction
    });

    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      await payment.update({
        status: 'failed',
        paymentResponse: JSON.stringify({
          error: 'Invalid signature',
          timestamp: new Date().toISOString()
        })
      }, { transaction });

      await transaction.commit();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    console.log('✅ Payment signature verified');

    // Get cart data from payment record or request
    const storedPaymentData = JSON.parse(payment.paymentData);
    const orderCartData = cartData || storedPaymentData.cartData;

    if (!orderCartData || !orderCartData.deliveryGroups) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cart data not found for order creation'
      });
    }

    // Get user details
    const User = require('../models/User');
    const user = await User.findByPk(userId, { transaction });

    // NOW create orders (only after payment verification!)
    const createdOrders = [];
    
    for (const group of orderCartData.deliveryGroups) {
      const orderNumber = generateOrderNumber();
      
      const order = await DailyOrder.create({
        userId,
        orderNumber,
        orderDate: group.orderDate,
        mealType: group.mealType,
        selectedItems: JSON.stringify(group.items),
        totalAmount: group.totalAmount,
        deliveryAddress: `Address ID: ${group.addressId}`,
        status: 'confirmed',
        paymentStatus: 'paid',
        paidAt: new Date(),
        notes: orderCartData.notes || null,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone
      }, { transaction });

      createdOrders.push(order);
    }

    console.log(`✅ Created ${createdOrders.length} orders`);

    // Update payment record
    await payment.update({
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: 'completed',
      completedAt: new Date(),
      orderIds: JSON.stringify(createdOrders.map(o => o.id)),
      paymentResponse: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        verified: true,
        ordersCreated: createdOrders.length,
        timestamp: new Date().toISOString()
      })
    }, { transaction });

    // Clear user's cart
    await Cart.destroy({
      where: { userId },
      transaction
    });

    console.log('✅ Cart cleared');

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Payment verified and orders created successfully',
      data: {
        paymentId: payment.id,
        ordersCreated: createdOrders.length,
        orderNumbers: createdOrders.map(o => o.orderNumber)
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Verify payment and create orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification or order creation failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create Razorpay order for existing orders
// @route   POST /api/payments/create-order
// @access  Private
const createRazorpayOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { orderIds, totalAmount, currency = 'INR' } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Order IDs are required'
      });
    }

    if (!totalAmount || totalAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Valid total amount is required'
      });
    }

    const orders = await DailyOrder.findAll({
      where: {
        id: orderIds,
        userId,
        paymentStatus: 'pending'
      },
      transaction
    });

    if (orders.length !== orderIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Some orders not found or already paid'
      });
    }

    const calculatedTotal = orders.reduce((sum, order) => 
      sum + parseFloat(order.totalAmount), 0
    );

    if (Math.abs(calculatedTotal - parseFloat(totalAmount)) > 0.01) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Amount mismatch'
      });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency,
      receipt: `order_${Date.now()}`,
      notes: {
        userId,
        orderIds: orderIds.join(','),
        orderCount: orderIds.length
      }
    });

    const payment = await Payment.create({
      userId,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
      currency,
      paymentMethod: 'razorpay',
      status: 'created',
      orderIds: JSON.stringify(orderIds),
      paymentData: JSON.stringify({
        razorpayOrder,
        createdAt: new Date().toISOString()
      })
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Razorpay order created',
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        paymentId: payment.id,
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Create Razorpay order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order'
    });
  }
};

// @desc    Handle payment failure
// @route   POST /api/payments/failure
// @access  Private
const handlePaymentFailure = async (req, res) => {
  try {
    const userId = req.user.id;
    const { razorpay_order_id, error } = req.body;

    const payment = await Payment.findOne({
      where: {
        razorpayOrderId: razorpay_order_id,
        userId
      }
    });

    if (payment) {
      await payment.update({
        status: 'failed',
        paymentResponse: JSON.stringify({
          error: error || 'Payment failed',
          timestamp: new Date().toISOString()
        })
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment failure recorded'
    });

  } catch (error) {
    console.error('Handle payment failure error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment failure'
    });
  }
};

// @desc    Get payment details
// @route   GET /api/payments/:id
// @access  Private
const getPaymentDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const payment = await Payment.findOne({
      where: { id, userId }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { payment }
    });

  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details'
    });
  }
};

// @desc    Get user's payment history
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};

// Helper function
function generateOrderNumber() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `MS${timestamp.slice(-6)}${random}`;
}

// IMPORTANT: Export all functions
module.exports = {
  createRazorpayOrderForCart,
  verifyPaymentAndCreateOrders,
  createRazorpayOrder,
  handlePaymentFailure,
  getPaymentDetails,
  getPaymentHistory
};