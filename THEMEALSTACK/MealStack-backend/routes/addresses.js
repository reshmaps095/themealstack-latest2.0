// routes/addresses.js (WITH AUTHENTICATION)
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress
} = require('../controllers/addressController');

// All routes require authentication
router.use(authenticateToken);

router.get('/', getAddresses);
router.get('/default', getDefaultAddress);
router.get('/:id', getAddress);
router.post('/', createAddress);
router.put('/:id', updateAddress);
router.delete('/:id', deleteAddress);
router.patch('/:id/default', setDefaultAddress);

module.exports = router;