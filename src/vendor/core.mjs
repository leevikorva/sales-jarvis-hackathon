import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { provider, routeIntent } from './provider.mjs';

const DEMO_TIME = '2026-10-03T12:00:00.000Z';
const MAX_TEXT = 50_000;
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
const unique = values => [...new Set(values.filter(Boolean))];
const now = () => new Date().toISOString();
const uid = prefix => `${prefix}-${randomUUID()}`;
export class ActionError extends Error {
  constructor(message, status = 400) { super(message); this.name = 'ActionError'; this.status = status; }
}
const requireText = (value, label, max = MAX_TEXT) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ActionError(`${label} must be non-empty text of at most ${max} characters.`);
  return value.trim();
};
const sourceIdValid = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value);

export function createInitialState() {
  const sources = [
    { id: 'source-brief', title: 'SPIN shared brief · synthetic demo', kind: 'brief', status: 'user-provided', observedAt: DEMO_TIME, text: 'Synthetic demonstration context. SPIN is described as a cognition-focused energy-drink company starting B2B sales. Founder goal: acquire suitable B2B prospects, qualify interest, and hand interested buyers to the founder for sales conversations. No approved ingredients, clinical substantiation, commercial prices, trial-pack sizes or delivery dates have been supplied. Demo handoff assumption: fit of at least 70 plus expressed interest. Nothing here authorizes external contact or spending.' },
    { id: 'source-warm', title: 'Northline Workspace · sample call and commitment', kind: 'sample', status: 'synthetic', observedAt: '2026-10-01T10:00:00.000Z', text: 'SYNTHETIC SAMPLE · Europe/Brussels · 1 October 2026, 12:00. Maya Chen, operations lead: “We would like to try SPIN with our workspace team before considering a larger order. Can you send the trial options?” Seller: “I will confirm the options and return to you by 2 October.” No later reply or fulfilled commitment is recorded. At the explicit demo clock, 3 October 2026 14:00 Europe/Brussels, this commitment is overdue. Product price and trial formats remain unknown.' },
    { id: 'source-clinical', title: 'Clearwell Clinic · sample unsupported requirement', kind: 'sample', status: 'synthetic', observedAt: '2026-10-02T08:00:00.000Z', text: 'SYNTHETIC SAMPLE · 2 October 2026. Dr Alex Morgan, procurement: “We need a drink clinically proven to treat ADHD and reduce patient symptoms. We are interested only if you can provide approved clinical evidence.” No such product substantiation was supplied. The clinical requirement is unsupported and must not become a sales claim.' },
    { id: 'source-optout', title: 'Atlas Office · sample explicit opt-out', kind: 'sample', status: 'synthetic', observedAt: '2026-10-02T12:00:00.000Z', text: 'SYNTHETIC SAMPLE · 2 October 2026. Jordan Reed, office manager: “Please do not contact me again. Remove us from outreach and do not send any more follow-ups.” This latest explicit opt-out takes precedence over older interest and fit.' },
    { id: 'source-price', title: 'Harbour Collective · sample price request', kind: 'sample', status: 'synthetic', observedAt: '2026-10-02T14:00:00.000Z', text: 'SYNTHETIC SAMPLE · 2 October 2026. Casey Taylor, community manager: “We are interested in a team trial. What is the unit price and what would a trial cost?” Approved unit price, pack sizes and offer terms are absent from the shared business context. Confirm them before quoting.' },
    { id: 'source-timing', title: 'Studio Common · sample changed customer timeline', kind: 'sample', status: 'synthetic', observedAt: '2026-10-03T09:00:00.000Z', text: 'SYNTHETIC SAMPLE · Europe/Brussels. 30 September: Sam Ellis asked about a 24-can trial this month. Latest reply, 3 October 2026, 11:00: “Our opening has moved to November. Please wait until November before following up. We now expect to need 60 cans instead of 24.” Current timing is November and the requested quantity is 60; the earlier October/24-can request is obsolete. No precise November follow-up date has been agreed.' },
    { id: 'source-complete', title: 'Foundry Teams · sample completed handoff', kind: 'sample', status: 'synthetic', observedAt: '2026-10-03T10:00:00.000Z', text: 'SYNTHETIC SAMPLE · 3 October 2026. Avery Quinn, team operations: “We would like to discuss a trial with your founder.” A safe local follow-up draft has already been prepared, and the opportunity has been handed to the founder inside this CRM. The local handoff task is complete. No email was sent and no external CRM was modified. Repeating the same completed action must not create another draft or handoff record.' },
  ];
  const specs = [
    ['warm', 'Northline Workspace', 'Maya Chen', 'Operations lead', 'Coworking', 91, 'expressed', 'new', 'allowed'],
    ['clinical', 'Clearwell Clinic', 'Dr Alex Morgan', 'Procurement lead', 'Healthcare', 24, 'expressed', 'new', 'unknown'],
    ['optout', 'Atlas Office', 'Jordan Reed', 'Office manager', 'Workplace', 84, 'withdrawn', 'suppressed', 'do_not_contact'],
    ['price', 'Harbour Collective', 'Casey Taylor', 'Community manager', 'Coworking', 87, 'expressed', 'new', 'allowed'],
    ['timing', 'Studio Common', 'Sam Ellis', 'Founder', 'Creative workspace', 82, 'expressed', 'new', 'allowed'],
    ['complete', 'Foundry Teams', 'Avery Quinn', 'Team operations', 'Workplace', 89, 'expressed', 'handoff', 'allowed'],
  ];
  const leads = specs.map(([key, company, contact, role, segment, fit, interest, stage, permission]) => ({ id: `lead-${key}`, company, contact, role, segment, fit, interest, stage, permission, evidenceIds: [`source-${key}`], nextAction: '', notes: [] }));
  const state = {
    schemaVersion: 1, revision: 0, updatedAt: DEMO_TIME,
    business: { id: 'spin', name: 'SPIN', owner: 'Founder', goal: 'Acquire suitable B2B prospects, qualify interest, and hand interested buyers to the founder.', description: 'Cognition-focused energy-drink company starting B2B sales. Product claims and commercial details await review.' },
    provider: { ...provider },
    context: { facts: [{ id: 'fact-business', label: 'Business', value: 'SPIN · energy-drink company starting B2B sales', status: 'user-provided', sourceId: 'source-brief' }, { id: 'fact-goal', label: 'First service', value: 'Find suitable B2B prospects, qualify interest, prepare outreach, and hand interested buyers to the founder.', status: 'user-provided', sourceId: 'source-brief' }], unknowns: ['Approved product ingredients', 'Clinical benefit substantiation', 'Approved unit price and trial cost', 'Available trial formats, quantities and delivery dates'], handoff: { minFit: 70, requireInterest: true } },
    sources, leads,
    drafts: [{ id: 'draft-complete', leadId: 'lead-complete', subject: 'Your SPIN trial conversation', body: 'Hi Avery,\n\nThanks for your interest in discussing a SPIN trial. I have recorded your request for the founder to review. Trial formats, pricing and availability still need confirmation.\n\nPrepared locally for review. No outreach has been sent.', createdAt: '2026-10-03T10:10:00.000Z', evidenceIds: ['source-brief', 'source-complete'], status: 'draft' }],
    activity: [{ id: 'activity-complete-draft', leadId: 'lead-complete', type: 'draft_created', text: 'Synthetic demo: follow-up prepared locally; no email sent.', createdAt: '2026-10-03T10:10:00.000Z', sourceId: 'source-complete' }, { id: 'activity-complete-handoff', leadId: 'lead-complete', type: 'handoff', text: 'Synthetic demo: local founder handoff completed; no external CRM changed.', createdAt: '2026-10-03T10:15:00.000Z', sourceId: 'source-complete' }],
    messages: [{ id: 'message-welcome', role: 'assistant', text: 'I am the guided offline assistant. These six prospects and their conversations are synthetic. Ask me to prioritize leads, inspect evidence, prepare a safe follow-up, record a note, or propose a simulated budget. Drafts stay local for review.', evidenceIds: ['source-brief'], createdAt: DEMO_TIME }],
    channels: [], proposals: [],
  };
  refresh(state);
  return state;
}

export function resolveEvidence(state, ids) {
  const sourceMap = new Map(state.sources.map(source => [source.id, source]));
  return unique(ids).map(id => { const source = sourceMap.get(id); if (!source) throw new ActionError(`Evidence source does not exist: ${id}`); return clone(source); });
}
function currentSource(state, lead) {
  const ids = unique([...lead.evidenceIds, ...lead.notes.map(note => note.sourceId)]);
  return ids.map(id => state.sources.find(source => source.id === id)).filter(Boolean).reverse().sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
}
function reviewedPrices(state) {
  return state.context.facts.filter(fact => ['approved', 'confirmed'].includes(fact.status) && /\b(price|cost)\b/i.test(fact.label));
}
const optOut = text => /\b(do not contact|don['’]?t contact|stop (?:contacting|emailing|messaging)|remove (?:me|us)|unsubscribe|no more (?:emails|follow[ -]?ups)|opt[ -]?out)\b/i.test(text);
const clinical = text => /\b(clinically (?:proven|validated)|treat(?:s|ing)? ADHD|reduce patient symptoms|medical benefit|cure|clinical evidence)\b/i.test(text);
const timing = text => /\b(wait until|moved to|postponed|follow up in|follow-up in|not before|hold (?:off|until)|pause (?:until|outreach))\b/i.test(text);
const uncertainNote = text => /\b(hypothes(?:is|es)|I think|we think|may|might|perhaps|probably|possibly|assum(?:e|ing|ption)|suspect|guess|could|seems|uncertain|unconfirmed)\b/i.test(text);
const negativeInterest = text => /\b(not interested|no longer interested|not (?:looking|ready) (?:for|to)|don['’]?t want (?:a |the )?(?:trial|order|to discuss)|do not want (?:a |the )?(?:trial|order|to discuss))\b/i.test(text);
function unsupported(state, lead) {
  return lead.evidenceIds.concat(lead.notes.map(n => n.sourceId)).some(id => clinical(state.sources.find(s => s.id === id)?.text || ''));
}
function qualifies(state, lead) {
  return lead.permission !== 'do_not_contact' && lead.interest !== 'withdrawn' && lead.fit >= state.context.handoff.minFit && (!state.context.handoff.requireInterest || lead.interest === 'expressed');
}
function nextAction(state, lead) {
  if (lead.permission === 'do_not_contact') return 'Suppressed: explicit opt-out. No outreach or draft is permitted.';
  if (lead.interest === 'withdrawn') return 'Buyer has withdrawn interest. Respect the latest reply; do not qualify or hand off for a sales conversation.';
  if (lead.stage === 'handoff') return 'Founder handoff complete in this local CRM. Founder owns the sales conversation.';
  if (unsupported(state, lead)) return 'Unsupported clinical requirement. Request approved evidence or explain the mismatch; do not pitch clinical benefits.';
  const source = currentSource(state, lead);
  if (source && timing(source.text)) return `Respect the latest customer timing and quantity: ${source.id === 'source-timing' ? 'wait until November; 60 cans requested; exact date unconfirmed.' : source.text}`;
  if (lead.id === 'lead-warm' && lead.notes.length === 0) return 'Overdue demo commitment: confirm trial options and approved price, then review a follow-up. Due 2 October; demo clock 3 October 2026.';
  if (source && /\b(price|cost|quote)\b/i.test(source.text)) return reviewedPrices(state).length ? 'Review the source-linked approved pricing; trial formats, offer terms and availability still need confirmation.' : 'Confirm approved pricing and offer terms before quoting. A safe acknowledgement can be drafted for review.';
  if (lead.interest !== 'expressed') return 'Research fit and establish interest. A fit score alone does not establish buyer intent.';
  return lead.stage === 'drafted' ? 'Review the saved local draft. Nothing has been sent.' : 'Review the latest evidence and qualify for a founder conversation.';
}
function refresh(state) {
  const unknownPrice = 'Approved unit price and trial cost';
  state.context.unknowns = state.context.unknowns.filter(value => value !== unknownPrice);
  if (!reviewedPrices(state).length) state.context.unknowns.splice(2, 0, unknownPrice);
  for (const lead of state.leads) {
    // Contact restrictions always win, including over completed draft actions.
    if (lead.permission === 'do_not_contact') { lead.stage = 'suppressed'; lead.interest = 'withdrawn'; }
    lead.nextAction = nextAction(state, lead);
  }
  const groups = [['direct', 'Direct B2B', ['lead-warm', 'lead-optout']], ['partner', 'Partner outreach', ['lead-clinical', 'lead-timing']], ['inbound', 'Inbound requests', ['lead-price', 'lead-complete']]];
  state.channels = groups.map(([id, name, ids]) => { const leads = state.leads.filter(l => ids.includes(l.id)); return { id, name, assessed: leads.length, interested: leads.filter(l => l.interest === 'expressed' && l.permission !== 'do_not_contact').length, handoffs: leads.filter(l => l.stage === 'handoff').length, spend: 0, currency: 'EUR', simulated: true }; });
}
function getLead(state, id) {
  const lead = state.leads.find(lead => lead.id === id);
  if (!lead) throw new ActionError('Select a valid synthetic lead.', 404);
  return lead;
}
const evidenceFor = (state, lead) => unique(['source-brief', ...state.context.facts.map(fact => fact.sourceId), ...lead.evidenceIds, ...lead.notes.map(note => note.sourceId)]);
function record(state, lead, type, text, sourceId) {
  state.activity.push({ id: uid('activity'), leadId: lead?.id || null, type, text, createdAt: now(), sourceId: sourceId || 'source-brief' });
}
function draftBody(state, lead) {
  const source = currentSource(state, lead);
  const prices = reviewedPrices(state);
  const pending = prices.length ? 'trial formats and availability' : 'trial formats, approved pricing and availability';
  let request = `Thanks for your interest in SPIN. I am confirming the ${pending} before sharing an offer.`;
  if (lead.id === 'lead-warm') request = `Thanks for asking about a team trial. I owe you an update on the trial options. I am confirming the ${pending} before sharing a proposal.`;
  if (source && timing(source.text)) request = `Thanks for the update. I have recorded your latest timing and quantity request: ${source.id === 'source-timing' ? 'follow-up in November and 60 cans instead of 24' : source.text}. I will respect that timing. The ${pending} still need confirmation.`;
  if (source?.kind === 'imported' && !timing(source.text)) request = `Thanks for your latest update. I have recorded it for review. I am confirming the ${pending} before sharing an offer.`;
  if (prices.length) request += `\n\nReviewed commercial details: ${prices.map(fact => `${fact.label}: ${fact.value}`).join('; ')}.`;
  return `Hi ${lead.contact.split(' ')[0]},\n\n${request}\n\nPrepared locally for review. No outreach has been sent.`;
}
function execute(state, action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) throw new ActionError('Action must be a JSON object.');
  const type = action.type;
  if (type === 'live_event') {
    if (!['user', 'assistant', 'tool', 'session'].includes(action.eventType)) throw new ActionError('Invalid live event type.');
    const text = requireText(action.text, 'Live event', 8000);
    const lead = action.leadId ? getLead(state, action.leadId) : null;
    const evidenceIds = action.evidenceIds || [];
    if (!Array.isArray(evidenceIds) || evidenceIds.length > 20) throw new ActionError('Invalid live event evidence.');
    resolveEvidence(state, evidenceIds);
    if (['user', 'assistant'].includes(action.eventType)) state.messages.push({ id: uid('message'), role: action.eventType, text: `Live ElevenLabs · ${text}`, evidenceIds, createdAt: now() });
    else record(state, lead, `elevenlabs_${action.eventType}`, `Live ElevenLabs · ${text}`, evidenceIds[0] || 'source-brief');
    return { message: 'Live ElevenLabs demo event saved locally.', evidenceIds };
  }
  if (type === 'qualify') {
    const selected = action.leadId ? [getLead(state, action.leadId)] : state.leads;
    for (const lead of selected) {
      if (lead.permission === 'do_not_contact') continue;
      if (!['drafted', 'handoff'].includes(lead.stage)) {
        const stage = qualifies(state, lead) ? 'qualified' : 'new';
        if (lead.stage !== stage) { lead.stage = stage; record(state, lead, 'qualified', `Local qualification: fit ${lead.fit}/${state.context.handoff.minFit}; interest ${lead.interest}. Demo criteria are configurable.`, currentSource(state, lead)?.id); }
      }
    }
    refresh(state);
    const ordered = [...selected].sort((a, b) => priority(state, b) - priority(state, a));
    return { message: `Transparent demo qualification: fit ≥ ${state.context.handoff.minFit}${state.context.handoff.requireInterest ? ' plus expressed interest' : ''}. ${ordered.map(l => `${l.company}: ${l.stage}; ${l.nextAction}`).join('\n')}`, evidenceIds: unique(ordered.flatMap(l => evidenceFor(state, l))) };
  }
  if (type === 'draft') {
    const lead = getLead(state, action.leadId);
    if (lead.permission === 'do_not_contact') throw new ActionError('Outreach suppressed: this customer explicitly opted out. No draft is permitted.', 409);
    if (lead.interest === 'withdrawn') throw new ActionError('Cannot prepare a sales follow-up: the buyer has withdrawn interest. Review their latest reply.', 409);
    if (unsupported(state, lead)) throw new ActionError('Cannot draft a clinical pitch: the customer requires unsupported clinical evidence. No approved clinical substantiation exists.', 409);
    const evidenceIds = evidenceFor(state, lead);
    let draft = state.drafts.find(draft => draft.leadId === lead.id);
    if (lead.stage === 'handoff' && draft) return { message: 'This local draft and founder handoff are already complete. The existing draft is retained; no duplicate action was created.', evidenceIds: draft.evidenceIds };
    const body = draftBody(state, lead);
    if (!draft) { draft = { id: uid('draft'), leadId: lead.id, subject: 'Your SPIN trial request', body, createdAt: now(), evidenceIds, status: 'draft' }; state.drafts.push(draft); record(state, lead, 'draft_created', 'Safe follow-up prepared locally for review. Pricing, formats and availability require confirmation; no email sent.', currentSource(state, lead)?.id); }
    else if (draft.body !== body || JSON.stringify(draft.evidenceIds) !== JSON.stringify(evidenceIds)) { draft.body = body; draft.evidenceIds = evidenceIds; record(state, lead, 'draft_updated', 'Saved local draft updated against the latest evidence; no email sent.', currentSource(state, lead)?.id); }
    lead.stage = 'drafted';
    return { message: `Safe draft saved locally for review. ${reviewedPrices(state).length ? 'Reviewed commercial facts are quoted with their original evidence. ' : 'Approved pricing remains unconfirmed. '}Ingredients, trial formats and clinical claims still require review. Nothing has been sent.`, evidenceIds };
  }
  if (type === 'handoff') {
    const lead = getLead(state, action.leadId);
    if (lead.permission === 'do_not_contact') throw new ActionError('Cannot hand off: customer explicitly opted out.', 409);
    if (!qualifies(state, lead)) throw new ActionError(`Handoff requires fit ≥ ${state.context.handoff.minFit}${state.context.handoff.requireInterest ? ' and expressed interest' : ''}. Current fit ${lead.fit}; interest ${lead.interest}.`, 409);
    if (unsupported(state, lead)) throw new ActionError('Handoff blocked by the unsupported clinical requirement. Review evidence before proceeding.', 409);
    if (lead.stage === 'handoff' || state.activity.some(item => item.leadId === lead.id && item.type === 'handoff')) return { message: 'Founder handoff already completed in the local CRM. No duplicate activity was created.', evidenceIds: evidenceFor(state, lead) };
    lead.stage = 'handoff'; record(state, lead, 'handoff', 'Interested buyer handed to the founder in the local CRM. This is a reviewed internal task update; no outreach or external CRM change.', currentSource(state, lead)?.id);
    return { message: 'Founder handoff saved in the local CRM. Nothing was sent or changed in an external system.', evidenceIds: evidenceFor(state, lead) };
  }
  if (type === 'note') {
    const lead = getLead(state, action.leadId);
    const text = requireText(action.text, 'Note');
    const sourceId = action.sourceId ?? `source-note-${hash(`${lead.id}\n${text}`)}`;
    if (!sourceIdValid(sourceId)) throw new ActionError('sourceId must be a stable plain identifier, not a path.');
    const existing = state.sources.find(source => source.id === sourceId);
    if (existing && existing.text !== text) throw new ActionError('This source ID already belongs to different original text. Use a new source ID for a new reply.', 409);
    if (lead.notes.some(note => note.sourceId === sourceId)) return { message: 'This source and note are already recorded. No duplicate activity was created.', evidenceIds: [sourceId] };
    if (!existing) state.sources.push({ id: sourceId, title: `${lead.company} · user-provided note`, text, status: 'user-provided', kind: 'imported', observedAt: now() });
    lead.notes.push({ id: uid('note'), text, createdAt: now(), sourceId });
    lead.evidenceIds = unique([...lead.evidenceIds, sourceId]);
    if (optOut(text)) { lead.permission = 'do_not_contact'; lead.interest = 'withdrawn'; lead.stage = 'suppressed'; }
    else if (!uncertainNote(text) && negativeInterest(text)) { lead.interest = 'withdrawn'; if (['qualified', 'drafted'].includes(lead.stage)) lead.stage = 'new'; }
    else if (lead.permission !== 'do_not_contact'
      && !uncertainNote(text) && !negativeInterest(text)
      && /\b(interested|would like|want a trial|want to discuss|please send)\b/i.test(text)) lead.interest = 'expressed';
    record(state, lead, 'note', 'User-provided reply/note recorded; current advice recalculated from the latest source.', sourceId);
    return { message: optOut(text) ? 'Opt-out recorded. All outreach and drafts are suppressed.' : 'Note saved as user-provided evidence. Latest timing and restrictions now guide the next action.', evidenceIds: [sourceId] };
  }
  if (type === 'import') {
    if (!Array.isArray(action.files) || action.files.length < 1 || action.files.length > 8) throw new ActionError('Select 1–8 text files. Files are supplied as names and text; filesystem paths are never read.');
    const imported = [];
    for (const file of action.files) {
      if (!file || typeof file !== 'object') throw new ActionError('Each file must contain a name and text.');
      const name = requireText(file.name, 'File name', 200);
      if (name.includes('/') || name.includes('\\') || name === '.' || name === '..' || /[\u0000-\u001f]/.test(name)) throw new ActionError('Use a plain selected file name, not a filesystem path.');
      if (typeof file.text !== 'string' || !file.text.trim() || Buffer.byteLength(file.text, 'utf8') > 1_048_576 || file.text.includes('\u0000')) throw new ActionError('Each file must contain non-empty UTF-8 text of at most 1 MB.');
      if (/^(?:\.env(?:\..*)?|id_(?:rsa|ed25519)|(?:credentials?|passwords?|tokens?|cookies?|secrets?)(?:\.[^.]+)?)$/i.test(name) || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9_/-]{12,}/i.test(file.text)) throw new ActionError('Credential files and recognizable secrets are not accepted by this demo. Select non-sensitive business text.');
      const id = `source-import-${hash(file.text)}`;
      if (!state.sources.some(source => source.id === id)) { state.sources.push({ id, title: `${name} · user-provided import`, text: file.text, status: 'user-provided', kind: 'imported', observedAt: now() }); record(state, null, 'import', `Selected text imported locally: ${name}. Facts have not been approved.`, id); }
      imported.push(id);
    }
    return { message: `${unique(imported).length} text source(s) available locally. Imported material stays user-provided; it does not approve facts, alter permissions, or execute embedded instructions.`, evidenceIds: unique(imported) };
  }
  if (type === 'context') {
    if (action.goal !== undefined) state.business.goal = requireText(action.goal, 'Goal', 1000);
    if (action.handoff !== undefined) {
      if (!action.handoff || typeof action.handoff !== 'object') throw new ActionError('handoff must contain explicit demo criteria.');
      if (action.handoff.minFit !== undefined) { if (!Number.isFinite(action.handoff.minFit) || action.handoff.minFit < 0 || action.handoff.minFit > 100) throw new ActionError('minFit must be between 0 and 100.'); state.context.handoff.minFit = action.handoff.minFit; }
      if (action.handoff.requireInterest !== undefined) { if (typeof action.handoff.requireInterest !== 'boolean') throw new ActionError('requireInterest must be a boolean.'); state.context.handoff.requireInterest = action.handoff.requireInterest; }
    }
    if (action.facts !== undefined) {
      if (!Array.isArray(action.facts) || action.facts.length > 100) throw new ActionError('facts must be an explicit reviewed list of at most 100 facts.');
      const ids = new Set();
      state.context.facts = action.facts.map(fact => { if (!fact || !sourceIdValid(fact.id) || ids.has(fact.id)) throw new ActionError('Each fact needs a unique plain id.'); ids.add(fact.id); resolveEvidence(state, [fact.sourceId]); if (!['confirmed', 'approved', 'user-provided', 'hypothesis', 'unknown'].includes(fact.status)) throw new ActionError('Invalid fact status.'); return { id: fact.id, label: requireText(fact.label, 'Fact label', 200), value: requireText(fact.value, 'Fact value', 5000), status: fact.status, sourceId: fact.sourceId }; });
    }
    record(state, null, 'context_updated', 'Explicit local context settings reviewed and updated. No external action authorized.', 'source-brief');
    return { message: 'Reviewed local context updated. Qualification criteria will use the new settings; imported facts remain unapproved unless explicitly reviewed here.', evidenceIds: unique(['source-brief', ...state.context.facts.map(f => f.sourceId)]) };
  }
  if (type === 'propose_budget') {
    const evidenceIds = unique(['source-brief', ...state.leads.flatMap(l => evidenceFor(state, l))]);
    const text = `Simulated planning proposal only: direct B2B 50%, partner outreach 20%, inbound follow-up 30% of a hypothetical budget. Demo cohort: ${state.leads.length} assessed prospects, ${state.leads.filter(l => l.interest === 'expressed' && l.permission !== 'do_not_contact').length} expressed interest, ${state.leads.filter(l => l.stage === 'handoff').length} local handoffs. Prioritize existing inbound requests and overdue commitments, exclude opted-out contacts, and respect the latest customer timing. No actual budget, acquisition costs or conversion outcomes are known; this allocation is a transparent demo assumption, not an optimal-spend claim. No money will be spent.`;
    if (!state.proposals.some(p => p.text === text)) state.proposals.push({ id: uid('proposal'), title: 'Simulated acquisition allocation', text, createdAt: now(), status: 'proposed', evidenceIds });
    return { message: text, evidenceIds };
  }
  if (type === 'chat') {
    const text = requireText(action.text, 'Message', 8000);
    const intent = routeIntent(text);
    let lead = action.leadId ? getLead(state, action.leadId) : state.leads.find(l => text.toLowerCase().includes(l.company.toLowerCase()));
    if (!lead && ['draft', 'handoff'].includes(intent)) lead = state.leads.filter(l => l.permission !== 'do_not_contact' && l.stage !== 'handoff').sort((a, b) => priority(state, b) - priority(state, a))[0];
    let result;
    if (intent === 'summarize') { const evidenceIds = lead ? evidenceFor(state, lead) : ['source-brief']; result = { message: lead ? `${lead.company}: fit ${lead.fit}; interest ${lead.interest}; permission ${lead.permission}. Latest next action: ${nextAction(state, lead)}. ${lead.notes.length} recorded notes. Sources preserve original sample or user-provided text.` : `${state.business.name}: ${state.business.goal}\nUnknowns: ${state.context.unknowns.join('; ')}. All six lead conversations and channel metrics are synthetic. Imported files stay user-provided until review.`, evidenceIds }; }
    else if (intent === 'external') result = { message: 'This local demo prepares drafts and internal CRM updates. Sending, calling, payments and campaign launches require planned connectors and separate approval. No external action was performed.', evidenceIds: ['source-brief'] };
    else if (intent === 'unsupported') result = { message: 'Supported offline requests: prioritize or qualify prospects, summarize context and evidence, prepare a follow-up draft, hand off a qualified buyer, and propose a simulated channel budget. I use transparent rules rather than a live language model.', evidenceIds: ['source-brief'] };
    else { try { result = execute(state, { type: intent, ...(lead ? { leadId: lead.id } : {}) }); } catch (error) { if (!(error instanceof ActionError)) throw error; result = { message: error.message, evidenceIds: lead ? evidenceFor(state, lead) : ['source-brief'] }; } }
    state.messages.push({ id: uid('message'), role: 'user', text, evidenceIds: [], createdAt: now() });
    const message = `Guided offline assistant · ${intent === 'summarize' ? 'context retrieval' : intent.replaceAll('_', ' ')}\n${result.message}`;
    state.messages.push({ id: uid('message'), role: 'assistant', text: message, evidenceIds: result.evidenceIds, createdAt: now() });
    return { message, evidenceIds: result.evidenceIds };
  }
  throw new ActionError(`Unsupported action: ${String(type)}.`);
}
function priority(state, lead) {
  if (lead.permission === 'do_not_contact' || lead.stage === 'handoff' || unsupported(state, lead)) return -100;
  if (timing(currentSource(state, lead)?.text || '')) return 10;
  if (lead.id === 'lead-warm' && !lead.notes.length) return 100;
  return (lead.interest === 'expressed' ? 50 : 0) + lead.fit / 10;
}
function validateState(state) {
  if (state?.schemaVersion !== 1 || !Number.isInteger(state.revision) || !state.context?.handoff || !state.business || !state.provider) throw new Error('Unsupported or invalid saved state schema.');
  for (const key of ['sources', 'leads', 'drafts', 'activity', 'messages', 'channels', 'proposals']) if (!Array.isArray(state[key])) throw new Error(`Invalid saved state: ${key}.`);
  if (new Set(state.sources.map(s => s.id)).size !== state.sources.length || new Set(state.leads.map(l => l.id)).size !== state.leads.length) throw new Error('Saved state contains duplicate IDs.');
  for (const source of state.sources) if (!sourceIdValid(source.id) || typeof source.text !== 'string' || typeof source.observedAt !== 'string') throw new Error('Invalid saved source.');
  for (const lead of state.leads) { if (!Array.isArray(lead.evidenceIds) || !Array.isArray(lead.notes)) throw new Error('Invalid saved lead.'); resolveEvidence(state, [...lead.evidenceIds, ...lead.notes.map(n => n.sourceId)]); }
  for (const item of [...state.drafts, ...state.messages, ...state.proposals]) resolveEvidence(state, item.evidenceIds);
  resolveEvidence(state, [...state.activity.map(a => a.sourceId), ...state.context.facts.map(f => f.sourceId)]);
}
export async function createEngine({ dataDir = process.env.SALES_JARVIS_DATA_DIR || join(homedir(), '.local', 'share', 'sales-jarvis') } = {}) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const stateFile = join(dataDir, 'state.json');
  let state;
  try { state = JSON.parse(await readFile(stateFile, 'utf8')); validateState(state); refresh(state); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error(`Cannot load Sales Jarvis state at ${stateFile}; original file preserved. ${error.message}`, { cause: error }); state = createInitialState(); await save(state); }
  async function save(candidate) {
    const temp = join(dataDir, `.state-${randomUUID()}.tmp`);
    try { await writeFile(temp, `${JSON.stringify(candidate, null, 2)}\n`, { mode: 0o600, flag: 'wx' }); await rename(temp, stateFile); }
    catch (error) { await unlink(temp).catch(() => {}); throw new Error(`Cannot save local Sales Jarvis state: ${error.message}`, { cause: error }); }
  }
  let queue = Promise.resolve();
  return {
    getState: () => clone(state),
    resolveEvidence: ids => resolveEvidence(state, ids),
    stateFile,
    action(action) {
      const work = queue.then(async () => {
        const candidate = clone(state);
        const result = execute(candidate, action); refresh(candidate); resolveEvidence(candidate, result.evidenceIds); validateState(candidate);
        if (JSON.stringify(candidate) !== JSON.stringify(state)) { candidate.revision = state.revision + 1; candidate.updatedAt = now(); await save(candidate); state = candidate; }
        return { state: clone(state), message: result.message, evidenceIds: result.evidenceIds };
      });
      queue = work.catch(() => {}); return work;
    },
  };
}
