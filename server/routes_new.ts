import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { getCollection, getDb } from './db.js';
import { CalculationService } from './calculations.js';
import { UserRole, ResultStatus } from '../src/types.js';

export const apiRouter = express.Router();

const COOKIE_NAME = 'sahityotsav_admin_session';

const JWT_SECRET = process.env.AUTH_SECRET || 'fallback_secret_for_development_only_12345';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

function configureCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary not configured in .env');
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// --- MIDDLEWARES ---

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieHeader = req.headers.cookie || '';
    const cookieMatch = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (cookieMatch) token = cookieMatch[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, code: 'SESSION_MISSING', message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await getCollection('users').findOne({ _id: decoded.userId });
    
    if (!user || !user.active) {
      return res.status(401).json({ success: false, code: 'USER_INACTIVE', message: 'User account is deactivated.' });
    }

    (req as any).user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({ success: false, code: 'SESSION_EXPIRED', message: 'Session invalid or expired.' });
  }
}

export function requireRole(roles: (UserRole | string)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: `Access denied. Requires one of roles: ${roles.join(', ')}` });
    }
    
    // VIEWER BLOCK
    if (user.role === 'viewer' && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
      return res.status(403).json({ error: 'Demo mode: Viewers cannot make changes to the system.' });
    }
    
    next();
  };
}

// --- PUBLIC ROUTES ---
apiRouter.get('/public/highlights', async (req, res) => {
  const highlights = await getCollection('videoHighlights').find().toArray();
  res.json(highlights);
});

apiRouter.get('/public/gallery', async (req, res) => {
  const gallery = await getCollection('gallery').find().toArray();
  res.json(gallery);
});

apiRouter.get('/public/cms', async (req, res) => {
  const dragBlocks = await getCollection('dragBlocks').find().toArray();
  const heroMedia = await getCollection('heroMedia').find().toArray();
  const cmsSettings = await getCollection('settings').findOne({ _id: 'cmsSettings' });
  res.json({ dragBlocks, heroMedia, cmsSettings: cmsSettings || {} });
});

// To be continued...
