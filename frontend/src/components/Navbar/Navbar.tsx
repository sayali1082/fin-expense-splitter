import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Plus, UserPlus, FolderOpen } from 'lucide-react';
import Logo from '../Logo/Logo';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { to: '/create-group', label: 'Create Group', icon: <Plus size={15} /> },
    { to: '/join', label: 'Join Group', icon: <UserPlus size={15} /> },
    { to: '/groups', label: 'Existing Groups', icon: <FolderOpen size={15} /> },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-40 bg-[#FAFAF7]/90 dark:bg-[#111210]/90 backdrop-blur-lg border-b border-[#E8E8E3] dark:border-[#2A2C29]"
    >
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between">
        <Logo />

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1D1D1B] dark:text-[#F5F5F2] bg-transparent hover:bg-[#E7E7E2] dark:hover:bg-[#2A2C29] rounded-full transition-all duration-150 hover:-translate-y-[1px]"
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-xl hover:bg-[#E7E7E2] dark:hover:bg-[#2A2C29] transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-[#E8E8E3] dark:border-[#2A2C29] bg-[#FAFAF7] dark:bg-[#111210] overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-2">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#1D1D1B] dark:text-[#F5F5F2] hover:bg-[#E7E7E2] dark:hover:bg-[#2A2C29] rounded-2xl transition-colors"
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 pl-4">
                <ThemeToggle />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
