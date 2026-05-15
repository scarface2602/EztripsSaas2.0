import Image from 'next/image';
import { cn } from '@/lib/utils';

export function EzTripsLogo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const heights = { sm: 32, md: 40, lg: 52 };
  const widths = { sm: 90, md: 120, lg: 150 };

  return (
    <div className={cn('flex items-center', className)}>
      <Image src="/logo-eztrips.png" alt="EzTrips" width={widths[size]} height={heights[size]} className="object-contain" />
    </div>
  );
}
