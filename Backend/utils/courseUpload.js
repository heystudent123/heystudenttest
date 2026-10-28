const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure with ENV vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage config for course materials (PDFs, notes, images, etc.)
const courseStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Determine folder based on file type
    let folder = 'heystudents/courses';
    
    if (file.mimetype.startsWith('image/')) {
      folder = 'heystudents/courses/images';
    } else if (file.mimetype === 'application/pdf') {
      folder = 'heystudents/courses/pdfs';
    } else if (file.mimetype.includes('document') || file.mimetype.includes('word')) {
      folder = 'heystudents/courses/documents';
    } else {
      folder = 'heystudents/courses/files';
    }

    return {
      folder: folder,
      resource_type: 'auto',
      type: 'authenticated',
      public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, '-').replace(/\.[^/.]+$/, '')}`,
      // Allow all file formats
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'zip', 'rar'],
    };
  },
});

// Multer middleware for course file uploads
const uploadCourseFiles = multer({ 
  storage: courseStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images, PDFs, and documents
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/zip',
      'application/x-rar-compressed'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  }
});

// Delete file from Cloudinary
const deleteFile = async (publicId) => {
  try {
    // Try deleting as different resource types
    const resourceTypes = ['image', 'raw', 'video'];
    const deliveryTypes = ['authenticated', 'private', 'upload'];
    
    for (const resourceType of resourceTypes) {
      for (const type of deliveryTypes) {
        try {
          const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type });
          if (result.result === 'ok') {
            return result;
          }
        } catch (err) {
          continue;
        }
      }
    }
    
    return { result: 'not found' };
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

module.exports = { 
  cloudinary, 
  uploadCourseFiles,
  deleteFile
};
