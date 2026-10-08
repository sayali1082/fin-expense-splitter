import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users, Receipt, Wallet, Clock, Plus, Share2, Copy, Link,
  MessageCircle, ChevronDown, X, Trash2, Edit3, Eye, ArrowDownCircle,
  Phone, QrCode, Banknote, CheckCircle, Send, AlertCircle, Upload,
  Utensils, Plane, Building, Bus, ShoppingBag, ShoppingCart, Film, FileText, MoreHorizontal
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../hooks/useToast';
import { groupsApi } from '../../api/groups';
import { expensesApi } from '../../api/expenses';
import { settlementsApi } from '../../api/settlements';
import { usersApi } from '../../api/users';
import client from '../../api/client';
import { formatCurrency, formatSignedCurrency, maskMobile } from '../../utils/currency';
import { getShareUrl, copyToClipboard, shareWhatsApp } from '../../utils/share';
import { validateAmount, validateExpenseDescription, validateSplitExact, validateSplitPercentage, validateMobile, validateQRFile } from '../../utils/validation';
import Avatar from '../../components/Avatar/Avatar';
import Modal from '../../components/Modal/Modal';
import LoadingSkeleton from '../../components/LoadingSkeleton/LoadingSkeleton';
import EmptyState from '../../components/EmptyState/EmptyState';
import ErrorState from '../../components/ErrorState/ErrorState';
import type { Group, GroupMember, Expense, Balance, Settlement, PaymentHistoryItem, SplitMethod, ExpenseCategory } from '../../types';
import { EXPENSE_CATEGORIES, SPLIT_METHODS } from '../../types';

const categoryIcons: Record<string, React.ReactNode> = {
  Food: <Utensils size={14} />, Travel: <Plane size={14} />, Hotel: <Building size={14} />,
  Transport: <Bus size={14} />, Shopping: <ShoppingBag size={14} />, Groceries: <ShoppingCart size={14} />,
  Entertainment: <Film size={14} />, Bills: <FileText size={14} />, Other: <MoreHorizontal size={14} />,
};

export default function GroupDashboardPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useUser();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Data
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Viewing as
  const [viewingAs, setViewingAs] = useState<string>('');

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Settlement | null>(null);
  const [showQRViewer, setShowQRViewer] = useState<string>('');
  const [showConfirmPay, setShowConfirmPay] = useState<Settlement | null>(null);
  const [showReminderModal, setShowReminderModal] = useState<any>(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState<Expense | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Add member
  const [newMemberName, setNewMemberName] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Expense form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidBy, setExpPaidBy] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Other');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expSplitMethod, setExpSplitMethod] = useState<SplitMethod>('equal');
  const [expParticipants, setExpParticipants] = useState<Record<string, boolean>>({});
  const [expExactAmounts, setExpExactAmounts] = useState<Record<string, string>>({});
  const [expPercentages, setExpPercentages] = useState<Record<string, string>>({});
  const [expShares, setExpShares] = useState<Record<string, string>>({});
  const [expErrors, setExpErrors] = useState<Record<string, string>>({});
  const [addingExpense, setAddingExpense] = useState(false);

  // Payment details
  const [pdMobile, setPdMobile] = useState('');
  const [pdCash, setPdCash] = useState(false);
  const [pdQR, setPdQR] = useState('');
  const [pdSaving, setPdSaving] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(false);
    try {
      const [gRes, eRes, bRes, sRes, phRes] = await Promise.all([
        groupsApi.get(groupId),
        expensesApi.getAll(groupId),
        client.get(`/groups/${groupId}/balances`),
        settlementsApi.getAll(groupId),
        settlementsApi.getPaymentHistory(groupId),
      ]);
      setGroup(gRes.data);
      setExpenses(eRes.data);
      setBalances(bRes.data);
      setSettlements(sRes.data);
      setPaymentHistory(phRes.data);

      if (!viewingAs && user) {
        setViewingAs(user.id);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [groupId, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Load payment details when viewing as changes
  useEffect(() => {
    if (viewingAs) {
      usersApi.getPaymentDetails(viewingAs)
        .then(res => {
          setPdMobile(res.data.mobile || '');
          setPdCash(res.data.acceptsCash || false);
          setPdQR(res.data.qrImage || '');
        })
        .catch(() => {});
    }
  }, [viewingAs]);

  // Init expense participants when group loads
  useEffect(() => {
    if (group) {
      const p: Record<string, boolean> = {};
      group.members.forEach(m => { p[m.userId] = true; });
      setExpParticipants(p);
      if (!expPaidBy && user) {
        const me = group.members.find(m => m.userId === user.id);
        setExpPaidBy(me?.userId || group.members[0]?.userId || '');
      }
    }
  }, [group]);

  const members = group?.members || [];
  const inviteCode = group?.invite_code || group?.inviteCode || '';
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const myBalance = balances.find(b => b.userId === viewingAs)?.amount || 0;
  const pendingCount = settlements.filter(s => s.status === 'pending').length;

  // ===== HANDLERS =====
  const handleAddMember = async () => {
    if (!newMemberName.trim() || !groupId) return;
    setAddingMember(true);
    try {
      await groupsApi.addMember(groupId, newMemberName.trim());
      showToast('Member added.');
      setNewMemberName('');
      setShowAddMember(false);
      fetchAll();
    } catch {
      showToast('Failed to add member.', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!groupId) return;
    try {
      await groupsApi.removeMember(groupId, userId);
      showToast('Member removed.');
      fetchAll();
    } catch {
      showToast('Failed to remove member.', 'error');
    }
  };

  const resetExpenseForm = () => {
    setExpDesc('');
    setExpAmount('');
    setExpPaidBy(user?.id || members[0]?.userId || '');
    setExpCategory('Other');
    setExpDate(new Date().toISOString().split('T')[0]);
    setExpSplitMethod('equal');
    const p: Record<string, boolean> = {};
    members.forEach(m => { p[m.userId] = true; });
    setExpParticipants(p);
    setExpExactAmounts({});
    setExpPercentages({});
    setExpShares({});
    setExpErrors({});
    setEditingExpense(null);
  };

  const openExpenseModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpDesc(expense.description);
      setExpAmount(expense.amount.toString());
      setExpPaidBy(expense.paidBy);
      setExpCategory(expense.category as ExpenseCategory);
      setExpDate(expense.date);
      setExpSplitMethod(expense.splitMethod);
      const p: Record<string, boolean> = {};
      members.forEach(m => { p[m.userId] = false; });
      expense.participants.forEach(pp => { p[pp.userId] = true; });
      setExpParticipants(p);
    } else {
      resetExpenseForm();
    }
    setShowExpenseModal(true);
  };

  const handleAddExpense = async () => {
    const errors: Record<string, string> = {};
    const descErr = validateExpenseDescription(expDesc);
    if (descErr) errors.desc = descErr;
    const amtErr = validateAmount(expAmount);
    if (amtErr) errors.amount = amtErr;

    const selectedParticipants = members.filter(m => expParticipants[m.userId]);
    if (selectedParticipants.length === 0) errors.participants = 'Select at least one participant';

    const amount = parseFloat(expAmount);

    if (expSplitMethod === 'exact') {
      const amounts = selectedParticipants.map(p => parseFloat(expExactAmounts[p.userId] || '0'));
      const err = validateSplitExact(amounts, amount);
      if (err) errors.split = err;
    }
    if (expSplitMethod === 'percentage') {
      const pcts = selectedParticipants.map(p => parseFloat(expPercentages[p.userId] || '0'));
      const err = validateSplitPercentage(pcts);
      if (err) errors.split = err;
    }

    if (Object.keys(errors).length > 0) {
      setExpErrors(errors);
      return;
    }

    setAddingExpense(true);
    try {
      const participants = selectedParticipants.map(m => ({
        userId: m.userId,
        name: m.name,
        amount: expSplitMethod === 'exact' ? parseFloat(expExactAmounts[m.userId] || '0') : undefined,
        percentage: expSplitMethod === 'percentage' ? parseFloat(expPercentages[m.userId] || '0') : undefined,
        shares: expSplitMethod === 'shares' ? parseInt(expShares[m.userId] || '1') : undefined,
      }));

      if (editingExpense) {
        await expensesApi.update(editingExpense.id, {
          description: expDesc,
          amount,
          paidBy: expPaidBy,
          category: expCategory,
          date: expDate,
          splitMethod: expSplitMethod,
          participants,
        });
        showToast('Expense updated.');
      } else {
        await expensesApi.create(groupId!, {
          description: expDesc,
          amount,
          paidBy: expPaidBy,
          category: expCategory,
          date: expDate,
          splitMethod: expSplitMethod,
          participants,
        });
        showToast('Expense added!');
      }
      setShowExpenseModal(false);
      resetExpenseForm();
      fetchAll();
    } catch {
      showToast('Failed to save expense.', 'error');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await expensesApi.delete(expenseId);
      showToast('Expense deleted.');
      setShowExpenseDetail(null);
      fetchAll();
    } catch {
      showToast('Failed to delete expense.', 'error');
    }
  };

  const handleMarkPaid = async (settlement: Settlement) => {
    try {
      await settlementsApi.markPaid(settlement.id);
      showToast('Payment marked as paid.');
      setShowConfirmPay(null);
      setShowPaymentModal(null);
      fetchAll();
    } catch {
      showToast('Failed to mark payment.', 'error');
    }
  };

  const handleSendReminder = async (settlement: Settlement) => {
    try {
      const res = await settlementsApi.sendReminder(settlement.id);
      setShowReminderModal(res.data);
    } catch {
      showToast('Failed to generate reminder.', 'error');
    }
  };

  const handleSavePaymentDetails = async () => {
    if (!viewingAs) return;
    const mobileErr = validateMobile(pdMobile);
    if (mobileErr) { showToast(mobileErr, 'warning'); return; }
    setPdSaving(true);
    try {
      await usersApi.updatePaymentDetails(viewingAs, { mobile: pdMobile, acceptsCash: pdCash });
      showToast('Payment details saved.');
    } catch {
      showToast('Failed to save.', 'error');
    } finally {
      setPdSaving(false);
    }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewingAs) return;
    const err = validateQRFile(file);
    if (err) { showToast(err, 'error'); return; }
    setUploadingQR(true);
    try {
      const res = await usersApi.uploadQR(viewingAs, file);
      setPdQR(res.data.qrImage);
      showToast('QR uploaded.');
    } catch {
      showToast('Failed to upload QR.', 'error');
    } finally {
      setUploadingQR(false);
    }
  };

  const handleDeleteQR = async () => {
    if (!viewingAs) return;
    try {
      await usersApi.deleteQR(viewingAs);
      setPdQR('');
      showToast('QR removed.');
    } catch {
      showToast('Failed to remove QR.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-6">
        <LoadingSkeleton type="card" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <LoadingSkeleton key={i} type="card" />)}
        </div>
        <div className="space-y-3">
          {[1,2,3].map(i => <LoadingSkeleton key={i} type="expense" />)}
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        <ErrorState message="Could not load group." onRetry={fetchAll} />
      </div>
    );
  }

  const selectedParticipants = members.filter(m => expParticipants[m.userId]);
  const expAmountNum = parseFloat(expAmount) || 0;

  // Exact split validation
  const exactTotal = selectedParticipants.reduce((s, p) => s + (parseFloat(expExactAmounts[p.userId] || '0')), 0);
  const percentageTotal = selectedParticipants.reduce((s, p) => s + (parseFloat(expPercentages[p.userId] || '0')), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/groups')} className="p-2 rounded-xl hover:bg-[#E7E7E2] dark:hover:bg-[#2A2C29] transition-colors" aria-label="Back">
            <ArrowLeft size={20} className="text-[#555] dark:text-[#A5AAA4]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#111] dark:text-[#F5F5F2] tracking-[-0.5px]">{group.name}</h1>
            <p className="text-xs text-[#777] dark:text-[#A5AAA4]">{members.length} members</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowShareMenu(true)} className="p-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] hover:bg-[#E7E7E2]/50 dark:hover:bg-[#2A2C29]/50 transition-colors" aria-label="Share">
            <Share2 size={16} className="text-[#555] dark:text-[#A5AAA4]" />
          </button>
          <button
            onClick={async () => { await copyToClipboard(getShareUrl(inviteCode)); showToast('Link copied!'); }}
            className="p-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] hover:bg-[#E7E7E2]/50 dark:hover:bg-[#2A2C29]/50 transition-colors" aria-label="Copy link"
          >
            <Link size={16} className="text-[#555] dark:text-[#A5AAA4]" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total Spent', value: formatCurrency(totalSpent), icon: <Receipt size={16} />, color: 'text-[#4F82B2]' },
          { label: 'Members', value: members.length.toString(), icon: <Users size={16} />, color: 'text-[#555] dark:text-[#A5AAA4]' },
          { label: 'Your Balance', value: formatSignedCurrency(myBalance), icon: <Wallet size={16} />, color: myBalance > 0 ? 'text-[#22A06B]' : myBalance < 0 ? 'text-[#E05252]' : 'text-[#777]' },
          { label: 'Pending', value: pendingCount.toString(), icon: <Clock size={16} />, color: pendingCount > 0 ? 'text-[#D99A25]' : 'text-[#777]' },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-[#1B1D1A] rounded-2xl border border-[#E7E7E2] dark:border-[#2A2C29] p-4">
            <div className={`flex items-center gap-2 text-xs text-[#777] dark:text-[#A5AAA4] mb-1`}>
              {card.icon} {card.label}
            </div>
            <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Viewing as */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white dark:bg-[#1B1D1A] rounded-2xl border border-[#E7E7E2] dark:border-[#2A2C29] p-4">
        <span className="text-xs text-[#777] dark:text-[#A5AAA4] font-medium">Viewing as:</span>
        <select
          value={viewingAs}
          onChange={e => setViewingAs(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-sm text-[#111] dark:text-[#F5F5F2] outline-none"
        >
          {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
        <button onClick={() => setShowPaymentDetails(true)} className="ml-auto text-xs font-medium text-[#4F82B2] dark:text-[#6FA5D6] hover:underline">My Payment Details</button>
      </div>

      {/* Add Expense Button */}
      <div className="mb-6">
        <button onClick={() => openExpenseModal()} className="flex items-center gap-2 px-5 py-3 bg-[#5C8FBE] hover:bg-[#4F82B2] text-white rounded-xl text-sm font-semibold shadow-lg shadow-[#5C8FBE]/20 hover:-translate-y-[1px] active:scale-[0.97] transition-all">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Balances */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-[#111] dark:text-[#F5F5F2] mb-3">Balances</h2>
        {balances.length === 0 ? (
          <EmptyState title="No balances yet" subtitle="Add an expense to see balances." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b, i) => (
              <motion.div key={b.userId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#1B1D1A] border border-[#E7E7E2] dark:border-[#2A2C29]">
                <Avatar name={b.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111] dark:text-[#F5F5F2] truncate">{b.name}</p>
                  <p className="text-xs text-[#777] dark:text-[#A5AAA4]">
                    {b.amount > 0 ? 'You receive' : b.amount < 0 ? 'You owe' : 'Settled'}
                  </p>
                </div>
                <p className={`text-sm font-bold ${b.amount > 0 ? 'text-[#22A06B]' : b.amount < 0 ? 'text-[#E05252]' : 'text-[#777]'}`}>
                  {b.amount === 0 ? '₹0' : formatSignedCurrency(b.amount)}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Settlements */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-[#111] dark:text-[#F5F5F2] mb-3">Settle Up</h2>
        {settlements.filter(s => s.status === 'pending').length === 0 ? (
          <EmptyState title="You're all settled up 🎉" />
        ) : (
          <div className="space-y-3">
            {settlements.filter(s => s.status === 'pending').map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-[#1B1D1A] rounded-2xl border border-[#E7E7E2] dark:border-[#2A2C29] p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={s.fromUserName} size="sm" />
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-xs text-[#777] dark:text-[#A5AAA4]">{s.fromUserName}</span>
                    <ArrowDownCircle size={16} className="text-[#D99A25] my-1" />
                    <span className="text-base font-bold text-[#111] dark:text-[#F5F5F2]">{formatCurrency(s.amount)}</span>
                    <ArrowDownCircle size={16} className="text-[#D99A25] my-1" />
                    <span className="text-xs text-[#777] dark:text-[#A5AAA4]">{s.toUserName}</span>
                  </div>
                  <Avatar name={s.toUserName} size="sm" />
                </div>
                <div className="flex items-center gap-2 justify-between">
                  <span className="text-xs font-medium text-[#D99A25] bg-[#FFF6DF] dark:bg-[#3a3019] px-2.5 py-1 rounded-full">Pending</span>
                  <div className="flex gap-2">
                    <button onClick={() => setShowPaymentModal(s)} className="px-4 py-2 text-xs font-medium bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] rounded-lg hover:-translate-y-[1px] transition-all">Pay</button>
                    <button onClick={() => handleSendReminder(s)} className="px-4 py-2 text-xs font-medium border border-[#E7E7E2] dark:border-[#2A2C29] rounded-lg hover:bg-[#E7E7E2]/50 dark:hover:bg-[#2A2C29]/50 transition-all text-[#555] dark:text-[#A5AAA4]">
                      <Send size={12} className="inline mr-1" /> Remind
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Expenses */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-[#111] dark:text-[#F5F5F2] mb-3">Expenses</h2>
        {expenses.length === 0 ? (
          <EmptyState title="No expenses yet." subtitle="Add your first expense." action={
            <button onClick={() => openExpenseModal()} className="px-5 py-2.5 bg-[#5C8FBE] text-white rounded-xl text-sm font-semibold hover:-translate-y-[1px] transition-all">
              <Plus size={14} className="inline mr-1" /> Add Expense
            </button>
          } />
        ) : (
          <div className="space-y-3">
            {expenses.map((exp, i) => (
              <motion.div key={exp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-white dark:bg-[#1B1D1A] rounded-2xl border border-[#E7E7E2] dark:border-[#2A2C29] p-4 hover:-translate-y-[1px] hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-base font-semibold text-[#111] dark:text-[#F5F5F2]">{exp.description}</h4>
                    <p className="text-xs text-[#777] dark:text-[#A5AAA4] mt-0.5">Paid by {exp.paidByName || 'Unknown'}</p>
                  </div>
                  <p className="text-lg font-bold text-[#111] dark:text-[#F5F5F2]">{formatCurrency(exp.amount)}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#777] dark:text-[#A5AAA4] mb-3">
                  <span className="flex items-center gap-1">{categoryIcons[exp.category] || categoryIcons.Other} {exp.category}</span>
                  <span>{new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span>Split {exp.splitMethod} between {exp.participants.length} people</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowExpenseDetail(exp)} className="px-3 py-1.5 text-xs font-medium border border-[#E7E7E2] dark:border-[#2A2C29] rounded-lg hover:bg-[#E7E7E2]/50 transition-colors text-[#555] dark:text-[#A5AAA4]">
                    <Eye size={12} className="inline mr-1" /> View
                  </button>
                  <button onClick={() => openExpenseModal(exp)} className="px-3 py-1.5 text-xs font-medium border border-[#E7E7E2] dark:border-[#2A2C29] rounded-lg hover:bg-[#E7E7E2]/50 transition-colors text-[#555] dark:text-[#A5AAA4]">
                    <Edit3 size={12} className="inline mr-1" /> Edit
                  </button>
                  <button onClick={() => handleDeleteExpense(exp.id)} className="px-3 py-1.5 text-xs font-medium border border-[#FDEEEE] dark:border-[#3a1a1a] text-[#E05252] rounded-lg hover:bg-[#FDEEEE] dark:hover:bg-[#3a1a1a] transition-colors">
                    <Trash2 size={12} className="inline mr-1" /> Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Members */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-[#111] dark:text-[#F5F5F2]">Members</h2>
          <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1 text-xs font-medium text-[#4F82B2] dark:text-[#6FA5D6] hover:underline">
            <Plus size={14} /> Add Member
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m, i) => {
            const balance = balances.find(b => b.userId === m.userId)?.amount || 0;
            return (
              <motion.div key={m.userId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#1B1D1A] border border-[#E7E7E2] dark:border-[#2A2C29]">
                <Avatar name={m.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111] dark:text-[#F5F5F2] truncate">{m.name}</p>
                  <p className="text-xs text-[#777] dark:text-[#A5AAA4]">{balance > 0 ? 'You receive' : balance < 0 ? 'You owe' : 'Settled'}</p>
                </div>
                <p className={`text-sm font-bold ${balance > 0 ? 'text-[#22A06B]' : balance < 0 ? 'text-[#E05252]' : 'text-[#777]'}`}>
                  {balance === 0 ? '₹0' : formatSignedCurrency(balance)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Payment History */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-[#111] dark:text-[#F5F5F2] mb-3">Payment History</h2>
        {paymentHistory.length === 0 ? (
          <EmptyState title="No payments yet" subtitle="Payments will appear here once marked." />
        ) : (
          <div className="space-y-2">
            {paymentHistory.map((ph, i) => (
              <motion.div key={ph.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#1B1D1A] border border-[#E7E7E2] dark:border-[#2A2C29]">
                <CheckCircle size={16} className="text-[#22A06B] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#111] dark:text-[#F5F5F2]">
                    <span className="font-medium">{ph.fromUserName}</span> paid <span className="font-bold">{formatCurrency(ph.amount)}</span> to <span className="font-medium">{ph.toUserName}</span>
                  </p>
                  <p className="text-xs text-[#777] dark:text-[#A5AAA4]">{new Date(ph.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ===== MODALS ===== */}

      {/* Add Member Modal */}
      <Modal isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Add member">
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Name</label>
            <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMember()} placeholder="Enter name" autoFocus className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none focus:border-[#4F82B2] transition-all" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAddMember(false)} className="flex-1 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] text-sm font-medium text-[#555] dark:text-[#A5AAA4] hover:bg-[#E7E7E2]/50 transition-all">Cancel</button>
            <button onClick={handleAddMember} disabled={addingMember || !newMemberName.trim()} className="flex-1 py-3 rounded-xl bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] text-sm font-semibold disabled:opacity-50 transition-all">{addingMember ? 'Adding...' : 'Add Member'}</button>
          </div>
        </div>
      </Modal>

      {/* Share Menu Modal */}
      <Modal isOpen={showShareMenu} onClose={() => setShowShareMenu(false)} title="Share group">
        <div className="space-y-4 pt-2">
          <div className="bg-[#F1EDE0] dark:bg-[#2A2C29] rounded-xl p-4">
            <p className="text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1">{group.name}</p>
            <p className="text-xs text-[#777] dark:text-[#A5AAA4] font-mono">{inviteCode}</p>
            <p className="text-xs text-[#777] dark:text-[#A5AAA4] mt-1 break-all">{getShareUrl(inviteCode)}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => { await copyToClipboard(getShareUrl(inviteCode)); showToast('Link copied!'); setShowShareMenu(false); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] text-sm font-medium hover:bg-[#E7E7E2]/50 transition-all text-[#111] dark:text-[#F5F5F2]"
            >
              <Copy size={14} /> Copy Link
            </button>
            <button
              onClick={() => { shareWhatsApp(`Join my group "${group.name}" on fin! ${getShareUrl(inviteCode)}`); setShowShareMenu(false); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white text-sm font-medium hover:-translate-y-[1px] transition-all"
            >
              <MessageCircle size={14} /> WhatsApp
            </button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Expense Modal */}
      <Modal isOpen={showExpenseModal} onClose={() => { setShowExpenseModal(false); resetExpenseForm(); }} title={editingExpense ? 'Edit Expense' : 'Add Expense'} maxWidth="max-w-xl">
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Description</label>
            <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="e.g. Dinner" className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none focus:border-[#4F82B2] transition-all" />
            {expErrors.desc && <p className="text-xs text-[#E05252] mt-1">{expErrors.desc}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Amount (₹)</label>
            <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="3000" className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none focus:border-[#4F82B2] transition-all" />
            {expErrors.amount && <p className="text-xs text-[#E05252] mt-1">{expErrors.amount}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Paid by</label>
              <select value={expPaidBy} onChange={e => setExpPaidBy(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none">
                {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Category</label>
              <select value={expCategory} onChange={e => setExpCategory(e.target.value as ExpenseCategory)} className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Date</label>
              <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Split</label>
              <select value={expSplitMethod} onChange={e => setExpSplitMethod(e.target.value as SplitMethod)} className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none">
                {SPLIT_METHODS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-2">Participants</label>
            {expErrors.participants && <p className="text-xs text-[#E05252] mb-2">{expErrors.participants}</p>}
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {members.map(m => (
                <div key={m.userId} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input type="checkbox" checked={expParticipants[m.userId] || false} onChange={e => setExpParticipants(prev => ({ ...prev, [m.userId]: e.target.checked }))} className="w-4 h-4 accent-[#4F82B2] rounded" />
                    <Avatar name={m.name} size="sm" />
                    <span className="text-sm text-[#111] dark:text-[#F5F5F2]">{m.name}</span>
                  </label>
                  {expParticipants[m.userId] && expSplitMethod === 'equal' && expAmountNum > 0 && (
                    <span className="text-xs text-[#777] dark:text-[#A5AAA4] font-medium">{formatCurrency(expAmountNum / selectedParticipants.length)}</span>
                  )}
                  {expParticipants[m.userId] && expSplitMethod === 'exact' && (
                    <input type="number" value={expExactAmounts[m.userId] || ''} onChange={e => setExpExactAmounts(prev => ({ ...prev, [m.userId]: e.target.value }))} placeholder="₹0" className="w-24 px-2 py-1.5 rounded-lg border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-sm text-right outline-none" />
                  )}
                  {expParticipants[m.userId] && expSplitMethod === 'percentage' && (
                    <input type="number" value={expPercentages[m.userId] || ''} onChange={e => setExpPercentages(prev => ({ ...prev, [m.userId]: e.target.value }))} placeholder="0%" className="w-20 px-2 py-1.5 rounded-lg border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-sm text-right outline-none" />
                  )}
                  {expParticipants[m.userId] && expSplitMethod === 'shares' && (
                    <input type="number" value={expShares[m.userId] || '1'} onChange={e => setExpShares(prev => ({ ...prev, [m.userId]: e.target.value }))} min="1" className="w-20 px-2 py-1.5 rounded-lg border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-sm text-right outline-none" />
                  )}
                </div>
              ))}
            </div>
            {/* Split validation */}
            {expSplitMethod === 'exact' && expAmountNum > 0 && (
              <p className={`text-xs mt-2 font-medium ${Math.abs(exactTotal - expAmountNum) < 0.01 ? 'text-[#22A06B]' : 'text-[#E05252]'}`}>
                Total: {formatCurrency(exactTotal)} / {formatCurrency(expAmountNum)} {Math.abs(exactTotal - expAmountNum) < 0.01 ? '✓' : ''}
              </p>
            )}
            {expSplitMethod === 'percentage' && (
              <p className={`text-xs mt-2 font-medium ${Math.abs(percentageTotal - 100) < 0.01 ? 'text-[#22A06B]' : 'text-[#E05252]'}`}>
                {percentageTotal}% {Math.abs(percentageTotal - 100) < 0.01 ? '✓' : '/ 100%'}
              </p>
            )}
            {expErrors.split && <p className="text-xs text-[#E05252] mt-1">{expErrors.split}</p>}
          </div>

          <button onClick={handleAddExpense} disabled={addingExpense} className="w-full py-3.5 rounded-xl bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] font-semibold text-sm disabled:opacity-50 hover:-translate-y-[1px] transition-all">
            {addingExpense ? 'Saving...' : editingExpense ? 'Update Expense' : 'Add Expense'}
          </button>
        </div>
      </Modal>

      {/* Expense Detail Modal */}
      <Modal isOpen={!!showExpenseDetail} onClose={() => setShowExpenseDetail(null)} title={showExpenseDetail?.description || 'Expense'}>
        {showExpenseDetail && (
          <div className="space-y-4 pt-2">
            <div className="text-center">
              <p className="text-3xl font-bold text-[#111] dark:text-[#F5F5F2]">{formatCurrency(showExpenseDetail.amount)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#777] dark:text-[#A5AAA4]">Paid by</span><p className="font-medium text-[#111] dark:text-[#F5F5F2]">{showExpenseDetail.paidByName}</p></div>
              <div><span className="text-[#777] dark:text-[#A5AAA4]">Category</span><p className="font-medium text-[#111] dark:text-[#F5F5F2]">{showExpenseDetail.category}</p></div>
              <div><span className="text-[#777] dark:text-[#A5AAA4]">Date</span><p className="font-medium text-[#111] dark:text-[#F5F5F2]">{new Date(showExpenseDetail.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
              <div><span className="text-[#777] dark:text-[#A5AAA4]">Split</span><p className="font-medium text-[#111] dark:text-[#F5F5F2] capitalize">{showExpenseDetail.splitMethod}</p></div>
            </div>
            <div>
              <p className="text-sm font-medium text-[#777] dark:text-[#A5AAA4] mb-2">Participants</p>
              <div className="space-y-2">
                {showExpenseDetail.participants.map(p => (
                  <div key={p.userId} className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF7] dark:bg-[#111210]">
                    <div className="flex items-center gap-2"><Avatar name={p.name} size="sm" /><span className="text-sm text-[#111] dark:text-[#F5F5F2]">{p.name}</span></div>
                    <span className="text-sm font-bold text-[#111] dark:text-[#F5F5F2]">{formatCurrency(p.shareAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowExpenseDetail(null); openExpenseModal(showExpenseDetail); }} className="flex-1 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] text-sm font-medium text-[#555] dark:text-[#A5AAA4] hover:bg-[#E7E7E2]/50 transition-all"><Edit3 size={14} className="inline mr-1" /> Edit</button>
              <button onClick={() => handleDeleteExpense(showExpenseDetail.id)} className="flex-1 py-3 rounded-xl border border-[#FDEEEE] dark:border-[#3a1a1a] text-sm font-medium text-[#E05252] hover:bg-[#FDEEEE] transition-all"><Trash2 size={14} className="inline mr-1" /> Delete</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={!!showPaymentModal} onClose={() => setShowPaymentModal(null)} title={showPaymentModal ? `Pay ${showPaymentModal.toUserName}` : ''}>
        {showPaymentModal && (
          <div className="space-y-4 pt-2">
            <div className="text-center">
              <p className="text-3xl font-bold text-[#111] dark:text-[#F5F5F2]">{formatCurrency(showPaymentModal.amount)}</p>
              <p className="text-sm text-[#777] dark:text-[#A5AAA4] mt-1">to {showPaymentModal.toUserName}</p>
            </div>
            <PaymentMethodsView userId={showPaymentModal.toUserId} onCopy={(text) => { copyToClipboard(text); showToast('Copied!'); }} onViewQR={(qr) => setShowQRViewer(qr)} />
            <button onClick={() => setShowConfirmPay(showPaymentModal)} className="w-full py-3.5 rounded-xl bg-[#22A06B] text-white font-semibold text-sm hover:-translate-y-[1px] transition-all">
              <CheckCircle size={14} className="inline mr-1" /> Mark as Paid
            </button>
          </div>
        )}
      </Modal>

      {/* QR Viewer */}
      <Modal isOpen={!!showQRViewer} onClose={() => setShowQRViewer('')} title="QR Code">
        {showQRViewer && (
          <div className="flex flex-col items-center pt-4">
            <img src={showQRViewer} alt="Payment QR Code" className="w-64 h-64 object-contain rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] mb-4" />
            {showPaymentModal && (
              <button onClick={() => { setShowQRViewer(''); setShowConfirmPay(showPaymentModal); }} className="w-full py-3.5 rounded-xl bg-[#22A06B] text-white font-semibold text-sm hover:-translate-y-[1px] transition-all">
                <CheckCircle size={14} className="inline mr-1" /> Mark as Paid
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm Pay */}
      <Modal isOpen={!!showConfirmPay} onClose={() => setShowConfirmPay(null)} title="Confirm Payment">
        {showConfirmPay && (
          <div className="space-y-4 pt-2 text-center">
            <p className="text-base text-[#111] dark:text-[#F5F5F2]">
              Have you paid <span className="font-bold">{formatCurrency(showConfirmPay.amount)}</span> to <span className="font-bold">{showConfirmPay.toUserName}</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmPay(null)} className="flex-1 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] text-sm font-medium text-[#555] dark:text-[#A5AAA4]">Cancel</button>
              <button onClick={() => handleMarkPaid(showConfirmPay)} className="flex-1 py-3 rounded-xl bg-[#22A06B] text-white text-sm font-semibold hover:-translate-y-[1px] transition-all">Confirm Payment</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reminder Modal */}
      <Modal isOpen={!!showReminderModal} onClose={() => setShowReminderModal(null)} title="Send Reminder">
        {showReminderModal && (
          <div className="space-y-4 pt-2">
            <div className="bg-[#F1EDE0] dark:bg-[#2A2C29] rounded-xl p-4">
              <p className="text-sm text-[#111] dark:text-[#F5F5F2] whitespace-pre-line">{showReminderModal.message}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={async () => { await copyToClipboard(showReminderModal.message); showToast('Copied!'); setShowReminderModal(null); }} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] text-sm font-medium text-[#111] dark:text-[#F5F5F2]">
                <Copy size={14} /> Copy
              </button>
              <button onClick={() => { shareWhatsApp(showReminderModal.message); setShowReminderModal(null); }} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white text-sm font-medium">
                <MessageCircle size={14} /> WhatsApp
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Details Modal */}
      <Modal isOpen={showPaymentDetails} onClose={() => setShowPaymentDetails(false)} title="My Payment Details">
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Mobile number</label>
            <input type="tel" value={pdMobile} onChange={e => setPdMobile(e.target.value)} placeholder="9876543210" maxLength={10} className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none focus:border-[#4F82B2] transition-all" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={pdCash} onChange={e => setPdCash(e.target.checked)} className="w-4 h-4 accent-[#22A06B] rounded" />
            <span className="text-sm text-[#111] dark:text-[#F5F5F2]">Accepts cash</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">QR Code</label>
            {pdQR ? (
              <div className="space-y-3">
                <img src={pdQR} alt="Your QR Code" className="w-40 h-40 object-contain rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29]" />
                <div className="flex gap-2">
                  <label className="px-4 py-2 text-xs font-medium border border-[#E7E7E2] dark:border-[#2A2C29] rounded-lg hover:bg-[#E7E7E2]/50 transition-colors cursor-pointer text-[#555] dark:text-[#A5AAA4]">
                    Replace
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQRUpload} className="hidden" />
                  </label>
                  <button onClick={handleDeleteQR} className="px-4 py-2 text-xs font-medium text-[#E05252] border border-[#FDEEEE] dark:border-[#3a1a1a] rounded-lg hover:bg-[#FDEEEE] transition-colors">Remove</button>
                </div>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-[#E7E7E2] dark:border-[#2A2C29] rounded-xl p-8 text-center hover:border-[#4F82B2] transition-colors">
                  <Upload size={28} className="mx-auto mb-2 text-[#777] dark:text-[#A5AAA4]" />
                  <p className="text-sm font-medium text-[#111] dark:text-[#F5F5F2]">Upload QR Code</p>
                  <p className="text-xs text-[#777] dark:text-[#A5AAA4] mt-1">PNG/JPG/WebP • 300KB max</p>
                </div>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQRUpload} className="hidden" />
              </label>
            )}
            {uploadingQR && <p className="text-xs text-[#4F82B2] mt-1">Uploading...</p>}
          </div>
          <button onClick={handleSavePaymentDetails} disabled={pdSaving} className="w-full py-3.5 rounded-xl bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] font-semibold text-sm disabled:opacity-50 transition-all">
            {pdSaving ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}

// Payment methods sub-component
function PaymentMethodsView({ userId, onCopy, onViewQR }: { userId: string; onCopy: (text: string) => void; onViewQR: (qr: string) => void }) {
  const [details, setDetails] = useState<any>(null);
  const [showMobile, setShowMobile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.getPaymentDetails(userId)
      .then(res => setDetails(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="py-4"><LoadingSkeleton type="line" /></div>;
  if (!details) return <p className="text-sm text-[#777] py-4">No payment details available.</p>;

  const hasMobile = !!details.mobile;
  const hasQR = !!details.qrImage;
  const hasCash = details.acceptsCash;

  if (!hasMobile && !hasQR && !hasCash) {
    return <p className="text-sm text-[#777] dark:text-[#A5AAA4] py-4 text-center">No payment details added yet.</p>;
  }

  return (
    <div className="space-y-3">
      {hasMobile && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FAFAF7] dark:bg-[#111210] border border-[#E7E7E2] dark:border-[#2A2C29]">
          <Phone size={16} className="text-[#4F82B2] shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-[#777] dark:text-[#A5AAA4]">Mobile number</p>
            <p className="text-sm font-medium text-[#111] dark:text-[#F5F5F2]">
              {showMobile ? details.mobile : maskMobile(details.mobile)}
            </p>
          </div>
          <button onClick={() => setShowMobile(!showMobile)} className="text-xs text-[#4F82B2] dark:text-[#6FA5D6] font-medium">{showMobile ? 'Hide' : 'Show'}</button>
          <button onClick={() => onCopy(details.mobile)} className="p-1.5 rounded-lg hover:bg-[#E7E7E2] dark:hover:bg-[#2A2C29] transition-colors"><Copy size={12} /></button>
        </div>
      )}
      {hasQR && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FAFAF7] dark:bg-[#111210] border border-[#E7E7E2] dark:border-[#2A2C29]">
          <QrCode size={16} className="text-[#4F82B2] shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-[#777] dark:text-[#A5AAA4]">QR Code</p>
            <p className="text-sm font-medium text-[#111] dark:text-[#F5F5F2]">Available</p>
          </div>
          <button onClick={() => onViewQR(details.qrImage)} className="text-xs text-[#4F82B2] dark:text-[#6FA5D6] font-medium">View QR</button>
        </div>
      )}
      {hasCash && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FAFAF7] dark:bg-[#111210] border border-[#E7E7E2] dark:border-[#2A2C29]">
          <Banknote size={16} className="text-[#22A06B] shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-[#777] dark:text-[#A5AAA4]">Cash</p>
            <p className="text-sm font-medium text-[#22A06B]">✓ Accepted</p>
          </div>
        </div>
      )}
    </div>
  );
}
