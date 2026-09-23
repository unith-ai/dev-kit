// UNITH demo server — plugin-mode endpoint + webhook receiver.
// Zero dependencies, Node >= 18.
//
//   npm start                     → listens on http://localhost:3000
//   cloudflared tunnel --url http://localhost:3000   (or ngrok http 3000)
//
// Endpoints:
//   POST /plugin           ← UNITH forwards each user message here (plugin mode)
//   POST /webhooks/unith   ← lifecycle events (HMAC-signed)
//   GET  /health
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { api, env, DATA_API } from './lib/unith.js';

const PORT = Number(process.env.PORT ?? 3000);

// ---------------------------------------------------------------------------
// 1. PLUGIN MODE — your server owns the conversation.
//    UNITH sends you the user's text; whatever you return is what the digital
//    human SPEAKS. Plug in anything here: your own LLM, an SLM, business
//    rules, RAG — full control.
// ---------------------------------------------------------------------------
async function handlePlugin(payload) {
  const started = Date.now();

  // Request contract: the platform POSTs to
  //   {configured url}/conversation/{user_id}/message
  // with an ARRAY of events:
  //   [{ type: "text", payload: { type: "message", message: "…", options: {},
  //      session_metadata: { session_id, username, public_head_id, … } } }]
  const event = Array.isArray(payload) ? payload.find((e) => e?.payload) : null;
  const userText = event?.payload?.message ?? payload.text ?? payload.message ?? payload.input ?? '';
  const asTraces = Array.isArray(payload);

  const meta = event?.payload?.session_metadata;
  if (meta) {
    const device = meta.request_metadata?.essential?.device_info?.device_type ?? '?';
    console.log(`   👤 ${meta.username} · session ${String(meta.session_id).slice(0, 8)}… · ${device} · ${meta.public_head_id}`);
  }

  // --- TRIGGERS: once the text is on your server, you can act on it --------
  if (/\b(price|pricing|cost)\b/i.test(userText)) {
    fireTrigger('pricing_intent', userText);
    return reply(
      'Great question. Our team tailors pricing to each use case, and I have just flagged this conversation for a follow-up.',
      started, asTraces,
    );
  }

  // --- YOUR MODEL GOES HERE -------------------------------------------------
  // With LOCAL_LLM=on in .env, replies come from a real SLM running on THIS
  // machine (Qwen3.5-4B via mlx_lm.server, OpenAI-compatible API on :1234).
  // Toggle off → echo template.
  if (process.env.LOCAL_LLM === 'on') {
    try {
      const answer = await localLLM(userText);
      return reply(answer, started, asTraces);
    } catch (err) {
      console.warn(`   ⚠ local LLM unavailable (${err.message}) — falling back to the echo template`);
    }
  }
  const answer = `You said: "${userText}". This reply was generated on this demo server — swap one line of code and it comes from your own LLM or SLM.`;
  return reply(answer, started, asTraces);
}

async function localLLM(userText) {
  const url = process.env.LOCAL_LLM_URL ?? 'http://localhost:1234/v1/chat/completions';
  const model = process.env.LOCAL_LLM_MODEL ?? 'mlx-community/Qwen3.5-4B-MLX-4bit';
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content: 'You are a digital human speaking out loud in a live demo. Answer in one or two short conversational sentences. No markdown, no lists.',
        },
        { role: 'user', content: userText },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error('empty completion');
  console.log(`   🧠 local LLM (${model.split('/').pop()}) answered in ${Date.now() - t0} ms — running on THIS machine`);
  return answer;
}

function reply(text, started, asTraces) {
  console.log(`   💬 reply → "${text}"`);
  console.log(`   ↳ replied in ${Date.now() - started} ms  (every ms spent here is added to the head's response latency)`);
  // Response contract: same trace shape as the request,
  // and payload.type is REQUIRED (pydantic-validated platform-side).
  return asTraces ? [{ type: 'text', payload: { type: 'message', message: text } }] : { text };
}

// Tolerant lead extraction — accepts several tool-call payload shapes, and
// the full payload is logged above anyway.
function extractLead(p) {
  const s = JSON.stringify(p ?? {});
  const email = s.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const name =
    p?.parameters?.name ?? p?.name ?? p?.payload?.parameters?.name ??
    (Array.isArray(p) ? p[0]?.payload?.parameters?.name : null) ?? null;
  return { name, email };
}

function fireTrigger(name, context) {
  console.log(`   ⚡ TRIGGER "${name}" fired → here you could update a CRM, alert sales on Slack, open a ticket… (user said: "${context}")`);
}

// ---------------------------------------------------------------------------
// 2. WEBHOOKS — lifecycle events: start_conversation, end_conversation,
//    inactivity_warning, timeout_conversation. Each request is signed
//    (x-signature-256, HMAC SHA-256 of the raw body with the shared secret).
//    On end_conversation we fetch that session's transcript from the data
//    API: event-driven conversation analytics, fully automated.
// ---------------------------------------------------------------------------
function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.UNITH_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('   ⚠ UNITH_WEBHOOK_SECRET not set — skipping signature check (never do this in production)');
    return true;
  }
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = signatureHeader.replace(/^sha256=/, '');
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handleWebhook(payload) {
  const event = payload.event ?? payload.event_type ?? '(unknown event)';
  console.log(`   📬 event: ${event}`);

  const sessionId = payload.session_id ?? payload.sessionId;
  if (event === 'end_conversation' && sessionId) {
    console.log('   ⏬ conversation ended — fetching its transcript from the data API…');
    const transcript = await api(
      'GET',
      `${DATA_API}/sessions/${env('UNITH_PUBLIC_ORG_ID')}/${sessionId}`,
    );
    console.log(JSON.stringify(transcript, null, 2));
    console.log('   💡 from here: sentiment analysis, lead scoring, CRM sync, QA review…');
  }
}

// ---------------------------------------------------------------------------
// HTTP plumbing (plain node:http — nothing to install)
// ---------------------------------------------------------------------------
const server = createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const rawBody = Buffer.concat(chunks);
    const route = `${req.method} ${req.url.split('?')[0]}`;
    try {
      if (req.method === 'OPTIONS') return json(res, 204, {});
      if (route === 'GET /health') return json(res, 200, { ok: true });

      // Chapter 6 — logs proxy. The data API allows no browser calls (no CORS),
      // so the companion page asks YOUR backend and your backend asks the data
      // API — which is exactly where log retrieval belongs.
      // SECURITY: localhost only — this proxy uses the org's credentials, and
      // the tunnel would otherwise expose your conversation logs to anyone
      // holding the ngrok URL.
      const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '');
      if (req.method === 'GET' && req.url.startsWith('/logs/') && !isLocal) {
        return json(res, 403, { error: 'logs are served on localhost only' });
      }
      if (req.method === 'GET' && req.url.startsWith('/logs/conversations')) {
        const q = new URL(req.url, 'http://localhost').searchParams;
        // Wide default range: an onboarding org holds only demo conversations,
        // and showing the full history proves nothing is hidden.
        const end = q.get('end') ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        const start = q.get('start') ?? '2023-01-01T00:00:00Z';
        const orgId = env('UNITH_PUBLIC_ORG_ID');
        const data = await api('GET', `${DATA_API}/conversations?org_id=${orgId}&start_date=${start}&end_date=${end}`);
        return json(res, 200, data);
      }
      const sessionMatch = req.url.split('?')[0].match(/^\/logs\/session\/([^/]+)$/);
      if (req.method === 'GET' && sessionMatch) {
        const data = await api('GET', `${DATA_API}/sessions/${env('UNITH_PUBLIC_ORG_ID')}/${sessionMatch[1]}`);
        return json(res, 200, data);
      }

      console.log(`\n━━━ ${route} ━━━ ${new Date().toISOString()}`);
      const payload = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {};
      console.log(JSON.stringify(payload, null, 2));

      // The platform calls {url}/conversation/{userId}/message — accept both
      // the bare /plugin (manual tests) and the real conversation route.
      if (req.method === 'POST' && /^\/plugin(\/conversation\/[^/]+\/message)?$/.test(req.url.split('?')[0])) {
        return json(res, 200, await handlePlugin(payload));
      }
      // Chapter 5 — conversation tools: OC heads POST here mid-conversation.
      // Two demo tools: a data lookup, and a lead capture whose RESPONSE
      // steers the conversation (your server whispers to the head).
      const toolPath = req.url.split('?')[0];
      if (req.method === 'POST' && toolPath.startsWith('/tools/')) {
        if (toolPath.includes('capture-lead')) {
          const lead = extractLead(payload);
          console.log(`   ⚡ NEW LEAD captured: ${lead.name ?? '(name?)'} <${lead.email ?? '(email?)'}> — save to CRM, notify sales, anything`);
          return json(res, 200, {
            result:
              'Lead saved successfully. IMPORTANT: today is this user\'s birthday! Congratulate them warmly by name and wish them a great day.',
          });
        }
        console.log('   🔧 tool call: policy lookup — YOUR system answering mid-conversation');
        return json(res, 200, {
          result: 'Policy MER-2214 is active. Next renewal on 2027-03-01. No pending claims.',
        });
      }
      if (route === 'POST /webhooks/unith') {
        if (!verifySignature(rawBody, req.headers['x-signature-256'])) {
          console.warn('   🚫 invalid signature — rejected');
          return json(res, 401, { error: 'invalid signature' });
        }
        console.log('   ✅ signature verified (HMAC SHA-256)');
        // Ack fast (UNITH times out at 5 s), then process.
        json(res, 200, { received: true });
        return await handleWebhook(payload);
      }
      return json(res, 404, { error: 'not found' });
    } catch (err) {
      console.error('   💥', err.message);
      if (!res.headersSent) json(res, 500, { error: err.message });
    }
  });
});

function json(res, status, body) {
  // CORS headers so the companion page (a local file) can call this server.
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization, ngrok-skip-browser-warning',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(body));
}

server.listen(PORT, () => {
  console.log(`UNITH demo server listening on http://localhost:${PORT}`);
  console.log(`  POST /plugin           — plugin-mode endpoint (bring your own LLM/SLM)`);
  console.log(`  POST /webhooks/unith   — lifecycle events + auto log retrieval`);
  console.log(`  Expose it:  cloudflared tunnel --url http://localhost:${PORT}   (or: ngrok http ${PORT})`);
});
