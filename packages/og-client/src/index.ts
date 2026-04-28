/**
 * @scholar-swarm/og-client
 *
 * 0G Labs adapter pack:
 *   - OGComputeInferenceProvider  — sealed inference via TeeML / dstack
 *   - OGStorageProvider           — decentralized blob/JSON storage
 *   - EVMChainAdapter             — Bounty state-machine ops (works on any EVM L1)
 */

export { OGComputeInferenceProvider, type OGComputeConfig } from "./inference.js";
export { OGStorageProvider, type OGStorageConfig } from "./storage.js";
export { EVMChainAdapter, type EVMChainConfig } from "./chain.js";
