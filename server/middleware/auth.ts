import type { Request, Response, NextFunction } from "express";
import { verifyIdToken } from "../firebase";

// Extend Express Request type
declare module "express-serve-static-core" {
  interface Request {
    storeId?: string;
    store?: {
      id: string;
      email: string;
      name?: string;
    };
  }
}

// Middleware to verify Firebase token and set store info
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized - No token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    // Verify token
    const decodedToken = await verifyIdToken(idToken);

    // Set store info on request
    req.storeId = decodedToken.uid;
    req.store = {
      id: decodedToken.uid,
      email: decodedToken.email || "",
      name: decodedToken.name,
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ error: "Unauthorized - Invalid token" });
  }
}

export function getStoreId(req: Request): string {
  const storeId = req.storeId;
  if (!storeId) {
    throw new Error("Store ID not found in request");
  }
  return storeId;
}
