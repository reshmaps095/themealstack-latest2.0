// models/MealCapacity.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MealCapacity = sequelize.define('MealCapacity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    unique: true
  },
  dayOfWeek: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'day_of_week'  // Explicitly set the database column name
  },
  breakfastCapacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 50,
    field: 'breakfast_capacity'
  },
  lunchCapacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 50,
    field: 'lunch_capacity'
  },
  dinnerCapacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 50,
    field: 'dinner_capacity'
  },
  breakfastBooked: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'breakfast_booked'
  },
  lunchBooked: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'lunch_booked'
  },
  dinnerBooked: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'dinner_booked'
  }
}, {
  tableName: 'meal_capacities',
  timestamps: true,
  underscored: true,  // This tells Sequelize to use snake_case for all columns
  indexes: [
    {
      unique: true,
      fields: ['date']
    },
    {
      fields: ['date', 'day_of_week']  // Use snake_case in index definition
    }
  ]
});

module.exports = MealCapacity;