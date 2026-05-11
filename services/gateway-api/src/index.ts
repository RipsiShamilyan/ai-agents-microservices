// import Fastify from "fastify";
// import cors from "@fastify/cors";

// const app = Fastify({ logger: true });
// await app.register(cors, { origin: true });

// const AUDIT_URL = process.env.AUDIT_URL || "http://127.0.0.1:3003";
// const CREDIT_URL = process.env.CREDIT_URL || "http://127.0.0.1:3011";
// const FINANCIAL_URL = process.env.FINANCIAL_URL || "http://127.0.0.1:3012";
// const FRAUD_URL = process.env.FRAUD_URL || "http://127.0.0.1:3013";

// function newTraceId() {
//   return "tr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
// }

// async function audit(event: unknown) {
//   try {
//     await fetch(`${AUDIT_URL}/audit`, {
//       method: "POST",
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify(event)
//     });
//   } catch {
//     // audit fail-ը չպետք է կոտրի հիմնական հոսքը
//   }
// }

// app.get("/health", async () => ({ ok: true, service: "gateway-api" }));

// // Credit Risk
// app.post("/api/credit-risk/assess", async (req, reply) => {
//   const traceId = newTraceId();
//   const started = Date.now();

//   const input = req.body && typeof req.body === "object" ? req.body : {};

//   const creditRes = await fetch(`${CREDIT_URL}/assess`, {
//     method: "POST",
//     headers: { "content-type": "application/json" },
//     body: JSON.stringify({ traceId, input })
//   });

//   const latencyMs = Date.now() - started;

//   const creditBody = await creditRes.json().catch(async () => {
//     const fallback = await creditRes.text();
//     return { ok: false, error: "Non-JSON response from credit service", raw: fallback };
//   });

//   await audit({
//     traceId,
//     service: "gateway-api",
//     endpoint: "/api/credit-risk/assess",
//     status: creditRes.status,
//     latencyMs,
//     request: input,
//     response: creditBody
//   });

//   reply.status(creditRes.status).send({
//     traceId,
//     latencyMs,
//     creditStatus: creditRes.status,
//     creditBody
//   });
// });

// // Financial Risk
// app.post("/api/financial-risk/analyze", async (req, reply) => {
//   const traceId = newTraceId();
//   const started = Date.now();

//   const input = req.body && typeof req.body === "object" ? req.body : {};

//   const res = await fetch(`${FINANCIAL_URL}/analyze`, {
//     method: "POST",
//     headers: { "content-type": "application/json" },
//     body: JSON.stringify({ traceId, input })
//   });

//   const latencyMs = Date.now() - started;

//   const financialBody = await res.json().catch(async () => {
//     const fallback = await res.text();
//     return { ok: false, error: "Non-JSON response from financial service", raw: fallback };
//   });

//   await audit({
//     traceId,
//     service: "gateway-api",
//     endpoint: "/api/financial-risk/analyze",
//     status: res.status,
//     latencyMs,
//     request: input,
//     response: financialBody
//   });

//   reply.status(res.status).send({
//     traceId,
//     latencyMs,
//     financialStatus: res.status,
//     financialBody
//   });
// });

// // Fraud Detection
// app.post("/api/fraud-detection/check", async (req, reply) => {
//   const traceId = newTraceId();
//   const started = Date.now();

//   const input = req.body && typeof req.body === "object" ? req.body : {};

//   const res = await fetch(`${FRAUD_URL}/check`, {
//     method: "POST",
//     headers: { "content-type": "application/json" },
//     body: JSON.stringify({ traceId, input })
//   });

//   const latencyMs = Date.now() - started;

//   const fraudBody = await res.json().catch(async () => {
//     const fallback = await res.text();
//     return { ok: false, error: "Non-JSON response from fraud service", raw: fallback };
//   });

//   await audit({
//     traceId,
//     service: "gateway-api",
//     endpoint: "/api/fraud-detection/check",
//     status: res.status,
//     latencyMs,
//     request: input,
//     response: fraudBody
//   });

//   reply.status(res.status).send({
//     traceId,
//     latencyMs,
//     fraudStatus: res.status,
//     fraudBody
//   });
// });

// // ✅ UI-ի համար audit proxy (with filters)
// app.get("/api/audit", async (req, reply) => {
//   const qs = new URLSearchParams();

//   const q: any = req.query || {};
//   for (const [k, v] of Object.entries(q)) {
//     if (v == null) continue;
//     qs.set(k, String(v));
//   }

//   const url = qs.toString() ? `${AUDIT_URL}/audit?${qs.toString()}` : `${AUDIT_URL}/audit`;

//   const res = await fetch(url);
//   const body = await res.json().catch(async () => {
//     const fallback = await res.text();
//     return { ok: false, error: "Non-JSON response from audit service", raw: fallback };
//   });

//   reply.status(res.status).send(body);
// });

// // ✅ Clear audit proxy
// app.delete("/api/audit", async (_req, reply) => {
//   const res = await fetch(`${AUDIT_URL}/audit`, { method: "DELETE" });
//   const body = await res.json().catch(async () => {
//     const fallback = await res.text();
//     return { ok: false, error: "Non-JSON response from audit service", raw: fallback };
//   });
//   reply.status(res.status).send(body);
// });

// app.listen({ port: 3000, host: "127.0.0.1" });


import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const AUDIT_URL = process.env.AUDIT_URL || "http://127.0.0.1:3003";
const CREDIT_URL = process.env.CREDIT_URL || "http://127.0.0.1:3011";
const FINANCIAL_URL = process.env.FINANCIAL_URL || "http://127.0.0.1:3012";
const FRAUD_URL = process.env.FRAUD_URL || "http://127.0.0.1:3013";

function newTraceId() {
  return "tr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

async function audit(event: unknown) {
  try {
    await fetch(`${AUDIT_URL}/audit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event)
    });
  } catch {
    // audit fail must not break main flow
  }
}

app.get("/health", async () => ({ ok: true, service: "gateway-api" }));

// Credit Risk
app.post("/api/credit-risk/assess", async (req, reply) => {
  const traceId = newTraceId();
  const started = Date.now();

  const input = req.body && typeof req.body === "object" ? req.body : {};

  const creditRes = await fetch(`${CREDIT_URL}/assess`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ traceId, input })
  });

  const latencyMs = Date.now() - started;

  const creditBody = await creditRes.json().catch(async () => {
    const fallback = await creditRes.text();
    return { ok: false, error: "Non-JSON response from credit service", raw: fallback };
  });

  await audit({
    traceId,
    service: "gateway-api",
    endpoint: "/api/credit-risk/assess",
    status: creditRes.status,
    latencyMs,
    request: input,
    response: creditBody
  });

  reply.status(creditRes.status).send({
    traceId,
    latencyMs,
    creditStatus: creditRes.status,
    creditBody
  });
});

// Financial Risk
app.post("/api/financial-risk/analyze", async (req, reply) => {
  const traceId = newTraceId();
  const started = Date.now();

  const input = req.body && typeof req.body === "object" ? req.body : {};

  const res = await fetch(`${FINANCIAL_URL}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ traceId, input })
  });

  const latencyMs = Date.now() - started;

  const financialBody = await res.json().catch(async () => {
    const fallback = await res.text();
    return { ok: false, error: "Non-JSON response from financial service", raw: fallback };
  });

  await audit({
    traceId,
    service: "gateway-api",
    endpoint: "/api/financial-risk/analyze",
    status: res.status,
    latencyMs,
    request: input,
    response: financialBody
  });

  reply.status(res.status).send({
    traceId,
    latencyMs,
    financialStatus: res.status,
    financialBody
  });
});

// Fraud Detection
app.post("/api/fraud-detection/check", async (req, reply) => {
  const traceId = newTraceId();
  const started = Date.now();

  const input = req.body && typeof req.body === "object" ? req.body : {};

  const res = await fetch(`${FRAUD_URL}/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ traceId, input })
  });

  const latencyMs = Date.now() - started;

  const fraudBody = await res.json().catch(async () => {
    const fallback = await res.text();
    return { ok: false, error: "Non-JSON response from fraud service", raw: fallback };
  });

  await audit({
    traceId,
    service: "gateway-api",
    endpoint: "/api/fraud-detection/check",
    status: res.status,
    latencyMs,
    request: input,
    response: fraudBody
  });

  reply.status(res.status).send({
    traceId,
    latencyMs,
    fraudStatus: res.status,
    fraudBody
  });
});

/**
 * ✅ Audit proxy with query passthrough:
 * /api/audit?limit=50&offset=0&q=...&service=...&status=...
 */
app.get("/api/audit", async (req, reply) => {
  const q = req.query as any;
  const params = new URLSearchParams();

  for (const k of ["limit", "offset", "q", "service", "endpoint", "status", "traceId"]) {
    if (q?.[k] != null && String(q[k]).trim() !== "") params.set(k, String(q[k]));
  }

  const url = `${AUDIT_URL}/audit${params.toString() ? `?${params.toString()}` : ""}`;

  const res = await fetch(url);
  const body = await res.json().catch(async () => {
    const fallback = await res.text();
    return { ok: false, error: "Non-JSON response from audit service", raw: fallback };
  });

  reply.status(res.status).send(body);
});

/** ✅ Clear Audit proxy */
app.delete("/api/audit", async (_req, reply) => {
  const res = await fetch(`${AUDIT_URL}/audit`, { method: "DELETE" });
  const body = await res.json().catch(async () => {
    const fallback = await res.text();
    return { ok: false, error: "Non-JSON response from audit service", raw: fallback };
  });
  reply.status(res.status).send(body);
});

app.listen({ port: 3000, host: "127.0.0.1" });





