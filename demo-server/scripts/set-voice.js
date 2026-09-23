// Chapter 3 — switch a head's voice with one call.
// We work with ElevenLabs and Azure; when changing provider, always update
// ttsprovider and ttsvoice together. Docs: https://docs.unith.ai/voice-selection-guide-tts
//
// Usage: npm run voice -- <headId> <ttsprovider> <ttsvoice...>
// e.g.:  npm run voice -- abc123 elevenlabs jessica eleven turbo v2 5
import { api, pretty, withCamel } from '../lib/unith.js';

const [headId, ttsprovider, ...voiceParts] = process.argv.slice(2);
const ttsvoice = voiceParts.join(' ');
if (!headId || !ttsprovider || !ttsvoice) {
  console.error('Usage: npm run voice -- <headId> <ttsprovider> <ttsvoice>');
  process.exit(1);
}

pretty(await api('PUT', '/head/update', withCamel({ id: headId, ttsprovider, ttsvoice })));
console.log('\n→ Talk to the head again: new voice, same everything else.');
console.log('  Want YOUR brand voice? Send us a clean audio sample and we clone it into your account.');
