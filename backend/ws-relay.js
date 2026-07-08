/**
 * WebSocket relay: connects to ai-web-team's WS for a given project
 * and fans out events to all dashboard clients watching that execution.
 *
 * Usage:
 *   const relay = require('./ws-relay');
 *   relay.attach(httpServer);
 *   relay.watch(executionId, projectId);  // called when an execution starts
 */
const { WebSocketServer, WebSocket } = require("ws");

const AI_WEB_TEAM_WS = (process.env.AI_WEB_TEAM_URL || "http://localhost:3002")
  .replace(/^http/, "ws");

// executionId → Set<WebSocket> (dashboard clients)
const dashboardClients = new Map();

// executionId → upstream WebSocket (ai-web-team)
const upstreamSockets = new Map();

let broadcastSSE = () => {};

function attach(server, broadcastSSEFn) {
  broadcastSSE = broadcastSSEFn;

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    // Expect URL: /ws?executionId=xxx
    const url = new URL(req.url, "http://localhost");
    const executionId = url.searchParams.get("executionId");
    if (!executionId) {
      ws.close(1008, "executionId required");
      return;
    }

    if (!dashboardClients.has(executionId)) {
      dashboardClients.set(executionId, new Set());
    }
    dashboardClients.get(executionId).add(ws);

    ws.on("close", () => {
      dashboardClients.get(executionId)?.delete(ws);
    });
  });
}

/**
 * Open an upstream connection to ai-web-team for this project and relay
 * all events to dashboard clients.
 */
function watch(executionId, projectId, hooks = {}) {
  const { force = false, onError } = hooks;

  if (upstreamSockets.has(executionId)) {
    if (!force) return; // already watching
    // Force a fresh connection (e.g. on retry): drop the stale one first.
    try { upstreamSockets.get(executionId).close(); } catch (_) {}
    upstreamSockets.delete(executionId);
  }

  const upstreamUrl = `${AI_WEB_TEAM_WS}/ws/${projectId}`;
  console.log(`[ws-relay] Connecting upstream: ${upstreamUrl}`);

  let settled = false; // guard so we report a terminal state only once

  const upstream = new WebSocket(upstreamUrl);
  upstreamSockets.set(executionId, upstream);

  upstream.on("message", (raw) => {
    const msg = raw.toString();
    let parsed;
    try { parsed = JSON.parse(msg); } catch (_) { parsed = { type: "raw", data: msg }; }

    // Fan out to all dashboard clients watching this execution
    const clients = dashboardClients.get(executionId) || new Set();
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ executionId, ...parsed }));
      }
    }

    // On pipeline_done, broadcast SSE notification
    if (parsed.type === "pipeline_done") {
      settled = true;
      broadcastSSE({ type: "execution_done", executionId });
      upstream.close();
      upstreamSockets.delete(executionId);
    }

    // An agent-level failure terminates the pipeline upstream.
    if (parsed.type === "error") {
      settled = true;
      if (onError) onError(parsed.data);
      upstreamSockets.delete(executionId);
    }
  });

  upstream.on("error", (e) => {
    console.error(`[ws-relay] Upstream error for ${executionId}:`, e.message);
    upstreamSockets.delete(executionId);
    if (!settled) {
      settled = true;
      if (onError) onError(e.message);
    }
  });

  upstream.on("close", () => {
    upstreamSockets.delete(executionId);
    // Closed before any terminal event → treat as a failed/stuck pipeline.
    if (!settled) {
      settled = true;
      if (onError) onError("Upstream pipeline closed before completing");
    }
  });
}

module.exports = { attach, watch };
