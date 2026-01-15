export function formatSessionTitle(prefix: string, createdAt: number): string {
  const d = new Date(createdAt);
  const date = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${prefix} — ${date} ${time}`;
}

export function formatDateTime(createdAt: number): string {
  return new Date(createdAt).toLocaleString();
}
