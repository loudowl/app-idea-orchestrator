require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const fetch = require("node-fetch");

const ideasRouter = require("./routes/ideas");
const executionsRouter = require("./routes/executions");
const wsRelay = require("./ws-relay");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3003;
const AI_WEB_TEAM = process.env.AI_WEB_TEAM_URL || "http://localhost:3002";

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Server-Sent Events (SSE) for global notifications ────────────────────────
const sseClients = new Set();

function broadcastSSE(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch (_) { sseClients.delete(client); }
  }
}

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sseClients.add(res);

  // Heartbeat every 20s to keep connection alive
  const hb = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch (_) {}
  }, 20_000);

  req.on("close", () => {
    clearInterval(hb);
    sseClients.delete(res);
  });
});

// Expose broadcastSSE to routes via app.locals
app.locals.broadcastSSE = broadcastSSE;

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/api", ideasRouter);
app.use("/api/executions", executionsRouter);

// Proxy ai-web-team's model/provider availability (OpenAI, Anthropic, Ollama)
// so the web UI can show which providers are usable and list installed Ollama models.
app.get("/api/models", async (req, res) => {
  try {
    const r = await fetch(`${AI_WEB_TEAM}/api/models`);
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: `ai-web-team unavailable: ${e.message}` });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    services: {
      idea_agent: process.env.IDEA_AGENT_URL || "http://localhost:3001",
      ai_web_team: process.env.AI_WEB_TEAM_URL || "http://localhost:3002",
    },
  });
});

// ── WebSocket relay ────────────────────────────────────────────────────────────
wsRelay.attach(server, broadcastSSE);

// Expose the relay's watch() so the executions route can open the upstream
// ai-web-team WS (which is what actually starts the agent pipeline) right
// after creating an execution. See routes/executions.js → startPipeline().
app.locals.watchExecution = wsRelay.watch;

// ── Start ──────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 App Idea Orchestrator running at http://localhost:${PORT}`);
  console.log(`   → app-idea-agent:  ${process.env.IDEA_AGENT_URL || "http://localhost:3001"}`);
  console.log(`   → ai-web-team:     ${process.env.AI_WEB_TEAM_URL || "http://localhost:3002"}`);
  console.log(`   → SSE stream:      http://localhost:${PORT}/api/events`);
  console.log(`   → WS relay:        ws://localhost:${PORT}/ws?executionId=<id>\n`);
});
