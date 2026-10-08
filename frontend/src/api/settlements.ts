import client from './client';

export const settlementsApi = {
  getAll: (groupId: string) => client.get(`/groups/${groupId}/settlements`),
  markPaid: (settlementId: string) => client.post(`/settlements/${settlementId}/pay`),
  markUnpaid: (settlementId: string) => client.post(`/settlements/${settlementId}/unpay`),
  sendReminder: (settlementId: string) => client.post(`/settlements/${settlementId}/reminder`),
  getPaymentHistory: (groupId: string) => client.get(`/groups/${groupId}/payment-history`),
};
