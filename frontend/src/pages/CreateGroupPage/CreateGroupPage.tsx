import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, CheckCircle, Copy, MessageCircle, ArrowRight } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../hooks/useToast';
import { groupsApi } from '../../api/groups';
import { validateGroupName, validateMemberName } from '../../utils/validation';
import { getShareUrl, copyToClipboard, shareWhatsApp } from '../../utils/share';
import Avatar from '../../components/Avatar/Avatar';

interface MemberInput {
  id: string;
  name: string;
}

export default function CreateGroupPage() {
  const { user, createUser } = useUser();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [memberName, setMemberName] = useState('');
  const [members, setMembers] = useState<MemberInput[]>([]);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Success state
  const [success, setSuccess] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<any>(null);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardName, setOnboardName] = useState('');
  const [onboardLoading, setOnboardLoading] = useState(false);

  const addMember = () => {
    const err = validateMemberName(memberName);
    if (err) {
      setErrors(prev => ({ ...prev, member: err }));
      return;
    }
    if (members.some(m => m.name.toLowerCase() === memberName.trim().toLowerCase())) {
      setErrors(prev => ({ ...prev, member: 'Member already added' }));
      return;
    }
    setMembers(prev => [...prev, { id: Date.now().toString(), name: memberName.trim() }]);
    setMemberName('');
    setErrors(prev => ({ ...prev, member: '' }));
  };

  const removeMember = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleCreate = async () => {
    if (!user) {
      setShowOnboarding(true);
      return;
    }

    const nameErr = validateGroupName(groupName);
    if (nameErr) {
      setErrors(prev => ({ ...prev, name: nameErr }));
      return;
    }

    setCreating(true);
    try {
      const res = await groupsApi.create({
        name: groupName.trim(),
        description: description.trim(),
        createdBy: user.id,
        creatorName: user.name,
        members: members.map(m => ({ name: m.name })),
      });
      setCreatedGroup(res.data);
      setSuccess(true);
      showToast('Group created successfully!');
    } catch {
      showToast('Failed to create group. Please try again.', 'error');
    } finally {
      setCreating(false);
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
      showToast('Could not connect. Please try again.', 'error');
    } finally {
      setOnboardLoading(false);
    }
  };

  const inviteCode = createdGroup?.invite_code || createdGroup?.inviteCode || '';
  const shareUrl = getShareUrl(inviteCode);

  if (success && createdGroup) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto px-4 sm:px-6 pt-16 pb-20"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-16 h-16 rounded-full bg-[#E9F8F0] dark:bg-[#1a3a2a] flex items-center justify-center mx-auto mb-5"
          >
            <CheckCircle size={32} className="text-[#22A06B]" />
          </motion.div>

          <h1 className="text-2xl font-bold text-[#111] dark:text-[#F5F5F2] mb-1">Group created!</h1>
          <p className="text-lg font-semibold text-[#555] dark:text-[#A5AAA4] mb-6">{createdGroup.name}</p>

          <div className="bg-white dark:bg-[#1B1D1A] rounded-2xl border border-[#E7E7E2] dark:border-[#2A2C29] p-6 mb-6 text-left">
            <p className="text-xs font-medium text-[#777] dark:text-[#A5AAA4] uppercase tracking-wider mb-2">Invite your friends</p>
            <p className="text-2xl font-bold text-[#111] dark:text-[#F5F5F2] tracking-wide mb-3">{inviteCode}</p>
            <p className="text-sm text-[#777] dark:text-[#A5AAA4] break-all">{shareUrl}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={async () => {
                await copyToClipboard(shareUrl);
                showToast('Link copied!');
              }}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] hover:bg-[#E7E7E2]/50 dark:hover:bg-[#2A2C29]/50 transition-all text-[#111] dark:text-[#F5F5F2]"
            >
              <Copy size={15} /> Copy Link
            </button>
            <button
              onClick={() => shareWhatsApp(`Join my group "${createdGroup.name}" on fin! ${shareUrl}`)}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium rounded-xl bg-[#25D366] text-white hover:-translate-y-[1px] transition-all"
            >
              <MessageCircle size={15} /> WhatsApp
            </button>
            <button
              onClick={() => navigate(`/groups/${createdGroup.id}`)}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] hover:-translate-y-[1px] transition-all"
            >
              Open Group <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-lg mx-auto px-4 sm:px-6 pt-12 pb-20"
    >
      {/* Onboarding */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowOnboarding(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white dark:bg-[#1B1D1A] rounded-3xl p-8 w-full max-w-sm shadow-2xl">
            <h2 className="text-2xl font-bold text-[#111] dark:text-[#F5F5F2] mb-1">Welcome to fin 👋</h2>
            <p className="text-sm text-[#777] dark:text-[#A5AAA4] mb-6">What's your name?</p>
            <input type="text" value={onboardName} onChange={e => setOnboardName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleOnboard()} placeholder="Your name" autoFocus className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none focus:border-[#4F82B2] transition-all" aria-label="Your name" />
            <button onClick={handleOnboard} disabled={!onboardName.trim() || onboardLoading} className="mt-4 w-full py-3 rounded-xl bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] font-semibold text-sm disabled:opacity-50 transition-all">{onboardLoading ? 'Getting started...' : 'Continue'}</button>
          </motion.div>
        </div>
      )}

      <h1 className="text-3xl font-bold text-[#111] dark:text-[#F5F5F2] tracking-[-1px] mb-2">Create a group</h1>
      <p className="text-sm text-[#777] dark:text-[#A5AAA4] mb-8">Start splitting expenses with your friends.</p>

      <div className="space-y-5">
        {/* Group name */}
        <div>
          <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Group name</label>
          <input
            type="text"
            value={groupName}
            onChange={e => { setGroupName(e.target.value); setErrors(prev => ({ ...prev, name: '' })); }}
            placeholder="e.g. Goa Trip"
            className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none focus:border-[#4F82B2] focus:ring-2 focus:ring-[#4F82B2]/20 transition-all"
          />
          {errors.name && <p className="text-xs text-[#E05252] mt-1">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none focus:border-[#4F82B2] focus:ring-2 focus:ring-[#4F82B2]/20 transition-all"
          />
        </div>

        {/* Members */}
        <div>
          <label className="block text-sm font-medium text-[#111] dark:text-[#F5F5F2] mb-1.5">Members</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={memberName}
              onChange={e => { setMemberName(e.target.value); setErrors(prev => ({ ...prev, member: '' })); }}
              onKeyDown={e => e.key === 'Enter' && addMember()}
              placeholder="Member name"
              className="flex-1 px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none focus:border-[#4F82B2] focus:ring-2 focus:ring-[#4F82B2]/20 transition-all"
            />
            <button
              onClick={addMember}
              className="px-5 py-3 rounded-xl bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] text-sm font-medium hover:-translate-y-[1px] active:scale-[0.97] transition-all"
            >
              + Add
            </button>
          </div>
          {errors.member && <p className="text-xs text-[#E05252] mt-1">{errors.member}</p>}

          {/* Creator shown */}
          {user && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#EAF2F8] dark:bg-[#1a2a3a]">
                <Avatar name={user.name} size="sm" />
                <span className="text-sm font-medium text-[#111] dark:text-[#F5F5F2] flex-1">{user.name}</span>
                <span className="text-xs text-[#4F82B2] font-medium">You</span>
              </div>
            </div>
          )}

          {/* Added members */}
          {members.length > 0 && (
            <div className="mt-2 space-y-2">
              {members.map(m => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-[#1B1D1A] border border-[#E7E7E2] dark:border-[#2A2C29]"
                >
                  <Avatar name={m.name} size="sm" />
                  <span className="text-sm font-medium text-[#111] dark:text-[#F5F5F2] flex-1">{m.name}</span>
                  <button onClick={() => removeMember(m.id)} className="p-1 rounded-full hover:bg-[#FDEEEE] dark:hover:bg-[#3a1a1a] transition-colors" aria-label={`Remove ${m.name}`}>
                    <X size={14} className="text-[#E05252]" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-3.5 rounded-xl bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] font-semibold text-sm hover:-translate-y-[1px] active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    </motion.div>
  );
}
