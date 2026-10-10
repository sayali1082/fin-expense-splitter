'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  Copy,
  CreditCard,
  Edit2,
  FileText,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ReceiptText,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Users,
  WalletCards,
  X
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  API_URL,
  apiExpenses,
  apiGroups,
  apiSettlements,
  apiUsers,
  ApiBalance,
  ApiExpense,
  ApiGroup,
  ApiMember,
  ApiPaymentDetails,
  ApiPaymentHistory,
  ApiSettlement,
  ApiUser
} from '@/lib/api'
import HoldButton from './HoldButton'

type View = 'home' | 'groups' | 'create' | 'join' | 'dashboard'
type User = ApiUser
type Member = ApiMember
type Group = ApiGroup
type Expense = ApiExpense
type Settlement = ApiSettlement
type Balance = ApiBalance
type PaymentHistory = ApiPaymentHistory

const USER_KEY = 'fin_user'

function money(value: number | string | undefined) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function inviteCode(group: Group) {
  return group.code || group.inviteCode || group.invite_code || ''
}

function initials(name: string) {
  return (name || '?').trim().charAt(0).toLowerCase()
}

function computeGroupBalances(
  members: Member[],
  expenses: Expense[],
  paymentHistory: PaymentHistory[]
): Balance[] {
  const map = new Map<string, { userId: string; name: string; amount: number }>()

  // 1. Initialize for all guaranteed members
  for (const m of members) {
    const nameKey = (m.name || '').trim().toLowerCase()
    const idKey = (m.userId || m.id || '').trim().toLowerCase()
    const record = { userId: m.userId || m.id, name: m.name, amount: 0 }
    if (nameKey) map.set(`name:${nameKey}`, record)
    if (idKey) map.set(`id:${idKey}`, record)
  }

  const findRecord = (userIdOrName?: string) => {
    if (!userIdOrName) return null
    const clean = userIdOrName.trim().toLowerCase()
    if (map.has(`id:${clean}`)) return map.get(`id:${clean}`)!
    if (map.has(`name:${clean}`)) return map.get(`name:${clean}`)!
    for (const val of map.values()) {
      if ((val.userId && val.userId.toLowerCase() === clean) || (val.name && val.name.toLowerCase() === clean)) {
        return val
      }
    }
    return null
  }

  // 2. Accumulate expenses
  for (const exp of expenses) {
    const amt = Number(exp.amount || 0)
    if (amt <= 0) continue

    const payer = findRecord(exp.paidByName) || findRecord(exp.paidBy)
    if (payer) {
      payer.amount += amt
    }

    const participants = exp.participants || []
    if (participants.length > 0) {
      const splitAmt = amt / participants.length
      participants.forEach((p, idx) => {
        const pId = typeof p === 'string' ? p : p.userId
        const pName = typeof p === 'object' ? p.name : undefined
        let pRecord = (pName && pName.toLowerCase() !== 'member') ? findRecord(pName) : null
        if (!pRecord && pId) pRecord = findRecord(pId)

        // Fallback 1: match by index if participant count equals member count
        if (!pRecord && participants.length === members.length && members[idx]) {
          pRecord = findRecord(members[idx].name) || findRecord(members[idx].userId || members[idx].id)
        }

        // Fallback 2: match against non-payer members if name is 'Member'
        if (!pRecord && members.length > 1) {
          const nonPayers = members.filter(m => {
            const mId = m.userId || m.id
            return mId !== exp.paidBy && m.name.toLowerCase() !== (exp.paidByName || '').toLowerCase()
          })
          if (nonPayers.length === 1) {
            pRecord = findRecord(nonPayers[0].name)
          }
        }

        let share = splitAmt
        if (typeof p === 'object' && p.shareAmount !== undefined && p.shareAmount !== null && Number(p.shareAmount) > 0) {
          share = Number(p.shareAmount)
        }

        if (pRecord) {
          pRecord.amount -= share
        }
      })
    } else if (members.length > 0) {
      const share = amt / members.length
      for (const m of members) {
        const r = findRecord(m.userId || m.id) || findRecord(m.name)
        if (r) r.amount -= share
      }
    }
  }

  // 3. Reconcile with completed payments in paymentHistory
  for (const pay of paymentHistory) {
    const from = findRecord(pay.fromUserName) || findRecord((pay as any).fromUserId)
    const to = findRecord(pay.toUserName) || findRecord((pay as any).toUserId)
    const amt = Number(pay.amount || 0)
    if (from) from.amount += amt
    if (to) to.amount -= amt
  }

  // Deduplicate unique records by lowercased name
  const uniqueRecords = new Map<string, { userId: string; name: string; amount: number }>()
  for (const rec of map.values()) {
    uniqueRecords.set(rec.name.toLowerCase(), rec)
  }

  return Array.from(uniqueRecords.values()).map(r => ({
    userId: r.userId,
    name: r.name,
    amount: Math.round(r.amount * 100) / 100
  }))
}

function computePendingSettlements(
  balances: Balance[],
  members: Member[],
  canonicalGroupId: string
): Settlement[] {
  const debtors: { userId: string; name: string; amount: number }[] = []
  const creditors: { userId: string; name: string; amount: number }[] = []

  for (const b of balances) {
    const rounded = Math.round(b.amount * 100) / 100
    if (rounded < -0.01) {
      debtors.push({ userId: b.userId, name: b.name, amount: Math.abs(rounded) })
    } else if (rounded > 0.01) {
      creditors.push({ userId: b.userId, name: b.name, amount: rounded })
    }
  }

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const results: Settlement[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount)
    if (amount > 0.01) {
      const fromUser = members.find(
        m => (m.userId || m.id) === debtors[i].userId || m.name.toLowerCase() === debtors[i].name.toLowerCase()
      )
      const toUser = members.find(
        m => (m.userId || m.id) === creditors[j].userId || m.name.toLowerCase() === creditors[j].name.toLowerCase()
      )

      results.push({
        id: `settle-${debtors[i].userId || debtors[i].name}-${creditors[j].userId || creditors[j].name}`,
        groupId: canonicalGroupId,
        fromUserId: fromUser ? (fromUser.userId || fromUser.id) : debtors[i].userId,
        fromUserName: debtors[i].name,
        toUserId: toUser ? (toUser.userId || toUser.id) : creditors[j].userId,
        toUserName: creditors[j].name,
        amount: Math.round(amount * 100) / 100,
        status: 'pending',
        createdAt: new Date().toISOString()
      })
    }

    debtors[i].amount -= amount
    creditors[j].amount -= amount
    if (debtors[i].amount < 0.01) i++
    if (creditors[j].amount < 0.01) j++
  }

  return results
}

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">f</span>
      <span>fin</span>
    </div>
  )
}

function Mascot() {
  return (
    <div className="mascot-scene" aria-label="Friendly coral mascot illustration">
      <motion.div
        className="sparkle sparkle-one"
        animate={{ opacity: [0.35, 1, 0.35], scale: [0.8, 1.15, 0.8] }}
        transition={{ repeat: Infinity, duration: 3 }}
      >
        ✦
      </motion.div>
      <motion.div
        className="coin coin-one"
        animate={{ y: [0, -8, 0], rotate: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 4 }}
      >
        ₹
      </motion.div>
      <motion.div
        className="coin coin-two"
        animate={{ y: [0, -6, 0], rotate: [0, -12, 0] }}
        transition={{ repeat: Infinity, duration: 4.5, delay: 0.4 }}
      >
        ₹
      </motion.div>
      <motion.div
        className="mascot"
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
      >
        <span className="mascot-eye eye-left" />
        <span className="mascot-eye eye-right" />
        <span className="mascot-mouth" />
        <span className="mascot-arm arm-left" />
        <span className="mascot-arm arm-right" />
      </motion.div>
      <div className="scene-shadow" />
    </div>
  )
}

function Nav({ onNavigate, onTheme }: { onNavigate: (v: View) => void; onTheme: () => void }) {
  const [open, setOpen] = useState(false)
  const go = (v: View) => {
    onNavigate(v)
    setOpen(false)
  }
  return (
    <header className="topbar">
      <div className="nav-inner">
        <button className="logo-button" onClick={() => go('home')}>
          <Logo />
        </button>
        <div className="desktop-nav">
          <button className="theme-toggle" onClick={onTheme}>
            <span>☼</span>
            <span>◐</span>
          </button>
          <button className="nav-button" onClick={() => go('create')}>Create group</button>
          <button className="nav-button" onClick={() => go('join')}>Join group</button>
          <button className="nav-button" onClick={() => go('groups')}>Existing groups</button>
        </div>
        <button className="mobile-menu" onClick={() => setOpen(!open)}>
          <Menu size={21} />
        </button>
      </div>
      {open && (
        <div className="mobile-nav">
          <button onClick={() => go('create')}>Create group</button>
          <button onClick={() => go('join')}>Join group</button>
          <button onClick={() => go('groups')}>Existing groups</button>
        </div>
      )}
    </header>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
      <motion.div
        className="modal"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

function Home({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <main className="home-main">
      <motion.section className="hero" initial="hidden" animate="show">
        <motion.div
          className="hero-copy"
          variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.55 } } }}
        >
          <div className="eyebrow">
            <span className="eyebrow-dot" /> Fin makes money conversations easy
          </div>
          <h1>
            Bhai paise wapas bhi<br />
            <em>karne hote hai yrr</em>
          </h1>
          <p>
            Split expenses, settle up, and keep shared<br className="desktop-only" /> life simple with fin.
          </p>
          <div className="hero-actions">
            <span>Jaldi karo</span>
            <button className="primary-button" onClick={() => onNavigate('join')}>
              Join Group <ArrowRight size={17} />
            </button>
          </div>
          <div className="social-proof">
            <span>Start with your own group and invite your friends.</span>
          </div>
        </motion.div>
        <motion.div
          className="hero-art"
          variants={{ hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1, transition: { duration: 0.7, delay: 0.1 } } }}
        >
          <Mascot />
          <div className="art-label">
            <span>
              <Sparkles size={15} /> A little less awkward
            </span>
            <b>about money.</b>
          </div>
        </motion.div>
      </motion.section>
    </main>
  )
}

function Stat({ label, value, note, icon: Icon, tone = 'blue' }: { label: string; value: string; note: string; icon: any; tone?: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <Icon size={17} />
      </div>
      <div>
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  )
}

function Dashboard({ groupId, user, onNavigate }: { groupId: string; user: User; onNavigate: (v: View) => void }) {
  const [group, setGroup] = useState<Group | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([])
  const [modal, setModal] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Expense form state
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [payer, setPayer] = useState(user.id)
  const [participants, setParticipants] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)

  // Member addition & deletion
  const [newMemberName, setNewMemberName] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [deletingGroup, setDeletingGroup] = useState(false)

  // Settlement actions state
  const [activeSettlement, setActiveSettlement] = useState<Settlement | null>(null)
  const [payeeDetails, setPayeeDetails] = useState<ApiPaymentDetails | null>(null)
  const [loadingPayee, setLoadingPayee] = useState(false)
  const [processingSettlementId, setProcessingSettlementId] = useState<string | null>(null)
  const [reminderText, setReminderText] = useState('')

  const notify = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(''), 3000)
  }

  // Guarantee group always has its full member list properly mapped, merged, and deduped
  const getGuaranteedMembers = (g: Group | null, targetGroupId?: string): Member[] => {
    const raw = g?.members || []
    const canonicalId = targetGroupId || g?.id || groupId || ''

    // Read any locally cached members for this group so additions are persistent and never lost
    let cached: Member[] = []
    if (typeof window !== 'undefined' && canonicalId) {
      try {
        const stored = localStorage.getItem(`fin_members_${canonicalId}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) cached = parsed
        }
      } catch {}
    }

    const list: Member[] = []
    const seenIds = new Set<string>()
    const seenNames = new Set<string>()

    // Merge candidates: backend raw members + cached members
    const allCandidates = [...raw, ...cached]
    for (const m of allCandidates) {
      const name = (m.name || '').trim()
      if (!name) continue
      const id = m.userId || m.id || name.toLowerCase()
      const lowerName = name.toLowerCase()

      if (!seenIds.has(id) && !seenNames.has(lowerName)) {
        seenIds.add(id)
        seenNames.add(lowerName)
        list.push({
          id: m.id || id,
          userId: m.userId || id,
          name: name
        })
      }
    }

    // Ensure the current user is always included in their group
    if (user && user.id && user.name) {
      const userExists = list.some(
        m => (m.userId || m.id) === user.id || m.name.toLowerCase() === user.name.toLowerCase()
      )
      if (!userExists) {
        list.unshift({ id: user.id, userId: user.id, name: user.name })
      }
    }

    // Update localStorage cache with the guaranteed list
    if (typeof window !== 'undefined' && canonicalId && list.length > 0) {
      try {
        localStorage.setItem(`fin_members_${canonicalId}`, JSON.stringify(list))
      } catch {}
    }

    return list
  }

  const refreshData = async () => {
    try {
      const cleanId = String(groupId || '').trim()
      let g: Group | null = null

      try {
        g = await apiGroups.get(cleanId)
      } catch (directErr) {
        if (user && user.id) {
          const userGroups = await apiGroups.getUserGroups(user.id).catch(() => [] as Group[])
          const found = userGroups.find(
            x =>
              x.id === cleanId ||
              inviteCode(x).toLowerCase() === cleanId.toLowerCase() ||
              x.name.trim().toLowerCase() === cleanId.toLowerCase()
          )
          if (found) {
            if (found.id && found.id !== cleanId) {
              try {
                g = await apiGroups.get(found.id)
              } catch {
                g = found
              }
            } else {
              g = found
            }
          }
        }
        if (!g && !group) throw directErr
      }

      if (g) {
        const canonicalId = g.id || cleanId
        // Merge incoming server members with any existing members in state so members never vanish
        const currentMembers = group?.members || []
        const incomingMembers = g.members || []
        const combined = [...currentMembers, ...incomingMembers]
        const ensuredMembers = getGuaranteedMembers({ ...g, members: combined.length ? combined : incomingMembers }, canonicalId)
        const updatedGroup = { ...g, id: canonicalId, members: ensuredMembers }
        setGroup(updatedGroup)
        setError('')

        const memberIds = ensuredMembers.map(m => m.userId || m.id)
        if (!participants.length) {
          setParticipants(memberIds)
        }
        if (!memberIds.includes(payer)) {
          setPayer(memberIds[0] || user.id)
        }

        // Fetch companion live backend data
        const [expResult, setResult, balResult, histResult] = await Promise.allSettled([
          apiGroups.getExpenses(canonicalId),
          apiGroups.getSettlements(canonicalId),
          apiGroups.getBalances(canonicalId),
          apiGroups.getPaymentHistory(canonicalId)
        ])

        if (expResult.status === 'fulfilled' && Array.isArray(expResult.value)) {
          setExpenses(expResult.value)
        }
        if (setResult.status === 'fulfilled' && Array.isArray(setResult.value)) {
          setSettlements(setResult.value)
        }
        if (balResult.status === 'fulfilled' && Array.isArray(balResult.value)) {
          setBalances(balResult.value)
        }
        if (histResult.status === 'fulfilled' && Array.isArray(histResult.value)) {
          let mergedHist = [...histResult.value]
          if (typeof window !== 'undefined' && canonicalId) {
            try {
              const raw = localStorage.getItem(`fin_payhist_${canonicalId}`)
              if (raw) {
                const localHist = JSON.parse(raw) as PaymentHistory[]
                const ids = new Set(mergedHist.map(h => h.id || h.settlementId))
                for (const item of localHist) {
                  if (!ids.has(item.id) && !ids.has(item.settlementId)) {
                    mergedHist.push(item)
                  }
                }
              }
            } catch {}
          }
          setPaymentHistory(mergedHist)
        }
      }
    } catch (err) {
      if (!group) {
        setError(err instanceof Error ? err.message : 'Unable to load group')
      }
    }
  }

  useEffect(() => {
    let alive = true
    refreshData().finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [groupId])

  const members = group ? getGuaranteedMembers(group) : []
  const memberCount = members.length
  const total = expenses.reduce((n, e) => n + Number(e.amount || 0), 0)

  // 1. Authoritative calculated balances for every member (unconditional hook)
  const effectiveBalances = useMemo(() => {
    return computeGroupBalances(members, expenses, paymentHistory)
  }, [members, expenses, paymentHistory])

  // 2. Authoritative pending settlements (unconditional hook)
  const pendingSettlements = useMemo(() => {
    const backendPending = settlements.filter(s => String(s.status || '').toLowerCase() === 'pending')
    const computed = computePendingSettlements(effectiveBalances, members, group?.id || groupId)

    if (backendPending.length > 0) {
      const enrichedBackend = backendPending.map(s => {
        const fromMember = members.find(
          m => (m.userId || m.id) === s.fromUserId || m.name.toLowerCase() === (s.fromUserName || '').toLowerCase()
        )
        const toMember = members.find(
          m => (m.userId || m.id) === s.toUserId || m.name.toLowerCase() === (s.toUserName || '').toLowerCase()
        )
        return {
          ...s,
          fromUserId: s.fromUserId || fromMember?.userId || fromMember?.id || '',
          fromUserName: s.fromUserName || fromMember?.name || 'Member',
          toUserId: s.toUserId || toMember?.userId || toMember?.id || '',
          toUserName: s.toUserName || toMember?.name || 'Member',
          amount: Number(s.amount || 0)
        }
      })

      const keySet = new Set(enrichedBackend.map(s => `${s.fromUserName.toLowerCase()}->${s.toUserName.toLowerCase()}`))
      const missingComputed = computed.filter(
        c => !keySet.has(`${c.fromUserName.toLowerCase()}->${c.toUserName.toLowerCase()}`)
      )
      return [...enrichedBackend, ...missingComputed]
    }

    return computed
  }, [settlements, effectiveBalances, members, group?.id, groupId])

  // Calculate user net balance
  const userBalanceEntry = effectiveBalances.find(
    b => b.userId === user.id || b.name.toLowerCase() === user.name.toLowerCase()
  )
  const userBalanceAmount = userBalanceEntry ? userBalanceEntry.amount : 0
  const userBalanceFormatted =
    userBalanceAmount > 0
      ? `+${money(userBalanceAmount)}`
      : userBalanceAmount < 0
      ? `-${money(Math.abs(userBalanceAmount))}`
      : '₹0.00'
  const userBalanceNote =
    userBalanceAmount > 0 ? 'You get back' : userBalanceAmount < 0 ? 'You owe overall' : 'All settled up'

  if (loading && !group) {
    return (
      <main className="app-main">
        <div className="simple-page">
          <div className="empty-state">
            <h2>Loading group...</h2>
            <p>Getting the latest group information from the server.</p>
          </div>
        </div>
      </main>
    )
  }

  if (error && !group) {
    return (
      <main className="app-main">
        <div className="simple-page">
          <div className="empty-state">
            <h2>Couldn’t load this group</h2>
            <p>{error || 'Group not found.'}</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => onNavigate('groups')}>
                Back to groups <ArrowRight size={16} />
              </button>
              <button className="outline-button" onClick={() => refreshData()}>
                Try again
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!group) return null

  const code = inviteCode(group)
  const link = code ? `${typeof window !== 'undefined' ? window.location.origin : ''}?join=${encodeURIComponent(code)}` : ''

  const copy = async () => {
    if (link) {
      if (navigator.share) {
        try {
          await navigator.share({ title: group.name, text: `Join ${group.name} on Fin`, url: link })
          notify('Invite link shared')
          return
        } catch {
          // Fallback to clipboard
        }
      }
      await navigator.clipboard?.writeText(link)
      notify('Invite link copied')
    }
  }

  const isParticipantChecked = (m: Member) => {
    const mid = m.userId || m.id
    return participants.some(
      p =>
        p === mid ||
        p === m.userId ||
        p === m.id ||
        p.toLowerCase() === (m.name || '').toLowerCase() ||
        members.find(x => x.userId === p || x.id === p)?.name.toLowerCase() === (m.name || '').toLowerCase()
    )
  }

  const toggleParticipant = (m: Member) => {
    const mid = m.userId || m.id
    setParticipants(prev => {
      const isChecked = isParticipantChecked(m)
      if (isChecked) {
        return prev.filter(
          p =>
            p !== mid &&
            p !== m.userId &&
            p !== m.id &&
            p.toLowerCase() !== (m.name || '').toLowerCase() &&
            members.find(x => x.userId === p || x.id === p)?.name.toLowerCase() !== (m.name || '').toLowerCase()
        )
      } else {
        return [...prev, mid]
      }
    })
  }

  const openAddExpenseModal = () => {
    setEditingExpenseId(null)
    setTitle('')
    setAmount('')
    setCategory('Food')
    const memberIds = members.map(m => m.userId || m.id)
    setParticipants(memberIds)
    setPayer(user.id)
    setModal('expense')
  }

  const openEditExpenseModal = (exp: Expense) => {
    setEditingExpenseId(exp.id)
    setTitle(exp.title || exp.description || '')
    setAmount(String(exp.amount || ''))
    setCategory(exp.category || 'Food')
    setPayer(exp.paidBy || user.id)
    const existingParts = (exp.participants || []).map(p => p.userId)
    setParticipants(existingParts.length ? existingParts : members.map(m => m.userId || m.id))
    setModal('expense')
  }

  const handleSaveExpense = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || Number(amount) <= 0) return notify('Enter a valid title and amount')
    const checkedMembers = members.filter(m => isParticipantChecked(m))
    if (!checkedMembers.length) return notify('Select at least one participant')

    // Map checked members to canonical backend IDs
    const finalParticipantIds = checkedMembers.map(m => {
      const match = (group?.members || []).find(bm => bm.name.toLowerCase() === m.name.toLowerCase())
      return match ? (match.userId || match.id) : (m.userId || m.id)
    })

    setSaving(true)
    try {
      const canonicalGroupId = group.id || groupId
      if (editingExpenseId) {
        await apiExpenses.update(editingExpenseId, {
          title: title.trim(),
          amount: Number(amount),
          category,
          paidBy: payer || user.id,
          participants: finalParticipantIds
        })
        notify('Expense updated')
      } else {
        await apiExpenses.create(canonicalGroupId, {
          title: title.trim(),
          amount: Number(amount),
          category,
          paidBy: payer || user.id,
          participants: finalParticipantIds
        })
        notify('Expense added')
      }
      setModal(null)
      await refreshData()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteExpense = async (expenseId: string, titleName: string) => {
    const confirmDel = window.confirm(`Delete expense "${titleName}"?`)
    if (!confirmDel) return
    try {
      await apiExpenses.delete(expenseId)
      notify('Expense deleted')
      await refreshData()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete expense')
    }
  }

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault()
    const nameToAdd = newMemberName.trim()
    if (!nameToAdd) return notify('Enter member name')

    const canonicalGroupId = group?.id || groupId
    const currentMembers = getGuaranteedMembers(group, canonicalGroupId)
    if (currentMembers.some(m => m.name.toLowerCase() === nameToAdd.toLowerCase())) {
      return notify(`"${nameToAdd}" is already in this group`)
    }

    setAddingMember(true)

    // 1. Immediately create and keep the new member in local state and localStorage so it never vanishes
    const newMemberItem: Member = {
      id: Math.random().toString(36).substring(2, 11),
      userId: `user-${Date.now()}`,
      name: nameToAdd
    }

    const nextMembers = [...currentMembers, newMemberItem]
    const guaranteed = getGuaranteedMembers({ ...(group || {}), id: canonicalGroupId, name: group?.name || '', members: nextMembers }, canonicalGroupId)
    
    // Save to localStorage immediately
    if (typeof window !== 'undefined' && canonicalGroupId) {
      try {
        localStorage.setItem(`fin_members_${canonicalGroupId}`, JSON.stringify(guaranteed))
      } catch {}
    }

    setGroup(prev => prev ? { ...prev, members: guaranteed } : { id: canonicalGroupId, name: 'Group', members: guaranteed } as Group)
    setParticipants(guaranteed.map(m => m.userId || m.id))
    setNewMemberName('')
    notify(`Added ${nameToAdd} to group`)

    // 2. Sync with backend asynchronously
    try {
      const res = await apiGroups.addMember(canonicalGroupId, nameToAdd)
      if (res && res.members && Array.isArray(res.members)) {
        const mergedWithBackend = getGuaranteedMembers({ ...group, members: [...guaranteed, ...res.members] }, canonicalGroupId)
        setGroup(prev => prev ? { ...prev, members: mergedWithBackend } : prev)
        if (typeof window !== 'undefined' && canonicalGroupId) {
          try {
            localStorage.setItem(`fin_members_${canonicalGroupId}`, JSON.stringify(mergedWithBackend))
          } catch {}
        }
      } else if (res && (res.userId || res.name)) {
        setGroup(prev => {
          if (!prev) return prev
          const updatedMembers = (prev.members || []).map(m =>
            m.name.toLowerCase() === nameToAdd.toLowerCase()
              ? { ...m, id: res.userId || m.id, userId: res.userId || m.userId }
              : m
          )
          return { ...prev, members: updatedMembers }
        })
      }
      await refreshData()
    } catch (err) {
      console.warn('Backend sync error (retained locally):', err)
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (targetUserId === user.id) return notify('Cannot remove yourself from the group')
    const confirmRemove = window.confirm(`Remove member "${memberName}" from group?`)
    if (!confirmRemove) return

    const canonicalGroupId = group?.id || groupId

    // Remove from state & localStorage immediately
    setGroup(prev => {
      if (!prev) return prev
      const filtered = (prev.members || []).filter(
        m => (m.userId || m.id) !== targetUserId && m.name.toLowerCase() !== memberName.toLowerCase()
      )
      if (typeof window !== 'undefined' && canonicalGroupId) {
        try {
          localStorage.setItem(`fin_members_${canonicalGroupId}`, JSON.stringify(filtered))
        } catch {}
      }
      return { ...prev, members: filtered }
    })

    notify(`Removed ${memberName}`)

    try {
      await apiGroups.removeMember(canonicalGroupId, targetUserId)
      await refreshData()
    } catch (err) {
      console.warn('Backend removeMember:', err)
    }
  }

  const handleDeleteGroup = async () => {
    setDeletingGroup(true)
    try {
      const canonicalGroupId = group.id || groupId
      await apiGroups.delete(canonicalGroupId, user.id)
      notify('Group deleted successfully')
      onNavigate('groups')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete group')
      setDeletingGroup(false)
    }
  }

  const openReminderModal = async (s: Settlement) => {
    setActiveSettlement(s)
    try {
      if (s.id && !s.id.startsWith('settle-')) {
        const res = await apiSettlements.sendReminder(s.id)
        if (res && res.message) {
          setReminderText(res.message)
          setModal('reminder')
          return
        }
      }
    } catch {}
    setReminderText(`Hey ${s.fromUserName} 👋\nYou have a pending payment of ${money(s.amount)} to ${s.toUserName} in ${group.name} on fin.`)
    setModal('reminder')
  }

  const openPayModal = async (s: Settlement) => {
    setActiveSettlement(s)
    setModal('pay')
    setLoadingPayee(true)
    setPayeeDetails(null)
    try {
      let details: ApiPaymentDetails | null = null
      if (s.toUserId) {
        try {
          details = await apiUsers.getPaymentDetails(s.toUserId)
        } catch {}
      }
      if (!details || (!details.mobile && !details.qrImage && !details.acceptsCash)) {
        const match = members.find(m => m.name.toLowerCase() === (s.toUserName || '').toLowerCase())
        if (match && (match.userId || match.id)) {
          details = await apiUsers.getPaymentDetails(match.userId || match.id).catch(() => null)
        }
      }
      setPayeeDetails(details)
    } catch {
      setPayeeDetails(null)
    } finally {
      setLoadingPayee(false)
    }
  }

  const handleMarkPaid = async (settlementId: string) => {
    setProcessingSettlementId(settlementId)
    try {
      const s = pendingSettlements.find(x => x.id === settlementId) || activeSettlement
      if (settlementId && !settlementId.startsWith('settle-')) {
        try {
          await apiSettlements.markPaid(settlementId)
        } catch {}
      }
      if (s) {
        const newRecord: PaymentHistory = {
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          groupId: group?.id || groupId,
          settlementId: s.id,
          fromUserName: s.fromUserName,
          toUserName: s.toUserName,
          amount: Number(s.amount || 0),
          paidAt: new Date().toISOString()
        }
        setPaymentHistory(prev => [newRecord, ...prev])
        const cId = group?.id || groupId
        if (typeof window !== 'undefined' && cId) {
          try {
            const raw = localStorage.getItem(`fin_payhist_${cId}`)
            const list = raw ? JSON.parse(raw) : []
            localStorage.setItem(`fin_payhist_${cId}`, JSON.stringify([newRecord, ...list]))
          } catch {}
        }
      }
      notify('Settlement marked as paid')
      setModal(null)
      await refreshData()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to mark settlement as paid')
    } finally {
      setProcessingSettlementId(null)
    }
  }

  const handleMarkUnpaid = async (settlementId: string) => {
    setProcessingSettlementId(settlementId)
    try {
      if (settlementId && !settlementId.startsWith('settle-')) {
        try {
          await apiSettlements.markUnpaid(settlementId)
        } catch {}
      }
      setPaymentHistory(prev => prev.filter(h => h.settlementId !== settlementId && h.id !== settlementId))
      const cId = group?.id || groupId
      if (typeof window !== 'undefined' && cId) {
        try {
          const raw = localStorage.getItem(`fin_payhist_${cId}`)
          if (raw) {
            const list = JSON.parse(raw)
            localStorage.setItem(
              `fin_payhist_${cId}`,
              JSON.stringify(list.filter((h: any) => h.settlementId !== settlementId && h.id !== settlementId))
            )
          }
        } catch {}
      }
      notify('Settlement marked as unpaid')
      await refreshData()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to mark settlement as unpaid')
    } finally {
      setProcessingSettlementId(null)
    }
  }

  const whatsappMessage = `Join my expense group "${group.name}" on Fin!\nUse invite code: ${code}\nOr join directly with this link: ${link}`
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`

  return (
    <main className="app-main">
      <div className="app-shell">
        <div className="dashboard-head">
          <button className="back-link" onClick={() => onNavigate('groups')}>
            <ArrowLeft size={16} /> Back to groups
          </button>
          <div className="dashboard-actions">
            <button className="outline-button copy-link-btn" onClick={copy}>
              <Copy size={15} /> Copy link
            </button>
            <HoldButton
              doneLabel="Deleted"
              backgroundColor="#27272a"
              fillColor="#ff2746"
              textColor="#f5f5f5"
              fillTextColor="#ffffff"
              size="md"
              radius={14}
              fillDirection="right"
              holdTime={2000}
              releaseTime={200}
              pressScale={0.97}
              wave
              waveAmplitude={6}
              glow
              resetAfter={1200}
              disabled={deletingGroup}
              onHold={() => {
                console.log('confirmed')
                handleDeleteGroup()
              }}
              icon={<Trash2 size={15} />}
              className="dashboard-hold-delete-btn"
            >
              Hold to delete
            </HoldButton>
            <button className="primary-button small add-expense-btn" onClick={openAddExpenseModal}>
              <Plus size={16} /> Add expense
            </button>
          </div>
        </div>

        <div className="group-title-row">
          <div>
            <div className="kicker">
              {(group.name || 'Your group').toUpperCase()} <span className="live-dot" /> ACTIVE{' '}
              <span className="members-badge">
                <Users size={12} /> {memberCount} {memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
              </span>
            </div>
            {group.name && group.name.toLowerCase() !== 'your group' && (
              <h2>
                {group.name} {code && <span className="title-code">{code}</span>}
              </h2>
            )}
            <p className="group-subtitle">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} added
              {code ? ` · ${code}` : ''}
              {group.createdAt ? ` · Created ${new Date(group.createdAt).toLocaleDateString('en-IN')}` : ''}
            </p>
          </div>
          <button className="share-circle" onClick={() => setModal('share')} aria-label="Share group">
            <Share2 size={18} />
          </button>
        </div>

        <div className="stats-grid">
          <Stat
            label="Total spent"
            value={money(total)}
            note={`${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}`}
            icon={ReceiptText}
            tone="blue"
          />
          <Stat
            label="Members"
            value={`${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
            note="People in this group"
            icon={Users}
            tone="cream"
          />
          <Stat
            label="Your balance"
            value={userBalanceFormatted}
            note={userBalanceNote}
            icon={ArrowUpRight}
            tone={userBalanceAmount > 0 ? 'green' : userBalanceAmount < 0 ? 'red' : 'soft-blue'}
          />
          <Stat
            label="Pending"
            value={String(pendingSettlements.length)}
            note={`${pendingSettlements.length === 1 ? '1 settlement' : `${pendingSettlements.length} settlements`} open`}
            icon={Bell}
            tone="orange"
          />
        </div>

        <div className="dashboard-grid">
          <div className="left-column">
            <section className="panel">
              <div className="section-head">
                <div>
                  <span className="kicker">The people involved</span>
                  <h3>Members ({memberCount})</h3>
                </div>
              </div>
              {members.length ? (
                <div className="member-list">
                  {members.map(m => {
                    const mid = m.userId || m.id
                    const isYou = mid === user.id || m.name.toLowerCase() === user.name.toLowerCase()
                    const bEntry = effectiveBalances.find(b => b.userId === mid || b.name.toLowerCase() === m.name.toLowerCase())
                    const bAmount = bEntry ? bEntry.amount : 0
                    const bClass = bAmount > 0 ? 'green' : bAmount < 0 ? 'red' : 'muted'
                    return (
                      <div className="member-row" key={mid}>
                        <span className="avatar">{initials(m.name)}</span>
                        <span className="member-info">
                          <b>
                            {m.name}
                            {isYou && <span className="you-tag">You</span>}
                          </b>
                          <small>{isYou ? 'You' : 'Group member'}</small>
                        </span>
                        <strong className={bClass}>
                          {bAmount > 0 ? `+${money(bAmount)}` : bAmount < 0 ? `-${money(Math.abs(bAmount))}` : '₹0.00'}
                        </strong>
                        {!isYou && (
                          <button
                            className="icon-subtle-btn"
                            title="Remove member"
                            onClick={() => handleRemoveMember(mid, m.name)}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-inline">
                  <Users size={18} />No members have been added yet.
                </div>
              )}
              <form className="add-member-bar" onSubmit={handleAddMember}>
                <input
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  placeholder="Add member name..."
                  disabled={addingMember}
                />
                <button className="outline-button" type="submit" disabled={addingMember}>
                  <Plus size={14} /> {addingMember ? 'Adding...' : 'Add'}
                </button>
              </form>
              <div className="viewing">
                <span>Viewing as</span>
                <button>{user.name}</button>
                <button className="payment-details" onClick={() => setModal('details')}>
                  <CreditCard size={14} /> My payment details
                </button>
              </div>
            </section>

            <section className="panel expenses-panel">
              <div className="section-head">
                <div>
                  <span className="kicker">Where it went</span>
                  <h3>Recent expenses</h3>
                </div>
                <MoreHorizontal size={19} className="more-dots" />
              </div>
              {expenses.length ? (
                expenses.map(e => {
                  const paidByName =
                    e.paidByName ||
                    members.find(m => m.userId === e.paidBy || m.id === e.paidBy)?.name ||
                    e.paidBy ||
                    'member'
                  return (
                    <div className="expense-row" key={e.id}>
                      <span className="expense-icon">
                        <WalletCards size={17} />
                      </span>
                      <span className="expense-info">
                        <b>{e.title || e.description || 'Expense'}</b>
                        <small>
                          {e.category || 'Other'}
                          {e.date ? ` · ${new Date(e.date).toLocaleDateString('en-IN')}` : ''}
                        </small>
                      </span>
                      <span className="expense-amount">
                        <b>{money(e.amount)}</b>
                        <small>Paid by {paidByName}</small>
                      </span>
                      <div className="expense-row-actions">
                        <button
                          className="icon-subtle-btn"
                          title="Edit expense"
                          onClick={() => openEditExpenseModal(e)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="icon-subtle-btn"
                          title="Delete expense"
                          onClick={() => handleDeleteExpense(e.id, e.title || e.description || 'Expense')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="empty-inline">
                  <FileText size={18} />
                  <span>No expenses yet. Add the first one.</span>
                </div>
              )}
            </section>
          </div>

          <div className="right-column">
            <section className="panel settle-panel">
              <div className="section-head">
                <div>
                  <span className="kicker">Almost there</span>
                  <h3>Settle up</h3>
                </div>
                <span className="count-badge">{pendingSettlements.length} pending</span>
              </div>
              {pendingSettlements.length ? (
                <div className="settlements-list">
                  {pendingSettlements.map(s => (
                    <div className="settlement-card" key={s.id}>
                      <div className="settle-transfer-body">
                        {/* Debtor */}
                        <div className="settle-party">
                          <div className="settle-avatar" title={s.fromUserName}>
                            {initials(s.fromUserName)}
                          </div>
                          <span className="settle-party-name">{s.fromUserName}</span>
                        </div>

                        {/* Amount & Arrow Direction */}
                        <div className="settle-direction">
                          <span className="settle-amount-tag">{money(s.amount)}</span>
                          <div className="settle-arrow-wrap">
                            <span className="settle-arrow-line" />
                            <ArrowRight size={15} className="settle-arrow-head" />
                          </div>
                          <span className="settle-owes-label">owes</span>
                        </div>

                        {/* Creditor */}
                        <div className="settle-party">
                          <div className="settle-avatar creditor" title={s.toUserName}>
                            {initials(s.toUserName)}
                          </div>
                          <span className="settle-party-name">{s.toUserName}</span>
                        </div>
                      </div>

                      {/* Card Footer: Pending Badge & Action Buttons */}
                      <div className="settle-card-footer">
                        <span className="settle-status-badge">
                          <span className="settle-status-dot" /> Pending
                        </span>
                        <div className="settle-action-buttons">
                          <button
                            className="outline-button settle-btn-remind"
                            onClick={() => openReminderModal(s)}
                            title={`Remind ${s.fromUserName}`}
                          >
                            <Send size={13} /> Remind
                          </button>
                          <button
                            className="primary-button small settle-btn-pay"
                            onClick={() => openPayModal(s)}
                            disabled={processingSettlementId === s.id}
                          >
                            <CreditCard size={13} /> Pay
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-inline">
                  <Check size={18} />
                  <span>No pending settlements.</span>
                </div>
              )}
            </section>

            <section className="panel history-panel">
              <div className="section-head">
                <div>
                  <span className="kicker">All caught up</span>
                  <h3>Payment history</h3>
                </div>
              </div>
              {paymentHistory.length ? (
                <div className="history-list">
                  {paymentHistory.map(h => (
                    <div className="history-item" key={h.id}>
                      <div className="history-check">
                        <Check size={14} />
                      </div>
                      <div className="history-copy">
                        <b>
                          {h.fromUserName} paid {h.toUserName}
                        </b>
                        <small>
                          {new Date(h.paidAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </small>
                      </div>
                      <strong className="history-amount">{money(h.amount)}</strong>
                      <button
                        className="icon-subtle-btn"
                        title="Mark unpaid"
                        onClick={() => handleMarkUnpaid(h.settlementId || h.id)}
                        disabled={processingSettlementId === (h.settlementId || h.id)}
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-inline">
                  <Check size={18} />
                  <span>No payment history yet.</span>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
            <span><Check size={15} /></span>
            {toast}
          </motion.div>
        )}

        {modal === 'expense' && (
          <Modal title={editingExpenseId ? 'Edit expense' : 'Add an expense'} onClose={() => setModal(null)}>
            <form onSubmit={handleSaveExpense}>
              <p className="modal-subtitle">Anyone in the group can pay or record expenses for any member.</p>
              <label className="field-label">
                What was it for?
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dinner at the beach" />
              </label>
              <div className="form-row">
                <label className="field-label">
                  Amount
                  <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="₹ 0.00" />
                </label>
                <label className="field-label">
                  Category
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    <option>Food</option>
                    <option>Travel</option>
                    <option>Hotel</option>
                    <option>Transport</option>
                    <option>Shopping</option>
                    <option>Groceries</option>
                    <option>Entertainment</option>
                    <option>Bills</option>
                    <option>Other</option>
                  </select>
                </label>
              </div>
              <div className="field-block">
                <div className="field-title">Paid by (Member who paid)</div>
                <select className="select-clean" value={payer} onChange={e => setPayer(e.target.value)}>
                  {members.map(m => {
                    const mid = m.userId || m.id
                    return (
                      <option key={mid} value={mid}>
                        {m.name} {(mid === user.id || m.name.toLowerCase() === user.name.toLowerCase()) ? '(You)' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="split-heading">
                <span className="field-label">Split between</span>
                <span className="split-pill"><Check size={13} /> Equal split</span>
              </div>
              <div className="participant-list">
                {members.map(m => {
                  const mid = m.userId || m.id
                  return (
                    <label key={mid}>
                      <input
                        type="checkbox"
                        checked={isParticipantChecked(m)}
                        onChange={() => toggleParticipant(m)}
                      />
                      <span className="mini-avatar">{initials(m.name)}</span>
                      {m.name} {(mid === user.id || m.name.toLowerCase() === user.name.toLowerCase()) ? '(You)' : ''}
                    </label>
                  )
                })}
              </div>
              <button className="primary-button full" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingExpenseId ? 'Save changes' : 'Add expense'} <ArrowRight size={16} />
              </button>
            </form>
          </Modal>
        )}

        {modal === 'pay' && activeSettlement && (
          <Modal title={`Settle with ${activeSettlement.toUserName}`} onClose={() => setModal(null)}>
            <div className="pay-amount">
              {money(activeSettlement.amount)}
              <small>from {activeSettlement.fromUserName} to {activeSettlement.toUserName}</small>
            </div>
            {loadingPayee ? (
              <p className="modal-subtitle">Loading payee details...</p>
            ) : (
              <div className="payment-options">
                {payeeDetails?.mobile && (
                  <button
                    onClick={async () => {
                      await navigator.clipboard?.writeText(payeeDetails.mobile)
                      notify('Mobile number copied')
                    }}
                  >
                    <div className="option-icon blue-bg"><CreditCard size={16} /></div>
                    <div>
                      <b>UPI / PhonePe / GPay</b>
                      <small>{payeeDetails.mobile}</small>
                    </div>
                    <Copy size={14} />
                  </button>
                )}
                {payeeDetails?.qrImage && (
                  <div className="qr-preview-box">
                    <img
                      src={payeeDetails.qrImage.startsWith('http') ? payeeDetails.qrImage : `${API_URL.replace(/\/api$/, '')}${payeeDetails.qrImage}`}
                      alt="Payee QR"
                    />
                  </div>
                )}
                {payeeDetails?.acceptsCash && (
                  <div className="cash-option">
                    <div className="option-icon green-bg"><Check size={16} /></div>
                    <div>
                      <b>Cash Payment</b>
                      <small>{activeSettlement.toUserName} accepts cash in person</small>
                    </div>
                  </div>
                )}
                {!payeeDetails?.mobile && !payeeDetails?.qrImage && !payeeDetails?.acceptsCash && (
                  <p className="modal-subtitle" style={{ margin: '14px 0' }}>
                    {activeSettlement.toUserName} hasn’t configured custom payment details yet. Settle directly or record the transaction below.
                  </p>
                )}
              </div>
            )}
            <button
              className="primary-button full"
              onClick={() => handleMarkPaid(activeSettlement.id)}
              disabled={processingSettlementId === activeSettlement.id}
            >
              {processingSettlementId === activeSettlement.id ? 'Recording payment...' : 'Mark as Paid'} <Check size={16} />
            </button>
          </Modal>
        )}

        {modal === 'share' && (
          <Modal title={`Share ${group.name}`} onClose={() => setModal(null)}>
            <p className="modal-subtitle">Share the invite code, link, or send directly via WhatsApp.</p>
            <div className="invite-code">
              <span>Invite code</span>
              <b>{code || 'Not available'}</b>
              <button
                onClick={async () => {
                  if (code) {
                    await navigator.clipboard?.writeText(code)
                    notify('Invite code copied')
                  }
                }}
              >
                <Copy size={15} /> Copy code
              </button>
            </div>
            <label className="field-label">
              Share link
              <input readOnly value={link} />
            </label>
            <div className="share-action-grid">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="whatsapp-button">
                <MessageCircle size={18} /> Share on WhatsApp
              </a>
              <button className="primary-button full" onClick={copy}>
                <Share2 size={16} /> Copy invite link
              </button>
            </div>
          </Modal>
        )}

        {modal === 'reminder' && (
          <Modal title="Send a reminder" onClose={() => setModal(null)}>
            <p className="modal-subtitle">Copy the friendly reminder message to send to your group friend.</p>
            <div className="message-box" style={{ whiteSpace: 'pre-wrap' }}>
              {reminderText}
            </div>
            <button
              className="outline-button full"
              onClick={async () => {
                await navigator.clipboard?.writeText(reminderText)
                notify('Reminder copied to clipboard')
                setModal(null)
              }}
            >
              <Copy size={15} /> Copy reminder message
            </button>
          </Modal>
        )}

        {modal === 'details' && (
          <PaymentDetails
            user={user}
            onClose={() => setModal(null)}
            onSaved={() => {
              setModal(null)
              notify('Payment details saved')
            }}
          />
        )}
      </AnimatePresence>
    </main>
  )
}

function PaymentDetails({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const [mobile, setMobile] = useState('')
  const [cash, setCash] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiUsers
      .getPaymentDetails(user.id)
      .then(d => {
        if (d.mobile) setMobile(d.mobile)
        if (d.acceptsCash !== undefined) setCash(!!d.acceptsCash)
        if (d.qrImage) setQrUrl(d.qrImage)
      })
      .catch(() => undefined)
  }, [user.id])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      if (file && file.size > 300 * 1024) throw new Error('QR image must be 300KB or smaller')
      await apiUsers.updatePaymentDetails(user.id, { mobile, acceptsCash: cash })
      if (file) {
        await apiUsers.uploadQr(user.id, file)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save payment details')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteQr = async () => {
    try {
      await apiUsers.deleteQr(user.id)
      setQrUrl('')
      setFile(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete QR')
    }
  }

  return (
    <Modal title="My payment details" onClose={onClose}>
      <p className="modal-subtitle">Use only mobile number, QR code, or cash.</p>
      <label className="field-label">
        Mobile number
        <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="9876543210" />
      </label>
      <label className="cash-check">
        <input type="checkbox" checked={cash} onChange={e => setCash(e.target.checked)} /> I accept cash payments
      </label>
      <div className="qr-upload">
        <CreditCard size={21} />
        <b>Upload QR code</b>
        <small>PNG, JPG or WebP · max 300KB</small>
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
        {file && <small>{file.name}</small>}
        {qrUrl && !file && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <small>Current QR code active</small>
            <button
              type="button"
              className="icon-subtle-btn"
              onClick={handleDeleteQr}
              title="Delete current QR"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button full" onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save details'} <Check size={16} />
      </button>
    </Modal>
  )
}

function Groups({ user, onNavigate, onOpen }: { user: User; onNavigate: (v: View) => void; onOpen: (id: string) => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadGroups = () => {
    let alive = true
    apiGroups
      .getUserGroups(user.id)
      .then(d => {
        if (alive) setGroups(Array.isArray(d) ? d : [])
      })
      .catch(e => {
        if (alive) setError(e instanceof Error ? e.message : 'Unable to load groups')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }

  useEffect(() => {
    return loadGroups()
  }, [user.id])

  const performDelete = async (g: Group) => {
    const targetId = g.id || (g as any)._id || g.code || g.inviteCode || g.invite_code || ''
    const fallbackCode = g.inviteCode || g.invite_code || g.code || ''
    setDeletingId(targetId)

    try {
      await apiGroups.delete(targetId, user.id, fallbackCode)
      setGroups(prev => prev.filter(item => {
        const itemTarget = item.id || (item as any)._id || item.code || item.inviteCode || item.invite_code || ''
        return itemTarget !== targetId && itemTarget !== fallbackCode && item.id !== g.id
      }))
      notify(`Deleted group "${g.name}"`)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete group')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="app-main">
      <div className="simple-page">
        <div className="page-heading">
          <div>
            <span className="kicker">Welcome, {user.name}</span>
            <h1>Your groups</h1>
            <p>Only groups you actually create or join appear here. Press and hold the delete button to delete.</p>
          </div>
          <button className="primary-button" onClick={() => onNavigate('create')}>
            <Plus size={17} /> Create group
          </button>
        </div>

        {loading && (
          <div className="empty-state">
            <h2>Loading your groups...</h2>
            <p>Fetching your groups from the backend.</p>
          </div>
        )}

        {!loading && error && (
          <div className="empty-state">
            <h2>Couldn’t load groups</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && !groups.length && (
          <div className="empty-state">
            <span className="form-icon">
              <Users size={22} />
            </span>
            <h2>No groups yet</h2>
            <p>Create a group or join one with an invite code. Nothing is pre-populated.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => onNavigate('create')}>
                Create your first group <ArrowRight size={16} />
              </button>
              <button className="outline-button" onClick={() => onNavigate('join')}>
                Join a group
              </button>
            </div>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="group-grid">
            {groups.map((g, i) => {
              const cachedCount = typeof window !== 'undefined' ? (() => {
                try {
                  const raw = localStorage.getItem(`fin_members_${g.id || g.code}`)
                  return raw ? JSON.parse(raw).length : 0
                } catch { return 0 }
              })() : 0
              const count = Math.max((g.members || []).length, g.memberCount || 0, cachedCount)
              const targetId = g.id || g.code || ''
              const isDeleting = deletingId === targetId
              return (
                <motion.div
                  className="group-card"
                  key={g.id || targetId}
                  onClick={() => onOpen(targetId)}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="group-card-art">
                    <span>{initials(g.name)}</span>
                    <div className="group-card-actions" onClick={e => e.stopPropagation()}>
                      <HoldButton
                        doneLabel="Deleted"
                        backgroundColor="#27272a"
                        fillColor="#ff2746"
                        textColor="#f5f5f5"
                        fillTextColor="#ffffff"
                        size="md"
                        radius={14}
                        fillDirection="right"
                        holdTime={2000}
                        releaseTime={200}
                        pressScale={0.97}
                        wave
                        waveAmplitude={6}
                        glow
                        resetAfter={1200}
                        disabled={isDeleting}
                        onHold={() => {
                          console.log('confirmed')
                          performDelete(g)
                        }}
                        icon={<Trash2 size={15} />}
                        className="card-hold-delete-btn"
                      >
                        Hold to delete
                      </HoldButton>
                    </div>
                  </div>
                  <div className="group-card-body">
                    <div className="group-card-title">
                      <b>{g.name}</b>
                      <span className="members-badge">
                        <Users size={11} /> {count}
                      </span>
                    </div>
                    <small>{count} {count === 1 ? 'member' : 'members'}</small>
                    <div className="group-card-foot">
                      <span className="settled">Open group</span>
                      <span>{inviteCode(g)}</span>
                    </div>
                    {g.description && <small className="activity">{g.description}</small>}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
            <span><Check size={15} /></span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

function Create({ user, onNavigate, onCreated }: { user: User; onNavigate: (v: View) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [member, setMember] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<Group | null>(null)

  const add = () => {
    if (member.trim()) {
      const newName = member.trim()
      if (!members.includes(newName)) {
        setMembers(x => [...x, newName])
      }
      setMember('')
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Group name is required')
    setSaving(true)
    setError('')

    let allMembers = [...members]
    if (member.trim() && !allMembers.includes(member.trim())) {
      allMembers.push(member.trim())
    }

    try {
      const g = await apiGroups.create({
        name: name.trim(),
        description: description.trim(),
        createdBy: user.id,
        creatorName: user.name,
        members: allMembers.map(mName => ({ name: mName }))
      })
      setCreated(g)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create group')
    } finally {
      setSaving(false)
    }
  }

  if (created) {
    const code = inviteCode(created)
    const link = code ? `${window.location.origin}?join=${encodeURIComponent(code)}` : ''
    return (
      <main className="app-main">
        <div className="form-page">
          <div className="success-card">
            <span className="success-icon">
              <Check size={27} />
            </span>
            <span className="kicker">It’s official</span>
            <h1>Group created!</h1>
            <p>{created.name} is now stored in fin.</p>
            <div className="code-card">
              <small>Invite code</small>
              <b>{code || 'Unavailable'}</b>
              <button className="outline-button" onClick={() => navigator.clipboard?.writeText(link || code)}>
                <Copy size={15} /> Copy link
              </button>
            </div>
            <button className="primary-button full" onClick={() => onCreated(created.id || created.code || '')}>
              Open group <ArrowRight size={16} />
            </button>
            <button className="text-button centered" onClick={() => onNavigate('groups')}>
              See all groups
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="app-main">
      <div className="form-page">
        <button className="back-link" onClick={() => onNavigate('home')}>
          <ArrowDownLeft size={16} /> Back home
        </button>
        <div className="form-heading">
          <span className="form-icon">
            <Users size={22} />
          </span>
          <span className="kicker">New beginnings</span>
          <h1>Create a group</h1>
          <p>Nothing is saved until you click Create group.</p>
        </div>
        <form className="create-form" onSubmit={submit}>
          <label className="field-label">
            Group name
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Goa Trip" />
          </label>
          <label className="field-label">
            Description <span className="optional">optional</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What are you planning together?"
              rows={3}
            />
          </label>
          <div className="field-label">
            Members <span className="optional">Add members so anyone can split expenses</span>
            <div className="add-member-input">
              <input
                value={member}
                onChange={e => setMember(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    add()
                  }
                }}
                placeholder="Member name (press Enter or Add)"
              />
              <button type="button" className="outline-button" onClick={add}>
                <Plus size={15} /> Add
              </button>
            </div>
          </div>
          <div className="added-members">
            <div className="creator-pill">
              <span className="mini-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              {user.name} <span className="you-tag">Creator</span>
            </div>
            {members.map((m, i) => (
              <div key={`${m}-${i}`}>
                <span className="mini-avatar">{m.slice(0, 1).toUpperCase()}</span>
                {m}
                <button type="button" onClick={() => setMembers(x => x.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button full" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create group'} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </main>
  )
}

function Join({ user, onNavigate, onJoined }: { user: User; onNavigate: (v: View) => void; onJoined: (id: string) => void }) {
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('join')
    if (value) setCode(value)
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return setError('Enter an invite code')
    setSaving(true)
    setError('')
    try {
      const g = await apiGroups.join(code.trim(), user.id, user.name)
      onJoined(g.id || g.code || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join group')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="app-main">
      <div className="form-page">
        <button className="back-link" onClick={() => onNavigate('home')}>
          <ArrowDownLeft size={16} /> Back home
        </button>
        <div className="form-heading">
          <span className="form-icon">
            <Share2 size={22} />
          </span>
          <span className="kicker">Got an invite?</span>
          <h1>Join a group</h1>
          <p>Enter the invite code shared by your friend.</p>
        </div>
        <form className="create-form" onSubmit={submit}>
          <label className="field-label">
            Invite code
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="e.g. FIN-AB12CD"
              autoCapitalize="characters"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button full" type="submit" disabled={saving}>
            {saving ? 'Joining...' : 'Join group'} <ArrowRight size={16} />
          </button>
          <button type="button" className="outline-button full" onClick={() => onNavigate('groups')}>
            View my existing groups
          </button>
        </form>
      </div>
    </main>
  )
}

function UserSetup({ onReady }: { onReady: (u: User) => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Please enter your name')
    setSaving(true)
    setError('')
    try {
      const u = await apiUsers.create(name.trim())
      localStorage.setItem(USER_KEY, JSON.stringify(u))
      onReady(u)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create your profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="app-main">
      <div className="form-page">
        <div className="form-heading">
          <span className="form-icon">
            <Users size={22} />
          </span>
          <span className="kicker">First time here?</span>
          <h1>What should we call you?</h1>
          <p>Enter your name. fin will use it when you create or join groups.</p>
        </div>
        <form className="create-form" onSubmit={submit}>
          <label className="field-label">
            Your name
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" autoFocus />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button full" type="submit" disabled={saving}>
            {saving ? 'Setting up...' : 'Continue'} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </main>
  )
}

export default function Page() {
  const [view, setView] = useState<View>('home')
  const [dark, setDark] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [groupId, setGroupId] = useState('')

  useEffect(() => {
    let alive = true
    const initUser = async () => {
      try {
        const raw = localStorage.getItem(USER_KEY)
        if (raw) {
          const u = JSON.parse(raw) as User
          if (u.id && u.name) {
            // Validate user against backend
            try {
              const verified = await apiUsers.get(u.id)
              if (alive && verified && verified.id) {
                setUser({ ...u, ...verified })
                return
              }
            } catch {
              // Stale user in localStorage, clear it
              localStorage.removeItem(USER_KEY)
            }
          }
        }
      } catch {
        localStorage.removeItem(USER_KEY)
      } finally {
        if (alive) setChecking(false)
      }
    }
    initUser()
    return () => {
      alive = false
    }
  }, [])

  const open = (id: string) => {
    setGroupId(id)
    setView('dashboard')
  }

  if (checking) return <div className={dark ? 'fin-app dark-mode' : 'fin-app'} />

  if (!user) {
    return (
      <div className={dark ? 'fin-app dark-mode' : 'fin-app'}>
        <Nav onNavigate={() => undefined} onTheme={() => setDark(x => !x)} />
        <UserSetup onReady={setUser} />
      </div>
    )
  }

  return (
    <div className={dark ? 'fin-app dark-mode' : 'fin-app'}>
      <Nav onNavigate={setView} onTheme={() => setDark(x => !x)} />
      {view === 'home' && <Home onNavigate={setView} />}
      {view === 'groups' && <Groups user={user} onNavigate={setView} onOpen={open} />}
      {view === 'create' && <Create user={user} onNavigate={setView} onCreated={open} />}
      {view === 'join' && <Join user={user} onNavigate={setView} onJoined={open} />}
      {view === 'dashboard' && groupId && <Dashboard groupId={groupId} user={user} onNavigate={setView} />}
    </div>
  )
}
