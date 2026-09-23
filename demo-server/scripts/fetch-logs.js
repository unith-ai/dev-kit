// Chapter 6 — retrieve and filter conversation logs on demand.
// Docs: https://docs.unith.ai/conversation-logs-retrieval
//
// Usage: npm run logs                     → today's conversations for the org
//        npm run logs -- <sessionId>      → full transcript of one session
import { api, env, pretty, DATA_API } from '../lib/unith.js';

const orgId = env('UNITH_PUBLIC_ORG_ID');
const sessionId = process.argv[2];

if (sessionId) {
  console.log(`=== Transcript for session ${sessionId} ===`);
  pretty(await api('GET', `${DATA_API}/sessions/${orgId}/${sessionId}`));
} else {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const qs = new URLSearchParams({
    org_id: orgId,
    start_date: dayStart.toISOString(),
    end_date: now.toISOString(),
    // Also filterable by: head_id, username, data_tag (set via embed attributes)
  });
  console.log('=== Conversations today ===');
  pretty(await api('GET', `${DATA_API}/conversations?${qs}`));
  console.log('\n→ Transcript of one session: npm run logs -- <sessionId>');
}
