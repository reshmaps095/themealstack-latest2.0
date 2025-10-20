// models/Subscription.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Subscription = sequelize.define(
  "Subscription",
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
    orderNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'order_number'
    },
    packageType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'package_type'
    },
    packageTitle: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'package_title'
    },
    priceAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'price_amount'
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'start_date'
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'end_date'
    },
    deliveryAddress: {
      type: DataTypes.ENUM('home', 'office'),
      allowNull: false,
      field: 'delivery_address'
    },
    specialInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'special_instructions'
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'payment_method'
    },
    status: {
      type: DataTypes.ENUM('pending_payment', 'active', 'paused', 'cancelled', 'completed', 'payment_failed'),
      defaultValue: 'pending_payment'
    },
    activatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'activated_at'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  },
  {
    tableName: "subscriptions",
    underscored: true
  }
);

module.exports = Subscription;