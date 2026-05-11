// import Fastify from "fastify";
// import cors from "@fastify/cors";

// const app = Fastify({ logger: true });
// await app.register(cors, { origin: true });

// type AuditEvent = {
//   traceId: string;
//   service: string;
//   endpoint: string;
//   status: number;
//   latencyMs: number;
//   request?: unknown;
//   response?: unknown;
//   timestamp?: string;
// };

// const events: AuditEvent[] = []; // memory (հետո կարող է լինել SQLite)

// app.get("/health", async () => ({ ok: true, service: "audit-logging" }));

// app.post<{ Body: AuditEvent }>("/audit", async (req, reply) => {
//   const e = req.body;
//   if (!e?.traceId || !e?.service || !e?.endpoint) {
//     return reply.status(400).send({ ok: false, error: "traceId, service, endpoint required" });
//   }
//   events.push({ ...e, timestamp: e.timestamp || new Date().toISOString() });
//   return { ok: true };
// });

// /**
//  * GET /audit?service=gateway-api&status=200&q=credit&limit=50
//  * status can be: "200" | "4xx" | "5xx"
//  */
// app.get<{
//   Querystring: { service?: string; status?: string; q?: string; limit?: string };
// }>("/audit", async (req) => {
//   const { service, status, q, limit } = req.query || {};

//   const limRaw = Number(limit ?? 50);
//   const lim = Number.isFinite(limRaw) ? Math.max(1, Math.min(200, limRaw)) : 50;

//   // newest first
//   let list = [...events].reverse();

//   if (service && service !== "all") {
//     list = list.filter((e) => e.service === service);
//   }

//   if (status && status !== "all") {
//     if (status === "4xx") list = list.filter((e) => e.status >= 400 && e.status < 500);
//     else if (status === "5xx") list = list.filter((e) => e.status >= 500 && e.status < 600);
//     else {
//       const s = Number(status);
//       if (Number.isFinite(s)) list = list.filter((e) => e.status === s);
//     }
//   }

//   if (q && q.trim().length > 0) {
//     const needle = q.trim().toLowerCase();

//     list = list.filter((e) => {
//       const parts: string[] = [];
//       parts.push(e.traceId ?? "");
//       parts.push(e.service ?? "");
//       parts.push(e.endpoint ?? "");

//       try {
//         parts.push(JSON.stringify(e.request ?? ""));
//       } catch {}
//       try {
//         parts.push(JSON.stringify(e.response ?? ""));
//       } catch {}

//       const hay = parts.join(" ").toLowerCase();
//       return hay.includes(needle);
//     });
//   }

//   const sliced = list.slice(0, lim);

//   return { ok: true, count: sliced.length, total: list.length, events: sliced };
// });

// // ✅ Clear audit memory
// app.delete("/audit", async () => {
//   const cleared = events.length;
//   events.length = 0;
//   return { ok: true, cleared };
// });

// app.listen({ port: 3003, host: "127.0.0.1" });


import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

type AuditEvent = {
  traceId: string;
  service: string;
  endpoint: string;
  status: number;
  latencyMs: number;
  request?: unknown;
  response?: unknown;
  timestamp?: string;
};

const events: AuditEvent[] = []; // memory (հետո կարող է SQLite)

app.get("/health", async () => ({ ok: true, service: "audit-logging" }));

app.post<{ Body: AuditEvent }>("/audit", async (req, reply) => {
  const e = req.body;
  if (!e?.traceId || !e?.service || !e?.endpoint) {
    return reply.status(400).send({ ok: false, error: "traceId, service, endpoint required" });
  }
  events.push({ ...e, timestamp: e.timestamp || new Date().toISOString() });
  return { ok: true };
});

/**
 * GET /audit?limit=50&offset=0&q=...&service=...&status=200&traceId=...
 * returns filtered + paginated results (newest first)
 */
app.get("/audit", async (req) => {
  const q = String((req.query as any)?.q ?? "").trim().toLowerCase();
  const service = String((req.query as any)?.service ?? "").trim();
  const endpoint = String((req.query as any)?.endpoint ?? "").trim();
  const traceId = String((req.query as any)?.traceId ?? "").trim();
  const statusStr = String((req.query as any)?.status ?? "").trim();

  const limitRaw = Number((req.query as any)?.limit ?? 50);
  const offsetRaw = Number((req.query as any)?.offset ?? 0);

  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  const status = statusStr ? Number(statusStr) : null;

  // newest first
  const allNewestFirst = [...events].reverse();

  const filtered = allNewestFirst.filter((e) => {
    if (service && e.service !== service) return false;
    if (endpoint && e.endpoint !== endpoint) return false;
    if (traceId && e.traceId !== traceId) return false;
    if (status != null && Number.isFinite(status) && e.status !== status) return false;

    if (q) {
      const hay = JSON.stringify({
        traceId: e.traceId,
        service: e.service,
        endpoint: e.endpoint,
        status: e.status,
        request: e.request,
        response: e.response
      }).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const page = filtered.slice(offset, offset + limit);

  return {
    ok: true,
    total: filtered.length,
    limit,
    offset,
    count: page.length,
    events: page
  };
});

/** Clear all audit */
app.delete("/audit", async () => {
  events.length = 0;
  return { ok: true, cleared: true };
});

app.listen({ port: 3003, host: "127.0.0.1" });