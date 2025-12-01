// Reference: blueprint:javascript_database
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[DB] DATABASE_URL value:", url === undefined ? 'undefined' : url === '' ? 'empty string' : 'has value');
    console.log("[DB] DATABASE_URL typeof:", typeof process.env.DATABASE_URL);
    console.log("[DB] All DB-related env vars:");
    Object.keys(process.env).filter(k => k.includes('PG') || k.includes('DATABASE')).forEach(k => {
      const val = process.env[k];
      console.log(`  ${k}: ${val === undefined ? 'undefined' : val === '' ? 'empty' : 'has value (len=' + val.length + ')'}`);
    });
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return url;
}

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: getDatabaseUrl() });
  }
  return _pool;
}

export function getDb() {
  if (!_db) {
    _db = drizzle({ client: getPool(), schema });
  }
  return _db;
}

export const pool = new Proxy({} as Pool, {
  get(_, prop) {
    return (getPool() as any)[prop];
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  }
});
