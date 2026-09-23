// Chapter 3 — create an Open Conversation digital human, entirely by API.
// Docs: https://docs.unith.ai/create-a-digital-human
import { api, env, pretty, trackHead, withCamel } from '../lib/unith.js';

const name = process.argv[2] ?? 'demo-oc';

const payload = {
  headvisualid: env('UNITH_HEAD_VISUAL_ID'),
  name,
  alias: 'Demo Assistant',
  operationmode: 'oc',
  // The system prompt key is system_prompt (snake_case).
  promptconfig: {
    system_prompt:
      'You are a friendly assistant created live during a UNITH technical demo. Keep answers short and conversational.',
  },
  ttsprovider: env('UNITH_TTS_PROVIDER', 'elevenlabs'),
  ttsvoice: env('UNITH_TTS_VOICE', 'Xb7hH8MSUJpSbSDYk0k2_eleven_turbo_v2_5'),
  ocprovider: 'playground',
  languagespeechrecognition: 'en-US',
  language: 'en-US',
  greetings: 'Hi! I was created live, thirty seconds ago, with one API call.',
  videostreaming: true,
};
if (process.env.UNITH_ORG_ID) payload.orgid = process.env.UNITH_ORG_ID;

const result = await api('POST', '/head/create', withCamel(payload));
pretty(result);
trackHead({ id: result.publicId ?? result.publicid, uuid: result.id, name, mode: 'oc' });

console.log('\n→ Refresh interFace (https://app.unith.ai): the head is already there.');
console.log(`→ Talk to it now: ${result.publicUrl ?? result.publicurl}`);
