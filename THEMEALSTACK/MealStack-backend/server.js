// server.js - CLEANED UP VERSION
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import database
const { sequelize } = require('./config/database');

// Import models
const User = require('./models/User');
const Address = require('./models/Address');
const Subscription = require('./models/Subscription');
const Payment = require('./models/Payment');
const Order = require('./models/Order');
const MealCapacity = require('./models/MealCapacity');

// Import and set up associations
const { setupAssociations } = require('./config/associations');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const subscriptionRoutes = require('./routes/subscription');
const menuRoutes = require('./routes/menuRoutes');
const addressRoutes = require('./routes/addresses');
const orderRoutes = require('./routes/orders');
const cartRoutes = require('./routes/cartRoutes');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging for development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`📍 ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
    next();
  });
}

// Health check route (BEFORE other routes)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api', menuRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payments', paymentRoutes);

console.log('✅ All routes registered');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error'
  });
});

// 404 handler (MUST BE LAST)
app.use('*', (req, res) => {
  console.log('❌ 404 Route not found:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Database connection and server start
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');

    // Set up model associations
    setupAssociations();

    // Sync database (use alter: true ONCE to update tables)
    await sequelize.sync({ 
      force: false,
      alter: true  // Change to false after first run
    });
    console.log('✅ Database models synced successfully');

    app.listen(PORT, () => {
      console.log('=================================');
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`💳 Payment API: http://localhost:${PORT}/api/payments`);
      console.log('=================================');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

startServer();