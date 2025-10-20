// models/Payment.js - UPDATED FOR RAZORPAY
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Payment = sequelize.define(
  "Payment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // OLD PhonePe/legacy fields - make nullable
    transactionId: {
      type: DataTypes.STRING(100),
      allowNull: true,  // ✅ Changed to nullable
      field: 'transaction_id'
    },
    subscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: true,  // ✅ Changed to nullable
      field: 'subscription_id',
      references: {
        model: 'subscriptions',
        key: 'id'
      }
    },
    weeklyOrderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'weekly_order_id',
      references: {
        model: 'daily_orders',
        key: 'id'
      }
    },
    // NEW Razorpay fields
    razorpayOrderId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      field: 'razorpay_order_id'
    },
    razorpayPaymentId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'razorpay_payment_id'
    },
    razorpaySignature: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'razorpay_signature'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'INR'
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'razorpay',
      field: 'payment_method'
    },
    status: {
      type: DataTypes.ENUM('initiated', 'created', 'completed', 'failed', 'cancelled'),
      defaultValue: 'created'
    },
    orderIds: {
      type: DataTypes.TEXT,
      allowNull: true,  // ✅ For cart orders (JSON array)
      field: 'order_ids',
      comment: 'JSON array of order IDs for cart checkout'
    },
    paymentData: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'payment_data',
      comment: 'JSON data from Razorpay order creation'
    },
    paymentResponse: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'payment_response',
      comment: 'JSON response from payment verification'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    }
  },
  {
    tableName: "payments",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id', 'status']
      },
      {
        fields: ['razorpay_order_id']
      },
      {
        fields: ['razorpay_payment_id']
      },
      {
        fields: ['transaction_id']
      },
      {
        fields: ['subscription_id']
      }
    ]
  }
);

module.exports = Payment;