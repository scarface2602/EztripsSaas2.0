'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/auth/actions';
import type { User } from '@/lib/types/database';
import {
  LayoutDashboard,
  FileText,
  Users,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  Settings,
  Shield,
  LogOut,
  Globe,
  Inbox,
  MapPin,
  BookOpen,
  ClipboardList,
  LayoutList,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EzTripsLogo } from '@/components/eztrips-logo';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/proposals', label: 'Proposals', icon: FileText },
  { href: '/bookings', label: 'Bookings', icon: ClipboardList },
  { href: '/leads', label: 'Enquiries', icon: Inbox },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/receivables', label: 'Receivables', icon: ArrowDownLeft },
  { href: '/payables', label: 'Payables', icon: ArrowUpRight },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const ADMIN_ITEMS = [
  { href: '/admin', label: 'Admin', icon: Shield },
  { href: '/admin/users', label: 'Team', icon: Users },
];

const WEBSITE_ITEMS = [
  { href: '/admin/website', label: 'Overview', icon: Globe },
  { href: '/admin/website/pages', label: 'Pages', icon: LayoutList },
  { href: '/admin/website/destinations', label: 'Destinations & Packages', icon: MapPin },
  { href: '/admin/website/blog', label: 'Blog', icon: BookOpen },
];

function SidebarNav({ user, onNavigate, overdueFollowUps = 0 }: { user: User; onNavigate?: () => void; overdueFollowUps?: number }) {
  const pathname = usePathname();

  const items = (user.role === 'super_admin' || user.role === 'manager')
    ? [...NAV_ITEMS, ...ADMIN_ITEMS]
    : NAV_ITEMS;

  return (
    <>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {item.href === '/leads' && overdueFollowUps > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                  {overdueFollowUps}
                </span>
              )}
            </Link>
          );
        })}
        {(user.role === 'super_admin' || user.role === 'manager') && (
          <>
            <p className="text-xs text-muted-foreground px-3 py-1 mt-4">Website CMS</p>
            {WEBSITE_ITEMS.map((item) => {
              const isActive = item.href === '/admin/website'
                ? pathname === '/admin/website'
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
      <Separator />
      <div className="p-4 space-y-3">
        <div className="text-sm">
          <p className="font-medium truncate">{user.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
        </div>
        <form action={signOut}>
          <Button variant="outline" size="sm" className="w-full" type="submit">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </form>
      </div>
    </>
  );
}

export function Sidebar({ user, overdueFollowUps = 0 }: { user: User; overdueFollowUps?: number }) {
  return (
    <aside className="hidden md:flex w-64 bg-background border-r flex-col h-full">
      <div className="p-4">
        <Link href="/"><EzTripsLogo /></Link>
      </div>
      <Separator />
      <SidebarNav user={user} overdueFollowUps={overdueFollowUps} />
    </aside>
  );
}

export function MobileHeader({ user, overdueFollowUps = 0 }: { user: User; overdueFollowUps?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden flex items-center gap-3 border-b bg-background px-4 py-3">
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </Button>
      <Link href="/"><EzTripsLogo /></Link>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="p-4">
            <Link href="/" onClick={() => setOpen(false)}><EzTripsLogo /></Link>
          </div>
          <Separator />
          <SidebarNav user={user} onNavigate={() => setOpen(false)} overdueFollowUps={overdueFollowUps} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
