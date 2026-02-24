import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  checkCustomerDiscount,
  applyCustomerDiscount,
  addCustomerSeconds,
} from "./controller";

const router = Router();

router.get("/api/customers", requireAuth, listCustomers);
router.post("/api/customers", requireAuth, createCustomer);
router.get("/api/customers/:id", requireAuth, getCustomer);
router.patch("/api/customers/:id", requireAuth, updateCustomer);
router.delete("/api/customers/:id", requireAuth, deleteCustomer);

router.post("/api/customers/:phoneNumber/seconds", requireAuth, addCustomerSeconds);
router.get("/api/customers/:phoneNumber/discounts/check", requireAuth, checkCustomerDiscount);
router.post("/api/customers/:phoneNumber/discounts/apply", requireAuth, applyCustomerDiscount);

export const customersRouter = router;
