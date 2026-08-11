import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import compression from 'compression';
import path from 'path';
import { apiRouter } from './server/routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable gzip compression for all responses (huge speed boost for JSON APIs)
app.use(compression());

// Security headers & parsers with 50mb limit for gallery Base64 logo uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logs
app.use((req, res, next) => {
  if (!req.url.startsWith('/@vite') && !req.url.startsWith('/src')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount API router
app.use('/api', apiRouter);

// Serve static assets/uploaded logos if they exist on disk
app.use('/data/uploads', express.static(path.join(process.cwd(), 'data/uploads')));

// If we are NOT running inside Vercel, boot up a full server
if (!process.env.VERCEL) {
  if (process.env.NODE_ENV !== 'production') {
    // Development Mode
    import('vite').then(({ createServer: createViteServer }) => {
      createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      }).then(vite => {
        app.use(vite.middlewares);
        console.log("Vite development server middleware mounted");
        
        app.listen(PORT, () => {
          console.log(`=============================================================`);
          console.log(`🚀 SSF Ninthikal Sector Sahityotsav Dev Server Running on port ${PORT}`);
          console.log(`=============================================================`);
        });
      }).catch(err => {
        console.error("FATAL: Failed to start Vite Dev Server", err);
        process.exit(1);
      });
    }).catch(err => {
      console.error("Failed to dynamically import Vite", err);
    });
  } else {
    // Production Mode: Serve the static files from /dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Serving production static folder");
    
    app.listen(PORT, () => {
      console.log(`=============================================================`);
      console.log(`🚀 SSF Ninthikal Sector Sahityotsav Prod Server Running on port ${PORT}`);
      console.log(`=============================================================`);
    });
  }
}

// ALWAYS export the app for Vercel Serverless
export default app;
