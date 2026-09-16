export type StatusTone = 'success' | 'warning' | 'danger' | 'info';

export function statusLabel(tone: StatusTone): string {
  return tone;
}
