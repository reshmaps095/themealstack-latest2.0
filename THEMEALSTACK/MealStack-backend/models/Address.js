const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Address = sequelize.define(
  "Address",
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
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    addressType: {
      type: DataTypes.ENUM("home", "office"),
      allowNull: false,
      field: 'address_type'
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Address is required" },
        len: {
          args: [10, 500],
          msg: "Address must be between 10 and 500 characters",
        },
      },
    },
    nearestLocation: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'nearest_location'
    },
    locationUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'location_url',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_default'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_verified',
      comment: 'Whether this address has been verified by admin'
    },
    verificationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'verification_reason',
      comment: 'Reason for rejection if address is not verified'
    }
  },
  {
    tableName: "addresses",
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'address_type']
      }
    ]
  }
);

module.exports = Address;