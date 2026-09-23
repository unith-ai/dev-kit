// Chapter 5 — equip an OC head with the two demo tools AND the prompt block
// that tells it when to call them:
//   · check_policy_status → GET-style data lookup (server answers demo data)
//   · capture_lead        → fires when the user gives their email; the tool
//                           RESPONSE steers the conversation (birthday twist)
//
// Contract: PUT /head/{uuid}/conversation-settings with the
// body wrapped in conversationSettings; the PUT replaces the whole object so
// we merge over current settings. The prompt goes via PUT /head/update.
//
// Usage: npm run tools -- <headUuid> [tunnelUrl]
import { api, env, pretty } from '../lib/unith.js';

const [headId, urlArg] = process.argv.slice(2);
if (!headId) {
  console.error('Usage: npm run tools -- <headUuid> [tunnelUrl]');
  process.exit(1);
}
const base = (urlArg ?? env('TUNNEL_URL')).replace(/\/$/, '');

// Parameters are a LIST of {name, description} objects — any other shape
// stops the head loading.
const TOOLS = [
  {
    name: 'check_policy_status',
    description: 'Check the status of the insurance policy of the current user',
    url: `${base}/tools/policy-status`,
    parameters: [{ name: 'policy_holder', description: 'The full name of the policy holder' }],
  },
  {
    name: 'capture_lead',
    description:
      'Save a new sales lead. Call this as soon as the user has provided their email address.',
    url: `${base}/tools/capture-lead`,
    parameters: [
      { name: 'name', description: 'The name of the user' },
      { name: 'email', description: 'The email address of the user' },
    ],
  },
];

// The prompt block is half of the feature: it tells the head WHEN to call each
// tool, and to obey instructions that come back in tool results.
const PROMPT =
  'Prioritise natural, engaging speech cadence. You are the virtual assistant of Meridian Insurance in a live demo. ' +
  'Keep every answer short and conversational, one or two spoken sentences, no markdown. ' +
  'LEAD CAPTURE: your first goal is to learn the visitor\'s name, and after that their email address. Ask naturally, one thing at a time. ' +
  'The moment the user provides their email address, call the capture_lead tool with the parameters name and email. ' +
  'POLICY QUESTIONS: if the user asks about their policy or its status, call the check_policy_status tool and answer with what it returns. ' +
  'TOOL RESULTS: after any tool responds, follow the instructions contained in the tool result faithfully.';

console.log('Current settings (merged over, not lost):');
const current = await api('GET', `/head/${headId}/conversation-settings`);
pretty(current);

console.log(`\n1/2 — Wiring both tools → ${base}/tools/*`);
pretty(await api('PUT', `/head/${headId}/conversation-settings`, {
  conversationSettings: { ...(current.conversationSettings ?? {}), tools: TOOLS },
}));

console.log('\n2/2 — Updating the prompt with the tool instructions…');
await api('PUT', '/head/update', { id: headId, promptConfig: { system_prompt: PROMPT } });

console.log('\n→ Talk to the head. It will ask your name, then your email — type the');
console.log('  email in chat. Watch the console: ⚡ NEW LEAD arrives, and the tool');
console.log('  response tells the head it is your birthday. It should congratulate you.');
console.log('→ Also try: "can you check my policy status?"');
