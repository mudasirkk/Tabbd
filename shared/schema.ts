import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
});

export const squareTokens = pgTable("square_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  merchantId: text("merchant_id").notNull(),
});

export const oauthStates = pgTable("oauth_states", {
  state: varchar("state").primaryKey(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
});

export const insertSquareTokenSchema = createInsertSchema(squareTokens).omit({
  id: true,
});

export const insertOAuthStateSchema = createInsertSchema(oauthStates);

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type SquareToken = typeof squareTokens.$inferSelect;
export type InsertSquareToken = z.infer<typeof insertSquareTokenSchema>;
export type OAuthState = typeof oauthStates.$inferSelect;
export type InsertOAuthState = z.infer<typeof insertOAuthStateSchema>;
