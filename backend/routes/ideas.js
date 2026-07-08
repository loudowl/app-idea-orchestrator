/**
 * Proxy routes for app-idea-agent's ideas & runs API.
 * Also handles "force run" trigger.
 */
const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

const IDEA_AGENT = process.env.IDEA_AGENT_URL || "http://localhost:3001";

// ── Forward helpers ────────────────────────────────────────────────────────────

async function proxy(res, path, opts = {}) {
  try {
    const r = await fetch(`${IDEA_AGENT}${path}`, opts);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: `app-idea-agent unavailable: ${e.message}` });
  }
}

// GET /api/ideas
router.get("/ideas", (req, res) => {
  const q = new URLSearchParams(req.query).toString();
  proxy(res, `/api/ideas${q ? "?" + q : ""}`);
});

// GET /api/ideas/stats
router.get("/ideas/stats", (req, res) => proxy(res, "/api/ideas/stats"));

// GET /api/ideas/:id
router.get("/ideas/:id", (req, res) => proxy(res, `/api/ideas/${req.params.id}`));

// GET /api/categories
router.get("/categories", (req, res) => proxy(res, "/api/categories"));

// GET /api/runs
router.get("/runs", (req, res) => proxy(res, "/api/runs"));

// POST /api/force-run  — trigger an immediate agent cycle
router.post("/force-run", async (req, res) => {
  try {
    const r = await fetch(`${IDEA_AGENT}/api/agent/run`, { method: "POST" });
    const data = await r.json();
    // Broadcast to SSE clients
    req.app.locals.broadcastSSE({ type: "force_run_started", ...data });
    res.json({ message: "Force run triggered", ...data });
  } catch (e) {
    res.status(502).json({ error: `app-idea-agent unavailable: ${e.message}` });
  }
});

module.exports = router;
