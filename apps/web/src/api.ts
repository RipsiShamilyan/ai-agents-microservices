// import axios from "axios";

// export type ServiceKey = "credit" | "financial" | "fraud";

// export interface ServiceMeta {
//   title: string;
//   endpoint: string;
//   sample: Record<string, unknown>;
// }

// export const serviceMeta: Record<ServiceKey, ServiceMeta> = {
//   credit: {
//     title: "Credit Risk",
//     endpoint: "/api/credit-risk/assess",
//     sample: { income: 450000, debts: 120000, paymentHistory: "good", age: 28 }
//   },
//   financial: {
//     title: "Financial Risk",
//     endpoint: "/api/financial-risk/analyze",
//     sample: { company: "ABC LLC", cashFlow: 1200000, liabilities: 800000, volatility: "medium" }
//   },
//   fraud: {
//     title: "Fraud Detection",
//     endpoint: "/api/fraud-detection/check",
//     sample: { transactionAmount: 950000, country: "RU", device: "new", frequency: "high" }
//   }
// };

// export async function runService(service: ServiceKey, input: Record<string, unknown>) {
//   const { endpoint } = serviceMeta[service];
//   const res = await axios.post(endpoint, input, {
//     headers: { "Content-Type": "application/json" }
//   });
//   return res.data;
// }

// export type AuditFilters = {
//   service?: string; // "all" | "gateway-api" | ...
//   status?: string;  // "all" | "200" | "4xx" | "5xx"
//   q?: string;
//   limit?: number;
// };

// export async function fetchAudit(filters?: AuditFilters) {
//   const res = await axios.get("/api/audit", { params: filters });
//   return res.data;
// }

// export async function clearAudit() {
//   const res = await axios.delete("/api/audit");
//   return res.data;
// }


import axios from "axios";

export type ServiceKey = "credit" | "financial" | "fraud";

export interface ServiceMeta {
  title: string;
  endpoint: string;
  sample: Record<string, unknown>;
}

export const serviceMeta: Record<ServiceKey, ServiceMeta> = {
  credit: {
    title: "Credit Risk",
    endpoint: "/api/credit-risk/assess",
    sample: { income: 450000, debts: 120000, paymentHistory: "good", age: 28 }
  },
  financial: {
    title: "Financial Risk",
    endpoint: "/api/financial-risk/analyze",
    sample: { company: "ABC LLC", cashFlow: 1200000, liabilities: 800000, volatility: "medium" }
  },
  fraud: {
    title: "Fraud Detection",
    endpoint: "/api/fraud-detection/check",
    sample: { transactionAmount: 950000, country: "RU", device: "new", frequency: "high" }
  }
};

export async function runService(service: ServiceKey, input: Record<string, unknown>) {
  const { endpoint } = serviceMeta[service];
  const res = await axios.post(endpoint, input, {
    headers: { "Content-Type": "application/json" }
  });
  return res.data;
}

export type AuditQuery = {
  q?: string;
  service?: string;
  endpoint?: string;
  status?: number | "";
  traceId?: string;
  limit?: number;
  offset?: number;
};

export async function fetchAudit(query: AuditQuery = {}) {
  const res = await axios.get("/api/audit", { params: query });
  return res.data;
}

export async function clearAudit() {
  const res = await axios.delete("/api/audit");
  return res.data;
}