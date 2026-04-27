/**
 * @scholar-swarm/axl-client
 *
 * Gensyn AXL adapter pack. AXL = peer-to-peer mesh node (Go binary running
 * on localhost:9002). This package implements MessagingProvider on top of
 * AXL's local HTTP API. MCP-over-AXL helpers ship in a future release.
 */

export { AXLMessagingProvider, type AXLConfig } from "./messaging.js";
