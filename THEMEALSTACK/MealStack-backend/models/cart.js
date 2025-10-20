// models/Cart.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Cart = sequelize.define('Cart', {
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
  menuItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'menu_item_id',
    references: {
      model: 'menu_items',
      key: 'id'
    }
  },
  orderDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'order_date'
  },
  dayOfWeek: {
    type: DataTypes.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
    allowNull: false,
    field: 'day_of_week'
  },
  mealType: {
    type: DataTypes.ENUM('breakfast', 'lunch', 'dinner'),
    allowNull: false,
    field: 'meal_type'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  isSpecialItem: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_special_item'
  },
  itemName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'item_name'
  },
  dayDisplayName: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'day_display_name'
  },
  addressId: {
    type: DataTypes.INTEGER,
    allowNull: true,  // Allow null for backward compatibility
    field: 'address_id',
    references: {
      model: 'addresses',
      key: 'id'
    }
  }
}, {
  tableName: 'cart_items',
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'menu_item_id', 'order_date', 'meal_type']
    },
    {
      fields: ['user_id', 'order_date']
    }
  ]
});

module.exports = Cart;