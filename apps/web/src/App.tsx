import { useMemo, useState } from "react";
import "./App.css";
import { clearAudit, fetchAudit, runService } from "./api";
import type { ServiceKey } from "./api";

type AgentParsed = {
  riskScore?: number;
  riskLevel?: "low" | "medium" | "high" | string;
  summary?: string;
  recommendations?: string[];
};

// type RunnerBodyShape = {
//   parsed?: unknown;
//   raw?: unknown;
// };

// type BodyShape = {
//   runnerBody?: unknown;
// };

// type ServiceResponseEnvelope = {
//   creditBody?: BodyShape;
//   financialBody?: BodyShape;
//   fraudBody?: BodyShape;
// };

function errorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  return String(e);
}

// function extractAgentParsed(result: unknown): AgentParsed | null {
//   if (!result || typeof result !== "object") return null;

//   const r = result as ServiceResponseEnvelope;
//   const body = r.creditBody ?? r.financialBody ?? r.fraudBody ?? null;
//   if (!body || !body.runnerBody) return null;

//   const runnerBody = body.runnerBody;

//   if (runnerBody && typeof runnerBody === "object") {
//     const rb = runnerBody as RunnerBodyShape;

//     if (rb.parsed && typeof rb.parsed === "object") return rb.parsed as AgentParsed;

//     if (typeof rb.raw === "string") {
//       try {
//         return JSON.parse(rb.raw) as AgentParsed;
//       } catch {
//         return null;
//       }
//     }
//   }
//   return null;
// }

function extractAgentParsed(result: any): AgentParsed | null {
  if (!result || typeof result !== "object") return null;

  if (result.parsed) {
    return result.parsed;
  }

  return null;
}

type AuditEvent = {
  traceId?: string;
  service?: string;
  endpoint?: string;
  status?: number;
  latencyMs?: number;
  request?: unknown;
  response?: unknown;
  timestamp?: string;
};

function safeJsonParse(v: unknown): unknown {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function extractParsedFromAuditResponse(resp: unknown): AgentParsed | null {
  const r = safeJsonParse(resp);

  if (r && typeof r === "object") {
    const obj: any = r;

    if (obj.runnerBody?.parsed && typeof obj.runnerBody.parsed === "object") return obj.runnerBody.parsed;

    if (typeof obj.runnerBody?.raw === "string") {
      try {
        return JSON.parse(obj.runnerBody.raw);
      } catch {
        return null;
      }
    }

    if (obj.parsed && typeof obj.parsed === "object") return obj.parsed;
  }
  return null;
}

function normalizeAudit(audit: unknown): { events: AuditEvent[]; total: number; limit: number; offset: number } {
  if (!audit || typeof audit !== "object") return { events: [], total: 0, limit: 50, offset: 0 };

  const anyAudit: any = audit;
  const events = Array.isArray(anyAudit.events) ? anyAudit.events : [];
  const total = typeof anyAudit.total === "number" ? anyAudit.total : events.length;
  const limit = typeof anyAudit.limit === "number" ? anyAudit.limit : 50;
  const offset = typeof anyAudit.offset === "number" ? anyAudit.offset : 0;

  return {
    total,
    limit,
    offset,
    events: events.map((e: any) => ({
      traceId: e.traceId,
      service: e.service,
      endpoint: e.endpoint,
      status: e.status,
      latencyMs: e.latencyMs,
      request: e.request,
      response: e.response,
      timestamp: e.timestamp
    }))
  };
}

function levelBadge(level: string | null) {
  if (!level) return { text: "—", cls: "badge" };
  const v = level.toLowerCase();
  if (v === "low") return { text: "LOW", cls: "badge badge-low" };
  if (v === "medium") return { text: "MEDIUM", cls: "badge badge-medium" };
  if (v === "high") return { text: "HIGH", cls: "badge badge-high" };
  return { text: level.toUpperCase(), cls: "badge" };
}

type Field =
  | { key: string; label: string; kind: "number"; placeholder?: string; defaultValue: number }
  | { key: string; label: string; kind: "text"; placeholder?: string; defaultValue: string }
  | { key: string; label: string; kind: "select"; options: string[]; defaultValue: string };

const formConfig: Record<ServiceKey, { title: string; endpoint: string; fields: Field[] }> = {
  credit: {
    title: "Credit Risk",
    endpoint: "/api/credit-risk/assess",
    fields: [
      { key: "income", label: "Income Amount", kind: "number", defaultValue: 450000 },
      { key: "incomeCurrency", label: "Income Currency", kind: "select", options: ["AMD", "USD", "EUR", "RUR"], defaultValue: "AMD" },

      { key: "debts", label: "Debts Amount", kind: "number", defaultValue: 120000 },
      { key: "debtsCurrency", label: "Debts Currency", kind: "select", options: ["AMD", "USD", "EUR", "RUR"], defaultValue: "AMD" },

      { key: "paymentHistory", label: "Payment History", kind: "select", options: ["good", "average", "bad"], defaultValue: "good" },
      { key: "age", label: "Age", kind: "number", defaultValue: 28 }
    ]
  },
  financial: {
    title: "Financial Risk",
    endpoint: "/api/financial-risk/analyze",
    fields: [
      { key: "company", label: "Company", kind: "text", defaultValue: "ABC LLC" },

      { key: "cashFlow", label: "Cash Flow Amount", kind: "number", defaultValue: 1200000 },
      { key: "cashFlowCurrency", label: "Cash Flow Currency", kind: "select", options: ["AMD", "USD", "EUR", "RUR"], defaultValue: "AMD" },

      { key: "liabilities", label: "Liabilities Amount", kind: "number", defaultValue: 800000 },
      { key: "liabilitiesCurrency", label: "Liabilities Currency", kind: "select", options: ["AMD", "USD", "EUR", "RUR"], defaultValue: "AMD" },

      { key: "volatility", label: "Volatility", kind: "select", options: ["low", "medium", "high"], defaultValue: "medium" }
    ]
  },
  fraud: {
    title: "Fraud Detection",
    endpoint: "/api/fraud-detection/check",
    fields: [
      { key: "transactionAmount", label: "Transaction Amount", kind: "number", defaultValue: 950000 },
      { key: "transactionCurrency", label: "Transaction Currency", kind: "select", options: ["AMD", "USD", "EUR", "RUR"], defaultValue: "AMD" },

      { key: "country", label: "Country", kind: "select", options: ["AM", "RU", "US", "DE", "FR", "IR", "CN"], defaultValue: "AM" },
      { key: "device", label: "Device", kind: "select", options: ["known", "new"], defaultValue: "new" },
      { key: "frequency", label: "Frequency", kind: "select", options: ["low", "medium", "high"], defaultValue: "high" }
    ]
  }
};

function initFormValues(service: ServiceKey): Record<string, string> {
  const cfg = formConfig[service];
  const v: Record<string, string> = {};
  for (const f of cfg.fields) v[f.key] = String(f.defaultValue);
  return v;
}

function buildInput(service: ServiceKey, values: Record<string, string>): Record<string, unknown> {
  const cfg = formConfig[service];
  const input: Record<string, unknown> = {};
  for (const f of cfg.fields) {
    const raw = values[f.key] ?? "";
    if (f.kind === "number") {
      const n = Number(raw);
      input[f.key] = Number.isFinite(n) ? n : 0;
    } else {
      input[f.key] = raw;
    }
  }
  return input;
}

// -------- Export helpers --------
function downloadText(filename: string, text: string, mime = "application/octet-stream") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  const needs = /[",\n]/.test(s);
  const out = s.replace(/"/g, '""');
  return needs ? `"${out}"` : out;
}

export default function App() {
  const [service, setService] = useState<ServiceKey>("credit");
  const [values, setValues] = useState<Record<string, string>>(() => initFormValues("credit"));

  const [, setResult] = useState<unknown>(null);
  const [parsedOnly, setParsedOnly] = useState<AgentParsed | null>(null);

  // audit state
  const [audit, setAudit] = useState<unknown>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // audit filters + paging
  const [auditQ, setAuditQ] = useState("");
  const [auditService, setAuditService] = useState<string>("");
  const [auditStatus, setAuditStatus] = useState<string>(""); // "" or "200" etc
  const [limit, setLimit] = useState(12);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cfg = useMemo(() => formConfig[service], [service]);
  const badge = useMemo(() => levelBadge(parsedOnly?.riskLevel ?? null), [parsedOnly?.riskLevel]);

  const auditNormalized = useMemo(() => normalizeAudit(audit), [audit]);
  const visibleAuditEvents = useMemo(() => {
    return auditNormalized.events.filter((e) => e.service === "gateway-api");
  }, [auditNormalized]);


  function switchService(s: ServiceKey) {
    setService(s);
    setValues(initFormValues(s));
    setResult(null);
    setParsedOnly(null);
    setErr(null);
  }

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onRun() {
    setLoading(true);
    setErr(null);
    setParsedOnly(null);

    try {
      const input = buildInput(service, values);
      const data = await runService(service, input);
      setResult(data);

      const parsed = extractAgentParsed(data);
      if (!parsed) setErr("AI did not return a valid parsed JSON. (Check agent-runner output format.)");
      setParsedOnly(parsed);
    } catch (e: unknown) {
      setErr(errorMessage(e));
      setResult({ ok: false, error: "Request failed", details: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  }

  async function loadAudit(nextOffset = offset) {
    setAuditLoading(true);
    try {
      const data = await fetchAudit({
        q: auditQ || undefined,
        service: auditService || undefined,
        status: auditStatus ? Number(auditStatus) : undefined,
        limit,
        offset: nextOffset
      });
      setAudit(data);
      setOffset(nextOffset);
    } catch (e: unknown) {
      setAudit({ ok: false, error: "Failed to load audit", details: errorMessage(e) });
    } finally {
      setAuditLoading(false);
    }
  }

  async function onClearAudit() {
    setAuditLoading(true);
    try {
      await clearAudit();
      setAudit(null);
      setOffset(0);
    } catch (e: unknown) {
      setAudit({ ok: false, error: "Failed to clear audit", details: errorMessage(e) });
    } finally {
      setAuditLoading(false);
    }
  }

  function onExportJSON() {
    const rows = visibleAuditEvents ?? [];
    const payload = { exportedAt: new Date().toISOString(), filters: { auditQ, auditService, auditStatus, limit, offset }, events: rows };
    downloadText("audit-export.json", JSON.stringify(payload, null, 2), "application/json");
  }

  function onExportCSV() {
    const rows = visibleAuditEvents ?? [];
    const header = ["timestamp", "traceId", "service", "endpoint", "status", "latencyMs", "riskScore", "riskLevel", "summary"];
    const lines = [header.join(",")];

    for (const e of rows) {
      const parsed = extractParsedFromAuditResponse(e.response);
      const line = [
        csvEscape(e.timestamp),
        csvEscape(e.traceId),
        csvEscape(e.service),
        csvEscape(e.endpoint),
        csvEscape(e.status),
        csvEscape(e.latencyMs),
        csvEscape(parsed?.riskScore),
        csvEscape(parsed?.riskLevel),
        csvEscape(parsed?.summary)
      ];
      lines.push(line.join(","));
    }

    downloadText("audit-export.csv", lines.join("\n"), "text/csv");
  }

  const total = auditNormalized.total;
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="title">AI Agents Microservices Demo</div>
          <div className="sub">Gateway → Domain Service → Agent Runner (Ollama) → Audit (traceId, latency)</div>
        </div>
        <div className="sub">Local: http://localhost:5173</div>
      </div>

      <div className="toolbar">
        <button className={`btn-tab ${service === "credit" ? "active" : ""}`} onClick={() => switchService("credit")} disabled={loading}>
          Credit Risk
        </button>
        <button className={`btn-tab ${service === "financial" ? "active" : ""}`} onClick={() => switchService("financial")} disabled={loading}>
          Financial Risk
        </button>
        <button className={`btn-tab ${service === "fraud" ? "active" : ""}`} onClick={() => switchService("fraud")} disabled={loading}>
          Fraud Detection
        </button>

        <div className="spacer" />

        <button className="btn-primary" onClick={onRun} disabled={loading}>
          {loading ? "Running..." : "Run Analysis"}
        </button>
      </div>

      <div className="grid">
        {/* INPUT */}
        <div className="card">
          <h3>Input — {cfg.title}</h3>
          <div className="meta">Endpoint: {cfg.endpoint}</div>

          <div className="formGrid">
            {cfg.fields.map((f, index) => {
              const next = cfg.fields[index + 1];

              const isAmountWithCurrency =
                f.kind === "number" &&
                next &&
                next.kind === "select" &&
                next.key.toLowerCase().includes("currency");

              const isCurrencyPairedWithPrevious =
                f.kind === "select" &&
                f.key.toLowerCase().includes("currency") &&
                index > 0 &&
                cfg.fields[index - 1].kind === "number";

              if (isCurrencyPairedWithPrevious) {
                return null;
              }

              if (isAmountWithCurrency && next) {
                return (
                  <div className="formRow" key={f.key}>
                    <div className="formRowInline">
                      <div className="formSubRow">
                        <label className="formLabel">{f.label}</label>
                        <input
                          className="control"
                          type="number"
                          value={values[f.key] ?? ""}
                          onChange={(e) => setField(f.key, e.target.value)}
                          disabled={loading}
                        />
                      </div>

                      <div className="formSubRow">
                        <label className="formLabel">{next.label}</label>
                        <select
                          className="control"
                          value={values[next.key] ?? ""}
                          onChange={(e) => setField(next.key, e.target.value)}
                          disabled={loading}
                        >
                          {next.options.map((opt) => (
                            <option value={opt} key={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="formRow" key={f.key}>
                  <label className="formLabel">{f.label}</label>

                  {f.kind === "select" ? (
                    <select className="control" value={values[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} disabled={loading}>
                      {f.options.map((opt) => (
                        <option value={opt} key={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="control"
                      type={f.kind === "number" ? "number" : "text"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      disabled={loading}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {err && <div className="errorBox">⚠ {err}</div>}
        </div>

        {/* RESULT */}
        <div className="card resultPanel">
          <h3>Analysis Result (Clean View)</h3>

          <div className="kpis">
            <div className="kpi">
              <div className="label">Risk Score</div>
              <div className="value">{parsedOnly?.riskScore ?? "—"}</div>
            </div>
            <div className="kpi">
              <div className="label">Risk Level</div>
              <div className="value">
                <span className={badge.cls}>{badge.text}</span>
              </div>
            </div>
            <div className="kpi">
              <div className="label">Summary (Detailed)</div>
              <div className="summaryBox">{parsedOnly?.summary ?? "—"}</div>
            </div>
          </div>

          <div className="recCard">
            <div className="recTitle">Recommendations</div>
            {parsedOnly?.recommendations?.length ? (
              <ul className="recList">
                {parsedOnly.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <div className="muted">—</div>
            )}
          </div>

          {loading && (
            <div className="loadingOverlay">
              <div className="loadingBox">Running analysis… please wait</div>
            </div>
          )}
        </div>
      </div>

      {/* AUDIT */}
      <div className="auditSection">
        <div className="card">
          <div className="auditHeader">
            <div>
              <h3 style={{ margin: 0 }}>Audit History (Filter + Pagination)</h3>
              <div className="meta" style={{ marginTop: 6 }}>
                Showing <b>{visibleAuditEvents.length}</b> gateway records from <b>{auditNormalized.events.length}</b> loaded records
              </div>

              <div className="auditActions">
                <button onClick={() => loadAudit(0)} disabled={auditLoading}>
                  {auditLoading ? "Loading..." : "Load Audit"}
                </button>
                <button onClick={onClearAudit} disabled={auditLoading}>
                  Clear Audit
                </button>
                <button onClick={onExportJSON} disabled={!auditNormalized.events.length}>
                  Export JSON
                </button>
                <button onClick={onExportCSV} disabled={!auditNormalized.events.length}>
                  Export CSV
                </button>
              </div>
            </div>

            <div className="auditFilters">
              <input
                className="control"
                placeholder="Search (q) — traceId / service / endpoint / response..."
                value={auditQ}
                onChange={(e) => setAuditQ(e.target.value)}
                disabled={auditLoading}
              />

              <select className="control" value={auditService} onChange={(e) => setAuditService(e.target.value)} disabled={auditLoading}>
                <option value="">All services</option>
                <option value="gateway-api">gateway-api</option>
                <option value="credit-risk-service">credit-risk-service</option>
                <option value="financial-risk-service">financial-risk-service</option>
                <option value="fraud-detection-service">fraud-detection-service</option>
                {/* <option value="agent-runner">agent-runner</option>
                <option value="audit-logging">audit-logging</option> */}
              </select>

              <select className="control" value={auditStatus} onChange={(e) => setAuditStatus(e.target.value)} disabled={auditLoading}>
                <option value="">All status</option>
                <option value="200">200</option>
                <option value="400">400</option>
                <option value="500">500</option>
                <option value="502">502</option>
                <option value="504">504</option>
              </select>

              <select className="control" value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))} disabled={auditLoading}>
                <option value="12">12 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
              </select>

              <button onClick={() => loadAudit(0)} disabled={auditLoading}>
                Apply Filter
              </button>

              <div className="spacer" />

              <button onClick={() => loadAudit(Math.max(0, offset - limit))} disabled={auditLoading || !canPrev}>
                Prev
              </button>
              <button onClick={() => loadAudit(offset + limit)} disabled={auditLoading || !canNext}>
                Next
              </button>
            </div>

            {!audit && <div className="muted">Click “Load Audit” to view logs.</div>}

            {!!audit && !visibleAuditEvents.length && <div className="muted">No gateway audit events match your filters.</div>}

            {!!visibleAuditEvents.length && (
              <div className="auditTableWrap">
                <table className="auditTable">
                  <thead>
                    <tr>
                      <th>timestamp</th>
                      <th>traceId</th>
                      <th>service</th>
                      <th>endpoint</th>
                      <th>status</th>
                      <th>latency</th>
                      <th>risk</th>
                      <th>summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAuditEvents.map((e, idx) => {
                      const parsed = extractParsedFromAuditResponse(e.response);
                      const b = levelBadge(parsed?.riskLevel ?? null);

                      return (
                        <tr key={idx}>
                          <td className="mono">{e.timestamp ?? "—"}</td>
                          <td className="mono">{e.traceId ?? "—"}</td>
                          <td>{e.service ?? "—"}</td>
                          <td className="mono">{e.endpoint ?? "—"}</td>
                          <td>{e.status ?? "—"}</td>
                          <td>{typeof e.latencyMs === "number" ? `${e.latencyMs} ms` : "—"}</td>
                          <td className="mono">
                            {parsed?.riskScore != null ? parsed.riskScore : "—"}{" "}
                            <span className={b.cls} style={{ marginLeft: 8 }}>
                              {b.text}
                            </span>
                          </td>
                          <td className="summaryCell">{parsed?.summary ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div >
    </div>
  );
}