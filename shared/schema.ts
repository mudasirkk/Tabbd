import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * STORES
 * =========================
 * id = Square merchant_id
 */
export const stores = pgTable("stores", {
  id: varchar("id").primaryKey(), // Square merchant_id
  name: text("name").notNull(),    // Business name from Square
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/**
 * MENU ITEMS (store-scoped)
 */
export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
});

/**
 * SQUARE TOKENS (store-scoped)
 */
export const squareTokens = pgTable("square_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  merchantId: text("merchant_id").notNull(), // redundant but useful
});

/**
 * OAUTH CSRF STATES
 * =========================
 * Keyed ONLY by state token
 */
export const oauthStates = pgTable("oauth_states", {
  csrfToken: varchar("csrf_token").primaryKey(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

/**
 * STORE SESSIONS (optional persistence)
 */
export const storeSessions = pgTable("store_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  stationId: varchar("station_id").notNull(),
  stationName: text("station_name").notNull(),
  stationType: text("station_type").notNull(),
  startTime: timestamp("start_time").notNull(),
  pausedTime: timestamp("paused_time"),
  isPaused: text("is_paused").notNull().default("false"),
  items: text("items").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/**
 * INSERT SCHEMAS
 */
export const insertStoreSchema = createInsertSchema(stores).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
});

export const insertSquareTokenSchema = createInsertSchema(squareTokens).omit({
  id: true,
  storeId: true,
});

export const insertOAuthStateSchema = createInsertSchema(oauthStates);

export const insertStoreSessionSchema = createInsertSchema(storeSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * TYPES
 */
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;

export type SquareToken = typeof squareTokens.$inferSelect;
export type InsertSquareToken = z.infer<typeof insertSquareTokenSchema>;

export type OAuthState = typeof oauthStates.$inferSelect;
export type InsertOAuthState = z.infer<typeof insertOAuthStateSchema>;

export type StoreSession = typeof storeSessions.$inferSelect;
export type InsertStoreSession = z.infer<typeof insertStoreSessionSchema>;
