// Chapter 2 — discovery: who am I, and what faces/categories can I use?
// The same calls are copy-pasteable from the companion guide.
import { api, pretty } from '../lib/unith.js';

const me = await api('GET', '/user/me');
const org = me.organisation ?? {};

console.log('=== Organisation ===');
pretty({
  name: org.name,
  publicId: org.publicId,
  orgId: org.id,
  apiKey: org.apiKey,
  subscriptionType: org.subscriptionType,
  slots: org.slots,
  streaming: org.streaming,
});

console.log('\n=== Head visuals (GET /head_visual/face/all) ===');
const visuals = await api('GET', '/head_visual/face/all?order=ASC&page=1&take=50');
for (const v of visuals.data ?? []) {
  console.log(`  ${v.id}  ${v.name}  (${v.gender?.toLowerCase()}, ${v.permissionType})`);
}

console.log('\n=== Voices (GET /voice/all — filterable) ===');
// Filters: language, accent, gender, languageCode, provider, displayName, filterOutProvider
const voices = await api('GET', '/voice/all?order=ASC&page=1&take=10&sortBy=displayName');
for (const v of voices.data ?? []) {
  console.log(`  ${v.voiceId}  ${v.displayName}  (${v.language} · ${v.accent} · ${v.gender?.toLowerCase()} · ${v.provider})`);
}
console.log(`  … ${voices.meta?.itemCount} voices in total across ${voices.meta?.pageCount} pages.`);
console.log('  Try: /voice/all?language=Spanish&gender=FEMALE&provider=elevenlabs');

console.log('\n=== Categories (GET /category/all) ===');
pretty(await api('GET', '/category/all'));
