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
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();

    const dbName = mongoUri.includes('/') 
      ? (mongoUri.split('/').pop()?.split('?')[0] || 'sahityotsav')
      : 'sahityotsav';

    const mongoDb = mongoClient.db(dbName);
    mongoCollection = mongoDb.collection('app_state');
    isMongoConnected = true;
    console.log(`=============================================================`);
    console.log(`🍃 Connected successfully to MongoDB: "${dbName}"`);
    console.log(`=============================================================`);

    // Synchronize current cache from MongoDB if it exists and has valid data
    const existingState = await mongoCollection.findOne({ _id: 'global_state' as any });
    const hasMongoData = existingState && Array.isArray(existingState.participants) && existingState.participants.length > 0;
    const hasLocalData = db && Array.isArray(db.participants) && db.participants.length > 0;

    if (hasMongoData) {
      console.log(`Found existing database state in MongoDB (${existingState.participants.length} participants). Synchronizing cache...`);
      const { _id, ...restOfState } = existingState;
      db = restOfState as any;
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
      } catch (_) {}
    } else if (hasLocalData) {
      console.log(`MongoDB state was empty. Preserving local state (${db.participants.length} participants) and pushing to MongoDB Atlas...`);
      await mongoCollection.replaceOne(
        { _id: 'global_state' as any },
        { ...db },
        { upsert: true }
      );
    } else if (existingState) {
      const { _id, ...restOfState } = existingState;
      db = restOfState as any;
    } else {
      console.log("No existing database state in MongoDB. Uploading initial seeded state...");
      await mongoCollection.replaceOne(
        { _id: 'global_state' as any },
        { ...db },
        { upsert: true }
      );
    }
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
    { id: 'unit_nekkila', name: 'Nekkila', code: 'NEK', active: true },
    { id: 'unit_muchila', name: 'Muchila', code: 'MUC', active: true },
    { id: 'unit_yenmoor', name: 'Yenmoor', code: 'YEN', active: true },
    { id: 'unit_ninthikal', name: 'Ninthikal', code: 'NIN', active: true },
    { id: 'unit_alekkadi', name: 'Alekkadi', code: 'ALE', active: true },
    { id: 'unit_samahadi', name: 'Samahadi', code: 'SAM', active: true },
    { id: 'unit_karimbila', name: 'Karimbila', code: 'KAR', active: true }
  ];

  const initialCategories: Category[] = [
    { id: 'cat_sub_junior', name: 'Sub-Junior', dobStart: '2014-05-01', dobEnd: '2020-04-30', active: true },
    { id: 'cat_junior', name: 'Junior', dobStart: '2009-05-01', dobEnd: '2014-04-30', active: true },
    { id: 'cat_senior', name: 'Senior', dobStart: '2003-05-01', dobEnd: '2009-04-30', active: true },
    { id: 'cat_general', name: 'General', dobStart: '1995-05-01', dobEnd: '2003-04-30', active: true },
    { id: 'cat_campus_junior', name: 'Campus Junior', dobStart: '1995-05-01', dobEnd: '2008-04-30', educationRequirements: [EducationStatus.UNDERGRADUATE], active: true },
    { id: 'cat_campus_senior', name: 'Campus Senior', dobStart: '1995-05-01', dobEnd: '2008-04-30', educationRequirements: [EducationStatus.POSTGRADUATE], active: true },
    { id: 'cat_campus_general', name: 'Campus General', dobStart: '1995-05-01', dobEnd: '2008-04-30', educationRequirements: [EducationStatus.UNDERGRADUATE, EducationStatus.POSTGRADUATE], active: true }
  ];

  const initialCompetitions: Competition[] = [];
  let order = 1;

  // Helper to add competition
  const addComp = (catId: string, name: string, type: ParticipationType, teamSize: number, duration: number, stage: StageType, lang?: string) => {
    initialCompetitions.push({
      id: `comp_${catId.replace('cat_', '')}_${order++}`,
      name,
      categoryId: catId,
      language: lang,
      participationType: type,
      teamSize,
      duration,
      stageType: stage,
      displayOrder: order,
      active: true
    });
  };

  // Seeding SUB-JUNIOR (7 events)
  addComp('cat_sub_junior', 'Elocution (English)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'English');
  addComp('cat_sub_junior', 'Elocution (Urdu)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Urdu');
  addComp('cat_sub_junior', 'Elocution (Kannada)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Kannada');
  addComp('cat_sub_junior', 'Naat (Urdu)', ParticipationType.INDIVIDUAL, 1, 5, StageType.ON_STAGE, 'Urdu');
  addComp('cat_sub_junior', 'Song (Kannada)', ParticipationType.INDIVIDUAL, 1, 5, StageType.ON_STAGE, 'Kannada');
  addComp('cat_sub_junior', 'Pencil Drawing', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE);
  addComp('cat_sub_junior', 'Storytelling (Kannada)', ParticipationType.INDIVIDUAL, 1, 3, StageType.ON_STAGE, 'Kannada');

  // Seeding JUNIOR (24 events)
  addComp('cat_junior', 'Elocution (English)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'English');
  addComp('cat_junior', 'Elocution (Urdu)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Urdu');
  addComp('cat_junior', 'Elocution (Kannada)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Kannada');
  addComp('cat_junior', 'Manqabat (Urdu)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Urdu');
  addComp('cat_junior', 'Naat (Urdu)', ParticipationType.GROUP, 3, 5, StageType.ON_STAGE, 'Urdu');
  addComp('cat_junior', 'Song (Kannada)', ParticipationType.INDIVIDUAL, 1, 5, StageType.ON_STAGE, 'Kannada');
  addComp('cat_junior', 'Poetry Recitation (Urdu)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_junior', 'Poetry Recitation (Hindi)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_junior', 'Storytelling (Urdu)', ParticipationType.INDIVIDUAL, 1, 5, StageType.ON_STAGE, 'Urdu');
  addComp('cat_junior', 'Storytelling (Kannada)', ParticipationType.INDIVIDUAL, 1, 5, StageType.ON_STAGE, 'Kannada');
  addComp('cat_junior', 'Reading (Urdu)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_junior', 'Reading (Hindi)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_junior', 'Reading (English)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'English');
  addComp('cat_junior', 'Reading (Arabic)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Arabic');
  addComp('cat_junior', 'Reading (Kannada)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_junior', 'Quiz', ParticipationType.INDIVIDUAL, 1, 0, StageType.ON_STAGE);
  addComp('cat_junior', 'Language Game (English)', ParticipationType.INDIVIDUAL, 1, 0, StageType.OFF_STAGE, 'English');
  addComp('cat_junior', 'Math Game (English)', ParticipationType.INDIVIDUAL, 1, 0, StageType.OFF_STAGE, 'English');
  addComp('cat_junior', 'Handwriting (English)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'English');
  addComp('cat_junior', 'Handwriting (Urdu)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_junior', 'Handwriting (Hindi)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_junior', 'Handwriting (Kannada)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_junior', 'Pencil Drawing', ParticipationType.INDIVIDUAL, 1, 45, StageType.OFF_STAGE);
  addComp('cat_junior', 'Painting (Water Color)', ParticipationType.INDIVIDUAL, 1, 45, StageType.OFF_STAGE);

  // Seeding SENIOR (26 events)
  addComp('cat_senior', 'Elocution (English)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'English');
  addComp('cat_senior', 'Elocution (Urdu)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Urdu');
  addComp('cat_senior', 'Elocution (Hindi)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Hindi');
  addComp('cat_senior', 'Elocution (Kannada)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Kannada');
  addComp('cat_senior', 'Manqabat (Urdu)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Urdu');
  addComp('cat_senior', 'Nasheeda (Arabic)', ParticipationType.GROUP, 4, 7, StageType.ON_STAGE, 'Arabic');
  addComp('cat_senior', 'Burda Sharif', ParticipationType.GROUP, 4, 7, StageType.ON_STAGE, 'Arabic'); // 3+1
  addComp('cat_senior', 'Salam-e-Raza', ParticipationType.GROUP, 3, 5, StageType.ON_STAGE, 'Urdu');
  addComp('cat_senior', 'Azan', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE);
  addComp('cat_senior', 'Poetry Recitation (Urdu)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_senior', 'Poetry Recitation (Hindi)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_senior', 'Poetry Recitation (English)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'English');
  addComp('cat_senior', 'Poetry Recitation (Kannada)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_senior', 'Quiz', ParticipationType.INDIVIDUAL, 1, 0, StageType.ON_STAGE);
  addComp('cat_senior', 'Essay Writing (Urdu)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_senior', 'Essay Writing (Hindi)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_senior', 'Essay Writing (English)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'English');
  addComp('cat_senior', 'Essay Writing (Kannada)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_senior', 'Story Writing (Urdu)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_senior', 'Story Writing (Hindi)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_senior', 'Story Writing (English)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'English');
  addComp('cat_senior', 'Story Writing (Kannada)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_senior', 'Calligraphy (Arabic)', ParticipationType.INDIVIDUAL, 1, 45, StageType.OFF_STAGE, 'Arabic');
  addComp('cat_senior', 'Kitab Test', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE);
  addComp('cat_senior', 'Translation (Arabic to Kannada)', ParticipationType.INDIVIDUAL, 1, 40, StageType.OFF_STAGE);
  addComp('cat_senior', 'Baith Hifz', ParticipationType.INDIVIDUAL, 1, 0, StageType.ON_STAGE);

  // Seeding GENERAL (29 events)
  addComp('cat_general', 'Elocution (English)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'English');
  addComp('cat_general', 'Elocution (Urdu)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Urdu');
  addComp('cat_general', 'Elocution (Hindi)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Hindi');
  addComp('cat_general', 'Elocution (Arabic)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Arabic');
  addComp('cat_general', 'Elocution (Kannada)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Kannada');
  addComp('cat_general', 'Hamd (Urdu)', ParticipationType.INDIVIDUAL, 1, 5, StageType.ON_STAGE, 'Urdu');
  addComp('cat_general', 'Poetry Recitation (Urdu)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_general', 'Poetry Recitation (Hindi)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_general', 'Poetry Recitation (English)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'English');
  addComp('cat_general', 'Poetry Recitation (Kannada)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_general', 'Qawwali (Urdu)', ParticipationType.GROUP, 5, 7, StageType.ON_STAGE, 'Urdu');
  addComp('cat_general', 'Nasheeda (Arabic)', ParticipationType.GROUP, 4, 7, StageType.ON_STAGE, 'Arabic');
  addComp('cat_general', 'Burda Sharif', ParticipationType.GROUP, 4, 7, StageType.ON_STAGE, 'Arabic'); // 3+1
  addComp('cat_general', 'Quiz', ParticipationType.INDIVIDUAL, 1, 0, StageType.ON_STAGE);
  addComp('cat_general', 'Poster Making', ParticipationType.INDIVIDUAL, 1, 45, StageType.OFF_STAGE);
  addComp('cat_general', 'Digital Designing', ParticipationType.INDIVIDUAL, 1, 60, StageType.OFF_STAGE);
  addComp('cat_general', 'Essay Writing (Urdu)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_general', 'Essay Writing (Hindi)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_general', 'Essay Writing (English)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'English');
  addComp('cat_general', 'Essay Writing (Arabic)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Arabic');
  addComp('cat_general', 'Essay Writing (Kannada)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_general', 'Poetry Writing (English)', ParticipationType.INDIVIDUAL, 1, 40, StageType.OFF_STAGE, 'English');
  addComp('cat_general', 'Poetry Writing (Kannada)', ParticipationType.INDIVIDUAL, 1, 40, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_general', 'Translation (Urdu to English)', ParticipationType.INDIVIDUAL, 1, 40, StageType.OFF_STAGE);
  addComp('cat_general', 'Mushaira', ParticipationType.INDIVIDUAL, 1, 0, StageType.ON_STAGE);
  addComp('cat_general', 'Ibarath Reading', ParticipationType.INDIVIDUAL, 1, 10, StageType.OFF_STAGE);
  addComp('cat_general', 'Debate (Kannada)', ParticipationType.INDIVIDUAL, 1, 60, StageType.ON_STAGE, 'Kannada');
  addComp('cat_general', 'Revolutionary Song Writing (Urdu)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_general', 'Slogan Writing (Urdu)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Urdu');

  // Seeding CAMPUS JUNIOR (25 events)
  addComp('cat_campus_junior', 'Elocution (English)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'English');
  addComp('cat_campus_junior', 'Elocution (Urdu)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Urdu');
  addComp('cat_campus_junior', 'Elocution (Hindi)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Hindi');
  addComp('cat_campus_junior', 'Elocution (Kannada)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Kannada');
  addComp('cat_campus_junior', 'Poetry Recitation (English)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'English');
  addComp('cat_campus_junior', 'Poetry Recitation (Hindi)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_campus_junior', 'Poetry Recitation (Kannada)', ParticipationType.INDIVIDUAL, 1, 3, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_campus_junior', 'Hamd (Urdu)', ParticipationType.INDIVIDUAL, 1, 5, StageType.ON_STAGE, 'Urdu');
  addComp('cat_campus_junior', 'Song (Kannada)', ParticipationType.INDIVIDUAL, 1, 5, StageType.ON_STAGE, 'Kannada');
  addComp('cat_campus_junior', 'Digital Designing', ParticipationType.INDIVIDUAL, 1, 60, StageType.OFF_STAGE);
  addComp('cat_campus_junior', 'Essay Writing (Urdu)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_campus_junior', 'Essay Writing (Hindi)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_campus_junior', 'Essay Writing (English)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'English');
  addComp('cat_campus_junior', 'Essay Writing (Kannada)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_campus_junior', 'Story Writing (English)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'English');
  addComp('cat_campus_junior', 'Story Writing (Hindi)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Hindi');
  addComp('cat_campus_junior', 'Story Writing (Kannada)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_campus_junior', 'Translation (Urdu to English)', ParticipationType.INDIVIDUAL, 1, 40, StageType.OFF_STAGE);
  addComp('cat_campus_junior', 'Translation (English to Hindi)', ParticipationType.INDIVIDUAL, 1, 40, StageType.OFF_STAGE);
  addComp('cat_campus_junior', 'Social Tweet (English)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'English');
  addComp('cat_campus_junior', 'News Report Writing (English)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'English');
  addComp('cat_campus_junior', 'News Report Writing (Urdu)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_campus_junior', 'News Report Writing (Kannada)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Kannada');
  addComp('cat_campus_junior', 'AI Prompting', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE);
  addComp('cat_campus_junior', 'Reel Making', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE);

  // Seeding CAMPUS GENERAL (5 events)
  addComp('cat_campus_general', 'Naat (Urdu)', ParticipationType.GROUP, 3, 5, StageType.ON_STAGE, 'Urdu');
  addComp('cat_campus_general', 'Quiz', ParticipationType.GROUP, 2, 0, StageType.ON_STAGE);
  addComp('cat_campus_general', 'Spot Magazine', ParticipationType.GROUP, 5, 60, StageType.OFF_STAGE);
  addComp('cat_campus_general', 'Collage', ParticipationType.GROUP, 3, 60, StageType.OFF_STAGE);
  addComp('cat_campus_general', 'Project Submission', ParticipationType.GROUP, 5, 60, StageType.OFF_STAGE);

  // Seeding CAMPUS SENIOR (15 events)
  addComp('cat_campus_senior', 'Hamd (Urdu)', ParticipationType.INDIVIDUAL, 1, 5, StageType.ON_STAGE, 'Urdu');
  addComp('cat_campus_senior', 'PPT Presentation', ParticipationType.GROUP, 2, 20, StageType.ON_STAGE);
  addComp('cat_campus_senior', 'Thematic Presentation', ParticipationType.INDIVIDUAL, 1, 7, StageType.ON_STAGE);
  addComp('cat_campus_senior', 'Newsletter', ParticipationType.GROUP, 3, 20, StageType.OFF_STAGE);
  addComp('cat_campus_senior', 'Literary Criticism', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE);
  addComp('cat_campus_senior', 'Revolutionary Song Writing (Urdu)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_campus_senior', 'Debate', ParticipationType.INDIVIDUAL, 1, 60, StageType.ON_STAGE);
  addComp('cat_campus_senior', 'Feature Writing', ParticipationType.INDIVIDUAL, 1, 60, StageType.OFF_STAGE);
  addComp('cat_campus_senior', 'Abstract Writing', ParticipationType.INDIVIDUAL, 1, 60, StageType.OFF_STAGE);
  addComp('cat_campus_senior', 'Essay (Urdu)', ParticipationType.INDIVIDUAL, 1, 20, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_campus_senior', 'Slogan Writing (Urdu)', ParticipationType.INDIVIDUAL, 1, 30, StageType.OFF_STAGE, 'Urdu');
  addComp('cat_campus_senior', 'Ideathon', ParticipationType.INDIVIDUAL, 1, 15, StageType.ON_STAGE);
  addComp('cat_campus_senior', 'Vlog Making', ParticipationType.INDIVIDUAL, 1, 7, StageType.OFF_STAGE);
  addComp('cat_campus_senior', 'Song (Kannada)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Kannada');
  addComp('cat_campus_senior', 'Elocution (Kannada)', ParticipationType.INDIVIDUAL, 1, 4, StageType.ON_STAGE, 'Kannada');

  const initialSettings: EventSettings = {
    eventTitle: 'SSF Ninthikal Sector Sahityotsav',
    sectorName: 'Ninthikal Sector',
    eventYear: '2026',
    cutoffDate: '2026-05-01',
    eventDate: '2026-08-15',
    venue: 'Ninthikal Town Hall',
    contactInfo: 'info@ssf-ninthikal.org',
    maxIndividualEvents: 3,
    maxGroupEvents: 2,
    registrationOpen: true,
    ssfLogoUrl: 'https://i.pinimg.com/736x/db/ce/0f/dbce0ffa11c023edfc378a85a0259145.jpg', // Official SSF Logo
    sahityotsavLogoUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=128&q=80', // Beautiful literary art vector placeholder
    primaryColor: 'emerald',
    accentColor: 'amber',
    numJudges: 2,
    markDecimalPrecision: 2,
    autoRankingEnabled: true
  };

  // Chest number counters - one per category, starting at the specified base values
  const initialCounters: Counter[] = [
    { id: 'counter_sub_junior', categoryId: 'cat_sub_junior', currentValue: 999 },
    { id: 'counter_junior', categoryId: 'cat_junior', currentValue: 1999 },
    { id: 'counter_senior', categoryId: 'cat_senior', currentValue: 2999 },
    { id: 'counter_campus_junior', categoryId: 'cat_campus_junior', currentValue: 3999 },
    { id: 'counter_campus_senior', categoryId: 'cat_campus_senior', currentValue: 4999 },
    { id: 'counter_general', categoryId: 'cat_general', currentValue: 5999 },
    { id: 'counter_campus_general', categoryId: 'cat_campus_general', currentValue: 6999 }
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

function _syncMongoNow() {
  if (isMongoConnected && mongoCollection && !isMongoConnecting && db && Array.isArray(db.participants)) {
    mongoCollection.replaceOne(
      { _id: 'global_state' as any },
      { ...db },
      { upsert: true }
    ).catch(e => console.error("MongoDB sync error:", e));
  }
}

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

  // Write to local file (compact JSON, non-blocking)
  try {
    const data = JSON.stringify(db);
    fs.writeFile(DB_FILE, data, 'utf-8', (err) => {
      if (err) console.error("Failed to write db file:", err);
    });
  } catch (e) {
    console.error("Failed to serialize database", e);
  }

  // Schedule a debounced MongoDB sync (non-blocking)
  _scheduleMongSync();
}

// Initialize on import
ensureDbExists();

// Start MongoDB connection in the background and sync
connectToMongo();

export const dbClient = {
  waitForSync: () => {
    return connectToMongo();
  },

  forceSync: async () => {
    if (isMongoConnected && mongoCollection) {
      try {
        const existingState = await mongoCollection.findOne({ _id: 'global_state' as any });
        if (existingState) {
          const { _id, ...restOfState } = existingState;
          db = restOfState as any;
        }
      } catch (e) {
        console.error("Force sync failed", e);
      }
    }
  },

  get: () => {
    ensureDbExists();
    return db;
  },
  
  save: async () => {
    await saveDb();
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
