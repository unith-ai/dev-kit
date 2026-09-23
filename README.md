# UNITH Developer Kit

A hands-on onboarding kit for the [UNITH](https://unith.ai) digital human
platform: an interactive guide, a demo backend, and embedding examples. Use it
alongside a UNITH-led technical onboarding session or work through it on your
own.

Everything runs locally with no build step: plain HTML pages and a Node.js
server with zero dependencies.

> **Read-only reference repository.** You are welcome to clone, download, and
> inspect this kit, and to copy its patterns into your own projects. It is
> distributed by UNITH and does not accept external contributions — see
> [Contributions](#contributions).

## Contents

- [Who this is for](#who-this-is-for)
- [What you will achieve](#what-you-will-achieve)
- [What's inside](#whats-inside)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Onboarding steps](#onboarding-steps)
- [Validate your setup](#validate-your-setup)
- [Clean up](#clean-up)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Support](#support)
- [Contributions](#contributions)
- [License](#license)

## Who this is for

Developers and technical teams at UNITH customers who are integrating digital
humans into their products — whether you are following along with a UNITH
engineer or onboarding on your own. You should be comfortable running terminal
commands and reading JavaScript.

## What you will achieve

By the end of the onboarding (about 90 minutes), you will have:

- Authenticated against the UNITH platform API and explored the faces and
  voices available to your organization.
- Created a digital human entirely by API, then changed its voice and language
  model.
- Connected a digital human to a backend you control (plugin mode), optionally
  powered by a small language model running on your own machine.
- Given a digital human conversation tools that call your systems
  mid-conversation.
- Received signed lifecycle webhooks and retrieved conversation transcripts.
- Embedded a digital human in a web page with an iframe, the
  `<unith-widget>` web component, and the `@unith-ai/core-client` SDK.
- Created a custom head visual (avatar) from your own video.

## What's inside

| Path | Description |
|---|---|
| `companion/index.html` | The interactive onboarding guide — a single self-contained HTML file. Each chapter has live API runners, copy-paste `curl` commands, and links to the official documentation. |
| `demo-server/` | The demo backend (Node.js 18+, no dependencies): plugin-mode endpoint, conversation tools, HMAC-verified webhook receiver, conversation-log proxy, optional local language model, and scripts for every API step. See [`demo-server/README.md`](demo-server/README.md). |
| `demo-embed/` | Embedding examples: a sample website (widget, iframe, or paste-it-yourself), the SDK playground covering the full `@unith-ai/core-client` v3 API, and three SDK layouts — draggable bubble, fullscreen hero, and scroll-narrated tour. |
| `sample-avatar.mp4` | Reference face video for the custom-avatar chapter (single idle loop). |
| `sample-avatar-expressive.mp4` | Reference video for the expressive state: 3 seconds of calm idle, then expressive movement. |
| `setup.sh` | One-time setup: checks prerequisites and creates `demo-server/.env` with your credentials. |
| `start.sh` | Starts every service (tunnel, demo server, embed site, guide) in one terminal. |

The demo websites use **Meridian Insurance**, a fictional company.

## Prerequisites

| Requirement | Needed for | Notes |
|---|---|---|
| UNITH account and organization | Everything | Sign in at [app.unith.ai](https://app.unith.ai). You need your account email and a secret key (interFace → **Manage Account**). |
| [Node.js](https://nodejs.org) 18 or later | Demo server, scripts | No `npm install` is required — the server has zero dependencies. |
| Bash and `perl` | `setup.sh`, `start.sh` | Preinstalled on macOS and most Linux distributions. On Windows, use the [manual setup](#manual-setup). |
| [ngrok](https://ngrok.com/download) with a free account | Chapters 4–6 | Exposes the local demo server to the platform. Run `ngrok config add-authtoken <YOUR_TOKEN>` once after [signing up](https://dashboard.ngrok.com/signup). Any HTTPS tunnel (for example `cloudflared`) also works. |
| Google Chrome | Embedding demos | Microphone input requires Chrome and `localhost` or HTTPS. |
| Apple Silicon Mac and [uv](https://docs.astral.sh/uv/) | Optional local language model (Chapter 4) | The first run downloads about 2.3 GB. |

## Getting started

### 1. Get the kit

Clone the repository:

```bash
git clone https://github.com/unith-ai/dev-kit.git
cd dev-kit
```

Or download the ZIP package from the
[latest release](https://github.com/unith-ai/dev-kit/releases/latest) and
extract it.

### 2. Run the setup

```bash
./setup.sh
```

The script checks Node.js and ngrok, then asks for your UNITH account email and
secret key and writes them to `demo-server/.env`. The secret key is not echoed
to the terminal, and `.env` is excluded from Git.

### 3. Start the kit

```bash
./start.sh
```

This starts the ngrok tunnel, the demo server on port 3000, and the embed site
on port 8080, then opens the guide in your browser. Output from every service
appears in one terminal, prefixed with the service name. Press **Ctrl+C** to
stop everything.

Useful options (`./start.sh --help` lists them all):

| Option | Effect |
|---|---|
| `--no-tunnel` | Start without ngrok. |
| `--no-browser` | Do not open the guide automatically. |
| `--llm` / `--no-llm` | Force the local language model on or off, overriding `LOCAL_LLM` in `.env`. |

### Manual setup

If you prefer to start each component yourself, or you are on Windows:

```bash
cp demo-server/.env.example demo-server/.env   # then edit it: UNITH_EMAIL and UNITH_SECRET_KEY
cd demo-server && npm start                    # demo server on :3000
ngrok http 3000                                # in a second terminal
cd demo-server && npm run site                 # embed site on :8080, in a third terminal
```

Then open `companion/index.html` in your browser. Put the public ngrok URL in
`demo-server/.env` as `TUNNEL_URL` and in the guide's **Session data** panel.

## Onboarding steps

Open the guide (`companion/index.html`) and work through the chapters in order.
The **Session data** panel stores your identifiers in your browser and fills
them into every command on the page.

| Chapter | Topic | What you do | Uses |
|---|---|---|---|
| 1 | Setup and credentials | Exchange your secret key for a bearer token and look up your organization. | Guide |
| 2 | Discovery | List the faces (head visuals) and voices available to you. | Guide, `npm run discovery` |
| 3 | Create a digital human | Create an Open Conversation head by API, then switch its voice and LLM. | Guide, `npm run create:oc`, `voice`, `llm` |
| 4 | Plugin mode | Create a head wired to the demo server, so your backend decides every reply. Optionally switch on the local language model. | Demo server, tunnel |
| 5 | Tools and metadata | Give an Open Conversation head two tools that call the demo server mid-conversation. | Demo server, tunnel, `npm run tools` |
| 6 | Webhooks and logs | Enable signed lifecycle events and fetch conversation transcripts. | Demo server, tunnel, `npm run webhook`, `logs` |
| 7 | Embedding and the SDK | Embed the head in a website, then explore the SDK playground and layouts. | Embed site |
| 8 | Custom avatars | Upload a video and turn it into a head visual. | Guide, sample videos |
| 9 | Going live | Plan the path from pilot to production with UNITH. | — |

Every step in the guide can also be run from the terminal with `curl` or with
the `npm run` scripts described in [`demo-server/README.md`](demo-server/README.md).

## Validate your setup

Run these checks at any point to confirm each component works:

| Check | Command or action | Expected result |
|---|---|---|
| Demo server is running | `curl http://localhost:3000/health` | `{"ok":true}` |
| Credentials are valid | `cd demo-server && npm run discovery` | Your organization, head visuals, and voices are printed. |
| Tunnel reaches the server | `curl https://<your-tunnel-url>/health` | `{"ok":true}` |
| Plugin mode works | Talk to the head created in Chapter 4. | The server console prints each incoming message and the reply. |
| Tools work | Give the Chapter 5 head your name and email. | The server console prints `⚡ NEW LEAD captured`. |
| Webhooks work | End a conversation with a head registered in Chapter 6. | The server console prints `✅ signature verified` and the transcript. |
| Embed site is running | Open `http://localhost:8080/client-site.html` | The Meridian Insurance sample site loads. |

## Clean up

When you are finished, remove the digital humans created by the scripts:

```bash
cd demo-server
npm run reset                 # lists tracked and existing heads; deletes nothing
npm run reset -- --apply      # deletes only the heads created by this kit's scripts
```

> **Warning:** `npm run reset -- --apply --all` permanently deletes **every**
> digital human in your organization, including ones not created by this kit.
> Use it only on a dedicated test organization.

Heads created from the guide in the browser are not tracked locally; delete
them in interFace or with `--apply --all` on a test organization.

## Security notes

1. **Your secret key is permanent and grants full control of your
   organization.** It is stored only in `demo-server/.env` (excluded from Git)
   and in the guide's **Session data** panel, which uses your browser's local
   storage — use the panel's **Clear** button on shared machines. Never commit
   or share it. If it is exposed, regenerate it in interFace → **Manage
   Account**.
2. **Bearer tokens are valid for 7 days.** Treat any copied command that
   contains one as sensitive for that period.
3. **The organization `api_key` used in embeds is public by design** — it
   appears in stream URLs. Production heads are protected by their
   `allowedOrigins` allow-list. Demo heads allow all origins (`"*"`); restrict
   this before going live.
4. **A tunnel makes your machine publicly reachable.** The demo server verifies
   webhook signatures and serves conversation logs on `localhost` only, but
   `/plugin` and `/tools/*` accept any caller. A production deployment must
   authenticate these endpoints.
5. **This kit is teaching material, not production code.** Reuse its patterns,
   not the server itself.

To report a security vulnerability, follow [`SECURITY.md`](SECURITY.md). Do not
open a public issue.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `port 3000 is already in use` (or 8080) | Another process holds the port. Find it with `lsof -i :3000` and stop it. Keep the default ports: the guide expects the demo server on 3000 and the embed site on 8080. |
| `ngrok is installed but has NO AUTHTOKEN` | ngrok needs a free account. Sign up, then run `ngrok config add-authtoken <YOUR_TOKEN>`. |
| `credentials still unset in demo-server/.env` | Fill in `UNITH_EMAIL` and `UNITH_SECRET_KEY`, or run `./setup.sh` again. |
| `Missing env var …` when running a script | The variable is not set in `demo-server/.env`. Copy it from `.env.example` and fill it in. |
| A guide button reports `Failed to fetch` | The browser could not reach the API. Check your connection and bearer token, or run the equivalent `curl` command or `npm run` script instead. |
| The plugin head does not reach the server | The head stores its endpoint when it is created. Make sure the tunnel was running and `TUNNEL_URL` was set before creating it. If the tunnel URL changes, recreate the head (`npm run create:plugin`) and re-register tools and webhooks. Copy the tunnel URL from `http://127.0.0.1:4040` to avoid truncation. |
| The head loads but never speaks | Browsers only allow audio after a user click. Press the **Start** button. |
| The microphone does not work | Use Chrome, and open the demos from `http://localhost:8080` (not from the file system). |
| `Concurrency limit reached`, or a head goes quiet | Every open conversation uses one of your organization's concurrent slots (a developer account has 3, and each open tab counts). Close other sessions and reload. |
| Webhook requests are rejected with `invalid signature` | Set `UNITH_WEBHOOK_SECRET` in `demo-server/.env` to the `sharedKey` returned when you registered the webhook, then restart the server. |
| `logs are served on localhost only` | By design, the conversation-log proxy only answers requests to `localhost`. Open the guide on the machine running the demo server. |
| The local language model is slow or unavailable | The first start downloads the model. Until it answers, the server falls back to its template reply. It requires Apple Silicon. |

## Support

- **Technical questions:** [support@unith.ai](mailto:support@unith.ai)
- **Projects, pilots, and pricing:** [sales@unith.ai](mailto:sales@unith.ai)
- **Documentation:** [docs.unith.ai](https://docs.unith.ai)
- **SDK:** [`@unith-ai/core-client`](https://www.npmjs.com/package/@unith-ai/core-client) on npm

To report a bug in this kit, open an issue using the bug report form. Never
include secret keys, bearer tokens, or other credentials. See
[`SUPPORT.md`](SUPPORT.md) for details.

## Contributions

This repository is a read-only reference maintained by UNITH. External
contributions, pull requests, and direct changes are not accepted, and pull
requests will be closed without review. To suggest an improvement, contact
[support@unith.ai](mailto:support@unith.ai).

## License

This repository does not currently include a license. For questions about
usage terms, contact [support@unith.ai](mailto:support@unith.ai).
