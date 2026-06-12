import { describe, it, expect } from 'vitest';
import { hasPermission, pathPermission, ROLE_PERMISSIONS } from './permissions';

describe('role permissions', () => {
  it('super_admin can do everything', () => {
    for (const perm of ROLE_PERMISSIONS.super_admin) {
      expect(hasPermission('super_admin', perm)).toBe(true);
    }
    expect(hasPermission('super_admin', 'admin.manage')).toBe(true);
  });

  it('manager can do everything except admin', () => {
    expect(hasPermission('manager', 'proposals.manage')).toBe(true);
    expect(hasPermission('manager', 'accounts.manage')).toBe(true);
    expect(hasPermission('manager', 'admin.manage')).toBe(false);
  });

  it('agent owns the sales funnel but not ops or accounts', () => {
    expect(hasPermission('agent', 'leads.manage')).toBe(true);
    expect(hasPermission('agent', 'proposals.manage')).toBe(true);
    expect(hasPermission('agent', 'bookings.view')).toBe(true);
    expect(hasPermission('agent', 'bookings.manage')).toBe(false);
    expect(hasPermission('agent', 'ops.actions')).toBe(false);
    expect(hasPermission('agent', 'payments.manage')).toBe(false);
    expect(hasPermission('agent', 'accounts.manage')).toBe(false);
  });

  it('operations runs bookings but cannot create proposals or touch accounts', () => {
    expect(hasPermission('operations', 'bookings.manage')).toBe(true);
    expect(hasPermission('operations', 'ops.actions')).toBe(true);
    expect(hasPermission('operations', 'payments.manage')).toBe(true);
    expect(hasPermission('operations', 'proposals.manage')).toBe(false);
    expect(hasPermission('operations', 'leads.manage')).toBe(false);
    expect(hasPermission('operations', 'accounts.manage')).toBe(false);
  });

  it('accounts handles money but no sales or ops mutations', () => {
    expect(hasPermission('accounts', 'accounts.manage')).toBe(true);
    expect(hasPermission('accounts', 'payments.manage')).toBe(true);
    expect(hasPermission('accounts', 'reports.view')).toBe(true);
    expect(hasPermission('accounts', 'proposals.manage')).toBe(false);
    expect(hasPermission('accounts', 'bookings.manage')).toBe(false);
    expect(hasPermission('accounts', 'ops.actions')).toBe(false);
  });

  it('handles missing roles safely', () => {
    expect(hasPermission(undefined, 'leads.manage')).toBe(false);
    expect(hasPermission(null, 'leads.manage')).toBe(false);
  });
});

describe('path gating', () => {
  it('maps gated prefixes to permissions', () => {
    expect(pathPermission('/proposals')).toBe('proposals.manage');
    expect(pathPermission('/proposals/abc/preview')).toBe('proposals.manage');
    expect(pathPermission('/leads')).toBe('leads.manage');
    expect(pathPermission('/bookings/new-offline')).toBe('bookings.manage');
    expect(pathPermission('/accounts/payments')).toBe('accounts.manage');
    expect(pathPermission('/admin/users')).toBe('admin.manage');
  });

  it('does not gate open paths or partial-name matches', () => {
    expect(pathPermission('/bookings')).toBeNull();
    expect(pathPermission('/bookings/123')).toBeNull();
    expect(pathPermission('/clients')).toBeNull();
    expect(pathPermission('/leadsboard')).toBeNull(); // prefix must be a path segment
    expect(pathPermission('/')).toBeNull();
  });
});
