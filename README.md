# XBuyer MCP Server — Example

A minimal, runnable [MCP](https://modelcontextprotocol.io) server that turns XBuyer's
Agent API into tools any MCP-compatible assistant (Claude, Cursor, custom agents) can call.

**The point:** your AI assistant can *actually shop* on XBuyer — search, compare, cart,
checkout, refund — while every spend is gated by the user's **wallet balance** and
**per-scope OAuth authorization**. The agent never sees the user's card.

## Tools
| Tool | Spends? | What it does |
|---|---|---|
| `xbuyer_search` | No | Find products by need + budget |
| `xbuyer_compare` | No | TOP-N shortlist with reasons |
| `xbuyer_cart_add` | No | Stage a product (no charge) |
| `xbuyer_checkout` | **Yes** | Charge wallet only within authorization + limits |
| `xbuyer_refund` | No (reverse) | Refund within return policy |

## Run
```bash
cd marketing/mcp-example
npm i @modelcontextprotocol/sdk zod
XBUYER_API_KEY=xxx npx tsx server.ts
```

## Wire into an MCP client (Claude Desktop example)
```json
{
  "mcpServers": {
    "xbuyer": {
      "command": "npx",
      "args": ["tsx", "/abs/path/marketing/mcp-example/server.ts"],
      "env": { "XBUYER_API_KEY": "xxx", "XBUYER_API_BASE": "https://xbuyer.com/api/agent" }
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
- [ ] Publish at `github.com/xbuyer/mcp-example` (Ph launch week)
- [ ] Point `XBUYER_API_BASE` to live Agent API + document auth flow
- [ ] Add MCP Inspector screenshot for the dev blog
- [ ] 5-minute "connect your agent to XBuyer" Loom/video

> DevRel asset for the EU/US GTM playbook (W2 / 2.3). Keep it tiny and clone-and-run.
