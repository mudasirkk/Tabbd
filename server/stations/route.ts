import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  createStation,
  deleteStation,
  listStations,
  reorderStations,
  updateStation,
} from "./controller";

const router = Router();

router.get("/api/stations", requireAuth, listStations);
router.post("/api/stations", requireAuth, createStation);
router.patch("/api/stations/reorder", requireAuth, reorderStations);
router.patch("/api/stations/:id", requireAuth, updateStation);
router.delete("/api/stations/:id", requireAuth, deleteStation);

export const stationsRouter = router;
