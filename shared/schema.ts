import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Stores table - uses Firebase UID as primary identifier
export const stores = pgTable("stores", {
  id: varchar("id").primaryKey(), // Firebase UID
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatar: text("avatar"), // Profile picture URL from Firebase
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Menu items - store-scoped
export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
});

// Square tokens - store-scoped
export const squareTokens = pgTable("square_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  merchantId: text("merchant_id").notNull(),
});

// OAuth states - can be removed if not needed, but keeping for Square OAuth
export const oauthStates = pgTable("oauth_states", {
  state: varchar("state").primaryKey(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Store sessions - for persistent session storage (optional, if you want DB persistence)
export const storeSessions = pgTable("store_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
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

// Schemas
export const insertStoreSchema = createInsertSchema(stores).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
});

export const insertSquareTokenSchema = createInsertSchema(squareTokens).omit({
  id: true,
  storeId: true, // Add this - storeId is passed separately to saveSquareToken
});

export const insertOAuthStateSchema = createInsertSchema(oauthStates);
export const insertStoreSessionSchema = createInsertSchema(storeSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
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
