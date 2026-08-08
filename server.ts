/**
 * XBuyer MCP Server — example
 * ----------------------------------------------------------------------------
 * Minimal, runnable MCP server that exposes XBuyer's Agent API as MCP tools.
 * An AI assistant (Claude, Cursor, a custom agent, ...) can call these tools to
 * SEARCH / COMPARE / CART / CHECKOUT / REFUND on XBuyer — all gated by the
 * user's wallet balance and per-scope OAuth authorization.
 *
 * This is the DevRel hook described in the marketing playbook (W2 / 2.3).
 * It is intentionally tiny so a developer can read it in 5 minutes.
 *
 * Run (after `npm i @modelcontextprotocol/sdk`):
 *   XBUYER_API_KEY=xxx npx tsx server.ts
 * Wire into Claude Desktop / any MCP client via stdio.
 * ----------------------------------------------------------------------------
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.XBUYER_API_BASE ?? "https://xbuyer.com/api/agent";
const API_KEY = process.env.XBUYER_API_KEY;

if (!API_KEY) {
  console.error("XBUYER_API_KEY is required");
  process.exit(1);
}

async function xbuyer(path: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    // Surface a safe error — never leak wallet internals beyond what API returns.
    const msg = await res.text();
    throw new Error(`XBuyer API ${res.status}: ${msg.slice(0, 200)}`);
  }
  return res.json();
}

const server = new McpServer({
  name: "xbuyer",
  version: "0.1.0",
});

// 1) SEARCH — find products by natural-language need + budget
server.tool(
  "xbuyer_search",
  "Search XBuyer products by a need and an optional budget. Returns candidates with prices.",
  { query: z.string(), budgetUsd: z.number().optional(), limit: z.number().default(10) },
  async ({ query, budgetUsd, limit }) =>
    xbuyer("/search", { query, budgetUsd, limit }).then((r) => ({
      content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
    }))
);

// 2) COMPARE — get a TOP-N shortlist with reasons
server.tool(
  "xbuyer_compare",
  "Compare candidates and return a TOP-N shortlist with reasons. Does NOT spend anything.",
  { query: z.string(), budgetUsd: z.number().optional(), topN: z.number().default(10) },
  async ({ query, budgetUsd, topN }) =>
    xbuyer("/compare", { query, budgetUsd, topN }).then((r) => ({
      content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
    }))
);

// 3) CART — stage a product (still no charge)
server.tool(
  "xbuyer_cart_add",
  "Add a product to the agent cart. No charge until checkout is authorized.",
  { productId: z.string(), qty: z.number().default(1) },
  async ({ productId, qty }) =>
    xbuyer("/cart", { productId, qty }).then((r) => ({
      content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
    }))
);

// 4) CHECKOUT — the ONLY tool that can spend, and only within wallet + authorization
server.tool(
  "xbuyer_checkout",
  "Checkout the cart. Charges ONLY the pre-funded wallet, within the user's per-scope authorization and daily limits. Fails closed if not authorized.",
  { confirm: z.boolean().describe("Must be true; requires prior user authorization") },
  async ({ confirm }) => {
    if (!confirm) return { content: [{ type: "text", text: "Checkout requires explicit confirm=true and user authorization." }] };
    return xbuyer("/checkout", { confirm }).then((r) => ({
      content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
    }));
  }
);

// 5) REFUND — governed refund within policy
server.tool(
  "xbuyer_refund",
  "Request a refund for an order within XBuyer's return policy. Gated by policy + authorization.",
  { orderId: z.string(), reason: z.string().optional() },
  async ({ orderId, reason }) =>
    xbuyer("/refund", { orderId, reason }).then((r) => ({
      content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
    }))
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("XBuyer MCP server running on stdio");
