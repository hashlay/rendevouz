import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_FILE = './data/db.json';
const UPLOADS_DIR = './data/uploads';

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

console.log('Reading db.json...');
const data = fs.readFileSync(DB_FILE, 'utf-8');
const db = JSON.parse(data);

let modified = false;

function extractBase64(obj, parentKey = '') {
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/')) {
      const matches = obj.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        const filename = `${hash}.${ext}`;
        const filepath = path.join(UPLOADS_DIR, filename);
        if (!fs.existsSync(filepath)) {
          fs.writeFileSync(filepath, buffer);
          console.log(`Saved base64 image to ${filepath} (${(buffer.length / 1024).toFixed(2)} KB)`);
        }
        modified = true;
        return `/data/uploads/${filename}`;
      }
    }
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = extractBase64(obj[i], `${parentKey}[${i}]`);
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const key in obj) {
      obj[key] = extractBase64(obj[key], `${parentKey}.${key}`);
    }
  }
  return obj;
}

console.log('Extracting base64 images...');
extractBase64(db);

if (modified) {
  console.log('Writing modified db.json...');
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  console.log('Done! db.json shrunk successfully.');
} else {
  console.log('No base64 images found.');
}
