// models/Order.js - UPDATED WITH ADDRESS_ID

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
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
  orderNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    field: 'order_number'
  },
  orderDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'order_date'
  },
  dayOfWeek: {
    type: DataTypes.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
    allowNull: true,
    field: 'day_of_week'
  },
  mealType: {
    type: DataTypes.ENUM('breakfast', 'lunch', 'dinner'),
    allowNull: false,
    field: 'meal_type'
  },
  selectedItems: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'selected_items',
    get() {
      const rawValue = this.getDataValue('selectedItems');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('selectedItems', JSON.stringify(value));
    }
  },
  specialItems: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'special_items',
    get() {
      const rawValue = this.getDataValue('specialItems');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('specialItems', JSON.stringify(value));
    }
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_amount'
  },
  deliveryAddress: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'delivery_address'
  },
  nearestLocation: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'nearest_location'
  },
  // ✅ NEW FIELD: Store address ID for reference
  addressId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'address_id',
    references: {
      model: 'addresses',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'),
    defaultValue: 'pending'
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    defaultValue: 'pending',
    field: 'payment_status'
  },
  paymentId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'payment_id'
  },
  razorpayOrderId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'razorpay_order_id'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cancellationReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'cancellation_reason'
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cancelled_at'
  }
}, {
  tableName: 'orders',
  underscored: true,
  timestamps: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['order_number']
    },
    {
      fields: ['order_date']
    },
    {
      fields: ['status']
    },
    {
      fields: ['payment_status']
    }
  ]
});

module.exports = Order;