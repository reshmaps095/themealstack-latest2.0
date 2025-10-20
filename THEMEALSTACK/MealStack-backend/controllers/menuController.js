// controllers/menuController.js (COMPLETE VERSION)
const MenuItem = require('../models/MenuItem');
const WeeklyMenu = require('../models/WeeklyMenu');
const MealPricing = require('../models/MealPricing');
const WeeklyOrder = require('../models/DailyOrder');
const User = require('../models/User');
const { Op } = require('sequelize');

// Import upload helpers only if the middleware exists
let deleteImageFile, getImageUrl;
try {
  const uploadHelpers = require('../middleware/upload');
  deleteImageFile = uploadHelpers.deleteImageFile;
  getImageUrl = uploadHelpers.getImageUrl;
} catch (error) {
  console.warn('Upload middleware not found, image features will be disabled');
  deleteImageFile = () => {};
  getImageUrl = () => null;
}

// ===== MENU ITEMS MANAGEMENT =====
const getAllMenuItems = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      type = '',
      isSpecialItem = '',
      isActive = 'true',
      search = '',
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = {};
    
    if (type) whereClause.type = type;
    if (isSpecialItem !== '') whereClause.isSpecialItem = isSpecialItem === 'true';
    if (isActive !== '') whereClause.isActive = isActive === 'true';
    
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await MenuItem.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()]]
    });

    // Add full image URLs to response
    const menuItemsWithImages = rows.map(item => {
      const itemData = item.toJSON();
      if (itemData.imageFilename && getImageUrl) {
        itemData.imageUrl = getImageUrl(req, itemData.imageFilename);
      }
      return itemData;
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        menuItems: menuItemsWithImages,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount: count,
          pageSize: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get menu items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu items'
    });
  }
};

const createMenuItem = async (req, res) => {
  try {
    const { name, type, price, isSpecialItem = false, description = '' } = req.body;

    if (!name || !type || price === undefined || price === null) {
      // Clean up uploaded file if validation fails
      if (req.file && deleteImageFile) {
        deleteImageFile(req.file.filename);
      }
      return res.status(400).json({
        success: false,
        message: 'Name, type, and price are required'
      });
    }

    const validTypes = ['breakfast', 'lunch', 'dinner'];
    if (!validTypes.includes(type)) {
      if (req.file && deleteImageFile) {
        deleteImageFile(req.file.filename);
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid meal type. Must be breakfast, lunch, or dinner'
      });
    }

    if (parseFloat(price) < 0) {
      if (req.file && deleteImageFile) {
        deleteImageFile(req.file.filename);
      }
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
    }

    const existingItem = await MenuItem.findOne({
      where: {
        name: name.trim(),
        type: type
      }
    });

    if (existingItem) {
      if (req.file && deleteImageFile) {
        deleteImageFile(req.file.filename);
      }
      return res.status(400).json({
        success: false,
        message: `Menu item "${name}" already exists for ${type}`
      });
    }

    // Prepare menu item data
    const menuItemData = {
      name: name.trim(),
      type,
      price: parseFloat(price),
      isSpecialItem,
      description: description.trim(),
      isActive: true
    };

    // Add image data if uploaded
    if (req.file && getImageUrl) {
      menuItemData.imageFilename = req.file.filename;
      // Store relative path instead of full URL to avoid validation issues
      menuItemData.imageUrl = `/uploads/menu-items/${req.file.filename}`;
    }

    const menuItem = await MenuItem.create(menuItemData);

    // Return item with full image URL
    const responseData = menuItem.toJSON();
    if (responseData.imageFilename && getImageUrl) {
      responseData.imageUrl = getImageUrl(req, responseData.imageFilename);
    }

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: { menuItem: responseData }
    });

  } catch (error) {
    // Clean up uploaded file if error occurs
    if (req.file && deleteImageFile) {
      deleteImageFile(req.file.filename);
    }
    console.error('Create menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create menu item'
    });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, price, isSpecialItem, description, isActive } = req.body;

    const menuItem = await MenuItem.findByPk(id);
    
    if (!menuItem) {
      if (req.file && deleteImageFile) {
        deleteImageFile(req.file.filename);
      }
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    if (type) {
      const validTypes = ['breakfast', 'lunch', 'dinner'];
      if (!validTypes.includes(type)) {
        if (req.file && deleteImageFile) {
          deleteImageFile(req.file.filename);
        }
        return res.status(400).json({
          success: false,
          message: 'Invalid meal type. Must be breakfast, lunch, or dinner'
        });
      }
    }

    if (price !== undefined && parseFloat(price) < 0) {
      if (req.file && deleteImageFile) {
        deleteImageFile(req.file.filename);
      }
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type;
    if (price !== undefined) updates.price = parseFloat(price);
    if (isSpecialItem !== undefined) updates.isSpecialItem = isSpecialItem;
    if (description !== undefined) updates.description = description.trim();
    if (isActive !== undefined) updates.isActive = isActive;

    // Handle image update
    if (req.file && deleteImageFile && getImageUrl) {
      // Delete old image if it exists
      if (menuItem.imageFilename) {
        deleteImageFile(menuItem.imageFilename);
      }
      
      updates.imageFilename = req.file.filename;
      updates.imageUrl = getImageUrl(req, req.file.filename);
    }

    await menuItem.update(updates);

    // Return updated item with full image URL
    const responseData = menuItem.toJSON();
    if (responseData.imageFilename && getImageUrl) {
      responseData.imageUrl = getImageUrl(req, responseData.imageFilename);
    }

    res.status(200).json({
      success: true,
      message: 'Menu item updated successfully',
      data: { menuItem: responseData }
    });

  } catch (error) {
    if (req.file && deleteImageFile) {
      deleteImageFile(req.file.filename);
    }
    console.error('Update menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update menu item'
    });
  }
};

const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await MenuItem.findByPk(id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    // Delete associated image file
    if (menuItem.imageFilename && deleteImageFile) {
      deleteImageFile(menuItem.imageFilename);
    }

    await menuItem.destroy();

    res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully'
    });

  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete menu item'
    });
  }
};

// Additional endpoint to delete menu item image only
const deleteMenuItemImage = async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await MenuItem.findByPk(id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    if (!menuItem.imageFilename) {
      return res.status(400).json({
        success: false,
        message: 'No image to delete'
      });
    }

    // Delete image file
    if (deleteImageFile) {
      deleteImageFile(menuItem.imageFilename);
    }

    // Update database to remove image references
    await menuItem.update({
      imageFilename: null,
      imageUrl: null
    });

    res.status(200).json({
      success: true,
      message: 'Menu item image deleted successfully'
    });

  } catch (error) {
    console.error('Delete menu item image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete menu item image'
    });
  }
};

// ===== WEEKLY MENU MANAGEMENT =====
const getWeeklyMenus = async (req, res) => {
  try {
    const { isActive = 'true' } = req.query;
    
    let whereClause = {};
    if (isActive !== '') whereClause.isActive = isActive === 'true';

    const weeklyMenus = await WeeklyMenu.findAll({
      where: whereClause,
      order: [['dayOfWeek', 'ASC']]
    });

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const menusMap = {};
    
    weeklyMenus.forEach(menu => {
      menusMap[menu.dayOfWeek] = menu;
    });

    const fullWeekMenus = days.map(day => {
      return menusMap[day] || {
        dayOfWeek: day,
        breakfastItems: [],
        lunchItems: [],
        dinnerItems: [],
        isActive: true,
        id: null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        weeklyMenus: fullWeekMenus
      }
    });

  } catch (error) {
    console.error('Get weekly menus error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly menus'
    });
  }
};

const createOrUpdateWeeklyMenu = async (req, res) => {
  try {
    const { dayOfWeek, breakfastItems, lunchItems, dinnerItems } = req.body;

    if (!dayOfWeek) {
      return res.status(400).json({
        success: false,
        message: 'Day of week is required'
      });
    }

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(dayOfWeek.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid day of week'
      });
    }

    if (!Array.isArray(breakfastItems) || !Array.isArray(lunchItems) || !Array.isArray(dinnerItems)) {
      return res.status(400).json({
        success: false,
        message: 'Menu items must be arrays'
      });
    }

    const allItemIds = [...breakfastItems, ...lunchItems, ...dinnerItems];
    if (allItemIds.length > 0) {
      const existingItems = await MenuItem.findAll({
        where: { id: { [Op.in]: allItemIds } },
        attributes: ['id']
      });

      const existingIds = existingItems.map(item => item.id);
      const missingIds = allItemIds.filter(id => !existingIds.includes(id));
      
      if (missingIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid menu item IDs: ${missingIds.join(', ')}`
        });
      }
    }

    let weeklyMenu = await WeeklyMenu.findOne({ 
      where: { dayOfWeek: dayOfWeek.toLowerCase() } 
    });

    if (weeklyMenu) {
      await weeklyMenu.update({
        breakfastItems,
        lunchItems,
        dinnerItems,
        isActive: true
      });
      
      res.status(200).json({
        success: true,
        message: `${dayOfWeek} menu updated successfully`,
        data: { weeklyMenu }
      });
    } else {
      weeklyMenu = await WeeklyMenu.create({
        dayOfWeek: dayOfWeek.toLowerCase(),
        breakfastItems,
        lunchItems,
        dinnerItems,
        isActive: true
      });

      res.status(201).json({
        success: true,
        message: `${dayOfWeek} menu created successfully`,
        data: { weeklyMenu }
      });
    }

  } catch (error) {
    console.error('Create/update weekly menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create/update weekly menu'
    });
  }
};

const getMenuForDay = async (req, res) => {
  try {
    const { dayOfWeek } = req.params;

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(dayOfWeek.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid day of week'
      });
    }

    const weeklyMenu = await WeeklyMenu.findOne({
      where: { 
        dayOfWeek: dayOfWeek.toLowerCase(),
        isActive: true 
      }
    });

    if (!weeklyMenu) {
      return res.status(404).json({
        success: false,
        message: `No menu found for ${dayOfWeek}`
      });
    }

    res.status(200).json({
      success: true,
      data: { weeklyMenu }
    });

  } catch (error) {
    console.error('Get menu for day error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu for day'
    });
  }
};

const deleteWeeklyMenu = async (req, res) => {
  try {
    const { dayOfWeek } = req.params;

    const weeklyMenu = await WeeklyMenu.findOne({
      where: { dayOfWeek: dayOfWeek.toLowerCase() }
    });
    
    if (!weeklyMenu) {
      return res.status(404).json({
        success: false,
        message: 'Menu not found for this day'
      });
    }

    await weeklyMenu.destroy();

    res.status(200).json({
      success: true,
      message: `${dayOfWeek} menu deleted successfully`
    });

  } catch (error) {
    console.error('Delete weekly menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete weekly menu'
    });
  }
};

// ===== MEAL PRICING MANAGEMENT =====
const getAllMealPricing = async (req, res) => {
  try {
    const pricing = await MealPricing.findAll({
      order: [['mealType', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: { pricing }
    });

  } catch (error) {
    console.error('Get meal pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meal pricing'
    });
  }
};

const updateMealPricing = async (req, res) => {
  try {
    const { mealType } = req.params;
    const { basePrice, specialItemSurcharge } = req.body;

    const validTypes = ['breakfast', 'lunch', 'dinner'];
    if (!validTypes.includes(mealType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid meal type. Must be breakfast, lunch, or dinner'
      });
    }

    if (basePrice === undefined || basePrice === null) {
      return res.status(400).json({
        success: false,
        message: 'Base price is required'
      });
    }

    if (parseFloat(basePrice) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Base price must be a positive number'
      });
    }

    const surcharge = specialItemSurcharge !== undefined ? parseFloat(specialItemSurcharge) : 0;
    if (surcharge < 0) {
      return res.status(400).json({
        success: false,
        message: 'Special item surcharge must be a positive number'
      });
    }

    let pricing = await MealPricing.findOne({ where: { mealType } });
    
    if (!pricing) {
      pricing = await MealPricing.create({
        mealType,
        basePrice: parseFloat(basePrice),
        specialItemSurcharge: surcharge,
        isActive: true
      });
    } else {
      await pricing.update({
        basePrice: parseFloat(basePrice),
        specialItemSurcharge: surcharge
      });
    }

    res.status(200).json({
      success: true,
      message: 'Meal pricing updated successfully',
      data: { pricing }
    });

  } catch (error) {
    console.error('Update meal pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update meal pricing'
    });
  }
};

// ===== WEEKLY ORDERS MANAGEMENT =====
const getAllWeeklyOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status = '',
      paymentStatus = '',
      subscriptionType = '',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = {};
    
    if (status) whereClause.status = status;
    if (paymentStatus) whereClause.paymentStatus = paymentStatus;
    if (subscriptionType) whereClause.subscriptionType = subscriptionType;
    
    if (search) {
      whereClause[Op.or] = [
        { orderNumber: { [Op.like]: `%${search}%` } },
        { '$User.firstName$': { [Op.like]: `%${search}%` } },
        { '$User.lastName$': { [Op.like]: `%${search}%` } },
        { '$User.email$': { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await WeeklyOrder.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['firstName', 'lastName', 'email', 'phone']
        }
      ],
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()]]
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        orders: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount: count,
          pageSize: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get weekly orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly orders'
    });
  }
};

const updateWeeklyOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'paused', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active, paused, cancelled, or completed'
      });
    }

    const order = await WeeklyOrder.findByPk(id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    await order.update({ status });

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
};

// ===== PUBLIC ENDPOINTS =====
const getWeeklyMenuForDay = async (req, res) => {
  try {
    const { dayOfWeek } = req.params;

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(dayOfWeek.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid day of week'
      });
    }

    const weeklyMenu = await WeeklyMenu.findOne({
      where: { 
        dayOfWeek: dayOfWeek.toLowerCase(),
        isActive: true
      }
    });

    if (!weeklyMenu) {
      return res.status(404).json({
        success: false,
        message: `No menu available for ${dayOfWeek}`
      });
    }

    const allItemIds = [
      ...weeklyMenu.breakfastItems,
      ...weeklyMenu.lunchItems,
      ...weeklyMenu.dinnerItems
    ];

    const menuItems = await MenuItem.findAll({
      where: { 
        id: { [Op.in]: allItemIds },
        isActive: true
      }
    });

    const itemsMap = menuItems.reduce((map, item) => {
      map[item.id] = item;
      return map;
    }, {});

    const formattedMenu = {
      dayOfWeek: weeklyMenu.dayOfWeek,
      breakfast: weeklyMenu.breakfastItems.map(id => itemsMap[id]).filter(Boolean),
      lunch: weeklyMenu.lunchItems.map(id => itemsMap[id]).filter(Boolean),
      dinner: weeklyMenu.dinnerItems.map(id => itemsMap[id]).filter(Boolean)
    };

    res.status(200).json({
      success: true,
      data: { menu: formattedMenu }
    });

  } catch (error) {
    console.error('Get weekly menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly menu'
    });
  }
};

const getFullWeeklyMenu = async (req, res) => {
  try {
    const weeklyMenus = await WeeklyMenu.findAll({
      where: { isActive: true },
      order: [['dayOfWeek', 'ASC']]
    });

    const allItemIds = new Set();
    weeklyMenus.forEach(menu => {
      [...menu.breakfastItems, ...menu.lunchItems, ...menu.dinnerItems].forEach(id => allItemIds.add(id));
    });

    const menuItems = await MenuItem.findAll({
      where: { 
        id: { [Op.in]: Array.from(allItemIds) },
        isActive: true
      }
    });

    const itemsMap = menuItems.reduce((map, item) => {
      map[item.id] = item;
      return map;
    }, {});

    const formattedMenus = weeklyMenus.map(menu => ({
      dayOfWeek: menu.dayOfWeek,
      breakfast: menu.breakfastItems.map(id => itemsMap[id]).filter(Boolean),
      lunch: menu.lunchItems.map(id => itemsMap[id]).filter(Boolean),
      dinner: menu.dinnerItems.map(id => itemsMap[id]).filter(Boolean)
    }));

    res.status(200).json({
      success: true,
      data: { weeklyMenus: formattedMenus }
    });

  } catch (error) {
    console.error('Get full weekly menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly menu'
    });
  }
};

const getMealPricing = async (req, res) => {
  try {
    const pricing = await MealPricing.findAll({
      where: { isActive: true },
      order: [['mealType', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: { pricing }
    });

  } catch (error) {
    console.error('Get meal pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meal pricing'
    });
  }
};

module.exports = {
  // Menu Items
  getAllMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  deleteMenuItemImage,
  
  // Weekly Menus
  getWeeklyMenus,
  createOrUpdateWeeklyMenu,
  getMenuForDay,
  deleteWeeklyMenu,
  
  // Meal Pricing
  getAllMealPricing,
  updateMealPricing,
  
  // Weekly Orders
  getAllWeeklyOrders,
  updateWeeklyOrderStatus,
  
  // Public endpoints
  getWeeklyMenuForDay,
  getFullWeeklyMenu,
  getMealPricing
};