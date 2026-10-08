export default function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors = [
    'bg-[#EAF2F8] text-[#4F82B2]',
    'bg-[#E9F8F0] text-[#22A06B]',
    'bg-[#FFF6DF] text-[#D99A25]',
    'bg-[#FDEEEE] text-[#E05252]',
    'bg-[#F1EDE0] text-[#8B7355]',
    'bg-[#E8E0F0] text-[#7B5FA0]',
  ];

  const index = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' };
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={`${sizes[size]} ${colors[index]} rounded-full flex items-center justify-center font-bold shrink-0 select-none`}
      aria-label={name}
    >
      {initial}
    </div>
  );
}
