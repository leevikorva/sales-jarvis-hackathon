import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist');
await mkdir(out, { recursive: true });
await cp(join(root, 'src/public'), out, { recursive: true });
let core = await readFile(join(root, 'src/vendor/core.mjs'), 'utf8');
core = core.slice(core.indexOf('const DEMO_TIME'), core.indexOf('export async function createEngine'));
core = core.replace("const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 20);", "const hash = value => Array.from(String(value)).reduce((h,c) => Math.imul(h ^ c.charCodeAt(0),16777619) >>> 0,2166136261).toString(16);");
core = core.replace('const uid = prefix => `${prefix}-${randomUUID()}`;', 'const uid = prefix => `${prefix}-${crypto.randomUUID()}`;');
core = core.replace("['lead-warm', 'lead-optout']", "['lead-warm', 'lead-optout', 'lead-unconfirmed']").replace("['lead-clinical', 'lead-timing']", "['lead-clinical', 'lead-timing', 'lead-declined']");
core = core.replace('All six lead conversations', 'All eight lead conversations');
core = "// Derived from the original local core: same guards and action execution; filesystem adapter removed.\nimport { provider, routeIntent } from './provider.mjs';\n" + core + `
export function prepareState(seed) { const state = structuredClone(seed); validateState(state); refresh(state); return state; }
export function applyLocalAction(state, action) {
  if (['import','live_event'].includes(action?.type)) throw new ActionError('This shared fictional demo accepts no file imports or provider sessions.', 409);
  const next=structuredClone(state); const result=execute(next,action); refresh(next);
  resolveEvidence(next,result.evidenceIds); validateState(next);
  if(JSON.stringify(next)!==JSON.stringify(state)){next.revision=state.revision+1;next.updatedAt=new Date().toISOString();}
  return {...result,state:next};
}
`;
if (/node:|createHash|randomUUID\(\)(?!\})/.test(core.replace('crypto.randomUUID()', 'browserUUID'))) throw new Error('Unexpected Node runtime dependency in browser core.');
await writeFile(join(out, 'browser-core.mjs'), core);
await cp(join(root, 'src/vendor/provider.mjs'), join(out, 'provider.mjs'));
await cp(join(root, 'src/browser-api.mjs'), join(out, 'browser-api.mjs'));
await cp(join(root, 'src/seed.json'), join(out, 'seed.json'));
let app = await readFile(join(root, 'src/public/app.js'), 'utf8');
app = "import './browser-api.mjs';\n" + app;
const begin = app.indexOf('function connectionsView()');
const end = app.indexOf('function activityPanel(', begin);
if (begin < 0 || end < 0) throw new Error('Frontend connection-view boundary changed.');
app = app.slice(0,begin) + `function connectionsView() {
  return el('section',{class:'panel'},el('h2',{text:'Shared guided demo'}),el('p',{text:'Eight fictional SPIN buyers. Qualification, source-linked drafts and internal handoffs run in this browser and stay on this device.'}),el('p',{text:'Live voice, provider connections, file imports, email sending and external CRM sync are unavailable in this static demo. No API key is needed.'}));
}
` + app.slice(end);
app = app.replace("type: 'file', id: 'context-files',", "type: 'file', disabled: true, id: 'context-files',");
await writeFile(join(out, 'app.js'), app);
let ui = await readFile(join(out, 'manager-ui.mjs'), 'utf8');
ui = ui.replace("'Voice not connected · click to type'", "'Guided offline demo · click to type'");
await writeFile(join(out, 'manager-ui.mjs'), ui);
await writeFile(join(out, '_headers'), "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'\n");
console.log('Built dependency-free static Sales Jarvis demo: dist/');
