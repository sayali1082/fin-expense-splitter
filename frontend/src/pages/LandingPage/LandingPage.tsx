import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../hooks/useToast';

export default function LandingPage() {
  const { user, createUser } = useUser();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGetStarted = () => {
    if (user) {
      navigate('/create-group');
    } else {
      setShowOnboarding(true);
    }
  };

  const handleOnboard = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createUser(name.trim());
      showToast(`Welcome to fin, ${name.trim()}! 👋`);
      setShowOnboarding(false);
      navigate('/create-group');
    } catch {
      showToast('Could not connect to server. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowOnboarding(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white dark:bg-[#1B1D1A] rounded-3xl p-8 w-full max-w-sm shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-[#111] dark:text-[#F5F5F2] mb-1">Welcome to fin 👋</h2>
            <p className="text-sm text-[#777] dark:text-[#A5AAA4] mb-6">What's your name?</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleOnboard()}
              placeholder="Your name"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-[#E7E7E2] dark:border-[#2A2C29] bg-white dark:bg-[#111210] text-[#111] dark:text-[#F5F5F2] text-sm outline-none focus:border-[#4F82B2] focus:ring-2 focus:ring-[#4F82B2]/20 transition-all"
              aria-label="Your name"
            />
            <button
              onClick={handleOnboard}
              disabled={!name.trim() || loading}
              className="mt-4 w-full py-3 rounded-xl bg-[#1D1D1B] dark:bg-[#F5F5F2] text-white dark:text-[#111] font-semibold text-sm hover:-translate-y-[1px] active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Getting started...' : 'Continue'}
            </button>
          </motion.div>
        </div>
      )}

      {/* Hero */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-16 pt-16 sm:pt-24 lg:pt-32 pb-20">
        {/* Left - Text */}
        <div className="flex-1 max-w-xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-[#111] dark:text-[#F5F5F2] leading-[1.1] tracking-[-1.5px] mb-5"
          >
            Bhai paise wapas bhi{' '}
            <br className="hidden sm:block" />
            karne hote hai yrr
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-base sm:text-lg text-[#555] dark:text-[#A5AAA4] leading-relaxed mb-8 max-w-md"
          >
            Split expenses, settle up, and keep shared
            <br className="hidden sm:block" />
            life simple with fin.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center gap-4"
          >
            <span className="text-sm font-medium text-[#777] dark:text-[#A5AAA4] italic">Jaldi karo</span>
            <button
              onClick={handleGetStarted}
              className="group flex items-center gap-2 px-7 py-3.5 bg-[#5C8FBE] hover:bg-[#4F82B2] text-white font-semibold text-sm rounded-full shadow-lg shadow-[#5C8FBE]/25 hover:-translate-y-[2px] active:scale-[0.97] transition-all duration-200"
            >
              Create Group
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </motion.div>
        </div>

        {/* Right - Illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex-shrink-0"
        >
          <div className="w-[280px] sm:w-[320px] lg:w-[345px] h-[320px] sm:h-[360px] lg:h-[390px] bg-[#F1EDE0] dark:bg-[#2A2C29] rounded-[28px] flex items-center justify-center relative overflow-hidden">
            {/* Sparkles */}
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-8 right-10"
            >
              <Sparkles size={16} className="text-[#E9AA35]" />
            </motion.div>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.15, 1] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className="absolute top-16 left-10"
            >
              <Sparkles size={12} className="text-[#E9AA35]" />
            </motion.div>

            {/* Mascot */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative z-10"
            >
              {/* Mascot body */}
              <svg width="120" height="140" viewBox="0 0 120 140" fill="none">
                {/* Shadow */}
                <ellipse cx="60" cy="135" rx="35" ry="5" fill="#00000015" />
                {/* Body */}
                <ellipse cx="60" cy="80" rx="38" ry="45" fill="#F4513E" />
                {/* Belly */}
                <ellipse cx="60" cy="88" rx="25" ry="30" fill="#F9766B" />
                {/* Left eye */}
                <circle cx="47" cy="68" r="6" fill="white" />
                <circle cx="49" cy="67" r="3" fill="#111" />
                <circle cx="50" cy="66" r="1" fill="white" />
                {/* Right eye */}
                <circle cx="73" cy="68" r="6" fill="white" />
                <circle cx="75" cy="67" r="3" fill="#111" />
                <circle cx="76" cy="66" r="1" fill="white" />
                {/* Smile */}
                <path d="M50 82 Q60 92 70 82" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                {/* Left arm */}
                <ellipse cx="25" cy="85" rx="10" ry="7" fill="#F4513E" transform="rotate(-15 25 85)" />
                {/* Right arm */}
                <ellipse cx="95" cy="85" rx="10" ry="7" fill="#F4513E" transform="rotate(15 95 85)" />
                {/* Left foot */}
                <ellipse cx="45" cy="122" rx="12" ry="6" fill="#F4513E" />
                {/* Right foot */}
                <ellipse cx="75" cy="122" rx="12" ry="6" fill="#F4513E" />
              </svg>
            </motion.div>

            {/* Coins */}
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              className="absolute bottom-16 left-8"
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="16" fill="#E9AA35" stroke="#D4911A" strokeWidth="2" />
                <text x="18" y="23" textAnchor="middle" fill="#fff" fontWeight="800" fontSize="14">₹</text>
              </svg>
            </motion.div>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
              className="absolute bottom-24 right-8"
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="12" fill="#E9AA35" stroke="#D4911A" strokeWidth="2" />
                <text x="14" y="18" textAnchor="middle" fill="#fff" fontWeight="800" fontSize="11">₹</text>
              </svg>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
