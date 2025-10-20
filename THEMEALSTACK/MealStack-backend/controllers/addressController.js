// controllers/addressController.js (WITH AUTHENTICATION)
const Address = require('../models/Address');
const { Op } = require('sequelize');

// Get all addresses for logged-in user
const getAddresses = async (req, res) => {
  try {
    // Get userId from authenticated user
    const userId = req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const addresses = await Address.findAll({
      where: { 
        userId,  // Filter by logged-in user
        isActive: true
      },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: { addresses }
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch addresses'
    });
  }
};

// Create new address
const createAddress = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { addressType, address, nearestLocation, locationUrl, isDefault } = req.body;

    // Validation
    if (!addressType || !address) {
      return res.status(400).json({
        success: false,
        message: 'Address type and address are required'
      });
    }

    if (!['home', 'office'].includes(addressType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address type. Must be home or office'
      });
    }

    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 10 || trimmedAddress.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Address must be between 10 and 500 characters'
      });
    }

    // Check if user already has an address of this type
    const existingAddress = await Address.findOne({
      where: {
        userId,  // Check for current user only
        addressType,
        isActive: true
      }
    });

    if (existingAddress) {
      return res.status(400).json({
        success: false,
        message: `A ${addressType} address already exists. Please update the existing one or delete it first.`
      });
    }

    // If this is set as default, remove default from other addresses
    if (isDefault) {
      await Address.update(
        { isDefault: false },
        { where: { userId, isActive: true } }
      );
    }

    // If this is the first address, make it default
    const addressCount = await Address.count({
      where: { userId, isActive: true }
    });

    const shouldBeDefault = isDefault || addressCount === 0;

    const newAddress = await Address.create({
      userId,  // Use authenticated user's ID
      addressType,
      address: trimmedAddress,
      nearestLocation: nearestLocation || null,
      locationUrl: locationUrl ? locationUrl.trim() : null,
      isDefault: shouldBeDefault,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: { address: newAddress }
    });
  } catch (error) {
    console.error('Create address error:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'An address of this type already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create address'
    });
  }
};

// Update existing address
const updateAddress = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { id } = req.params;
    const { addressType, address, nearestLocation, locationUrl, isDefault } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid address ID is required'
      });
    }

    // Find address that belongs to current user
    const existingAddress = await Address.findOne({
      where: { 
        id: parseInt(id),
        userId  // Only allow updating own addresses
      }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Validation
    if (addressType && !['home', 'office'].includes(addressType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address type. Must be home or office'
      });
    }

    if (address) {
      const trimmedAddress = address.trim();
      if (trimmedAddress.length < 10 || trimmedAddress.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Address must be between 10 and 500 characters'
        });
      }
    }

    // If setting as default, remove default from other addresses
    if (isDefault === true) {
      await Address.update(
        { isDefault: false },
        { where: { userId, id: { [Op.ne]: parseInt(id) } } }
      );
    }

    // Build update object
    const updates = {};
    if (addressType !== undefined) updates.addressType = addressType;
    if (address !== undefined) updates.address = address.trim();
    if (locationUrl !== undefined) updates.locationUrl = locationUrl ? locationUrl.trim() : null;
    if (isDefault !== undefined) updates.isDefault = Boolean(isDefault);
    if (nearestLocation !== undefined) updates.nearestLocation = nearestLocation;

    await existingAddress.update(updates);

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: { address: existingAddress }
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update address'
    });
  }
};

// Delete address
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid address ID is required'
      });
    }

    const address = await Address.findOne({
      where: { 
        id: parseInt(id),
        userId  // Only allow deleting own addresses
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // If deleting the default address, set another address as default
    if (address.isDefault) {
      const otherAddress = await Address.findOne({
        where: {
          userId,
          isActive: true,
          id: { [Op.ne]: parseInt(id) }
        },
        order: [['createdAt', 'DESC']]
      });

      if (otherAddress) {
        await otherAddress.update({ isDefault: true });
      }
    }

    // Soft delete
    await address.update({ isActive: false });

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete address'
    });
  }
};

// Set default address
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid address ID is required'
      });
    }

    const address = await Address.findOne({
      where: { 
        id: parseInt(id), 
        userId,  // Only allow setting own addresses as default
        isActive: true 
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Remove default from all other addresses
    await Address.update(
      { isDefault: false },
      { where: { userId, id: { [Op.ne]: parseInt(id) } } }
    );

    // Set this address as default
    await address.update({ isDefault: true });

    res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      data: { address }
    });
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default address'
    });
  }
};

// Get address by ID
const getAddress = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { id } = req.params;
    
    const address = await Address.findOne({
      where: { 
        id: parseInt(id),
        userId,  // Only allow viewing own addresses
        isActive: true
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { address }
    });
  } catch (error) {
    console.error('Get address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch address'
    });
  }
};

// Get default address
const getDefaultAddress = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const defaultAddress = await Address.findOne({
      where: {
        userId,  // Only get current user's default address
        isDefault: true,
        isActive: true
      }
    });

    res.status(200).json({
      success: true,
      data: { address: defaultAddress }
    });
  } catch (error) {
    console.error('Get default address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch default address'
    });
  }
};

module.exports = {
  getAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress
};