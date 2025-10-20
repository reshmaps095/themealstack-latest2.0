// controllers/adminController.js - Complete Admin Controller
const DailyOrder = require('../models/DailyOrder');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const ExcelJS = require('exceljs');

// Get all orders with advanced filtering
const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      paymentStatus,
      mealType,
      dateFilter,
      userName,
      nearestLocation,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = {};

    if (search) {
      whereClause.orderNumber = {
        [Op.like]: `%${search}%`
      };
    }

    if (paymentStatus) {
      whereClause.paymentStatus = paymentStatus;
    }

    if (mealType) {
      whereClause.mealType = mealType;
    }

    if (nearestLocation) {
      whereClause.nearestLocation = nearestLocation;
    }

    // Date filters
    if (dateFilter) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      switch (dateFilter) {
        case 'today':
          whereClause.orderDate = today.toISOString().split('T')[0];
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          whereClause.orderDate = yesterday.toISOString().split('T')[0];
          break;
        case 'last7days':
          const last7days = new Date(today);
          last7days.setDate(last7days.getDate() - 7);
          whereClause.orderDate = {
            [Op.gte]: last7days.toISOString().split('T')[0],
            [Op.lte]: today.toISOString().split('T')[0]
          };
          break;
        case 'last30days':
          const last30days = new Date(today);
          last30days.setDate(last30days.getDate() - 30);
          whereClause.orderDate = {
            [Op.gte]: last30days.toISOString().split('T')[0],
            [Op.lte]: today.toISOString().split('T')[0]
          };
          break;
        case 'thisMonth':
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
          whereClause.orderDate = {
            [Op.gte]: firstDay.toISOString().split('T')[0],
            [Op.lte]: today.toISOString().split('T')[0]
          };
          break;
      }
    }

    if (startDate && endDate) {
      whereClause.orderDate = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.orderDate = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.orderDate = {
        [Op.lte]: endDate
      };
    }

    let userWhereClause = {};
    if (userName) {
      userWhereClause = {
        [Op.or]: [
          { firstName: { [Op.like]: `%${userName}%` } },
          { lastName: { [Op.like]: `%${userName}%` } },
          sequelize.where(
            sequelize.fn('CONCAT', sequelize.col('User.firstName'), ' ', sequelize.col('User.lastName')),
            { [Op.like]: `%${userName}%` }
          )
        ]
      };
    }

    const { count, rows } = await DailyOrder.findAndCountAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'User',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
        where: Object.keys(userWhereClause).length > 0 ? userWhereClause : undefined,
        required: Object.keys(userWhereClause).length > 0
      }],
      limit: limitNum,
      offset,
      order: [[sortBy, sortOrder]],
      distinct: true,
      subQuery: false
    });

    // Format the response to ensure all fields are included
    const formattedOrders = rows.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      orderDate: order.orderDate,
      mealType: order.mealType,
      selectedItems: order.selectedItems || [],
      specialItems: order.specialItems || [],
      totalAmount: parseFloat(order.totalAmount),
      deliveryAddress: order.deliveryAddress || 'Not specified',
      nearestLocation: order.nearestLocation || 'Not specified',
      status: order.status,
      paymentStatus: order.paymentStatus,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      User: order.User ? {
        id: order.User.id,
        firstName: order.User.firstName,
        lastName: order.User.lastName,
        email: order.User.email,
        phone: order.User.phone
      } : null
    }));

    const totalPages = Math.ceil(count / limitNum);

    res.status(200).json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount: count,
          pageSize: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// Get single order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await DailyOrder.findByPk(id, {
      include: [{
        model: User,
        as: 'User',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
      }]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Format the response
    const formattedOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      orderDate: order.orderDate,
      mealType: order.mealType,
      selectedItems: order.selectedItems || [],
      specialItems: order.specialItems || [],
      totalAmount: parseFloat(order.totalAmount),
      deliveryAddress: order.deliveryAddress || 'Not specified',
      nearestLocation: order.nearestLocation || 'Not specified',
      status: order.status,
      paymentStatus: order.paymentStatus,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      User: order.User ? {
        id: order.User.id,
        firstName: order.User.firstName,
        lastName: order.User.lastName,
        email: order.User.email,
        phone: order.User.phone
      } : null
    };

    res.status(200).json({
      success: true,
      data: { order: formattedOrder }
    });

  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const order = await DailyOrder.findByPk(id);

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
// Update payment status
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status value'
      });
    }

    const order = await DailyOrder.findByPk(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    await order.update({ paymentStatus });

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status'
    });
  }
};

// Export orders to Excel
const exportOrdersExcel = async (req, res) => {
  try {
    const {
      search,
      paymentStatus,
      mealType,
      dateFilter,
      userName,
      nearestLocation,
      startDate,
      endDate
    } = req.query;

    let whereClause = {};

    if (search) {
      whereClause.orderNumber = { [Op.like]: `%${search}%` };
    }
    if (paymentStatus) {
      whereClause.paymentStatus = paymentStatus;
    }
    if (mealType) {
      whereClause.mealType = mealType;
    }
    if (nearestLocation) {
      whereClause.nearestLocation = nearestLocation;
    }

    // Date filters
    if (dateFilter) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      switch (dateFilter) {
        case 'today':
          whereClause.orderDate = today.toISOString().split('T')[0];
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          whereClause.orderDate = yesterday.toISOString().split('T')[0];
          break;
        case 'last7days':
          const last7days = new Date(today);
          last7days.setDate(last7days.getDate() - 7);
          whereClause.orderDate = {
            [Op.gte]: last7days.toISOString().split('T')[0],
            [Op.lte]: today.toISOString().split('T')[0]
          };
          break;
        case 'last30days':
          const last30days = new Date(today);
          last30days.setDate(last30days.getDate() - 30);
          whereClause.orderDate = {
            [Op.gte]: last30days.toISOString().split('T')[0],
            [Op.lte]: today.toISOString().split('T')[0]
          };
          break;
        case 'thisMonth':
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
          whereClause.orderDate = {
            [Op.gte]: firstDay.toISOString().split('T')[0],
            [Op.lte]: today.toISOString().split('T')[0]
          };
          break;
      }
    }

    if (startDate && endDate) {
      whereClause.orderDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.orderDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.orderDate = { [Op.lte]: endDate };
    }

    let userWhereClause = {};
    if (userName) {
      userWhereClause = {
        [Op.or]: [
          { firstName: { [Op.like]: `%${userName}%` } },
          { lastName: { [Op.like]: `%${userName}%` } }
        ]
      };
    }

    const orders = await DailyOrder.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'User',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
        where: Object.keys(userWhereClause).length > 0 ? userWhereClause : undefined,
        required: Object.keys(userWhereClause).length > 0
      }],
      order: [['orderDate', 'DESC'], ['createdAt', 'DESC']]
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Orders');

    // Define columns
    worksheet.columns = [
      { header: 'Order Number', key: 'orderNumber', width: 20 },
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Order Date', key: 'orderDate', width: 15 },
      { header: 'Meal Type', key: 'mealType', width: 12 },
      { header: 'Total Amount', key: 'totalAmount', width: 15 },
      { header: 'Payment Status', key: 'paymentStatus', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Nearest Location', key: 'nearestLocation', width: 25 },
      { header: 'Delivery Address', key: 'deliveryAddress', width: 40 },
      { header: 'Items', key: 'items', width: 50 },
      { header: 'Special Items', key: 'specialItems', width: 50 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };

    // Add data rows - FIXED
    orders.forEach(order => {
      // Safely handle selectedItems
      let itemsList = '';
      if (Array.isArray(order.selectedItems) && order.selectedItems.length > 0) {
        itemsList = order.selectedItems.map(item => 
          `${item.name || 'Item'} (${item.quantity || 1}x ₹${item.price || 0})`
        ).join(', ');
      }

      // Safely handle specialItems
      let specialItemsList = '';
      if (Array.isArray(order.specialItems) && order.specialItems.length > 0) {
        specialItemsList = order.specialItems.map(item => 
          `${item.name || 'Special Item'} (${item.quantity || 1}x ₹${item.price || 0})`
        ).join(', ');
      }

      worksheet.addRow({
        orderNumber: order.orderNumber,
        customerName: order.User ? `${order.User.firstName} ${order.User.lastName}` : 'N/A',
        email: order.User?.email || 'N/A',
        phone: order.User?.phone || 'N/A',
        orderDate: order.orderDate,
        mealType: order.mealType,
        totalAmount: `₹${order.totalAmount}`,
        paymentStatus: order.paymentStatus,
        status: order.status,
        nearestLocation: order.nearestLocation || 'Not specified',
        deliveryAddress: order.deliveryAddress || 'Not specified',
        items: itemsList,
        specialItems: specialItemsList,
        notes: order.notes || ''
      });
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (!column.width) {
        column.width = 15;
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=orders_export_${new Date().toISOString().split('T')[0]}.xlsx`);

    res.send(buffer);

  } catch (error) {
    console.error('Export orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export orders',
      error: error.message
    });
  }
};


// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Total orders
    const totalOrders = await DailyOrder.count();

    // Today's orders
    const todaysOrders = await DailyOrder.count({
      where: { orderDate: today }
    });

    // Pending orders
    const pendingOrders = await DailyOrder.count({
      where: { status: 'pending' }
    });

    // Total revenue
    const revenueResult = await DailyOrder.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalRevenue']
      ],
      where: { paymentStatus: 'paid' }
    });

    const totalRevenue = parseFloat(revenueResult?.dataValues?.totalRevenue || 0);

    // Today's revenue
    const todaysRevenueResult = await DailyOrder.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'todaysRevenue']
      ],
      where: {
        orderDate: today,
        paymentStatus: 'paid'
      }
    });

    const todaysRevenue = parseFloat(todaysRevenueResult?.dataValues?.todaysRevenue || 0);

    // Total users
    const totalUsers = await User.count();

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        todaysOrders,
        pendingOrders,
        totalRevenue,
        todaysRevenue,
        totalUsers
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 25, search } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = {};

    if (search) {
      whereClause = {
        [Op.or]: [
          { firstName: { [Op.like]: `%${search}%` } },
          { lastName: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } }
        ]
      };
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'role', 'isActive', 'createdAt'],
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']]
    });

    const totalPages = Math.ceil(count / limitNum);

    res.status(200).json({
      success: true,
      data: {
        users: rows,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount: count,
          pageSize: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};



// old

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private (Admin only)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [{
        model: Address,
        as: 'addresses'  // Match the alias from associations
      }],
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
};

// @desc    Update user verification status
// @route   PATCH /api/admin/users/:id/verification
// @access  Private (Admin only)
const updateVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, reason } = req.body;

    const validStatuses = ['pending', 'under_review', 'verified', 'rejected'];
    
    if (!validStatuses.includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status'
      });
    }

    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const oldStatus = user.verificationStatus;

    await user.update({
      verificationStatus,
      isVerified: verificationStatus === 'verified'
    });

    // Send email notifications
    if (oldStatus !== verificationStatus) {
      if (verificationStatus === 'verified') {
        await sendVerificationApprovedEmail(user);
      } else if (verificationStatus === 'rejected') {
        await sendVerificationRejectedEmail(user, reason);
      }
    }

    res.status(200).json({
      success: true,
      message: `User verification status updated to ${verificationStatus}`,
      data: { user }
    });

  } catch (error) {
    console.error('Update verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update verification status'
    });
  }
};


// @desc    Update user active status
// @route   PATCH /api/admin/users/:id/status
// @access  Private (Admin only)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin' && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate admin users'
      });
    }

    await user.update({ isActive });

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
};

// @desc    Get all payments with filtering and pagination
// @route   GET /api/admin/payments
// @access  Private (Admin only)
const getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      paymentMethod = '',
      dateFilter = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = {};
    
    if (status) whereClause.status = status;
    if (paymentMethod) whereClause.paymentMethod = paymentMethod;
    
    // Date filter
    if (dateFilter) {
      const now = new Date();
      let startDate;
      
      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          whereClause.createdAt = { [Op.gte]: startDate };
          break;
        case 'last7days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          whereClause.createdAt = { [Op.gte]: startDate };
          break;
        case 'last30days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
          whereClause.createdAt = { [Op.gte]: startDate };
          break;
      }
    }
    
    if (search) {
      whereClause[Op.or] = [
        { transactionId: { [Op.like]: `%${search}%` } }
      ];
    }

    // Try the query with associations first
    let payments = [];
    let totalCount = 0;

    try {
      const { count, rows } = await Payment.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'User',
            attributes: ['firstName', 'lastName', 'email'],
            required: false
          },
          {
            model: Subscription,
            as: 'Subscription',
            attributes: ['orderNumber', 'packageTitle', 'startDate', 'endDate'],
            required: false
          }
        ],
        limit: parseInt(limit),
        offset: offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        distinct: true
      });

      payments = rows;
      totalCount = count;

    } catch (associationError) {
      console.log('Association query failed, falling back to manual join:', associationError.message);
      
      // Fallback: Get payments without associations and manually add user data
      const { count, rows } = await Payment.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: offset,
        order: [[sortBy, sortOrder.toUpperCase()]]
      });

      totalCount = count;
      payments = rows;

      // Manually fetch user and subscription data for each payment
      for (let payment of payments) {
        try {
          // Get user info
          if (payment.userId) {
            const user = await User.findByPk(payment.userId, {
              attributes: ['firstName', 'lastName', 'email']
            });
            // Add user data to the payment object
            payment.dataValues.User = user;
          }
          
          // Get subscription info
          if (payment.subscriptionId) {
            const subscription = await Subscription.findByPk(payment.subscriptionId, {
              attributes: ['orderNumber', 'packageTitle', 'startDate', 'endDate']
            });
            // Add subscription data to the payment object
            payment.dataValues.Subscription = subscription;
          }
        } catch (fetchError) {
          console.log('Error fetching related data for payment:', payment.id, fetchError.message);
        }
      }
    }

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        payments: payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount: totalCount,
          pageSize: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments'
    });
  }
};

// @desc    Get payment by ID
// @route   GET /api/admin/payments/:id
// @access  Private (Admin only)
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: User,
          as: 'User',  // Must match the alias
          attributes: ['firstName', 'lastName', 'email', 'phone']
        },
        {
          model: Subscription,
          as: 'Subscription',  // Must match the alias
          attributes: ['orderNumber', 'packageTitle', 'startDate', 'endDate', 'deliveryAddress']
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { payment }
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment'
    });
  }
};



// @desc    Refund payment
// @route   POST /api/admin/payments/:id/refund
// @access  Private (Admin only)
const refundPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Admin refund' } = req.body;

    const payment = await Payment.findByPk(id, {
      include: [{
        model: Subscription,
        as: 'Subscription'  // Must match the alias
      }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed payments can be refunded'
      });
    }

    await payment.update({
      status: 'refunded',
      paymentResponse: JSON.stringify({
        refund: true,
        refundReason: reason,
        refundedAt: new Date(),
        refundedBy: req.user.id,
        originalResponse: payment.paymentResponse
      })
    });

    if (payment.Subscription) {
      await payment.Subscription.update({
        status: 'cancelled'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment refunded successfully',
      data: { payment }
    });

  } catch (error) {
    console.error('Refund payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund'
    });
  }
};

// @desc    Export users data
// @route   GET /api/admin/users/export
// @access  Private (Admin only)
const exportUsers = async (req, res) => {
  try {
    const {
      search = '',
      status = '',
      role = '',
      verificationStatus = ''
    } = req.query;

    let whereClause = {};
    
    if (status === 'active') whereClause.isActive = true;
    else if (status === 'inactive') whereClause.isActive = false;
    if (role) whereClause.role = role;
    if (verificationStatus) whereClause.verificationStatus = verificationStatus;
    
    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    let csvContent = 'ID,First Name,Last Name,Email,Phone,Role,Verification Status,Active,Company,Joined Date\n';
    
    users.forEach(user => {
      csvContent += `"${user.id}","${user.firstName}","${user.lastName}","${user.email}","${user.phone}","${user.role}","${user.verificationStatus}","${user.isActive}","${user.companyName || ''}","${new Date(user.createdAt).toISOString()}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export users'
    });
  }
};

// @desc    Export payments data
// @route   GET /api/admin/payments/export
// @access  Private (Admin only)
const exportPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      include: [
        {
          model: User,
          as: 'User',  // Must match the alias
          attributes: ['firstName', 'lastName', 'email']
        },
        {
          model: Subscription,
          as: 'Subscription',  // Must match the alias
          attributes: ['orderNumber', 'packageTitle', 'startDate', 'endDate']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    let csvContent = 'Transaction ID,Customer Name,Email,Amount,Payment Method,Status,Package,Order Number,Date,Completed Date\n';
    
    payments.forEach(payment => {
      const customerName = payment.User ? `${payment.User.firstName} ${payment.User.lastName}` : 'N/A';
      const email = payment.User ? payment.User.email : 'N/A';
      const packageTitle = payment.Subscription ? payment.Subscription.packageTitle : 'N/A';
      const orderNumber = payment.Subscription ? payment.Subscription.orderNumber : 'N/A';
      const completedDate = payment.completedAt ? new Date(payment.completedAt).toISOString() : 'N/A';
      
      csvContent += `"${payment.transactionId}","${customerName}","${email}","${payment.amount}","${payment.paymentMethod}","${payment.status}","${packageTitle}","${orderNumber}","${new Date(payment.createdAt).toISOString()}","${completedDate}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payments_export_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export payments'
    });
  }
};
const getUserAddresses = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid user ID is required'
      });
    }

    // Check if user exists
    const user = await User.findByPk(parseInt(userId));
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user addresses
    const addresses = await Address.findAll({
      where: {
        userId: parseInt(userId)
      },
      order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: addresses,
      message: `Found ${addresses.length} addresses for user`
    });

  } catch (error) {
    console.error('Get user addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};



// @desc    Export orders with filters
// @route   GET /api/admin/orders/export
// @access  Private (Admin only)
const exportOrders = async (req, res) => {
  try {
    const {
      search = '',
      paymentStatus = '',
      mealType = '',
      dateFilter = '',
      userName = '',
      nearestLocation = '',
      startDate = '',
      endDate = ''
    } = req.query;

    let whereClause = {};

    if (paymentStatus) whereClause.paymentStatus = paymentStatus;
    if (mealType) whereClause.mealType = mealType;
    if (search) whereClause.orderNumber = { [Op.like]: `%${search}%` };
if (nearestLocation) whereClause.nearestLocation = nearestLocation;

    // Apply date filters
    if (dateFilter) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      switch (dateFilter) {
        case 'today':
          whereClause.orderDate = todayStr;
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
          whereClause.orderDate = yesterdayStr;
          break;
        case 'last7days':
          const last7 = new Date(today);
          last7.setDate(last7.getDate() - 7);
          const last7Str = `${last7.getFullYear()}-${String(last7.getMonth() + 1).padStart(2, '0')}-${String(last7.getDate()).padStart(2, '0')}`;
          whereClause.orderDate = { [Op.gte]: last7Str };
          break;
        case 'last30days':
          const last30 = new Date(today);
          last30.setDate(last30.getDate() - 30);
          const last30Str = `${last30.getFullYear()}-${String(last30.getMonth() + 1).padStart(2, '0')}-${String(last30.getDate()).padStart(2, '0')}`;
          whereClause.orderDate = { [Op.gte]: last30Str };
          break;
        case 'thisMonth':
          const monthStart = new Date(year, today.getMonth(), 1);
          const monthStartStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;
          whereClause.orderDate = { [Op.gte]: monthStartStr };
          break;
      }
    }

    if (startDate && endDate) {
      whereClause.orderDate = { [Op.gte]: startDate, [Op.lte]: endDate };
    } else if (startDate) {
      whereClause.orderDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.orderDate = { [Op.lte]: endDate };
    }

    let userWhereClause = {};
    if (userName) {
      userWhereClause[Op.or] = [
        { firstName: { [Op.like]: `%${userName}%` } },
        { lastName: { [Op.like]: `%${userName}%` } }
      ];
    }

    const orders = await DailyOrder.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['firstName', 'lastName', 'email', 'phone'],
          where: Object.keys(userWhereClause).length > 0 ? userWhereClause : undefined,
          required: false
        }
      ],
      order: [['orderDate', 'DESC'], ['createdAt', 'DESC']]
    });

    // Create CSV content
    let csvContent = 'Order Number,Customer Name,Email,Phone,Order Date,Meal Type,Total Amount,Payment Status,Nearest Location,Delivery Address,Items Count,Special Items Count,Notes,Created At\n';
    
    orders.forEach(order => {
      const customerName = order.User ? `${order.User.firstName} ${order.User.lastName}` : 'N/A';
      const email = order.User ? order.User.email : 'N/A';
      const phone = order.User ? order.User.phone : 'N/A';
      const itemsCount = order.selectedItems?.length || 0;
      const specialItemsCount = order.specialItems?.length || 0;
      const notes = order.notes ? order.notes.replace(/"/g, '""').replace(/\n/g, ' ') : '';
      const nearestLoc = order.nearestLocation || 'N/A';
      
      csvContent += `"${order.orderNumber}","${customerName}","${email}","${phone}","${order.orderDate}","${order.mealType}","${order.totalAmount}","${order.paymentStatus}","${nearestLoc}","${order.deliveryAddress.replace(/"/g, '""')}","${itemsCount}","${specialItemsCount}","${notes}","${new Date(order.createdAt).toISOString()}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders_export_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export orders'
    });
  }
};

// @desc    Update address verification status
// @route   PATCH /api/admin/addresses/:id/verification
// @access  Private (Admin only)
const updateAddressVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, reason } = req.body;

    const address = await Address.findByPk(id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'verificationStatus']
      }]
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const oldVerificationStatus = address.isVerified;

    // Update address verification status
    await address.update({
      isVerified: isVerified,
      verificationReason: reason || null
    });

    // **KEY CHANGE: Update user verification status based on ANY verified address**
    if (isVerified && !oldVerificationStatus) {
      // Address was just verified - update user to verified
      await address.user.update({
        verificationStatus: 'verified',
        isVerified: true
      });

      console.log(`User ${address.user.id} status updated to VERIFIED (address ${id} verified)`);
    } else if (!isVerified && oldVerificationStatus) {
      // Address was just rejected - check if user still has any verified addresses
      const remainingVerifiedAddresses = await Address.count({
        where: {
          userId: address.user.id,
          isVerified: true,
          isActive: true,
          id: { [Op.ne]: id } // Exclude current address
        }
      });

      // If no other verified addresses exist, set user back to under_review
      if (remainingVerifiedAddresses === 0) {
        await address.user.update({
          verificationStatus: 'under_review',
          isVerified: false
        });

        console.log(`User ${address.user.id} status updated to UNDER_REVIEW (no verified addresses remaining)`);
      }
    }

    // Send email notification
    if (oldVerificationStatus !== isVerified || (!isVerified && reason)) {
      if (isVerified) {
        await sendAddressVerificationApprovedEmail(address.user, address);
      } else if (reason) {
        await sendAddressVerificationRejectedEmail(address.user, address, reason);
      }
    }

    // Fetch updated user data to return
    const updatedUser = await User.findByPk(address.user.id, {
      attributes: ['id', 'firstName', 'lastName', 'email', 'verificationStatus', 'isVerified']
    });

    res.status(200).json({
      success: true,
      message: `Address verification status updated`,
      data: { 
        address,
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Update address verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update address verification status'
    });
  }
};

// Update the verification approved email to reflect single address verification
const sendAddressVerificationApprovedEmail = async (user, address) => {
  const addressTypeLabel = address.addressType.charAt(0).toUpperCase() + address.addressType.slice(1);
  
  const mailOptions = {
    from: '"MealStack Support" <reshmasajeev095@gmail.com>',
    to: user.email,
    subject: `${addressTypeLabel} Address Verified - Your Account is Now Active!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f6f9; }
          .container { background: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { color: #2E8B57; font-size: 24px; font-weight: bold; }
          .content { line-height: 1.6; color: #333; }
          .success-box { 
            background: linear-gradient(135deg, #10b981, #059669); 
            color: white; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            text-align: center;
          }
          .address-box {
            background: #f8fafc;
            border-left: 4px solid #10b981;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .address-type {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 10px;
          }
          .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #667eea, #764ba2); 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold; 
            margin: 20px 0;
          }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 14px; }
          .highlight-box {
            background: #fef3c7;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #f59e0b;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">MealStack</div>
            <h2 style="color: #10b981;">ðŸŽ‰ Your Account is Now Verified!</h2>
          </div>
          <div class="content">
            <p>Dear ${user.firstName},</p>
            
            <div class="success-box">
              <h3 style="margin: 0;">âœ“ Address Verified Successfully</h3>
              <p style="margin: 10px 0 0;">Your account is now fully active and ready to use!</p>
            </div>
            
            <div class="address-box">
              <div class="address-type">
                <span>${address.addressType === 'home' ? 'ðŸ ' : 'ðŸ¢'}</span>
                <span>${addressTypeLabel} Address - VERIFIED</span>
              </div>
              <p style="margin: 5px 0; color: #475569;">${address.address}</p>
              ${address.nearestLocation ? `<p style="margin: 5px 0; color: #6366f1;">ðŸ“ Near ${address.nearestLocation}</p>` : ''}
            </div>
            
            <div class="highlight-box">
              <p style="margin: 0;"><strong>Good news!</strong> You only need one verified address to start using MealStack. Your ${addressTypeLabel.toLowerCase()} address has been approved and you can now place orders!</p>
            </div>
            
            <p><strong>What you can do now:</strong></p>
            <ul>
              <li>Browse our delicious meal plans</li>
              <li>Place orders for delivery to your verified address</li>
              <li>Customize your meal preferences</li>
              <li>Enjoy hassle-free meal deliveries</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/basic-plan" class="cta-button">
                Start Ordering Now
              </a>
            </div>
          </div>
          <div class="footer">
            <p>Best regards,<br>The MealStack Team</p>
            <p><small>Need help? Contact us at support@mealstack.com</small></p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Address verification approved email sent to: ${user.email}`);
  } catch (mailError) {
    console.error("Address verification approved email failed:", mailError);
  }
};

// Keep the rejection email as is
const sendAddressVerificationRejectedEmail = async (user, address, reason = '') => {
  const addressTypeLabel = address.addressType.charAt(0).toUpperCase() + address.addressType.slice(1);
  
  // Check if user still has verified addresses
  const hasOtherVerifiedAddress = await Address.count({
    where: {
      userId: user.id,
      isVerified: true,
      isActive: true,
      id: { [Op.ne]: address.id }
    }
  });
  
  const mailOptions = {
    from: '"MealStack Support" <reshmasajeev095@gmail.com>',
    to: user.email,
    subject: `${addressTypeLabel} Address Verification Update - MealStack`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f6f9; }
          .container { background: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { color: #2E8B57; font-size: 24px; font-weight: bold; }
          .content { line-height: 1.6; color: #333; }
          .warning-box { 
            background: #fef3c7; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            border-left: 4px solid #f59e0b;
          }
          .address-box {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .reason-box {
            background: #fee2e2;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #ef4444;
          }
          .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #667eea, #764ba2); 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold; 
            margin: 20px 0;
          }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 14px; }
          .info-box {
            background: #dbeafe;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #3b82f6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">MealStack</div>
            <h2 style="color: #d97706;">${addressTypeLabel} Address Verification Update</h2>
          </div>
          <div class="content">
            <p>Dear ${user.firstName},</p>
            
            <div class="warning-box">
              <p style="margin: 0;"><strong>We're unable to verify your ${addressTypeLabel.toLowerCase()} address at this time.</strong></p>
            </div>
            
            <div class="address-box">
              <p style="margin: 5px 0; color: #475569;">${address.address}</p>
              ${address.nearestLocation ? `<p style="margin: 5px 0; color: #dc2626;">ðŸ“ Near ${address.nearestLocation}</p>` : ''}
            </div>
            
            ${reason ? `
            <div class="reason-box">
              <p style="margin: 0;"><strong>Reason for rejection:</strong></p>
              <p style="margin: 10px 0 0;">${reason}</p>
            </div>
            ` : ''}
            
            ${hasOtherVerifiedAddress > 0 ? `
            <div class="info-box">
              <p style="margin: 0;"><strong>Good news!</strong> You still have another verified address on file, so you can continue using MealStack services without interruption.</p>
            </div>
            ` : `
            <div class="warning-box">
              <p style="margin: 0;"><strong>Important:</strong> You need at least one verified address to place orders. Please update your address information to continue using our services.</p>
            </div>
            `}
            
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>Review and update your address information</li>
              <li>Ensure the address is accurate and complete</li>
              <li>Verify the nearest location is correct</li>
              <li>Contact our support team if you need assistance</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/profile" class="cta-button">
                Update Address
              </a>
            </div>
          </div>
          <div class="footer">
            <p>Best regards,<br>The MealStack Team</p>
            <p><small>Support Email: support@mealstack.com</small></p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Address verification rejected email sent to: ${user.email}`);
  } catch (mailError) {
    console.error("Address verification rejected email failed:", mailError);
  }
};




module.exports = {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  exportOrdersExcel,
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateVerificationStatus,
  updateUserStatus,
  getAllPayments,
  getPaymentById,
  refundPayment,
  exportUsers,
  exportPayments,
  getUserAddresses,
  updateAddressVerification ,
  exportOrders
};