// Centralized Vietnamese-facing formatting helpers.

/** 560000 -> "560k", 1200000 -> "1,2tr" — compact VND for tight widgets. */
export function formatVndCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  if (Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000;
    const rounded = Math.round(millions * 10) / 10;
    return `${String(rounded).replace('.', ',')}tr`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${Math.round(amount / 1_000)}k`;
  }
  return `${Math.round(amount)}đ`;
}

/** Full VND with grouping: 560000 -> "560.000đ". */
export function formatVnd(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))}đ`;
}

/** Local YYYY-MM-DD for "today" comparisons against plan dates. */
export function todayLocalIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Days until an ISO date, floored at 0; null when the date is missing/invalid. */
export function daysUntil(dateIso?: string): number | null {
  if (!dateIso) return null;
  const calendarDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  const target = calendarDate
    ? new Date(Number(calendarDate[1]), Number(calendarDate[2]) - 1, Number(calendarDate[3])).getTime()
    : new Date(dateIso).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}
