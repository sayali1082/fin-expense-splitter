import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const icons = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const styles = {
  success: 'bg-[#E9F8F0] text-[#22A06B] dark:bg-[#1a3a2a] dark:text-[#4CD99A]',
  error: 'bg-[#FDEEEE] text-[#E05252] dark:bg-[#3a1a1a] dark:text-[#FF7A7A]',
  warning: 'bg-[#FFF6DF] text-[#D99A25] dark:bg-[#3a3019] dark:text-[#F0B44A]',
  info: 'bg-[#EAF2F8] text-[#4F82B2] dark:bg-[#1a2a3a] dark:text-[#6FA5D6]',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-[380px]">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg ${styles[toast.type]} backdrop-blur-sm`}
          >
            <span className="shrink-0">{icons[toast.type]}</span>
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
