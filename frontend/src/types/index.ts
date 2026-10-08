export interface User {
  id: string;
  name: string;
  mobile?: string;
  acceptsCash?: boolean;
  qrImage?: string;
}

export interface GroupMember {
  id: string;
  userId: string;
  name: string;
  joinedAt?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  inviteCode?: string;
  invite_code?: string;
  createdBy?: string;
  created_by?: string;
  members: GroupMember[];
  expenses?: Expense[];
  createdAt?: string;
  created_at?: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  memberCount: number;
  expenseCount: number;
  totalSpent: number;
  balance: number;
  lastActivity: string;
}

export interface ExpenseParticipant {
  userId: string;
  name: string;
  shareAmount: number;
  shareValue: number;
  amount?: number;
  percentage?: number;
  shares?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  paidByName: string;
  category: string;
  date: string;
  splitMethod: 'equal' | 'exact' | 'percentage' | 'shares';
  participants: ExpenseParticipant[];
  createdAt: string;
}

export interface Balance {
  userId: string;
  name: string;
  amount: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  status: 'pending' | 'paid';
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentDetails {
  userId: string;
  name: string;
  mobile: string;
  acceptsCash: boolean;
  qrImage: string;
}

export interface PaymentHistoryItem {
  id: string;
  groupId: string;
  settlementId: string;
  fromUserName: string;
  toUserName: string;
  amount: number;
  paidAt: string;
}

export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares';

export type ExpenseCategory = 
  | 'Food' | 'Travel' | 'Hotel' | 'Transport' 
  | 'Shopping' | 'Groceries' | 'Entertainment' | 'Bills' | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Food', 'Travel', 'Hotel', 'Transport', 
  'Shopping', 'Groceries', 'Entertainment', 'Bills', 'Other'
];

export const SPLIT_METHODS: { value: SplitMethod; label: string }[] = [
  { value: 'equal', label: 'Equal' },
  { value: 'exact', label: 'Exact Amount' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'shares', label: 'Shares' },
];
