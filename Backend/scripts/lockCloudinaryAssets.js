const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Course = require('../models/Course');
const Post = require('../models/Post');
const { parseCloudinaryUrl, lockToAuthenticated } = require('../utils/signedAsset');

async function lockAttachment(att) {
  const parsed = parseCloudinaryUrl(att.url || '');
  const publicId = att.publicId || parsed?.publicId;
  if (!publicId) return 'skipped';
  if (att.deliveryType === 'authenticated' && !att.url) return 'already';
  const resourceType = att.resourceType || parsed?.resourceType || 'raw';
  const fromType = parsed?.deliveryType && parsed.deliveryType !== 'authenticated'
    ? parsed.deliveryType
    : 'upload';
  const result = await lockToAuthenticated(publicId, resourceType, fromType);
  att.publicId = publicId;
  att.resourceType = resourceType;
  att.deliveryType = 'authenticated';
  att.url = '';
  return result;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const summary = { moved: 0, already: 0, skipped: 0, failed: [] };

  const posts = await Post.find();
  for (const post of posts) {
    let changed = false;
    for (const att of post.attachments || []) {
      try {
        const result = await lockAttachment(att);
        if (result === 'skipped') summary.skipped += 1;
        else {
          summary[result] += 1;
          changed = true;
        }
      } catch (err) {
        summary.failed.push({ label: att.label, error: err?.message || String(err) });
      }
    }
    for (const folder of post.folders || []) {
      for (const att of folder.attachments || []) {
        try {
          const result = await lockAttachment(att);
          if (result === 'skipped') summary.skipped += 1;
          else {
            summary[result] += 1;
            changed = result !== 'already' || Boolean(att.url) || changed;
            changed = true;
          }
        } catch (err) {
          summary.failed.push({ label: att.label, error: err?.message || String(err) });
        }
      }
    }
    if (changed) await post.save();
  }

  const courses = await Course.find();
  for (const course of courses) {
    let changed = false;
    for (const material of course.materials || []) {
      if (!material.cloudinaryPublicId) continue;
      if (material.cloudinaryDelivery === 'authenticated') {
        summary.already += 1;
        continue;
      }
      const resourceType = material.fileType === 'image' ? 'image' : material.fileType === 'video' ? 'video' : 'raw';
      const fromType = material.cloudinaryDelivery || 'private';
      try {
        let result;
        try {
          result = await lockToAuthenticated(material.cloudinaryPublicId, resourceType, fromType);
        } catch (err) {
          if (fromType !== 'upload') result = await lockToAuthenticated(material.cloudinaryPublicId, resourceType, 'upload');
          else throw err;
        }
        material.cloudinaryDelivery = 'authenticated';
        summary[result] += 1;
        changed = true;
      } catch (err) {
        summary.failed.push({ label: material.title, error: err?.message || String(err) });
      }
    }
    if (changed) await course.save();
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
