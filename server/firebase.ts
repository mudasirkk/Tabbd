import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");
}

const serviceAccount = JSON.parse(
  Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_B64,
    "base64"
  ).toString("utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const auth = admin.auth();

export async function verifyIdToken(idToken: string) {
  return auth.verifyIdToken(idToken);
}

export default admin;
