/** Sales Jarvis presentation only. The application adapter owns all I/O. */
const NS = 'http://www.w3.org/2000/svg';
const glyphs = {
  command:['M5 4h14v12H9l-4 4V4Z','M9 8h6','M9 12h4'],
  people:['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M17 4a4 4 0 0 1 0 7','M22 21v-2a4 4 0 0 0-3-3.9'],
  review:['M8 3h8l4 4v14H4V3h4Z','M14 3v5h6','m8 14 2 2 5-5'],
  context:['m12 3 9 5-9 5-9-5 9-5Z','m3 12 9 5 9-5','m3 16 9 5 9-5'],
  activity:['M3 12h4l3-8 4 16 3-8h4'],
  source:['M6 3h9l4 4v14H5V3h1Z','M14 3v5h5','M9 12h6','M9 16h4'],
  arrow:['M5 12h14','m13 6 6 6-6 6'],
  up:['M12 19V5','m6 11 6-6 6 6'],
  mic:['M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Z','M5 10v2a7 7 0 0 0 14 0v-2','M12 19v3','M8 22h8'],
  stop:['M6 6h12v12H6Z'],
  check:['m5 12 4 4L19 6'],
  close:['m6 6 12 12','m18 6-12 12'],
  settings:['M4 7h16','M4 17h16','M8 4v6','M16 14v6'],
  sparkle:['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z'],
};
function icon(name) {
  const s = document.createElementNS(NS,'svg');
  for (const [k,v] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',class:'jm-icon'})) s.setAttribute(k,v);
  for (const d of glyphs[name] || glyphs.command) { const p=document.createElementNS(NS,'path');p.setAttribute('d',d);s.append(p); }
  return s;
}
function node(tag,attrs={},...children) {
  const n=document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (v===undefined || v===null || v===false) continue;
    if (k==='class') n.className=v;
    else if (k==='text') n.textContent=String(v);
    else if (k==='value') n.value=v;
    else if (k==='disabled') n.disabled=!!v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2),v);
    else n.setAttribute(k,v===true?'':String(v));
  }
  for (const c of children.flat(Infinity)) if (c!==null && c!==undefined && c!==false) n.append(c instanceof Node?c:document.createTextNode(String(c)));
  return n;
}
const time = value => { const d=new Date(value);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(d); };
const initials = text => String(text||'?').split(/\s+/).map(w=>w[0]).slice(0,2).join('');
const stageLabel = l => l.permission==='do_not_contact'?'Do not contact':({new:'To understand',qualified:'Interest confirmed',drafted:'Draft ready',handoff:'With founder',suppressed:'Do not contact'}[l.stage]||l.stage||'To understand');
const views = [['workspace','Workspace','command'],['outbound','Outbound','arrow'],['customers','CRM','people'],['review','Follow-ups','review'],['context','Business context','context'],['activity','Completed work','activity']];

/**
 * @param {HTMLElement} root
 * @param {{action:Function,getVoiceStatus?:Function,startVoice?:Function,stopVoice?:Function,onNavigate?:Function,startText?:Function,setConversationMode?:Function}} adapter
 * @returns {{update:Function,destroy:Function}}
 */
export function mountManagerUI(root, adapter={}) {
  if (!(root instanceof HTMLElement)) throw new TypeError('mountManagerUI needs an HTML root.');
  let state={},snapshot={},view='workspace',selectedId=null,busy=false,destroyed=false;
  let chatValue='',noteValue='',goalValue=null,notice='',error='',sourceOpen=null,showHistory=false,lastMessageCount=0;
  const shell=node('div',{class:'jm'});
  root.append(shell);
  const stateList = key => Array.isArray(state[key])?state[key]:[];
  const currentLead = () => stateList('leads').find(l=>l.id===selectedId);
  const voice = () => { let v={};try {v=adapter.getVoiceStatus?.()||{};}catch{} return {...v,...(snapshot.voice||snapshot.voiceStatus||{})}; };
  function button(label,fn,style='jm-button',attrs={}) {return node('button',{type:'button',class:style,onclick:fn,disabled:busy,...attrs},label);}
  function pill(text,kind='') {return node('span',{class:`jm-pill ${kind}`,text});}
  function focusCommand(text='',leadId) { if(leadId) selectedId=leadId;view='workspace';if(text) chatValue=text;render();shell.querySelector('[data-testid="manager-command"]')?.focus(); }
  function navigate(next,id) { view=next;if(id)selectedId=id;sourceOpen=null;error='';render();adapter.onNavigate?.(next,id);shell.querySelector('main')?.focus({preventScroll:true});shell.scrollIntoView({block:'start',behavior:'instant'}); }
  function sources(ids=[]) { return node('div',{class:'jm-citations'},[...new Set(ids.filter(Boolean))].map(id=>{
    const s=stateList('sources').find(x=>x.id===id);
    return s?button([icon('source'),s.title],()=>openSource(id),'jm-source',{'aria-label':`Read source: ${s.title}`}):node('span',{class:'jm-muted',text:`Source unavailable: ${id}`});
  })); }
  function openSource(id) {sourceOpen=id;render();shell.querySelector('dialog button')?.focus();}
  function accept(next) {
    if (!next) return;
    snapshot=next.state?{...snapshot,...next}:next;
    const candidate=next.state||next;
    if (!state.revision || candidate.revision===undefined || candidate.revision>=state.revision) state=candidate;
    if (!stateList('leads').some(l=>l.id===selectedId)) selectedId=null;
  }
  async function act(payload) {
    if (busy||destroyed) return;
    busy=true;error='';notice='';render();
    try {
      if (typeof adapter.action!=='function') throw new Error('The application connection is unavailable. Your request has not run.');
      const result=await adapter.action(payload);
      if(destroyed)return;
      if(result?.state) accept(result);
      if(result?.error)throw new Error(result.error);
      // A resolved call alone is not proof that work completed.
      notice=payload.type==='chat'&&result?.state&&result?.message?.length>240?'Jarvis replied. See the conversation and completed local work.':result?.message||'Request passed to Jarvis. Completed work appears when the application confirms it.';
      if(payload.type==='chat')chatValue='';
      if(payload.type==='note')noteValue='';
      if(payload.type==='context')goalValue=null;
    }catch(e){if(!destroyed)error=e.message||'The request could not complete. Try again.';}
    finally{if(!destroyed){busy=false;render();}}
  }
  async function voiceAction(fn) {
    if(!fn||busy)return;
    error='';try{await fn();}catch(e){error=e.message||'Voice could not start. You can still type your request.';}
    if(!destroyed)render();
  }
  function modeLabel(v) {
    const connected=['connected','listening','speaking'].includes(v.status||v.state||v.sessionState);
    if(connected && (v.inputMode||v.mode)==='voice')return v.agentMode==='speaking'||v.status==='speaking'?'Jarvis is speaking':'Listening to you';
    if(connected)return 'Live text connected';
    if((v.status||v.state||v.sessionState)==='connecting')return 'Connecting to Jarvis';
    return v.ready?'Voice is ready':'Type to Jarvis';
  }
  function aiStage() {
    const v=voice();const status=v.status||v.state||v.sessionState||'disconnected';
    const active=['connected','listening','speaking'].includes(status);const connecting=status==='connecting';
    const speaking=v.agentMode==='speaking'||status==='speaking';const voiceLive=active&&(v.inputMode||v.mode)==='voice';
    const label=active||connecting?'End conversation':v.ready&&adapter.startVoice?'Talk to Jarvis':'Ask Jarvis';
    const handle=()=>{
      if(active||connecting)return voiceAction(adapter.stopVoice?.bind(adapter));
      if(v.ready&&adapter.startVoice)return voiceAction(async()=>{await adapter.setConversationMode?.('live');await adapter.startVoice();});
      focusCommand();
    };
    return node('section',{class:'jm-ai-stage','aria-label':'Start with Jarvis'},
      node('p',{class:'jm-ai-intro',text:state.business?.owner==='Founder'?'Demo Founder, meet your AI sales partner.':'Your AI sales partner.'}),
      node('h1',{text:'Let’s move your business forward.'}),
      node('p',{class:'jm-ai-description',text:'Bring an idea, a question, or your next big goal. Start a conversation with Jarvis.'}),
      button([node('span',{class:`jm-ai-orb ${connecting?'is-connecting':voiceLive?(speaking?'is-speaking':'is-listening'):''}`,'aria-hidden':'true'},node('span',{class:'jm-ai-halo halo-one'}),node('span',{class:'jm-ai-halo halo-two'}),node('span',{class:'jm-ai-halo halo-three'}),node('span',{class:'jm-ai-orb-core'},active||connecting?icon('stop'):icon('sparkle'),node('span',{text:'AI'})),node('span',{class:'jm-ai-orb-glint'})),node('span',{class:'jm-ai-button-label',text:label})],handle,'jm-ai-button',{id:'jm-ai-button','data-testid':active||connecting?'manager-stop-voice':'manager-start-voice','aria-label':label,disabled:active||connecting?!adapter.stopVoice:busy}),
      node('div',{class:'jm-ai-status',role:'status','data-testid':'manager-voice-status'},node('span',{class:`jm-ai-state-dot ${voiceLive?'is-live':''}`}),node('span',{text:active||connecting?modeLabel(v):v.ready?'Voice ready · click to begin':'Voice not connected · click to type'})),
      button([icon('command'),'Type instead'],()=>focusCommand(),'jm-ai-text-fallback',{'data-testid':'manager-type-instead'}),
      v.error&&node('p',{class:'jm-error',text:v.error}));
  }
  function ideaCards() {
    const ideas=[
      ['customers','Find the right customers','Start with who needs your offer.','Help me understand which customers in our current context are a good match. Explain the evidence and the next useful step.'],
      ['offer','Make my offer clearer','Turn a thought into a useful plan.','Help me clarify my business offer and goal. Use our context, ask one important missing question, and keep unknown prices and product claims unknown.'],
      ['conversation','Prepare my next conversation','Give a promising relationship a next step.','Help me prepare the next safe customer conversation. Inspect the latest context before suggesting a follow-up.'],
    ];
    return node('section',{class:'jm-ideas','aria-label':'Ideas to explore with Jarvis'},node('div',{class:'jm-section-heading'},node('h2',{text:'A few places to start'}),node('span',{class:'jm-muted',text:'Bring your own idea, too.'})),node('div',{class:'jm-idea-grid'},ideas.map(([name,title,description,prompt])=>button([
      node('span',{class:'jm-idea-image'},node('img',{src:new URL(`./manager-ui-assets/${name}.jpg`,import.meta.url).href,alt:'',width:900,height:520,loading:'eager',decoding:'async'})),
      node('span',{class:'jm-idea-copy'},node('strong',{text:title}),node('span',{text:description})),icon('arrow')
    ],()=>focusCommand(prompt),'jm-idea-card',{'data-testid':`manager-idea-${name}`}))));
  }
  function voiceInstrument(compact=false) {
    const v=voice();const status=v.status||v.state||v.sessionState||'disconnected';
    const active=['connected','listening','speaking'].includes(status);
    const speaking=v.agentMode==='speaking'||status==='speaking';
    const voiceLive=active&&(v.inputMode||v.mode)==='voice';
    const connecting=status==='connecting';
    return node('div',{class:`jm-voice ${compact?'jm-voice-small':''}`},
      node('div',{class:`jm-instrument ${connecting?'is-connecting':voiceLive?(speaking?'is-speaking':'is-listening'):''}`,'aria-hidden':'true'},node('span',{class:'jm-orbit orbit-one'}),node('span',{class:'jm-orbit orbit-two'}),node('span',{class:'jm-orbit orbit-three'}),node('span',{class:'jm-core'},[9,16,25,34,25,16,9].map((h,i)=>node('i',{style:`--bar:${h}px;--delay:${i*80}ms`})) )),
      node('span',{class:'jm-voice-label',role:'status','data-testid':'manager-voice-status',text:modeLabel(v)}),
      !compact&&node('p',{class:'jm-muted',text:v.error?'Voice needs attention. Text is available.':voiceLive?'Speak naturally. You can interrupt.':v.ready?'Your ideas, out loud.':'Voice is not connected. Text is available.'}),
      !compact&&(active||connecting?button([icon('stop'),'End session'],()=>voiceAction(adapter.stopVoice?.bind(adapter)),'jm-button jm-secondary',{'data-testid':'manager-stop-voice',disabled:!adapter.stopVoice}):button([icon('mic'),v.ready?'Talk to Jarvis':'Voice unavailable'],()=>voiceAction(adapter.startVoice?.bind(adapter)),'jm-button jm-secondary',{'data-testid':'manager-start-voice',disabled:!v.ready||!adapter.startVoice})),
    );
  }
  function navItem(id,label,glyph,mobile=false) { const count=id==='review'?stateList('drafts').length+stateList('proposals').filter(p=>p.status==='proposed').length:0;
    return button([icon(glyph),node('span',{text:label}),!mobile&&count>0&&node('span',{class:'jm-nav-count',text:count})],()=>navigate(id),`jm-nav-link ${view===id?'is-current':''}`,{'aria-current':view===id?'page':undefined,'data-testid':`manager-nav-${id}`}); }
  function rail() { return node('aside',{class:'jm-rail'},
    button([node('span',{class:'jm-mark','aria-hidden':'true'},node('i'),node('i'),node('i')),node('strong',{text:'jarvis'})],()=>navigate('workspace'),'jm-brand',{'aria-label':'Jarvis workspace'}),
    node('div',{class:'jm-business'},node('span',{class:'jm-business-mark',text:state.business?.name||'Your business'}),node('div',{},node('strong',{text:state.business?.name||'Your workspace'}),node('span',{text:state.business?.owner==='Founder'?'Demo Founder’s workspace':'Founder workspace'}))),
    node('nav',{'aria-label':'Sales workspace'},views.map(([id,l,g])=>navItem(id,l,g))),
    node('div',{class:'jm-rail-foot'},button([icon('settings'),'Connections'],()=>navigate('connections'),'jm-nav-link',{'data-testid':'manager-connections',disabled:!adapter.onNavigate}),node('div',{class:'jm-founder'},node('span',{class:'jm-avatar',text:initials(state.business?.owner==='Founder'?'Demo Founder':state.business?.owner||'You')}),node('div',{},node('strong',{text:state.business?.owner==='Founder'?'Demo Founder':state.business?.owner||'Your workspace'}),node('span',{text:'A little less admin. More conversation.'})))));
  }
  function header() {return node('header',{class:'jm-topbar'},node('div',{class:'jm-breadcrumb'},node('span',{text:state.business?.name||'Business'}),node('span',{class:'jm-slash',text:'/'}),node('strong',{text:(view==='connections'?'Connections':views.find(x=>x[0]===view)?.[1])||'Workspace'})),node('div',{class:'jm-top-status'},pill(state.sources?.some(s=>s.status==='synthetic')?'Synthetic demo':'Local workspace','jm-demo'),node('span',{class:'jm-save',text:busy?'Working…':state.updatedAt?`Saved ${time(state.updatedAt)}`:'Waiting for context'})));}
  function message(m) {return node('article',{class:`jm-message ${m.role==='user'?'is-user':''}`},node('span',{class:'jm-message-avatar',text:m.role==='user'?'You':'J'}),node('div',{class:'jm-message-body'},node('div',{class:'jm-message-label'},node('strong',{text:m.role==='user'?'You':'Jarvis'}),node('span',{text:time(m.createdAt)})),node('p',{text:m.text||m.message||''}),sources(m.evidenceIds)));}
  function conversation() {
    const msgs=stateList('messages');const visible=showHistory?msgs:msgs.slice(-4);const hasConversation=showHistory||msgs.some(m=>m.role==='user');
    const input=node('textarea',{id:'jm-command','data-testid':'manager-command',rows:'2','aria-label':'Tell Jarvis your goal',placeholder:'I have an idea. Help me turn it into my next sales move…',value:chatValue,oninput:e=>{chatValue=e.target.value;}});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(chatValue.trim())act({type:'chat',text:chatValue.trim(),...(selectedId?{leadId:selectedId}:{})});}});
    const v=voice();
    const sessionStatus=v.status||v.state||v.sessionState;const liveBadge=v.conversationMode==='live'?(sessionStatus==='connected'?'Live AI connected':v.ready?'Live AI ready':'Connection needed'):v.label||state.provider?.label||'Local assistant';
    return node('section',{class:'jm-command-panel','aria-label':'Conversation with Jarvis'},
      node('div',{class:'jm-panel-heading'},node('div',{},node('h2',{text:'One conversation. Your whole sales picture.'}),node('p',{text:'Start with an idea, a question or a customer. Jarvis uses your context to help.'})),pill(liveBadge)),
      (adapter.setConversationMode||adapter.startText)&&node('div',{class:'jm-session-controls'},adapter.setConversationMode&&button('Local assistant',()=>voiceAction(()=>adapter.setConversationMode('offline')),'jm-text-button',{'aria-pressed':v.conversationMode!=='live'}),adapter.setConversationMode&&button('Live AI',()=>voiceAction(()=>adapter.setConversationMode('live')),'jm-text-button',{'aria-pressed':v.conversationMode==='live'}),adapter.startText&&v.ready&&button('Start live text',()=>voiceAction(adapter.startText.bind(adapter)),'jm-text-button')),
      visible.length&&hasConversation?node('div',{class:'jm-messages','data-testid':'manager-messages',role:'log','aria-label':'Jarvis conversation','aria-live':'polite'},visible.map(message)):node('p',{class:'jm-conversation-invite',text:'Tell Jarvis what you want to achieve. Start small; the next step can be prepared for review.'}),
      msgs.length>4&&button(showHistory?'Show recent conversation':`See all ${msgs.length} messages`,()=>{showHistory=!showHistory;render();},'jm-text-button'),
      node('form',{class:'jm-composer',onsubmit:e=>{e.preventDefault();if(chatValue.trim())act({type:'chat',text:chatValue.trim(),...(selectedId?{leadId:selectedId}:{})});}},input,node('div',{class:'jm-composer-foot'},button([icon('context'),selectedId?currentLead()?.company||'Business context':'Whole business context'],()=>navigate(selectedId?'customers':'context',selectedId),'jm-context-chip'),node('div',{class:'jm-send-group'},node('span',{text:'Enter to send'}),node('button',{type:'submit',class:'jm-send','aria-label':'Send request to Jarvis','data-testid':'manager-send',disabled:busy},icon('up'))))),
      node('div',{class:'jm-prompt-row'},[['Help me choose a next step','Help me prioritize suitable customers and explain the next useful move.'],['Turn my idea into a plan','I have a business idea. Help me clarify my goal and build a source-backed sales plan.'],['Prepare a follow-up','Prepare a safe follow-up for this customer using the latest context.']].map(([l,t])=>button(l,()=>focusCommand(t),'jm-prompt'))),
      node('p',{class:'jm-command-note'},icon('review'),'Drafts and proposals are prepared for review. External actions need your approval.'),
      (v.error||v.notice)&&node('p',{class:v.error?'jm-error':'jm-muted',text:v.error||v.notice}));
  }
  function actionableLeads() {return stateList('leads').filter(l=>l.permission!=='do_not_contact'&&l.interest!=='withdrawn'&&l.stage!=='handoff'&&!/unsupported|respect the latest customer timing|wait until|pause outreach|withdrawn/i.test(l.nextAction||'')).sort((a,b)=>(b.interest==='expressed')-(a.interest==='expressed')||b.fit-a.fit).slice(0,2);}
  function nextMoves() {const leads=actionableLeads();return node('section',{class:'jm-work-section'},node('div',{class:'jm-section-heading'},node('h2',{text:'Next useful moves'}),button('See customers',()=>navigate('customers'),'jm-text-button')),
    leads.length?leads.map((l,i)=>button([node('span',{class:'jm-move-number',text:i+1}),node('span',{class:'jm-move-copy'},node('strong',{text:l.company}),node('span',{text:l.nextAction||'Inspect the latest source before choosing an action.'})),icon('arrow')],()=>{selectedId=l.id;focusCommand(`Help me choose the next safe move for ${l.company}. Explain what we know and what needs confirmation.`,l.id);},'jm-move')):node('p',{class:'jm-muted',text:'Start with your goal. A useful next step needs customer context.'}));}
  function completed(limit=3) {const items=stateList('activity').filter(x=>x.type!=='session'&&x.type!=='proposal').slice(-limit).reverse();return node('section',{class:'jm-work-section'},node('div',{class:'jm-section-heading'},node('h2',{text:'Completed locally'}),limit<100?button('View all work',()=>navigate('activity'),'jm-text-button',{'data-testid':'manager-all-work'}):pill(`${items.length?stateList('activity').filter(x=>x.type!=='session'&&x.type!=='proposal').length:0} records`)),
    items.length?node('ol',{class:'jm-done-list'},items.map(a=>node('li',{},node('span',{class:'jm-done-icon'},icon('check')),node('div',{},node('strong',{text:stateList('leads').find(l=>l.id===a.leadId)?.company||'Business workspace'}),node('p',{text:a.text}),node('div',{class:'jm-done-meta'},node('span',{text:time(a.createdAt)}),sources(a.evidenceIds||[a.sourceId])))))):node('p',{class:'jm-muted',text:'Nothing recorded yet. Confirmed local work will appear here.'}));}
  function workspace() {return node('div',{class:'jm-workspace'},aiStage(),conversation(),ideaCards(),node('div',{class:'jm-goal'},node('span',{class:'jm-goal-icon'},icon('sparkle')),node('div',{},node('span',{class:'jm-muted',text:'The goal we’re working towards'}),node('p',{text:state.business?.goal||'Tell Jarvis what you want to achieve.'})),button('Edit goal',()=>navigate('context'),'jm-text-button')),node('div',{class:'jm-work-strip'},nextMoves(),completed()));}
  function contextMargin() { const l=currentLead()||actionableLeads()[0];const drafts=stateList('drafts');const proposals=stateList('proposals').filter(p=>p.status==='proposed');const unknowns=state.context?.unknowns||[];
    return node('aside',{class:'jm-margin','aria-label':'Useful context'},node('section',{class:'jm-margin-section'},node('div',{class:'jm-section-heading'},node('h2',{text:'Worth a conversation'}),icon('people')),l?node('div',{},node('div',{class:'jm-customer-heading'},node('span',{class:'jm-company-avatar',text:initials(l.company)}),node('div',{},node('h3',{text:l.company}),node('p',{text:l.contact}))),pill(stageLabel(l),l.permission==='do_not_contact'?'jm-danger':'jm-good'),node('p',{class:'jm-customer-next',text:l.nextAction}),sources(l.evidenceIds),button([`Explore ${l.contact?.split(' ')[0]||'customer'}’s context`,icon('arrow')],()=>navigate('customers',l.id),'jm-button jm-secondary')):node('p',{class:'jm-muted',text:'Customer context will appear when you add it.'})),
      node('section',{class:'jm-margin-section'},node('div',{class:'jm-section-heading'},node('h2',{text:'For your review'}),pill(drafts.length+proposals.length)),node('p',{text:drafts.length||proposals.length?'Prepared work, waiting for your judgment.':'No drafts or proposals waiting yet.'}),drafts.slice(0,2).map(d=>button([icon('review'),node('span',{},node('strong',{text:stateList('leads').find(l=>l.id===d.leadId)?.company||d.subject}),node('small',{text:'Follow-up draft · not sent'}))],()=>navigate('review',d.leadId),'jm-review-link')),proposals.slice(0,1).map(p=>button([icon('review'),p.title],()=>navigate('review'),'jm-review-link'))),
      node('section',{class:'jm-margin-section jm-unknowns'},node('h2',{text:'A little clarity first'}),node('p',{text:unknowns.length?'These details still need confirmation. Jarvis keeps them out of promises.':'Review your business facts before using them in a customer offer.'}),unknowns.length?node('ul',{},unknowns.slice(0,3).map(x=>node('li',{text:x}))):null,button([icon('context'),'Open business context'],()=>navigate('context'),'jm-text-button')),
      node('p',{class:'jm-margin-foot',text:'Suggestions come from the supplied context. Saved records show what actually happened.'}));
  }
  function pageHeading(title,description) {return node('div',{class:'jm-page-heading'},node('h1',{text:title}),node('p',{text:description}));}
  function outbound() {
    const leads=stateList('leads').filter(l=>l.permission!=='do_not_contact'&&l.interest!=='withdrawn'&&!['handoff','suppressed'].includes(l.stage)&&!/unsupported|respect the latest customer timing|wait until|pause outreach|withdrawn/i.test(l.nextAction||''));
    return node('div',{},pageHeading('Outbound. Start with the right conversation.','Choose a prospect, understand their context and prepare the next move with Jarvis.'),
      node('section',{class:'jm-review-card'},node('h2',{text:'Build your outreach plan'}),node('p',{text:'Jarvis can help prioritize the customers already in your CRM and prepare a relevant approach.'}),button([icon('sparkle'),'Plan outbound with Jarvis'],()=>focusCommand('Help me plan outbound using the customers in my CRM. Prioritize suitable prospects, respect contact restrictions and explain the source evidence before preparing outreach.'),'jm-button jm-primary',{'data-testid':'manager-outbound-plan'})),
      leads.length?leads.map(l=>node('article',{class:'jm-review-card'},node('div',{class:'jm-section-heading'},node('h2',{text:l.company}),pill(stageLabel(l))),node('p',{class:'jm-muted',text:l.contact}),node('p',{text:l.nextAction||'Review the latest customer context before outreach.'}),sources(l.evidenceIds||[]),node('div',{class:'jm-detail-actions'},button('Discuss outreach with Jarvis',()=>focusCommand(`Help me prepare a relevant outreach approach for ${l.company}. Check the latest sources, timing and contact permission first.`,l.id),'jm-button jm-primary'),button('Open in CRM',()=>navigate('customers',l.id),'jm-button jm-secondary')))):node('p',{class:'jm-empty',text:'No suitable prospects available yet. Review your CRM and add customer context before planning outreach.'}));
  }
  function customers() {const l=currentLead()||stateList('leads')[0];return node('div',{},pageHeading('CRM. Every relationship in context.','A customer’s latest words matter more than a score.'),node('div',{class:'jm-customer-layout'},node('div',{class:'jm-customer-list'},stateList('leads').map(x=>button([node('span',{class:'jm-company-avatar',text:initials(x.company)}),node('span',{class:'jm-customer-list-copy'},node('strong',{text:x.company}),node('span',{text:x.contact}),pill(stageLabel(x),x.permission==='do_not_contact'?'jm-danger':''))],()=>{selectedId=x.id;render();},`jm-customer-row ${l?.id===x.id?'selected':''}`,{'data-testid':`manager-customer-${x.id}`,'aria-pressed':l?.id===x.id}))),l&&node('section',{class:'jm-detail'},node('h2',{text:l.company}),node('p',{class:'jm-muted',text:`${l.contact} · ${l.role||''}`}),node('dl',{class:'jm-facts'},node('dt',{text:'Interest'}),node('dd',{text:l.interest==='expressed'?'Expressed':l.interest==='withdrawn'?'Withdrawn':'Unconfirmed'}),node('dt',{text:'Contact permission'}),node('dd',{text:l.permission==='do_not_contact'?'Do not contact':l.permission||'Unknown'}),node('dt',{text:'Fit to demo criteria'}),node('dd',{text:Number.isFinite(l.fit)?`${l.fit}%`:'Not assessed'})),node('h3',{text:'The next considered step'}),node('p',{text:l.nextAction}),sources(l.evidenceIds.concat((l.notes||[]).map(n=>n.sourceId))),node('div',{class:'jm-detail-actions'},button('Discuss with Jarvis',()=>focusCommand(`Help me understand ${l.company} and the next safe move.`,l.id),'jm-button jm-primary'),button('Review qualification',()=>act({type:'qualify',leadId:l.id}),'jm-button jm-secondary',{'data-testid':'manager-qualify'}),button('Prepare follow-up',()=>act({type:'draft',leadId:l.id}),'jm-button jm-secondary',{'data-testid':'manager-draft',disabled:busy||l.permission==='do_not_contact'||l.interest==='withdrawn'}),button('Record founder handoff',()=>act({type:'handoff',leadId:l.id}),'jm-button jm-secondary',{'data-testid':'manager-handoff',disabled:busy||l.permission==='do_not_contact'||l.interest==='withdrawn'||l.stage==='handoff'})),node('p',{class:'jm-muted',text:'The application checks customer restrictions and source evidence before saving work.'}),node('form',{class:'jm-note-form',onsubmit:e=>{e.preventDefault();if(noteValue.trim())act({type:'note',leadId:l.id,text:noteValue.trim()});}},node('label',{for:'jm-note',text:'What changed in this conversation?'}),node('textarea',{id:'jm-note',rows:3,'aria-label':'Customer update',value:noteValue,placeholder:'Add their latest reply, a timing change or a contact restriction.',oninput:e=>noteValue=e.target.value}),node('button',{class:'jm-button jm-secondary',type:'submit',disabled:busy,text:'Save local note'})),(l.notes||[]).map(n=>node('div',{class:'jm-saved-note'},node('p',{text:n.text}),sources([n.sourceId]))))));}
  function review() {return node('div',{},pageHeading('Follow-ups. Ready for your review.','Inspect prepared drafts and proposals. Nothing here sends outreach or spends money.'),!stateList('drafts').length&&!stateList('proposals').length&&node('p',{class:'jm-empty',text:'No prepared work yet. Ask Jarvis to help with a follow-up or a sales plan.'}),stateList('drafts').map(d=>node('article',{class:'jm-review-card'},node('div',{class:'jm-section-heading'},node('h2',{text:stateList('leads').find(l=>l.id===d.leadId)?.company||'Follow-up'}),pill('Local draft · not sent')),node('h3',{text:d.subject}),node('div',{class:'jm-draft-body',text:d.body}),sources(d.evidenceIds),button('Discuss this draft',()=>focusCommand(`Review the saved draft for ${stateList('leads').find(l=>l.id===d.leadId)?.company||'this customer'}. Explain missing facts before outreach.`,d.leadId),'jm-button jm-secondary'))),stateList('proposals').map(p=>node('article',{class:'jm-review-card'},node('div',{class:'jm-section-heading'},node('h2',{text:p.title||'Proposed plan'}),pill(p.status||'Proposed')),node('p',{class:'jm-proposal-text',text:p.text||p.description||'Open this proposal with Jarvis to inspect it.'}),sources(p.evidenceIds),button('Discuss proposal',()=>focusCommand(`Explain the proposal "${p.title}" and the assumptions that need review.`),'jm-button jm-secondary'))),button('Discuss a sales plan',()=>focusCommand('Help me make a sales plan from the business context. Ask for the most important missing detail first.'),'jm-button jm-primary'));}
  function contextView() {return node('div',{},pageHeading('One shared picture of your business.','Jarvis uses the facts you supply. Unknowns stay unknown until reviewed.'),node('form',{class:'jm-review-card',onsubmit:e=>{e.preventDefault();if((goalValue??state.business?.goal??'').trim())act({type:'context',goal:(goalValue??state.business?.goal??'').trim()});}},node('label',{for:'jm-goal-edit',text:'What are you working towards?'}),node('textarea',{id:'jm-goal-edit',rows:3,value:goalValue??state.business?.goal??'',oninput:e=>goalValue=e.target.value}),node('button',{class:'jm-button jm-primary',type:'submit',disabled:busy,text:'Save goal locally'})),node('section',{class:'jm-review-card'},node('h2',{text:'Facts we can refer to'}),(state.context?.facts||[]).map(f=>node('div',{class:'jm-context-fact'},node('h3',{text:f.label}),node('p',{text:f.value}),pill(f.status||'Needs review'),sources([f.sourceId])))),node('section',{class:'jm-review-card jm-context-unknowns'},node('h2',{text:'Details to confirm'}),node('ul',{},(state.context?.unknowns||[]).map(x=>node('li',{text:x})))),node('section',{class:'jm-review-card'},node('h2',{text:'Original sources'}),stateList('sources').map(s=>button([icon('source'),node('span',{},node('strong',{text:s.title}),node('small',{text:`${s.kind||'Source'} · ${s.status||'Needs review'}`})),icon('arrow')],()=>openSource(s.id),'jm-library-row'))));}
  function connectionsView() {
    return node('div',{class:'jm-connections'},adapter.renderConnections?.()||node('div',{},pageHeading('Connections. Your tools, together.','Connect your services without leaving your workspace.'),node('section',{class:'jm-review-card'},node('h2',{text:'ElevenLabs'}),node('p',{text:voice().ready?'Ready for live sessions.':'Voice is not connected yet. Connection controls are unavailable in this preview.'}),button('Back to Jarvis',()=>navigate('workspace'),'jm-button jm-primary'))));
  }
  function activityView() {return node('div',{},pageHeading('The work is visible.','Only records returned by the application appear here. Demo records are synthetic; saved work is local.'),completed(100),snapshot.toolReceipts?.length?node('section',{class:'jm-review-card'},node('h2',{text:'Confirmed tool results'}),snapshot.toolReceipts.map(r=>node('article',{class:'jm-tool-receipt'},node('h3',{text:r.name||'Local tool'}),node('p',{text:r.text||r.message}),sources(r.evidenceIds)))):null);}
  function render() {
    if(destroyed)return;
    const active=document.activeElement;const ownsFocus=shell.contains(active);const focusId=ownsFocus?active.id:null;const focusTest=ownsFocus?active.getAttribute('data-testid'):null;const selection=active&&'selectionStart'in active?{start:active.selectionStart,end:active.selectionEnd}:null;
    const messageScroll=shell.querySelector('.jm-messages')?.scrollTop||0;
    shell.setAttribute('aria-busy',String(busy));
    const content=({workspace,outbound,customers,review,context:contextView,activity:activityView,connections:connectionsView}[view]||workspace)();
    if(view==='context')content.firstElementChild?.after(button([icon('settings'),'Manage connections'],()=>navigate('connections'),'jm-button jm-secondary jm-context-connect',{'data-testid':'manager-mobile-connections',disabled:!adapter.onNavigate}));
    const main=node('main',{id:'jm-main',tabindex:'-1',class:'jm-main','data-testid':`manager-view-${view}`},content);
    shell.replaceChildren(...[node('a',{class:'jm-skip',href:'#jm-main',text:'Skip to workspace'}),rail(),node('div',{class:'jm-body'},header(),node('div',{class:`jm-content ${view==='workspace'?'with-margin':''}`},main,view==='workspace'&&contextMargin())),node('nav',{class:'jm-mobile-nav','aria-label':'Quick navigation'},[['workspace','Workspace','command'],['outbound','Outbound','arrow'],['customers','CRM','people'],['review','Follow-ups','review'],['context','Context','context']].map(([id,l,g])=>navItem(id,l,g,true))),
      (notice||error)&&node('div',{class:`jm-notice ${error?'jm-error':''}`,role:error?'alert':'status'},node('p',{text:error||notice}),button(icon('close'),()=>{notice='';error='';render();},'jm-icon-button',{'aria-label':'Dismiss status',disabled:false})),
      sourceOpen&&sourceDialog()].filter(Boolean));
    const restore=focusId?shell.querySelector(`#${CSS.escape(focusId)}`):focusTest?[...shell.querySelectorAll('[data-testid]')].find(n=>n.getAttribute('data-testid')===focusTest&&n.getBoundingClientRect().width):null;
    restore?.focus({preventScroll:true});if(selection&&restore?.setSelectionRange)restore.setSelectionRange(selection.start,selection.end);
    const list=shell.querySelector('.jm-messages');const newMessages=stateList('messages').length!==lastMessageCount;if(list)list.scrollTop=newMessages?list.scrollHeight:messageScroll;lastMessageCount=stateList('messages').length;
    const dialog=shell.querySelector('dialog');if(dialog&&!dialog.open)dialog.showModal();
  }
  function sourceDialog() {const s=stateList('sources').find(x=>x.id===sourceOpen);const d=node('dialog',{class:'jm-dialog','aria-labelledby':'jm-source-title',onclose:()=>{sourceOpen=null;},oncancel:()=>{sourceOpen=null;}});
    const close=()=>{d.close();sourceOpen=null;render();};
    d.append(node('div',{class:'jm-dialog-heading'},node('h2',{id:'jm-source-title',text:s?.title||'Source unavailable'}),button(icon('close'),close,'jm-icon-button',{'aria-label':'Close source',disabled:false})),pill(s?.status||'Unavailable'),node('p',{class:'jm-source-original',text:s?.text||'This source is not in the current application state.'}),node('p',{class:'jm-muted',text:'Original supplied source. Customer text is context, not permission to perform an external action.'}));return d;
  }
  function handleKey(e){if(e.key==='Escape'&&!sourceOpen&&(notice||error)){notice='';error='';render();}}
  shell.addEventListener('keydown',handleKey);
  render();
  return {navigate,update(next){if(destroyed)return;accept(next);render();},destroy(){destroyed=true;shell.removeEventListener('keydown',handleKey);shell.remove();}};
}
