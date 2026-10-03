import { prepareState, applyLocalAction } from './browser-core.mjs';
const networkFetch = window.fetch.bind(window);
const KEY = 'sales-jarvis-fictional-netlify-v1';
const seed = await (await networkFetch('/seed.json')).json();
let state;
try { const saved=localStorage.getItem(KEY); state=prepareState(saved?JSON.parse(saved):seed); }
catch { state=prepareState(seed); }
const reply = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
let queue=Promise.resolve();
window.fetch = (input, options={}) => {
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(url.origin!==location.origin || !url.pathname.startsWith('/api/'))return networkFetch(input,options);
  if(url.pathname==='/api/state')return Promise.resolve(reply(structuredClone(state)));
  if(url.pathname==='/api/health')return Promise.resolve(reply({app:'sales-jarvis',schemaVersion:1,mode:'offline'}));
  if(url.pathname==='/api/elevenlabs/status')return Promise.resolve(reply({configured:false,ready:false,mode:'offline',label:'Guided offline demo',error:'Live voice is available only in the local desktop app. This shared static demo supports typed requests and customer actions.'}));
  if(url.pathname!=='/api/action')return Promise.resolve(reply({error:'External connectors, provider keys, live voice and imports are unavailable in this shared demo.'},409));
  const task=queue.then(async()=>{
    try {
      const action=JSON.parse(options.body||'{}');
      if(action.type==='note'&&!action.sourceId){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${action.leadId}\n${action.text}`));action.sourceId=`source-note-${Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('').slice(0,20)}`;}
      const result=applyLocalAction(state,action);
      // Persist before exposing success: a quota/privacy failure is a failed save.
      localStorage.setItem(KEY,JSON.stringify(result.state));state=result.state;
      return reply(result);
    }catch(error){return reply({error:error.message||'The browser-local action failed.'},error.status||400);}
  });queue=task.catch(()=>{});return task;
};
