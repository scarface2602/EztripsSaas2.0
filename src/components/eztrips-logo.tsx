import Image from 'next/image';
import { cn } from '@/lib/utils';

export function EzTripsLogo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 20, md: 28, lg: 36 };
  const textSizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' };
  const px = sizes[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image src="/logo-eztrips.png" alt="EzTrips" width={px} height={px} className="object-contain" />
      <span className={cn('font-bold tracking-tight', textSizes[size])}>EzTrips</span>
    </div>
  );
}
