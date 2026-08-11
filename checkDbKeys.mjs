import fs from 'fs';

const DB_FILE = './data/db.json';
const data = fs.readFileSync(DB_FILE, 'utf-8');
const db = JSON.parse(data);

for (const key in db) {
  const str = JSON.stringify(db[key]);
  console.log(`${key}: ${(str.length / 1024 / 1024).toFixed(2)} MB`);
}
