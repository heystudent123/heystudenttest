const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCloudinaryUrl, attachmentForStorage, attachmentForClient } = require('../utils/signedAsset');

test('a public Cloudinary URL is reduced to its file id', () => {
  const parsed = parseCloudinaryUrl(
    'https://res.cloudinary.com/dhsjszzei/raw/upload/v1772553702/heystudents/posts/pdfs/1772553702296-Poetic_Devices_One_Stop_Solution-%281%29.pdf'
  );
  assert.equal(parsed.resourceType, 'raw');
  assert.equal(parsed.deliveryType, 'upload');
  assert.equal(
    parsed.publicId,
    'heystudents/posts/pdfs/1772553702296-Poetic_Devices_One_Stop_Solution-(1).pdf'
  );
  assert.equal(parseCloudinaryUrl('https://example.com/file.pdf'), null);
});

test('stored attachments keep the file id and drop the Cloudinary URL', () => {
  const stored = attachmentForStorage({
    label: 'Notes.pdf',
    type: 'document',
    url: 'https://res.cloudinary.com/demo/raw/upload/v1/heystudents/posts/pdfs/notes.pdf',
  });
  assert.equal(stored.publicId, 'heystudents/posts/pdfs/notes.pdf');
  assert.equal(stored.resourceType, 'raw');
  assert.equal(stored.deliveryType, 'authenticated');
  assert.equal(stored.url, '');

  const studentView = attachmentForClient({
    _id: 'abc',
    label: 'Notes.pdf',
    type: 'document',
    url: 'https://res.cloudinary.com/demo/raw/upload/v1/heystudents/posts/pdfs/notes.pdf',
  });
  assert.equal(studentView.protected, true);
  assert.equal(studentView.url, '');
  assert.equal('publicId' in studentView, false);
});
