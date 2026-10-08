import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = 'Something went wrong.', onRetry }: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-[#FDEEEE] dark:bg-[#3a1a1a] flex items-center justify-center mb-5">
        <AlertTriangle size={28} className="text-[#E05252]" />
      </div>
      <h3 className="text-lg font-semibold text-[#111] dark:text-[#F5F5F2] mb-1">{message}</h3>
      <p className="text-sm text-[#777] dark:text-[#A5AAA4] mb-5">Please try again or check your connection.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1D1D1B] dark:bg-[#F5F5F2] dark:text-[#111] rounded-full hover:-translate-y-[1px] active:scale-[0.97] transition-all duration-150"
        >
          <RefreshCw size={15} />
          Try Again
        </button>
      )}
    </motion.div>
  );
}
