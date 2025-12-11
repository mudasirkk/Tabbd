import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config(); // loads root .env automatically if server runs at root

// ------------------------------------------
// Load service account from file
// ------------------------------------------

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_PATH in .env");
}

const resolvedPath = path.resolve(serviceAccountPath);

if (!fs.existsSync(resolvedPath)) {
  throw new Error(`Service account file not found at: ${resolvedPath}`);
}

const serviceAccountJSON = JSON.parse(
  fs.readFileSync(resolvedPath, "utf8")
);

// Fix escaped newlines in private_key (common on Windows)
if (serviceAccountJSON.private_key) {
  serviceAccountJSON.private_key = serviceAccountJSON.private_key.replace(/\\n/g, "\n");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountJSON as admin.ServiceAccount),
  });
  console.log("[Firebase] Initialized using service account file");
}

export const auth = admin.auth();

export async function verifyIdToken(idToken: string) {
  return auth.verifyIdToken(idToken);
}

export default admin;
