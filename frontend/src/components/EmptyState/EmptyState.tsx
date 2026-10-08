import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-[#F1EDE0] dark:bg-[#2A2C29] flex items-center justify-center mb-5">
        {icon || <Inbox size={28} className="text-[#777] dark:text-[#A5AAA4]" />}
      </div>
      <h3 className="text-lg font-semibold text-[#111] dark:text-[#F5F5F2] mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-[#777] dark:text-[#A5AAA4] mb-5 max-w-[300px]">{subtitle}</p>}
      {action && <div>{action}</div>}
    </motion.div>
  );
}
