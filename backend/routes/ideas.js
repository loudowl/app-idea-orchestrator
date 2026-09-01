/**
 * Proxy routes for app-idea-agent's ideas & runs API.
 * Also handles "force run" trigger.
 */
const express = require("express");
const { Readable } = require("node:stream");
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

// ── Agent progress SSE proxy ──────────────────────────────────────────────────

// GET /api/agent/stream — proxy the app-idea-agent SSE stream directly to the caller
router.get("/agent/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let upstreamRes;
  try {
    upstreamRes = await fetch(`${IDEA_AGENT}/api/agent/stream`);
  } catch (e) {
    res.write(`data: {"type":"error","message":"app-idea-agent unavailable"}\n\n`);
    res.end();
    return;
  }

  // Global fetch (undici) exposes a WHATWG ReadableStream, not a Node stream,
  // so adapt it before piping the SSE bytes straight to the caller.
  const nodeStream = Readable.fromWeb(upstreamRes.body);
  nodeStream.pipe(res);
  req.on("close", () => {
    if (!nodeStream.destroyed) nodeStream.destroy();
  });
});

// ── Agent model settings proxy ────────────────────────────────────────────────

// GET /api/agent/settings — resolve effective per-step config + catalog metadata
router.get("/agent/settings", (req, res) => proxy(res, "/api/settings"));

// PUT /api/agent/settings — persist preset + per-step overrides
router.put("/agent/settings", async (req, res) => {
  try {
    const r = await fetch(`${IDEA_AGENT}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: `app-idea-agent unavailable: ${e.message}` });
  }
});

// GET /api/agent/catalog — model catalog + presets + step metadata + effort levels
router.get("/agent/catalog", (req, res) => proxy(res, "/api/models"));

module.exports = router;
