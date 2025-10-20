// middleware/upload.js (SIMPLE VERSION - Create this file)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads/menu-items');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory:', uploadDir);
  }
} catch (error) {
  console.error('Error creating uploads directory:', error);
}

// Simple storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Simple filename: timestamp + original extension
    const uniqueSuffix = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `menu-item-${uniqueSuffix}${ext}`);
  }
});

// Basic file filter
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Basic multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Simple error handler
const handleUploadError = (error, req, res, next) => {
  if (error) {
    console.error('Upload error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'File upload failed'
    });
  }
  next();
};

// Helper to delete files
const deleteImageFile = (filename) => {
  if (filename) {
    const filePath = path.join(uploadDir, filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Deleted file:', filename);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
};

// Helper to get image URL
const getImageUrl = (req, filename) => {
  if (!filename) return null;
  // If filename already contains the full path, return it as-is
  if (filename.startsWith('/uploads/')) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}${filename}`;
  }
  // Otherwise, construct the full URL
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/api/uploads/menu-items/${filename}`;
};

module.exports = {
  upload: upload.single('image'),
  handleUploadError,
  deleteImageFile,
  getImageUrl
};