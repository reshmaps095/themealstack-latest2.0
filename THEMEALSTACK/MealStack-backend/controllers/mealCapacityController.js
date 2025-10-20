// controllers/admin/mealCapacityController.js
const MealCapacity = require('../models/MealCapacity');
const DailyOrder = require('../models/DailyOrder');
const { Op } = require('sequelize');

// @desc    Get meal capacity for next 7 days
// @route   GET /api/admin/meal-capacity/next-7-days
// @access  Private/Admin
// @desc    Get meal capacity for next 7 days
// @route   GET /api/admin/meal-capacity/next-7-days
// @access  Private/Admin
const getNext7DaysCapacity = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 6);

    // Generate date strings for the next 7 days
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Use findOrCreate for each date to avoid duplicates
    const capacities = await Promise.all(
      dates.map(async (dateStr) => {
        const date = new Date(dateStr);
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        const [capacity, created] = await MealCapacity.findOrCreate({
          where: { date: dateStr },
          defaults: {
            dayOfWeek,
            breakfastCapacity: 50,
            lunchCapacity: 50,
            dinnerCapacity: 50,
            breakfastBooked: 0,
            lunchBooked: 0,
            dinnerBooked: 0
          }
        });
        
        return capacity;
      })
    );

    // Calculate remaining for each
    const capacitiesWithRemaining = capacities.map(cap => ({
      ...cap.toJSON(),
      breakfastRemaining: cap.breakfastCapacity - cap.breakfastBooked,
      lunchRemaining: cap.lunchCapacity - cap.lunchBooked,
      dinnerRemaining: cap.dinnerCapacity - cap.dinnerBooked
    }));

    res.status(200).json({
      success: true,
      data: { capacities: capacitiesWithRemaining }
    });

  } catch (error) {
    console.error('Get next 7 days capacity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meal capacities'
    });
  }
};

// @desc    Get meal capacity for specific date
// @route   GET /api/admin/meal-capacity/date/:date
// @access  Private/Admin
const getCapacityForDate = async (req, res) => {
  try {
    const { date } = req.params;

    let capacity = await MealCapacity.findOne({
      where: { date }
    });

    if (!capacity) {
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      capacity = await MealCapacity.create({
        date,
        dayOfWeek,
        breakfastCapacity: 50,
        lunchCapacity: 50,
        dinnerCapacity: 50,
        breakfastBooked: 0,
        lunchBooked: 0,
        dinnerBooked: 0
      });
    }

    const capacityData = {
      ...capacity.toJSON(),
      breakfastRemaining: capacity.breakfastCapacity - capacity.breakfastBooked,
      lunchRemaining: capacity.lunchCapacity - capacity.lunchBooked,
      dinnerRemaining: capacity.dinnerCapacity - capacity.dinnerBooked
    };

    res.status(200).json({
      success: true,
      data: { capacity: capacityData }
    });

  } catch (error) {
    console.error('Get capacity for date error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch capacity'
    });
  }
};

// @desc    Create or update meal capacity
// @route   POST /api/admin/meal-capacity
// @access  Private/Admin
const createOrUpdateCapacity = async (req, res) => {
  try {
    const { date, breakfastCapacity, lunchCapacity, dinnerCapacity } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    let capacity = await MealCapacity.findOne({
      where: { date }
    });

    if (capacity) {
      // Check if new capacities are less than booked
      if (breakfastCapacity < capacity.breakfastBooked) {
        return res.status(400).json({
          success: false,
          message: `Breakfast capacity cannot be less than booked slots (${capacity.breakfastBooked})`
        });
      }
      if (lunchCapacity < capacity.lunchBooked) {
        return res.status(400).json({
          success: false,
          message: `Lunch capacity cannot be less than booked slots (${capacity.lunchBooked})`
        });
      }
      if (dinnerCapacity < capacity.dinnerBooked) {
        return res.status(400).json({
          success: false,
          message: `Dinner capacity cannot be less than booked slots (${capacity.dinnerBooked})`
        });
      }

      await capacity.update({
        breakfastCapacity: breakfastCapacity || capacity.breakfastCapacity,
        lunchCapacity: lunchCapacity || capacity.lunchCapacity,
        dinnerCapacity: dinnerCapacity || capacity.dinnerCapacity
      });
    } else {
      capacity = await MealCapacity.create({
        date,
        dayOfWeek,
        breakfastCapacity: breakfastCapacity || 50,
        lunchCapacity: lunchCapacity || 50,
        dinnerCapacity: dinnerCapacity || 50,
        breakfastBooked: 0,
        lunchBooked: 0,
        dinnerBooked: 0
      });
    }

    const capacityData = {
      ...capacity.toJSON(),
      breakfastRemaining: capacity.breakfastCapacity - capacity.breakfastBooked,
      lunchRemaining: capacity.lunchCapacity - capacity.lunchBooked,
      dinnerRemaining: capacity.dinnerCapacity - capacity.dinnerBooked
    };

    res.status(200).json({
      success: true,
      message: 'Meal capacity saved successfully',
      data: { capacity: capacityData }
    });

  } catch (error) {
    console.error('Create/update capacity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save capacity'
    });
  }
};

// @desc    Update meal capacity by ID
// @route   PUT /api/admin/meal-capacity/:id
// @access  Private/Admin
const updateCapacity = async (req, res) => {
  try {
    const { id } = req.params;
    const { breakfastCapacity, lunchCapacity, dinnerCapacity } = req.body;

    const capacity = await MealCapacity.findByPk(id);

    if (!capacity) {
      return res.status(404).json({
        success: false,
        message: 'Meal capacity not found'
      });
    }

    // Validate against booked slots
    if (breakfastCapacity < capacity.breakfastBooked) {
      return res.status(400).json({
        success: false,
        message: `Breakfast capacity cannot be less than booked slots (${capacity.breakfastBooked})`
      });
    }
    if (lunchCapacity < capacity.lunchBooked) {
      return res.status(400).json({
        success: false,
        message: `Lunch capacity cannot be less than booked slots (${capacity.lunchBooked})`
      });
    }
    if (dinnerCapacity < capacity.dinnerBooked) {
      return res.status(400).json({
        success: false,
        message: `Dinner capacity cannot be less than booked slots (${capacity.dinnerBooked})`
      });
    }

    await capacity.update({
      breakfastCapacity,
      lunchCapacity,
      dinnerCapacity
    });

    const capacityData = {
      ...capacity.toJSON(),
      breakfastRemaining: capacity.breakfastCapacity - capacity.breakfastBooked,
      lunchRemaining: capacity.lunchCapacity - capacity.lunchBooked,
      dinnerRemaining: capacity.dinnerCapacity - capacity.dinnerBooked
    };

    res.status(200).json({
      success: true,
      message: 'Meal capacity updated successfully',
      data: { capacity: capacityData }
    });

  } catch (error) {
    console.error('Update capacity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update capacity'
    });
  }
};

// @desc    Bulk set capacity for next 7 days
// @route   POST /api/admin/meal-capacity/bulk-set
// @access  Private/Admin
const bulkSetCapacity = async (req, res) => {
  try {
    const { breakfastCapacity, lunchCapacity, dinnerCapacity } = req.body;

    if (!breakfastCapacity || !lunchCapacity || !dinnerCapacity) {
      return res.status(400).json({
        success: false,
        message: 'All meal capacities are required'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const capacities = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      let capacity = await MealCapacity.findOne({
        where: { date: dateStr }
      });

      if (capacity) {
        // Only update if new capacity is >= booked
        if (breakfastCapacity >= capacity.breakfastBooked &&
            lunchCapacity >= capacity.lunchBooked &&
            dinnerCapacity >= capacity.dinnerBooked) {
          await capacity.update({
            breakfastCapacity,
            lunchCapacity,
            dinnerCapacity
          });
        }
      } else {
        capacity = await MealCapacity.create({
          date: dateStr,
          dayOfWeek,
          breakfastCapacity,
          lunchCapacity,
          dinnerCapacity,
          breakfastBooked: 0,
          lunchBooked: 0,
          dinnerBooked: 0
        });
      }

      capacities.push(capacity);
    }

    res.status(200).json({
      success: true,
      message: 'Bulk capacity set successfully',
      data: { capacities }
    });

  } catch (error) {
    console.error('Bulk set capacity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set bulk capacity'
    });
  }
};

// @desc    Increment booked count when order is placed (internal use)
// @route   Internal function
const incrementBookedCount = async (orderDate, mealType, quantity = 1) => {
  try {
    let capacity = await MealCapacity.findOne({
      where: { date: orderDate }
    });

    if (!capacity) {
      const dateObj = new Date(orderDate);
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      capacity = await MealCapacity.create({
        date: orderDate,
        dayOfWeek,
        breakfastCapacity: 50,
        lunchCapacity: 50,
        dinnerCapacity: 50,
        breakfastBooked: 0,
        lunchBooked: 0,
        dinnerBooked: 0
      });
    }

    const field = `${mealType}Booked`;
    const capacityField = `${mealType}Capacity`;
    
    const newBooked = capacity[field] + quantity;
    
    if (newBooked > capacity[capacityField]) {
      throw new Error(`${mealType} is fully booked for ${orderDate}`);
    }

    await capacity.update({
      [field]: newBooked
    });

    return capacity;
  } catch (error) {
    console.error('Increment booked count error:', error);
    throw error;
  }
};

// @desc    Decrement booked count when order is cancelled (internal use)
// @route   Internal function
const decrementBookedCount = async (orderDate, mealType, quantity = 1) => {
  try {
    const capacity = await MealCapacity.findOne({
      where: { date: orderDate }
    });

    if (!capacity) {
      return;
    }

    const field = `${mealType}Booked`;
    const newBooked = Math.max(0, capacity[field] - quantity);

    await capacity.update({
      [field]: newBooked
    });

    return capacity;
  } catch (error) {
    console.error('Decrement booked count error:', error);
    throw error;
  }
};

// @desc    Check if capacity is available
// @route   Internal function
const checkCapacityAvailable = async (orderDate, mealType, quantity = 1) => {
  try {
    let capacity = await MealCapacity.findOne({
      where: { date: orderDate }
    });

    if (!capacity) {
      // No capacity record means unlimited
      return true;
    }

    const bookedField = `${mealType}Booked`;
    const capacityField = `${mealType}Capacity`;
    
    const remaining = capacity[capacityField] - capacity[bookedField];
    
    return remaining >= quantity;
  } catch (error) {
    console.error('Check capacity available error:', error);
    return false;
  }
};

module.exports = {
  getNext7DaysCapacity,
  getCapacityForDate,
  createOrUpdateCapacity,
  updateCapacity,
  bulkSetCapacity,
  incrementBookedCount,
  decrementBookedCount,
  checkCapacityAvailable
};