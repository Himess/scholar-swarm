/**
 * Mock MCP router for Node B (Spike 3 — proves MCP-over-AXL transport).
 *
 * AXL forwards inbound /mcp/{peer}/{service} to its configured router
 * (router_addr:router_port). This mock answers with a valid JSON-RPC response
 * regardless of input — enough to verify the round-trip A → AXL → B →
 * router → response → AXL → A.
 *
 * Usage: node mock-mcp-router.js (run before starting Node B with router_addr set)
 */

const http = require("node:http");

const PORT = 9003;

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    console.log(`[router] ${req.method} ${req.url}  body=${body.slice(0, 160)}`);
    let id = 1;
    let method = "unknown";
    try {
      const parsed = JSON.parse(body);
      id = parsed.id ?? 1;
      method = parsed.method ?? "unknown";
    } catch {
      /* not JSON — still respond */
    }
    // AXL expects { response: {...inner JSON-RPC...}, error: "" }
    // — see internal/mcp/mcp_utils.go RouterResponse.
    const innerJsonRpc = {
      jsonrpc: "2.0",
      id,
      result: {
        echoed: { method, bodyPreview: body.slice(0, 200) },
        servedBy: "mock-mcp-router on node-b",
        timestamp: new Date().toISOString(),
      },
    };
    const routerResponse = { response: innerJsonRpc, error: "" };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(routerResponse));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[router] listening on http://127.0.0.1:${PORT}`);
});
