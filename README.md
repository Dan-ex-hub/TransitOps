# TransitOps — Logistics & Fleet Command Surface

TransitOps is a real-time fleet management, driver operations, and dispatch intelligence platform built for modern logistics teams.

---

## 🚀 Key Features

- **Fleet Register (`/fleet`)**: Track vehicle assets, model specifications, region assignment, load capacity, odometer readings, and lifecycle status (`AVAILABLE`, `ON_TRIP`, `IN_SHOP`, `RETIRED`).
- **Driver Operations (`/drivers`)**: Manage driver registries, license categories (`HGV`, `MGV`, `LGV`), license expiry tracking, contact details, and safety scores.
- **Dispatch & Trip Management (`/trips`)**: Plan and monitor trip lifecycles from draft to completion, including origin/destination regions, cargo weight, distance, and revenue tracking.
- **Fuel Intelligence (`/fuel`)**: Record fuel refill logs, monitor efficiency, calculate fuel costs, and flag efficiency anomalies automatically.
- **Maintenance Logs (`/maintenance`)**: Track scheduled service events, repair descriptions, cost records, and maintenance statuses.
- **Analytics & Audit (`/analytics`, `/audit`)**: Real-time performance dashboards and complete audit logging for configuration and data modifications.
- **Role-Based Access Control (RBAC) & Approvals (`/users`)**: 
  - Gated write operations for Admin and Fleet Manager accounts.
  - New registration approval workflow managed directly by Admins.
- **Data Import & Export**:
  - Bulk CSV import with column header validation and automatic field transformation.
  - One-click CSV and PDF export across all operational tables.

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript
- **Routing & State**: TanStack Router & TanStack Query
- **Styling**: Tailwind CSS + Shadcn UI primitives
- **Database & Authentication**: Firebase Auth + Firebase Realtime Database (RTDB)
- **Charts & Reports**: Recharts, jsPDF, PapaParse

---

## 🔑 Environment Variables

To run the project locally or in production, configure the following Firebase environment variables:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 💻 Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Dan-ex-hub/TransitOps.git
   cd TransitOps
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Create a `.env` file in the root directory using the template above.

4. **Seed Database (Optional)**:
   ```bash
   node setup-admin.mjs   # Creates default admin account
   node seed-data.mjs     # Seeds fleet, drivers, trips, fuel, and maintenance records
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 🌐 Vercel Deployment Guide

TransitOps is optimized out-of-the-box for seamless deployment on **Vercel**.

### Step 1: Import Project to Vercel
1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Select and import the `TransitOps` GitHub repository.

### Step 2: Configure Environment Variables
In the Vercel project settings during import (or under **Settings > Environment Variables**), add your Firebase keys:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Step 3: Build & Deploy
Vercel automatically detects the configuration:
- **Framework Preset**: Vite / Other
- **Build Command**: `npm run build`
- **Output Directory**: `dist/client`

Click **Deploy**. Vercel will build and launch your application instantly.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
