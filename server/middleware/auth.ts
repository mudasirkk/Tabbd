import type { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";

/**
 * Firebase-auth middleware.
 *
 * Client must send: Authorization: Bearer <Firebase ID token>
 * Server verifies token via Firebase Admin SDK.
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(json) {
    const serviceAccount = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    initFirebaseAdmin();

    const header = req.headers.authorization;
    if(!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }

    const idToken = header.slice("Bearer ".length).trim();
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    console.error("[Auth] Token Verification Failed:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
    }
  }

  export function getUserId(req: Request) {
    if (!req.user?.uid) throw new Error("Missing req.user - did you forget requireAuth?");  
    return req.user.uid;
  }