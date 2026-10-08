export function validateGroupName(name: string): string | null {
  if (!name.trim()) return 'Group name is required';
  if (name.trim().length < 2) return 'Group name must be at least 2 characters';
  if (name.trim().length > 50) return 'Group name must be under 50 characters';
  return null;
}

export function validateMemberName(name: string): string | null {
  if (!name.trim()) return 'Name is required';
  if (name.trim().length < 1) return 'Name must be at least 1 character';
  return null;
}

export function validateAmount(amount: string | number): string | null {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num <= 0) return 'Enter a valid amount';
  if (num > 10000000) return 'Amount is too large';
  return null;
}

export function validateMobile(mobile: string): string | null {
  if (!mobile) return null; // optional
  if (!/^\d{10}$/.test(mobile)) return 'Enter a valid 10-digit mobile number';
  return null;
}

export function validateInviteCode(code: string): string | null {
  if (!code.trim()) return 'Invite code is required';
  return null;
}

export function validateExpenseDescription(desc: string): string | null {
  if (!desc.trim()) return 'Description is required';
  return null;
}

export function validateSplitExact(amounts: number[], total: number): string | null {
  const sum = amounts.reduce((s, a) => s + a, 0);
  if (Math.abs(sum - total) > 0.01) return `Amounts must equal the expense total (₹${total})`;
  return null;
}

export function validateSplitPercentage(percentages: number[]): string | null {
  const sum = percentages.reduce((s, p) => s + p, 0);
  if (Math.abs(sum - 100) > 0.01) return 'Percentages must total 100%';
  return null;
}

export function validateQRFile(file: File): string | null {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowed.includes(file.type)) return 'Only PNG, JPG, JPEG, WebP files are allowed';
  if (file.size > 300 * 1024) return 'File size must be under 300KB';
  return null;
}
