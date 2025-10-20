const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'first_name',
      validate: {
        notEmpty: { msg: "First name is required" },
        len: {
          args: [2, 50],
          msg: "First name must be between 2 and 50 characters",
        },
      },
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'last_name',
      validate: {
        notEmpty: { msg: "Last name is required" },
        len: {
          args: [2, 50],
          msg: "Last name must be between 2 and 50 characters",
        },
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: "Email is required" },
        isEmail: { msg: "Please provide a valid email address" },
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Phone number is required" },
        len: { args: [10], msg: "Phone number must be 10 digits" },
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Password is required" },
        len: {
          args: [6, 255],
          msg: "Password must be at least 6 characters long",
        },
      },
    },
    resetPasswordToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'reset_password_token'
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reset_password_expires'
    },
    // // Keep legacy address fields for backward compatibility
    // home_address: DataTypes.TEXT,
    // home_locationUrl: DataTypes.STRING,
    // office_address: DataTypes.TEXT,
    // office_locationUrl: DataTypes.STRING,
    // nearestLocation: DataTypes.STRING,
    // addressType: {
    //   type: DataTypes.ENUM("home", "office"),
    //   allowNull: true,
    //   field: 'address_type'
    // },
    role: {
      type: DataTypes.ENUM("admin", "user", "accountant"),
      defaultValue: "user",
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_verified'
    },
    verificationStatus: {
      type: DataTypes.ENUM("pending", "under_review", "verified", "rejected"),
      defaultValue: "pending",
      field: 'verification_status'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login'
    },
    companyName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'company_name'
    },
  },
  {
    tableName: "users",
    underscored: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

// Instance methods
User.prototype.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values;
};

// Define associations
// User.associate = (models) => {
//   User.hasMany(models.Address, {
//     foreignKey: 'user_id',
//     as: 'addresses',
//     onDelete: 'CASCADE'
//   });
// };

module.exports = User;