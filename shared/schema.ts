import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, boolean, timestamp, pgEnum, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * USERS
 * id = Firebase uid
 */
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: text("email"),
  storeName: text("store_name"),
  discountThresholdSeconds: integer("discount_threshold_seconds").notNull().default(20 * 3600),
  discountRate: decimal("discount_rate", { precision: 5, scale: 4 }).notNull().default("0.2"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/**
 * MENU ITEMS (user-scoped)
 */
export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("Miscellaneous"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stockQty: integer("stock_qty").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/**
 * STATIONS (user-scoped)
 */
export const stations = pgTable("stations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  stationType: text("station_type").notNull().default("pool"),
  rateSoloHourly: numeric("rate_solo_hourly", { precision: 10, scale: 2 }).notNull().default("0"),
  rateGroupHourly: numeric("rate_group_hourly", { precision: 10, scale: 2 }).notNull().default("0"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const sessionStatusEnum = pgEnum("session_status", ["active", "paused", "closed"]);
export const pricingTierEnum = pgEnum("pricing_tier", ["solo", "group"]);

/**
 * SESSIONS (user-scoped)
 */
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stationId: varchar("station_id").notNull().references(() => stations.id, { onDelete: "cascade" }),
  status: sessionStatusEnum("status").notNull().default("active"),
  startedAt: timestamp("started_at").notNull(),
  pausedAt: timestamp("paused_at"),
  totalPausedSeconds: integer("total_paused_seconds").notNull().default(0),
  closedAt: timestamp("closed_at"),
  pricingTier: pricingTierEnum("pricing_tier").notNull(),
  rateHourlySnapshot: numeric("rate_hourly_snapshot", { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/**
 * SESSION ITEMS (snapshots)
 */
export const sessionItems = pgTable("session_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  menuItemId: varchar("menu_item_id").references(() => menuItems.id, { onDelete: "set null" }),
  nameSnapshot: text("name_snapshot").notNull(),
  priceSnapshot: numeric("price_snapshot", { precision: 10, scale: 2 }).notNull(),
  qty: integer("qty").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

/**
 * CUSTOMERS (user-scoped)
 */
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phoneNumber: text("phone_number").notNull(),
  totalSeconds: integer("total_seconds").notNull().default(0),
  isDiscountAvailable: boolean("is_discount_available").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/**
 * Zod schemas
 */

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const upsertProfileSchema = z.object({
  storeName: z.string().min(1).max(120),
});

/** Body for POST /api/settings: threshold in hours (converted to seconds on server), rate 0–1 */
export const updateDiscountSettingsSchema = z.object({
  discountThresholdHours: z.coerce.number().min(0),
  discountRate: z.coerce.number().min(0).max(1),
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMenuItemSchema = insertMenuItemSchema.partial();

export const insertStationSchema = createInsertSchema(stations).omit({
  id: true,
  userId: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
});

export const updateStationSchema = insertStationSchema.partial();

export const reorderStationsSchema = z.object({
  stationIds: z.array(z.string().min(1)).min(1),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  totalSeconds: z.number().int().min(0).default(0),
});

export const updateCustomerSchema = insertCustomerSchema.partial();

export const startSessionSchema = z.object({
  stationId: z.string().min(1),
  pricingTier: z.enum(["solo", "group"]),
  startedAt: z.string().datetime().optional(),
});

export const addSessionItemSchema = z.object({
  menuItemId: z.string().min(1),
  qty: z.number().int().positive(),
});

export const removeSessionItemSchema = z.object({
  menuItemId: z.string().min(1),
  qty: z.number().int().positive(),
});

export const transferSessionSchema = z.object({
  destinationStationId: z.string().min(1),
});

export const closeSessionSchema = z.object({
  pricingTier: z.enum(["solo", "group"]).optional(),
});

/**
 * TYPES
 */

export type User = typeof users.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Station = typeof stations.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionItem = typeof sessionItems.$inferSelect;
export type Customer = typeof customers.$inferSelect;
