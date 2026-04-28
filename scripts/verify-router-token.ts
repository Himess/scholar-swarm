/**
 * Quick on-chain check: confirm Base Sepolia PaymentRouter is wired to real
 * Circle USDC (not a mock) and report its keeper / owner.
 *   pnpm exec tsx scripts/verify-router-token.ts
 */
import { ethers } from "ethers";

const RPC = process.env["BASE_SEPOLIA_RPC"] ?? "https://sepolia.base.org";
const ROUTER = process.env["BASE_PAYMENT_ROUTER"] ?? "0xda6ab98bb73e75b2581b72c98f0891529eee2156";
const EXPECTED_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const ABI = [
  "function token() view returns (address)",
  "function keeper() view returns (address)",
  "function owner() view returns (address)",
];

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(RPC);
  const router = new ethers.Contract(ROUTER, ABI, provider);
  const [token, keeper, owner] = await Promise.all([router.token(), router.keeper(), router.owner()]);
  console.log("PaymentRouter:", ROUTER);
  console.log("  token():    ", token, token.toLowerCase() === EXPECTED_USDC.toLowerCase() ? "✅ real Circle USDC" : "❌ mismatch");
  console.log("  keeper():   ", keeper);
  console.log("  owner():    ", owner);
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});
