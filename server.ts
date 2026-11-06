/**
 * VNMade MCP Server — example (v2)
 * ----------------------------------------------------------------------------
 * Minimal, runnable MCP server that exposes VNMade's Agent API as MCP tools.
 * An AI assistant (Claude, Cursor, a custom agent, ...) can call these tools to
 * SEARCH / COMPARE / CART / CHECKOUT / REFUND on VNMade — all gated by the
 * user's wallet balance and per-scope OAuth authorization.
 *
 * This is the DevRel hook described in the marketing playbook (W2 / 2.3).
 * It is intentionally tiny so a developer can read it in 5 minutes.
 *
 * Run (after `npm i @modelcontextprotocol/sdk`):
 *   XVNMADE_API_KEY=xxx npx tsx server.ts
 * Wire into Claude Desktop / any MCP client via stdio.
 *
 * v2 migration note (2026-11-07): tools are registered under BOTH the new
 * `vnmade_*` names (preferred) and the legacy `xbuyer_*` names (deprecated
 * aliases). Existing clients using `xbuyer_*` keep working unchanged. The
 * legacy names will be removed in a future major version.
 * ----------------------------------------------------------------------------
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE =
  process.env.XVNMADE_API_BASE ??
  process.env.XBUYER_API_BASE ??
  "https://vnmade.xbuyer.com/api/agent";
const API_KEY = process.env.XVNMADE_API_KEY ?? process.env.XBUYER_API_KEY;

if (!API_KEY) {
  console.error("XVNMADE_API_KEY is required (XBUYER_API_KEY also accepted as legacy fallback)");
  process.exit(1);
}

async function agentApi(path: string, body?: unknown) {
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
    throw new Error(`VNMade API ${res.status}: ${msg.slice(0, 200)}`);
  }
  return res.json();
}

const server = new McpServer({
  name: "vnmade",
  version: "0.2.0",
});

/**
 * Registers one agent tool under BOTH the v2 name (`vnmade_<base>`, preferred)
 * and the legacy alias (`xbuyer_<base>`, deprecated). Both names invoke the
 * same handler, so existing `xbuyer_*` clients keep working unchanged until the
 * legacy aliases are removed in a future major version.
 */
function registerAgentTool(
  base: string,
  description: string,
  schema: Record<string, z.ZodTypeAny>,
  handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>,
) {
  server.tool(`vnmade_${base}`, description, schema, handler as never);
  server.tool(
    `xbuyer_${base}`,
    `[DEPRECATED alias of vnmade_${base}] ${description}`,
    schema,
    handler as never,
  );
}

// 1) SEARCH — find products by natural-language need + budget
registerAgentTool(
  "search",
  "Search VNMade products by a need and an optional budget. Returns candidates with prices.",
  { query: z.string(), budgetUsd: z.number().optional(), limit: z.number().default(10) },
  async ({ query, budgetUsd, limit }) =>
    agentApi("/search", { query, budgetUsd, limit }).then((r) => ({
      content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
    })),
);

// 2) COMPARE — get a TOP-N shortlist with reasons
registerAgentTool(
  "compare",
  "Compare candidates and return a TOP-N shortlist with reasons. Does NOT spend anything.",
  { query: z.string(), budgetUsd: z.number().optional(), topN: z.number().default(10) },
  async ({ query, budgetUsd, topN }) =>
    agentApi("/compare", { query, budgetUsd, topN }).then((r) => ({
      content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
    })),
);

// 3) CART — stage a product (still no charge)
registerAgentTool(
  "cart_add",
  "Add a product to the agent cart. No charge until checkout is authorized.",
  { productId: z.string(), qty: z.number().default(1) },
  async ({ productId, qty }) =>
    agentApi("/cart", { productId, qty }).then((r) => ({
      content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
    })),
);

// 4) CHECKOUT — the ONLY tool that can spend, and only within wallet + authorization
registerAgentTool(
  "checkout",
  "Checkout the cart. Charges ONLY the pre-funded wallet, within the user's per-scope authorization and daily limits. Fails closed if not authorized.",
  { confirm: z.boolean().describe("Must be true; requires prior user authorization") },
  async ({ confirm }) => {
    if (!confirm)
      return {
        content: [
          { type: "text", text: "Checkout requires explicit confirm=true and user authorization." },
        ],
      };
    return agentApi("/checkout", { confirm }).then((r) => ({
      content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
    }));
  },
);

// 5) REFUND — governed refund within policy
registerAgentTool(
  "refund",
  "Request a refund for an order within VNMade's return policy. Gated by policy + authorization.",
  { orderId: z.string(), reason: z.string().optional() },
  async ({ orderId, reason }) =>
    agentApi("/refund", { orderId, reason }).then((r) => ({
      content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
    })),
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("VNMade MCP server (v2) running on stdio");
