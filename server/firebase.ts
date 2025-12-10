import admin from "firebase-admin";
import 'dotenv/config';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Using service account JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      // Check if the value looks like a template placeholder or invalid JSON
      const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      
      if (serviceAccountStr.startsWith('{{') || serviceAccountStr === '' || serviceAccountStr === '{{') {
        console.warn("[Firebase] FIREBASE_SERVICE_ACCOUNT appears to be a template placeholder or empty. Skipping Firebase initialization.");
        console.warn("[Firebase] Please set FIREBASE_SERVICE_ACCOUNT to a valid JSON string in your .env file.");
      } else {
        const serviceAccount = JSON.parse(serviceAccountStr);
        
        // Fix the private_key field - replace escaped newlines with actual newlines
        if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        });
        
        console.log("[Firebase] Initialized with service account");
      }
    } catch (error: any) {
      console.error("[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT:", error.message);
      console.error("[Firebase] Make sure FIREBASE_SERVICE_ACCOUNT is valid JSON in your .env file");
      // Don't throw - allow server to start without Firebase for development
    }
  } 
  // Option 2: Using individual credentials
  else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log("[Firebase] Initialized with individual credentials");
    } catch (error: any) {
      console.error("[Firebase] Failed to initialize with individual credentials:", error.message);
    }
  }
  // Option 3: Using default credentials
  else {
    try {
      admin.initializeApp();
      console.log("[Firebase] Initialized with default credentials");
    } catch (error: any) {
      console.warn("[Firebase] Could not initialize with default credentials:", error.message);
    }
  }
}

// Export auth only if initialized, otherwise export null and handle in verifyIdToken
let authInstance: admin.auth.Auth | null = null;
try {
  authInstance = admin.auth();
} catch (error) {
  console.warn("[Firebase] Auth instance not available");
}

export const auth = authInstance!;

// Verify Firebase ID token
export async function verifyIdToken(idToken: string) {
  if (!auth) {
    throw new Error("Firebase Admin not initialized. Please configure FIREBASE_SERVICE_ACCOUNT in your .env file.");
  }
  
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("Error verifying ID token:", error);
    throw new Error("Invalid ID token");
  }
}

export default admin;
