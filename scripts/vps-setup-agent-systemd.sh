#!/usr/bin/env bash
# Set up systemd units for the 5 agent runtimes on the VPS.
# Each unit: EnvironmentFile=.env (shared secrets) + per-unit Environment= overrides.
set -euo pipefail

ROOT=/opt/scholar-swarm
TSX_BIN=$(realpath $ROOT/node_modules/.bin/tsx)
echo "tsx binary: $TSX_BIN"

write_unit() {
  local role=$1
  local pkg=$2
  local exec_args=$3
  local env_block=$4

  cat > /etc/systemd/system/scholar-agent-$role.service <<EOF
[Unit]
Description=Scholar Swarm agent runtime — $role
After=scholar-axl-$role.service
Requires=scholar-axl-$role.service

[Service]
Type=simple
User=root
WorkingDirectory=$ROOT
EnvironmentFile=$ROOT/.env
$env_block
ExecStart=$TSX_BIN apps/$pkg/src/index.ts
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/scholar-agent-$role.log
StandardError=append:/var/log/scholar-agent-$role.log

[Install]
WantedBy=multi-user.target
EOF
  echo "wrote scholar-agent-$role.service"
}

write_unit planner agent-planner "" \
  'Environment="AXL_ENDPOINT=http://127.0.0.1:9101"
Environment="BID_WINDOW_MS=120000"'

write_unit r1 agent-researcher "" \
  'Environment="RESEARCHER_NUMBER=1"
Environment="AXL_ENDPOINT_RESEARCHER_1=http://127.0.0.1:9102"'

write_unit r2 agent-researcher "" \
  'Environment="RESEARCHER_NUMBER=2"
Environment="AXL_ENDPOINT_RESEARCHER_2=http://127.0.0.1:9103"'

write_unit critic agent-critic "" \
  'Environment="AXL_ENDPOINT=http://127.0.0.1:9104"'

write_unit synth agent-synthesizer "" \
  'Environment="AXL_ENDPOINT=http://127.0.0.1:9105"'

systemctl daemon-reload
for r in planner r1 r2 critic synth; do
  systemctl enable --now scholar-agent-$r.service 2>&1 | tail -1
done

sleep 8
echo ""
echo "=== Status ==="
for r in planner r1 r2 critic synth; do
  st=$(systemctl is-active scholar-agent-$r.service)
  echo "  scholar-agent-$r: $st"
done
echo ""
echo "=== First 4 lines from each log ==="
for r in planner r1 r2 critic synth; do
  echo "--- $r ---"
  head -4 /var/log/scholar-agent-$r.log 2>/dev/null || echo "(no log yet)"
done
