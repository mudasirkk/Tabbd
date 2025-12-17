import type { Request, Response, NextFunction } from "express";

// Extend Express Request type
declare module "express-session" {
  interface SessionData {
    storeId?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.storeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

export function getStoreId(req: Request) {
  return req.session!.storeId as string;
}
