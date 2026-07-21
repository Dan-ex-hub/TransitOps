/**
 * setup-admin.mjs
 * ─────────────────────────────────────────────────────────────────
 * One-time script to create the TransitOps admin account.
 *
 * Admin credentials:
 *   Email:    admin@transitops.com
 *   Password: Admin@123
 *
 * Usage:
 *   node setup-admin.mjs
 *
 * Uses Firebase client SDK + RTDB (no Firestore, no service-account needed).
 * Run only ONCE. Running again on an existing account is a safe no-op.
 * ─────────────────────────────────────────────────────────────────
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env manually (no dotenv dependency needed)
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

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
};

const ADMIN_EMAIL    = "admin@transitops.com";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_NAME     = "TransitOps Admin";

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const rtdb = getDatabase(app);

async function main() {
  console.log("🔧 TransitOps — Admin Setup");
  console.log("────────────────────────────");

  let uid;

  // Create the Auth account (or sign in if it already exists)
  try {
    const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    uid = cred.user.uid;
    await updateProfile(cred.user, { displayName: ADMIN_NAME });
    console.log(`✅ Firebase Auth account created (uid: ${uid})`);
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      console.log("ℹ️  Auth account already exists — signing in…");
      const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      uid = cred.user.uid;
      console.log(`✅ Signed in (uid: ${uid})`);
    } else {
      console.error("❌ Auth failed:", err.message);
      process.exit(1);
    }
  }

  // Write admin profile to RTDB user_profiles/{uid}
  try {
    await set(ref(rtdb, `user_profiles/${uid}`), {
      uid,
      email:        ADMIN_EMAIL,
      display_name: ADMIN_NAME,
      roles:        ["admin"],
      status:       "approved",
      created_at:   new Date().toISOString(),
    });
    console.log("✅ RTDB admin profile written to user_profiles/" + uid);
  } catch (err) {
    console.error("❌ RTDB write failed:", err.message);
    process.exit(1);
  }

  console.log("");
  console.log("🎉 Admin account ready!");
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log("");
  process.exit(0);
}

main();
