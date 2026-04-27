/**
 * @scholar-swarm/og-client
 *
 * 0G Labs adapter pack. Three providers:
 *   - OGComputeInferenceProvider  — sealed inference via TeeML / dstack
 *   - OGStorageProvider           — decentralized blob/JSON storage
 *   - (OGReputationProvider — Day 5, reads ReputationRegistry contract)
 */

export { OGComputeInferenceProvider, type OGComputeConfig } from "./inference.js";
export { OGStorageProvider, type OGStorageConfig } from "./storage.js";
