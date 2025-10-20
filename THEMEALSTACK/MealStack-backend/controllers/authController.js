const User = require('../models/User');
const Address = require('../models/Address');
const { generateTokens } = require('../utils/jwt');
const transporter = require("../mailer");

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ 
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    await user.update({ lastLogin: new Date() });
    const tokens = generateTokens(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          companyName: user.companyName,
          lastLogin: user.lastLogin,
          verificationStatus: user.verificationStatus || 'pending',
          isVerified: user.isVerified || false
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, companyName, phone } = req.body;

    if (!firstName || !lastName || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, phone number and password are required'
      });
    }

    const existingUser = await User.findOne({ 
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      companyName,
      phone,
      role: 'user',
      verificationStatus: 'pending'
    });

    const tokens = generateTokens(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          companyName: user.companyName,
          verificationStatus: user.verificationStatus,
          isVerified: user.isVerified
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: Address,
        as: 'addresses',
        where: { isActive: true },
        required: false
      }]
    });

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    // If association fails, fallback to user only
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] }
      });
      
      res.status(200).json({
        success: true,
        data: { user }
      });
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
};

// @desc    Create or Update Address (New Method)
// @route   POST /api/auth/address
// @access  Private
const createOrUpdateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      addressType,
      address,
      locationUrl,
      nearestLocation,
      // city,
      // state,
      // pincode,
      isDefault
    } = req.body;

    if (!addressType || !address) {
      return res.status(400).json({
        success: false,
        message: 'Address type and address are required'
      });
    }

    if (!['home', 'office'].includes(addressType)) {
      return res.status(400).json({
        success: false,
        message: 'Address type must be either home or office'
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    let existingAddress = await Address.findOne({
      where: {
        userId,
        addressType
      }
    });

    let addressRecord;

    if (existingAddress) {
      addressRecord = await existingAddress.update({
        address,
        locationUrl,
        nearestLocation,
        // city,
        // state,
        // pincode,
        isDefault: isDefault || false
      });
    } else {
      addressRecord = await Address.create({
        userId,
        addressType,
        address,
        locationUrl,
        nearestLocation,
        // city,
        // state,
        // pincode,
        isDefault: isDefault || false
      });
    }

    await user.update({
      verificationStatus: 'under_review'
    });

    await sendVerificationEmail(user, { addressType, address });

    return res.status(200).json({
      success: true,
      message: 'Address saved successfully',
      data: {
        address: addressRecord,
        verificationStatus: 'under_review'
      }
    });

  } catch (error) {
    console.error('Address creation error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user addresses
// @route   GET /api/auth/addresses
// @access  Private
const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user.id;

    const addresses = await Address.findAll({
      where: {
        userId,
        isActive: true
      },
      order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: addresses
    });

  } catch (error) {
    console.error('Get addresses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete address
// @route   DELETE /api/auth/address/:id
// @access  Private
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    const address = await Address.findOne({
      where: {
        id: addressId,
        userId
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    await address.update({ isActive: false });

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });

  } catch (error) {
    console.error('Delete address error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update Address (Legacy Method - For backward compatibility)
// @route   PUT /api/auth/updateaddress
// @access  Private
const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      addressType,
      home_address,
      home_locationUrl,
      office_address,
      office_locationUrl
    } = req.body;

    if (!addressType || (addressType === 'home' && (!home_address || !home_locationUrl)) ||
        (addressType === 'office' && (!office_address || !office_locationUrl))) {
      return res.status(400).json({
        success: false,
        message: 'Address type and relevant address fields are required'
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update legacy user fields if they exist
    const updateData = { verificationStatus: 'under_review' };
    
    if (addressType === 'home') {
      updateData.home_address = home_address;
      updateData.home_locationUrl = home_locationUrl;
    } else {
      updateData.office_address = office_address;  
      updateData.office_locationUrl = office_locationUrl;
    }

    await user.update(updateData);

    await sendVerificationEmail(user, { 
      addressType, 
      address: addressType === 'home' ? home_address : office_address 
    });

    return res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: {
        addressType,
        verificationStatus: 'under_review'
      }
    });
  } catch (error) {
    console.error('Update address error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper function to send verification email
const sendVerificationEmail = async (user, addressInfo) => {
  const mailOptions = {
    from: '"MealStack Support" <reshmasajeev095@gmail.com>',
    to: user.email,
    subject: "Your Account is Under Verification",
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
          .highlight { background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">MealStack</div>
            <h2 style="color: #2E8B57;">Account Verification in Progress</h2>
          </div>
          <div class="content">
            <p>Dear ${user.firstName},</p>
            <p>Thank you for providing your address details. Your account is now <strong>under verification</strong>.</p>
            <div class="highlight">
              <strong>Address Type:</strong> ${addressInfo.addressType}<br>
              <strong>Address:</strong> ${addressInfo.address}
            </div>
            <p>Our team is reviewing your information and will get back to you within 24-48 hours.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The MealStack Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Verification email sent to:", user.email);
  } catch (mailError) {
    console.error("Mail send failed:", mailError);
  }
};

// Add this method to your authController.js

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      currentPassword,
      newPassword
    } = req.body;

    // Find the user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prepare update data
    const updateData = {};
    
    // Basic fields validation and update
    if (firstName) {
      if (firstName.length < 2 || firstName.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'First name must be between 2 and 50 characters'
        });
      }
      updateData.firstName = firstName;
    }

    if (lastName) {
      if (lastName.length < 2 || lastName.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Last name must be between 2 and 50 characters'
        });
      }
      updateData.lastName = lastName;
    }

    if (email) {
      // Check if email is already taken by another user
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }

      const existingUser = await User.findOne({
        where: {
          email: email.toLowerCase(),
          id: { [require('sequelize').Op.ne]: userId }
        }
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email is already registered with another account'
        });
      }

      updateData.email = email.toLowerCase();
    }

    if (phone) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be exactly 10 digits'
        });
      }
      updateData.phone = phone;
    }

    if (companyName !== undefined) {
      updateData.companyName = companyName || null;
    }

    // Handle password change
    if (currentPassword && newPassword) {
      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Validate new password
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      updateData.password = newPassword; // Will be hashed by the beforeUpdate hook
    } else if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Both current password and new password are required to change password'
      });
    }

    // Update user
    await user.update(updateData);

    // Fetch updated user data (excluding password)
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [{
        model: Address,
        as: 'addresses',
        where: { isActive: true },
        required: false
      }]
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


// Add these methods to your authController.js

const crypto = require('crypto');

// @desc    Forgot password - Send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save reset token to user
    await user.update({
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetTokenExpiry
    });

    // Send reset email
    await sendPasswordResetEmail(user, resetToken);

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          [require('sequelize').Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password and clear reset token
    await user.update({
      password: newPassword, // Will be hashed by beforeUpdate hook
      resetPasswordToken: null,
      resetPasswordExpires: null
    });

    // Send confirmation email
    await sendPasswordResetConfirmation(user);

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Verify reset token
// @route   GET /api/auth/verify-reset-token/:token
// @access  Public
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          [require('sequelize').Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        email: user.email,
        firstName: user.firstName
      }
    });

  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper function to send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: '"MealStack Support" <reshmasajeev095@gmail.com>',
    to: user.email,
    subject: "Password Reset Request - MealStack",
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
          .reset-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #2E8B57, #4CAF50); 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold; 
            margin: 20px 0;
          }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 14px; }
          .warning { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">MealStack</div>
            <h2 style="color: #2E8B57;">Password Reset Request</h2>
          </div>
          <div class="content">
            <p>Dear ${user.firstName},</p>
            <p>We received a request to reset the password for your MealStack account.</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="reset-button">Reset Your Password</a>
            </div>
            
            <div class="warning">
              <strong>Important:</strong>
              <ul>
                <li>This link will expire in 15 minutes</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Never share this link with anyone</li>
              </ul>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px;">
              ${resetUrl}
            </p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The MealStack Team</p>
            <p><small>This is an automated message. Please do not reply to this email.</small></p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Password reset email sent to:", user.email);
  } catch (mailError) {
    console.error("Password reset email failed:", mailError);
    throw new Error('Failed to send reset email');
  }
};

// Helper function to send password reset confirmation
const sendPasswordResetConfirmation = async (user) => {
  const mailOptions = {
    from: '"MealStack Support" <reshmasajeev095@gmail.com>',
    to: user.email,
    subject: "Password Reset Successful - MealStack",
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
          .success-box { background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">MealStack</div>
            <h2 style="color: #2E8B57;">Password Reset Successful</h2>
          </div>
          <div class="content">
            <p>Dear ${user.firstName},</p>
            <div class="success-box">
              <p><strong>Your password has been successfully reset!</strong></p>
            </div>
            <p>You can now login to your MealStack account using your new password.</p>
            <p>If you did not make this change, please contact our support team immediately.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The MealStack Team<br>
            Support: support@mealstack.com</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Password reset confirmation sent to:", user.email);
  } catch (mailError) {
    console.error("Confirmation email failed:", mailError);
  }
};

// Update your module.exports to include new methods
module.exports = {
  login,
  register,
  getProfile,
  updateProfile,
  logout,
  updateAddress,
  createOrUpdateAddress,
  getUserAddresses,
  deleteAddress,
  forgotPassword,      // Add this
  resetPassword,       // Add this
  verifyResetToken     // Add this
};
