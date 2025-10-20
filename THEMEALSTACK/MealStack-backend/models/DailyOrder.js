// models/DailyOrder.js - UPDATED WITH ADDRESS_ID
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DailyOrder = sequelize.define('DailyOrder', {
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
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'order_number'
  },
  orderDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'order_date'
  },
  mealType: {
    type: DataTypes.ENUM('breakfast', 'lunch', 'dinner'),
    allowNull: false,
    field: 'meal_type'
  },
  selectedItems: {
    type: DataTypes.JSON,
    allowNull: false,
    field: 'selected_items',
    defaultValue: []
  },
  specialItems: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'special_items',
    defaultValue: []
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_amount',
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  deliveryAddress: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'delivery_address'
  },
  nearestLocation: {
    type: DataTypes.STRING(100),
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
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']]
    }
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    defaultValue: 'pending',
    field: 'payment_status'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'daily_orders',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['order_date']
    },
    {
      fields: ['status']
    },
    {
      fields: ['payment_status']
    },
    {
      fields: ['nearest_location']
    },
    {
      fields: ['address_id']  // ✅ NEW INDEX
    },
    {
      fields: ['order_number'],
      unique: true
    }
  ]
});

module.exports = DailyOrder;