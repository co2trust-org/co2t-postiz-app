import { PostgresStore } from '@mastra/pg';
import { Pool } from 'pg';

const MASTRA_STORAGE_POOL_MAX = Number(process.env.MASTRA_STORAGE_POOL_MAX || 4);
const MASTRA_STORAGE_IDLE_TIMEOUT_MS = Number(
  process.env.MASTRA_STORAGE_IDLE_TIMEOUT_MS || 10000
);
const MASTRA_STORAGE_CONNECTION_TIMEOUT_MS = Number(
  process.env.MASTRA_STORAGE_CONNECTION_TIMEOUT_MS || 5000
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: MASTRA_STORAGE_POOL_MAX,
  idleTimeoutMillis: MASTRA_STORAGE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: MASTRA_STORAGE_CONNECTION_TIMEOUT_MS,
});

export const pStore = new PostgresStore({
  id: 'postiz-store',
  pool,
});
