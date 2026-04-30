#!/usr/bin/env bash
# Boot all 5 AXL nodes on the VPS, harvest peer IDs into a JSON file.
# Run on the VPS as root from /opt/scholar-swarm.
set -euo pipefail

cd /opt/scholar-swarm/infra

# Kill any stale instances
pkill -f "axl-node-(planner|r1|r2|critic|synth)/node" 2>/dev/null || true
sleep 2

declare -A PORTS=( [planner]=9101 [r1]=9102 [r2]=9103 [critic]=9104 [synth]=9105 )

# Boot all 5
for r in planner r1 r2 critic synth; do
  cd /opt/scholar-swarm/infra/axl-node-$r
  rm -f /tmp/axl-$r.log
  setsid nohup ./node -config node-config.json > /tmp/axl-$r.log 2>&1 < /dev/null &
  echo "boot $r (pid $!)"
done

cd /opt/scholar-swarm/infra
sleep 6

# Harvest peer IDs
echo ""
echo "=== Peer IDs ==="
out="{}"
for r in planner r1 r2 critic synth; do
  port=${PORTS[$r]}
  pk=$(curl -sS http://127.0.0.1:$port/topology 2>/dev/null \
       | grep -oE "\"our_public_key\":\"[a-f0-9]+\"" \
       | head -1 \
       | sed -E "s/.*\"([a-f0-9]+)\"/\1/")
  echo "  $r (api=$port): $pk"
done

echo ""
echo "=== Process status ==="
pgrep -af "axl-node-(planner|r1|r2|critic|synth)/node" | head -10
