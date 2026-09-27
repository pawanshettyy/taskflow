const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const isVercel = process.env.VERCEL === '1';
const databasePath = process.env.DATABASE_PATH || (isVercel ? '/tmp/taskflow.sqlite' : path.join(__dirname, '../../data/taskflow.sqlite'));
const dataDirectory = path.dirname(databasePath);
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(user_id, due_date);
`);

try {
  db.exec('ALTER TABLE sessions ADD COLUMN csrf_token TEXT');
} catch (error) {
  if (!String(error.message).includes('duplicate column name')) throw error;
}

db.exec("UPDATE sessions SET csrf_token = lower(hex(randomblob(32))) WHERE csrf_token IS NULL");

module.exports = db;