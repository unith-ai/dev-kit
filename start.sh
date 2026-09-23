#!/usr/bin/env bash
# UNITH Developer Kit — start every service and watch them from one terminal.
#
# This is the control panel for the onboarding. It brings up, in order:
#   tunnel  ngrok http 3000            (public URL for plugin / tools / webhooks)
#   server  demo-server/server.js      (plugin endpoint, tools, webhook receiver)
#   site    demo-server/scripts/serve-site.js   (the embed demos + SDK playground)
#   guide   companion/index.html       (opened in your browser)
#   llm     mlx_lm.server              (only when LOCAL_LLM=on)
#
# Every service's output is prefixed with its name, so one terminal shows the
# whole system. Ctrl+C stops all of them.
#
# Usage: ./start.sh [--no-tunnel] [--no-browser] [--llm|--no-llm] [--help]

set -uo pipefail
cd "$(dirname "$0")"

ENV_FILE=demo-server/.env

# ── colours (dropped when not writing to a terminal) ────────────────────────
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  NC=$'\033[0m'; B=$'\033[1m'; DIM=$'\033[2m'
  RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'
  BLU=$'\033[34m'; MAG=$'\033[35m'; CYN=$'\033[36m'
else
  NC=''; B=''; DIM=''; RED=''; GRN=''; YEL=''; BLU=''; MAG=''; CYN=''
fi

# ── option parsing ──────────────────────────────────────────────────────────
WANT_TUNNEL=1
WANT_BROWSER=1
WANT_LLM=auto        # auto → follow LOCAL_LLM in .env

while [ $# -gt 0 ]; do
  case $1 in
    --no-tunnel)  WANT_TUNNEL=0 ;;
    --no-browser) WANT_BROWSER=0 ;;
    --llm)        WANT_LLM=on ;;
    --no-llm)     WANT_LLM=off ;;
    -h|--help)
      awk 'NR > 1 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "$0"
      exit 0 ;;
    *) printf '%sUnknown option: %s%s  (try --help)\n' "$RED" "$1" "$NC" >&2; exit 2 ;;
  esac
  shift
done

# ── log plumbing: one prefixed, colour-coded line per service line ──────────
line_out() {  # line_out <name> <colour> <text>
  printf '%s%6s%s %s│%s %s\n' "$2" "$1" "$NC" "$DIM" "$NC" "$3"
}

say()  { line_out kit "$B"   "$1"; }
ok()   { line_out kit "$B"   "${GRN}✓${NC} $1"; }
warn() { line_out kit "$B"   "${YEL}△${NC} $1"; }
fail() { line_out kit "$B"   "${RED}✗${NC} $1"; }
die()  { fail "$1"; exit 1; }

# ngrok speaks logfmt: turn `t=… lvl=info msg="started tunnel" url=…` into
# something a human can read at a glance, and drop the debug chatter.
FMT=''
fmt_ngrok() {
  local l=$1 lvl='' obj='' msg='' url='' addr='' err=''
  FMT=''
  [[ $l =~ lvl=([a-z]+) ]] && lvl=${BASH_REMATCH[1]}
  case $lvl in debug|dbug|trace) return ;; esac
  [[ $l =~ obj=([^[:space:]]+) ]] && obj=${BASH_REMATCH[1]}
  if   [[ $l =~ msg=\"([^\"]*)\" ]];      then msg=${BASH_REMATCH[1]}
  elif [[ $l =~ msg=([^[:space:]]+) ]];   then msg=${BASH_REMATCH[1]}
  fi
  # The inspector on :4040 logs a start/end pair (tagged with the page it
  # served) for every request made to it — including this script's own polling
  # for the public URL. Pure noise.
  case $msg in
    start|end) [[ $l == *' pg='* || $obj == web ]] && return ;;
  esac
  case $msg in
    'no configuration paths supplied'|'using configuration at default config path') return ;;
    'open config file'|'FIPS 140 mode'|'starting web service') return ;;
    'INFO received stop request'*) return ;;
    'accept failed') [[ $l == *'reconnecting session closed'* ]] && return ;;
    'join connections') FMT="↔ a request came through the tunnel"; return ;;
  esac
  [[ $l =~ url=([^[:space:]]+) ]]  && url=${BASH_REMATCH[1]}
  [[ $l =~ addr=([^[:space:]]+) ]] && addr=${BASH_REMATCH[1]}
  if   [[ $l =~ err=\"([^\"]*)\" ]];    then err=${BASH_REMATCH[1]}
  elif [[ $l =~ err=([^[:space:]]+) ]]; then err=${BASH_REMATCH[1]}
  fi
  [ "$err" = "<nil>" ] && err=''
  if [ -z "$msg" ]; then FMT=$l; return; fi
  FMT=$msg
  [ -n "$url" ]  && FMT="$FMT  $url"
  [ -n "$addr" ] && [ -n "$url" ] && FMT="$FMT → $addr"
  [ -n "$err" ]  && FMT="$FMT — $err"
  case $lvl in warn|eror|error|crit) FMT="${YEL}${FMT}${NC}" ;; esac
}

stream() {  # stream <name> <colour> <raw|ngrok>  — reads the service's stdout
  local name=$1 colour=$2 mode=$3 line
  while IFS= read -r line || [ -n "$line" ]; do
    if [ "$mode" = ngrok ]; then
      fmt_ngrok "$line"
      line=$FMT
      [ -z "$line" ] && continue
    fi
    line_out "$name" "$colour" "$line"
  done
}

# ── service registry ────────────────────────────────────────────────────────
PIDS=()
PNAMES=()
PDEAD=()

launch() {  # launch <name> <colour> <raw|ngrok> <workdir> <cmd...>
  local name=$1 colour=$2 mode=$3 dir=$4
  shift 4
  ( cd "$dir" && exec "$@" ) </dev/null > >(stream "$name" "$colour" "$mode") 2>&1 &
  PIDS+=("$!")
  PNAMES+=("$name")
  PDEAD+=(0)
}

STOPPING=0
shutdown() {  # shutdown [exit-code]
  [ "$STOPPING" = 1 ] && return
  STOPPING=1
  trap '' INT TERM
  local code=${1:-0} i pid alive
  printf '\n'
  if [ ${#PIDS[@]} -eq 0 ]; then
    say "nothing was started."
    exit "$code"
  fi
  say "shutting down…"
  for i in "${!PIDS[@]}"; do
    pid=${PIDS[$i]}
    kill -0 "$pid" 2>/dev/null || continue
    pkill -TERM -P "$pid" 2>/dev/null   # grandchildren first (uvx → python)
    kill  -TERM "$pid"    2>/dev/null
  done
  # up to 5 s to exit cleanly, then insist
  for i in $(seq 1 50); do
    alive=0
    for pid in "${PIDS[@]}"; do kill -0 "$pid" 2>/dev/null && alive=1; done
    [ "$alive" = 0 ] && break
    sleep 0.1
  done
  for i in "${!PIDS[@]}"; do
    pid=${PIDS[$i]}
    if kill -0 "$pid" 2>/dev/null; then
      pkill -KILL -P "$pid" 2>/dev/null
      kill  -KILL "$pid"    2>/dev/null
      line_out kit "$B" "${YEL}△${NC} ${PNAMES[$i]} did not stop — killed"
    else
      line_out kit "$B" "${GRN}✓${NC} ${PNAMES[$i]} stopped"
    fi
  done
  sleep 0.3   # let the log readers drain
  say "all services stopped."
  exit "$code"
}
trap shutdown INT TERM

# ── small helpers ───────────────────────────────────────────────────────────
read_env() {  # read_env KEY → value (empty if unset)
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" \
    | tail -n 1 | sed 's/[[:space:]]*$//; s/^"//; s/"$//'
}

set_env() {  # set_env KEY VALUE — rewrite (or append) one line in .env
  node -e '
    const fs = require("fs");
    const [file, key, val] = process.argv.slice(1);
    let t = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const re = new RegExp("^[ \\t]*" + key + "[ \\t]*=.*$", "m");
    t = re.test(t) ? t.replace(re, key + "=" + val)
                   : t.replace(/\n*$/, "\n") + key + "=" + val + "\n";
    fs.writeFileSync(file, t);
  ' "$ENV_FILE" "$1" "$2"
}

# Port checks go through node (always present here) rather than bash's
# /dev/tcp, which some builds ship without.
tcp_wait() {  # tcp_wait PORT SECONDS → 0 as soon as something accepts on it
  node -e '
    const net = require("node:net");
    const [port, secs] = process.argv.slice(1).map(Number);
    const deadline = Date.now() + secs * 1000;
    (function probe() {
      const s = net.createConnection({ host: "127.0.0.1", port });
      s.setTimeout(500);
      const retry = () => {
        s.destroy();
        if (Date.now() < deadline) setTimeout(probe, 200); else process.exit(1);
      };
      s.on("connect", () => { s.destroy(); process.exit(0); });
      s.on("timeout", retry);
      s.on("error", retry);
    })();
  ' "$1" "$2" >/dev/null 2>&1
}

port_busy() { tcp_wait "$1" 0; }
wait_port() { tcp_wait "$1" "${2:-15}"; }

http_ok() {
  node -e 'fetch(process.argv[1], { signal: AbortSignal.timeout(4000) })
             .then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))' \
       "$1" >/dev/null 2>&1
}

open_url() {
  if   command -v xdg-open >/dev/null 2>&1; then (xdg-open "$1" >/dev/null 2>&1 &)
  elif command -v open     >/dev/null 2>&1; then (open     "$1" >/dev/null 2>&1 &)
  else return 1
  fi
}

ngrok_url() {  # ngrok_url [expected-local-port] → the tunnel's public URL
  node -e '
    const want = process.argv[1];
    fetch("http://127.0.0.1:4040/api/tunnels", { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(j => {
        let t = (j.tunnels || []).filter(t => (t.public_url || "").startsWith("https"));
        if (want) {
          const mine = t.filter(t => (t.config?.addr || "").endsWith(":" + want));
          if (mine.length) t = mine;
        }
        if (!t.length) process.exit(1);
        console.log(t[0].public_url);
      })
      .catch(() => process.exit(1));
  ' "${1:-}" 2>/dev/null
}

require_free_port() {  # require_free_port PORT WHAT
  if port_busy "$1"; then
    fail "port $1 is already in use — $2 cannot start."
    line_out kit "$B" "  find it with:  lsof -i :$1     (then stop it, or free the port)"
    exit 1
  fi
}

# ── preflight ───────────────────────────────────────────────────────────────
printf '\n%s── UNITH Developer Kit ─ starting services ────────────────────%s\n' "$B" "$NC"

command -v node >/dev/null 2>&1 || die "Node.js not found — install Node 18+ from https://nodejs.org"
NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
[ "$NODE_MAJOR" -ge 18 ] || die "Node $NODE_MAJOR found — this kit needs Node 18+."
ok "Node $(node --version)"

if [ ! -f "$ENV_FILE" ]; then
  warn "$ENV_FILE missing — running ./setup.sh first."
  if [ -t 0 ]; then
    ./setup.sh || die "setup.sh did not finish — fix the above and re-run ./start.sh"
    printf '\n'
  else
    die "run ./setup.sh (it needs a terminal) and then ./start.sh"
  fi
fi

UNITH_EMAIL_V=$(read_env UNITH_EMAIL)
UNITH_SECRET_V=$(read_env UNITH_SECRET_KEY)
if [ -z "$UNITH_EMAIL_V" ] || [ "$UNITH_EMAIL_V" = "you@yourcompany.com" ] \
   || [ -z "$UNITH_SECRET_V" ] || [ "$UNITH_SECRET_V" = "your-secret-key" ]; then
  warn "credentials still unset in $ENV_FILE — the server starts, but log"
  line_out kit "$B" "  retrieval and the API scripts will fail. Fill UNITH_EMAIL and"
  line_out kit "$B" "  UNITH_SECRET_KEY (interFace → Manage Account), or re-run ./setup.sh."
else
  ok "credentials present  ($UNITH_EMAIL_V)"
fi

PORT=$(read_env PORT);           PORT=${PORT:-3000}
SITE_PORT=$(read_env SITE_PORT); SITE_PORT=${SITE_PORT:-8080}
LLM_URL=$(read_env LOCAL_LLM_URL); LLM_URL=${LLM_URL:-http://localhost:1234/v1/chat/completions}
LLM_MODEL=$(read_env LOCAL_LLM_MODEL); LLM_MODEL=${LLM_MODEL:-mlx-community/Qwen3.5-4B-MLX-4bit}
LLM_PORT=$(printf '%s' "$LLM_URL" | sed -n 's|.*://[^:/]*:\([0-9]*\).*|\1|p'); LLM_PORT=${LLM_PORT:-1234}
[ "$WANT_LLM" = auto ] && { [ "$(read_env LOCAL_LLM)" = on ] && WANT_LLM=on || WANT_LLM=off; }

ngrok_has_token() {
  [ -n "${NGROK_AUTHTOKEN:-}" ] && return 0
  local f
  for f in "$HOME/Library/Application Support/ngrok/ngrok.yml" \
           "$HOME/.config/ngrok/ngrok.yml" "$HOME/.ngrok2/ngrok.yml"; do
    [ -f "$f" ] && grep -q "authtoken" "$f" && return 0
  done
  return 1
}

if [ "$WANT_TUNNEL" = 1 ] && ! command -v ngrok >/dev/null 2>&1; then
  warn "ngrok not found — starting without a tunnel (the plugin/tools/webhooks chapters need one)."
  line_out kit "$B" "  install it: https://ngrok.com/download"
  WANT_TUNNEL=0
fi
if [ "$WANT_TUNNEL" = 1 ] && ! ngrok_has_token; then
  warn "ngrok is installed but has NO AUTHTOKEN — it needs a free account."
  line_out kit "$B" "  1. sign up:   https://dashboard.ngrok.com/signup"
  line_out kit "$B" "  2. get token: https://dashboard.ngrok.com/get-started/your-authtoken"
  line_out kit "$B" "  3. run:       ngrok config add-authtoken <YOUR_TOKEN>"
  line_out kit "$B" "  then re-run ./start.sh — starting without a tunnel for now."
  WANT_TUNNEL=0
fi

require_free_port "$PORT"      "the demo server"
require_free_port "$SITE_PORT" "the embed site"

# An ngrok already running on this machine is reused rather than fought over.
TUNNEL_REUSED=0
if [ "$WANT_TUNNEL" = 1 ] && port_busy 4040; then
  REUSE=$(ngrok_url "$PORT")
  if [ -n "$REUSE" ]; then
    TUNNEL_REUSED=1
    ok "ngrok already running — reusing $REUSE"
  else
    fail "port 4040 is in use but no https tunnel to :$PORT is registered there."
    line_out kit "$B" "  stop that ngrok (or run ./start.sh --no-tunnel)."
    exit 1
  fi
fi
if [ "$WANT_LLM" = on ] && port_busy "$LLM_PORT"; then
  warn "port $LLM_PORT already serving — reusing whatever runs there as the local LLM."
  WANT_LLM=reuse
fi

printf '\n'

# ── 1. tunnel (first: the heads and scripts read TUNNEL_URL from .env) ──────
TUNNEL=''
TUNNEL_OLD=$(read_env TUNNEL_URL)
if [ "$TUNNEL_REUSED" = 1 ]; then
  TUNNEL=$REUSE
  set_env TUNNEL_URL "$TUNNEL" && ok "TUNNEL_URL written to $ENV_FILE"
elif [ "$WANT_TUNNEL" = 1 ]; then
  say "starting ngrok on :$PORT …"
  launch tunnel "$YEL" ngrok . ngrok http "$PORT" --log=stdout --log-format=logfmt --log-level=info
  if wait_port 4040 20; then
    for i in $(seq 1 40); do
      TUNNEL=$(ngrok_url "$PORT") && [ -n "$TUNNEL" ] && break
      sleep 0.25
    done
  fi
  if [ -n "$TUNNEL" ]; then
    ok "tunnel up: $TUNNEL"
    set_env TUNNEL_URL "$TUNNEL" && ok "TUNNEL_URL written to $ENV_FILE"
  else
    warn "ngrok started but no public URL yet — check the tunnel lines below,"
    line_out kit "$B" "  or copy the URL from http://127.0.0.1:4040 into $ENV_FILE."
  fi
else
  say "tunnel skipped — Chapters 4-6 need one (\`ngrok http $PORT\` in another tab)."
fi

# ── 2. optional local SLM ───────────────────────────────────────────────────
if [ "$WANT_LLM" = on ]; then
  if command -v uvx >/dev/null 2>&1; then
    say "starting local SLM on :$LLM_PORT  (${LLM_MODEL##*/}) …"
    [ "$(uname -s)" = Darwin ] || warn "mlx needs Apple Silicon — expect this one to fail here."
    launch llm "$BLU" raw . \
      uvx --from 'mlx-lm>=0.30' --python 3.12 mlx_lm.server \
          --model "$LLM_MODEL" --port "$LLM_PORT" \
          --chat-template-args '{"enable_thinking": false}'
    wait_port "$LLM_PORT" 180 && ok "local SLM answering on :$LLM_PORT" \
      || warn "local SLM slow to load — the server falls back to the echo reply until it is up."
  else
    warn "LOCAL_LLM=on but uvx not found — install uv, or set LOCAL_LLM=off."
    WANT_LLM=off
  fi
fi

# ── 3. demo server ──────────────────────────────────────────────────────────
say "starting demo server on :$PORT …"
# The flags win over LOCAL_LLM in .env: lib/unith.js only fills in vars the
# process does not already have, so exporting it here is authoritative.
case $WANT_LLM in
  on|reuse) launch server "$CYN" raw demo-server env LOCAL_LLM=on  node server.js ;;
  *)        launch server "$CYN" raw demo-server env LOCAL_LLM=off node server.js ;;
esac
if wait_port "$PORT"; then
  http_ok "http://localhost:$PORT/health" && ok "demo server healthy  (GET /health)" \
    || warn "demo server listening but /health did not answer — see its output above."
else
  fail "demo server never opened :$PORT — see its output above."
  shutdown 1
fi

# ── 4. embed site ───────────────────────────────────────────────────────────
say "starting embed site on :$SITE_PORT …"
launch site "$MAG" raw demo-server node scripts/serve-site.js
wait_port "$SITE_PORT" && ok "embed site serving demo-embed/" \
  || warn "embed site never opened :$SITE_PORT — see its output above."

# ── 5. the guide ────────────────────────────────────────────────────────────
GUIDE="file://$PWD/companion/index.html"
GUIDE_STATE="not opened"
if [ "$WANT_BROWSER" = 1 ]; then
  if open_url "$GUIDE"; then
    GUIDE_STATE='opened in your browser'
    ok "guide opened — start at Chapter 1"
  else
    warn "could not open a browser — open companion/index.html manually."
  fi
fi

# ── the control panel ───────────────────────────────────────────────────────
row() { printf ' %s%-12s%s %s\n' "$B" "$1" "$NC" "$2"; }
rule() { printf '%s──────────────────────────────────────────────────────────────%s\n' "$DIM" "$NC"; }

printf '\n'
rule
printf ' %sUNITH Developer Kit — control panel%s\n' "$B" "$NC"
rule
row guide  "companion/index.html  ${DIM}($GUIDE_STATE)${NC}"
row server "http://localhost:$PORT  ${DIM}/plugin · /tools/* · /webhooks/unith · /logs/*${NC}"
if [ -n "$TUNNEL" ] && [ "$TUNNEL_REUSED" = 1 ]; then
  row tunnel "$TUNNEL  ${DIM}→ :$PORT · already running, not ours to stop${NC}"
elif [ -n "$TUNNEL" ]; then
  row tunnel "$TUNNEL  ${DIM}→ :$PORT · inspect http://127.0.0.1:4040${NC}"
elif [ "$WANT_TUNNEL" = 1 ]; then
  row tunnel "${YEL}starting — URL at http://127.0.0.1:4040${NC}"
else
  row tunnel "${DIM}off — Chapters 4-6 need it${NC}"
fi
row site   "http://localhost:$SITE_PORT/client-site.html"
printf ' %s%-12s%s %s\n' "$B" "" "$NC" "http://localhost:$SITE_PORT/sdk-playground.html"
case $WANT_LLM in
  on)    row llm "http://localhost:$LLM_PORT  ${DIM}${LLM_MODEL##*/}${NC}" ;;
  reuse) row llm "http://localhost:$LLM_PORT  ${DIM}already running — reused${NC}" ;;
  *)     row llm "${DIM}off — set LOCAL_LLM=on in $ENV_FILE, or ./start.sh --llm${NC}" ;;
esac
rule
printf ' If the guide did not open in your browser, open it here:\n'
printf '   %s%s%s\n' "$B" "$GUIDE" "$NC"
rule
if [ -n "$TUNNEL" ] && [ -n "$TUNNEL_OLD" ] && [ "$TUNNEL_OLD" != "$TUNNEL" ] \
   && [ "$TUNNEL_OLD" != "https://your-tunnel.example.com" ]; then
  printf ' %s△%s the tunnel URL changed since last run. A plugin head stores the\n' "$YEL" "$NC"
  printf '   endpoint at creation — recreate it (%snpm run create:plugin%s) or update\n' "$B" "$NC"
  printf '   its pluginOperationalModeConfig, and re-register tools/webhooks.\n'
  printf '   %swas %s%s\n' "$DIM" "$TUNNEL_OLD" "$NC"
  rule
fi
printf ' In another tab, from %sdemo-server/%s:\n' "$B" "$NC"
printf '   %snpm run discovery%s · %screate:oc%s · %screate:plugin%s · %stools%s · %swebhook%s · %slogs%s · %sreset%s\n' \
  "$B" "$NC" "$B" "$NC" "$B" "$NC" "$B" "$NC" "$B" "$NC" "$B" "$NC" "$B" "$NC"
printf '\n %sCtrl+C stops every service.%s  Output below is prefixed per service.\n' "$B" "$NC"
rule
printf '\n'

# ── watch: stream logs until Ctrl+C, reporting anything that dies ───────────
while :; do
  live=0
  for i in "${!PIDS[@]}"; do
    if [ "${PDEAD[$i]}" = 0 ]; then
      if kill -0 "${PIDS[$i]}" 2>/dev/null; then
        live=1
      else
        PDEAD[$i]=1
        warn "${PNAMES[$i]} exited — restart with ./start.sh, or run it on its own."
      fi
    fi
  done
  [ "$live" = 0 ] && { say "no services left running."; shutdown 1; }
  sleep 1
done
