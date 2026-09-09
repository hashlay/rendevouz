import fs from 'fs';

const DB_FILE = './data/db.json';
const data = fs.readFileSync(DB_FILE, 'utf-8');
const db = JSON.parse(data);

if (db.auditLogs && db.auditLogs.length > 100) {
  db.auditLogs = db.auditLogs.slice(-100);
}
if (db.loginAudits && db.loginAudits.length > 100) {
  db.loginAudits = db.loginAudits.slice(-100);
}

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
console.log('Truncated auditLogs and loginAudits!');
