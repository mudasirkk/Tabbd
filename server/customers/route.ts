import { Router } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { checkCustomerDiscounts, applyCustomerDiscounts } from "./controller";

const router = Router();

router.get(
    "/api/customers/:phoneNumber/discounts/check",
    requireAuth,
    checkCustomerDiscounts
);

router.get(
    "/api/customers/:phoneNumber/discounts/apply",
    requireAuth,
    applyCustomerDiscounts
)

export const customersRouter = router;