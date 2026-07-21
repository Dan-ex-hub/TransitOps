/**
 * seed-data.mjs
 * ─────────────────────────────────────────────────────────────────
 * Seeds the Firebase RTDB with data from the /data/*.csv files.
 * Clears existing bad/blank records first, then inserts clean data.
 *
 * Usage:
 *   node seed-data.mjs
 * ─────────────────────────────────────────────────────────────────
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, set, remove, get } from "firebase/database";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env ──────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, ".env");
let envContent = "";
try { envContent = readFileSync(envPath, "utf8"); } catch {}
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=");
  const k = key?.trim();
  const v = rest.join("=").trim().replace(/^["']|["']$/g, "");
  if (k && !k.startsWith("#") && v) process.env[k] = v;
}

// ── Firebase init ──────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
};
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const rtdb = getDatabase(app);

// ── CSV parser (no external deps) ─────────────────────────────────
function parseCsv(content) {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? "").trim(); });
    return row;
  });
}

function splitCsvLine(line) {
  const result = [];
  let cur = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === "," && !inQuote) { result.push(cur); cur = ""; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function num(v) { const n = Number(v); return isFinite(n) ? n : null; }
function bool(v) { return /^(yes|true|1)$/i.test(String(v)); }
function nullable(v) { return v === "" || v == null ? null : v; }

// ── Table: vehicles ────────────────────────────────────────────────
function mapVehicle(r) {
  return {
    registration_number: r["Registration"],
    name:                r["Name"],
    model:               nullable(r["Model"]),
    type:                r["Type"],
    region:              r["Region"],
    max_load_capacity:   num(r["Capacity (kg)"]),
    odometer:            num(r["Odometer"]),
    acquisition_cost:    num(r["Cost"]),
    status:              r["Status"] || "AVAILABLE",
  };
}

// ── Table: drivers ─────────────────────────────────────────────────
function mapDriver(r) {
  return {
    name:                r["Name"],
    license_number:      r["License"],
    license_category:    r["Category"],
    license_expiry_date: r["Expiry"],
    contact_number:      nullable(r["Contact"]),
    safety_score:        num(r["Safety"]),
    status:              r["Status"] || "AVAILABLE",
  };
}

// ── Table: trips ───────────────────────────────────────────────────
function mapTrip(r) {
  return {
    source:               r["Source"],
    source_region:        nullable(r["From region"]),
    destination:          r["Destination"],
    destination_region:   nullable(r["To region"]),
    vehicle_id:           null,
    driver_id:            null,
    cargo_weight:         num(r["Cargo (kg)"]),
    planned_distance:     num(r["Distance (km)"]),
    actual_distance:      nullable(r["Actual (km)"]) ? num(r["Actual (km)"]) : null,
    fuel_consumed:        null,
    revenue:              nullable(r["Revenue"]) ? num(r["Revenue"]) : null,
    status:               r["Status"] || "DRAFT",
    dispatched_at:        null,
    completed_at:         null,
  };
}

// ── Table: fuel_logs ───────────────────────────────────────────────
function mapFuelLog(r) {
  return {
    vehicle_id:    nullable(r["Vehicle"]),
    trip_id:       null,
    date:          r["Date"],
    liters:        num(r["Liters"]),
    cost:          num(r["Cost"]),
    anomaly_flag:  bool(r["Anomaly"]),
    anomaly_reason: nullable(r["Reason"]),
  };
}

// ── Table: maintenance_logs ────────────────────────────────────────
function mapMaintenance(r) {
  return {
    vehicle_id:  nullable(r["Vehicle"]),
    description: r["Description"],
    start_date:  r["Start"],
    end_date:    nullable(r["End"]),
    cost:        num(r["Cost"]),
    status:      r["Status"] || "ACTIVE",
  };
}

// ── RTDB helpers ───────────────────────────────────────────────────
function newKey() {
  // Firebase push-key format: timestamp + random
  const now = Date.now();
  const chars = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
  let key = "";
  let t = now;
  for (let i = 7; i >= 0; i--) { key = chars[t % 64] + key; t = Math.floor(t / 64); }
  for (let i = 0; i < 12; i++) key += chars[Math.floor(Math.random() * 64)];
  return key;
}

async function clearTable(table) {
  const snap = await get(ref(rtdb, table));
  const val = snap.val();
  if (!val) return 0;
  const keys = Object.keys(val);
  for (const k of keys) await remove(ref(rtdb, `${table}/${k}`));
  return keys.length;
}

async function insertRows(table, rows, mapFn) {
  const now = new Date().toISOString();
  let inserted = 0;
  for (const r of rows) {
    const mapped = mapFn(r);
    const key = newKey();
    await set(ref(rtdb, `${table}/${key}`), { ...mapped, created_at: now, updated_at: now });
    inserted++;
  }
  return inserted;
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 TransitOps — Data Seeder");
  console.log("────────────────────────────────────────");

  // Sign in as admin to have write permission
  console.log("🔑 Signing in as admin…");
  await signInWithEmailAndPassword(auth, "admin@transitops.com", "Admin@123");
  console.log("✅ Signed in\n");

  const tables = [
    { file: "fleet.csv",        table: "vehicles",         mapFn: mapVehicle     },
    { file: "drivers.csv",      table: "drivers",          mapFn: mapDriver      },
    { file: "trips.csv",        table: "trips",            mapFn: mapTrip        },
    { file: "fuel_logs.csv",    table: "fuel_logs",        mapFn: mapFuelLog     },
    { file: "maintenance.csv",  table: "maintenance_logs", mapFn: mapMaintenance },
  ];

  for (const { file, table, mapFn } of tables) {
    const filePath = resolve(__dirname, "data", file);
    let content;
    try { content = readFileSync(filePath, "utf8"); }
    catch { console.warn(`  ⚠️  ${file} not found — skipping`); continue; }

    const rows = parseCsv(content);
    if (rows.length === 0) { console.warn(`  ⚠️  ${file} is empty — skipping`); continue; }

    process.stdout.write(`  📋 ${table}: clearing old data… `);
    const cleared = await clearTable(table);
    console.log(`cleared ${cleared} record(s)`);

    process.stdout.write(`  📥 inserting ${rows.length} row(s)… `);
    const inserted = await insertRows(table, rows, mapFn);
    console.log(`✅ ${inserted} inserted`);
  }

  console.log("\n🎉 Seeding complete!");
  process.exit(0);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
