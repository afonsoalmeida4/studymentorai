import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Helper to clean DATABASE_URL - sometimes it contains CLI wrapper like "psql 'url'"
export function getCleanDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || '';
  
  // Remove "psql " prefix if present
  if (url.startsWith("psql ")) {
    url = url.substring(5);
  }
  
  // Remove surrounding quotes
  url = url.replace(/^['"]|['"]$/g, '');
  
  // Validate it looks like a postgres URL
  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    throw new Error(
      `Invalid DATABASE_URL format. Expected postgres:// or postgresql:// URL, got: ${url.substring(0, 20)}...`,
    );
  }
  
  return url;
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const cleanDbUrl = getCleanDatabaseUrl();
export const pool = new Pool({ connectionString: cleanDbUrl });
export const db = drizzle({ client: pool, schema });
