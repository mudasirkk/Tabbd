import { Request, Response } from "express";
import { customer } from "./service";;
import { getUserId } from "server/middleware/auth";

export async function checkCustomerDiscounts(
  req: Request,
  res: Response
) {
    try {
        const totalPrice = await customer.checkDiscount({
            storeId: getUserId(req),
            phoneNumber: req.params.phoneNumber,
            hoursPlayed: req.body.hoursPlayed,
        });
        res.json({ totalPrice });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to get total price" });
    }
}


export async function applyCustomerDiscounts(
  req: Request,
  res: Response
) {
  try {
    await customer.applyDiscount({
      storeId: getUserId(req),
      phoneNumber: req.params.phoneNumber,
      hoursPlayed: req.body.hoursPlayed,
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to apply discount" });
  }
}