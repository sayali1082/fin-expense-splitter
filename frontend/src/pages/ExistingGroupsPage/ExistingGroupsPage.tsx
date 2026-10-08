import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Receipt, ArrowRight, Plus } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../hooks/useToast';
import { groupsApi } from '../../api/groups';
import { formatCurrency, formatSignedCurrency } from '../../utils/currency';
import LoadingSkeleton from '../../components/LoadingSkeleton/LoadingSkeleton';
import EmptyState from '../../components/EmptyState/EmptyState';
import ErrorState from '../../components/ErrorState/ErrorState';
import type { GroupSummary } from '../../types';

export default function ExistingGroupsPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchGroups = () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    groupsApi.getUserGroups(user.id)
      .then(res => setGroups(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchGroups(); }, [user]);

  if (!user) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">
        <EmptyState
          title="Sign in to see your groups"
          subtitle="Create or join a group to get started."
          action={<button onClick={() => navigate('/')} className="px-6 py-3 bg-[#1D1D1B] text-white rounded-xl font-semibold text-sm">Go Home</button>}
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111] dark:text-[#F5F5F2] tracking-[-1px]">Your groups</h1>
          <p className="text-sm text-[#777] dark:text-[#A5AAA4] mt-1">All your created and joined groups.</p>
        </div>
        <button
          onClick={() => navigate('/create-group')}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] rounded-full text-sm font-medium hover:-translate-y-[1px] transition-all"
        >
          <Plus size={15} /> New Group
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => <LoadingSkeleton key={i} type="card" />)}
        </div>
      ) : error ? (
        <ErrorState onRetry={fetchGroups} />
      ) : groups.length === 0 ? (
        <EmptyState
          title="You haven't joined any groups yet."
          subtitle="Create or join a group to start splitting expenses."
          action={<button onClick={() => navigate('/create-group')} className="px-6 py-3 bg-[#5C8FBE] text-white rounded-xl font-semibold text-sm hover:-translate-y-[1px] transition-all">Create Group</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => navigate(`/groups/${g.id}`)}
              className="bg-white dark:bg-[#1B1D1A] rounded-2xl border border-[#E7E7E2] dark:border-[#2A2C29] p-5 cursor-pointer hover:-translate-y-[3px] hover:shadow-lg transition-all duration-200 group"
            >
              <h3 className="text-base font-bold text-[#111] dark:text-[#F5F5F2] mb-2">{g.name}</h3>
              <div className="flex items-center gap-4 text-xs text-[#777] dark:text-[#A5AAA4] mb-3">
                <span className="flex items-center gap-1"><Users size={12} /> {g.memberCount} members</span>
                <span className="flex items-center gap-1"><Receipt size={12} /> {g.expenseCount} expenses</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  {g.balance > 0 ? (
                    <div>
                      <p className="text-sm font-bold text-[#22A06B]">{formatSignedCurrency(g.balance)}</p>
                      <p className="text-xs text-[#22A06B]">You receive</p>
                    </div>
                  ) : g.balance < 0 ? (
                    <div>
                      <p className="text-sm font-bold text-[#E05252]">{formatSignedCurrency(g.balance)}</p>
                      <p className="text-xs text-[#E05252]">You owe</p>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-[#777] dark:text-[#A5AAA4]">Settled</p>
                  )}
                </div>
                <div className="w-8 h-8 rounded-full bg-[#EAF2F8] dark:bg-[#1a2a3a] flex items-center justify-center group-hover:bg-[#5C8FBE] group-hover:text-white transition-colors">
                  <ArrowRight size={14} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
