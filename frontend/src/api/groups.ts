import client from './client';

export const groupsApi = {
  create: (data: {
    name: string;
    description: string;
    createdBy: string;
    creatorName: string;
    members: { name: string }[];
  }) => client.post('/groups', data),

  getUserGroups: (userId: string) => client.get(`/groups/user/${userId}`),

  get: (groupId: string) => client.get(`/groups/${groupId}`),

  getByInviteCode: (inviteCode: string) => client.get(`/groups/invite/${inviteCode}`),

  join: (data: { inviteCode: string; userId: string; userName: string }) =>
    client.post('/groups/join', data),

  addMember: (groupId: string, name: string) =>
    client.post(`/groups/${groupId}/members`, { name }),

  removeMember: (groupId: string, userId: string) =>
    client.delete(`/groups/${groupId}/members/${userId}`),

  getShare: (groupId: string) => client.get(`/groups/${groupId}/share`),
};
