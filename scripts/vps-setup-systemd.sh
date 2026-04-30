#!/usr/bin/env bash
# Set up systemd units for the 5 swarm AXL nodes on the VPS.
# Existing /etc/systemd/system/axl-node.service (the Spike 2b cross-ISP node)
# stays untouched — it runs on different ports (9001/9002).
set -euo pipefail

INFRA=/opt/scholar-swarm/infra

# Stop manual boots
pkill -f "axl-node-(planner|r1|r2|critic|synth)/node" 2>/dev/null || true
sleep 2

for r in planner r1 r2 critic synth; do
  cat > /etc/systemd/system/scholar-axl-$r.service <<EOF
[Unit]
Description=Scholar Swarm AXL node — $r
After=network-online.target axl-node.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INFRA/axl-node-$r
ExecStart=$INFRA/axl-node-$r/node -config node-config.json
Restart=always
RestartSec=5
StandardOutput=append:/var/log/scholar-axl-$r.log
StandardError=append:/var/log/scholar-axl-$r.log

[Install]
WantedBy=multi-user.target
EOF
  echo "wrote scholar-axl-$r.service"
done

systemctl daemon-reload
for r in planner r1 r2 critic synth; do
  systemctl enable --now scholar-axl-$r.service 2>&1 | tail -1
done

sleep 5
echo ""
echo "=== Status ==="
for r in planner r1 r2 critic synth; do
  st=$(systemctl is-active scholar-axl-$r.service)
  echo "  scholar-axl-$r: $st"
done
echo ""
echo "=== /topology pubkey check ==="
for r in planner r1 r2 critic synth; do
  port=""; case $r in planner) port=9101;; r1) port=9102;; r2) port=9103;; critic) port=9104;; synth) port=9105;; esac
  pk=$(curl -sS http://127.0.0.1:$port/topology 2>/dev/null | grep -oE "\"our_public_key\":\"[a-f0-9]+\"" | head -1)
  echo "  $r ($port): $pk"
done
