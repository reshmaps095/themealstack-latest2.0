// routes/orders.js (Fixed version)
const express = require('express');
const router = express.Router();
const {
  createBulkOrders,
  createOrder,
  getOrderHistory,
  getOrder,
  cancelOrder,
  getOrdersForDate,
  getTodaysOrders
} = require('../controllers/orderController');

const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/bulk', createBulkOrders);
router.post('/', createOrder);
router.get('/', getOrderHistory);
router.get('/today', getTodaysOrders);
router.get('/date/:date', getOrdersForDate);
router.get('/:id', getOrder);
router.patch('/:id/cancel', cancelOrder);

module.exports = router;

