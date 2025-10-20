const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MealPricing = sequelize.define('MealPricing', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  mealType: {
    type: DataTypes.ENUM('breakfast', 'lunch', 'dinner'),
    allowNull: false,
    unique: true,
    field: 'meal_type',
    validate: {
      isIn: [['breakfast', 'lunch', 'dinner']]
    }
  },
  basePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'base_price',
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  specialItemSurcharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'special_item_surcharge',
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
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
  tableName: 'meal_pricing',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['meal_type'],
      unique: true
    }
  ]
});

module.exports = MealPricing;