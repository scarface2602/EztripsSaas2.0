// Role → permission map. Single source of truth for what each role can
// do, enforced in three layers: middleware (page paths), withAuth
// (API routes), and the sidebar (nav visibility).
//
// Changing what a role can do = editing ROLE_PERMISSIONS, nothing else.

import type { User } from '@/lib/types/database';

export type Role = User['role'];

export type Permission =
  | 'leads.manage'        // enquiries / CRM
  | 'proposals.manage'    // create, edit, publish, clone proposals
  | 'bookings.view'       // see bookings & trip data
  | 'bookings.manage'     // create/edit bookings (incl. offline & register entry)
  | 'ops.actions'         // supplier confirmations, item edits, vouchers, booking emails
  | 'payments.manage'     // record customer/supplier payments & schedules
  | 'accounts.manage'     // invoices, receipts, treasury, financial exports
  | 'clients.manage'      // create/edit clients & billing entities
  | 'suppliers.manage'    // supplier records & ledger
  | 'reports.view'        // financial reports
  | 'approvals.manage'    // manager approvals
  | 'admin.manage';       // users, org settings, imports, website CMS

const ALL: Permission[] = [
  'leads.manage', 'proposals.manage', 'bookings.view', 'bookings.manage',
  'ops.actions', 'payments.manage', 'accounts.manage', 'clients.manage',
  'suppliers.manage', 'reports.view', 'approvals.manage', 'admin.manage',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ALL,
  manager: ALL.filter((p) => p !== 'admin.manage'),
  // Sales: owns the lead → proposal funnel; sees bookings, doesn't run them.
  agent: ['leads.manage', 'proposals.manage', 'clients.manage', 'suppliers.manage', 'bookings.view'],
  // Ops: owns bookings/register/confirmations; never touches proposals or accounts.
  operations: ['bookings.view', 'bookings.manage', 'ops.actions', 'payments.manage', 'clients.manage', 'suppliers.manage'],
  // Accounts: money in/out, invoices, reports; no sales or ops mutations.
  accounts: ['bookings.view', 'payments.manage', 'accounts.manage', 'reports.view', 'clients.manage', 'suppliers.manage'],
};

export function hasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

/**
 * Dashboard path prefixes gated in middleware. First match wins;
 * order specific prefixes before general ones.
 */
export const PATH_PERMISSIONS: Array<{ prefix: string; permission: Permission }> = [
  { prefix: '/proposals', permission: 'proposals.manage' },
  { prefix: '/leads', permission: 'leads.manage' },
  { prefix: '/bookings/new-offline', permission: 'bookings.manage' },
  { prefix: '/operations', permission: 'ops.actions' },
  { prefix: '/ops', permission: 'ops.actions' },
  { prefix: '/accounts', permission: 'accounts.manage' },
  { prefix: '/reports', permission: 'reports.view' },
  { prefix: '/approvals', permission: 'approvals.manage' },
  { prefix: '/admin', permission: 'admin.manage' },
];

export function pathPermission(pathname: string): Permission | null {
  const match = PATH_PERMISSIONS.find(
    (p) => pathname === p.prefix || pathname.startsWith(p.prefix + '/'),
  );
  return match ? match.permission : null;
}
