// Chapter 3 (quick setting) — swap the LLM provider/model behind an OC head.
// Supported providers today: openai, groq. Groq also serves fast open-source
// SLMs — switch to one and feel the latency drop.
// Docs: https://docs.unith.ai/advanced-conversational-settings-llm-provider-external-tools
//
// Usage: npm run llm -- <headId> <provider> <llmName> <providerApiKey> [maxTokens]
// e.g.:  npm run llm -- abc123 groq llama-3.1-8b-instant gsk_xxx 512
import { api, pretty } from '../lib/unith.js';

const [headId, provider, llmName, apiKey, maxTokens] = process.argv.slice(2);
if (!headId || !provider || !llmName || !apiKey) {
  console.error('Usage: npm run llm -- <headId> <provider: openai|groq> <llmName> <providerApiKey> [maxTokens]');
  process.exit(1);
}

console.log('Current settings (the PUT REPLACES this whole object — keep a copy):');
const current = await api('GET', `/head/${headId}/conversation-settings`);
pretty(current);

// The body must be wrapped in conversationSettings (a flat body is rejected with 400).
// Merge over the existing settings so tools etc. survive the update.
const settings = { ...(current.conversationSettings ?? {}), provider, llmName, apiKey };
if (maxTokens) settings.maxTokens = Number(maxTokens);

console.log(`\nSwitching to ${provider} / ${llmName}…`);
pretty(await api('PUT', `/head/${headId}/conversation-settings`, { conversationSettings: settings }));
console.log('\n→ Ask the head the same question as before and compare the response time.');
