# Hetzner VPS — AXL Cross-ISP Mesh Setup

> Spike 2b: prove that AXL (Yggdrasil overlay) works across ISPs by running one node
> on the laptop (TR residential ISP, behind NAT) and one on a public-IP VPS in Frankfurt.
> The on-stage demo runs the same way: laptop runs the Planner / Critic / Synthesizer,
> Hetzner runs Researcher 1 + Researcher 2, and they coordinate over AXL.

---

## 1. Provisioning

| Setting       | Value                                  |
|---------------|----------------------------------------|
| Provider      | Hetzner Cloud (https://console.hetzner.cloud) |
| Plan          | **CX22** (€4.51/mo, 2 vCPU, 4 GB RAM, 40 GB SSD) — overkill for AXL but cheapest 4 GB |
| Region        | **Frankfurt (fsn1)** — closest EU region to Istanbul, low RTT |
| Image         | Ubuntu 22.04 LTS                       |
| SSH key       | Upload your laptop pubkey at create time |
| Firewall rule | Inbound `tcp/9001` (AXL listener) + `tcp/22` (SSH) |
| Server name   | `scholar-swarm-axl-fsn1`               |

After create, write the public IPv4 down — that goes into the laptop's
`Peers` list and into `.env::AXL_BOOTSTRAP_PEERS`.

---

## 2. First-boot hardening (one-shot)

```bash
ssh root@<HETZNER_IP>

# Create a non-root user for the AXL node
adduser --disabled-password --gecos "" axl
usermod -aG sudo axl
mkdir -p /home/axl/.ssh
cp ~/.ssh/authorized_keys /home/axl/.ssh/
chown -R axl:axl /home/axl/.ssh

# Lock down SSH
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload ssh

# UFW: only AXL listener + SSH
apt-get update && apt-get install -y ufw
ufw allow 22/tcp
ufw allow 9001/tcp
ufw --force enable
```

---

## 3. Build AXL on the VPS

The Hetzner side builds from source — we don't ship `node.exe` to a Linux box.

```bash
ssh axl@<HETZNER_IP>

# Go toolchain (AXL is Go 1.22+)
wget https://go.dev/dl/go1.22.5.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.5.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc && source ~/.bashrc

# Clone AXL (Gensyn fork is what's vendored under infra/axl/)
git clone https://github.com/gensyn-ai/axl ~/axl
cd ~/axl
go build -o node ./cmd/node/

# Generate a persistent identity
openssl genpkey -algorithm ed25519 -out private.pem
chmod 600 private.pem
```

---

## 4. `node-config.json` on Hetzner

Hetzner is the **public listener** — it's where laptop dials in. So `Listen` is set, `Peers` is empty.

```json
{
  "PrivateKeyPath": "private.pem",
  "Peers": [],
  "Listen": ["tls://0.0.0.0:9001"],
  "api_port": 9002,
  "bridge_addr": "127.0.0.1",
  "router_addr": "http://127.0.0.1",
  "router_port": 9003,
  "a2a_addr": "http://127.0.0.1",
  "a2a_port": 9004
}
```

`bridge_addr` stays on `127.0.0.1` — only the AXL TCP listener (`tcp/9001`) is exposed
to the internet. The HTTP API on `9002` is loopback-only and reached via SSH tunnel
during operator work.

---

## 5. Run as a systemd service

```ini
# /etc/systemd/system/axl-node.service
[Unit]
Description=Scholar Swarm AXL Node
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=axl
WorkingDirectory=/home/axl/axl
ExecStart=/home/axl/axl/node -config /home/axl/axl/node-config.json
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now axl-node
sudo systemctl status axl-node
journalctl -u axl-node -f   # watch peer discovery + handshake
```

The startup logs print this node's Yggdrasil peer ID — copy it, you'll need it
for `AXL_PEER_ID` on the laptop side and to verify mesh membership in `/peers`.

---

## 6. Laptop side (`infra/axl/node-config.json`)

The laptop is the **dialer** — it has no public IP, so `Listen` is empty and `Peers`
points at Hetzner.

```json
{
  "PrivateKeyPath": "private.pem",
  "Peers": ["tls://<HETZNER_IP>:9001"],
  "Listen": [],
  "api_port": 9002,
  "bridge_addr": "127.0.0.1",
  "router_addr": "http://127.0.0.1",
  "router_port": 9003
}
```

Then update `.env`:

```
AXL_BOOTSTRAP_PEERS=tls://<HETZNER_IP>:9001
AXL_PEER_ID=<HETZNER_PEER_ID_FROM_LOGS>
```

Restart `infra/axl/node.exe -config infra/axl/node-config.json` on the laptop.

---

## 7. Verify cross-ISP mesh (Spike 2b)

From the laptop:

```bash
# 1. Peer count > 0 means handshake succeeded
curl -s http://127.0.0.1:9002/peers | jq

# 2. Send a hello to Hetzner peer
curl -s -X POST http://127.0.0.1:9002/send \
  -H "content-type: application/json" \
  -d '{"peer_id":"<HETZNER_PEER_ID>","data":"hello from istanbul"}'

# 3. On Hetzner, tail journal — message should appear in /recv stream
ssh axl@<HETZNER_IP> "curl -s http://127.0.0.1:9002/recv?n=1 | jq"
```

When both directions succeed (laptop → Hetzner AND Hetzner → laptop reply), Spike 2b
is PASS — flip the row in `docs/spike-results.md` and run
`scripts/spike-03-mcp-axl.ts` against the cross-ISP pair to repeat MCP-over-AXL
across real internet.

---

## 8. Demo-day checklist

- [ ] Hetzner systemd service stays up across reboots (`systemctl is-enabled axl-node`)
- [ ] UFW shows `22/tcp ALLOW` and `9001/tcp ALLOW` only
- [ ] Laptop `/peers` lists Hetzner peer ID
- [ ] Round-trip `/send` → `/recv` < 200 ms (Frankfurt ↔ Istanbul typical)
- [ ] If laptop network drops, AXL auto-reconnects on next packet (no manual restart)

---

## 9. Cost / teardown

- CX22 in Frankfurt: ~€0.007/hour, or **€4.51/mo capped**.
- The hackathon submission window is May 3 → ~10 days max active = **<€2 total**.
- After demo: `hcloud server delete scholar-swarm-axl-fsn1` (or click delete in console).
- Backups not needed — the only state on the box is `private.pem`, which is regenerated
  if we ever respin the node.
