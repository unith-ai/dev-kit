#!/bin/bash
# UNITH Developer Kit — one-shot setup.
set -e
cd "$(dirname "$0")"

echo "── UNITH Developer Kit setup ──────────────────────────────"

# 1. Node ≥ 18 (the demo server has zero dependencies, but needs modern Node)
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js not found — install Node 18+ from https://nodejs.org and re-run."
  exit 1
fi
NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "✗ Node $NODE_MAJOR found — this kit needs Node 18+."
  exit 1
fi
echo "✓ Node $(node --version)"

# 2. ngrok (needed for Chapters 4-6: plugin mode, tools, webhooks)
if command -v ngrok >/dev/null 2>&1; then
  if [ -n "${NGROK_AUTHTOKEN:-}" ] \
     || grep -qs authtoken "$HOME/Library/Application Support/ngrok/ngrok.yml" \
     || grep -qs authtoken "$HOME/.config/ngrok/ngrok.yml" \
     || grep -qs authtoken "$HOME/.ngrok2/ngrok.yml"; then
    echo "✓ ngrok found and authenticated"
  else
    echo "△ ngrok found but NOT authenticated — it needs a free account:"
    echo "    1. sign up:   https://dashboard.ngrok.com/signup"
    echo "    2. get token: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "    3. run:       ngrok config add-authtoken <YOUR_TOKEN>"
  fi
else
  echo "△ ngrok not found — install it for the tunnel chapters: https://ngrok.com/download"
fi

# 3. Credentials → demo-server/.env
if [ -f demo-server/.env ]; then
  echo "✓ demo-server/.env already exists — leaving it untouched."
else
  cp demo-server/.env.example demo-server/.env
  echo ""
  echo "Your UNITH credentials (interFace → Manage Account → secret key):"
  read -r -p "  Account email: " EMAIL
  read -r -s -p "  Secret key (hidden): " SECRET
  echo ""
  # portable in-place edit (macOS + Linux); values via env so perl never
  # interpolates characters like @ in the email
  EMAIL="$EMAIL" perl -pi -e 's|^UNITH_EMAIL=.*|UNITH_EMAIL=$ENV{EMAIL}|' demo-server/.env
  SECRET="$SECRET" perl -pi -e 's|^UNITH_SECRET_KEY=.*|UNITH_SECRET_KEY=$ENV{SECRET}|' demo-server/.env
  echo "✓ demo-server/.env created (never share or commit this file)"
fi

echo ""
echo "── Ready. Next steps ──────────────────────────────────────"
echo "  1. Open the guide:        open companion/index.html"
echo "     (start at Chapter 1 — the Session data panel fills every command)"
echo "  2. Backend (Ch. 4-6):     cd demo-server && npm start"
echo "  3. Public URL (Ch. 4-6):  ngrok http 3000"
echo "  4. Embed demos (Ch. 7):   cd demo-server && npm run site"
echo ""
echo "Docs: https://docs.unith.ai · Help: support@unith.ai"
