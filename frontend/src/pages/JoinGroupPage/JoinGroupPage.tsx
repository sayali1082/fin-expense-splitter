import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ArrowRight, Loader2 } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../hooks/useToast';
import { groupsApi } from '../../api/groups';
import { validateInviteCode } from '../../utils/validation';
import { formatCurrency, formatSignedCurrency } from '../../utils/currency';
import Avatar from '../../components/Avatar/Avatar';
import LoadingSkeleton from '../../components/LoadingSkeleton/LoadingSkeleton';
import EmptyState from '../../components/EmptyState/EmptyState';
import type { GroupSummary } from '../../types';

export default function JoinGroupPage() {
  const { inviteCode: paramCode } = useParams();
  const { user, createUser } = useUser();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [inviteCode, setInviteCode] = useState(paramCode || '');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  // Preview state for invite link
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joinedGroupId, setJoinedGroupId] = useState('');

  // User groups
  const [userGroups, setUserGroups] = useState<GroupSummary[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardName, setOnboardName] = useState('');
  const [onboardLoading, setOnboardLoading] = useState(false);

  // Load preview if invite code in URL
  useEffect(() => {
    if (paramCode) {
      loadPreview(paramCode);
    }
  }, [paramCode]);

  // Load user's groups
  useEffect(() => {
    if (user) {
      setGroupsLoading(true);
      groupsApi.getUserGroups(user.id)
        .then(res => setUserGroups(res.data))
        .catch(() => {})
        .finally(() => setGroupsLoading(false));
    }
  }, [user]);

  const loadPreview = async (code: string) => {
    setPreviewLoading(true);
    setError('');
    try {
      const res = await groupsApi.getByInviteCode(code);
      setPreview(res.data);
    } catch {
      setError('Invalid invite code. Please check and try again.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      setShowOnboarding(true);
      return;
    }

    const code = inviteCode.trim() || paramCode || '';
    const err = validateInviteCode(code);
    if (err) { setError(err); return; }

    setJoining(true);
    setError('');
    try {
      const res = await groupsApi.join({
        inviteCode: code,
        userId: user.id,
        userName: user.name,
      });
      if (res.data.alreadyMember) {
        setAlreadyMember(true);
        setJoinedGroupId(res.data.groupId);
        showToast("You've already joined this group.");
      } else {
        showToast('Group joined successfully!');
        navigate(`/groups/${res.data.groupId}`);
      }
    } catch {
      setError('Could not join. Please check the code and try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleOnboard = async () => {
    if (!onboardName.trim()) return;
    setOnboardLoading(true);
    try {
      await createUser(onboardName.trim());
      showToast(`Welcome, ${onboardName.trim()}! 👋`);
      setShowOnboarding(false);
    } catch {
      showToast('Could not connect.', 'error');
    } finally {
      setOnboardLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-4 sm:px-6 pt-12 pb-20"
    >
      {/* Onboarding */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowOnboarding(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white dark:bg-[#1B1D1A] rounded-3xl p-8 w-full max-w-sm shadow-2xl">
            <h2 className="text-2xl font-bold text-[#111] dark:text-[#F5F5F2] mb-1">Welcome to fin 👋</h2>
            <p className="text-sm text-[#777] dark:text-[#A5AAA4] mb-6">What's your name?</p>
            <input type="text" value={onboardName} onChange={e => setOnboardName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleOnboard()} placeholder="Your name" autoFocus className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none focus:border-[#4F82B2] transition-all" />
            <button onClick={handleOnboard} disabled={!onboardName.trim() || onboardLoading} className="mt-4 w-full py-3 rounded-xl bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] font-semibold text-sm disabled:opacity-50 transition-all">{onboardLoading ? 'Getting started...' : 'Continue'}</button>
          </motion.div>
        </div>
      )}

      <h1 className="text-3xl font-bold text-[#111] dark:text-[#F5F5F2] tracking-[-1px] mb-2">Join a group</h1>
      <p className="text-sm text-[#777] dark:text-[#A5AAA4] mb-8">Enter a group code or open a shared invite.</p>

      {/* Preview from invite link */}
      {paramCode && preview && !previewLoading && (
        <div className="bg-white dark:bg-[#1B1D1A] rounded-2xl border border-[#E7E7E2] dark:border-[#2A2C29] p-5 mb-6">
          <h3 className="text-lg font-bold text-[#111] dark:text-[#F5F5F2] mb-1">{preview.name}</h3>
          {preview.description && <p className="text-sm text-[#777] dark:text-[#A5AAA4] mb-3">{preview.description}</p>}
          <div className="flex items-center gap-2 text-sm text-[#555] dark:text-[#A5AAA4] mb-3">
            <Users size={14} />
            <span>{preview.memberCount || preview.members?.length || 0} members</span>
          </div>
          {preview.members && (
            <div className="flex -space-x-2 mb-4">
              {preview.members.slice(0, 5).map((m: any) => (
                <Avatar key={m.userId} name={m.name} size="sm" />
              ))}
              {preview.members.length > 5 && (
                <div className="w-8 h-8 rounded-full bg-[#E7E7E2] dark:bg-[#2A2C29] flex items-center justify-center text-xs font-medium">
                  +{preview.members.length - 5}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-[#777] dark:text-[#A5AAA4]">Invite code: <span className="font-mono font-bold">{paramCode}</span></p>
        </div>
      )}

      {previewLoading && <div className="mb-6"><LoadingSkeleton type="card" /></div>}

      {alreadyMember ? (
        <div className="text-center py-8">
          <p className="text-lg font-semibold text-[#111] dark:text-[#F5F5F2] mb-4">You've already joined this group.</p>
          <button onClick={() => navigate(`/groups/${joinedGroupId}`)} className="px-6 py-3 bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] rounded-xl font-semibold text-sm hover:-translate-y-[1px] transition-all">
            Open Group <ArrowRight size={15} className="inline ml-1" />
          </button>
        </div>
      ) : (
        <>
          {!paramCode && (
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={inviteCode}
                onChange={e => { setInviteCode(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="FIN-AB12CD"
                className="flex-1 px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm font-mono outline-none focus:border-[#4F82B2] focus:ring-2 focus:ring-[#4F82B2]/20 transition-all"
              />
            </div>
          )}

          {error && <p className="text-sm text-[#E05252] mb-4">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3.5 rounded-xl bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] font-semibold text-sm hover:-translate-y-[1px] active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {joining ? 'Joining...' : 'Join Group'}
          </button>
        </>
      )}

      {/* Previously created/joined groups */}
      {user && (
        <div className="mt-12">
          <h2 className="text-lg font-bold text-[#111] dark:text-[#F5F5F2] mb-4">Previously Created / Joined Groups</h2>
          {groupsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <LoadingSkeleton key={i} type="card" />)}
            </div>
          ) : userGroups.length === 0 ? (
            <EmptyState title="No groups yet" subtitle="Create or join a group to get started." />
          ) : (
            <div className="space-y-3">
              {userGroups.map((g, i) => (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white dark:bg-[#1B1D1A] rounded-2xl border border-[#E7E7E2] dark:border-[#2A2C29] p-4 hover:-translate-y-[2px] hover:shadow-lg transition-all duration-200 cursor-pointer"
                  onClick={() => navigate(`/groups/${g.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-[#111] dark:text-[#F5F5F2]">{g.name}</h3>
                      <p className="text-xs text-[#777] dark:text-[#A5AAA4] mt-0.5">{g.memberCount} members</p>
                    </div>
                    <div className="text-right">
                      {g.balance > 0 ? (
                        <>
                          <p className="text-sm font-bold text-[#22A06B]">{formatSignedCurrency(g.balance)}</p>
                          <p className="text-xs text-[#22A06B]">You receive</p>
                        </>
                      ) : g.balance < 0 ? (
                        <>
                          <p className="text-sm font-bold text-[#E05252]">{formatSignedCurrency(g.balance)}</p>
                          <p className="text-xs text-[#E05252]">You owe</p>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-[#777] dark:text-[#A5AAA4]">Settled</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
