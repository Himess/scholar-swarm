/**
 * SearXNG-MCP router for Node B (Spike 20 — proves a real Researcher tool runs over MCP-over-AXL).
 *
 * AXL forwards inbound /mcp/{peer}/{service} → router_addr:router_port. This
 * router receives the JSON-RPC body, invokes a real upstream tool (SearXNG),
 * and wraps the result in the RouterResponse envelope ({response, error})
 * that AXL expects. Net effect: agent A calls
 *   POST localhost:{a_api}/mcp/{b_peer}/searxng
 * and gets real Google/Bing/DuckDuckGo results back, with the entire
 * round-trip riding the AXL Yggdrasil mesh.
 *
 * Supported JSON-RPC methods:
 *   - "search"   { query, max_results? } → SearXNG /search ?format=json
 *   - "ping"     {}                      → health check
 *
 * Usage:
 *   SEARXNG_ENDPOINT=http://127.0.0.1:8888 node searxng-mcp-router.js
 *   (AXL Node B's node-config.json must have router_addr / router_port = 9003)
 */

const http = require("node:http");

const PORT = Number(process.env.ROUTER_PORT || 9003);
const SEARXNG_ENDPOINT = (process.env.SEARXNG_ENDPOINT || "http://127.0.0.1:8888").replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.SEARXNG_TIMEOUT_MS || 15000);

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function envelope(inner, errStr = "") {
  // AXL RouterResponse contract: { response: <inner json-rpc>, error: "" }
  return { response: inner, error: errStr };
}

async function searxngSearch(query, maxResults) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    categories: "general",
    language: "en",
  });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${SEARXNG_ENDPOINT}/search?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`SearXNG HTTP ${resp.status} ${resp.statusText}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    const trimmed = (data.results || []).slice(0, maxResults || 5).map((r) => ({
      url: r.url,
      title: r.title,
      content: r.content || "",
      engine: r.engine || "",
    }));
    return { query: data.query || query, count: trimmed.length, results: trimmed };
  } finally {
    clearTimeout(t);
  }
}

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    // AXL wraps the JSON-RPC in a RouterRequest envelope:
    //   { service, request: <inner json-rpc bytes>, from_peer_id }
    // We need to unwrap `request` to get the actual JSON-RPC payload.
    let outer;
    try {
      outer = JSON.parse(body || "{}");
    } catch {
      const err = envelope(jsonRpcError(null, -32700, "Parse error: outer envelope"), "");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(err));
      return;
    }
    const service = outer.service || "";
    const fromPeerId = outer.from_peer_id || "";

    let parsed;
    try {
      // `request` is either a JSON object (already parsed) or a JSON string/raw bytes
      parsed =
        typeof outer.request === "string"
          ? JSON.parse(outer.request)
          : outer.request || {};
    } catch {
      const err = envelope(jsonRpcError(null, -32700, "Parse error: inner json-rpc"), "");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(err));
      return;
    }
    const { id = 1, method = "", params = {} } = parsed;
    console.log(
      `[searxng-router] ${req.method} ${req.url}  service=${service}  from=${fromPeerId.slice(0, 8)}  method=${method}  q=${(params.query || "").slice(0, 80)}`,
    );

    try {
      let inner;
      if (method === "search") {
        const result = await searxngSearch(params.query || "", params.max_results);
        inner = jsonRpcResult(id, result);
      } else if (method === "ping") {
        inner = jsonRpcResult(id, { ok: true, ts: new Date().toISOString() });
      } else if (method === "initialize" || method === "tools/list") {
        // Minimal MCP handshake support so generic MCP clients can introspect.
        inner = jsonRpcResult(id, {
          serverInfo: { name: "searxng-mcp-router", version: "0.1.0" },
          tools: [
            {
              name: "search",
              description: "Federated web search via SearXNG (Google/Bing/DuckDuckGo/Wikipedia).",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  max_results: { type: "number" },
                },
                required: ["query"],
              },
            },
          ],
        });
      } else {
        inner = jsonRpcError(id, -32601, `Unknown method: ${method}`);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(envelope(inner, "")));
    } catch (err) {
      const inner = jsonRpcError(id, -32603, String(err?.message || err));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(envelope(inner, "")));
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[searxng-router] listening on http://127.0.0.1:${PORT}  upstream=${SEARXNG_ENDPOINT}`);
});
