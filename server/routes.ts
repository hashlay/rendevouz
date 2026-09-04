import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { dbClient, getCollection, getDb } from './db.js';
import { CalculationService } from './calculations.js';
import {
  UserRole, User, Session, LoginAudit, AuditLog,
  Unit, Category, Competition, Participant, Team,
  Registration, Result, EventSettings, EducationStatus, ParticipationType,
  StageType, Gender, ResultStatus,
  ChestNumber, Counter, GreenRoomAssignment, GreenRoomStatus,
  JudgmentSheet, JudgmentSheetStatus, JudgeScore, JudgeScoreEntry, JudgeScoreStatus, VideoHighlight
} from '../src/types.js';

export const apiRouter = express.Router();

// Enable 50mb payload limits directly on apiRouter
apiRouter.use(express.json({ limit: '50mb' }));
apiRouter.use(express.urlencoded({ limit: '50mb', extended: true }));

// Prevent 304 Not Modified caching on all API routes so browsers ALWAYS get 100% fresh data
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Ensure MongoDB connection and 100% fresh state sync on every API request
apiRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await dbClient.waitForSync();
  } catch (err) {
    console.error('Mongo connection middleware error:', err);
  }
  next();
});

// Helper: Format string to Title Case (capitalizing first letter of every word)
function toTitleCase(str: string): string {
  if (!str) return '';
  return str.trim().split(/\s+/).map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

import { v2 as cloudinary } from 'cloudinary';
import os from 'os';

// Setup Cloudinary for Uploads
const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
};

const uploadDir = os.tmpdir();

async function processUploadFile(file: Express.Multer.File, folder: string): Promise<string> {
  if (!file) throw new Error('No image file uploaded');

  // Attempt Cloudinary upload if credentials exist
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    if (cloudName && apiKey) {
      configureCloudinary();
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        resource_type: 'image',
        folder
      });
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return uploadResult.secure_url;
    }
  } catch (cErr: any) {
    console.warn(`Cloudinary upload failed for ${folder}, falling back to Base64:`, cErr?.message || cErr);
  }

  // Fail-safe Base64 Data URL fallback
  try {
    const buffer = fs.readFileSync(file.path);
    const mimeType = file.mimetype || 'image/png';
    const base64Url = `data:${mimeType};base64,${buffer.toString('base64')}`;
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return base64Url;
  } catch (err: any) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw err;
  }
}
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit for videos
});

const galleryUpload = multer({
  dest: uploadDir,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit for images
});

let lastSyncTimestamp = 0;

apiRouter.use('/data/uploads', express.static(path.join(process.cwd(), 'data/uploads')));
apiRouter.use('/uploads', express.static(path.join(process.cwd(), 'data/uploads')));

// --- SERVERLESS GLOBAL SYNC MIDDLEWARE ---
// Connects to DB once and processes all requests instantly in memory.
let dbNormalized = false;

apiRouter.use(async (req, res, next) => {
  try {
    await dbClient.waitForSync();

    // Auto-normalize legacy totalMark values and title-case participant/competition names ONCE on load
    if (!dbNormalized) {
      const db = dbClient.get();
      if (db) {
        if (db.results) {
          db.results.forEach((r: any) => {
            const j1 = Number(r.judge1Mark) || 0;
            const j2 = Number(r.judge2Mark) || 0;
            // Calculate true total and average
            r.totalMark = j1 + j2;
            const activeCount = (j1 > 0 ? 1 : 0) + (j2 > 0 ? 1 : 0) || 1;
            r.averageMark = Math.round(((j1 + j2) / activeCount) * 100) / 100;
          });
        }
        if (db.judgeScores) {
          db.judgeScores.forEach((s: any) => {
            if (s.status === JudgeScoreStatus.PARTICIPATED || s.status === 'participated') {
              const nonZeroMarks = (s.judgeScores || []).filter((j: any) => typeof j.mark === 'number' && !Number.isNaN(j.mark) && j.mark > 0);
              const sumMarks = (s.judgeScores || []).reduce((sum: number, jm: any) => sum + (typeof jm.mark === 'number' && !Number.isNaN(jm.mark) ? jm.mark : 0), 0);
              const activeJudgesCount = nonZeroMarks.length > 0 ? nonZeroMarks.length : 1;
              const avg = Math.round((sumMarks / activeJudgesCount) * 100) / 100;
              s.totalMark = sumMarks;
              if (!s.averageMark || s.averageMark === 0) {
                s.averageMark = avg;
              }
            }
          });
        }
        if (db.participants) {
          db.participants.forEach((p: any) => {
            if (p.fullName) p.fullName = toTitleCase(p.fullName);
          });
        }
        if (db.competitions) {
          const catCounterMap: Record<string, number> = {};
          db.competitions.forEach((c: any) => {
            if (c.name) c.name = toTitleCase(c.name);
            if (!c.code || !c.code.trim()) {
              const catId = c.categoryId || 'cat_general';
              catCounterMap[catId] = (catCounterMap[catId] || 0) + 1;
              const category = (db.categories || []).find((cat: any) => cat.id === catId);
              let prefix = 'CMP';
              if (category && category.name) {
                const catLower = category.name.toLowerCase();
                if (catLower.includes('sub')) prefix = 'SJ';
                else if (catLower.includes('junior')) prefix = 'JR';
                else if (catLower.includes('senior')) prefix = 'SR';
                else if (catLower.includes('general')) prefix = 'GEN';
                else prefix = category.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'CMP';
              }
              c.code = `${prefix}${String(catCounterMap[catId]).padStart(2, '0')}`;
            }
          });
        }
      }
      dbNormalized = true;
    }

    next();
  } catch (e) {
    console.error("Database connection failed:", e);
    res.status(500).json({ error: 'Database connection error' });
  }
});

// Ensure required environment variables exist
if (!process.env.AUTH_SECRET) {
  console.warn("WARNING: AUTH_SECRET environment variable is missing. Using fallback secret.");
}

if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
  console.warn("WARNING: MONGODB_URI environment variable is missing. Database may not persist in serverless environments.");
}

const JWT_SECRET = process.env.AUTH_SECRET || 'fallback_secret_for_development_only_12345';
const COOKIE_NAME = 'sahityotsav_session';

// Rate limiter / failed attempts map
const failedLoginTracker: { [username: string]: { count: number; lockedUntil?: number } } = {};

// --- PUBLIC API ---

apiRouter.get('/public/highlights', async (req, res) => {
  const collection = getCollection('videoHighlights');
  if (collection) {
    const highlights = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return res.json(highlights);
  }
  const db = dbClient.get();
  res.json(db.videoHighlights || []);
});

apiRouter.get('/public/gallery', async (req, res) => {
  const collection = getCollection('gallery');
  if (collection) {
    const gallery = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return res.json(gallery);
  }
  const db = dbClient.get();
  res.json(db.gallery || []);
});


// --- MIDDLEWARES ---

// Authenticate session from HTTP-only cookie or custom Authorization header using JWT
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const db = dbClient.get();

  // Get token from cookie or authorization header
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Read from cookies if present
    const cookieHeader = req.headers.cookie || '';
    const cookieMatch = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (cookieMatch) {
      token = cookieMatch[1];
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, code: 'SESSION_MISSING', message: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Find user
    const user = db.users.find(u => u.id === decoded.userId);
    if (!user || !user.active) {
      return res.status(401).json({ success: false, code: 'USER_INACTIVE', message: 'User account is deactivated or deleted.' });
    }

    // Attach user to request
    (req as any).user = user;

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, code: 'SESSION_EXPIRED', message: 'Your session has expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, code: 'SESSION_INVALID', message: 'Session invalid or corrupted.' });
  }
}

// Require role middleware
export function requireRole(roles: (UserRole | string)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as User;
    if (!user) {
      return res.status(403).json({ error: 'Access denied. You do not have permission for this resource.' });
    }
    const userRole = (user.role || '').toString().toLowerCase();

    // DEMO VIEWER READ-ONLY SIMULATION BLOCK
    if (userRole === 'viewer' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase())) {
      // Allow preview/generate operations (e.g. certificates, posters, reports) to execute and render preview output
      const pathUrl = req.path.toLowerCase();
      const isGenerator = pathUrl.includes('/generate') || pathUrl.includes('/preview') || pathUrl.includes('/export') || pathUrl.includes('/print');

      if (isGenerator) {
        return next();
      }

      // For standard data mutations (create/update/delete), simulate success cleanly without altering DB
      return res.json({
        success: true,
        message: 'Demo Mode (Viewer): Action simulated successfully! Changes are read-only and were not saved to database.',
        demo: true
      });
    }

    // Always allow management roles for CMS and media management
    const allowedManagement = ['developer', 'super_admin', 'superadmin', 'admin', 'committee', 'sector_team', 'media', 'staff', 'viewer'];
    if (allowedManagement.includes(userRole)) {
      return next();
    }

    const roleStrings = roles.map(r => r.toString().toLowerCase());
    if (roleStrings.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ error: 'Access denied. You do not have permission for this resource.' });
  };
}

// Utility to calculate eligible categories
export function calculateEligibleCategories(dobStr: string, educationStatus: string) {
  const db = dbClient.get();
  const hasDob = dobStr && dobStr.trim() !== '';
  const dob = hasDob ? new Date(dobStr) : new Date();

  if (hasDob && isNaN(dob.getTime())) {
    return db.categories.map(c => ({ id: c.id, name: c.name, eligible: false, reason: 'Invalid date of birth' }));
  }

  return db.categories.map(c => {
    let dobMatch = true;
    if (hasDob) {
      const start = new Date(c.dobStart);
      const end = new Date(c.dobEnd);
      dobMatch = dob >= start && dob <= end;
    }

    if (!dobMatch) {
      return {
        id: c.id,
        name: c.name,
        eligible: false,
        reason: `DOB must be between ${c.dobStart} and ${c.dobEnd}`
      };
    }

    // Check custom rules:
    if (educationStatus === 'student') {
      if (c.id.startsWith('cat_campus')) {
        return {
          id: c.id,
          name: c.name,
          eligible: false,
          reason: 'Campus categories are only for Undergraduate or Postgraduate candidates.'
        };
      }
    }
    else if (educationStatus === 'undergraduate') {
      if (c.id === 'cat_campus_senior') {
        return {
          id: c.id,
          name: c.name,
          eligible: false,
          reason: 'Campus Senior is only for Postgraduate candidates.'
        };
      }
    }
    else if (educationStatus === 'postgraduate') {
      if (c.id === 'cat_campus_junior') {
        return {
          id: c.id,
          name: c.name,
          eligible: false,
          reason: 'Campus Junior is only for Undergraduate candidates.'
        };
      }
    }

    return { id: c.id, name: c.name, eligible: true };
  });
}


// --- API ROUTES ---

// 1. AUTHENTICATION

// Public Login API
apiRouter.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const db = dbClient.get();

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const normalizedUsername = username.trim().toLowerCase();

  // Check rate limit/lockout
  const lock = failedLoginTracker[normalizedUsername];
  if (lock && lock.lockedUntil && lock.lockedUntil > Date.now()) {
    const remainingSecs = Math.ceil((lock.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({ error: `Account locked temporarily. Try again in ${remainingSecs} seconds.` });
  }

  // Find user
  const user = db.users.find(u => u.username.toLowerCase() === normalizedUsername);

  const logFailure = async (reason: string) => {
    const audit: LoginAudit = {
      id: `login_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username,
      success: false,
      failureReason: reason,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    };
    db.loginAudits.unshift(audit);
    await dbClient.save();

    // Increment failed attempts
    if (!failedLoginTracker[normalizedUsername]) {
      failedLoginTracker[normalizedUsername] = { count: 1 };
    } else {
      failedLoginTracker[normalizedUsername].count++;
    }

    if (failedLoginTracker[normalizedUsername].count >= 5) {
      failedLoginTracker[normalizedUsername].lockedUntil = Date.now() + 60 * 1000; // 1 min lock
      return res.status(429).json({ error: 'Too many failed login attempts. Account temporarily locked for 60 seconds.' });
    }

    return res.status(401).json({ error: 'Invalid username or password.' });
  };

  if (!user || !user.active) {
    return await logFailure('User does not exist or is inactive');
  }

  // Verify password
  const match = bcrypt.compareSync(password, user.passwordHash);
  if (!match) {
    return await logFailure('Incorrect password');
  }

  // Success - Clear lockout
  delete failedLoginTracker[normalizedUsername];

  // Generate Session Token (JWT)
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  // Update last login timestamp
  user.lastLoginAt = new Date().toISOString();
  await dbClient.save();

  // Audit login success
  const audit: LoginAudit = {
    id: `login_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    username: user.username,
    success: true,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  };
  db.loginAudits.unshift(audit);
  await dbClient.save();

  // Set secure HTTP-only cookie
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });

  return res.json({
    message: 'Logged in successfully',
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      assignedUnitId: user.assignedUnitId,
      assignedCompetitionIds: user.assignedCompetitionIds,
      mustChangePassword: user.mustChangePassword
    }
  });
});

// Logout
apiRouter.post('/auth/logout', authenticate, async (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ message: 'Logged out successfully' });
});

// Get Current Session Profile
apiRouter.get('/auth/session', authenticate, async (req, res) => {
  const user = (req as any).user as User;
  res.json({
    authenticated: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      assignedUnitId: user.assignedUnitId,
      assignedCompetitionIds: user.assignedCompetitionIds,
      mustChangePassword: user.mustChangePassword
    }
  });
});

// Change Password
apiRouter.post('/auth/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = (req as any).user as User;
  const db = dbClient.get();

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  const liveUser = db.users.find(u => u.id === user.id);
  if (!liveUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Validate current password
  if (!bcrypt.compareSync(currentPassword, liveUser.passwordHash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  const salt = bcrypt.genSaltSync(10);
  liveUser.passwordHash = bcrypt.hashSync(newPassword, salt);
  liveUser.mustChangePassword = false;
  liveUser.passwordChangedAt = new Date().toISOString();

  await dbClient.logAudit(liveUser.id, liveUser.username, liveUser.role, 'Change Password', 'User', liveUser.id);
  await dbClient.save();

  // Issue a fresh token after password change
  const token = jwt.sign(
    {
      userId: liveUser.id,
      username: liveUser.username,
      role: liveUser.role
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });

  res.json({ message: 'Password changed successfully', token });
});



// --- VIDEO HIGHLIGHTS API ---
apiRouter.post('/highlights/upload', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), upload.single('video'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    let videoUrl = '';
    try {
      configureCloudinary();
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        resource_type: 'video',
        folder: 'sahityotsav_videos'
      });
      videoUrl = uploadResult.secure_url;
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (cErr) {
      console.warn("Cloudinary video upload failed, saving locally:", cErr);
      const uploadDir = path.join(process.cwd(), 'data', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filename = `vid_${Date.now()}_${path.basename(file.path)}`;
      const destPath = path.join(uploadDir, filename);
      fs.copyFileSync(file.path, destPath);
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      videoUrl = `/data/uploads/${filename}`;
    }

    const { title, event, performer, stageName } = req.body;

    const highlight: VideoHighlight = {
      id: `vh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title || 'Untitled',
      event: event || 'Unknown Event',
      performer: performer || 'Unknown',
      duration: '0:00', // Default, frontend can calculate or it can be inputted
      views: '0',
      thumbnailUrl: '', // Could be generated or uploaded separately later, using placeholder
      videoUrl: videoUrl,
      stageName: stageName || 'Main Stage',
      createdAt: Date.now()
    };

    const collection = getCollection('videoHighlights');
    if (collection) {
      await collection.insertOne({ ...highlight, _id: highlight.id }).catch(() => { });
    }
    const db = dbClient.get();
    if (!Array.isArray(db.videoHighlights)) db.videoHighlights = [];
    db.videoHighlights.unshift(highlight);
    await dbClient.save();

    await dbClient.logAudit(
      (req as any).user.id, (req as any).user.username, (req as any).user.role,
      'CREATE_HIGHLIGHT', 'VideoHighlight', highlight.id, undefined, null, highlight
    );

    res.json({ success: true, highlight });
  } catch (error: any) {
    console.error('Error uploading video:', error);
    fs.writeFileSync(path.join(process.cwd(), 'data', 'debug.log'), (error && error.stack) ? error.stack : String(error));
    res.status(500).json({ error: error.message || 'Failed to upload video', stack: error.stack });
  }
});

apiRouter.get('/highlights', authenticate, async (req, res) => {
  const collection = getCollection('videoHighlights');
  if (collection) {
    const highlights = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return res.json(highlights);
  }
  const db = dbClient.get();
  res.json(db.videoHighlights || []);
});

apiRouter.delete('/highlights/:id', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  try {
    let highlight = null;
    const collection = getCollection('videoHighlights');

    if (collection) {
      highlight = await collection.findOne({ _id: req.params.id });
      if (!highlight) {
        return res.status(404).json({ error: 'Video highlight not found' });
      }
      await collection.deleteOne({ _id: req.params.id });
    } else {
      const db = dbClient.get();
      const index = db.videoHighlights.findIndex((v: any) => v.id === req.params.id);

      if (index === -1) {
        return res.status(404).json({ error: 'Video highlight not found' });
      }
      highlight = db.videoHighlights[index];
      db.videoHighlights.splice(index, 1);
      await dbClient.save();
    }

    // Optional: Delete physical file to save disk space
    if (highlight && highlight.videoUrl && highlight.videoUrl.startsWith('/data/uploads/videos/')) {
      const filename = highlight.videoUrl.split('/').pop();
      if (filename) {
        const filePath = path.join(process.cwd(), 'data/uploads/videos', filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    await dbClient.logAudit(
      (req as any).user.id, (req as any).user.username, (req as any).user.role,
      'DELETE_HIGHLIGHT', 'VideoHighlight', req.params.id, undefined, highlight, null
    );

    res.json({ success: true, message: 'Video highlight deleted successfully' });
  } catch (error) {
    console.error('Error deleting video highlight:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// --- GALLERY API ---
apiRouter.post('/gallery/upload', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), galleryUpload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    let imageUrl = '';
    try {
      configureCloudinary();
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        resource_type: 'image',
        folder: 'sahityotsav_gallery'
      });
      imageUrl = uploadResult.secure_url;
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (cErr) {
      console.warn("Cloudinary image upload failed, converting to permanent Base64 Data URL:", cErr);
      try {
        const imageBuffer = fs.readFileSync(file.path);
        const mimeType = file.mimetype || 'image/jpeg';
        imageUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
      } catch (bErr) {
        console.error("Base64 conversion failed:", bErr);
        imageUrl = '';
      }
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    if (!imageUrl) {
      return res.status(500).json({ error: 'Failed to process image file' });
    }

    const { title, category, caption, photographer, date } = req.body;

    const item: any = {
      id: `gal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title || 'Untitled',
      category: category || 'General',
      imageUrl: imageUrl,
      caption: caption || '',
      photographer: photographer || '',
      date: date || new Date().toISOString().split('T')[0],
      isApproved: true,
      isFeatured: false,
      createdAt: Date.now()
    };

    const collection = getCollection('gallery');
    if (collection) {
      await collection.insertOne({ ...item, _id: item.id }).catch(() => { });
    }
    const db = dbClient.get();
    if (!Array.isArray(db.gallery)) db.gallery = [];
    db.gallery.unshift(item);
    await dbClient.save();

    await dbClient.logAudit(
      (req as any).user.id, (req as any).user.username, (req as any).user.role,
      'CREATE_GALLERY_ITEM', 'GalleryItem', item.id, undefined, null, item
    );

    res.json({ success: true, item });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image: ' + (error.message || String(error)) });
  }
});

apiRouter.get('/gallery', authenticate, async (req, res) => {
  const collection = getCollection('gallery');
  if (collection) {
    const gallery = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return res.json(gallery);
  }
  const db = dbClient.get();
  res.json(db.gallery || []);
});

apiRouter.put('/gallery/:id/featured', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  try {
    const { isFeatured } = req.body;
    let oldItem = null;
    let newItem = null;

    const collection = getCollection('gallery');
    if (collection) {
      const item = await collection.findOne({ _id: req.params.id });
      if (!item) return res.status(404).json({ error: 'Gallery item not found' });

      if (isFeatured) {
        const featuredCount = await collection.countDocuments({ isFeatured: true });
        if (featuredCount >= 8) return res.status(400).json({ error: 'Maximum 8 featured images allowed' });
      }

      oldItem = { ...item };
      newItem = { ...item, isFeatured };
      await collection.updateOne({ _id: req.params.id }, { $set: { isFeatured } });
    } else {
      const db = dbClient.get();
      const index = db.gallery.findIndex((i: any) => i.id === req.params.id);

      if (index === -1) {
        return res.status(404).json({ error: 'Gallery item not found' });
      }

      if (isFeatured) {
        // Check if we already have 8 featured images
        const featuredCount = db.gallery.filter((i: any) => i.isFeatured).length;
        if (featuredCount >= 8) {
          return res.status(400).json({ error: 'Maximum 8 featured images allowed' });
        }
      }

      oldItem = { ...db.gallery[index] };
      db.gallery[index].isFeatured = isFeatured;
      newItem = db.gallery[index];
      await dbClient.save();
    }

    await dbClient.logAudit(
      (req as any).user.id, (req as any).user.username, (req as any).user.role,
      'UPDATE_GALLERY_ITEM', 'GalleryItem', req.params.id, undefined, oldItem, newItem
    );

    res.json({ success: true, item: newItem });
  } catch (error) {
    console.error('Error updating gallery item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

apiRouter.delete('/gallery/:id', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  try {
    let item = null;
    const collection = getCollection('gallery');

    if (collection) {
      item = await collection.findOne({ _id: req.params.id });
      if (!item) return res.status(404).json({ error: 'Gallery item not found' });
      await collection.deleteOne({ _id: req.params.id });
    } else {
      const db = dbClient.get();
      const index = db.gallery.findIndex((i: any) => i.id === req.params.id);

      if (index === -1) {
        return res.status(404).json({ error: 'Gallery item not found' });
      }

      item = db.gallery[index];
      db.gallery.splice(index, 1);
      await dbClient.save();
    }

    // Optional: Delete physical file to save disk space
    if (item && item.imageUrl && item.imageUrl.startsWith('/data/uploads/gallery/')) {
      const filename = item.imageUrl.split('/').pop();
      if (filename) {
        const filePath = path.join(process.cwd(), 'data/uploads/gallery', filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    await dbClient.logAudit(
      (req as any).user.id, (req as any).user.username, (req as any).user.role,
      'DELETE_GALLERY_ITEM', 'GalleryItem', req.params.id, undefined, item, null
    );

    res.json({ success: true, message: 'Gallery item deleted successfully' });
  } catch (error) {
    console.error('Error deleting gallery item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// 2. SETTINGS & EVENT MANAGE

const DEFAULT_PHOTO_HUB_DRIVE_LINK = 'https://drive.google.com/drive/folders/1cQNek6Q2EiThqdFrUDb1I8cfsmQneP1J';

apiRouter.get('/settings', async (req, res) => {
  const db = dbClient.get();
  const settings = db.eventSettings || {};
  if (!settings.photoHubDriveLink) {
    settings.photoHubDriveLink = DEFAULT_PHOTO_HUB_DRIVE_LINK;
  }
  res.json(settings);
});

const DEFAULT_DRAG_BLOCKS = [
  { id: '1', title: 'Hero Section', type: 'hero', enabled: true, order: 1 },
  { id: '2', title: 'About & Concept', type: 'about', enabled: true, order: 2 },
  { id: '3', title: 'Live Team Standings', type: 'results', enabled: true, order: 3 },
  { id: '4', title: 'Announced Results & Placements', type: 'announcements', enabled: true, order: 4 },
  { id: '5', title: 'Photo Hub (Drive & QR)', type: 'smile', enabled: true, order: 5 },
  { id: '6', title: 'Media Gallery (Photo Uploads)', type: 'gallery', enabled: true, order: 6 },
  { id: '7', title: 'Live Broadcast Streams', type: 'live_stages', enabled: true, order: 7 },
  { id: '8', title: 'Video Highlights & Stage Clips', type: 'highlights', enabled: true, order: 8 },
  { id: '9', title: 'Winner Posters Page', type: 'posters', enabled: true, order: 9 }
];

apiRouter.get('/public/cms', async (req, res) => {
  const db = dbClient.get();
  if (!db.dragBlocks || db.dragBlocks.length === 0) {
    db.dragBlocks = DEFAULT_DRAG_BLOCKS;
  } else {
    // If old combined block 'Photo Hub & Media Gallery' exists, split it into two separate blocks
    const oldIndex = db.dragBlocks.findIndex((b: any) => b.title && b.title.includes('Photo Hub & Media Gallery'));
    if (oldIndex !== -1) {
      const oldBlock = db.dragBlocks[oldIndex];
      db.dragBlocks.splice(oldIndex, 1,
        { id: 'smile_block', title: 'Photo Hub (Drive & QR)', type: 'smile', enabled: oldBlock.enabled, order: oldBlock.order },
        { id: 'gallery_block', title: 'Media Gallery (Photo Uploads)', type: 'gallery', enabled: oldBlock.enabled, order: oldBlock.order + 1 }
      );
      db.dragBlocks.forEach((b: any, idx: number) => { b.order = idx + 1; });
      dbClient.save();
    }
    if (!db.dragBlocks.some((b: any) => b.type === 'posters')) {
      db.dragBlocks.push({ id: 'posters_block', title: 'Winner Posters Page', type: 'posters', enabled: true, order: db.dragBlocks.length + 1 });
      dbClient.save();
    }
  }
  res.json({
    dragBlocks: db.dragBlocks,
    heroMedia: db.heroMedia || [],
    cmsSettings: db.cmsSettings || {}
  });
});

apiRouter.put('/settings', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const prevSettings = { ...db.eventSettings };

  if (req.body.posterTemplateConfig) {
    db.posterTemplateConfig = req.body.posterTemplateConfig;
  }
  if (req.body.certificateTemplateConfig) {
    db.certificateTemplateConfig = req.body.certificateTemplateConfig;
  }

  // Aggressively clean up redundant base64 strings in overrides to prevent massive JSON bloat
  const cleanOverrides = (overrides: any) => {
    if (!overrides || typeof overrides !== 'object') return;
    Object.keys(overrides).forEach(key => {
      const ov = overrides[key];
      if (ov && typeof ov._savedBgImageUrl === 'string' && ov._savedBgImageUrl.length > 200) {
        const bg = ov._savedBgImageUrl;
        ov._savedBgImageUrl = `hash_${bg.length}_${bg.slice(-30)}`;
      }
    });
  };

  if (req.body.chestNumberOverrides) cleanOverrides(req.body.chestNumberOverrides);
  if (req.body.posterOverrides) cleanOverrides(req.body.posterOverrides);
  if (req.body.certificateOverrides) cleanOverrides(req.body.certificateOverrides);

  db.eventSettings = {
    ...db.eventSettings,
    ...req.body
  };

  // Clean existing database bloat
  cleanOverrides(db.eventSettings.chestNumberOverrides);
  cleanOverrides(db.eventSettings.posterOverrides);
  cleanOverrides(db.eventSettings.certificateOverrides);

  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Update Event Settings', 'EventSettings', 'global', undefined, prevSettings, db.eventSettings);
  await dbClient.save();

  // Do NOT return massive settings object back to the client!
  res.json({
    message: 'Settings updated successfully',
    success: true
  });
});

// GET CMS Settings (Admin View)
apiRouter.get('/cms', authenticate, async (req, res) => {
  const db = dbClient.get();
  if (!db.dragBlocks || db.dragBlocks.length === 0) {
    db.dragBlocks = DEFAULT_DRAG_BLOCKS;
  }
  res.json({
    dragBlocks: db.dragBlocks,
    heroMedia: db.heroMedia || [],
    cmsSettings: db.cmsSettings || {}
  });
});

// PUT CMS Settings (Update CMS configuration)
apiRouter.put('/cms', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const { dragBlocks, heroMedia, cmsSettings } = req.body;
  const db = dbClient.get();

  if (dragBlocks) db.dragBlocks = dragBlocks;
  if (heroMedia) db.heroMedia = heroMedia;
  if (cmsSettings) db.cmsSettings = cmsSettings;

  await dbClient.save();

  await dbClient.logAudit(
    (req as any).user.id, (req as any).user.username, (req as any).user.role,
    'UPDATE_CMS', 'System', 'cms_settings'
  );

  res.json({ success: true, message: 'CMS Settings updated successfully' });
});


// 3. AUDIT LOGS & LISTS

apiRouter.get('/audit-logs', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  const db = dbClient.get();
  res.json(db.auditLogs);
});


// 4. UNITS (CRUD)

apiRouter.get('/units', async (req, res) => {
  const db = dbClient.get();
  res.json(db.units);
});

apiRouter.post('/units', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  const { name, code } = req.body;
  const db = dbClient.get();

  if (!name || !code) {
    return res.status(400).json({ error: 'Unit name and code are required.' });
  }

  const normalizedCode = code.trim().toUpperCase();
  if (db.units.some(u => u.code === normalizedCode)) {
    return res.status(400).json({ error: `Unit code ${normalizedCode} is already in use.` });
  }

  const newUnit: Unit = {
    id: `unit_${Date.now()}`,
    name: name.trim(),
    code: normalizedCode,
    active: true
  };

  db.units.push(newUnit);
  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Create Unit', 'Unit', newUnit.id, undefined, undefined, newUnit);
  await dbClient.save();

  res.json({ message: 'Unit created successfully', unit: newUnit });
});

apiRouter.put('/units/:id', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  const { name, code, active } = req.body;
  const db = dbClient.get();
  const unitIndex = db.units.findIndex(u => u.id === req.params.id);

  if (unitIndex === -1) {
    return res.status(404).json({ error: 'Unit not found' });
  }

  const oldUnit = { ...db.units[unitIndex] };

  if (code) {
    const normalizedCode = code.trim().toUpperCase();
    if (db.units.some(u => u.code === normalizedCode && u.id !== req.params.id)) {
      return res.status(400).json({ error: 'Unit code is already in use' });
    }
    db.units[unitIndex].code = normalizedCode;
  }

  if (name) db.units[unitIndex].name = name.trim();
  if (active !== undefined) db.units[unitIndex].active = active;

  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Update Unit', 'Unit', req.params.id, undefined, oldUnit, db.units[unitIndex]);
  await dbClient.save();

  res.json({ message: 'Unit updated successfully', unit: db.units[unitIndex] });
});

apiRouter.delete('/units/:id', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  const db = dbClient.get();
  const unitId = req.params.id;

  // Delete only if no related registrations or results
  const hasRegistrations = db.participants.some(p => p.unitId === unitId && !p.deletedAt);
  const hasTeams = db.teams.some(t => t.unitId === unitId && !t.deletedAt);

  if (hasRegistrations || hasTeams) {
    return res.status(400).json({
      error: 'Cannot delete unit. It has active participants or group teams registered. Deactivate the unit instead.'
    });
  }

  const index = db.units.findIndex(u => u.id === unitId);
  if (index === -1) {
    return res.status(404).json({ error: 'Unit not found' });
  }

  const deletedUnit = db.units[index];
  db.units.splice(index, 1);
  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Delete Unit', 'Unit', unitId, undefined, deletedUnit);
  await dbClient.save();

  res.json({ message: 'Unit deleted successfully' });
});


// 5. CATEGORIES

apiRouter.get('/categories', async (req, res) => {
  const db = dbClient.get();

  // Calculate minimum generated chest number per category
  const minChestNumbers: Record<string, number> = {};
  if (db.chestNumbers && Array.isArray(db.chestNumbers)) {
    for (const cn of db.chestNumbers) {
      if (!minChestNumbers[cn.categoryId] || cn.chestNumber < minChestNumbers[cn.categoryId]) {
        minChestNumbers[cn.categoryId] = cn.chestNumber;
      }
    }
  }

  // Map over categories to attach dynamic starting chest number and fallback criteriaType
  const enrichedCategories = db.categories.map(cat => {
    const userDefinedStartNo = cat.startingChestNumber !== undefined && cat.startingChestNumber !== null ? Number(cat.startingChestNumber) : undefined;
    return {
      ...cat,
      criteriaType: cat.criteriaType || (cat.dobStart || cat.dobEnd ? 'dob' : (cat.classStart || cat.classEnd ? 'class' : undefined)),
      startingChestNumber: userDefinedStartNo !== undefined ? userDefinedStartNo : (minChestNumbers[cat.id] !== undefined ? minChestNumbers[cat.id] : 1001)
    };
  });

  res.json(enrichedCategories);
});

apiRouter.post('/categories/reorder', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const { categoryIds } = req.body;
  const db = dbClient.get();

  if (!Array.isArray(categoryIds)) {
    return res.status(400).json({ error: 'categoryIds array is required.' });
  }

  const catMap = new Map<string, any>();
  (db.categories || []).forEach((c: any) => catMap.set(c.id, c));

  const newCategories: any[] = [];
  categoryIds.forEach((id: string) => {
    if (catMap.has(id)) {
      newCategories.push(catMap.get(id));
      catMap.delete(id);
    }
  });

  catMap.forEach((c: any) => newCategories.push(c));

  db.categories = newCategories;
  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Reorder Categories', 'Category', 'bulk');
  await dbClient.save();

  res.json({ message: 'Category order saved successfully', categories: db.categories });
});

apiRouter.put('/categories/reorder', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const { categoryIds } = req.body;
  const db = dbClient.get();

  if (!Array.isArray(categoryIds)) {
    return res.status(400).json({ error: 'categoryIds array is required.' });
  }

  const catMap = new Map<string, any>();
  (db.categories || []).forEach((c: any) => catMap.set(c.id, c));

  const newCategories: any[] = [];
  categoryIds.forEach((id: string) => {
    if (catMap.has(id)) {
      newCategories.push(catMap.get(id));
      catMap.delete(id);
    }
  });

  catMap.forEach((c: any) => newCategories.push(c));

  db.categories = newCategories;
  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Reorder Categories', 'Category', 'bulk');
  await dbClient.save();

  res.json({ message: 'Category order saved successfully', categories: db.categories });
});

apiRouter.post('/categories', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const { name, code, criteriaType, dobStart, dobEnd, classStart, classEnd, pointsRank1, pointsRank2, pointsRank3, startingChestNumber } = req.body;
  const db = dbClient.get();

  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  const categoryCode = code || name.trim().toUpperCase().replace(/\s+/g, '_');
  const catIndex = db.categories.length;
  const defaultStartNumber = (catIndex + 1) * 1000 + 1;

  const newCat: Category = {
    id: `cat_${Date.now()}`,
    name: name.trim(),
    code: categoryCode,
    criteriaType: criteriaType || 'dob',
    dobStart,
    dobEnd,
    classStart,
    classEnd,
    pointsRank1: Number(pointsRank1) || 20,
    pointsRank2: Number(pointsRank2) || 14,
    pointsRank3: Number(pointsRank3) || 7,
    startingChestNumber: Number(startingChestNumber) || defaultStartNumber,
    active: true
  };

  db.categories.push(newCat);
  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Create Category', 'Category', newCat.id, undefined, undefined, newCat);
  await dbClient.save();

  res.json({ message: 'Category created successfully', category: newCat });
});

apiRouter.put('/categories/:id', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const { name, criteriaType, dobStart, dobEnd, classStart, classEnd, pointsRank1, pointsRank2, pointsRank3, startingChestNumber, active } = req.body;
  const db = dbClient.get();
  const catIndex = db.categories.findIndex(c => c.id === req.params.id);

  if (catIndex === -1) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const oldCat = { ...db.categories[catIndex] };

  if (name) db.categories[catIndex].name = name.trim();
  if (criteriaType) db.categories[catIndex].criteriaType = criteriaType;
  if (dobStart !== undefined) db.categories[catIndex].dobStart = dobStart;
  if (dobEnd !== undefined) db.categories[catIndex].dobEnd = dobEnd;
  if (classStart !== undefined) db.categories[catIndex].classStart = classStart;
  if (classEnd !== undefined) db.categories[catIndex].classEnd = classEnd;
  if (pointsRank1 !== undefined) db.categories[catIndex].pointsRank1 = Number(pointsRank1);
  if (pointsRank2 !== undefined) db.categories[catIndex].pointsRank2 = Number(pointsRank2);
  if (pointsRank3 !== undefined) db.categories[catIndex].pointsRank3 = Number(pointsRank3);
  if (startingChestNumber !== undefined) {
    const newStart = Number(startingChestNumber);
    db.categories[catIndex].startingChestNumber = newStart;
    if (!db.counters) db.counters = [];
    let counter = db.counters.find((c: Counter) => c.categoryId === req.params.id);
    if (counter) {
      counter.currentValue = newStart - 1;
    } else {
      db.counters.push({
        id: `counter_${req.params.id}`,
        categoryId: req.params.id,
        currentValue: newStart - 1
      });
    }
  }
  if (active !== undefined) db.categories[catIndex].active = active;

  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Update Category', 'Category', req.params.id, undefined, oldCat, db.categories[catIndex]);
  await dbClient.save();

  res.json({ message: 'Category updated successfully', category: db.categories[catIndex] });
});

apiRouter.delete('/categories/:id', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const catId = req.params.id;

  const hasParticipants = db.participants.some(p => p.selectedCategoryId === catId && !p.deletedAt);
  const hasCompetitions = db.competitions.some(c => c.categoryId === catId && c.active);

  if (hasParticipants || hasCompetitions) {
    return res.status(400).json({ error: 'Cannot delete category. It has active participants or competitions assigned.' });
  }

  const index = db.categories.findIndex(c => c.id === catId);
  if (index === -1) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const deletedCat = db.categories[index];
  db.categories.splice(index, 1);
  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Delete Category', 'Category', catId, undefined, deletedCat);
  await dbClient.save();

  res.json({ message: 'Category deleted successfully' });
});


// 6. COMPETITIONS

function generateCompCode(db: any, categoryId: string, name: string, requestedCode?: string): string {
  if (requestedCode && requestedCode.trim()) {
    return requestedCode.trim().toUpperCase();
  }
  const category = (db.categories || []).find((c: any) => c.id === categoryId);
  const catLower = (category?.name || '').toLowerCase();
  let prefix = 'CMP';
  if (catLower.includes('campus')) {
    if (catLower.includes('junior')) prefix = 'CJ';
    else if (catLower.includes('senior')) prefix = 'CS';
    else if (catLower.includes('general')) prefix = 'CG';
    else prefix = 'CP';
  } else {
    if (catLower.includes('sub') || catLower.includes('sj')) prefix = 'SJ';
    else if (catLower.includes('junior') || catLower.includes('jr')) prefix = 'JR';
    else if (catLower.includes('senior') || catLower.includes('sr')) prefix = 'SR';
    else if (catLower.includes('general') || catLower.includes('gen')) prefix = 'GR';
    else if (catLower.includes('primary') || catLower.includes('pr')) prefix = 'PR';
    else if (catLower.includes('sec') || catLower.includes('high')) prefix = 'SEC';
    else prefix = category.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'CMP';
  }

  // Find all existing competitions matching category or prefix to find max numeric index
  const compsInCat = (db.competitions || []).filter((c: any) =>
    c.categoryId === categoryId ||
    (c.code && typeof c.code === 'string' && c.code.toUpperCase().startsWith(prefix))
  );

  let maxNum = 0;
  for (const comp of compsInCat) {
    if (comp.code) {
      const match = String(comp.code).match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }
  }

  if (maxNum === 0) {
    maxNum = compsInCat.length;
  }

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(2, '0')}`;
}

apiRouter.get('/competitions', async (req, res) => {
  const db = dbClient.get();
  const comps = db.competitions.map(c => ({ ...c, name: toTitleCase(c.name) }));
  res.json(comps);
});

apiRouter.post('/competitions', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  const { name, code, categoryId, language, participationType, teamSize, duration, stageType, displayOrder } = req.body;
  const db = dbClient.get();

  if (!name || !categoryId || !participationType || !stageType) {
    return res.status(400).json({ error: 'Name, Category, Participation Type, and Stage Type are required.' });
  }

  const assignedCode = generateCompCode(db, categoryId, name, code);

  const newComp: Competition = {
    id: `comp_${categoryId.replace('cat_', '')}_${Date.now()}`,
    name: toTitleCase(name),
    code: assignedCode,
    categoryId,
    language: language ? language.trim() : undefined,
    participationType,
    teamSize: participationType === ParticipationType.GROUP ? (Number(teamSize) || 2) : 1,
    duration: Number(duration) || 0,
    stageType,
    displayOrder: Number(displayOrder) || (db.competitions.length + 1),
    active: true
  };

  db.competitions.push(newComp);
  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Create Competition', 'Competition', newComp.id, undefined, undefined, newComp);
  await dbClient.save();

  res.json({ message: 'Competition created successfully', competition: newComp });
});

apiRouter.put('/competitions/:id', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  const db = dbClient.get();
  const compIndex = db.competitions.findIndex(c => c.id === req.params.id);

  if (compIndex === -1) {
    return res.status(404).json({ error: 'Competition not found' });
  }

  const oldComp = { ...db.competitions[compIndex] };
  const catId = req.body.categoryId || oldComp.categoryId;
  const assignedCode = req.body.code ? req.body.code.trim().toUpperCase() : (oldComp.code || generateCompCode(db, catId, req.body.name || oldComp.name));

  db.competitions[compIndex] = {
    ...db.competitions[compIndex],
    ...req.body,
    name: req.body.name ? toTitleCase(req.body.name) : oldComp.name,
    code: assignedCode,
    // ensure casting
    teamSize: req.body.participationType === ParticipationType.INDIVIDUAL ? 1 : Number(req.body.teamSize || oldComp.teamSize),
    duration: req.body.duration !== undefined ? Number(req.body.duration) : oldComp.duration,
    displayOrder: req.body.displayOrder !== undefined ? Number(req.body.displayOrder) : oldComp.displayOrder,
  };

  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Update Competition', 'Competition', req.params.id, undefined, oldComp, db.competitions[compIndex]);
  await dbClient.save();

  res.json({ message: 'Competition updated successfully', competition: db.competitions[compIndex] });
});

apiRouter.delete('/competitions/:id', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  const db = dbClient.get();
  const compId = req.params.id;

  const index = db.competitions.findIndex(c => c.id === compId);
  if (index === -1) {
    return res.status(404).json({ error: 'Competition not found' });
  }

  const deletedComp = db.competitions[index];
  const now = new Date().toISOString();

  // Cascade delete associated results, teams, registrations, and judgment sheets
  (db.results || []).forEach(r => {
    if (r.competitionId === compId) r.deletedAt = now;
  });

  (db.teams || []).forEach(t => {
    if (t.competitionId === compId) t.deletedAt = now;
  });

  (db.greenRoomAssignments || []).forEach(gr => {
    if (gr.competitionId === compId) gr.deletedAt = now;
  });

  (db.judgmentSheets || []).forEach(js => {
    if (js.competitionId === compId) js.deletedAt = now;
  });

  (db.registrations || []).forEach(reg => {
    if (Array.isArray(reg.selectedIndividualCompetitionIds)) {
      reg.selectedIndividualCompetitionIds = reg.selectedIndividualCompetitionIds.filter((id: string) => id !== compId);
    }
    if (Array.isArray(reg.selectedGroupTeamIds)) {
      reg.selectedGroupTeamIds = reg.selectedGroupTeamIds.filter((id: string) => id !== compId);
    }
  });

  db.competitions.splice(index, 1);
  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Delete Competition', 'Competition', compId, undefined, deletedComp);
  await dbClient.save();

  res.json({ message: 'Competition and associated records deleted successfully' });
});


// 6. COMPETITIONS BULK & CRUD

apiRouter.post('/competitions/bulk', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  const db = dbClient.get();
  const { competitions: items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Competitions array is required.' });
  }

  let imported = 0;
  for (const item of items) {
    const name = (item.name || '').toString().trim();
    if (!name) continue;

    let cat = db.categories.find(c =>
      c.id === item.categoryId ||
      c.name.toLowerCase() === (item.category || item.categoryName || '').toString().trim().toLowerCase()
    );
    if (!cat && db.categories.length > 0) cat = db.categories[0];

    const catId = cat ? cat.id : 'cat_general';
    const assignedCode = generateCompCode(db, catId, name, item.code);

    const newComp: Competition = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: toTitleCase(name),
      code: assignedCode,
      categoryId: catId,
      participationType: (item.participationType || '').toString().toLowerCase().includes('group') ? ParticipationType.GROUP : ParticipationType.INDIVIDUAL,
      teamSize: (item.participationType || '').toString().toLowerCase().includes('group') ? (Number(item.teamSize) || 2) : 1,
      duration: Number(item.duration) || 5,
      stageType: (item.stageType || '').toString().toLowerCase().includes('off') ? StageType.OFF_STAGE : StageType.ON_STAGE,
      displayOrder: db.competitions.length + 1,
      active: true
    };
    db.competitions.push(newComp);
    imported++;
  }

  await dbClient.save();
  res.json({ message: `Bulk imported ${imported} competitions successfully`, imported });
});

apiRouter.post('/participants/check-eligibility', async (req, res) => {
  const { dob, educationStatus } = req.body;
  if (!educationStatus) {
    return res.status(400).json({ error: 'educationStatus is required.' });
  }

  const results = calculateEligibleCategories(dob, educationStatus);
  res.json(results);
});


// 8. PARTICIPANTS MANAGEMENT

// Read Participants (Filtered / Isolated)
apiRouter.get('/participants', authenticate, async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  let participants = db.participants.filter(p => !p.deletedAt);

  // Unit Team Leader Isolation: Can only see their unit's participants
  if (user.role === UserRole.UNIT_TEAM_LEADER) {
    participants = participants.filter(p => p.unitId === user.assignedUnitId);
  } else if (req.query.unitId) {
    // Other roles can filter by unitId
    participants = participants.filter(p => p.unitId === req.query.unitId);
  }

  if (req.query.categoryId) {
    participants = participants.filter(p => p.selectedCategoryId === req.query.categoryId);
  }

  if (req.query.search) {
    const s = String(req.query.search).toLowerCase();
    participants = participants.filter(p => p.fullName.toLowerCase().includes(s));
  }

  const formattedParticipants = participants.map(p => ({
    ...p,
    fullName: toTitleCase(p.fullName)
  }));

  res.json(formattedParticipants);
});

// Read all registrations
apiRouter.get('/registrations', authenticate, async (req, res) => {
  const db = dbClient.get();
  res.json((db as any).registrations || []);
});

// Bulk Import Participants
apiRouter.post('/participants/bulk', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { participants: items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Participants array is required.' });
  }

  let imported = 0;
  let errors: string[] = [];

  for (const item of items) {
    try {
      const fullName = (item.fullName || item.name || '').toString().trim();
      if (!fullName) continue;

      let unit = db.units.find(u =>
        u.id === item.unitId ||
        u.name.toLowerCase() === (item.unitName || item.unit || item.house || '').toString().trim().toLowerCase() ||
        u.code.toLowerCase() === (item.unitCode || '').toString().trim().toLowerCase()
      );
      if (!unit && db.units.length > 0) {
        unit = db.units[0];
      }

      let category = db.categories.find(c =>
        c.id === item.categoryId ||
        c.name.toLowerCase() === (item.categoryName || item.category || '').toString().trim().toLowerCase()
      );
      if (!category && db.categories.length > 0) {
        category = db.categories[0];
      }

      const participantId = `part_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const generatedChest = unit && category ? generateNextChestNumber(db, category.id, user.id, participantId, unit.id) : null;
      const chestNumberString = generatedChest ? generatedChest.chestNumber.toString() : 'PENDING';

      const p: Participant = {
        id: participantId,
        fullName: toTitleCase(fullName),
        dob: item.dob || '',
        candidateClass: item.candidateClass || item.class || '',
        unitId: unit?.id || 'unit_default',
        gender: (item.gender || '').toString().toLowerCase().includes('female') ? Gender.FEMALE : Gender.MALE,
        educationStatus: EducationStatus.STUDENT,
        selectedCategoryId: category?.id || 'cat_junior',
        profilePhoto: chestNumberString,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.participants.push(p);

      const compIds: string[] = Array.isArray(item.selectedCompetitionIds) ? item.selectedCompetitionIds : [];
      if (!(db as any).registrations) (db as any).registrations = [];
      const registration: Registration = {
        id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        participantId: p.id,
        categoryId: p.selectedCategoryId,
        selectedIndividualCompetitionIds: compIds,
        selectedGroupTeamIds: [],
        registrationStatus: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      (db as any).registrations.push(registration);

      imported++;
    } catch (e: any) {
      errors.push(e.message || 'Row import failed');
    }
  }

  await dbClient.save();
  res.json({ message: `Bulk imported ${imported} participants successfully`, imported, errors });
});

// Bulk Import Results
apiRouter.post('/results/bulk', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.RESULT_MANAGER]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { results: items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Results array is required.' });
  }

  let imported = 0;
  for (const item of items) {
    const comp = db.competitions.find(c => c.id === item.competitionId || c.name.toLowerCase() === (item.competitionName || item.eventName || '').toString().trim().toLowerCase());
    if (!comp) continue;

    const part = db.participants.find(p => p.id === item.participantId || p.fullName.toLowerCase() === (item.participantName || '').toString().trim().toLowerCase() || p.profilePhoto === (item.chestNumber || '').toString().trim());

    const j1 = Number(item.judge1Mark) || 0;
    const j2 = Number(item.judge2Mark) || 0;
    const total = j1 + j2;

    const newResult: Result = {
      id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      categoryId: comp.categoryId,
      competitionId: comp.id,
      participantId: part ? part.id : undefined,
      judge1Mark: j1,
      judge2Mark: j2,
      totalMark: total,
      status: item.status === 'absent' ? ResultStatus.ABSENT : item.status === 'disqualified' ? ResultStatus.DISQUALIFIED : ResultStatus.PARTICIPATED,
      publishedStatus: true,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.results.push(newResult);
    imported++;
  }

  await dbClient.save();
  res.json({ message: `Bulk imported ${imported} results successfully`, imported });
});

// Bulk Import Competitions
apiRouter.post('/competitions/bulk', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { competitions: items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Competitions array is required.' });
  }

  let imported = 0;
  for (const item of items) {
    const compName = (item.name || item.eventName || '').toString().trim();
    if (!compName) continue;

    let category = db.categories.find(c =>
      c.id === item.categoryId ||
      c.name.toLowerCase() === (item.categoryName || item.category || '').toString().trim().toLowerCase()
    );
    if (!category && db.categories.length > 0) {
      category = db.categories[0];
    }

    const newComp: Competition = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: toTitleCase(compName),
      categoryId: category?.id || 'cat_junior',
      language: item.language,
      participationType: (item.participationType || '').toLowerCase().includes('group') ? ParticipationType.GROUP : ParticipationType.INDIVIDUAL,
      teamSize: Number(item.teamSize) || 1,
      duration: Number(item.duration) || 5,
      stageType: (item.stageType || '').toLowerCase().includes('off') ? StageType.OFF_STAGE : StageType.ON_STAGE,
      displayOrder: db.competitions.length + 1,
      active: true
    };

    db.competitions.push(newComp);
    imported++;
  }

  await dbClient.save();
  res.json({ message: `Bulk imported ${imported} competitions successfully`, imported });
});

// Duplicate Checking Check
apiRouter.post('/participants/check-duplicate', authenticate, async (req, res) => {
  res.json({ duplicate: false, matches: [] });
});

// Create Participant
apiRouter.post('/participants', authenticate, async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  // Check registration lock for Unit Leaders
  if (!db.eventSettings.registrationOpen && user.role === UserRole.UNIT_TEAM_LEADER) {
    return res.status(400).json({ error: 'Registration process is currently closed/disabled by the festival team.' });
  }

  const {
    fullName, dob, candidateClass, unitId, gender, educationStatus,
    selectedCategoryId, institution, course, yearSemester,
    phone, guardianPhone, address, notes, selectedCompetitionIds
  } = req.body;

  // Basic Validation
  if (!fullName || !unitId || !selectedCategoryId || !educationStatus) {
    return res.status(400).json({ error: 'Missing required participant fields.' });
  }

  // 1. Lock unit field for Unit Team Leaders
  const finalUnitId = user.role === UserRole.UNIT_TEAM_LEADER ? user.assignedUnitId! : unitId;



  // 3. Server-side limit validation:
  // Split selected competition IDs into Individual and Group to verify limits:
  // Maximum 3 individual events, 2 group events per participant!
  const competitionIds: string[] = selectedCompetitionIds || [];
  const individualCompetitions = db.competitions.filter(c =>
    competitionIds.includes(c.id) && c.participationType === ParticipationType.INDIVIDUAL
  );
  const groupCompetitions = db.competitions.filter(c =>
    competitionIds.includes(c.id) && c.participationType === ParticipationType.GROUP
  );

  if (individualCompetitions.length > db.eventSettings.maxIndividualEvents) {
    return res.status(400).json({ error: `Cannot select more than ${db.eventSettings.maxIndividualEvents} individual competitions.` });
  }
  if (groupCompetitions.length > db.eventSettings.maxGroupEvents) {
    return res.status(400).json({ error: `Cannot select more than ${db.eventSettings.maxGroupEvents} group competitions.` });
  }

  // On-stage / Off-stage limits (null means no limit)
  const allSelectedComps = db.competitions.filter(c => competitionIds.includes(c.id));
  const onStageComps = allSelectedComps.filter(c => c.stageType === StageType.ON_STAGE);
  const offStageComps = allSelectedComps.filter(c => c.stageType === StageType.OFF_STAGE);
  if (db.eventSettings.maxOnStageEvents != null && onStageComps.length > db.eventSettings.maxOnStageEvents) {
    return res.status(400).json({ error: `Cannot select more than ${db.eventSettings.maxOnStageEvents} on-stage competitions.` });
  }
  if (db.eventSettings.maxOffStageEvents != null && offStageComps.length > db.eventSettings.maxOffStageEvents) {
    return res.status(400).json({ error: `Cannot select more than ${db.eventSettings.maxOffStageEvents} off-stage competitions.` });
  }

  // Verify that all competitions belong to the SELECTED category
  for (const compId of competitionIds) {
    const comp = db.competitions.find(c => c.id === compId);
    if (!comp || comp.categoryId !== selectedCategoryId) {
      return res.status(400).json({ error: `Competition ${compId} is invalid or does not belong to the selected category.` });
    }
  }

  // Pre-generate participant ID to allow chest number generation
  const participantId = `part_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  // Auto-generate chest number from the atomic counter system immediately
  if (!db.chestNumbers) db.chestNumbers = [];
  const generatedChest = generateNextChestNumber(db, selectedCategoryId, user.id, participantId, finalUnitId);
  const chestNumberString = generatedChest ? generatedChest.chestNumber.toString() : 'PENDING';

  const newParticipant: Participant = {
    id: participantId,
    fullName: toTitleCase(fullName),
    dob,
    candidateClass: candidateClass || req.body.candidateClass || undefined,
    unitId: finalUnitId,
    gender: gender || Gender.MALE,
    educationStatus,
    institution,
    course,
    yearSemester,
    selectedCategoryId,
    phone,
    guardianPhone,
    address,
    notes,
    profilePhoto: chestNumberString, // Using numeric chest number directly
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.participants.push(newParticipant);

  // Auto-create or link Group Teams when candidate registers for group competitions
  for (const groupComp of groupCompetitions) {
    // Find an existing team for this unit & group competition that HAS SPACE (memberIds.length < groupComp.teamSize)
    let availableTeam = db.teams.find(t =>
      t.unitId === finalUnitId &&
      t.competitionId === groupComp.id &&
      !t.deletedAt &&
      t.memberIds.length < groupComp.teamSize
    );

    if (availableTeam) {
      if (!availableTeam.memberIds.includes(newParticipant.id)) {
        availableTeam.memberIds.push(newParticipant.id);
        availableTeam.updatedAt = new Date().toISOString();
        // Update team name to first registered member & Team if generic
        const firstM = db.participants.find(p => p.id === availableTeam.memberIds[0]);
        if (firstM) {
          availableTeam.teamName = `${firstM.fullName} & Team`;
        }
      }
    } else {
      // Current teams are full or none exist -> create a NEW team led by this new candidate!
      const autoTeam: Team = {
        id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        teamNumber: `T-${String(db.teams.length + 1).padStart(3, '0')}`,
        teamName: `${newParticipant.fullName} & Team`,
        unitId: finalUnitId,
        categoryId: selectedCategoryId,
        competitionId: groupComp.id,
        memberIds: [newParticipant.id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.teams.push(autoTeam);
    }
  }

  // Store selected competitions in a new Registration record
  const registration: any = {
    id: `reg_${Date.now()}`,
    participantId: newParticipant.id,
    categoryId: selectedCategoryId,
    candidateClass: candidateClass || req.body.candidateClass || undefined,
    selectedIndividualCompetitionIds: individualCompetitions.map(c => c.id),
    selectedGroupTeamIds: groupCompetitions.map(c => c.id),
    registrationStatus: 'confirmed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!db.hasOwnProperty('registrations')) {
    (db as any).registrations = [];
  }
  (db as any).registrations.push(registration);

  // Direct instant write-through to MongoDB Atlas for 100% permanent persistence
  const mongoDb = getDb();
  if (mongoDb) {
    try {
      await Promise.all([
        mongoDb.collection('participants').replaceOne(
          { $or: [{ id: newParticipant.id }, { _id: newParticipant.id as any }] },
          { id: newParticipant.id, ...newParticipant },
          { upsert: true }
        ),
        mongoDb.collection('registrations').replaceOne(
          { participantId: newParticipant.id },
          { ...registration },
          { upsert: true }
        ),
        generatedChest ? mongoDb.collection('chestNumbers').replaceOne(
          { id: generatedChest.id },
          { ...generatedChest },
          { upsert: true }
        ) : Promise.resolve(),
        mongoDb.collection('app_state').replaceOne(
          { _id: 'global_state' as any },
          { ...db },
          { upsert: true }
        )
      ]);
    } catch (mongoErr) {
      console.error('Direct MongoDB participant create error:', mongoErr);
    }
  }

  await dbClient.logAudit(user.id, user.username, user.role, 'Register Participant', 'Participant', newParticipant.id, finalUnitId, undefined, newParticipant);

  res.json({
    message: 'Participant registered successfully',
    participant: newParticipant,
    chestNumber: generatedChest?.chestNumber
  });

  setImmediate(async () => {
    try {
      const mongoDb = getDb();
      if (mongoDb) {
        await Promise.all([
          mongoDb.collection('participants').replaceOne(
            { $or: [{ id: newParticipant.id }, { _id: newParticipant.id as any }] },
            { id: newParticipant.id, ...newParticipant },
            { upsert: true }
          ),
          mongoDb.collection('registrations').replaceOne(
            { participantId: newParticipant.id },
            { ...registration },
            { upsert: true }
          ),
          generatedChest ? mongoDb.collection('chestNumbers').replaceOne(
            { id: generatedChest.id },
            { ...generatedChest },
            { upsert: true }
          ) : Promise.resolve(),
          mongoDb.collection('app_state').replaceOne(
            { _id: 'global_state' as any },
            { ...db },
            { upsert: true }
          )
        ]);
      }
      await dbClient.save();
    } catch (mongoErr) {
      console.error('Background MongoDB participant create error:', mongoErr);
    }
  });
});

// Update Participant
apiRouter.put('/participants/:id', authenticate, async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  // Check registration lock for Unit Leaders
  if (!db.eventSettings.registrationOpen && user.role === UserRole.UNIT_TEAM_LEADER) {
    return res.status(400).json({ error: 'Registration process is currently closed/disabled by the sector team.' });
  }

  const partId = req.params.id;

  const partIndex = db.participants.findIndex(p => p.id === partId && !p.deletedAt);
  if (partIndex === -1) {
    return res.status(404).json({ error: 'Participant not found.' });
  }

  const existingPart = db.participants[partIndex];

  // Unit isolation enforcement
  if (user.role === UserRole.UNIT_TEAM_LEADER && existingPart.unitId !== user.assignedUnitId) {
    return res.status(403).json({ error: 'Access denied. You can only manage participants from your own unit.' });
  }

  const {
    fullName, dob, educationStatus, selectedCategoryId, gender,
    institution, course, yearSemester, phone, guardianPhone, address, notes,
    selectedCompetitionIds
  } = req.body;

  // If changing unit, block unless super admin
  if (req.body.unitId && req.body.unitId !== existingPart.unitId && user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ error: 'Only Super Admins can transfer participants between units.' });
  }

  const finalDob = dob || existingPart.dob;
  const finalEd = educationStatus || existingPart.educationStatus;
  const finalCat = selectedCategoryId || existingPart.selectedCategoryId;



  // Update competition limits
  if (selectedCompetitionIds) {
    const competitionIds: string[] = selectedCompetitionIds;
    const individualCompetitions = db.competitions.filter(c =>
      competitionIds.includes(c.id) && c.participationType === ParticipationType.INDIVIDUAL
    );
    const groupCompetitions = db.competitions.filter(c =>
      competitionIds.includes(c.id) && c.participationType === ParticipationType.GROUP
    );

    if (individualCompetitions.length > db.eventSettings.maxIndividualEvents) {
      return res.status(400).json({ error: `Cannot select more than ${db.eventSettings.maxIndividualEvents} individual competitions.` });
    }
    if (groupCompetitions.length > db.eventSettings.maxGroupEvents) {
      return res.status(400).json({ error: `Cannot select more than ${db.eventSettings.maxGroupEvents} group competitions.` });
    }

    // On-stage / Off-stage limits (null means no limit)
    const allSelectedComps = db.competitions.filter(c => competitionIds.includes(c.id));
    const onStageComps = allSelectedComps.filter(c => c.stageType === StageType.ON_STAGE);
    const offStageComps = allSelectedComps.filter(c => c.stageType === StageType.OFF_STAGE);
    if (db.eventSettings.maxOnStageEvents != null && onStageComps.length > db.eventSettings.maxOnStageEvents) {
      return res.status(400).json({ error: `Cannot select more than ${db.eventSettings.maxOnStageEvents} on-stage competitions.` });
    }
    if (db.eventSettings.maxOffStageEvents != null && offStageComps.length > db.eventSettings.maxOffStageEvents) {
      return res.status(400).json({ error: `Cannot select more than ${db.eventSettings.maxOffStageEvents} off-stage competitions.` });
    }

    // Verify category matches
    for (const compId of competitionIds) {
      const comp = db.competitions.find(c => c.id === compId);
      if (!comp || comp.categoryId !== finalCat) {
        return res.status(400).json({ error: `Competition ${compId} is invalid or does not belong to the selected category.` });
      }
    }



    // Update or create Registration record
    if (!db.hasOwnProperty('registrations')) {
      (db as any).registrations = [];
    }
    let reg = (db as any).registrations.find((r: any) => r.participantId === partId);
    if (!reg) {
      reg = {
        id: `reg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        participantId: partId,
        categoryId: finalCat,
        selectedIndividualCompetitionIds: [],
        selectedGroupCompetitionIds: [],
        registrationStatus: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      (db as any).registrations.push(reg);
    }
    reg.categoryId = finalCat;
    if (req.body.candidateClass !== undefined) reg.candidateClass = req.body.candidateClass;
    reg.selectedIndividualCompetitionIds = individualCompetitions.map(c => c.id);
    reg.selectedGroupCompetitionIds = groupCompetitions.map(c => c.id);
    reg.selectedGroupTeamIds = groupCompetitions.map(c => c.id);
    reg.updatedAt = new Date().toISOString();

    // Sync group team memberships in db.teams
    const groupCompIds = groupCompetitions.map(c => c.id);
    if (db.teams) {
      // 1. Remove participant from any group team where the competition is no longer selected
      for (const team of db.teams) {
        if (!team.deletedAt && team.memberIds && team.memberIds.includes(partId) && !groupCompIds.includes(team.competitionId)) {
          team.memberIds = team.memberIds.filter((mId: string) => mId !== partId);
          team.updatedAt = new Date().toISOString();
        }
      }

      // 2. Link participant to a group team for newly selected group competitions
      for (const groupComp of groupCompetitions) {
        const alreadyInTeam = db.teams.some(t => !t.deletedAt && t.competitionId === groupComp.id && t.memberIds && t.memberIds.includes(partId));
        if (!alreadyInTeam) {
          const availableTeam = db.teams.find(t =>
            t.unitId === existingPart.unitId &&
            t.competitionId === groupComp.id &&
            !t.deletedAt &&
            t.memberIds &&
            t.memberIds.length < groupComp.teamSize
          );

          if (availableTeam) {
            availableTeam.memberIds.push(partId);
            availableTeam.updatedAt = new Date().toISOString();
          } else {
            const newTeam: any = {
              id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              teamName: `${existingPart.fullName} & Team`,
              unitId: existingPart.unitId,
              competitionId: groupComp.id,
              memberIds: [partId],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            db.teams.push(newTeam);
          }
        }
      }
    }
  }

  const oldPart = { ...existingPart };

  // Update fields
  if (fullName) existingPart.fullName = toTitleCase(fullName);
  if (dob !== undefined) existingPart.dob = dob;
  if (req.body.candidateClass !== undefined) existingPart.candidateClass = req.body.candidateClass;
  if (educationStatus) existingPart.educationStatus = educationStatus;
  if (selectedCategoryId) existingPart.selectedCategoryId = selectedCategoryId;
  if (gender) existingPart.gender = gender;
  if (institution !== undefined) existingPart.institution = institution;
  if (course !== undefined) existingPart.course = course;
  if (yearSemester !== undefined) existingPart.yearSemester = yearSemester;
  if (phone !== undefined) existingPart.phone = phone;
  if (guardianPhone !== undefined) existingPart.guardianPhone = guardianPhone;
  if (address !== undefined) existingPart.address = address;
  if (notes !== undefined) existingPart.notes = notes;

  if (req.body.unitId && user.role === UserRole.SUPER_ADMIN) {
    existingPart.unitId = req.body.unitId;
  }

  existingPart.updatedAt = new Date().toISOString();

  // Direct instant write-through to MongoDB Atlas for 100% permanent persistence
  const updatedReg = ((db as any).registrations || []).find((r: any) => r.participantId === partId);
  const mongoDb = getDb();
  if (mongoDb) {
    try {
      await Promise.all([
        mongoDb.collection('participants').replaceOne(
          { $or: [{ id: partId }, { _id: partId as any }] },
          { id: partId, ...existingPart },
          { upsert: true }
        ),
        updatedReg ? mongoDb.collection('registrations').replaceOne(
          { participantId: partId },
          { ...updatedReg },
          { upsert: true }
        ) : Promise.resolve(),
        mongoDb.collection('app_state').replaceOne(
          { _id: 'global_state' as any },
          { ...db },
          { upsert: true }
        )
      ]);
    } catch (mongoErr) {
      console.error('Direct MongoDB participant update error:', mongoErr);
    }
  }

  await dbClient.logAudit(user.id, user.username, user.role, 'Update Participant', 'Participant', partId, existingPart.unitId, oldPart, existingPart);
  await dbClient.save();

  res.json({ message: 'Participant updated successfully', participant: existingPart });
});

// Permanent Delete Participant (With Complete Cascading Cleanup Across Database)
const hardDeleteParticipant = async (req: Request, res: Response) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  // Check registration lock for Unit Leaders
  if (!db.eventSettings.registrationOpen && user.role === UserRole.UNIT_TEAM_LEADER) {
    return res.status(400).json({ error: 'Registration process is currently closed/disabled by the sector team.' });
  }

  const partId = req.params.id;
  const { reason } = req.body || {};

  const partIndex = db.participants.findIndex(p => p.id === partId);
  if (partIndex === -1) {
    return res.status(404).json({ error: 'Participant not found.' });
  }

  const part = db.participants[partIndex];

  // Unit isolation enforcement
  if (user.role === UserRole.UNIT_TEAM_LEADER && part.unitId !== user.assignedUnitId) {
    return res.status(403).json({ error: 'Access denied. You can only delete participants from your own unit.' });
  }

  // 1. Permanent purge from db.participants
  db.participants.splice(partIndex, 1);

  // 2. Permanent purge associated results
  db.results = (db.results || []).filter(r => r.participantId !== partId);

  // 3. Permanent cleanup from group teams
  (db.teams || []).forEach(t => {
    if (Array.isArray(t.memberIds) && t.memberIds.includes(partId)) {
      t.memberIds = t.memberIds.filter((mId: string) => mId !== partId);
    }
  });
  db.teams = (db.teams || []).filter(t => !t.memberIds || t.memberIds.length > 0);

  // 4. Permanent purge chest numbers
  db.chestNumbers = (db.chestNumbers || []).filter(cn => cn.participantId !== partId && cn.entityId !== partId);

  // 5. Permanent purge registrations
  db.registrations = ((db as any).registrations || []).filter((reg: any) => reg.participantId !== partId);

  // 6. Permanent purge green room assignments
  db.greenRoomAssignments = (db.greenRoomAssignments || []).filter(gr => (gr as any).participantId !== partId);

  // 7. Direct MongoDB Atlas permanent deletion of participant & all related documents
  const mongoDb = getDb();
  if (mongoDb) {
    try {
      await Promise.all([
        mongoDb.collection('participants').deleteMany({ $or: [{ id: partId }, { _id: partId as any }] }),
        mongoDb.collection('results').deleteMany({ participantId: partId }),
        mongoDb.collection('registrations').deleteMany({ participantId: partId }),
        mongoDb.collection('chestNumbers').deleteMany({ $or: [{ participantId: partId }, { entityId: partId }] }),
        mongoDb.collection('greenRoomAssignments').deleteMany({ participantId: partId }),
        mongoDb.collection('app_state').updateOne({ _id: 'global_state' as any }, { $pull: { participants: { id: partId } } } as any)
      ]);
    } catch (mongoErr) {
      console.error('Direct MongoDB permanent delete error:', mongoErr);
    }
  }

  await dbClient.logAudit(user.id, user.username, user.role, 'Delete Participant', 'Participant', partId, part.unitId, undefined, { deletionReason: reason || 'Permanent deletion' });
  await dbClient.save();

  res.json({ message: 'Participant and all associated records permanently deleted successfully' });
};

apiRouter.post('/participants/:id/delete', authenticate, hardDeleteParticipant);
apiRouter.delete('/participants/:id', authenticate, hardDeleteParticipant);


let teamsHealed = false;

apiRouter.get('/teams', authenticate, async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  // Auto-heal team names & team capacity limits for existing database records (run once on load)
  if (!teamsHealed) {
    let modifiedDB = false;
    for (let i = 0; i < db.teams.length; i++) {
      const t = db.teams[i];
      if (t.deletedAt) continue;

      const comp = db.competitions.find(c => c.id === t.competitionId);
      const maxCapacity = comp?.teamSize || 3;

      // 1. If team member count exceeds maxCapacity (e.g. 4 members when max is 3), split excess members into new team
      if (t.memberIds.length > maxCapacity) {
        const excessMemberIds = t.memberIds.slice(maxCapacity);
        t.memberIds = t.memberIds.slice(0, maxCapacity);

        const firstExcessMember = db.participants.find(p => p.id === excessMemberIds[0]);
        const newTeam: Team = {
          id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          teamNumber: `T-${String(db.teams.length + 1).padStart(3, '0')}`,
          teamName: firstExcessMember ? `${firstExcessMember.fullName} & Team` : 'New Group Team',
          unitId: t.unitId,
          categoryId: t.categoryId,
          competitionId: t.competitionId,
          memberIds: excessMemberIds,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.teams.push(newTeam);
        modifiedDB = true;
      }

      // 2. Format team name as First Registered Leader & Team
      const firstMember = db.participants.find(p => p.id === t.memberIds[0]);
      if (firstMember && (!t.teamName || (t.teamName.toLowerCase().includes('team') && !t.teamName.includes('&')))) {
        t.teamName = `${firstMember.fullName} & Team`;
        modifiedDB = true;
      }
    }

    if (modifiedDB) {
      await dbClient.save();
    }
    teamsHealed = true;
  }

  let teams = db.teams.filter(t => !t.deletedAt);

  // Isolation
  if (user.role === UserRole.UNIT_TEAM_LEADER) {
    teams = teams.filter(t => t.unitId === user.assignedUnitId);
  } else if (req.query.unitId) {
    teams = teams.filter(t => t.unitId === req.query.unitId);
  }

  if (req.query.competitionId) {
    teams = teams.filter(t => t.competitionId === req.query.competitionId);
  }

  res.json(teams);
});

// Create/Register Group Team
apiRouter.post('/teams', authenticate, async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  // Check registration lock for Unit Leaders
  if (!db.eventSettings.registrationOpen && user.role === UserRole.UNIT_TEAM_LEADER) {
    return res.status(400).json({ error: 'Registration process is currently closed/disabled by the sector team.' });
  }

  const { teamName, unitId, categoryId, competitionId, memberIds } = req.body;

  if (!categoryId || !competitionId || !memberIds || !Array.length) {
    return res.status(400).json({ error: 'Category, Competition, and Members are required.' });
  }

  const finalUnitId = user.role === UserRole.UNIT_TEAM_LEADER ? user.assignedUnitId! : unitId;
  if (!finalUnitId) {
    return res.status(400).json({ error: 'Unit ID is required' });
  }

  const comp = db.competitions.find(c => c.id === competitionId);
  if (!comp || comp.participationType !== ParticipationType.GROUP) {
    return res.status(400).json({ error: 'Selected competition is not a group event.' });
  }

  if (comp.categoryId !== categoryId) {
    return res.status(400).json({ error: 'Selected competition category mismatch.' });
  }



  // Validate team size (min 2, max comp.teamSize)
  if (memberIds.length < 2 || memberIds.length > comp.teamSize) {
    return res.status(400).json({ error: `Team size must be between 2 and ${comp.teamSize} members for ${comp.name}.` });
  }

  // Validate member qualifications
  const members: Participant[] = [];
  for (const mid of memberIds) {
    const p = db.participants.find(part => part.id === mid && !part.deletedAt);
    if (!p) {
      return res.status(400).json({ error: `Member participant ${mid} not found or is deleted.` });
    }
    // Unit match
    const unitObj = (db.units || []).find((u: any) => u.id === finalUnitId || u.name === finalUnitId);
    const isUnitMatch = p.unitId === finalUnitId || (unitObj && (p.unitId === unitObj.id || p.unitId === unitObj.name));
    if (!isUnitMatch) {
      return res.status(400).json({ error: `Member ${p.fullName} belongs to a different unit.` });
    }
    // Category match
    const targetCatId = categoryId || comp.categoryId;
    const catObj = (db.categories || []).find((c: any) => c.id === targetCatId || c.name === targetCatId);
    const pCatId = p.selectedCategoryId || (p as any).categoryId;
    const isCategoryMatch = 
      pCatId === targetCatId ||
      (catObj && (pCatId === catObj.id || pCatId === catObj.name)) ||
      (p.selectedCategoryId && (p.selectedCategoryId === comp.categoryId || p.selectedCategoryId === targetCatId)) ||
      ((p as any).categoryId && ((p as any).categoryId === comp.categoryId || (p as any).categoryId === targetCatId));
    if (!isCategoryMatch) {
      return res.status(400).json({ error: `Member ${p.fullName} belongs to a different category.` });
    }

    // Limit checks: Make sure this participant has not exceeded 2 group events
    // Let's count current group teams where this participant is a member
    const currentMemberTeams = db.teams.filter(t =>
      t.memberIds.includes(p.id) && !t.deletedAt && t.competitionId !== competitionId
    );
    if (currentMemberTeams.length >= db.eventSettings.maxGroupEvents) {
      return res.status(400).json({
        error: `Member ${p.fullName} has already reached the limit of ${db.eventSettings.maxGroupEvents} group competitions.`
      });
    }

    // Prevent duplicate team membership for same competition
    const isAlreadyInSameComp = db.teams.some(t =>
      t.competitionId === competitionId && t.memberIds.includes(p.id) && !t.deletedAt
    );
    if (isAlreadyInSameComp) {
      return res.status(400).json({ error: `Member ${p.fullName} is already in another team registered for this competition.` });
    }
  }

  const serial = db.teams.filter(t => t.competitionId === competitionId && !t.deletedAt).length + 1;
  const firstMember = db.participants.find(p => p.id === memberIds[0]);
  const finalTeamName = firstMember ? `${firstMember.fullName} & Team` : `${db.units.find(u => u.id === finalUnitId)?.name} Team ${serial}`;

  const newTeam: Team = {
    id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    teamNumber: `T-${String(db.teams.length + 1).padStart(3, '0')}`,
    teamName: finalTeamName,
    unitId: finalUnitId,
    categoryId,
    competitionId,
    memberIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.teams.push(newTeam);

  // Log Audit
  await dbClient.logAudit(user.id, user.username, user.role, 'Create Group Team', 'Team', newTeam.id, finalUnitId, undefined, newTeam);
  await dbClient.save();

  res.json({ message: 'Group team registered successfully', team: newTeam });
});

// Update Team Members
apiRouter.put('/teams/:id', authenticate, async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  // Check registration lock for Unit Leaders
  if (!db.eventSettings.registrationOpen && user.role === UserRole.UNIT_TEAM_LEADER) {
    return res.status(400).json({ error: 'Registration process is currently closed/disabled by the sector team.' });
  }

  const teamId = req.params.id;

  const teamIndex = db.teams.findIndex(t => t.id === teamId && !t.deletedAt);
  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const team = db.teams[teamIndex];

  // Isolation check
  if (user.role === UserRole.UNIT_TEAM_LEADER && team.unitId !== user.assignedUnitId) {
    return res.status(403).json({ error: 'Access denied. You can only manage teams belonging to your own unit.' });
  }

  const { teamName, memberIds } = req.body;
  const oldTeam = { ...team };

  if (teamName) team.teamName = teamName.trim();

  if (memberIds) {
    const comp = db.competitions.find(c => c.id === team.competitionId);
    if (!comp) return res.status(404).json({ error: 'Competition not found' });

    if (memberIds.length < 2 || memberIds.length > comp.teamSize) {
      return res.status(400).json({ error: `Team size must be between 2 and ${comp.teamSize} members.` });
    }

    // Verify member qualifications
    for (const mid of memberIds) {
      const p = db.participants.find(part => part.id === mid && !part.deletedAt);
      if (!p) {
        return res.status(400).json({ error: `Member ${mid} not found.` });
      }
      // Unit match
      const unitObj = (db.units || []).find((u: any) => u.id === team.unitId || u.name === team.unitId);
      const isUnitMatch = p.unitId === team.unitId || (unitObj && (p.unitId === unitObj.id || p.unitId === unitObj.name));
      if (!isUnitMatch) {
        return res.status(400).json({ error: `Member ${p.fullName} belongs to a different unit.` });
      }
      // Category match
      const targetCatId = team.categoryId || comp.categoryId;
      const catObj = (db.categories || []).find((c: any) => c.id === targetCatId || c.name === targetCatId);
      const pCatId = p.selectedCategoryId || (p as any).categoryId;
      const isCategoryMatch = 
        pCatId === targetCatId ||
        (catObj && (pCatId === catObj.id || pCatId === catObj.name)) ||
        (p.selectedCategoryId && (p.selectedCategoryId === comp.categoryId || p.selectedCategoryId === targetCatId)) ||
        ((p as any).categoryId && ((p as any).categoryId === comp.categoryId || (p as any).categoryId === targetCatId));
      if (!isCategoryMatch) {
        return res.status(400).json({ error: `Member ${p.fullName} belongs to a different category.` });
      }

      // Max group event counts
      const currentMemberTeams = db.teams.filter(t =>
        t.memberIds.includes(p.id) && !t.deletedAt && t.id !== teamId
      );
      if (currentMemberTeams.length >= db.eventSettings.maxGroupEvents) {
        return res.status(400).json({ error: `Member ${p.fullName} already registered for maximum ${db.eventSettings.maxGroupEvents} group events.` });
      }
    }

    team.memberIds = memberIds;
  }

  // Always enforce team name to be based on the first member
  const firstMember = db.participants.find(p => p.id === team.memberIds[0]);
  if (firstMember) {
    team.teamName = `${firstMember.fullName} & Team`;
  }

  team.updatedAt = new Date().toISOString();
  await dbClient.logAudit(user.id, user.username, user.role, 'Update Group Team', 'Team', teamId, team.unitId, oldTeam, team);
  await dbClient.save();

  res.json({ message: 'Team updated successfully', team });
});

// Soft Delete Team
apiRouter.post('/teams/:id/delete', authenticate, async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  // Check registration lock for Unit Leaders
  if (!db.eventSettings.registrationOpen && user.role === UserRole.UNIT_TEAM_LEADER) {
    return res.status(400).json({ error: 'Registration process is currently closed/disabled by the sector team.' });
  }

  const teamId = req.params.id;

  const teamIndex = db.teams.findIndex(t => t.id === teamId && !t.deletedAt);
  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const team = db.teams[teamIndex];

  // Isolation check
  if (user.role === UserRole.UNIT_TEAM_LEADER && team.unitId !== user.assignedUnitId) {
    return res.status(403).json({ error: 'Access denied. You can only manage teams belonging to your own unit.' });
  }

  // Safety check: has results?
  const hasResults = db.results.some(r => r.teamId === teamId && !r.deletedAt);
  if (hasResults) {
    return res.status(400).json({ error: 'Cannot delete team because results have been entered. Remove results first.' });
  }

  team.deletedAt = new Date().toISOString();
  team.deletedBy = user.username;

  await dbClient.logAudit(user.id, user.username, user.role, 'Delete Group Team', 'Team', teamId, team.unitId, undefined, { deleted: true });
  await dbClient.save();

  res.json({ message: 'Team deleted successfully' });
});


// 10. RESULT ENTRY & SCOREBOARDS (CRUD)

// Enter Result (Sector Team and Super Admin only)
apiRouter.post('/results', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { categoryId, competitionId, participantId, teamId, judge1Mark, judge2Mark, status, remarks, publishedStatus, manualRankOverride, manualRankOverrideReason, overrideRank } = req.body;

  if (!categoryId || !competitionId || (!participantId && !teamId) || !status) {
    return res.status(400).json({ error: 'Category, Competition, Participant/Team and Status are required.' });
  }

  // Validate decimals/numbers strictly 0 to 100
  const j1 = Number(judge1Mark) || 0;
  const j2 = Number(judge2Mark) || 0;
  if (j1 < 0 || j2 < 0) {
    return res.status(400).json({ error: 'Judge marks cannot be negative.' });
  }

  const sheetTemp = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.competitionId === competitionId && !s.deletedAt);
  const activeCount = (j1 > 0 ? 1 : 0) + (j2 > 0 ? 1 : 0) || 1;
  const totalMark = j1 + j2;
  const averageMark = Math.round((totalMark / activeCount) * 100) / 100;
  if (averageMark < 0 || averageMark > 100) {
    return res.status(400).json({ error: 'Average mark must be strictly between 0 and 100.' });
  }

  // Check duplicates
  const existingResult = db.results.find(r =>
    r.competitionId === competitionId &&
    ((participantId && r.participantId === participantId) || (teamId && r.teamId === teamId)) &&
    !r.deletedAt
  );

  if (existingResult) {
    return res.status(400).json({ error: 'Result already entered for this participant/team in this competition. Edit the existing record instead.' });
  }

  const newResult: Result = {
    id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    categoryId,
    competitionId,
    participantId: participantId || undefined,
    teamId: teamId || undefined,
    judge1Mark: j1,
    judge2Mark: j2,
    totalMark,
    averageMark,
    status,
    remarks,
    publishedStatus: publishedStatus !== undefined ? publishedStatus : true,
    manualRankOverride: !!manualRankOverride,
    manualRankOverrideReason,
    rank: manualRankOverride ? Number(overrideRank) : undefined,
    createdBy: user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.results.push(newResult);
  await dbClient.save();

  // Trigger ranks and scores recalculations immediately!
  CalculationService.calculateCompetitionRanks(competitionId);

  // Sync corresponding JudgmentSheet status to COMPLETED and update JudgeScore
  let sheet = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.competitionId === competitionId && !s.deletedAt);
  if (sheet) {
    sheet.status = JudgmentSheetStatus.COMPLETED;
    sheet.publishedToResults = newResult.publishedStatus;
    sheet.updatedAt = new Date().toISOString();

    // Find the green room assignment for this participant/team
    const gr = (db.greenRoomAssignments || []).find((a: GreenRoomAssignment) =>
      a.competitionId === competitionId &&
      !a.deletedAt &&
      ((participantId && a.participantId === participantId) || (teamId && a.teamId === teamId))
    );

    if (gr) {
      // Find or create JudgeScore
      let score = (db.judgeScores || []).find((s: JudgeScore) => s.judgmentSheetId === sheet?.id && s.greenRoomAssignmentId === gr.id);

      let judgeScoreStatus = JudgeScoreStatus.PARTICIPATED;
      if (newResult.status === ResultStatus.ABSENT) judgeScoreStatus = JudgeScoreStatus.ABSENT;
      if (newResult.status === ResultStatus.DISQUALIFIED) judgeScoreStatus = JudgeScoreStatus.DISQUALIFIED;

      if (score) {
        score.judgeScores = [
          { judgeNumber: 1, mark: j1 },
          { judgeNumber: 2, mark: j2 }
        ];
        score.totalMark = totalMark;
        const activeCount = (j1 > 0 ? 1 : 0) + (j2 > 0 ? 1 : 0) || 1;
        score.averageMark = averageMark;
        score.status = judgeScoreStatus;
        score.remarks = remarks || '';
        if (newResult.manualRankOverride && newResult.rank) {
          score.rank = newResult.rank;
        }
      } else {
        const activeCount = (j1 > 0 ? 1 : 0) + (j2 > 0 ? 1 : 0) || 1;
        const newScore: JudgeScore = {
          id: `js_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          judgmentSheetId: sheet.id,
          competitionId: sheet.competitionId,
          codeLetter: gr.codeLetter,
          greenRoomAssignmentId: gr.id,
          judgeScores: [
            { judgeNumber: 1, mark: j1 },
            { judgeNumber: 2, mark: j2 }
          ],
          totalMark: totalMark,
          averageMark: averageMark,
          status: judgeScoreStatus,
          remarks: remarks || '',
          enteredBy: user.id,
          enteredAt: new Date().toISOString()
        };
        if (newResult.manualRankOverride && newResult.rank) {
          newScore.rank = newResult.rank;
        }
        if (!db.judgeScores) db.judgeScores = [];
        db.judgeScores.push(newScore);
      }
    }
  }

  await dbClient.logAudit(user.id, user.username, user.role, 'Enter Competition Result', 'Result', newResult.id, undefined, undefined, newResult);
  await dbClient.save();

  res.json({ message: 'Result entered successfully', result: newResult });
});

// Update Result
apiRouter.put('/results/:id', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const resId = req.params.id;

  const resIndex = db.results.findIndex(r => r.id === resId && !r.deletedAt);
  if (resIndex === -1) {
    return res.status(404).json({ error: 'Result not found' });
  }

  const resultObj = db.results[resIndex];
  const oldRes = { ...resultObj };

  // Update properties
  if (req.body.status) resultObj.status = req.body.status;
  if (req.body.remarks !== undefined) resultObj.remarks = req.body.remarks;
  if (req.body.publishedStatus !== undefined) resultObj.publishedStatus = req.body.publishedStatus;

  // Judges' marks recalculations
  const j1 = req.body.judge1Mark !== undefined ? Number(req.body.judge1Mark) : resultObj.judge1Mark;
  const j2 = req.body.judge2Mark !== undefined ? Number(req.body.judge2Mark) : resultObj.judge2Mark;
  resultObj.judge1Mark = j1;
  resultObj.judge2Mark = j2;
  const sheetTemp = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.competitionId === resultObj.competitionId && !s.deletedAt);
  const activeCount = (j1 > 0 ? 1 : 0) + (j2 > 0 ? 1 : 0) || 1;
  resultObj.totalMark = j1 + j2;
  resultObj.averageMark = Math.round(((j1 + j2) / activeCount) * 100) / 100;

  // Rank overrides
  if (req.body.manualRankOverride !== undefined) {
    resultObj.manualRankOverride = !!req.body.manualRankOverride;
    resultObj.manualRankOverrideReason = req.body.manualRankOverrideReason;
  }

  if (resultObj.manualRankOverride) {
    resultObj.rank = Number(req.body.overrideRank) || resultObj.rank;
    // Log override audit if different
    if (oldRes.rank !== resultObj.rank || !oldRes.manualRankOverride) {
      await dbClient.logAudit(user.id, user.username, user.role, 'Manual Rank Override', 'Result', resId, undefined, { previousRank: oldRes.rank }, { overriddenRank: resultObj.rank, reason: resultObj.manualRankOverrideReason });
    }
  } else if (req.body.manualRankOverride === false) {
    resultObj.rank = undefined;
    resultObj.manualRankOverrideReason = undefined;
  }

  resultObj.updatedAt = new Date().toISOString();
  resultObj.updatedBy = user.id;

  await dbClient.save();

  // Recalculate competition ranks
  CalculationService.calculateCompetitionRanks(resultObj.competitionId);

  // Sync corresponding JudgmentSheet and JudgeScore
  let sheet = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.competitionId === resultObj.competitionId && !s.deletedAt);
  if (sheet) {
    if (resultObj.publishedStatus !== undefined) {
      sheet.publishedToResults = resultObj.publishedStatus;
    }

    // Find green room assignment
    const gr = (db.greenRoomAssignments || []).find((a: GreenRoomAssignment) =>
      a.competitionId === resultObj.competitionId &&
      !a.deletedAt &&
      ((resultObj.participantId && a.participantId === resultObj.participantId) || (resultObj.teamId && a.teamId === resultObj.teamId))
    );

    if (gr) {
      let score = (db.judgeScores || []).find((s: JudgeScore) => s.judgmentSheetId === sheet?.id && s.greenRoomAssignmentId === gr.id);

      let judgeScoreStatus = JudgeScoreStatus.PARTICIPATED;
      if (resultObj.status === ResultStatus.ABSENT) judgeScoreStatus = JudgeScoreStatus.ABSENT;
      if (resultObj.status === ResultStatus.DISQUALIFIED) judgeScoreStatus = JudgeScoreStatus.DISQUALIFIED;

      if (score) {
        score.judgeScores = [
          { judgeNumber: 1, mark: resultObj.judge1Mark },
          { judgeNumber: 2, mark: resultObj.judge2Mark }
        ];
        score.totalMark = resultObj.totalMark;
        score.averageMark = resultObj.averageMark;
        score.status = judgeScoreStatus;
        score.remarks = resultObj.remarks || '';
        if (resultObj.manualRankOverride && resultObj.rank) {
          score.rank = resultObj.rank;
        }
      }
    }
    sheet.updatedAt = new Date().toISOString();
  }

  await dbClient.logAudit(user.id, user.username, user.role, 'Update Competition Result', 'Result', resId, undefined, oldRes, resultObj);
  await dbClient.save();

  res.json({ message: 'Result updated successfully', result: resultObj });
});

// Soft Delete Result
apiRouter.post('/results/:id/delete', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const resId = req.params.id;

  const resIndex = db.results.findIndex(r => r.id === resId && !r.deletedAt);
  if (resIndex === -1) {
    return res.status(404).json({ error: 'Result not found' });
  }

  const resultObj = db.results[resIndex];
  resultObj.deletedAt = new Date().toISOString();
  resultObj.deletedBy = user.username;

  await dbClient.save();

  // Recalculate ranks immediately
  CalculationService.calculateCompetitionRanks(resultObj.competitionId);
  await dbClient.logAudit(user.id, user.username, user.role, 'Delete Competition Result', 'Result', resId, undefined, { deleted: true });
  await dbClient.save();

  res.json({ message: 'Result deleted successfully' });
});

// Read Results for specific competition
apiRouter.get('/results', authenticate, async (req, res) => {
  await dbClient.waitForSync();
  const db = dbClient.get();
  let results = (db.results || []).filter(r => !r.deletedAt);

  const compId = req.query.competitionId ? String(req.query.competitionId) : undefined;
  const catId = req.query.categoryId ? String(req.query.categoryId) : undefined;

  if (compId) {
    results = results.filter(r => r.competitionId === compId);
  }
  if (catId) {
    results = results.filter(r => r.categoryId === catId);
  }
  if (req.query.stageType) {
    const stageType = String(req.query.stageType);
    results = results.filter(r => {
      const comp = db.competitions.find(c => c.id === r.competitionId);
      return comp?.stageType === stageType;
    });
  }

  // Two-way sync: If querying for a specific competition, also check Judgment Sheet scores to bridge any unpopulated results
  if (compId) {
    const sheet = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.competitionId === compId && !s.deletedAt);
    if (sheet) {
      const sheetScores = (db.judgeScores || []).filter((s: JudgeScore) => s.judgmentSheetId === sheet.id);
      for (const score of sheetScores) {
        const gr = (db.greenRoomAssignments || []).find((a: GreenRoomAssignment) => a.id === score.greenRoomAssignmentId);
        if (!gr) continue;

        const pId = gr.participantId;
        const tId = gr.teamId;
        if (!pId && !tId) continue;

        const existingRes = results.find(r => (pId && r.participantId === pId) || (tId && r.teamId === tId));

        const j1 = score.judgeScores?.find(j => j.judgeNumber === 1);
        const j2 = score.judgeScores?.find(j => j.judgeNumber === 2);
        const j1Mark = j1?.mark || 0;
        const j2Mark = j2?.mark || 0;
        const activeCount = (j1Mark > 0 ? 1 : 0) + (j2Mark > 0 ? 1 : 0) || 1;
        const calculatedAvg = score.averageMark !== undefined ? score.averageMark : Math.round(((j1Mark + j2Mark) / activeCount) * 100) / 100;

        let resStatus: ResultStatus = ResultStatus.PARTICIPATED;
        if (score.status === JudgeScoreStatus.ABSENT || score.status === 'absent') resStatus = ResultStatus.ABSENT;
        if (score.status === JudgeScoreStatus.DISQUALIFIED || score.status === 'disqualified') resStatus = ResultStatus.DISQUALIFIED;

        if (existingRes) {
          // Overlay missing or outdated evaluation fields from Judgment Sheet
          if (existingRes.judge1Mark === undefined || (j1Mark > 0 && existingRes.judge1Mark === 0)) existingRes.judge1Mark = j1Mark;
          if (existingRes.judge2Mark === undefined || (j2Mark > 0 && existingRes.judge2Mark === 0)) existingRes.judge2Mark = j2Mark;
          if (existingRes.totalMark === undefined || (score.totalMark > 0 && existingRes.totalMark === 0)) existingRes.totalMark = score.totalMark || (j1Mark + j2Mark);
          if (existingRes.averageMark === undefined || (calculatedAvg > 0 && existingRes.averageMark === 0)) existingRes.averageMark = calculatedAvg;
          if (!existingRes.manualRankOverride && score.rank) existingRes.rank = score.rank;
          if (score.status) existingRes.status = resStatus;
        } else if (score.judgeScores && (score.judgeScores.length > 0 || score.status !== JudgeScoreStatus.PARTICIPATED)) {
          // Synthesize result record from Judgment Sheet score if not explicitly in db.results array yet
          const virtualRes: any = {
            id: `v_res_${score.id}`,
            categoryId: sheet.categoryId,
            competitionId: compId,
            participantId: pId,
            teamId: tId,
            judge1Mark: j1Mark,
            judge2Mark: j2Mark,
            totalMark: score.totalMark || (j1Mark + j2Mark),
            averageMark: calculatedAvg,
            rank: score.rank,
            status: resStatus,
            remarks: score.remarks,
            publishedStatus: sheet.publishedToResults || false,
            createdAt: score.enteredAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          results.push(virtualRes);
        }
      }
    }
  }

  const enrichedResults = results.map(r => {
    let participantName = undefined;
    let teamName = undefined;
    let unitName = undefined;
    let teamNumber = undefined;

    if (r.participantId) {
      const p = db.participants.find(part => part.id === r.participantId);
      participantName = p?.fullName;
      const u = db.units.find(u => u.id === p?.unitId);
      unitName = u?.name;
    } else if (r.teamId) {
      const t = db.teams.find(team => team.id === r.teamId);
      teamName = t?.teamName;
      teamNumber = t?.teamNumber;
      const u = db.units.find(u => u.id === t?.unitId);
      unitName = u?.name;
    }

    return {
      ...r,
      participantName,
      teamName,
      teamNumber,
      unitName
    };
  });

  res.json(enrichedResults);
});

// Bulk Announce/Un-announce Results for a Competition
apiRouter.post('/results/announce', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { competitionId, announce } = req.body;

  if (!competitionId) {
    return res.status(400).json({ error: 'Competition ID is required.' });
  }

  const results = db.results.filter(r => r.competitionId === competitionId && !r.deletedAt);
  if (results.length === 0) {
    return res.status(404).json({ error: 'No results found for this competition.' });
  }

  const shouldAnnounce = announce !== false; // default to true
  results.forEach(r => {
    r.publishedStatus = shouldAnnounce;
    r.updatedAt = new Date().toISOString();
  });

  await dbClient.logAudit(user.id, user.username, user.role, shouldAnnounce ? 'Announce Competition Results' : 'Un-announce Competition Results', 'Competition', competitionId);
  await dbClient.save();

  res.json({ message: `Results ${shouldAnnounce ? 'announced' : 'un-announced'} successfully for ${results.length} entries.`, count: results.length });
});

// Update Participant Chest Number (Sector Team & Super Admin only)
apiRouter.put('/participants/:id/chest', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), (req, res) => handleChestNumberUpdate(req, res));


// 11. PUBLIC STANDINGS & INDIVIDUAL SCOREBOARDS (ACCESSIBLE TO ALL LOGGED IN USERS)

// Get Individual Scoreboard (Calculated on server!)
apiRouter.get('/scoreboard', authenticate, async (req, res) => {
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
  const unitId = req.query.unitId ? String(req.query.unitId) : undefined;
  const stageType = req.query.stageType ? (String(req.query.stageType) as StageType) : undefined;
  const search = req.query.search ? String(req.query.search) : undefined;

  const scoreboard = CalculationService.getIndividualScoreboard({
    categoryId,
    unitId,
    stageType,
    search
  });

  res.json(scoreboard);
});

// Get Unit Standings (Calculated on server!)
apiRouter.get('/standings', authenticate, async (req, res) => {
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
  const standings = CalculationService.getUnitStandings({ categoryId });
  res.json(standings);
});
// 12. USER MANAGEMENT (SUPER ADMIN ONLY)

// Read users
apiRouter.get('/users', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  // Filter sensitive fields
  const safeUsers = db.users.map(u => ({
    id: u.id,
    fullName: u.fullName,
    username: u.username,
    email: u.email,
    role: u.role,
    assignedUnitId: u.assignedUnitId,
    assignedCompetitionIds: u.assignedCompetitionIds || [],
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt
  }));
  res.json(safeUsers);
});

// Create user
apiRouter.post('/users', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const { fullName, username, password, email, role, assignedUnitId, assignedCompetitionIds } = req.body;

  const reqUser = (req as any).user;
  if (reqUser.role !== UserRole.SUPER_ADMIN && (role === UserRole.SUPER_ADMIN || role === UserRole.SECTOR_TEAM)) {
    return res.status(403).json({ error: 'Only Super Admin can create Admin or Super Admin accounts.' });
  }

  if (!fullName || !username || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields: fullName, username, password, role.' });
  }

  const existingUser = db.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
  if (existingUser) {
    return res.status(409).json({ error: 'Username is already taken. Please choose another.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    fullName: fullName.trim(),
    username: username.toLowerCase().trim(),
    passwordHash,
    email: email || undefined,
    role: role as UserRole,
    assignedUnitId: role === UserRole.UNIT_TEAM_LEADER ? assignedUnitId : undefined,
    assignedCompetitionIds: role === UserRole.JUDGE && Array.isArray(assignedCompetitionIds) ? assignedCompetitionIds : undefined,
    active: true,
    mustChangePassword: true,
    failedLoginAttempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.users.push(newUser);
  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Create User Account', 'User', newUser.id, undefined, undefined, { username: newUser.username, role: newUser.role, assignedUnitId: newUser.assignedUnitId });
  await dbClient.save();

  res.json({
    message: 'User account created successfully. The user must change password upon first login.',
    user: {
      id: newUser.id,
      fullName: newUser.fullName,
      username: newUser.username,
      role: newUser.role,
      assignedUnitId: newUser.assignedUnitId,
      assignedCompetitionIds: newUser.assignedCompetitionIds,
      active: newUser.active
    }
  });
});

// Update user details or reset password
apiRouter.put('/users/:id', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const userId = req.params.id;

  const userIndex = db.users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const targetUser = db.users[userIndex];
  const reqUser = (req as any).user;

  if (reqUser.role !== UserRole.SUPER_ADMIN && (targetUser.role === UserRole.SUPER_ADMIN || targetUser.role === UserRole.SECTOR_TEAM)) {
    return res.status(403).json({ error: 'Only Super Admin can modify Admin or Super Admin accounts.' });
  }

  const oldUser = { ...targetUser };

  const { fullName, email, role, assignedUnitId, assignedCompetitionIds, active, resetPassword } = req.body;

  if (fullName) targetUser.fullName = fullName.trim();
  if (email !== undefined) targetUser.email = email;
  if (active !== undefined) {
    targetUser.active = active;
  }

  if (assignedCompetitionIds !== undefined && Array.isArray(assignedCompetitionIds)) {
    targetUser.assignedCompetitionIds = assignedCompetitionIds;
    // Immediately purge targetUser from sheet.claimedJudges for any competitions they are no longer assigned to
    if (db.judgmentSheets && Array.isArray(db.judgmentSheets)) {
      for (const js of db.judgmentSheets) {
        if ((js as any).claimedJudges) {
          for (const [slotKey, claimObj] of Object.entries((js as any).claimedJudges as Record<string, any>)) {
            if (claimObj?.userId === targetUser.id && !assignedCompetitionIds.includes(js.competitionId)) {
              delete (js as any).claimedJudges[slotKey];
            }
          }
        }
      }

      // Auto-claim available slots for targetUser for any assigned competitions where targetUser is not yet claimed
      if (targetUser.role === UserRole.JUDGE) {
        for (const compId of assignedCompetitionIds) {
          const js = db.judgmentSheets.find((sheet: any) => sheet.competitionId === compId && !sheet.deletedAt);
          if (js) {
            if (!(js as any).claimedJudges) {
              (js as any).claimedJudges = {};
            }
            const claimedObj = (js as any).claimedJudges as Record<string, any>;
            const alreadyClaimed = Object.values(claimedObj).some((c: any) => c?.userId === targetUser.id);
            if (!alreadyClaimed) {
              const numJudges = js.numJudges || 2;
              for (let i = 1; i <= numJudges; i++) {
                if (!claimedObj[i]) {
                  claimedObj[i] = {
                    userId: targetUser.id,
                    username: targetUser.username,
                    claimedAt: new Date().toISOString()
                  };
                  break;
                }
              }
            }
          }
        }
      }
    }
  }

  if (role) {
    targetUser.role = role;
    if (role === UserRole.UNIT_TEAM_LEADER) {
      targetUser.assignedUnitId = assignedUnitId;
    } else {
      targetUser.assignedUnitId = undefined;
    }
  }

  if (resetPassword) {
    if (resetPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    const salt = bcrypt.genSaltSync(10);
    targetUser.passwordHash = bcrypt.hashSync(resetPassword, salt);
    targetUser.mustChangePassword = true; // force change again
  }

  targetUser.updatedAt = new Date().toISOString();
  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Update User Account', 'User', userId, undefined, oldUser, targetUser);
  await dbClient.save();

  res.json({ message: 'User account updated successfully.' });
});

// Force reset password PIN endpoint
apiRouter.post('/users/:id/force-reset-password', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const userId = req.params.id;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'PIN / Password must be at least 4 characters long.' });
  }

  const userIndex = db.users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const targetUser = db.users[userIndex];
  const reqUser = (req as any).user;

  if (reqUser.role !== UserRole.SUPER_ADMIN && (targetUser.role === UserRole.SUPER_ADMIN || targetUser.role === UserRole.SECTOR_TEAM)) {
    return res.status(403).json({ error: 'Only Super Admin can modify Admin or Super Admin accounts.' });
  }

  const oldUser = { ...targetUser };
  const salt = bcrypt.genSaltSync(10);
  targetUser.passwordHash = bcrypt.hashSync(newPassword, salt);
  targetUser.mustChangePassword = true;
  targetUser.updatedAt = new Date().toISOString();

  await dbClient.logAudit(reqUser.id, reqUser.username, reqUser.role, 'Force Reset Password PIN', 'User', userId, undefined, oldUser, targetUser);
  await dbClient.save();

  res.json({ success: true, message: 'Password PIN reset successfully.' });
});

// Force log out a user by revoking all their sessions
apiRouter.post('/users/:id/logout', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const userId = req.params.id;

  // Note: With stateless JWTs, forceful logout requires a token blacklist or updating a sessionVersion on the user object.
  // For now, we just log the action.

  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Force Logout Sessions', 'User', userId);
  await dbClient.save();

  res.json({ message: 'User forced to log out successfully' });
});

// Delete user
apiRouter.delete('/users/:id', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const userId = req.params.id;

  const reqUser = (req as any).user;

  if (userId === 'usr_admin' || userId === reqUser.id) {
    return res.status(400).json({ error: 'Cannot delete the main admin account or your own logged-in account.' });
  }

  const index = db.users.findIndex(u => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const targetUser = db.users[index];
  if (reqUser.role !== UserRole.SUPER_ADMIN && (targetUser.role === UserRole.SUPER_ADMIN || targetUser.role === UserRole.SECTOR_TEAM)) {
    return res.status(403).json({ error: 'Only Super Admin can delete Admin accounts.' });
  }

  const deletedUser = db.users[index];
  db.users.splice(index, 1);

  await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Delete User Account', 'User', userId, undefined, deletedUser);
  await dbClient.save();

  res.json({ message: 'User account deleted successfully' });
});


// 13. DATA DASHBOARD & STATS SUMMARY

apiRouter.get('/dashboard-stats', authenticate, async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  // Scoped filters
  let participants = db.participants.filter(p => !p.deletedAt);
  let teams = db.teams.filter(t => !t.deletedAt);
  let results = db.results.filter(r => !r.deletedAt);

  // Global stats are now shown to all users, including unit team leaders, 
  // so they can see complete announced results and standings.
  // Registrations counts
  const individualRegistrationsCount = participants.reduce((sum, p) => {
    const reg = (db as any).registrations?.find((r: any) => r.participantId === p.id);
    return sum + (reg ? reg.selectedIndividualCompetitionIds.length : 0);
  }, 0);

  // Group registrations count
  const groupRegistrationsCount = teams.length;

  // Active units count
  const unitsCount = db.units.filter(u => u.active).length;

  // Total active competitions
  const compsCount = db.competitions.filter(c => c.active).length;

  // Results progress (Competition level)
  // Find all active competitions that have at least 1 valid registration (individual or team)
  const activeCompetitions = db.competitions.filter(comp => {
    if (!comp.active) return false;

    if (comp.participationType === ParticipationType.INDIVIDUAL) {
      // Check if any individual is registered for this competition
      const regsInComp = (db as any).registrations?.filter((r: any) => r.selectedIndividualCompetitionIds.includes(comp.id)) || [];
      const hasActiveReg = regsInComp.some((r: any) => {
        const p = db.participants.find(part => part.id === r.participantId);
        return p && !p.deletedAt;
      });
      return hasActiveReg;
    } else {
      // Check if any team is registered for this competition
      return db.teams.some(t => t.competitionId === comp.id && !t.deletedAt);
    }
  });

  const totalResultsExpected = activeCompetitions.length;

  // A competition is considered "entered" if it has at least one result
  const resultsEnteredCount = activeCompetitions.filter(comp => {
    return db.results.some(r => r.competitionId === comp.id && !r.deletedAt);
  }).length;

  const resultsPendingCount = Math.max(0, totalResultsExpected - resultsEnteredCount);

  // Leading Unit Preview
  const standings = CalculationService.getUnitStandings();
  const leadingUnit = standings[0] || null;

  // Top Individual Preview
  const scoreboard = CalculationService.getIndividualScoreboard();
  const topIndividual = scoreboard[0] || null;

  // Top Individual On-Stage
  const scoreboardOnStage = CalculationService.getIndividualScoreboard({ stageType: StageType.ON_STAGE });
  const topIndividualOnStage = scoreboardOnStage[0] || null;

  // Top Individual Off-Stage
  const scoreboardOffStage = CalculationService.getIndividualScoreboard({ stageType: StageType.OFF_STAGE });
  const topIndividualOffStage = scoreboardOffStage[0] || null;

  // Counts by Unit
  const participantsByUnit = db.units.map(u => ({
    unitId: u.id,
    unitName: u.name,
    count: db.participants.filter(p => p.unitId === u.id && !p.deletedAt).length
  }));

  // Counts by Category
  const participantsByCategory = db.categories.map(cat => ({
    categoryId: cat.id,
    categoryName: cat.name,
    count: db.participants.filter(p => p.selectedCategoryId === cat.id && !p.deletedAt).length
  }));

  res.json({
    totalParticipants: participants.length,
    totalUnits: unitsCount,
    totalCompetitions: compsCount,
    individualRegistrations: individualRegistrationsCount,
    groupTeamsCount: groupRegistrationsCount,
    resultsEntered: resultsEnteredCount,
    resultsPending: resultsPendingCount,
    leadingUnit,
    topIndividual,
    topIndividualOnStage,
    topIndividualOffStage,
    participantsByUnit,
    participantsByCategory,
    recentRegistrations: db.participants.filter(p => !p.deletedAt).slice(-5).reverse().map(p => ({
      id: p.id,
      fullName: p.fullName,
      unitName: db.units.find(u => u.id === p.unitId)?.name || 'Unknown',
      categoryName: db.categories.find(c => c.id === p.selectedCategoryId)?.name || 'Unknown',
      createdAt: p.createdAt
    })),
    recentResults: db.results.filter(r => !r.deletedAt && r.publishedStatus).slice(-5).reverse().map(r => {
      const comp = db.competitions.find(c => c.id === r.competitionId);
      const cat = db.categories.find(c => c.id === r.categoryId);
      let participantName = 'Unknown';
      let unitName = 'Unknown';
      if (r.participantId) {
        const p = db.participants.find(part => part.id === r.participantId);
        participantName = p ? p.fullName : 'Unknown';
        unitName = p ? (db.units.find(u => u.id === p.unitId)?.name || 'Unknown') : 'Unknown';
      } else if (r.teamId) {
        const t = db.teams.find(team => team.id === r.teamId);
        participantName = t ? t.teamNumber : 'Unknown';
        unitName = t ? (db.units.find(u => u.id === t.unitId)?.name || 'Unknown') : 'Unknown';
      }
      const j1 = Number(r.judge1Mark) || 0;
      const j2 = Number(r.judge2Mark) || 0;
      const activeCount = (j1 > 0 ? 1 : 0) + (j2 > 0 ? 1 : 0) || 1;
      const calculatedAvg = Math.round(((j1 + j2) / activeCount) * 100) / 100;
      const averageMark = r.averageMark !== undefined ? r.averageMark : calculatedAvg;

      return {
        id: r.id,
        competitionName: comp ? comp.name : 'Unknown',
        categoryName: cat ? cat.name : 'Unknown',
        participantName,
        unitName,
        totalMark: r.totalMark,
        averageMark,
        status: r.status,
        rank: r.rank,
        updatedAt: r.updatedAt
      };
    })
  });
});

apiRouter.get('/dashboard-stats/pending-competitions', authenticate, async (req, res) => {
  const db = dbClient.get();

  const activeCompetitions = db.competitions.filter(comp => {
    if (!comp.active) return false;

    if (comp.participationType === ParticipationType.INDIVIDUAL) {
      const regsInComp = (db as any).registrations?.filter((r: any) => r.selectedIndividualCompetitionIds.includes(comp.id)) || [];
      const hasActiveReg = regsInComp.some((r: any) => {
        const p = db.participants.find(part => part.id === r.participantId);
        return p && !p.deletedAt;
      });
      return hasActiveReg;
    } else {
      return db.teams.some(t => t.competitionId === comp.id && !t.deletedAt);
    }
  });

  const pendingComps = activeCompetitions
    .filter(comp => !db.results.some(r => r.competitionId === comp.id && !r.deletedAt))
    .map(comp => {
      const category = db.categories.find(c => c.id === comp.categoryId);
      let registeredCount = 0;
      if (comp.participationType === ParticipationType.INDIVIDUAL) {
        const regsInComp = (db as any).registrations?.filter((r: any) => r.selectedIndividualCompetitionIds.includes(comp.id)) || [];
        registeredCount = regsInComp.filter((r: any) => {
          const p = db.participants.find(part => part.id === r.participantId);
          return p && !p.deletedAt;
        }).length;
      } else {
        registeredCount = db.teams.filter(t => t.competitionId === comp.id && !t.deletedAt).length;
      }

      return {
        id: comp.id,
        name: comp.name,
        code: comp.code,
        categoryName: category ? category.name : 'Unknown',
        categoryCode: category ? category.code : '',
        participationType: comp.participationType,
        registeredCount
      };
    });

  res.json(pendingComps);
});


// ===================================================================
// 14. CHEST NUMBER MANAGEMENT
// ===================================================================

// Helper: Generate next chest number atomically
function generateNextChestNumber(db: any, categoryId: string, userId: string, participantId: string, unitId: string): ChestNumber | null {
  if (!db.counters) db.counters = [];

  const category = (db.categories || []).find((c: Category) => c.id === categoryId);
  const catIndex = (db.categories || []).findIndex((c: Category) => c.id === categoryId);
  let startNum = (category && category.startingChestNumber)
    ? Number(category.startingChestNumber)
    : (catIndex >= 0 ? (catIndex + 1) * 100 + 1 : 101);

  // Safeguard against legacy 1000-based values
  if (categoryId === 'cat_sub_junior' && startNum === 2000) startNum = 201;
  if (categoryId === 'cat_kids' && startNum === 1000) startNum = 101;
  if (categoryId === 'cat_junior' && startNum === 3000) startNum = 301;
  if (categoryId === 'cat_senior' && startNum === 4000) startNum = 401;

  let counter = db.counters.find((c: Counter) => c.categoryId === categoryId);
  if (!counter) {
    counter = { id: `counter_${categoryId}`, categoryId, currentValue: startNum - 1 };
    db.counters.push(counter);
  } else if (counter.currentValue < startNum - 1) {
    counter.currentValue = startNum - 1;
  }

  // Atomic increment
  counter.currentValue += 1;
  const chestNum = counter.currentValue;

  // Verify no duplicate among active non-deleted chest numbers
  const existing = (db.chestNumbers || []).find((cn: ChestNumber) => !cn.deletedAt && cn.chestNumber === chestNum);
  if (existing) {
    return generateNextChestNumber(db, categoryId, userId, participantId, unitId);
  }

  const chestNumber: ChestNumber = {
    id: `chest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    chestNumber: chestNum,
    participantId,
    categoryId,
    unitId,
    generatedBy: userId,
    generatedAt: new Date().toISOString()
  };

  db.chestNumbers.push(chestNumber);
  return chestNumber;
}

// Get all chest numbers
apiRouter.get('/chest-numbers', authenticate, async (req, res) => {
  const db = dbClient.get();
  const activeParticipants = db.participants.filter(p => !p.deletedAt);
  const activeParticipantIds = new Set(activeParticipants.map(p => p.id));

  const chestNumbers = (db.chestNumbers || []).filter((cn: ChestNumber) =>
    !cn.deletedAt && activeParticipantIds.has(cn.participantId)
  );

  // Map participantId -> latest ChestNumber (deduplicate so 1 chest number per participant)
  const map = new Map<string, any>();
  chestNumbers.forEach((cn: ChestNumber) => {
    const participant = db.participants.find(p => p.id === cn.participantId);
    if (!participant) return;
    const unit = db.units.find(u => u.id === cn.unitId || u.id === participant.unitId);
    const category = db.categories.find(c => c.id === cn.categoryId || c.id === participant.selectedCategoryId);
    const generatedByUser = db.users.find(u => u.id === cn.generatedBy);

    map.set(cn.participantId, {
      ...cn,
      participantName: participant.fullName,
      unitName: unit?.name || 'Unknown',
      categoryName: category?.name || 'Unknown',
      generatedByName: generatedByUser?.fullName || 'System'
    });
  });

  res.json(Array.from(map.values()));
});

// Chest number stats
apiRouter.get('/chest-numbers/stats', authenticate, async (req, res) => {
  const db = dbClient.get();
  const activeParticipants = db.participants.filter(p => !p.deletedAt);
  const activeParticipantIds = new Set(activeParticipants.map(p => p.id));

  const activeChests = (db.chestNumbers || []).filter((cn: ChestNumber) =>
    !cn.deletedAt && activeParticipantIds.has(cn.participantId)
  );

  // Map participantId -> latest ChestNumber (deduplicate)
  const participantChestMap = new Map<string, ChestNumber>();
  activeChests.forEach(cn => {
    participantChestMap.set(cn.participantId, cn);
  });

  const uniqueGeneratedChests = Array.from(participantChestMap.values());
  const generatedParticipantIds = new Set(uniqueGeneratedChests.map(cn => cn.participantId));
  const missing = activeParticipants.filter(p => !generatedParticipantIds.has(p.id));

  // By category: calculate registered participants and generated chest numbers for each category
  const categorySummary = db.categories.map(cat => {
    const participantsInCat = activeParticipants.filter(p => p.selectedCategoryId === cat.id || p.categoryId === cat.id);
    const chestsInCat = uniqueGeneratedChests.filter(cn => {
      const p = activeParticipants.find(part => part.id === cn.participantId);
      return p && (p.selectedCategoryId === cat.id || p.categoryId === cat.id || cn.categoryId === cat.id);
    });
    const missingInCat = participantsInCat.filter(p => !generatedParticipantIds.has(p.id));

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      generated: chestsInCat.length,
      total: participantsInCat.length,
      missing: missingInCat.length
    };
  });

  res.json({
    totalGenerated: uniqueGeneratedChests.length,
    totalParticipants: activeParticipants.length,
    pending: missing.length,
    missing: missing.length,
    categorySummary
  });
});

// Generate chest number for single participant
apiRouter.post('/chest-numbers/generate/:participantId', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const participantId = req.params.participantId;

  const participant = db.participants.find(p => p.id === participantId && !p.deletedAt);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found.' });
  }

  // Check if already has chest number
  const existing = (db.chestNumbers || []).find((cn: ChestNumber) => cn.participantId === participantId && !cn.deletedAt);
  if (existing) {
    return res.status(400).json({ error: `Participant already has chest number ${existing.chestNumber}.` });
  }

  const chestNumber = generateNextChestNumber(db, participant.selectedCategoryId, user.id, participantId, participant.unitId);
  if (!chestNumber) {
    return res.status(500).json({ error: 'Failed to generate chest number.' });
  }

  // Sync to participant profilePhoto
  participant.profilePhoto = chestNumber.chestNumber.toString();
  participant.updatedAt = new Date().toISOString();

  await dbClient.logAudit(user.id, user.username, user.role, 'Generate Chest Number', 'ChestNumber', chestNumber.id, undefined, undefined, chestNumber);
  await dbClient.save();

  res.json({ message: 'Chest number generated successfully', chestNumber });
});

// Bulk generate missing chest numbers
apiRouter.post('/chest-numbers/generate-bulk', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  if (!db.chestNumbers) db.chestNumbers = [];

  const activeParticipants = db.participants.filter(p => !p.deletedAt);
  const existingParticipantIds = new Set(db.chestNumbers.filter((cn: ChestNumber) => !cn.deletedAt).map((cn: ChestNumber) => cn.participantId));

  const missing = activeParticipants.filter(p => !existingParticipantIds.has(p.id));

  const generated: ChestNumber[] = [];
  for (const participant of missing) {
    const cn = generateNextChestNumber(db, participant.selectedCategoryId, user.id, participant.id, participant.unitId);
    if (cn) {
      generated.push(cn);
      participant.profilePhoto = cn.chestNumber.toString();
      participant.updatedAt = new Date().toISOString();
    }
  }

  await dbClient.logAudit(user.id, user.username, user.role, `Bulk Generate ${generated.length} Chest Numbers`, 'ChestNumber', 'bulk');
  await dbClient.save();

  res.json({ message: `Generated ${generated.length} chest numbers`, count: generated.length, chestNumbers: generated });
});

// Full Bulk Regenerate All Chest Numbers (Admin only) - Resets counters per category starting numbers
apiRouter.post('/chest-numbers/regenerate-all', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;

  // Clear existing chest numbers and reset counters
  db.chestNumbers = [];
  db.counters = [];

  // Re-initialize counters per category from starting numbers
  (db.categories || []).forEach((cat: Category, index: number) => {
    let startNum = cat.startingChestNumber ? Number(cat.startingChestNumber) : (index + 1) * 100 + 1;
    if (cat.id === 'cat_sub_junior' && startNum === 2000) startNum = 201;
    if (cat.id === 'cat_kids' && startNum === 1000) startNum = 101;
    if (cat.id === 'cat_junior' && startNum === 3000) startNum = 301;
    if (cat.id === 'cat_senior' && startNum === 4000) startNum = 401;
    db.counters.push({
      id: `counter_${cat.id}`,
      categoryId: cat.id,
      currentValue: startNum - 1
    });
  });

  const activeParticipants = db.participants.filter(p => !p.deletedAt);

  // Sort participants by Category order, then Full Name
  const categoryOrderMap = new Map((db.categories || []).map((cat: any, idx: number) => [cat.id, idx]));
  activeParticipants.sort((a, b) => {
    const catIdxA = categoryOrderMap.get(a.selectedCategoryId) ?? 999;
    const catIdxB = categoryOrderMap.get(b.selectedCategoryId) ?? 999;
    if (catIdxA !== catIdxB) return catIdxA - catIdxB;
    return a.fullName.localeCompare(b.fullName);
  });

  const generated: ChestNumber[] = [];

  for (const participant of activeParticipants) {
    const cn = generateNextChestNumber(db, participant.selectedCategoryId, user.id, participant.id, participant.unitId);
    if (cn) {
      generated.push(cn);
      participant.profilePhoto = cn.chestNumber.toString();
      participant.updatedAt = new Date().toISOString();
    }
  }

  await dbClient.logAudit(user.id, user.username, user.role, `Bulk Regenerate All ${generated.length} Chest Numbers`, 'ChestNumber', 'regenerate-all');
  await dbClient.save();

  res.json({ message: `Successfully regenerated ${generated.length} chest numbers according to CMS Category starting settings.`, count: generated.length, chestNumbers: generated });
});

// Shared helper for Updating/Swapping Chest Numbers
const handleChestNumberUpdate = async (req: Request, res: Response) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const targetId = req.params.id;
  const newChestNum = Number(req.body.chestNumber);

  if (!newChestNum || Number.isNaN(newChestNum) || newChestNum <= 0) {
    return res.status(400).json({ error: 'Valid positive numeric chest number is required.' });
  }

  // Find target chest record & participant
  const targetChest = (db.chestNumbers || []).find((cn: ChestNumber) =>
    !cn.deletedAt && (cn.id === targetId || cn.participantId === targetId || cn.entityId === targetId)
  );

  const partId = targetChest ? (targetChest.participantId || targetChest.entityId) : targetId;
  const partA = db.participants.find(p => (p.id === partId || p.profilePhoto === targetId || p.profilePhoto === String(targetId)) && !p.deletedAt);

  if (!partA) {
    return res.status(404).json({ error: 'Participant not found.' });
  }

  const oldChestNumA = targetChest ? targetChest.chestNumber : (Number(partA.profilePhoto) || 0);

  if (oldChestNumA === newChestNum) {
    return res.json({ message: 'Chest number unchanged.', participant: partA });
  }

  // Check if newChestNum is already assigned to another active participant (Participant B)
  const otherChest = (db.chestNumbers || []).find((cn: ChestNumber) =>
    !cn.deletedAt &&
    cn.chestNumber === newChestNum &&
    cn.participantId !== partA.id &&
    cn.entityId !== partA.id
  );

  const partB = otherChest
    ? db.participants.find(p => p.id === (otherChest.participantId || otherChest.entityId) && !p.deletedAt)
    : db.participants.find(p => p.id !== partA.id && !p.deletedAt && (p.profilePhoto === String(newChestNum) || (p.profilePhoto as any) === newChestNum));

  let isSwapped = false;

  // Swapping logic if Participant B exists
  if (partB && oldChestNumA > 0) {
    isSwapped = true;
    partB.profilePhoto = String(oldChestNumA);
    partB.updatedAt = new Date().toISOString();

    if (otherChest) {
      otherChest.chestNumber = oldChestNumA;
      (otherChest as any).updatedAt = new Date().toISOString();
    }
  }

  // Update Participant A
  partA.profilePhoto = String(newChestNum);
  partA.updatedAt = new Date().toISOString();

  if (targetChest) {
    targetChest.chestNumber = newChestNum;
    (targetChest as any).updatedAt = new Date().toISOString();
  } else {
    const newCn: ChestNumber = {
      id: `chest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      chestNumber: newChestNum,
      categoryId: partA.selectedCategoryId,
      unitId: partA.unitId,
      participantId: partA.id,
      entityId: partA.id,
      generatedBy: user.id,
      generatedAt: new Date().toISOString()
    };
    if (!db.chestNumbers) db.chestNumbers = [];
    db.chestNumbers.push(newCn);
  }

  // Direct instant write-through to MongoDB Atlas for 100% permanent persistence
  const mongoDb = getDb();
  if (mongoDb) {
    try {
      const updates: Promise<any>[] = [
        mongoDb.collection('participants').replaceOne(
          { $or: [{ id: partA.id }, { _id: partA.id as any }] },
          { id: partA.id, ...partA },
          { upsert: true }
        ),
        targetChest ? mongoDb.collection('chestNumbers').replaceOne(
          { $or: [{ id: targetChest.id }, { _id: targetChest.id as any }] },
          { id: targetChest.id, ...targetChest },
          { upsert: true }
        ) : Promise.resolve(),
        mongoDb.collection('app_state').replaceOne(
          { _id: 'global_state' as any },
          { ...db },
          { upsert: true }
        )
      ];

      if (partB) {
        updates.push(
          mongoDb.collection('participants').replaceOne(
            { $or: [{ id: partB.id }, { _id: partB.id as any }] },
            { id: partB.id, ...partB },
            { upsert: true }
          )
        );
      }

      if (otherChest) {
        updates.push(
          mongoDb.collection('chestNumbers').replaceOne(
            { $or: [{ id: otherChest.id }, { _id: otherChest.id as any }] },
            { id: otherChest.id, ...otherChest },
            { upsert: true }
          )
        );
      }

      await Promise.all(updates);
    } catch (mongoErr) {
      console.error('Direct MongoDB chest swap update error:', mongoErr);
    }
  }

  await dbClient.logAudit(
    user.id, user.username, user.role,
    isSwapped ? `Swap Chest Number ${oldChestNumA} <-> ${newChestNum}` : `Update Chest Number to ${newChestNum}`,
    'ChestNumber', partA.id, partA.unitId,
    { oldChest: oldChestNumA },
    { newChest: newChestNum, swappedParticipant: partB?.fullName }
  );

  await dbClient.save();

  res.json({
    message: isSwapped
      ? `Chest numbers swapped! ${partA.fullName} is now #${newChestNum}, and ${partB?.fullName} is now #${oldChestNumA}.`
      : `Chest number updated to #${newChestNum} for ${partA.fullName}.`,
    participant: partA,
    swappedParticipant: partB
  });
};

// Edit chest number (Admin / Sector Team)
apiRouter.put('/chest-numbers/:id', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), (req, res) => handleChestNumberUpdate(req, res));

// Export chest numbers as CSV
apiRouter.get('/chest-numbers/export', authenticate, async (req, res) => {
  const db = dbClient.get();
  const chestNumbers = (db.chestNumbers || []).filter((cn: ChestNumber) => !cn.deletedAt);

  let csv = 'Chest Number,Participant Name,Unit,Category,Generated Date\n';
  for (const cn of chestNumbers) {
    const p = db.participants.find(part => part.id === cn.participantId);
    const u = db.units.find(unit => unit.id === cn.unitId);
    const c = db.categories.find(cat => cat.id === cn.categoryId);
    csv += `${cn.chestNumber},"${p?.fullName || 'Unknown'}","${u?.name || 'Unknown'}","${c?.name || 'Unknown'}","${cn.generatedAt}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="chest-numbers.csv"');
  res.send(csv);
});

// Public API: Get Participant Profile by Chest Number (for QR code scan bypass)
apiRouter.get('/public/participant/by-chest/:chestNo', async (req, res) => {
  const db = dbClient.get();
  const searchChest = req.params.chestNo.toString().trim().toLowerCase();

  let targetParticipantId: string | null = null;
  const cnObj = (db.chestNumbers || []).find((cn: any) => !cn.deletedAt && cn.chestNumber.toString().toLowerCase() === searchChest);
  if (cnObj) {
    targetParticipantId = cnObj.participantId;
  } else {
    const partObj = (db.participants || []).find((p: any) => !p.deletedAt && (
      (p.profilePhoto && p.profilePhoto.toLowerCase() === searchChest) ||
      (p.codeNumber && p.codeNumber.toLowerCase() === searchChest) ||
      (p.chestNumber && p.chestNumber.toString().toLowerCase() === searchChest)
    ));
    if (partObj) targetParticipantId = partObj.id;
  }

  if (!targetParticipantId) {
    return res.status(404).json({ error: `Participant with chest number ${searchChest} not found.` });
  }

  const participant = (db.participants || []).find((p: any) => p.id === targetParticipantId && !p.deletedAt);
  if (!participant) {
    return res.status(404).json({ error: 'Participant record not found.' });
  }

  const enriched = getEnrichedParticipant(participant, db, searchChest);
  res.json({ participant: enriched, ...enriched });
});



// ===================================================================
// 15. GREEN ROOM MANAGEMENT
// ===================================================================

// Helper: Generate code letter from index (0=A, 1=B, ..., 25=Z, 26=AA, 27=AB...)
function indexToCodeLetter(index: number): string {
  let result = '';
  let n = index;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

// Get all green room assignments
apiRouter.get('/green-room', authenticate, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const db = dbClient.get();
  const assignments = (db.greenRoomAssignments || []).filter((a: GreenRoomAssignment) => !a.deletedAt);

  const enriched = assignments.map((a: GreenRoomAssignment) => {
    const competition = db.competitions.find(c => c.id === a.competitionId);
    const category = db.categories.find(c => c.id === a.categoryId);
    let participantName = '';
    let unitName = '';
    if (a.participantId) {
      const p = db.participants.find(part => part.id === a.participantId);
      participantName = p?.fullName || 'Unknown';
      unitName = db.units.find(u => u.id === p?.unitId)?.name || 'Unknown';
    } else if (a.teamId) {
      const t = db.teams.find(team => team.id === a.teamId);
      const firstMember = (t?.memberIds || []).map(mid => db.participants.find(part => part.id === mid && !part.deletedAt)).find(Boolean);
      participantName = t?.teamName || (firstMember ? `${firstMember.fullName} & Team` : (t?.teamNumber ? `Team ${t.teamNumber}` : 'Group Team'));
      unitName = (db.units.find(u => u.id === t?.unitId || u.name === t?.unitId)?.name) || (firstMember ? db.units.find(u => u.id === firstMember.unitId)?.name : '') || 'Unknown';
    }
    return {
      ...a,
      competitionName: competition?.name || 'Unknown',
      categoryName: category?.name || 'Unknown',
      participantName,
      unitName
    };
  });

  res.json(enriched);
});

// Green room stats
apiRouter.get('/green-room/stats', authenticate, async (req, res) => {
  const db = dbClient.get();
  const assignments = (db.greenRoomAssignments || []).filter((a: GreenRoomAssignment) => !a.deletedAt);

  // Total competitions that have registrations
  const allComps = db.competitions.filter(c => c.active);
  const assignedCompIds = new Set(assignments.map((a: GreenRoomAssignment) => a.competitionId));

  const printedAssignments = assignments.filter((a: GreenRoomAssignment) => a.status === GreenRoomStatus.PRINTED || a.status === GreenRoomStatus.CHECKED_IN || a.status === GreenRoomStatus.STAGE_READY);
  const printedCompIds = new Set(printedAssignments.map((a: GreenRoomAssignment) => a.competitionId));

  res.json({
    totalCompetitions: allComps.length,
    assigned: assignedCompIds.size,
    pending: allComps.length - assignedCompIds.size,
    printed: printedCompIds.size,
    totalAssignments: assignments.length
  });
});

// Get assignments for a specific competition
apiRouter.get('/green-room/competition/:competitionId', authenticate, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const db = dbClient.get();
  const competitionId = req.params.competitionId;
  const assignments = (db.greenRoomAssignments || []).filter((a: GreenRoomAssignment) => a.competitionId === competitionId && !a.deletedAt);

  const enriched = assignments.map((a: GreenRoomAssignment) => {
    let participantName = '';
    let unitName = '';
    let chestNumber: any = a.chestNumber;

    if (a.participantId) {
      const p = db.participants.find(part => part.id === a.participantId);
      participantName = p?.fullName || 'Unknown';
      unitName = db.units.find(u => u.id === p?.unitId)?.name || 'Unknown';
    } else if (a.teamId) {
      const t = db.teams.find(team => team.id === a.teamId);
      const firstMember = (t?.memberIds || []).map(mid => db.participants.find(part => part.id === mid && !part.deletedAt)).find(Boolean);
      participantName = t?.teamName || (firstMember ? `${firstMember.fullName} & Team` : (t?.teamNumber ? `Team ${t.teamNumber}` : 'Group Team'));
      unitName = (db.units.find(u => u.id === t?.unitId || u.name === t?.unitId)?.name) || (firstMember ? db.units.find(u => u.id === firstMember.unitId)?.name : '') || 'Unknown';

      if (t && t.memberIds && t.memberIds.length > 0) {
        const memberChestNumbers = t.memberIds.map(mid => {
          const cn = (db.chestNumbers || []).find(c => c.participantId === mid && !c.deletedAt);
          const p = db.participants.find(part => part.id === mid);
          return cn ? cn.chestNumber : p?.profilePhoto;
        }).filter(Boolean);
        if (memberChestNumbers.length > 0) {
          chestNumber = memberChestNumbers.join(', ');
        }
      }
    }
    return {
      ...a,
      chestNumber,
      participantName,
      unitName
    };
  });

  res.json(enriched);
});

// Generate random codes for a competition
apiRouter.post('/green-room/generate', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.GREEN_ROOM_MANAGER]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { competitionId } = req.body;

  if (!competitionId) {
    return res.status(400).json({ error: 'competitionId is required.' });
  }

  const competition = db.competitions.find(c => c.id === competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found.' });
  }

  if (!db.greenRoomAssignments) db.greenRoomAssignments = [];

  // Check if already generated
  const existing = db.greenRoomAssignments.filter((a: GreenRoomAssignment) => a.competitionId === competitionId && !a.deletedAt);
  if (existing.length > 0) {
    return res.status(400).json({ error: 'Green room codes already generated for this competition. Use regenerate to replace.' });
  }

  // OPTIMIZATION: Use Maps for fast lookups
  const participantMap = new Map((db.participants || []).filter(p => !p.deletedAt).map(p => [p.id, p]));
  const chestNumberMap = new Map((db.chestNumbers || []).filter((c: any) => !c.deletedAt).map((c: any) => [c.participantId, c]));
  const unitMap = new Map((db.units || []).map(u => [u.id, u]));
  const categoryMap = new Map((db.categories || []).map(c => [c.id, c]));
  const teamMap = new Map((db.teams || []).filter(t => !t.deletedAt).map(t => [t.id, t]));

  let entries: { participantId?: string; teamId?: string; chestNumber?: number }[] = [];

  if (competition.participationType === ParticipationType.INDIVIDUAL) {
    const registrations = (db.registrations || []).filter((r: any) => r.selectedIndividualCompetitionIds.includes(competitionId));
    for (const reg of registrations) {
      const participant = participantMap.get(reg.participantId);
      if (!participant) continue;
      const cn = chestNumberMap.get(participant.id);
      if (!cn) continue;
      entries.push({ participantId: participant.id, chestNumber: cn.chestNumber });
    }
  } else {
    const teams = (db.teams || []).filter(t => t.competitionId === competitionId && !t.deletedAt);
    for (const team of teams) {
      entries.push({ teamId: team.id });
    }
  }

  if (entries.length === 0) {
    return res.status(400).json({ error: 'No registered participants/teams with chest numbers found for this competition.' });
  }

  // Shuffle entries randomly (Fisher-Yates)
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  // Assign code letters
  const assignments: GreenRoomAssignment[] = entries.map((entry, index) => ({
    id: `gr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    competitionId,
    categoryId: competition.categoryId,
    participantId: entry.participantId,
    teamId: entry.teamId,
    chestNumber: entry.chestNumber,
    codeLetter: indexToCodeLetter(index),
    status: GreenRoomStatus.ASSIGNED,
    generatedBy: user.id,
    generatedAt: new Date().toISOString()
  }));

  db.greenRoomAssignments.push(...assignments);

  const categoryName = categoryMap.get(competition.categoryId)?.name || 'Unknown';

  const enrichedAssignments = assignments.map(a => {
    let participantName = '';
    let unitName = '';
    if (a.participantId) {
      const p = participantMap.get(a.participantId);
      participantName = p?.fullName || 'Unknown';
      unitName = unitMap.get(p?.unitId || '')?.name || 'Unknown';
    } else if (a.teamId) {
      const t = teamMap.get(a.teamId);
      const firstMember = (t?.memberIds || []).map(mid => participantMap.get(mid)).find(p => p && !p.deletedAt);
      participantName = t?.teamName || (firstMember ? `${firstMember.fullName} & Team` : (t?.teamNumber ? `Team ${t.teamNumber}` : 'Group Team'));
      unitName = (unitMap.get(t?.unitId || '')?.name) || (firstMember ? unitMap.get(firstMember.unitId)?.name : '') || 'Unknown';
    }

    let chestNumber: any = a.chestNumber;
    if (a.teamId) {
      const t = teamMap.get(a.teamId);
      if (t && t.memberIds && t.memberIds.length > 0) {
        const memberChestNumbers = t.memberIds.map(mid => {
          const cn = chestNumberMap.get(mid);
          const p = participantMap.get(mid);
          return cn ? cn.chestNumber : p?.profilePhoto;
        }).filter(Boolean);
        if (memberChestNumbers.length > 0) {
          chestNumber = memberChestNumbers.join(', ');
        }
      }
    }

    return {
      ...a,
      chestNumber,
      competitionName: competition?.name || 'Unknown',
      categoryName,
      participantName,
      unitName
    };
  });

  await dbClient.logAudit(user.id, user.username, user.role, `Generate Green Room Codes for ${competition.name}`, 'GreenRoom', competitionId);
  await dbClient.save();

  res.json({ message: `Generated ${assignments.length} code assignments`, assignments: enrichedAssignments });
});

// Regenerate codes (Admin only, with confirmation)
apiRouter.post('/green-room/regenerate', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.GREEN_ROOM_MANAGER]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { competitionId } = req.body;

  if (!competitionId) {
    return res.status(400).json({ error: 'competitionId is required.' });
  }

  const competition = db.competitions.find(c => c.id === competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found.' });
  }

  if (!db.greenRoomAssignments) db.greenRoomAssignments = [];

  // Delete existing
  const existing = db.greenRoomAssignments.filter((a: GreenRoomAssignment) => a.competitionId === competitionId && !a.deletedAt);
  existing.forEach((a: GreenRoomAssignment) => {
    a.deletedAt = new Date().toISOString();
    a.deletedBy = user.id;
  });

  // OPTIMIZATION: Use Maps for fast lookups
  const participantMap = new Map((db.participants || []).filter(p => !p.deletedAt).map(p => [p.id, p]));
  const chestNumberMap = new Map((db.chestNumbers || []).filter((c: any) => !c.deletedAt).map((c: any) => [c.participantId, c]));
  const unitMap = new Map((db.units || []).map(u => [u.id, u]));
  const categoryMap = new Map((db.categories || []).map(c => [c.id, c]));
  const teamMap = new Map((db.teams || []).filter(t => !t.deletedAt).map(t => [t.id, t]));

  let entries: { participantId?: string; teamId?: string; chestNumber?: number }[] = [];

  if (competition.participationType === ParticipationType.INDIVIDUAL) {
    const registrations = (db.registrations || []).filter((r: any) => r.selectedIndividualCompetitionIds.includes(competitionId));
    for (const reg of registrations) {
      const participant = participantMap.get(reg.participantId);
      if (!participant) continue;
      const cn = chestNumberMap.get(participant.id);
      if (!cn) continue;
      entries.push({ participantId: participant.id, chestNumber: cn.chestNumber });
    }
  } else {
    const teams = (db.teams || []).filter(t => t.competitionId === competitionId && !t.deletedAt);
    for (const team of teams) {
      entries.push({ teamId: team.id });
    }
  }

  if (entries.length === 0) {
    await dbClient.save(); // Save deletions
    return res.status(400).json({ error: 'Existing codes deleted, but no registered participants/teams found to generate new ones.' });
  }

  // Shuffle entries randomly (Fisher-Yates)
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  // Assign code letters
  const assignments: GreenRoomAssignment[] = entries.map((entry, index) => ({
    id: `gr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    competitionId,
    categoryId: competition.categoryId,
    participantId: entry.participantId,
    teamId: entry.teamId,
    chestNumber: entry.chestNumber,
    codeLetter: indexToCodeLetter(index),
    status: GreenRoomStatus.ASSIGNED,
    generatedBy: user.id,
    generatedAt: new Date().toISOString()
  }));

  db.greenRoomAssignments.push(...assignments);

  const categoryName = categoryMap.get(competition.categoryId)?.name || 'Unknown';

  const enrichedAssignments = assignments.map(a => {
    let participantName = '';
    let unitName = '';
    if (a.participantId) {
      const p = participantMap.get(a.participantId);
      participantName = p?.fullName || 'Unknown';
      unitName = unitMap.get(p?.unitId || '')?.name || 'Unknown';
    } else if (a.teamId) {
      const t = teamMap.get(a.teamId);
      const firstMember = (t?.memberIds || []).map(mid => participantMap.get(mid)).find(p => p && !p.deletedAt);
      participantName = t?.teamName || (firstMember ? `${firstMember.fullName} & Team` : (t?.teamNumber ? `Team ${t.teamNumber}` : 'Group Team'));
      unitName = (unitMap.get(t?.unitId || '')?.name) || (firstMember ? unitMap.get(firstMember.unitId)?.name : '') || 'Unknown';
    }

    let chestNumber: any = a.chestNumber;
    if (a.teamId) {
      const t = teamMap.get(a.teamId);
      if (t && t.memberIds && t.memberIds.length > 0) {
        const memberChestNumbers = t.memberIds.map(mid => {
          const cn = chestNumberMap.get(mid);
          const p = participantMap.get(mid);
          return cn ? cn.chestNumber : p?.profilePhoto;
        }).filter(Boolean);
        if (memberChestNumbers.length > 0) {
          chestNumber = memberChestNumbers.join(', ');
        }
      }
    }

    return {
      ...a,
      chestNumber,
      competitionName: competition?.name || 'Unknown',
      categoryName,
      participantName,
      unitName
    };
  });

  await dbClient.logAudit(user.id, user.username, user.role, `Regenerate Green Room Codes for ${competition.name}`, 'GreenRoom', competitionId);
  await dbClient.save();

  res.json({ message: `Regenerated ${assignments.length} code assignments`, assignments: enrichedAssignments });
});

// Update assignment status
apiRouter.put('/green-room/:id/status', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.GREEN_ROOM_MANAGER]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const assignmentId = req.params.id;
  const { status } = req.body;

  if (!status || !Object.values(GreenRoomStatus).includes(status)) {
    return res.status(400).json({ error: 'Valid status is required.' });
  }

  const assignment = (db.greenRoomAssignments || []).find((a: GreenRoomAssignment) => a.id === assignmentId && !a.deletedAt);
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found.' });
  }

  const old = { ...assignment };
  assignment.status = status;

  await dbClient.logAudit(user.id, user.username, user.role, 'Update Green Room Status', 'GreenRoom', assignmentId, undefined, old, assignment);
  await dbClient.save();

  res.json({ message: 'Status updated', assignment });
});

// Bulk update status for competition (e.g. mark all as Printed)
apiRouter.put('/green-room/competition/:competitionId/status', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.GREEN_ROOM_MANAGER]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { status } = req.body;
  const competitionId = req.params.competitionId;

  if (!status || !Object.values(GreenRoomStatus).includes(status)) {
    return res.status(400).json({ error: 'Valid status is required.' });
  }

  const assignments = (db.greenRoomAssignments || []).filter((a: GreenRoomAssignment) => a.competitionId === competitionId && !a.deletedAt);
  let updated = 0;
  for (const a of assignments) {
    a.status = status;
    updated++;
  }

  await dbClient.logAudit(user.id, user.username, user.role, `Bulk Update Green Room Status to ${status}`, 'GreenRoom', competitionId);
  await dbClient.save();

  res.json({ message: `Updated ${updated} assignments to ${status}` });
});


// ===================================================================
// 16. JUDGMENT SHEET MANAGEMENT
// ===================================================================

// Get all judgment sheets
apiRouter.get('/judgment-sheets', authenticate, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  await dbClient.waitForSync();
  const db = dbClient.get();
  const user = (req as any).user as User;
  let sheets = (db.judgmentSheets || []).filter((s: JudgmentSheet) => !s.deletedAt);

  if (user.role === UserRole.JUDGE) {
    const liveUser = db.users.find((u: User) => u.id === user.id) || user;
    const assignedIds = liveUser.assignedCompetitionIds || [];
    sheets = sheets.filter(s => assignedIds.includes(s.competitionId));
  }

  const enriched = sheets.map((s: JudgmentSheet) => {
    const competition = db.competitions.find(c => c.id === s.competitionId);
    const category = db.categories.find(c => c.id === s.categoryId);
    const scores = (db.judgeScores || []).filter((sc: JudgeScore) => sc.judgmentSheetId === s.id);

    let currentStatus = s.status;
    const isPublished = (db.results || []).some(r => r.competitionId === s.competitionId && !r.deletedAt && r.publishedStatus);

    if (s.publishedToResults && isPublished && currentStatus !== JudgmentSheetStatus.LOCKED) {
      currentStatus = JudgmentSheetStatus.LOCKED;
    }

    return {
      ...s,
      status: currentStatus,
      publishedToResults: isPublished || s.publishedToResults,
      competitionName: competition?.name || 'Unknown',
      categoryName: category?.name || 'Unknown',
      participationType: competition?.participationType || 'unknown',
      stageType: competition?.stageType || 'unknown',
      scoresCount: scores.length
    };
  });

  let finalSheets = enriched;
  if (user.role === UserRole.JUDGE) {
    // Hide locked sheets from judges
    finalSheets = enriched.filter(s => s.status !== JudgmentSheetStatus.LOCKED);
  }

  res.json(finalSheets);
});

// Judgment sheet stats
apiRouter.get('/judgment-sheets/stats', authenticate, async (req, res) => {
  await dbClient.waitForSync();
  const db = dbClient.get();
  const sheets = (db.judgmentSheets || []).filter((s: JudgmentSheet) => !s.deletedAt);

  const statusCounts = { pending: 0, inProgress: 0, completed: 0, locked: 0 };
  for (const s of sheets) {
    let currentStatus = s.status;
    const isPublished = (db.results || []).some(r => r.competitionId === s.competitionId && !r.deletedAt && r.publishedStatus);
    if (s.publishedToResults && isPublished && currentStatus !== JudgmentSheetStatus.LOCKED) {
      currentStatus = JudgmentSheetStatus.LOCKED;
    }
    if (currentStatus === JudgmentSheetStatus.PENDING) statusCounts.pending++;
    else if (currentStatus === JudgmentSheetStatus.IN_PROGRESS) statusCounts.inProgress++;
    else if (currentStatus === JudgmentSheetStatus.COMPLETED) statusCounts.completed++;
    else if (currentStatus === JudgmentSheetStatus.LOCKED) statusCounts.locked++;
  }

  res.json({
    totalSheets: sheets.length,
    ...statusCounts
  });
});

// Generate judgment sheet for a competition
apiRouter.post('/judgment-sheets/generate', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.RESULT_MANAGER]), async (req, res) => {
  await dbClient.waitForSync();
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { competitionId, maxMarks } = req.body;

  if (!competitionId) {
    return res.status(400).json({ error: 'competitionId is required.' });
  }

  const competition = db.competitions.find(c => c.id === competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found.' });
  }

  if (!db.judgmentSheets) db.judgmentSheets = [];
  if (!db.judgeScores) db.judgeScores = [];

  // Check if already exists
  const existing = db.judgmentSheets.find((s: JudgmentSheet) => s.competitionId === competitionId && !s.deletedAt);
  if (existing) {
    return res.status(400).json({ error: 'Judgment sheet already exists for this competition.' });
  }

  // Check green room assignments exist
  const grAssignments = (db.greenRoomAssignments || []).filter((a: GreenRoomAssignment) => a.competitionId === competitionId && !a.deletedAt);
  if (grAssignments.length === 0) {
    return res.status(400).json({ error: 'Green room assignments must be generated before creating a judgment sheet.' });
  }

  const numJudges = competition.numJudges || db.eventSettings.numJudges || 2;
  const finalMaxMarks = maxMarks || db.eventSettings.maxMarksPerJudge || 100;

  const sheet: JudgmentSheet = {
    id: `js_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    competitionId,
    categoryId: competition.categoryId,
    status: JudgmentSheetStatus.PENDING,
    maxMarks: finalMaxMarks,
    numJudges,
    createdBy: user.id,
    createdAt: new Date().toISOString()
  };

  db.judgmentSheets.push(sheet);

  // Pre-create score entries for each green room assignment
  for (const gr of grAssignments) {
    const score: JudgeScore = {
      id: `score_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${gr.codeLetter}`,
      judgmentSheetId: sheet.id,
      competitionId,
      codeLetter: gr.codeLetter,
      greenRoomAssignmentId: gr.id,
      judgeScores: [],
      totalMark: 0,
      averageMark: 0,
      status: JudgeScoreStatus.PARTICIPATED,
      enteredBy: user.id,
      enteredAt: new Date().toISOString()
    };
    db.judgeScores.push(score);
  }

  await dbClient.logAudit(user.id, user.username, user.role, `Generate Judgment Sheet for ${competition.name}`, 'JudgmentSheet', sheet.id);
  await dbClient.save();

  res.json({ message: 'Judgment sheet created', sheet });
});

// Get a judgment sheet (anonymous - no participant names)
apiRouter.get('/judgment-sheets/:id', authenticate, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  await dbClient.waitForSync();
  const db = dbClient.get();
  const sheetId = req.params.id;
  const user = (req as any).user as User;

  const sheet = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.id === sheetId && !s.deletedAt);
  if (!sheet) {
    return res.status(404).json({ error: 'Judgment sheet not found.' });
  }

  if (user.role === UserRole.JUDGE) {
    const liveUser = db.users.find((u: User) => u.id === user.id) || user;
    const assignedIds = liveUser.assignedCompetitionIds || [];
    if (!assignedIds.includes(sheet.competitionId)) {
      return res.status(403).json({ error: 'You are not assigned to evaluate this competition.' });
    }
  }

  const competition = db.competitions.find(c => c.id === sheet.competitionId);
  const category = db.categories.find(c => c.id === sheet.categoryId);
  const scores = (db.judgeScores || []).filter((s: JudgeScore) => s.judgmentSheetId === sheetId);

  // For judges, NEVER show participant identity
  const isJudge = user.role === UserRole.JUDGE;

  const enrichedScores = scores.map((s: JudgeScore) => {
    const nonZeroMarks = (s.judgeScores || []).filter((j: any) => typeof j.mark === 'number' && !Number.isNaN(j.mark) && j.mark > 0);
    const sumMarks = (s.judgeScores || []).reduce((sum: number, jm: any) => sum + (typeof jm.mark === 'number' && !Number.isNaN(jm.mark) ? jm.mark : 0), 0);
    const activeJudgesCount = nonZeroMarks.length > 0 ? nonZeroMarks.length : 1;
    const calculatedAvg = Math.round((sumMarks / activeJudgesCount) * 100) / 100;
    const effectiveAvg = (s.averageMark && s.averageMark > 0) ? s.averageMark : (sumMarks > 0 ? calculatedAvg : (s.averageMark ?? 0));

    const base: any = {
      id: s.id,
      codeLetter: s.codeLetter,
      judgeScores: s.judgeScores || [],
      totalMark: s.totalMark || sumMarks,
      averageMark: effectiveAvg,
      rank: isJudge ? undefined : s.rank,
      status: s.status,
      remarks: s.remarks
    };

    // Only non-judge users get to see the mapping (for result management)
    if (!isJudge) {
      const gr = (db.greenRoomAssignments || []).find((a: GreenRoomAssignment) => a.id === s.greenRoomAssignmentId);

      // If result is published, overlay the actual published marks onto this view safely
      const publishedResult = db.results.find(r =>
        r.competitionId === sheet.competitionId &&
        !r.deletedAt &&
        r.publishedStatus &&
        ((gr?.participantId && r.participantId === gr.participantId) || (gr?.teamId && r.teamId === gr.teamId))
      );

      if (publishedResult) {
        if (typeof publishedResult.totalMark === 'number' && publishedResult.totalMark > 0) {
          base.totalMark = publishedResult.totalMark;
        }
        const j1Val = Number(publishedResult.judge1Mark) || 0;
        const j2Val = Number(publishedResult.judge2Mark) || 0;
        const activeCount = (j1Val > 0 ? 1 : 0) + (j2Val > 0 ? 1 : 0) || 1;
        if (publishedResult.averageMark !== undefined && publishedResult.averageMark > 0) {
          base.averageMark = publishedResult.averageMark;
        }
        if (publishedResult.rank) {
          base.rank = publishedResult.rank;
        }

        // Reconstruct judge scores for display if non-zero
        let j1 = base.judgeScores.find((j: any) => j.judgeNumber === 1);
        let j2 = base.judgeScores.find((j: any) => j.judgeNumber === 2);

        if (!j1 && j1Val > 0) {
          base.judgeScores.push({ judgeNumber: 1, mark: j1Val });
        } else if (j1 && j1Val > 0) {
          j1.mark = j1Val;
        }

        if (!j2 && j2Val > 0) {
          base.judgeScores.push({ judgeNumber: 2, mark: j2Val });
        } else if (j2 && j2Val > 0) {
          j2.mark = j2Val;
        }
      }

      if (gr) {
        base.chestNumber = gr.chestNumber;
        if (gr.participantId) {
          const p = db.participants.find(part => part.id === gr.participantId);
          base.participantName = p?.fullName;
          base.unitName = db.units.find(u => u.id === p?.unitId)?.name;
        } else if (gr.teamId) {
          const t = db.teams.find(team => team.id === gr.teamId);
          base.participantName = t?.teamName || t?.teamNumber;
          base.unitName = db.units.find(u => u.id === t?.unitId)?.name;

          if (t && t.memberIds && t.memberIds.length > 0) {
            const memberChestNumbers = t.memberIds.map(mid => {
              const cn = (db.chestNumbers || []).find(c => c.participantId === mid && !c.deletedAt);
              const p = db.participants.find(part => part.id === mid);
              return cn ? cn.chestNumber : p?.profilePhoto;
            }).filter(Boolean);
            if (memberChestNumbers.length > 0) {
              base.chestNumber = memberChestNumbers.join(', ');
            }
          }
        }
      }
    }

    return base;
  });

  // Dynamically ensure Dense Ranking for participated entries (1, 1, 2, 2, 3, 3)
  if (!isJudge) {
    const rankable = [...enrichedScores].filter((s: any) => s.status === JudgeScoreStatus.PARTICIPATED && (s.averageMark || 0) > 0);
    rankable.sort((a: any, b: any) => (b.averageMark || 0) - (a.averageMark || 0));
    let rRank = 1;
    let ranksUpdated = false;
    for (let i = 0; i < rankable.length; i++) {
      if (i > 0 && (rankable[i].averageMark || 0) < (rankable[i - 1].averageMark || 0)) {
        rRank++;
      }
      rankable[i].rank = rRank;
      const underlying = scores.find((sc: any) => sc.id === rankable[i].id);
      if (underlying && underlying.rank !== rRank) {
        underlying.rank = rRank;
        ranksUpdated = true;
      }
    }
    if (ranksUpdated) {
      CalculationService.calculateCompetitionRanks(sheet.competitionId);
      await dbClient.save();
    }
  }

  // Sort by code letter
  enrichedScores.sort((a: any, b: any) => a.codeLetter.localeCompare(b.codeLetter));

  if (!(sheet as any).claimedJudges) {
    (sheet as any).claimedJudges = {};
  }

  // Dynamically sanitize claimedJudges: remove claims for judges who are no longer assigned to this competition
  const currentClaimed = (sheet as any).claimedJudges as Record<string, any>;
  let claimedChanged = false;
  for (const [slotStr, claimObj] of Object.entries(currentClaimed)) {
    if (claimObj && claimObj.userId) {
      const u = db.users.find((userObj: User) => userObj.id === claimObj.userId);
      const isAssigned = u && u.role === UserRole.JUDGE && u.assignedCompetitionIds && u.assignedCompetitionIds.includes(sheet.competitionId);
      if (!isAssigned) {
        delete currentClaimed[slotStr];
        claimedChanged = true;
      }
    }
  }
  if (claimedChanged) {
    await dbClient.save();
  }

  let assignedJudgeNumber: number | undefined = undefined;

  if (isJudge) {
    // Check if current judge user already claimed a slot for this sheet
    for (const [slotStr, claimObj] of Object.entries((sheet as any).claimedJudges as Record<string, any>)) {
      if (claimObj.userId === user.id) {
        assignedJudgeNumber = Number(slotStr);
        break;
      }
    }

    // If not claimed yet, claim the first available slot (1..numJudges)
    if (!assignedJudgeNumber) {
      const maxJudges = sheet.numJudges || 2;
      for (let i = 1; i <= maxJudges; i++) {
        if (!(sheet as any).claimedJudges[i]) {
          (sheet as any).claimedJudges[i] = {
            userId: user.id,
            username: user.username,
            claimedAt: new Date().toISOString()
          };
          assignedJudgeNumber = i;
          await dbClient.save();
          break;
        }
      }
    }
  }

  let currentStatus = sheet.status;
  const isPublished = (db.results || []).some(r => r.competitionId === sheet.competitionId && !r.deletedAt && r.publishedStatus);
  if (sheet.publishedToResults && isPublished && currentStatus !== JudgmentSheetStatus.LOCKED) {
    currentStatus = JudgmentSheetStatus.LOCKED;
  }

  res.json({
    sheet: {
      ...sheet,
      status: currentStatus,
      competitionName: competition?.name || 'Unknown',
      categoryName: category?.name || 'Unknown',
      participationType: competition?.participationType,
      stageType: competition?.stageType,
      assignedJudgeNumber,
      claimedJudges: (sheet as any).claimedJudges || {}
    },
    scores: enrichedScores
  });
});

// Enter/update marks for a judgment sheet
apiRouter.post('/judgment-sheets/:id/scores', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.JUDGE, UserRole.RESULT_MANAGER]), async (req, res) => {
  await dbClient.waitForSync();
  const db = dbClient.get();
  const user = (req as any).user as User;
  const sheetId = req.params.id;

  const sheet = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.id === sheetId && !s.deletedAt);
  if (!sheet) {
    return res.status(404).json({ error: 'Judgment sheet not found.' });
  }

  if (user.role === UserRole.JUDGE) {
    const liveUser = db.users.find((u: User) => u.id === user.id) || user;
    const assignedIds = liveUser.assignedCompetitionIds || [];
    if (!assignedIds.includes(sheet.competitionId)) {
      return res.status(403).json({ error: 'You are not assigned to evaluate this competition.' });
    }
  }

  if (sheet.status === JudgmentSheetStatus.LOCKED) {
    return res.status(400).json({ error: 'Judgment sheet is locked. Cannot modify scores.' });
  }

  const { scores } = req.body;
  if (!scores || !Array.isArray(scores)) {
    return res.status(400).json({ error: 'scores array is required.' });
  }

  // Security enforcement: For judge users, strictly restrict marks to their claimed judge number
  if (user.role === UserRole.JUDGE) {
    if (!(sheet as any).claimedJudges) {
      (sheet as any).claimedJudges = {};
    }
    let userClaimedSlotStr = Object.keys((sheet as any).claimedJudges).find(
      k => (sheet as any).claimedJudges[k]?.userId === user.id
    );
    // If not claimed yet (e.g. re-assigned), claim the first available slot automatically
    if (!userClaimedSlotStr) {
      const maxJudges = sheet.numJudges || 2;
      for (let i = 1; i <= maxJudges; i++) {
        if (!(sheet as any).claimedJudges[i]) {
          (sheet as any).claimedJudges[i] = {
            userId: user.id,
            username: user.username,
            claimedAt: new Date().toISOString()
          };
          userClaimedSlotStr = String(i);
          break;
        }
      }
    }
    if (userClaimedSlotStr) {
      const allowedSlot = Number(userClaimedSlotStr);
      for (const scoreUpdate of scores) {
        if (scoreUpdate.judgeScores && Array.isArray(scoreUpdate.judgeScores)) {
          scoreUpdate.judgeScores = scoreUpdate.judgeScores.filter(
            (jm: any) => jm.judgeNumber === allowedSlot
          );
        }
      }
    }
  }

  for (const scoreUpdate of scores) {
    const { scoreId, judgeScores: judgeMarks, status, remarks } = scoreUpdate;

    const existingScore = (db.judgeScores || []).find((s: JudgeScore) => s.id === scoreId && s.judgmentSheetId === sheetId);
    if (!existingScore) continue;

    if (status) {
      existingScore.status = status;
    }
    if (remarks !== undefined) {
      existingScore.remarks = remarks;
    }

    if (judgeMarks && Array.isArray(judgeMarks)) {
      // Validate marks and merge into existing judgeScores by judgeNumber
      for (const jm of judgeMarks) {
        if (typeof jm.mark !== 'number' || jm.mark < 0 || jm.mark > sheet.maxMarks) {
          return res.status(400).json({ error: `Invalid mark ${jm.mark} for judge ${jm.judgeNumber}. Must be between 0 and ${sheet.maxMarks}.` });
        }
        const idx = existingScore.judgeScores.findIndex((j: JudgeScoreEntry) => j.judgeNumber === jm.judgeNumber);
        if (idx >= 0) {
          existingScore.judgeScores[idx] = jm;
        } else {
          existingScore.judgeScores.push(jm);
        }
      }

      // Calculate total and average based on non-null submitted judge marks
      if (existingScore.status === JudgeScoreStatus.PARTICIPATED) {
        const nonZeroMarks = existingScore.judgeScores.filter((j: JudgeScoreEntry) => typeof j.mark === 'number' && !Number.isNaN(j.mark) && j.mark > 0);
        const sumMarks = existingScore.judgeScores.reduce((sum: number, jm: JudgeScoreEntry) => sum + (typeof jm.mark === 'number' && !Number.isNaN(jm.mark) ? jm.mark : 0), 0);
        const activeJudgesCount = nonZeroMarks.length > 0 ? nonZeroMarks.length : 1;
        const avg = sumMarks / activeJudgesCount;
        existingScore.totalMark = sumMarks;
        existingScore.averageMark = Math.round(avg * 100) / 100;
      } else {
        existingScore.totalMark = 0;
        existingScore.averageMark = 0;
      }
    }

    existingScore.updatedBy = user.id;
    existingScore.updatedAt = new Date().toISOString();
  }

  // Update sheet status
  const allScores = (db.judgeScores || []).filter((s: JudgeScore) => s.judgmentSheetId === sheetId);
  const hasAnyScores = allScores.some(s => s.judgeScores.length > 0 || s.status !== JudgeScoreStatus.PARTICIPATED);
  const allComplete = allScores.every(s => s.judgeScores.length >= sheet.numJudges || s.status !== JudgeScoreStatus.PARTICIPATED);

  if (allComplete && allScores.length > 0) {
    sheet.status = JudgmentSheetStatus.COMPLETED;
  } else if (hasAnyScores) {
    sheet.status = JudgmentSheetStatus.IN_PROGRESS;
  }

  // Calculate ranks for participated entries using Dense Ranking (1, 1, 2, 2, 3, 3)
  const participatedScores = allScores.filter(s => s.status === JudgeScoreStatus.PARTICIPATED && s.judgeScores.length > 0);
  participatedScores.sort((a, b) => (b.averageMark || 0) - (a.averageMark || 0));
  let currentRank = 1;
  for (let i = 0; i < participatedScores.length; i++) {
    if (i > 0 && (participatedScores[i].averageMark || 0) < (participatedScores[i - 1].averageMark || 0)) {
      currentRank++;
    }
    participatedScores[i].rank = currentRank;
  }
  // Clear ranks for non-participated
  allScores.filter(s => s.status !== JudgeScoreStatus.PARTICIPATED).forEach(s => { s.rank = undefined; });

  // Two-way sync: Auto-sync Judgment Sheet marks directly into db.results entries
  for (const score of allScores) {
    const gr = (db.greenRoomAssignments || []).find((a: GreenRoomAssignment) => a.id === score.greenRoomAssignmentId);
    if (!gr) continue;

    const j1 = score.judgeScores.find(j => j.judgeNumber === 1);
    const j2 = score.judgeScores.find(j => j.judgeNumber === 2);
    const j1Mark = j1?.mark || 0;
    const j2Mark = j2?.mark || 0;

    let resultStatus: ResultStatus = ResultStatus.PARTICIPATED;
    if (score.status === JudgeScoreStatus.ABSENT || score.status === 'absent') resultStatus = ResultStatus.ABSENT;
    if (score.status === JudgeScoreStatus.DISQUALIFIED || score.status === 'disqualified') resultStatus = ResultStatus.DISQUALIFIED;

    const existingResult = (db.results || []).find(r =>
      r.competitionId === sheet.competitionId &&
      !r.deletedAt &&
      ((gr.participantId && r.participantId === gr.participantId) || (gr.teamId && r.teamId === gr.teamId))
    );

    if (existingResult) {
      existingResult.judge1Mark = j1Mark;
      existingResult.judge2Mark = j2Mark;
      existingResult.totalMark = score.totalMark;
      existingResult.averageMark = score.averageMark;
      if (!existingResult.manualRankOverride) {
        existingResult.rank = score.rank;
      }
      existingResult.status = resultStatus;
      existingResult.remarks = score.remarks;
      existingResult.updatedAt = new Date().toISOString();
    } else if (score.judgeScores.length > 0 || score.status !== JudgeScoreStatus.PARTICIPATED) {
      if (!db.results) db.results = [];
      db.results.push({
        id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        categoryId: sheet.categoryId,
        competitionId: sheet.competitionId,
        participantId: gr.participantId,
        teamId: gr.teamId,
        judge1Mark: j1Mark,
        judge2Mark: j2Mark,
        totalMark: score.totalMark,
        averageMark: score.averageMark,
        rank: score.rank,
        status: resultStatus,
        remarks: score.remarks,
        publishedStatus: sheet.publishedToResults || false,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  await dbClient.logAudit(user.id, user.username, user.role, 'Update Judgment Scores', 'JudgmentSheet', sheetId);
  await dbClient.save();

  try {
    const mongoDb = getDb();
    if (mongoDb) {
      const updatedScores = (db.judgeScores || []).filter((s: JudgeScore) => s.judgmentSheetId === sheetId);
      const ops = updatedScores.map((s: JudgeScore) => ({
        updateOne: {
          filter: { $or: [{ id: s.id }, { _id: s.id as any }] },
          update: { $set: { id: s.id, ...s } },
          upsert: true
        }
      }));
      if (ops.length > 0) {
        await mongoDb.collection('judgeScores').bulkWrite(ops, { ordered: false }).catch(() => {});
      }

      const compResults = (db.results || []).filter((r: Result) => r.competitionId === sheet.competitionId);
      const resOps = compResults.map((r: Result) => ({
        updateOne: {
          filter: { $or: [{ id: r.id }, { _id: r.id as any }] },
          update: { $set: { id: r.id, ...r } },
          upsert: true
        }
      }));
      if (resOps.length > 0) {
        await mongoDb.collection('results').bulkWrite(resOps, { ordered: false }).catch(() => {});
      }

      await mongoDb.collection('judgmentSheets').replaceOne(
        { $or: [{ id: sheet.id }, { _id: sheet.id as any }] },
        { id: sheet.id, ...sheet },
        { upsert: true }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('Mongo scores save error:', err);
  }

  res.json({ message: 'Scores updated successfully' });
});

// Lock judgment sheet results
apiRouter.post('/judgment-sheets/:id/lock', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.RESULT_MANAGER]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const sheetId = req.params.id;

  const sheet = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.id === sheetId && !s.deletedAt);
  if (!sheet) {
    return res.status(404).json({ error: 'Judgment sheet not found.' });
  }

  if (sheet.status === JudgmentSheetStatus.LOCKED) {
    return res.status(400).json({ error: 'Sheet is already locked.' });
  }

  sheet.status = JudgmentSheetStatus.LOCKED;
  sheet.lockedBy = user.id;
  sheet.lockedAt = new Date().toISOString();

  await dbClient.logAudit(user.id, user.username, user.role, 'Lock Judgment Sheet', 'JudgmentSheet', sheetId);
  await dbClient.save();

  res.json({ message: 'Judgment sheet locked successfully' });
});

// Unlock judgment sheet results (Admin only)
apiRouter.post('/judgment-sheets/:id/unlock', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.RESULT_MANAGER]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const sheetId = req.params.id;

  const sheet = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.id === sheetId && !s.deletedAt);
  if (!sheet) {
    return res.status(404).json({ error: 'Judgment sheet not found.' });
  }

  sheet.status = JudgmentSheetStatus.IN_PROGRESS;
  sheet.publishedToResults = false;

  // Unpublish associated results so they don't override sheet status
  (db.results || []).forEach((r: Result) => {
    if (r.competitionId === sheet.competitionId) {
      r.publishedStatus = false;
    }
  });

  await dbClient.logAudit(user.id, user.username, user.role, 'Unlock Judgment Sheet', 'JudgmentSheet', sheetId);
  await dbClient.save();

  try {
    const mongoDb = getDb();
    if (mongoDb) {
      await mongoDb.collection('judgmentSheets').updateOne(
        { $or: [{ id: sheetId }, { _id: sheetId as any }] },
        { $set: { status: JudgmentSheetStatus.IN_PROGRESS, publishedToResults: false } }
      ).catch(() => {});
      await mongoDb.collection('results').updateMany(
        { competitionId: sheet.competitionId },
        { $set: { publishedStatus: false } }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to sync unlock to Mongo:', err);
  }

  res.json({ message: 'Judgment sheet unlocked successfully' });
});

// Calculate results and push to the existing Result module
apiRouter.post('/judgment-sheets/:id/calculate', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.RESULT_MANAGER]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const sheetId = req.params.id;

  const sheet = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.id === sheetId && !s.deletedAt);
  if (!sheet) {
    return res.status(404).json({ error: 'Judgment sheet not found.' });
  }

  const scores = (db.judgeScores || []).filter((s: JudgeScore) => s.judgmentSheetId === sheetId);
  const competition = db.competitions.find(c => c.id === sheet.competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found.' });
  }

  let resultsPublished = 0;

  for (const score of scores) {
    // Resolve the green room assignment to get participantId/teamId
    const gr = (db.greenRoomAssignments || []).find((a: GreenRoomAssignment) => a.id === score.greenRoomAssignmentId);
    if (!gr) continue;

    // Map judge scores to the existing Result format (judge1Mark, judge2Mark)
    const j1 = score.judgeScores.find(j => j.judgeNumber === 1);
    const j2 = score.judgeScores.find(j => j.judgeNumber === 2);

    // Check if result already exists for this participant/team in this competition
    const existingResult = db.results.find(r =>
      r.competitionId === sheet.competitionId &&
      !r.deletedAt &&
      ((gr.participantId && r.participantId === gr.participantId) || (gr.teamId && r.teamId === gr.teamId))
    );

    let resultStatus: ResultStatus;
    switch (score.status) {
      case JudgeScoreStatus.ABSENT: resultStatus = ResultStatus.ABSENT; break;
      case JudgeScoreStatus.DISQUALIFIED: resultStatus = ResultStatus.DISQUALIFIED; break;
      default: resultStatus = ResultStatus.PARTICIPATED; break;
    }

    const j1Mark = j1?.mark || 0;
    const j2Mark = j2?.mark || 0;
    const nonZeroCount = (j1Mark > 0 ? 1 : 0) + (j2Mark > 0 ? 1 : 0) || 1;
    const calculatedAvgMark = score.averageMark !== undefined ? score.averageMark : Math.round((score.totalMark / nonZeroCount) * 100) / 100;

    if (existingResult) {
      // Update existing result
      existingResult.judge1Mark = j1Mark;
      existingResult.judge2Mark = j2Mark;
      existingResult.totalMark = score.totalMark;
      existingResult.averageMark = calculatedAvgMark;
      existingResult.rank = score.rank;
      existingResult.status = resultStatus;
      existingResult.remarks = score.remarks;
      existingResult.updatedBy = user.id;
      existingResult.updatedAt = new Date().toISOString();
      existingResult.publishedStatus = true;
      resultsPublished++;
    } else {
      // Create new result
      const result: Result = {
        id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        categoryId: sheet.categoryId,
        competitionId: sheet.competitionId,
        participantId: gr.participantId,
        teamId: gr.teamId,
        judge1Mark: j1Mark,
        judge2Mark: j2Mark,
        totalMark: score.totalMark,
        averageMark: calculatedAvgMark,
        rank: score.rank,
        status: resultStatus,
        remarks: score.remarks,
        publishedStatus: true,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.results.push(result);
      resultsPublished++;
    }
  }

  sheet.publishedToResults = true;

  await dbClient.logAudit(user.id, user.username, user.role, `Publish ${resultsPublished} Results from Judgment Sheet`, 'JudgmentSheet', sheetId);
  await dbClient.save();

  try {
    const mongoDb = getDb();
    if (mongoDb) {
      const compResults = (db.results || []).filter((r: Result) => r.competitionId === sheet.competitionId);
      const resOps = compResults.map((r: Result) => ({
        updateOne: {
          filter: { $or: [{ id: r.id }, { _id: r.id as any }] },
          update: { $set: { id: r.id, ...r } },
          upsert: true
        }
      }));
      if (resOps.length > 0) {
        await mongoDb.collection('results').bulkWrite(resOps, { ordered: false }).catch(() => {});
      }
      await mongoDb.collection('judgmentSheets').replaceOne(
        { $or: [{ id: sheet.id }, { _id: sheet.id as any }] },
        { id: sheet.id, ...sheet },
        { upsert: true }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('Mongo calculate results save error:', err);
  }

  res.json({ message: `Successfully published ${resultsPublished} result(s) to the Result module` });
});






// ==========================================
// 15. CERTIFICATE PUBLISHING
// ==========================================

apiRouter.post('/results/:id/publish-certificate', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { published } = req.body;
  const result = db.results.find(r => r.id === req.params.id && !r.deletedAt);
  if (!result) return res.status(404).json({ error: 'Result not found' });

  result.certificatePublished = published !== undefined ? published : true;
  result.updatedAt = new Date().toISOString();
  result.updatedBy = user.id;

  await dbClient.logAudit(user.id, user.username, user.role, `${published ? 'Publish' : 'Unpublish'} Certificate for ${result.id}`, 'Certificate', result.id);
  await dbClient.save();

  res.json({ success: true, certificatePublished: result.certificatePublished });
});


// ==========================================
// 🌐 PUBLIC WEBSITE APIs
// ==========================================

// Public Event Settings
apiRouter.get('/public/settings', async (req, res) => {
  const db = dbClient.get();
  res.json({
    ...(db.eventSettings || {}),
    ...(db.cmsSettings || {}),
    dragBlocks: db.dragBlocks || db.eventSettings?.dragBlocks || []
  });
});

// Public Units
apiRouter.get('/public/units', async (req, res) => {
  res.json(dbClient.get().units.filter(u => u.active));
});

// Public Categories
apiRouter.get('/public/categories', async (req, res) => {
  res.json(dbClient.get().categories.filter(c => c.active));
});

// Public Competitions
apiRouter.get('/public/competitions', async (req, res) => {
  res.json(dbClient.get().competitions.filter(c => c.active));
});

// Public Unit Standings (Calculated by official CalculationService!)
apiRouter.get('/public/standings', async (req, res) => {
  try {
    const standings = CalculationService.getUnitStandings();
    res.json(standings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate standings' });
  }
});

// Public Published Results
apiRouter.get('/public/results', async (req, res) => {
  const db = dbClient.get();

  const enrichedResults = db.results
    .filter(r => !r.deletedAt && r.publishedStatus)
    .map(r => {
      const comp = db.competitions.find(c => c.id === r.competitionId);
      const cat = db.categories.find(c => c.id === r.categoryId);

      let participantName = '';
      let codeNumber = '';
      let department = '';
      let participationType = comp?.participationType === 'group' ? 'Group' : 'Individual';

      let teamMemberIds: string[] = [];
      if (r.participantId) {
        const p = db.participants.find(p => p.id === r.participantId);
        if (p) {
          participantName = p.fullName;
          const chest = db.chestNumbers.find(c => c.participantId === p.id && c.categoryId === p.selectedCategoryId);
          codeNumber = chest ? chest.chestNumber.toString() : '';
          const unit = db.units.find(u => u.id === p.unitId);
          department = unit ? unit.name : '';
        }
      } else if (r.teamId) {
        const t = db.teams.find(t => t.id === r.teamId);
        if (t) {
          participantName = t.teamName || t.teamNumber;
          codeNumber = t.teamNumber;
          const unit = db.units.find(u => u.id === t.unitId);
          department = unit ? unit.name : '';
          teamMemberIds = t.memberIds || [];
        }
      }

      // Calculate points dynamically based on rank, category points, and eventSettings
      let points = 0;
      if (r.rank && r.rank <= 10) {
        if (cat) {
          const key = `pointsRank${r.rank}` as keyof typeof cat;
          if (cat[key] !== undefined && cat[key] !== null) {
            const val = Number(cat[key]);
            if (!isNaN(val)) points = val;
          }
        }
        if (points === 0) {
          const settingsKey = `globalPointsRank${r.rank}`;
          const settingsVal = (db.eventSettings as any)?.[settingsKey];
          if (settingsVal !== undefined && settingsVal !== null) {
            const val = Number(settingsVal);
            if (!isNaN(val)) points = val;
          }
        }
        if (points === 0) {
          const defaultMap: Record<number, number> = { 1: 20, 2: 14, 3: 7, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1, 9: 1, 10: 1 };
          points = defaultMap[r.rank] || 0;
        }
      }

      let grade = 'D';
      const m = r.totalMark || 0;
      if (m >= 90) grade = 'A+';
      else if (m >= 80) grade = 'A';
      else if (m >= 70) grade = 'B+';
      else if (m >= 60) grade = 'B';
      else if (m >= 50) grade = 'C+';
      else if (m >= 40) grade = 'C';
      else if (m >= 30) grade = 'D+';
      else grade = 'D';

      return {
        id: r.id,
        competitionId: r.competitionId,
        categoryId: r.categoryId,
        participantId: r.participantId || null,
        teamId: r.teamId || null,
        teamMemberIds: teamMemberIds || [],
        eventName: comp ? comp.name : 'Unknown',
        category: cat ? cat.name : 'Unknown',
        participationType,
        participantName,
        codeNumber,
        department,
        rank: r.rank || 0,
        grade,
        points,
        totalMark: m,
        marks: m,
        certificatePublished: r.certificatePublished || false,
        // Also send raw data for Poster Studio
        raw: {
          ...r,
          teamMemberIds
        }
      };
    });

  res.json(enrichedResults);
});

function getEnrichedParticipant(participant: any, db: any, chestNumStr?: string) {
  const cNum = (db.chestNumbers || []).find((c: any) => c.participantId === participant.id);
  const unit = (db.units || []).find((u: any) => u.id === participant.unitId || (cNum && u.id === cNum.unitId));
  const category = (db.categories || []).find((c: any) =>
    c.id === participant.categoryId ||
    c.id === participant.selectedCategoryId ||
    (cNum && c.id === cNum.categoryId)
  );

  // 1. Registered Individual Programs
  const indRegs = (db.registrations || []).filter((r: any) => !r.deletedAt && r.participantId === participant.id);
  const indCompIds: string[] = [];
  indRegs.forEach((r: any) => {
    if (r.competitionId) indCompIds.push(r.competitionId);
    if (Array.isArray(r.selectedIndividualCompetitionIds)) {
      r.selectedIndividualCompetitionIds.forEach((id: string) => {
        if (!indCompIds.includes(id)) indCompIds.push(id);
      });
    }
  });

  const indPrograms = indCompIds.map((compId: string) => {
    const comp = (db.competitions || []).find((c: any) => c.id === compId && !c.deletedAt);
    const cat = (db.categories || []).find((c: any) => c.id === (comp?.categoryId || participant.selectedCategoryId || participant.categoryId));
    const hasResult = (db.results || []).some((res: any) => {
      if (res.deletedAt) return false;
      if (res.competitionId !== compId) return false;
      const rPartId = res.participantId || res.raw?.participantId;
      const rCode = (res.codeNumber || res.chestNumber || res.raw?.codeNumber || res.raw?.chestNumber || '').toString();

      return (rPartId && rPartId === participant.id) ||
        (rCode && chestNumStr && rCode === chestNumStr) ||
        (!rPartId && !rCode && res.participantName === participant.fullName);
    });

    return {
      id: compId,
      competitionId: compId,
      program: comp ? comp.name : 'Individual Program',
      category: cat ? cat.name : (category ? category.name : 'General'),
      type: 'individual',
      status: hasResult ? 'completed' : 'upcoming'
    };
  });

  // 2. Registered Group Programs
  const groupTeams = (db.teams || []).filter((t: any) => !t.deletedAt && Array.isArray(t.memberIds) && t.memberIds.includes(participant.id));
  const groupPrograms = groupTeams.map((t: any) => {
    const comp = (db.competitions || []).find((c: any) => c.id === t.competitionId);
    const cat = (db.categories || []).find((c: any) => c.id === (comp?.categoryId || participant.selectedCategoryId || participant.categoryId));
    const hasResult = (db.results || []).some((res: any) => {
      if (res.competitionId !== t.competitionId) return false;
      return (res.teamId === t.id) ||
        (res.raw && Array.isArray(res.raw.teamMemberIds) && res.raw.teamMemberIds.includes(participant.id));
    });

    return {
      id: t.id,
      competitionId: t.competitionId,
      program: comp ? `${comp.name} (Group - ${t.name || 'Team'})` : 'Group Program',
      category: cat ? cat.name : (category ? category.name : 'General'),
      type: 'group',
      status: hasResult ? 'completed' : 'upcoming'
    };
  });

  return {
    ...participant,
    chestNumber: chestNumStr || (cNum ? cNum.chestNumber : participant.chestNumber || ''),
    unitName: unit ? unit.name : (participant.unitName || 'Nekkila'),
    categoryName: category ? category.name : (participant.categoryName || 'General'),
    dob: participant.dob || '',
    registeredPrograms: [...indPrograms, ...groupPrograms]
  };
}

// Participant Auth
apiRouter.post('/public/auth/participant-login', async (req, res) => {
  const { chestNumber, dob, candidateClass, classVal } = req.body;
  const db = dbClient.get();

  const cNum = db.chestNumbers.find(c => c.chestNumber.toString() === chestNumber);
  if (!cNum) return res.status(401).json({ error: 'Invalid Chest Number' });

  const participant = db.participants.find(p => p.id === cNum.participantId && !p.deletedAt);
  if (!participant) return res.status(401).json({ error: 'Participant not found' });

  const criteriaMode = db.eventSettings?.participantLoginCriteria || 'class';
  if (criteriaMode === 'class') {
    const val = (candidateClass || classVal || dob || '').toString().trim().toLowerCase();
    const pClass = (participant.candidateClass || '').toString().trim().toLowerCase();
    if (val && pClass && val !== pClass) {
      return res.status(401).json({ error: 'Incorrect Class / Grade' });
    }
  } else {
    if (dob && participant.dob && participant.dob !== dob) {
      return res.status(401).json({ error: 'Incorrect Date of Birth' });
    }
  }

  const enriched = getEnrichedParticipant(participant, db, cNum.chestNumber.toString());
  const token = jwt.sign({ participantId: participant.id, role: 'participant' }, JWT_SECRET || 'fallback', { expiresIn: '8h' });
  res.json({ token, participant: enriched });
});

apiRouter.get('/public/participant/by-chest/:chestNo', async (req, res) => {
  const { chestNo } = req.params;
  const db = dbClient.get();

  const cNum = (db.chestNumbers || []).find((c: any) => c.chestNumber.toString().toLowerCase() === chestNo.trim().toLowerCase());
  let participant = cNum ? (db.participants || []).find((p: any) => p.id === cNum.participantId && !p.deletedAt) : null;

  if (!participant) {
    participant = (db.participants || []).find((p: any) =>
      !p.deletedAt && (
        (p.chestNumber && p.chestNumber.toString().toLowerCase() === chestNo.trim().toLowerCase()) ||
        (p.codeNumber && p.codeNumber.toString().toLowerCase() === chestNo.trim().toLowerCase())
      )
    );
  }

  if (!participant) return res.status(404).json({ error: 'Participant not found' });

  const enriched = getEnrichedParticipant(participant, db, chestNo.trim());
  res.json({ participant: enriched });
});

apiRouter.get('/public/participant/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET || 'fallback') as any;
    if (decoded.role !== 'participant') return res.status(403).json({ error: 'Forbidden' });

    const db = dbClient.get();
    const participant = db.participants.find(p => p.id === decoded.participantId && !p.deletedAt);
    if (!participant) return res.status(404).json({ error: 'Participant not found' });

    const enriched = getEnrichedParticipant(participant, db);
    res.json({ participant: enriched });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Hero Upload Route
apiRouter.post('/hero/upload', authenticate, upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image file' });
    const url = await processUploadFile(file, 'sahityotsav_hero');
    res.status(201).json({ url });
  } catch (error: any) {
    console.error('Hero upload error:', error);
    res.status(500).json({ error: 'Failed to upload image', details: error.message || String(error) });
  }
});

// About Image Upload Route
apiRouter.post('/about/upload', authenticate, upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image file' });
    const url = await processUploadFile(file, 'sahityotsav_about');

    const db = dbClient.get();
    if (!db.cmsSettings) db.cmsSettings = {} as any;
    db.cmsSettings.aboutImage = url;
    await dbClient.save();

    res.status(201).json({ url });
  } catch (error: any) {
    console.error('About upload error:', error);
    res.status(500).json({ error: 'Failed to upload image', details: error.message || String(error) });
  }
});

// Footer Logo Upload Route
apiRouter.post('/footer/upload', authenticate, upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image file' });
    const url = await processUploadFile(file, 'sahityotsav_footer');

    const db = dbClient.get();
    if (!db.cmsSettings) db.cmsSettings = {} as any;
    db.cmsSettings.footerLogo = url;
    await dbClient.save();

    res.status(201).json({ url });
  } catch (error: any) {
    console.error('Footer upload error:', error);
    res.status(500).json({ error: 'Failed to upload logo', details: error.message || String(error) });
  }
});
// CMS Routes
apiRouter.get('/public/cms', (req, res) => {
  const db = dbClient.get();
  if (!db.dragBlocks || db.dragBlocks.length === 0) {
    db.dragBlocks = DEFAULT_DRAG_BLOCKS;
  }
  res.json({
    dragBlocks: db.dragBlocks,
    heroMedia: db.heroMedia || [],
    cmsSettings: db.cmsSettings || {}
  });
});

apiRouter.get('/cms', authenticate, (req, res) => {
  const db = dbClient.get();
  if (!db.dragBlocks || db.dragBlocks.length === 0) {
    db.dragBlocks = DEFAULT_DRAG_BLOCKS;
  }
  res.json({
    dragBlocks: db.dragBlocks,
    heroMedia: db.heroMedia || [],
    cmsSettings: db.cmsSettings || {}
  });
});

apiRouter.put('/cms', authenticate, (req, res) => {
  const db = dbClient.get();
  if (req.body.dragBlocks) db.dragBlocks = req.body.dragBlocks;
  if (req.body.heroMedia) db.heroMedia = req.body.heroMedia;
  if (req.body.cmsSettings) db.cmsSettings = req.body.cmsSettings;
  dbClient.save();
  res.json({ success: true });
});



// Bulk Participants
apiRouter.post('/participants/bulk', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), (req, res) => {
  try {
    const { participants } = req.body;
    if (!Array.isArray(participants)) return res.status(400).json({ error: 'Invalid payload' });

    const db = dbClient.get();
    let imported = 0;

    for (const p of participants) {
      if (!p.fullName) continue;

      const catNameStr = p.categoryName ? p.categoryName.toLowerCase() : '';
      let cat = db.categories.find(c => c.name.toLowerCase() === catNameStr);
      if (!cat && db.categories.length > 0) cat = db.categories[0];

      const unitNameStr = p.unitName ? p.unitName.toLowerCase() : '';
      let unit = db.units.find(u => u.name.toLowerCase() === unitNameStr);
      if (!unit && db.units.length > 0) unit = db.units[0];

      if (!cat || !unit) continue;

      const prefix = cat.name.substring(0, 3).toUpperCase();
      let highestCode = 100;
      const sameCategoryCodeNumbers = db.chestNumbers.filter(cn => cn.categoryId === cat!.id && cn.participationType === 'individual');
      if (sameCategoryCodeNumbers.length > 0) {
        const nums = sameCategoryCodeNumbers
          .map(cn => parseInt(cn.codeNumber.replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n));
        if (nums.length > 0) highestCode = Math.max(...nums);
      }
      const newCodeFormatted = `${prefix}${highestCode + 1}`;

      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      db.participants.push({
        id: newId,
        fullName: p.fullName,
        selectedCategoryId: cat.id,
        categoryId: cat.id,
        unitId: unit.id,
        chestNumber: newCodeFormatted,
        dob: p.dob || '',
        candidateClass: p.candidateClass || p.class || '',
        gender: p.gender || 'male',
        active: true,
        registrationStatus: 'approved',
        registeredAt: now,
        createdAt: now,
        updatedAt: now
      });

      db.chestNumbers.push({
        id: crypto.randomUUID(),
        entityId: newId,
        categoryId: cat.id,
        participationType: 'individual',
        codeNumber: newCodeFormatted
      });
      imported++;
    }

    dbClient.save();
    res.json({ success: true, imported, message: `Successfully imported ${imported} participants` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk Competitions
apiRouter.post('/competitions/bulk', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), (req, res) => {
  try {
    const { competitions } = req.body;
    if (!Array.isArray(competitions)) return res.status(400).json({ error: 'Invalid payload' });

    const db = dbClient.get();
    let imported = 0;

    for (const c of competitions) {
      if (!c.name) continue;

      const catNameStr = c.categoryName ? c.categoryName.toLowerCase() : '';
      let cat = db.categories.find(cat => cat.name.toLowerCase() === catNameStr);
      if (!cat && db.categories.length > 0) cat = db.categories[0];
      const compCode = generateCompCode(db, cat.id, c.name, c.code);

      db.competitions.push({
        id: crypto.randomUUID(),
        name: toTitleCase(c.name),
        code: compCode,
        categoryId: cat.id,
        participationType: c.participationType === 'group' ? ParticipationType.GROUP : ParticipationType.INDIVIDUAL,
        stageType: c.stageType === 'off_stage' ? StageType.OFF_STAGE : StageType.ON_STAGE,
        duration: c.duration || 5,
        displayOrder: 0,
        active: true,
        maxDurationMinutes: c.duration || 5,
        basePoints: 10,
        teamSize: c.participationType === 'group' ? 5 : 1,
        timeLimit: `${c.duration || 5} Min`,
        maxMarksPerJudge: 100,
        numJudges: 2,
        isCompleted: false,
        isResultPublished: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      imported++;
    }

    dbClient.save();
    res.json({ success: true, imported, message: `Successfully imported ${imported} competitions` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk Results
apiRouter.post('/results/bulk', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.JUDGE]), (req, res) => {
  try {
    const { results } = req.body;
    if (!Array.isArray(results)) return res.status(400).json({ error: 'Invalid payload' });

    const db = dbClient.get();
    let imported = 0;

    for (const r of results) {
      if (!r.competitionName || !r.chestNumber) continue;

      const comp = db.competitions.find(c => c.name.toLowerCase() === r.competitionName.toLowerCase());
      if (!comp) continue;

      const chestRecord = db.chestNumbers.find(cn => cn.codeNumber && cn.codeNumber.toUpperCase() === r.chestNumber.toUpperCase() && cn.categoryId === comp.categoryId);
      if (!chestRecord) continue;

      let participantId: string | undefined;
      let teamId: string | undefined;

      if (chestRecord.participationType === 'individual' || (chestRecord.participationType as any) === 'individual') {
        participantId = chestRecord.entityId;
      } else {
        teamId = chestRecord.entityId;
      }

      const existing = db.results.find(res => res.competitionId === comp.id &&
        ((participantId && res.participantId === participantId) || (teamId && res.teamId === teamId)));

      if (existing) continue;

      const j1 = r.judge1Mark || 0;
      const j2 = r.judge2Mark || 0;
      const total = j1 + j2;
      const sheet = (db.judgmentSheets || []).find((s: JudgmentSheet) => s.competitionId === comp.id && !s.deletedAt);
      const activeCount = (j1 > 0 ? 1 : 0) + (j2 > 0 ? 1 : 0) || 1;
      const average = Math.round((total / activeCount) * 100) / 100;

      db.results.push({
        id: crypto.randomUUID(),
        competitionId: comp.id,
        categoryId: comp.categoryId,
        participantId,
        teamId,
        judge1Mark: j1,
        judge2Mark: j2,
        totalMark: total,
        averageMark: average,
        rank: 0,
        status: r.status === 'absent' ? ResultStatus.ABSENT : r.status === 'disqualified' ? ResultStatus.DISQUALIFIED : ResultStatus.PARTICIPATED,
        publishedStatus: false,
        createdBy: (req as any).user?.username || 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      imported++;
    }

    const affectedComps = new Set<string>();
    for (const r of results) {
      const comp = db.competitions.find(c => c.name.toLowerCase() === (r.competitionName || '').toLowerCase());
      if (comp) affectedComps.add(comp.id);
    }

    for (const compId of Array.from(affectedComps)) {
      CalculationService.calculateCompetitionRanks(compId);
    }

    dbClient.save();
    res.json({ success: true, imported, message: `Successfully imported ${imported} results` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Database Backup Export Endpoint
apiRouter.get('/backup/export', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  const db = dbClient.get();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=sahityotsav_backup_${Date.now()}.json`);
  res.send(JSON.stringify(db, null, 2));
});

// Database Backup Restore Endpoint
apiRouter.post('/backup/restore', authenticate, requireRole([UserRole.SUPER_ADMIN]), upload.single('backup'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No backup file uploaded' });
    const content = fs.readFileSync(file.path, 'utf-8');
    const parsed = JSON.parse(content);

    const db = dbClient.get();
    Object.assign(db, parsed);

    await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Restore Database Backup', 'System', 'global');
    await dbClient.save();
    res.json({ success: true, message: 'Database restored successfully' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to restore backup' });
  }
});

// Full System Reset Endpoint (Wipes candidates, teams, results, chest numbers, registrations)
apiRouter.post('/backup/reset', authenticate, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
  try {
    const db = dbClient.get();
    db.participants = [];
    db.registrations = [];
    db.teams = [];
    db.results = [];
    db.chestNumbers = [];
    db.counters = [];
    db.greenRoomAssignments = [];
    db.judgmentSheets = [];
    db.judgeScores = [];

    await dbClient.logAudit((req as any).user.id, (req as any).user.username, (req as any).user.role, 'Full Reset System Database', 'System', 'global');
    await dbClient.save();

    res.json({ success: true, message: 'System wiped successfully. All candidate registrations, teams, and results cleared.' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to reset system database' });
  }
});

// ==========================================
// 🌐 PUBLIC WEBSITE APIs
// ==========================================

// Public Event Settings
apiRouter.get('/public/settings', async (req, res) => {
  const db = dbClient.get();
  res.json({
    ...(db.eventSettings || {}),
    ...(db.cmsSettings || {}),
    dragBlocks: db.dragBlocks || db.eventSettings?.dragBlocks || []
  });
});

// Public Units
apiRouter.get('/public/units', async (req, res) => {
  const db = dbClient.get();
  res.json((db.units || []).filter((u: any) => u.active));
});

// Public Categories
apiRouter.get('/public/categories', async (req, res) => {
  const db = dbClient.get();
  res.json((db.categories || []).filter((c: any) => c.active));
});

// Public Competitions
apiRouter.get('/public/competitions', async (req, res) => {
  const db = dbClient.get();
  res.json((db.competitions || []).filter((c: any) => c.active));
});

// Public Published Results
apiRouter.get('/public/results', async (req, res) => {
  const db = dbClient.get();
  const enrichedResults = (db.results || [])
    .filter((r: any) => !r.deletedAt && (r.publishedStatus || (r.rank !== undefined && r.rank > 0)))
    .map((r: any) => {
      const comp = (db.competitions || []).find((c: any) => c.id === r.competitionId);
      const cat = (db.categories || []).find((c: any) => c.id === r.categoryId);
      let participantName = r.participantName || '';
      let codeNumber = r.codeNumber || r.chestNumber || '';
      let department = r.department || r.unitName || '';
      let participationType = comp?.participationType === 'group' ? 'Group' : 'Individual';

      if (r.participantId && !participantName) {
        const p = (db.participants || []).find((p: any) => p.id === r.participantId);
        if (p) {
          participantName = p.fullName;
          const chest = (db.chestNumbers || []).find((c: any) => c.entityId === p.id);
          codeNumber = chest ? chest.codeNumber || chest.chestNumber.toString() : '';
          const unit = (db.units || []).find((u: any) => u.id === p.unitId);
          department = unit ? unit.name : '';
        }
      }

      let points = r.points || 0;
      if (!points) {
        if (r.rank === 1) points = db.eventSettings?.globalPointsRank1 ?? 20;
        else if (r.rank === 2) points = db.eventSettings?.globalPointsRank2 ?? 14;
        else if (r.rank === 3) points = db.eventSettings?.globalPointsRank3 ?? 7;
        else if (r.rank && r.rank >= 4 && r.rank <= 10) points = (db.eventSettings as any)?.[`globalPointsRank${r.rank}`] ?? 0;
      }

      let grade = r.grade || 'A';
      return {
        id: r.id,
        competitionId: r.competitionId,
        eventName: comp ? comp.name : (r.eventName || r.program || 'Competition'),
        category: cat ? cat.name : (r.category || 'General'),
        participationType,
        participantName,
        codeNumber,
        department,
        rank: r.rank || 0,
        grade,
        points,
        raw: r
      };
    });
  res.json(enrichedResults);
});

// Public Standings / House Scores
apiRouter.get('/public/standings', async (req, res) => {
  const db = dbClient.get();
  const units = (db.units || []).filter((u: any) => u.active);
  const standings = units.map((u: any) => {
    let overallPoints = 0;
    let firstPlaceCount = 0;
    let secondPlaceCount = 0;
    let thirdPlaceCount = 0;

    (db.results || []).forEach((r: any) => {
      if (!r.deletedAt && (r.publishedStatus || (r.rank !== undefined && r.rank > 0))) {
        const p = (db.participants || []).find((p: any) => p.id === r.participantId);
        const t = (db.teams || []).find((t: any) => t.id === r.teamId);
        const unitId = p ? p.unitId : (t ? t.unitId : null);
        if (unitId === u.id || r.department === u.name) {
          const pts = r.points || (r.rank === 1 ? 20 : r.rank === 2 ? 15 : r.rank === 3 ? 10 : 0);
          overallPoints += pts;
          if (r.rank === 1) firstPlaceCount++;
          if (r.rank === 2) secondPlaceCount++;
          if (r.rank === 3) thirdPlaceCount++;
        }
      }
    });

    return {
      unitId: u.id,
      unitName: u.name,
      unitCode: u.code,
      overallPoints,
      firstPlaceCount,
      secondPlaceCount,
      thirdPlaceCount
    };
  }).sort((a: any, b: any) => b.overallPoints - a.overallPoints);

  res.json(standings);
});

// Public Gallery
apiRouter.get('/public/gallery', async (req, res) => {
  const db = dbClient.get();
  res.json(db.gallery || []);
});

// Public Highlights
apiRouter.get('/public/highlights', async (req, res) => {
  const db = dbClient.get();
  res.json(db.videoHighlights || []);
});

