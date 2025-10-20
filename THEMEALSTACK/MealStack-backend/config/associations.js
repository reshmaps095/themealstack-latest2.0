// config/associations.js - UPDATED
const User = require('../models/User');
const Address = require('../models/Address');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const MenuItem = require('../models/MenuItem');
const WeeklyMenu = require('../models/WeeklyMenu');
const MealPricing = require('../models/MealPricing');
const Cart = require('../models/cart');
const DailyOrder = require('../models/DailyOrder');
const Order = require('../models/Order'); // ADD THIS

const setupAssociations = () => {
  // User associations
  User.hasMany(Address, {
    foreignKey: 'user_id',
    as: 'addresses',
    onDelete: 'CASCADE'
  });

  User.hasMany(Subscription, {
    foreignKey: 'user_id',
    as: 'subscriptions',
    onDelete: 'CASCADE'
  });

  User.hasMany(Payment, {
    foreignKey: 'user_id',
    as: 'payments',
    onDelete: 'CASCADE'
  });

  User.hasMany(DailyOrder, {
    foreignKey: 'user_id',
    as: 'dailyOrders',
    onDelete: 'CASCADE'
  });

  User.hasMany(Cart, {
    foreignKey: 'user_id',
    as: 'cartItems',
    onDelete: 'CASCADE'
  });

  // NEW: Order associations
  User.hasMany(Order, {
    foreignKey: 'user_id',
    as: 'orders',
    onDelete: 'CASCADE'
  });

  Order.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  Order.belongsTo(Address, {
    foreignKey: 'address_id',
    as: 'address'  // Changed from 'deliveryAddress' to 'address'
  });

  Address.hasMany(Order, {
    foreignKey: 'address_id',
    as: 'orders'
  });

  // DailyOrder associations
  DailyOrder.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'User'
  });

  DailyOrder.hasMany(Payment, {
    foreignKey: 'weekly_order_id',
    as: 'payments',
    onDelete: 'CASCADE'
  });

  // Address associations
  Address.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  Address.hasMany(Cart, {
    foreignKey: 'address_id',
    as: 'cartItems'
  });

  // Cart associations
  Cart.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  Cart.belongsTo(MenuItem, {
    foreignKey: 'menu_item_id',
    as: 'menuItem'
  });

  Cart.belongsTo(Address, {
    foreignKey: 'address_id',
    as: 'deliveryAddress',
    constraints: false
  });

  // MenuItem associations
  MenuItem.hasMany(Cart, {
    foreignKey: 'menu_item_id',
    as: 'cartItems',
    onDelete: 'CASCADE'
  });

  // Subscription associations
  Subscription.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  Subscription.hasMany(Payment, {
    foreignKey: 'subscription_id',
    as: 'payments',
    onDelete: 'CASCADE'
  });

  // Payment associations
  Payment.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'User'
  });

  Payment.belongsTo(Subscription, {
    foreignKey: 'subscription_id',
    as: 'Subscription'
  });

  Payment.belongsTo(DailyOrder, {
    foreignKey: 'weekly_order_id',
    as: 'WeeklyOrder'
  });

  console.log('Model associations have been set up successfully');
};

module.exports = { setupAssociations };