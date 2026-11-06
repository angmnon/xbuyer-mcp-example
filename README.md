# VNMade MCP Server — Example (v2)

A minimal, runnable [MCP](https://modelcontextprotocol.io) server that turns VNMade's
Agent API into tools any MCP-compatible assistant (Claude, Cursor, custom agents) can call.

**The point:** your AI assistant can *actually shop* on VNMade — search, compare, cart,
checkout, refund — while every spend is gated by the user's **wallet balance** and
**per-scope OAuth authorization**. The agent never sees the user's card.

## Tools
| Tool (v2, preferred) | Legacy alias | Spends? | What it does |
|---|---|---|---|
| `vnmade_search` | `xbuyer_search` | No | Find products by need + budget |
| `vnmade_compare` | `xbuyer_compare` | No | TOP-N shortlist with reasons |
| `vnmade_cart_add` | `xbuyer_cart_add` | No | Stage a product (no charge) |
| `vnmade_checkout` | `xbuyer_checkout` | **Yes** | Charge wallet only within authorization + limits |
| `vnmade_refund` | `xbuyer_refund` | No (reverse) | Refund within return policy |

> **v2 migration (2026-11-07).** Tools are exposed under both the new `vnmade_*`
> names (preferred) and the legacy `xbuyer_*` names (deprecated aliases). New
> integrations should use `vnmade_*`; `xbuyer_*` will be removed in a future
> major version. See the hosted discovery card at
> `https://vnmade.xbuyer.com/.well-known/mcp/server-card.json`.

## Run
```bash
cd marketing/mcp-example
npm i @modelcontextprotocol/sdk zod
XVNMADE_API_KEY=xxx npx tsx server.ts
```
The `xbuyer_mcp-example` reads these environment variables:
- `XVNMADE_API_KEY` — **required** (legacy `XBUYER_API_KEY` also accepted).
- `XVNMADE_API_BASE` — API root (default `https://vnmade.xbuyer.com/api/agent`; legacy `XBUYER_API_BASE` also accepted).

## Wire into an MCP client (Claude Desktop example)
```json
{
  "mcpServers": {
    "vnmade": {
      "command": "npx",
      "args": ["tsx", "/abs/path/marketing/mcp-example/server.ts"],
      "env": { "XVNMADE_API_KEY": "xxx", "XVNMADE_API_BASE": "https://vnmade.xbuyer.com/api/agent" }
    }
  }
}
```

## Safety model (why users trust it)
- **Wallet isolation** — the agent can only spend pre-funded wallet balance, never the card.
- **Per-transaction authorization** — checkout requires explicit, revocable consent.
- **Limits** — daily / per-transaction caps; fails closed if exceeded.
- **Audit** — every action is logged and reviewable.

## Status / TODO
- [x] v2: `vnmade_*` tool names + legacy `xbuyer_*` aliases (backward compatible)
- [ ] Point `XVNMADE_API_BASE` to live Agent API + document auth flow
- [ ] Add MCP Inspector screenshot for the dev blog
- [ ] 5-minute "connect your agent to VNMade" Loom/video

> DevRel asset for the EU/US GTM playbook (W2 / 2.3). Keep it tiny and clone-and-run.
