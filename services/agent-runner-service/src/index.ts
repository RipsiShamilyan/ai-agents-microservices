import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";

const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 180000);

type RunBody = {
  traceId: string;
  agent: "credit-risk" | "financial-risk" | "fraud-detection" | string;
  input: Record<string, unknown>;
};

type RiskLevel = "low" | "medium" | "high";

type ComputedRisk = {
  riskScore: number;
  riskLevel: RiskLevel;
};

type Currency = "AMD" | "USD" | "EUR" | "RUR";

const FX_TO_AMD: Record<Currency, number> = {
  AMD: Number(process.env.FX_AMD_TO_AMD || 1),
  USD: Number(process.env.FX_USD_TO_AMD || 400),
  EUR: Number(process.env.FX_EUR_TO_AMD || 430),
  RUR: Number(process.env.FX_RUR_TO_AMD || 4.3)
};

const COUNTRY_RISK_WEIGHTS: Record<string, number> = {
  AM: 5,
  RU: 20,
  US: 10,
  DE: 8,
  FR: 8,
  IR: 25,
  CN: 12
};

app.get("/health", async () => ({ ok: true, service: "agent-runner" }));

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function normalizeCurrency(value: unknown): Currency {
  const v = String(value ?? "").toUpperCase();
  if (v === "USD" || v === "EUR" || v === "RUR" || v === "AMD") return v;
  return "AMD";
}

function toAmd(amount: number, currency: Currency): number {
  return amount * (FX_TO_AMD[currency] || 1);
}

function calculateCreditRisk(input: Record<string, unknown>): ComputedRisk {
  const income = Number(input.income ?? 0);
  const incomeCurrency = normalizeCurrency(input.incomeCurrency);

  const debts = Number(input.debts ?? 0);
  const debtsCurrency = normalizeCurrency(input.debtsCurrency);

  const paymentHistory = String(input.paymentHistory ?? "").toLowerCase();
  const age = Number(input.age ?? 0);

  const incomeAmd = toAmd(income, incomeCurrency);
  const debtsAmd = toAmd(debts, debtsCurrency);

  let score = 0;

  const debtToIncome = incomeAmd > 0 ? debtsAmd / incomeAmd : 999;

  if (debtToIncome >= 10) score += 75;
  else if (debtToIncome >= 5) score += 60;
  else if (debtToIncome >= 3) score += 45;
  else if (debtToIncome >= 2) score += 30;
  else if (debtToIncome >= 1) score += 15;

  if (paymentHistory === "bad") score += 20;
  else if (paymentHistory === "average") score += 10;
  else if (paymentHistory === "good") score += 0;

  if (age < 21) score += 5;
  else if (age > 65) score += 5;

  score = clampScore(score);

  return {
    riskScore: score,
    riskLevel: scoreToLevel(score)
  };
}

function calculateFinancialRisk(input: Record<string, unknown>): ComputedRisk {
  const cashFlow = Number(input.cashFlow ?? 0);
  const cashFlowCurrency = normalizeCurrency(input.cashFlowCurrency);

  const liabilities = Number(input.liabilities ?? 0);
  const liabilitiesCurrency = normalizeCurrency(input.liabilitiesCurrency);

  const volatility = String(input.volatility ?? "").toLowerCase();

  const cashFlowAmd = toAmd(cashFlow, cashFlowCurrency);
  const liabilitiesAmd = toAmd(liabilities, liabilitiesCurrency);

  let score = 0;

  const liabilitiesToCashFlow = cashFlowAmd > 0 ? liabilitiesAmd / cashFlowAmd : 999;

  if (liabilitiesToCashFlow >= 3) score += 70;
  else if (liabilitiesToCashFlow >= 2) score += 55;
  else if (liabilitiesToCashFlow >= 1.5) score += 40;
  else if (liabilitiesToCashFlow >= 1.0) score += 25;
  else if (liabilitiesToCashFlow >= 0.6) score += 12;
  else score += 5;

  if (volatility === "high") score += 25;
  else if (volatility === "medium") score += 10;
  else if (volatility === "low") score += 0;

  score = clampScore(score);

  return {
    riskScore: score,
    riskLevel: scoreToLevel(score)
  };
}

function calculateFraudRisk(input: Record<string, unknown>): ComputedRisk {
  const transactionAmount = Number(input.transactionAmount ?? 0);
  const transactionCurrency = normalizeCurrency(input.transactionCurrency);

  const country = String(input.country ?? "").toUpperCase();
  const device = String(input.device ?? "").toLowerCase();
  const frequency = String(input.frequency ?? "").toLowerCase();

  const amountAmd = toAmd(transactionAmount, transactionCurrency);

  let score = 0;

  // Amount risk
  if (amountAmd >= 5000000) score += 45;
  else if (amountAmd >= 2000000) score += 35;
  else if (amountAmd >= 1000000) score += 25;
  else if (amountAmd >= 500000) score += 15;
  else score += 5;

  // Country risk
  score += COUNTRY_RISK_WEIGHTS[country] ?? 12;

  // Device risk
  if (device === "new") score += 20;
  else if (device === "known") score += 5;

  // Frequency risk
  if (frequency === "high") score += 20;
  else if (frequency === "medium") score += 10;
  else if (frequency === "low") score += 3;

  // Combination rules
  if (device === "new" && frequency === "high") score += 15;
  if (device === "new" && amountAmd >= 1000000) score += 10;
  if (frequency === "high" && amountAmd >= 2000000) score += 10;
  if (country !== "AM" && device === "new" && frequency === "high") score += 10;

  score = clampScore(score);

  return {
    riskScore: score,
    riskLevel: scoreToLevel(score)
  };
}

function calculateRisk(agent: string, input: Record<string, unknown>): ComputedRisk {
  if (agent === "credit-risk") return calculateCreditRisk(input);
  if (agent === "financial-risk") return calculateFinancialRisk(input);
  if (agent === "fraud-detection") return calculateFraudRisk(input);

  return {
    riskScore: 0,
    riskLevel: "low"
  };
}

function buildPrompt(agent: string, input: Record<string, unknown>, computed: ComputedRisk): string {
  return `
Agent: ${agent}
Input: ${JSON.stringify(input)}
Use these exact values:
riskScore=${computed.riskScore}
riskLevel=${computed.riskLevel}

Return only valid JSON:
{
  "riskScore": ${computed.riskScore},
  "riskLevel": "${computed.riskLevel}",
  "summary": "Write 2 to 4 short English sentences. Mention currencies and country if they exist in input.",
  "recommendations": ["4 short recommendations"]
}
`;
}

function tryParseJsonFromModel(raw: string): { parsed: any | null; parseError: string | null } {
  try {
    return { parsed: JSON.parse(raw), parseError: null };
  } catch (e1: any) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start >= 0 && end > start) {
      const candidate = raw.slice(start, end + 1);
      try {
        return { parsed: JSON.parse(candidate), parseError: null };
      } catch (e2: any) {
        return { parsed: null, parseError: e2?.message || String(e2) };
      }
    }

    return { parsed: null, parseError: e1?.message || String(e1) };
  }
}

app.post<{ Body: RunBody }>("/run", async (req, reply) => {
  const { traceId, agent, input } = req.body || ({} as RunBody);

  if (!traceId || !agent || !input) {
    return reply.status(400).send({
      ok: false,
      error: "traceId, agent, input are required"
    });
  }

  const started = Date.now();
  const computed = calculateRisk(agent, input);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;

  try {
    res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: buildPrompt(agent, input, computed),
        stream: false,
        format: "json",
        options: {
          num_predict: 120,
          temperature: 0.1
        }
      }),
      signal: controller.signal
    });
  } catch (e: any) {
    clearTimeout(t);
    const latencyMs = Date.now() - started;

    return reply.status(504).send({
      ok: false,
      traceId,
      error: "Ollama timeout or network error",
      latencyMs,
      details: e?.message || String(e)
    });
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    const text = await res.text();
    const latencyMs = Date.now() - started;

    return reply.status(502).send({
      ok: false,
      traceId,
      error: "Ollama error",
      latencyMs,
      details: text
    });
  }

  const data = (await res.json()) as { response?: string };
  const raw = data.response ?? "";
  const latencyMs = Date.now() - started;

  const { parsed, parseError } = tryParseJsonFromModel(raw);
  const safeParsed = parsed && typeof parsed === "object" ? parsed : {};

  const finalParsed = {
    riskScore: computed.riskScore,
    riskLevel: computed.riskLevel,
    summary:
      typeof safeParsed.summary === "string" && safeParsed.summary.trim()
        ? safeParsed.summary.trim()
        : `The analysis indicates a ${computed.riskLevel} risk profile based on the provided input data. The selected currency values and country context were included in the evaluation.`,
    recommendations:
      Array.isArray(safeParsed.recommendations) && safeParsed.recommendations.length
        ? safeParsed.recommendations.map((x: unknown) => String(x))
        : [
            "Review the input data carefully.",
            "Monitor this case regularly.",
            "Apply additional controls if risk indicators increase.",
            "Reassess after any major change in the input data."
          ]
  };

  return {
    ok: true,
    traceId,
    agent,
    model: MODEL,
    latencyMs,
    raw,
    parsed: finalParsed,
    parseError: parseError ?? null
  };
});

// app.listen({ port: 3002, host: "127.0.0.1" });

app.listen({
  port: Number(process.env.PORT) || 3002,
  host: "0.0.0.0"
});
