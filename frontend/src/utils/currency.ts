export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: abs % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  return `₹${formatted}`;
}

export function formatSignedCurrency(amount: number): string {
  const prefix = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${prefix}${formatCurrency(Math.abs(amount))}`;
}

export function maskMobile(mobile: string): string {
  if (!mobile || mobile.length < 4) return mobile;
  return mobile.slice(0, 2) + '******' + mobile.slice(-2);
}
