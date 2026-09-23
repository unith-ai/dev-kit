// Chapter 4 — create a PLUGIN MODE digital human wired to the local demo server.
// This is the "bring your own LLM / SLM" mode: UNITH forwards every user
// message to the URL below; whatever the server returns is what the head speaks.
// Docs: https://docs.unith.ai/create-a-digital-human (Plugin Mode payload)
//
// Prerequisites: `npm start` running, tunnel up, TUNNEL_URL set in .env.
import { api, env, pretty, trackHead, withCamel } from '../lib/unith.js';

const name = process.argv[2] ?? 'demo-plugin';
const endpoint = `${env('TUNNEL_URL').replace(/\/$/, '')}/plugin`;

const payload = {
  headvisualid: env('UNITH_HEAD_VISUAL_ID'),
  name,
  alias: 'Plugin Demo',
  operationmode: 'plugin',
  pluginoperationalmodeconfig: {
    name: 'demo-local-server',
    url: endpoint,
    options: {},
  },
  ttsprovider: env('UNITH_TTS_PROVIDER', 'elevenlabs'),
  ttsvoice: env('UNITH_TTS_VOICE', 'Xb7hH8MSUJpSbSDYk0k2_eleven_turbo_v2_5'),
  ocprovider: 'playground',
  languagespeechrecognition: 'en-US',
  language: 'en-US',
  greetings: 'Hi! Everything I say from now on comes from a server YOU control.',
  videostreaming: true,
};
if (process.env.UNITH_ORG_ID) payload.orgid = process.env.UNITH_ORG_ID;

console.log(`Wiring head "${name}" → ${endpoint}\n`);
const result = await api('POST', '/head/create', withCamel(payload));
pretty(result);
trackHead({ id: result.publicId ?? result.publicid, uuid: result.id, name, mode: 'plugin' });

console.log('\n→ Talk to the head and watch the server console: the text arrives there,');
console.log('  the reply is generated there. Try the word "pricing" to fire the trigger.');
console.log(`→ ${result.publicUrl ?? result.publicurl}`);
