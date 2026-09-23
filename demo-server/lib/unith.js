// Minimal UNITH platform API client — zero dependencies, Node >= 18.
// Docs: https://docs.unith.ai/user (auth) · https://docs.unith.ai/getting-started
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --- .env loader (so we need no dotenv package) -----------------------------
const envPath = resolve(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] !== '' && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  }
}

export function env(key, fallback) {
  const v = process.env[key] ?? fallback;
  if (v === undefined) {
    console.error(`Missing env var ${key} — copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return v;
}

export const PLATFORM_API = 'https://platform-api.unith.ai';
// Conversation data API (conversation logs and transcripts).
export const DATA_API = 'https://api.data.unith.ai';

// --- Bearer token: exchange the secret key, cache for 6 days (valid 7) ------
const TOKEN_CACHE = resolve(ROOT, '.token.json');
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

export async function getBearer() {
  if (existsSync(TOKEN_CACHE)) {
    const { bearer, fetchedAt } = JSON.parse(readFileSync(TOKEN_CACHE, 'utf8'));
    if (Date.now() - fetchedAt < SIX_DAYS_MS) return bearer;
  }
  // Send the key as both secretKey and secretkey for compatibility.
  const payload = {
    email: env('UNITH_EMAIL'),
    secretKey: env('UNITH_SECRET_KEY'),
    secretkey: env('UNITH_SECRET_KEY'),
  };
  logRequest('POST', `${PLATFORM_API}/auth/token`, payload, { auth: false });
  const res = await fetch(`${PLATFORM_API}/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  console.log(`← ${res.status} ${res.statusText}  (bearer cached in .token.json for 6 days)\n`);
  if (!res.ok) throw new Error(`POST /auth/token → ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  writeFileSync(TOKEN_CACHE, JSON.stringify({ bearer: data.bearer, fetchedAt: Date.now() }));
  return data.bearer;
}

// --- Teaching mode: print every request so you can SEE the API calls --------
const MASK = /^(apikey|secretkey|api_key|bottoken)$/i;

function maskSecrets(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = MASK.test(k) && typeof v === 'string'
      ? v.slice(0, 4) + '…' + v.slice(-4)
      : maskSecrets(v);
  }
  return out;
}

function logRequest(method, url, body, { auth = true } = {}) {
  console.log(`\n→ ${method} ${url}`);
  if (auth) console.log('  authorization: Bearer eyJhbGci…  (7-day token)');
  if (body !== undefined) {
    console.log(JSON.stringify(maskSecrets(body), null, 2).replace(/^/gm, '  '));
  }
}

// --- Generic authenticated call ----------------------------------------------
export async function api(method, path, body) {
  const bearer = await getBearer();
  const url = path.startsWith('http') ? path : `${PLATFORM_API}${path}`;
  logRequest(method, url, body);
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${bearer}`,
      accept: 'application/json',
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`← ${res.status} ${res.statusText}\n`);
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}\n${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

export const pretty = (obj) => console.log(JSON.stringify(obj, null, 2));

// Send each field in both lowercase and camelCase (e.g. headvisualid and
// headVisualId) so the payload is accepted in either form.
const CAMEL = {
  headvisualid: 'headVisualId', operationmode: 'operationMode',
  ttsprovider: 'ttsProvider', ttsvoice: 'ttsVoice',
  languagespeechrecognition: 'languageSpeechRecognition',
  promptconfig: 'promptConfig', ocprovider: 'ocProvider',
  videostreaming: 'videoStreaming', orgid: 'orgId',
  pluginoperationalmodeconfig: 'pluginOperationalModeConfig',
};
export function withCamel(payload) {
  const out = { ...payload };
  for (const [k, v] of Object.entries(payload)) if (CAMEL[k]) out[CAMEL[k]] = v;
  return out;
}

// --- Track heads created by these scripts, so `npm run reset` can clean up --
const HEADS_FILE = resolve(ROOT, '.demo-heads.json');

export function trackHead(head) {
  const list = existsSync(HEADS_FILE) ? JSON.parse(readFileSync(HEADS_FILE, 'utf8')) : [];
  list.push({ ...head, createdAt: new Date().toISOString() });
  writeFileSync(HEADS_FILE, JSON.stringify(list, null, 2));
}

export function trackedHeads() {
  return existsSync(HEADS_FILE) ? JSON.parse(readFileSync(HEADS_FILE, 'utf8')) : [];
}

export function clearTrackedHeads() {
  writeFileSync(HEADS_FILE, '[]');
}
