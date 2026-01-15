export function createId(): string {
  // crypto.randomUUID is available in modern Chrome + service workers.
  // Keep a fallback for environments/tests.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
