import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User, UserRole, Session, LoginAudit, AuditLog,
  Unit, Category, Competition, Participant, Team,
  Result, EventSettings, EducationStatus, ParticipationType,
  StageType, Gender, ResultStatus,
  ChestNumber, Counter, GreenRoomAssignment, JudgmentSheet, JudgeScore
} from '../src/types.js';
import { MongoClient, Collection } from 'mongodb';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// MongoDB Client Connection Setup
let mongoClient: MongoClient | null = null;
let mongoCollection: Collection<any> | null = null;
let isMongoConnecting = false;
let isMongoConnected = false;

let mongoConnectedPromise: Promise<void> | null = null;

async function _connectToMongo() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log("No MONGO_URI/MONGODB_URI found in environment. Using local JSON store (data/db.json).");
    return;
  }

  if (isMongoConnected || isMongoConnecting) return;
  isMongoConnecting = true;

  try {
    console.log("Attempting to connect to MongoDB...");
    mongoClient = new MongoClient(mongoUri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000
    });
    await mongoClient.connect();

    const mongoUriStr = mongoUri || '';
    const dbPath = mongoUriStr.includes('/') ? mongoUriStr.split('/').pop()?.split('?')[0] : null;
    const dbName = (dbPath && dbPath.length > 0) ? dbPath : 'sahityotsav';

    const mongoDb = mongoClient.db(dbName);
    mongoCollection = mongoDb.collection('app_state');
    isMongoConnected = true;
    console.log(`=============================================================`);
    console.log(`🍃 Connected successfully to MongoDB: "${dbName}"`);
    console.log(`=============================================================`);

    await syncStateFromMongo(true);

    // Explicit recovery check: if categories or units are empty, ensure default defaults exist
    if (!db.categories || db.categories.length === 0) {
      db.categories = [
        { id: 'cat_kids', name: 'Kids', startingChestNumber: 101, dobStart: '2019-01-01', dobEnd: '2026-12-31', active: true },
        { id: 'cat_sub_junior', name: 'Sub-Junior', startingChestNumber: 201, dobStart: '2016-01-01', dobEnd: '2018-12-31', active: true },
        { id: 'cat_junior', name: 'Junior', startingChestNumber: 301, dobStart: '2014-01-01', dobEnd: '2015-12-31', active: true },
        { id: 'cat_senior', name: 'Senior', startingChestNumber: 401, dobStart: '2010-01-01', dobEnd: '2013-12-31', active: true }
      ];
    }
    if (!db.units || db.units.length === 0) {
      db.units = [
        { id: 'unit_ash_shukr', name: 'Ash-Shukr', code: 'SHK', active: true },
        { id: 'unit_as_sabr', name: 'As-Sabr', code: 'SBR', active: true }
      ];
    }

    // Normalize category starting chest numbers (convert legacy 1000/2000/3000/4000 to 101/201/301/401)
    if (Array.isArray(db.categories)) {
      db.categories.forEach((cat: any) => {
        if (cat.id === 'cat_kids' && (!cat.startingChestNumber || cat.startingChestNumber === 1000)) cat.startingChestNumber = 101;
        if (cat.id === 'cat_sub_junior' && (!cat.startingChestNumber || cat.startingChestNumber === 2000)) cat.startingChestNumber = 201;
        if (cat.id === 'cat_junior' && (!cat.startingChestNumber || cat.startingChestNumber === 3000)) cat.startingChestNumber = 301;
        if (cat.id === 'cat_senior' && (!cat.startingChestNumber || cat.startingChestNumber === 4000)) cat.startingChestNumber = 401;
      });
    }

    // Sanitize broken legacy local uploads from gallery & videoHighlights
    if (Array.isArray(db.gallery)) {
      db.gallery = db.gallery.filter((g: any) => g.imageUrl && !g.imageUrl.startsWith('/data/uploads/'));
      try {
        await mongoDb.collection('gallery').deleteMany({ imageUrl: { $regex: '^/data/uploads/' } });
      } catch (_) { }
    }
    if (Array.isArray(db.videoHighlights)) {
      db.videoHighlights = db.videoHighlights.filter((v: any) => v.videoUrl && !v.videoUrl.startsWith('/data/uploads/'));
      try {
        await mongoDb.collection('videoHighlights').deleteMany({ videoUrl: { $regex: '^/data/uploads/' } });
      } catch (_) { }
    }

    // Write synchronized state to local file store and sync to MongoDB collections
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (_) { }

    // Sync all categories, competitions, units, settings to MongoDB collections
    await _syncMongoNow();
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB. Falling back to local file store.", err);
    isMongoConnected = false;
  } finally {
    isMongoConnecting = false;
  }
}

function connectToMongo() {
  if (!mongoConnectedPromise) {
    mongoConnectedPromise = _connectToMongo();
  }
  return mongoConnectedPromise;
}

export interface DatabaseSchema {
  users: User[];
  loginAudits: LoginAudit[];
  auditLogs: AuditLog[];
  units: Unit[];
  categories: Category[];
  competitions: Competition[];
  participants: Participant[];
  teams: Team[];
  results: Result[];
  eventSettings: EventSettings;
  registrations: any[];
  // New collections
  chestNumbers: ChestNumber[];
  counters: Counter[];
  greenRoomAssignments: GreenRoomAssignment[];
  judgmentSheets: JudgmentSheet[];
  judgeScores: JudgeScore[];
  gallery?: any[];
  videoHighlights?: any[];
  dragBlocks?: any[];
  heroMedia?: any[];
  posterTemplateConfig?: any;
  certificateTemplateConfig?: any;
  cmsSettings?: any;
}

// Simple in-memory cache synchronized with the file
let db: DatabaseSchema;

function ensureDbExists() {
  if (db) return; // Prevent reloading from disk if already in memory

  if (!fs.existsSync(DB_DIR)) {
    try {
      fs.mkdirSync(DB_DIR, { recursive: true });
    } catch (e) {
      console.warn("Could not create DB_DIR (expected on read-only environments like Vercel).");
    }
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(data);
      // Ensure all arrays exist
      if (!db.users) db.users = [];
      if (!db.loginAudits) db.loginAudits = [];
      if (!db.auditLogs) db.auditLogs = [];
      if (!db.units) db.units = [];
      if (!db.categories) db.categories = [];
      if (!db.competitions) db.competitions = [];
      if (!db.participants) db.participants = [];
      if (!db.teams) db.teams = [];
      if (!db.results) db.results = [];
      if (!db.registrations) db.registrations = [];
      // New collections
      if (!db.chestNumbers) db.chestNumbers = [];
      if (!db.counters) db.counters = [];
      if (!db.greenRoomAssignments) db.greenRoomAssignments = [];
      if (!db.judgmentSheets) db.judgmentSheets = [];
      if (!db.judgeScores) db.judgeScores = [];
      if (!db.gallery) db.gallery = [];
      if (!db.videoHighlights) db.videoHighlights = [];
      if (!db.eventSettings) db.eventSettings = {} as any;
      if (!db.eventSettings.eventTitle) db.eventSettings.eventTitle = 'A SMILE THAT BRINGS HEARTS TOGETHER';
      if (!db.eventSettings.festivalName) db.eventSettings.festivalName = 'tabassum';
      if (!db.eventSettings.campusName) db.eventSettings.campusName = 'Noorul Islam Madrasa, Jeppu';
      if (!db.eventSettings.sectorName) db.eventSettings.sectorName = 'Noorul Islam Madrasa, Jeppu';
      if (!db.eventSettings.eventYear) db.eventSettings.eventYear = '2026';
      if (!db.eventSettings.venue) db.eventSettings.venue = 'Jeppu';
      if (!db.eventSettings.contactInfo) db.eventSettings.contactInfo = 'zenith.theorganizer@gmail.com';
      if (!db.eventSettings.ssfLogoUrl || db.eventSettings.ssfLogoUrl.includes('base64') || db.eventSettings.ssfLogoUrl.includes('zenith')) db.eventSettings.ssfLogoUrl = '/tabassum_logo.jpg';
      if (!db.eventSettings.sahityotsavLogoUrl || db.eventSettings.sahityotsavLogoUrl.includes('base64') || db.eventSettings.sahityotsavLogoUrl.includes('zenith')) db.eventSettings.sahityotsavLogoUrl = '/tabassum_logo.jpg';
      return;
    } catch (e) {
      console.error("Error reading database file, initializing fresh one", e);
    }
  }

  // Create fresh seeded database
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync(process.env.INITIAL_ADMIN_PASSWORD || 'admin123', salt);

  const initialUsers: User[] = [
    {
      id: 'usr_admin',
      fullName: 'Super Administrator',
      username: process.env.INITIAL_ADMIN_USERNAME || 'admin',
      email: 'admin@ssf.org',
      passwordHash: adminPasswordHash,
      role: UserRole.SUPER_ADMIN,
      active: true,
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const initialUnits: Unit[] = [
    { id: 'unit_ash_shukr', name: 'Ash-Shukr', code: 'SHK', active: true },
    { id: 'unit_as_sabr', name: 'As-Sabr', code: 'SBR', active: true }
  ];

  const initialCategories: Category[] = [
    { id: 'cat_kids', name: 'Kids', startingChestNumber: 101, dobStart: '2019-01-01', dobEnd: '2026-12-31', active: true },
    { id: 'cat_sub_junior', name: 'Sub-Junior', startingChestNumber: 201, dobStart: '2016-01-01', dobEnd: '2018-12-31', active: true },
    { id: 'cat_junior', name: 'Junior', startingChestNumber: 301, dobStart: '2014-01-01', dobEnd: '2015-12-31', active: true },
    { id: 'cat_senior', name: 'Senior', startingChestNumber: 401, dobStart: '2010-01-01', dobEnd: '2013-12-31', active: true }
  ];

  // Default initial competitions array starts empty (0 programs) for new databases
  const initialCompetitions: Competition[] = [];

  const initialSettings: EventSettings = {
    eventTitle: 'A SMILE THAT BRINGS HEARTS TOGETHER',
    festivalName: 'At-Tabassum',
    campusName: 'Noorul Islam Madrasa, Jeppu',
    sectorName: 'Noorul Islam Madrasa, Jeppu',
    eventYear: '2026',
    cutoffDate: '2026-05-01',
    eventDate: '2026-08-15',
    venue: 'Jeppu',
    contactInfo: 'zenith.theorganizer@gmail.com',
    maxIndividualEvents: 10,
    maxGroupEvents: 10,
    maxOnStageEvents: null,
    maxOffStageEvents: null,
    registrationOpen: true,
    fillLogo: true,
    autoRemoveLogoBg: false,
    ssfLogoUrl: '/tabassum_logo.png',
    sahityotsavLogoUrl: '/tabassum_logo.png',
    primaryColor: 'emerald',
    accentColor: 'amber',
    numJudges: 2,
    markDecimalPrecision: 2,
    autoRankingEnabled: true,
    entityMode: 'team',
    gradeSystemEnabled: false,
    participantLoginCriteria: 'class',
    globalPointsRank1: 20,
    globalPointsRank2: 14,
    globalPointsRank3: 7,
    globalPointsRank4: 0,
    globalPointsRank5: 0,
    globalPointsRank6: 0,
    globalPointsRank7: 0,
    globalPointsRank8: 0,
    globalPointsRank9: 0,
    globalPointsRank10: 0
  };

  // Chest number counters - one per category, starting at the specified base values
  const initialCounters: Counter[] = [
    { id: 'counter_kids', categoryId: 'cat_kids', currentValue: 100 },
    { id: 'counter_sub_junior', categoryId: 'cat_sub_junior', currentValue: 200 },
    { id: 'counter_junior', categoryId: 'cat_junior', currentValue: 300 },
    { id: 'counter_senior', categoryId: 'cat_senior', currentValue: 400 }
  ];

  db = {
    users: initialUsers,
    loginAudits: [],
    auditLogs: [],
    units: initialUnits,
    categories: initialCategories,
    competitions: initialCompetitions,
    participants: [],
    teams: [],
    results: [],
    eventSettings: initialSettings,
    registrations: [],
    chestNumbers: [],
    counters: initialCounters,
    greenRoomAssignments: [],
    judgmentSheets: [],
    judgeScores: []
  };

  saveDb();
  console.log("Database initialized and seeded successfully");
}

// ============================================================
// HIGH-PERFORMANCE SAVE ENGINE
// ============================================================

const BACKUP_DIR = path.join(DB_DIR, 'backups');

export function performHourlyBackup() {
  if (!db || !Array.isArray(db.participants) || db.participants.length === 0) return;
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = path.join(BACKUP_DIR, `db_backup_${timestamp}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(db, null, 2), 'utf-8');
    console.log(`📦 [Hourly Backup Engine] Database snapshot saved to ${backupFilePath} (${db.participants.length} participants, ${db.results.length} results)`);

    // Maintain only the last 48 hourly backups
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
    if (files.length > 48) {
      const toDelete = files.slice(0, files.length - 48);
      toDelete.forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
    }
  } catch (err) {
    console.error("❌ Failed to perform hourly database backup:", err);
  }
}

// Trigger initial hourly backup on boot & set 60-min interval
setTimeout(performHourlyBackup, 5000);
setInterval(performHourlyBackup, 60 * 60 * 1000);

async function _syncMongoNow() {
  if (isMongoConnected && mongoClient && !isMongoConnecting && db) {
    try {
      const mongoUriStr = process.env.MONGO_URI || process.env.MONGODB_URI || '';
      const dbPath = mongoUriStr.includes('/') ? mongoUriStr.split('/').pop()?.split('?')[0] : null;
      const dbName = (dbPath && dbPath.length > 0) ? dbPath : 'sahityotsav';
      const mongoDb = mongoClient.db(dbName);

      // Dedicated per-collection updates to strictly prevent MongoDB 16MB document limit
      const collectionKeys = [
        'users', 'units', 'categories', 'competitions', 'participants', 'teams',
        'results', 'registrations', 'chestNumbers', 'counters', 'greenRoomAssignments',
        'judgmentSheets', 'judgeScores', 'gallery', 'videoHighlights', 'dragBlocks', 'heroMedia'
      ];

      for (const colName of collectionKeys) {
        const items = (db as any)[colName];
        if (Array.isArray(items)) {
          const col = mongoDb.collection(colName);
          const activeIds = items.map((i: any) => i.id || i._id).filter(Boolean);

          // Delete any document from MongoDB Atlas that was removed from memory
          if (activeIds.length > 0) {
            await col.deleteMany({
              $and: [
                { id: { $nin: activeIds } },
                { _id: { $nin: activeIds } }
              ]
            }).catch(() => { });
          }

          if (items.length > 0) {
            const ops = items.map((item: any) => {
              const docId = item.id || item._id;
              const { _id, ...rest } = item;
              return {
                updateOne: {
                  filter: { $or: [{ _id: docId }, { id: docId }] },
                  update: { $set: { id: docId, ...rest } },
                  upsert: true
                }
              };
            });
            await col.bulkWrite(ops, { ordered: false }).catch(err => {
              if (err.code !== 11000) console.error(`Mongo sync error (${colName}):`, err.message);
            });
          }
        }
      }

      // Sync all configuration & branding settings (keep eventSettings lightweight < 2KB)
      if (db.eventSettings) {
        const { posterTemplateConfig, certificateTemplateConfig, ...cleanSettings } = db.eventSettings as any;
        await mongoDb.collection('settings').replaceOne(
          { _id: 'eventSettings' as any },
          { _id: 'eventSettings', ...cleanSettings },
          { upsert: true }
        ).catch(() => { });
      }

      if (db.cmsSettings) {
        await mongoDb.collection('settings').replaceOne(
          { _id: 'cmsSettings' as any },
          { _id: 'cmsSettings', ...db.cmsSettings },
          { upsert: true }
        ).catch(() => { });
      }

      if (db.posterTemplateConfig) {
        await mongoDb.collection('settings').replaceOne(
          { _id: 'posterTemplateConfig' as any },
          { _id: 'posterTemplateConfig', ...db.posterTemplateConfig },
          { upsert: true }
        ).catch(() => { });
      }

      if (db.certificateTemplateConfig) {
        await mongoDb.collection('settings').replaceOne(
          { _id: 'certificateTemplateConfig' as any },
          { _id: 'certificateTemplateConfig', ...db.certificateTemplateConfig },
          { upsert: true }
        ).catch(() => { });
      }

      // Safe global_state sync only if total payload is strictly under 12MB
      const jsonStr = JSON.stringify(db);
      if (Buffer.byteLength(jsonStr, 'utf8') < 12 * 1024 * 1024 && mongoCollection) {
        await mongoCollection.replaceOne(
          { _id: 'global_state' as any },
          { ...db },
          { upsert: true }
        ).catch(() => { });
      }
    } catch (e: any) {
      console.error("MongoDB sync error:", e.message);
    }
  }
}

let _mongoSyncTimer: NodeJS.Timeout | null = null;
const MONGO_SYNC_DEBOUNCE_MS = 5000;


function _scheduleMongSync() {
  if (_mongoSyncTimer) clearTimeout(_mongoSyncTimer);
  _mongoSyncTimer = setTimeout(() => {
    _mongoSyncTimer = null;
    _syncMongoNow();
  }, MONGO_SYNC_DEBOUNCE_MS);
}

export async function saveDb() {
  if (!db) return;
  // Truncate logs in memory (fast, no I/O)
  if (db.auditLogs && db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(-500);
  }
  if (db.loginAudits && db.loginAudits.length > 500) {
    db.loginAudits = db.loginAudits.slice(-500);
  }

  // Write to local file synchronously so disk state is immediately persistent
  try {
    const data = JSON.stringify(db, null, 2);
    fs.writeFileSync(DB_FILE, data, 'utf-8');
  } catch (e) {
    console.error("Failed to serialize database", e);
  }

  // Sync to MongoDB Atlas in background without blocking the HTTP response
  _scheduleMongSync();
}

if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    if (_mongoSyncTimer) {
      clearTimeout(_mongoSyncTimer);
      _syncMongoNow().catch(() => {});
    }
  });
}

// Initialize on import
ensureDbExists();

// Start MongoDB connection in the background and sync
connectToMongo();

export function getCollection(name: string): Collection<any> | null {
  if (!mongoClient || !isMongoConnected) return null;
  const mongoUriStr = process.env.MONGO_URI || process.env.MONGODB_URI || '';
  const dbPath = mongoUriStr.includes('/') ? mongoUriStr.split('/').pop()?.split('?')[0] : null;
  const dbName = (dbPath && dbPath.length > 0) ? dbPath : 'sahityotsav';
  return mongoClient.db(dbName).collection(name);
}

export function getDb() {
  if (!mongoClient || !isMongoConnected) return null;
  const mongoUriStr = process.env.MONGO_URI || process.env.MONGODB_URI || '';
  const dbPath = mongoUriStr.includes('/') ? mongoUriStr.split('/').pop()?.split('?')[0] : null;
  const dbName = (dbPath && dbPath.length > 0) ? dbPath : 'sahityotsav';
  return mongoClient.db(dbName);
}

let localStateVersion = 0;
let lastVersionCheckTime = 0;

export async function bumpStateVersion() {
  localStateVersion = Date.now();
  if (!mongoClient || !isMongoConnected) return;
  try {
    const mongoDb = getDb();
    if (mongoDb) {
      await mongoDb.collection('settings').updateOne(
        { _id: 'state_version' as any },
        { $set: { _id: 'state_version', version: localStateVersion } },
        { upsert: true }
      ).catch(() => { });
    }
  } catch (_) { }
}

async function syncStateFromMongo(force: boolean = false) {
  if (!mongoClient || !isMongoConnected) return;
  const now = Date.now();
  if (!force && now - lastVersionCheckTime < 3000) return;
  lastVersionCheckTime = now;

  try {
    const mongoDb = getDb();
    if (!mongoDb) return;

    // Check remote state_version first (1 micro-query, ~1ms!)
    const versionDoc = await mongoDb.collection('settings').findOne({ _id: 'state_version' as any }).catch(() => null);
    const remoteVersion = versionDoc ? (versionDoc.version || 0) : 0;

    // If local instance is already up to date with MongoDB Atlas, skip fetching all 17 collections!
    if (!force && localStateVersion > 0 && remoteVersion <= localStateVersion) {
      return;
    }

    localStateVersion = remoteVersion || Date.now();

    const collectionKeys = [
      'users', 'units', 'categories', 'competitions', 'participants', 'teams',
      'results', 'registrations', 'chestNumbers', 'counters', 'greenRoomAssignments',
      'judgmentSheets', 'judgeScores', 'gallery', 'videoHighlights', 'dragBlocks', 'heroMedia'
    ];

    for (const colName of collectionKeys) {
      try {
        const docs = await mongoDb.collection(colName).find({}).toArray();
        if (docs) {
          const dedupeMap = new Map();
          docs.forEach((d: any) => {
            const docId = d.id || d._id;
            if (docId) {
              const { _id, ...rest } = d;
              dedupeMap.set(docId.toString(), { id: docId, ...rest });
            }
          });
          (db as any)[colName] = Array.from(dedupeMap.values());
        }
      } catch (_) { }
    }

    const mongoSettingsDocs = await mongoDb.collection('settings').find({}).toArray().catch(() => []);
    mongoSettingsDocs.forEach((doc: any) => {
      if (doc._id) {
        const { _id, ...rest } = doc;
        if (doc._id === 'eventSettings') db.eventSettings = { ...db.eventSettings, ...rest };
        if (doc._id === 'cmsSettings') db.cmsSettings = { ...rest };
        if (doc._id === 'posterTemplateConfig') db.posterTemplateConfig = { ...rest };
        if (doc._id === 'certificateTemplateConfig') db.certificateTemplateConfig = { ...rest };
      }
    });

    const existingState = await mongoDb.collection('app_state').findOne({ _id: 'global_state' as any });
    if (existingState) {
      const { _id, ...restOfState } = existingState;
      for (const [key, val] of Object.entries(restOfState)) {
        if (!collectionKeys.includes(key) && key !== 'eventSettings' && key !== 'cmsSettings') {
          if (Array.isArray(val)) {
            (db as any)[key] = val;
          } else if (val && typeof val === 'object') {
            (db as any)[key] = { ...(db as any)[key], ...val };
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in syncStateFromMongo:', err);
  }
}

export const dbClient = {
  waitForSync: async () => {
    await connectToMongo();
    await syncStateFromMongo(false);
  },

  forceSync: async () => {
    await _syncMongoNow();
    await bumpStateVersion();
  },

  get: () => {
    ensureDbExists();
    return db;
  },

  save: async () => {
    await saveDb();
    await bumpStateVersion();
  },

  // Audit helper — appends log to memory only (caller must call save() after)
  logAudit: async (actorId: string | undefined, actorUsername: string | undefined, actorRole: string | undefined, action: string, entityType: string, entityId: string, assignedUnitId?: string, previousData?: any, newData?: any) => {
    const log: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      actorUserId: actorId,
      actorUsername,
      actorRole,
      action,
      entityType,
      entityId,
      assignedUnitId,
      previousData: previousData ? JSON.stringify(previousData) : undefined,
      newData: newData ? JSON.stringify(newData) : undefined,
      timestamp: new Date().toISOString()
    };
    db.auditLogs.unshift(log); // newest first — memory only, fast
    return log;
  }
};
