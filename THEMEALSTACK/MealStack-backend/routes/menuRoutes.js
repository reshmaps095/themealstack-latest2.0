// routes/menuRoutes.js (updated with image upload support)
const express = require('express');
const router = express.Router();
const path = require('path');
const {
  getAllMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  deleteMenuItemImage, // NEW
  getWeeklyMenus,
  createOrUpdateWeeklyMenu,
  getMenuForDay,
  deleteWeeklyMenu,
  getAllMealPricing,
  updateMealPricing,
  getAllWeeklyOrders,
  updateWeeklyOrderStatus,
  getWeeklyMenuForDay,
  getFullWeeklyMenu,
  getMealPricing
} = require('../controllers/menuController');

const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// ===== STATIC FILE SERVING =====
// Serve uploaded images
router.use('/uploads/menu-items', express.static(path.join(__dirname, '../uploads/menu-items')));

// ===== ADMIN ROUTES =====

// Menu Items Management (updated with image support)
router.get('/menu-items', authenticateToken, authorizeRoles('admin'), getAllMenuItems);

// Create menu item with image upload
router.post('/menu-items', 
  authenticateToken, 
  authorizeRoles('admin'), 
  upload, 
  handleUploadError, 
  createMenuItem
);

// Update menu item with optional image upload
router.put('/menu-items/:id', 
  authenticateToken, 
  authorizeRoles('admin'), 
  upload, 
  handleUploadError, 
  updateMenuItem
);

router.delete('/menu-items/:id', authenticateToken, authorizeRoles('admin'), deleteMenuItem);

// NEW: Delete menu item image only
router.delete('/menu-items/:id/image', authenticateToken, authorizeRoles('admin'), deleteMenuItemImage);

// Weekly Menu Management
router.get('/weekly-menus', authenticateToken, authorizeRoles('admin'), getWeeklyMenus);
router.post('/weekly-menus', authenticateToken, authorizeRoles('admin'), createOrUpdateWeeklyMenu);
router.get('/weekly-menus/:dayOfWeek', authenticateToken, authorizeRoles('admin'), getMenuForDay);
router.delete('/weekly-menus/:dayOfWeek', authenticateToken, authorizeRoles('admin'), deleteWeeklyMenu);

// Meal Pricing Management
router.get('/meal-pricing', authenticateToken, authorizeRoles('admin'), getAllMealPricing);
router.put('/meal-pricing/:mealType', authenticateToken, authorizeRoles('admin'), updateMealPricing);

// Weekly Orders Management
router.get('/weekly-orders', authenticateToken, authorizeRoles('admin'), getAllWeeklyOrders);
router.patch('/weekly-orders/:id/status', authenticateToken, authorizeRoles('admin'), updateWeeklyOrderStatus);

// ===== PUBLIC ROUTES =====

// Weekly Menu Information for Users
router.get('/menu/weekly/:dayOfWeek', getWeeklyMenuForDay);
router.get('/menu/weekly', getFullWeeklyMenu);
router.get('/menu/pricing', getMealPricing);

module.exports = router;