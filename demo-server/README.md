# UNITH Demo Server

The demo backend of the UNITH Developer Kit. It has **zero dependencies** —
Node.js 18 or later is all you need, with no `npm install`.

This server becomes the brain of a plugin-mode digital human: UNITH forwards
every user message here, and whatever the server returns is what the digital
human speaks. Bring your own LLM, small language model, or business rules.

## Quickstart

```bash
cp .env.example .env          # fill in UNITH_EMAIL and UNITH_SECRET_KEY
npm start                     # local server on :3000
ngrok http 3000               # or: cloudflared tunnel --url http://localhost:3000
# put the public tunnel URL in .env as TUNNEL_URL, then restart the server
```

From the repository root, `./start.sh` does all of this for you.

## Role of the server in the onboarding

The server's job is to **show** what the platform sends to your backend
(plugin messages, tool calls, webhook events) and how you answer. Digital-human
configuration happens in the companion guide or with `curl`; the scripts below
are an optional reference implementation of the same API calls and a starting
point for your own tooling.

## Scripts

Run these from the `demo-server/` directory. Chapter numbers refer to the
companion guide.

| Chapter | Command | What it does |
|---|---|---|
| 2 | `npm run discovery` | Shows your organization, head visuals, voices, and categories. |
| 3 | `npm run create:oc [-- <name>]` | Creates an Open Conversation head by API. |
| 3 | `npm run voice -- <headUuid> <provider> <voiceId>` | Switches a head's voice. |
| 3 | `npm run llm -- <headUuid> <provider> <model> <providerApiKey> [maxTokens]` | Switches the LLM behind an Open Conversation head (`openai` or `groq`). |
| 4 | `npm run create:plugin [-- <name>]` | Creates a plugin-mode head wired to this server through `TUNNEL_URL`. |
| 5 | `npm run tools -- <headUuid> [tunnelUrl]` | Adds the two demo tools and the prompt that activates them to a head. |
| 6 | `npm run webhook -- <headUuid> [tunnelUrl]` | Enables event delivery and registers this server for lifecycle webhooks. |
| 6 | `npm run logs [-- <sessionId>]` | Lists today's conversations, or prints one session's transcript. |
| 7 | `npm run site` | Serves the embedding demos on `http://localhost:8080`. |
| — | `npm run reset` | Lists demo heads. `-- --apply` deletes the heads created by these scripts. |

> **Warning:** `npm run reset -- --apply --all` permanently deletes **every**
> head in your organization, including heads not created by this kit. Use it
> only on a dedicated test organization.

Every API request is printed to the console, with secret values masked, so you
can see exactly what is sent. The bearer token is cached in `.token.json` for
six days, and heads created by the scripts are tracked in `.demo-heads.json`.
Both files are excluded from Git.

## Endpoints

| Route | Purpose |
|---|---|
| `POST /plugin` and `POST /plugin/conversation/{user_id}/message` | Plugin-mode endpoint: receives each user message and returns the reply. |
| `POST /tools/capture-lead` | Demo tool: captures a name and email, and returns an instruction that steers the conversation. |
| `POST /tools/policy-status` | Demo tool: returns sample policy data. Any other `/tools/*` path gets the same response. |
| `POST /webhooks/unith` | Lifecycle webhook receiver. Verifies the `x-signature-256` HMAC signature. |
| `GET /logs/conversations` | Proxy to the conversation data API. Served on `localhost` only. |
| `GET /logs/session/{sessionId}` | Proxy for one session's transcript. Served on `localhost` only. |
| `GET /health` | Health check. Returns `{"ok":true}`. |

## What to watch

- **`POST /plugin`** — the full payload UNITH sends is printed on every turn.
  The word `pricing` fires a demo trigger. The handler logs its own latency,
  because every millisecond your backend takes is added to the head's response
  time.
- **`POST /webhooks/unith`** — verifies the HMAC signature and, on
  `end_conversation`, automatically fetches that session's transcript from the
  data API.

## Plugin contract

The platform sends a `POST` to `{configured url}/conversation/{user_id}/message`
with an array of typed events. The user's text is in `payload.message`, and
`payload.session_metadata` carries the session, user, head, and device details.

The response must use the same shape, and `payload.type` is required:

```json
[{ "type": "text", "payload": { "type": "message", "message": "What the digital human should say" } }]
```

## Environment variables

Configured in `.env` (see `.env.example`):

| Variable | Required | Description |
|---|---|---|
| `UNITH_EMAIL` | Yes | Your UNITH account email. |
| `UNITH_SECRET_KEY` | Yes | Your secret key from interFace → Manage Account. |
| `UNITH_ORG_ID` | Multi-org accounts | Organization uuid. |
| `UNITH_PUBLIC_ORG_ID` | Logs, webhooks | Organization public id (from `GET /user/me` → `organisation.publicId`). |
| `UNITH_HEAD_VISUAL_ID` | Creating heads | The face to use, from `npm run discovery`. |
| `UNITH_TTS_PROVIDER`, `UNITH_TTS_VOICE` | No | Default voice for new heads. |
| `PORT`, `SITE_PORT` | No | Local ports (default 3000 and 8080). |
| `TUNNEL_URL` | Chapters 4–6 | Public HTTPS URL of your tunnel. `start.sh` fills it in automatically. |
| `UNITH_WEBHOOK_SECRET` | Chapter 6 | The `sharedKey` returned when registering the webhook. |
| `LOCAL_LLM`, `LOCAL_LLM_URL`, `LOCAL_LLM_MODEL` | No | Optional local language model for plugin replies. |

## Documentation

- [Authentication](https://docs.unith.ai/user)
- [Create a digital human](https://docs.unith.ai/create-a-digital-human)
- [LLM provider settings and external tools](https://docs.unith.ai/advanced-conversational-settings-llm-provider-external-tools)
- [Voice selection guide](https://docs.unith.ai/voice-selection-guide-tts)
- [Webhooks](https://docs.unith.ai/webhook-api-for-digital-human-events)
- [Conversation logs](https://docs.unith.ai/conversation-logs-retrieval)
- [Head visuals](https://docs.unith.ai/creating-head-visuals)

## Security

This server is teaching material, not production code. `/plugin` and
`/tools/*` accept requests from anyone who knows the tunnel URL, CORS is open,
and the webhook signature check is skipped when `UNITH_WEBHOOK_SECRET` is not
set. A production deployment must authenticate these endpoints. See the
[security notes](../README.md#security-notes) in the main README.
