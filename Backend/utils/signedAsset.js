const axios = require('axios');
const cloudinary = require('cloudinary').v2;

const SIGNED_URL_TTL_SECONDS = 60;
const RESOURCE_TYPES = ['image', 'raw', 'video'];
const DELIVERY_TYPES = ['upload', 'private', 'authenticated'];

const ensureCloudinary = () => {
  const current = cloudinary.config();
  if (current && current.cloud_name) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

const parseCloudinaryUrl = (value) => {
  if (typeof value !== 'string' || !value.includes('cloudinary.com')) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 4) return null;
  const resourceType = parts[1];
  const deliveryType = parts[2];
  if (!RESOURCE_TYPES.includes(resourceType) || !DELIVERY_TYPES.includes(deliveryType)) return null;
  let rest = parts.slice(3);
  const versionAt = rest.findIndex((part) => /^v\d+$/.test(part));
  if (versionAt >= 0) rest = rest.slice(versionAt + 1);
  if (!rest.length) return null;
  let publicId = '';
  try {
    publicId = decodeURIComponent(rest.join('/'));
  } catch {
    return null;
  }
  if (!publicId) return null;
  return { publicId, resourceType, deliveryType };
};

const attachmentForStorage = (att) => {
  if (!att || typeof att !== 'object') return null;
  const label = String(att.label || '').trim().slice(0, 200);
  const type = ['image', 'document', 'video'].includes(att.type) ? att.type : 'document';
  const parsed = parseCloudinaryUrl(att.url);
  const publicId = String(att.publicId || parsed?.publicId || '').trim().slice(0, 400);
  const resourceType = RESOURCE_TYPES.includes(att.resourceType)
    ? att.resourceType
    : (parsed?.resourceType || '');
  const deliveryType = DELIVERY_TYPES.includes(att.deliveryType)
    ? att.deliveryType
    : (publicId ? 'authenticated' : '');
  if (publicId) {
    return { label, type, publicId, resourceType, deliveryType, url: '' };
  }
  const url = typeof att.url === 'string' ? att.url.trim().slice(0, 500) : '';
  if (url && !url.includes('cloudinary.com')) {
    return { label, type, url, publicId: '', resourceType: '', deliveryType: '' };
  }
  return { label, type, url: '', publicId: '', resourceType: '', deliveryType: '' };
};

const attachmentForClient = (att, { includeFileId = false } = {}) => {
  const stored = attachmentForStorage(att);
  if (!stored) return null;
  const view = {
    _id: att._id,
    label: stored.label,
    type: stored.type,
    protected: Boolean(stored.publicId),
    url: stored.publicId ? '' : stored.url,
  };
  if (includeFileId) {
    view.publicId = stored.publicId;
    view.resourceType = stored.resourceType;
    view.deliveryType = stored.deliveryType;
  }
  return view;
};

const signedDeliveryUrl = ({ publicId, resourceType, deliveryType, format }) => {
  ensureCloudinary();
  const options = {
    resource_type: resourceType || 'raw',
    type: deliveryType || 'authenticated',
    secure: true,
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
  };
  if (format) options.format = format;
  return cloudinary.url(publicId, options);
};

const pipeSignedAsset = async (res, asset, filename) => {
  const signedUrl = signedDeliveryUrl(asset);
  const upstream = await axios.get(signedUrl, {
    responseType: 'stream',
    validateStatus: () => true,
    maxRedirects: 5,
    timeout: 20000,
  });
  if (upstream.status >= 400) {
    if (upstream.data && typeof upstream.data.resume === 'function') upstream.data.resume();
    return false;
  }
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  if (upstream.headers['content-type']) res.set('Content-Type', upstream.headers['content-type']);
  const safeName = String(filename || 'file').replace(/[\r\n"]/g, '').slice(0, 180) || 'file';
  res.set('Content-Disposition', `inline; filename="${safeName}"`);
  upstream.data.pipe(res);
  return true;
};

const httpCode = (err) => err?.error?.http_code || err?.http_code || err?.response?.status;

const lockToAuthenticated = async (publicId, resourceType, fromType) => {
  ensureCloudinary();
  try {
    await cloudinary.api.resource(publicId, { resource_type: resourceType, type: 'authenticated' });
    return 'already';
  } catch (err) {
    if (httpCode(err) && httpCode(err) !== 404) throw err;
  }
  await cloudinary.uploader.rename(publicId, publicId, {
    resource_type: resourceType,
    type: fromType || 'upload',
    to_type: 'authenticated',
    overwrite: true,
  });
  return 'moved';
};

module.exports = {
  SIGNED_URL_TTL_SECONDS,
  parseCloudinaryUrl,
  attachmentForStorage,
  attachmentForClient,
  signedDeliveryUrl,
  pipeSignedAsset,
  lockToAuthenticated,
};
