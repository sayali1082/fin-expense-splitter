export default function LoadingSkeleton({ type = 'card' }: { type?: 'card' | 'line' | 'circle' | 'expense' | 'member' }) {
  const pulse = 'animate-pulse bg-[#E7E7E2] dark:bg-[#2A2C29] rounded-xl';

  if (type === 'line') {
    return <div className={`${pulse} h-4 w-full`} />;
  }

  if (type === 'circle') {
    return <div className={`${pulse} w-10 h-10 rounded-full`} />;
  }

  if (type === 'member') {
    return (
      <div className="flex items-center gap-3 p-3">
        <div className={`${pulse} w-10 h-10 rounded-full`} />
        <div className="flex-1 space-y-2">
          <div className={`${pulse} h-4 w-24`} />
          <div className={`${pulse} h-3 w-16`} />
        </div>
      </div>
    );
  }

  if (type === 'expense') {
    return (
      <div className="p-4 rounded-2xl border border-[#E7E7E2] dark:border-[#2A2C29] space-y-3">
        <div className="flex justify-between">
          <div className={`${pulse} h-5 w-32`} />
          <div className={`${pulse} h-5 w-20`} />
        </div>
        <div className={`${pulse} h-3 w-48`} />
        <div className={`${pulse} h-3 w-36`} />
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl border border-[#E7E7E2] dark:border-[#2A2C29] space-y-3">
      <div className={`${pulse} h-5 w-40`} />
      <div className={`${pulse} h-4 w-28`} />
      <div className={`${pulse} h-4 w-full`} />
      <div className={`${pulse} h-10 w-32 mt-2`} />
    </div>
  );
}
