# Lab Deployment Guide — Patent Workbench

This guide serves as a basic framework for hosting Patent Workbench on a single GPU-equipped lab server, so that multiple users on the same network (or connected via VPN) can access it through a shared URL, such as `http://patent-workbench.lab` or `http://10.0.1.50/patent-workbench`.

The design goal is to centralise all compute on the server — LLM inference, the API layer, and the client bundle — so that **client machines only need a browser**. No Node.js, no Ollama, and no local GPU are required on individual workstations.

No cloud services are involved. Ollama, the Express server, and the client bundle all run on the same machine.

---

## Table of contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Step-by-step deployment](#step-by-step-deployment)
   - [1. Prepare the host](#1-prepare-the-host)
   - [2. Clone and build](#2-clone-and-build)
   - [3. Configure the server](#3-configure-the-server)
   - [4. Set up a reverse proxy (nginx)](#4-set-up-a-reverse-proxy-nginx)
   - [5. Keep the server running (PM2)](#5-keep-the-server-running-pm2)
   - [6. Pull Ollama models and tune for GPU](#6-pull-ollama-models-and-tune-for-gpu)
4. [Multi-user considerations](#multi-user-considerations)
5. [Security hardening](#security-hardening)
   - [Firewall (UFW)](#firewall-ufw)
   - [Lock down Ollama](#lock-down-ollama)
   - [Authentication layers](#authentication-layers)
   - [Credential rotation](#credential-rotation)
   - [Audit logging](#audit-logging)
6. [SSO Authentication (OAuth2/OIDC)](#sso-authentication-oauth2oidc)
   - [How it works](#how-it-works)
   - [Updated architecture](#updated-architecture)
   - [Option A — Authelia (self-hosted, no corporate IdP)](#option-a--authelia-self-hosted-no-corporate-idp)
   - [Option B — Corporate IdP (Azure AD, Okta, Google Workspace…)](#option-b--corporate-idp-azure-ad-okta-google-workspace)
   - [Install oauth2-proxy](#install-oauth2-proxy)
   - [Configure oauth2-proxy](#configure-oauth2-proxy)
   - [Update nginx](#update-nginx)
   - [Branded login page](#branded-login-page)
   - [Logout](#logout)
7. [Enhancements](#enhancements)
   - [MVP](#mvp)
   - [Idea scenario](#idea-scenario)
8. [Troubleshooting](#troubleshooting)

---

## Architecture

```
[ VPN / internal network ]
         │
         ▼
  ┌──────────────────────────────────────────┐
  │  Lab server  (e.g., 10.0.1.50)           │
  │                                          │
  │  nginx :80                               │
  │    /patent-workbench  → static files     │
  │    /api/*             → Express :3001    │
  │                                          │
  │  Express :3001  (localhost only)         │
  │    ↕ LLM proxy                           │
  │  Ollama :11434  (localhost only)         │
  │                                          │
  │  SQLite  ./data/workbench.db             │
  └──────────────────────────────────────────┘
```

nginx is the only process that binds to a public interface. The Express server and Ollama remain on loopback — users on the network never communicate with them directly.

---

## Prerequisites

**Lab server (one machine, shared by all users):**

| Component | Target spec | Notes |
| --- | --- | --- |
| GPU | NVIDIA RTX 3090 / A-series or better | CUDA 12+ required; VRAM determines which models fit |
| VRAM | 24 GB+ | Fits `qwen2.5:14b` or `phi4` with room for a 32 k context |
| System RAM | 64 GB+ | Headroom for the OS, Express, SQLite, and multiple concurrent sessions |
| OS | Ubuntu 22.04 LTS | Recommended; CUDA drivers available via `apt` |
| Disk | 60 GB+ free | Models are 5–20 GB each; allow space for several |
| Network | Gigabit NIC | Handles many concurrent WebSocket/HTTP connections without bottlenecking |

**Client machines (each user's workstation):**

A modern browser is the only requirement. No local install of Node.js, Ollama, or any GPU tooling is needed.

**Software to install on the lab server before starting:**

```bash
# NVIDIA CUDA drivers (if not already installed — check with `nvidia-smi`)
sudo apt-get install -y nvidia-driver-535 nvidia-cuda-toolkit

# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Ollama (auto-detects CUDA at install time)
curl -fsSL https://ollama.com/install.sh | sh

# nginx
sudo apt-get install -y nginx

# PM2 (global)
npm install -g pm2
```

Verify CUDA is visible to Ollama after install:

```bash
ollama run phi3:mini "hello"   # should show GPU layers in the log output
nvidia-smi                     # confirm GPU is not idle during inference
```

---

## Step-by-step deployment

### 1. Prepare the host

Choose a directory for the application (suggested: `/opt/patent-workbench`):

```bash
sudo mkdir -p /opt/patent-workbench
sudo chown $USER:$USER /opt/patent-workbench
```

Create a dedicated data directory for the SQLite database:

```bash
sudo mkdir -p /var/lib/patent-workbench
sudo chown $USER:$USER /var/lib/patent-workbench
```

---

### 2. Clone and build

```bash
cd /opt/patent-workbench
git clone https://github.com/your-org/patent-workbench.git .

# Install all dependencies
npm run setup

# Build the client bundle
npm run client:build
```

The client bundle is written to `client/dist/`. This is the static directory nginx will serve.

Build the server:

```bash
cd server
npm run build
cd ..
```

The compiled server is written to `server/dist/server.js`.

---

### 3. Configure the server

Copy the example environment file and edit it:

```bash
cp server/.env.example server/.env
nano server/.env
```

Key values to set for a lab deployment:

```dotenv
# Keep the server on loopback — nginx proxies to it
HOST=127.0.0.1
PORT=3001

# REQUIRED: match the HTTPS URL users will open in their browser
CORS_ORIGIN=https://patent-workbench.lab

# Tell Express it is behind a trusted proxy (enables correct IP for rate limiting)
TRUST_PROXY=true

NODE_ENV=production

# Point to the shared data directory
DATA_DIR=/var/lib/patent-workbench

# Ollama stays local — never change this to a public address
OLLAMA_URL=http://localhost:11434

# REQUIRED in a lab deployment — nginx injects this header transparently (see step 4)
# Generate with: openssl rand -hex 32
API_KEY=replace-with-a-strong-random-string

# Rate limits for multi-user lab use
RATE_MAX=200
GENERATE_RATE_MAX=50
```

> [!IMPORTANT]
> `API_KEY` is mandatory for a lab deployment. nginx injects it as a request header automatically (see step 4) — users never see or type it. Generate a strong value with `openssl rand -hex 32` and keep it out of version control.

---

### 4. Set up a reverse proxy (nginx)

#### 4a. TLS certificate

If your organisation has an internal CA, issue a certificate for the hostname (e.g., `patent-workbench.lab`) and skip to 4b. Otherwise, generate a self-signed certificate:

```bash
sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout /etc/ssl/private/patent-workbench.key \
  -out /etc/ssl/certs/patent-workbench.crt \
  -subj "/CN=patent-workbench.lab/O=Lab/C=US"
sudo chmod 600 /etc/ssl/private/patent-workbench.key
```

Distribute the `.crt` file to users' browsers / OS trust stores so they do not see a certificate warning.

#### 4b. Per-user HTTP Basic Auth

Install `htpasswd` and create credentials for each lab user:

```bash
sudo apt-get install -y apache2-utils

# First user (-c creates the file)
sudo htpasswd -c /etc/nginx/.htpasswd alice
# Additional users (no -c flag — appends)
sudo htpasswd /etc/nginx/.htpasswd bob
sudo htpasswd /etc/nginx/.htpasswd carol

sudo chmod 640 /etc/nginx/.htpasswd
sudo chown root:www-data /etc/nginx/.htpasswd
```

To revoke a user: `sudo htpasswd -D /etc/nginx/.htpasswd bob`

#### 4c. nginx site configuration

```bash
sudo nano /etc/nginx/sites-available/patent-workbench
```

```nginx
# Redirect plain HTTP to HTTPS
server {
    listen 80;
    server_name patent-workbench.lab;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name patent-workbench.lab;   # or the server's IP

    ssl_certificate     /etc/ssl/certs/patent-workbench.crt;
    ssl_certificate_key /etc/ssl/private/patent-workbench.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;

    # Per-user authentication (applied to the whole server block)
    auth_basic "Patent Workbench — Authorised Access Only";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # Serve the client bundle
    location /patent-workbench {
        alias /opt/patent-workbench/client/dist;
        try_files $uri $uri/ /patent-workbench/index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # Proxy API requests to the Express server
    location /api/ {
        proxy_pass         http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 360s;

        # Inject the API key — users never see or type it
        proxy_set_header   x-api-key         "replace-with-your-API_KEY-value";
    }
}
```

> [!IMPORTANT]
> The `x-api-key` value in the nginx config must match `API_KEY` in `server/.env` exactly. This way the Express server validates every request, but users authenticate only once via the Basic Auth prompt — they are never exposed to the key itself.

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/patent-workbench /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### 5. Keep the server running (PM2)

```bash
cd /opt/patent-workbench/server

# Start the compiled server and register it with PM2
pm2 start dist/server.js --name patent-workbench --env production

# Persist across reboots
pm2 save
pm2 startup   # follow the printed instructions to register the PM2 systemd service
```

Useful PM2 commands:

```bash
pm2 status                       # check running processes
pm2 logs patent-workbench        # stream logs
pm2 restart patent-workbench     # restart after config change
pm2 stop patent-workbench        # stop
```

---

### 6. Pull Ollama models and tune for GPU

#### Choose models for your VRAM

On a well-equipped GPU server you can run significantly larger models than a typical developer laptop. Larger models produce noticeably better patent text.

| Model | VRAM needed | Quality | Notes |
| --- | --- | --- | --- |
| `qwen2.5:14b` | ~10 GB | Excellent | Best overall for patent generation; **recommended for the lab** |
| `phi4` | ~10 GB | Excellent | Strong reasoning; good alternative to qwen2.5:14b |
| `qwen2.5:32b` | ~20 GB | Outstanding | Preferred if VRAM allows; noticeably better Full Description output |
| `llama3.1:8b` | ~6 GB | Good | Fast fallback; useful if the primary model is busy |
| `qwen2.5:7b` | ~5 GB | Good | Minimum recommended quality; avoid on a GPU lab if larger fits |

```bash
ollama pull qwen2.5:14b   # primary
ollama pull phi4          # alternative
ollama pull llama3.1:8b   # fast fallback
```

#### Set a high context length (Modelfile)

Patent Workbench enables context file uploads only when the selected model reports `num_ctx ≥ 16 384`. On a GPU server with large VRAM you can set this well above the default and unlock full context file support for all users.

Create a custom Modelfile for the primary model:

```bash
cat > /tmp/Modelfile.qwen14b << 'EOF'
FROM qwen2.5:14b
PARAMETER num_ctx 32768
EOF

ollama create qwen2.5:14b-lab -f /tmp/Modelfile.qwen14b
```

Use `qwen2.5:14b-lab` as the default model in `server/.env`:

```dotenv
DEFAULT_MODEL=qwen2.5:14b-lab
```

With 24 GB VRAM you can safely push `num_ctx` to `32768`. With 48 GB+ you can go to `65536`, which comfortably fits a full workflow session (~8 800 tokens) plus large reference documents.

#### Tune Ollama for concurrent users

By default Ollama processes one request at a time. On a multi-user lab you want it to handle several simultaneous generations. Override the Ollama systemd service:

```bash
sudo systemctl edit ollama
```

Add the following and save:

```ini
[Service]
Environment="OLLAMA_NUM_PARALLEL=4"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_FLASH_ATTENTION=1"
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

| Variable | Value | Effect |
| --- | --- | --- |
| `OLLAMA_NUM_PARALLEL` | `4` | Processes up to 4 generation requests concurrently instead of queuing them |
| `OLLAMA_MAX_LOADED_MODELS` | `2` | Keeps two models warm in VRAM — eliminates the cold-load delay when users switch models |
| `OLLAMA_FLASH_ATTENTION` | `1` | Enables Flash Attention 2 on CUDA — reduces VRAM usage and increases throughput for long contexts |

> [!NOTE]
> `OLLAMA_NUM_PARALLEL=4` works well with 24 GB VRAM and a 14B model at `num_ctx 32768`. Monitor VRAM usage with `nvidia-smi` and reduce the value if the GPU runs out of memory.

Users can switch models from the Settings panel in the app at any time, as long as the model is already pulled on the host.

---

## Multi-user considerations

| Topic | Behaviour |
| --- | --- |
| **Session isolation** | Each browser session has its own draft history stored in the shared SQLite database. Users cannot see each other's sessions. |
| **Concurrent LLM requests** | With `OLLAMA_NUM_PARALLEL=4` (see step 6), Ollama handles up to 4 simultaneous generation requests without queuing. Beyond that, excess requests queue briefly — latency grows only when all parallel slots are occupied. |
| **VRAM pressure** | Each parallel slot holds a separate KV cache for the active request. Monitor with `nvidia-smi`; if VRAM is exhausted reduce `OLLAMA_NUM_PARALLEL` or lower `num_ctx`. |
| **SQLite concurrency** | The database runs in WAL mode, which safely handles concurrent reads alongside writes. |
| **Rate limiting** | The defaults (20 `/generate` calls per minute per IP) are typically too low for a busy lab. The `.env` example above sets `GENERATE_RATE_MAX=50`; increase further if needed. |
| **Context files** | Each session manages its own uploaded context files in memory. Files are not shared across sessions or stored on disk beyond the session. |
| **Client requirements** | Users need only a browser — no local install of Node.js, Ollama, or GPU drivers. All compute runs on the lab server. |

---

## Security hardening

The steps below are **required**, not optional. The lab server handles confidential invention disclosures — treat it accordingly.

### Firewall (UFW)

Block all inbound traffic except HTTPS from the VPN/internal subnet and SSH for administration:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow HTTPS only from the VPN / internal subnet
sudo ufw allow from 10.0.1.0/24 to any port 443 proto tcp

# Allow SSH for server administration (restrict to admin IPs if possible)
sudo ufw allow from 10.0.1.0/24 to any port 22 proto tcp

sudo ufw enable
sudo ufw status verbose
```

Port 80 is intentionally omitted — the nginx HTTP→HTTPS redirect (step 4) runs on port 80 **only inside the server** (localhost); it is not exposed to the network.

### Lock down Ollama

Ollama must never be reachable from the network. Verify that its systemd unit binds only to loopback:

```bash
sudo systemctl cat ollama | grep -i "OLLAMA_HOST\|ListenStream"
```

If `OLLAMA_HOST` is set to anything other than `127.0.0.1`, override it:

```bash
sudo systemctl edit ollama
# Add under [Service]:
# Environment="OLLAMA_HOST=127.0.0.1:11434"
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

Confirm it is not listening on a public interface:

```bash
ss -tlnp | grep 11434   # should show 127.0.0.1:11434 only
```

### Authentication layers

The deployment uses two independent authentication layers. Both must be in place:

| Layer | Mechanism | What it protects |
| --- | --- | --- |
| **1 — Per-user login** | nginx HTTP Basic Auth (htpasswd) | Entire app — no page loads or API calls reach the backend without a valid credential |
| **2 — API secret** | `x-api-key` header injected by nginx, validated by Express | Ensures the Express server only accepts requests forwarded by the authorised nginx instance, blocking direct bypass attempts |

Layer 1 gives individual user control (add/revoke per person). Layer 2 ensures that even if someone discovers the server's IP and port 3001, they cannot call the API without the shared secret.

> [!TIP]
> When you upgrade Layer 1 from Basic Auth to OAuth2/OIDC via `oauth2-proxy`, the Patent Workbench login screen shown to users can be replaced with a fully branded page that matches the app's visual identity. Drop the ready-made templates from [docs/oauth2-login-customisation.md](oauth2-login-customisation.md) into `/opt/oauth2-proxy/templates/` and point `custom-templates-path` at that directory — no app code changes required. The in-app demo component (`VITE_DEMO_OAUTH`) is a separate development tool and plays no role in this flow.

### Credential rotation

```bash
# Rotate API_KEY
openssl rand -hex 32   # generate a new value

# 1. Update server/.env
# 2. Update the x-api-key line in the nginx site config
# 3. Reload both services
pm2 restart patent-workbench
sudo systemctl reload nginx
```

Rotate the API key any time a team member leaves or a suspected exposure occurs. User passwords are rotated individually:

```bash
sudo htpasswd /etc/nginx/.htpasswd alice   # prompts for new password
```

### Audit logging

The Express server logs every request at `info` level by default. For a lab deployment, consider increasing to `debug` to capture model names and token counts per user session:

```dotenv
LOG_LEVEL=debug
```

Logs are written to stdout and captured by PM2. Retrieve them with:

```bash
pm2 logs patent-workbench --lines 500
```

---

## SSO Authentication (OAuth2/OIDC)

This section describes how to replace nginx Basic Auth (Layer 1) with a proper SSO login backed by OAuth2/OIDC. Layer 2 (the `x-api-key` API secret) remains unchanged — only the user-facing authentication mechanism changes.

**The Patent Workbench application code requires no modifications.** The app never handles auth logic itself; it only ever sees requests that have already been authenticated and forwarded by the proxy.

---

### How it works

`oauth2-proxy` is placed between nginx and the rest of the stack. nginx delegates every request to oauth2-proxy via the `auth_request` directive before serving it. The flow is:

1. User navigates to `https://patent-workbench.lab/patent-workbench`.
2. nginx calls `oauth2-proxy` to check whether the request carries a valid session cookie.
3. If no valid session: oauth2-proxy redirects the browser to the IdP login page (Authelia or corporate IdP).
4. User authenticates at the IdP.
5. IdP redirects back to `oauth2-proxy`'s callback URL with an authorization code.
6. oauth2-proxy exchanges the code for tokens, sets an encrypted session cookie, and redirects the user to the original URL.
7. Subsequent requests carry the session cookie — oauth2-proxy validates it and passes the request through with `X-Forwarded-User` / `X-Forwarded-Email` headers.
8. nginx forwards the request (with the `x-api-key` injected) to Express. The app receives it as an already-authenticated request.

---

### Updated architecture

```
[ VPN / internal network ]
         │
         ▼
  ┌────────────────────────────────────────────────┐
  │  Lab server  (e.g., 10.0.1.50)                 │
  │                                                │
  │  nginx :443                                    │
  │    auth_request → oauth2-proxy :4180           │
  │    /patent-workbench  → static files           │
  │    /api/*             → Express :3001          │
  │    /oauth2/*          → oauth2-proxy :4180     │
  │                                                │
  │  oauth2-proxy :4180   (loopback only)          │
  │    ↕ OIDC / OAuth2                             │
  │  Authelia :9091       (loopback only)    ─┐    │
  │    or corporate IdP (external)            │    │
  │                                           └─── │
  │  Express :3001        (loopback only)          │
  │    ↕ LLM proxy                                 │
  │  Ollama :11434        (loopback only)          │
  │                                                │
  │  SQLite  ./data/workbench.db                   │
  └────────────────────────────────────────────────┘
```

---

### Option A — Authelia (self-hosted, no corporate IdP)

Use this when the lab has no existing identity provider. Authelia is a self-hosted authentication and authorisation server that supports local users, LDAP, TOTP, and WebAuthn, and exposes a standards-compliant OIDC endpoint that oauth2-proxy can consume.

**Install Authelia:**

```bash
# Download the latest release binary
AUTHELIA_VERSION=4.38.9
wget https://github.com/authelia/authelia/releases/download/v${AUTHELIA_VERSION}/authelia-linux-amd64.tar.gz
tar xf authelia-linux-amd64.tar.gz
sudo mv authelia /usr/local/bin/authelia
sudo chmod +x /usr/local/bin/authelia

# Create config and data directories
sudo mkdir -p /etc/authelia /var/lib/authelia
sudo chown $USER:$USER /etc/authelia /var/lib/authelia
```

**Minimal `/etc/authelia/configuration.yml`:**

```yaml
server:
  host: 127.0.0.1
  port: 9091

log:
  level: info

jwt_secret: replace-with-openssl-rand-hex-32

default_redirection_url: https://patent-workbench.lab/patent-workbench

authentication_backend:
  file:
    path: /var/lib/authelia/users.yml

session:
  secret: replace-with-openssl-rand-hex-32
  domain: patent-workbench.lab
  expiration: 8h
  inactivity: 1h

storage:
  local:
    path: /var/lib/authelia/authelia.db

notifier:
  filesystem:
    filename: /var/lib/authelia/notifications.txt   # replace with SMTP in production

identity_providers:
  oidc:
    hmac_secret: replace-with-openssl-rand-hex-32
    issuer_private_key: /etc/authelia/oidc.pem      # generate below
    clients:
      - id: patent-workbench
        secret: replace-with-openssl-rand-hex-32    # bcrypt hash in production
        redirect_uris:
          - https://patent-workbench.lab/oauth2/callback
        scopes: [openid, profile, email]
        grant_types: [authorization_code]
        response_types: [code]
```

**Generate the OIDC signing key:**

```bash
openssl genrsa -out /etc/authelia/oidc.pem 4096
```

**Create user accounts** in `/var/lib/authelia/users.yml`:

```yaml
users:
  alice:
    displayname: Alice Researcher
    password: "$argon2id$..."   # generate with: authelia crypto hash generate argon2
    email: alice@lab.internal
    groups: [lab-users]
  bob:
    displayname: Bob Engineer
    password: "$argon2id$..."
    email: bob@lab.internal
    groups: [lab-users]
```

**Run Authelia as a systemd service:**

```bash
sudo tee /etc/systemd/system/authelia.service > /dev/null <<'EOF'
[Unit]
Description=Authelia authentication server
After=network.target

[Service]
User=www-data
ExecStart=/usr/local/bin/authelia --config /etc/authelia/configuration.yml
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now authelia
sudo systemctl status authelia
```

---

### Option B — Corporate IdP (Azure AD, Okta, Google Workspace…)

If the organisation already has an OIDC-capable IdP, skip Authelia entirely. Register a new application in the IdP's admin console and obtain:

- **Client ID**
- **Client secret**
- **Issuer URL** (e.g., `https://login.microsoftonline.com/{tenant-id}/v2.0` for Azure AD)

Set the redirect URI to `https://patent-workbench.lab/oauth2/callback`.

Everything else (oauth2-proxy config, nginx config) is identical to Option A — only the `--provider` and `--oidc-issuer-url` values change.

| IdP | `--provider` | `--oidc-issuer-url` |
| --- | --- | --- |
| Azure AD | `oidc` | `https://login.microsoftonline.com/{tenant-id}/v2.0` |
| Google Workspace | `google` | *(not needed — provider handles discovery)* |
| Okta | `oidc` | `https://{your-domain}.okta.com` |
| Generic OIDC | `oidc` | Your IdP's discovery URL |

> [!NOTE]
> For Azure AD, also pass `--allowed-group` with the object ID of the AD group that should have access, so that users outside the group cannot log in even if they have valid Azure credentials.

---

### Install oauth2-proxy

```bash
VERSION=7.6.0
wget https://github.com/oauth2-proxy/oauth2-proxy/releases/download/v${VERSION}/oauth2-proxy-v${VERSION}.linux-amd64.tar.gz
tar xf oauth2-proxy-v${VERSION}.linux-amd64.tar.gz
sudo mv oauth2-proxy-v${VERSION}.linux-amd64/oauth2-proxy /usr/local/bin/
sudo chmod +x /usr/local/bin/oauth2-proxy
```

---

### Configure oauth2-proxy

Create `/etc/oauth2-proxy/oauth2-proxy.cfg`:

```ini
# --- Provider (Option A: Authelia) ---
provider = "oidc"
oidc-issuer-url = "https://patent-workbench.lab/authelia"
# For Option B, replace with your IdP's issuer URL

# --- Application credentials ---
client-id = "patent-workbench"
client-secret = "replace-with-your-oidc-client-secret"

# --- Session ---
cookie-secret = "replace-with-openssl-rand-base64-32"   # must be 16, 24, or 32 bytes
cookie-secure = true
cookie-domain = ".patent-workbench.lab"
cookie-expire = "8h"

# --- Upstream (what to protect) ---
# oauth2-proxy sits in front of nginx's auth_request — no upstream needed here
upstreams = ["http://127.0.0.1:4181"]   # dummy; actual proxying is done by nginx

# --- Network ---
http-address = "127.0.0.1:4180"

# --- Access control ---
# Restrict by email domain (remove if using Authelia with explicit user list)
# email-domain = "lab.internal"

# --- Callbacks ---
redirect-url = "https://patent-workbench.lab/oauth2/callback"

# --- Branded login page ---
custom-templates-path = "/opt/oauth2-proxy/templates"
# See docs/oauth2-login-customisation.md for the ready-made templates

# --- Optional labels shown on the login page ---
banner = "Lab access only — contact your administrator to request an account."
footer = "Patent Workbench · Internal use only"
provider-display-name = "Authelia"   # shown as "Sign in with Authelia"
```

Generate the cookie secret:

```bash
openssl rand -base64 32
```

**Run oauth2-proxy as a systemd service:**

```bash
sudo mkdir -p /etc/oauth2-proxy
sudo tee /etc/systemd/system/oauth2-proxy.service > /dev/null <<'EOF'
[Unit]
Description=oauth2-proxy
After=network.target

[Service]
User=www-data
ExecStart=/usr/local/bin/oauth2-proxy --config /etc/oauth2-proxy/oauth2-proxy.cfg
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now oauth2-proxy
sudo systemctl status oauth2-proxy
```

---

### Update nginx

Replace the `auth_basic` directives in the nginx site config with `auth_request` delegation to oauth2-proxy. The `x-api-key` injection on `/api/` remains unchanged.

```nginx
server {
    listen 443 ssl;
    server_name patent-workbench.lab;

    ssl_certificate     /etc/ssl/certs/patent-workbench.crt;
    ssl_certificate_key /etc/ssl/private/patent-workbench.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;

    # ── oauth2-proxy internal endpoint ──────────────────────────────────────
    location /oauth2/ {
        proxy_pass       http://127.0.0.1:4180;
        proxy_set_header Host                    $host;
        proxy_set_header X-Real-IP               $remote_addr;
        proxy_set_header X-Forwarded-For         $proxy_add_x_forwarded_for;
        proxy_set_header X-Auth-Request-Redirect $scheme://$host$request_uri;
    }

    # Internal auth check called by auth_request — must return 2xx or 4xx only
    location = /oauth2/auth {
        proxy_pass       http://127.0.0.1:4180;
        proxy_set_header Host             $host;
        proxy_set_header X-Real-IP        $remote_addr;
        proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
        proxy_set_header Content-Length   "";
        proxy_pass_request_body           off;
    }

    # ── Client bundle (protected) ────────────────────────────────────────────
    location /patent-workbench {
        auth_request /oauth2/auth;
        # On 401, redirect to the oauth2-proxy sign-in page
        error_page 401 = /oauth2/sign_in;
        # Forward identity headers set by oauth2-proxy into the app (optional)
        auth_request_set $user  $upstream_http_x_auth_request_user;
        auth_request_set $email $upstream_http_x_auth_request_email;
        proxy_set_header X-Forwarded-User  $user;
        proxy_set_header X-Forwarded-Email $email;

        alias /opt/patent-workbench/client/dist;
        try_files $uri $uri/ /patent-workbench/index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # ── API (protected) ──────────────────────────────────────────────────────
    location /api/ {
        auth_request /oauth2/auth;
        error_page 401 = /oauth2/sign_in;

        proxy_pass         http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 360s;

        # Layer 2 API secret — unchanged from the Basic Auth setup
        proxy_set_header   x-api-key         "replace-with-your-API_KEY-value";
    }
}
```

Reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

### Branded login page

Patent Workbench ships ready-made `sign_in.html` and `error.html` templates that replace oauth2-proxy's default pages with the app's visual identity. To apply them:

```bash
sudo mkdir -p /opt/oauth2-proxy/templates
# Copy the templates from docs/oauth2-login-customisation.md into this directory
sudo systemctl restart oauth2-proxy
```

Full instructions, variable reference, and the complete template HTML are in [docs/oauth2-login-customisation.md](oauth2-login-customisation.md).

> [!NOTE]
> The in-app React component (`VITE_DEMO_OAUTH=true`) is a separate development tool that previews the login UI inside the Vite dev server. It plays no role in the production auth flow — the page users actually see is the `sign_in.html` template served by oauth2-proxy.

---

### Logout

oauth2-proxy provides a `/oauth2/sign_out` endpoint that clears the session cookie. To give users a logout link:

1. Add a logout URL to the app (or simply tell users to navigate there directly):
   `https://patent-workbench.lab/oauth2/sign_out?rd=https://patent-workbench.lab/oauth2/sign_in`

2. After clearing the cookie, oauth2-proxy redirects to the `rd` URL, which triggers re-authentication.

3. To also invalidate the session at the IdP level (full SSO logout), configure `--oidc-extra-audience` and use the IdP's end-session endpoint as the redirect destination. For Authelia this is:
   `https://patent-workbench.lab/authelia/api/oidc/end-session`

---

## Enhancements

### MVP

Items that should be in place before the lab is considered stable and ready for regular use. None require changes to the application code.

| Enhancement | Why it matters | Approach |
| --- | --- | --- |
| **OAuth2/OIDC authentication** | Basic Auth has no sessions, no logout, and no MFA. OAuth integrates with the corporate IdP so users log in with existing credentials and access is revoked centrally when someone leaves. | Deploy [`oauth2-proxy`](https://oauth2-proxy.github.io/oauth2-proxy/) in front of nginx. `oauth2-proxy` serves its own login page and handles the full auth flow — unauthenticated users are redirected to it automatically before any request reaches Patent Workbench. **The Patent Workbench app itself requires no login screen or auth code changes** — it only ever sees already-authenticated requests forwarded by the proxy. If no corporate IdP exists, use [Authelia](https://www.authelia.com/) as a self-hosted OIDC provider with its own login portal. Patent Workbench ships a branded `sign_in.html` / `error.html` template pair that replaces oauth2-proxy's default pages with the app's visual identity; see [docs/oauth2-login-customisation.md](oauth2-login-customisation.md) for the full setup. The app also includes an in-app demo component (`VITE_DEMO_OAUTH=true`) for previewing the login flow during development — this is unrelated to the proxy and is never active in production. |
| **Automated SQLite backups** | The database holds every user's draft history. Disk failure or an accidental `rm` means permanent data loss with no recovery path. | Cron job: `sqlite3 /var/lib/patent-workbench/workbench.db ".backup '/backups/workbench-$(date +%F).db'"` — run nightly, keep 7 days, store on a separate volume or NAS. |
| **PM2 log rotation** | PM2 logs grow unbounded and will fill the disk, causing the server to crash silently after weeks of use. | `pm2 install pm2-logrotate` then `pm2 set pm2-logrotate:max_size 50M` and `pm2 set pm2-logrotate:retain 14`. |
| **Health monitoring** | When Ollama or the Express process dies, users see a red status badge with no explanation. There is no alerting mechanism by default. | Use `uptime-kuma` (lightweight, self-hosted) or a simple cron that calls `GET /status` and sends an email/Slack alert on failure. |
| **Reproducible model setup script** | After a server rebuild, models need to be manually re-pulled and Modelfiles recreated. This is error-prone and slows recovery. | A small shell script that runs `ollama pull`, creates the Modelfile, and verifies `num_ctx` — checked into the repo and run as part of provisioning. |

---

### Idea scenario

Longer-term improvements that go beyond the initial lab setup. These would increase adoption, quality, and operational visibility as usage grows.

| Enhancement | Value | Notes |
| --- | --- | --- |
| **Per-user usage dashboard** | Shows token consumption, session count, and generation history per person — useful for capacity planning and understanding how the tool is being adopted. | Requires structured logging (JSON) piped into a lightweight store (SQLite or InfluxDB) + a simple read-only dashboard (Grafana or a custom page). |
| **Docker Compose deployment** | Eliminates manual dependency management, makes upgrades a single `docker compose pull && docker compose up -d`, and simplifies onboarding a second lab server. | Requires containerising the Express server and writing a Compose file that wires Ollama, Express, nginx, and optional oauth2-proxy together. |
| **Multi-GPU / multi-node load balancing** | A single GPU becomes a bottleneck once 10+ users are actively generating. Distributing inference across nodes removes the ceiling. | Run one Ollama instance per GPU node; put an Ollama-aware load balancer (or a simple nginx upstream block with `least_conn`) in front of them. |
| **Department-specific REG templates** | Different teams (software, hardware, biotech) have different patent styles, terminology, and jurisdictional requirements. A single template is a compromise for all of them. | Already supported by `reg-templates.json` — serve a different JSON file per team via a URL parameter or subdomain, loaded by the client at startup. |
| **Export to patent management software** | Finished artifacts currently export as `.docx` or `.md`. Integrating with tools like Anaqua, CPA Global, or internal IP databases would remove the manual import step. | Implement a new export endpoint on the Express server that formats the artifact as the target system's API payload. |
| **Collaborative drafting** | Currently, sessions are strictly per-user. Co-inventors working on the same IDF must share a session externally (copy-paste). | Would require a real-time sync layer (e.g., WebSockets + CRDT) on top of the existing session model — significant but well-defined scope. |
| **Fine-tuning on internal patent corpus** | A general-purpose model like `qwen2.5:14b` is trained on public data. A model fine-tuned on the company's accepted patents would produce output already aligned with internal style and terminology. | Requires curating an internal training set and running a LoRA fine-tune (feasible on the lab GPU with tools like `unsloth`). The resulting adapter is loaded by Ollama as a custom model. |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Browser shows a blank page at `/patent-workbench` | nginx `alias` path is wrong | Confirm `client/dist/index.html` exists; check nginx error log (`/var/log/nginx/error.log`) |
| Status badge stays red (LLM unreachable) | Ollama not running, or `OLLAMA_URL` is wrong | `systemctl status ollama`; confirm `curl http://localhost:11434` returns a response |
| CORS error in browser console | `CORS_ORIGIN` does not match the URL in the browser | Set `CORS_ORIGIN` to the exact origin (`http://10.0.1.50`) — no trailing slash |
| 429 Too Many Requests | Rate limit too low for concurrent users | Increase `GENERATE_RATE_MAX` in `.env` and restart PM2 |
| Browser shows a login prompt but correct credentials are rejected | Password file path wrong in nginx, or file permissions deny `www-data` | `sudo nginx -t`; confirm `chown root:www-data /etc/nginx/.htpasswd` and `chmod 640` |
| 401 on API calls even after login | `x-api-key` in nginx config does not match `API_KEY` in `.env` | Copy the exact value — no extra spaces or quotes; `pm2 restart` after changing `.env` |
| Context file upload disabled in the UI | Model's `num_ctx` is below 16 384 | Create a Modelfile with `PARAMETER num_ctx 32768` (see step 6) and use the custom model name |
| Ollama running on CPU instead of GPU | CUDA driver not found, or Ollama installed before CUDA | `nvidia-smi` to verify driver; reinstall Ollama after CUDA; check `ollama logs` for `CUDA not found` |
| Ollama reachable from the network (port scan shows 11434 open) | `OLLAMA_HOST` not set to loopback, or UFW not enabled | Override `OLLAMA_HOST=127.0.0.1:11434` in the systemd unit; `sudo ufw enable` |
| VRAM OOM — Ollama crashes under load | `OLLAMA_NUM_PARALLEL` too high for the chosen model and context length | Reduce `OLLAMA_NUM_PARALLEL` or lower `num_ctx` in the Modelfile; check with `nvidia-smi` during inference |
| Slow generation despite GPU | Model KV cache spilling to system RAM | Lower `num_ctx` or `OLLAMA_NUM_PARALLEL`; confirm `nvidia-smi` shows high GPU utilisation (not close to 0%) |
| `ENOENT` on database path | `DATA_DIR` does not exist or wrong permissions | `mkdir -p /var/lib/patent-workbench && chown $USER /var/lib/patent-workbench` |
| oauth2-proxy redirects to login on every request | Session cookie domain mismatch | Ensure `cookie-domain` in `oauth2-proxy.cfg` matches the nginx `server_name` exactly (including the leading dot for subdomains) |
| `502 Bad Gateway` on `/oauth2/` | oauth2-proxy not running or bound to wrong address | `systemctl status oauth2-proxy`; confirm `http-address = "127.0.0.1:4180"` and nginx `proxy_pass` point to the same port |
| OIDC discovery fails at startup | Authelia not reachable when oauth2-proxy starts | Check `systemctl status authelia`; ensure Authelia starts before oauth2-proxy (add `After=authelia.service` to the oauth2-proxy unit) |
| Login page shows oauth2-proxy defaults, not the branded template | `custom-templates-path` path wrong or files not readable | `ls -la /opt/oauth2-proxy/templates/` — confirm `sign_in.html` and `error.html` exist and are readable by `www-data` |
| `{{.ProviderName}}` shows empty on the login page | `provider-display-name` not set in oauth2-proxy config | Add `provider-display-name = "Authelia"` (or your IdP name) to `oauth2-proxy.cfg` and restart |
| Users from outside the allowed group can log in | `email-domain` or `--allowed-group` not configured | Set `email-domain` in `oauth2-proxy.cfg` to restrict by domain, or use `--allowed-group` for group-based access (Azure AD, Okta) |
| Authelia OIDC token signing fails | OIDC private key missing or wrong path | Confirm `openssl genrsa -out /etc/authelia/oidc.pem 4096` was run and the path matches `issuer_private_key` in `configuration.yml` |
