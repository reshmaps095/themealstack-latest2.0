// models/WeeklyMenu.js (NEW MODEL for day-based system)
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WeeklyMenu = sequelize.define('WeeklyMenu', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  dayOfWeek: {
    type: DataTypes.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
    allowNull: false,
    unique: true,
    field: 'day_of_week',
    validate: {
      isIn: [['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']]
    }
  },
  breakfastItems: {
    type: DataTypes.JSON,
    allowNull: false,
    field: 'breakfast_items',
    defaultValue: [],
    comment: 'Array of menu item IDs for breakfast'
  },
  lunchItems: {
    type: DataTypes.JSON,
    allowNull: false,
    field: 'lunch_items',
    defaultValue: [],
    comment: 'Array of menu item IDs for lunch'
  },
  dinnerItems: {
    type: DataTypes.JSON,
    allowNull: false,
    field: 'dinner_items',
    defaultValue: [],
    comment: 'Array of menu item IDs for dinner'
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
  tableName: 'weekly_menus',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['day_of_week'],
      unique: true
    },
    {
      fields: ['is_active']
    }
  ]
});

module.exports = WeeklyMenu;