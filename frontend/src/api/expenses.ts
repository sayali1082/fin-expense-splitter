import client from './client';
import type { SplitMethod, ExpenseCategory } from '../types';

export const expensesApi = {
  create: (groupId: string, data: {
    description: string;
    amount: number;
    paidBy: string;
    category: ExpenseCategory;
    date: string;
    splitMethod: SplitMethod;
    participants: Array<{
      userId: string;
      name: string;
      amount?: number;
      percentage?: number;
      shares?: number;
    }>;
  }) => client.post(`/groups/${groupId}/expenses`, data),

  getAll: (groupId: string) => client.get(`/groups/${groupId}/expenses`),

  update: (expenseId: string, data: {
    description?: string;
    amount?: number;
    paidBy?: string;
    category?: string;
    date?: string;
    splitMethod?: SplitMethod;
    participants?: Array<{
      userId: string;
      name: string;
      amount?: number;
      percentage?: number;
      shares?: number;
    }>;
  }) => client.put(`/expenses/${expenseId}`, data),

  delete: (expenseId: string) => client.delete(`/expenses/${expenseId}`),
};
