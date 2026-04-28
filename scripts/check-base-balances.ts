/**
 * Pre-flight check for Spike 19: confirm deployer has Base Sepolia ETH (for
 * fund() gas) and USDC (for the actual escrow). Also reports KH Para wallet
 * ETH (it pays distribute() gas).
 *   pnpm exec tsx --env-file=.env scripts/check-base-balances.ts
 */
import { ethers } from "ethers";

const RPC = process.env["BASE_SEPOLIA_RPC"] ?? "https://sepolia.base.org";
const USDC = process.env["BASE_SEPOLIA_USDC"] ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const ROUTER = process.env["BASE_PAYMENT_ROUTER"] ?? "0xda6ab98bb73e75b2581b72c98f0891529eee2156";
const DEPLOYER = "0xF505e2E71df58D7244189072008f25f6b6aaE5ae";
const KEEPER = process.env["KEEPERHUB_WALLET_ADDR"] ?? "0x7109C8e3B56C0A94729F3f538105b6916EF5934B";

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(RPC);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);
  const decimals: number = await usdc.decimals();

  console.log(`Base Sepolia (chainId 84532) — RPC ${RPC}\n`);

  for (const [label, addr] of [
    ["Deployer (us)", DEPLOYER],
    ["KH Para wallet (keeper)", KEEPER],
    ["PaymentRouter", ROUTER],
  ] as const) {
    const [eth, usdcBal] = await Promise.all([
      provider.getBalance(addr),
      usdc.balanceOf(addr),
    ]);
    console.log(`${label}: ${addr}`);
    console.log(`  ETH:  ${ethers.formatEther(eth)}`);
    console.log(`  USDC: ${ethers.formatUnits(usdcBal, decimals)}\n`);
  }

  console.log("Spike 19 needs:");
  console.log("  • Deployer:        ≥ 0.005 ETH (for approve + fund tx) AND ≥ 1 USDC (escrow amount)");
  console.log("  • KH Para wallet:  ≥ 0.005 ETH (for distribute tx — keeper pays gas)");
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});
