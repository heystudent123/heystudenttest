const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const postStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'heystudents/posts/images';
    let resourceType = 'image';

    if (file.mimetype === 'application/pdf') {
      folder = 'heystudents/posts/pdfs';
      resourceType = 'raw';
    } else if (
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-powerpoint' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      folder = 'heystudents/posts/documents';
      resourceType = 'raw';
    }

    return {
      folder,
      resource_type: resourceType,
      type: 'authenticated',
      public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`,
    };
  },
});

const uploadAttachment = multer({
  storage: postStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

module.exports = { cloudinary, uploadAttachment };
