// Local intent routing only. This adapter never makes a network request.
export const provider = Object.freeze({ mode: 'offline', label: 'Guided offline assistant', available: false });

export function routeIntent(text) {
  const value = text.toLowerCase();
  if (/\b(send|email them|call them|purchase|pay|launch campaign)\b/.test(value)) return 'external';
  if (/\b(budget|channels?|orchestrat|allocat|acquisition)\w*/.test(value)) return 'propose_budget';
  if (/\b(handoff|hand off|founder|crm)\b/.test(value)) return 'handoff';
  if (/\b(draft|follow[ -]?up|prepare|write)\b/.test(value)) return 'draft';
  if (/\b(qualif|prioriti|prospect|lead)\w*/.test(value)) return 'qualify';
  if (/\b(summar|context|explain|history|source|evidence|help)\w*/.test(value)) return 'summarize';
  return 'unsupported';
}
