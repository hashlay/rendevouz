# 📖 COMPLETE GUIDE: Setting Up a New Festival (MongoDB, 16MB Bypass, Git & Vercel)

This document is the official, definitive reference manual for any developer or AI agent setting up a new festival, cloning this system, connecting a new MongoDB database, and deploying to Git & Vercel.

---

## 1. System Architecture Overview

The system consists of two tightly integrated applications sharing one MongoDB database:

| Component | Directory | Purpose | Repository (Example) |
| --- | --- | --- | --- |
| **Admin & Management Portal** | `ssf-ninthikal-sector-sahityotsav-management-system (2) - Copy/` (this folder) | Full festival operations: Registration, Competitions, Judgment Sheets, Chest Numbers, Poster Studio, Scoring, User Roles. | `hashlay/rendevouz` |
| **Public Results Portal** | Parent Root (`../`) | Ultra-fast public live scores, leaderboards, participant search, certificate download, poster showcase. | `hashlay/rendevouz-public` |

Both applications connect to the **same MongoDB database** via the `MONGODB_URI` environment variable.

---

## 2. MongoDB Setup & The 16MB Document Limit Solution

### ⚠️ The 16MB Problem in MongoDB
MongoDB Atlas enforces a strict hard limit: **A single BSON document cannot exceed 16 megabytes (16,777,216 bytes)**.
In a festival platform, when you have:
- Hundreds of registered participants with photos
- Scores across multiple criteria for every judge
- Base64 images, poster backgrounds, and gallery media
- Full audit logs and judgment sheets

Saving everything in a single monolithic document (e.g. `app_state.global_state`) **WILL CRASH** with:
```
BSONObj size (17825721 bytes) is larger than max BSON size (16777216 bytes)
```

---

### 🛡️ The Architecture Solution: 17 Partitioned Collections

To permanently bypass the 16MB limit, this codebase uses a **Collection-Based Architecture** implemented in [`server/db.ts`](file:///c:/Users/Lenovo/Downloads/rendezvous-silver-edition---imam-rabbani-life-festival/ssf-ninthikal-sector-sahityotsav-management-system%20(2)%20-%20Copy/server/db.ts):

Instead of storing the entire festival in one document, each section is stored as individual documents in **17 dedicated MongoDB collections**:

| Collection | What It Stores |
| --- | --- |
| `users` | Admin, Judges, Operators, Sector Teams with hashed passwords |
| `units` | Teams / Units (e.g., Ash-Shukr, As-Sabr) |
| `categories` | Categories (Kids, Sub-Junior, Junior, Senior) with age rules & chest prefixes |
| `competitions` | Programs, stage assignments, max marks, judges count |
| `participants` | Participant profiles, assigned chest numbers, unit affiliations |
| `teams` | Group competition rosters |
| `results` | Published ranks, points, grades, and winners |
| `registrations` | Active event registrations |
| `chestNumbers` | Allocated chest number entries |
| `counters` | Running chest number sequence counters (101, 201, 301, 401...) |
| `greenRoomAssignments`| Stage calling order and codes |
| `judgmentSheets` | Competition evaluation sheets and lock statuses |
| `judgeScores` | Criteria-wise marks (`c1`, `c2`, `c3`, `c4`, total) per judge |
| `gallery` | Uploaded festival photos |
| `videoHighlights` | Video highlight embeds and links |
| `dragBlocks` | Dynamic CMS landing page blocks |
| `heroMedia` | Hero banner media slides |
| `settings` | Individual config documents: `eventSettings`, `cmsSettings`, `posterTemplateConfig`, `certificateTemplateConfig`, `state_version` |

#### Dual-Safety Safeguards:
1. **12MB Threshold Guard**: The legacy `global_state` document in `app_state` is only updated if `Buffer.byteLength(jsonStr, 'utf8') < 12 * 1024 * 1024`. If the database grows beyond 12MB, the system automatically skips `global_state` and relies 100% on the 17 individual collections.
2. **Versioned Synchronization (`state_version`)**: Every save bumps a millisecond timestamp `state_version` in the `settings` collection. Serverless instances check this single 1ms micro-query before fetching data, preventing redundant database calls.

---

### Step-by-Step: Connecting a New MongoDB Database

1. **Create a Database in MongoDB Atlas**:
   - Go to [MongoDB Atlas](https://cloud.mongodb.com).
   - In your Cluster, click **Connect** &rarr; **Drivers** (Node.js).
   - Copy the connection string.
   - Format:
     ```
     mongodb+srv://<username>:<password>@cluster0.xyz.mongodb.net/<NEW_FESTIVAL_NAME_2026>?retryWrites=true&w=majority
     ```
   - **Crucial**: Replace `<NEW_FESTIVAL_NAME_2026>` with your new festival identifier (e.g., `At-Tabassum_2026` or `rendezvous_2026`). The server automatically parses this database name from the URL path!

2. **Starting Fresh vs Migrating Existing Data**:
   - **Option A (Fresh Festival)**:
     - When you start the server with a new empty database, `server/db.ts` detects the empty database and automatically seeds:
       - Super Admin user (`admin` / `admin123` or your `INITIAL_ADMIN_PASSWORD`)
       - Default categories (Kids, Sub-Junior, Junior, Senior) with starting chest numbers (101, 201, 301, 401)
       - Default units (Ash-Shukr, As-Sabr)
       - Default category counters
       - Default event settings
   - **Option B (Migrating Data from an existing JSON or legacy database)**:
     - If you have an existing `data/db.json` or `global_state` to import into the new collections, run the migration script:
       ```bash
       npx tsx server/migrateToCollections.ts
       ```
     - This script automatically extracts all 17 sections, maps `id` to `_id`, and performs batch upserts into the new collections.

---

## 3. Connecting to New Git Repositories

When creating a new festival, disconnect from the old repositories and connect to the new ones:

### A. Admin / Management Portal
```bash
# In this directory:
git remote set-url origin https://github.com/<YOUR_GITHUB_USER_OR_ORG>/<NEW_ADMIN_REPO>.git
git add -A
git commit -m "Initial commit for new festival management system"
git branch -M main
git push -u origin main
```

### B. Public Portal
```bash
cd .. # Navigate back to workspace root
git remote set-url origin https://github.com/<YOUR_GITHUB_USER_OR_ORG>/<NEW_PUBLIC_REPO>.git
git add -A
git commit -m "Initial commit for new festival public portal"
git branch -M main
git push -u origin main
```

---

## 4. Deploying to Vercel for the New Festival

You will create **two separate projects** in Vercel.

### Project 1: Admin Portal (`<festival>-admin.vercel.app`)
1. In Vercel, click **Add New** &rarr; **Project** &rarr; Import `<NEW_ADMIN_REPO>`.
2. **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (if standalone repo) or `ssf-ninthikal-sector-sahityotsav-management-system (2) - Copy` (if monorepo)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. **Environment Variables**:
   | Key | Value | Description |
   | --- | --- | --- |
   | `MONGODB_URI` | `mongodb+srv://.../<NEW_DB>?retryWrites=true&w=majority` | Atlas connection string |
   | `JWT_SECRET` | *(Generate a 32+ char random string)* | Auth session security |
   | `NODE_ENV` | `production` | Production mode |
   | `INITIAL_ADMIN_USERNAME` | `admin` | Default admin username |
   | `INITIAL_ADMIN_PASSWORD` | `<secure_password>` | Default admin password |
4. Click **Deploy**.

---

### Project 2: Public Portal (`<festival>-public.vercel.app`)
1. In Vercel, click **Add New** &rarr; **Project** &rarr; Import `<NEW_PUBLIC_REPO>`.
2. **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. **Environment Variables**:
   | Key | Value | Description |
   | --- | --- | --- |
   | `MONGODB_URI` | `mongodb+srv://.../<NEW_DB>?retryWrites=true&w=majority` | **Same** MongoDB URI as Admin |
   | `NODE_ENV` | `production` | Production mode |
4. Click **Deploy**.

---

### Step 4: Link the Public URL in Admin Settings
Once the public portal is deployed:
1. Log in to the Admin Portal (`admin` / your password).
2. Go to **Settings** &rarr; **Festival Information** or **Chest Number Studio**.
3. Set the **Public Portal URL** to your new public Vercel domain (e.g., `https://myfestival.vercel.app`).
4. Save settings.
5. All generated Chest Number QR codes and Certificate verification links will now point directly to your live public website!

---

## 5. Agent Verification Checklist (Run Before Completing)

Whenever an AI agent or developer finishes setting up a new festival:

- [ ] **Verify Builds Pass**:
  - Run `npm run build` in admin sub-app &rarr; Exit code `0`.
  - Run `npm run build` in root public app &rarr; Exit code `0`.
- [ ] **Verify MongoDB Connection**:
  - Start admin server (`npm run dev`) and check terminal logs for:
    `🍃 Connected successfully to MongoDB: "<NEW_DB>"`
- [ ] **Verify Collection Isolation (16MB Protection)**:
  - Check MongoDB Atlas collections view &rarr; verify `categories`, `units`, `competitions`, `participants`, `settings` collections exist.
- [ ] **Verify Admin Login**:
  - Open `/login` in browser and log in with the admin credentials.
- [ ] **Verify Public Site Connectivity**:
  - Load the public website; ensure it fetches active categories/units from MongoDB with status 200.
- [ ] **Verify Both Git Remotes**:
  - Run `git remote -v` in both directories to ensure they point to the new festival's repositories.
