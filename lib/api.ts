// Centralized API Client for Fin
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fin-expense-splitter.onrender.com/api'

export interface ApiUser {
  id: string
  name: string
  mobile?: string
  acceptsCash?: boolean
  qrImage?: string
  createdAt?: string
}

export interface ApiMember {
  id: string
  userId?: string
  name: string
  joinedAt?: string
}

export interface ApiGroup {
  id: string
  name: string
  description?: string
  inviteCode?: string
  invite_code?: string
  code?: string
  createdBy?: string
  created_by?: string
  members?: ApiMember[]
  memberCount?: number
  expenseCount?: number
  totalSpent?: number
  balance?: number
  createdAt?: string
  created_at?: string
  lastActivity?: string
}

export interface ApiParticipant {
  userId: string
  name?: string
  shareAmount?: number
  shareValue?: number
  amount?: number
  percentage?: number
  shares?: number
}

export interface ApiExpense {
  id: string
  groupId: string
  title?: string
  description?: string
  amount: number
  paidBy: string
  paidByName?: string
  category?: string
  date?: string
  splitMethod?: 'equal' | 'exact' | 'percentage' | 'shares'
  participants?: ApiParticipant[]
  createdAt?: string
}

export interface ApiBalance {
  userId: string
  name: string
  amount: number
}

export interface ApiSettlement {
  id: string
  groupId: string
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
  status: 'pending' | 'paid'
  paidAt?: string | null
  createdAt?: string
}

export interface ApiPaymentHistory {
  id: string
  groupId: string
  settlementId: string
  fromUserName: string
  toUserName: string
  amount: number
  paidAt: string
}

export interface ApiShareInfo {
  groupName: string
  inviteCode: string
  shareUrl: string
}

export interface ApiPaymentDetails {
  userId: string
  name: string
  mobile: string
  acceptsCash: boolean
  qrImage: string
}

// Low-level universal request function
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 25000
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {}
  // Do not set Content-Type if body is FormData (browser will automatically set boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string> || {})
      }
    })

    clearTimeout(timeoutId)

    const contentType = res.headers.get('content-type') || ''
    let data: any = {}
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => ({}))
    } else {
      const text = await res.text()
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text }
      }
    }

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || `Request failed with status ${res.status}`
      throw new Error(errorMsg)
    }

    // Auto unwrapping if nested
    if (data && typeof data === 'object') {
      if (data.user && !data.id && typeof data.user === 'object') return data.user as T
      if (data.group && !data.id && typeof data.group === 'object') return data.group as T
      if (data.expense && !data.id && typeof data.expense === 'object') return data.expense as T
      if (data.expenses && !Array.isArray(data) && Array.isArray(data.expenses)) return data.expenses as T
      if (data.settlements && !Array.isArray(data) && Array.isArray(data.settlements)) return data.settlements as T
      if (data.groups && !Array.isArray(data) && Array.isArray(data.groups)) return data.groups as T
    }

    return data as T
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Render backend may be waking up, please retry.')
    }
    throw err
  }
}

// User API
export const apiUsers = {
  create: (name: string) =>
    apiRequest<ApiUser>('/users', { method: 'POST', body: JSON.stringify({ name: name.trim() }) }),
  get: (userId: string) =>
    apiRequest<ApiUser>(`/users/${encodeURIComponent(userId)}`),
  getPaymentDetails: (userId: string) =>
    apiRequest<ApiPaymentDetails>(`/users/${encodeURIComponent(userId)}/payment-details`),
  updatePaymentDetails: (userId: string, data: { mobile: string; acceptsCash: boolean }) =>
    apiRequest<{ success: boolean }>(`/users/${encodeURIComponent(userId)}/payment-details`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  uploadQr: (userId: string, file: File) => {
    const formData = new FormData()
    formData.append('qr', file)
    return apiRequest<{ qrImage: string }>(`/users/${encodeURIComponent(userId)}/payment-qr`, {
      method: 'POST',
      body: formData
    })
  },
  deleteQr: (userId: string) =>
    apiRequest<{ success: boolean }>(`/users/${encodeURIComponent(userId)}/payment-qr`, {
      method: 'DELETE'
    })
}

// Group API
export const apiGroups = {
  create: (data: { name: string; description?: string; createdBy: string; creatorName: string; members?: { name: string }[] }) =>
    apiRequest<ApiGroup>('/groups', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        userId: data.createdBy
      })
    }),
  get: async (groupId: string) => {
    const cleanId = String(groupId || '').trim()
    try {
      return await apiRequest<ApiGroup & { expenses?: ApiExpense[] }>(`/groups/${encodeURIComponent(cleanId)}`)
    } catch (err: any) {
      try {
        const inv = await apiRequest<ApiGroup & { expenses?: ApiExpense[] }>(`/groups/invite/${encodeURIComponent(cleanId.toUpperCase())}`)
        if (inv && inv.id && inv.id !== cleanId) {
          try {
            return await apiRequest<ApiGroup & { expenses?: ApiExpense[] }>(`/groups/${encodeURIComponent(inv.id)}`)
          } catch {
            return inv
          }
        }
        return inv
      } catch {
        throw err
      }
    }
  },
  getUserGroups: (userId: string) =>
    apiRequest<ApiGroup[]>(`/groups/user/${encodeURIComponent(userId)}`).catch(() =>
      apiRequest<ApiGroup[]>(`/users/${encodeURIComponent(userId)}/groups`)
    ),
  getByInvite: (inviteCode: string) =>
    apiRequest<ApiGroup>(`/groups/invite/${encodeURIComponent(inviteCode)}`),
  join: (code: string, userId: string, name: string) =>
    apiRequest<ApiGroup & { alreadyMember?: boolean }>(`/groups/join`, {
      method: 'POST',
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
        inviteCode: code.trim().toUpperCase(),
        userId,
        name,
        userName: name
      })
    }),
  delete: async (groupId: string, userId?: string, fallbackCode?: string) => {
    try {
      return await apiRequest<{ success: boolean }>(`/groups/${encodeURIComponent(groupId)}`, {
        method: 'DELETE'
      })
    } catch (err: any) {
      if (userId) {
        try {
          return await apiRequest<{ success: boolean }>(
            `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
            { method: 'DELETE' }
          )
        } catch (memberErr: any) {
          if (fallbackCode && fallbackCode !== groupId) {
            return await apiRequest<{ success: boolean }>(
              `/groups/${encodeURIComponent(fallbackCode)}/members/${encodeURIComponent(userId)}`,
              { method: 'DELETE' }
            )
          }
          throw memberErr
        }
      }
      throw err
    }
  },
  addMember: async (groupId: string, name: string) => {
    let cleanId = String(groupId || '').trim()
    if (cleanId.toUpperCase().startsWith('FIN-') || cleanId.length <= 12) {
      try {
        const inv = await apiGroups.getByInvite(cleanId.toUpperCase())
        if (inv && inv.id) cleanId = inv.id
      } catch {}
    }
    try {
      return await apiRequest<{ userId?: string; name: string; members?: ApiMember[] }>(`/groups/${encodeURIComponent(cleanId)}/members`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() })
      })
    } catch (err: any) {
      try {
        const inv = await apiGroups.getByInvite(cleanId.toUpperCase())
        if (inv && inv.id && inv.id !== cleanId) {
          return await apiRequest<{ userId?: string; name: string; members?: ApiMember[] }>(`/groups/${encodeURIComponent(inv.id)}/members`, {
            method: 'POST',
            body: JSON.stringify({ name: name.trim() })
          })
        }
      } catch {}
      throw err
    }
  },
  removeMember: async (groupId: string, userId: string) => {
    let cleanId = String(groupId || '').trim()
    if (cleanId.toUpperCase().startsWith('FIN-') || cleanId.length <= 12) {
      try {
        const inv = await apiGroups.getByInvite(cleanId.toUpperCase())
        if (inv && inv.id) cleanId = inv.id
      } catch {}
    }
    return apiRequest<{ success: boolean }>(`/groups/${encodeURIComponent(cleanId)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    })
  },
  getBalances: (groupId: string) =>
    apiRequest<ApiBalance[]>(`/groups/${encodeURIComponent(groupId)}/balances`),
  getSettlements: (groupId: string) =>
    apiRequest<ApiSettlement[]>(`/groups/${encodeURIComponent(groupId)}/settlements`),
  getExpenses: (groupId: string) =>
    apiRequest<ApiExpense[]>(`/groups/${encodeURIComponent(groupId)}/expenses`),
  getShare: (groupId: string) =>
    apiRequest<ApiShareInfo>(`/groups/${encodeURIComponent(groupId)}/share`),
  getPaymentHistory: (groupId: string) =>
    apiRequest<ApiPaymentHistory[]>(`/groups/${encodeURIComponent(groupId)}/payment-history`)
}

// Expense API
export const apiExpenses = {
  create: (groupId: string, data: {
    title: string
    amount: number
    paidBy: string
    category?: string
    date?: string
    splitMethod?: string
    participants: (string | { userId: string; amount?: number; percentage?: number; shares?: number })[]
  }) =>
    apiRequest<ApiExpense>(`/groups/${encodeURIComponent(groupId)}/expenses`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        description: data.title
      })
    }),
  update: (expenseId: string, data: {
    title?: string
    amount?: number
    paidBy?: string
    category?: string
    date?: string
    splitMethod?: string
    participants?: (string | { userId: string; amount?: number; percentage?: number; shares?: number })[]
  }) =>
    apiRequest<ApiExpense>(`/expenses/${encodeURIComponent(expenseId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...data,
        description: data.title
      })
    }),
  delete: (expenseId: string) =>
    apiRequest<{ success: boolean }>(`/expenses/${encodeURIComponent(expenseId)}`, {
      method: 'DELETE'
    })
}

// Settlement API
export const apiSettlements = {
  markPaid: (settlementId: string) =>
    apiRequest<{ success: boolean; paidAt: string }>(`/settlements/${encodeURIComponent(settlementId)}/pay`, {
      method: 'POST'
    }),
  markUnpaid: (settlementId: string) =>
    apiRequest<{ success: boolean }>(`/settlements/${encodeURIComponent(settlementId)}/unpay`, {
      method: 'POST'
    }),
  sendReminder: (settlementId: string) =>
    apiRequest<{ message: string; settlement: ApiSettlement }>(`/settlements/${encodeURIComponent(settlementId)}/reminder`, {
      method: 'POST'
    })
}