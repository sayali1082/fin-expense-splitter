import client from './client';

export const usersApi = {
  create: (name: string) => client.post('/users', { name }),
  get: (userId: string) => client.get(`/users/${userId}`),
  getPaymentDetails: (userId: string) => client.get(`/users/${userId}/payment-details`),
  updatePaymentDetails: (userId: string, data: { mobile: string; acceptsCash: boolean }) =>
    client.put(`/users/${userId}/payment-details`, data),
  uploadQR: (userId: string, file: File) => {
    const formData = new FormData();
    formData.append('qr', file);
    return client.post(`/users/${userId}/payment-qr`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteQR: (userId: string) => client.delete(`/users/${userId}/payment-qr`),
};
