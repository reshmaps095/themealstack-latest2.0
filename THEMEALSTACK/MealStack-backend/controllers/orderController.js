// controllers/orderController.js - WITH PROPER ADDRESS STORAGE
const DailyOrder = require('../models/DailyOrder');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Address = require('../models/Address');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

// IMPORT MEAL CAPACITY FUNCTIONS
const { 
  incrementBookedCount, 
  decrementBookedCount, 
  checkCapacityAvailable 
} = require('../controllers/mealCapacityController')

// Generate unique order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

// Validate order date
const validateOrderDate = (orderDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const orderDateObj = new Date(orderDate);
  if (isNaN(orderDateObj.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }
  
  if (orderDateObj < today) {
    return { valid: false, error: 'Cannot place orders for past dates' };
  }
  
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 7);
  if (orderDateObj > maxDate) {
    return { valid: false, error: 'Cannot place orders more than 7 days in advance' };
  }
  
  return { valid: true };
};

// Check order timing restrictions
const checkOrderTiming = (orderDate, mealType) => {
  const now = new Date();
  const orderDateObj = new Date(orderDate);
  
  if (orderDateObj.toDateString() === now.toDateString()) {
    const cutoffHours = {
      breakfast: 6,
      lunch: 10,
      dinner: 16
    };
    
    const cutoffHour = cutoffHours[mealType] || 6;
    
    if (now.getHours() >= cutoffHour) {
      return { 
        allowed: false, 
        error: `Orders for ${mealType} must be placed before ${cutoffHour}:00` 
      };
    }
  }
  
  return { allowed: true };
};

// Create bulk orders from cart - WITH PROPER ADDRESS STORAGE
const createBulkOrders = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { orders } = req.body;
    
    console.log('=== BULK ORDER REQUEST ===');
    console.log('User ID:', req.user?.id);
    console.log('Number of orders:', orders?.length);
    
    if (!req.user || !req.user.id) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    const userId = req.user.id;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Orders array is required and cannot be empty'
      });
    }

    // ✅ Collect and validate ALL unique address IDs
    const addressIds = [...new Set(orders.map(o => o.deliveryAddressId).filter(Boolean))];
    const numericAddressIds = addressIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
    
    if (numericAddressIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'At least one valid delivery address is required'
      });
    }

    // ✅ Fetch ALL address records with full details
    const addresses = await Address.findAll({
      where: { 
        id: { [Op.in]: numericAddressIds },
        userId,
        isActive: true,
        isVerified: true  // Only verified addresses
      },
      transaction
    });

    if (addresses.length !== numericAddressIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'One or more delivery addresses are invalid, inactive, or not verified'
      });
    }

    // ✅ Create address lookup map
    const addressMap = {};
    addresses.forEach(addr => {
      addressMap[addr.id] = {
        id: addr.id,
        address: addr.address,
        nearestLocation: addr.nearestLocation || null,
        addressType: addr.addressType
      };
    });

    console.log('Address map created:', Object.keys(addressMap));

    const createdOrders = [];
    const errors = [];

    // Process each order
    for (let i = 0; i < orders.length; i++) {
      const orderData = orders[i];
      const {
        orderDate,
        mealType,
        selectedItems,
        totalAmount,
        deliveryAddressId,
        notes
      } = orderData;

      try {
        // Validate required fields
        if (!orderDate || !mealType || !selectedItems || !Array.isArray(selectedItems)) {
          errors.push(`Order ${i + 1}: Missing required fields`);
          continue;
        }

        const numericDeliveryAddressId = parseInt(deliveryAddressId);
        
        if (!numericDeliveryAddressId || isNaN(numericDeliveryAddressId) || !addressMap[numericDeliveryAddressId]) {
          errors.push(`Order ${i + 1}: Invalid delivery address`);
          continue;
        }

        if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
          errors.push(`Order ${i + 1}: Invalid meal type`);
          continue;
        }

        if (selectedItems.length === 0) {
          errors.push(`Order ${i + 1}: No items selected`);
          continue;
        }

        // Validate order date
        const dateValidation = validateOrderDate(orderDate);
        if (!dateValidation.valid) {
          errors.push(`Order ${i + 1}: ${dateValidation.error}`);
          continue;
        }

        // Check timing restrictions
        const timingCheck = checkOrderTiming(orderDate, mealType);
        if (!timingCheck.allowed) {
          errors.push(`Order ${i + 1}: ${timingCheck.error}`);
          continue;
        }

        // CHECK MEAL CAPACITY AVAILABILITY
        const hasCapacity = await checkCapacityAvailable(orderDate, mealType, 1);
        if (!hasCapacity) {
          errors.push(`${mealType} is fully booked for ${orderDate}`);
          continue;
        }

        // Validate menu items
        const menuItemIds = selectedItems.map(item => parseInt(item.menuItemId));
        const menuItems = await MenuItem.findAll({
          where: {
            id: { [Op.in]: menuItemIds },
            isActive: true
          },
          transaction
        });

        if (menuItems.length !== menuItemIds.length) {
          errors.push(`Order ${i + 1}: Some menu items are no longer available`);
          continue;
        }

        // Validate quantities
        for (const item of selectedItems) {
          if (!item.quantity || parseInt(item.quantity) <= 0) {
            throw new Error(`Invalid quantity for item ${item.menuItemId}`);
          }
        }

        // Separate special and regular items
        const specialItems = selectedItems.filter(item => item.isSpecialItem === true);
        const regularItems = selectedItems.filter(item => item.isSpecialItem !== true);

        // ✅ Get full address details from map
        const orderAddress = addressMap[numericDeliveryAddressId];
        
        console.log(`Order ${i + 1} - Using address:`, {
          id: orderAddress.id,
          text: orderAddress.address,
          nearestLocation: orderAddress.nearestLocation
        });

        // ✅ Create order with ACTUAL address text and nearest location
        const order = await DailyOrder.create({
          userId,
          orderNumber: generateOrderNumber(),
          orderDate,
          mealType,
          selectedItems: regularItems.map(item => ({
            menuItemId: parseInt(item.menuItemId),
            quantity: parseInt(item.quantity),
            name: item.name || '',
            price: parseFloat(item.price)
          })),
          specialItems: specialItems.map(item => ({
            menuItemId: parseInt(item.menuItemId),
            quantity: parseInt(item.quantity),
            name: item.name || '',
            price: parseFloat(item.price)
          })),
          totalAmount: parseFloat(totalAmount),
          deliveryAddress: orderAddress.address,      // ✅ Actual address text
          nearestLocation: orderAddress.nearestLocation, // ✅ Actual nearest location
          addressId: orderAddress.id,                 // ✅ Store ID for reference
          status: 'pending',
          paymentStatus: 'pending',
          notes: notes ? notes.trim().substring(0, 500) : null
        }, { transaction });

        // INCREMENT BOOKED COUNT AFTER SUCCESSFUL ORDER
        await incrementBookedCount(orderDate, mealType, 1);

        createdOrders.push(order);
        console.log(`✓ Order ${i + 1} created with ID:`, order.id);

      } catch (itemError) {
        console.error(`Error processing order ${i + 1}:`, itemError);
        errors.push(`Order ${i + 1}: ${itemError.message}`);
      }
    }

    if (createdOrders.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Failed to create orders',
        errors
      });
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `${createdOrders.length} order(s) created successfully`,
      data: { 
        orders: createdOrders,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Create bulk orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create orders',
      error: error.message
    });
  }
};

// Create single order - WITH PROPER ADDRESS STORAGE
const createOrder = async (req, res) => {
  try {
    const {
      orderDate,
      mealType,
      selectedItems,
      totalAmount,
      deliveryAddressId,
      notes
    } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const userId = req.user.id;

    if (!orderDate || !mealType || !selectedItems || !deliveryAddressId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid meal type'
      });
    }

    const dateValidation = validateOrderDate(orderDate);
    if (!dateValidation.valid) {
      return res.status(400).json({
        success: false,
        message: dateValidation.error
      });
    }

    const timingCheck = checkOrderTiming(orderDate, mealType);
    if (!timingCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: timingCheck.error
      });
    }

    // CHECK MEAL CAPACITY
    const hasCapacity = await checkCapacityAvailable(orderDate, mealType, 1);
    if (!hasCapacity) {
      return res.status(400).json({
        success: false,
        message: `${mealType} is fully booked for ${orderDate}. Please select a different date or meal.`
      });
    }

    // ✅ Fetch full address record
    const address = await Address.findOne({
      where: { 
        id: parseInt(deliveryAddressId), 
        userId,
        isActive: true,
        isVerified: true
      }
    });

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Invalid, inactive, or unverified delivery address'
      });
    }

    const menuItemIds = selectedItems.map(item => parseInt(item.menuItemId));
    const menuItems = await MenuItem.findAll({
      where: {
        id: { [Op.in]: menuItemIds },
        isActive: true
      }
    });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some menu items are no longer available'
      });
    }

    const specialItems = selectedItems.filter(item => item.isSpecialItem === true);
    const regularItems = selectedItems.filter(item => item.isSpecialItem !== true);

    // ✅ Create order with actual address text and nearest location
    const order = await DailyOrder.create({
      userId,
      orderNumber: generateOrderNumber(),
      orderDate,
      mealType,
      selectedItems: regularItems.map(item => ({
        menuItemId: parseInt(item.menuItemId),
        quantity: parseInt(item.quantity),
        name: item.name || '',
        price: parseFloat(item.price)
      })),
      specialItems: specialItems.map(item => ({
        menuItemId: parseInt(item.menuItemId),
        quantity: parseInt(item.quantity),
        name: item.name || '',
        price: parseFloat(item.price)
      })),
      totalAmount: parseFloat(totalAmount),
      deliveryAddress: address.address,           // ✅ Actual address text
      nearestLocation: address.nearestLocation,   // ✅ Actual nearest location
      addressId: address.id,                      // ✅ Store ID for reference
      status: 'pending',
      paymentStatus: 'pending',
      notes: notes ? notes.trim().substring(0, 500) : null
    });

    // INCREMENT BOOKED COUNT
    await incrementBookedCount(orderDate, mealType, 1);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order'
    });
  }
};

// Cancel order - WITH CAPACITY DECREMENT
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const userId = req.user.id;

    const order = await DailyOrder.findOne({
      where: { id: parseInt(id), userId }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status '${order.status}'`
      });
    }

    const orderDate = new Date(order.orderDate);
    const now = new Date();
    
    if (orderDate.toDateString() === now.toDateString()) {
      const cutoffHours = {
        breakfast: 6,
        lunch: 10,
        dinner: 16
      };
      
      const cutoffHour = cutoffHours[order.mealType];
      
      if (now.getHours() >= cutoffHour) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel ${order.mealType} order after ${cutoffHour}:00 on the same day`
        });
      }
    }

    const updatedNotes = reason 
      ? `${order.notes || ''}\n--- CANCELLED ---\nReason: ${reason.trim().substring(0, 200)}`
      : `${order.notes || ''}\n--- CANCELLED ---`;

    await order.update({
      status: 'cancelled',
      notes: updatedNotes.trim()
    });

    // DECREMENT BOOKED COUNT AFTER CANCELLATION
    await decrementBookedCount(order.orderDate, order.mealType, 1);

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order'
    });
  }
};

// Get order history
const getOrderHistory = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const { page = 1, limit = 10, status, mealType, fromDate, toDate } = req.query;
    const userId = req.user.id;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = { userId };

    if (status) {
      const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
      if (validStatuses.includes(status)) {
        whereClause.status = status;
      }
    }
    
    if (mealType) {
      const validMealTypes = ['breakfast', 'lunch', 'dinner'];
      if (validMealTypes.includes(mealType)) {
        whereClause.mealType = mealType;
      }
    }
    
    if (fromDate) {
      whereClause.orderDate = { [Op.gte]: fromDate };
    }
    
    if (toDate) {
      whereClause.orderDate = whereClause.orderDate 
        ? { ...whereClause.orderDate, [Op.lte]: toDate }
        : { [Op.lte]: toDate };
    }

    const { count, rows } = await DailyOrder.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset,
      order: [['orderDate', 'DESC'], ['createdAt', 'DESC']]
    });

    const totalPages = Math.ceil(count / limitNum);

    res.status(200).json({
      success: true,
      data: {
        orders: rows,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount: count,
          pageSize: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get order history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order history'
    });
  }
};

// Get single order
const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const userId = req.user.id;

    const order = await DailyOrder.findOne({
      where: { id: parseInt(id), userId }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { order }
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    });
  }
};

// Get orders for specific date
const getOrdersForDate = async (req, res) => {
  try {
    const { date } = req.params;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const userId = req.user.id;

    const orders = await DailyOrder.findAll({
      where: {
        userId,
        orderDate: date
      },
      order: [['mealType', 'ASC'], ['createdAt', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: { orders }
    });

  } catch (error) {
    console.error('Get orders for date error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
};

// Get today's orders
const getTodaysOrders = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const orders = await DailyOrder.findAll({
      where: {
        userId,
        orderDate: today
      },
      order: [['mealType', 'ASC'], ['createdAt', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: { orders }
    });

  } catch (error) {
    console.error('Get today\'s orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s orders'
    });
  }
};

module.exports = {
  createBulkOrders,
  createOrder,
  getOrderHistory,
  getOrder,
  cancelOrder,
  getOrdersForDate,
  getTodaysOrders
};