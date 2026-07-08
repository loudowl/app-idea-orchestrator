require("dotenv").config();
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || "./data/orchestrator.db";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS executions (
    id          TEXT PRIMARY KEY,
    idea_id     TEXT NOT NULL,
    idea_name   TEXT NOT NULL,
    idea_tagline TEXT,
    idea_brief  TEXT NOT NULL,
    idea_complexity TEXT,
    idea_category   TEXT,
    project_id  TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    github_url  TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
`);

// ── Executions ────────────────────────────────────────────────────────────────

function createExecution({ id, idea_id, idea_name, idea_tagline, idea_brief, idea_complexity, idea_category }) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO executions (id, idea_id, idea_name, idea_tagline, idea_brief, idea_complexity, idea_category, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, idea_id, idea_name, idea_tagline, idea_brief, idea_complexity, idea_category, now, now);
  return getExecution(id);
}

function getExecution(id) {
  return db.prepare("SELECT * FROM executions WHERE id = ?").get(id);
}

function listExecutions() {
  return db.prepare("SELECT * FROM executions ORDER BY created_at DESC").all();
}

function updateExecution(id, fields) {
  fields.updated_at = new Date().toISOString();
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(", ");
  const vals = [...Object.values(fields), id];
  db.prepare(`UPDATE executions SET ${sets} WHERE id = ?`).run(...vals);
  return getExecution(id);
}

function getExecutionByIdeaId(ideaId) {
  return db.prepare("SELECT * FROM executions WHERE idea_id = ?").get(ideaId);
}

module.exports = { createExecution, getExecution, listExecutions, updateExecution, getExecutionByIdeaId };
