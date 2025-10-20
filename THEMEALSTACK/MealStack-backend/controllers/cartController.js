// controllers/cartController.js (WITH DELIVERY CHARGE)
const Cart = require('../models/cart');
const MenuItem = require('../models/MenuItem');
const Address = require('../models/Address');
const { Op } = require('sequelize');

// Constants
const DELIVERY_CHARGE = 5.00; // ₹5 per delivery group

// @desc    Get user's cart with address details and delivery charges
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('User ID:', req.user?.id);
    
    const cartItems = await Cart.findAll({
      where: { userId },
      include: [
        {
          model: MenuItem,
          as: 'menuItem',
          attributes: ['id', 'name', 'type', 'description', 'imageUrl', 'imageFilename']
        },
        {
          model: Address,
          as: 'deliveryAddress',
          attributes: ['id', 'addressType', 'address', 'nearestLocation'],
          required: false
        }
      ],
      order: [
        ['orderDate', 'ASC'],
        ['mealType', 'ASC']
      ]
    });

    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const itemsSubtotal = cartItems.reduce((sum, item) => 
      sum + (parseFloat(item.price) * item.quantity), 0
    );

    const deliveryGroups = groupCartItemsByDelivery(cartItems);
    const totalDeliveryCharges = deliveryGroups.length * DELIVERY_CHARGE;
    const totalAmount = itemsSubtotal + totalDeliveryCharges;

    res.status(200).json({
      success: true,
      data: {
        cartItems,
        summary: {
          totalItems,
          itemsSubtotal: parseFloat(itemsSubtotal.toFixed(2)),
          deliveryCharges: parseFloat(totalDeliveryCharges.toFixed(2)),
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          totalOrders: deliveryGroups.length,
          deliveryChargePerOrder: DELIVERY_CHARGE
        },
        deliveryGroups
      }
    });

  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart'
    });
  }
};

// @desc    Add item to cart with address
// @route   POST /api/cart
// @access  Private
const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      menuItemId,
      orderDate,
      dayOfWeek,
      mealType,
      quantity = 1,
      dayDisplayName,
      addressId
    } = req.body;

    if (!menuItemId || !orderDate || !dayOfWeek || !mealType) {
      return res.status(400).json({
        success: false,
        message: 'Menu item, order date, day of week, and meal type are required'
      });
    }

    // Validate address if provided
    if (addressId) {
      const address = await Address.findOne({
        where: { id: addressId, userId, isActive: true }
      });

      if (!address) {
        return res.status(400).json({
          success: false,
          message: 'Invalid address selected'
        });
      }
    }

    const orderDateObj = new Date(orderDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (orderDateObj < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add items for past dates'
      });
    }

    const menuItem = await MenuItem.findByPk(menuItemId);
    if (!menuItem || !menuItem.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found or inactive'
      });
    }

    let cartItem = await Cart.findOne({
      where: {
        userId,
        menuItemId,
        orderDate,
        mealType,
        addressId: addressId || null
      }
    });

    if (cartItem) {
      cartItem.quantity += quantity;
      await cartItem.save();
    } else {
      cartItem = await Cart.create({
        userId,
        menuItemId,
        orderDate,
        dayOfWeek: dayOfWeek.toLowerCase(),
        mealType: mealType.toLowerCase(),
        quantity,
        price: menuItem.price,
        isSpecialItem: menuItem.isSpecialItem,
        itemName: menuItem.name,
        dayDisplayName,
        addressId: addressId || null
      });
    }

    const updatedCartItem = await Cart.findByPk(cartItem.id, {
      include: [
        { model: MenuItem, as: 'menuItem' },
        { model: Address, as: 'deliveryAddress', required: false }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: { cartItem: updatedCartItem }
    });

  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart'
    });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/:id
// @access  Private
const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const cartItem = await Cart.findOne({
      where: { id, userId }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    cartItem.quantity = quantity;
    await cartItem.save();

    const updatedCartItem = await Cart.findByPk(cartItem.id, {
      include: [
        { model: MenuItem, as: 'menuItem' },
        { model: Address, as: 'deliveryAddress', required: false }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: { cartItem: updatedCartItem }
    });

  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart item'
    });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:id
// @access  Private
const removeCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const cartItem = await Cart.findOne({
      where: { id, userId }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    await cartItem.destroy();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart'
    });

  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove cart item'
    });
  }
};

// @desc    Clear entire cart
// @route   DELETE /api/cart/clear/all
// @access  Private
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    await Cart.destroy({
      where: { userId }
    });

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully'
    });

  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart'
    });
  }
};

// @desc    Clear cart items for specific date
// @route   DELETE /api/cart/clear/date/:orderDate
// @access  Private
const clearCartByDate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderDate } = req.params;

    await Cart.destroy({
      where: {
        userId,
        orderDate
      }
    });

    res.status(200).json({
      success: true,
      message: 'Cart items cleared for selected date'
    });

  } catch (error) {
    console.error('Clear cart by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart items'
    });
  }
};

// @desc    Clear expired cart items
// @route   DELETE /api/cart/clear/expired
// @access  Private
const clearExpiredCartItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deleted = await Cart.destroy({
      where: {
        userId,
        orderDate: {
          [Op.lt]: today
        }
      }
    });

    res.status(200).json({
      success: true,
      message: `${deleted} expired cart items removed`
    });

  } catch (error) {
    console.error('Clear expired cart items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear expired items'
    });
  }
};

// @desc    Update cart item address
// @route   PATCH /api/cart/:id/address
// @access  Private
const updateCartItemAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { addressId } = req.body;

    const cartItem = await Cart.findOne({
      where: { id, userId }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    // Validate address
    if (addressId) {
      const address = await Address.findOne({
        where: { id: addressId, userId, isActive: true }
      });

      if (!address) {
        return res.status(400).json({
          success: false,
          message: 'Invalid address selected'
        });
      }
    }

    await cartItem.update({ addressId: addressId || null });

    const updatedCartItem = await Cart.findByPk(cartItem.id, {
      include: [
        { model: MenuItem, as: 'menuItem' },
        { model: Address, as: 'deliveryAddress', required: false }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Delivery address updated',
      data: { cartItem: updatedCartItem }
    });

  } catch (error) {
    console.error('Update cart address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery address'
    });
  }
};

// Helper function - includes delivery charge in each group
const groupCartItemsByDelivery = (cartItems) => {
  const groups = {};
  
  cartItems.forEach(item => {
    const key = `${item.orderDate}-${item.mealType}-${item.addressId || 'no-address'}`;
    
    if (!groups[key]) {
      groups[key] = {
        orderDate: item.orderDate,
        dayOfWeek: item.dayOfWeek,
        mealType: item.mealType,
        dayDisplayName: item.dayDisplayName,
        addressId: item.addressId,
        deliveryAddress: item.deliveryAddress || null,
        items: [],
        itemsSubtotal: 0,
        deliveryCharge: DELIVERY_CHARGE,
        totalAmount: 0,
        deliveryTimeSlot: getDeliveryTimeSlot(item.mealType)
      };
    }
    
    groups[key].items.push(item);
    groups[key].itemsSubtotal += parseFloat(item.price) * item.quantity;
  });
  
  return Object.values(groups).map(group => ({
    ...group,
    itemsSubtotal: parseFloat(group.itemsSubtotal.toFixed(2)),
    totalAmount: parseFloat((group.itemsSubtotal + group.deliveryCharge).toFixed(2))
  }));
};

const getDeliveryTimeSlot = (mealType) => {
  const timeSlots = {
    breakfast: '7:00 AM - 10:00 AM',
    lunch: '12:00 PM - 2:00 PM',
    dinner: '7:00 PM - 10:00 PM'
  };
  return timeSlots[mealType] || '';
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  clearCartByDate,
  clearExpiredCartItems,
  updateCartItemAddress
};