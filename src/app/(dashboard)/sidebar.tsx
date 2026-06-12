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
  UploadCloud,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  CreditCard,
  BarChart3,
  NotebookText,
  HandCoins,
  Landmark,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EzTripsLogo } from '@/components/eztrips-logo';
import { GlobalSearch } from '@/components/global-search';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';

// ── Workspace Groups ────────────────────────────────────

const SALES_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Enquiries', icon: Inbox, roles: ['agent', 'manager', 'super_admin'] },
  { href: '/proposals', label: 'Proposals', icon: FileText, roles: ['agent', 'manager', 'super_admin'] },
  { href: '/bookings', label: 'Bookings', icon: ClipboardList },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
];

const OPS_ITEMS = [
  { href: '/register', label: 'Register', icon: NotebookText, roles: ['operations', 'accounts', 'manager', 'super_admin'] },
  { href: '/operations', label: 'Operations', icon: Headset, roles: ['operations', 'manager', 'super_admin'] },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare, roles: ['manager', 'super_admin'] },
];

const FINANCE_ITEMS = [
  { href: '/accounts/receivables', label: 'Receivables', icon: HandCoins, roles: ['accounts', 'manager', 'super_admin'] },
  { href: '/accounts/tax-rules', label: 'Tax Rules', icon: Landmark, roles: ['accounts', 'manager', 'super_admin'] },
  { href: '/accounts/exports', label: 'Exports', icon: Download, roles: ['accounts', 'manager', 'super_admin'] },
  { href: '/accounts', label: 'Treasury', icon: Wallet, roles: ['accounts', 'manager', 'super_admin'] },
  { href: '/accounts/payments', label: 'Payments', icon: CreditCard, roles: ['accounts', 'manager', 'super_admin'] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['accounts', 'manager', 'super_admin'] },
];

const ADMIN_ITEMS = [
  { href: '/admin', label: 'Admin', icon: Shield },
  { href: '/admin/users', label: 'Team', icon: Users },
  { href: '/admin/import', label: 'Import Data', icon: UploadCloud },
];

const WEBSITE_ITEMS = [
  { href: '/admin/website', label: 'Overview', icon: Globe },
  { href: '/admin/website/homepage', label: 'Homepage & Reviews', icon: LayoutDashboard },
  { href: '/admin/website/pages', label: 'Pages', icon: LayoutList },
  { href: '/admin/website/destinations', label: 'Destinations & Packages', icon: MapPin },
  { href: '/admin/website/blog', label: 'Blog', icon: BookOpen },
];

// ── Components ──────────────────────────────────────────

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

function NavLink({ item, pathname, onNavigate, badge, collapsible = false }: { item: NavItem; pathname: string; onNavigate?: () => void; badge?: number; collapsible?: boolean }) {
  const isActive = item.href === '/'
    ? pathname === '/'
    : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={item.label}
      className={cn(
        'flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn(collapsible && 'hidden group-hover/sidebar:inline')}>{item.label}</span>
      {badge != null && badge > 0 && (
        <span className={cn('ml-auto bg-red-500 text-white text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1', collapsible && 'hidden group-hover/sidebar:flex')}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function CollapsibleGroup({
  label,
  icon: Icon,
  items,
  pathname,
  isOpen,
  onToggle,
  onNavigate,
  userRole,
  overdueFollowUps,
  collapsible = false,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  userRole: string;
  overdueFollowUps?: number;
  collapsible?: boolean;
}) {
  const visibleItems = items.filter(i => !i.roles || i.roles.includes(userRole));
  if (visibleItems.length === 0) return null;

  return (
    <div>
      <button
        onClick={onToggle}
        title={label}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors',
          isOpen ? 'text-foreground bg-muted/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className={cn(collapsible && 'hidden group-hover/sidebar:inline')}>{label}</span>
        <span className={cn('ml-auto', collapsible && 'hidden group-hover/sidebar:inline')}>
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
      </button>
      {isOpen && (
        <div className="mt-0.5 space-y-0.5 pl-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
              badge={item.href === '/leads' ? overdueFollowUps : undefined}
              collapsible={collapsible}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarNav({ user, onNavigate, overdueFollowUps = 0, collapsible = false }: { user: User; onNavigate?: () => void; overdueFollowUps?: number; collapsible?: boolean }) {
  const pathname = usePathname();
  const isAdmin = user.role === 'super_admin' || user.role === 'manager';

  // Auto-expand the group matching the current route
  const isSalesRoute = pathname === '/' || pathname.startsWith('/proposals') || pathname.startsWith('/leads') || pathname.startsWith('/clients') || pathname.startsWith('/suppliers') || pathname.startsWith('/bookings');
  const isOpsRoute = pathname.startsWith('/operations') || pathname.startsWith('/approvals');
  const isFinanceRoute = pathname.startsWith('/accounts');

  const [salesOpen, setSalesOpen] = useState(isSalesRoute);
  const [opsOpen, setOpsOpen] = useState(isOpsRoute);
  const [financeOpen, setFinanceOpen] = useState(isFinanceRoute);

  return (
    <>
      <nav className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className={cn('pb-1', collapsible && 'hidden group-hover/sidebar:block')}>
          <GlobalSearch />
        </div>
        <CollapsibleGroup
          label="Sales & Growth"
          icon={TrendingUp}
          items={SALES_ITEMS}
          pathname={pathname}
          isOpen={salesOpen}
          onToggle={() => setSalesOpen(!salesOpen)}
          onNavigate={onNavigate}
          userRole={user.role}
          overdueFollowUps={overdueFollowUps}
          collapsible={collapsible}
        />

        <CollapsibleGroup
          label="Operations"
          icon={Headset}
          items={OPS_ITEMS}
          pathname={pathname}
          isOpen={opsOpen}
          onToggle={() => setOpsOpen(!opsOpen)}
          onNavigate={onNavigate}
          userRole={user.role}
          collapsible={collapsible}
        />

        <CollapsibleGroup
          label="Finance & Treasury"
          icon={BarChart3}
          items={FINANCE_ITEMS}
          pathname={pathname}
          isOpen={financeOpen}
          onToggle={() => setFinanceOpen(!financeOpen)}
          onNavigate={onNavigate}
          userRole={user.role}
          collapsible={collapsible}
        />

        {isAdmin && (
          <>
            <p className={cn('text-[11px] text-muted-foreground px-3 pt-3 pb-0.5 uppercase tracking-wider', collapsible && 'hidden group-hover/sidebar:block')}>Admin</p>
            {ADMIN_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} collapsible={collapsible} />
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <p className={cn('text-[11px] text-muted-foreground px-3 pt-3 pb-0.5 uppercase tracking-wider', collapsible && 'hidden group-hover/sidebar:block')}>Website CMS</p>
            {WEBSITE_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} collapsible={collapsible} />
            ))}
          </>
        )}

        {/* Settings at the bottom of nav */}
        <div className="pt-2">
          <NavLink item={{ href: '/settings', label: 'Settings', icon: Settings }} pathname={pathname} onNavigate={onNavigate} collapsible={collapsible} />
        </div>
      </nav>
      <Separator />
      <div className={cn('p-3 space-y-2 shrink-0', collapsible && 'hidden group-hover/sidebar:block')}>
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
    <aside className="group/sidebar hidden md:flex w-[64px] hover:w-[240px] transition-all duration-300 ease-in-out bg-background border-r flex-col h-full overflow-hidden z-50 absolute md:relative shadow-none hover:shadow-lg">
      <div className="p-3 shrink-0 flex items-center justify-center group-hover/sidebar:p-4 group-hover/sidebar:justify-start transition-all duration-300">
        <Link href="/"><EzTripsLogo /></Link>
      </div>
      <Separator />
      <SidebarNav user={user} overdueFollowUps={overdueFollowUps} collapsible />
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
