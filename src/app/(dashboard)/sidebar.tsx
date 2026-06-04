'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/auth/actions';
import type { User } from '@/lib/types/database';
import {
  LayoutDashboard,
  FileText,
  Users,
  Truck,
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
  Moon,
  Sun,
  Headset,
  CheckSquare,
  Wallet,
  IndianRupee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EzTripsLogo } from '@/components/eztrips-logo';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';

// Core nav — visible to all roles
const CORE_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/proposals', label: 'Proposals', icon: FileText },
  { href: '/bookings', label: 'Bookings', icon: ClipboardList },
  { href: '/leads', label: 'Enquiries', icon: Inbox },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
];

// Finance group — receivables, payables, accounts
const FINANCE_ITEMS = [
  { href: '/receivables', label: 'Receivables', icon: IndianRupee },
  { href: '/payables', label: 'Payables', icon: IndianRupee },
  { href: '/accounts/payments', label: 'Accounts', icon: Wallet, roles: ['accounts', 'manager', 'super_admin'] },
];

// Ops group — operations, approvals
const OPS_ITEMS = [
  { href: '/operations', label: 'Operations', icon: Headset, roles: ['operations', 'manager', 'super_admin'] },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare, roles: ['manager', 'super_admin'] },
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

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-8 w-8"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

function NavLink({ item, pathname, onNavigate, badge }: { item: NavItem; pathname: string; onNavigate?: () => void; badge?: number }) {
  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
      {badge != null && badge > 0 && (
        <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1">
          {badge}
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ user, onNavigate, overdueFollowUps = 0 }: { user: User; onNavigate?: () => void; overdueFollowUps?: number }) {
  const pathname = usePathname();
  const isAdmin = user.role === 'super_admin' || user.role === 'manager';

  const visibleOps = OPS_ITEMS.filter(i => !i.roles || i.roles.includes(user.role));
  const visibleFinance = FINANCE_ITEMS.filter(i => !i.roles || i.roles.includes(user.role));

  return (
    <>
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {CORE_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
            badge={item.href === '/leads' ? overdueFollowUps : undefined}
          />
        ))}

        {visibleFinance.length > 0 && (
          <>
            <p className="text-[11px] text-muted-foreground px-3 pt-3 pb-0.5 uppercase tracking-wider">Finance</p>
            {visibleFinance.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </>
        )}

        {visibleOps.length > 0 && (
          <>
            <p className="text-[11px] text-muted-foreground px-3 pt-3 pb-0.5 uppercase tracking-wider">Ops</p>
            {visibleOps.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <p className="text-[11px] text-muted-foreground px-3 pt-3 pb-0.5 uppercase tracking-wider">Admin</p>
            {ADMIN_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <p className="text-[11px] text-muted-foreground px-3 pt-3 pb-0.5 uppercase tracking-wider">Website CMS</p>
            {WEBSITE_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </>
        )}

        {/* Settings at the bottom of nav */}
        <div className="pt-2">
          <NavLink item={{ href: '/settings', label: 'Settings', icon: Settings }} pathname={pathname} onNavigate={onNavigate} />
        </div>
      </nav>
      <Separator />
      <div className="p-3 space-y-2 shrink-0">
        <div className="text-sm">
          <p className="font-medium truncate">{user.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <form action={signOut} className="flex-1">
            <Button variant="outline" size="sm" className="w-full" type="submit">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </form>
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}

export function Sidebar({ user, overdueFollowUps = 0 }: { user: User; overdueFollowUps?: number }) {
  return (
    <aside className="hidden md:flex w-64 bg-background border-r flex-col h-full overflow-hidden">
      <div className="p-4 shrink-0">
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
