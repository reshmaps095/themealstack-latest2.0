const express = require('express');
const { 
  login, 
  register, 
  getProfile, 
  logout, 
  updateAddress,
  createOrUpdateAddress,
  getUserAddresses,
  deleteAddress ,
  updateProfile,
  forgotPassword,
  resetPassword,
  verifyResetToken
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/register', register);

router.post('/forgot-password', forgotPassword);           // Add this
router.post('/reset-password', resetPassword);             // Add this
router.get('/verify-reset-token/:token', verifyResetToken); // Add this


// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile); // Add this route
router.post('/logout', authenticateToken, logout);

// Address routes (Legacy and new)
router.put('/updateaddress', authenticateToken, updateAddress); // Legacy route
router.post('/address', authenticateToken, createOrUpdateAddress); // New route
router.get('/addresses', authenticateToken, getUserAddresses);
router.delete('/address/:id', authenticateToken, deleteAddress);

module.exports = router;