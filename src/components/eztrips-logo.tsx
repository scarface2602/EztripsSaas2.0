import { cn } from '@/lib/utils';

export function EzTripsLogo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-5 w-5', md: 'h-6 w-6', lg: 'h-8 w-8' };
  const textSizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={sizes[size]}
      >
        <rect width="32" height="32" rx="6" fill="currentColor" className="text-primary" />
        <path
          d="M8 12L16 8L24 12L16 16L8 12Z"
          fill="white"
          opacity="0.9"
        />
        <path
          d="M8 12V20L16 24V16L8 12Z"
          fill="white"
          opacity="0.6"
        />
        <path
          d="M24 12V20L16 24V16L24 12Z"
          fill="white"
          opacity="0.75"
        />
      </svg>
      <span className={cn('font-bold tracking-tight', textSizes[size])}>EzTrips</span>
    </div>
  );
}
