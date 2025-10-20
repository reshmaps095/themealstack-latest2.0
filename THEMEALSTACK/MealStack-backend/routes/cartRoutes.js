// routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  clearCartByDate,
  clearExpiredCartItems,
    updateCartItemAddress  // NEW

} = require('../controllers/cartController');

// All cart routes require authentication
router.use(authenticateToken);

// Get user's cart
router.get('/', getCart);

// Add item to cart
router.post('/', addToCart);

// Update cart item quantity
router.put('/:id', updateCartItem);
router.patch('/:id/address', updateCartItemAddress);  // NEW ROUTE


// Remove item from cart
router.delete('/:id', removeCartItem);

// Clear entire cart
router.delete('/clear/all', clearCart);

// Clear cart items for specific date
router.delete('/clear/date/:orderDate', clearCartByDate);

// Clear expired cart items
router.delete('/clear/expired', clearExpiredCartItems);

module.exports = router;