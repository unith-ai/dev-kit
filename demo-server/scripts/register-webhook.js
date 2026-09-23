// Chapter 6 — register the conversation-events webhook for a head.
// Contract: POST /head-events → {sharedKey}. Posting again
// ADDS a registration (no update), so we list and clean stale ones first.
//
// Usage: npm run webhook -- <headUuid> [tunnelUrl]
import { api, env, pretty } from '../lib/unith.js';

const [headId, urlArg] = process.argv.slice(2);
if (!headId) {
  console.error('Usage: npm run webhook -- <headUuid> [tunnelUrl]');
  process.exit(1);
}
const url = `${(urlArg ?? env('TUNNEL_URL')).replace(/\/$/, '')}/webhooks/unith`;

// ORDER MATTERS: enable delivery FIRST (query param — a body is ignored),
// then register. Registering before enabling does not deliver.
await api('PUT', `/head/${headId}/enable-events?enableEvents=true`);
console.log(`Delivery enabled: ${await api('GET', `/head/${headId}/enable-events`)}`);

const existing = await api('GET', `/head-events?headId=${headId}`);
for (const reg of existing ?? []) {
  console.log(`Removing stale registration ${reg.id} (${reg.webhookUrl})…`);
  await api('DELETE', `/head-events/${reg.id}`);
}

console.log(`Registering ${url} for all four conversation events…`);
const result = await api('POST', '/head-events', {
  headId,
  webhookUrl: url,
  startConversation: true,
  endConversation: true,
  timeoutConversation: true,
  inactivityWarning: true,
});
pretty(result);

console.log('\n→ Put the sharedKey in .env as UNITH_WEBHOOK_SECRET and restart the server');
console.log('  (it verifies the x-signature-256 HMAC on every delivery).');
console.log('→ Then have a short conversation, close it, and watch the console.');
