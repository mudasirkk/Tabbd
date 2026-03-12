import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { listMenu, createMenuItem, updateMenuItem, deleteMenuItem } from "./controller";

const router = Router();

router.get("/api/menu", requireAuth, listMenu);
router.post("/api/menu", requireAuth, createMenuItem);
router.patch("/api/menu/:id", requireAuth, updateMenuItem);
router.delete("/api/menu/:id", requireAuth, deleteMenuItem);

export const menuRouter = router;
