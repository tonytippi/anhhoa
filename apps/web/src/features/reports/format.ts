export const monthPattern = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;

export function currentMonth(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; }
export function formatMonth(month: string): string { const [year, value] = month.split('-'); return `${value}/${year}`; }
export function formatVnd(amount: number): string { return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`; }
