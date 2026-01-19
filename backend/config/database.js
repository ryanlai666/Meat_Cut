import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get database path from environment or use default
const DB_PATH = process.env.DB_PATH || join(__dirname, '../data/meat_cuts.db');

// Ensure data directory exists

const dataDir = join(__dirname, '../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Initialize database connection
let db = null;

export function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initializeDatabase() {
  const database = getDatabase();
  
  // Read and execute initialization SQL
  const initSqlPath = join(__dirname, '../migrations/init.sql');
  
  if (!existsSync(initSqlPath)) {
    throw new Error(`Database initialization SQL file not found at: ${initSqlPath}`);
  }
  
  const initSql = readFileSync(initSqlPath, 'utf-8');
  database.exec(initSql);
  
  console.log('Database initialized successfully');
  return database;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDatabase;
