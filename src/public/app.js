import { mountManagerUI } from './manager-ui.mjs';
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const sourceDialog = document.querySelector('#source-dialog');
let state;
let view = 'today';
let selectedId;
let busy = false;
let menuOpen = false;
let toastTimer;
let chatValue = '';
let noteValue = '';
let providerStatus = { configured: false, ready: false, label: 'Guided offline demo' };
let providerChecked = false;
let providerBusy = false;
let conversationMode = 'offline';
let liveSession = null;
let liveSessionId = null;
let liveSessionState = 'disconnected';
let liveInputMode = 'text';
let liveAgentMode = 'listening';
let liveNotice = '';
let liveError = '';
let liveTimer;
let sessionGeneration = 0;
let eventQueue = Promise.resolve();
const userEchoes = new Map();
const toolReceipts = [];
let managerController;
let managerPlan;
let presentation = new URL(location.href).searchParams.get('workspace') === 'crm' ? 'crm' : 'manager';
const clientToolNames = ['readDemoState', 'inspectDemoEvidence', 'proposeSalesPlan', 'qualifyLeads', 'prepareFollowUp', 'recordFounderHandoff', 'recordDemoNote', 'updateDemoGoal'];
const mobileQuery = matchMedia('(max-width: 650px)');
const views = [
  ['today', 'Today', 'spark'], ['pipeline', 'Pipeline', 'pipeline'],
  ['context', 'Shared context', 'layers'], ['conversations', 'Conversations', 'chat'],
  ['acquisition', 'Acquisition', 'signal'], ['connections', 'Connections', 'connect'],
];

// All customer and imported text enters the DOM through textContent.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'value') node.value = value;
    else if (key === 'checked') node.checked = value;
    else if (key === 'disabled') node.disabled = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', `icon ${className}`);
  const shapes = {
    spark: ['M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z'],
    pipeline: ['M4 4h16v4H4z', 'M4 12h10v3H4z', 'M4 19h5v1H4z'],
    layers: ['M12 3 3 8l9 5 9-5-9-5Z', 'M3 12l9 5 9-5', 'M3 16l9 5 9-5'],
    chat: ['M4 4h16v12H9l-5 4V4Z', 'M8 8h8', 'M8 12h5'],
    signal: ['M5 19V13', 'M12 19V8', 'M19 19V3'],
    connect: ['M9 8V4', 'M15 8V4', 'M6 8h12v3a6 6 0 0 1-12 0V8Z', 'M12 17v4'],
    arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
    send: ['M12 19V5', 'm6 11 6-6 6 6'],
    source: ['M7 3h8l4 4v14H5V3h2Z', 'M14 3v5h5', 'M9 12h6', 'M9 16h6'],
    check: ['m5 12 4 4L19 6'],
    close: ['m6 6 12 12', 'm18 6-12 12'],
    menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
    upload: ['M12 16V3', 'm7 8 5-5 5 5', 'M4 15v6h16v-6'],
    clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 7v5l3 2'],
    monitor: ['M3 4h18v13H3V4Z', 'M8 21h8', 'M12 17v4'],
    phone: ['M8 2h8v20H8V2Z', 'M11 18h2'],
    globe: ['M3 12h18', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 3c-5 5-5 13 0 18 5-5 5-13 0-18'],
    copy: ['M8 8h12v13H8V8Z', 'M16 8V3H3v13h5'],
    plus: ['M12 5v14', 'M5 12h14'],
    mic: ['M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Z', 'M5 10v2a7 7 0 0 0 14 0v-2', 'M12 19v3', 'M8 22h8'],
    stop: ['M6 6h12v12H6V6Z'],
  };
  for (const d of (shapes[name] || shapes.spark)) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d); svg.append(p);
  }
  return svg;
}
function ring(className = '') {
  return el('span', { class: `jarvis-ring ${className}`, 'aria-hidden': true }, el('span', { class: 'ring-core' }));
}
const fmt = value => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const dateFmt = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
const lead = () => state.leads.find(l => l.id === selectedId) || state.leads[0];
function notify(message, error = false) {
  clearTimeout(toastTimer); toast.textContent = message; toast.className = `toast visible ${error ? 'error' : ''}`;
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, error ? 8000 : 4500);
}
function button(label, onClick, className = 'button', attrs = {}) {
  return el('button', { type: 'button', class: className, onclick: onClick, disabled: busy, ...attrs }, label);
}
function badge(text, kind = '') { return el('span', { class: `badge ${kind}`, text }); }
function acceptState(next) {
  if (next?.schemaVersion && (!state || next.revision >= state.revision)) state = next;
}
async function providerRequest(route, body) {
  const response = await fetch(`/api/elevenlabs/${route}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The ElevenLabs connection could not complete.');
  return result;
}
async function refreshProviderStatus() {
  try { providerStatus = await providerRequest('status'); }
  catch { providerStatus = { ...providerStatus, ready: false, error: 'ElevenLabs status is unavailable. Offline rules remain available.' }; }
  providerChecked = true; render();
}
function persistLiveEvent(type, text, evidenceIds = [], eventLeadId = selectedId, eventSessionId = liveSessionId) {
  eventQueue = eventQueue.catch(() => {}).then(async () => {
    const saved = await providerRequest('event', { sessionId: eventSessionId, type, text, leadId: eventLeadId, evidenceIds });
    acceptState(saved.state || saved); render(); return true;
  }).catch(() => { liveError = 'A live transcript update could not be saved. Stop the session and retry from the local workspace.'; render(); return false; });
  return eventQueue;
}
function receiveLiveMessage(event) {
  const text = typeof event.message === 'string' ? event.message.trim() : '';
  if (!text) return;
  const type = event.source === 'user' ? 'user' : event.source === 'ai' || event.source === 'assistant' ? 'assistant' : null;
  if (!type) return;
  if (type === 'user' && userEchoes.get(text)) {
    const count = userEchoes.get(text) - 1;
    count ? userEchoes.set(text, count) : userEchoes.delete(text);
    return;
  }
  persistLiveEvent(type, text);
}
async function executeLiveTool(name, args = {}) {
  const toolSessionId = liveSessionId;
  const toolGeneration = sessionGeneration;
  try {
    await eventQueue;
    if (!toolSessionId || toolGeneration !== sessionGeneration || toolSessionId !== liveSessionId) return JSON.stringify({ error: 'This demo session has ended.', actionCompleted: false });
    const output = await providerRequest('tool', { sessionId: toolSessionId, name, args });
    acceptState(output.state);
    if (output.result?.plan) managerPlan = output.result.plan;
    const receipt = { name, text: output.message || 'Local tool completed.', evidenceIds: output.evidenceIds || [], createdAt: new Date().toISOString() };
    toolReceipts.unshift(receipt); toolReceipts.splice(4);
    if (args.leadId && state.leads.some(l => l.id === args.leadId)) selectedId = args.leadId;
    render();
    await persistLiveEvent('tool', `${name}: ${receipt.text}`, receipt.evidenceIds, args.leadId || selectedId, toolSessionId);
    // Only the server's filtered synthetic result crosses the provider boundary.
    return JSON.stringify(output.result ?? { message: receipt.text, evidenceIds: receipt.evidenceIds });
  } catch (error) {
    liveError = error.message; render();
    return JSON.stringify({ error: error.message, actionCompleted: false });
  }
}
async function startLiveSession(requestedMode) {
  if (!providerStatus.ready || liveSession || liveSessionState === 'connecting') return;
  const generation = ++sessionGeneration;
  liveSessionState = 'connecting'; liveInputMode = requestedMode; liveError = ''; liveNotice = ''; render();
  let mode = requestedMode;
  if (mode === 'voice') {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch {
      mode = 'text'; liveInputMode = 'text'; liveNotice = 'Microphone unavailable. Continuing with live text.'; render();
    }
  }
  try {
    const { Conversation } = await import('/elevenlabs-client.js');
    if (generation !== sessionGeneration) return;
    const credential = await providerRequest('session', { mode });
    const reservedAt = Date.now(); liveSessionId = credential.sessionId;
    if (generation !== sessionGeneration) {
      const cancelledId = credential.sessionId;
      await persistLiveEvent('session', 'ElevenLabs live session closed before connection.', [], selectedId, cancelledId);
      if (liveSessionId === cancelledId) liveSessionId = null;
      return;
    }
    const options = {
      ...(mode === 'voice' ? { conversationToken: credential.conversationToken, connectionType: 'webrtc' } : { signedUrl: credential.signedUrl, connectionType: 'websocket', overrides: { conversation: { textOnly: true } } }),
      clientTools: Object.fromEntries(clientToolNames.map(name => [name, args => generation === sessionGeneration ? executeLiveTool(name, args) : JSON.stringify({ error: 'This demo session has ended.' })])),
      onMessage: event => { if (generation === sessionGeneration) receiveLiveMessage(event); },
      onConnect: () => { if (generation !== sessionGeneration) return; liveSessionState = 'connected'; liveAgentMode = 'listening'; render(); },
      onDisconnect: () => { if (generation !== sessionGeneration) return; clearTimeout(liveTimer); const endedId = liveSessionId; liveSession = null; liveSessionId = null; liveSessionState = 'disconnected'; userEchoes.clear(); persistLiveEvent('session', 'ElevenLabs live session ended.', [], selectedId, endedId); render(); },
      onStatusChange: event => { if (generation !== sessionGeneration) return; liveSessionState = event.status; render(); },
      onModeChange: event => { if (generation !== sessionGeneration) return; liveAgentMode = event.mode; render(); },
      onError: () => { if (generation !== sessionGeneration) return; liveError = 'The live connection encountered an error. Stop the session and try Start text again.'; render(); },
    };
    const session = await Conversation.startSession(options);
    if (generation !== sessionGeneration) { await session.endSession(); return; }
    liveSession = session; liveSessionState = 'connected'; liveInputMode = mode;
    updateSelectedLiveContext();
    liveTimer = setTimeout(() => { liveNotice = 'The bounded demo session finished. Start another session when ready.'; stopLiveSession('limit'); }, Math.max(0, Math.min(90, credential.maxDurationSeconds || 90) * 1000 - (Date.now() - reservedAt) - 1000));
    persistLiveEvent('session', `ElevenLabs live ${mode} session started. Synthetic SPIN demo only.`); render();
  } catch (error) {
    const failedId = liveSessionId; liveSessionId = null;
    liveSession = null; liveSessionState = 'disconnected';
    if (failedId) persistLiveEvent('session', 'ElevenLabs live session closed because the connection could not start.', [], selectedId, failedId);
    liveError = /daily demo-session limit/i.test(error?.message || '') ? error.message : 'The live session could not start. Check ElevenLabs in Connections, or continue with Offline rules.'; render();
  }
}
async function stopLiveSession(reason = 'user') {
  const session = liveSession; const stoppedId = liveSessionId; liveSession = null; liveSessionId = null; liveSessionState = 'disconnected'; ++sessionGeneration; clearTimeout(liveTimer); userEchoes.clear(); render();
  try { if (session) await session.endSession(); }
  catch { liveError = 'The session connection has closed. Refresh if audio continues.'; render(); }
  if (stoppedId) await persistLiveEvent('session', reason === 'limit' ? 'ElevenLabs live session stopped at the bounded demo limit.' : 'ElevenLabs live session stopped by the user.', [], selectedId, stoppedId);
}
async function setConversationMode(mode) {
  if (mode === 'offline' && (liveSession || liveSessionState === 'connecting')) await stopLiveSession();
  conversationMode = mode; liveError = ''; liveNotice = ''; render();
  if (mode === 'live') await refreshProviderStatus();
}
async function sendChat(text) {
  if (!text || busy) return;
  if (conversationMode === 'offline') return act({ type: 'chat', text, leadId: selectedId });
  if (!liveSession || liveSessionState !== 'connected') { liveError = 'Start a live text or voice session before sending a message.'; render(); return { error: liveError }; }
  try {
    userEchoes.set(text, (userEchoes.get(text) || 0) + 1);
    const saved = await persistLiveEvent('user', text);
    if (!saved || !liveSession) { userEchoes.delete(text); return { error: liveError || 'The message was not sent.' }; }
    updateSelectedLiveContext(); liveSession.sendUserMessage(text);
    chatValue = ''; render(); return { state, message: 'Request sent to live Jarvis. Saved work appears after the local tools confirm it.' };
  } catch { userEchoes.delete(text); liveError = 'The message could not reach ElevenLabs. Stop the session and try Start text again.'; render(); return { error: liveError }; }
}
async function saveElevenLabsConnection(input, fromClipboard = false) {
  if (providerBusy) return;
  const key = input?.value || '';
  if (input) input.value = '';
  if (!fromClipboard && !key.trim()) { notify('Enter the API key or use a key you just copied from ElevenLabs.', true); return; }
  providerBusy = true; liveError = ''; render();
  try {
    providerStatus = await providerRequest('connect', fromClipboard ? { fromClipboard: true } : { apiKey: key });
    providerChecked = true; notify('ElevenLabs key saved in macOS Keychain.');
  } catch (error) { liveError = error.message; }
  finally { providerBusy = false; render(); }
}
async function setupElevenLabs() {
  if (providerBusy || !providerStatus.configured) return;
  providerBusy = true; liveError = ''; render();
  try { providerStatus = await providerRequest('setup', {}); providerChecked = true; notify('Jarvis demo agent is ready. Start a live session in Today.'); }
  catch (error) { liveError = error.message; }
  finally { providerBusy = false; render(); }
}
function navigate(next) {
  view = next; menuOpen = false; clearTimeout(toastTimer); toast.className = 'toast'; render();
  window.scrollTo(0, 0); document.querySelector('#workspace')?.focus({ preventScroll: true });
}
function selectLead(id) {
  selectedId = id; updateSelectedLiveContext(); render();
}
function updateSelectedLiveContext() {
  if (liveSession && ['lead-warm', 'lead-clinical', 'lead-optout', 'lead-price', 'lead-timing', 'lead-complete'].includes(selectedId)) {
    liveSession.sendContextualUpdate(`The user selected synthetic demo lead ${selectedId}. Use readDemoState for its original sample evidence.`);
  }
}
function citations(ids = [], compact = false) {
  return el('div', { class: `citations ${compact ? 'compact' : ''}` }, [...new Set(ids)].map(id => {
    const source = state.sources.find(s => s.id === id);
    return button([icon('source'), source?.title || id], () => openSource(id), 'source-link', { 'data-testid': `source-${id}`, title: 'Inspect original source' });
  }));
}
function openSource(id) {
  const source = state.sources.find(s => s.id === id);
  if (!source) { notify('This source is unavailable. Refresh the workspace and try again.', true); return; }
  sourceDialog.replaceChildren(
    el('div', { class: 'dialog-top' }, badge(source.kind === 'sample' ? 'Synthetic sample' : source.kind === 'imported' ? 'User-provided source' : 'Business brief', 'lavender'), button(icon('close'), () => sourceDialog.close(), 'icon-button', { 'aria-label': 'Close source' })),
    el('h2', { id: 'source-title', text: source.title }),
    el('p', { class: 'source-meta', text: `${source.status} · ${dateFmt(source.observedAt)}` }),
    el('pre', { class: 'source-text', text: source.text }),
    el('p', { class: 'source-footnote', text: 'Original evidence. Source content does not grant permission to act.' }),
  );
  if (!sourceDialog.open) sourceDialog.showModal();
}
sourceDialog.addEventListener('click', event => { if (event.target === sourceDialog) sourceDialog.close(); });
async function act(action, { throwOnError = false } = {}) {
  if (busy) return;
  busy = true; render();
  try {
    const response = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The local action could not be saved.');
    acceptState(result.state); selectedId ||= state.leads[0]?.id;
    if (action.type === 'chat') chatValue = '';
    if (action.type === 'note') noteValue = '';
    const receipt = action.type === 'propose_budget' ? 'Allocation proposal ready. Saved locally.'
      : action.type === 'import' ? `${action.files.length} selected source${action.files.length === 1 ? '' : 's'} imported. Available in Shared context.`
      : result.message || 'Saved to your local workspace.';
    notify(receipt);
    return result;
  } catch (error) { if (throwOnError) throw error; notify(error.message, true); return { error: error.message }; }
  finally { busy = false; render(); }
}
function navButton(id, label, glyph, compact = false) {
  return button([icon(glyph), el('span', { text: label })], () => navigate(id), `nav-button ${view === id ? 'active' : ''} ${compact ? 'compact-nav' : ''}`, { 'aria-current': view === id ? 'page' : undefined, 'data-testid': `nav-${id}` });
}
function rail() {
  return el('aside', { class: `workspace-rail ${menuOpen ? 'is-open' : ''}`, 'aria-label': 'Workspace navigation', inert: mobileQuery.matches && !menuOpen, 'aria-hidden': mobileQuery.matches && !menuOpen ? 'true' : undefined },
    el('a', { class: 'app-brand', href: '#workspace', onclick: event => { event.preventDefault(); navigate('today'); } }, ring(), el('span', {}, 'Sales', el('strong', { text: 'Jarvis' }))),
    el('div', { class: 'business-switcher' }, el('div', { class: 'spin-wordmark', text: 'SPIN' }), el('div', {}, el('strong', { text: 'SPIN workspace' }), el('span', { text: 'Founder edition' })), el('span', { class: 'switcher-dot' })),
    el('nav', { class: 'main-nav', 'aria-label': 'Main' }, views.map(([id, label, glyph]) => navButton(id, label, glyph))),
    el('div', { class: 'rail-bottom' },
      el('div', { class: 'local-card' }, el('span', { class: 'status-dot' }), el('div', {}, el('strong', { text: 'Your local workspace' }), el('p', { text: 'Private imports stay on this device.' }))),
      el('div', { class: 'founder-profile' }, el('span', { class: 'avatar founder-avatar', text: 'S' }), el('div', {}, el('strong', { text: 'SPIN founder' }), el('span', { text: 'Ready for the next conversation' }))),
    ),
  );
}
function header() {
  const label = views.find(v => v[0] === view)?.[1] || 'Today';
  return el('header', { class: 'topbar' },
    button(icon(menuOpen ? 'close' : 'menu'), () => { menuOpen = !menuOpen; render(); }, 'icon-button mobile-menu', { 'aria-label': menuOpen ? 'Close navigation' : 'Open navigation', 'aria-expanded': menuOpen }),
    el('div', { class: 'breadcrumb' }, el('span', { text: 'Workspace' }), el('span', { text: '/' }), el('strong', { text: label })),
    el('div', { class: 'topbar-status' }, el('span', { class: `save-status ${busy ? 'saving' : ''}`, 'data-testid': 'saved-state' }, el('span', { class: 'status-dot' }), busy ? 'Saving locally…' : `Saved locally · ${fmt(state.updatedAt)}`), badge('Synthetic demo', 'demo')),
  );
}
function sectionTitle(title, subtitle, aside) {
  return el('div', { class: 'section-heading' }, el('div', {}, el('h1', { text: title }), subtitle && el('p', { text: subtitle })), aside);
}
function leadStatus(l) {
  const stages = { new: 'To review', qualified: 'Qualified', drafted: 'Draft ready', handoff: 'With founder', suppressed: 'Suppressed' };
  return badge(stages[l.stage] || l.stage, l.stage === 'handoff' || l.stage === 'qualified' ? 'green' : l.stage === 'suppressed' ? 'red' : 'lavender');
}
function leadCard(l, slim = false) {
  const restricted = l.permission === 'do_not_contact';
  return el('button', { type: 'button', class: `lead-card ${selectedId === l.id ? 'selected' : ''} ${slim ? 'slim' : ''}`, onclick: () => selectLead(l.id), 'data-testid': `lead-${l.id}`, 'aria-label': `Inspect ${l.company}`, 'aria-pressed': selectedId === l.id },
    el('div', { class: 'lead-card-top' }, el('span', { class: `company-avatar avatar-${state.leads.indexOf(l) % 4}`, text: l.company.split(' ').map(v => v[0]).slice(0, 2).join('') }), el('div', { class: 'lead-company' }, el('strong', { text: l.company }), el('span', { text: `${l.contact} · ${l.role}` })), icon('arrow', 'lead-open')),
    el('div', { class: 'lead-card-meta' }, el('span', { text: l.segment }), leadStatus(l)),
    !slim && el('div', { class: 'lead-signals' }, el('div', {}, el('span', { text: 'Fit' }), el('strong', { text: `${l.fit}%` })), el('div', {}, el('span', { text: 'Interest' }), el('strong', { text: l.interest === 'expressed' ? 'Expressed' : l.interest === 'withdrawn' ? 'Withdrawn' : 'Unconfirmed' })), el('div', {}, el('span', { text: 'Permission' }), el('strong', { class: restricted ? 'text-red' : '', text: restricted ? 'Do not contact' : l.permission === 'allowed' ? 'Allowed' : 'Unknown' }))),
    el('p', { class: 'next-action', text: l.nextAction }),
  );
}
function chatComposer() {
  const canSend = conversationMode === 'offline' || liveSessionState === 'connected';
  const input = el('textarea', { id: 'chat-input', name: 'request', rows: 2, placeholder: conversationMode === 'live' ? 'Talk to live Jarvis about the SPIN demo…' : 'Ask Jarvis to prioritize, prepare or hand off…', 'aria-label': 'Ask Jarvis', 'data-testid': 'chat-input', value: chatValue, oninput: event => { chatValue = event.target.value; } });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (input.value.trim()) sendChat(input.value.trim()); } });
  return el('form', { class: 'chat-composer', onsubmit: event => { event.preventDefault(); if (input.value.trim()) sendChat(input.value.trim()); } },
    input, el('div', { class: 'composer-bottom' }, el('span', { text: selectedId ? `Context: ${lead().company}` : 'Context: SPIN workspace' }), el('button', { type: 'submit', class: 'send-button', disabled: busy || !canSend, 'aria-label': 'Send request', 'data-testid': 'chat-send' }, busy ? el('span', { class: 'loader' }) : icon('send'))),
  );
}
function prompts() {
  return el('div', { class: 'suggested-prompts' }, [
    ['Who should I follow up with?', 'Prioritize leads and explain their next actions'],
    ['Prepare a follow-up', 'Draft a follow up for this selected lead'],
    ['What do we know?', 'Summarize context for this selected lead'],
  ].map(([label, text]) => button([icon(label.startsWith('Who') ? 'pipeline' : label.startsWith('Prepare') ? 'source' : 'layers'), label], () => sendChat(text), 'prompt-button', { disabled: busy || (conversationMode === 'live' && liveSessionState !== 'connected'), 'data-testid': `prompt-${label.startsWith('Who') ? 'prioritize' : label.startsWith('Prepare') ? 'draft' : 'context'}` })));
}
function conversationControls() {
  const connected = liveSessionState === 'connected';
  const status = liveSessionState === 'connecting' ? 'Connecting…' : connected ? liveInputMode === 'voice' ? liveAgentMode === 'speaking' ? 'Speaking' : 'Listening' : 'Text session active' : providerStatus.ready ? 'Ready to start' : providerChecked ? 'Connection needed' : 'Checking connection…';
  return el('section', { class: `conversation-controls ${conversationMode === 'live' ? 'live-selected' : ''}`, 'aria-label': 'Conversation mode' },
    el('div', { class: 'mode-control-row' },
      el('div', { class: 'conversation-mode-toggle', role: 'group', 'aria-label': 'Choose conversation mode' },
        button('Offline rules', () => setConversationMode('offline'), `mode-choice ${conversationMode === 'offline' ? 'active' : ''}`, { 'aria-pressed': conversationMode === 'offline', 'data-testid': 'conversation-mode-offline' }),
        button('Live ElevenLabs', () => setConversationMode('live'), `mode-choice ${conversationMode === 'live' ? 'active' : ''}`, { 'aria-pressed': conversationMode === 'live', 'data-testid': 'conversation-mode-live' })),
      conversationMode === 'live' && el('span', { class: `live-status ${connected ? 'connected' : ''}`, 'data-testid': 'live-session-status', role: 'status', 'aria-live': 'polite' }, el('span', { class: 'status-dot' }), status)),
    conversationMode === 'live' && el('div', { class: 'live-control-actions' },
      connected || liveSessionState === 'connecting'
        ? button([icon('stop'), 'Stop session'], stopLiveSession, 'button live-stop', { 'data-testid': 'stop-live-session', disabled: false })
        : [button([icon('chat'), 'Start text'], () => startLiveSession('text'), 'button primary', { 'data-testid': 'start-live-text', disabled: !providerStatus.ready || providerBusy }), button([icon('mic'), 'Start voice'], () => startLiveSession('voice'), 'button secondary', { 'data-testid': 'start-live-voice', disabled: !providerStatus.ready || providerBusy })],
      el('span', { class: 'live-session-note', text: connected ? '90-second demo limit · synthetic SPIN tools' : 'Microphone starts only with Start voice.' }),
      !providerStatus.ready && button('Open Connections', () => navigate('connections'), 'text-button', { 'data-testid': 'open-live-connections' })),
    conversationMode === 'live' && liveNotice && el('p', { class: 'live-notice', text: liveNotice, role: 'status' }),
    conversationMode === 'live' && (liveError || providerStatus.error) && el('p', { class: 'live-error', text: liveError || providerStatus.error, role: 'alert', 'data-testid': 'live-error' }),
  );
}
function liveToolPanel() {
  if (!toolReceipts.length) return null;
  const labels = { readDemoState: 'Demo context inspected', qualifyLeads: 'Qualification reviewed', prepareFollowUp: 'Follow-up reviewed', recordFounderHandoff: 'Founder handoff reviewed' };
  return el('section', { class: 'live-tool-panel', 'data-testid': 'live-tool-receipts', 'aria-label': 'Live tool results' }, toolReceipts.map(receipt => el('article', { class: 'live-tool-receipt' },
    el('div', { class: 'tool-receipt-heading' }, icon('check'), el('strong', { text: labels[receipt.name] || receipt.name }), badge('Local tool', 'green')),
    el('p', { text: receipt.text }), citations(receipt.evidenceIds, true))));
}
function messageList() {
  const messages = state.messages.slice(-6);
  if (!messages.length) return el('div', { class: 'conversation-empty' }, ring('small'), el('div', {}, el('strong', { text: 'One conversation. A clearer next step.' }), el('p', { text: 'Use the SPIN brief and customer evidence to prepare your next move.' })));
  return el('div', { class: 'message-list', 'data-testid': 'chat-messages', 'aria-live': 'polite' }, messages.map(m => el('article', { class: `message ${m.role}`, 'data-origin': m.origin || 'local' }, m.role === 'assistant' ? ring('small') : el('span', { class: 'message-avatar', text: 'You' }), el('div', { class: 'message-content' }, el('div', { class: 'message-label' }, el('strong', { text: m.role === 'assistant' ? /elevenlabs/i.test(m.origin || '') ? 'Jarvis · ElevenLabs' : 'Jarvis' : 'You' }), el('span', { text: fmt(m.createdAt) })), el('p', { text: m.text }), citations(m.evidenceIds, true)))));
}
function todayView() {
  const warm = state.leads.filter(l => l.interest === 'expressed' && l.fit >= state.context.handoff.minFit && l.permission !== 'do_not_contact' && l.stage !== 'handoff').sort((a, b) => b.fit - a.fit);
  return el('div', { class: 'today-view' },
    el('section', { class: 'command-hero' }, el('div', { class: 'hero-heading' }, el('span', { class: 'hero-caption', text: 'Your sales workspace, in conversation' }), ring('hero-ring')), el('h1', {}, 'Let’s find your', el('br'), 'next customer.'), el('p', { text: state.business.goal }), el('div', { class: 'hero-mode' }, el('span', { class: 'mode-dot' }), conversationMode === 'live' ? liveSessionState === 'connected' ? 'Live ElevenLabs session' : 'ElevenLabs conversation mode' : 'Guided offline assistant', el('span', { text: 'Uses your context + local tools' }))),
    el('section', { class: 'conversation-panel', 'aria-label': 'Jarvis conversation' }, conversationControls(), prompts(), messageList(), liveToolPanel(), chatComposer(), el('div', { class: 'conversation-footnote' }, icon('check'), conversationMode === 'live' ? 'Only synthetic demo context is shared with ElevenLabs. Local drafts stay for review.' : 'Drafts and proposals stay local. You review the next move.')),
    el('section', { class: 'today-leads' }, el('div', { class: 'section-heading compact-heading' }, el('div', {}, el('h2', { text: 'Conversations worth your attention' }), el('p', { text: `${warm.length} suitable demo prospects with expressed interest` })), button('View pipeline', () => navigate('pipeline'), 'text-button')), el('div', { class: 'lead-grid' }, (warm.length ? warm : state.leads).slice(0, 2).map(l => leadCard(l, true)))),
  );
}
function pipelineView() {
  return el('div', {}, sectionTitle('People, before pipeline.', 'Review fit, expressed interest and contact permission separately.', button([icon('spark'), 'Review qualification'], () => act({ type: 'qualify' }), 'button primary', { 'data-testid': 'qualify-all' })),
    el('div', { class: 'pipeline-summary' }, [['Prospects', state.leads.length], ['Interested', state.leads.filter(l => l.interest === 'expressed' && l.permission !== 'do_not_contact').length], ['Founder handoffs', state.leads.filter(l => l.stage === 'handoff').length]].map(([label, count]) => el('div', {}, el('strong', { text: count }), el('span', { text: label }))), badge('Synthetic contacts', 'demo')),
    el('div', { class: 'pipeline-list', 'data-testid': 'pipeline-list' }, state.leads.map(l => leadCard(l))),
  );
}
function contextView() {
  const goal = el('textarea', { id: 'business-goal', name: 'goal', rows: 3, value: state.business.goal, 'data-testid': 'business-goal' });
  const threshold = el('input', { id: 'fit-threshold', type: 'number', min: 0, max: 100, value: state.context.handoff.minFit, 'data-testid': 'fit-threshold' });
  const interest = el('input', { id: 'require-interest', type: 'checkbox', checked: state.context.handoff.requireInterest, 'data-testid': 'require-interest' });
  const picker = el('input', { type: 'file', id: 'context-files', multiple: true, accept: '.txt,.md,.json,text/plain,text/markdown,application/json', class: 'file-input', 'data-testid': 'context-files', onchange: importFiles });
  return el('div', {}, sectionTitle('Give Jarvis the right context.', 'Approved facts, original sources and the things we still need to learn.'),
    el('section', { class: 'context-intro' }, el('div', { class: 'spin-wordmark large', text: 'SPIN' }), el('div', {}, el('h2', { text: 'Built around your business' }), el('p', { text: state.business.description }))),
    el('form', { class: 'panel context-settings', onsubmit: event => { event.preventDefault(); act({ type: 'context', goal: goal.value, handoff: { minFit: Number(threshold.value), requireInterest: interest.checked } }); } }, el('h2', { text: 'What does a good outcome look like?' }), el('label', { for: 'business-goal', text: 'Business goal' }), goal, el('div', { class: 'handoff-settings' }, el('div', {}, el('label', { for: 'fit-threshold', text: 'Minimum fit for a founder handoff' }), el('div', { class: 'threshold-input' }, threshold, el('span', { text: '%' }))), el('label', { class: 'checkbox-label', for: 'require-interest' }, interest, 'Require expressed interest')), el('div', { class: 'form-footer' }, el('p', { text: 'Demo assumption. Saving updates only this local workspace.' }), el('button', { type: 'submit', class: 'button primary', disabled: busy, 'data-testid': 'save-context' }, 'Save context'))),
    el('section', { class: 'panel facts-panel' }, el('div', { class: 'panel-title' }, el('h2', { text: 'Business facts' }), badge('Source linked', 'lavender')), el('div', { class: 'fact-list' }, state.context.facts.map(f => el('article', { class: 'fact-row' }, el('div', {}, el('h3', { text: f.label }), el('p', { text: f.value }), citations(f.sourceId ? [f.sourceId] : [], true)), badge(f.status.replaceAll('_', ' '), f.status === 'approved' || f.status === 'confirmed' ? 'green' : 'lavender'))))),
    el('section', { class: 'unknowns-panel' }, el('h2', { text: 'Keep the unknowns visible.' }), el('p', { text: 'Jarvis uses these as questions, never as promises.' }), el('ul', {}, state.context.unknowns.map(u => el('li', { text: u })))),
    el('section', { class: 'panel import-panel' }, el('div', {}, icon('upload', 'import-icon'), el('h2', { text: 'Bring a source into the workspace' }), el('p', { text: 'Choose specific text files. Imports remain user-provided evidence until reviewed.' }), el('span', { class: 'muted small', text: '.txt, .md or .json · up to 1 MB per file · up to 8 files' })), el('label', { class: `button primary file-label ${busy ? 'disabled' : ''}`, for: 'context-files' }, 'Choose files'), picker),
    el('section', { class: 'panel' }, el('h2', { text: 'Source library' }), el('div', { class: 'source-library' }, state.sources.map(s => button([icon('source'), el('span', {}, el('strong', { text: s.title }), el('small', { text: `${s.kind === 'sample' ? 'Synthetic sample' : s.kind === 'imported' ? 'User-provided' : 'Brief'} · ${s.status}` })), icon('arrow')], () => openSource(s.id), 'library-row')))),
  );
}
async function importFiles(event) {
  const files = [...event.target.files];
  if (!files.length) return;
  if (files.length > 8) { notify('Choose up to 8 text files per import.', true); event.target.value = ''; return; }
  for (const file of files) {
    if (!/\.(txt|md|json)$/i.test(file.name)) { notify(`“${file.name}” is not a supported text file. Choose .txt, .md or .json.`, true); return; }
    if (file.size > 1024 * 1024) { notify(`“${file.name}” exceeds the 1 MB limit. Choose a smaller file.`, true); return; }
  }
  try { await act({ type: 'import', files: await Promise.all(files.map(async file => ({ name: file.name, text: await file.text() }))) }); }
  catch (error) { notify(`Could not read the selected file: ${error.message}`, true); }
}
function conversationsView() {
  const l = lead();
  const samples = state.sources.filter(s => s.kind === 'sample');
  const matching = samples.filter(s => l.evidenceIds.includes(s.id));
  const sources = matching.length ? matching : samples.slice(0, 1);
  const note = el('textarea', { id: 'conversation-note', rows: 3, value: noteValue, placeholder: 'Record a new reply, changed timing or contact restriction…', 'aria-label': 'Conversation note', 'data-testid': 'conversation-note', oninput: e => { noteValue = e.target.value; } });
  return el('div', {}, sectionTitle('The conversation comes first.', 'Original customer words, current notes and the next commitment.'),
    el('div', { class: 'conversation-selector', 'aria-label': 'Select conversation' }, state.leads.map(item => button(item.company, () => selectLead(item.id), `filter-button ${item.id === l.id ? 'active' : ''}`, { 'data-testid': `conversation-${item.id}` }))),
    el('section', { class: 'panel transcript-panel' }, el('div', { class: 'panel-title' }, el('div', {}, el('h2', { text: l.company }), el('p', { class: 'muted', text: `${l.contact} · ${l.role}` })), badge('Synthetic conversation', 'demo')), sources.length ? sources.map(s => el('article', { class: 'transcript-source' }, el('h3', { text: s.title }), el('p', { class: 'transcript-text', text: s.text }), citations([s.id]))) : el('p', { class: 'empty-state', text: 'No sample transcript is linked to this lead. Record a note below.' })),
    el('section', { class: 'panel' }, el('h2', { text: 'Keep the latest situation in view' }), el('p', { class: 'muted', text: 'A new reply can change the next action. Opt-outs suppress future drafts.' }), el('form', { class: 'note-form', onsubmit: event => { event.preventDefault(); if (note.value.trim()) act({ type: 'note', leadId: l.id, text: note.value.trim() }); } }, note, el('button', { class: 'button primary', type: 'submit', disabled: busy, 'data-testid': 'save-note' }, 'Save conversation note')), el('div', { class: 'saved-notes' }, l.notes?.map(n => el('article', { class: 'saved-note' }, el('span', { text: dateFmt(n.createdAt) }), el('p', { text: n.text }), citations(n.sourceId ? [n.sourceId] : [], true))))),
    activityPanel(l.id),
  );
}
function acquisitionView() {
  const max = Math.max(1, ...state.channels.map(c => c.assessed));
  const channelRows = state.channels.map(c => {
    const stats = [[c.assessed, 'Assessed'], [c.interested, 'Interested'], [c.handoffs, 'Handoffs'], [money(c.spend), 'Demo spend']];
    return el('article', { class: 'channel-row' },
      el('div', { class: 'channel-name' }, el('h3', { text: c.name }), el('div', { class: 'channel-bar' }, el('span', { style: `width:${Math.max(4, c.assessed / max * 100)}%` }))),
      stats.map(([value, label]) => el('div', { class: 'channel-stat' }, el('strong', { text: value }), el('span', { text: label }))),
    );
  });
  return el('div', {}, sectionTitle('Find the next good conversation.', 'Compare demo channels and propose an allocation for review.', button([icon('spark'), 'Propose allocation'], () => act({ type: 'propose_budget' }), 'button primary', { 'data-testid': 'propose-budget' })),
    el('div', { class: 'acquisition-banner' }, icon('signal'), el('div', {}, el('strong', { text: 'A planning view for customer acquisition' }), el('p', { text: 'All channel counts and spend below are synthetic. Proposals do not launch campaigns or spend money.' }))),
    el('section', { class: 'panel channel-panel' }, el('div', { class: 'panel-title' }, el('h2', { text: 'Channel overview' }), badge('Simulated', 'demo')), el('div', { class: 'channel-list' }, channelRows)),
    el('section', { class: 'allocation-section' }, el('div', { class: 'section-heading compact-heading' }, el('div', {}, el('h2', { text: 'Jarvis allocation proposals' }), el('p', { text: 'A suggested next move, with its reasoning attached.' }))), state.proposals.length ? state.proposals.slice().reverse().map(p => el('article', { class: 'proposal-card', 'data-testid': `proposal-${p.id}` }, el('div', { class: 'panel-title' }, el('h3', { text: p.title }), badge('Proposed only', 'lavender')), el('p', { text: p.text }), citations(p.evidenceIds), el('span', { class: 'muted small', text: dateFmt(p.createdAt) }))) : el('div', { class: 'empty-proposal' }, ring(), el('h3', { text: 'Start with a considered proposal.' }), el('p', { text: 'Jarvis can compare the sample channels and prepare a simulated allocation.' }), button('Propose allocation', () => act({ type: 'propose_budget' }), 'button primary'))),
    el('section', { class: 'orchestrator-note' }, el('h2', { text: 'Acquisition → qualified interest → founder' }), el('p', { text: 'Jarvis supports prospect review and local preparation. The founder owns sales conversations and closing.' })),
  );
}
function connectionsView() {
  const connected = [
    ['layers', 'Shared context', 'Business facts and customer evidence', 'Available locally'],
    ['pipeline', 'Lead workspace', 'Qualification, drafts and reviewed handoffs', 'Available locally'],
    ['source', 'Selected text files', 'Deliberate .txt, .md and .json import', 'Available locally'],
  ];
  const planned = [['CRM', 'Sync accounts and opportunities'], ['Email', 'Send approved outreach and follow-ups'], ['Calls', 'Capture and transcribe conversations'], ['Ad channels', 'Review campaigns and acquisition'], ['Accounting', 'Connect commercial context'], ['Operations', 'Coordinate the wider business']];
  return el('div', {}, sectionTitle('One workspace. More ways to reach it.', 'The local workflow works today. Add ElevenLabs for live conversation.'),
    el('div', { class: 'surface-grid' }, [['monitor', 'Desktop', 'Local app workspace', 'Desktop shell'], ['globe', 'Web', 'This shared local interface', 'Available locally'], ['phone', 'Phone', 'Responsive interface', 'Remote access not configured']].map(([glyph, title, desc, status]) => el('article', { class: 'surface-card' }, icon(glyph), el('h2', { text: title }), el('p', { text: desc }), badge(status, title === 'Web' ? 'green' : 'lavender')))),
    el('section', { class: 'panel' }, el('div', { class: 'panel-title' }, el('h2', { text: 'Tools in this workspace' }), badge('Local tools', 'green')), el('div', { class: 'tool-list' }, connected.map(([glyph, title, desc, status]) => el('div', { class: 'tool-row' }, icon(glyph), el('div', {}, el('h3', { text: title }), el('p', { text: desc })), badge(status, 'green'))))),
    el('section', { class: 'panel' }, el('div', { class: 'panel-title' }, el('h2', { text: 'Where Sales Jarvis goes next' }), badge('Planned connectors', 'lavender')), el('div', { class: 'connector-grid' }, planned.map(([title, desc]) => el('article', {}, el('span', { class: 'connector-symbol', text: title.slice(0, 1) }), el('h3', { text: title }), el('p', { text: desc }), badge('Planned', 'neutral')))), el('p', { class: 'source-footnote', text: 'No live CRM, email, calling, ad or accounting provider is connected. A connector requires its own account and execution permissions.' })),
    elevenLabsConnectionPanel(),
    el('section', { class: 'provider-panel' }, ring(), el('div', {}, el('h2', { text: 'Offline rules are always available' }), el('p', { text: 'Transparent local rules qualify prospects, prepare drafts and propose actions. Switch modes in Workspace whenever you want the offline workflow.' })), badge('Local fallback', 'lavender')),
  );
}
function elevenLabsConnectionPanel() {
  const keyInput = el('input', { id: 'elevenlabs-api-key', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'Enter your ElevenLabs API key', 'data-testid': 'elevenlabs-api-key', 'aria-describedby': 'elevenlabs-key-help' });
  const status = providerStatus.ready ? 'Ready for live sessions' : providerStatus.configured ? 'Key connected · setup needed' : 'Not connected';
  return el('section', { class: 'panel elevenlabs-connection', 'data-testid': 'elevenlabs-connection' },
    el('div', { class: 'panel-title' }, el('div', {}, el('h2', { text: 'Bring a voice to Jarvis.' }), el('p', { class: 'muted small', text: 'Live ElevenLabs conversation + the local SPIN tools' })), badge(status, providerStatus.ready ? 'green' : 'lavender')),
    el('div', { class: 'connection-account' }, icon('connect'), el('span', { text: `${providerStatus.configured ? 'Connected account' : 'Intended account'}: ${providerStatus.accountEmail || 'Not connected'}` }), providerStatus.ready && button('Open live conversation', () => { conversationMode = 'live'; showManager(); managerController?.navigate('workspace'); }, 'text-button', { 'data-testid': 'open-live-conversation' })),
    el('form', { class: 'key-form', onsubmit: event => { event.preventDefault(); saveElevenLabsConnection(keyInput); } },
      el('label', { for: 'elevenlabs-api-key', text: 'ElevenLabs API key' }),
      keyInput,
      el('p', { id: 'elevenlabs-key-help', class: 'key-help', text: 'Saved only in macOS Keychain. The field clears immediately; the key never enters workspace data.' }),
      el('div', { class: 'connection-buttons' }, el('button', { type: 'submit', class: 'button primary', disabled: providerBusy, 'data-testid': 'save-elevenlabs-key' }, providerBusy ? 'Connecting…' : 'Save key to Keychain'), button([icon('copy'), 'Use copied key'], () => saveElevenLabsConnection(keyInput, true), 'button secondary', { disabled: providerBusy, 'data-testid': 'use-copied-key' }))),
    el('div', { class: 'agent-setup-row' }, el('div', {}, el('h3', { text: 'A private SPIN demo agent' }), el('p', { text: 'Set up the bounded agent with the synthetic prospects and four local tools. Sessions stop after 90 seconds.' })), button([icon('spark'), 'Set up Jarvis'], setupElevenLabs, 'button secondary', { disabled: providerBusy || !providerStatus.configured || providerStatus.ready, 'data-testid': 'setup-elevenlabs' })),
    el('div', { class: 'connection-footer' }, el('p', { text: 'Private imports and real customer notes are excluded from the demo context. No live outreach or spending tools are enabled.' }), button('Check status', refreshProviderStatus, 'text-button', { 'data-testid': 'check-elevenlabs-status', disabled: providerBusy })),
    (liveError || providerStatus.error) && el('p', { class: 'live-error', text: liveError || providerStatus.error, role: 'alert', 'data-testid': 'connection-error' }),
  );
}
function activityPanel(leadId, compact = false) {
  const activities = state.activity.filter(a => !leadId || a.leadId === leadId).slice().reverse().slice(0, compact ? 4 : 8);
  return el('section', { class: compact ? 'inspector-activity' : 'panel' }, el('h2', { text: 'Activity' }), activities.length ? el('ol', { class: 'activity-list' }, activities.map(a => el('li', {}, el('span', { class: 'activity-dot' }), el('div', {}, el('p', { text: a.text }), el('span', { text: dateFmt(a.createdAt) }), a.sourceId && citations([a.sourceId], true))))) : el('p', { class: 'empty-state', text: 'Local actions will appear here.' }));
}
function inspector() {
  const l = lead();
  if (!l) return null;
  const draft = state.drafts.filter(d => d.leadId === l.id).slice(-1)[0];
  const restricted = l.permission === 'do_not_contact';
  const canHandoff = !restricted && l.fit >= state.context.handoff.minFit && (!state.context.handoff.requireInterest || l.interest === 'expressed');
  return el('aside', { class: 'inspector', 'aria-label': 'Selected lead inspection', 'data-testid': 'lead-inspector' },
    el('div', { class: 'inspector-label' }, el('span', { text: 'Selected conversation' }), badge('Demo', 'demo')),
    el('div', { class: 'inspector-company' }, el('span', { class: `company-avatar large avatar-${state.leads.indexOf(l) % 4}`, text: l.company.split(' ').map(v => v[0]).slice(0, 2).join('') }), el('h2', { text: l.company }), el('p', { text: l.segment }), leadStatus(l)),
    el('div', { class: 'contact-detail' }, el('span', { class: 'avatar', text: l.contact.split(' ').map(v => v[0]).slice(0, 2).join('') }), el('div', {}, el('strong', { text: l.contact }), el('p', { text: l.role }))),
    el('dl', { class: 'qualification-detail' }, el('div', {}, el('dt', { text: 'Business fit' }), el('dd', { class: 'fit-number', text: `${l.fit}%` })), el('div', {}, el('dt', { text: 'Buyer interest' }), el('dd', { text: l.interest === 'expressed' ? 'Expressed' : l.interest === 'withdrawn' ? 'Withdrawn' : 'Unconfirmed' })), el('div', {}, el('dt', { text: 'Contact permission' }), el('dd', { class: restricted ? 'text-red' : '', text: restricted ? 'Do not contact' : l.permission === 'allowed' ? 'Allowed' : 'Unknown' }))),
    el('section', { class: 'next-step-panel' }, el('h3', { text: 'Next considered step' }), el('p', { text: l.nextAction }), el('div', { class: 'inspector-actions' }, button('Review qualification', () => act({ type: 'qualify', leadId: l.id }), 'button secondary', { 'data-testid': 'qualify-lead' }), button([icon('source'), 'Prepare follow-up'], () => act({ type: 'draft', leadId: l.id }), 'button primary', { disabled: busy || restricted, 'data-testid': 'draft-lead' })), restricted && el('p', { class: 'restriction-note', text: 'Outreach is suppressed by the latest contact restriction.' })),
    el('section', { class: 'evidence-panel' }, el('h3', { text: 'Why this lead?' }), el('p', { text: 'Inspect the original evidence behind the next action.' }), citations(l.evidenceIds)),
    draft && el('section', { class: 'draft-preview', 'data-testid': 'draft-review' }, el('div', { class: 'panel-title' }, el('h3', { text: 'Follow-up draft' }), badge('Review', 'lavender')), el('p', { class: 'draft-subject', text: draft.subject }), el('p', { class: 'draft-body', text: draft.body }), citations(draft.evidenceIds, true), button([icon('copy'), 'Copy draft'], async () => { try { await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`); notify('Draft copied. Review it before any outreach.'); } catch { notify('Copy is unavailable. Select the draft text to copy it.', true); } }, 'text-button'), el('p', { class: 'draft-local-note', text: 'Local preparation only. No message has been sent.' })),
    el('section', { class: 'handoff-panel' }, el('h3', { text: 'A warm handoff to the founder' }), el('p', { text: `Demo criteria: fit ≥ ${state.context.handoff.minFit}%${state.context.handoff.requireInterest ? ' + expressed interest' : ''}. Contact restrictions apply.` }), button([l.stage === 'handoff' ? icon('check') : icon('arrow'), l.stage === 'handoff' ? 'Handoff recorded' : 'Record founder handoff'], () => act({ type: 'handoff', leadId: l.id }), 'button handoff-button', { disabled: busy || !canHandoff || l.stage === 'handoff', 'data-testid': 'handoff-lead' }), !canHandoff && el('p', { class: 'handoff-reason', text: restricted ? 'Contact permission prevents a handoff.' : 'This lead does not meet the current handoff criteria.' })),
    activityPanel(l.id, true),
  );
}
function voiceStatus() {
  return { ...providerStatus, status: liveSessionState, inputMode: liveInputMode, agentMode: liveAgentMode, conversationMode, label: conversationMode === 'offline' ? 'Guided offline assistant' : 'ElevenLabs', error: liveError || providerStatus.error, notice: liveNotice };
}
function managerSnapshot() {
  const proposed = managerPlan ? { id: 'session-manager-plan', title: 'Suggested sales plan · this session', status: 'proposed', text: [managerPlan.goal, managerPlan.explanation, ...managerPlan.steps.map(step => `${step.number}. ${step.description} (${step.status})`), managerPlan.missingQuestion ? `To clarify: ${managerPlan.missingQuestion}` : '', 'Proposed in this session; no plan step is completed or persisted by this proposal.'].filter(Boolean).join('\n'), evidenceIds: [...new Set(managerPlan.steps.flatMap(step => step.evidenceIds || []))] } : null;
  return { state: proposed ? { ...state, proposals: [...state.proposals, proposed] } : state, voice: voiceStatus(), toolReceipts };
}
async function managerAction(payload) {
  if (payload.type === 'chat') selectedId = payload.leadId || null;
  else if (payload.leadId) selectedId = payload.leadId;
  if (payload.type === 'chat' && conversationMode === 'live') return sendChat(payload.text);
  return act({ ...payload, ...(payload.type === 'chat' && selectedId ? { leadId: selectedId } : {}) }, { throwOnError: true });
}
function showManager() { presentation = 'manager'; render(); }
function renderManager() {
  document.body.classList.add('manager-presentation');
  document.querySelector('link[href="/styles.css"]').disabled = true;
  if (!managerController) {
    app.replaceChildren();
    managerController = mountManagerUI(app, {
      action: managerAction, getVoiceStatus: voiceStatus, renderConnections: connectionsView,
      startVoice: async () => { await setConversationMode('live'); await startLiveSession('voice'); },
      startText: async () => { await setConversationMode('live'); await startLiveSession('text'); },
      stopVoice: stopLiveSession, setConversationMode,
      onNavigate: (next, id) => {
        if (id) { selectedId = id; updateSelectedLiveContext(); }
      },
    });
  }
  app.setAttribute('aria-busy', String(busy));
  managerController.update(managerSnapshot());
}
function render() {
  if (!state) return;
  if (presentation === 'manager') { renderManager(); return; }
  managerController?.destroy(); managerController = null;
  document.body.classList.remove('manager-presentation');
  document.querySelector('link[href="/styles.css"]').disabled = false;
  const inputFocus = document.activeElement?.id === 'chat-input' ? { start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd } : null;
  const content = { today: todayView, pipeline: pipelineView, context: contextView, conversations: conversationsView, acquisition: acquisitionView, connections: connectionsView }[view]();
  app.setAttribute('aria-busy', String(busy));
  app.replaceChildren(el('div', { class: 'workspace-shell' }, rail(), el('div', { class: 'workspace-body' }, header(), el('div', { class: `workspace-columns view-${view}` }, el('main', { id: 'workspace', class: 'workspace-main', tabindex: '-1', 'data-testid': `view-${view}` }, content, el('footer', { class: 'workspace-footer' }, 'Sales Jarvis for SPIN', el('span', { text: `Synthetic demo · local preparation · ${conversationMode === 'live' ? 'ElevenLabs conversation' : 'guided offline assistant'}` }))), inspector())), el('nav', { class: 'mobile-bottom-nav', 'aria-label': 'Quick navigation' }, navButton('today', 'Today', 'spark', true), navButton('pipeline', 'Pipeline', 'pipeline', true), navButton('context', 'Context', 'layers', true), button([icon('menu'), el('span', { text: 'More' })], () => { menuOpen = !menuOpen; render(); }, `nav-button compact-nav ${menuOpen ? 'active' : ''}`, { 'aria-label': 'More navigation', 'aria-expanded': menuOpen })), menuOpen && el('button', { class: 'menu-backdrop', 'aria-label': 'Close navigation', onclick: () => { menuOpen = false; render(); } })));
  document.querySelector('.workspace-main')?.prepend(button([icon('arrow'), 'Back to Jarvis conversation'], showManager, 'button secondary', { 'data-testid': 'back-to-manager' }));
  if (inputFocus && view === 'today') { const input = document.querySelector('#chat-input'); input?.focus({ preventScroll: true }); input?.setSelectionRange(inputFocus.start, inputFocus.end); }
}
async function load() {
  try {
    const response = await fetch('/api/state');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The local workspace could not be opened.');
    state = result; selectedId = state.leads.find(l => l.interest === 'expressed' && l.permission !== 'do_not_contact')?.id || state.leads[0]?.id; render(); refreshProviderStatus();
  } catch (error) {
    app.setAttribute('aria-busy', 'false');
    app.replaceChildren(el('main', { class: 'startup startup-error' }, ring(), el('h1', { text: 'Your workspace needs attention.' }), el('p', { text: error.message }), button('Try again', load, 'button primary'), el('p', { class: 'muted small', text: 'Start the local Sales Jarvis server, then retry. Existing workspace data is preserved.' })));
  }
}
mobileQuery.addEventListener('change', () => { menuOpen = false; if (state) render(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuOpen && !sourceDialog.open) { menuOpen = false; render(); document.querySelector('.mobile-bottom-nav button:last-child')?.focus(); }
});
window.addEventListener('pagehide', () => {
  ++sessionGeneration; clearTimeout(liveTimer);
  if (liveSession) { liveSession.endSession().catch(() => {}); liveSession = null; }
  if (liveSessionId) {
    fetch('/api/elevenlabs/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: liveSessionId, type: 'session', text: 'ElevenLabs live session closed when the workspace was left.', evidenceIds: [] }), keepalive: true }).catch(() => {});
    liveSessionId = null;
  }
});
load();
