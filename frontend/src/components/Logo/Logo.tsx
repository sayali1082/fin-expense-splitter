export default function Logo({ size = 'default' }: { size?: 'small' | 'default' }) {
  const iconSize = size === 'small' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  const textSize = size === 'small' ? 'text-lg' : 'text-xl';

  return (
    <a href="/" className="flex items-center gap-2 select-none group">
      <div className={`${iconSize} bg-[#4F82B2] rounded-lg flex items-center justify-center font-extrabold text-white group-hover:scale-105 transition-transform duration-150`}>
        f
      </div>
      <span className={`${textSize} font-extrabold tracking-tight text-[#111] dark:text-[#F5F5F2]`}>
        fin
      </span>
    </a>
  );
}
