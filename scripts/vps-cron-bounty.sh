#!/usr/bin/env bash
# Cron-friendly wrapper around spike-18-cli for VPS auto-bounty runs.
# Logs everything per-run to /var/log/scholar-cron/<timestamp>.log and
# appends a one-line summary to /var/log/scholar-cron/index.log.
#
# Add to /etc/cron.d/scholar-swarm with a line like:
#   0 */6 * * * root /opt/scholar-swarm/scripts/vps-cron-bounty.sh
# Runs every 6 hours.
set -uo pipefail

ROOT=/opt/scholar-swarm
LOGDIR=/var/log/scholar-cron
mkdir -p "$LOGDIR"

ts=$(date -u +%Y%m%dT%H%M%SZ)
log="$LOGDIR/${ts}.log"

cd "$ROOT"

# Pre-flight balance sanity (skip run if any wallet < 0.05 OG)
balance_ok=$(pnpm exec tsx --env-file=.env scripts/preflight-spike18.ts 2>&1 | tail -3 | head -1)
if echo "$balance_ok" | grep -q "FAILED"; then
  echo "$ts SKIP — preflight failed: $balance_ok" >> "$LOGDIR/index.log"
  exit 0
fi

# Run with a 30-min hard timeout (0G Storage testnet sometimes very slow)
timeout 1800 pnpm exec tsx --env-file=.env scripts/spike-18-cli.ts > "$log" 2>&1
rc=$?

# Extract bounty id + final status
bid=$(grep -oE "bountyId=[0-9]+" "$log" | head -1)
addr=$(grep -oE "address=0x[0-9a-fA-F]+" "$log" | head -1)
final=$(grep -E "status: [0-9]" "$log" | tail -1)
result="UNKNOWN"

if grep -q "Spike 18 PASS" "$log"; then
  result="PASS"
elif grep -qE "❌|timed out|Cancelled" "$log"; then
  result="FAIL"
elif [ "$rc" = "124" ]; then
  result="TIMEOUT-30min"
fi

echo "$ts $result $bid $addr $final" >> "$LOGDIR/index.log"

# Compact artifact for the frontend live-status badge
cat > "$LOGDIR/latest.json" <<EOF
{
  "timestamp": "$ts",
  "result": "$result",
  "bountyId": "$(echo $bid | cut -d= -f2)",
  "bountyAddress": "$(echo $addr | cut -d= -f2)",
  "finalStatus": "$final",
  "exitCode": $rc
}
EOF

# Push the artifact to GitHub via the deploy key, but only on a clean PASS.
# Failures stay local — we don't want flaky 0G Storage runs to spam the badge.
if [ "$result" = "PASS" ]; then
  bountyId=$(echo $bid | cut -d= -f2)
  bountyAddr=$(echo $addr | cut -d= -f2)
  reportRoot=$(grep -oE "Final report root: 0x[0-9a-fA-F]+" "$log" | head -1 | awk '{print $4}')
  createTx=$(grep -oE "tx: 0x[0-9a-fA-F]+" "$log" | head -1 | awk '{print $2}')
  acceptTx=$(grep -oE "acceptPlanner tx: 0x[0-9a-fA-F]+" "$log" | head -1 | awk '{print $3}')
  elapsed=$(grep -oE "\\+[0-9.]+s status: 6" "$log" | head -1 | sed 's/+\([0-9.]*\)s.*/\1/')
  completedAtIso=$(date -u -d "$ts" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$ROOT/docs/vps-runs/latest.json" <<EOF
{
  "_comment": "Auto-updated by scripts/vps-cron-bounty.sh on each successful cron run.",
  "vpsHost": "roil-devnet (EU)",
  "lastSuccessful": {
    "bountyId": $bountyId,
    "bountyAddress": "$bountyAddr",
    "completedAt": "$completedAtIso",
    "elapsedSeconds": ${elapsed:-0},
    "finalReportRoot": "$reportRoot",
    "createBountyTx": "$createTx",
    "acceptPlannerTx": "$acceptTx",
    "explorer": "https://chainscan-galileo.0g.ai/address/$bountyAddr",
    "trigger": "cron · auto-fired by /etc/cron.d/scholar-swarm"
  },
  "deploymentNote": "5 AXL + 5 agent systemd units, restart=always. Cron fires every 6 hours."
}
EOF

  cd "$ROOT"
  git pull --rebase --autostash origin master 2>&1 | tail -3
  git add docs/vps-runs/latest.json
  if ! git diff --cached --quiet; then
    git commit -m "vps-cron: bounty $bountyId completed in ${elapsed:-?}s (autonomous run $ts)"
    git push origin master 2>&1 | tail -3
  fi
fi

exit 0
