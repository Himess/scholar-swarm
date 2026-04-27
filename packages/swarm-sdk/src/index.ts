/**
 * @scholar-swarm/sdk
 *
 * Reusable framework for building multi-agent verifiable workflows on
 * decentralized infrastructure. Domain-agnostic — Scholar Swarm itself is
 * just one reference implementation built on this SDK.
 *
 * To build your own swarm:
 *   1. Choose providers: inference (TEE), storage, messaging (P2P), payment.
 *   2. Define roles: subclass `Role` and implement `handle(msg)`.
 *   3. Wire agents: `new Agent({ providers, role }).start()`.
 *
 * The SDK does not assume any particular blockchain, model provider, or
 * messaging mesh. It's the contract surface; concrete adapters live in
 * `./adapters/`.
 */

export * from "./types.js";
export * from "./providers.js";
export * from "./role.js";
export * from "./agent.js";
