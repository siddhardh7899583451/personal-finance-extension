/** Simple unique ID generator (no external dependency required at runtime if uuid not needed) */

export function generateId(prefix = ''): string {
  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return prefix ? `${prefix}-${uuid}` : uuid;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIsoDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
