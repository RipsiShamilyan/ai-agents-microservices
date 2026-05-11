import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:3002";
const AUDIT_URL = process.env.AUDIT_URL || "http://127.0.0.1:3003";
const RUNNER_TIMEOUT_MS = Number(process.env.RUNNER_TIMEOUT_MS || 130000);

async function audit(event: any) {
  try {
    await fetch(`${AUDIT_URL}/audit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...event, timestamp: new Date().toISOString() })
    });
  } catch {}
}

app.get("/health", async () => ({ ok: true, service: "financial-risk-service" }));

app.post("/analyze", async (req, reply) => {
  const { traceId, input } = (req.body as any) || {};
  if (!traceId || !input) {
    return reply.status(400).send({ ok: false, error: "traceId and input are required" });
  }

  const started = Date.now();

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), RUNNER_TIMEOUT_MS);

    const runnerRes = await fetch(`${RUNNER_URL}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        traceId,
        agent: "financial-risk",
        input
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(t));

    const runnerBody = await runnerRes.json();
    const latencyMs = Date.now() - started;

    await audit({
      traceId,
      service: "financial-risk-service",
      endpoint: "POST /analyze",
      status: runnerRes.status,
      latencyMs,
      request: input,
      response: runnerBody
    });

    return reply.status(runnerRes.status).send({
      ok: runnerRes.ok,
      traceId,
      latencyMs,
      runnerStatus: runnerRes.status,
      runnerBody
    });
  } catch (err: any) {
    const latencyMs = Date.now() - started;

    await audit({
      traceId,
      service: "financial-risk-service",
      endpoint: "POST /analyze",
      status: 504,
      latencyMs,
      request: input,
      response: { error: "Runner timeout or network error", details: String(err?.message || err) }
    });

    return reply.status(504).send({
      ok: false,
      traceId,
      latencyMs,
      runnerStatus: 504,
      runnerBody: JSON.stringify({
        ok: false,
        traceId,
        error: "Runner timeout or network error",
        latencyMs,
        details: String(err?.message || err)
      })
    });
  }
});

// app.listen({ port: 3012, host: "127.0.0.1" });

app.listen({
  port: Number(process.env.PORT) || 3012,
  host: "0.0.0.0"
});
