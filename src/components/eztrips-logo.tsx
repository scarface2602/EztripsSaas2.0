import Image from 'next/image';
import { cn } from '@/lib/utils';

export function EzTripsLogo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const heights = { sm: 28, md: 36, lg: 48 };
  const widths = { sm: 40, md: 51, lg: 68 };
  const textSizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image src="/logo-eztrips.png" alt="EzTrips" width={widths[size]} height={heights[size]} className="object-contain" />
      <span className={cn('font-bold tracking-tight', textSizes[size])}>EzTrips</span>
    </div>
  );
}
