/**
 * Execution routes — bridge between an app idea and an ai-web-team project.
 *
 * Flow:
 *   POST /api/executions        → create execution + project in ai-web-team
 *   GET  /api/executions        → list all executions (enriched with project status)
 *   GET  /api/executions/:id    → single execution detail
 *   POST /api/executions/:id/push → push completed project to GitHub
 */
const express = require("express");
const { randomUUID } = require("node:crypto");
const router = express.Router();

const db = require("../db/database");
const AI_WEB_TEAM = process.env.AI_WEB_TEAM_URL || "http://localhost:3002";

// ── Create execution ──────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const { idea } = req.body;
  if (!idea || !idea._id) {
    return res.status(400).json({ error: "idea object with _id is required" });
  }

  // Check if already executed
  const existing = db.getExecutionByIdeaId(String(idea._id));
  if (existing) {
    return res.status(409).json({ error: "Idea already executed", execution: existing });
  }

  // Build a rich brief from the idea for ai-web-team
  const brief = buildBrief(idea);

  // Create project in ai-web-team
  let project;
  try {
    const r = await fetch(`${AI_WEB_TEAM}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: idea.name,
        brief,
        // Default to OpenAI: ai-web-team's OPENAI_API_KEY is valid, whereas its
        // ANTHROPIC_API_KEY is unset (placeholder) and returns 401. Callers can
        // still override per-request via req.body.provider.
        provider: req.body.provider || "openai",
        model: req.body.model || null,
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      return res.status(502).json({ error: "ai-web-team error", detail: err });
    }
    project = await r.json();
  } catch (e) {
    return res.status(502).json({ error: `ai-web-team unavailable: ${e.message}` });
  }

  // Store mapping in orchestrator DB
  const execution = db.createExecution({
    id: randomUUID().slice(0, 8),
    idea_id: String(idea._id),
    idea_name: idea.name,
    idea_tagline: idea.tagline || "",
    idea_brief: brief,
    idea_complexity: idea.complexity || "",
    idea_category: idea.category || "",
  });

  db.updateExecution(execution.id, { project_id: project.id, status: "running" });

  // Broadcast to SSE clients
  req.app.locals.broadcastSSE({
    type: "execution_started",
    executionId: execution.id,
    ideaName: idea.name,
    projectId: project.id,
  });

  // Kick off the ai-web-team pipeline by opening the upstream WS relay.
  // Without this, ai-web-team only ever creates the project and never runs
  // run_pipeline (which is triggered by a WS connection), so the UI hangs
  // on "Waiting for agent pipeline to start...".
  startPipeline(req, execution.id, project.id);

  res.json({ execution: db.getExecution(execution.id), project });
});

// ── List executions (enriched) ─────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const executions = db.listExecutions();

  // Enrich with live status from ai-web-team
  const enriched = await Promise.all(
    executions.map(async (ex) => {
      if (!ex.project_id) return ex;
      try {
        const r = await fetch(`${AI_WEB_TEAM}/api/projects/${ex.project_id}`);
        if (r.ok) {
          const project = await r.json();
          // Sync status if changed
          if (project.status !== ex.status && project.status) {
            db.updateExecution(ex.id, { status: project.status, github_url: project.github_url || ex.github_url });
          }
          return { ...db.getExecution(ex.id), project };
        }
      } catch (_) {}
      return ex;
    })
  );

  res.json({ executions: enriched });
});

// ── Single execution ───────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const ex = db.getExecution(req.params.id);
  if (!ex) return res.status(404).json({ error: "Not found" });

  let project = null;
  let agents = [];
  if (ex.project_id) {
    try {
      const [pr, ar] = await Promise.all([
        fetch(`${AI_WEB_TEAM}/api/projects/${ex.project_id}`).then(r => r.json()),
        fetch(`${AI_WEB_TEAM}/api/projects/${ex.project_id}/agents`).then(r => r.json()),
      ]);
      project = pr;
      agents = ar.agents || [];
    } catch (_) {}
  }

  res.json({ execution: ex, project, agents });
});

// ── Retry a failed/stuck execution ─────────────────────────────────────────────

router.post("/:id/retry", async (req, res) => {
  const ex = db.getExecution(req.params.id);
  if (!ex) return res.status(404).json({ error: "Not found" });
  if (!ex.project_id) {
    return res.status(400).json({ error: "No ai-web-team project linked yet — re-run the idea instead" });
  }
  if (ex.status === "done" || ex.status === "pushed") {
    return res.status(409).json({ error: `Execution already ${ex.status}; nothing to retry` });
  }

  // Optional provider/model switch for this retry (e.g. move off a rate-limited
  // provider). Persist it on the ai-web-team project so run_pipeline picks it up.
  const { provider, model } = req.body || {};
  if (provider || model) {
    try {
      const r = await fetch(`${AI_WEB_TEAM}/api/projects/${ex.project_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider || null, model: model || null }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: r.statusText }));
        return res.status(502).json({ error: "ai-web-team error updating provider", detail: err });
      }
    } catch (e) {
      return res.status(502).json({ error: `ai-web-team unavailable: ${e.message}` });
    }
  }

  // Reset to running and re-open the upstream relay to (re)start the pipeline.
  db.updateExecution(ex.id, { status: "running" });
  req.app.locals.broadcastSSE({
    type: "execution_started",
    executionId: ex.id,
    ideaName: ex.idea_name,
    projectId: ex.project_id,
  });
  startPipeline(req, ex.id, ex.project_id, { force: true });

  res.json({ execution: db.getExecution(ex.id) });
});

// ── Push to GitHub ─────────────────────────────────────────────────────────────

router.post("/:id/push", async (req, res) => {
  const ex = db.getExecution(req.params.id);
  if (!ex) return res.status(404).json({ error: "Not found" });
  if (!ex.project_id) return res.status(400).json({ error: "No project linked yet" });

  try {
    const r = await fetch(`${AI_WEB_TEAM}/api/projects/${ex.project_id}/push`, { method: "POST" });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      return res.status(r.status).json(err);
    }
    const result = await r.json();
    db.updateExecution(ex.id, { github_url: result.github_url, status: "pushed" });

    req.app.locals.broadcastSSE({
      type: "execution_pushed",
      executionId: ex.id,
      ideaName: ex.idea_name,
      github_url: result.github_url,
    });

    res.json({ ...result, execution: db.getExecution(ex.id) });
  } catch (e) {
    res.status(502).json({ error: `ai-web-team unavailable: ${e.message}` });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Open the upstream WS relay to ai-web-team, which triggers run_pipeline.
 * Marks the execution as "error" if the upstream connection fails so the
 * UI stops showing an indefinite "pending"/"running" state.
 */
function startPipeline(req, executionId, projectId, { force = false } = {}) {
  req.app.locals.watchExecution(executionId, projectId, {
    force,
    onError: (msg) => {
      db.updateExecution(executionId, { status: "error" });
      req.app.locals.broadcastSSE({
        type: "execution_error",
        executionId,
        detail: msg || "Pipeline connection failed",
      });
    },
  });
}

function buildBrief(idea) {
  return `# ${idea.name}

**Tagline:** ${idea.tagline}

## Description
${idea.description}

## Key Features
${(idea.keyFeatures || []).map(f => `- ${f}`).join("\n")}

## Tech Stack
${(idea.techStack || []).join(", ")}

## Third-Party APIs
${(idea.thirdPartyAPIs || []).join(", ") || "None"}

## Monetization
${idea.monetizationStrategy}

## Target Platforms
${(idea.targetPlatforms || []).join(", ")}

## Complexity
${idea.complexity} — ${idea.complexityRationale}

## Time to MVP
${idea.timeToMVP}

---

## Developer Brief
${idea.buildPrompt || "Build the MVP described above."}`;
}

module.exports = router;
