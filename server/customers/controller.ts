import type { Request, Response } from "express";
import { z } from "zod";
import { insertCustomerSchema, updateCustomerSchema } from "@shared/schema";
import { getUserId } from "../middleware/auth";
import { customerService } from "./service";
import { toHttpError } from "./errors";

const applyDiscountBodySchema = z.object({ secondsPlayed: z.coerce.number().min(0) });
const addSecondsBodySchema = z.object({ seconds: z.coerce.number().min(0) });

export async function listCustomers(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const list = await customerService.listCustomers(userId);
    res.json(list);
  } catch (err) {
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message });
  }
}

export async function getCustomer(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const id = req.params.id;
    const customer = await customerService.getCustomerById(userId, id);
    res.json(customer);
  } catch (err) {
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message });
  }
}

export async function createCustomer(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const data = insertCustomerSchema.parse(req.body);
    const created = await customerService.createCustomer(userId, data);
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message });
  }
}

export async function updateCustomer(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const id = req.params.id;
    const patch = updateCustomerSchema.parse(req.body);
    const updated = await customerService.updateCustomer(userId, id, patch);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message });
  }
}

export async function deleteCustomer(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const id = req.params.id;
    await customerService.deleteCustomer(userId, id);
    res.status(204).send();
  } catch (err) {
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message });
  }
}

const checkDiscountQuerySchema = z.object({
  secondsPlayed: z.coerce.number().min(0),
});

export async function checkCustomerDiscount(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const phoneNumber = req.params.phoneNumber;
    const { secondsPlayed } = checkDiscountQuerySchema.parse(req.query);
    const discountAvailable = await customerService.checkDiscount({
      userId,
      phoneNumber,
      secondsPlayed,
    });
    res.json({ discountAvailable });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message });
  }
}

export async function applyCustomerDiscount(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const phoneNumber = req.params.phoneNumber;
    const { secondsPlayed } = applyDiscountBodySchema.parse(req.body);
    const { customer, discountRate } = await customerService.applyDiscount({
      userId,
      phoneNumber,
      secondsPlayed,
    });
    res.json({ customer, discountRate });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message });
  }
}

export async function addCustomerSeconds(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const phoneNumber = req.params.phoneNumber;
    const { seconds } = addSecondsBodySchema.parse(req.body);
    const customer = await customerService.addSeconds(userId, phoneNumber, seconds);
    res.json(customer);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message });
  }
}
