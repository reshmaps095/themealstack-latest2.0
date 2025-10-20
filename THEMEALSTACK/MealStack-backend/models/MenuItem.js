// models/MenuItem.js (updated with image field)
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MenuItem = sequelize.define('MenuItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  type: {
    type: DataTypes.ENUM('breakfast', 'lunch', 'dinner'),
    allowNull: false,
    validate: {
      isIn: [['breakfast', 'lunch', 'dinner']]
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  isSpecialItem: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_special_item'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // NEW: Image field
  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'image_url'
    // REMOVED: validate isUrl to fix the validation error
  },
  // NEW: Original filename for reference
  imageFilename: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'image_filename'
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
  tableName: 'menu_items',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['type']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['is_special_item']
    }
  ]
});

module.exports = MenuItem;