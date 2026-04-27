/**
 * @scholar-swarm/keeperhub-client
 *
 * KeeperHub adapter pack. Wraps the Direct Execution API for triggering
 * arbitrary contract calls with retry/audit semantics. Used by Scholar Swarm
 * to fire `PaymentRouter.distribute()` on Base Sepolia after a research job
 * completes on 0G.
 */

export { KeeperHubPaymentProvider, type KeeperHubConfig } from "./payment.js";
