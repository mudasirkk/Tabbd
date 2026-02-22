import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  addSessionItem,
  closeSession,
  getSessionHistory,
  pauseSession,
  removeSessionItem,
  resumeSession,
  startSession,
  transferSession,
} from "./controller";

const router = Router();

router.post("/api/sessions/start", requireAuth, startSession);
router.post("/api/sessions/:id/pause", requireAuth, pauseSession);
router.post("/api/sessions/:id/resume", requireAuth, resumeSession);
router.post("/api/sessions/:id/close", requireAuth, closeSession);
router.post("/api/sessions/:id/transfer", requireAuth, transferSession);
router.post("/api/sessions/:id/items", requireAuth, addSessionItem);
router.post("/api/sessions/:id/items/remove", requireAuth, removeSessionItem);
router.get("/api/sessions/history", requireAuth, getSessionHistory);

export const sessionsRouter = router;
