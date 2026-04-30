# VPS auto-runs — live evidence cadence

The Scholar Swarm backend runs on a continuously-up VPS (`roil-devnet` in EU). A cron job triggers a fresh research bounty every 6 hours via `pnpm spike:18:cli`, captures the artifact, and updates [`latest.json`](./latest.json) in this directory.

This proves the swarm is **alive**, not staged for the demo. Anyone can:

1. Read [`latest.json`](./latest.json) for the most recent successful auto-run.
2. Click the bounty `explorer` link to see all 16+ on-chain transitions on 0Gscan.
3. SSH into the VPS (with credentials) and check `systemctl status scholar-axl-*` and `scholar-agent-*` services running.

## VPS architecture

```
/opt/scholar-swarm                       cloned repo, pnpm install'd
├── infra/
│   ├── axl-node-planner   /node + private.pem  (TLS 9201, API 9101)
│   ├── axl-node-r1        ...                  (API 9102)
│   ├── axl-node-r2        ...                  (API 9103)
│   ├── axl-node-critic    ...                  (API 9104)
│   └── axl-node-synth     ...                  (API 9105)
└── scripts/
    ├── vps-boot-axl.sh             one-time bootstrap
    ├── vps-setup-systemd.sh        systemd units for AXL nodes
    ├── vps-setup-agent-systemd.sh  systemd units for agent runtimes
    └── vps-cron-bounty.sh          per-run wrapper (every 6h)

systemd units, all Restart=always:
  scholar-axl-{planner,r1,r2,critic,synth}.service     5×
  scholar-agent-{planner,r1,r2,critic,synth}.service   5×

cron (every 6 hours):
  /etc/cron.d/scholar-swarm  →  vps-cron-bounty.sh

logs:
  /var/log/scholar-axl-*.log     AXL node output
  /var/log/scholar-agent-*.log   agent runtime output
  /var/log/scholar-cron/         per-run + index + latest.json
```

## Existing AXL identity preserved

The original Spike 2b cross-ISP test node (`/home/axl/`, identity `f2c4bc95…`) stays intact on its own ports (TLS 9001, API 9002). The swarm uses 5 separate identities on different ports — no conflict.

## How to inspect a run manually

```bash
ssh root@<VPS>
cd /opt/scholar-swarm
journalctl -u scholar-agent-planner -n 50          # planner activity
journalctl -u scholar-axl-planner -n 50            # AXL node activity
ls /var/log/scholar-cron/                          # per-run logs
cat /var/log/scholar-cron/latest.json              # most recent artifact
```

## Why 0G Storage delays sometimes happen

0G Galileo testnet's storage indexer occasionally takes minutes (or even an hour+) to sync. The `agent-researcher` role catches the upload error and continues with a fallback hash; this is graceful but may produce an incomplete bounty. Bounty 24 (run 2026-04-29 23:25 UTC) hit this — task 2 storage upload took ~6 hours, then critic's reviewClaim reverted because findings root was effectively missing.

Bounty 25 (run 2026-04-30 09:07 UTC) completed cleanly in 4 min 45 s when 0G Storage was responsive.

This is a 0G testnet behavior, not a bug in our pipeline. Mainnet deployment removes the variability.
